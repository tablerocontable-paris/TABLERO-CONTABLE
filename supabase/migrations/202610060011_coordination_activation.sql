-- B2b / 011 local implementation slice. NOT production-ready yet.
-- Joint tasks, selected bindings and participant-safe reads are covered here;
-- all-write-path lock conversion, recurring coverage materialization and v4
-- monthly close/report attribution remain blocked. Do not apply remotely.
-- Apply only from 001 in the isolated accounting lab.
begin;

-- One open clock per actor and task. Historical sessions retain their actor and
-- legacy absence provenance; the new columns describe new sessions only.
drop index public.one_open_session_per_instance;
create unique index one_open_session_per_actor_instance
  on public.task_time_sessions(actor_id,instance_id) where ended_at is null;
alter table public.task_time_sessions
  add column contribution_kind text not null default 'responsible'
    check(contribution_kind in ('responsible','coverage')),
  add column coverage_binding_id uuid;
alter table public.task_coverage_plans add constraint coverage_plan_party_identity
  unique(id,responsible_id,replacement_id,organization_id);

create table public.task_coverage_bindings(
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  plan_id uuid not null,
  instance_id uuid,
  assignment_id uuid,
  responsible_id uuid not null,
  replacement_id uuid not null,
  starts_on date not null,
  ends_on date not null,
  company_id_snapshot uuid not null,
  period_snapshot date,
  scheduled_on_snapshot date,
  assignment_snapshot jsonb,
  status text not null default 'active' check(status in ('active','cancelled','expired')),
  approved_by uuid not null,
  approved_at timestamptz not null default clock_timestamp(),
  cancelled_by uuid,
  cancelled_at timestamptz,
  cancel_reason text,
  created_at timestamptz not null default clock_timestamp(),
  unique(id,organization_id),
  foreign key(plan_id,organization_id) references public.task_coverage_plans(id,organization_id),
  foreign key(plan_id,responsible_id,replacement_id,organization_id)
    references public.task_coverage_plans(id,responsible_id,replacement_id,organization_id),
  foreign key(instance_id,organization_id) references public.task_instances(id,organization_id),
  foreign key(assignment_id,organization_id) references public.task_assignments(id,organization_id),
  foreign key(responsible_id,organization_id) references public.profiles(id,organization_id),
  foreign key(replacement_id,organization_id) references public.profiles(id,organization_id),
  foreign key(company_id_snapshot,organization_id) references public.companies(id,organization_id),
  foreign key(approved_by,organization_id) references public.profiles(id,organization_id),
  foreign key(cancelled_by,organization_id) references public.profiles(id,organization_id),
  check((instance_id is null)<>(assignment_id is null)),
  check(isfinite(starts_on) and isfinite(ends_on) and starts_on<=ends_on),
  check((instance_id is not null and period_snapshot is not null and scheduled_on_snapshot is not null and assignment_id is null and assignment_snapshot is null)
     or (assignment_id is not null and instance_id is null and period_snapshot is null and scheduled_on_snapshot is null and jsonb_typeof(assignment_snapshot)='object')),
  check((status='cancelled')=(cancelled_at is not null and cancelled_by is not null and cancel_reason is not null))
);
create index task_coverage_bindings_instance_active_idx
  on public.task_coverage_bindings(instance_id,starts_on,ends_on) where status='active';
create index task_coverage_bindings_assignment_active_idx
  on public.task_coverage_bindings(assignment_id,starts_on,ends_on) where status='active';
create unique index task_coverage_binding_instance_replacement_active_uq
  on public.task_coverage_bindings(instance_id,replacement_id) where status='active' and instance_id is not null;
create unique index task_coverage_binding_rule_replacement_active_uq
  on public.task_coverage_bindings(assignment_id,replacement_id,starts_on,ends_on) where status='active' and assignment_id is not null;
alter table public.task_time_sessions add constraint session_coverage_binding_fk
  foreign key(coverage_binding_id,organization_id) references public.task_coverage_bindings(id,organization_id);
alter table public.task_time_sessions add constraint session_contribution_provenance_ck
  check((contribution_kind='coverage')=(coverage_binding_id is not null));

alter table public.task_coverage_bindings enable row level security;
revoke all on public.task_coverage_bindings from public,anon,authenticated,service_role;
revoke all on function public._coordination_text_present(text),public._validate_task_responsibility_set(uuid),
  public._validate_task_coverage_plan(uuid),public._legacy_task_responsibility(uuid)
  from public,anon,authenticated,service_role;

-- Physical lock ordering is by signed int keys in separate namespaces. Locks
-- are transaction scoped. No client can provide a lock plan.
create function public._coordination_lock_one(p_namespace integer,p_identity text) returns void
language plpgsql security definer set search_path='' as $$
begin
  perform pg_catalog.pg_advisory_xact_lock(p_namespace,pg_catalog.hashtext(p_identity));
end $$;
create function public._coordination_lock_keys(p_namespace integer,p_identities text[]) returns void
language plpgsql security definer set search_path='' as $$
declare k integer;
begin
  for k in select distinct pg_catalog.hashtext(x) from pg_catalog.unnest(coalesce(p_identities,'{}'::text[])) x
    where x is not null order by 1
  loop perform pg_catalog.pg_advisory_xact_lock(p_namespace,k); end loop;
end $$;
create function public._coordination_receipt_lock(p_actor uuid,p_operation uuid) returns void
language plpgsql security definer set search_path='' as $$
begin
  if p_actor is null or p_operation is null then raise exception 'Identidad y operación requeridas'; end if;
  perform public._coordination_lock_one(1101,p_actor::text||':'||p_operation::text);
end $$;
create function public._coordination_acquire(p_actors uuid[],p_profiles uuid[],p_months jsonb,p_catalog text[]) returns void
language plpgsql security definer set search_path='' as $$
declare identities text[];
begin
  perform public._coordination_lock_keys(1102,coalesce((select array_agg(x::text) from pg_catalog.unnest(p_actors) x),'{}'));
  perform public._coordination_lock_keys(1103,coalesce((select array_agg(x::text) from pg_catalog.unnest(p_profiles) x),'{}'));
  select coalesce(array_agg((x->>'ownerId')||':'||(x->>'period')),'{}') into identities
    from pg_catalog.jsonb_array_elements(coalesce(p_months,'[]'::jsonb)) x;
  perform public._coordination_lock_keys(1104,identities);
  perform public._coordination_lock_keys(1105,p_catalog);
end $$;
create function public._coordination_assert_month(p_owner uuid,p_period date) returns void
language plpgsql security definer set search_path='' as $$
begin
  if exists(select 1 from public.monthly_closures c where c.owner_id=p_owner and c.period=p_period) then
    raise exception 'El mes está cerrado';
  end if;
end $$;

-- Replace the old advisory lock helper by an assertion. Writers in this
-- migration acquire M before calling it; direct callers cannot use it as a lock.
create or replace function public.lock_open_month(target_owner uuid,target_period date) returns void
language plpgsql security definer set search_path='' as $$
begin perform public._coordination_assert_month(target_owner,target_period); end $$;

create or replace function public._guard_task_responsibility_head() returns trigger
language plpgsql security definer set search_path='' as $$
declare s public.task_responsibility_sets%rowtype; old_revision bigint; old_origin text;
begin
  if tg_op='DELETE' then raise exception 'La cabecera de responsabilidad es inmutable'; end if;
  if tg_op='INSERT' then
    select * into s from public.task_responsibility_sets
      where id=new.set_id and instance_id=new.instance_id and organization_id=new.organization_id for update;
    if not found or not s.sealed or s.mode<>'individual' or s.origin<>'baseline_legacy' then
      raise exception 'La inserción sólo admite baseline durante upgrade';
    end if;
    perform public._validate_task_responsibility_set(s.id);
    return new;
  end if;
  select s0.revision,s0.origin into old_revision,old_origin
    from public.task_responsibility_heads h
    join public.task_responsibility_sets s0 on s0.id=h.set_id
    where h.instance_id=old.instance_id and h.organization_id=old.organization_id for update of h;
  select * into s from public.task_responsibility_sets
    where id=new.set_id and instance_id=new.instance_id and organization_id=new.organization_id for update;
  if not found or not s.sealed or s.origin<>'explicit' or s.revision<>old_revision+1 or old_origin<>'baseline_legacy'
    then raise exception 'La revisión de responsabilidad debe avanzar exactamente una vez'; end if;
  if (new.instance_id,new.organization_id) is distinct from (old.instance_id,old.organization_id) then
    raise exception 'La identidad de la cabecera es inmutable';
  end if;
  perform public._validate_task_responsibility_set(s.id);
  return new;
end $$;

-- Tasks created after 010 receive their immutable legacy baseline at insert.
-- A new-task flow may replace that head with an explicit revision in the same
-- transaction before it returns the task to readers.
create function public._capture_new_task_responsibility() returns trigger
language plpgsql security definer set search_path='' as $$
declare set_id uuid; sector_name text;
begin
 select v.sector into sector_name from public.task_template_versions v
  where v.id=new.template_version_id and v.organization_id=new.organization_id;
 insert into public.task_responsibility_sets(organization_id,instance_id,revision,mode,origin,anchor_owner_id,
  company_id_snapshot,period_snapshot,team_id_snapshot,sector_snapshot,sector_source)
 values(new.organization_id,new.id,1,'individual','baseline_legacy',new.owner_id,new.company_id,new.period,new.team_id,
  case when coalesce(public._coordination_text_present(sector_name),false) then sector_name else null end,
  case when coalesce(public._coordination_text_present(sector_name),false) then 'catalog' else 'unknown' end)
 returning id into set_id;
 insert into public.task_responsibility_members(set_id,organization_id,profile_id,share_bps)
  values(set_id,new.organization_id,new.owner_id,10000);
 update public.task_responsibility_sets set sealed=true where id=set_id;
 insert into public.task_responsibility_heads(instance_id,organization_id,set_id)
  values(new.id,new.organization_id,set_id);
 return new;
end $$;
create trigger task_instance_responsibility_baseline after insert on public.task_instances
 for each row execute function public._capture_new_task_responsibility();

-- Rows may have been created after 010 was deployed but before 011. Capture
-- only those still missing a head; existing sealed history is never rewritten.
insert into public.task_responsibility_sets(organization_id,instance_id,revision,mode,origin,anchor_owner_id,
 company_id_snapshot,period_snapshot,team_id_snapshot,sector_snapshot,sector_source)
select t.organization_id,t.id,1,'individual','baseline_legacy',t.owner_id,t.company_id,t.period,t.team_id,
 case when coalesce(public._coordination_text_present(v.sector),false) then v.sector else null end,
 case when coalesce(public._coordination_text_present(v.sector),false) then 'catalog' else 'unknown' end
from public.task_instances t left join public.task_template_versions v
 on v.id=t.template_version_id and v.organization_id=t.organization_id
left join public.task_responsibility_heads h on h.instance_id=t.id and h.organization_id=t.organization_id
where h.instance_id is null;
insert into public.task_responsibility_members(set_id,organization_id,profile_id,share_bps)
select s.id,s.organization_id,s.anchor_owner_id,10000 from public.task_responsibility_sets s
join public.task_instances t on t.id=s.instance_id and t.organization_id=s.organization_id
left join public.task_responsibility_heads h on h.instance_id=t.id and h.organization_id=t.organization_id
where h.instance_id is null and s.origin='baseline_legacy' and s.revision=1
 and not exists(select 1 from public.task_responsibility_members m where m.set_id=s.id);
update public.task_responsibility_sets s set sealed=true
where s.origin='baseline_legacy' and s.revision=1 and not s.sealed
 and not exists(select 1 from public.task_responsibility_heads h where h.instance_id=s.instance_id and h.organization_id=s.organization_id);
insert into public.task_responsibility_heads(instance_id,organization_id,set_id)
select s.instance_id,s.organization_id,s.id from public.task_responsibility_sets s
join public.task_instances t on t.id=s.instance_id and t.organization_id=s.organization_id
left join public.task_responsibility_heads h on h.instance_id=t.id and h.organization_id=t.organization_id
where h.instance_id is null and s.origin='baseline_legacy' and s.revision=1 and s.sealed;

create or replace function public.can_cover_instance(p_instance uuid) returns boolean
language sql stable security definer set search_path='' as $$
  select exists(
    select 1 from public.task_instances t
    join public.profiles a on a.id=auth.uid() and a.active and a.organization_id=t.organization_id and a.role in ('empleado','encargado')
    join public.task_coverage_bindings b on b.instance_id=t.id and b.organization_id=t.organization_id
      and b.replacement_id=a.id and b.responsible_id=t.owner_id and b.status='active'
      and (now() at time zone 'America/Argentina/Buenos_Aires')::date between b.starts_on and b.ends_on
    join public.company_memberships cm on cm.profile_id=a.id and cm.company_id=t.company_id and cm.organization_id=t.organization_id
    where t.id=p_instance and t.period=b.period_snapshot
  ) or exists(
    select 1 from public.task_instances t
    join public.profiles a on a.id=auth.uid() and a.active and a.organization_id=t.organization_id
    join public.employee_absences x on x.owner_id=t.owner_id and x.organization_id=t.organization_id
      and x.replacement_id=a.id and x.cancelled_at is null and x.authorization_sealed
    join public.employee_absence_companies c on c.absence_id=x.id and c.organization_id=x.organization_id and c.company_id=t.company_id
    join public.company_memberships am on am.profile_id=a.id and am.company_id=t.company_id and am.organization_id=t.organization_id
    join public.company_memberships om on om.profile_id=t.owner_id and om.company_id=t.company_id and om.organization_id=t.organization_id
    where t.id=p_instance and a.role in ('empleado','encargado')
      and (now() at time zone 'America/Argentina/Buenos_Aires')::date between x.starts_on and x.ends_on
      and t.period between date_trunc('month',x.starts_on)::date and date_trunc('month',x.ends_on)::date
  )
$$;
create or replace function public._can_access_instance_at(p_instance uuid,p_at timestamptz) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.task_instances t join public.profiles a on a.id=auth.uid() and a.active and a.organization_id=t.organization_id
  where t.id=p_instance and (
   (public.can_access_owner(t.owner_id) and (a.role='jefe' or exists(select 1 from public.company_memberships m where m.profile_id=a.id and m.company_id=t.company_id and m.organization_id=t.organization_id)))
   or (exists(select 1 from public.task_responsibility_heads h join public.task_responsibility_members rm on rm.set_id=h.set_id
       where h.instance_id=t.id and h.organization_id=t.organization_id and rm.profile_id=a.id)
       and a.role in ('empleado','encargado')
       and exists(select 1 from public.company_memberships cm where cm.profile_id=a.id and cm.company_id=t.company_id and cm.organization_id=t.organization_id))
   or exists(select 1 from public.task_coverage_bindings b join public.company_memberships cm on cm.profile_id=a.id and cm.company_id=t.company_id and cm.organization_id=t.organization_id
       where b.instance_id=t.id and b.organization_id=t.organization_id and b.responsible_id=t.owner_id and b.replacement_id=a.id
         and b.status='active' and t.period=b.period_snapshot
         and (p_at at time zone 'America/Argentina/Buenos_Aires')::date between b.starts_on and b.ends_on)
   or exists(select 1 from public.profiles o join public.employee_absences x on x.owner_id=o.id and x.organization_id=o.organization_id
       join public.employee_absence_companies c on c.absence_id=x.id and c.organization_id=x.organization_id and c.company_id=t.company_id
       join public.company_memberships am on am.profile_id=a.id and am.company_id=t.company_id and am.organization_id=t.organization_id
       join public.company_memberships om on om.profile_id=o.id and om.company_id=t.company_id and om.organization_id=t.organization_id
       where o.id=t.owner_id and o.active and a.role in ('empleado','encargado') and x.replacement_id=a.id and x.cancelled_at is null and x.authorization_sealed
         and (p_at at time zone 'America/Argentina/Buenos_Aires')::date between x.starts_on and x.ends_on
         and t.period between date_trunc('month',x.starts_on)::date and date_trunc('month',x.ends_on)::date)
  ))
$$;
create or replace function public.can_access_instance(p_instance_id uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select public._can_access_instance_at(p_instance_id,clock_timestamp())
$$;

create or replace function public._effective_session_end(p_session uuid,p_proposed timestamptz) returns timestamptz
language sql stable security definer set search_path='' as $$
 select least(p_proposed,
   coalesce((a.ends_on+1)::timestamp at time zone 'America/Argentina/Buenos_Aires',
     (b.ends_on+1)::timestamp at time zone 'America/Argentina/Buenos_Aires'),
   a.cancelled_at,
   case when b.status='cancelled' then b.cancelled_at end)
 from public.task_time_sessions s
 left join public.employee_absences a on a.id=s.absence_id
 left join public.task_coverage_bindings b on b.id=s.coverage_binding_id
 where s.id=p_session
$$;
create or replace function public._session_cutoff(p_session uuid) returns timestamptz
language sql stable security definer set search_path='' as $$
 select least((a.ends_on+1)::timestamp at time zone 'America/Argentina/Buenos_Aires',
   (b.ends_on+1)::timestamp at time zone 'America/Argentina/Buenos_Aires',
   a.cancelled_at,case when b.status='cancelled' then b.cancelled_at end)
 from public.task_time_sessions s
 left join public.employee_absences a on a.id=s.absence_id
 left join public.task_coverage_bindings b on b.id=s.coverage_binding_id
 where s.id=p_session
$$;

create or replace function public.start_task_timer(
 p_instance uuid,p_expected_revision bigint,p_operation_id uuid,p_switch boolean default false
) returns uuid
language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); planned public.task_instances%rowtype; t public.task_instances%rowtype;
 old_session public.task_time_sessions%rowtype; target_session public.task_time_sessions%rowtype;
 source_task public.task_instances%rowtype; new_session uuid; binding uuid; absence uuid; old_ended timestamptz;
 cached public.task_mutation_receipts%rowtype; args jsonb; result uuid; at_time timestamptz;
 actors uuid[]; profiles_to_lock uuid[]; months jsonb; active_count integer; contribution text;
begin
 if actor is null or p_instance is null or p_operation_id is null or p_expected_revision is null
   or p_expected_revision<0 or p_switch is null then raise exception 'Identidad, revisión y operación requeridas'; end if;
 perform public._coordination_receipt_lock(actor,p_operation_id);
 args:=jsonb_build_object('instance',p_instance,'revision',p_expected_revision,'switch',p_switch);
 select * into cached from public.task_mutation_receipts where actor_id=actor and operation_id=p_operation_id;
 if found then
   if cached.operation_kind<>'start_timer' or cached.arguments<>args then raise exception 'Identificador de operación reutilizado con otros argumentos'; end if;
   return (cached.result->>'session_id')::uuid;
 end if;
 select * into planned from public.task_instances where id=p_instance;
 if not found then raise exception 'Tarea inexistente'; end if;
 select * into old_session from public.task_time_sessions where actor_id=actor and ended_at is null;
 if old_session.id is not null then select * into source_task from public.task_instances where id=old_session.instance_id; end if;
 select coalesce(array_agg(distinct x),array[]::uuid[]) into profiles_to_lock from (
   select planned.owner_id x union select m.profile_id from public.task_responsibility_heads h
     join public.task_responsibility_members m on m.set_id=h.set_id where h.instance_id=planned.id
   union select source_task.owner_id where source_task.id is not null
   union select m.profile_id from public.task_responsibility_heads h
     join public.task_responsibility_members m on m.set_id=h.set_id where h.instance_id=source_task.id
 ) q;
 profiles_to_lock:=array_append(profiles_to_lock,actor);
 actors:=array[actor];
 select coalesce(jsonb_agg(jsonb_build_object('ownerId',q.profile_id,'period',q.period)),'[]')
   into months from (
     select distinct profiles_to_lock_item.profile_id,qtask.period
     from unnest(profiles_to_lock) profiles_to_lock_item(profile_id)
     cross join (select planned.period union select source_task.period where source_task.id is not null) qtask
   ) q;
 perform public._coordination_acquire(actors,profiles_to_lock,months,array[]::text[]);
 perform 1 from public.task_instances i where i.id in (planned.id,source_task.id) order by i.id for update;
 perform 1 from public.task_time_sessions s where s.ended_at is null
   and (s.instance_id in (planned.id,source_task.id) or s.actor_id=actor)
   order by s.instance_id,s.actor_id,s.id for update;
 select * into t from public.task_instances where id=p_instance;
 if (t.id,t.organization_id,t.assignment_id,t.company_id,t.owner_id,t.team_id,t.period,t.state_revision)
   is distinct from (planned.id,planned.organization_id,planned.assignment_id,planned.company_id,planned.owner_id,planned.team_id,planned.period,planned.state_revision)
   then raise exception using errcode='40001',message='La ocurrencia cambió; reintente en una transacción nueva'; end if;
 select * into old_session from public.task_time_sessions where actor_id=actor and ended_at is null;
 if (old_session.id is distinct from null and old_session.instance_id is distinct from source_task.id)
   or (source_task.id is null and old_session.id is not null) then
   raise exception using errcode='40001',message='El cronómetro de origen cambió; reintente';
 end if;
 at_time:=clock_timestamp();
 if not public._can_access_instance_at(t.id,at_time) or public.actor_role()='auditor' then raise exception 'Sin permiso'; end if;
 if t.state_revision<>p_expected_revision then raise exception 'La tarea cambió; actualice antes de continuar'; end if;
 if t.status='Completada' or t.blocked_by is not null then raise exception 'La tarea no admite cronómetro'; end if;
 perform public._coordination_assert_month(t.owner_id,t.period);
 if exists(select 1 from public.monthly_closures c where c.owner_id=any(profiles_to_lock) and c.period=t.period) then
   raise exception 'El período del participante está cerrado';
 end if;
 select * into target_session from public.task_time_sessions where instance_id=t.id and actor_id=actor and ended_at is null;
 if target_session.id is not null then
   insert into public.task_mutation_receipts(organization_id,actor_id,operation_id,operation_kind,arguments,result)
   values(t.organization_id,actor,p_operation_id,'start_timer',args,jsonb_build_object('session_id',target_session.id));
   return target_session.id;
 end if;
 select count(*)::integer into active_count from public.task_time_sessions where instance_id=t.id and ended_at is null;
 if active_count>=2 then raise exception 'La tarea ya tiene sus dos espacios de ejecución ocupados'; end if;
 -- A legacy coverage clock whose authorization has ended is closed even when
 -- the caller did not request switching. Ordinary clocks still require the
 -- explicit switch flag.
 if old_session.id is not null and not p_switch
   and not (public._session_cutoff(old_session.id) is not null and public._session_cutoff(old_session.id)<=at_time)
   then raise exception 'Pause su cronómetro actual o solicite el cambio'; end if;
 binding:=null; absence:=null; contribution:='responsible';
 if exists(select 1 from public.task_responsibility_heads h join public.task_responsibility_members m on m.set_id=h.set_id
   where h.instance_id=t.id and m.profile_id=actor) then
   contribution:='responsible';
 else
   select b.id into binding from public.task_coverage_bindings b
    where b.instance_id=t.id and b.organization_id=t.organization_id and b.responsible_id=t.owner_id
      and b.replacement_id=actor and b.status='active' and b.period_snapshot=t.period
      and b.company_id_snapshot=t.company_id
      and (at_time at time zone 'America/Argentina/Buenos_Aires')::date between b.starts_on and b.ends_on
    order by b.approved_at,b.id limit 1;
   if binding is not null then contribution:='coverage';
   elsif not public.can_access_owner(t.owner_id) then
     select a.id into absence from public.employee_absences a
       join public.employee_absence_companies c on c.absence_id=a.id and c.company_id=t.company_id and c.organization_id=t.organization_id
       where a.owner_id=t.owner_id and a.replacement_id=actor and a.cancelled_at is null and a.authorization_sealed
         and (at_time at time zone 'America/Argentina/Buenos_Aires')::date between a.starts_on and a.ends_on
         and t.period between date_trunc('month',a.starts_on)::date and date_trunc('month',a.ends_on)::date limit 1;
     if absence is null then raise exception 'Cobertura vencida o sin autorización para esta tarea'; end if;
     contribution:='coverage';
   end if;
 end if;
 if not public._can_access_instance_at(t.id,at_time) then raise exception 'Sin permiso'; end if;
 if old_session.id is not null then
   perform public._coordination_assert_month(source_task.owner_id,source_task.period);
   if public._session_cutoff(old_session.id) is not null and public._session_cutoff(old_session.id)<=at_time then
     old_ended:=public._effective_session_end(old_session.id,at_time);
     update public.task_time_sessions set ended_at=greatest(old_session.started_at,old_ended) where id=old_session.id;
     update public.task_instances set state_revision=state_revision+1 where id=source_task.id;
     insert into public.audit_events(organization_id,actor_id,action,entity_id,at,details)
      values(source_task.organization_id,actor,'task.timer_expired',old_session.id,clock_timestamp(),
       jsonb_build_object('instance',source_task.id,'executor',actor,'session',old_session.id,'started_at',old_session.started_at,'ended_at',old_ended,
         'absence',old_session.absence_id,'binding',old_session.coverage_binding_id));
   elsif old_session.coverage_binding_id is not null or old_session.absence_id is not null then
     old_ended:=public._effective_session_end(old_session.id,at_time);
     update public.task_time_sessions set ended_at=greatest(old_session.started_at,old_ended) where id=old_session.id;
     update public.task_instances set state_revision=state_revision+1 where id=source_task.id;
     insert into public.audit_events(organization_id,actor_id,action,entity_id,at,details)
      values(source_task.organization_id,actor,'task.timer_switched',old_session.id,clock_timestamp(),
       jsonb_build_object('from_instance',source_task.id,'to_instance',t.id,'executor',actor,'session',old_session.id,'started_at',old_session.started_at,'ended_at',old_ended));
   else
     update public.task_time_sessions set ended_at=greatest(old_session.started_at,at_time) where id=old_session.id;
     update public.task_instances set state_revision=state_revision+1 where id=source_task.id;
     insert into public.audit_events(organization_id,actor_id,action,entity_id,at,details)
      values(source_task.organization_id,actor,'task.timer_switched',old_session.id,clock_timestamp(),
       jsonb_build_object('from_instance',source_task.id,'to_instance',t.id,'executor',actor,'session',old_session.id,'started_at',old_session.started_at,'ended_at',at_time));
   end if;
 end if;
 if t.status='Pendiente' then
   update public.task_instances set status='En curso',started_at=coalesce(started_at,at_time),state_revision=state_revision+1 where id=t.id;
 else
   update public.task_instances set state_revision=state_revision+1 where id=t.id;
 end if;
 insert into public.task_time_sessions(organization_id,instance_id,actor_id,started_at,absence_id,contribution_kind,coverage_binding_id)
 values(t.organization_id,t.id,actor,at_time,absence,contribution,binding) returning id into new_session;
 insert into public.audit_events(organization_id,actor_id,action,entity_id,at,details)
 values(t.organization_id,actor,'task.timer_started',new_session,at_time,jsonb_build_object('instance',t.id,'contribution',contribution,'binding',binding));
 insert into public.task_mutation_receipts(organization_id,actor_id,operation_id,operation_kind,arguments,result)
 values(t.organization_id,actor,p_operation_id,'start_timer',args,jsonb_build_object('session_id',new_session));
 return new_session;
end $$;

create or replace function public.pause_task_timer(p_session uuid,p_operation_id uuid) returns timestamptz
language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); planned_s public.task_time_sessions%rowtype; s public.task_time_sessions%rowtype;
 planned_t public.task_instances%rowtype; t public.task_instances%rowtype; cached public.task_mutation_receipts%rowtype;
 args jsonb; ended timestamptz; at_time timestamptz; people uuid[]; months jsonb; org uuid;
begin
 if actor is null or p_session is null or p_operation_id is null then raise exception 'Identidad y operación requeridas'; end if;
 perform public._coordination_receipt_lock(actor,p_operation_id);
 args:=jsonb_build_object('session',p_session);
 select * into cached from public.task_mutation_receipts where actor_id=actor and operation_id=p_operation_id;
 if found then
   if cached.operation_kind<>'pause_timer' or cached.arguments<>args then raise exception 'Identificador de operación reutilizado con otros argumentos'; end if;
   return (cached.result->>'ended_at')::timestamptz;
 end if;
 select * into planned_s from public.task_time_sessions where id=p_session and actor_id=actor;
 if not found then raise exception 'Sesión propia no encontrada'; end if;
 select * into planned_t from public.task_instances where id=planned_s.instance_id;
 if not found then raise exception 'Sesión inválida'; end if;
 org:=(select p.organization_id from public.profiles p where p.id=actor);
 if org is distinct from planned_t.organization_id then raise exception 'Sin permiso'; end if;
 select coalesce(array_agg(distinct x),array[]::uuid[]) into people from (
   select planned_t.owner_id x union select m.profile_id from public.task_responsibility_heads h
    join public.task_responsibility_members m on m.set_id=h.set_id where h.instance_id=planned_t.id
 ) q;
 select coalesce(jsonb_agg(jsonb_build_object('ownerId',person.profile_id,'period',planned_t.period)),'[]')
  into months from unnest(people) person(profile_id);
 perform public._coordination_acquire(array[actor],people,months,array[]::text[]);
 perform 1 from public.task_instances i where i.id=planned_t.id for update;
 select * into t from public.task_instances where id=planned_t.id;
 if (t.id,t.organization_id,t.assignment_id,t.company_id,t.owner_id,t.period,t.state_revision)
   is distinct from (planned_t.id,planned_t.organization_id,planned_t.assignment_id,planned_t.company_id,planned_t.owner_id,planned_t.period,planned_t.state_revision)
   then raise exception using errcode='40001',message='La tarea cambió; reintente desde una transacción nueva'; end if;
 select * into s from public.task_time_sessions where id=p_session and actor_id=actor for update;
 if not found or (s.id,s.instance_id,s.actor_id,s.started_at,s.absence_id,s.coverage_binding_id)
    is distinct from (planned_s.id,planned_s.instance_id,planned_s.actor_id,planned_s.started_at,planned_s.absence_id,planned_s.coverage_binding_id)
   then raise exception using errcode='40001',message='La sesión cambió; reintente'; end if;
 if s.ended_at is not null then ended:=s.ended_at;
 else
   perform public._coordination_assert_month(t.owner_id,t.period);
   at_time:=clock_timestamp();
   ended:=public._effective_session_end(s.id,at_time);
   update public.task_time_sessions set ended_at=greatest(s.started_at,ended) where id=s.id;
   if not exists(select 1 from public.monthly_closures c where c.owner_id=actor and c.period=t.period) then
     update public.task_instances set state_revision=state_revision+1 where id=t.id;
   end if;
   insert into public.audit_events(organization_id,actor_id,action,entity_id,at,details)
    values(t.organization_id,actor,
      case when public._session_cutoff(s.id) is not null and public._session_cutoff(s.id)<=at_time then 'task.timer_expired' else 'task.timer_paused' end,
      s.id,at_time,jsonb_build_object('instance',t.id,'executor',actor,'session',s.id,'started_at',s.started_at,'ended_at',ended,
        'absence',s.absence_id,'binding',s.coverage_binding_id,'contribution',s.contribution_kind));
 end if;
 insert into public.task_mutation_receipts(organization_id,actor_id,operation_id,operation_kind,arguments,result)
 values(org,actor,p_operation_id,'pause_timer',args,jsonb_build_object('ended_at',ended));
 return ended;
end $$;

create function public._coordination_apply_task_control(
 p_instance uuid,p_kind text,p_next text,p_check text,p_done boolean,p_note text,p_reason text,p_expected_revision bigint
) returns bigint
language plpgsql security definer set search_path='' as $$
#variable_conflict use_column
declare planned public.task_instances%rowtype; t public.task_instances%rowtype;
 checklist_next jsonb; next_status text; stop_all boolean; start_clock boolean; changes_check boolean;
 session_actors uuid[]; current_actors uuid[]; actor_locks uuid[]; profile_locks uuid[];
 month_locks jsonb; s public.task_time_sessions%rowtype; at_time timestamptz; result_revision bigint;
 contribution text; binding uuid; absence uuid; open_actor_session public.task_time_sessions%rowtype;
 active_count integer; supervisor boolean; reason text;
 profile_item uuid;
begin
 if p_kind not in ('transition','checklist','wait') then raise exception 'Operación de tarea inválida'; end if;
 if auth.uid() is null or p_expected_revision is null or p_expected_revision<0 then raise exception 'Identidad y revisión requeridas'; end if;
 if not public.can_access_instance(p_instance) or public.actor_role()='auditor' then raise exception 'Sin permiso'; end if;
 select * into planned from public.task_instances where id=p_instance;
 if not found then raise exception 'Tarea inexistente'; end if;
 checklist_next:=planned.checklist;
 next_status:=planned.status;
 changes_check:=false;
 if p_kind='transition' then
   if p_next not in ('Pendiente','En curso','Completada') then raise exception 'Estado inválido'; end if;
   next_status:=p_next;
 elsif p_kind='checklist' then
   if p_check is null or p_done is null or not exists(select 1 from jsonb_array_elements(planned.checklist) x where x->>'id'=p_check)
     then raise exception 'Paso inválido'; end if;
   changes_check:=exists(select 1 from jsonb_array_elements(planned.checklist) x where x->>'id'=p_check and coalesce((x->>'done')::boolean,false) is distinct from p_done);
   select coalesce(jsonb_agg(case when x->>'id'=p_check then jsonb_set(x,'{done}',to_jsonb(p_done)) else x end order by ord),'[]'::jsonb)
    into checklist_next from jsonb_array_elements(planned.checklist) with ordinality z(x,ord);
   if changes_check then
    next_status:=case when planned.status='Completada' then 'En curso'
      when p_done and planned.status='Pendiente' and planned.blocked_by is null then 'En curso'
      else planned.status end;
    if planned.kind='resultado' and next_status<>'Pendiente' and planned.blocked_by is null
      and not exists(select 1 from jsonb_array_elements(checklist_next) x where coalesce((x->>'done')::boolean,false)=false)
      then next_status:='Completada'; end if;
   end if;
 elsif p_kind='wait' then
   if p_note is not null and public._coordination_text_present(p_note) is not true then raise exception 'La espera requiere descripción o NULL'; end if;
   if p_note is not null and planned.status='Completada' then raise exception 'Reabra la tarea antes de ponerla en espera'; end if;
 end if;
 if planned.status='Completada' and next_status<>'Completada' and nullif(trim(coalesce(p_reason,'')),'') is null then
   raise exception 'La reapertura requiere motivo';
 end if;
 if next_status='Completada' and (planned.kind='operativa' or (p_kind='transition' and planned.status='Pendiente')
    or planned.blocked_by is not null or exists(select 1 from jsonb_array_elements(checklist_next) x where coalesce((x->>'done')::boolean,false)=false))
   then raise exception 'Transición inválida o controles pendientes'; end if;
 reason:=nullif(trim(coalesce(p_reason,'')),'');
 stop_all:=(p_kind='wait' and p_note is not null and planned.blocked_by is distinct from trim(p_note)) or next_status in ('Pendiente','Completada')
   or (p_kind='checklist' and planned.status='Completada' and next_status<>'Completada');
 start_clock:=p_kind='transition' and next_status='En curso' and planned.status='Pendiente'
   or p_kind='checklist' and changes_check and planned.status='Pendiente' and next_status='En curso';
 select coalesce(array_agg(distinct s.actor_id order by s.actor_id),array[]::uuid[])
   into session_actors from public.task_time_sessions s where s.instance_id=planned.id and s.ended_at is null
   and (stop_all or start_clock);
 actor_locks:=array(select distinct x from (select auth.uid() x union select unnest(session_actors)) q order by x);
 select coalesce(array_agg(distinct x),array[]::uuid[]) into profile_locks from (
   select planned.owner_id x union select m.profile_id from public.task_responsibility_heads h
    join public.task_responsibility_members m on m.set_id=h.set_id where h.instance_id=planned.id
   union select unnest(session_actors)
 ) q;
 select coalesce(jsonb_agg(jsonb_build_object('ownerId',q.profile_id,'period',planned.period)),'[]')
   into month_locks from unnest(profile_locks) q(profile_id);
 perform public._coordination_acquire(actor_locks,profile_locks,month_locks,array[]::text[]);
 perform 1 from public.task_instances i where i.id=planned.id for update;
 perform 1 from public.task_time_sessions s where s.instance_id=planned.id and s.ended_at is null order by s.instance_id,s.actor_id,s.id for update;
 select * into t from public.task_instances where id=planned.id;
 if (t.id,t.organization_id,t.assignment_id,t.company_id,t.owner_id,t.team_id,t.period,t.state_revision,t.status,t.checklist,t.blocked_by)
   is distinct from (planned.id,planned.organization_id,planned.assignment_id,planned.company_id,planned.owner_id,planned.team_id,planned.period,planned.state_revision,planned.status,planned.checklist,planned.blocked_by)
   then raise exception using errcode='40001',message='La tarea cambió; recargue y reintente en otra transacción'; end if;
 select coalesce(array_agg(distinct s.actor_id order by s.actor_id),array[]::uuid[])
  into current_actors from public.task_time_sessions s where s.instance_id=t.id and s.ended_at is null and (stop_all or start_clock);
 if current_actors is distinct from session_actors then raise exception using errcode='40001',message='Cambió el conjunto de cronómetros; reintente'; end if;
 if t.state_revision<>p_expected_revision then raise exception 'La tarea cambió'; end if;
 at_time:=clock_timestamp();
 if not public._can_access_instance_at(t.id,at_time) then raise exception 'Sin permiso'; end if;
 foreach profile_item in array actor_locks loop
   if exists(select 1 from public.monthly_closures c where c.owner_id=profile_item and c.period=t.period) then
     raise exception 'El período afectado está cerrado';
   end if;
 end loop;
 perform public._coordination_assert_month(t.owner_id,t.period);
 if exists(select 1 from public.monthly_closures c join public.task_responsibility_heads h on h.instance_id=t.id
    join public.task_responsibility_members m on m.set_id=h.set_id
    where m.profile_id=c.owner_id and c.period=t.period) then raise exception 'El período de un participante está cerrado'; end if;
 if start_clock then
   select * into open_actor_session from public.task_time_sessions where actor_id=auth.uid() and ended_at is null;
   if open_actor_session.id is not null then raise exception 'Pause su cronómetro actual antes de iniciar'; end if;
   select count(*)::integer into active_count from public.task_time_sessions where instance_id=t.id and ended_at is null;
   if active_count>=2 then raise exception 'La tarea ya tiene dos cronómetros activos'; end if;
 end if;
 if stop_all and exists(select 1 from public.task_time_sessions s where s.instance_id=t.id and s.ended_at is null and s.actor_id<>auth.uid()) then
   supervisor:=public.actor_role() in ('jefe','encargado') and public.can_access_owner(t.owner_id);
   if not supervisor or reason is null then raise exception 'Sólo un superior puede interrumpir al ejecutor compañero con motivo'; end if;
   perform public.require_privileged_session();
 end if;
 if p_kind='checklist' and not changes_check then return t.state_revision; end if;
 if p_kind='transition' and next_status=t.status then return t.state_revision; end if;
 if p_kind='wait' and p_note is null and t.blocked_by is null then return t.state_revision; end if;
 if p_kind='wait' and p_note is not null and t.blocked_by=trim(p_note) and not stop_all then return t.state_revision; end if;
 if stop_all then
   for s in select * from public.task_time_sessions where instance_id=t.id and ended_at is null order by instance_id,actor_id,id loop
     update public.task_time_sessions set ended_at=greatest(s.started_at,public._effective_session_end(s.id,at_time)) where id=s.id;
     insert into public.audit_events(organization_id,actor_id,action,entity_id,at,details)
      values(t.organization_id,auth.uid(),'task.timer_stopped_by_task_change',s.id,at_time,
       jsonb_build_object('instance',t.id,'executor',s.actor_id,'started_at',s.started_at,'ended_at',public._effective_session_end(s.id,at_time),'reason',reason));
   end loop;
 end if;
 if t.status='Completada' and next_status<>'Completada' then
   insert into public.task_reopen_events(organization_id,instance_id,actor_id,at,reason,source)
    values(t.organization_id,t.id,auth.uid(),at_time,reason,'explicit');
 end if;
 if start_clock then
   binding:=null; absence:=null; contribution:='responsible';
   if not exists(select 1 from public.task_responsibility_heads h join public.task_responsibility_members m on m.set_id=h.set_id where h.instance_id=t.id and m.profile_id=auth.uid()) then
     select b.id into binding from public.task_coverage_bindings b
      where b.instance_id=t.id and b.responsible_id=t.owner_id and b.replacement_id=auth.uid() and b.status='active'
       and b.period_snapshot=t.period and b.company_id_snapshot=t.company_id
       and (at_time at time zone 'America/Argentina/Buenos_Aires')::date between b.starts_on and b.ends_on limit 1;
     if binding is not null then contribution:='coverage';
     elsif not public.can_access_owner(t.owner_id) then
      select a.id into absence from public.employee_absences a join public.employee_absence_companies c on c.absence_id=a.id and c.company_id=t.company_id
       where a.owner_id=t.owner_id and a.replacement_id=auth.uid() and a.cancelled_at is null and a.authorization_sealed
        and (at_time at time zone 'America/Argentina/Buenos_Aires')::date between a.starts_on and a.ends_on
        and t.period between date_trunc('month',a.starts_on)::date and date_trunc('month',a.ends_on)::date limit 1;
      if absence is null then raise exception 'Sin cobertura para iniciar'; end if;
      contribution:='coverage';
     end if;
   end if;
 end if;
 if p_kind='wait' then
   update public.task_instances set blocked_by=case when p_note is null then null else trim(p_note) end,
    blocked_since=case when p_note is null then null else (at_time at time zone 'America/Argentina/Buenos_Aires')::date end,
    state_revision=state_revision+1 where id=t.id returning state_revision into result_revision;
 elsif p_kind='checklist' then
   if t.status='Pendiente' and next_status='En curso' and t.blocked_by is not null then raise exception 'La tarea sigue en espera'; end if;
   update public.task_instances set checklist=checklist_next,status=next_status,
    started_at=case when next_status='En curso' then coalesce(started_at,at_time) else started_at end,
    completed_at=case when next_status='Completada' then at_time else null end,
    state_revision=state_revision+1 where id=t.id returning state_revision into result_revision;
 else
   if next_status='En curso' and t.blocked_by is not null then raise exception 'Desbloquee la tarea antes de iniciarla'; end if;
   update public.task_instances set status=next_status,started_at=case when next_status='En curso' then coalesce(started_at,at_time) else started_at end,
    completed_at=case when next_status='Completada' then at_time else null end,state_revision=state_revision+1
    where id=t.id returning state_revision into result_revision;
 end if;
 if start_clock and next_status='En curso' then
   insert into public.task_time_sessions(organization_id,instance_id,actor_id,started_at,absence_id,contribution_kind,coverage_binding_id)
    values(t.organization_id,t.id,auth.uid(),at_time,absence,contribution,binding);
 end if;
 insert into public.audit_events(organization_id,actor_id,action,entity_id,at,details)
 values(t.organization_id,auth.uid(),case p_kind when 'wait' then case when p_note is null then 'task.wait_cleared' else 'task.wait' end
   when 'checklist' then 'task.checklist' else 'task.transition' end,t.id,at_time,
   jsonb_build_object('from',t.status,'to',next_status,'step',p_check,'done',p_done,'note',p_note,'reason',reason,'executor',auth.uid()));
 return result_revision;
end $$;

create or replace function public.transition_task_reviewed(
 p_instance uuid,p_next text,p_reason text,p_expected_revision bigint,p_operation_id uuid
) returns bigint
language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); args jsonb; r public.task_mutation_receipts%rowtype; result bigint;
begin
 args:=jsonb_build_object('instance',p_instance,'next',p_next,'reason',p_reason,'revision',p_expected_revision);
 perform public._coordination_receipt_lock(actor,p_operation_id);
 select * into r from public.task_mutation_receipts where actor_id=actor and operation_id=p_operation_id;
 if found then if r.operation_kind<>'transition_reviewed' or r.arguments<>args then raise exception 'Identificador de operación reutilizado con otros argumentos'; end if; return (r.result->>'revision')::bigint; end if;
 result:=public._coordination_apply_task_control(p_instance,'transition',p_next,null,null,null,p_reason,p_expected_revision);
 insert into public.task_mutation_receipts(organization_id,actor_id,operation_id,operation_kind,arguments,result)
 values(public.actor_org(),actor,p_operation_id,'transition_reviewed',args,jsonb_build_object('revision',result));
 return result;
end $$;
create or replace function public.set_checklist_item_reviewed(
 p_instance uuid,p_check text,p_done boolean,p_reason text,p_expected_revision bigint,p_operation_id uuid
) returns bigint
language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); args jsonb; r public.task_mutation_receipts%rowtype; result bigint;
begin
 args:=jsonb_build_object('instance',p_instance,'check',p_check,'done',p_done,'reason',p_reason,'revision',p_expected_revision);
 perform public._coordination_receipt_lock(actor,p_operation_id);
 select * into r from public.task_mutation_receipts where actor_id=actor and operation_id=p_operation_id;
 if found then if r.operation_kind<>'checklist_reviewed' or r.arguments<>args then raise exception 'Identificador de operación reutilizado con otros argumentos'; end if; return (r.result->>'revision')::bigint; end if;
 result:=public._coordination_apply_task_control(p_instance,'checklist',null,p_check,p_done,null,p_reason,p_expected_revision);
 insert into public.task_mutation_receipts(organization_id,actor_id,operation_id,operation_kind,arguments,result)
 values(public.actor_org(),actor,p_operation_id,'checklist_reviewed',args,jsonb_build_object('revision',result));
 return result;
end $$;
create or replace function public.set_task_wait(
 p_instance uuid,p_note text,p_expected_revision bigint,p_operation_id uuid
) returns bigint
language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); args jsonb; r public.task_mutation_receipts%rowtype; result bigint;
begin
 args:=jsonb_build_object('instance',p_instance,'note',p_note,'revision',p_expected_revision);
 perform public._coordination_receipt_lock(actor,p_operation_id);
 select * into r from public.task_mutation_receipts where actor_id=actor and operation_id=p_operation_id;
 if found then if r.operation_kind<>'task_wait' or r.arguments<>args then raise exception 'Identificador de operación reutilizado con otros argumentos'; end if; return (r.result->>'revision')::bigint; end if;
 result:=public._coordination_apply_task_control(p_instance,'wait',null,null,null,p_note,null,p_expected_revision);
 insert into public.task_mutation_receipts(organization_id,actor_id,operation_id,operation_kind,arguments,result)
 values(public.actor_org(),actor,p_operation_id,'task_wait',args,jsonb_build_object('revision',result));
 return result;
end $$;

create function public._coordination_record_activity(
 p_instance uuid,p_work_date date,p_quantity integer,p_reference text,p_operation uuid,p_operation_kind text
) returns uuid
language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); planned public.task_instances%rowtype; t public.task_instances%rowtype;
 args jsonb; cached public.task_mutation_receipts%rowtype; people uuid[]; months jsonb;
 entry uuid; at_time timestamptz; profile_item uuid;
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
  select planned.owner_id x union select m.profile_id from public.task_responsibility_heads h
   join public.task_responsibility_members m on m.set_id=h.set_id where h.instance_id=planned.id
  union select actor
 ) q;
 select coalesce(jsonb_agg(jsonb_build_object('ownerId',person,'period',planned.period)),'[]')
  into months from unnest(people) person;
 perform public._coordination_acquire(array[]::uuid[],people,months,array[]::text[]);
 perform 1 from public.task_instances i where i.id=planned.id for update;
 select * into t from public.task_instances where id=planned.id;
 if (t.id,t.organization_id,t.assignment_id,t.company_id,t.owner_id,t.period,t.kind,t.state_revision)
  is distinct from (planned.id,planned.organization_id,planned.assignment_id,planned.company_id,planned.owner_id,planned.period,planned.kind,planned.state_revision)
  then raise exception using errcode='40001',message='La tarea cambió; reintente desde otra transacción'; end if;
 at_time:=clock_timestamp();
 if not public._can_access_instance_at(t.id,at_time) or public.actor_role()='auditor' then raise exception 'Sin permiso'; end if;
 if t.kind<>'operativa' or date_trunc('month',p_work_date)::date<>t.period
   or p_work_date>(at_time at time zone 'America/Argentina/Buenos_Aires')::date then raise exception 'Fecha o tipo de tarea inválidos'; end if;
 foreach profile_item in array people loop perform public._coordination_assert_month(profile_item,t.period); end loop;
 if exists(select 1 from public.activity_entries e where e.instance_id=t.id and e.work_date=p_work_date and e.actor_id=actor
   and e.reference=trim(p_reference) and e.quantity=p_quantity) then
  select e.id into entry from public.activity_entries e where e.instance_id=t.id and e.work_date=p_work_date
    and e.actor_id=actor and e.reference=trim(p_reference) and e.quantity=p_quantity order by e.created_at,e.id limit 1;
 else
  insert into public.activity_entries(organization_id,instance_id,work_date,quantity,reference,actor_id)
   values(t.organization_id,t.id,p_work_date,p_quantity,trim(p_reference),actor) returning id into entry;
  update public.task_instances set state_revision=state_revision+1 where id=t.id;
  insert into public.audit_events(organization_id,actor_id,action,entity_id,at,details)
   values(t.organization_id,actor,'activity.created',entry,at_time,jsonb_build_object('instance',t.id,'work_date',p_work_date,'quantity',p_quantity));
 end if;
 insert into public.task_mutation_receipts(organization_id,actor_id,operation_id,operation_kind,arguments,result)
 values(t.organization_id,actor,p_operation,p_operation_kind,args,
   case when p_operation_kind='record_activity' then jsonb_build_object('entry_id',entry) else jsonb_build_object('id',entry) end);
 return entry;
end $$;
create or replace function public.record_activity_once(
 p_instance uuid,p_work_date date,p_quantity integer,p_reference text,p_operation_id uuid
) returns uuid
language plpgsql security definer set search_path='' as $$
begin
 return public._coordination_record_activity(p_instance,p_work_date,p_quantity,p_reference,p_operation_id,'record_activity');
end $$;
create or replace function public.record_activity(
 p_instance_id uuid,work_day date,qty integer,note text
) returns uuid
language plpgsql security definer set search_path='' as $$
begin
 return public._coordination_record_activity(p_instance_id,work_day,qty,note,gen_random_uuid(),'activity_legacy');
end $$;

create or replace function public.save_private_block_note(
 p_instance uuid,p_body text,p_expected_revision bigint,p_operation_id uuid
) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); org uuid; actor_role_value text; normalized text; args jsonb;
 cached public.private_block_note_receipts%rowtype; planned public.task_instances%rowtype;
 t public.task_instances%rowtype; n public.task_private_block_notes%rowtype; people uuid[]; months jsonb;
 at_time timestamptz; result jsonb; action_name text;
 profile_item uuid;
begin
 org:=public.actor_org(); actor_role_value:=public.actor_role();
 if actor is null or org is null or actor_role_value not in ('empleado','encargado','jefe') then raise exception 'Sin permiso'; end if;
 if p_instance is null or p_operation_id is null or p_expected_revision is null or p_expected_revision<0 then raise exception 'Identidad, operación y revisión requeridas'; end if;
 normalized:=public._normalize_private_block_note_body(p_body);
 if p_body is not null and (length(normalized)=0 or length(normalized)>2000) then raise exception 'El comentario debe tener entre 1 y 2000 caracteres'; end if;
 args:=jsonb_build_object('instance',p_instance,'body',p_body,'revision',p_expected_revision);
 perform public._coordination_receipt_lock(actor,p_operation_id);
 if public.actor_org() is distinct from org or public.actor_role() not in ('empleado','encargado','jefe') then raise exception 'Sin permiso'; end if;
 select * into cached from public.private_block_note_receipts where actor_id=actor and operation_id=p_operation_id;
 if found then
   if cached.organization_id is distinct from org or cached.arguments<>args then raise exception 'La operación ya fue usada con otros argumentos'; end if;
   return cached.result;
 end if;
 select * into planned from public.task_instances where id=p_instance and organization_id=org;
 if not found then raise exception 'Sin permiso'; end if;
 select coalesce(array_agg(distinct x),array[]::uuid[]) into people from (
  select planned.owner_id x union select m.profile_id from public.task_responsibility_heads h
   join public.task_responsibility_members m on m.set_id=h.set_id where h.instance_id=planned.id
 ) q;
 select coalesce(jsonb_agg(jsonb_build_object('ownerId',person,'period',planned.period)),'[]')
  into months from unnest(people) person;
 perform public._coordination_acquire(array[]::uuid[],people,months,array[]::text[]);
 perform 1 from public.task_instances i where i.id=planned.id for update;
 select * into t from public.task_instances where id=p_instance and organization_id=org;
 if not found or (t.id,t.organization_id,t.assignment_id,t.company_id,t.owner_id,t.period,t.state_revision)
  is distinct from (planned.id,planned.organization_id,planned.assignment_id,planned.company_id,planned.owner_id,planned.period,planned.state_revision)
  then raise exception using errcode='40001',message='La tarea cambió; reintente en otra transacción'; end if;
 at_time:=clock_timestamp();
 if public.actor_org() is distinct from org or not public._can_access_instance_at(t.id,at_time)
   or public.actor_role() not in ('empleado','encargado','jefe') then raise exception 'Sin permiso'; end if;
 foreach profile_item in array people loop perform public._coordination_assert_month(profile_item,t.period); end loop;
 select * into n from public.task_private_block_notes where instance_id=t.id and author_id=actor for update;
 if not found then
  if p_expected_revision<>0 or p_body is null then raise exception 'La revisión del comentario cambió'; end if;
  insert into public.task_private_block_notes(organization_id,instance_id,author_id,body,revision,created_at,updated_at)
   values(t.organization_id,t.id,actor,normalized,1,at_time,at_time) returning * into n;
  action_name:='private_block_note.created';
  insert into public.task_private_block_note_versions(note_id,organization_id,revision,body,cleared_at,at,actor_id)
   values(n.id,n.organization_id,n.revision,n.body,null,at_time,actor);
 else
  if n.revision<>p_expected_revision then raise exception 'La revisión del comentario cambió'; end if;
  normalized:=coalesce(normalized,'');
  if n.body=normalized and ((p_body is null)=(n.cleared_at is not null)) then
   result:=jsonb_build_object('note_id',n.id,'revision',n.revision,'cleared',n.cleared_at is not null);
   insert into public.private_block_note_receipts(organization_id,actor_id,operation_id,arguments,result)
    values(org,actor,p_operation_id,args,result);
   return result;
  end if;
  if n.revision>=9007199254740991 then raise exception 'Se alcanzó el límite de revisiones'; end if;
  update public.task_private_block_notes set body=normalized,revision=n.revision+1,updated_at=at_time,
   cleared_at=case when p_body is null then at_time else null end where id=n.id returning * into n;
  action_name:=case when p_body is null then 'private_block_note.cleared' else 'private_block_note.updated' end;
  insert into public.task_private_block_note_versions(note_id,organization_id,revision,body,cleared_at,at,actor_id)
   values(n.id,n.organization_id,n.revision,n.body,n.cleared_at,at_time,actor);
 end if;
 result:=jsonb_build_object('note_id',n.id,'revision',n.revision,'cleared',n.cleared_at is not null);
 insert into public.audit_events(organization_id,actor_id,action,entity_id,at,details)
  values(org,actor,action_name,n.id,at_time,'{}'::jsonb);
 insert into public.private_block_note_receipts(organization_id,actor_id,operation_id,arguments,result)
  values(org,actor,p_operation_id,args,result);
 return result;
end $$;

create function public._coordination_can_assign(p_instance uuid,p_members jsonb) returns void
language plpgsql security definer set search_path='' as $$
declare t public.task_instances%rowtype; member jsonb; n integer; total integer; op uuid;
begin
 select * into t from public.task_instances where id=p_instance;
 if not found then raise exception 'Tarea inexistente'; end if;
 if public.actor_org() is distinct from t.organization_id or public.actor_role() not in ('jefe','encargado') then raise exception 'Sin permiso'; end if;
 perform public.require_privileged_session();
 if public.actor_role()='encargado' and not public.can_access_owner(t.owner_id) then raise exception 'Fuera del equipo asignado'; end if;
 if not exists(select 1 from public.task_assignments a where a.id=t.assignment_id and a.frequency='unica') then raise exception 'La tarea conjunta debe ser puntual'; end if;
 if jsonb_typeof(p_members)<>'array' or jsonb_array_length(p_members)<>2 then raise exception 'Se requieren exactamente dos participantes'; end if;
 if exists(select 1 from jsonb_array_elements(p_members) x where jsonb_typeof(x)<>'object'
   or (select count(*) from jsonb_object_keys(x))<>2
   or nullif(x->>'profileId','') is null or nullif(x->>'shareBps','') is null) then raise exception 'Formato de participantes inválido'; end if;
 if exists(select 1 from jsonb_array_elements(p_members) x where (x->>'profileId')::uuid is null or (x->>'shareBps')::integer not between 1 and 9999) then raise exception 'Cuotas inválidas'; end if;
 select count(distinct (x->>'profileId')::uuid),sum((x->>'shareBps')::integer)::int into n,total from jsonb_array_elements(p_members) x;
 if n<>2 or total<>10000 or not exists(select 1 from jsonb_array_elements(p_members) x where (x->>'profileId')::uuid=t.owner_id)
   then raise exception 'Debe conservar al titular y distribuir 10000 puntos'; end if;
 for member in select value from jsonb_array_elements(p_members) loop
  if not exists(select 1 from public.profiles p where p.id=(member->>'profileId')::uuid and p.organization_id=t.organization_id and p.active and p.role in ('empleado','encargado')
    and exists(select 1 from public.company_memberships cm where cm.profile_id=p.id and cm.company_id=t.company_id and cm.organization_id=t.organization_id))
    then raise exception 'Participante inactivo o fuera de la empresa'; end if;
  if public.actor_role()='encargado' and not public.can_access_owner((member->>'profileId')::uuid) then raise exception 'Fuera del ámbito del encargado'; end if;
 end loop;
 if t.kind='operativa' or t.status<>'Pendiente' or t.state_revision<0 or t.blocked_by is not null
   or exists(select 1 from public.activity_entries e where e.instance_id=t.id)
   or exists(select 1 from public.task_time_sessions s where s.instance_id=t.id)
   then raise exception 'La asignación conjunta debe preceder a toda evidencia operativa'; end if;
end $$;

create function public.assign_task_responsibility(
 p_instance uuid,p_members jsonb,p_reason text,p_expected_revision bigint,p_idempotency_key uuid
) returns bigint
language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); org uuid; t public.task_instances%rowtype; planned public.task_instances%rowtype;
 headrow public.task_responsibility_heads%rowtype; oldset public.task_responsibility_sets%rowtype;
 setid uuid; cached public.task_mutation_receipts%rowtype; args jsonb; result bigint; now_at timestamptz;
 member jsonb; month_keys jsonb; profiles uuid[];
begin
 if actor is null or p_instance is null or p_expected_revision is null or p_idempotency_key is null or public._coordination_text_present(p_reason) is not true then raise exception 'Identidad, revisión y motivo requeridos'; end if;
 perform public._coordination_receipt_lock(actor,p_idempotency_key);
 args:=jsonb_build_object('instance',p_instance,'members',p_members,'reason',p_reason,'revision',p_expected_revision);
 select * into cached from public.task_mutation_receipts where actor_id=actor and operation_id=p_idempotency_key;
 if found then
   if cached.operation_kind<>'assign_responsibility' or cached.arguments<>args then raise exception 'Identificador de operación reutilizado con otros argumentos'; end if;
   return (cached.result->>'revision')::bigint;
 end if;
 select * into planned from public.task_instances where id=p_instance;
 if not found then raise exception 'Tarea inexistente'; end if;
 select coalesce(array_agg(distinct (x->>'profileId')::uuid),array[]::uuid[]) into profiles from jsonb_array_elements(p_members) x;
 profiles:=array_append(profiles,planned.owner_id);
 select coalesce(jsonb_agg(jsonb_build_object('ownerId',x,'period',planned.period)),'[]'::jsonb)
   into month_keys from (select distinct unnest(profiles) x) q;
 perform public._coordination_acquire(array[actor],profiles,month_keys,array[]::text[]);
 perform 1 from public.task_instances where id=p_instance for update;
 perform 1 from public.task_responsibility_heads h where h.instance_id=p_instance for update;
 select * into t from public.task_instances where id=p_instance for update;
 if (t.id,t.organization_id,t.assignment_id,t.company_id,t.owner_id,t.team_id,t.period,t.state_revision)
   is distinct from (planned.id,planned.organization_id,planned.assignment_id,planned.company_id,planned.owner_id,planned.team_id,planned.period,planned.state_revision)
   then raise exception using errcode='40001',message='La ocurrencia cambió; reintente desde una transacción nueva'; end if;
 perform public._coordination_can_assign(t.id,p_members);
 perform public._coordination_assert_month(t.owner_id,t.period);
 select h.* into headrow from public.task_responsibility_heads h where h.instance_id=t.id and h.organization_id=t.organization_id;
 if not found then raise exception 'No existe cabecera de responsabilidad'; end if;
 select s.* into oldset from public.task_responsibility_sets s where s.id=headrow.set_id and s.sealed;
 if not found or oldset.origin<>'baseline_legacy' or oldset.revision<>1 then raise exception 'Sólo se activa la responsabilidad inicial una vez'; end if;
 if oldset.revision<>p_expected_revision then raise exception 'La revisión de responsabilidad cambió'; end if;
 now_at:=clock_timestamp();
 if not public._can_access_instance_at(t.id,now_at) then raise exception 'Sin permiso'; end if;
 insert into public.task_responsibility_sets(organization_id,instance_id,revision,mode,origin,anchor_owner_id,
  company_id_snapshot,period_snapshot,team_id_snapshot,sector_snapshot,sector_source,captured_by,reason)
 values(t.organization_id,t.id,oldset.revision+1,'conjunta','explicit',t.owner_id,t.company_id,t.period,t.team_id,
  oldset.sector_snapshot,oldset.sector_source,actor,trim(p_reason)) returning id into setid;
 for member in select value from jsonb_array_elements(p_members) loop
  insert into public.task_responsibility_members(set_id,organization_id,profile_id,share_bps)
  values(setid,t.organization_id,(member->>'profileId')::uuid,(member->>'shareBps')::smallint);
 end loop;
 update public.task_responsibility_sets set sealed=true where id=setid;
 update public.task_responsibility_heads set set_id=setid where instance_id=t.id;
 update public.task_instances set state_revision=state_revision+1 where id=t.id;
 result:=oldset.revision+1;
 insert into public.audit_events(organization_id,actor_id,action,entity_id,at,details)
 values(t.organization_id,actor,'task.responsibility_assigned',t.id,now_at,jsonb_build_object('set_id',setid,'revision',oldset.revision+1,'reason',trim(p_reason)));
 insert into public.task_mutation_receipts(organization_id,actor_id,operation_id,operation_kind,arguments,result)
 values(t.organization_id,actor,p_idempotency_key,'assign_responsibility',args,jsonb_build_object('revision',result));
 return result;
end $$;

create function public.approve_task_coverage_plan(p_plan uuid,p_operation_id uuid) returns integer
language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); p public.task_coverage_plans%rowtype; cached public.task_mutation_receipts%rowtype;
 args jsonb; n integer:=0; x record; t public.task_instances%rowtype; a public.task_assignments%rowtype; org uuid; months jsonb; people uuid[]; catalog_keys text[];
 planned public.task_coverage_plans%rowtype;
begin
 if actor is null or p_operation_id is null then raise exception 'Identidad y operación requeridas'; end if;
 perform public._coordination_receipt_lock(actor,p_operation_id);
 args:=jsonb_build_object('plan',p_plan);
 select * into cached from public.task_mutation_receipts where actor_id=actor and operation_id=p_operation_id;
 if found then if cached.operation_kind<>'approve_task_coverage' or cached.arguments<>args then raise exception 'Identificador de operación reutilizado con otros argumentos'; end if; return (cached.result->>'count')::integer; end if;
 perform public.require_privileged_session();
 select * into p from public.task_coverage_plans where id=p_plan;
 if not found or not p.sealed then raise exception 'Plan de cobertura sellado requerido'; end if;
 planned:=p;
 if public.actor_org() is distinct from p.organization_id or public.actor_role() not in ('jefe','encargado') then raise exception 'Sin permiso'; end if;
 if public.actor_role()='encargado' and (not public.can_access_owner(p.responsible_id) or not public.can_access_owner(p.replacement_id)) then raise exception 'Fuera del ámbito del encargado'; end if;
 select coalesce(array_agg(distinct z),array[]::uuid[]) into people from (
  select p.responsible_id z union select p.replacement_id
  union select task_row.owner_id from public.task_coverage_plan_instances i join public.task_instances task_row on task_row.id=i.instance_id where i.plan_id=p.id
  union select m.profile_id from public.task_coverage_plan_instances i join public.task_responsibility_heads h on h.instance_id=i.instance_id join public.task_responsibility_members m on m.set_id=h.set_id where i.plan_id=p.id
  union select p.responsible_id from public.task_coverage_plan_assignment_rules r where r.plan_id=p.id
  union select p.replacement_id from public.task_coverage_plan_assignment_rules r where r.plan_id=p.id
 ) q;
 select coalesce(jsonb_agg(jsonb_build_object('ownerId',z.profile_id,'period',z.period)),'[]') into months from (
  select distinct person.profile_id,task.period
  from public.task_coverage_plan_instances i join public.task_instances task on task.id=i.instance_id
  cross join lateral (
    select task.owner_id profile_id union
    select m.profile_id from public.task_responsibility_heads h
      join public.task_responsibility_members m on m.set_id=h.set_id where h.instance_id=task.id
    union select p.responsible_id union select p.replacement_id
  ) person
  where i.plan_id=p.id
  union
  select p.responsible_id,month_start::date from generate_series(date_trunc('month',p.starts_on)::date::timestamp,date_trunc('month',p.ends_on)::date::timestamp,interval '1 month') month_start
  where exists(select 1 from public.task_coverage_plan_assignment_rules r where r.plan_id=p.id)
  union
  select p.replacement_id,month_start::date from generate_series(date_trunc('month',p.starts_on)::date::timestamp,date_trunc('month',p.ends_on)::date::timestamp,interval '1 month') month_start
  where exists(select 1 from public.task_coverage_plan_assignment_rules r where r.plan_id=p.id)
 ) z;
 select coalesce(array_agg(distinct 'template:'||ta.template_id::text),'{}') into catalog_keys
   from public.task_coverage_plan_assignment_rules r join public.task_assignments ta on ta.id=r.assignment_id where r.plan_id=p.id;
 perform public._coordination_acquire(array[actor],people,months,catalog_keys);
 -- Lock catalog rows before the plan/task rows, following the shared SQL row order.
 perform 1 from public.task_templates tt join public.task_assignments ta on ta.template_id=tt.id
   join public.task_coverage_plan_assignment_rules r on r.assignment_id=ta.id
   where r.plan_id=p.id order by tt.id for update of tt;
 perform 1 from public.task_assignments ta join public.task_coverage_plan_assignment_rules r on r.assignment_id=ta.id
   where r.plan_id=p.id order by ta.id for update of ta;
 select * into p from public.task_coverage_plans where id=p_plan for update;
 if not found or to_jsonb(p) is distinct from to_jsonb(planned)
   then raise exception using errcode='40001',message='El plan cambió; reintente'; end if;
 if not exists(select 1 from public.profiles replacement_profile join public.profiles owner_profile on owner_profile.id=p.responsible_id and owner_profile.organization_id=p.organization_id
    where replacement_profile.id=p.replacement_id and replacement_profile.organization_id=p.organization_id and replacement_profile.active and replacement_profile.role in ('empleado','encargado') and owner_profile.active)
    then raise exception 'Titular o reemplazo inactivo'; end if;
 for x in select i.instance_id,i.company_id_snapshot,i.period_snapshot,i.responsibility_set_id from public.task_coverage_plan_instances i where i.plan_id=p.id order by i.instance_id loop
  select * into t from public.task_instances where id=x.instance_id for update;
  if not found or t.owner_id<>p.responsible_id or t.organization_id<>p.organization_id
    or t.company_id<>x.company_id_snapshot or t.period<>x.period_snapshot then raise exception 'Selección de ocurrencia cambió'; end if;
  if (x.responsibility_set_id is not null and not exists(select 1 from public.task_responsibility_heads h where h.instance_id=t.id and h.set_id=x.responsibility_set_id))
    or (x.responsibility_set_id is null and exists(select 1 from public.task_responsibility_heads h join public.task_responsibility_sets rs on rs.id=h.set_id
      where h.instance_id=t.id and (rs.mode<>'individual' or not exists(select 1 from public.task_responsibility_members rm where rm.set_id=rs.id and rm.profile_id=t.owner_id)))) then
    raise exception 'La responsabilidad de la selección cambió';
  end if;
  if not exists(select 1 from public.company_memberships m where m.profile_id=p.replacement_id and m.company_id=t.company_id and m.organization_id=t.organization_id)
    then raise exception 'El reemplazo no pertenece a la empresa de la tarea'; end if;
  if not public.can_access_owner(t.owner_id) and public.actor_role()<>'jefe' then raise exception 'Fuera del equipo asignado'; end if;
  perform public._coordination_assert_month(t.owner_id,t.period);
  if exists(select 1 from public.task_responsibility_heads h join public.task_responsibility_members m on m.set_id=h.set_id where h.instance_id=t.id and m.profile_id=p.replacement_id)
    then raise exception 'Un miembro responsable no se duplica como cobertura'; end if;
  insert into public.task_coverage_bindings(organization_id,plan_id,instance_id,responsible_id,replacement_id,starts_on,ends_on,
    company_id_snapshot,period_snapshot,scheduled_on_snapshot,approved_by)
  values(p.organization_id,p.id,t.id,p.responsible_id,p.replacement_id,p.starts_on,p.ends_on,t.company_id,t.period,t.scheduled_on,actor);
  n:=n+1;
 end loop;
 -- Freeze each approved recurring assignment as an explicit rule binding.
 -- Existing occurrences are bound only when canonical scheduled_on is inside
 -- the replacement interval; later occurrences are bound by materialize_month.
 for x in select r.assignment_id,r.company_id_snapshot,r.assignment_snapshot
   from public.task_coverage_plan_assignment_rules r where r.plan_id=p.id order by r.assignment_id loop
  select * into a from public.task_assignments where id=x.assignment_id for update;
  if not found or a.organization_id<>p.organization_id or a.owner_id<>p.responsible_id
    or a.company_id<>x.company_id_snapshot or to_jsonb(a) is distinct from x.assignment_snapshot then
    raise exception 'La regla o su snapshot cambió';
  end if;
  if not exists(select 1 from public.company_memberships m where m.profile_id=p.replacement_id and m.company_id=a.company_id and m.organization_id=a.organization_id)
    then raise exception 'El reemplazo no pertenece a la empresa de la regla'; end if;
  if not public.can_access_owner(a.owner_id) and public.actor_role()<>'jefe' then raise exception 'Fuera del equipo asignado'; end if;
  if exists(select 1 from public.task_coverage_bindings b where b.assignment_id=a.id and b.replacement_id=p.replacement_id
    and b.status='active' and b.starts_on<=p.ends_on and b.ends_on>=p.starts_on) then
    raise exception 'Ya existe cobertura activa solapada para esta regla';
  end if;
  perform public._coordination_assert_month(a.owner_id,date_trunc('month',p.starts_on)::date);
  insert into public.task_coverage_bindings(organization_id,plan_id,assignment_id,responsible_id,replacement_id,starts_on,ends_on,
    company_id_snapshot,assignment_snapshot,approved_by)
  values(p.organization_id,p.id,a.id,p.responsible_id,p.replacement_id,p.starts_on,p.ends_on,a.company_id,to_jsonb(a),actor);
  n:=n+1;
  for t in select * from public.task_instances ti where ti.assignment_id=a.id and ti.organization_id=a.organization_id
      and ti.scheduled_on between p.starts_on and p.ends_on order by ti.id for update loop
    if not exists(select 1 from public.company_memberships m where m.profile_id=p.replacement_id and m.company_id=t.company_id and m.organization_id=t.organization_id)
      then raise exception 'El reemplazo no pertenece a la empresa de una ocurrencia'; end if;
    if exists(select 1 from public.task_responsibility_heads h join public.task_responsibility_members m on m.set_id=h.set_id
      where h.instance_id=t.id and m.profile_id=p.replacement_id) then raise exception 'Un miembro responsable no se duplica como cobertura'; end if;
    perform public._coordination_assert_month(t.owner_id,t.period);
    insert into public.task_coverage_bindings(organization_id,plan_id,instance_id,responsible_id,replacement_id,starts_on,ends_on,
      company_id_snapshot,period_snapshot,scheduled_on_snapshot,approved_by)
    values(p.organization_id,p.id,t.id,p.responsible_id,p.replacement_id,p.starts_on,p.ends_on,t.company_id,t.period,t.scheduled_on,actor);
    n:=n+1;
  end loop;
 end loop;
 if n=0 then raise exception 'El plan no contiene ocurrencias seleccionadas'; end if;
 insert into public.audit_events(organization_id,actor_id,action,entity_id,at,details)
 values(p.organization_id,actor,'task.coverage_approved',p.id,clock_timestamp(),jsonb_build_object('bindings',n));
 insert into public.task_mutation_receipts(organization_id,actor_id,operation_id,operation_kind,arguments,result)
 values(p.organization_id,actor,p_operation_id,'approve_task_coverage',args,jsonb_build_object('count',n));
 return n;
end $$;

create function public.cancel_task_coverage_binding(p_binding uuid,p_reason text,p_operation_id uuid) returns void
language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); b public.task_coverage_bindings%rowtype; t public.task_instances%rowtype;
 args jsonb; cached public.task_mutation_receipts%rowtype; ended timestamptz; s public.task_time_sessions%rowtype;
begin
 if actor is null or p_operation_id is null or public._coordination_text_present(p_reason) is not true then raise exception 'Identidad, operación y motivo requeridos'; end if;
 perform public._coordination_receipt_lock(actor,p_operation_id);
 args:=jsonb_build_object('binding',p_binding,'reason',p_reason);
 select * into cached from public.task_mutation_receipts where actor_id=actor and operation_id=p_operation_id;
 if found then if cached.operation_kind<>'cancel_task_coverage' or cached.arguments<>args then raise exception 'Identificador de operación reutilizado con otros argumentos'; end if; return; end if;
 select * into b from public.task_coverage_bindings where id=p_binding;
 if not found then raise exception 'Cobertura inexistente'; end if;
 select * into t from public.task_instances where id=b.instance_id;
 perform public.require_privileged_session();
 if public.actor_org() is distinct from b.organization_id or public.actor_role() not in ('jefe','encargado')
   or (public.actor_role()='encargado' and (not public.can_access_owner(b.responsible_id) or not public.can_access_owner(b.replacement_id)))
   then raise exception 'Fuera del ámbito'; end if;
 perform public._coordination_acquire(array[actor,b.replacement_id],array[b.responsible_id,b.replacement_id],jsonb_build_array(jsonb_build_object('ownerId',b.responsible_id,'period',t.period)),array[]::text[]);
 select * into t from public.task_instances where id=b.instance_id for update;
 select * into b from public.task_coverage_bindings where id=p_binding for update;
 if b.status<>'active' then raise exception 'La cobertura ya no está activa'; end if;
 select * into s from public.task_time_sessions where coverage_binding_id=b.id and ended_at is null and actor_id=b.replacement_id for update;
 if s.id is not null then
   perform public._coordination_assert_month(t.owner_id,t.period);
   ended:=least(clock_timestamp(),(b.ends_on+1)::timestamp at time zone 'America/Argentina/Buenos_Aires');
   update public.task_time_sessions set ended_at=greatest(s.started_at,ended) where id=s.id;
   update public.task_instances set state_revision=state_revision+1 where id=t.id;
 end if;
 update public.task_coverage_bindings set status='cancelled',cancelled_by=actor,cancelled_at=clock_timestamp(),cancel_reason=trim(p_reason) where id=b.id;
 insert into public.audit_events(organization_id,actor_id,action,entity_id,at,details)
 values(b.organization_id,actor,'task.coverage_cancelled',b.id,clock_timestamp(),jsonb_build_object('reason',trim(p_reason),'session_ended',s.id));
 insert into public.task_mutation_receipts(organization_id,actor_id,operation_id,operation_kind,arguments,result)
 values(b.organization_id,actor,p_operation_id,'cancel_task_coverage',args,'{}'::jsonb);
end $$;

create function public._coordinated_task_payload(p_instance uuid) returns jsonb
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
    where a.owner_id=t.owner_id and a.replacement_id=auth.uid() and a.cancelled_at is null and a.authorization_sealed
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
   'myContribution',(select jsonb_build_object('kind',case when c.id is null then 'responsible' else 'coverage' end,
      'shareBps',coalesce(m.share_bps,0)) from (select 1) q
      left join public.task_responsibility_heads h on h.instance_id=t.id
      left join public.task_responsibility_members m on m.set_id=h.set_id and m.profile_id=auth.uid()
      left join lateral (select b.id from public.task_coverage_bindings b where b.instance_id=t.id and b.replacement_id=auth.uid()
        and b.status='active' and work_day between b.starts_on and b.ends_on limit 1) c on true),
   'coverage',coverage,'dueState',due_state) into payload;
 return payload;
end $$;

create function public.read_coordinated_task(p_instance uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
 if auth.uid() is null or not public._can_access_instance_at(p_instance,clock_timestamp()) then raise exception 'Sin permiso'; end if;
 return public._coordinated_task_payload(p_instance);
end $$;
create function public.read_coordinated_task_for_manager(p_instance uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare t public.task_instances%rowtype;
begin
 if auth.uid() is null or public.actor_role() not in ('jefe','encargado') then raise exception 'Sin permiso'; end if;
 select * into t from public.task_instances where id=p_instance;
 if not found or not public.can_access_owner(t.owner_id) or
   (public.actor_role()<>'jefe' and not exists(select 1 from public.company_memberships m
     where m.profile_id=auth.uid() and m.company_id=t.company_id and m.organization_id=t.organization_id)) then raise exception 'Fuera del ámbito'; end if;
 return public._coordinated_task_payload(p_instance);
end $$;

-- Coordinated month materialization. Assignment and approved-rule snapshots
-- are the optimistic footprint; rows are locked and fingerprints revalidated
-- before writing occurrences or explicit occurrence bindings.
create or replace function public.materialize_month(p_owner uuid,p_period date) returns integer
language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); op uuid:=gen_random_uuid(); org uuid:=public.actor_org();
 people uuid[]; months jsonb; catalog_keys text[]; planned_assignments jsonb; current_assignments jsonb;
 planned_bindings jsonb; current_bindings jsonb; inserted integer:=0; inserted_now integer:=0; bound integer:=0; bound_now integer:=0;
 assignment_row public.task_assignments%rowtype; task_row public.task_instances%rowtype; day_row date;
begin
 if actor is null or org is null or not public.can_access_owner(p_owner) or public.actor_role()='auditor' then raise exception 'Sin permiso'; end if;
 if p_period is null or extract(day from p_period)<>1 then raise exception 'Período inválido'; end if;
 perform public._coordination_receipt_lock(actor,op);
 select coalesce(array_agg(distinct b.replacement_id order by b.replacement_id),array[]::uuid[]) into people
  from public.task_coverage_bindings b where b.responsible_id=p_owner and b.organization_id=org and b.assignment_id is not null
    and b.status='active' and b.starts_on<=(p_period+interval '1 month - 1 day')::date and b.ends_on>=p_period;
 people:=array(select distinct x from unnest(people||array[p_owner]) x order by x);
 select coalesce(jsonb_agg(jsonb_build_object('ownerId',x,'period',p_period) order by x),'[]'::jsonb) into months from unnest(people) x;
 select coalesce(array_agg(distinct 'template:'||a.template_id::text order by 'template:'||a.template_id::text),'{}') into catalog_keys
  from public.task_assignments a where a.owner_id=p_owner and a.organization_id=org and a.start_date<=(p_period+interval '1 month - 1 day')::date
    and (a.end_date is null or a.end_date>=p_period);
 select coalesce(jsonb_agg(to_jsonb(a) order by a.id),'[]'::jsonb) into planned_assignments
  from public.task_assignments a where a.owner_id=p_owner and a.organization_id=org and a.start_date<=(p_period+interval '1 month - 1 day')::date
    and (a.end_date is null or a.end_date>=p_period);
 select coalesce(jsonb_agg(jsonb_build_object('id',b.id,'responsible',b.responsible_id,'replacement',b.replacement_id,
   'starts',b.starts_on,'ends',b.ends_on,'assignment',b.assignment_snapshot) order by b.id),'[]'::jsonb) into planned_bindings
  from public.task_coverage_bindings b where b.responsible_id=p_owner and b.organization_id=org and b.assignment_id is not null
    and b.status='active' and b.starts_on<=(p_period+interval '1 month - 1 day')::date and b.ends_on>=p_period;
 perform public._coordination_acquire(array[actor],people,months,catalog_keys);
 perform 1 from public.task_templates tt join public.task_assignments ta on ta.template_id=tt.id
   where ta.owner_id=p_owner and ta.organization_id=org and ta.start_date<=(p_period+interval '1 month - 1 day')::date
     and (ta.end_date is null or ta.end_date>=p_period) order by tt.id for update of tt;
 perform 1 from public.task_assignments a where a.owner_id=p_owner and a.organization_id=org
   and a.start_date<=(p_period+interval '1 month - 1 day')::date and (a.end_date is null or a.end_date>=p_period)
   order by a.id for update of a;
 select coalesce(jsonb_agg(to_jsonb(a) order by a.id),'[]'::jsonb) into current_assignments
  from public.task_assignments a where a.owner_id=p_owner and a.organization_id=org and a.start_date<=(p_period+interval '1 month - 1 day')::date
    and (a.end_date is null or a.end_date>=p_period);
 select coalesce(jsonb_agg(jsonb_build_object('id',b.id,'responsible',b.responsible_id,'replacement',b.replacement_id,
   'starts',b.starts_on,'ends',b.ends_on,'assignment',b.assignment_snapshot) order by b.id),'[]'::jsonb) into current_bindings
  from public.task_coverage_bindings b where b.responsible_id=p_owner and b.organization_id=org and b.assignment_id is not null
    and b.status='active' and b.starts_on<=(p_period+interval '1 month - 1 day')::date and b.ends_on>=p_period;
 if planned_assignments is distinct from current_assignments or planned_bindings is distinct from current_bindings then
   raise exception using errcode='40001',message='Cambió el catálogo o la cobertura; reintente'; end if;
 if public.actor_org() is distinct from org or not public.can_access_owner(p_owner) then raise exception 'Permiso modificado durante la materialización'; end if;
 perform public._coordination_assert_month(p_owner,p_period);
 for day_row in select g::date from generate_series(p_period::timestamp,(p_period+interval '1 month - 1 day')::timestamp,interval '1 day') g loop
  for assignment_row in select * from public.task_assignments a where a.owner_id=p_owner and a.organization_id=org
    and a.start_date<=day_row and (a.end_date is null or a.end_date>=day_row)
    and (a.frequency<>'unica' or day_row=a.start_date)
    and (a.frequency<>'mensual' or ((((extract(year from day_row)::integer*12+extract(month from day_row)::integer)-(extract(year from a.start_date)::integer*12+extract(month from a.start_date)::integer)) % a.interval_count=0) and extract(day from day_row)::integer=least(a.month_day,extract(day from (date_trunc('month',day_row)+interval '1 month - 1 day'))::integer)))
    and (a.frequency<>'diaria' or mod(day_row-a.start_date,a.interval_count)=0)
    and (a.frequency<>'semanal' or ((extract(dow from day_row)::integer=any(a.weekdays)) and (((day_row-(a.start_date-((extract(isodow from a.start_date)::integer-1))::integer))/7) % a.interval_count=0)))
    and (public.actor_role()='jefe' or exists(select 1 from public.company_memberships cm where cm.profile_id=actor and cm.company_id=a.company_id and cm.organization_id=org))
    order by a.id loop
    perform public._coordination_assert_month(p_owner,p_period);
    insert into public.task_instances(organization_id,assignment_id,template_version_id,company_id,owner_id,team_id,period,scheduled_on,title,kind,weight,unit,target,due_date,checklist)
    values(assignment_row.organization_id,assignment_row.id,assignment_row.template_version_id,assignment_row.company_id,assignment_row.owner_id,assignment_row.team_id,p_period,day_row,assignment_row.title,assignment_row.kind,assignment_row.weight,assignment_row.unit,assignment_row.target,
      case when assignment_row.has_deadline then day_row+assignment_row.due_offset_days else null end,
      coalesce((select jsonb_agg(jsonb_build_object('id',gen_random_uuid(),'text',case when jsonb_typeof(x)='string' then x#>>'{}' else x->>'text' end,'done',false) order by pos) from jsonb_array_elements(assignment_row.checklist) with ordinality items(x,pos)),'[]'::jsonb))
    on conflict(assignment_id,scheduled_on) do nothing;
    get diagnostics inserted_now=row_count; inserted:=inserted+inserted_now;
  end loop;
 end loop;
 for task_row in select ti.* from public.task_instances ti join public.task_coverage_bindings b
   on b.assignment_id=ti.assignment_id and b.organization_id=ti.organization_id and b.responsible_id=ti.owner_id
   and b.status='active' and ti.scheduled_on between b.starts_on and b.ends_on
   join public.task_assignments ta on ta.id=ti.assignment_id and ta.organization_id=ti.organization_id
   where ti.owner_id=p_owner and ti.period=p_period and ti.organization_id=org and b.assignment_snapshot=to_jsonb(ta)
   order by ti.id loop
  perform public._coordination_assert_month(task_row.owner_id,task_row.period);
  if exists(select 1 from public.task_responsibility_heads h join public.task_responsibility_members m on m.set_id=h.set_id
    where h.instance_id=task_row.id and m.profile_id in (select cb.replacement_id from public.task_coverage_bindings cb where cb.instance_id is null and cb.assignment_id=task_row.assignment_id and cb.status='active' and task_row.scheduled_on between cb.starts_on and cb.ends_on)) then
    raise exception 'Un miembro responsable no se duplica como cobertura';
  end if;
  insert into public.task_coverage_bindings(organization_id,plan_id,instance_id,responsible_id,replacement_id,starts_on,ends_on,
    company_id_snapshot,period_snapshot,scheduled_on_snapshot,approved_by)
  select cb.organization_id,cb.plan_id,task_row.id,cb.responsible_id,cb.replacement_id,cb.starts_on,cb.ends_on,task_row.company_id,task_row.period,task_row.scheduled_on,cb.approved_by
   from public.task_coverage_bindings cb where cb.assignment_id=task_row.assignment_id and cb.responsible_id=task_row.owner_id
    and cb.status='active' and task_row.scheduled_on between cb.starts_on and cb.ends_on
    and not exists(select 1 from public.task_coverage_bindings oldb where oldb.instance_id=task_row.id and oldb.replacement_id=cb.replacement_id and oldb.status='active')
  on conflict(instance_id,replacement_id) where status='active' and instance_id is not null do nothing;
  get diagnostics bound_now=row_count; bound:=bound+bound_now;
 end loop;
 if inserted>0 or bound>0 then
  insert into public.audit_events(organization_id,actor_id,action,entity_id,details) values(org,actor,'month.materialized',p_owner,jsonb_build_object('period',p_period,'count',inserted,'coverageBindings',bound));
 end if;
 return inserted;
end $$;

-- RPCs are the sole write path. The read policy exposes only the shared task
-- fields to a current participant; comments and peer sessions keep their
-- original private policies.
revoke all on function public._coordination_lock_one(integer,text),public._coordination_lock_keys(integer,text[]),
 public._coordination_receipt_lock(uuid,uuid),public._coordination_acquire(uuid[],uuid[],jsonb,text[]),
 public._coordination_assert_month(uuid,date),public._coordination_can_assign(uuid,jsonb)
 ,public._capture_new_task_responsibility()
 ,public._coordination_apply_task_control(uuid,text,text,text,boolean,text,text,bigint)
 ,public._effective_session_end(uuid,timestamptz),public._session_cutoff(uuid)
 ,public._coordinated_task_payload(uuid)
 from public,anon,authenticated,service_role;
revoke all on function public.assign_task_responsibility(uuid,jsonb,text,bigint,uuid),
 public.approve_task_coverage_plan(uuid,uuid),public.cancel_task_coverage_binding(uuid,text,uuid)
 ,public.read_coordinated_task(uuid),public.read_coordinated_task_for_manager(uuid)
 from public,anon;
grant execute on function public.assign_task_responsibility(uuid,jsonb,text,bigint,uuid),
 public.approve_task_coverage_plan(uuid,uuid),public.cancel_task_coverage_binding(uuid,text,uuid),
 public.read_coordinated_task(uuid),public.read_coordinated_task_for_manager(uuid)
 to authenticated;
revoke execute on function public.lock_open_month(uuid,date) from public,anon,authenticated,service_role;

drop policy own_session_read on public.task_time_sessions;
drop policy sessions_read on public.task_time_sessions;
create policy coordinated_session_read on public.task_time_sessions for select to authenticated using(
 actor_id=auth.uid() or exists(
   select 1 from public.task_instances t join public.profiles session_actor
     on session_actor.id=task_time_sessions.actor_id and session_actor.organization_id=t.organization_id
   where t.id=task_time_sessions.instance_id and public.actor_role() in ('jefe','encargado')
     and public.can_access_owner(session_actor.id)
     and (public.actor_role()='jefe' or exists(select 1 from public.company_memberships cm
       where cm.profile_id=auth.uid() and cm.company_id=t.company_id and cm.organization_id=t.organization_id))
 ));
drop policy activity_read on public.activity_entries;
create policy coordinated_activity_read on public.activity_entries for select to authenticated using(
 actor_id=auth.uid() or exists(
   select 1 from public.task_instances task_row
   where task_row.id=activity_entries.instance_id and public.actor_role() in ('jefe','encargado')
     and public.can_access_owner(activity_entries.actor_id)
     and (public.actor_role()='jefe' or exists(select 1 from public.company_memberships cm
       where cm.profile_id=auth.uid() and cm.company_id=task_row.company_id and cm.organization_id=task_row.organization_id))
 ));

commit;
