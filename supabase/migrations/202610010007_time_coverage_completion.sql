-- Completa la aceptación de cobertura/cronómetros. No modifica historia previa.
begin;

create or replace function public.guard_absence_immutability() returns trigger
language plpgsql security definer set search_path='' as $$begin
  if tg_op='DELETE' then raise exception 'Las ausencias forman parte del historial'; end if;
  if new.id is distinct from old.id or new.organization_id is distinct from old.organization_id or new.owner_id is distinct from old.owner_id
    or new.replacement_id is distinct from old.replacement_id or new.kind is distinct from old.kind
    or new.starts_on is distinct from old.starts_on or new.ends_on is distinct from old.ends_on
    or new.note is distinct from old.note or new.approved_by is distinct from old.approved_by
    or new.approved_at is distinct from old.approved_at then
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

create or replace function public.guard_absence_company_immutability() returns trigger
language plpgsql security definer set search_path='' as $$declare sealed boolean; begin
  if tg_op<>'INSERT' then raise exception 'Las empresas autorizadas son inmutables'; end if;
  select authorization_sealed into sealed from public.employee_absences where id=new.absence_id and organization_id=new.organization_id for update;
  if not found or sealed then raise exception 'La autorización ya está sellada'; end if;
  return new;
end$$;

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
  insert into public.employee_absences(organization_id,owner_id,replacement_id,kind,starts_on,ends_on,note,approved_by,approved_at,authorization_sealed)
  values(org,p_owner,p_replacement,p_kind,p_starts,p_ends,trim(p_note),auth.uid(),at_time,false) returning id into new_id;
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
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(t.owner_id::text||t.period::text,0));
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
      insert into public.audit_events(organization_id,actor_id,action,entity_id,at,details)
      values(t.organization_id,auth.uid(),'task.timer_expired',s.id,now_at,jsonb_build_object('instance',t.id,'executor',s.actor_id,'session',s.id,'started_at',s.started_at,'ended_at',ended,'absence',s.absence_id));
    else
      insert into public.audit_events(organization_id,actor_id,action,entity_id,at,details)
      values(t.organization_id,auth.uid(),'task.timer_paused',s.id,now_at,jsonb_build_object('instance',t.id,'executor',s.actor_id,'session',s.id,'started_at',s.started_at,'ended_at',ended,'absence',s.absence_id));
    end if;
  end if;
  insert into public.task_mutation_receipts(organization_id,actor_id,operation_id,operation_kind,arguments,result) values(org,auth.uid(),p_operation_id,'pause_timer',args,jsonb_build_object('ended_at',ended));
  return ended;
end$$;

create or replace function public.start_task_timer(p_instance uuid,p_expected_revision bigint,p_operation_id uuid,p_switch boolean default false) returns uuid
language plpgsql security definer set search_path='' as $$
declare t public.task_instances; s public.task_time_sessions; old public.task_time_sessions; result jsonb; absence uuid; now_at timestamptz; source_task public.task_instances; planned_source_task public.task_instances; owner_lock uuid; args jsonb; planned_source_id uuid; planned_source_revision bigint;
begin
  if auth.uid() is null or p_expected_revision is null or p_expected_revision<0 or p_switch is null then raise exception 'Identidad, revisión y decisión de cambio requeridas'; end if;
  args:=jsonb_build_object('instance',p_instance,'revision',p_expected_revision,'switch',p_switch);
  result:=public._get_mutation_receipt('start_timer',args,p_operation_id); if result is not null then return (result->>'session_id')::uuid; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('timer-actor:'||auth.uid()::text,0));
  if not public.can_access_instance(p_instance) or public.actor_role()='auditor' then raise exception 'Sin permiso'; end if;
  select * into t from public.task_instances where id=p_instance;
  select * into old from public.task_time_sessions where actor_id=auth.uid() and ended_at is null;
  if old.id is not null then select * into source_task from public.task_instances where id=old.instance_id; planned_source_id:=old.id; planned_source_revision:=source_task.state_revision; planned_source_task:=source_task; end if;
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
  select * into old from public.task_time_sessions where actor_id=auth.uid() and ended_at is null;
  if old.id is distinct from planned_source_id then raise exception 'El cronómetro de origen cambió'; end if;
  if old.id is not null then
    select * into source_task from public.task_instances where id=old.instance_id;
    if source_task is distinct from planned_source_task or source_task.state_revision is distinct from planned_source_revision then raise exception 'La tarea de origen cambió'; end if;
  end if;
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

create or replace function public.set_checklist_item_reviewed(p_instance uuid,p_check text,p_done boolean,p_reason text,p_expected_revision bigint,p_operation_id uuid) returns bigint
language plpgsql security definer set search_path='' as $$
declare t public.task_instances; updated jsonb; next_status text; v bigint; cached jsonb; s public.task_time_sessions; args jsonb; now_at timestamptz; absence uuid; ended timestamptz; old public.task_time_sessions; source_task public.task_instances; planned_source_task public.task_instances; owner_lock uuid; r_period record; planned_source_id uuid; planned_source_revision bigint; needs_start boolean; expired_s public.task_time_sessions;
begin
  if auth.uid() is null or p_expected_revision is null or p_expected_revision<0 or p_done is null then raise exception 'Identidad, control y revisión requeridos'; end if;
  args:=jsonb_build_object('instance',p_instance,'check',p_check,'done',p_done,'reason',p_reason,'revision',p_expected_revision);
  cached:=public._get_mutation_receipt('checklist_reviewed',args,p_operation_id);
  if cached is not null then return (cached->>'revision')::bigint; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('timer-actor:'||auth.uid()::text,0));
  if not public.can_access_instance(p_instance) or public.actor_role()='auditor' then raise exception 'Sin permiso'; end if;
  select * into t from public.task_instances where id=p_instance;
  if not found then raise exception 'Tarea inexistente'; end if;
  if not exists(select 1 from jsonb_array_elements(t.checklist) x where x->>'id'=p_check) then raise exception 'Paso inválido'; end if;
  select jsonb_agg(case when x->>'id'=p_check then jsonb_set(x,'{done}',to_jsonb(p_done)) else x end order by pos)
    into updated from jsonb_array_elements(t.checklist) with ordinality items(x,pos);
  next_status:=case when t.status='Completada' then 'En curso' when p_done and t.status='Pendiente' and t.blocked_by is null then 'En curso' else t.status end;
  if t.kind='resultado' and next_status<>'Pendiente' and t.blocked_by is null
    and not exists(select 1 from jsonb_array_elements(updated) x where coalesce((x->>'done')::boolean,false)=false) then next_status:='Completada'; end if;
  needs_start:=t.status='Pendiente' and next_status='En curso';
  if needs_start then
    select * into old from public.task_time_sessions where actor_id=auth.uid() and ended_at is null;
    if old.id is not null then select * into source_task from public.task_instances where id=old.instance_id; planned_source_id:=old.id; planned_source_revision:=source_task.state_revision; planned_source_task:=source_task; end if;
  end if;
  for owner_lock in select distinct x.owner_id from (values(t.owner_id),(case when needs_start then source_task.owner_id end)) x(owner_id) where x.owner_id is not null order by x.owner_id loop
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('work-owner:'||owner_lock::text,0));
  end loop;
  for r_period in select distinct x.owner_id,x.period from (values(t.owner_id,t.period),(case when needs_start then source_task.owner_id end,case when needs_start then source_task.period end)) x(owner_id,period) where x.owner_id is not null order by x.owner_id,x.period loop
    perform public.lock_open_month(r_period.owner_id,r_period.period);
  end loop;
  perform 1 from public.task_instances where id in(t.id,case when needs_start then source_task.id end) order by id for update;
  perform 1 from public.task_time_sessions where ((instance_id=t.id and ended_at is null) or (needs_start and actor_id=auth.uid() and ended_at is null)) order by id for update;
  select * into t from public.task_instances where id=p_instance;
  select * into s from public.task_time_sessions where instance_id=t.id and ended_at is null;
  if needs_start then
    select * into old from public.task_time_sessions where actor_id=auth.uid() and ended_at is null;
    if old.id is distinct from planned_source_id then raise exception 'El cronómetro de origen cambió'; end if;
    if old.id is not null then select * into source_task from public.task_instances where id=old.instance_id;
      if source_task is distinct from planned_source_task or source_task.state_revision is distinct from planned_source_revision then raise exception 'La tarea de origen cambió'; end if;
    end if;
  end if;
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
  if s.id is not null and s.absence_id is not null and public._session_cutoff(s.id)<=now_at then
    expired_s:=s; ended:=public._effective_session_end(s.id,now_at); update public.task_time_sessions set ended_at=ended where id=s.id;
    insert into public.audit_events(organization_id,actor_id,action,entity_id,at,details) values(t.organization_id,auth.uid(),'task.timer_expired',s.id,now_at,jsonb_build_object('instance',t.id,'executor',s.actor_id,'session',s.id,'started_at',s.started_at,'ended_at',ended,'absence',s.absence_id)); s.id:=null;
  end if;
  if next_status='Completada' and s.id is not null and s.actor_id<>auth.uid() then
    if public.actor_role() not in ('jefe','encargado') or not public.can_access_owner(t.owner_id) or nullif(trim(coalesce(p_reason,'')),'') is null then raise exception 'Sólo un responsable permanente puede interrumpir al ejecutor con motivo'; end if;
    perform public.require_privileged_session();
  elsif s.id is not null and s.actor_id<>auth.uid() then raise exception 'No puede cambiar el control mientras otro ejecutor trabaja'; end if;
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
    values(t.organization_id,auth.uid(),'task.checklist',t.id,now_at,jsonb_build_object('step',p_check,'done',p_done,'reason',p_reason,'executor',coalesce(s.actor_id,expired_s.actor_id),'session',coalesce(s.id,expired_s.id),'started_at',coalesce(s.started_at,expired_s.started_at),'ended_at',ended,'absence',coalesce(s.absence_id,expired_s.absence_id)));
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
  if p_note is null then
    if t.blocked_by is null then
      perform public._save_mutation_receipt('task_wait',args,p_operation_id,jsonb_build_object('revision',t.state_revision));
      return t.state_revision;
    end if;
    update public.task_instances set blocked_by=null,blocked_since=null,state_revision=state_revision+1 where id=t.id returning state_revision into v;
    insert into public.audit_events(organization_id,actor_id,action,entity_id,at,details)
    values(t.organization_id,auth.uid(),'task.wait_cleared',t.id,now_at,jsonb_build_object('previous_reason',t.blocked_by));
    perform public._save_mutation_receipt('task_wait',args,p_operation_id,jsonb_build_object('revision',v));
    return v;
  end if;
  if p_note is null and t.blocked_by is null then
    perform public._save_mutation_receipt('task_wait',args,p_operation_id,jsonb_build_object('revision',t.state_revision));
    return t.state_revision;
  end if;
  if s.id is not null and s.absence_id is not null and public._session_cutoff(s.id)<=now_at then
    ended:=public._effective_session_end(s.id,now_at);
    update public.task_time_sessions set ended_at=ended where id=s.id;
    insert into public.audit_events(organization_id,actor_id,action,entity_id,at,details)
    values(t.organization_id,auth.uid(),'task.timer_expired',s.id,now_at,jsonb_build_object('instance',t.id,'executor',s.actor_id,'session',s.id,'started_at',s.started_at,'ended_at',ended,'absence',s.absence_id));
    s.id:=null;
  end if;
  if p_note is not null and t.blocked_by=trim(p_note) and s.id is null and ended is null then
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

create or replace function public.transition_task_reviewed(p_instance uuid,p_next text,p_reason text,p_expected_revision bigint,p_operation_id uuid) returns bigint
language plpgsql security definer set search_path='' as $$
declare t public.task_instances; cached jsonb; v bigint; s public.task_time_sessions; args jsonb; now_at timestamptz; absence uuid; old public.task_time_sessions; source_task public.task_instances; planned_source_task public.task_instances; owner_lock uuid; r_period record; ended timestamptz; planned_source_id uuid; planned_source_revision bigint; needs_start boolean; expired_s public.task_time_sessions;
begin
  if auth.uid() is null or p_expected_revision is null or p_expected_revision<0 or p_next is null then raise exception 'Identidad, estado y revisión requeridos'; end if;
  args:=jsonb_build_object('instance',p_instance,'next',p_next,'reason',p_reason,'revision',p_expected_revision);
  cached:=public._get_mutation_receipt('transition_reviewed',args,p_operation_id); if cached is not null then return (cached->>'revision')::bigint; end if;
  if p_next not in ('Pendiente','En curso','Completada') then raise exception 'Estado inválido'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('timer-actor:'||auth.uid()::text,0));
  if not public.can_access_instance(p_instance) or public.actor_role()='auditor' then raise exception 'Sin permiso'; end if;
  select * into t from public.task_instances where id=p_instance;
  if not found then raise exception 'Tarea inexistente'; end if;
  needs_start:=p_next='En curso' and t.status='Pendiente';
  if needs_start then
    select * into old from public.task_time_sessions where actor_id=auth.uid() and ended_at is null;
    if old.id is not null then select * into source_task from public.task_instances where id=old.instance_id; planned_source_id:=old.id; planned_source_revision:=source_task.state_revision; planned_source_task:=source_task; end if;
  end if;
  for owner_lock in select distinct x.owner_id from (values(t.owner_id),(case when needs_start then source_task.owner_id end)) x(owner_id) where x.owner_id is not null order by x.owner_id loop
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('work-owner:'||owner_lock::text,0));
  end loop;
  for r_period in select distinct x.owner_id,x.period from (values(t.owner_id,t.period),(case when needs_start then source_task.owner_id end,case when needs_start then source_task.period end)) x(owner_id,period) where x.owner_id is not null order by x.owner_id,x.period loop
    perform public.lock_open_month(r_period.owner_id,r_period.period);
  end loop;
  perform 1 from public.task_instances where id in(t.id,case when needs_start then source_task.id end) order by id for update;
  perform 1 from public.task_time_sessions where ((instance_id=t.id and ended_at is null) or (needs_start and actor_id=auth.uid() and ended_at is null)) order by id for update;
  select * into t from public.task_instances where id=p_instance;
  if needs_start then
    select * into old from public.task_time_sessions where actor_id=auth.uid() and ended_at is null;
    if old.id is distinct from planned_source_id then raise exception 'El cronómetro de origen cambió'; end if;
    if old.id is not null then select * into source_task from public.task_instances where id=old.instance_id;
      if source_task is distinct from planned_source_task or source_task.state_revision is distinct from planned_source_revision then raise exception 'La tarea de origen cambió'; end if;
    end if;
  end if;
  now_at:=clock_timestamp(); if not public._can_access_instance_at(p_instance,now_at) or public.actor_role()='auditor' then raise exception 'Sin permiso'; end if;
  if t.state_revision is distinct from p_expected_revision then raise exception 'La tarea cambió'; end if;
  if t.status=p_next then perform public._save_mutation_receipt('transition_reviewed',args,p_operation_id,jsonb_build_object('revision',t.state_revision)); return t.state_revision; end if;
  if p_next='En curso' and t.blocked_by is not null then raise exception 'Desbloquee la tarea antes de iniciarla'; end if;
  if t.status='Completada' and p_next<>'Completada' and nullif(trim(coalesce(p_reason,'')),'') is null then raise exception 'La reapertura requiere motivo'; end if;
  if p_next='Completada' and (t.kind='operativa' or t.status='Pendiente' or t.blocked_by is not null or exists(select 1 from jsonb_array_elements(t.checklist) c where coalesce((c->>'done')::boolean,false)=false)) then raise exception 'Transición inválida o controles pendientes'; end if;
  select * into s from public.task_time_sessions where instance_id=t.id and ended_at is null;
  if s.id is not null and s.absence_id is not null and public._session_cutoff(s.id)<=now_at then
    expired_s:=s; ended:=public._effective_session_end(s.id,now_at); update public.task_time_sessions set ended_at=ended where id=s.id;
    insert into public.audit_events(organization_id,actor_id,action,entity_id,at,details) values(t.organization_id,auth.uid(),'task.timer_expired',s.id,now_at,jsonb_build_object('instance',t.id,'executor',s.actor_id,'session',s.id,'started_at',s.started_at,'ended_at',ended,'absence',s.absence_id)); s.id:=null;
  end if;
  if s.id is not null and s.actor_id<>auth.uid() then
    if p_next not in ('Pendiente','Completada') or public.actor_role() not in ('jefe','encargado') or not public.can_access_owner(t.owner_id) or nullif(trim(coalesce(p_reason,'')),'') is null then raise exception 'Sólo un responsable permanente puede interrumpir al ejecutor con motivo'; end if;
    perform public.require_privileged_session();
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
  insert into public.audit_events(organization_id,actor_id,action,entity_id,at,details) values(t.organization_id,auth.uid(),'task.transition',t.id,now_at,jsonb_build_object('from',t.status,'to',p_next,'reason',p_reason,'executor',coalesce(s.actor_id,expired_s.actor_id),'session',coalesce(s.id,expired_s.id),'started_at',coalesce(s.started_at,expired_s.started_at),'ended_at',ended,'absence',coalesce(s.absence_id,expired_s.absence_id)));
  perform public._save_mutation_receipt('transition_reviewed',args,p_operation_id,jsonb_build_object('revision',v)); return v;
end $$;

create or replace function public.cancel_employee_absence(p_absence uuid,p_reason text,p_operation_id uuid) returns void
language plpgsql security definer set search_path='' as $$
declare a public.employee_absences; cached jsonb; args jsonb; cutoff timestamptz; row_session record; inst uuid; canonical_reason text; at_time timestamptz;
begin
  if auth.uid() is null or nullif(trim(coalesce(p_reason,'')),'') is null then raise exception 'Identidad y motivo requeridos'; end if;
  args:=jsonb_build_object('absence',p_absence,'reason',trim(p_reason));
  cached:=public._get_mutation_receipt('cancel_absence',args,p_operation_id); if cached is not null then return; end if;
  perform public.require_privileged_session();
  select * into a from public.employee_absences where id=p_absence and organization_id=public.actor_org();
  if not found or public.actor_role() not in ('jefe','encargado') or not public.can_access_owner(a.owner_id) then raise exception 'Ausencia fuera del ámbito'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('work-owner:'||a.owner_id::text,0));
  select * into a from public.employee_absences where id=p_absence and organization_id=public.actor_org();
  if not found or public.actor_role() not in ('jefe','encargado') or not public.can_access_owner(a.owner_id) then raise exception 'Ausencia fuera del ámbito'; end if;
  perform public.require_privileged_session();
  if public.actor_role()='encargado' and a.replacement_id is not null and
     (not public.can_access_owner(a.replacement_id) or exists(select 1 from public.employee_absence_companies c
       where c.absence_id=a.id and not exists(select 1 from public.company_memberships m where m.profile_id=auth.uid() and m.organization_id=a.organization_id and m.company_id=c.company_id))) then
    raise exception 'El reemplazante o una empresa está fuera del ámbito permanente';
  end if;
  if a.cancelled_at is not null then
    select * into a from public.employee_absences where id=a.id and organization_id=public.actor_org() for update;
    if not found or public.actor_role() not in ('jefe','encargado') or not public.can_access_owner(a.owner_id) then raise exception 'Ausencia fuera del ámbito'; end if;
    perform public.require_privileged_session();
    if public.actor_role()='encargado' and a.replacement_id is not null and
       (not public.can_access_owner(a.replacement_id) or exists(select 1 from public.employee_absence_companies c
         where c.absence_id=a.id and not exists(select 1 from public.company_memberships m where m.profile_id=auth.uid() and m.organization_id=a.organization_id and m.company_id=c.company_id))) then
      raise exception 'El reemplazante o una empresa está fuera del ámbito permanente';
    end if;
    if a.cancelled_at is null then raise exception 'La ausencia cambió durante la cancelación'; end if;
    perform public._save_mutation_receipt('cancel_absence',args,p_operation_id,jsonb_build_object('cancelled_at',a.cancelled_at));
    return;
  end if;
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
    at_time:=clock_timestamp(); cutoff:=at_time;
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
    insert into public.audit_events(organization_id,actor_id,action,entity_id,at,details)
    values(row_session.organization_id,auth.uid(),'absence.session_stopped',row_session.instance_id,at_time,
      jsonb_build_object('absence',a.id,'session',row_session.id,'executor',row_session.actor_id,'started_at',row_session.started_at,'ended_at',public._effective_session_end(row_session.id,cutoff),'reason',coalesce(canonical_reason,trim(p_reason))));
  end loop;
  if a.cancelled_at is null then
    insert into public.audit_events(organization_id,actor_id,action,entity_id,at,details)
    values(a.organization_id,auth.uid(),'absence.cancelled',a.id,at_time,jsonb_build_object('reason',trim(p_reason),'cancelled_at',cutoff));
  end if;
  perform public._save_mutation_receipt('cancel_absence',args,p_operation_id,jsonb_build_object('cancelled_at',cutoff));
end $$;

drop trigger if exists employee_absence_identity_immutable on public.employee_absences;
create trigger employee_absence_identity_immutable before update or delete on public.employee_absences
for each row execute function public.guard_absence_immutability();
drop trigger if exists employee_absence_company_immutable on public.employee_absence_companies;
create trigger employee_absence_company_immutable before insert or update or delete on public.employee_absence_companies
for each row execute function public.guard_absence_company_immutability();
revoke execute on function public.guard_absence_immutability(),public.guard_absence_company_immutability() from public,anon,authenticated;
commit;
