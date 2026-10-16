-- Cierra los seis hallazgos reproducibles de 005 y normaliza los guards de escritura.
begin;
do $$ declare conflicts text; begin
  if auth.uid() is not null then raise exception 'Migración 006 debe ejecutarse como owner'; end if;
  select string_agg(s.id::text,', ' order by s.id::text) into conflicts
  from public.task_time_sessions s
  left join public.task_instances t on t.id=s.instance_id and t.organization_id=s.organization_id
  left join public.employee_absences a on a.id=s.absence_id and a.organization_id=s.organization_id
  where t.id is null or (s.absence_id is not null and (a.id is null or a.owner_id is distinct from t.owner_id
    or a.replacement_id is distinct from s.actor_id
    or not exists(select 1 from public.employee_absence_companies c where c.absence_id=a.id and c.organization_id=a.organization_id and c.company_id=t.company_id)
    or s.started_at<((a.starts_on)::timestamp at time zone 'America/Argentina/Buenos_Aires')
    or s.started_at>=least(((a.ends_on+1)::timestamp at time zone 'America/Argentina/Buenos_Aires'),a.cancelled_at)
    or (s.ended_at is not null and s.ended_at>least(((a.ends_on+1)::timestamp at time zone 'America/Argentina/Buenos_Aires'),a.cancelled_at))));
  if conflicts is not null then raise exception 'Preflight 006: sesiones incompatibles, revisión manual requerida: %',conflicts; end if;
  select string_agg(e.id::text,', ' order by e.id::text) into conflicts
  from public.audit_events e
  left join public.task_instances t on t.id=e.entity_id and t.organization_id=e.organization_id
  where e.action='task.transition' and e.details->>'from'='Completada'
    and e.details->>'to'<>'Completada' and t.id is null;
  if conflicts is not null then raise exception 'Preflight 006: auditorías de reapertura huérfanas: %',conflicts; end if;
  select string_agg(e.id::text,', ' order by e.id::text) into conflicts
  from public.audit_events e join public.task_instances t on t.id=e.entity_id
  left join public.profiles p on p.id=e.actor_id
  where e.action='task.transition' and e.details->>'from'='Completada'
    and e.details->>'to'<>'Completada' and e.actor_id is not null
    and (t.organization_id<>e.organization_id or (p.id is not null and p.organization_id<>e.organization_id));
  if conflicts is not null then raise exception 'Preflight 006: reaperturas con organización incompatible: %',conflicts; end if;
  select string_agg(r.id::text,', ' order by r.id::text) into conflicts
  from public.task_reopen_events r
  left join public.task_instances t on t.id=r.instance_id and t.organization_id=r.organization_id
  left join public.profiles p on p.id=r.actor_id and p.organization_id=r.organization_id
  left join public.audit_events e on e.id=r.legacy_audit_id and e.organization_id=r.organization_id
  where t.id is null or (r.actor_id is not null and p.id is null)
    or (r.legacy_audit_id is not null and (e.id is null or e.action<>'task.transition' or e.entity_id<>r.instance_id));
  if conflicts is not null then raise exception 'Preflight 006: reaperturas históricas incompatibles: %',conflicts; end if;
end $$;

alter table public.employee_absences add column authorization_sealed boolean not null default true;
create or replace function public.guard_absence_immutability() returns trigger
language plpgsql security definer set search_path='' as $$begin
  if tg_op='DELETE' then raise exception 'Las ausencias forman parte del historial'; end if;
  if new.organization_id is distinct from old.organization_id or new.owner_id is distinct from old.owner_id
    or new.replacement_id is distinct from old.replacement_id or new.kind is distinct from old.kind
    or new.starts_on is distinct from old.starts_on or new.ends_on is distinct from old.ends_on
    or new.note is distinct from old.note or new.approved_by is distinct from old.approved_by then
    raise exception 'La autorización de ausencia es inmutable';
  end if;
  if old.authorization_sealed and not new.authorization_sealed then raise exception 'No se puede reabrir una autorización sellada'; end if;
  if not old.authorization_sealed and new.authorization_sealed then
    if new.cancelled_at is distinct from old.cancelled_at then raise exception 'No se puede sellar y cancelar a la vez'; end if;
    return new;
  end if;
  if old.cancelled_at is not null and new.cancelled_at is distinct from old.cancelled_at then raise exception 'La cancelación es inmutable'; end if;
  if old.cancelled_at is null and new.cancelled_at is not null and not old.authorization_sealed then raise exception 'Selle la autorización antes de cancelarla'; end if;
  if new.authorization_sealed is distinct from old.authorization_sealed
    and not (not old.authorization_sealed and new.authorization_sealed) then raise exception 'Sellado inválido'; end if;
  return new;
end$$;

create or replace function public.set_checklist_item_reviewed(p_instance uuid,p_check text,p_done boolean,p_reason text,p_expected_revision bigint,p_operation_id uuid) returns bigint
language plpgsql security definer set search_path='' as $$
declare t public.task_instances; updated jsonb; next_status text; v bigint; cached jsonb; s public.task_time_sessions; args jsonb; now_at timestamptz; absence uuid; ended timestamptz; old public.task_time_sessions; source_task public.task_instances; owner_lock uuid; r_period record;
begin
  if auth.uid() is null or p_expected_revision is null or p_expected_revision<0 or p_done is null then raise exception 'Identidad, control y revisión requeridos'; end if;
  args:=jsonb_build_object('instance',p_instance,'check',p_check,'done',p_done,'reason',p_reason,'revision',p_expected_revision);
  cached:=public._get_mutation_receipt('checklist_reviewed',args,p_operation_id);
  if cached is not null then return (cached->>'revision')::bigint; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('timer-actor:'||auth.uid()::text,0));
  if not public.can_access_instance(p_instance) or public.actor_role()='auditor' then raise exception 'Sin permiso'; end if;
  select * into t from public.task_instances where id=p_instance;
  select * into old from public.task_time_sessions where actor_id=auth.uid() and ended_at is null;
  if old.id is not null then select * into source_task from public.task_instances where id=old.instance_id; end if;
  for owner_lock in select distinct x.owner_id from (values(t.owner_id),(source_task.owner_id)) x(owner_id) where x.owner_id is not null order by x.owner_id loop
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('work-owner:'||owner_lock::text,0));
  end loop;
  for r_period in select distinct x.owner_id,x.period from (values(t.owner_id,t.period),(source_task.owner_id,source_task.period)) x(owner_id,period) where x.owner_id is not null order by x.owner_id,x.period loop
    perform public.lock_open_month(r_period.owner_id,r_period.period);
  end loop;
  perform 1 from public.task_instances where id in(t.id,source_task.id) order by id for update;
  perform 1 from public.task_time_sessions where ((instance_id=t.id and ended_at is null) or (actor_id=auth.uid() and ended_at is null)) order by id for update;
  select * into t from public.task_instances where id=p_instance;
  select * into s from public.task_time_sessions where instance_id=t.id and ended_at is null;
  now_at:=clock_timestamp();
  if not public._can_access_instance_at(t.id,now_at) or public.actor_role()='auditor' then raise exception 'Sin permiso'; end if;
  if t.state_revision is distinct from p_expected_revision then raise exception 'La tarea cambió'; end if;
  if not exists(select 1 from jsonb_array_elements(t.checklist) x where x->>'id'=p_check) then raise exception 'Paso inválido'; end if;
  if exists(select 1 from jsonb_array_elements(t.checklist) x where x->>'id'=p_check and coalesce((x->>'done')::boolean,false)=p_done) then
    perform public._save_mutation_receipt('checklist_reviewed',args,p_operation_id,jsonb_build_object('revision',t.state_revision));
    return t.state_revision;
  end if;
  if t.status='Completada' and nullif(trim(coalesce(p_reason,'')),'') is null then raise exception 'La reapertura requiere motivo'; end if;
  select jsonb_agg(case when x->>'id'=p_check then jsonb_set(x,'{done}',to_jsonb(p_done)) else x end order by pos)
    into updated from jsonb_array_elements(t.checklist) with ordinality items(x,pos);
  next_status:=case when t.status='Completada' then 'En curso' when p_done and t.status='Pendiente' and t.blocked_by is null then 'En curso' else t.status end;
  if t.kind='resultado' and next_status<>'Pendiente' and t.blocked_by is null
    and not exists(select 1 from jsonb_array_elements(updated) x where coalesce((x->>'done')::boolean,false)=false) then next_status:='Completada'; end if;
  if next_status='Completada' and s.id is not null and s.actor_id<>auth.uid() then
    if public.actor_role() not in ('jefe','encargado') or not public.can_access_owner(t.owner_id) or nullif(trim(coalesce(p_reason,'')),'') is null then raise exception 'Sólo un responsable permanente puede interrumpir al ejecutor con motivo'; end if;
    perform public.require_privileged_session();
  elsif s.id is not null and s.actor_id<>auth.uid() then raise exception 'No puede cambiar el control mientras otro ejecutor trabaja'; end if;
  if s.id is not null and s.absence_id is not null and public._session_cutoff(s.id)<=now_at then
    ended:=public._effective_session_end(s.id,now_at); update public.task_time_sessions set ended_at=ended where id=s.id;
    insert into public.audit_events(organization_id,actor_id,action,entity_id,at,details) values(t.organization_id,auth.uid(),'task.timer_expired',s.id,now_at,jsonb_build_object('instance',t.id,'executor',s.actor_id,'session',s.id,'started_at',s.started_at,'ended_at',ended,'absence',s.absence_id));
    s.id:=null;
  end if;
  if t.status='Pendiente' and next_status='En curso' then
    if t.blocked_by is not null then raise exception 'La tarea sigue en espera'; end if;
    select * into old from public.task_time_sessions where actor_id=auth.uid() and ended_at is null;
    if old.id is not null and old.absence_id is not null and public._session_cutoff(old.id)<=now_at then
      ended:=public._effective_session_end(old.id,now_at); update public.task_time_sessions set ended_at=ended where id=old.id;
      if old.instance_id<>t.id then update public.task_instances set state_revision=state_revision+1 where id=old.instance_id; end if;
      insert into public.audit_events(organization_id,actor_id,action,entity_id,at,details) values(source_task.organization_id,auth.uid(),'task.timer_expired',old.id,now_at,jsonb_build_object('instance',old.instance_id,'executor',old.actor_id,'session',old.id,'started_at',old.started_at,'ended_at',ended,'absence',old.absence_id));
      old.id:=null;
    end if;
    if old.id is not null then raise exception 'Pause su cronómetro actual antes de iniciar'; end if;
    if public.can_access_owner(t.owner_id) then absence:=null; else
      select a.id into absence from public.employee_absences a join public.employee_absence_companies c on c.absence_id=a.id and c.company_id=t.company_id
      where a.owner_id=t.owner_id and a.replacement_id=auth.uid() and a.cancelled_at is null and a.authorization_sealed
        and (now_at at time zone 'America/Argentina/Buenos_Aires')::date between a.starts_on and a.ends_on
        and t.period between date_trunc('month',a.starts_on)::date and date_trunc('month',a.ends_on)::date limit 1;
      if absence is null then raise exception 'Cobertura vencida o sin autorización'; end if;
    end if;
    if not exists(select 1 from jsonb_array_elements(updated) x where coalesce((x->>'done')::boolean,false)=false) then
      if t.kind='resultado' then next_status:='Completada'; else next_status:='En curso'; end if;
    end if;
    if next_status='En curso' then
      insert into public.task_time_sessions(organization_id,instance_id,actor_id,started_at,absence_id) values(t.organization_id,t.id,auth.uid(),now_at,absence);
    end if;
  end if;
  if next_status in ('Completada','Pendiente') and s.id is not null then
    ended:=public._effective_session_end(s.id,now_at);
    update public.task_time_sessions set ended_at=ended where id=s.id;
    if s.absence_id is not null and public._session_cutoff(s.id)<=now_at then
      insert into public.audit_events(organization_id,actor_id,action,entity_id,at,details)
      values(t.organization_id,auth.uid(),'task.timer_expired',s.id,now_at,jsonb_build_object('instance',t.id,'executor',s.actor_id,'session',s.id,'started_at',s.started_at,'ended_at',ended,'absence',s.absence_id));
    end if;
  end if;
  if t.status='Completada' then
    insert into public.task_reopen_events(organization_id,instance_id,actor_id,at,reason,source) values(t.organization_id,t.id,auth.uid(),now_at,trim(p_reason),'explicit');
  end if;
  update public.task_instances set checklist=updated,status=next_status,started_at=case when next_status='En curso' then coalesce(started_at,now_at) else started_at end,
    completed_at=case when next_status='Completada' then now_at else null end,state_revision=state_revision+1 where id=t.id returning state_revision into v;
  insert into public.audit_events(organization_id,actor_id,action,entity_id,at,details)
    values(t.organization_id,auth.uid(),'task.checklist',t.id,now_at,jsonb_build_object('step',p_check,'done',p_done,'reason',p_reason,'executor',s.actor_id,'session',s.id,'started_at',s.started_at,'ended_at',ended,'absence',s.absence_id));
  perform public._save_mutation_receipt('checklist_reviewed',args,p_operation_id,jsonb_build_object('revision',v));
  return v;
end$$;

create or replace function public.set_task_wait(p_instance uuid,p_note text,p_expected_revision bigint,p_operation_id uuid) returns bigint
language plpgsql security definer set search_path='' as $$
declare t public.task_instances; s public.task_time_sessions; cached jsonb; args jsonb; v bigint; now_at timestamptz; ended timestamptz;
begin
  if auth.uid() is null or p_expected_revision is null or p_expected_revision<0 then raise exception 'Identidad y revisión requeridas'; end if;
  if p_note is not null and nullif(trim(p_note),'') is null then raise exception 'La espera requiere una descripción o NULL para desbloquear'; end if;
  args:=jsonb_build_object('instance',p_instance,'note',p_note,'revision',p_expected_revision);
  cached:=public._get_mutation_receipt('task_wait',args,p_operation_id);
  if cached is not null then return (cached->>'revision')::bigint; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('timer-actor:'||auth.uid()::text,0));
  if not public.can_access_instance(p_instance) or public.actor_role()='auditor' then raise exception 'Sin permiso'; end if;
  select * into t from public.task_instances where id=p_instance;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('work-owner:'||t.owner_id::text,0));
  perform public.lock_open_month(t.owner_id,t.period);
  perform 1 from public.task_instances where id=t.id for update;
  select * into t from public.task_instances where id=t.id;
  select * into s from public.task_time_sessions where instance_id=t.id and ended_at is null order by id for update;
  now_at:=clock_timestamp();
  if not public._can_access_instance_at(t.id,now_at) or public.actor_role()='auditor' then raise exception 'Sin permiso'; end if;
  if t.state_revision is distinct from p_expected_revision then raise exception 'La tarea cambió'; end if;
  if p_note is null and t.blocked_by is null then
    perform public._save_mutation_receipt('task_wait',args,p_operation_id,jsonb_build_object('revision',t.state_revision));
    return t.state_revision;
  end if;
  if p_note is not null and t.blocked_by=trim(p_note) and s.id is null then
    perform public._save_mutation_receipt('task_wait',args,p_operation_id,jsonb_build_object('revision',t.state_revision));
    return t.state_revision;
  end if;
  if p_note is not null and s.id is not null and s.actor_id<>auth.uid() then
    if public.actor_role() not in ('jefe','encargado') or not public.can_access_owner(t.owner_id) then raise exception 'Sólo un responsable permanente puede detener al ejecutor'; end if;
    perform public.require_privileged_session();
  end if;
  if s.id is not null then
    ended:=public._effective_session_end(s.id,now_at);
    update public.task_time_sessions set ended_at=ended where id=s.id;
  end if;
  update public.task_instances set blocked_by=case when p_note is null then null else trim(p_note) end,
    blocked_since=case when p_note is null then null else (now_at at time zone 'America/Argentina/Buenos_Aires')::date end,
    state_revision=state_revision+1 where id=t.id returning state_revision into v;
  if p_note is not null then
    insert into public.audit_events(organization_id,actor_id,action,entity_id,at,details)
    values(t.organization_id,auth.uid(),'task.wait',t.id,now_at,jsonb_build_object('executor',s.actor_id,'session',s.id,'reason',trim(p_note),'started_at',s.started_at,'ended_at',ended,'absence',s.absence_id));
  end if;
  perform public._save_mutation_receipt('task_wait',args,p_operation_id,jsonb_build_object('revision',v));
  return v;
end$$;
drop trigger if exists employee_absence_identity_immutable on public.employee_absences;
create trigger employee_absence_identity_immutable before update or delete on public.employee_absences
for each row execute function public.guard_absence_immutability();

create or replace function public.guard_absence_company_immutability() returns trigger
language plpgsql security definer set search_path='' as $$declare sealed boolean; begin
  if tg_op<>'INSERT' then raise exception 'Las empresas autorizadas son inmutables'; end if;
  select authorization_sealed into sealed from public.employee_absences where id=new.absence_id and organization_id=new.organization_id;
  if not found or sealed then raise exception 'La autorización ya está sellada'; end if;
  return new;
end$$;
drop trigger if exists employee_absence_company_immutable on public.employee_absence_companies;
create trigger employee_absence_company_immutable before insert or update or delete on public.employee_absence_companies
for each row execute function public.guard_absence_company_immutability();

create or replace function public.guard_task_session_integrity() returns trigger
language plpgsql security definer set search_path='' as $$
declare t public.task_instances; a public.employee_absences; cutoff timestamptz;
begin
  if tg_op='DELETE' then raise exception 'Las sesiones históricas son inmutables'; end if;
  if tg_op='UPDATE' then
    if new.id is distinct from old.id or new.organization_id is distinct from old.organization_id
      or new.instance_id is distinct from old.instance_id or new.actor_id is distinct from old.actor_id
      or new.started_at is distinct from old.started_at or new.absence_id is distinct from old.absence_id
      or old.ended_at is not null or new.ended_at is null then raise exception 'La identidad o cierre de sesión es inmutable'; end if;
  end if;
  select * into t from public.task_instances where id=new.instance_id and organization_id=new.organization_id;
  if not found then raise exception 'Instancia de sesión inválida: %',new.id; end if;
  if new.absence_id is not null then
    select * into a from public.employee_absences where id=new.absence_id and organization_id=new.organization_id;
    if tg_op='INSERT' and a.cancelled_at is not null and a.cancelled_at<=clock_timestamp() then
      raise exception 'La cobertura ya fue cancelada: %',new.absence_id;
    end if;
    if not found or not a.authorization_sealed or a.owner_id is distinct from t.owner_id or a.replacement_id is distinct from new.actor_id
      or not exists(select 1 from public.employee_absence_companies c where c.absence_id=a.id and c.organization_id=a.organization_id and c.company_id=t.company_id)
      or new.started_at<((a.starts_on)::timestamp at time zone 'America/Argentina/Buenos_Aires') then
      raise exception 'Ausencia y sesión no coinciden: %',new.id;
    end if;
    cutoff:=least(((a.ends_on+1)::timestamp at time zone 'America/Argentina/Buenos_Aires'),a.cancelled_at);
    if new.ended_at is not null then new.ended_at:=least(new.ended_at,cutoff); end if;
    if new.started_at>=cutoff then raise exception 'La sesión empieza después del corte de cobertura: %',new.id; end if;
  end if;
  if new.ended_at is not null and new.ended_at<new.started_at then raise exception 'El fin precede al inicio: %',new.id; end if;
  return new;
end$$;
drop trigger if exists task_sessions_clamp_end on public.task_time_sessions;
drop trigger if exists task_time_session_integrity on public.task_time_sessions;
create trigger task_time_session_integrity before insert or update or delete on public.task_time_sessions
for each row execute function public.guard_task_session_integrity();

create or replace function public._session_cutoff(p_session uuid) returns timestamptz
language sql stable security definer set search_path='' as $$
  select least(((a.ends_on+1)::timestamp at time zone 'America/Argentina/Buenos_Aires'),a.cancelled_at)
  from public.task_time_sessions s join public.employee_absences a on a.id=s.absence_id where s.id=p_session
$$;
revoke all on function public.guard_absence_immutability(),public.guard_absence_company_immutability(),public.guard_task_session_integrity(),public._session_cutoff(uuid) from public,anon,authenticated;

create or replace function public.approve_employee_absence(p_owner uuid,p_replacement uuid,p_kind text,p_starts date,p_ends date,p_company_ids uuid[],p_note text,p_operation_id uuid) returns uuid
language plpgsql security definer set search_path='' as $$
declare org uuid; new_id uuid; cached jsonb; c uuid; args jsonb; at_time timestamptz;
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
    if not public.can_access_owner(p_owner) or (p_replacement is not null and not public.can_access_owner(p_replacement)) then raise exception 'Fuera del ámbito permanente'; end if;
    if exists(select 1 from unnest(coalesce(p_company_ids,'{}'::uuid[])) cid where not exists(select 1 from public.company_memberships m where m.profile_id=auth.uid() and m.company_id=cid and m.organization_id=org)) then raise exception 'Empresa fuera del ámbito'; end if;
  end if;
  if p_replacement is not null and (p_replacement=p_owner or not exists(select 1 from public.profiles where id=p_replacement and organization_id=org and active and role in ('empleado','encargado'))) then raise exception 'Reemplazante inválido'; end if;
  if p_replacement is not null and (coalesce(cardinality(p_company_ids),0)=0 or array_position(p_company_ids,null) is not null or cardinality(p_company_ids)<>(select count(distinct x) from unnest(p_company_ids) x)) then raise exception 'Seleccione empresas válidas y sin repetir'; end if;
  if p_replacement is null and coalesce(cardinality(p_company_ids),0)>0 then raise exception 'Sin reemplazante no se habilitan empresas'; end if;
  if p_replacement is not null and exists(select 1 from unnest(p_company_ids) cid where not exists(select 1 from public.company_memberships m where m.profile_id=p_owner and m.company_id=cid and m.organization_id=org) or not exists(select 1 from public.company_memberships m where m.profile_id=p_replacement and m.company_id=cid and m.organization_id=org)) then raise exception 'Ambos deben pertenecer a las empresas seleccionadas'; end if;
  if exists(select 1 from public.employee_absences where owner_id=p_owner and cancelled_at is null and daterange(starts_on,ends_on,'[]') && daterange(p_starts,p_ends,'[]')) then raise exception 'La ausencia se superpone con otra'; end if;
  at_time:=clock_timestamp();
  insert into public.employee_absences(organization_id,owner_id,replacement_id,kind,starts_on,ends_on,note,approved_by,authorization_sealed)
  values(org,p_owner,p_replacement,p_kind,p_starts,p_ends,trim(p_note),auth.uid(),false) returning id into new_id;
  foreach c in array coalesce(p_company_ids,'{}'::uuid[]) loop insert into public.employee_absence_companies(absence_id,organization_id,company_id) values(new_id,org,c); end loop;
  update public.employee_absences set authorization_sealed=true where id=new_id;
  insert into public.audit_events(organization_id,actor_id,action,entity_id,at,details) values(org,auth.uid(),'absence.approved',new_id,at_time,jsonb_build_object('owner',p_owner,'replacement',p_replacement,'companies',coalesce(to_jsonb(p_company_ids),'[]'::jsonb)));
  perform public._save_mutation_receipt('approve_absence',args,p_operation_id,jsonb_build_object('id',new_id)); return new_id;
end $$;

create or replace function public.pause_task_timer(p_session uuid,p_operation_id uuid) returns timestamptz
language plpgsql security definer set search_path='' as $$
declare s public.task_time_sessions; t public.task_instances; r public.task_mutation_receipts; ended timestamptz; org uuid; args jsonb; now_at timestamptz;
begin
  if auth.uid() is null or p_operation_id is null then raise exception 'Identidad y operación requeridas'; end if;
  args:=jsonb_build_object('session',p_session);
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(auth.uid()::text||p_operation_id::text,0));
  select * into r from public.task_mutation_receipts where actor_id=auth.uid() and operation_id=p_operation_id;
  if found then if r.operation_kind<>'pause_timer' or r.arguments<>args then raise exception 'Identificador de operación reutilizado con otros argumentos'; end if; return (r.result->>'ended_at')::timestamptz; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('timer-actor:'||auth.uid()::text,0));
  select * into s from public.task_time_sessions where id=p_session and actor_id=auth.uid(); if not found then raise exception 'Sesión propia no encontrada'; end if;
  select * into t from public.task_instances where id=s.instance_id; if not found then raise exception 'Sesión inválida'; end if;
  select organization_id into org from public.profiles where id=auth.uid() and organization_id=t.organization_id; if org is null then raise exception 'Sin permiso'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('work-owner:'||t.owner_id::text,0));
  perform public.lock_open_month(t.owner_id,t.period);
  perform 1 from public.task_instances where id=t.id for update;
  select * into s from public.task_time_sessions where id=p_session and actor_id=auth.uid() for update;
  now_at:=clock_timestamp();
  if s.ended_at is not null then ended:=s.ended_at;
  else
    if exists(select 1 from public.monthly_closures c where c.owner_id=t.owner_id and c.period=t.period) then raise exception 'El mes está cerrado'; end if;
    ended:=public._effective_session_end(s.id,now_at);
    update public.task_time_sessions set ended_at=ended where id=s.id;
    update public.task_instances set state_revision=state_revision+1 where id=t.id;
    if s.absence_id is not null and public._session_cutoff(s.id)<=now_at then
      insert into public.audit_events(organization_id,actor_id,action,entity_id,at,details) values(t.organization_id,auth.uid(),'task.timer_expired',s.id,now_at,jsonb_build_object('instance',t.id,'executor',s.actor_id,'session',s.id,'started_at',s.started_at,'ended_at',ended,'absence',s.absence_id));
    end if;
  end if;
  insert into public.task_mutation_receipts(organization_id,actor_id,operation_id,operation_kind,arguments,result) values(org,auth.uid(),p_operation_id,'pause_timer',args,jsonb_build_object('ended_at',ended));
  return ended;
end$$;

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
  perform 1 from public.task_instances where id in (t.id,source_task.id) order by id for update;
  select * into t from public.task_instances where id=p_instance;
  perform 1 from public.task_time_sessions where ((instance_id=t.id and ended_at is null) or (actor_id=auth.uid() and ended_at is null)) order by id for update;
  select * into s from public.task_time_sessions where instance_id=t.id and ended_at is null;
  now_at:=clock_timestamp();
  if not public._can_access_instance_at(p_instance,now_at) or public.actor_role()='auditor' then raise exception 'Sin permiso'; end if;
  if t.state_revision is distinct from p_expected_revision then raise exception 'La tarea cambió; actualice antes de continuar'; end if;
  if t.status='Completada' or t.blocked_by is not null then raise exception 'La tarea no admite cronómetro'; end if;
  if s.id is not null then
    if s.absence_id is not null and public._session_cutoff(s.id)<=now_at then
      update public.task_time_sessions set ended_at=public._effective_session_end(s.id,now_at) where id=s.id;
      insert into public.audit_events(organization_id,actor_id,action,entity_id,at,details) values(t.organization_id,auth.uid(),'task.timer_expired',s.id,now_at,jsonb_build_object('instance',t.id,'executor',s.actor_id,'session',s.id,'started_at',s.started_at,'ended_at',public._effective_session_end(s.id,now_at),'absence',s.absence_id));
      s.id:=null;
    end if;
    if s.id is not null then
      if s.actor_id<>auth.uid() then raise exception 'La tarea tiene otro ejecutor activo'; end if;
      perform public._save_mutation_receipt('start_timer',args,p_operation_id,jsonb_build_object('session_id',s.id));
      return s.id;
    end if;
  end if;
  select * into old from public.task_time_sessions where actor_id=auth.uid() and ended_at is null;
  if old.id is not null and old.absence_id is not null and public._session_cutoff(old.id)<=now_at then
    update public.task_time_sessions set ended_at=public._effective_session_end(old.id,now_at) where id=old.id;
    update public.task_instances set state_revision=state_revision+1 where id=source_task.id;
    insert into public.audit_events(organization_id,actor_id,action,entity_id,at,details) values(source_task.organization_id,auth.uid(),'task.timer_expired',old.id,now_at,jsonb_build_object('instance',source_task.id,'executor',old.actor_id,'session',old.id,'started_at',old.started_at,'ended_at',public._effective_session_end(old.id,now_at),'absence',old.absence_id));
    old.id:=null;
  end if;
  if old.id is not null and not p_switch then raise exception 'Pause su cronómetro actual o solicite el cambio'; end if;
  if public.can_access_owner(t.owner_id) then absence:=null; else
    select a.id into absence from public.employee_absences a join public.employee_absence_companies c on c.absence_id=a.id and c.company_id=t.company_id
    where a.owner_id=t.owner_id and a.replacement_id=auth.uid() and a.cancelled_at is null and a.authorization_sealed
      and (now_at at time zone 'America/Argentina/Buenos_Aires')::date between a.starts_on and a.ends_on
      and t.period between date_trunc('month',a.starts_on)::date and date_trunc('month',a.ends_on)::date limit 1;
    if absence is null then raise exception 'Cobertura vencida o sin autorización para esta empresa'; end if;
  end if;
  if old.id is not null then
    update public.task_time_sessions set ended_at=public._effective_session_end(old.id,now_at) where id=old.id;
    update public.task_instances set state_revision=state_revision+1 where id=source_task.id;
    insert into public.audit_events(organization_id,actor_id,action,entity_id,at,details) values(source_task.organization_id,auth.uid(),'task.timer_switched',old.id,now_at,jsonb_build_object('from_instance',source_task.id,'to_instance',t.id,'executor',old.actor_id,'session',old.id,'started_at',old.started_at,'ended_at',public._effective_session_end(old.id,now_at),'absence',old.absence_id));
  end if;
  if t.status='Pendiente' then update public.task_instances set status='En curso',started_at=coalesce(started_at,now_at),state_revision=state_revision+1 where id=t.id;
  else update public.task_instances set state_revision=state_revision+1 where id=t.id; end if;
  insert into public.task_time_sessions(organization_id,instance_id,actor_id,started_at,absence_id) values(t.organization_id,t.id,auth.uid(),now_at,absence) returning * into s;
  perform public._save_mutation_receipt('start_timer',args,p_operation_id,jsonb_build_object('session_id',s.id)); return s.id;
end $$;


create or replace function public.close_employee_month(p_owner uuid,p_period date,p_note text) returns uuid
language plpgsql security definer set search_path='' as $$
declare snapshot_data jsonb; new_id uuid; report_id uuid; delivery_id uuid; recipient uuid; recipient_mail text; org uuid; now_at timestamptz; row_session record;
begin
  if auth.uid() is null then raise exception 'Sesión requerida'; end if;
  perform public.require_privileged_session();
  if public.actor_role() not in ('jefe','encargado') or not public.can_access_owner(p_owner) then raise exception 'Sin permiso'; end if;
  if p_period is null or extract(day from p_period)<>1 or p_period>date_trunc('month',clock_timestamp() at time zone 'America/Argentina/Buenos_Aires')::date then raise exception 'Período inválido'; end if;
  if nullif(trim(p_note),'') is null then raise exception 'La revisión requiere una nota'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('work-owner:'||p_owner::text,0));
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_owner::text||p_period::text,0));
  if public.actor_role() not in ('jefe','encargado') or not public.can_access_owner(p_owner) then raise exception 'Sin permiso'; end if;
  perform public.require_privileged_session();
  org:=public.actor_org(); if org is null then raise exception 'Sin permiso'; end if;
  if public.actor_role()<>'jefe' and exists(select 1 from public.task_instances t where t.owner_id=p_owner and t.period=p_period and not public.can_access_instance(t.id)) then raise exception 'Se requiere acceso permanente a todas las empresas del mes'; end if;
  select id into new_id from public.monthly_closures where owner_id=p_owner and period=p_period;
  if found then return new_id; end if;
  select p.id,u.email into recipient,recipient_mail from public.report_settings s join public.profiles p on p.id=s.recipient_id and p.organization_id=s.organization_id join auth.users u on u.id=p.id
  where s.organization_id=org and p.active and p.role='jefe' and u.email_confirmed_at is not null and nullif(trim(u.email),'') is not null;
  if recipient is null then raise exception 'Configure un gerente con correo verificado antes del cierre'; end if;
  if not exists(select 1 from public.task_instances where owner_id=p_owner and period=p_period) then raise exception 'No hay tareas para cerrar'; end if;
  perform 1 from public.task_instances where owner_id=p_owner and period=p_period order by id for update;
  perform 1 from public.task_time_sessions s join public.task_instances t on t.id=s.instance_id where t.owner_id=p_owner and t.period=p_period and s.ended_at is null order by s.id for update of s;
  now_at:=clock_timestamp();
  if p_period>date_trunc('month',now_at at time zone 'America/Argentina/Buenos_Aires')::date then raise exception 'Período inválido'; end if;
  if public.actor_role() not in ('jefe','encargado') or public.actor_org() is distinct from org or not public.can_access_owner(p_owner) then raise exception 'Permiso modificado durante el cierre'; end if;
  perform public.require_privileged_session();
  if public.actor_role()<>'jefe' and exists(select 1 from public.task_instances t where t.owner_id=p_owner and t.period=p_period and not public.can_access_instance(t.id)) then raise exception 'Se requiere acceso permanente a todas las empresas del mes'; end if;
  select p.id,u.email into recipient,recipient_mail from public.report_settings s join public.profiles p on p.id=s.recipient_id and p.organization_id=s.organization_id join auth.users u on u.id=p.id where s.organization_id=org and p.active and p.role='jefe' and u.email_confirmed_at is not null and nullif(trim(u.email),'') is not null;
  if recipient is null then raise exception 'Configure un gerente con correo verificado antes del cierre'; end if;
  with expired as (
    update public.task_time_sessions s set ended_at=public._effective_session_end(s.id,now_at)
    from public.employee_absences a,public.task_instances t
    where t.owner_id=p_owner and t.period=p_period and t.id=s.instance_id and s.absence_id=a.id and s.ended_at is null
      and (((a.ends_on+1)::timestamp at time zone 'America/Argentina/Buenos_Aires')<=now_at or a.cancelled_at<=now_at)
    returning s.id,s.instance_id,s.actor_id,s.started_at,s.ended_at,s.organization_id,s.absence_id
  ), revisions as (
    update public.task_instances t set state_revision=t.state_revision+1
    where t.id in(select distinct instance_id from expired) returning t.id
  )
  insert into public.audit_events(organization_id,actor_id,action,entity_id,at,details)
  select e.organization_id,auth.uid(),'task.timer_expired',e.id,now_at,jsonb_build_object('instance',e.instance_id,'session',e.id,'executor',e.actor_id,'started_at',e.started_at,'ended_at',e.ended_at,'absence',e.absence_id,'closed_by_month',p_period)
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
  insert into public.audit_events(organization_id,actor_id,action,entity_id,at,details) values(org,auth.uid(),'month.closed',new_id,now_at,jsonb_build_object('owner',p_owner,'period',p_period));
  insert into public.period_reports(organization_id,closure_id,owner_id,period,snapshot) values(org,new_id,p_owner,p_period,snapshot_data) returning id into report_id;
  insert into public.report_deliveries(organization_id,report_id,recipient_id,recipient_email) values(org,report_id,recipient,recipient_mail) returning id into delivery_id;
  insert into public.report_outbox_events(organization_id,delivery_id) values(org,delivery_id);
  return new_id;
end $$;


create or replace function public.transition_task_reviewed(p_instance uuid,p_next text,p_reason text,p_expected_revision bigint,p_operation_id uuid) returns bigint
language plpgsql security definer set search_path='' as $$
declare t public.task_instances; cached jsonb; v bigint; s public.task_time_sessions; args jsonb; now_at timestamptz; absence uuid; old public.task_time_sessions; source_task public.task_instances; owner_lock uuid; r_period record; ended timestamptz;
begin
  if auth.uid() is null or p_expected_revision is null or p_expected_revision<0 or p_next is null then raise exception 'Identidad, estado y revisión requeridos'; end if;
  args:=jsonb_build_object('instance',p_instance,'next',p_next,'reason',p_reason,'revision',p_expected_revision);
  cached:=public._get_mutation_receipt('transition_reviewed',args,p_operation_id); if cached is not null then return (cached->>'revision')::bigint; end if;
  if p_next not in ('Pendiente','En curso','Completada') then raise exception 'Estado inválido'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('timer-actor:'||auth.uid()::text,0));
  if not public.can_access_instance(p_instance) or public.actor_role()='auditor' then raise exception 'Sin permiso'; end if;
  select * into t from public.task_instances where id=p_instance;
  select * into old from public.task_time_sessions where actor_id=auth.uid() and ended_at is null;
  if old.id is not null then select * into source_task from public.task_instances where id=old.instance_id; end if;
  for owner_lock in select distinct x.owner_id from (values(t.owner_id),(source_task.owner_id)) x(owner_id) where x.owner_id is not null order by x.owner_id loop
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('work-owner:'||owner_lock::text,0));
  end loop;
  for r_period in select distinct x.owner_id,x.period from (values(t.owner_id,t.period),(source_task.owner_id,source_task.period)) x(owner_id,period) where x.owner_id is not null order by x.owner_id,x.period loop
    perform public.lock_open_month(r_period.owner_id,r_period.period);
  end loop;
  perform 1 from public.task_instances where id in(t.id,source_task.id) order by id for update;
  perform 1 from public.task_time_sessions where ((instance_id=t.id and ended_at is null) or (actor_id=auth.uid() and ended_at is null)) order by id for update;
  select * into t from public.task_instances where id=p_instance;
  now_at:=clock_timestamp(); if not public._can_access_instance_at(p_instance,now_at) or public.actor_role()='auditor' then raise exception 'Sin permiso'; end if;
  if t.state_revision is distinct from p_expected_revision then raise exception 'La tarea cambió'; end if;
  if t.status=p_next then perform public._save_mutation_receipt('transition_reviewed',args,p_operation_id,jsonb_build_object('revision',t.state_revision)); return t.state_revision; end if;
  if p_next='En curso' and t.blocked_by is not null then raise exception 'Desbloquee la tarea antes de iniciarla'; end if;
  if t.status='Completada' and p_next<>'Completada' and nullif(trim(coalesce(p_reason,'')),'') is null then raise exception 'La reapertura requiere motivo'; end if;
  if p_next='Completada' and (t.kind='operativa' or t.status='Pendiente' or t.blocked_by is not null or exists(select 1 from jsonb_array_elements(t.checklist) c where coalesce((c->>'done')::boolean,false)=false)) then raise exception 'Transición inválida o controles pendientes'; end if;
  select * into s from public.task_time_sessions where instance_id=t.id and ended_at is null;
  if s.id is not null and s.actor_id<>auth.uid() then
    if p_next not in ('Pendiente','Completada') or public.actor_role() not in ('jefe','encargado') or not public.can_access_owner(t.owner_id) or nullif(trim(coalesce(p_reason,'')),'') is null then raise exception 'Sólo un responsable permanente puede interrumpir al ejecutor con motivo'; end if;
    perform public.require_privileged_session();
  end if;
  if s.id is not null and s.absence_id is not null and public._session_cutoff(s.id)<=now_at then
    ended:=public._effective_session_end(s.id,now_at);
    update public.task_time_sessions set ended_at=ended where id=s.id;
    insert into public.audit_events(organization_id,actor_id,action,entity_id,at,details) values(t.organization_id,auth.uid(),'task.timer_expired',s.id,now_at,jsonb_build_object('instance',t.id,'executor',s.actor_id,'session',s.id,'started_at',s.started_at,'ended_at',ended,'absence',s.absence_id));
    s.id:=null;
  end if;
  if p_next='En curso' and t.status='Pendiente' then
    select * into old from public.task_time_sessions where actor_id=auth.uid() and ended_at is null;
    if old.id is not null and old.absence_id is not null and public._session_cutoff(old.id)<=now_at then
      ended:=public._effective_session_end(old.id,now_at); update public.task_time_sessions set ended_at=ended where id=old.id;
      if old.instance_id<>t.id then update public.task_instances set state_revision=state_revision+1 where id=old.instance_id; end if;
      insert into public.audit_events(organization_id,actor_id,action,entity_id,at,details) values(source_task.organization_id,auth.uid(),'task.timer_expired',old.id,now_at,jsonb_build_object('instance',old.instance_id,'executor',old.actor_id,'session',old.id,'started_at',old.started_at,'ended_at',ended,'absence',old.absence_id));
      old.id:=null;
    end if;
    if old.id is not null then raise exception 'Pause su cronómetro actual antes de iniciar'; end if;
    if s.id is not null then raise exception 'La tarea ya tiene un ejecutor'; end if;
    if public.can_access_owner(t.owner_id) then absence:=null; else
      select a.id into absence from public.employee_absences a join public.employee_absence_companies c on c.absence_id=a.id and c.company_id=t.company_id
      where a.owner_id=t.owner_id and a.replacement_id=auth.uid() and a.cancelled_at is null and a.authorization_sealed and (now_at at time zone 'America/Argentina/Buenos_Aires')::date between a.starts_on and a.ends_on limit 1;
      if absence is null then raise exception 'Cobertura vencida o sin autorización'; end if;
    end if;
    insert into public.task_time_sessions(organization_id,instance_id,actor_id,started_at,absence_id) values(t.organization_id,t.id,auth.uid(),now_at,absence);
  end if;
  if p_next in ('Pendiente','Completada') and s.id is not null then ended:=public._effective_session_end(s.id,now_at); update public.task_time_sessions set ended_at=ended where id=s.id; end if;
  if t.status='Completada' and p_next<>'Completada' then insert into public.task_reopen_events(organization_id,instance_id,actor_id,at,reason,source) values(t.organization_id,t.id,auth.uid(),now_at,trim(p_reason),'explicit'); end if;
  update public.task_instances set status=p_next,started_at=case when p_next='En curso' then coalesce(started_at,now_at) else started_at end,completed_at=case when p_next='Completada' then now_at else null end,state_revision=state_revision+1 where id=t.id returning state_revision into v;
  insert into public.audit_events(organization_id,actor_id,action,entity_id,at,details) values(t.organization_id,auth.uid(),'task.transition',t.id,now_at,jsonb_build_object('from',t.status,'to',p_next,'reason',p_reason,'executor',s.actor_id,'session',s.id,'started_at',s.started_at,'ended_at',ended,'absence',s.absence_id));
  perform public._save_mutation_receipt('transition_reviewed',args,p_operation_id,jsonb_build_object('revision',v)); return v;
end $$;



revoke execute on function public._session_cutoff(uuid),public.guard_absence_immutability(),public.guard_absence_company_immutability(),public.guard_task_session_integrity() from public,anon,authenticated;
commit;
