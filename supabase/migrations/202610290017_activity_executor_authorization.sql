-- A supervisor's permission to inspect an operational task does not authorize
-- them to register work on it. Revalidate executor identity after coordination
-- locks and on receipt replay; keep historic joint operational tasks read-only.
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
  cached_after public.task_mutation_receipts%rowtype;
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
    if cached.organization_id is null then raise exception 'Sin permiso'; end if;
    select * into planned from public.task_instances where id=p_instance and organization_id=cached.organization_id;
    if not found then raise exception 'Sin permiso'; end if;
    select coalesce(array_agg(distinct x order by x),array[]::uuid[]) into people from (
      select actor x union select planned.owner_id
      union select m.profile_id from public.task_responsibility_heads h
        join public.task_responsibility_members m on m.set_id=h.set_id
        where h.instance_id=planned.id and h.organization_id=planned.organization_id
    ) q;
    select coalesce(jsonb_agg(jsonb_build_object('ownerId',x,'period',planned.period) order by x),'[]'::jsonb)
      into months from unnest(people) x;
    plan:=public._coordination_prepare(array[planned.id],array[actor],people,months,array[]::text[],'{}'::jsonb);
    perform app_private._coordination_acquire_m22b(plan,false);
    select * into t from public.task_instances where id=p_instance;
    if not found or (t.id,t.organization_id,t.assignment_id,t.company_id,t.owner_id,t.team_id,t.period,t.kind)
      is distinct from (planned.id,planned.organization_id,planned.assignment_id,planned.company_id,planned.owner_id,planned.team_id,planned.period,planned.kind)
      then raise exception using errcode='40001',message='La tarea cambió; reintente desde otra transacción'; end if;
    select * into cached_after from public.task_mutation_receipts where actor_id=actor and operation_id=p_operation;
    if not found or (cached_after.organization_id,cached_after.actor_id,cached_after.operation_id,cached_after.operation_kind,cached_after.arguments,cached_after.result)
      is distinct from (cached.organization_id,cached.actor_id,cached.operation_id,cached.operation_kind,cached.arguments,cached.result)
      then raise exception using errcode='40001',message='El recibo de actividad cambió; reintente desde otra transacción'; end if;
    at_time:=clock_timestamp();
    if not exists(select 1 from public.profiles p where p.id=actor and p.organization_id=t.organization_id and p.active and p.role in ('empleado','encargado','jefe'))
      or not coalesce(public.actor_role() in ('empleado','encargado','jefe'),false)
      or not coalesce(public._can_access_instance_at(t.id,at_time),false)
      then raise exception 'Sin permiso'; end if;
    if exists(select 1 from public.task_responsibility_heads h
        join public.task_responsibility_sets s on s.id=h.set_id and s.organization_id=h.organization_id
        where h.instance_id=t.id and s.mode='conjunta') then
      raise exception using errcode='0A000',message='GP_JOINT_OPERATION_REQUIRES_REVIEW';
    end if;
    if not app_private.api_task_actor_can_execute(t.id,actor,p_work_date) then
      raise exception using errcode='42501',message='Sin permiso para registrar actividad en esta tarea';
    end if;
    if jsonb_typeof(cached_after.result) is distinct from 'object'
       or (p_operation_kind='record_activity' and (
         coalesce(cached_after.result->>'entry_id','') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
         or cached_after.result is distinct from jsonb_build_object('entry_id',cached_after.result->>'entry_id')))
       or (p_operation_kind<>'record_activity' and (
         coalesce(cached_after.result->>'id','') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
         or cached_after.result is distinct from jsonb_build_object('id',cached_after.result->>'id'))) then
      raise exception using errcode='40001',message='El recibo de actividad es inconsistente; reintente desde otra transacción';
    end if;
    entry:=case when p_operation_kind='record_activity' then (cached_after.result->>'entry_id')::uuid else (cached_after.result->>'id')::uuid end;
    return entry;
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
  if exists(select 1 from public.task_responsibility_heads h
      join public.task_responsibility_sets s on s.id=h.set_id and s.organization_id=h.organization_id
      where h.instance_id=t.id and s.mode='conjunta') then
    raise exception using errcode='0A000',message='GP_JOINT_OPERATION_REQUIRES_REVIEW';
  end if;
  if not app_private.api_task_actor_can_execute(t.id,actor,p_work_date) then
    raise exception using errcode='42501',message='Sin permiso para registrar actividad en esta tarea';
  end if;
  foreach profile_item in array people loop perform public._coordination_assert_month(profile_item,t.period); end loop;

  -- Distinct operation IDs remain distinct movement entries.
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
