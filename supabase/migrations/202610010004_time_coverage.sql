-- Contrato 004: autorización explícita de cobertura, registro de tiempo y reaperturas.
-- Aplicar después de 001-003. Sin cambios al frontend ni conexiones remotas.
begin;

-- No escoger arbitrariamente un responsable si la instalación ya contiene una
-- tarea con cronómetros concurrentes. El error aborta toda esta migración.
do $$ declare conflicts text; begin
  select string_agg(instance_id::text, ', ' order by instance_id::text) into conflicts
  from (select instance_id from public.task_time_sessions where ended_at is null group by instance_id having count(distinct actor_id)>1) x;
  if conflicts is not null then raise exception 'Preflight 004: tareas con varios cronómetros activos: %',conflicts; end if;
end $$;

alter table public.employee_absences add constraint employee_absence_identity unique(id,organization_id);
create table public.employee_absence_companies(
  absence_id uuid not null, organization_id uuid not null, company_id uuid not null,
  primary key(absence_id,company_id),
  foreign key(absence_id,organization_id) references public.employee_absences(id,organization_id),
  foreign key(company_id,organization_id) references public.companies(id,organization_id)
);
alter table public.task_time_sessions add column absence_id uuid;
alter table public.task_time_sessions add constraint session_absence_identity foreign key(absence_id,organization_id) references public.employee_absences(id,organization_id);
create unique index one_open_session_per_instance on public.task_time_sessions(instance_id) where ended_at is null;
alter table public.task_instances add column state_revision bigint not null default 0 check(state_revision>=0);

create table public.task_reopen_events(
  id uuid primary key default gen_random_uuid(), organization_id uuid not null, instance_id uuid not null,
  actor_id uuid references public.profiles(id), at timestamptz not null default now(), reason text not null,
  source text not null check(source in ('explicit','legacy_transition')), legacy_audit_id bigint unique,
  foreign key(instance_id,organization_id) references public.task_instances(id,organization_id),
  check((source='explicit' and actor_id is not null and legacy_audit_id is null and length(trim(reason))>0) or
        (source='legacy_transition' and legacy_audit_id is not null and length(trim(reason))>0))
);
insert into public.task_reopen_events(organization_id,instance_id,actor_id,at,reason,source,legacy_audit_id)
select e.organization_id,e.entity_id,case when exists(select 1 from public.profiles p where p.id=e.actor_id) then e.actor_id else null end,e.at,'Transición histórica sin motivo registrado','legacy_transition',e.id
from public.audit_events e join public.task_instances t on t.id=e.entity_id and t.organization_id=e.organization_id
where e.action='task.transition' and e.details->>'from'='Completada' and e.details->>'to'<>'Completada'
on conflict(legacy_audit_id) do nothing;
create table public.task_mutation_receipts(
  organization_id uuid not null, actor_id uuid not null, operation_id uuid not null,
  operation_kind text not null, arguments jsonb not null, result jsonb not null, created_at timestamptz not null default now(),
  primary key(actor_id,operation_id), foreign key(actor_id,organization_id) references public.profiles(id,organization_id)
);

alter table public.employee_absence_companies enable row level security;
alter table public.task_reopen_events enable row level security;
alter table public.task_mutation_receipts enable row level security;
drop policy absences_read on public.employee_absences;
create policy absences_read on public.employee_absences for select to authenticated using(organization_id=public.actor_org() and (owner_id=auth.uid() or replacement_id=auth.uid()));
create policy absence_companies_read on public.employee_absence_companies for select to authenticated using(exists(select 1 from public.employee_absences a where a.id=employee_absence_companies.absence_id and a.organization_id=employee_absence_companies.organization_id and (a.owner_id=auth.uid() or a.replacement_id=auth.uid())));
create policy reopen_events_read on public.task_reopen_events for select to authenticated using(public.can_access_instance(instance_id));
create policy own_session_read on public.task_time_sessions for select to authenticated using(actor_id=auth.uid() or public.can_access_instance(instance_id));
revoke all on public.employee_absence_companies,public.task_reopen_events,public.task_mutation_receipts from anon,authenticated;
grant select on public.employee_absence_companies,public.task_reopen_events to authenticated;

create or replace function public.can_cover_instance(p_instance uuid) returns boolean
language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.task_instances t join public.profiles a on a.id=auth.uid() and a.active and a.organization_id=t.organization_id
    join public.employee_absences x on x.owner_id=t.owner_id and x.organization_id=t.organization_id and x.replacement_id=a.id and x.cancelled_at is null
    join public.employee_absence_companies c on c.absence_id=x.id and c.organization_id=x.organization_id and c.company_id=t.company_id
    join public.profiles o on o.id=t.owner_id and o.active and o.organization_id=t.organization_id
    join public.company_memberships am on am.profile_id=a.id and am.company_id=t.company_id and am.organization_id=t.organization_id
    join public.company_memberships om on om.profile_id=o.id and om.company_id=t.company_id and om.organization_id=t.organization_id
    where t.id=p_instance and a.role in ('empleado','encargado')
      and (now() at time zone 'America/Argentina/Buenos_Aires')::date between x.starts_on and x.ends_on
      and t.period between date_trunc('month',x.starts_on)::date and date_trunc('month',x.ends_on)::date)
$$;
create or replace function public.can_access_instance(p_instance_id uuid) returns boolean
language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.task_instances t where t.id=p_instance_id and
    ((public.can_access_owner(t.owner_id) and (public.actor_role()='jefe' or exists(select 1 from public.company_memberships m where m.profile_id=auth.uid() and m.company_id=t.company_id)))
     or public.can_cover_instance(p_instance_id)))
$$;

-- RPCs serializan mutaciones por actor y propietario/mes. Los receipt guardan
-- únicamente operaciones nuevas; las interfaces históricas siguen disponibles.
create function public._get_mutation_receipt(p_kind text,p_args jsonb,p_operation uuid) returns jsonb
language plpgsql security definer set search_path='' as $$declare r public.task_mutation_receipts; org uuid; begin
  if p_operation is null then raise exception 'Identificador de operación requerido'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(auth.uid()::text||p_operation::text,0));
  select * into r from public.task_mutation_receipts where actor_id=auth.uid() and operation_id=p_operation;
  if found then if r.operation_kind<>p_kind or r.arguments<>p_args then raise exception 'Identificador de operación reutilizado con otros argumentos'; end if; return r.result; end if;
  org:=public.actor_org(); if org is null then raise exception 'Sin permiso'; end if;
  return null;
end$$;
create function public._save_mutation_receipt(p_kind text,p_args jsonb,p_operation uuid,p_result jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$begin
  insert into public.task_mutation_receipts(organization_id,actor_id,operation_id,operation_kind,arguments,result)
    values(public.actor_org(),auth.uid(),p_operation,p_kind,p_args,p_result); return p_result;
end$$;

create function public.approve_employee_absence(p_owner uuid,p_replacement uuid,p_kind text,p_starts date,p_ends date,p_company_ids uuid[],p_note text,p_operation_id uuid) returns uuid
language plpgsql security definer set search_path='' as $$
declare org uuid; new_id uuid; cached jsonb; c uuid; mgr uuid; begin
  cached:=public._get_mutation_receipt('approve_absence',jsonb_build_object('owner',p_owner,'replacement',p_replacement,'kind',p_kind,'starts',p_starts,'ends',p_ends,'companies',p_company_ids,'note',p_note),p_operation_id);
  if cached is not null then return (cached->>'id')::uuid; end if;
  perform public.require_privileged_session(); org:=public.actor_org();
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('work-owner:'||p_owner::text,0));
  if p_kind not in ('vacaciones','licencia') or p_starts is null or p_ends<p_starts or nullif(trim(coalesce(p_note,'')),'') is null then raise exception 'Datos de ausencia inválidos'; end if;
  if not exists(select 1 from public.profiles where id=p_owner and organization_id=org and active) then raise exception 'Titular inválido'; end if;
  if public.actor_role()<>'jefe' then
    if not public.can_access_owner(p_owner) then raise exception 'Fuera del ámbito del encargado'; end if;
    if p_replacement is not null and not public.can_access_owner(p_replacement) then raise exception 'El reemplazante está fuera del ámbito del encargado'; end if;
    if exists(select 1 from unnest(coalesce(p_company_ids,'{}'::uuid[])) cid where not exists(select 1 from public.company_memberships m where m.profile_id=auth.uid() and m.company_id=cid and m.organization_id=org)) then raise exception 'Empresa fuera del ámbito'; end if;
  end if;
  if p_replacement is not null and (p_replacement=p_owner or not exists(select 1 from public.profiles where id=p_replacement and organization_id=org and active and role in ('empleado','encargado'))) then raise exception 'Reemplazante inválido'; end if;
  if p_replacement is not null and (coalesce(cardinality(p_company_ids),0)=0 or cardinality(p_company_ids)<>(select count(distinct x) from unnest(p_company_ids) x)) then raise exception 'Seleccione empresas sin repetir'; end if;
  if p_replacement is null and coalesce(cardinality(p_company_ids),0)>0 then raise exception 'Sin reemplazante no se habilitan empresas'; end if;
  if p_replacement is not null and exists(select 1 from unnest(p_company_ids) cid where not exists(select 1 from public.company_memberships m where m.profile_id=p_owner and m.company_id=cid and m.organization_id=org) or not exists(select 1 from public.company_memberships m where m.profile_id=p_replacement and m.company_id=cid and m.organization_id=org)) then raise exception 'Ambos deben pertenecer a las empresas seleccionadas'; end if;
  if p_replacement is not null and exists(select 1 from public.employee_absences where owner_id=p_owner and cancelled_at is null and daterange(starts_on,ends_on,'[]') && daterange(p_starts,p_ends,'[]')) then raise exception 'La ausencia se superpone con otra'; end if;
  if p_replacement is not null and public.actor_role()<>'jefe' and exists(select 1 from public.task_instances t where t.owner_id=p_owner and t.company_id=any(p_company_ids) and not public.can_access_owner(t.owner_id)) then raise exception 'Fuera del ámbito'; end if;
  insert into public.employee_absences(organization_id,owner_id,replacement_id,kind,starts_on,ends_on,note,approved_by) values(org,p_owner,p_replacement,p_kind,p_starts,p_ends,trim(p_note),auth.uid()) returning id into new_id;
  foreach c in array coalesce(p_company_ids,'{}'::uuid[]) loop insert into public.employee_absence_companies values(new_id,org,c); end loop;
  insert into public.audit_events(organization_id,actor_id,action,entity_id,details) values(org,auth.uid(),'absence.approved',new_id,jsonb_build_object('owner',p_owner,'replacement',p_replacement,'companies',coalesce(to_jsonb(p_company_ids),'[]'::jsonb)));
  perform public._save_mutation_receipt('approve_absence',jsonb_build_object('owner',p_owner,'replacement',p_replacement,'kind',p_kind,'starts',p_starts,'ends',p_ends,'companies',p_company_ids,'note',p_note),p_operation_id,jsonb_build_object('id',new_id)); return new_id;
end$$;

create function public.cancel_employee_absence(p_absence uuid,p_reason text,p_operation_id uuid) returns void
language plpgsql security definer set search_path='' as $$declare a public.employee_absences; cached jsonb; cutoff timestamptz; begin
  cached:=public._get_mutation_receipt('cancel_absence',jsonb_build_object('absence',p_absence,'reason',p_reason),p_operation_id); if cached is not null then return; end if;
  perform public.require_privileged_session(); select * into a from public.employee_absences where id=p_absence and organization_id=public.actor_org();
  if not found or not public.can_access_owner(a.owner_id) or nullif(trim(p_reason),'') is null then raise exception 'Ausencia o motivo inválido'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('work-owner:'||a.owner_id::text,0));
  select * into a from public.employee_absences where id=p_absence and organization_id=public.actor_org() for update;
  cutoff:=now();
  if exists(select 1 from public.task_time_sessions s join public.task_instances t on t.id=s.instance_id where s.absence_id=a.id and s.ended_at is null and exists(select 1 from public.monthly_closures c where c.owner_id=t.owner_id and c.period=t.period)) then raise exception 'No se puede cancelar una cobertura con mes cerrado'; end if;
  update public.employee_absences set cancelled_at=cutoff where id=a.id and cancelled_at is null;
  update public.task_time_sessions set ended_at=cutoff where absence_id=a.id and ended_at is null;
  insert into public.audit_events(organization_id,actor_id,action,entity_id,details) values(a.organization_id,auth.uid(),'absence.cancelled',a.id,jsonb_build_object('reason',trim(p_reason),'cancelled_at',cutoff));
  perform public._save_mutation_receipt('cancel_absence',jsonb_build_object('absence',p_absence,'reason',p_reason),p_operation_id,'{}'::jsonb);
end$$;

create function public.start_task_timer(p_instance uuid,p_expected_revision bigint,p_operation_id uuid,p_switch boolean default false) returns uuid
language plpgsql security definer set search_path='' as $$
declare t public.task_instances; s public.task_time_sessions; old public.task_time_sessions; result jsonb; absence uuid; now_at timestamptz:=now(); owner_lock uuid; source_owner uuid; source_period date; begin
  result:=public._get_mutation_receipt('start_timer',jsonb_build_object('instance',p_instance,'revision',p_expected_revision,'switch',p_switch),p_operation_id); if result is not null then return (result->>'session_id')::uuid; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('timer-actor:'||auth.uid()::text,0));
  if not public.can_access_instance(p_instance) or public.actor_role()='auditor' then raise exception 'Sin permiso'; end if;
  select * into t from public.task_instances where id=p_instance;
  select * into old from public.task_time_sessions where actor_id=auth.uid() and ended_at is null;
  if old.id is not null then select owner_id,period into source_owner,source_period from public.task_instances where id=old.instance_id; end if;
  for owner_lock in select distinct x.owner_id from (values(t.owner_id),(source_owner)) x(owner_id) where x.owner_id is not null order by x.owner_id loop
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('work-owner:'||owner_lock::text,0));
  end loop;
  if source_owner is not null and source_owner=t.owner_id and source_period=t.period then perform public.lock_open_month(t.owner_id,t.period);
  elsif source_owner is not null and (source_owner::text||source_period::text)<(t.owner_id::text||t.period::text) then perform public.lock_open_month(source_owner,source_period); perform public.lock_open_month(t.owner_id,t.period);
  else perform public.lock_open_month(t.owner_id,t.period); if source_owner is not null then perform public.lock_open_month(source_owner,source_period); end if; end if;
  select * into t from public.task_instances where id=p_instance for update;
  if t.state_revision<>p_expected_revision then raise exception 'La tarea cambió; actualice antes de continuar'; end if;
  if t.status='Completada' or t.blocked_by is not null then raise exception 'La tarea no admite cronómetro'; end if;
  select * into s from public.task_time_sessions where instance_id=t.id and ended_at is null;
  if found then if s.actor_id<>auth.uid() then raise exception 'La tarea tiene otro ejecutor activo'; end if; return s.id; end if;
  select * into old from public.task_time_sessions where actor_id=auth.uid() and ended_at is null for update;
  if found and not p_switch then raise exception 'Pause su cronómetro actual o solicite el cambio'; end if;
  if public.can_access_owner(t.owner_id) then absence:=null; else
    select a.id into absence from public.employee_absences a join public.employee_absence_companies c on c.absence_id=a.id and c.company_id=t.company_id where a.owner_id=t.owner_id and a.replacement_id=auth.uid() and a.cancelled_at is null and (now_at at time zone 'America/Argentina/Buenos_Aires')::date between a.starts_on and a.ends_on and t.period between date_trunc('month',a.starts_on)::date and date_trunc('month',a.ends_on)::date limit 1;
    if absence is null then raise exception 'Cobertura vencida o sin autorización para esta empresa'; end if;
  end if;
  if old.id is not null then update public.task_time_sessions set ended_at=least(now_at,public._effective_session_end(old.id,now_at)) where id=old.id; end if;
  if t.status='Pendiente' then update public.task_instances set status='En curso',started_at=coalesce(started_at,now_at),state_revision=state_revision+1 where id=t.id; end if;
  if t.status='En curso' then update public.task_instances set state_revision=state_revision+1 where id=t.id; end if;
  insert into public.task_time_sessions(organization_id,instance_id,actor_id,started_at,absence_id) values(t.organization_id,t.id,auth.uid(),now_at,absence) returning id into s.id;
  perform public._save_mutation_receipt('start_timer',jsonb_build_object('instance',p_instance,'revision',p_expected_revision,'switch',p_switch),p_operation_id,jsonb_build_object('session_id',s.id)); return s.id;
end$$;

create function public._effective_session_end(p_session uuid,p_proposed timestamptz) returns timestamptz
language sql stable security definer set search_path='' as $$select least(p_proposed,coalesce(a.cancelled_at,((a.ends_on+1)::timestamp at time zone 'America/Argentina/Buenos_Aires'))) from public.task_time_sessions s left join public.employee_absences a on a.id=s.absence_id where s.id=p_session$$;

create function public.pause_task_timer(p_session uuid,p_operation_id uuid) returns timestamptz
language plpgsql security definer set search_path='' as $$declare s public.task_time_sessions; cached jsonb; ended timestamptz; begin
  cached:=public._get_mutation_receipt('pause_timer',jsonb_build_object('session',p_session),p_operation_id); if cached is not null then return (cached->>'ended_at')::timestamptz; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('timer-actor:'||auth.uid()::text,0));
  select * into s from public.task_time_sessions where id=p_session and actor_id=auth.uid() for update;
  if not found then raise exception 'Sesión propia no encontrada'; end if;
  if s.ended_at is not null then ended:=s.ended_at; else ended:=public._effective_session_end(s.id,now()); update public.task_time_sessions set ended_at=ended where id=s.id; update public.task_instances set state_revision=state_revision+1 where id=s.instance_id and not exists(select 1 from public.monthly_closures c where c.owner_id=task_instances.owner_id and c.period=task_instances.period); end if;
  perform public._save_mutation_receipt('pause_timer',jsonb_build_object('session',p_session),p_operation_id,jsonb_build_object('ended_at',ended)); return ended;
end$$;

create function public.set_task_wait(p_instance uuid,p_note text,p_expected_revision bigint,p_operation_id uuid) returns bigint
language plpgsql security definer set search_path='' as $$declare t public.task_instances; cached jsonb; v bigint; s public.task_time_sessions; begin
  cached:=public._get_mutation_receipt('task_wait',jsonb_build_object('instance',p_instance,'note',p_note,'revision',p_expected_revision),p_operation_id); if cached is not null then return (cached->>'revision')::bigint; end if;
  if p_note='' then raise exception 'La espera requiere una descripción o NULL para desbloquear'; end if;
  if not public.can_access_instance(p_instance) or public.actor_role()='auditor' then raise exception 'Sin permiso'; end if;
  select * into t from public.task_instances where id=p_instance; perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('work-owner:'||t.owner_id::text,0)); perform public.lock_open_month(t.owner_id,t.period);
  select * into t from public.task_instances where id=p_instance for update; if t.state_revision<>p_expected_revision then raise exception 'La tarea cambió'; end if;
  select * into s from public.task_time_sessions where instance_id=t.id and ended_at is null;
  if s.id is not null then if s.actor_id<>auth.uid() and (public.actor_role()<>'jefe' and not (public.actor_role()='encargado' and public.can_access_owner(t.owner_id))) then raise exception 'No puede interrumpir al ejecutor'; end if; update public.task_time_sessions set ended_at=public._effective_session_end(id,now()) where id=s.id; end if;
  update public.task_instances set blocked_by=case when p_note is null then null else trim(p_note) end,blocked_since=case when p_note is null then null else (now() at time zone 'America/Argentina/Buenos_Aires')::date end,state_revision=state_revision+1 where id=t.id returning state_revision into v;
  perform public._save_mutation_receipt('task_wait',jsonb_build_object('instance',p_instance,'note',p_note,'revision',p_expected_revision),p_operation_id,jsonb_build_object('revision',v)); return v;
end$$;

create function public.transition_task_reviewed(p_instance uuid,p_next text,p_reason text,p_expected_revision bigint,p_operation_id uuid) returns bigint
language plpgsql security definer set search_path='' as $$declare t public.task_instances; cached jsonb; v bigint; s public.task_time_sessions; begin
  cached:=public._get_mutation_receipt('transition_reviewed',jsonb_build_object('instance',p_instance,'next',p_next,'reason',p_reason,'revision',p_expected_revision),p_operation_id); if cached is not null then return (cached->>'revision')::bigint; end if;
  if p_next not in ('Pendiente','En curso','Completada') then raise exception 'Estado inválido'; end if;
  if not public.can_access_instance(p_instance) or public.actor_role()='auditor' then raise exception 'Sin permiso'; end if;
  select * into t from public.task_instances where id=p_instance; perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('work-owner:'||t.owner_id::text,0)); perform public.lock_open_month(t.owner_id,t.period);
  select * into t from public.task_instances where id=p_instance for update; if t.state_revision<>p_expected_revision then raise exception 'La tarea cambió'; end if;
  if t.status=p_next then perform public._save_mutation_receipt('transition_reviewed',jsonb_build_object('instance',p_instance,'next',p_next,'reason',p_reason,'revision',p_expected_revision),p_operation_id,jsonb_build_object('revision',t.state_revision)); return t.state_revision; end if;
  if t.status='Completada' and p_next<>'Completada' and nullif(trim(coalesce(p_reason,'')),'') is null then raise exception 'La reapertura requiere motivo'; end if;
  if p_next='Completada' and (t.kind='operativa' or t.status='Pendiente' or t.blocked_by is not null or exists(select 1 from jsonb_array_elements(t.checklist) c where coalesce((c->>'done')::boolean,false)=false)) then raise exception 'Transición inválida o controles pendientes'; end if;
  select * into s from public.task_time_sessions where instance_id=t.id and ended_at is null;
  if s.id is not null and s.actor_id<>auth.uid() and (p_next in ('Pendiente','Completada') or p_next='En curso') and not (public.actor_role()='jefe' or (public.actor_role()='encargado' and public.can_access_owner(t.owner_id))) then raise exception 'No puede interrumpir al ejecutor'; end if;
  if p_next='En curso' and t.status='Pendiente' then
    if s.id is not null then raise exception 'La tarea ya tiene un ejecutor'; end if;
    if exists(select 1 from public.task_time_sessions where actor_id=auth.uid() and ended_at is null) then raise exception 'Pause su cronómetro actual antes de iniciar'; end if;
    insert into public.task_time_sessions(organization_id,instance_id,actor_id,started_at,absence_id) values(t.organization_id,t.id,auth.uid(),now(),case when public.can_access_owner(t.owner_id) then null else (select a.id from public.employee_absences a join public.employee_absence_companies c on c.absence_id=a.id and c.company_id=t.company_id where a.owner_id=t.owner_id and a.replacement_id=auth.uid() and a.cancelled_at is null and (now() at time zone 'America/Argentina/Buenos_Aires')::date between a.starts_on and a.ends_on limit 1) end);
  end if;
  if p_next in ('Pendiente','Completada') and s.id is not null then update public.task_time_sessions set ended_at=public._effective_session_end(id,now()) where id=s.id; end if;
  if t.status='Completada' and p_next<>'Completada' then insert into public.task_reopen_events(organization_id,instance_id,actor_id,reason,source) values(t.organization_id,t.id,auth.uid(),trim(p_reason),'explicit'); end if;
  update public.task_instances set status=p_next,started_at=case when p_next='En curso' then coalesce(started_at,now()) else started_at end,completed_at=case when p_next='Completada' then now() else null end,state_revision=state_revision+1 where id=t.id returning state_revision into v;
  insert into public.audit_events(organization_id,actor_id,action,entity_id,details) values(t.organization_id,auth.uid(),'task.transition',t.id,jsonb_build_object('from',t.status,'to',p_next,'reason',p_reason));
  perform public._save_mutation_receipt('transition_reviewed',jsonb_build_object('instance',p_instance,'next',p_next,'reason',p_reason,'revision',p_expected_revision),p_operation_id,jsonb_build_object('revision',v)); return v;
end$$;

create or replace function public.transition_task(p_instance_id uuid,next_status text) returns void
language plpgsql security definer set search_path='' as $$declare t public.task_instances; begin select * into t from public.task_instances where id=p_instance_id; if not found then raise exception 'Sin permiso'; end if; perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('work-owner:'||t.owner_id::text,0)); perform public.lock_open_month(t.owner_id,t.period); perform public.transition_task_reviewed(p_instance_id,next_status,null,t.state_revision,gen_random_uuid()); end$$;

create function public.set_checklist_item_reviewed(p_instance uuid,p_check text,p_done boolean,p_reason text,p_expected_revision bigint,p_operation_id uuid) returns bigint
language plpgsql security definer set search_path='' as $$declare t public.task_instances; updated jsonb; next_status text; v bigint; cached jsonb; s public.task_time_sessions; begin
  cached:=public._get_mutation_receipt('checklist_reviewed',jsonb_build_object('instance',p_instance,'check',p_check,'done',p_done,'reason',p_reason,'revision',p_expected_revision),p_operation_id); if cached is not null then return (cached->>'revision')::bigint; end if;
  if not public.can_access_instance(p_instance) or public.actor_role()='auditor' then raise exception 'Sin permiso'; end if;
  select * into t from public.task_instances where id=p_instance; perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('work-owner:'||t.owner_id::text,0)); perform public.lock_open_month(t.owner_id,t.period);
  select * into t from public.task_instances where id=p_instance for update; if t.state_revision<>p_expected_revision then raise exception 'La tarea cambió'; end if;
  if p_done is null or not exists(select 1 from jsonb_array_elements(t.checklist) x where x->>'id'=p_check) then raise exception 'Paso inválido'; end if;
  if exists(select 1 from jsonb_array_elements(t.checklist) x where x->>'id'=p_check and coalesce((x->>'done')::boolean,false)=p_done) then perform public._save_mutation_receipt('checklist_reviewed',jsonb_build_object('instance',p_instance,'check',p_check,'done',p_done,'reason',p_reason,'revision',p_expected_revision),p_operation_id,jsonb_build_object('revision',t.state_revision)); return t.state_revision; end if;
  if t.status='Completada' and nullif(trim(coalesce(p_reason,'')),'') is null then raise exception 'La reapertura requiere motivo'; end if;
  select jsonb_agg(case when x->>'id'=p_check then jsonb_set(x,'{done}',to_jsonb(p_done)) else x end order by pos) into updated from jsonb_array_elements(t.checklist) with ordinality items(x,pos);
  next_status:=case when t.status='Completada' then 'En curso' when p_done and t.status='Pendiente' then 'En curso' else t.status end;
  if p_done and t.kind='resultado' and t.blocked_by is null and not exists(select 1 from jsonb_array_elements(updated) x where coalesce((x->>'done')::boolean,false)=false) then next_status:='Completada'; end if;
  if t.status='Pendiente' and next_status='En curso' then
    if exists(select 1 from public.task_time_sessions where actor_id=auth.uid() and ended_at is null) then raise exception 'Pause su cronómetro actual antes de iniciar'; end if;
    if exists(select 1 from public.task_time_sessions where instance_id=t.id and ended_at is null) then raise exception 'La tarea ya tiene un ejecutor'; end if;
    insert into public.task_time_sessions(organization_id,instance_id,actor_id,started_at,absence_id) values(t.organization_id,t.id,auth.uid(),now(),case when public.can_access_owner(t.owner_id) then null else (select a.id from public.employee_absences a join public.employee_absence_companies c on c.absence_id=a.id and c.company_id=t.company_id where a.owner_id=t.owner_id and a.replacement_id=auth.uid() and a.cancelled_at is null and (now() at time zone 'America/Argentina/Buenos_Aires')::date between a.starts_on and a.ends_on limit 1) end);
  end if;
  if next_status in ('Completada','Pendiente') then select * into s from public.task_time_sessions where instance_id=t.id and ended_at is null; if s.id is not null then update public.task_time_sessions set ended_at=public._effective_session_end(id,now()) where id=s.id; end if; end if;
  if t.status='Completada' then insert into public.task_reopen_events(organization_id,instance_id,actor_id,reason,source) values(t.organization_id,t.id,auth.uid(),trim(p_reason),'explicit'); end if;
  update public.task_instances set checklist=updated,status=next_status,started_at=case when next_status='En curso' then coalesce(started_at,now()) else started_at end,completed_at=case when next_status='Completada' then now() else null end,state_revision=state_revision+1 where id=t.id returning state_revision into v;
  insert into public.audit_events(organization_id,actor_id,action,entity_id,details) values(t.organization_id,auth.uid(),'task.checklist',t.id,jsonb_build_object('step',p_check,'done',p_done,'reason',p_reason));
  perform public._save_mutation_receipt('checklist_reviewed',jsonb_build_object('instance',p_instance,'check',p_check,'done',p_done,'reason',p_reason,'revision',p_expected_revision),p_operation_id,jsonb_build_object('revision',v)); return v;
end$$;
create or replace function public.set_checklist_item(p_instance_id uuid,p_check_id text,p_done boolean) returns void
language plpgsql security definer set search_path='' as $$declare t public.task_instances; begin select * into t from public.task_instances where id=p_instance_id; if not found then raise exception 'Sin permiso'; end if; perform public.set_checklist_item_reviewed(p_instance_id,p_check_id,p_done,null,t.state_revision,gen_random_uuid()); end$$;

create or replace function public.create_catalog_assignment(p_template uuid,p_company uuid,p_owner uuid,p_team uuid,p_period date,p_due_day integer,p_frequency text) returns uuid
language plpgsql security definer set search_path='' as $$
declare tpl public.task_template_versions; base_template public.task_templates; new_id uuid;
begin
  perform public.require_privileged_session();
  if public.actor_role()<>'jefe' then raise exception 'Sólo jefatura puede crear asignaciones; complete la inducción aprobada'; end if;
  if extract(day from p_period)<>1 or p_due_day not between 1 and 31 then raise exception 'Período o fecha inválida';end if;
  if not exists(select 1 from public.company_memberships where profile_id=p_owner and company_id=p_company and organization_id=public.actor_org())
     or not exists(select 1 from public.team_members where profile_id=p_owner and team_id=p_team and organization_id=public.actor_org()) then raise exception 'Empresa o equipo fuera del ámbito';end if;
  perform public.lock_open_month(p_owner,p_period);
  select * into base_template from public.task_templates where id=p_template and organization_id=public.actor_org() and active;
  if not found then raise exception 'Plantilla inválida';end if;
  select * into tpl from public.task_template_versions where template_id=p_template and organization_id=public.actor_org() order by version desc limit 1;
  if not found then raise exception 'La plantilla no tiene revisión activa';end if;
  insert into public.task_assignments(organization_id,template_id,template_version_id,company_id,owner_id,team_id,title,kind,weight,unit,target,frequency,start_month,due_day,checklist)
    values(tpl.organization_id,tpl.template_id,tpl.id,p_company,p_owner,p_team,tpl.title,tpl.kind,tpl.weight,tpl.unit,tpl.monthly_target,p_frequency,p_period,p_due_day,tpl.checklist) returning id into new_id;
  insert into public.audit_events(organization_id,actor_id,action,entity_id,details) values(tpl.organization_id,auth.uid(),'assignment.created',new_id,jsonb_build_object('company',p_company,'template_version',tpl.version));
  return new_id;
end$$;

-- Asegurar compatibilidad con la transición anterior: los relojes se detienen
-- al completar/revertir y una reapertura vieja no puede omitir justificación.
create or replace function public.record_activity(p_instance_id uuid,work_day date,qty integer,note text) returns uuid
language plpgsql security definer set search_path='' as $$
declare t public.task_instances; entry_id uuid; begin
  if not public.can_access_instance(p_instance_id) or public.actor_role()='auditor' then raise exception 'Sin permiso'; end if;
  select * into t from public.task_instances where id=p_instance_id;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('work-owner:'||t.owner_id::text,0)); perform public.lock_open_month(t.owner_id,t.period);
  select * into t from public.task_instances where id=p_instance_id for update;
  if t.kind<>'operativa' or date_trunc('month',work_day)::date<>t.period or work_day>(now() at time zone 'America/Argentina/Buenos_Aires')::date then raise exception 'Fecha o tipo inválido'; end if;
  insert into public.activity_entries(organization_id,instance_id,work_date,quantity,reference,actor_id) values(t.organization_id,t.id,work_day,qty,note,auth.uid()) returning id into entry_id;
  update public.task_instances set state_revision=state_revision+1 where id=t.id;
  insert into public.audit_events(organization_id,actor_id,action,entity_id) values(t.organization_id,auth.uid(),'activity.created',entry_id); return entry_id;
end$$;
create function public.record_activity_once(p_instance uuid,p_work_date date,p_quantity integer,p_reference text,p_operation_id uuid) returns uuid
language plpgsql security definer set search_path='' as $$declare cached jsonb; entry uuid; begin
  cached:=public._get_mutation_receipt('record_activity',jsonb_build_object('instance',p_instance,'work_date',p_work_date,'quantity',p_quantity,'reference',p_reference),p_operation_id);
  if cached is not null then return (cached->>'entry_id')::uuid; end if;
  entry:=public.record_activity(p_instance,p_work_date,p_quantity,p_reference);
  perform public._save_mutation_receipt('record_activity',jsonb_build_object('instance',p_instance,'work_date',p_work_date,'quantity',p_quantity,'reference',p_reference),p_operation_id,jsonb_build_object('entry_id',entry)); return entry;
end$$;

-- Los cierres terminan cobertura vencida en su límite real antes de evaluar
-- sesiones genuinamente activas; el cierre/outbox 003 conserva atomicidad.
create or replace function public.close_employee_month(p_owner uuid,p_period date,p_note text) returns uuid
language plpgsql security definer set search_path='' as $$
declare snapshot_data jsonb; new_id uuid; report_id uuid; delivery_id uuid; recipient uuid; recipient_mail text; begin
  perform public.require_privileged_session();
  if not public.can_access_owner(p_owner) then raise exception 'Sin permiso'; end if;
  if p_period is null or extract(day from p_period)<>1 or p_period>date_trunc('month',now() at time zone 'America/Argentina/Buenos_Aires')::date then raise exception 'Período inválido'; end if;
  if nullif(trim(p_note),'') is null then raise exception 'La revisión requiere una nota'; end if;
  if public.actor_role()<>'jefe' and exists(select 1 from public.task_instances t where t.owner_id=p_owner and t.period=p_period and not public.can_access_instance(t.id)) then raise exception 'Se requiere acceso a todas las empresas del mes'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('work-owner:'||p_owner::text,0));
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_owner::text||p_period::text,0));
  select id into new_id from public.monthly_closures where owner_id=p_owner and period=p_period; if found then return new_id; end if;
  select p.id,u.email into recipient,recipient_mail from public.report_settings s join public.profiles p on p.id=s.recipient_id and p.organization_id=s.organization_id join auth.users u on u.id=p.id where s.organization_id=public.actor_org() and p.active and p.role='jefe' and u.email_confirmed_at is not null and nullif(trim(u.email),'') is not null;
  if recipient is null then raise exception 'Configure un gerente con correo verificado antes del cierre'; end if;
  update public.task_time_sessions s set ended_at=least(((a.ends_on+1)::timestamp at time zone 'America/Argentina/Buenos_Aires'),coalesce(a.cancelled_at,now())) from public.employee_absences a,public.task_instances t where t.owner_id=p_owner and t.period=p_period and t.id=s.instance_id and s.absence_id=a.id and s.ended_at is null and ((now() at time zone 'America/Argentina/Buenos_Aires')::date>a.ends_on or a.cancelled_at is not null);
  if exists(select 1 from public.task_time_sessions s join public.task_instances t on t.id=s.instance_id where t.owner_id=p_owner and t.period=p_period and s.ended_at is null) then raise exception 'Hay cronómetros activos; pausar antes del cierre'; end if;
  if not exists(select 1 from public.task_instances where owner_id=p_owner and period=p_period) then raise exception 'No hay tareas para cerrar'; end if;
  perform public.lock_open_month(p_owner,p_period);
  with work as (select t.*,coalesce((select sum(e.quantity) from public.activity_entries e where e.instance_id=t.id and date_trunc('month',e.work_date)::date=p_period),0) quantity from public.task_instances t where t.owner_id=p_owner and t.period=p_period), values_per_task as (select *,weight*case when kind='resultado' then case when status='Completada' then 1 else 0 end else least(quantity::numeric/target,1) end earned from work), totals as (select sum(weight) points,sum(earned) earned,count(*) filter(where kind='resultado') assigned,count(*) filter(where kind='resultado' and status='Completada') done,count(*) filter(where kind='resultado' and status='Completada' and due_date is not null) done_with_deadline,count(*) filter(where kind='resultado' and status='Completada' and due_date is not null and (completed_at at time zone 'America/Argentina/Buenos_Aires')::date<=due_date) on_time,count(*) filter(where kind='resultado' and status<>'Completada' and due_date<(now() at time zone 'America/Argentina/Buenos_Aires')::date) late,count(*) filter(where blocked_by is not null) blocked,count(*) filter(where kind='operativa') operational,count(*) filter(where kind='operativa' and quantity>=target) operational_target from values_per_task)
  select jsonb_build_object('version',3,'evaluated_at',now(),'timezone','America/Argentina/Buenos_Aires','period',p_period,'tasks',(select jsonb_agg(to_jsonb(t) order by t.company_id,t.id) from work t),'activity',coalesce((select jsonb_agg(to_jsonb(e) order by e.work_date,e.id) from public.activity_entries e join work t on t.id=e.instance_id where date_trunc('month',e.work_date)::date=p_period),'[]'::jsonb),'sessions',coalesce((select jsonb_agg(to_jsonb(s) order by s.started_at,s.id) from public.task_time_sessions s join work t on t.id=s.instance_id),'[]'::jsonb),'reopen_events',coalesce((select jsonb_agg(to_jsonb(e) order by e.at,e.id) from public.task_reopen_events e join work t on t.id=e.instance_id),'[]'::jsonb),'metrics',jsonb_build_object('points',points,'earned',round(earned,2),'weighted',round(earned/nullif(points,0)*100),'assigned',assigned,'done',done,'onTime',round(on_time::numeric/nullif(done_with_deadline,0)*100),'completedWithDeadline',done_with_deadline,'recordedSeconds',coalesce((select sum(extract(epoch from (s.ended_at-s.started_at))) from public.task_time_sessions s join work t on t.id=s.instance_id),0),'late',late,'blocked',blocked,'operational',operational,'operationalTarget',operational_target)) into snapshot_data from totals;
  insert into public.monthly_closures(organization_id,owner_id,period,snapshot,closed_by,note) values(public.actor_org(),p_owner,p_period,snapshot_data,auth.uid(),trim(p_note)) returning id into new_id;
  insert into public.audit_events(organization_id,actor_id,action,entity_id,details) values(public.actor_org(),auth.uid(),'month.closed',new_id,jsonb_build_object('owner',p_owner,'period',p_period));
  insert into public.period_reports(organization_id,closure_id,owner_id,period,snapshot) values(public.actor_org(),new_id,p_owner,p_period,snapshot_data) returning id into report_id;
  insert into public.report_deliveries(organization_id,report_id,recipient_id,recipient_email) values(public.actor_org(),report_id,recipient,recipient_mail) returning id into delivery_id;
  insert into public.report_outbox_events(organization_id,delivery_id) values(public.actor_org(),delivery_id); return new_id;
end$$;

revoke all on function public._get_mutation_receipt(text,jsonb,uuid),public._save_mutation_receipt(text,jsonb,uuid,jsonb),public._effective_session_end(uuid,timestamptz) from public,anon,authenticated;
revoke execute on function public.can_cover_instance(uuid),public.approve_employee_absence(uuid,uuid,text,date,date,uuid[],text,uuid),public.cancel_employee_absence(uuid,text,uuid),public.start_task_timer(uuid,bigint,uuid,boolean),public.pause_task_timer(uuid,uuid),public.set_task_wait(uuid,text,bigint,uuid),public.transition_task_reviewed(uuid,text,text,bigint,uuid),public.set_checklist_item_reviewed(uuid,text,boolean,text,bigint,uuid),public.record_activity_once(uuid,date,integer,text,uuid),public.create_catalog_assignment(uuid,uuid,uuid,uuid,date,integer,text),public.transition_task(uuid,text),public.set_checklist_item(uuid,text,boolean),public.record_activity(uuid,date,integer,text),public.close_employee_month(uuid,date,text) from public,anon;
grant execute on function public.can_cover_instance(uuid),public.approve_employee_absence(uuid,uuid,text,date,date,uuid[],text,uuid),public.cancel_employee_absence(uuid,text,uuid),public.start_task_timer(uuid,bigint,uuid,boolean),public.pause_task_timer(uuid,uuid),public.set_task_wait(uuid,text,bigint,uuid),public.transition_task_reviewed(uuid,text,text,bigint,uuid),public.set_checklist_item_reviewed(uuid,text,boolean,text,bigint,uuid),public.record_activity_once(uuid,date,integer,text,uuid),public.create_catalog_assignment(uuid,uuid,uuid,uuid,date,integer,text),public.transition_task(uuid,text),public.set_checklist_item(uuid,text,boolean),public.record_activity(uuid,date,integer,text),public.close_employee_month(uuid,date,text) to authenticated;
commit;
