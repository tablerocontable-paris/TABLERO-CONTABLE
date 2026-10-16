-- Contrato 005: endurece reloj, revisiones, cobertura e historia sin reescribir
-- snapshots publicados. Se ejecuta como una única transacción.
begin;

-- No inventar identidad ni ocultar incompatibilidades históricas.
do $$ declare conflicts text; begin
  if auth.uid() is not null then raise exception 'Migración 005 debe ejecutarse como owner'; end if;
  select string_agg(e.id::text, ', ' order by e.id::text) into conflicts
  from public.audit_events e
  left join public.task_instances t on t.id=e.entity_id and t.organization_id=e.organization_id
  where e.action='task.transition' and e.details->>'from'='Completada'
    and e.details->>'to'<>'Completada' and t.id is null;
  if conflicts is not null then raise exception 'Preflight 005: auditorías de reapertura sin tarea compatible: %',conflicts; end if;
  select string_agg(e.id::text, ', ' order by e.id::text) into conflicts
  from public.audit_events e join public.task_instances t on t.id=e.entity_id
  left join public.profiles p on p.id=e.actor_id
  where e.action='task.transition' and e.details->>'from'='Completada'
    and e.details->>'to'<>'Completada' and e.actor_id is not null
    and (t.organization_id<>e.organization_id or (p.id is not null and p.organization_id<>e.organization_id));
  if conflicts is not null then raise exception 'Preflight 005: auditorías de reapertura con organización incompatible: %',conflicts; end if;
  select string_agg(r.id::text, ', ' order by r.id::text) into conflicts
  from public.task_reopen_events r
  left join public.task_instances t on t.id=r.instance_id and t.organization_id=r.organization_id
  left join public.profiles p on p.id=r.actor_id and p.organization_id=r.organization_id
  left join public.audit_events e on e.id=r.legacy_audit_id and e.organization_id=r.organization_id
  where t.id is null or (r.actor_id is not null and p.id is null)
    or (r.legacy_audit_id is not null and (e.id is null or e.action<>'task.transition' or e.entity_id<>r.instance_id));
  if conflicts is not null then raise exception 'Preflight 005: reaperturas históricas incompatibles: %',conflicts; end if;
end $$;

-- Mantener backfill explícito; el 004 pudo omitir huérfanos que ya bloquea el preflight.
insert into public.task_reopen_events(organization_id,instance_id,actor_id,at,reason,source,legacy_audit_id)
  select e.organization_id,e.entity_id,case when exists(select 1 from public.profiles p where p.id=e.actor_id and p.organization_id=e.organization_id) then e.actor_id else null end,e.at,'Transición histórica sin motivo registrado','legacy_transition',e.id
from public.audit_events e join public.task_instances t on t.id=e.entity_id and t.organization_id=e.organization_id
where e.action='task.transition' and e.details->>'from'='Completada' and e.details->>'to'<>'Completada'
  and not exists(select 1 from public.task_reopen_events r where r.legacy_audit_id=e.id)
on conflict(legacy_audit_id) do nothing;

create unique index if not exists audit_events_id_org_uq on public.audit_events(id,organization_id);
alter table public.task_reopen_events
  add constraint reopen_actor_org_fk foreign key(actor_id,organization_id) references public.profiles(id,organization_id),
  add constraint reopen_legacy_audit_org_fk foreign key(legacy_audit_id,organization_id) references public.audit_events(id,organization_id);
create or replace function public.prevent_reopen_event_mutation() returns trigger
language plpgsql security definer set search_path='' as $$begin raise exception 'El historial de reaperturas es inmutable'; end$$;
drop trigger if exists task_reopen_events_immutable on public.task_reopen_events;
create trigger task_reopen_events_immutable before update or delete on public.task_reopen_events
for each row execute function public.prevent_reopen_event_mutation();

-- La expiración siempre limita por el primero entre el corte propuesto,
-- medianoche ART posterior al último día y cancelación, si existió.
create or replace function public._effective_session_end(p_session uuid,p_proposed timestamptz) returns timestamptz
language sql stable security definer set search_path='' as $$
  select least(p_proposed,(a.ends_on+1)::timestamp at time zone 'America/Argentina/Buenos_Aires',a.cancelled_at)
  from public.task_time_sessions s left join public.employee_absences a on a.id=s.absence_id where s.id=p_session
$$;

create or replace function public._get_mutation_receipt(p_kind text,p_args jsonb,p_operation uuid) returns jsonb
language plpgsql security definer set search_path='' as $$declare r public.task_mutation_receipts; org uuid; begin
  if auth.uid() is null then raise exception 'Se requiere una sesión autenticada'; end if;
  if p_operation is null then raise exception 'Identificador de operación requerido'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(auth.uid()::text||p_operation::text,0));
  select * into r from public.task_mutation_receipts where actor_id=auth.uid() and operation_id=p_operation;
  if found then if r.operation_kind<>p_kind or r.arguments<>p_args then raise exception 'Identificador de operación reutilizado con otros argumentos'; end if; return r.result; end if;
  org:=public.actor_org(); if org is null then raise exception 'Sin permiso'; end if;
  return null;
end $$;
create or replace function public._save_mutation_receipt(p_kind text,p_args jsonb,p_operation uuid,p_result jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$declare org uuid; begin
  if auth.uid() is null or p_operation is null then raise exception 'Identidad y operación requeridas'; end if;
  org:=public.actor_org(); if org is null then raise exception 'Sin permiso'; end if;
  insert into public.task_mutation_receipts(organization_id,actor_id,operation_id,operation_kind,arguments,result)
  values(org,auth.uid(),p_operation,p_kind,p_args,p_result); return p_result;
end $$;

create or replace function public._can_access_instance_at(p_instance uuid,p_at timestamptz) returns boolean
language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.task_instances t
    where t.id=p_instance and (
      (public.can_access_owner(t.owner_id) and (public.actor_role()='jefe' or exists(
        select 1 from public.company_memberships m where m.profile_id=auth.uid() and m.company_id=t.company_id and m.organization_id=t.organization_id)))
      or exists(select 1 from public.profiles a join public.profiles o on o.id=t.owner_id and o.organization_id=t.organization_id and o.active
        join public.employee_absences x on x.owner_id=o.id and x.organization_id=t.organization_id and x.replacement_id=a.id and x.cancelled_at is null
        join public.employee_absence_companies c on c.absence_id=x.id and c.organization_id=x.organization_id and c.company_id=t.company_id
        join public.company_memberships am on am.profile_id=a.id and am.company_id=t.company_id and am.organization_id=t.organization_id
        join public.company_memberships om on om.profile_id=o.id and om.company_id=t.company_id and om.organization_id=t.organization_id
        where a.id=auth.uid() and a.organization_id=t.organization_id and a.active and a.role in ('empleado','encargado')
          and (p_at at time zone 'America/Argentina/Buenos_Aires')::date between x.starts_on and x.ends_on
          and t.period between date_trunc('month',x.starts_on)::date and date_trunc('month',x.ends_on)::date)))
$$;

create or replace function public.clamp_covered_session_end() returns trigger
language plpgsql security definer set search_path='' as $$begin
  if new.ended_at is not null and new.absence_id is not null then
    new.ended_at:=least(new.ended_at,public._effective_session_end(new.id,new.ended_at));
  end if;
  return new;
end$$;
drop trigger if exists task_sessions_clamp_end on public.task_time_sessions;
create trigger task_sessions_clamp_end before insert or update of ended_at on public.task_time_sessions
for each row execute function public.clamp_covered_session_end();

-- Defensa de integridad también para futuras RPCs: una licencia sin reemplazo
-- sigue reservando el rango del titular.
create or replace function public.reject_overlapping_absence() returns trigger
language plpgsql security definer set search_path='' as $$begin
  if new.cancelled_at is null and exists(select 1 from public.employee_absences a
    where a.owner_id=new.owner_id and a.id<>coalesce(new.id,'00000000-0000-0000-0000-000000000000'::uuid)
      and a.cancelled_at is null and daterange(a.starts_on,a.ends_on,'[]') && daterange(new.starts_on,new.ends_on,'[]')) then
    raise exception 'La ausencia se superpone con otra';
  end if;
  return new;
end$$;
drop trigger if exists employee_absences_no_overlap on public.employee_absences;
create trigger employee_absences_no_overlap before insert or update of owner_id,starts_on,ends_on,cancelled_at on public.employee_absences
for each row execute function public.reject_overlapping_absence();

create or replace function public.guard_absence_approval() returns trigger
language plpgsql security definer set search_path='' as $$declare p public.profiles; begin
  select * into p from public.profiles where id=new.approved_by and organization_id=new.organization_id and active;
  if not found or new.approved_by<>auth.uid() or p.role not in ('jefe','encargado') then raise exception 'Sólo un responsable activo puede aprobar ausencias'; end if;
  -- Se vuelve a validar MFA dentro de la escritura, luego del owner guard de RPC.
  perform public.require_privileged_session();
  return new;
end$$;
drop trigger if exists employee_absence_approval_guard on public.employee_absences;
create trigger employee_absence_approval_guard before insert on public.employee_absences
for each row execute function public.guard_absence_approval();

create or replace function public.approve_employee_absence(p_owner uuid,p_replacement uuid,p_kind text,p_starts date,p_ends date,p_company_ids uuid[],p_note text,p_operation_id uuid) returns uuid
language plpgsql security definer set search_path='' as $$
declare org uuid; new_id uuid; cached jsonb; c uuid; args jsonb;
begin
  if auth.uid() is null or p_owner is null or p_kind is null or p_starts is null or p_ends is null or p_ends<p_starts or nullif(trim(coalesce(p_note,'')),'') is null then raise exception 'Datos de ausencia inválidos'; end if;
  args:=jsonb_build_object('owner',p_owner,'replacement',p_replacement,'kind',p_kind,'starts',p_starts,'ends',p_ends,'companies',p_company_ids,'note',p_note);
  cached:=public._get_mutation_receipt('approve_absence',args,p_operation_id); if cached is not null then return (cached->>'id')::uuid; end if;
  perform public.require_privileged_session();
  if public.actor_role() not in ('jefe','encargado') then raise exception 'Sólo jefatura o encargado puede aprobar ausencias'; end if;
  org:=public.actor_org();
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('work-owner:'||p_owner::text,0));
  perform public.require_privileged_session();
  if public.actor_role() not in ('jefe','encargado') or public.actor_org() is distinct from org then raise exception 'Responsable fuera de ámbito'; end if;
  if p_kind not in ('vacaciones','licencia') or not exists(select 1 from public.profiles where id=p_owner and organization_id=org and active) then raise exception 'Titular o tipo inválido'; end if;
  if public.actor_role()<>'jefe' then
    if not public.can_access_owner(p_owner) then raise exception 'Fuera del ámbito del encargado'; end if;
    if p_replacement is not null and not public.can_access_owner(p_replacement) then raise exception 'El reemplazante está fuera del ámbito del encargado'; end if;
    if exists(select 1 from unnest(coalesce(p_company_ids,'{}'::uuid[])) cid where not exists(select 1 from public.company_memberships m where m.profile_id=auth.uid() and m.company_id=cid and m.organization_id=org)) then raise exception 'Empresa fuera del ámbito'; end if;
  end if;
  if p_replacement is not null and (p_replacement=p_owner or not exists(select 1 from public.profiles where id=p_replacement and organization_id=org and active and role in ('empleado','encargado'))) then raise exception 'Reemplazante inválido'; end if;
  if p_replacement is not null and (coalesce(cardinality(p_company_ids),0)=0 or array_position(p_company_ids,null) is not null or cardinality(p_company_ids)<>(select count(distinct x) from unnest(p_company_ids) x)) then raise exception 'Seleccione empresas válidas y sin repetir'; end if;
  if p_replacement is null and coalesce(cardinality(p_company_ids),0)>0 then raise exception 'Sin reemplazante no se habilitan empresas'; end if;
  if p_replacement is not null and exists(select 1 from unnest(p_company_ids) cid where not exists(select 1 from public.company_memberships m where m.profile_id=p_owner and m.company_id=cid and m.organization_id=org) or not exists(select 1 from public.company_memberships m where m.profile_id=p_replacement and m.company_id=cid and m.organization_id=org)) then raise exception 'Ambos deben pertenecer a las empresas seleccionadas'; end if;
  if exists(select 1 from public.employee_absences where owner_id=p_owner and cancelled_at is null and daterange(starts_on,ends_on,'[]') && daterange(p_starts,p_ends,'[]')) then raise exception 'La ausencia se superpone con otra'; end if;
  insert into public.employee_absences(organization_id,owner_id,replacement_id,kind,starts_on,ends_on,note,approved_by) values(org,p_owner,p_replacement,p_kind,p_starts,p_ends,trim(p_note),auth.uid()) returning id into new_id;
  foreach c in array coalesce(p_company_ids,'{}'::uuid[]) loop insert into public.employee_absence_companies(absence_id,organization_id,company_id) values(new_id,org,c); end loop;
  insert into public.audit_events(organization_id,actor_id,action,entity_id,details) values(org,auth.uid(),'absence.approved',new_id,jsonb_build_object('owner',p_owner,'replacement',p_replacement,'companies',coalesce(to_jsonb(p_company_ids),'[]'::jsonb)));
  perform public._save_mutation_receipt('approve_absence',args,p_operation_id,jsonb_build_object('id',new_id)); return new_id;
end $$;

create or replace function public.cancel_employee_absence(p_absence uuid,p_reason text,p_operation_id uuid) returns void
language plpgsql security definer set search_path='' as $$
declare a public.employee_absences; cached jsonb; args jsonb; cutoff timestamptz; row_session record; inst uuid; canonical_reason text;
begin
  if auth.uid() is null or nullif(trim(coalesce(p_reason,'')),'') is null then raise exception 'Identidad y motivo requeridos'; end if;
  args:=jsonb_build_object('absence',p_absence,'reason',trim(p_reason));
  cached:=public._get_mutation_receipt('cancel_absence',args,p_operation_id); if cached is not null then return; end if;
  perform public.require_privileged_session();
  select * into a from public.employee_absences where id=p_absence and organization_id=public.actor_org();
  if not found or public.actor_role() not in ('jefe','encargado') or not public.can_access_owner(a.owner_id) then raise exception 'Ausencia fuera del ámbito'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('work-owner:'||a.owner_id::text,0));
  if public.actor_role() not in ('jefe','encargado') or not public.can_access_owner(a.owner_id) then raise exception 'Ausencia fuera del ámbito'; end if;
  perform public.require_privileged_session();
  -- Meses, instancias y sesiones se bloquean de forma estable.
  for row_session in select distinct t.period from public.task_time_sessions s join public.task_instances t on t.id=s.instance_id
    where s.absence_id=a.id and s.ended_at is null order by t.period loop
    perform public.lock_open_month(a.owner_id,row_session.period);
  end loop;
  for inst in select distinct t.id from public.task_time_sessions s join public.task_instances t on t.id=s.instance_id
    where s.absence_id=a.id and s.ended_at is null order by t.id loop
    perform 1 from public.task_instances t where t.id=inst for update;
  end loop;
  -- Row locks follow the period guards; cancellation does not take executor timer guards.
  perform 1 from public.task_time_sessions where absence_id=a.id and ended_at is null order by id for update;
  select * into a from public.employee_absences where id=p_absence and organization_id=public.actor_org() for update;
  if not found or public.actor_role() not in ('jefe','encargado') or not public.can_access_owner(a.owner_id) then raise exception 'Ausencia fuera del ámbito'; end if;
  perform public.require_privileged_session();
  if public.actor_role()='encargado' and a.replacement_id is not null and
     (not public.can_access_owner(a.replacement_id) or exists(select 1 from public.employee_absence_companies c
       where c.absence_id=a.id and not exists(select 1 from public.company_memberships m where m.profile_id=auth.uid() and m.organization_id=a.organization_id and m.company_id=c.company_id))) then
    raise exception 'El reemplazante o una empresa está fuera del ámbito permanente';
  end if;
  if a.cancelled_at is null then
    cutoff:=clock_timestamp();
    update public.employee_absences set cancelled_at=cutoff where id=a.id;
  else
    cutoff:=a.cancelled_at;
    select e.details->>'reason' into canonical_reason from public.audit_events e where e.action='absence.cancelled' and e.entity_id=a.id order by e.at limit 1;
  end if;
  for row_session in select s.id,s.instance_id,s.actor_id,s.started_at,t.organization_id
    from public.task_time_sessions s join public.task_instances t on t.id=s.instance_id
    where s.absence_id=a.id and s.ended_at is null order by s.id loop
    update public.task_time_sessions set ended_at=public._effective_session_end(row_session.id,cutoff) where id=row_session.id;
    update public.task_instances set state_revision=state_revision+1 where id=row_session.instance_id;
    insert into public.audit_events(organization_id,actor_id,action,entity_id,details)
    values(row_session.organization_id,auth.uid(),'absence.session_stopped',row_session.instance_id,
      jsonb_build_object('absence',a.id,'session',row_session.id,'executor',row_session.actor_id,'started_at',row_session.started_at,'ended_at',public._effective_session_end(row_session.id,cutoff),'reason',coalesce(canonical_reason,trim(p_reason))));
  end loop;
  if a.cancelled_at is null then
    insert into public.audit_events(organization_id,actor_id,action,entity_id,details)
    values(a.organization_id,auth.uid(),'absence.cancelled',a.id,jsonb_build_object('reason',trim(p_reason),'cancelled_at',cutoff));
  end if;
  perform public._save_mutation_receipt('cancel_absence',args,p_operation_id,jsonb_build_object('cancelled_at',cutoff));
end $$;

-- Pausar la propia sesión es el único mutador disponible para un perfil suspendido.
-- El recibo se asocia a su organización histórica sin exigir que siga activo.
create or replace function public.pause_task_timer(p_session uuid,p_operation_id uuid) returns timestamptz
language plpgsql security definer set search_path='' as $$
declare s public.task_time_sessions; t public.task_instances; cached jsonb; ended timestamptz; org uuid; args jsonb; r public.task_mutation_receipts;
begin
  if auth.uid() is null or p_operation_id is null then raise exception 'Identidad y operación requeridas'; end if;
  args:=jsonb_build_object('session',p_session);
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(auth.uid()::text||p_operation_id::text,0));
  select * into r from public.task_mutation_receipts where actor_id=auth.uid() and operation_id=p_operation_id;
  if found then
    if r.operation_kind<>'pause_timer' or r.arguments<>args then raise exception 'Identificador de operación reutilizado con otros argumentos'; end if;
    return (r.result->>'ended_at')::timestamptz;
  end if;
  select * into s from public.task_time_sessions where id=p_session and actor_id=auth.uid();
  if not found then raise exception 'Sesión propia no encontrada'; end if;
  select * into t from public.task_instances where id=s.instance_id;
  if not found then raise exception 'Sesión inválida'; end if;
  select organization_id into org from public.profiles where id=auth.uid() and organization_id=t.organization_id;
  if org is null then raise exception 'Sin permiso'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('work-owner:'||t.owner_id::text,0));
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(t.owner_id::text||t.period::text,0));
  select * into t from public.task_instances where id=s.instance_id for update;
  select * into s from public.task_time_sessions where id=p_session and actor_id=auth.uid() for update;
  if s.ended_at is not null then ended:=s.ended_at;
  else
    if exists(select 1 from public.monthly_closures c where c.owner_id=t.owner_id and c.period=t.period) then raise exception 'El mes está cerrado'; end if;
    ended:=public._effective_session_end(s.id,clock_timestamp());
    update public.task_time_sessions set ended_at=ended where id=s.id;
    update public.task_instances set state_revision=state_revision+1 where id=t.id;
  end if;
  insert into public.task_mutation_receipts(organization_id,actor_id,operation_id,operation_kind,arguments,result)
  values(org,auth.uid(),p_operation_id,'pause_timer',args,jsonb_build_object('ended_at',ended));
  return ended;
end $$;

create or replace function public.start_task_timer(p_instance uuid,p_expected_revision bigint,p_operation_id uuid,p_switch boolean default false) returns uuid
language plpgsql security definer set search_path='' as $$
declare t public.task_instances; s public.task_time_sessions; old public.task_time_sessions; result jsonb; absence uuid; now_at timestamptz; source_task public.task_instances; owner_lock uuid; args jsonb;
begin
  if auth.uid() is null or p_expected_revision is null or p_expected_revision<0 or p_switch is null then raise exception 'Identidad, revisión y decisión de cambio requeridas'; end if;
  args:=jsonb_build_object('instance',p_instance,'revision',p_expected_revision,'switch',p_switch);
  result:=public._get_mutation_receipt('start_timer',args,p_operation_id); if result is not null then return (result->>'session_id')::uuid; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('timer-actor:'||auth.uid()::text,0));
  if not public.can_access_instance(p_instance) or public.actor_role()='auditor' then raise exception 'Sin permiso'; end if;
  select * into t from public.task_instances where id=p_instance;
  select * into old from public.task_time_sessions where actor_id=auth.uid() and ended_at is null;
  if old.id is not null then select * into source_task from public.task_instances where id=old.instance_id; end if;
  for owner_lock in select distinct x.owner_id from (values(t.owner_id),(source_task.owner_id)) x(owner_id) where x.owner_id is not null order by x.owner_id loop
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('work-owner:'||owner_lock::text,0));
  end loop;
  -- Bloquea periodos de origen/destino siempre en orden estable.
  if source_task.id is not null and (source_task.owner_id::text||source_task.period::text)<(t.owner_id::text||t.period::text) then perform public.lock_open_month(source_task.owner_id,source_task.period); end if;
  perform public.lock_open_month(t.owner_id,t.period);
  if source_task.id is not null and not (source_task.owner_id=t.owner_id and source_task.period=t.period)
     and (source_task.owner_id::text||source_task.period::text)>(t.owner_id::text||t.period::text) then perform public.lock_open_month(source_task.owner_id,source_task.period); end if;
  select * into t from public.task_instances where id=p_instance for update;
  now_at:=clock_timestamp();
  if not public._can_access_instance_at(p_instance,now_at) or public.actor_role()='auditor' then raise exception 'Sin permiso'; end if;
  if t.state_revision is distinct from p_expected_revision then raise exception 'La tarea cambió; actualice antes de continuar'; end if;
  if t.status='Completada' or t.blocked_by is not null then raise exception 'La tarea no admite cronómetro'; end if;
  select * into s from public.task_time_sessions where instance_id=t.id and ended_at is null for update;
  if found then
    if s.absence_id is not null and exists(select 1 from public.employee_absences a where a.id=s.absence_id and ((a.ends_on+1)::timestamp at time zone 'America/Argentina/Buenos_Aires')<=now_at) then
      update public.task_time_sessions set ended_at=public._effective_session_end(s.id,now_at) where id=s.id;
      insert into public.audit_events(organization_id,actor_id,action,entity_id,details) values(t.organization_id,auth.uid(),'task.timer_expired',s.id,jsonb_build_object('instance',t.id,'executor',s.actor_id,'started_at',s.started_at,'ended_at',public._effective_session_end(s.id,now_at)));
      s.id:=null;
    end if;
    if s.id is not null then
      if s.actor_id<>auth.uid() then raise exception 'La tarea tiene otro ejecutor activo'; end if;
      perform public._save_mutation_receipt('start_timer',args,p_operation_id,jsonb_build_object('session_id',s.id));
      return s.id;
    end if;
  end if;
  select * into old from public.task_time_sessions where actor_id=auth.uid() and ended_at is null for update;
  if found and old.absence_id is not null and exists(select 1 from public.employee_absences a where a.id=old.absence_id and ((a.ends_on+1)::timestamp at time zone 'America/Argentina/Buenos_Aires')<=now_at) then
    update public.task_time_sessions set ended_at=public._effective_session_end(old.id,now_at) where id=old.id;
    update public.task_instances set state_revision=state_revision+1 where id=source_task.id;
    insert into public.audit_events(organization_id,actor_id,action,entity_id,details) values(source_task.organization_id,auth.uid(),'task.timer_expired',old.id,jsonb_build_object('instance',source_task.id,'executor',old.actor_id,'started_at',old.started_at,'ended_at',public._effective_session_end(old.id,now_at)));
    old.id:=null;
  end if;
  if found and old.id is not null and not p_switch then raise exception 'Pause su cronómetro actual o solicite el cambio'; end if;
  if public.can_access_owner(t.owner_id) then absence:=null; else
    select a.id into absence from public.employee_absences a join public.employee_absence_companies c on c.absence_id=a.id and c.company_id=t.company_id
    where a.owner_id=t.owner_id and a.replacement_id=auth.uid() and a.cancelled_at is null
      and (now_at at time zone 'America/Argentina/Buenos_Aires')::date between a.starts_on and a.ends_on
      and t.period between date_trunc('month',a.starts_on)::date and date_trunc('month',a.ends_on)::date limit 1;
    if absence is null then raise exception 'Cobertura vencida o sin autorización para esta empresa'; end if;
  end if;
  if old.id is not null then
    update public.task_time_sessions set ended_at=public._effective_session_end(old.id,now_at) where id=old.id;
    update public.task_instances set state_revision=state_revision+1 where id=source_task.id;
    insert into public.audit_events(organization_id,actor_id,action,entity_id,details) values(source_task.organization_id,auth.uid(),'task.timer_switched',old.id,jsonb_build_object('from_instance',source_task.id,'to_instance',t.id,'executor',old.actor_id,'ended_at',public._effective_session_end(old.id,now_at)));
  end if;
  if t.status='Pendiente' then update public.task_instances set status='En curso',started_at=coalesce(started_at,now_at),state_revision=state_revision+1 where id=t.id;
  else update public.task_instances set state_revision=state_revision+1 where id=t.id; end if;
  insert into public.task_time_sessions(organization_id,instance_id,actor_id,started_at,absence_id) values(t.organization_id,t.id,auth.uid(),now_at,absence) returning * into s;
  perform public._save_mutation_receipt('start_timer',args,p_operation_id,jsonb_build_object('session_id',s.id)); return s.id;
end $$;

-- Las firmas de revisión no pueden aceptar NULL; espera valida texto y sólo
-- detiene el reloj cuando se está bloqueando (nunca al desbloquear).
create or replace function public.set_task_wait(p_instance uuid,p_note text,p_expected_revision bigint,p_operation_id uuid) returns bigint
language plpgsql security definer set search_path='' as $$
declare t public.task_instances; cached jsonb; v bigint; s public.task_time_sessions; args jsonb; now_at timestamptz;
begin
  if auth.uid() is null or p_expected_revision is null or p_expected_revision<0 then raise exception 'Identidad y revisión requeridas'; end if;
  if p_note is not null and nullif(trim(p_note),'') is null then raise exception 'La espera requiere una descripción o NULL para desbloquear'; end if;
  args:=jsonb_build_object('instance',p_instance,'note',p_note,'revision',p_expected_revision);
  cached:=public._get_mutation_receipt('task_wait',args,p_operation_id); if cached is not null then return (cached->>'revision')::bigint; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('timer-actor:'||auth.uid()::text,0));
  if not public.can_access_instance(p_instance) or public.actor_role()='auditor' then raise exception 'Sin permiso'; end if;
  select * into t from public.task_instances where id=p_instance;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('work-owner:'||t.owner_id::text,0)); perform public.lock_open_month(t.owner_id,t.period);
  select * into t from public.task_instances where id=p_instance for update;
  now_at:=clock_timestamp(); if not public._can_access_instance_at(p_instance,now_at) or public.actor_role()='auditor' then raise exception 'Sin permiso'; end if;
  if t.state_revision is distinct from p_expected_revision then raise exception 'La tarea cambió'; end if;
  if (p_note is null and t.blocked_by is null) or (p_note is not null and t.blocked_by=trim(p_note)) then perform public._save_mutation_receipt('task_wait',args,p_operation_id,jsonb_build_object('revision',t.state_revision)); return t.state_revision; end if;
  select * into s from public.task_time_sessions where instance_id=t.id and ended_at is null for update;
  if p_note is not null and s.id is not null and s.actor_id<>auth.uid() then
    if public.actor_role() not in ('jefe','encargado') or not public.can_access_owner(t.owner_id) or nullif(trim(p_note),'') is null then raise exception 'Sólo un responsable permanente puede detener al ejecutor'; end if;
    perform public.require_privileged_session();
  end if;
  now_at:=clock_timestamp();
  if p_note is not null and s.id is not null then update public.task_time_sessions set ended_at=public._effective_session_end(s.id,now_at) where id=s.id; end if;
  update public.task_instances set blocked_by=case when p_note is null then null else trim(p_note) end,
    blocked_since=case when p_note is null then null else (now_at at time zone 'America/Argentina/Buenos_Aires')::date end,
    state_revision=state_revision+1 where id=t.id returning state_revision into v;
  if p_note is not null then insert into public.audit_events(organization_id,actor_id,action,entity_id,details) values(t.organization_id,auth.uid(),'task.wait',t.id,jsonb_build_object('executor',s.actor_id,'session',s.id,'reason',trim(p_note))); end if;
  perform public._save_mutation_receipt('task_wait',args,p_operation_id,jsonb_build_object('revision',v)); return v;
end $$;

create or replace function public.transition_task_reviewed(p_instance uuid,p_next text,p_reason text,p_expected_revision bigint,p_operation_id uuid) returns bigint
language plpgsql security definer set search_path='' as $$
declare t public.task_instances; cached jsonb; v bigint; s public.task_time_sessions; args jsonb; now_at timestamptz; absence uuid;
begin
  if auth.uid() is null or p_expected_revision is null or p_expected_revision<0 or p_next is null then raise exception 'Identidad, estado y revisión requeridos'; end if;
  args:=jsonb_build_object('instance',p_instance,'next',p_next,'reason',p_reason,'revision',p_expected_revision);
  cached:=public._get_mutation_receipt('transition_reviewed',args,p_operation_id); if cached is not null then return (cached->>'revision')::bigint; end if;
  if p_next not in ('Pendiente','En curso','Completada') then raise exception 'Estado inválido'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('timer-actor:'||auth.uid()::text,0));
  if not public.can_access_instance(p_instance) or public.actor_role()='auditor' then raise exception 'Sin permiso'; end if;
  select * into t from public.task_instances where id=p_instance;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('work-owner:'||t.owner_id::text,0));
  perform public.lock_open_month(t.owner_id,t.period);
  select * into t from public.task_instances where id=p_instance for update;
  now_at:=clock_timestamp(); if not public._can_access_instance_at(p_instance,now_at) or public.actor_role()='auditor' then raise exception 'Sin permiso'; end if;
  if t.state_revision is distinct from p_expected_revision then raise exception 'La tarea cambió'; end if;
  if t.status=p_next then perform public._save_mutation_receipt('transition_reviewed',args,p_operation_id,jsonb_build_object('revision',t.state_revision)); return t.state_revision; end if;
  if p_next='En curso' and t.blocked_by is not null then raise exception 'Desbloquee la tarea antes de iniciarla'; end if;
  if t.status='Completada' and p_next<>'Completada' and nullif(trim(coalesce(p_reason,'')),'') is null then raise exception 'La reapertura requiere motivo'; end if;
  if p_next='Completada' and (t.kind='operativa' or t.status='Pendiente' or t.blocked_by is not null or exists(select 1 from jsonb_array_elements(t.checklist) c where coalesce((c->>'done')::boolean,false)=false)) then raise exception 'Transición inválida o controles pendientes'; end if;
  select * into s from public.task_time_sessions where instance_id=t.id and ended_at is null for update;
  if s.id is not null and s.actor_id<>auth.uid() then
    if p_next not in ('Pendiente','Completada') or public.actor_role() not in ('jefe','encargado') or not public.can_access_owner(t.owner_id) or nullif(trim(coalesce(p_reason,'')),'') is null then raise exception 'Sólo un responsable permanente puede interrumpir al ejecutor con motivo'; end if;
    perform public.require_privileged_session();
  end if;
  if p_next='En curso' and t.status='Pendiente' then
    if s.id is not null then raise exception 'La tarea ya tiene un ejecutor'; end if;
    if exists(select 1 from public.task_time_sessions where actor_id=auth.uid() and ended_at is null) then raise exception 'Pause su cronómetro actual antes de iniciar'; end if;
    if public.can_access_owner(t.owner_id) then absence:=null; else
      select a.id into absence from public.employee_absences a join public.employee_absence_companies c on c.absence_id=a.id and c.company_id=t.company_id
      where a.owner_id=t.owner_id and a.replacement_id=auth.uid() and a.cancelled_at is null and (now_at at time zone 'America/Argentina/Buenos_Aires')::date between a.starts_on and a.ends_on limit 1;
      if absence is null then raise exception 'Cobertura vencida o sin autorización'; end if;
    end if;
    insert into public.task_time_sessions(organization_id,instance_id,actor_id,started_at,absence_id) values(t.organization_id,t.id,auth.uid(),now_at,absence);
  end if;
  if p_next in ('Pendiente','Completada') and s.id is not null then update public.task_time_sessions set ended_at=public._effective_session_end(s.id,now_at) where id=s.id; end if;
  if t.status='Completada' and p_next<>'Completada' then insert into public.task_reopen_events(organization_id,instance_id,actor_id,reason,source) values(t.organization_id,t.id,auth.uid(),trim(p_reason),'explicit'); end if;
  update public.task_instances set status=p_next,started_at=case when p_next='En curso' then coalesce(started_at,now_at) else started_at end,completed_at=case when p_next='Completada' then now_at else null end,state_revision=state_revision+1 where id=t.id returning state_revision into v;
  insert into public.audit_events(organization_id,actor_id,action,entity_id,details) values(t.organization_id,auth.uid(),'task.transition',t.id,jsonb_build_object('from',t.status,'to',p_next,'reason',p_reason,'executor',s.actor_id,'session',s.id));
  perform public._save_mutation_receipt('transition_reviewed',args,p_operation_id,jsonb_build_object('revision',v)); return v;
end $$;

create or replace function public.set_checklist_item_reviewed(p_instance uuid,p_check text,p_done boolean,p_reason text,p_expected_revision bigint,p_operation_id uuid) returns bigint
language plpgsql security definer set search_path='' as $$
declare t public.task_instances; updated jsonb; next_status text; v bigint; cached jsonb; s public.task_time_sessions; args jsonb; now_at timestamptz; absence uuid;
begin
  if auth.uid() is null or p_expected_revision is null or p_expected_revision<0 or p_done is null then raise exception 'Identidad, control y revisión requeridos'; end if;
  args:=jsonb_build_object('instance',p_instance,'check',p_check,'done',p_done,'reason',p_reason,'revision',p_expected_revision);
  cached:=public._get_mutation_receipt('checklist_reviewed',args,p_operation_id); if cached is not null then return (cached->>'revision')::bigint; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('timer-actor:'||auth.uid()::text,0));
  if not public.can_access_instance(p_instance) or public.actor_role()='auditor' then raise exception 'Sin permiso'; end if;
  select * into t from public.task_instances where id=p_instance;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('work-owner:'||t.owner_id::text,0)); perform public.lock_open_month(t.owner_id,t.period);
  select * into t from public.task_instances where id=p_instance for update;
  now_at:=clock_timestamp(); if not public._can_access_instance_at(p_instance,now_at) or public.actor_role()='auditor' then raise exception 'Sin permiso'; end if;
  if t.state_revision is distinct from p_expected_revision then raise exception 'La tarea cambió'; end if;
  if not exists(select 1 from jsonb_array_elements(t.checklist) x where x->>'id'=p_check) then raise exception 'Paso inválido'; end if;
  if exists(select 1 from jsonb_array_elements(t.checklist) x where x->>'id'=p_check and coalesce((x->>'done')::boolean,false)=p_done) then perform public._save_mutation_receipt('checklist_reviewed',args,p_operation_id,jsonb_build_object('revision',t.state_revision)); return t.state_revision; end if;
  if t.status='Completada' and nullif(trim(coalesce(p_reason,'')),'') is null then raise exception 'La reapertura requiere motivo'; end if;
  select jsonb_agg(case when x->>'id'=p_check then jsonb_set(x,'{done}',to_jsonb(p_done)) else x end order by pos) into updated from jsonb_array_elements(t.checklist) with ordinality items(x,pos);
  next_status:=case when t.status='Completada' then 'En curso' when p_done and t.status='Pendiente' and t.blocked_by is null then 'En curso' else t.status end;
  if p_done and t.kind='resultado' and t.blocked_by is null and not exists(select 1 from jsonb_array_elements(updated) x where coalesce((x->>'done')::boolean,false)=false) then next_status:='Completada'; end if;
  select * into s from public.task_time_sessions where instance_id=t.id and ended_at is null for update;
  if next_status='Completada' and s.id is not null and s.actor_id<>auth.uid() then
    if public.actor_role() not in ('jefe','encargado') or not public.can_access_owner(t.owner_id) or nullif(trim(coalesce(p_reason,'')),'') is null then raise exception 'Sólo un responsable permanente puede interrumpir al ejecutor con motivo'; end if;
    perform public.require_privileged_session();
  elsif s.id is not null and s.actor_id<>auth.uid() then raise exception 'No puede cambiar el control mientras otro ejecutor trabaja';
  end if;
  if t.status='Pendiente' and next_status='En curso' then
    if t.blocked_by is not null then raise exception 'La tarea sigue en espera'; end if;
    if exists(select 1 from public.task_time_sessions where actor_id=auth.uid() and ended_at is null) then raise exception 'Pause su cronómetro actual antes de iniciar'; end if;
    if public.can_access_owner(t.owner_id) then absence:=null; else
      select a.id into absence from public.employee_absences a join public.employee_absence_companies c on c.absence_id=a.id and c.company_id=t.company_id where a.owner_id=t.owner_id and a.replacement_id=auth.uid() and a.cancelled_at is null and (now_at at time zone 'America/Argentina/Buenos_Aires')::date between a.starts_on and a.ends_on limit 1;
      if absence is null then raise exception 'Cobertura vencida o sin autorización'; end if;
    end if;
    if not exists(select 1 from jsonb_array_elements(updated) x where coalesce((x->>'done')::boolean,false)=false) then
      next_status:='Completada';
    else insert into public.task_time_sessions(organization_id,instance_id,actor_id,started_at,absence_id) values(t.organization_id,t.id,auth.uid(),now_at,absence); end if;
  end if;
  if next_status in ('Completada','Pendiente') and s.id is not null then update public.task_time_sessions set ended_at=public._effective_session_end(s.id,now_at) where id=s.id; end if;
  if t.status='Completada' then insert into public.task_reopen_events(organization_id,instance_id,actor_id,reason,source) values(t.organization_id,t.id,auth.uid(),trim(p_reason),'explicit'); end if;
  update public.task_instances set checklist=updated,status=next_status,started_at=case when next_status='En curso' then coalesce(started_at,now_at) else started_at end,completed_at=case when next_status='Completada' then now_at else null end,state_revision=state_revision+1 where id=t.id returning state_revision into v;
  insert into public.audit_events(organization_id,actor_id,action,entity_id,details) values(t.organization_id,auth.uid(),'task.checklist',t.id,jsonb_build_object('step',p_check,'done',p_done,'reason',p_reason,'executor',s.actor_id,'session',s.id));
  perform public._save_mutation_receipt('checklist_reviewed',args,p_operation_id,jsonb_build_object('revision',v)); return v;
end $$;

-- Wrappers históricos no toman locks antes del núcleo de revisión.
create or replace function public.transition_task(p_instance_id uuid,next_status text) returns void
language plpgsql security definer set search_path='' as $$declare t public.task_instances; begin
  if not public.can_access_instance(p_instance_id) then raise exception 'Sin permiso'; end if;
  select * into t from public.task_instances where id=p_instance_id;
  perform public.transition_task_reviewed(p_instance_id,next_status,null,t.state_revision,gen_random_uuid());
end $$;
create or replace function public.set_checklist_item(p_instance_id uuid,p_check_id text,p_done boolean) returns void
language plpgsql security definer set search_path='' as $$declare t public.task_instances; begin
  if not public.can_access_instance(p_instance_id) then raise exception 'Sin permiso'; end if;
  select * into t from public.task_instances where id=p_instance_id;
  perform public.set_checklist_item_reviewed(p_instance_id,p_check_id,p_done,null,t.state_revision,gen_random_uuid());
end $$;

create or replace function public.record_activity(p_instance_id uuid,work_day date,qty integer,note text) returns uuid
language plpgsql security definer set search_path='' as $$
declare t public.task_instances; entry_id uuid; now_at timestamptz;
begin
  if auth.uid() is null then raise exception 'Sesión requerida'; end if;
  if not public.can_access_instance(p_instance_id) or public.actor_role()='auditor' then raise exception 'Sin permiso'; end if;
  select * into t from public.task_instances where id=p_instance_id;
  if not found then raise exception 'Sin permiso'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('work-owner:'||t.owner_id::text,0));
  perform public.lock_open_month(t.owner_id,t.period);
  select * into t from public.task_instances where id=p_instance_id for update;
  now_at:=clock_timestamp();
  if not public._can_access_instance_at(p_instance_id,now_at) or public.actor_role()='auditor' then raise exception 'Sin permiso'; end if;
  if t.kind<>'operativa' or work_day is null or qty is null or qty not between 1 and 1000000
     or nullif(trim(coalesce(note,'')),'') is null or date_trunc('month',work_day)::date<>t.period
     or work_day>(now_at at time zone 'America/Argentina/Buenos_Aires')::date then raise exception 'Fecha, cantidad o referencia inválida'; end if;
  insert into public.activity_entries(organization_id,instance_id,work_date,quantity,reference,actor_id)
  values(t.organization_id,t.id,work_day,qty,trim(note),auth.uid()) returning id into entry_id;
  update public.task_instances set state_revision=state_revision+1 where id=t.id;
  insert into public.audit_events(organization_id,actor_id,action,entity_id,details)
  values(t.organization_id,auth.uid(),'activity.created',entry_id,jsonb_build_object('instance',t.id,'work_date',work_day,'quantity',qty));
  return entry_id;
end $$;

create or replace function public.close_employee_month(p_owner uuid,p_period date,p_note text) returns uuid
language plpgsql security definer set search_path='' as $$
declare snapshot_data jsonb; new_id uuid; report_id uuid; delivery_id uuid; recipient uuid; recipient_mail text; org uuid; now_at timestamptz;
begin
  if auth.uid() is null then raise exception 'Sesión requerida'; end if;
  perform public.require_privileged_session();
  if not public.can_access_owner(p_owner) then raise exception 'Sin permiso'; end if;
  if p_period is null or extract(day from p_period)<>1 or p_period>date_trunc('month',clock_timestamp() at time zone 'America/Argentina/Buenos_Aires')::date then raise exception 'Período inválido'; end if;
  if nullif(trim(p_note),'') is null then raise exception 'La revisión requiere una nota'; end if;
  if public.actor_role()<>'jefe' and exists(select 1 from public.task_instances t where t.owner_id=p_owner and t.period=p_period and not public.can_access_instance(t.id)) then raise exception 'Se requiere acceso a todas las empresas del mes'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('work-owner:'||p_owner::text,0));
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_owner::text||p_period::text,0));
  select id into new_id from public.monthly_closures where owner_id=p_owner and period=p_period;
  if found then return new_id; end if;
  now_at:=clock_timestamp(); org:=public.actor_org();
  if p_period>date_trunc('month',now_at at time zone 'America/Argentina/Buenos_Aires')::date then raise exception 'Período inválido'; end if;
  select p.id,u.email into recipient,recipient_mail from public.report_settings s join public.profiles p on p.id=s.recipient_id and p.organization_id=s.organization_id join auth.users u on u.id=p.id
  where s.organization_id=org and p.active and p.role='jefe' and u.email_confirmed_at is not null and nullif(trim(u.email),'') is not null;
  if recipient is null then raise exception 'Configure un gerente con correo verificado antes del cierre'; end if;
  if not exists(select 1 from public.task_instances where owner_id=p_owner and period=p_period) then raise exception 'No hay tareas para cerrar'; end if;
  perform 1 from public.task_instances where owner_id=p_owner and period=p_period order by id for update;
  perform 1 from public.task_time_sessions s join public.task_instances t on t.id=s.instance_id where t.owner_id=p_owner and t.period=p_period and s.ended_at is null order by s.id for update of s;
  with expired as (
    update public.task_time_sessions s set ended_at=public._effective_session_end(s.id,now_at)
    from public.employee_absences a,public.task_instances t
    where t.owner_id=p_owner and t.period=p_period and t.id=s.instance_id and s.absence_id=a.id and s.ended_at is null
      and (((a.ends_on+1)::timestamp at time zone 'America/Argentina/Buenos_Aires')<=now_at or a.cancelled_at is not null)
    returning s.id,s.instance_id,s.actor_id,s.started_at,s.ended_at,s.organization_id
  ), revisions as (
    update public.task_instances t set state_revision=t.state_revision+1
    where t.id in(select distinct instance_id from expired) returning t.id
  )
  insert into public.audit_events(organization_id,actor_id,action,entity_id,details)
  select e.organization_id,auth.uid(),'task.timer_expired',e.id,jsonb_build_object('instance',e.instance_id,'executor',e.actor_id,'started_at',e.started_at,'ended_at',e.ended_at,'closed_by_month',p_period)
  from expired e;
  if exists(select 1 from public.task_time_sessions s join public.task_instances t on t.id=s.instance_id where t.owner_id=p_owner and t.period=p_period and s.ended_at is null) then raise exception 'Hay cronómetros activos; pausar antes del cierre'; end if;
  with work as (
    select t.*,coalesce((select sum(e.quantity) from public.activity_entries e where e.instance_id=t.id and date_trunc('month',e.work_date)::date=p_period),0) quantity
    from public.task_instances t where t.owner_id=p_owner and t.period=p_period
  ), values_per_task as (
    select *,weight*case when kind='resultado' then case when status='Completada' then 1 else 0 end else least(quantity::numeric/target,1) end earned from work
  ), totals as (
    select sum(weight) points,sum(earned) earned,count(*) filter(where kind='resultado') assigned,
      count(*) filter(where kind='resultado' and status='Completada') done,
      count(*) filter(where kind='resultado' and status='Completada' and due_date is not null) done_with_deadline,
      count(*) filter(where kind='resultado' and status='Completada' and due_date is not null and (completed_at at time zone 'America/Argentina/Buenos_Aires')::date<=due_date) on_time,
      count(*) filter(where kind='resultado' and status<>'Completada' and due_date<(now_at at time zone 'America/Argentina/Buenos_Aires')::date) late,
      count(*) filter(where blocked_by is not null) blocked,count(*) filter(where kind='operativa') operational,
      count(*) filter(where kind='operativa' and quantity>=target) operational_target from values_per_task
  )
  select jsonb_build_object('version',3,'evaluated_at',now_at,'timezone','America/Argentina/Buenos_Aires','period',p_period,
    'tasks',(select jsonb_agg(to_jsonb(t) order by t.company_id,t.id) from work t),
    'activity',coalesce((select jsonb_agg(to_jsonb(e) order by e.work_date,e.id) from public.activity_entries e join work t on t.id=e.instance_id where date_trunc('month',e.work_date)::date=p_period),'[]'::jsonb),
    'sessions',coalesce((select jsonb_agg(to_jsonb(s) order by s.started_at,s.id) from public.task_time_sessions s join work t on t.id=s.instance_id),'[]'::jsonb),
    'reopen_events',coalesce((select jsonb_agg(to_jsonb(e) order by e.at,e.id) from public.task_reopen_events e join work t on t.id=e.instance_id),'[]'::jsonb),
    'metrics',jsonb_build_object('points',points,'earned',round(earned,2),'weighted',round(earned/nullif(points,0)*100),'assigned',assigned,'done',done,
      'onTime',round(on_time::numeric/nullif(done_with_deadline,0)*100),'completedWithDeadline',done_with_deadline,
      'recordedSeconds',coalesce((select sum(extract(epoch from (s.ended_at-s.started_at))) from public.task_time_sessions s join work t on t.id=s.instance_id),0),
      'late',late,'blocked',blocked,'operational',operational,'operationalTarget',operational_target)) into snapshot_data from totals;
  insert into public.monthly_closures(organization_id,owner_id,period,snapshot,closed_by,note) values(org,p_owner,p_period,snapshot_data,auth.uid(),trim(p_note)) returning id into new_id;
  insert into public.audit_events(organization_id,actor_id,action,entity_id,details) values(org,auth.uid(),'month.closed',new_id,jsonb_build_object('owner',p_owner,'period',p_period));
  insert into public.period_reports(organization_id,closure_id,owner_id,period,snapshot) values(org,new_id,p_owner,p_period,snapshot_data) returning id into report_id;
  insert into public.report_deliveries(organization_id,report_id,recipient_id,recipient_email) values(org,report_id,recipient,recipient_mail) returning id into delivery_id;
  insert into public.report_outbox_events(organization_id,delivery_id) values(org,delivery_id);
  return new_id;
end $$;

revoke all on function public.prevent_reopen_event_mutation(),public.clamp_covered_session_end(),public.reject_overlapping_absence(),public.guard_absence_approval(),public._effective_session_end(uuid,timestamptz),public._can_access_instance_at(uuid,timestamptz) from public,anon,authenticated;
revoke execute on function public.pause_task_timer(uuid,uuid),public.start_task_timer(uuid,bigint,uuid,boolean),public.set_task_wait(uuid,text,bigint,uuid) from public,anon;
revoke execute on function public.transition_task_reviewed(uuid,text,text,bigint,uuid),public.set_checklist_item_reviewed(uuid,text,boolean,text,bigint,uuid),public.transition_task(uuid,text),public.set_checklist_item(uuid,text,boolean) from public,anon;
grant execute on function public.pause_task_timer(uuid,uuid),public.start_task_timer(uuid,bigint,uuid,boolean),public.set_task_wait(uuid,text,bigint,uuid),public.transition_task_reviewed(uuid,text,text,bigint,uuid),public.set_checklist_item_reviewed(uuid,text,boolean,text,bigint,uuid),public.transition_task(uuid,text),public.set_checklist_item(uuid,text,boolean) to authenticated;
commit;
