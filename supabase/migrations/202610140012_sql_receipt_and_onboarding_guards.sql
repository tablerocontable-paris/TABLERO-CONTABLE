-- S59/S60: harden the isolated historical SQL contract after migration 011.
-- This migration is intentionally local-only during the product laboratory.
begin;

-- Keep the 011 signature for existing clients. New reviewed calls carry the
-- interruption reason in both the task-control guard and the idempotency body.
create function public.set_task_wait_reviewed(
  p_instance uuid,
  p_note text,
  p_reason text,
  p_expected_revision bigint,
  p_operation_id uuid
) returns bigint
language plpgsql security definer set search_path='' as $$
declare
  actor uuid:=auth.uid();
  args jsonb;
  receipt public.task_mutation_receipts%rowtype;
  result bigint;
begin
  if actor is null or p_operation_id is null then raise exception 'Identidad y operación requeridas'; end if;
  args:=jsonb_build_object('instance',p_instance,'note',p_note,'reason',p_reason,'revision',p_expected_revision);
  perform public._coordination_receipt_lock(actor,p_operation_id);
  select * into receipt from public.task_mutation_receipts where actor_id=actor and operation_id=p_operation_id;
  if found then
    if receipt.operation_kind<>'task_wait_reviewed' or receipt.arguments<>args then raise exception 'Identificador de operación reutilizado con otros argumentos'; end if;
    return (receipt.result->>'revision')::bigint;
  end if;
  result:=public._coordination_apply_task_control(p_instance,'wait',null,null,null,p_note,p_reason,p_expected_revision);
  insert into public.task_mutation_receipts(organization_id,actor_id,operation_id,operation_kind,arguments,result)
  values(public.actor_org(),actor,p_operation_id,'task_wait_reviewed',args,jsonb_build_object('revision',result));
  return result;
end
$$;
revoke all on function public.set_task_wait_reviewed(uuid,text,text,bigint,uuid) from public,anon;
grant execute on function public.set_task_wait_reviewed(uuid,text,text,bigint,uuid) to authenticated;

-- Correct the coordinated DTO for both legacy absence coverage and precise
-- bindings. A participant keeps their frozen share; a replacement-only viewer
-- receives a coverage label with zero responsibility points.
create or replace function public._coordinated_task_payload(p_instance uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare t public.task_instances%rowtype; payload jsonb; responsibility jsonb; coverage jsonb; due_state text;
 work_day date:=(clock_timestamp() at time zone 'America/Argentina/Buenos_Aires')::date;
begin
 select * into t from public.task_instances where id=p_instance;
 if not found then raise exception 'Ocurrencia inexistente'; end if;
 responsibility:=public._legacy_task_responsibility(t.id);
 select jsonb_build_object('kind','coverage','bindingId',b.id,'startsOn',b.starts_on,'endsOn',b.ends_on)
  into coverage from public.task_coverage_bindings b
  where b.instance_id=t.id and b.replacement_id=auth.uid() and b.status='active'
   and work_day between b.starts_on and b.ends_on order by b.approved_at desc,b.id limit 1;
 if coverage is null then
   select jsonb_build_object('kind','coverage','bindingId',null,'startsOn',a.starts_on,'endsOn',a.ends_on)
    into coverage from public.employee_absences a join public.employee_absence_companies c
      on c.absence_id=a.id and c.company_id=t.company_id and c.organization_id=t.organization_id
    where a.owner_id=t.owner_id and a.replacement_id=auth.uid() and a.cancelled_at is null and a.authorization_sealed and public._legacy_coverage_scope_allowed(t.owner_id,auth.uid(),clock_timestamp())
      and work_day between a.starts_on and a.ends_on order by a.approved_at desc,a.id limit 1;
 end if;
 select case when t.due_date is null then 'no_deadline'
   when t.status<>'Completada' and work_day>t.due_date then 'overdue'
   when t.status<>'Completada' then 'pending'
   when (t.completed_at at time zone 'America/Argentina/Buenos_Aires')::date<t.due_date then 'completed_early'
   when (t.completed_at at time zone 'America/Argentina/Buenos_Aires')::date=t.due_date then 'completed_on_time'
   else 'completed_late' end into due_state;
 select jsonb_build_object('schemaVersion',3,'taskId',t.id,'companyId',t.company_id,'period',t.period,
   'scheduledOn',t.scheduled_on,'title',t.title,'kind',t.kind,'weight',t.weight,'unit',t.unit,'target',t.target,
   'status',t.status,'dueDate',t.due_date,'startedAt',t.started_at,'completedAt',t.completed_at,
   'checklist',t.checklist,'isBlocked',t.blocked_by is not null,'stateRevision',t.state_revision,
   'responsibility',responsibility,
   'members',(select coalesce(jsonb_agg(jsonb_build_object('profileId',m.profile_id,'displayName',p.name,'shareBps',m.share_bps) order by m.profile_id),'[]'::jsonb)
      from public.task_responsibility_members m join public.task_responsibility_heads h on h.set_id=m.set_id and h.instance_id=t.id
      join public.profiles p on p.id=m.profile_id where m.organization_id=t.organization_id),
   'myContribution',jsonb_build_object(
      'kind',case
        when exists(select 1 from public.task_responsibility_heads h
          join public.task_responsibility_members m on m.set_id=h.set_id
          where h.instance_id=t.id and m.profile_id=auth.uid()) then 'responsible'
        when coverage is not null then 'coverage'
        else 'responsible' end,
      'shareBps',coalesce((select m.share_bps from public.task_responsibility_heads h
        join public.task_responsibility_members m on m.set_id=h.set_id
        where h.instance_id=t.id and m.profile_id=auth.uid()),0)),
   'coverage',coverage,'dueState',due_state) into payload;
 return payload;
end $$;

create or replace function public.approve_onboarding(
  p_request uuid,
  p_expected_revision integer,
  p_weight_overrides jsonb default '{}'::jsonb
) returns integer
language plpgsql security definer set search_path='' as $$
declare
  plan jsonb;
  months jsonb;
  catalog text[];
  r public.onboarding_requests;
  v public.onboarding_request_versions;
  line jsonb;
  line_id uuid;
  comp uuid;
  team uuid;
  start_on date;
  finish_on date;
  freq text;
  interval_n integer;
  wd smallint[];
  md smallint;
  deadline boolean;
  offset_n integer;
  tpl public.task_template_versions;
  new_assignment uuid;
  line_count integer:=0;
  task_title text;
  task_kind text;
  task_weight numeric;
  task_unit text;
  target_n integer;
  checklist jsonb;
  org uuid;
  current_period date:=date_trunc('month',now() at time zone 'America/Argentina/Buenos_Aires')::date;
begin
  perform public.require_privileged_session();
  if public.actor_role()<>'jefe' then raise exception 'Sólo jefatura puede aprobar la inducción'; end if;
  if p_expected_revision is null or p_expected_revision<1 then raise exception 'Solicitud o revisión desactualizada'; end if;
  if jsonb_typeof(coalesce(p_weight_overrides,'{}'::jsonb))<>'object' then raise exception 'Pesos particulares inválidos'; end if;

  select * into r from public.onboarding_requests where id=p_request and organization_id=public.actor_org();
  if not found or r.current_revision is distinct from p_expected_revision then raise exception 'Solicitud o revisión desactualizada'; end if;
  if r.status='approved' then
    return (select count(*)::integer from public.onboarding_activations where request_id=r.id and revision=r.current_revision);
  end if;
  if r.status<>'submitted' then raise exception 'Solicitud o revisión desactualizada'; end if;
  if not exists(select 1 from public.profiles where id=r.owner_id and organization_id=r.organization_id and active and role='empleado') then raise exception 'El empleado ya no está activo'; end if;
  select * into v from public.onboarding_request_versions where request_id=r.id and revision=r.current_revision and organization_id=r.organization_id;
  if not found then raise exception 'No existe el contenido enviado'; end if;
  org:=r.organization_id;

  select coalesce(jsonb_agg(jsonb_build_object('ownerId',r.owner_id,'period',d)),'[]') into months from (
    select distinct g::date d
    from jsonb_array_elements(v.payload->'lines') l
    cross join lateral generate_series(
      date_trunc('month',(l->>'start_date')::date)::date,
      greatest(current_period,date_trunc('month',(l->>'start_date')::date)::date),
      interval '1 month'
    ) g
  ) q;
  select coalesce(array_agg(distinct 'template:'||tv.template_id::text),'{}') into catalog
  from jsonb_array_elements(v.payload->'lines') l
  join public.task_template_versions tv on tv.id=nullif(l->>'template_version_id','')::uuid;

  perform public._coordination_receipt_lock(auth.uid(),gen_random_uuid());
  plan:=public._coordination_prepare(
    '{}',array[auth.uid()],array[r.owner_id],months,catalog,
    jsonb_build_object('kind','materialize','owner',r.owner_id,'period',current_period,'request',r.id)
  );
  perform public._coordination_acquire(plan);

  -- The acquire step locks and revalidates the request snapshot. Re-read under
  -- that lock and repeat the authorization/revision checks before any writes.
  perform public.require_privileged_session();
  if public.actor_role()<>'jefe' or public.actor_org() is distinct from org then raise exception 'Sin permiso'; end if;
  select * into r from public.onboarding_requests where id=p_request and organization_id=org for update;
  if not found or r.current_revision is distinct from p_expected_revision or r.status<>'submitted' then
    raise exception 'Solicitud o revisión desactualizada';
  end if;
  select * into v from public.onboarding_request_versions
  where request_id=r.id and revision=p_expected_revision and organization_id=org for share;
  if not found then raise exception 'No existe el contenido enviado'; end if;
  if not exists(select 1 from public.profiles where id=r.owner_id and organization_id=org and active and role='empleado') then raise exception 'El empleado ya no está activo'; end if;
  perform public.validate_onboarding_payload(v.payload,false);

  for line in select value from jsonb_array_elements(v.payload->'lines') loop
    line_id:=(line->>'line_id')::uuid;
    comp:=(line->>'company_id')::uuid;
    team:=(line->>'team_id')::uuid;
    start_on:=(line->>'start_date')::date;
    finish_on:=nullif(line->>'end_date','')::date;
    freq:=line->>'frequency';
    interval_n:=(line->>'interval_count')::integer;
    deadline:=(line->>'has_deadline')::boolean;
    offset_n:=coalesce((line->>'due_offset_days')::integer,0);
    if start_on is null or (finish_on is not null and finish_on<start_on) or offset_n not between 0 and 31 then raise exception 'Calendario inválido en línea %',line_id; end if;
    if freq='unica' and (finish_on is not null and finish_on<>start_on) then raise exception 'La tarea puntual no puede repetirse'; end if;
    if not exists(select 1 from public.company_memberships where organization_id=org and company_id=comp and profile_id=r.owner_id)
       or not exists(select 1 from public.team_members where organization_id=org and team_id=team and profile_id=r.owner_id)
       or not exists(select 1 from public.teams where id=team and organization_id=org) then
      raise exception 'Empresa o equipo ya no asignado en línea %',line_id;
    end if;
    if exists(select 1 from public.monthly_closures c where c.owner_id=r.owner_id and c.period>=date_trunc('month',start_on)::date and c.period<=current_period) then
      raise exception 'La fecha de inicio cruza un período cerrado';
    end if;
    tpl:=null;
    if coalesce(line->>'template_version_id','')<>'' then
      select tv.* into tpl
      from public.task_template_versions tv
      join public.task_templates t on t.id=tv.template_id and t.organization_id=tv.organization_id
      where tv.id=(line->>'template_version_id')::uuid and tv.organization_id=org and t.active and tv.version=t.version;
      if not found then raise exception 'El estándar cambió; debe actualizar y reenviar la inducción'; end if;
      task_title:=tpl.title; task_kind:=tpl.kind; task_weight:=tpl.weight; task_unit:=tpl.unit; target_n:=tpl.monthly_target; checklist:=tpl.checklist;
    else
      task_title:=nullif(trim(line->>'custom_title'),'');
      task_kind:=line->>'kind';
      task_unit:=nullif(trim(line->>'unit'),'');
      target_n:=nullif(line->>'target','')::integer;
      checklist:=coalesce(line->'checklist','[]'::jsonb);
      task_weight:=nullif(p_weight_overrides->>line_id::text,'')::numeric;
      if task_title is null or task_kind not in ('resultado','operativa') or task_weight is null or task_weight<=0 or task_weight>100 or jsonb_typeof(checklist)<>'array' then
        raise exception 'La tarea particular requiere título, tipo, controles y peso aprobado';
      end if;
      if task_kind='operativa' and (target_n is null or target_n<=0 or task_unit is null) then raise exception 'Tarea operativa requiere meta y unidad'; end if;
    end if;
    if tpl.id is not null and exists(
      select 1 from public.task_assignments a
      where a.owner_id=r.owner_id and a.company_id=comp and a.template_version_id=tpl.id
        and a.frequency=freq and a.start_date=start_on and a.end_date is not distinct from finish_on
    ) then raise exception 'La tarea estándar ya está asignada a esa empresa'; end if;
    if freq='semanal' then
      select array_agg(distinct (x#>>'{}')::smallint order by (x#>>'{}')::smallint) into wd
      from jsonb_array_elements(line->'weekdays') x;
      if cardinality(wd)=0 or not wd<@array[0,1,2,3,4,5,6]::smallint[] then raise exception 'Días semanales inválidos'; end if;
    else
      wd:=array[1]::smallint[];
    end if;
    if freq='mensual' then
      md:=coalesce((line->>'month_day')::smallint,extract(day from start_on)::smallint);
      if md not between 1 and 31 then raise exception 'Día mensual inválido'; end if;
    else
      md:=extract(day from start_on)::smallint;
    end if;
    insert into public.task_assignments(
      organization_id,template_id,template_version_id,company_id,owner_id,team_id,title,kind,weight,unit,target,
      frequency,start_month,due_day,checklist,start_date,end_date,interval_count,weekdays,month_day,has_deadline,due_offset_days
    ) values(
      org,tpl.template_id,tpl.id,comp,r.owner_id,team,task_title,task_kind,task_weight,task_unit,target_n,
      freq,date_trunc('month',start_on)::date,extract(day from start_on)::integer,checklist,start_on,finish_on,
      interval_n,wd,md,deadline,offset_n
    ) returning id into new_assignment;
    insert into public.onboarding_activations(organization_id,request_id,revision,line_id,assignment_id)
    values(org,r.id,p_expected_revision,line_id,new_assignment);
    line_count:=line_count+1;
  end loop;
  if exists(select 1 from public.task_assignments a where a.owner_id=r.owner_id and a.start_date<(current_period+interval '1 month')::date and (a.end_date is null or a.end_date>=current_period)) then
    perform public._coordination_assert_month(r.owner_id,current_period);
    perform public._coordination_materialize_core(r.owner_id,current_period);
  end if;
  update public.onboarding_requests set status='approved',approved_at=now(),approved_by=auth.uid(),updated_at=now() where id=r.id;
  insert into public.onboarding_reviews(organization_id,request_id,revision,actor_id,action,note)
  values(org,r.id,p_expected_revision,auth.uid(),'approved','');
  insert into public.audit_events(organization_id,actor_id,action,entity_id,details)
  values(org,auth.uid(),'onboarding.approved',r.id,jsonb_build_object('revision',p_expected_revision,'assignments',line_count));
  return line_count;
end
$$;

create or replace function public.request_onboarding_changes(
  p_request uuid,
  p_expected_revision integer,
  p_note text
) returns void
language plpgsql security definer set search_path='' as $$
declare
  r public.onboarding_requests;
  plan jsonb;
  org uuid:=public.actor_org();
begin
  perform public.require_privileged_session();
  if org is null or p_expected_revision is null or p_expected_revision<1
     or public.actor_role() not in ('jefe','encargado') or nullif(trim(p_note),'') is null then
    raise exception 'La solicitud requiere responsable, revisión y motivo';
  end if;
  -- Resolve the request and current authority before acquiring the shared
  -- actor/profile/request locks; acquire revalidates that snapshot afterward.
  select * into r from public.onboarding_requests
  where id=p_request and organization_id=org;
  if not found then raise exception 'Solicitud o revisión desactualizada'; end if;
  plan:=public._coordination_prepare(
    '{}',array[auth.uid()],array[r.owner_id],'[]','{}',
    jsonb_build_object('kind','onboarding_review','request',r.id)
  );
  perform public._coordination_acquire(plan);

  -- Re-check the privileged session, current request revision/status, and
  -- team authority after coordination locks and immediately before writes.
  perform public.require_privileged_session();
  if public.actor_org() is distinct from org or public.actor_role() not in ('jefe','encargado') then raise exception 'Fuera del ámbito actual'; end if;
  select * into r from public.onboarding_requests
  where id=p_request and organization_id=org for update;
  if not found or r.status<>'submitted' or r.current_revision is distinct from p_expected_revision then
    raise exception 'Solicitud o revisión desactualizada';
  end if;
  -- Revalidate the session and current organization/team authority while the
  -- request row is locked, immediately before changing status or writing logs.
  perform public.require_privileged_session();
  if public.actor_org() is distinct from org or public.actor_role() not in ('jefe','encargado') then raise exception 'Fuera del ámbito actual'; end if;
  if public.actor_role()='encargado' and not exists(
    select 1 from public.profiles p where p.id=r.owner_id and p.organization_id=org and p.active and p.manager_id=auth.uid()
  ) then raise exception 'Fuera del equipo asignado'; end if;
  update public.onboarding_requests set status='changes_requested',updated_at=now() where id=r.id;
  insert into public.onboarding_reviews(organization_id,request_id,revision,actor_id,action,note)
  values(org,r.id,r.current_revision,auth.uid(),'changes_requested',trim(p_note));
  insert into public.audit_events(organization_id,actor_id,action,entity_id,details)
  values(org,auth.uid(),'onboarding.changes_requested',r.id,jsonb_build_object('revision',r.current_revision));
end
$$;

create or replace function public._coordination_record_activity(
  p_instance uuid,
  p_work_date date,
  p_quantity integer,
  p_reference text,
  p_operation uuid,
  p_operation_kind text
) returns uuid
language plpgsql security definer set search_path='' as $$
declare
  plan jsonb;
  actor uuid:=auth.uid();
  planned public.task_instances%rowtype;
  t public.task_instances%rowtype;
  args jsonb;
  cached public.task_mutation_receipts%rowtype;
  people uuid[];
  months jsonb;
  entry uuid;
  at_time timestamptz;
  profile_item uuid;
begin
  if actor is null or p_operation is null then raise exception 'Identidad y operación requeridas'; end if;
  args:=jsonb_build_object('instance',p_instance,'work_date',p_work_date,'quantity',p_quantity,'reference',p_reference);
  perform public._coordination_receipt_lock(actor,p_operation);
  select * into cached from public.task_mutation_receipts where actor_id=actor and operation_id=p_operation;
  if found then
    if cached.operation_kind<>p_operation_kind or cached.arguments<>args then raise exception 'Identificador de operación reutilizado con otros argumentos'; end if;
    return coalesce((cached.result->>'entry_id')::uuid,(cached.result->>'id')::uuid);
  end if;
  if public.actor_role() not in ('jefe','encargado','empleado') or public.actor_org() is null then raise exception 'Sin permiso'; end if;
  select * into planned from public.task_instances where id=p_instance;
  if not found or not public.can_access_instance(p_instance) then raise exception 'Sin permiso'; end if;
  if p_quantity is null or p_quantity not between 1 and 1000000 or p_work_date is null
     or nullif(trim(coalesce(p_reference,'')),'') is null then raise exception 'Fecha, cantidad o referencia inválida'; end if;
  select coalesce(array_agg(distinct x),array[]::uuid[]) into people from (
    select planned.owner_id x
    union select m.profile_id from public.task_responsibility_heads h
      join public.task_responsibility_members m on m.set_id=h.set_id where h.instance_id=planned.id
    union select actor
  ) q;
  select coalesce(jsonb_agg(jsonb_build_object('ownerId',person,'period',planned.period)),'[]')
  into months from unnest(people) person;
  plan:=public._coordination_prepare(array[planned.id],array[]::uuid[],people,months,array[]::text[],'{}'::jsonb);
  perform public._coordination_acquire(plan);
  perform 1 from public.task_instances i where i.id=planned.id for update;
  select * into t from public.task_instances where id=planned.id;
  if (t.id,t.organization_id,t.assignment_id,t.company_id,t.owner_id,t.period,t.kind,t.state_revision)
     is distinct from (planned.id,planned.organization_id,planned.assignment_id,planned.company_id,planned.owner_id,planned.period,planned.kind,planned.state_revision) then
    raise exception using errcode='40001',message='La tarea cambió; reintente desde otra transacción';
  end if;
  at_time:=clock_timestamp();
  if not public._can_access_instance_at(t.id,at_time) or public.actor_role()='auditor' then raise exception 'Sin permiso'; end if;
  if t.kind<>'operativa' or date_trunc('month',p_work_date)::date<>t.period
     or p_work_date>(at_time at time zone 'America/Argentina/Buenos_Aires')::date then raise exception 'Fecha o tipo de tarea inválidos'; end if;
  foreach profile_item in array people loop perform public._coordination_assert_month(profile_item,t.period); end loop;

  -- The receipt lock identifies a replay. Content equality does not: two
  -- different operation IDs always create two independent activity entries.
  insert into public.activity_entries(organization_id,instance_id,work_date,quantity,reference,actor_id)
  values(t.organization_id,t.id,p_work_date,p_quantity,trim(p_reference),actor)
  returning id into entry;
  update public.task_instances set state_revision=state_revision+1 where id=t.id;
  insert into public.audit_events(organization_id,actor_id,action,entity_id,at,details)
  values(t.organization_id,actor,'activity.created',entry,at_time,jsonb_build_object('instance',t.id,'work_date',p_work_date,'quantity',p_quantity));
  insert into public.task_mutation_receipts(organization_id,actor_id,operation_id,operation_kind,arguments,result)
  values(t.organization_id,actor,p_operation,p_operation_kind,args,
    case when p_operation_kind='record_activity' then jsonb_build_object('entry_id',entry) else jsonb_build_object('id',entry) end);
  return entry;
end
$$;

commit;
