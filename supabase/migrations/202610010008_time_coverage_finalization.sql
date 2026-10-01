-- Finalización 008: la cobertura temporal requiere autorización sellada.
-- No toca filas históricas; añade guard de lectura y conserva ACL públicas.
begin;

create or replace function public.can_cover_instance(p_instance uuid) returns boolean
language sql stable security definer set search_path='' as $$
  select exists(
    select 1
    from public.task_instances t
    join public.profiles a on a.id=auth.uid() and a.active and a.organization_id=t.organization_id
    join public.employee_absences x on x.owner_id=t.owner_id and x.organization_id=t.organization_id
      and x.replacement_id=a.id and x.cancelled_at is null and x.authorization_sealed
    join public.employee_absence_companies c on c.absence_id=x.id and c.organization_id=x.organization_id and c.company_id=t.company_id
    join public.profiles o on o.id=t.owner_id and o.active and o.organization_id=t.organization_id
    join public.company_memberships am on am.profile_id=a.id and am.company_id=t.company_id and am.organization_id=t.organization_id
    join public.company_memberships om on om.profile_id=o.id and om.company_id=t.company_id and om.organization_id=t.organization_id
    where t.id=p_instance and a.role in ('empleado','encargado')
      and (now() at time zone 'America/Argentina/Buenos_Aires')::date between x.starts_on and x.ends_on
      and t.period between date_trunc('month',x.starts_on)::date and date_trunc('month',x.ends_on)::date
  )
$$;

create or replace function public._can_access_instance_at(p_instance uuid,p_at timestamptz) returns boolean
language sql stable security definer set search_path='' as $$
  select exists(
    select 1 from public.task_instances t
    where t.id=p_instance and (
      (public.can_access_owner(t.owner_id) and (public.actor_role()='jefe' or exists(
        select 1 from public.company_memberships m where m.profile_id=auth.uid()
          and m.company_id=t.company_id and m.organization_id=t.organization_id)))
      or exists(
        select 1 from public.profiles a
        join public.profiles o on o.id=t.owner_id and o.organization_id=t.organization_id and o.active
        join public.employee_absences x on x.owner_id=o.id and x.organization_id=t.organization_id
          and x.replacement_id=a.id and x.cancelled_at is null and x.authorization_sealed
        join public.employee_absence_companies c on c.absence_id=x.id
          and c.organization_id=x.organization_id and c.company_id=t.company_id
        join public.company_memberships am on am.profile_id=a.id
          and am.company_id=t.company_id and am.organization_id=t.organization_id
        join public.company_memberships om on om.profile_id=o.id
          and om.company_id=t.company_id and om.organization_id=t.organization_id
        where a.id=auth.uid() and a.organization_id=t.organization_id and a.active
          and a.role in ('empleado','encargado')
          and (p_at at time zone 'America/Argentina/Buenos_Aires')::date between x.starts_on and x.ends_on
          and t.period between date_trunc('month',x.starts_on)::date and date_trunc('month',x.ends_on)::date
      )
    )
  )
$$;

create or replace function public.set_checklist_item_reviewed(p_instance uuid,p_check text,p_done boolean,p_reason text,p_expected_revision bigint,p_operation_id uuid) returns bigint
language plpgsql security definer set search_path='' as $$
declare t public.task_instances; updated jsonb; next_status text; v bigint; cached jsonb; s public.task_time_sessions; args jsonb; now_at timestamptz; absence uuid; ended timestamptz; old public.task_time_sessions; source_task public.task_instances; planned_source_task public.task_instances; owner_lock uuid; r_period record; planned_source_id uuid; planned_source_revision bigint; needs_start boolean; expired_s public.task_time_sessions; dest_ended timestamptz; planned_t public.task_instances; changes_check boolean; actual_needs_start boolean;
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
  planned_t:=t;
  changes_check:=exists(select 1 from jsonb_array_elements(t.checklist) x where x->>'id'=p_check and coalesce((x->>'done')::boolean,false) is distinct from p_done);
  select jsonb_agg(case when x->>'id'=p_check then jsonb_set(x,'{done}',to_jsonb(p_done)) else x end order by pos)
    into updated from jsonb_array_elements(t.checklist) with ordinality items(x,pos);
  next_status:=case when t.status='Completada' then 'En curso' when p_done and t.status='Pendiente' and t.blocked_by is null then 'En curso' else t.status end;
  if t.kind='resultado' and next_status<>'Pendiente' and t.blocked_by is null
    and not exists(select 1 from jsonb_array_elements(updated) x where coalesce((x->>'done')::boolean,false)=false) then next_status:='Completada'; end if;
  needs_start:=changes_check and t.status='Pendiente' and next_status='En curso';
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
  if not found or (t.id,t.organization_id,t.assignment_id,t.company_id,t.owner_id,t.period) is distinct from (planned_t.id,planned_t.organization_id,planned_t.assignment_id,planned_t.company_id,planned_t.owner_id,planned_t.period) then raise exception 'La identidad de la tarea cambió'; end if;
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
  changes_check:=exists(select 1 from jsonb_array_elements(t.checklist) x where x->>'id'=p_check and coalesce((x->>'done')::boolean,false) is distinct from p_done);
  select jsonb_agg(case when x->>'id'=p_check then jsonb_set(x,'{done}',to_jsonb(p_done)) else x end order by pos)
    into updated from jsonb_array_elements(t.checklist) with ordinality items(x,pos);
  next_status:=case when t.status='Completada' then 'En curso' when p_done and t.status='Pendiente' and t.blocked_by is null then 'En curso' else t.status end;
  if t.kind='resultado' and next_status<>'Pendiente' and t.blocked_by is null
    and not exists(select 1 from jsonb_array_elements(updated) x where coalesce((x->>'done')::boolean,false)=false) then next_status:='Completada'; end if;
  actual_needs_start:=changes_check and t.status='Pendiente' and next_status='En curso';
  if actual_needs_start is distinct from needs_start then raise exception 'El plan de inicio cambió; vuelva a intentar'; end if;
  if exists(select 1 from jsonb_array_elements(t.checklist) x where x->>'id'=p_check and coalesce((x->>'done')::boolean,false)=p_done) then
    perform public._save_mutation_receipt('checklist_reviewed',args,p_operation_id,jsonb_build_object('revision',t.state_revision));
    return t.state_revision;
  end if;
  if t.status='Completada' and nullif(trim(coalesce(p_reason,'')),'') is null then raise exception 'La reapertura requiere motivo'; end if;
  if s.id is not null and s.absence_id is not null and public._session_cutoff(s.id)<=now_at then
    expired_s:=s; ended:=public._effective_session_end(s.id,now_at); dest_ended:=ended; update public.task_time_sessions set ended_at=ended where id=s.id;
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
    ended:=public._effective_session_end(s.id,now_at); dest_ended:=ended;
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
    values(t.organization_id,auth.uid(),'task.checklist',t.id,now_at,jsonb_build_object('step',p_check,'done',p_done,'reason',p_reason,'executor',coalesce(s.actor_id,expired_s.actor_id),'session',coalesce(s.id,expired_s.id),'started_at',coalesce(s.started_at,expired_s.started_at),'ended_at',dest_ended,'absence',coalesce(s.absence_id,expired_s.absence_id)));
  perform public._save_mutation_receipt('checklist_reviewed',args,p_operation_id,jsonb_build_object('revision',v));
  return v;
end$$;
create or replace function public.start_task_timer(p_instance uuid,p_expected_revision bigint,p_operation_id uuid,p_switch boolean default false) returns uuid
language plpgsql security definer set search_path='' as $$
declare t public.task_instances; planned_t public.task_instances; s public.task_time_sessions; old public.task_time_sessions; result jsonb; absence uuid; now_at timestamptz; source_task public.task_instances; planned_source_task public.task_instances; owner_lock uuid; args jsonb; planned_source_id uuid; planned_source_revision bigint;
begin
  if auth.uid() is null or p_expected_revision is null or p_expected_revision<0 or p_switch is null then raise exception 'Identidad, revisión y decisión de cambio requeridas'; end if;
  args:=jsonb_build_object('instance',p_instance,'revision',p_expected_revision,'switch',p_switch);
  result:=public._get_mutation_receipt('start_timer',args,p_operation_id); if result is not null then return (result->>'session_id')::uuid; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('timer-actor:'||auth.uid()::text,0));
  if not public.can_access_instance(p_instance) or public.actor_role()='auditor' then raise exception 'Sin permiso'; end if;
  select * into t from public.task_instances where id=p_instance;
  if not found then raise exception 'Tarea inexistente'; end if;
  planned_t:=t;
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
  if not found or (t.id,t.organization_id,t.assignment_id,t.company_id,t.owner_id,t.period) is distinct from (planned_t.id,planned_t.organization_id,planned_t.assignment_id,planned_t.company_id,planned_t.owner_id,planned_t.period) then raise exception 'La identidad de la tarea cambió'; end if;
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

create or replace function public.set_task_wait(p_instance uuid,p_note text,p_expected_revision bigint,p_operation_id uuid) returns bigint
language plpgsql security definer set search_path='' as $$
declare t public.task_instances; planned_t public.task_instances; s public.task_time_sessions; cached jsonb; args jsonb; v bigint; now_at timestamptz; ended timestamptz; expired_s public.task_time_sessions;
begin
  if auth.uid() is null or p_expected_revision is null or p_expected_revision<0 then raise exception 'Identidad y revisión requeridas'; end if;
  if p_note is not null and nullif(trim(p_note),'') is null then raise exception 'La espera requiere una descripción o NULL para desbloquear'; end if;
  args:=jsonb_build_object('instance',p_instance,'note',p_note,'revision',p_expected_revision);
  cached:=public._get_mutation_receipt('task_wait',args,p_operation_id);
  if cached is not null then return (cached->>'revision')::bigint; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('timer-actor:'||auth.uid()::text,0));
  if not public.can_access_instance(p_instance) or public.actor_role()='auditor' then raise exception 'Sin permiso'; end if;
  select * into t from public.task_instances where id=p_instance;
  if not found then raise exception 'Tarea inexistente'; end if;
  planned_t:=t;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('work-owner:'||t.owner_id::text,0));
  perform public.lock_open_month(t.owner_id,t.period);
  perform 1 from public.task_instances where id=t.id for update;
  select * into t from public.task_instances where id=p_instance;
  if not found or (t.id,t.organization_id,t.assignment_id,t.company_id,t.owner_id,t.period) is distinct from (planned_t.id,planned_t.organization_id,planned_t.assignment_id,planned_t.company_id,planned_t.owner_id,planned_t.period) then raise exception 'La identidad de la tarea cambió'; end if;
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
    expired_s:=s;
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
    values(t.organization_id,auth.uid(),'task.wait',t.id,now_at,jsonb_build_object('executor',coalesce(s.actor_id,expired_s.actor_id),'session',coalesce(s.id,expired_s.id),'reason',trim(p_note),'started_at',coalesce(s.started_at,expired_s.started_at),'ended_at',ended,'absence',coalesce(s.absence_id,expired_s.absence_id)));
  end if;
  perform public._save_mutation_receipt('task_wait',args,p_operation_id,jsonb_build_object('revision',v));
  return v;
end$$;
create or replace function public.transition_task_reviewed(p_instance uuid,p_next text,p_reason text,p_expected_revision bigint,p_operation_id uuid) returns bigint
language plpgsql security definer set search_path='' as $$
declare t public.task_instances; planned_t public.task_instances; cached jsonb; v bigint; s public.task_time_sessions; args jsonb; now_at timestamptz; absence uuid; old public.task_time_sessions; source_task public.task_instances; planned_source_task public.task_instances; owner_lock uuid; r_period record; ended timestamptz; planned_source_id uuid; planned_source_revision bigint; needs_start boolean; expired_s public.task_time_sessions; dest_ended timestamptz;
begin
  if auth.uid() is null or p_expected_revision is null or p_expected_revision<0 or p_next is null then raise exception 'Identidad, estado y revisión requeridos'; end if;
  args:=jsonb_build_object('instance',p_instance,'next',p_next,'reason',p_reason,'revision',p_expected_revision);
  cached:=public._get_mutation_receipt('transition_reviewed',args,p_operation_id); if cached is not null then return (cached->>'revision')::bigint; end if;
  if p_next not in ('Pendiente','En curso','Completada') then raise exception 'Estado inválido'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('timer-actor:'||auth.uid()::text,0));
  if not public.can_access_instance(p_instance) or public.actor_role()='auditor' then raise exception 'Sin permiso'; end if;
  select * into t from public.task_instances where id=p_instance;
  if not found then raise exception 'Tarea inexistente'; end if;
  planned_t:=t;
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
  if not found or (t.id,t.organization_id,t.assignment_id,t.company_id,t.owner_id,t.period) is distinct from (planned_t.id,planned_t.organization_id,planned_t.assignment_id,planned_t.company_id,planned_t.owner_id,planned_t.period) then raise exception 'La identidad de la tarea cambió'; end if;
  if needs_start then
    select * into old from public.task_time_sessions where actor_id=auth.uid() and ended_at is null;
    if old.id is distinct from planned_source_id then raise exception 'El cronómetro de origen cambió'; end if;
    if old.id is not null then select * into source_task from public.task_instances where id=old.instance_id;
      if source_task is distinct from planned_source_task or source_task.state_revision is distinct from planned_source_revision then raise exception 'La tarea de origen cambió'; end if;
    end if;
  end if;
  now_at:=clock_timestamp(); if not public._can_access_instance_at(p_instance,now_at) or public.actor_role()='auditor' then raise exception 'Sin permiso'; end if;
  if t.state_revision is distinct from p_expected_revision then raise exception 'La tarea cambió'; end if;
  if (p_next='En curso' and t.status='Pendiente') is distinct from needs_start then raise exception 'El plan de inicio cambió; vuelva a intentar'; end if;
  if t.status=p_next then perform public._save_mutation_receipt('transition_reviewed',args,p_operation_id,jsonb_build_object('revision',t.state_revision)); return t.state_revision; end if;
  if p_next='En curso' and t.blocked_by is not null then raise exception 'Desbloquee la tarea antes de iniciarla'; end if;
  if t.status='Completada' and p_next<>'Completada' and nullif(trim(coalesce(p_reason,'')),'') is null then raise exception 'La reapertura requiere motivo'; end if;
  if p_next='Completada' and (t.kind='operativa' or t.status='Pendiente' or t.blocked_by is not null or exists(select 1 from jsonb_array_elements(t.checklist) c where coalesce((c->>'done')::boolean,false)=false)) then raise exception 'Transición inválida o controles pendientes'; end if;
  select * into s from public.task_time_sessions where instance_id=t.id and ended_at is null;
  if s.id is not null and s.absence_id is not null and public._session_cutoff(s.id)<=now_at then
    expired_s:=s; ended:=public._effective_session_end(s.id,now_at); dest_ended:=ended; update public.task_time_sessions set ended_at=ended where id=s.id;
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
  if p_next in ('Pendiente','Completada') and s.id is not null then ended:=public._effective_session_end(s.id,now_at); dest_ended:=ended; update public.task_time_sessions set ended_at=ended where id=s.id; end if;
  if t.status='Completada' and p_next<>'Completada' then insert into public.task_reopen_events(organization_id,instance_id,actor_id,at,reason,source) values(t.organization_id,t.id,auth.uid(),now_at,trim(p_reason),'explicit'); end if;
  update public.task_instances set status=p_next,started_at=case when p_next='En curso' then coalesce(started_at,now_at) else started_at end,completed_at=case when p_next='Completada' then now_at else null end,state_revision=state_revision+1 where id=t.id returning state_revision into v;
  insert into public.audit_events(organization_id,actor_id,action,entity_id,at,details) values(t.organization_id,auth.uid(),'task.transition',t.id,now_at,jsonb_build_object('from',t.status,'to',p_next,'reason',p_reason,'executor',coalesce(s.actor_id,expired_s.actor_id),'session',coalesce(s.id,expired_s.id),'started_at',coalesce(s.started_at,expired_s.started_at),'ended_at',dest_ended,'absence',coalesce(s.absence_id,expired_s.absence_id)));
  perform public._save_mutation_receipt('transition_reviewed',args,p_operation_id,jsonb_build_object('revision',v)); return v;
end $$;
create or replace function public.pause_task_timer(p_session uuid,p_operation_id uuid) returns timestamptz
language plpgsql security definer set search_path='' as $$
declare s public.task_time_sessions; planned_s public.task_time_sessions; t public.task_instances; planned_t public.task_instances; r public.task_mutation_receipts; ended timestamptz; org uuid; args jsonb; now_at timestamptz;
begin
  if auth.uid() is null or p_operation_id is null then raise exception 'Identidad y operación requeridas'; end if;
  args:=jsonb_build_object('session',p_session);
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(auth.uid()::text||p_operation_id::text,0));
  select * into r from public.task_mutation_receipts where actor_id=auth.uid() and operation_id=p_operation_id;
  if found then if r.operation_kind<>'pause_timer' or r.arguments<>args then raise exception 'Identificador de operación reutilizado con otros argumentos'; end if; return (r.result->>'ended_at')::timestamptz; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('timer-actor:'||auth.uid()::text,0));
  select * into s from public.task_time_sessions where id=p_session and actor_id=auth.uid(); if not found then raise exception 'Sesión propia no encontrada'; end if;
  planned_s:=s;
  select * into t from public.task_instances where id=s.instance_id; if not found then raise exception 'Sesión inválida'; end if;
  planned_t:=t;
  select organization_id into org from public.profiles where id=auth.uid() and organization_id=t.organization_id; if org is null then raise exception 'Sin permiso'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('work-owner:'||t.owner_id::text,0));
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(t.owner_id::text||t.period::text,0));
  perform 1 from public.task_instances where id=t.id for update;
  select * into t from public.task_instances where id=planned_t.id;
  if not found or (t.id,t.organization_id,t.assignment_id,t.company_id,t.owner_id,t.period) is distinct from (planned_t.id,planned_t.organization_id,planned_t.assignment_id,planned_t.company_id,planned_t.owner_id,planned_t.period) then raise exception 'La identidad de la tarea cambió'; end if;
  select * into s from public.task_time_sessions where id=p_session and actor_id=auth.uid() for update;
  if not found or (s.id,s.instance_id,s.actor_id,s.started_at,s.absence_id) is distinct from (planned_s.id,planned_s.instance_id,planned_s.actor_id,planned_s.started_at,planned_s.absence_id) then raise exception 'La identidad de la sesión cambió'; end if;
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

-- El helper temporal es interno. can_cover_instance mantiene su ACL pública
-- autenticada configurada en 004; no conceder ejecución del helper privado.
revoke all on function public._can_access_instance_at(uuid,timestamptz) from public,anon,authenticated;
revoke all on function public.can_cover_instance(uuid) from public,anon;
grant execute on function public.can_cover_instance(uuid) to authenticated;

commit;
