begin;

-- M2.2A/B candidate. This migration remains local until B/C are accepted.
create table app_private.operational_rate_heads (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null,
  company_id uuid not null, template_id uuid, instance_id uuid,
  config_revision bigint not null default 0 check(config_revision>=0),
  fence_epoch bigint not null default 0 check(fence_epoch>=0),
  unique(id,organization_id),
  constraint operational_rate_heads_scope_key unique nulls not distinct(organization_id,company_id,template_id,instance_id),
  foreign key(company_id,organization_id) references public.companies(id,organization_id),
  foreign key(template_id,organization_id) references public.task_templates(id,organization_id),
  foreign key(instance_id,organization_id) references public.task_instances(id,organization_id),
  check((template_id is null)<>(instance_id is null))
);
create table app_private.operational_rate_versions (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null,
  head_id uuid not null, version bigint not null check(version>0), effective_on date not null,
  unit text not null check(char_length(unit) between 1 and 80),
  unit_weight numeric(20,6) not null check(unit_weight>0 and unit_weight<=1000000),
  reason text not null check(char_length(app_private.normalize_context_name(reason)) between 5 and 1000),
  created_by uuid not null, created_at timestamptz not null default clock_timestamp(),
  unique(id,organization_id), unique(head_id,version),
  foreign key(head_id,organization_id) references app_private.operational_rate_heads(id,organization_id),
  foreign key(created_by,organization_id) references public.profiles(id,organization_id)
);
create table app_private.operational_assessments (
  instance_id uuid primary key, organization_id uuid not null, revision bigint not null check(revision>0),
  foreign key(instance_id,organization_id) references public.task_instances(id,organization_id)
);
create table app_private.operational_assessment_versions (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null, instance_id uuid not null,
  revision bigint not null check(revision>0), quality smallint not null check(quality between 0 and 100),
  order_score smallint not null check(order_score between 0 and 100), timeliness smallint not null check(timeliness between 0 and 100),
  observation text not null check(char_length(app_private.normalize_context_name(observation)) between 5 and 1000),
  evaluated_by uuid not null, evaluated_at timestamptz not null default clock_timestamp(), unique(instance_id,revision),
  foreign key(instance_id,organization_id) references public.task_instances(id,organization_id),
  foreign key(evaluated_by,organization_id) references public.profiles(id,organization_id)
);
create table app_private.api_operation_fences (
  actor_id uuid not null, operation_id uuid not null, fence_epoch bigint not null default 1 check(fence_epoch>=1),
  primary key(actor_id,operation_id), foreign key(actor_id) references auth.users(id)
);
create table app_private.api_month_fences (
  organization_id uuid not null, owner_id uuid not null, period date not null check(isfinite(period) and extract(day from period)=1),
  fence_epoch bigint not null default 0 check(fence_epoch>=0), primary key(owner_id,period),
  foreign key(owner_id,organization_id) references public.profiles(id,organization_id)
);
insert into app_private.api_month_fences(organization_id,owner_id,period)
select distinct organization_id,owner_id,period from public.monthly_closures
on conflict(owner_id,period) do nothing;
create table app_private.api_command_receipts (
  actor_id uuid not null, operation_id uuid not null, organization_id uuid not null,
  kind text not null, arguments jsonb not null, result jsonb not null, created_at timestamptz not null default clock_timestamp(),
  primary key(actor_id,operation_id), foreign key(actor_id) references auth.users(id),
  foreign key(organization_id) references public.organizations(id),
  check(kind in ('operation.record','operation.rate','operation.assess'))
);

-- M2.2B: private commercial tracking and per-company monthly dependency graphs.
alter table public.task_instances add column priority text not null default 'Media'
  check(priority in ('Alta','Media','Baja'));
create table app_private.task_tracking (
 instance_id uuid primary key, organization_id uuid not null,
 commercial_enabled boolean not null default false,
 through_day smallint, progress_by uuid, progress_at timestamptz, available_from date,
 foreign key(instance_id,organization_id) references public.task_instances(id,organization_id),
 foreign key(progress_by,organization_id) references public.profiles(id,organization_id),
 check((commercial_enabled and through_day is not null and through_day between 0 and 30 and progress_by is not null and progress_at is not null)
    or (not commercial_enabled and through_day is null and progress_by is null and progress_at is null))
);
create table app_private.task_dependency_graphs (
 organization_id uuid not null, company_id uuid not null, period date not null,
 config_revision bigint not null default 0 check(config_revision>=0),
 fence_epoch bigint not null default 0 check(fence_epoch>=0),
 primary key(organization_id,company_id,period),
 foreign key(company_id,organization_id) references public.companies(id,organization_id),
 check(isfinite(period) and extract(day from period)=1)
);
create table app_private.task_dependencies (
 organization_id uuid not null, company_id uuid not null, period date not null,
 instance_id uuid not null, prerequisite_id uuid not null,
 primary key(instance_id,prerequisite_id),
 foreign key(organization_id,company_id,period) references app_private.task_dependency_graphs(organization_id,company_id,period),
 foreign key(instance_id,organization_id) references public.task_instances(id,organization_id),
 foreign key(prerequisite_id,organization_id) references public.task_instances(id,organization_id),
 check(instance_id<>prerequisite_id)
);
create index task_dependencies_prerequisite_idx on app_private.task_dependencies(prerequisite_id,instance_id);
create table app_private.task_tracking_events (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null, instance_id uuid not null,
 task_revision bigint not null check(task_revision>0), kind text not null check(kind in ('commercial_mode','commercial_progress','dependencies','availability')),
 previous_value jsonb not null, next_value jsonb not null, actor_id uuid not null,
 at timestamptz not null default clock_timestamp(), unique(instance_id,task_revision),
 foreign key(instance_id,organization_id) references public.task_instances(id,organization_id),
 foreign key(actor_id,organization_id) references public.profiles(id,organization_id)
);
create table app_private.task_completion_events (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null, instance_id uuid not null,
 task_revision bigint not null check(task_revision>0), completed_by uuid not null,
 completed_at timestamptz not null default clock_timestamp(), unique(instance_id,task_revision),
 foreign key(instance_id,organization_id) references public.task_instances(id,organization_id),
 foreign key(completed_by,organization_id) references public.profiles(id,organization_id)
);
create function app_private.guard_task_tracking_scope() returns trigger
language plpgsql security definer set search_path='' as $$
declare task_row public.task_instances%rowtype;
 begin
 select * into task_row from public.task_instances where id=new.instance_id and organization_id=new.organization_id;
 if not found or (new.available_from is not null and date_trunc('month',new.available_from)::date<>task_row.period) then
  raise exception using errcode='22023',message='Seguimiento inválido';
 end if;
 if new.commercial_enabled and (task_row.kind<>'resultado' or exists(
   select 1 from public.task_responsibility_heads h join public.task_responsibility_sets s on s.id=h.set_id
   where h.instance_id=task_row.id and s.mode='conjunta')) then
  raise exception using errcode='22023',message='Seguimiento comercial no disponible';
 end if;
 return new;
end $$;
create trigger task_tracking_scope_guard before insert or update on app_private.task_tracking
 for each row execute function app_private.guard_task_tracking_scope();
create function app_private.guard_task_dependency_scope() returns trigger
language plpgsql security definer set search_path='' as $$
declare task_row public.task_instances%rowtype; prerequisite_row public.task_instances%rowtype;
begin
 select * into task_row from public.task_instances where id=new.instance_id and organization_id=new.organization_id;
 select * into prerequisite_row from public.task_instances where id=new.prerequisite_id and organization_id=new.organization_id;
 if not found or task_row.id is null or prerequisite_row.id is null or task_row.kind<>'resultado' or prerequisite_row.kind<>'resultado'
   or (task_row.company_id,task_row.period) is distinct from (new.company_id,new.period)
   or (prerequisite_row.company_id,prerequisite_row.period) is distinct from (new.company_id,new.period)
   or exists(select 1 from public.task_responsibility_heads h join public.task_responsibility_sets s on s.id=h.set_id
      where h.instance_id in (task_row.id,prerequisite_row.id) and s.mode='conjunta') then
  raise exception using errcode='22023',message='Dependencia inválida';
 end if;
 return new;
end $$;
create trigger task_dependency_scope_guard before insert or update on app_private.task_dependencies
 for each row execute function app_private.guard_task_dependency_scope();
alter table app_private.api_command_receipts drop constraint api_command_receipts_kind_check;
alter table app_private.api_command_receipts add constraint api_command_receipts_kind_check check(kind in (
 'operation.record','operation.rate','operation.assess','task.commercialMode','task.commercialProgress','task.dependencies','task.transition',
 'catalogue.create','catalogue.revise','catalogue.weight','onboarding.saveDraft','onboarding.submit','onboarding.requestChanges','onboarding.approve','assignment.create','task.createOneOff','month.materialize','companyMembership.setActive'));
do $$ declare t text; begin
 foreach t in array array['task_tracking','task_dependency_graphs','task_dependencies','task_tracking_events','task_completion_events'] loop
  execute format('alter table app_private.%I enable row level security',t);
  execute format('revoke all on table app_private.%I from public,anon,authenticated,service_role',t);
 end loop;
end $$;
do $$ declare t text; begin
  foreach t in array array['operational_rate_heads','operational_rate_versions','operational_assessments','operational_assessment_versions','api_operation_fences','api_month_fences','api_command_receipts'] loop
    execute format('alter table app_private.%I enable row level security',t);
    execute format('revoke all on table app_private.%I from public,anon,authenticated,service_role',t);
  end loop;
end $$;

create function app_private.reject_immutable_operational_history() returns trigger
language plpgsql security definer set search_path='' as $$
begin raise exception using errcode='55000',message='El historial operativo es inmutable'; end $$;
create trigger operational_rate_versions_immutable before update or delete on app_private.operational_rate_versions for each row execute function app_private.reject_immutable_operational_history();
create trigger operational_assessment_versions_immutable before update or delete on app_private.operational_assessment_versions for each row execute function app_private.reject_immutable_operational_history();
create trigger api_command_receipts_immutable before update or delete on app_private.api_command_receipts for each row execute function app_private.reject_immutable_operational_history();
create trigger task_tracking_events_immutable before update or delete on app_private.task_tracking_events for each row execute function app_private.reject_immutable_operational_history();
create trigger task_completion_events_immutable before update or delete on app_private.task_completion_events for each row execute function app_private.reject_immutable_operational_history();

alter table public.company_memberships
 add column active boolean not null default true,
 add column revision bigint not null default 0 check(revision>=0),
 add column changed_at timestamptz,
 add column changed_by uuid references public.profiles(id),
 add column access_valid_from timestamptz;

alter table public.activity_entries alter column reference drop not null;
alter table public.activity_entries add column measurement_version smallint not null default 1 check(measurement_version in (1,2));
alter table public.activity_entries add column operational_rate_id uuid;
alter table public.activity_entries add column operational_unit_weight numeric(20,6);
alter table public.activity_entries add column unit_snapshot text;
alter table public.activity_entries add constraint activity_operational_rate_fk foreign key(operational_rate_id,organization_id) references app_private.operational_rate_versions(id,organization_id);
alter table public.activity_entries add constraint activity_operational_snapshot_pair check((operational_rate_id is null)=(operational_unit_weight is null));
alter table public.activity_entries add constraint activity_operational_snapshot_valid check(
  (measurement_version=1 and operational_rate_id is null and operational_unit_weight is null and unit_snapshot is null and reference is not null and length(trim(reference))>0)
  or (measurement_version=2 and unit_snapshot is not null and char_length(unit_snapshot) between 1 and 80 and char_length(app_private.normalize_context_name(unit_snapshot)) between 1 and 80 and (reference is null or char_length(app_private.normalize_context_name(reference)) between 1 and 2000))
);
alter table public.activity_entries drop constraint if exists activity_entries_reference_check;
alter table public.activity_entries add constraint activity_entries_reference_v2_check check(
  (measurement_version=1 and length(trim(reference))>0) or
  (measurement_version=2 and (reference is null or char_length(app_private.normalize_context_name(reference)) between 1 and 2000))
);
create index operational_rate_versions_effective_idx on app_private.operational_rate_versions(head_id,effective_on desc,version desc);
create index operational_assessment_latest_idx on app_private.operational_assessment_versions(instance_id,revision desc);

create function app_private.guard_operational_activity_snapshot() returns trigger
language plpgsql security definer set search_path='' as $$
declare t public.task_instances%rowtype; r app_private.operational_rate_versions%rowtype; h app_private.operational_rate_heads%rowtype;
begin
 if tg_op='UPDATE' then
   if (new.measurement_version,new.operational_rate_id,new.operational_unit_weight,new.unit_snapshot) is distinct from (old.measurement_version,old.operational_rate_id,old.operational_unit_weight,old.unit_snapshot) then
     raise exception using errcode='55000',message='El snapshot operativo es inmutable';
   end if;
   return new;
 end if;
 if new.measurement_version=1 then
   if new.operational_rate_id is not null or new.operational_unit_weight is not null or new.unit_snapshot is not null then raise exception using errcode='22023',message='Snapshot operativo inválido'; end if;
   return new;
 end if;
 select * into t from public.task_instances where id=new.instance_id and organization_id=new.organization_id;
 if not found or t.kind<>'operativa' or t.unit is null or char_length(t.unit) not between 1 and 80 or char_length(app_private.normalize_context_name(t.unit)) not between 1 and 80 then raise exception using errcode='22023',message='Unidad inválida'; end if;
 new.unit_snapshot:=t.unit;
 if new.reference is not null then new.reference:=app_private.normalize_context_name(new.reference); if char_length(new.reference) not between 1 and 2000 then raise exception using errcode='22023',message='Referencia inválida'; end if; end if;
 if new.operational_rate_id is null then
   if new.operational_unit_weight is not null then raise exception using errcode='22023',message='Coeficiente inválido'; end if;
 else
   select * into r from app_private.operational_rate_versions where id=new.operational_rate_id and organization_id=new.organization_id;
   select * into h from app_private.operational_rate_heads where id=r.head_id and organization_id=r.organization_id;
   if not found or h.company_id<>t.company_id or (h.instance_id is not null and h.instance_id<>t.id) or
      (h.template_id is not null and h.template_id is distinct from (select template_id from public.task_assignments where id=t.assignment_id)) or
      r.unit<>t.unit or r.effective_on>new.work_date or r.unit_weight is distinct from new.operational_unit_weight then
     raise exception using errcode='22023',message='Coeficiente no aplicable';
   end if;
 end if;
 return new;
end $$;
create trigger activity_operational_snapshot_guard before insert or update on public.activity_entries for each row execute function app_private.guard_operational_activity_snapshot();

create function app_private.guard_operational_unit_change() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if new.unit is distinct from old.unit and exists(select 1 from public.activity_entries e where e.instance_id=old.id and e.measurement_version=2) then
   raise exception using errcode='55000',message='La unidad ya tiene movimientos operativos versionados';
 end if;
 return new;
end $$;
create trigger task_instance_operational_unit_guard before update of unit on public.task_instances for each row execute function app_private.guard_operational_unit_change();

-- Keep the current coordination-011 close function byte-for-byte in force.
-- A BEFORE INSERT fence aborts its legacy formula before any report/outbox write.
create function app_private.guard_legacy_operational_closure() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if exists(select 1 from public.task_instances t where t.period=new.period and
   (t.owner_id=new.owner_id or
    exists(select 1 from public.task_responsibility_heads h join public.task_responsibility_members m on m.set_id=h.set_id where h.instance_id=t.id and m.profile_id=new.owner_id) or
    exists(select 1 from public.task_time_sessions s where s.instance_id=t.id and s.actor_id=new.owner_id) or
    exists(select 1 from public.activity_entries e where e.instance_id=t.id and e.actor_id=new.owner_id)) and
   (t.measurement_version=2 or exists(select 1 from public.activity_entries e where e.instance_id=t.id and e.measurement_version=2) or
    exists(select 1 from app_private.operational_assessments a where a.instance_id=t.id))) then
   raise exception using errcode='0A000',message='GP_V2_REQUIRES_COMPANY_CLOSE';
 end if;
 return new;
end $$;
create trigger monthly_closures_legacy_operational_guard before insert on public.monthly_closures
for each row execute function app_private.guard_legacy_operational_closure();

create function app_private.touch_api_month_fence(p_organization uuid,p_owner uuid,p_period date) returns void
language plpgsql security definer set search_path='' as $$
begin
  insert into app_private.api_month_fences(organization_id,owner_id,period,fence_epoch)
  values(p_organization,p_owner,p_period,1)
  on conflict(owner_id,period) do update set fence_epoch=app_private.api_month_fences.fence_epoch+1;
end $$;
create function app_private.guard_api_month_close_fence() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  perform app_private.touch_api_month_fence(new.organization_id,new.owner_id,new.period);
  return new;
end $$;
create trigger monthly_closures_api_month_fence before insert on public.monthly_closures
for each row execute function app_private.guard_api_month_close_fence();

create function app_private.api_revalidate_actor(p_actor uuid,p_context jsonb) returns void
language plpgsql security definer set search_path='' as $$
declare current_profile record;
begin
  select p.organization_id,p.role,p.active into current_profile from public.profiles p where p.id=p_actor for share;
  if not found or not current_profile.active or current_profile.organization_id is distinct from (p_context->'principal'->>'organizationId')::uuid
    or current_profile.role is distinct from (p_context->'principal'->>'role') then
    raise exception using errcode='42501',message='Contexto no autorizado';
  end if;
end $$;

create function app_private.api_lock_task_scope(p_actor uuid,p_organization uuid,p_task uuid) returns void
language plpgsql security definer set search_path='' as $$
declare task_row record; profile_id uuid; membership_row record; profile_row record; binding_id uuid; absence_id uuid; responsibility_set_id uuid; responsibility_profile_id uuid;
begin
  select t.owner_id,t.company_id,t.organization_id into task_row from public.task_instances t where t.id=p_task for share;
  if not found or task_row.organization_id is distinct from p_organization then raise exception using errcode='42501',message='Contexto no autorizado'; end if;
  perform 1 from public.teams tm where tm.id=(select t.team_id from public.task_instances t where t.id=p_task) for share;
  for profile_id in select distinct x from (
    select p_actor x union select task_row.owner_id union
    select m.profile_id from public.task_responsibility_heads h join public.task_responsibility_members m on m.set_id=h.set_id and m.organization_id=h.organization_id where h.organization_id=p_organization and h.instance_id=p_task
  ) profiles_to_lock order by x loop
    select p.organization_id,p.active,p.role into profile_row from public.profiles p where p.id=profile_id for share;
    if (profile_id=p_actor or profile_id=task_row.owner_id) and (not found or profile_row.organization_id is distinct from p_organization or not profile_row.active) then
      raise exception using errcode='42501',message='Contexto no autorizado';
    end if;
  end loop;
  for membership_row in select cm.profile_id,cm.company_id from public.company_memberships cm
    where cm.organization_id=p_organization and cm.company_id=task_row.company_id and cm.profile_id=any(array[p_actor,task_row.owner_id])
    order by cm.profile_id,cm.company_id loop
    perform 1 from public.company_memberships cm where cm.organization_id=p_organization and cm.profile_id=membership_row.profile_id and cm.company_id=membership_row.company_id for share;
  end loop;
  for membership_row in select tm.profile_id,tm.team_id from public.team_members tm
    where tm.organization_id=p_organization and tm.team_id=(select t.team_id from public.task_instances t where t.id=p_task) and tm.profile_id=any(array[p_actor,task_row.owner_id])
    order by tm.profile_id,tm.team_id loop
    perform 1 from public.team_members tm where tm.organization_id=p_organization and tm.profile_id=membership_row.profile_id and tm.team_id=membership_row.team_id for share;
  end loop;
  for responsibility_set_id in select h.set_id from public.task_responsibility_heads h where h.organization_id=p_organization and h.instance_id=p_task order by h.set_id loop
    perform 1 from public.task_responsibility_heads h where h.organization_id=p_organization and h.instance_id=p_task and h.set_id=responsibility_set_id for share;
    perform 1 from public.task_responsibility_sets s where s.organization_id=p_organization and s.id=responsibility_set_id for share;
    for responsibility_profile_id in select m.profile_id from public.task_responsibility_members m where m.organization_id=p_organization and m.set_id=responsibility_set_id order by m.profile_id loop
      perform 1 from public.task_responsibility_members m where m.organization_id=p_organization and m.set_id=responsibility_set_id and m.profile_id=responsibility_profile_id for share;
    end loop;
  end loop;
  for binding_id in select b.id from public.task_coverage_bindings b where b.organization_id=p_organization and b.instance_id=p_task and b.replacement_id=p_actor order by b.id loop
    perform 1 from public.task_coverage_bindings b where b.id=binding_id for share;
  end loop;
  for absence_id in select a.id from public.employee_absences a join public.employee_absence_companies ac on ac.absence_id=a.id and ac.organization_id=a.organization_id
    where a.organization_id=p_organization and a.owner_id=task_row.owner_id and a.replacement_id=p_actor and ac.company_id=task_row.company_id order by a.id loop
    perform 1 from public.employee_absences a where a.id=absence_id for share;
    perform 1 from public.employee_absence_companies ac where ac.absence_id=absence_id and ac.company_id=task_row.company_id for share;
  end loop;
end $$;

create function app_private.api_touch_month_fences(p_organization uuid,p_months jsonb) returns void
language plpgsql security definer set search_path='' as $$
declare month_row record;
begin
  for month_row in select distinct (x->>'ownerId')::uuid owner_id,(x->>'period')::date period
    from jsonb_array_elements(coalesce(p_months,'[]'::jsonb)) x order by owner_id,period loop
    perform app_private.touch_api_month_fence(p_organization,month_row.owner_id,month_row.period);
  end loop;
end $$;

create function app_private.api_require_business(p_privileged boolean default false)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare c jsonb; p jsonb;
begin
 c:=api.get_context_v1(); p:=c->'principal';
 if p->>'kind' is distinct from 'business' or p->>'role' is null or (p->>'role') not in ('empleado','encargado','jefe') or (c->'authentication'->>'requiresMfa')::boolean is distinct from false then
   raise exception using errcode='42501',message='Contexto no autorizado';
 end if;
 if p_privileged and (p->>'role'<>'jefe' or c->'authentication'->>'aal'<>'aal2') then
   raise exception using errcode='42501',message='Contexto no autorizado';
 end if;
 return c;
end $$;

create function app_private.api_exact_keys(p_value jsonb,p_keys text[]) returns boolean
language sql immutable set search_path='' as $$
 select coalesce(
    case when jsonb_typeof(p_value) is distinct from 'object' or p_keys is null or array_position(p_keys,null) is not null then false
   else (
     select count(*)=cardinality(p_keys)
       and coalesce(bool_and(k=any(p_keys)),cardinality(p_keys)=0)
     from jsonb_object_keys(p_value) as keys(k)
   ) end,
   false
 )
$$;
create function app_private.api_text(p_value jsonb,p_key text,p_min integer,p_max integer) returns text
language plpgsql immutable set search_path='' as $$
declare v text;
begin
 if jsonb_typeof(p_value->p_key) is distinct from 'string' then raise exception using errcode='22023',message='Solicitud inválida'; end if;
 v:=app_private.normalize_context_name(p_value->>p_key);
 if char_length(v) not between p_min and p_max then raise exception using errcode='22023',message='Solicitud inválida'; end if;
 return v;
end $$;
create function app_private.api_date(p_value jsonb,p_key text) returns date
language plpgsql immutable set search_path='' as $$
declare raw text; result date;
begin
 if jsonb_typeof(p_value->p_key) is distinct from 'string' then raise exception using errcode='22023',message='Solicitud inválida'; end if;
 raw:=p_value->>p_key;
 if raw !~ '^(?!0000)\d{4}-\d{2}-\d{2}$' then raise exception using errcode='22023',message='Solicitud inválida'; end if;
 begin result:=raw::date; exception when others then raise exception using errcode='22023',message='Solicitud inválida'; end;
 if not isfinite(result) or to_char(result,'YYYY-MM-DD')<>raw then raise exception using errcode='22023',message='Solicitud inválida'; end if;
 return result;
end $$;
create function app_private.api_timestamp(p_value jsonb,p_key text) returns timestamptz
language plpgsql immutable set search_path='' as $$
declare raw text; result timestamptz;
begin
 if jsonb_typeof(p_value->p_key) is distinct from 'string' then raise exception using errcode='22023',message='Consulta inválida'; end if;
 raw:=p_value->>p_key;
 if raw !~ '^(?!0000)[0-9]{4}-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])T([01][0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9](\.[0-9]{1,6})?(Z|[+-](0[0-9]|1[0-4]):[0-5][0-9])$' then raise exception using errcode='22023',message='Consulta inválida'; end if;
 begin result:=raw::timestamptz; exception when others then raise exception using errcode='22023',message='Consulta inválida'; end;
 if not isfinite(result) then raise exception using errcode='22023',message='Consulta inválida'; end if;
 return result;
end $$;
create function app_private.api_uuid(p_value jsonb,p_key text) returns uuid
language plpgsql immutable set search_path='' as $$
declare raw text;
begin
 if jsonb_typeof(p_value->p_key) is distinct from 'string' then raise exception using errcode='22023',message='Solicitud inválida'; end if;
 raw:=p_value->>p_key;
 if raw !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then raise exception using errcode='22023',message='Solicitud inválida'; end if;
 return raw::uuid;
end $$;
create function app_private.api_expected(p_value jsonb,p_key text) returns bigint
language plpgsql immutable set search_path='' as $$
declare raw text; result bigint;
begin
 if jsonb_typeof(p_value->p_key) is distinct from 'string' then raise exception using errcode='22023',message='Solicitud inválida'; end if;
 raw:=p_value->>p_key;
 if raw !~ '^(0|[1-9][0-9]*)$' then raise exception using errcode='22023',message='Solicitud inválida'; end if;
 begin result:=raw::bigint; exception when others then raise exception using errcode='22023',message='Solicitud inválida'; end;
 return result;
end $$;
create function app_private.api_integer(p_value jsonb,p_key text,p_min integer,p_max integer) returns integer
language plpgsql immutable set search_path='' as $$
declare raw text; result integer;
begin
 if jsonb_typeof(p_value->p_key) is distinct from 'number' then raise exception using errcode='22023',message='Solicitud inválida'; end if;
 raw:=p_value->>p_key;
 if raw !~ '^-?(0|[1-9][0-9]*)$' then raise exception using errcode='22023',message='Solicitud inválida'; end if;
 begin result:=raw::integer; exception when others then raise exception using errcode='22023',message='Solicitud inválida'; end;
 if result not between p_min and p_max then raise exception using errcode='22023',message='Solicitud inválida'; end if;
 return result;
end $$;

create function app_private.api_company_membership_valid_at(p_org uuid,p_company uuid,p_profile uuid,p_at timestamptz) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.company_memberships cm where cm.organization_id=p_org and cm.company_id=p_company and cm.profile_id=p_profile and cm.active and (cm.access_valid_from is null or cm.access_valid_from<=p_at))
$$;
alter function public._can_access_instance_at(uuid,timestamptz) rename to _can_access_instance_at_membership_base;
revoke all on function public._can_access_instance_at_membership_base(uuid,timestamptz) from public,anon,authenticated,service_role;
create function public._can_access_instance_at(p_instance uuid,p_at timestamptz) returns boolean
language sql stable security definer set search_path='' as $$
 select public._can_access_instance_at_membership_base(p_instance,p_at) and exists(
  select 1 from public.task_instances t where t.id=p_instance and
   (public.actor_role()='jefe' or app_private.api_company_membership_valid_at(t.organization_id,t.company_id,auth.uid(),p_at)))
$$;

create function app_private.guard_active_company_membership_writes() returns trigger
language plpgsql security definer set search_path='' as $$
declare org uuid; comp uuid; owner uuid; access_from timestamptz; start_on date;
begin
 if tg_table_name='task_assignments' then org:=new.organization_id; comp:=new.company_id; owner:=new.owner_id; start_on:=new.start_date;
 elsif tg_table_name='task_responsibility_members' then
  select t.organization_id,t.company_id into org,comp from public.task_responsibility_heads h join public.task_instances t on t.id=h.instance_id where h.set_id=new.set_id;
  if org is null then return new; end if;
  owner:=new.profile_id; start_on:=(clock_timestamp() at time zone 'America/Argentina/Buenos_Aires')::date;
 elsif tg_table_name='task_coverage_bindings' then
  org:=new.organization_id; comp:=coalesce(new.company_id_snapshot,(select a.company_id from public.task_assignments a where a.id=new.assignment_id)); start_on:=new.starts_on;
  if new.status='active' then
   if not app_private.api_company_membership_valid_at(org,comp,new.responsible_id,start_on::timestamp at time zone 'America/Argentina/Buenos_Aires')
     or not app_private.api_company_membership_valid_at(org,comp,new.replacement_id,start_on::timestamp at time zone 'America/Argentina/Buenos_Aires') then raise exception using errcode='42501',message='Membresía de empresa inactiva'; end if;
  end if;
  return new;
 elsif tg_table_name='activity_entries' then
  select organization_id,company_id into org,comp from public.task_instances where id=new.instance_id;
  owner:=new.actor_id; start_on:=new.work_date;
 end if;
 if not app_private.api_company_membership_valid_at(org,comp,owner,start_on::timestamp at time zone 'America/Argentina/Buenos_Aires') then
  raise exception using errcode='42501',message='Membresía de empresa inactiva';
 end if;
 return new;
end $$;
create trigger task_assignment_active_membership_guard before insert or update of company_id,owner_id,start_date on public.task_assignments
 for each row execute function app_private.guard_active_company_membership_writes();
create trigger task_responsibility_active_membership_guard before insert or update of set_id,profile_id on public.task_responsibility_members
 for each row execute function app_private.guard_active_company_membership_writes();
create function app_private.guard_active_responsibility_head_memberships() returns trigger
language plpgsql security definer set search_path='' as $$
declare org uuid; comp uuid; start_on date; bad_profile uuid;
begin
 select t.organization_id,t.company_id,t.period into org,comp,start_on from public.task_instances t where t.id=new.instance_id;
 if org is null then return new; end if;
 select m.profile_id into bad_profile from public.task_responsibility_members m
 where m.set_id=new.set_id and not app_private.api_company_membership_valid_at(org,comp,m.profile_id,start_on::timestamp at time zone 'America/Argentina/Buenos_Aires') limit 1;
 if bad_profile is not null then raise exception using errcode='42501',message='Membresía de empresa inactiva'; end if;
 return new;
end $$;
create trigger task_responsibility_head_active_membership_guard before insert or update of set_id on public.task_responsibility_heads
 for each row execute function app_private.guard_active_responsibility_head_memberships();
create trigger task_coverage_active_membership_guard before insert or update of status,responsible_id,replacement_id,starts_on,ends_on on public.task_coverage_bindings
 for each row execute function app_private.guard_active_company_membership_writes();
create trigger activity_active_membership_guard before insert on public.activity_entries
 for each row execute function app_private.guard_active_company_membership_writes();

create function app_private.api_can_execute(p_task uuid,p_actor uuid,p_work_date date) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.task_instances t where t.id=p_task and t.kind='operativa' and app_private.api_company_membership_valid_at(t.organization_id,t.company_id,p_actor,(p_work_date::timestamp at time zone 'America/Argentina/Buenos_Aires')) and
   (t.owner_id=p_actor or exists(select 1 from public.task_responsibility_heads h join public.task_responsibility_members m on m.set_id=h.set_id and m.organization_id=h.organization_id where h.instance_id=t.id and m.profile_id=p_actor)))
 or exists(select 1 from public.task_instances t join public.task_coverage_bindings b on b.instance_id=t.id and b.organization_id=t.organization_id
   join public.company_memberships cm on cm.profile_id=p_actor and cm.company_id=t.company_id and cm.organization_id=t.organization_id
   where t.id=p_task and t.kind='operativa' and b.replacement_id=p_actor and b.responsible_id=t.owner_id and b.status='active' and t.period=b.period_snapshot and p_work_date between b.starts_on and b.ends_on)
 or exists(select 1 from public.task_instances t join public.employee_absences a on a.owner_id=t.owner_id and a.organization_id=t.organization_id
   join public.employee_absence_companies c on c.absence_id=a.id and c.organization_id=a.organization_id and c.company_id=t.company_id
   join public.company_memberships cm on cm.profile_id=p_actor and cm.company_id=t.company_id and cm.organization_id=t.organization_id
   where t.id=p_task and t.kind='operativa' and a.replacement_id=p_actor and a.cancelled_at is null and a.authorization_sealed and p_work_date between a.starts_on and a.ends_on and t.period between date_trunc('month',a.starts_on)::date and date_trunc('month',a.ends_on)::date)
$$;

create function api.command_v1(p jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare c jsonb; actor uuid:=auth.uid(); org uuid; role_name text; kind text; op uuid; payload jsonb; revisions jsonb; args jsonb;
 task_id uuid; company_id uuid; v_company uuid; template_id uuid; expected bigint; expected_task bigint; expected_rate bigint; expected_assessment bigint; new_revision bigint;
  t public.task_instances%rowtype; planned_t public.task_instances%rowtype; a public.task_assignments%rowtype; h app_private.operational_rate_heads%rowtype;
 chosen app_private.operational_rate_versions%rowtype; rate_id uuid; rate_version bigint; unit_value text; coeff numeric(20,6); amount integer; ref text; work_date date; reason text;
 quality_score integer; order_value integer; timely integer; observation text; assessment_id uuid; assessment_rev bigint;
 result_data jsonb; existing app_private.api_command_receipts%rowtype; plan jsonb; people uuid[]; months jsonb; locks text[]; now_at timestamptz;
begin
 if actor is null then raise exception using errcode='28000',message='Autenticación requerida'; end if;
 if octet_length(coalesce(p::text,''))>32768 or not app_private.api_exact_keys(p,array['contractVersion','operationId','kind','expectedRevisions','payload']) or jsonb_typeof(p->'contractVersion') is distinct from 'number' or p->>'contractVersion' is distinct from '1' then raise exception using errcode='22023',message='Solicitud inválida'; end if;
 if jsonb_typeof(p->'kind') is distinct from 'string' then raise exception using errcode='22023',message='Solicitud inválida'; end if;
 c:=app_private.api_require_business(false); org:=(c->'principal'->>'organizationId')::uuid; role_name:=c->'principal'->>'role';
 op:=app_private.api_uuid(p,'operationId'); kind:=p->>'kind'; payload:=p->'payload'; revisions:=p->'expectedRevisions';
 if jsonb_typeof(revisions) is distinct from 'object' or jsonb_typeof(payload) is distinct from 'object' then raise exception using errcode='22023',message='Solicitud inválida'; end if;
 if kind not in ('operation.record','operation.rate','operation.assess') then raise exception using errcode='0A000',message='Operación no disponible'; end if;
 if kind='operation.record' then
   if not app_private.api_exact_keys(payload,array['taskId','workDate','quantity','reference']) or not app_private.api_exact_keys(revisions,array['task:'||(payload->>'taskId')]) then raise exception using errcode='22023',message='Solicitud inválida'; end if;
   task_id:=app_private.api_uuid(payload,'taskId'); work_date:=app_private.api_date(payload,'workDate');
    expected_task:=app_private.api_expected(revisions,'task:'||task_id);
   if jsonb_typeof(payload->'quantity') is distinct from 'number' or (payload->>'quantity') !~ '^[1-9][0-9]{0,6}$' or (payload->>'quantity')::integer>1000000 or (jsonb_typeof(payload->'reference') is distinct from 'string' and jsonb_typeof(payload->'reference') is distinct from 'null') then raise exception using errcode='22023',message='Solicitud inválida'; end if;
   amount:=(payload->>'quantity')::integer;
   if jsonb_typeof(payload->'reference')='string' then ref:=nullif(app_private.normalize_context_name(payload->>'reference'),''); if ref is not null and char_length(ref)>2000 then raise exception using errcode='22023',message='Solicitud inválida'; end if; else ref:=null; end if;
 elsif kind='operation.rate' then
   if not app_private.api_exact_keys(payload,array['companyId','templateId','taskId','effectiveOn','unitWeight','reason']) then raise exception using errcode='22023',message='Solicitud inválida'; end if;
   if (payload->>'templateId' is null)=(payload->>'taskId' is null) then raise exception using errcode='22023',message='Solicitud inválida'; end if;
   company_id:=app_private.api_uuid(payload,'companyId'); v_company:=company_id; template_id:=case when payload->>'templateId' is null then null else app_private.api_uuid(payload,'templateId') end;
   task_id:=case when payload->>'taskId' is null then null else app_private.api_uuid(payload,'taskId') end;
   if not app_private.api_exact_keys(revisions,array[case when template_id is not null then 'rate:'||company_id||':template:'||template_id else 'rate:'||company_id||':task:'||task_id end]) then raise exception using errcode='22023',message='Solicitud inválida'; end if;
    expected_rate:=app_private.api_expected(revisions,'rate:'||company_id||case when template_id is not null then ':template:'||template_id else ':task:'||task_id end);
   work_date:=app_private.api_date(payload,'effectiveOn'); reason:=app_private.api_text(payload,'reason',5,1000);
   if jsonb_typeof(payload->'unitWeight') is distinct from 'string' or (payload->>'unitWeight') !~ '^(0|[1-9][0-9]*)(\.[0-9]{1,6})?$' then raise exception using errcode='22023',message='Solicitud inválida'; end if;
   begin coeff:=(payload->>'unitWeight')::numeric(20,6); exception when others then raise exception using errcode='22023',message='Solicitud inválida'; end;
   if coeff<=0 or coeff>1000000 then raise exception using errcode='22023',message='Solicitud inválida'; end if;
 elsif kind='operation.assess' then
   if not app_private.api_exact_keys(payload,array['taskId','quality','order','timeliness','observation']) then raise exception using errcode='22023',message='Solicitud inválida'; end if;
   task_id:=app_private.api_uuid(payload,'taskId');
   if not app_private.api_exact_keys(revisions,array['task:'||task_id,'assessment:'||task_id]) then raise exception using errcode='22023',message='Solicitud inválida'; end if;
    expected_task:=app_private.api_expected(revisions,'task:'||task_id);
   expected_assessment:=app_private.api_expected(revisions,'assessment:'||task_id);
   quality_score:=app_private.api_integer(payload,'quality',0,100); order_value:=app_private.api_integer(payload,'order',0,100); timely:=app_private.api_integer(payload,'timeliness',0,100); observation:=app_private.api_text(payload,'observation',5,1000);
 end if;
 args:=p;
 perform public._coordination_receipt_lock(actor,op);
 select * into existing from app_private.api_command_receipts where actor_id=actor and operation_id=op;
 if found then
 if existing.arguments is distinct from args or existing.kind<>kind then raise exception using errcode='40001',message='Identificador de operación ya utilizado'; end if;
   if task_id is not null then
     select * into t from public.task_instances where id=task_id and organization_id=org;
     if not found then raise exception using errcode='42501',message='Contexto no autorizado'; end if;
     people:=array(select distinct x from (select actor x union select t.owner_id union select m.profile_id from public.task_responsibility_heads rh join public.task_responsibility_members m on m.set_id=rh.set_id where rh.instance_id=t.id) q order by x);
     months:=coalesce((select jsonb_agg(jsonb_build_object('ownerId',x,'period',t.period) order by x) from unnest(people) x),'[]'::jsonb);
     select ta.template_id into template_id from public.task_assignments ta where ta.id=t.assignment_id;
     locks:=array['rate:'||t.company_id||':task:'||t.id,'rate:'||t.company_id||':template:'||coalesce(template_id,t.id)];
     plan:=public._coordination_prepare(array[t.id],array[actor],people,months,locks||case when template_id is null then '{}'::text[] else array['template:'||template_id] end,'{}'::jsonb);
     perform public._coordination_acquire(plan);
   else
     perform public._coordination_lock_keys(1102,array[actor::text]);
     perform public._coordination_lock_keys(1103,array[actor::text]);
   end if;
   perform app_private.api_revalidate_actor(actor,c);
   if task_id is not null then perform app_private.api_lock_task_scope(actor,org,task_id); end if;
   if kind='operation.rate' and (role_name<>'jefe' or c->'authentication'->>'aal'<>'aal2') then raise exception using errcode='42501',message='Contexto no autorizado'; end if;
   if kind='operation.rate' then
     if role_name<>'jefe' or c->'authentication'->>'aal'<>'aal2' or not exists(select 1 from public.companies co where co.id=company_id and co.organization_id=org) then raise exception using errcode='42501',message='Contexto no autorizado'; end if;
   elsif task_id is not null then
     select * into t from public.task_instances where id=task_id and organization_id=org;
     if not found or not public.can_access_instance(task_id) or (kind='operation.record' and not app_private.api_can_execute(task_id,actor,work_date)) or (kind='operation.assess' and (role_name<>'jefe' or c->'authentication'->>'aal'<>'aal2')) then raise exception using errcode='42501',message='Contexto no autorizado'; end if;
   end if;
   return existing.result;
 end if;
 insert into app_private.api_operation_fences(actor_id,operation_id) values(actor,op)
   on conflict(actor_id,operation_id) do update set fence_epoch=app_private.api_operation_fences.fence_epoch+1;
 if kind='operation.rate' then
   if role_name<>'jefe' or c->'authentication'->>'aal'<>'aal2' then raise exception using errcode='42501',message='Contexto no autorizado'; end if;
   if not exists(select 1 from public.companies co where co.organization_id=org and co.id=v_company) then raise exception using errcode='42501',message='Contexto no autorizado'; end if;
   if task_id is not null then select ti.* into t from public.task_instances ti where ti.id=task_id and ti.organization_id=org and ti.company_id=v_company and ti.kind='operativa'; if not found then raise exception using errcode='42501',message='Contexto no autorizado'; end if; planned_t:=t; perform public._coordination_assert_month(t.owner_id,t.period); unit_value:=t.unit;
   else select tt.unit into unit_value from public.task_templates tt where tt.id=template_id and tt.organization_id=org and tt.kind='operativa'; if not found then raise exception using errcode='22023',message='Plantilla inválida'; end if; end if;
   if unit_value is null or char_length(unit_value) not between 1 and 80 or char_length(app_private.normalize_context_name(unit_value)) not between 1 and 80 then raise exception using errcode='22023',message='Unidad inválida'; end if;
   locks:=array['rate:'||company_id||':template:'||coalesce(template_id,(select ta.template_id from public.task_assignments ta where ta.id=t.assignment_id)),'rate:'||company_id||':task:'||coalesce(task_id,t.id)];
   perform public._coordination_lock_keys(1102,array[actor::text]); perform public._coordination_lock_keys(1103,case when task_id is null then array[actor::text] else array[actor::text,t.owner_id::text] end);
   perform public._coordination_lock_keys(1104,case when task_id is null then '{}'::text[] else array[t.owner_id::text||':'||t.period] end);
   perform public._coordination_lock_keys(1105,locks||array['template:'||coalesce(template_id,(select ta.template_id from public.task_assignments ta where ta.id=t.assignment_id))]);
   perform app_private.api_revalidate_actor(actor,c);
   if task_id is not null then perform app_private.api_lock_task_scope(actor,org,task_id); end if;
   if task_id is not null then perform app_private.touch_api_month_fence(org,t.owner_id,t.period); end if;
   c:=app_private.api_require_business(true);
   if (c->'principal'->>'organizationId')::uuid<>org or not exists(select 1 from public.companies co where co.id=v_company and co.organization_id=org) then raise exception using errcode='42501',message='Contexto no autorizado'; end if;
   if task_id is not null then
     select ti.* into t from public.task_instances ti where ti.id=task_id and ti.organization_id=org for update;
     if not found or (t.id,t.company_id,t.owner_id,t.period,t.kind,t.unit,t.assignment_id,t.state_revision) is distinct from (planned_t.id,planned_t.company_id,planned_t.owner_id,planned_t.period,planned_t.kind,planned_t.unit,planned_t.assignment_id,planned_t.state_revision) then raise exception using errcode='40001',message='Cambió el ámbito de la operación; reintente'; end if;
     perform public._coordination_assert_month(t.owner_id,t.period);
   else
     perform 1 from public.task_templates tt where tt.id=template_id and tt.organization_id=org and tt.kind='operativa' and tt.unit=unit_value for update;
     if not found then raise exception using errcode='40001',message='Cambió el catálogo; reintente'; end if;
   end if;
   insert into app_private.operational_rate_heads(organization_id,company_id,template_id,instance_id) values(org,company_id,template_id,task_id) on conflict on constraint operational_rate_heads_scope_key do update set fence_epoch=app_private.operational_rate_heads.fence_epoch+1 returning * into h;
   if h.config_revision<>expected_rate then raise exception using errcode='40001',message='La configuración cambió; reintente'; end if;
   rate_version:=h.config_revision+1; now_at:=clock_timestamp(); rate_id:=gen_random_uuid();
   insert into app_private.operational_rate_versions(id,organization_id,head_id,version,effective_on,unit,unit_weight,reason,created_by,created_at) values(rate_id,org,h.id,rate_version,work_date,unit_value,coeff,reason,actor,now_at);
   update app_private.operational_rate_heads set config_revision=rate_version where id=h.id;
   insert into public.audit_events(organization_id,actor_id,action,entity_id,at,details) values(org,actor,'operational.rate.created',rate_id,now_at,jsonb_build_object('companyId',company_id,'scopeId',coalesce(template_id,task_id),'version',rate_version,'effectiveOn',work_date));
   result_data:=jsonb_build_object('contractVersion',1,'operationId',op,'kind',kind,'result',jsonb_build_object('rateId',rate_id,'scopeRevision',rate_version::text,'version',rate_version::text,'effectiveOn',work_date,'unit',unit_value,'unitWeight',coeff::text));
 else
   select * into t from public.task_instances where id=task_id and organization_id=org;
   if not found or t.kind<>'operativa' then raise exception using errcode='42501',message='Contexto no autorizado'; end if;
   -- Defer record authorization until after the shared lock plan and fence
   -- revalidation. An RR caller with a stale membership snapshot must abort
   -- with 40001 before it can reach the fresh authorization denial.
   if kind='operation.assess' and not public.can_access_instance(task_id) then raise exception using errcode='42501',message='Contexto no autorizado'; end if;
   if kind='operation.assess' and role_name<>'jefe' then raise exception using errcode='42501',message='Contexto no autorizado'; end if;
   if kind='operation.assess' and not exists(select 1 from public.profiles p where p.id=t.owner_id and p.organization_id=org) then raise exception using errcode='42501',message='Contexto no autorizado'; end if;
   people:=array(select distinct x from (select actor x union select t.owner_id union select m.profile_id from public.task_responsibility_heads rh join public.task_responsibility_members m on m.set_id=rh.set_id where rh.instance_id=t.id) q order by x);
   months:=coalesce((select jsonb_agg(jsonb_build_object('ownerId',x,'period',t.period) order by x) from unnest(people) x),'[]'::jsonb);
   select ta.* into a from public.task_assignments ta where ta.id=t.assignment_id; template_id:=a.template_id;
   locks:=array['rate:'||t.company_id||':task:'||t.id,'rate:'||t.company_id||':template:'||coalesce(template_id,t.id)];
   plan:=public._coordination_prepare(array[t.id],array[actor],people,months,locks||case when template_id is null then '{}'::text[] else array['template:'||template_id] end,'{}'::jsonb);
   perform public._coordination_acquire(plan);
   perform app_private.api_revalidate_actor(actor,c);
   perform app_private.api_lock_task_scope(actor,org,task_id);
   perform app_private.api_touch_month_fences(org,plan->'months');
   perform public._coordination_revalidate(plan);
   if kind='operation.record' and not app_private.api_can_execute(task_id,actor,work_date) then raise exception using errcode='42501',message='Contexto no autorizado'; end if;
   select * into t from public.task_instances where id=task_id and organization_id=org;
    if not found or t.state_revision<>expected_task or not public.can_access_instance(task_id) then raise exception using errcode='40001',message='La tarea o el acceso cambiaron; reintente'; end if;
   if exists(select 1 from unnest(people) person where exists(select 1 from public.monthly_closures mc where mc.owner_id=person and mc.period=t.period)) then raise exception using errcode='55000',message='GP_CLOSED_UNIT'; end if;
   if kind='operation.assess' and exists(select 1 from public.task_responsibility_heads rh join public.task_responsibility_sets rs on rs.id=rh.set_id where rh.instance_id=t.id and rs.mode='conjunta') then raise exception using errcode='0A000',message='GP_JOINT_ASSESSMENT_REQUIRES_REVIEW'; end if;
   if kind='operation.record' then
     now_at:=clock_timestamp();
     if work_date>(now_at at time zone 'America/Argentina/Buenos_Aires')::date or date_trunc('month',work_date)::date<>t.period then raise exception using errcode='22023',message='Fecha inválida'; end if;
     if not app_private.api_can_execute(task_id,actor,work_date) then raise exception using errcode='42501',message='Contexto no autorizado'; end if;
     if exists(select 1 from public.task_responsibility_heads rh join public.task_responsibility_sets rs on rs.id=rh.set_id where rh.instance_id=t.id and rs.mode='conjunta') then raise exception using errcode='0A000',message='GP_JOINT_OPERATION_REQUIRES_REVIEW'; end if;
     perform public._coordination_lock_keys(1105,locks||case when template_id is null then '{}'::text[] else array['template:'||template_id] end);
     insert into app_private.operational_rate_heads(organization_id,company_id,template_id,instance_id) values(org,t.company_id,null,t.id) on conflict on constraint operational_rate_heads_scope_key do update set fence_epoch=app_private.operational_rate_heads.fence_epoch+1;
     if template_id is not null then insert into app_private.operational_rate_heads(organization_id,company_id,template_id,instance_id) values(org,t.company_id,template_id,null) on conflict on constraint operational_rate_heads_scope_key do update set fence_epoch=app_private.operational_rate_heads.fence_epoch+1; end if;
     select v.* into chosen from app_private.operational_rate_heads rh join app_private.operational_rate_versions v on v.head_id=rh.id
       where rh.organization_id=org and rh.company_id=t.company_id and rh.instance_id=t.id and v.unit=t.unit and v.effective_on<=work_date
       order by v.effective_on desc,v.version desc limit 1;
     if not found and template_id is not null then select v.* into chosen from app_private.operational_rate_heads rh join app_private.operational_rate_versions v on v.head_id=rh.id where rh.organization_id=org and rh.company_id=t.company_id and rh.template_id=a.template_id and v.unit=t.unit and v.effective_on<=work_date order by v.effective_on desc,v.version desc limit 1; end if;
     insert into public.activity_entries(organization_id,instance_id,work_date,quantity,reference,actor_id,created_at,measurement_version,operational_rate_id,operational_unit_weight,unit_snapshot)
       values(org,t.id,work_date,amount,ref,actor,now_at,2,chosen.id,chosen.unit_weight,t.unit) returning id into assessment_id;
     update public.task_instances set state_revision=state_revision+1 where id=t.id returning state_revision into new_revision;
     insert into public.audit_events(organization_id,actor_id,action,entity_id,at,details) values(org,actor,'activity.created',assessment_id,now_at,jsonb_build_object('instance',t.id,'work_date',work_date,'quantity',amount,'measurement_version',2));
     result_data:=jsonb_build_object('contractVersion',1,'operationId',op,'kind',kind,'result',jsonb_build_object('entryId',assessment_id,'taskRevision',new_revision::text,'measurementVersion',2,'rateId',chosen.id,'unitWeight',case when chosen.id is null then null else chosen.unit_weight::text end,'weightedLoad',case when chosen.id is null then null else (amount*chosen.unit_weight)::text end));
   else
     if role_name<>'jefe' or c->'authentication'->>'aal'<>'aal2' then raise exception using errcode='42501',message='Contexto no autorizado'; end if;
      if t.state_revision<>expected_task then raise exception using errcode='40001',message='La tarea cambió; reintente'; end if;
     select revision into assessment_rev from app_private.operational_assessments where instance_id=t.id;
     assessment_rev:=coalesce(assessment_rev,0);
     if assessment_rev<>expected_assessment then raise exception using errcode='40001',message='La evaluación cambió; reintente'; end if;
     assessment_id:=gen_random_uuid(); assessment_rev:=assessment_rev+1;
     insert into app_private.operational_assessments(instance_id,organization_id,revision) values(t.id,org,assessment_rev) on conflict(instance_id) do update set revision=excluded.revision;
     insert into app_private.operational_assessment_versions(id,organization_id,instance_id,revision,quality,order_score,timeliness,observation,evaluated_by,evaluated_at) values(assessment_id,org,t.id,assessment_rev,quality_score,order_value,timely,observation,actor,clock_timestamp());
     update public.task_instances set state_revision=state_revision+1 where id=t.id returning state_revision into new_revision;
     insert into public.audit_events(organization_id,actor_id,action,entity_id,details) values(org,actor,'operational.assessed',assessment_id,jsonb_build_object('taskId',t.id,'revision',assessment_rev,'quality',quality_score,'order',order_value,'timeliness',timely));
     result_data:=jsonb_build_object('contractVersion',1,'operationId',op,'kind',kind,'result',jsonb_build_object('assessmentId',assessment_id,'assessmentRevision',assessment_rev::text,'taskRevision',new_revision::text,'quality',quality_score,'order',order_value,'timeliness',timely));
   end if;
 end if;
 insert into app_private.api_command_receipts(actor_id,operation_id,organization_id,kind,arguments,result) values(actor,op,org,kind,args,result_data);
 return result_data;
end $$;

create function api.query_v1(p jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
 declare c jsonb; actor uuid:=auth.uid(); org uuid; role_name text; kind text; f jsonb; task_id uuid; target uuid; target_date date; company_id uuid; v_company uuid; template_id uuid; v_template uuid; lim integer; cursor_value text; cursor_json jsonb; cursor_at timestamptz; cursor_id uuid; cursor_version bigint; t public.task_instances%rowtype; r app_private.api_command_receipts%rowtype; data jsonb; next_cursor text; unit_value text; total numeric; rated numeric; unrated numeric; count_entries bigint; seconds numeric; full_weighted boolean; scope_rev bigint; now_at timestamptz; newest app_private.operational_assessment_versions%rowtype;
 route_as_of date; route_subject uuid; route_company uuid; route_team uuid; route_ready_rank integer; route_due date; route_priority integer; route_weight numeric; route_scheduled date; route_data jsonb; route_items jsonb; route_count integer; route_last jsonb; route_fingerprint text;
begin
 if actor is null then raise exception using errcode='28000',message='Autenticación requerida'; end if;
 if octet_length(coalesce(p::text,''))>4096 or not app_private.api_exact_keys(p,array['contractVersion','kind','filters','cursor','limit']) or jsonb_typeof(p->'contractVersion') is distinct from 'number' or p->>'contractVersion' is distinct from '1' then raise exception using errcode='22023',message='Consulta inválida'; end if;
 if jsonb_typeof(p->'kind') is distinct from 'string' then raise exception using errcode='22023',message='Consulta inválida'; end if;
 c:=app_private.api_require_business(false); org:=(c->'principal'->>'organizationId')::uuid; role_name:=c->'principal'->>'role'; kind:=p->>'kind'; f:=p->'filters';
 if jsonb_typeof(p->'limit') is distinct from 'number' then raise exception using errcode='22023',message='Consulta inválida'; end if; lim:=app_private.api_integer(p,'limit',1,100);
 if jsonb_typeof(p->'cursor') is distinct from 'string' and jsonb_typeof(p->'cursor') is distinct from 'null' then raise exception using errcode='22023',message='Consulta inválida'; end if; cursor_value:=p->>'cursor'; if cursor_value is not null and char_length(cursor_value)>2048 then raise exception using errcode='22023',message='Consulta inválida'; end if;
 if kind='commandReceipt' then
   if not app_private.api_exact_keys(f,array['operationId']) or lim<>1 or cursor_value is not null then raise exception using errcode='22023',message='Consulta inválida'; end if;
   target:=app_private.api_uuid(f,'operationId');
 elsif kind in ('activityPage','operationalSummary','quality','readiness') then
   if not app_private.api_exact_keys(f,array['taskId']) then raise exception using errcode='22023',message='Consulta inválida'; end if;
   task_id:=app_private.api_uuid(f,'taskId');
 elsif kind='suggestedRoute' then
   if not app_private.api_exact_keys(f,array['subjectId','period','companyId','teamId','sector']) then raise exception using errcode='22023',message='Consulta inválida'; end if;
   route_subject:=app_private.api_uuid(f,'subjectId');
   if jsonb_typeof(f->'period') is distinct from 'string' or (f->>'period') !~ '^[0-9]{4}-[0-9]{2}-01$' then raise exception using errcode='22023',message='Consulta inválida'; end if;
   target_date:=app_private.api_date(f,'period');
   if (jsonb_typeof(f->'companyId') is distinct from 'string' and jsonb_typeof(f->'companyId') is distinct from 'null') or (jsonb_typeof(f->'teamId') is distinct from 'string' and jsonb_typeof(f->'teamId') is distinct from 'null') or (jsonb_typeof(f->'sector') is distinct from 'string' and jsonb_typeof(f->'sector') is distinct from 'null') then raise exception using errcode='22023',message='Consulta inválida'; end if;
   company_id:=case when f->>'companyId' is null then null else app_private.api_uuid(f,'companyId') end;
   template_id:=case when f->>'teamId' is null then null else app_private.api_uuid(f,'teamId') end;
   route_company:=company_id; route_team:=template_id;
   if jsonb_typeof(f->'sector')='string' and char_length(trim(f->>'sector')) not between 1 and 200 then raise exception using errcode='22023',message='Consulta inválida'; end if;
 elsif kind='rateHistory' then
   if not app_private.api_exact_keys(f,array['companyId','templateId','taskId'])
     or jsonb_typeof(f->'companyId') is distinct from 'string'
     or (jsonb_typeof(f->'templateId') is distinct from 'string' and jsonb_typeof(f->'templateId') is distinct from 'null')
     or (jsonb_typeof(f->'taskId') is distinct from 'string' and jsonb_typeof(f->'taskId') is distinct from 'null') then raise exception using errcode='22023',message='Filtros de historial inválidos'; end if;
   v_company:=app_private.api_uuid(f,'companyId');
   v_template:=case when f->>'templateId' is null then null else app_private.api_uuid(f,'templateId') end;
   if jsonb_typeof(f->'taskId')='string' then task_id:=app_private.api_uuid(f,'taskId'); else task_id:=null; end if;
    if (v_template is null)=(task_id is null) then raise exception using errcode='22023',message='Seleccione una plantilla o una tarea'; end if;
 elsif kind not in ('activityPage','operationalSummary','quality','rateHistory','commandReceipt','readiness','suggestedRoute') then
   raise exception using errcode='0A000',message='Consulta no disponible';
 end if;
 if kind in ('operationalSummary','quality','readiness') and (lim<>1 or cursor_value is not null) then raise exception using errcode='22023',message='Consulta inválida'; end if;
 if kind='activityPage' and cursor_value is not null then
   begin cursor_json:=convert_from(decode(translate(cursor_value,'-_','+/')||repeat('=',(4-char_length(cursor_value)%4)%4),'base64'),'UTF8')::jsonb; if not app_private.api_exact_keys(cursor_json,array['kind','taskId','createdAt','entryId']) or cursor_json->>'kind' is distinct from 'activityPage' or cursor_json->>'taskId' is distinct from task_id::text then raise exception using errcode='22023',message='Cursor inválido'; end if; cursor_at:=app_private.api_timestamp(cursor_json,'createdAt'); cursor_id:=app_private.api_uuid(cursor_json,'entryId'); exception when others then raise exception using errcode='22023',message='Consulta inválida'; end;
 end if;
 if kind='rateHistory' and cursor_value is not null then
   begin cursor_json:=convert_from(decode(translate(cursor_value,'-_','+/')||repeat('=',(4-char_length(cursor_value)%4)%4),'base64'),'UTF8')::jsonb; if not app_private.api_exact_keys(cursor_json,array['kind','companyId','templateId','taskId','version','rateId']) or cursor_json->>'kind' is distinct from 'rateHistory' or cursor_json->>'companyId' is distinct from v_company::text or cursor_json->>'templateId' is distinct from v_template::text or cursor_json->>'taskId' is distinct from task_id::text then raise exception using errcode='22023',message='Cursor inválido'; end if; cursor_version:=app_private.api_expected(cursor_json,'version'); cursor_id:=app_private.api_uuid(cursor_json,'rateId'); exception when others then raise exception using errcode='22023',message='Consulta inválida'; end;
 end if;
 if kind='suggestedRoute' and cursor_value is not null then
   begin
     cursor_json:=convert_from(decode(translate(cursor_value,'-_','+/')||repeat('=',(4-char_length(cursor_value)%4)%4),'base64'),'UTF8')::jsonb;
     if not app_private.api_exact_keys(cursor_json,array['kind','subjectId','period','companyId','teamId','sector','asOfOn','routeHash','readyRank','dueDate','priorityRank','weight','scheduledOn','taskId'])
       or cursor_json->>'kind' is distinct from 'suggestedRoute' or cursor_json->>'subjectId' is distinct from route_subject::text or cursor_json->>'period' is distinct from target_date::text
       or cursor_json->>'companyId' is distinct from route_company::text or cursor_json->>'teamId' is distinct from route_team::text or cursor_json->>'sector' is distinct from f->>'sector' then raise exception using errcode='22023',message='Cursor inválido'; end if;
     route_as_of:=app_private.api_date(cursor_json,'asOfOn'); route_ready_rank:=app_private.api_integer(cursor_json,'readyRank',0,1);
     if jsonb_typeof(cursor_json->'routeHash') is distinct from 'string' or cursor_json->>'routeHash' !~ '^[0-9a-f]{32}$' then raise exception using errcode='22023',message='Cursor inválido'; end if;
     route_due:=case when jsonb_typeof(cursor_json->'dueDate')='null' then '9999-12-31'::date else app_private.api_date(cursor_json,'dueDate') end;
     route_priority:=app_private.api_integer(cursor_json,'priorityRank',0,2);
     if jsonb_typeof(cursor_json->'weight') is distinct from 'string' or cursor_json->>'weight' !~ '^-?[0-9]+(\.[0-9]+)?$' then raise exception using errcode='22023',message='Cursor inválido'; end if;
     route_weight:=(cursor_json->>'weight')::numeric;
     route_scheduled:=case when jsonb_typeof(cursor_json->'scheduledOn')='null' then '9999-12-31'::date else app_private.api_date(cursor_json,'scheduledOn') end;
     cursor_id:=app_private.api_uuid(cursor_json,'taskId');
   exception when others then raise exception using errcode='22023',message='Consulta inválida'; end;
 end if;
 if kind='commandReceipt' then perform public._coordination_lock_keys(1102,array[actor::text]); perform public._coordination_lock_keys(1103,array[actor::text]); end if;
 perform app_private.api_revalidate_actor(actor,c);
 if kind='commandReceipt' then
   select * into r from app_private.api_command_receipts where actor_id=actor and operation_id=target;
   if found then
     if r.organization_id<>org then raise exception using errcode='42501',message='Consulta no disponible'; end if;
     if r.kind='operation.rate' then
       if role_name<>'jefe' or c->'authentication'->>'aal'<>'aal2' or not exists(select 1 from public.companies co where co.id=app_private.api_uuid(r.arguments->'payload','companyId') and co.organization_id=org) then raise exception using errcode='42501',message='Consulta no disponible'; end if;
     else
       task_id:=app_private.api_uuid(r.arguments->'payload','taskId'); perform app_private.api_lock_task_scope(actor,org,task_id); select * into t from public.task_instances where id=task_id and organization_id=org;
       if not found or not public.can_access_instance(task_id) then raise exception using errcode='42501',message='Consulta no disponible'; end if;
       if r.kind in ('task.commercialMode','task.commercialProgress','task.dependencies','task.transition') then
         if (r.kind='task.commercialMode' and (role_name<>'jefe' or c->'authentication'->>'aal'<>'aal2'))
           or (r.kind='task.dependencies' and (role_name<>'jefe' or c->'authentication'->>'aal'<>'aal2'))
           or (r.kind in ('task.commercialProgress','task.transition') and not app_private.api_task_actor_can_execute(task_id,actor,(clock_timestamp() at time zone 'America/Argentina/Buenos_Aires')::date)) then raise exception using errcode='42501',message='Consulta no disponible'; end if;
       elsif r.kind='operation.record' then target_date:=app_private.api_date(r.arguments->'payload','workDate'); if not app_private.api_can_execute(task_id,actor,target_date) then raise exception using errcode='42501',message='Consulta no disponible'; end if;
       elsif role_name<>'jefe' or c->'authentication'->>'aal'<>'aal2' then raise exception using errcode='42501',message='Consulta no disponible'; end if;
     end if;
     return jsonb_build_object('contractVersion',1,'kind',kind,'data',jsonb_build_object('found',true,'command',r.result));
   end if;
   return jsonb_build_object('contractVersion',1,'kind',kind,'data',jsonb_build_object('found',false));
 end if;
 if kind='activityPage' or kind='operationalSummary' or kind='quality' or kind='readiness' then
   if not app_private.api_exact_keys(f,array['taskId']) then raise exception using errcode='22023',message='Consulta inválida'; end if;
   task_id:=app_private.api_uuid(f,'taskId'); perform app_private.api_lock_task_scope(actor,org,task_id); select * into t from public.task_instances where id=task_id and organization_id=org;
   if not found or (kind<>'readiness' and t.kind<>'operativa') or not public.can_access_instance(task_id) then raise exception using errcode='42501',message='Consulta no disponible'; end if;
 elsif kind='suggestedRoute' then
   if cursor_json is not null then
     if route_as_of<>(clock_timestamp() at time zone 'America/Argentina/Buenos_Aires')::date then raise exception using errcode='40001',message='La fecha de la ruta cambió; recargue'; end if;
   else route_as_of:=(clock_timestamp() at time zone 'America/Argentina/Buenos_Aires')::date; end if;
   if not exists(select 1 from public.profiles p where p.id=route_subject and p.organization_id=org and p.active) or (route_subject<>actor and (role_name not in ('jefe','encargado') or not public.can_access_owner(route_subject))) then raise exception using errcode='42501',message='Consulta no disponible'; end if;
   if route_company is not null and not exists(select 1 from public.companies co where co.id=route_company and co.organization_id=org) then raise exception using errcode='42501',message='Consulta no disponible'; end if;
   if route_team is not null and not exists(select 1 from public.teams tm where tm.id=route_team and tm.organization_id=org) then raise exception using errcode='42501',message='Consulta no disponible'; end if;
   select md5(coalesce(string_agg(ti.id::text||':'||to_jsonb(ti)::text||':'||app_private.api_task_readiness(ti.id,actor)::text,'|' order by ti.id),'')) into route_fingerprint
   from public.task_instances ti left join public.task_responsibility_heads rh on rh.instance_id=ti.id and rh.organization_id=ti.organization_id
   left join public.task_responsibility_sets rs on rs.id=rh.set_id and rs.organization_id=ti.organization_id
   where ti.organization_id=org and ti.period=target_date and ti.status<>'Completada' and ti.kind='resultado'
      and not exists(select 1 from public.monthly_closures mc where mc.period=ti.period and mc.owner_id in (ti.owner_id,route_subject))
      and (ti.owner_id=route_subject or exists(select 1 from public.task_coverage_bindings cb where cb.instance_id=ti.id and cb.replacement_id=route_subject and cb.status='active'
       and cb.starts_on<=route_as_of and cb.ends_on>=route_as_of and cb.period_snapshot=ti.period and cb.company_id_snapshot=ti.company_id))
     and public.can_access_instance(ti.id) and (route_company is null or ti.company_id=route_company) and (route_team is null or ti.team_id=route_team)
     and (f->>'sector' is null or rs.sector_snapshot=trim(f->>'sector'));
   if cursor_json is not null and cursor_json->>'routeHash' is distinct from route_fingerprint then raise exception using errcode='40001',message='La ruta cambió; recargue'; end if;
 elsif kind='rateHistory' then
   if role_name<>'jefe' or c->'authentication'->>'aal'<>'aal2' then raise exception using errcode='42501',message='Consulta no disponible'; end if;
   if not exists(select 1 from public.companies co where co.organization_id=org and co.id=v_company) then raise exception using errcode='42501',message='Consulta no disponible'; end if;
   if v_template is not null and not exists(select 1 from public.task_templates tt where tt.organization_id=org and tt.id=v_template and tt.kind='operativa') then raise exception using errcode='42501',message='Consulta no disponible'; end if;
   if task_id is not null and not exists(select 1 from public.task_instances ti where ti.id=task_id and ti.organization_id=org and ti.company_id=v_company and ti.kind='operativa') then raise exception using errcode='42501',message='Consulta no disponible'; end if;
 elsif kind not in ('activityPage','operationalSummary','quality','suggestedRoute') then raise exception using errcode='0A000',message='Consulta no disponible'; end if;
 if kind='quality' and role_name<>'jefe' and t.owner_id<>actor then raise exception using errcode='42501',message='Consulta no disponible'; end if;
 if kind='quality' and role_name='jefe' and c->'authentication'->>'aal'<>'aal2' then raise exception using errcode='42501',message='Consulta no disponible'; end if;
 if kind='suggestedRoute' then
   select coalesce(jsonb_agg(page.item order by page.ready_rank,page.due_key,page.priority_rank,page.weight_key,page.scheduled_key,page.task_id),'[]'::jsonb),count(*)::integer
   into route_data,route_count from (
     select jsonb_build_object('taskId',x.id,'taskRevision',x.state_revision::text,'title',x.title,'companyId',x.company_id,'ownerId',x.owner_id,'period',x.period,
       'dueDate',x.due_date,'priority',x.priority,'weight',x.weight::text,'scheduledOn',x.scheduled_on,'ready',x.ready,
       'blockerCodes',x.blocker_codes) item,
       case when x.ready then 0 else 1 end ready_rank,coalesce(x.due_date,'9999-12-31'::date) due_key,
       case x.priority when 'Alta' then 0 when 'Media' then 1 else 2 end priority_rank,-x.weight weight_key,
       coalesce(x.scheduled_on,'9999-12-31'::date) scheduled_key,x.id task_id
     from (
       select ti.*,rd.ready,rd.blocker_codes from public.task_instances ti
       cross join lateral (select app_private.api_task_readiness(ti.id,actor) j) q
       cross join lateral (select (q.j->>'ready')::boolean ready,
         coalesce((select jsonb_agg(b->>'code') from jsonb_array_elements(q.j->'blockers') b),'[]'::jsonb) blocker_codes) rd
       left join public.task_responsibility_heads rh on rh.instance_id=ti.id and rh.organization_id=ti.organization_id
       left join public.task_responsibility_sets rs on rs.id=rh.set_id and rs.organization_id=ti.organization_id
       where ti.organization_id=org and ti.period=target_date and ti.status<>'Completada' and ti.kind='resultado'
          and not exists(select 1 from public.monthly_closures mc where mc.period=ti.period and mc.owner_id in (ti.owner_id,route_subject))
          and (ti.owner_id=route_subject or exists(select 1 from public.task_coverage_bindings cb where cb.instance_id=ti.id and cb.replacement_id=route_subject and cb.status='active'
           and cb.starts_on<=route_as_of and cb.ends_on>=route_as_of and cb.period_snapshot=ti.period and cb.company_id_snapshot=ti.company_id))
         and public.can_access_instance(ti.id)
         and (route_company is null or ti.company_id=route_company) and (route_team is null or ti.team_id=route_team)
         and (f->>'sector' is null or rs.sector_snapshot=trim(f->>'sector'))
     ) x
     where cursor_json is null or (case when x.ready then 0 else 1 end,coalesce(x.due_date,'9999-12-31'::date),
       case x.priority when 'Alta' then 0 when 'Media' then 1 else 2 end,-x.weight,coalesce(x.scheduled_on,'9999-12-31'::date),x.id)
       >(route_ready_rank,route_due,route_priority,route_weight,route_scheduled,cursor_id)
     order by ready_rank,due_key,priority_rank,weight_key,scheduled_key,task_id limit lim+1
   ) page;
   if route_count>lim then
     route_last:=route_data->(lim-1);
     next_cursor:=rtrim(translate(replace(encode(convert_to(jsonb_build_object('kind','suggestedRoute','subjectId',route_subject,'period',target_date,'companyId',route_company,'teamId',route_team,'sector',f->'sector',
       'asOfOn',route_as_of,'routeHash',route_fingerprint,'readyRank',case when (route_last->>'ready')::boolean then 0 else 1 end,'dueDate',route_last->'dueDate',
       'priorityRank',case route_last->>'priority' when 'Alta' then 0 when 'Media' then 1 else 2 end,'weight',(-((route_last->>'weight')::numeric))::text,
       'scheduledOn',route_last->'scheduledOn','taskId',route_last->>'taskId')::text,'UTF8'),'base64'),E'\n',''),'+/','-_'),'=');
     route_data:=(select coalesce(jsonb_agg(value order by ord),'[]'::jsonb) from jsonb_array_elements(route_data) with ordinality x(value,ord) where ord<=lim);
   else next_cursor:=null; end if;
   return jsonb_build_object('contractVersion',1,'kind',kind,'data',jsonb_build_object('asOfOn',route_as_of,'items',route_data,'nextCursor',next_cursor));
 elsif kind='readiness' then
   return jsonb_build_object('contractVersion',1,'kind',kind,'data',app_private.api_task_readiness(task_id,actor));
 elsif kind='activityPage' then
   select coalesce(jsonb_agg(item order by created_at desc,id desc),'[]'::jsonb) into data from (select jsonb_build_object('entryId',e.id,'taskId',e.instance_id,'workDate',e.work_date,'quantity',e.quantity,'unit',coalesce(e.unit_snapshot,t.unit),'reference',e.reference,'actorId',e.actor_id,'createdAt',e.created_at,'measurementVersion',e.measurement_version,'rateId',e.operational_rate_id,'unitWeight',case when e.operational_unit_weight is null then null else e.operational_unit_weight::text end,'weightedLoad',case when e.operational_unit_weight is null then null else (e.quantity*e.operational_unit_weight)::text end) item,e.created_at,id from public.activity_entries e where e.instance_id=task_id and (cursor_json is null or (e.created_at,e.id)<(cursor_at,cursor_id)) order by e.created_at desc,e.id desc limit lim+1) q;
   if jsonb_array_length(data)>lim then next_cursor:=rtrim(translate(replace(encode(convert_to(jsonb_build_object('kind',kind,'taskId',task_id,'createdAt',(data->(lim-1)->>'createdAt'),'entryId',(data->(lim-1)->>'entryId'))::text,'UTF8'),'base64'),E'\n',''),'+/','-_'),'='); data:= (select jsonb_agg(value order by ord) from jsonb_array_elements(data) with ordinality x(value,ord) where ord<=lim); else next_cursor:=null; end if;
   return jsonb_build_object('contractVersion',1,'kind',kind,'data',jsonb_build_object('items',data,'nextCursor',next_cursor));
 elsif kind='operationalSummary' then
   select coalesce(sum(e.quantity),0),coalesce(sum(e.quantity*e.operational_unit_weight) filter(where e.operational_unit_weight is not null),0),coalesce(sum(e.quantity) filter(where e.operational_unit_weight is null),0),count(*)
   into total,rated,unrated,count_entries from public.activity_entries e where e.instance_id=task_id;
   now_at:=clock_timestamp();
   select coalesce(sum(greatest(0,extract(epoch from (least(coalesce(s.ended_at,now_at),now_at,public._effective_session_end(s.id,now_at),coalesce(public._session_cutoff(s.id),now_at))-s.started_at)))),0) into seconds from public.task_time_sessions s where s.instance_id=task_id;
   select exists(select 1 from public.task_responsibility_heads h join public.task_responsibility_sets s on s.id=h.set_id where h.instance_id=task_id and s.mode='conjunta') into full_weighted;
   select exists(select 1 from app_private.operational_rate_heads rh join app_private.operational_rate_versions rv on rv.head_id=rh.id where rh.organization_id=org and rh.company_id=t.company_id and (rh.instance_id=t.id or (rh.template_id=(select ta.template_id from public.task_assignments ta where ta.id=t.assignment_id) and rh.instance_id is null)) and rv.unit=t.unit and rv.effective_on<=((t.period+interval '1 month - 1 day')::date) order by rv.effective_on desc,rv.version desc limit 1) into full_weighted;
   return jsonb_build_object('contractVersion',1,'kind',kind,'data',jsonb_build_object('taskId',task_id,'unit',t.unit,'movementCount',count_entries::text,'quantity',total::text,'ratedLoad',rated::text,'weightedLoad',case when unrated=0 and full_weighted then rated::text else null end,'unratedQuantity',unrated::text,'recordedSeconds',round(seconds)::bigint::text,'fullyWeighted',unrated=0 and full_weighted,'requiresJointReview',exists(select 1 from public.task_responsibility_heads h join public.task_responsibility_sets s on s.id=h.set_id where h.instance_id=task_id and s.mode='conjunta')));
 elsif kind='quality' then
   select * into newest from app_private.operational_assessment_versions where instance_id=task_id order by revision desc limit 1;
   return jsonb_build_object('contractVersion',1,'kind',kind,'data',jsonb_build_object('taskId',task_id,'current',case when newest.id is null then null else jsonb_build_object('assessmentId',newest.id,'revision',newest.revision::text,'quality',newest.quality,'order',newest.order_score,'timeliness',newest.timeliness,'mean',round((newest.quality+newest.order_score+newest.timeliness)::numeric/3,2)::text,'observation',newest.observation,'evaluatedBy',newest.evaluated_by,'evaluatedAt',newest.evaluated_at) end));
 else
   select coalesce(rh.config_revision,0) into scope_rev from (select 1) x left join app_private.operational_rate_heads rh on rh.organization_id=org and rh.company_id=v_company and rh.template_id is not distinct from v_template and rh.instance_id is not distinct from task_id;
   select coalesce(jsonb_agg(item order by version desc,id desc),'[]'::jsonb) into data from (select jsonb_build_object('rateId',v.id,'version',v.version::text,'effectiveOn',v.effective_on,'unit',v.unit,'unitWeight',v.unit_weight::text,'createdAt',v.created_at,'createdBy',v.created_by,'reason',v.reason) item,v.version,v.id from app_private.operational_rate_heads h join app_private.operational_rate_versions v on v.head_id=h.id where h.organization_id=org and h.company_id=v_company and h.template_id is not distinct from v_template and h.instance_id is not distinct from task_id and (cursor_json is null or (v.version,v.id)<(cursor_version,cursor_id)) order by v.version desc,v.id desc limit lim+1) q;
   if jsonb_array_length(data)>lim then next_cursor:=rtrim(translate(replace(encode(convert_to(jsonb_build_object('kind',kind,'companyId',v_company,'templateId',v_template,'taskId',task_id,'version',(data->(lim-1)->>'version'),'rateId',(data->(lim-1)->>'rateId'))::text,'UTF8'),'base64'),E'\n',''),'+/','-_'),'='); data:=(select jsonb_agg(value order by ord) from jsonb_array_elements(data) with ordinality x(value,ord) where ord<=lim); else next_cursor:=null; end if;
   return jsonb_build_object('contractVersion',1,'kind',kind,'data',jsonb_build_object('scopeRevision',coalesce(scope_rev,0)::text,'items',coalesce(data,'[]'::jsonb),'nextCursor',next_cursor));
 end if;
end $$;

create function app_private.api_task_actor_can_execute(p_task uuid,p_actor uuid,p_at date) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.task_instances t where t.id=p_task and t.owner_id=p_actor)
  or exists(select 1 from public.task_responsibility_heads h join public.task_responsibility_members m on m.set_id=h.set_id and m.organization_id=h.organization_id where h.instance_id=p_task and m.profile_id=p_actor)
  or exists(select 1 from public.task_instances t join public.task_coverage_bindings b on b.instance_id=t.id and b.organization_id=t.organization_id
    where t.id=p_task and b.replacement_id=p_actor and b.responsible_id=t.owner_id and b.status='active'
      and b.period_snapshot=t.period and b.company_id_snapshot=t.company_id and p_at between b.starts_on and b.ends_on)
  or exists(select 1 from public.task_instances t join public.employee_absences a on a.owner_id=t.owner_id and a.organization_id=t.organization_id
    join public.employee_absence_companies c on c.absence_id=a.id and c.organization_id=a.organization_id and c.company_id=t.company_id
    where t.id=p_task and a.replacement_id=p_actor and a.cancelled_at is null and a.authorization_sealed
      and p_at between a.starts_on and a.ends_on and t.period between date_trunc('month',a.starts_on)::date and date_trunc('month',a.ends_on)::date)
$$;
create function app_private.api_task_readiness(p_task uuid,p_actor uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare t public.task_instances%rowtype; tr app_private.task_tracking%rowtype; today date;
 dep jsonb; visible jsonb; hidden boolean; pending boolean; blockers jsonb; gr bigint;
begin
 select * into t from public.task_instances where id=p_task;
 if not found then raise exception using errcode='42501',message='Consulta no disponible'; end if;
 today:=(clock_timestamp() at time zone 'America/Argentina/Buenos_Aires')::date;
 select * into tr from app_private.task_tracking where instance_id=t.id and organization_id=t.organization_id;
 select coalesce(g.config_revision,0) into gr from (select 1) x left join app_private.task_dependency_graphs g
   on g.organization_id=t.organization_id and g.company_id=t.company_id and g.period=t.period;
 select exists(select 1 from app_private.task_dependencies d join public.task_instances p on p.id=d.prerequisite_id and p.organization_id=d.organization_id
   where d.instance_id=t.id and d.organization_id=t.organization_id and p.status<>'Completada') into pending;
 select coalesce(jsonb_agg(jsonb_build_object('taskId',p.id,'title',p.title,'status',p.status) order by p.id),'[]'::jsonb)
 into visible from app_private.task_dependencies d join public.task_instances p on p.id=d.prerequisite_id and p.organization_id=d.organization_id
 where d.instance_id=t.id and d.organization_id=t.organization_id and public.can_access_instance(p.id);
 select exists(select 1 from app_private.task_dependencies d join public.task_instances p on p.id=d.prerequisite_id and p.organization_id=d.organization_id
   where d.instance_id=t.id and d.organization_id=t.organization_id and not public.can_access_instance(p.id)) into hidden;
 select coalesce(jsonb_agg(jsonb_build_object('code',x.code,'availableFrom',x.available_from) order by x.code),'[]'::jsonb) into blockers
 from (select 'external_wait'::text code,null::date available_from where t.blocked_by is not null
       union all select 'available_later',tr.available_from where tr.available_from>today
       union all select 'dependencies_pending',null::date where pending) x;
 return jsonb_build_object('taskId',t.id,'taskRevision',t.state_revision::text,'graphRevision',coalesce(gr,0)::text,'asOfOn',today,
   'ready',jsonb_array_length(blockers)=0,'blockers',blockers,'visibleDependencies',coalesce(visible,'[]'::jsonb),
   'hasHiddenDependencies',coalesce(hidden,false),'commercial',jsonb_build_object('enabled',coalesce(tr.commercial_enabled,false),
   'throughDay',case when tr.commercial_enabled then tr.through_day else null end,'completionSuggested',coalesce(tr.commercial_enabled and tr.through_day=30,false)));
end $$;
create function app_private._coordination_acquire_m22b(p_plan jsonb,p_write_fences boolean default true) returns void
language plpgsql security definer set search_path='' as $$
declare s jsonb:=p_plan->'snapshot'; k text; org uuid; actor_org uuid; comp uuid; per date; t public.task_instances%rowtype; graph app_private.task_dependency_graphs%rowtype; r jsonb; fence_profile uuid; fence_epoch bigint;
begin
 if p_plan->>'actor' is distinct from auth.uid()::text or jsonb_typeof(p_plan->'input')<>'object' then raise exception 'Plan interno inválido'; end if;
  select p.organization_id into actor_org from public.profiles p where p.id=auth.uid();
  if actor_org is null then raise exception using errcode='42501',message='Contexto no autorizado'; end if;
  if nullif(p_plan->>'org','') is not null and (p_plan->>'org')::uuid is distinct from actor_org then raise exception using errcode='42501',message='Contexto no autorizado'; end if;
  if exists(select 1 from jsonb_array_elements_text(coalesce(p_plan->'profiles','[]'::jsonb)) x left join public.profiles p on p.id=x::uuid where p.id is null or p.organization_id is distinct from actor_org)
     or exists(select 1 from jsonb_array_elements_text(coalesce(p_plan->'actors','[]'::jsonb)) x left join public.profiles p on p.id=x::uuid where p.id is null or p.organization_id is distinct from actor_org)
     or exists(select 1 from jsonb_array_elements(coalesce(p_plan->'months','[]'::jsonb)) x left join public.profiles p on p.id=(x->>'ownerId')::uuid where p.id is null or p.organization_id is distinct from actor_org)
     or exists(select 1 from jsonb_array_elements_text(coalesce(p_plan->'tasks','[]'::jsonb)) x left join public.task_instances planned_task on planned_task.id=x::uuid where planned_task.id is null or planned_task.organization_id is distinct from actor_org)
     or (p_plan->'input'->'scope' ? 'membership' and (not exists(select 1 from public.companies co where co.id=(p_plan->'input'->'scope'->>'company')::uuid and co.organization_id=actor_org) or not exists(select 1 from public.profiles p where p.id=(p_plan->'input'->'scope'->>'membership')::uuid and p.organization_id=actor_org))) then
    raise exception using errcode='42501',message='Contexto no autorizado';
  end if;
 if p_plan->'input'->'scope' ? 'membership' then
  perform public._coordination_lock_keys(1102,array(select x::text from jsonb_array_elements_text(p_plan->'actors') x));
  perform public._coordination_lock_keys(1103,array(select x::text from jsonb_array_elements_text(p_plan->'profiles') x));
  perform public._coordination_lock_keys(1104,array(select distinct (x->>'ownerId')||':'||(x->>'period') from jsonb_array_elements(p_plan->'months') x));
  perform public._coordination_lock_keys(1105,array(select x from jsonb_array_elements_text(p_plan->'catalog') x));
 else
  perform public._coordination_lock_keys(1102,array(select x::text from jsonb_array_elements_text(p_plan->'actors') x));
  perform public._coordination_lock_keys(1103,array(select x::text from jsonb_array_elements_text(p_plan->'profiles') x));
  perform public._coordination_lock_keys(1104,array(select distinct (x->>'ownerId')||':'||(x->>'period') from jsonb_array_elements(p_plan->'months') x));
  perform public._coordination_lock_keys(1105,array(select x from jsonb_array_elements_text(p_plan->'catalog') x));
  if p_write_fences and auth.uid() is not null then
    insert into app_private.api_membership_fences(organization_id,profile_id,fence_epoch)
     select actor_org,x::uuid,1 from jsonb_array_elements_text(p_plan->'profiles') x
    on conflict(organization_id,profile_id) do update set fence_epoch=app_private.api_membership_fences.fence_epoch+1;
  end if;
 end if;
 for r in select value from jsonb_array_elements(s->'profiles') order by value->>'id' loop
  perform 1 from public.profiles where id=(r->>'id')::uuid for share;
 end loop;
 -- Read-only replay acquisition must still serialize authorization against
 -- membership/profile writers. Lock existing fences only; never create or
 -- increment one on a replay path. A stale RR tuple raises 40001 naturally.
 if not p_write_fences then
   org:=actor_org;
  for fence_profile in select x::uuid from jsonb_array_elements_text(p_plan->'profiles') x order by x loop
   select f.fence_epoch into fence_epoch from app_private.api_membership_fences f
    where f.organization_id=org and f.profile_id=fence_profile for share;
   if not found then raise exception using errcode='42501',message='Contexto no autorizado'; end if;
  end loop;
 end if;
 for k in select x from jsonb_array_elements_text(p_plan->'catalog') x where x like 'dependencies:%' order by x loop
  for t in select ti.* from public.task_instances ti where ti.id=any(array(select x::uuid from jsonb_array_elements_text(p_plan->'tasks') x))
     and k='dependencies:'||ti.organization_id||':'||ti.company_id||':'||ti.period order by ti.organization_id,ti.company_id,ti.period loop
   if p_write_fences then
    insert into app_private.task_dependency_graphs(organization_id,company_id,period)
      values(t.organization_id,t.company_id,t.period)
      on conflict(organization_id,company_id,period) do update set fence_epoch=app_private.task_dependency_graphs.fence_epoch+1
      returning * into graph;
   end if;
   perform 1 from app_private.task_dependency_graphs where organization_id=t.organization_id and company_id=t.company_id and period=t.period for update;
  end loop;
 end loop;
 for r in select value from jsonb_array_elements(s->'templates') loop perform 1 from public.task_templates where id=(r->>'id')::uuid for update; end loop;
 for r in select value from jsonb_array_elements(s->'assignments') loop perform 1 from public.task_assignments where id=(r->>'id')::uuid for update; end loop;
 if s->'request'<>'null'::jsonb then perform 1 from public.onboarding_requests where id=(s->'request'->>'id')::uuid for update; end if;
 for r in select value from jsonb_array_elements(s->'plans') loop perform 1 from public.task_coverage_plans where id=(r->>'id')::uuid for update; end loop;
 for r in select value from jsonb_array_elements(s->'absences') loop perform 1 from public.employee_absences where id=(r->>'id')::uuid for update; end loop;
 for r in select value from jsonb_array_elements(s->'tasks') loop perform 1 from public.task_instances where id=(r->>'id')::uuid for update; end loop;
 for r in select value from jsonb_array_elements(s->'sets') loop perform 1 from public.task_responsibility_sets where id=(r->>'id')::uuid for update; end loop;
 for r in select value from jsonb_array_elements(s->'heads') loop perform 1 from public.task_responsibility_heads where instance_id=(r->>'instance_id')::uuid for update; end loop;
 for r in select value from jsonb_array_elements(s->'bindings') loop perform 1 from public.task_coverage_bindings where id=(r->>'id')::uuid for update; end loop;
 for r in select value from jsonb_array_elements(s->'sessions') loop perform 1 from public.task_time_sessions where id=(r->>'id')::uuid for update; end loop;
 if s->'privateNote'<>'null'::jsonb then perform 1 from public.task_private_block_notes where id=(s->'privateNote'->>'id')::uuid for update; end if;
 perform public._coordination_revalidate(p_plan);
end $$;

create function public._coordination_apply_task_control_m22b(
 p_instance uuid,p_kind text,p_next text,p_check text,p_done boolean,p_note text,p_reason text,p_expected_revision bigint,p_confirm_commercial_completion boolean default false,p_require_executor boolean default false,p_prepared_plan jsonb default null
) returns bigint
language plpgsql security definer set search_path='' as $$
#variable_conflict use_column
declare plan jsonb; planned public.task_instances%rowtype; t public.task_instances%rowtype;
 checklist_next jsonb; next_status text; stop_all boolean; start_clock boolean; changes_check boolean;
 session_actors uuid[]; current_actors uuid[]; actor_locks uuid[]; profile_locks uuid[];
 month_locks jsonb; s public.task_time_sessions%rowtype; at_time timestamptz; result_revision bigint;
 contribution text; binding uuid; absence uuid; open_actor_session public.task_time_sessions%rowtype;
 active_count integer; supervisor boolean; reason text; readiness jsonb; protected_task boolean; commercial_on boolean;
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
      and not coalesce((select commercial_enabled from app_private.task_tracking where instance_id=planned.id),false)
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
 if p_prepared_plan is null then
   plan:=public._coordination_prepare(array[planned.id],actor_locks,profile_locks,month_locks,case when planned.kind='resultado' then array['dependencies:'||planned.organization_id||':'||planned.company_id||':'||planned.period] else array[]::text[] end,jsonb_build_object('stopSessions',stop_all or start_clock));
   perform app_private._coordination_acquire_m22b(plan);
 else
   plan:=p_prepared_plan;
 end if;
 -- Centralize the month fence for API and legacy task-control writers. The
 -- complete graph/actor plan is already acquired, and no task/session row lock
 -- has been taken yet, preserving the shared graph-before-task order.
 perform app_private.api_touch_month_fences(planned.organization_id,plan->'months');
 perform 1 from public.task_instances i where i.id=planned.id for update;
 perform 1 from public.task_time_sessions s where s.instance_id=planned.id and s.ended_at is null order by s.instance_id,s.actor_id,s.id for update;
 select * into t from public.task_instances where id=planned.id;
 if (t.id,t.organization_id,t.assignment_id,t.company_id,t.owner_id,t.team_id,t.period,t.state_revision,t.status,t.checklist,t.blocked_by)
   is distinct from (planned.id,planned.organization_id,planned.assignment_id,planned.company_id,planned.owner_id,planned.team_id,planned.period,planned.state_revision,planned.status,planned.checklist,planned.blocked_by)
   then raise exception using errcode='40001',message='La tarea cambió; recargue y reintente en otra transacción'; end if;
 select coalesce(array_agg(distinct s.actor_id order by s.actor_id),array[]::uuid[])
  into current_actors from public.task_time_sessions s where s.instance_id=t.id and s.ended_at is null and (stop_all or start_clock);
 if current_actors is distinct from session_actors then raise exception using errcode='40001',message='Cambió el conjunto de cronómetros; reintente'; end if;
 if t.state_revision<>p_expected_revision then raise exception using errcode='40001',message='La tarea cambió; reintente'; end if;
 at_time:=clock_timestamp();
 if not public._can_access_instance_at(t.id,at_time) then raise exception 'Sin permiso'; end if;
 select coalesce(tr.commercial_enabled,false), (tr.commercial_enabled or tr.available_from is not null or exists(select 1 from app_private.task_dependencies d where d.instance_id=t.id or d.prerequisite_id=t.id)) into commercial_on,protected_task from app_private.task_tracking tr where tr.instance_id=t.id;
 if not found then commercial_on:=false; protected_task:=exists(select 1 from app_private.task_dependencies d where d.instance_id=t.id or d.prerequisite_id=t.id); end if;
 if (protected_task or p_require_executor) and not app_private.api_task_actor_can_execute(t.id,auth.uid(),(at_time at time zone 'America/Argentina/Buenos_Aires')::date) then raise exception using errcode='42501',message='Sin permiso'; end if;
 if p_confirm_commercial_completion and next_status<>'Completada' then raise exception using errcode='22023',message='Confirmación inválida'; end if;
 if next_status='En curso' and t.blocked_by is not null then raise exception 'Desbloquee la tarea antes de iniciarla'; end if;
 if start_clock or next_status='Completada' then
   readiness:=app_private.api_task_readiness(t.id,auth.uid());
   if not coalesce((readiness->>'ready')::boolean,false) then raise exception using errcode='55000',message='GP_NOT_READY'; end if;
 end if;
 if next_status='Completada' and commercial_on and (not p_confirm_commercial_completion or (select through_day from app_private.task_tracking where instance_id=t.id)<>30) then raise exception using errcode='55000',message='GP_NOT_READY'; end if;
  foreach profile_item in array actor_locks loop
    if exists(select 1 from public.monthly_closures c where c.owner_id=profile_item and c.period=t.period) then
      raise exception using errcode='55000',message='El período está cerrado (GP_CLOSED_UNIT)';
    end if;
  end loop;
 perform public._coordination_assert_month(t.owner_id,t.period);
 if exists(select 1 from public.monthly_closures c join public.task_responsibility_heads h on h.instance_id=t.id
    join public.task_responsibility_members m on m.set_id=h.set_id
     where m.profile_id=c.owner_id and c.period=t.period) then raise exception using errcode='55000',message='El período está cerrado (GP_CLOSED_UNIT)'; end if;
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
       jsonb_build_object('instance',t.id,'executor',s.actor_id,'started_at',s.started_at,'ended_at',public._effective_session_end(s.id,at_time)));
   end loop;
 end if;
 if (t.status='Completada' and next_status<>'Completada') or (stop_all and next_status='Pendiente' and reason is not null) then
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
   jsonb_build_object('from',t.status,'to',next_status,'step',p_check,'done',p_done,'note',p_note,'executor',auth.uid()));
 if next_status='Completada' and t.status<>'Completada' and (p_require_executor or protected_task or commercial_on) then insert into app_private.task_completion_events(organization_id,instance_id,task_revision,completed_by,completed_at) values(t.organization_id,t.id,result_revision,auth.uid(),at_time); end if;
 return result_revision;
end $$;


create or replace function public._coordination_apply_task_control(
 p_instance uuid,p_kind text,p_next text,p_check text,p_done boolean,p_note text,p_reason text,p_expected_revision bigint
) returns bigint language plpgsql security definer set search_path='' as $$
begin return public._coordination_apply_task_control_m22b(p_instance,p_kind,p_next,p_check,p_done,p_note,p_reason,p_expected_revision,false,false); end $$;
create or replace function public.assign_task_responsibility(
 p_instance uuid,p_members jsonb,p_reason text,p_expected_revision bigint,p_idempotency_key uuid
) returns bigint
language plpgsql security definer set search_path='' as $$
declare plan jsonb; actor uuid:=auth.uid(); org uuid; t public.task_instances%rowtype; planned public.task_instances%rowtype;
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
 plan:=public._coordination_prepare(array[planned.id],array[actor],profiles,month_keys,case when planned.kind='resultado' then array['dependencies:'||planned.organization_id||':'||planned.company_id||':'||planned.period] else array[]::text[] end,'{}'::jsonb);
 perform app_private._coordination_acquire_m22b(plan);
 perform 1 from public.task_instances where id=p_instance for update;
 perform 1 from public.task_responsibility_heads h where h.instance_id=p_instance for update;
 select * into t from public.task_instances where id=p_instance for update;
 if (t.id,t.organization_id,t.assignment_id,t.company_id,t.owner_id,t.team_id,t.period,t.state_revision)
   is distinct from (planned.id,planned.organization_id,planned.assignment_id,planned.company_id,planned.owner_id,planned.team_id,planned.period,planned.state_revision)
   then raise exception using errcode='40001',message='La ocurrencia cambió; reintente desde una transacción nueva'; end if;
 perform public._coordination_can_assign(t.id,p_members);
 if exists(select 1 from app_private.task_tracking tr where tr.instance_id=t.id and tr.commercial_enabled) or exists(select 1 from app_private.task_dependencies d where d.instance_id=t.id or d.prerequisite_id=t.id) then raise exception using errcode='55000',message='Retire el seguimiento comercial y las dependencias antes de asignar responsabilidad conjunta'; end if;
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

create or replace function public.start_task_timer(
 p_instance uuid,p_expected_revision bigint,p_operation_id uuid,p_switch boolean default false
) returns uuid
language plpgsql security definer set search_path='' as $$
declare plan jsonb; actor uuid:=auth.uid(); planned public.task_instances%rowtype; t public.task_instances%rowtype;
 old_session public.task_time_sessions%rowtype; target_session public.task_time_sessions%rowtype;
 source_task public.task_instances%rowtype; new_session uuid; binding uuid; absence uuid; old_ended timestamptz;
 cached public.task_mutation_receipts%rowtype; args jsonb; result uuid; at_time timestamptz;
 actors uuid[]; profiles_to_lock uuid[]; months jsonb; active_count integer; contribution text; readiness jsonb;
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
 plan:=public._coordination_prepare(array[planned.id,source_task.id],actors,profiles_to_lock,months,array(select distinct 'dependencies:'||ti.organization_id||':'||ti.company_id||':'||ti.period from public.task_instances ti where ti.id=any(array[planned.id,source_task.id]) and ti.kind='resultado'),'{}'::jsonb);
 perform app_private._coordination_acquire_m22b(plan);
 -- Legacy timer starts must serialize with monthly closure just like API writers.
 -- Acquire the complete coordination plan first, then touch its month fences
 -- before task/session row locks so the global graph-before-task order remains intact.
 perform app_private.api_touch_month_fences(planned.organization_id,plan->'months');
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
 if (exists(select 1 from app_private.task_tracking tr where tr.instance_id=t.id and (tr.commercial_enabled or tr.available_from is not null)) or exists(select 1 from app_private.task_dependencies d where d.instance_id=t.id or d.prerequisite_id=t.id))
   and not app_private.api_task_actor_can_execute(t.id,actor,(at_time at time zone 'America/Argentina/Buenos_Aires')::date) then raise exception using errcode='42501',message='Sin permiso'; end if;
 readiness:=app_private.api_task_readiness(t.id,actor);
 if not coalesce((readiness->>'ready')::boolean,false) then raise exception using errcode='55000',message='GP_NOT_READY'; end if;
 if t.state_revision<>p_expected_revision then raise exception using errcode='40001',message='La tarea cambió; reintente'; end if;
 if t.status='Completada' or t.blocked_by is not null then raise exception 'La tarea no admite cronómetro'; end if;
 perform public._coordination_assert_month(t.owner_id,t.period);
 if exists(select 1 from public.monthly_closures c where c.owner_id=any(profiles_to_lock) and c.period=t.period) then
   raise exception 'El período del participante está cerrado';
 end if;
 select * into target_session from public.task_time_sessions where instance_id=t.id and actor_id=actor and ended_at is null;
 if target_session.id is not null and public._session_cutoff(target_session.id) is not null and public._session_cutoff(target_session.id)<=at_time then
   old_ended:=greatest(target_session.started_at,public._effective_session_end(target_session.id,at_time));
   update public.task_time_sessions set ended_at=old_ended where id=target_session.id;
   update public.task_instances set state_revision=state_revision+1 where id=t.id;
   insert into public.audit_events(organization_id,actor_id,action,entity_id,at,details) values(t.organization_id,actor,'task.timer_expired',target_session.id,at_time,jsonb_build_object('instance',t.id,'session',target_session.id,'executor',actor,'ended_at',old_ended,'absence',target_session.absence_id,'binding',target_session.coverage_binding_id));
   old_session.id:=null; target_session.id:=null;
 end if;
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

create function app_private.api_task_command(p jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); c jsonb; org uuid; role_name text; kind text; op uuid; payload jsonb; revisions jsonb; task_id uuid;
 task_row public.task_instances%rowtype; planned public.task_instances%rowtype; tracking app_private.task_tracking%rowtype; graph_key text; expected_task bigint; expected_graph bigint;
 enabled boolean; requested_day integer; next_status text; reason text; confirm_completion boolean; available date; ids uuid[]; old_ids uuid[]; old_available date;
 people uuid[]; actors uuid[]; months jsonb; plan jsonb; args jsonb; old_result jsonb; result_data jsonb; existing app_private.api_command_receipts%rowtype;
 at_time timestamptz; new_revision bigint; graph_revision bigint; ready jsonb; changed boolean; cycle_found boolean; completion_id uuid;
begin
 if actor is null then raise exception using errcode='28000',message='Autenticación requerida'; end if;
 if octet_length(coalesce(p::text,''))>32768 or not app_private.api_exact_keys(p,array['contractVersion','operationId','kind','expectedRevisions','payload']) or jsonb_typeof(p->'contractVersion') is distinct from 'number' or p->>'contractVersion' is distinct from '1' or jsonb_typeof(p->'kind') is distinct from 'string' then raise exception using errcode='22023',message='Solicitud inválida'; end if;
 kind:=p->>'kind'; payload:=p->'payload'; revisions:=p->'expectedRevisions'; op:=app_private.api_uuid(p,'operationId');
 if kind not in ('task.commercialMode','task.commercialProgress','task.dependencies','task.transition') then raise exception using errcode='0A000',message='Operación no disponible'; end if;
 if jsonb_typeof(payload) is distinct from 'object' or jsonb_typeof(revisions) is distinct from 'object' then raise exception using errcode='22023',message='Solicitud inválida'; end if;
 if kind='task.commercialMode' then
  if not app_private.api_exact_keys(payload,array['taskId','enabled']) or jsonb_typeof(payload->'enabled') is distinct from 'boolean' then raise exception using errcode='22023',message='Solicitud inválida'; end if;
  enabled:=(payload->>'enabled')::boolean;
 elsif kind='task.commercialProgress' then
  if not app_private.api_exact_keys(payload,array['taskId','throughDay']) then raise exception using errcode='22023',message='Solicitud inválida'; end if;
  requested_day:=app_private.api_integer(payload,'throughDay',0,30);
 elsif kind='task.dependencies' then
  if not app_private.api_exact_keys(payload,array['taskId','prerequisiteIds','availableFrom']) or jsonb_typeof(payload->'prerequisiteIds') is distinct from 'array' or jsonb_array_length(payload->'prerequisiteIds')>100 or (jsonb_typeof(payload->'availableFrom') is distinct from 'string' and jsonb_typeof(payload->'availableFrom') is distinct from 'null') then raise exception using errcode='22023',message='Solicitud inválida'; end if;
  if jsonb_typeof(payload->'availableFrom')='string' then available:=app_private.api_date(jsonb_build_object('availableFrom',payload->>'availableFrom'),'availableFrom'); end if;
  if exists(select 1 from jsonb_array_elements(payload->'prerequisiteIds') x where jsonb_typeof(x) is distinct from 'string' or x#>>'{}' !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$') then raise exception using errcode='22023',message='Solicitud inválida'; end if;
  select coalesce(array_agg(x::uuid order by ord),array[]::uuid[]) into ids from jsonb_array_elements_text(payload->'prerequisiteIds') with ordinality e(x,ord);
  if cardinality(ids)<>(select count(distinct x) from unnest(ids) x) then raise exception using errcode='22023',message='Solicitud inválida'; end if;
 elsif kind='task.transition' then
  if not app_private.api_exact_keys(payload,array['taskId','status','reason','confirmCommercialCompletion']) or jsonb_typeof(payload->'status') is distinct from 'string' or payload->>'status' not in ('Pendiente','En curso','Completada') or (jsonb_typeof(payload->'reason') is distinct from 'string' and jsonb_typeof(payload->'reason') is distinct from 'null') or jsonb_typeof(payload->'confirmCommercialCompletion') is distinct from 'boolean' then raise exception using errcode='22023',message='Solicitud inválida'; end if;
  next_status:=payload->>'status'; confirm_completion:=(payload->>'confirmCommercialCompletion')::boolean;
  if jsonb_typeof(payload->'reason')='string' then reason:=app_private.api_text(payload,'reason',5,1000); end if;
 end if;
 task_id:=app_private.api_uuid(payload,'taskId'); expected_task:=app_private.api_expected(revisions,'task:'||task_id);
 if kind='task.dependencies' then
  if (select count(*) from jsonb_object_keys(revisions))<>2 or exists(select 1 from jsonb_object_keys(revisions) k where k<>'task:'||task_id and k !~ '^graph:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}:[0-9]{4}-[0-9]{2}-01$') then raise exception using errcode='22023',message='Solicitud inválida'; end if;
 else
  if not app_private.api_exact_keys(revisions,array['task:'||task_id]) then raise exception using errcode='22023',message='Solicitud inválida'; end if;
 end if;
 args:=p; c:=app_private.api_require_business(false); org:=(c->'principal'->>'organizationId')::uuid; role_name:=c->'principal'->>'role';
 if kind='task.commercialMode' and (role_name<>'jefe' or c->'authentication'->>'aal'<>'aal2') then raise exception using errcode='42501',message='Contexto no autorizado'; end if;
 select * into planned from public.task_instances where id=task_id and organization_id=org;
 if not found then raise exception using errcode='42501',message='Contexto no autorizado'; end if;
 graph_key:='graph:'||planned.company_id||':'||planned.period;
 if kind='task.dependencies' then
  if not app_private.api_exact_keys(revisions,array['task:'||task_id,graph_key]) then raise exception using errcode='22023',message='Solicitud inválida'; end if;
  expected_graph:=app_private.api_expected(revisions,graph_key);
  if planned.kind<>'resultado' or (available is not null and date_trunc('month',available)::date<>planned.period) or task_id=any(ids) then raise exception using errcode='22023',message='Solicitud inválida'; end if;
 end if;
 perform public._coordination_receipt_lock(actor,op);
 select * into existing from app_private.api_command_receipts where actor_id=actor and operation_id=op;
 if existing.actor_id is not null then
  select coalesce(array_agg(distinct x order by x),array[]::uuid[]) into people from (
   select actor x union select planned.owner_id
   union select m.profile_id from public.task_responsibility_heads h join public.task_responsibility_members m on m.set_id=h.set_id and m.organization_id=h.organization_id where h.instance_id=task_id
   union select b.responsible_id from public.task_coverage_bindings b where b.instance_id=task_id and b.status='active'
   union select b.replacement_id from public.task_coverage_bindings b where b.instance_id=task_id and b.status='active'
   union select s.actor_id from public.task_time_sessions s where s.instance_id=task_id and s.ended_at is null
   union select a.owner_id from public.task_time_sessions s join public.employee_absences a on a.id=s.absence_id where s.instance_id=task_id and s.ended_at is null
  ) q;
  months:=coalesce((select jsonb_agg(jsonb_build_object('ownerId',x,'period',planned.period) order by x) from unnest(people) x),'[]'::jsonb);
  actors:=array[actor];
  plan:=public._coordination_prepare(array[task_id],actors,people,months,array[]::text[],jsonb_build_object('stopSessions',kind='task.transition'));
  perform app_private._coordination_acquire_m22b(plan,false);
  perform app_private.api_revalidate_actor(actor,c);
  select * into task_row from public.task_instances where id=task_id and organization_id=org;
  if not found or existing.organization_id<>org or not public.can_access_instance(task_id) or role_name='auditor' then raise exception using errcode='42501',message='Contexto no autorizado'; end if;
  if kind in ('task.dependencies','task.commercialMode') then
   if role_name<>'jefe' or c->'authentication'->>'aal'<>'aal2' then raise exception using errcode='42501',message='Contexto no autorizado'; end if;
  elsif not app_private.api_task_actor_can_execute(task_id,actor,(clock_timestamp() at time zone 'America/Argentina/Buenos_Aires')::date) then
   raise exception using errcode='42501',message='Contexto no autorizado';
  end if;
  if existing.kind<>kind or existing.arguments is distinct from args then raise exception using errcode='40001',message='Identificador de operación ya utilizado'; end if;
  return existing.result;
 end if;
 select coalesce(array_agg(distinct x order by x),array[]::uuid[]) into people from (
  select actor x union select planned.owner_id union select m.profile_id from public.task_responsibility_heads h join public.task_responsibility_members m on m.set_id=h.set_id where h.instance_id=task_id
 ) q;
 months:=coalesce((select jsonb_agg(jsonb_build_object('ownerId',x,'period',planned.period) order by x) from unnest(people) x),'[]'::jsonb);
 actors:=array[actor];
 if kind='task.transition' and existing.actor_id is null then
  plan:=public._coordination_prepare(array[task_id],actors,people,months,case when planned.kind='resultado' then array['dependencies:'||org||':'||planned.company_id||':'||planned.period] else array[]::text[] end,jsonb_build_object('stopSessions',true));
  perform app_private._coordination_acquire_m22b(plan);
  perform app_private.api_revalidate_actor(actor,c); task_row:=planned;
  if not public.can_access_instance(task_id) or role_name='auditor'
     or not app_private.api_task_actor_can_execute(task_id,actor,(clock_timestamp() at time zone 'America/Argentina/Buenos_Aires')::date) then
   raise exception using errcode='42501',message='Contexto no autorizado';
  end if;
 else
  plan:=public._coordination_prepare(array[task_id],actors,people,months,case when existing.actor_id is null and kind in ('task.dependencies','task.commercialMode','task.commercialProgress') then array['dependencies:'||org||':'||planned.company_id||':'||planned.period] else array[]::text[] end,jsonb_build_object('stopSessions',kind='task.transition'));
  perform app_private._coordination_acquire_m22b(plan);
  if existing.actor_id is null and kind<>'task.transition' then perform app_private.api_touch_month_fences(org,plan->'months'); end if;
  perform app_private.api_revalidate_actor(actor,c);
  select * into task_row from public.task_instances where id=task_id and organization_id=org;
  if not found or (task_row.id,task_row.company_id,task_row.owner_id,task_row.period,task_row.kind,task_row.state_revision)
   is distinct from (planned.id,planned.company_id,planned.owner_id,planned.period,planned.kind,planned.state_revision) then raise exception using errcode='40001',message='La tarea cambió; reintente'; end if;
  if existing.actor_id is null and exists(select 1 from unnest(people) x join public.monthly_closures mc on mc.owner_id=x and mc.period=task_row.period) then raise exception using errcode='55000',message='El período está cerrado (GP_CLOSED_UNIT)'; end if;
  if not public.can_access_instance(task_id) or role_name='auditor' then raise exception using errcode='42501',message='Contexto no autorizado'; end if;
  -- API transition has a stable authorization SQLSTATE. Keep the legacy core's
  -- P0001 behavior for direct legacy callers, but reauthorize v1 after its
  -- locks/fences and before delegating to that core.
  if kind='task.transition' and not app_private.api_task_actor_can_execute(task_id,actor,(clock_timestamp() at time zone 'America/Argentina/Buenos_Aires')::date) then raise exception using errcode='42501',message='Contexto no autorizado'; end if;
 end if;
 if existing.actor_id is not null then
  if existing.kind<>kind or existing.arguments is distinct from args then raise exception using errcode='40001',message='Identificador de operación ya utilizado'; end if;
  if kind='task.dependencies' then
   if role_name<>'jefe' or c->'authentication'->>'aal'<>'aal2' then raise exception using errcode='42501',message='Contexto no autorizado'; end if;
  elsif kind='task.commercialMode' then
   if role_name<>'jefe' or c->'authentication'->>'aal'<>'aal2' then raise exception using errcode='42501',message='Contexto no autorizado'; end if;
  else
   if not app_private.api_task_actor_can_execute(task_id,actor,(clock_timestamp() at time zone 'America/Argentina/Buenos_Aires')::date) then raise exception using errcode='42501',message='Contexto no autorizado'; end if;
  end if;
  return existing.result;
 end if;
 insert into app_private.api_operation_fences(actor_id,operation_id) values(actor,op) on conflict(actor_id,operation_id) do update set fence_epoch=app_private.api_operation_fences.fence_epoch+1;
 if kind<>'task.transition' and task_row.state_revision<>expected_task then raise exception using errcode='40001',message='La tarea cambió; reintente'; end if;
 at_time:=clock_timestamp();
 if kind='task.dependencies' then
  if task_row.status='Completada' then raise exception using errcode='55000',message='No se pueden cambiar dependencias de una tarea completada'; end if;
  if role_name<>'jefe' or c->'authentication'->>'aal'<>'aal2' or task_row.kind<>'resultado' or exists(select 1 from public.task_responsibility_heads h join public.task_responsibility_sets s on s.id=h.set_id where h.instance_id=task_id and s.mode='conjunta') then raise exception using errcode='42501',message='Contexto no autorizado'; end if;
  insert into app_private.task_dependency_graphs(organization_id,company_id,period) values(org,task_row.company_id,task_row.period) on conflict do nothing;
  select config_revision into graph_revision from app_private.task_dependency_graphs where organization_id=org and company_id=task_row.company_id and period=task_row.period;
  if graph_revision<>expected_graph then raise exception using errcode='40001',message='El grafo cambió; recargue'; end if;
  if exists(select 1 from unnest(ids) x left join public.task_instances q on q.id=x and q.organization_id=org where q.id is null or q.kind<>'resultado' or q.company_id<>task_row.company_id or q.period<>task_row.period or exists(select 1 from public.task_responsibility_heads h join public.task_responsibility_sets s on s.id=h.set_id where h.instance_id=q.id and s.mode='conjunta')) then raise exception using errcode='22023',message='Dependencia inválida'; end if;
  with recursive edges(src,dst) as (select d.instance_id,d.prerequisite_id from app_private.task_dependencies d where d.organization_id=org and d.company_id=task_row.company_id and d.period=task_row.period and d.instance_id<>task_id), walk(id,path) as (select x,array[x] from unnest(ids) x union all select e.dst,w.path||e.dst from walk w join edges e on e.src=w.id where not e.dst=any(w.path)) select exists(select 1 from walk where id=task_id) into cycle_found;
  if cycle_found then raise exception using errcode='22023',message='Dependencias cíclicas'; end if;
  select coalesce(array_agg(prerequisite_id order by prerequisite_id),array[]::uuid[]) into old_ids from app_private.task_dependencies where instance_id=task_id;
  old_available:=(select available_from from app_private.task_tracking where instance_id=task_id);
  select old_ids is distinct from (select coalesce(array_agg(x order by x),array[]::uuid[]) from unnest(ids) x) or old_available is distinct from available into changed;
  if changed then
   delete from app_private.task_dependencies where instance_id=task_id;
   insert into app_private.task_dependencies(organization_id,company_id,period,instance_id,prerequisite_id) select org,task_row.company_id,task_row.period,task_id,x from unnest(ids) x;
   insert into app_private.task_tracking(instance_id,organization_id,available_from) values(task_id,org,available) on conflict(instance_id) do update set available_from=excluded.available_from;
   new_revision:=task_row.state_revision+1; update public.task_instances set state_revision=new_revision where id=task_id;
   update app_private.task_dependency_graphs set config_revision=config_revision+1 where organization_id=org and company_id=task_row.company_id and period=task_row.period returning config_revision into graph_revision;
   insert into app_private.task_tracking_events(organization_id,instance_id,task_revision,kind,previous_value,next_value,actor_id,at) values(org,task_id,new_revision,'dependencies',jsonb_build_object('prerequisiteIds',old_ids,'availableFrom',old_available),jsonb_build_object('prerequisiteIds',ids,'availableFrom',available),actor,at_time);
  else new_revision:=task_row.state_revision; end if;
  result_data:=jsonb_build_object('taskId',task_id,'taskRevision',new_revision::text,'graphRevision',graph_revision::text);
 elsif kind in ('task.commercialMode','task.commercialProgress') then
  if task_row.kind<>'resultado' or task_row.status='Completada' or exists(select 1 from public.task_responsibility_heads h join public.task_responsibility_sets s on s.id=h.set_id where h.instance_id=task_id and s.mode='conjunta') then raise exception using errcode='55000',message='Seguimiento comercial no disponible'; end if;
  if kind='task.commercialMode' then
   if role_name<>'jefe' or c->'authentication'->>'aal'<>'aal2' then raise exception using errcode='42501',message='Contexto no autorizado'; end if;
  elsif not app_private.api_task_actor_can_execute(task_id,actor,(at_time at time zone 'America/Argentina/Buenos_Aires')::date) then raise exception using errcode='42501',message='Contexto no autorizado'; end if;
  insert into app_private.task_tracking(instance_id,organization_id) values(task_id,org) on conflict(instance_id) do nothing;
  if kind='task.commercialMode' then
   select * into tracking from app_private.task_tracking where instance_id=task_id;
   if enabled is distinct from (select commercial_enabled from app_private.task_tracking where instance_id=task_id) then
    if enabled then update app_private.task_tracking set commercial_enabled=true,through_day=0,progress_by=actor,progress_at=at_time where instance_id=task_id;
    else update app_private.task_tracking set commercial_enabled=false,through_day=null,progress_by=null,progress_at=null where instance_id=task_id; end if;
    new_revision:=task_row.state_revision+1; update public.task_instances set state_revision=new_revision where id=task_id;
    insert into app_private.task_tracking_events(organization_id,instance_id,task_revision,kind,previous_value,next_value,actor_id,at) values(org,task_id,new_revision,'commercial_mode',jsonb_build_object('enabled',tracking.commercial_enabled,'throughDay',tracking.through_day),jsonb_build_object('enabled',enabled,'throughDay',case when enabled then coalesce(tracking.through_day,0) else null end),actor,at_time);
   else new_revision:=task_row.state_revision; end if;
   result_data:=jsonb_build_object('taskId',task_id,'taskRevision',new_revision::text,'enabled',enabled,'throughDay',case when enabled then (select through_day from app_private.task_tracking where instance_id=task_id) else null end);
  else
   if not coalesce((select commercial_enabled from app_private.task_tracking where instance_id=task_id),false) then raise exception using errcode='55000',message='Seguimiento comercial no habilitado'; end if;
   if requested_day is distinct from (select tr.through_day from app_private.task_tracking tr where tr.instance_id=task_id) then
    old_result:=jsonb_build_object('throughDay',(select through_day from app_private.task_tracking where instance_id=task_id));
    update app_private.task_tracking set through_day=requested_day,progress_by=actor,progress_at=at_time where instance_id=task_id;
    new_revision:=task_row.state_revision+1; update public.task_instances set state_revision=new_revision where id=task_id;
    insert into app_private.task_tracking_events(organization_id,instance_id,task_revision,kind,previous_value,next_value,actor_id,at) values(org,task_id,new_revision,'commercial_progress',old_result,jsonb_build_object('throughDay',requested_day),actor,at_time);
   else new_revision:=task_row.state_revision; end if;
   result_data:=jsonb_build_object('taskId',task_id,'taskRevision',new_revision::text,'throughDay',requested_day,'completionSuggested',requested_day=30);
  end if;
 elsif kind='task.transition' then
  if confirm_completion and (next_status<>'Completada' or not coalesce((select commercial_enabled from app_private.task_tracking where instance_id=task_id),false)) then raise exception using errcode='22023',message='Confirmación inválida'; end if;
  new_revision:=public._coordination_apply_task_control_m22b(task_id,'transition',next_status,null,null,null,reason,expected_task,confirm_completion,true,plan);
  select id into completion_id from app_private.task_completion_events where instance_id=task_id and task_revision=new_revision;
  result_data:=jsonb_build_object('taskId',task_id,'taskRevision',new_revision::text,'status',next_status,'completionEventId',completion_id);
 end if;
 result_data:=jsonb_build_object('contractVersion',1,'operationId',op,'kind',kind,'result',result_data);
 insert into app_private.api_command_receipts(actor_id,operation_id,organization_id,kind,arguments,result) values(actor,op,org,kind,args,result_data);
 insert into public.audit_events(organization_id,actor_id,action,entity_id,at,details) values(org,actor,'task.tracking.command',task_id,at_time,jsonb_build_object('kind',kind,'taskRevision',result_data->'result'->>'taskRevision'));
 return result_data;
end $$;

alter function api.command_v1(jsonb) rename to command_v1_a;
revoke all on function api.command_v1_a(jsonb) from public,anon,authenticated,service_role;
create function api.command_v1(p jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare k text;
begin
 if jsonb_typeof(p->'kind')='string' then k:=p->>'kind'; else return api.command_v1_a(p); end if;
 if k in ('task.commercialMode','task.commercialProgress','task.dependencies','task.transition') then return app_private.api_task_command(p); end if;
 return api.command_v1_a(p);
end $$;

revoke all on function app_private.api_task_command(jsonb) from public,anon,authenticated,service_role;
revoke all on function app_private.api_require_business(boolean),app_private.api_exact_keys(jsonb,text[]),app_private.api_text(jsonb,text,integer,integer),app_private.api_date(jsonb,text),app_private.api_timestamp(jsonb,text),app_private.api_uuid(jsonb,text),app_private.api_expected(jsonb,text),app_private.api_integer(jsonb,text,integer,integer),app_private.api_can_execute(uuid,uuid,date),app_private.api_task_actor_can_execute(uuid,uuid,date),app_private.api_task_readiness(uuid,uuid),app_private._coordination_acquire_m22b(jsonb,boolean),app_private.touch_api_month_fence(uuid,uuid,date),app_private.guard_api_month_close_fence(),app_private.api_revalidate_actor(uuid,jsonb),app_private.api_lock_task_scope(uuid,uuid,uuid),app_private.api_touch_month_fences(uuid,jsonb) from public,anon,authenticated,service_role;
revoke all on function app_private.api_require_business(boolean),app_private.api_exact_keys(jsonb,text[]),app_private.api_text(jsonb,text,integer,integer),app_private.api_date(jsonb,text),app_private.api_timestamp(jsonb,text),app_private.api_uuid(jsonb,text),app_private.api_expected(jsonb,text),app_private.api_integer(jsonb,text,integer,integer),app_private.api_can_execute(uuid,uuid,date),app_private.api_task_actor_can_execute(uuid,uuid,date),app_private.api_task_readiness(uuid,uuid),app_private._coordination_acquire_m22b(jsonb,boolean),app_private.touch_api_month_fence(uuid,uuid,date),app_private.guard_api_month_close_fence(),app_private.api_revalidate_actor(uuid,jsonb),app_private.api_lock_task_scope(uuid,uuid,uuid),app_private.api_touch_month_fences(uuid,jsonb) from public,anon,authenticated,service_role;
revoke all on function api.command_v1(jsonb),api.query_v1(jsonb) from public,anon,authenticated,service_role;
grant execute on function api.command_v1(jsonb),api.query_v1(jsonb) to authenticated;

-- M2.2C: versioned definitions and private coordination heads. This remains
-- part of the single, still-unapplied 014 candidate; no historical migration
-- is rewritten and no existing definition or occurrence is backfilled.
alter table public.task_templates add column measurement_version smallint not null default 1 check(measurement_version in (1,2));
alter table public.task_template_versions add column measurement_version smallint not null default 1 check(measurement_version in (1,2));
alter table public.task_assignments add column measurement_version smallint not null default 1 check(measurement_version in (1,2));
alter table public.task_instances add column measurement_version smallint not null default 1 check(measurement_version in (1,2));
alter table public.task_assignments add column definition_revision bigint not null default 0 check(definition_revision>=0);
alter table public.task_template_versions add column effective_on date;
alter table public.task_template_versions add column created_by uuid;
alter table public.task_template_versions add column reason text;
alter table public.task_template_versions add constraint task_template_versions_created_by_org_fk
 foreign key(created_by,organization_id) references public.profiles(id,organization_id);

-- Replace only old positive target/weight guards; preserve kind/schedule/history
-- checks and impose the v1/v2 union explicitly (including NULL semantics).
do $$ declare r record; begin
 for r in select c.conrelid::regclass rel,c.conname from pg_constraint c
  where c.conrelid in ('public.task_templates'::regclass,'public.task_template_versions'::regclass,'public.task_assignments'::regclass,'public.task_instances'::regclass)
    and c.contype='c' and (pg_get_constraintdef(c.oid) ilike '%weight%' or pg_get_constraintdef(c.oid) ilike '%monthly_target%' or pg_get_constraintdef(c.oid) ilike '%target%')
 loop execute format('alter table %s drop constraint %I',r.rel,r.conname); end loop;
end $$;
alter table public.task_templates alter column weight drop not null;
alter table public.task_template_versions alter column weight drop not null;
alter table public.task_assignments alter column weight drop not null;
alter table public.task_instances alter column weight drop not null;
alter table public.task_templates add constraint task_templates_measurement_shape check(
 (kind='resultado' and measurement_version=1 and weight is not null and weight>0 and weight<=100 and jsonb_typeof(checklist)='array') or
 (kind='operativa' and measurement_version=1 and weight is not null and weight>0 and weight<=100 and monthly_target is not null and monthly_target>0 and nullif(trim(unit),'') is not null) or
 (kind='operativa' and measurement_version=2 and weight is null and monthly_target is null and nullif(trim(unit),'') is not null and char_length(trim(unit)) between 1 and 80 and checklist='[]'::jsonb));
alter table public.task_template_versions add constraint task_template_versions_measurement_shape check(
 (kind='resultado' and measurement_version=1 and weight is not null and weight>0 and weight<=100) or
 (kind='operativa' and measurement_version=1 and weight is not null and weight>0 and weight<=100 and monthly_target is not null and monthly_target>0 and nullif(trim(unit),'') is not null) or
 (kind='operativa' and measurement_version=2 and weight is null and monthly_target is null and nullif(trim(unit),'') is not null and char_length(trim(unit)) between 1 and 80 and checklist='[]'::jsonb));
alter table public.task_assignments add constraint task_assignments_measurement_shape check(
 (kind='resultado' and measurement_version=1 and weight is not null and weight>0 and weight<=100) or
 (kind='operativa' and measurement_version=1 and weight is not null and weight>0 and weight<=100 and target is not null and target>0 and nullif(trim(unit),'') is not null) or
 (kind='operativa' and measurement_version=2 and weight is null and target is null and nullif(trim(unit),'') is not null and char_length(trim(unit)) between 1 and 80 and checklist='[]'::jsonb));
alter table public.task_instances add constraint task_instances_measurement_shape check(
 (kind='resultado' and measurement_version=1 and weight is not null and weight>0 and weight<=100) or
 (kind='operativa' and measurement_version=1 and weight is not null and weight>0 and weight<=100 and target is not null and target>0 and nullif(trim(unit),'') is not null and status<>'Completada') or
 (kind='operativa' and measurement_version=2 and weight is null and target is null and nullif(trim(unit),'') is not null and char_length(trim(unit)) between 1 and 80 and checklist='[]'::jsonb and status<>'Completada'));
alter table public.task_template_versions add constraint task_template_versions_publication_metadata check(
 (effective_on is null and created_by is null and reason is null) or
 (effective_on is not null and isfinite(effective_on) and created_by is not null and reason is not null and char_length(app_private.normalize_context_name(reason)) between 5 and 1000));
create function app_private.guard_v2_assignment_insert() returns trigger
language plpgsql security definer set search_path='' as $$
declare mv smallint;
begin
 if new.template_version_id is not null then
  select measurement_version into mv from public.task_template_versions where id=new.template_version_id and organization_id=new.organization_id;
  if mv is null then raise exception using errcode='22023',message='Revisión de catálogo inválida'; end if;
  new.measurement_version:=mv;
 end if;
 return new;
end $$;
create trigger task_assignment_measurement_version before insert on public.task_assignments for each row execute function app_private.guard_v2_assignment_insert();
create function app_private.guard_task_instance_measurement_version() returns trigger
language plpgsql security definer set search_path='' as $$
declare mv smallint;
begin
 select measurement_version into mv from public.task_assignments where id=new.assignment_id and organization_id=new.organization_id;
 if mv is null then raise exception using errcode='22023',message='Asignación inválida'; end if;
 new.measurement_version:=mv;
 return new;
end $$;
create trigger task_instance_measurement_version before insert on public.task_instances for each row execute function app_private.guard_task_instance_measurement_version();

create table app_private.api_catalogue_heads(
 organization_id uuid primary key references public.organizations(id),revision bigint not null default 0 check(revision>=0),fence_epoch bigint not null default 0 check(fence_epoch>=0));
create table app_private.api_onboarding_owner_heads(
 organization_id uuid not null,owner_id uuid not null,revision bigint not null default 0 check(revision>=0),fence_epoch bigint not null default 0 check(fence_epoch>=0),
 primary key(organization_id,owner_id),foreign key(owner_id,organization_id) references public.profiles(id,organization_id));
create table app_private.api_creation_heads(
 organization_id uuid not null,owner_id uuid not null,revision bigint not null default 0 check(revision>=0),fence_epoch bigint not null default 0 check(fence_epoch>=0),
 primary key(organization_id,owner_id),foreign key(owner_id,organization_id) references public.profiles(id,organization_id));
create table app_private.assignment_parameterization(
 assignment_id uuid primary key,organization_id uuid not null,pending boolean not null default true,created_by uuid not null,created_at timestamptz not null default clock_timestamp(),
 foreign key(assignment_id,organization_id) references public.task_assignments(id,organization_id),foreign key(created_by,organization_id) references public.profiles(id,organization_id));
alter table app_private.api_catalogue_heads enable row level security;
alter table app_private.api_onboarding_owner_heads enable row level security;
alter table app_private.api_creation_heads enable row level security;
alter table app_private.assignment_parameterization enable row level security;
revoke all on app_private.api_catalogue_heads,app_private.api_onboarding_owner_heads,app_private.api_creation_heads,app_private.assignment_parameterization from public,anon,authenticated,service_role;

-- Historical drafts remain byte-for-byte intact and are visible only to their
-- author. Submitted-version/review reads stay under the existing, narrower
-- policies until the private API projection is used.
drop policy if exists onboarding_requests_read on public.onboarding_requests;
create policy onboarding_requests_read on public.onboarding_requests for select to authenticated using(owner_id=auth.uid());
drop policy if exists onboarding_read on public.onboarding_progress;
create policy onboarding_read on public.onboarding_progress for select to authenticated using(profile_id=auth.uid());

create function app_private.api_validate_definition_v2(p_definition jsonb) returns void
language plpgsql immutable set search_path='' as $$
declare k text; item jsonb; seen uuid[]:='{}'; weight_n numeric;
begin
 if jsonb_typeof(p_definition) is distinct from 'object' or jsonb_typeof(p_definition->'kind') is distinct from 'string' then raise exception using errcode='22023',message='Definición inválida'; end if;
 k:=p_definition->>'kind';
 if k='resultado' then
  if not app_private.api_exact_keys(p_definition,array['kind','title','objective','sector','weight','checklist']) then raise exception using errcode='22023',message='Definición inválida'; end if;
  perform app_private.api_text(p_definition,'title',1,200); perform app_private.api_text(p_definition,'objective',0,4000); perform app_private.api_text(p_definition,'sector',1,200);
  if jsonb_typeof(p_definition->'weight') is distinct from 'string' or p_definition->>'weight' !~ '^(0|[1-9][0-9]*)(\.[0-9]{1,6})?$' then raise exception using errcode='22023',message='Definición inválida'; end if;
  weight_n:=(p_definition->>'weight')::numeric; if weight_n<=0 or weight_n>100 then raise exception using errcode='22023',message='Definición inválida'; end if;
  if jsonb_typeof(p_definition->'checklist') is distinct from 'array' or jsonb_array_length(p_definition->'checklist')>100 then raise exception using errcode='22023',message='Definición inválida'; end if;
  for item in select value from jsonb_array_elements(p_definition->'checklist') loop
   if not app_private.api_exact_keys(item,array['id','text']) then raise exception using errcode='22023',message='Definición inválida'; end if;
   if jsonb_typeof(item->'id') is distinct from 'string' or item->>'id' !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then raise exception using errcode='22023',message='Definición inválida'; end if;
   if (item->>'id')::uuid=any(seen) then raise exception using errcode='22023',message='Definición inválida'; end if;
   seen:=array_append(seen,(item->>'id')::uuid); perform app_private.api_text(item,'text',1,1000);
  end loop;
 elsif k='operativa' then
  if not app_private.api_exact_keys(p_definition,array['kind','title','objective','sector','unit']) then raise exception using errcode='22023',message='Definición inválida'; end if;
  perform app_private.api_text(p_definition,'title',1,200); perform app_private.api_text(p_definition,'objective',0,4000); perform app_private.api_text(p_definition,'sector',1,200);
  perform app_private.api_text(p_definition,'unit',1,80);
 else raise exception using errcode='22023',message='Definición inválida'; end if;
end $$;

create function app_private.api_catalogue_command(p jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); c jsonb; org uuid; op uuid; k text; payload jsonb; expected jsonb; args jsonb; existing app_private.api_command_receipts%rowtype;
 template_id_v uuid; version_id uuid; current_version integer; catalog_rev bigint; expected_catalog bigint; expected_template bigint; definition jsonb; title_v text; objective_v text; sector_v text; kind_v text; weight_v numeric; unit_v text; checklist_v jsonb; effective_v date; requested_effective date; reason_v text; result_v jsonb; role_v text;
begin
 if jsonb_typeof(p) is distinct from 'object' or not app_private.api_exact_keys(p,array['contractVersion','operationId','kind','expectedRevisions','payload']) or jsonb_typeof(p->'contractVersion') is distinct from 'number' or (p->>'contractVersion')<>'1' then raise exception using errcode='22023',message='Solicitud inválida'; end if;
 k:=p->>'kind'; if k not in ('catalogue.create','catalogue.revise','catalogue.weight') then raise exception using errcode='0A000',message='Operación no disponible'; end if;
 op:=app_private.api_uuid(p,'operationId'); payload:=p->'payload'; expected:=p->'expectedRevisions';
 if jsonb_typeof(expected) is distinct from 'object' then raise exception using errcode='22023',message='Solicitud inválida'; end if;
 if k='catalogue.create' then
  if not app_private.api_exact_keys(payload,array['definition','effectiveOn','reason']) then raise exception using errcode='22023',message='Solicitud inválida'; end if;
 else
  if k='catalogue.revise' and not app_private.api_exact_keys(payload,array['templateId','definition','effectiveOn','reason']) or k='catalogue.weight' and not app_private.api_exact_keys(payload,array['templateId','weight','effectiveOn','reason']) then raise exception using errcode='22023',message='Solicitud inválida'; end if;
  template_id_v:=app_private.api_uuid(payload,'templateId');
 end if;
 requested_effective:=app_private.api_date(payload,'effectiveOn'); reason_v:=app_private.api_text(payload,'reason',5,1000);
 if k='catalogue.weight' then
  if jsonb_typeof(payload->'weight') is distinct from 'string' or payload->>'weight' !~ '^(0|[1-9][0-9]*)(\.[0-9]{1,6})?$' then raise exception using errcode='22023',message='Solicitud inválida'; end if;
  weight_v:=(payload->>'weight')::numeric; if weight_v<=0 or weight_v>100 then raise exception using errcode='22023',message='Solicitud inválida'; end if;
 else
  definition:=payload->'definition'; perform app_private.api_validate_definition_v2(definition);
  kind_v:=definition->>'kind'; title_v:=app_private.api_text(definition,'title',1,200); objective_v:=app_private.api_text(definition,'objective',0,4000); sector_v:=app_private.api_text(definition,'sector',1,200);
  if kind_v='resultado' then weight_v:=(definition->>'weight')::numeric; checklist_v:=definition->'checklist'; else unit_v:=app_private.api_text(definition,'unit',1,80); checklist_v:='[]'::jsonb; end if;
 end if;
 c:=app_private.api_require_business(true); org:=(c->'principal'->>'organizationId')::uuid; role_v:=c->'principal'->>'role';
 if actor is null or role_v<>'jefe' then raise exception using errcode='42501',message='Contexto no autorizado'; end if;
 if k='catalogue.create' then
  if (select count(*) from jsonb_object_keys(expected))<>1 or not (expected ? ('catalogue:'||org)) then raise exception using errcode='22023',message='Revisiones inválidas'; end if;
  expected_catalog:=app_private.api_expected(expected,'catalogue:'||org);
 else
  if (select count(*) from jsonb_object_keys(expected))<>2 or not (expected ? ('catalogue:'||org)) or not (expected ? ('catalogue:'||template_id_v)) then raise exception using errcode='22023',message='Revisiones inválidas'; end if;
  expected_catalog:=app_private.api_expected(expected,'catalogue:'||org); expected_template:=app_private.api_expected(expected,'catalogue:'||template_id_v);
 end if;
 args:=jsonb_build_object('kind',k,'payload',payload,'expectedRevisions',expected); perform public._coordination_receipt_lock(actor,op);
 select * into existing from app_private.api_command_receipts where actor_id=actor and operation_id=op;
 perform public._coordination_lock_keys(1102,array[actor::text]);
 perform public._coordination_lock_keys(1105,array['catalogue:'||org]||case when template_id_v is null then '{}'::text[] else array['template:'||template_id_v] end);
 c:=app_private.api_require_business(true);
 if (c->'principal'->>'organizationId')::uuid<>org then raise exception using errcode='42501',message='Contexto no autorizado'; end if;
 perform 1 from public.profiles p where p.id=actor and p.organization_id=org and p.active and p.role='jefe' for share;
 if not found then raise exception using errcode='42501',message='Contexto no autorizado'; end if;
 if existing.actor_id is not null then
  if existing.kind<>k or existing.arguments is distinct from args then raise exception using errcode='40001',message='Identificador de operación ya utilizado'; end if;
  return existing.result;
 end if;
 insert into app_private.api_catalogue_heads(organization_id) values(org) on conflict(organization_id) do update set fence_epoch=app_private.api_catalogue_heads.fence_epoch+1;
 select revision into catalog_rev from app_private.api_catalogue_heads where organization_id=org for update;
 insert into app_private.api_operation_fences(actor_id,operation_id) values(actor,op);
 if expected_catalog<>catalog_rev then raise exception using errcode='40001',message='El catálogo cambió; recargue'; end if;
 if k='catalogue.create' then
  if exists(select 1 from public.task_template_versions v where v.organization_id=org and lower(regexp_replace(trim(v.title),'\s+',' ','g'))=lower(regexp_replace(title_v,'\s+',' ','g'))) then raise exception using errcode='22023',message='Ese proceso ya existe'; end if;
  insert into public.task_templates(organization_id,title,kind,weight,unit,monthly_target,checklist,version,measurement_version)
   values(org,title_v,kind_v,weight_v,unit_v,null,checklist_v,1,case when kind_v='operativa' then 2 else 1 end) returning id into template_id_v;
  current_version:=1;
 else
  select version,kind into current_version,kind_v from public.task_templates where id=template_id_v and organization_id=org and active for update;
  if not found then raise exception using errcode='42501',message='Contexto no autorizado'; end if;
  if expected_template<>current_version then raise exception using errcode='40001',message='La plantilla cambió; recargue'; end if;
  select v.effective_on into effective_v from public.task_template_versions v where v.template_id=template_id_v and v.organization_id=org order by v.version desc limit 1;
  if k='catalogue.weight' then
   if kind_v<>'resultado' then raise exception using errcode='22023',message='El peso sólo aplica a resultados'; end if;
   select v.title,v.objective,v.sector,v.checklist,v.unit into title_v,objective_v,sector_v,checklist_v,unit_v from public.task_template_versions v where v.template_id=template_id_v and v.organization_id=org order by v.version desc limit 1;
  else
   if definition->>'kind' is distinct from kind_v then raise exception using errcode='22023',message='No se puede cambiar el tipo de plantilla'; end if;
  end if;
  if effective_v is not null and requested_effective<effective_v then raise exception using errcode='22023',message='La vigencia no puede retroceder'; end if;
  current_version:=current_version+1;
  update public.task_templates set title=coalesce(title_v,title),kind=kind_v,weight=weight_v,unit=unit_v,monthly_target=null,checklist=coalesce(checklist_v,'[]'::jsonb),version=current_version,measurement_version=case when kind_v='operativa' then 2 else 1 end where id=template_id_v and organization_id=org;
 end if;
 insert into public.task_template_versions(organization_id,template_id,version,title,objective,sector,kind,weight,unit,monthly_target,checklist,measurement_version,effective_on,created_by,reason)
 values(org,template_id_v,current_version,title_v,objective_v,sector_v,kind_v,weight_v,unit_v,null,coalesce(checklist_v,'[]'::jsonb),case when kind_v='operativa' then 2 else 1 end,requested_effective,actor,reason_v) returning id into version_id;
 update app_private.api_catalogue_heads set revision=revision+1 where organization_id=org returning revision into catalog_rev;
 result_v:=jsonb_build_object('contractVersion',1,'operationId',op,'kind',k,'result',jsonb_build_object('templateId',template_id_v,'versionId',version_id,'version',current_version::text,'catalogueRevision',catalog_rev::text));
 insert into app_private.api_command_receipts(actor_id,operation_id,organization_id,kind,arguments,result) values(actor,op,org,k,args,result_v);
 insert into public.audit_events(organization_id,actor_id,action,entity_id,at,details) values(org,actor,k,template_id_v,clock_timestamp(),jsonb_build_object('version',current_version));
 return result_v;
end $$;

alter function api.command_v1(jsonb) rename to command_v1_b;
revoke all on function api.command_v1_b(jsonb) from public,anon,authenticated,service_role;
create function api.command_v1(p jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare k text;
begin
 if jsonb_typeof(p->'kind')='string' then k:=p->>'kind'; else return api.command_v1_b(p); end if;
 if k in ('catalogue.create','catalogue.revise','catalogue.weight') then return app_private.api_catalogue_command(p); end if;
 return api.command_v1_b(p);
end $$;

-- Legacy writers keep their v1 contract and fail closed when pointed at a v2
-- definition. The v2 API inserts fixed snapshots directly under its own plan.
alter function public.create_catalog_assignment(uuid,uuid,uuid,uuid,date,integer,text) rename to create_catalog_assignment_legacy;
revoke all on function public.create_catalog_assignment_legacy(uuid,uuid,uuid,uuid,date,integer,text) from public,anon,authenticated,service_role;
create function public.create_catalog_assignment(p_template uuid,p_company uuid,p_owner uuid,p_team uuid,p_period date,p_due_day integer,p_frequency text) returns uuid
language plpgsql security definer set search_path='' as $$
declare result_id uuid;
begin
 if exists(select 1 from public.task_templates where id=p_template and organization_id=public.actor_org() and measurement_version=2) then raise exception using errcode='0A000',message='La versión requiere API de creación'; end if;
 result_id:=public.create_catalog_assignment_legacy(p_template,p_company,p_owner,p_team,p_period,p_due_day,p_frequency); return result_id;
end $$;
revoke all on function public.create_catalog_assignment(uuid,uuid,uuid,uuid,date,integer,text) from public,anon,authenticated,service_role;
grant execute on function public.create_catalog_assignment(uuid,uuid,uuid,uuid,date,integer,text) to authenticated;

alter function public.update_template_weight(uuid,numeric) rename to update_template_weight_legacy;
revoke all on function public.update_template_weight_legacy(uuid,numeric) from public,anon,authenticated,service_role;
create function public.update_template_weight(p_template uuid,p_weight numeric) returns void
language plpgsql security definer set search_path='' as $$
begin
 if exists(select 1 from public.task_templates where id=p_template and organization_id=public.actor_org() and measurement_version=2) then raise exception using errcode='0A000',message='La versión requiere API de catálogo'; end if;
 perform public.update_template_weight_legacy(p_template,p_weight);
end $$;
revoke all on function public.update_template_weight(uuid,numeric) from public,anon,authenticated,service_role;
grant execute on function public.update_template_weight(uuid,numeric) to authenticated;

alter function public.approve_onboarding(uuid,integer,jsonb) rename to approve_onboarding_legacy;
revoke all on function public.approve_onboarding_legacy(uuid,integer,jsonb) from public,anon,authenticated,service_role;
create function public.approve_onboarding(p_request uuid,p_expected_revision integer,p_weight_overrides jsonb default '{}'::jsonb) returns integer
language plpgsql security definer set search_path='' as $$
declare payload_v jsonb; org_v uuid; status_v text; revision_v integer; activation_count integer;
begin
 perform public.require_privileged_session(); if public.actor_role()<>'jefe' then raise exception using errcode='42501',message='Contexto no autorizado'; end if;
 select r.organization_id,r.status,r.current_revision,v.payload into org_v,status_v,revision_v,payload_v from public.onboarding_requests r join public.onboarding_request_versions v on v.request_id=r.id and v.revision=r.current_revision where r.id=p_request and r.organization_id=public.actor_org();
 if not found or revision_v is distinct from p_expected_revision then raise exception using errcode='40001',message='Solicitud o revisión desactualizada'; end if;
 if payload_v ? 'schemaVersion' and payload_v->>'schemaVersion'='2' then raise exception using errcode='0A000',message='La revisión requiere API de inducción'; end if;
 if exists(select 1 from jsonb_array_elements(coalesce(payload_v->'lines','[]'::jsonb)) l join public.task_template_versions tv on tv.id=nullif(l->>'template_version_id','')::uuid where tv.measurement_version=2) then raise exception using errcode='0A000',message='La revisión requiere API de inducción'; end if;
 if status_v='approved' then select count(*)::integer into activation_count from public.onboarding_activations where request_id=p_request; return activation_count; end if;
 if status_v<>'submitted' then raise exception using errcode='40001',message='Solicitud o revisión desactualizada'; end if;
 return public.approve_onboarding_legacy(p_request,p_expected_revision,p_weight_overrides);
end $$;
revoke all on function public.approve_onboarding(uuid,integer,jsonb) from public,anon,authenticated,service_role;
grant execute on function public.approve_onboarding(uuid,integer,jsonb) to authenticated;

alter function api.query_v1(jsonb) rename to query_v1_b;
revoke all on function api.query_v1_b(jsonb) from public,anon,authenticated,service_role;
create function api.query_v1(p jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare k text; c_result jsonb;
begin
 if jsonb_typeof(p->'kind')='string' then k:=p->>'kind'; else return api.query_v1_b(p); end if;
 if k in ('cataloguePage','catalogueHistory','commandReceipt') then
  c_result:=app_private.api_catalogue_query(p); if c_result is not null then return c_result; end if;
 end if;
 return api.query_v1_b(p);
end $$;

create function app_private.api_catalogue_definition(p_version uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare v public.task_template_versions%rowtype;
begin
 select * into v from public.task_template_versions where id=p_version;
 if not found then return null; end if;
 if v.kind='operativa' and v.measurement_version=2 then
  return jsonb_build_object('kind',v.kind,'title',v.title,'objective',v.objective,'sector',v.sector,'unit',v.unit);
 elsif v.kind='resultado' then
  return jsonb_build_object('kind',v.kind,'title',v.title,'objective',v.objective,'sector',v.sector,'weight',v.weight::text,'checklist',coalesce((select jsonb_agg(jsonb_build_object('text',coalesce(x->>'text',case when jsonb_typeof(x)='string' then x#>>'{}' else '' end),'done',coalesce((x->>'done')::boolean,false)) order by n) from jsonb_array_elements(v.checklist) with ordinality a(x,n)),'[]'::jsonb));
 else
  return jsonb_build_object('kind',v.kind,'title',v.title,'objective',v.objective,'sector',v.sector,'unit',v.unit,'weight',v.weight::text,'target',v.monthly_target,'checklist',coalesce((select jsonb_agg(jsonb_build_object('text',coalesce(x->>'text',case when jsonb_typeof(x)='string' then x#>>'{}' else '' end),'done',coalesce((x->>'done')::boolean,false)) order by n) from jsonb_array_elements(v.checklist) with ordinality a(x,n)),'[]'::jsonb));
 end if;
end $$;
create function app_private.api_catalogue_query(p jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare c jsonb; actor uuid:=auth.uid(); org uuid; k text; f jsonb; cur text; curj jsonb; lim integer; kind_v text; active_v boolean; template_v uuid; rev_v bigint; cursor_rev bigint; last_title text; last_template uuid; last_version bigint; last_version_id uuid; items jsonb; next_value text; today_v date:=(clock_timestamp() at time zone 'America/Argentina/Buenos_Aires')::date; r app_private.api_command_receipts%rowtype; op_v uuid;
begin
 if actor is null then raise exception using errcode='28000',message='Autenticación requerida'; end if;
 if not app_private.api_exact_keys(p,array['contractVersion','kind','filters','cursor','limit']) or jsonb_typeof(p->'contractVersion') is distinct from 'number' or p->>'contractVersion'<>'1' or jsonb_typeof(p->'kind') is distinct from 'string' then raise exception using errcode='22023',message='Consulta inválida'; end if;
 c:=app_private.api_require_business(false); org:=(c->'principal'->>'organizationId')::uuid; k:=p->>'kind'; f:=p->'filters';
 if jsonb_typeof(p->'cursor') not in ('string','null') or jsonb_typeof(p->'limit') is distinct from 'number' then raise exception using errcode='22023',message='Consulta inválida'; end if;
 cur:=p->>'cursor'; lim:=app_private.api_integer(p,'limit',1,100);
 if k='commandReceipt' then
  if not app_private.api_exact_keys(f,array['operationId']) or lim<>1 or cur is not null then raise exception using errcode='22023',message='Consulta inválida'; end if;
  op_v:=app_private.api_uuid(f,'operationId'); select * into r from app_private.api_command_receipts where actor_id=actor and operation_id=op_v;
  if not found then return jsonb_build_object('contractVersion',1,'kind',k,'data',jsonb_build_object('found',false)); end if;
  if r.kind not in ('catalogue.create','catalogue.revise','catalogue.weight') then return null; end if;
  if r.organization_id<>org or c->'principal'->>'role'<>'jefe' or c->'authentication'->>'aal'<>'aal2' or not exists(select 1 from public.task_templates t where t.id=(r.result->'result'->>'templateId')::uuid and t.organization_id=org) then raise exception using errcode='42501',message='Consulta no disponible'; end if;
  return jsonb_build_object('contractVersion',1,'kind',k,'data',jsonb_build_object('found',true,'command',r.result));
 elsif k='cataloguePage' then
  if not app_private.api_exact_keys(f,array['kind','active']) or (jsonb_typeof(f->'kind') not in ('string','null')) or jsonb_typeof(f->'active') is distinct from 'boolean' then raise exception using errcode='22023',message='Consulta inválida'; end if;
  if f->>'kind' is not null and f->>'kind' not in ('resultado','operativa') then raise exception using errcode='22023',message='Consulta inválida'; end if;
  kind_v:=f->>'kind'; active_v:=(f->>'active')::boolean;
 elsif k='catalogueHistory' then
  if not app_private.api_exact_keys(f,array['templateId']) or lim<1 then raise exception using errcode='22023',message='Consulta inválida'; end if;
  template_v:=app_private.api_uuid(f,'templateId');
 else raise exception using errcode='0A000',message='Consulta no disponible'; end if;
 if cur is not null then
  begin
   curj:=convert_from(decode(translate(cur,'-_','+/')||repeat('=',(4-char_length(cur)%4)%4),'base64'),'UTF8')::jsonb;
   if k='cataloguePage' then
    if not app_private.api_exact_keys(curj,array['kind','filterKind','active','revision','title','templateId']) or curj->>'kind'<>'cataloguePage' or curj->>'filterKind' is distinct from kind_v or curj->>'active' is distinct from active_v::text then raise exception using errcode='22023',message='Cursor inválido'; end if;
    cursor_rev:=app_private.api_expected(curj,'revision'); last_title:=app_private.api_text(curj,'title',1,200); last_template:=app_private.api_uuid(curj,'templateId');
   else
    if not app_private.api_exact_keys(curj,array['kind','templateId','version','versionId']) or curj->>'kind'<>'catalogueHistory' or curj->>'templateId' is distinct from template_v::text then raise exception using errcode='22023',message='Cursor inválido'; end if;
    last_version:=app_private.api_expected(curj,'version'); last_version_id:=app_private.api_uuid(curj,'versionId');
   end if;
  exception when others then raise exception using errcode='22023',message='Consulta inválida'; end;
 end if;
 if k='commandReceipt' then
  if not app_private.api_exact_keys(f,array['operationId']) or lim<>1 or cur is not null then raise exception using errcode='22023',message='Consulta inválida'; end if;
  op_v:=app_private.api_uuid(f,'operationId');
 elsif k='cataloguePage' then
  select coalesce(revision,0) into rev_v from app_private.api_catalogue_heads where organization_id=org;
  if cur is not null and cursor_rev<>coalesce(rev_v,0) then raise exception using errcode='40001',message='El catálogo cambió; recargue'; end if;
  -- Build the actual page separately so the cursor marks the final returned row.
  select coalesce(jsonb_agg(item order by norm_title,template_id),'[]'::jsonb),max(norm_title) into items,last_title from (
   select jsonb_build_object('templateId',t.id,'versionId',v.id,'version',v.version::text,'measurementVersion',v.measurement_version,'definition',app_private.api_catalogue_definition(v.id),'effectiveOn',v.effective_on,'active',t.active,
    'aptForNewAssignment',t.active and (v.kind='resultado' or v.measurement_version=2)) item,lower(regexp_replace(trim(v.title),'\s+',' ','g')) norm_title,t.id template_id
   from public.task_templates t join public.task_template_versions v on v.template_id=t.id and v.organization_id=t.organization_id and v.version=t.version
   where t.organization_id=org and t.active=active_v and (kind_v is null or t.kind=kind_v)
     and (cur is null or (lower(regexp_replace(trim(v.title),'\s+',' ','g')),t.id)>(curj->>'title',last_template))
   order by lower(regexp_replace(trim(v.title),'\s+',' ','g')),t.id limit lim
  ) q;
  if jsonb_array_length(items)>0 and (select count(*) from public.task_templates t join public.task_template_versions v on v.template_id=t.id and v.organization_id=t.organization_id and v.version=t.version where t.organization_id=org and t.active=active_v and (kind_v is null or t.kind=kind_v) and (cur is null or (lower(regexp_replace(trim(v.title),'\s+',' ','g')),t.id)>(coalesce(curj->>'title',''),coalesce((curj->>'templateId')::uuid,'00000000-0000-0000-0000-000000000000'::uuid))))>lim then
   last_template:=(items->(lim-1)->>'templateId')::uuid;
   select lower(regexp_replace(trim(v.title),'\s+',' ','g')),t.id into last_title,last_template from public.task_templates t join public.task_template_versions v on v.template_id=t.id and v.organization_id=t.organization_id and v.version=t.version where t.id=(items->(lim-1)->>'templateId')::uuid;
   next_value:=rtrim(translate(replace(encode(convert_to(jsonb_build_object('kind','cataloguePage','filterKind',kind_v,'active',active_v,'revision',coalesce(rev_v,0)::text,'title',last_title,'templateId',last_template)::text,'UTF8'),'base64'),E'\n',''),'+/','-_'),'=');
  end if;
  return jsonb_build_object('contractVersion',1,'kind',k,'data',jsonb_build_object('catalogueRevision',coalesce(rev_v,0)::text,'items',items,'nextCursor',next_value));
 else
  if not exists(select 1 from public.task_templates where id=template_v and organization_id=org) then raise exception using errcode='42501',message='Consulta no disponible'; end if;
  select coalesce(jsonb_agg(item order by version desc,version_id desc),'[]'::jsonb) into items from (
   select jsonb_build_object('templateId',v.template_id,'versionId',v.id,'version',v.version::text,'measurementVersion',v.measurement_version,'definition',app_private.api_catalogue_definition(v.id),'effectiveOn',v.effective_on,'createdAt',v.created_at,'createdBy',v.created_by,'reason',v.reason) item,v.version, v.id version_id
   from public.task_template_versions v where v.organization_id=org and v.template_id=template_v and (cur is null or (v.version,v.id)<(last_version,last_version_id)) order by v.version desc,v.id desc limit lim
  ) q;
  if (select count(*) from public.task_template_versions v where v.organization_id=org and v.template_id=template_v and (cur is null or (v.version,v.id)<(last_version,last_version_id)))>lim then
   last_version:=(items->(jsonb_array_length(items)-1)->>'version')::bigint;
   last_version_id:=(items->(jsonb_array_length(items)-1)->>'versionId')::uuid;
   next_value:=rtrim(translate(replace(encode(convert_to(jsonb_build_object('kind','catalogueHistory','templateId',template_v,'version',last_version::text,'versionId',last_version_id)::text,'UTF8'),'base64'),E'\n',''),'+/','-_'),'=');
  end if;
  return jsonb_build_object('contractVersion',1,'kind',k,'data',jsonb_build_object('items',items,'nextCursor',next_value));
 end if;
end $$;

create function app_private.api_validate_onboarding_v2(p_draft jsonb,p_submit boolean,p_organization uuid,p_allow_historical_catalogue boolean default false) returns uuid[]
language plpgsql security definer set search_path='' as $$
declare line jsonb; schedule_v jsonb; source_v jsonb; definition_v jsonb; line_id uuid; company_v uuid; team_v uuid; template_v uuid; start_v date; end_v date; freq_v text; interval_v integer; weekday_v smallint; seen_ids uuid[]:='{}'; weekday_seen smallint[]:='{}'; template_ids uuid[]:='{}';
begin
 if not app_private.api_exact_keys(p_draft,array['schemaVersion','lines']) or jsonb_typeof(p_draft->'schemaVersion') is distinct from 'number' or p_draft->>'schemaVersion'<>'2' or jsonb_typeof(p_draft->'lines') is distinct from 'array' then raise exception using errcode='22023',message='Borrador inválido'; end if;
 if jsonb_array_length(p_draft->'lines')>100 or (p_submit and jsonb_array_length(p_draft->'lines')=0) then raise exception using errcode='22023',message='Cantidad de líneas inválida'; end if;
 foreach line in array array(select value from jsonb_array_elements(p_draft->'lines')) loop
  if not app_private.api_exact_keys(line,array['lineId','companyId','teamId','source','schedule']) then raise exception using errcode='22023',message='Línea inválida'; end if;
  line_id:=app_private.api_uuid(line,'lineId'); company_v:=app_private.api_uuid(line,'companyId'); team_v:=app_private.api_uuid(line,'teamId');
  if line_id=any(seen_ids) then raise exception using errcode='22023',message='Identificador de línea duplicado'; end if; seen_ids:=array_append(seen_ids,line_id);
  if not exists(select 1 from public.companies co where co.id=company_v and co.organization_id=p_organization) or not exists(select 1 from public.teams tm where tm.id=team_v and tm.organization_id=p_organization) then raise exception using errcode='22023',message='Empresa o equipo inválido'; end if;
  schedule_v:=line->'schedule';
  if not app_private.api_exact_keys(schedule_v,array['frequency','startDate','endDate','interval','weekdays','monthDay','hasDeadline','dueOffsetDays']) or schedule_v->>'frequency' not in ('unica','diaria','semanal','mensual') or jsonb_typeof(schedule_v->'weekdays') is distinct from 'array' or jsonb_typeof(schedule_v->'hasDeadline') is distinct from 'boolean' then raise exception using errcode='22023',message='Calendario inválido'; end if;
  start_v:=app_private.api_date(schedule_v,'startDate'); if jsonb_typeof(schedule_v->'endDate')='string' then end_v:=app_private.api_date(schedule_v,'endDate'); elsif jsonb_typeof(schedule_v->'endDate')='null' then end_v:=null; else raise exception using errcode='22023',message='Calendario inválido'; end if;
  if end_v is not null and end_v<start_v or schedule_v->>'frequency'='unica' and end_v is not null and end_v<>start_v then raise exception using errcode='22023',message='Calendario inválido'; end if;
  freq_v:=schedule_v->>'frequency'; interval_v:=app_private.api_integer(schedule_v,'interval',1,12); perform app_private.api_integer(schedule_v,'monthDay',1,31); perform app_private.api_integer(schedule_v,'dueOffsetDays',0,31);
  if freq_v='semanal' and jsonb_array_length(schedule_v->'weekdays')=0 then raise exception using errcode='22023',message='Calendario inválido'; end if;
  weekday_seen:='{}';
  foreach source_v in array array(select value from jsonb_array_elements(schedule_v->'weekdays')) loop
   if jsonb_typeof(source_v) is distinct from 'number' then raise exception using errcode='22023',message='Calendario inválido'; end if;
   weekday_v:=(source_v#>>'{}')::smallint;
   if weekday_v not between 0 and 6 or weekday_v=any(weekday_seen) then raise exception using errcode='22023',message='Calendario inválido'; end if;
   weekday_seen:=array_append(weekday_seen,weekday_v);
  end loop;
  source_v:=line->'source';
  if jsonb_typeof(source_v->'type') is distinct from 'string' then raise exception using errcode='22023',message='Origen inválido'; end if;
  if source_v->>'type'='catalogue' then
   if not app_private.api_exact_keys(source_v,array['type','templateVersionId']) then raise exception using errcode='22023',message='Origen inválido'; end if;
   template_v:=app_private.api_uuid(source_v,'templateVersionId'); template_ids:=array_append(template_ids,template_v);
   if not exists(select 1 from public.task_template_versions v join public.task_templates t on t.id=v.template_id and t.organization_id=v.organization_id where v.id=template_v and v.organization_id=p_organization and (p_allow_historical_catalogue or (t.active and v.version=t.version)) and v.effective_on is not null and start_v>=v.effective_on and (v.kind='resultado' or v.measurement_version=2)) then raise exception using errcode='22023',message='Estándar no elegible'; end if;
  elsif source_v->>'type'='custom' then
   if not app_private.api_exact_keys(source_v,array['type','definition']) or freq_v<>'unica' then raise exception using errcode='22023',message='Origen particular inválido'; end if;
   definition_v:=source_v->'definition'; perform app_private.api_validate_definition_v2(definition_v);
  else raise exception using errcode='22023',message='Origen inválido'; end if;
 end loop;
 return template_ids;
end $$;

-- C onboarding commands share the API receipt/revision protocol; they write
-- the existing versioned request tables directly after the complete scope
-- lock plan, rather than calling legacy writers that lock rows internally.
create function app_private.api_onboarding_command(p jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); c jsonb; org uuid; role_v text; k text; op uuid; payload jsonb; expected jsonb; args jsonb;
 existing app_private.api_command_receipts%rowtype; req public.onboarding_requests%rowtype; req_id uuid; owner_v uuid; owner_rev bigint; expected_owner bigint; expected_rev bigint; expected_draft bigint; next_rev integer; next_draft integer; reason_v text; draft_v jsonb; receipt_revision integer; template_ids uuid[]:='{}'; scopes text[]; result_v jsonb; owner_profile public.profiles%rowtype; membership_line jsonb;
begin
 if actor is null then raise exception using errcode='28000',message='Autenticación requerida'; end if;
 if octet_length(coalesce(p::text,''))>32768 or not app_private.api_exact_keys(p,array['contractVersion','operationId','kind','expectedRevisions','payload']) or jsonb_typeof(p->'contractVersion') is distinct from 'number' or p->>'contractVersion'<>'1' then raise exception using errcode='22023',message='Solicitud inválida'; end if;
 k:=p->>'kind'; if k not in ('onboarding.saveDraft','onboarding.submit','onboarding.requestChanges') then raise exception using errcode='0A000',message='Operación no disponible'; end if;
 op:=app_private.api_uuid(p,'operationId'); payload:=p->'payload'; expected:=p->'expectedRevisions';
 if jsonb_typeof(expected) is distinct from 'object' or jsonb_typeof(payload) is distinct from 'object' then raise exception using errcode='22023',message='Solicitud inválida'; end if;
 c:=app_private.api_require_business(false); org:=(c->'principal'->>'organizationId')::uuid; role_v:=c->'principal'->>'role';
 if k='onboarding.saveDraft' then
  if role_v<>'empleado' or not app_private.api_exact_keys(payload,array['requestId','draft']) or jsonb_typeof(payload->'requestId') not in ('string','null') then raise exception using errcode='42501',message='Contexto no autorizado'; end if;
  req_id:=case when payload->>'requestId' is null then null else app_private.api_uuid(payload,'requestId') end; draft_v:=payload->'draft';
  template_ids:=app_private.api_validate_onboarding_v2(draft_v,false,org);
  if exists(select 1 from jsonb_array_elements(draft_v->'lines') l where not exists(select 1 from public.company_memberships cm where cm.organization_id=org and cm.company_id=(l->>'companyId')::uuid and cm.profile_id=actor and cm.active) or not exists(select 1 from public.team_members tm where tm.organization_id=org and tm.team_id=(l->>'teamId')::uuid and tm.profile_id=actor)) then raise exception using errcode='42501',message='Contexto no autorizado'; end if;
  if req_id is null then
   if (select count(*) from jsonb_object_keys(expected))<>1 or not (expected ? ('onboardingOwner:'||actor)) then raise exception using errcode='22023',message='Revisiones inválidas'; end if;
   expected_owner:=app_private.api_expected(expected,'onboardingOwner:'||actor);
   select * into req from public.onboarding_requests where owner_id=actor and organization_id=org;
  else
   if (select count(*) from jsonb_object_keys(expected))<>3 or not (expected ? ('onboardingOwner:'||actor)) or not (expected ? ('onboarding:'||req_id)) or not (expected ? ('onboardingDraft:'||req_id)) then raise exception using errcode='22023',message='Revisiones inválidas'; end if;
   expected_owner:=app_private.api_expected(expected,'onboardingOwner:'||actor); expected_rev:=app_private.api_expected(expected,'onboarding:'||req_id); expected_draft:=app_private.api_expected(expected,'onboardingDraft:'||req_id);
   select * into req from public.onboarding_requests where id=req_id and owner_id=actor and organization_id=org;
   if not found then raise exception using errcode='42501',message='Contexto no autorizado'; end if;
  end if;
 elsif k='onboarding.submit' then
  if role_v<>'empleado' or not app_private.api_exact_keys(payload,array['requestId']) then raise exception using errcode='42501',message='Contexto no autorizado'; end if;
  req_id:=app_private.api_uuid(payload,'requestId');
  if (select count(*) from jsonb_object_keys(expected))<>2 or not (expected ? ('onboarding:'||req_id)) or not (expected ? ('onboardingDraft:'||req_id)) then raise exception using errcode='22023',message='Revisiones inválidas'; end if;
  expected_rev:=app_private.api_expected(expected,'onboarding:'||req_id); expected_draft:=app_private.api_expected(expected,'onboardingDraft:'||req_id);
  select * into req from public.onboarding_requests where id=req_id and owner_id=actor and organization_id=org;
  if not found then raise exception using errcode='42501',message='Contexto no autorizado'; end if;
 elsif k='onboarding.requestChanges' then
  if role_v not in ('jefe','encargado') or c->'authentication'->>'aal'<>'aal2' or not app_private.api_exact_keys(payload,array['requestId','reason']) then raise exception using errcode='42501',message='Contexto no autorizado'; end if;
  req_id:=app_private.api_uuid(payload,'requestId'); reason_v:=app_private.api_text(payload,'reason',5,1000);
  if (select count(*) from jsonb_object_keys(expected))<>1 or not (expected ? ('onboarding:'||req_id)) then raise exception using errcode='22023',message='Revisiones inválidas'; end if;
  expected_rev:=app_private.api_expected(expected,'onboarding:'||req_id);
  select * into req from public.onboarding_requests where id=req_id and organization_id=org;
  if not found then raise exception using errcode='42501',message='Contexto no autorizado'; end if;
  owner_v:=req.owner_id;
 else
  raise exception using errcode='0A000',message='Operación no disponible';
 end if;
 if owner_v is null then owner_v:=coalesce(req.owner_id,actor); end if;
 args:=jsonb_build_object('kind',k,'payload',payload,'expectedRevisions',expected);
 perform public._coordination_receipt_lock(actor,op);
 select * into existing from app_private.api_command_receipts where actor_id=actor and operation_id=op;
 if existing.actor_id is not null then
  if existing.kind<>k or existing.arguments is distinct from args then raise exception using errcode='40001',message='Identificador de operación ya utilizado'; end if;
  if existing.organization_id<>org then raise exception using errcode='42501',message='Contexto no autorizado'; end if;
  if k='onboarding.submit' then
   if existing.result#>>'{result,requestId}' is distinct from req_id::text then raise exception using errcode='40001',message='Recibo de inducción inválido'; end if;
   begin receipt_revision:=(existing.result#>>'{result,revision}')::integer; exception when others then raise exception using errcode='40001',message='Recibo de inducción inválido'; end;
   if receipt_revision is null or receipt_revision<1 then raise exception using errcode='40001',message='Recibo de inducción inválido'; end if;
   select v.payload into draft_v from public.onboarding_request_versions v where v.organization_id=org and v.request_id=req_id and v.revision=receipt_revision and v.submitted_by=actor;
   if not found then raise exception using errcode='42501',message='Contexto no autorizado'; end if;
  end if;
 end if;
 if k='onboarding.submit' then
  if existing.actor_id is null then draft_v:=req.draft_payload; end if;
  if existing.actor_id is null then template_ids:=app_private.api_validate_onboarding_v2(draft_v,true,org); end if;
 end if;
 perform public._coordination_lock_keys(1102,array[actor::text]);
 perform public._coordination_lock_keys(1103,array(select distinct x::text from unnest(array[actor,owner_v]) x order by x::text));
 scopes:=case when k='onboarding.requestChanges' then array['onboarding:'||req_id] else array['onboarding:'||req_id,'onboardingDraft:'||req_id] end;
 if k='onboarding.saveDraft' then scopes:=array['onboardingOwner:'||actor]||case when req_id is null then '{}'::text[] else scopes end; end if;
 if k='onboarding.submit' then
  scopes:=scopes||coalesce((select array_agg(distinct 'template:'||v.template_id::text) from public.task_template_versions v where v.id=any(template_ids)),'{}'::text[])
   ||coalesce((select array_agg(distinct 'membership:'||(line->>'companyId')||':'||actor::text) from jsonb_array_elements(draft_v->'lines') line),'{}'::text[]);
 end if;
 perform public._coordination_lock_keys(1105,scopes);
 if k in ('onboarding.submit','onboarding.requestChanges') then
  select * into req from public.onboarding_requests where id=req_id and organization_id=org and owner_id=owner_v for update;
  if not found then raise exception using errcode='42501',message='Contexto no autorizado'; end if;
 end if;
 if k in ('onboarding.saveDraft','onboarding.submit') and not exists(select 1 from public.profiles where id=actor and organization_id=org and active and role='empleado') then raise exception using errcode='42501',message='Contexto no autorizado'; end if;
 if k='onboarding.saveDraft' then
  for membership_line in select value from jsonb_array_elements(draft_v->'lines') order by value->>'companyId',value->>'teamId' loop
   perform 1 from public.company_memberships cm where cm.organization_id=org and cm.company_id=(membership_line->>'companyId')::uuid and cm.profile_id=actor and cm.active for share;
   if not found then raise exception using errcode='42501',message='Contexto no autorizado'; end if;
   perform 1 from public.team_members tm where tm.organization_id=org and tm.team_id=(membership_line->>'teamId')::uuid and tm.profile_id=actor for share;
   if not found then raise exception using errcode='42501',message='Contexto no autorizado'; end if;
  end loop;
 end if;
 if k='onboarding.submit' then
  for membership_line in select value from jsonb_array_elements(draft_v->'lines') order by value->>'companyId',value->>'teamId' loop
   perform 1 from public.company_memberships cm where cm.organization_id=org and cm.company_id=(membership_line->>'companyId')::uuid and cm.profile_id=actor and cm.active for share;
   if not found then raise exception using errcode='42501',message='Contexto no autorizado'; end if;
   perform 1 from public.team_members tm where tm.organization_id=org and tm.team_id=(membership_line->>'teamId')::uuid and tm.profile_id=actor for share;
   if not found then raise exception using errcode='42501',message='Contexto no autorizado'; end if;
  end loop;
 end if;
 if k='onboarding.requestChanges' and role_v='encargado' and not exists(select 1 from public.profiles p where p.id=owner_v and p.organization_id=org and p.active and p.manager_id=actor) then raise exception using errcode='42501',message='Contexto no autorizado'; end if;
 if k<>'onboarding.saveDraft' and not exists(select 1 from public.onboarding_requests where id=req_id and organization_id=org and owner_id=owner_v) then raise exception using errcode='42501',message='Contexto no autorizado'; end if;
 if existing.actor_id is not null then
  if existing.kind<>k or existing.arguments is distinct from args then raise exception using errcode='40001',message='Identificador de operación ya utilizado'; end if;
  if existing.organization_id<>org then raise exception using errcode='42501',message='Contexto no autorizado'; end if;
  return existing.result;
 end if;
 if k in ('onboarding.submit','onboarding.requestChanges') then
  insert into app_private.api_onboarding_owner_heads(organization_id,owner_id) values(org,owner_v) on conflict(organization_id,owner_id) do update set fence_epoch=app_private.api_onboarding_owner_heads.fence_epoch+1;
  perform 1 from app_private.api_onboarding_owner_heads where organization_id=org and owner_id=owner_v for update;
 end if;
 insert into app_private.api_operation_fences(actor_id,operation_id) values(actor,op);
 if k='onboarding.saveDraft' then
  insert into app_private.api_onboarding_owner_heads(organization_id,owner_id) values(org,actor) on conflict(organization_id,owner_id) do update set fence_epoch=app_private.api_onboarding_owner_heads.fence_epoch+1;
  select revision into owner_rev from app_private.api_onboarding_owner_heads where organization_id=org and owner_id=actor for update;
  if expected_owner<>owner_rev then raise exception using errcode='40001',message='La inducción cambió; recargue'; end if;
  if req_id is null then select * into req from public.onboarding_requests where owner_id=actor and organization_id=org for update;
  else select * into req from public.onboarding_requests where id=req_id and owner_id=actor and organization_id=org for update; end if;
  if found then
   req_id:=req.id;
   if req.status not in ('draft','changes_requested') then raise exception using errcode='40001',message='La inducción no admite edición en este estado'; end if;
   if payload->>'requestId' is not null and (expected_rev<>req.current_revision or expected_draft<>req.draft_revision) then raise exception using errcode='40001',message='El borrador cambió; recargue'; end if;
   next_rev:=req.current_revision; next_draft:=req.draft_revision+1;
   update public.onboarding_requests set draft_payload=draft_v,draft_revision=next_draft,updated_at=clock_timestamp() where id=req_id;
  else
   insert into public.onboarding_requests(organization_id,owner_id,status,draft_payload,draft_revision) values(org,actor,'draft',draft_v,1) returning * into req;
   req_id:=req.id; next_rev:=0; next_draft:=1;
  end if;
  update app_private.api_onboarding_owner_heads set revision=revision+1 where organization_id=org and owner_id=actor returning revision into owner_rev;
  result_v:=jsonb_build_object('contractVersion',1,'operationId',op,'kind',k,'result',jsonb_build_object('requestId',req_id,'revision',next_rev::text,'draftRevision',next_draft::text,'status',req.status));
  insert into public.audit_events(organization_id,actor_id,action,entity_id,details) values(org,actor,'onboarding.draft_saved',req_id,jsonb_build_object('draftRevision',next_draft,'lineCount',jsonb_array_length(draft_v->'lines')));
 elsif k='onboarding.submit' then
  select * into req from public.onboarding_requests where id=req_id and owner_id=actor and organization_id=org for update;
  if not found or req.status not in ('draft','changes_requested') or expected_rev<>req.current_revision or expected_draft<>req.draft_revision then raise exception using errcode='40001',message='La inducción cambió; recargue'; end if;
  template_ids:=app_private.api_validate_onboarding_v2(req.draft_payload,true,org);
  if not exists(select 1 from public.profiles where id=actor and organization_id=org and active and role='empleado') then raise exception using errcode='42501',message='Contexto no autorizado'; end if;
  if exists(select 1 from jsonb_array_elements(req.draft_payload->'lines') l where not exists(select 1 from public.company_memberships cm where cm.organization_id=org and cm.company_id=(l->>'companyId')::uuid and cm.profile_id=actor and cm.active) or not exists(select 1 from public.team_members tm where tm.organization_id=org and tm.team_id=(l->>'teamId')::uuid and tm.profile_id=actor)) then raise exception using errcode='42501',message='Contexto no autorizado'; end if;
  next_rev:=req.current_revision+1;
  insert into public.onboarding_request_versions(organization_id,request_id,revision,payload,submitted_by) values(org,req_id,next_rev,req.draft_payload,actor);
  update public.onboarding_requests set current_revision=next_rev,status='submitted',submitted_at=clock_timestamp(),approved_at=null,approved_by=null,updated_at=clock_timestamp() where id=req_id returning * into req;
  insert into public.onboarding_reviews(organization_id,request_id,revision,actor_id,action) values(org,req_id,next_rev,actor,'submitted');
  update app_private.api_onboarding_owner_heads set revision=revision+1 where organization_id=org and owner_id=actor returning revision into owner_rev;
  result_v:=jsonb_build_object('contractVersion',1,'operationId',op,'kind',k,'result',jsonb_build_object('requestId',req_id,'revision',next_rev::text,'draftRevision',req.draft_revision::text,'status',req.status));
  insert into public.audit_events(organization_id,actor_id,action,entity_id,details) values(org,actor,'onboarding.submitted',req_id,jsonb_build_object('revision',next_rev,'lineCount',jsonb_array_length(req.draft_payload->'lines')));
 else
  select * into req from public.onboarding_requests where id=req_id and organization_id=org for update;
  if not found or req.status<>'submitted' or req.current_revision<>expected_rev then raise exception using errcode='40001',message='La solicitud o revisión cambió'; end if;
  if role_v='encargado' and not exists(select 1 from public.profiles p where p.id=req.owner_id and p.organization_id=org and p.active and p.manager_id=actor) then raise exception using errcode='42501',message='Contexto no autorizado'; end if;
  update public.onboarding_requests set status='changes_requested',updated_at=clock_timestamp() where id=req_id;
  insert into public.onboarding_reviews(organization_id,request_id,revision,actor_id,action,note) values(org,req_id,req.current_revision,actor,'changes_requested',reason_v);
  update app_private.api_onboarding_owner_heads set revision=revision+1 where organization_id=org and owner_id=req.owner_id returning revision into owner_rev;
  result_v:=jsonb_build_object('contractVersion',1,'operationId',op,'kind',k,'result',jsonb_build_object('requestId',req_id,'revision',req.current_revision::text,'draftRevision',req.draft_revision::text,'status','changes_requested'));
  insert into public.audit_events(organization_id,actor_id,action,entity_id,details) values(org,actor,'onboarding.changes_requested',req_id,jsonb_build_object('revision',req.current_revision));
 end if;
 insert into app_private.api_command_receipts(actor_id,operation_id,organization_id,kind,arguments,result) values(actor,op,org,k,args,result_v);
 return result_v;
end $$;

alter function api.command_v1(jsonb) rename to command_v1_c;
revoke all on function api.command_v1_c(jsonb) from public,anon,authenticated,service_role;
create function api.command_v1(p jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare k text;
begin
 if jsonb_typeof(p->'kind')='string' then k:=p->>'kind'; else return api.command_v1_c(p); end if;
 if k='onboarding.approve' then return app_private.api_onboarding_approve(p); end if;
 if k in ('onboarding.saveDraft','onboarding.submit','onboarding.requestChanges') then return app_private.api_onboarding_command(p); end if;
 if k in ('assignment.create','task.createOneOff','month.materialize') then return app_private.api_creation_command(p); end if;
 return api.command_v1_c(p);
end $$;

create function app_private.api_onboarding_approve(p jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); c jsonb; org uuid; op uuid; payload jsonb; expected jsonb; args jsonb; req_id uuid; req public.onboarding_requests%rowtype; version_row public.onboarding_request_versions%rowtype; existing app_private.api_command_receipts%rowtype;
 owner_v uuid; period_v date; today_v date:=(clock_timestamp() at time zone 'America/Argentina/Buenos_Aires')::date; current_period date:=date_trunc('month',(clock_timestamp() at time zone 'America/Argentina/Buenos_Aires'))::date; expected_rev bigint; expected_catalog bigint; template_ids uuid[]:='{}'; catalog_locks text[]; expected_keys text[]; months jsonb; plan jsonb; line jsonb; line_id uuid; company_v uuid; team_v uuid; source_v jsonb; def_v jsonb; sched jsonb; template_version_v uuid; template_version_no integer; template_v uuid; tv public.task_template_versions%rowtype; title_v text; objective_v text; sector_v text; kind_v text; weight_v numeric; unit_v text; target_v integer; checklist_v jsonb; measurement_v smallint; start_v date; end_v date; freq_v text; interval_v smallint; weekdays_v smallint[]; month_day_v smallint; deadline_v boolean; offset_v smallint; overrides jsonb; override_line uuid; override_weight numeric; expected_override_ids uuid[]:='{}'; given_override_ids uuid[]:='{}'; assignment_id uuid; assignment_ids uuid[]:='{}'; task_ids uuid[]:='{}'; created_count integer:=0; line_count integer:=0; occurrence_count integer:=0; candidate_day date; result_v jsonb; version_map jsonb; receipt_revision integer; receipt_scopes text[]; receipt_line jsonb;
begin
 c:=app_private.api_require_business(true); org:=(c->'principal'->>'organizationId')::uuid;
 if actor is null or c->'principal'->>'role'<>'jefe' or c->'authentication'->>'aal'<>'aal2' then raise exception using errcode='42501',message='Contexto no autorizado'; end if;
 if octet_length(coalesce(p::text,''))>32768 or not app_private.api_exact_keys(p,array['contractVersion','operationId','kind','expectedRevisions','payload']) or jsonb_typeof(p->'contractVersion') is distinct from 'number' or p->>'contractVersion'<>'1' or p->>'kind'<>'onboarding.approve' then raise exception using errcode='22023',message='Solicitud inválida'; end if;
 op:=app_private.api_uuid(p,'operationId'); payload:=p->'payload'; expected:=p->'expectedRevisions';
 if not app_private.api_exact_keys(payload,array['requestId','weightOverrides','period']) or jsonb_typeof(payload->'weightOverrides') is distinct from 'array' or jsonb_array_length(payload->'weightOverrides')>100 then raise exception using errcode='22023',message='Solicitud inválida'; end if;
 req_id:=app_private.api_uuid(payload,'requestId'); period_v:=app_private.api_date(payload,'period');
 args:=jsonb_build_object('kind','onboarding.approve','payload',payload,'expectedRevisions',expected);
 perform public._coordination_receipt_lock(actor,op); select * into existing from app_private.api_command_receipts where actor_id=actor and operation_id=op;
 if existing.actor_id is not null then
  if existing.kind<>'onboarding.approve' or existing.arguments is distinct from args then raise exception using errcode='40001',message='Identificador de operación ya utilizado'; end if;
  if existing.organization_id<>org then raise exception using errcode='42501',message='Contexto no autorizado'; end if;
  -- An approval replay is an authorized read of the immutable submitted version
  -- named by its receipt. Never consult the current draft, mutable request state,
  -- or current catalogue eligibility on this path.
  if existing.result#>>'{result,requestId}' is distinct from req_id::text then raise exception using errcode='40001',message='Recibo de aprobación inválido'; end if;
  begin receipt_revision:=(existing.result#>>'{result,revision}')::integer; exception when others then raise exception using errcode='40001',message='Recibo de aprobación inválido'; end;
  if receipt_revision is null or receipt_revision<1 then raise exception using errcode='40001',message='Recibo de aprobación inválido'; end if;
  select r.owner_id into owner_v from public.onboarding_requests r where r.id=req_id and r.organization_id=org;
  if not found then raise exception using errcode='42501',message='Contexto no autorizado'; end if;
  select * into version_row from public.onboarding_request_versions where request_id=req_id and organization_id=org and revision=receipt_revision and submitted_by=owner_v;
  if not found then raise exception using errcode='42501',message='Contexto no autorizado'; end if;
  receipt_scopes:=array(select distinct 'membership:'||(ln->>'companyId')||':'||owner_v::text
   from jsonb_array_elements(version_row.payload->'lines') ln order by 1);
  months:=jsonb_build_array(jsonb_build_object('ownerId',owner_v,'period',period_v));
  plan:=public._coordination_prepare('{}'::uuid[],array[actor],array[actor,owner_v],months,receipt_scopes,'{}'::jsonb);
  perform app_private._coordination_acquire_m22b(plan,false);
  perform app_private.api_revalidate_actor(actor,c);
  select * into existing from app_private.api_command_receipts where actor_id=actor and operation_id=op;
  if not found or existing.organization_id<>org or existing.kind<>'onboarding.approve' or existing.arguments is distinct from args then
   raise exception using errcode='40001',message='El recibo de aprobación cambió';
  end if;
  if not exists(select 1 from public.profiles p where p.id=actor and p.organization_id=org and p.active and p.role='jefe') then raise exception using errcode='42501',message='Contexto no autorizado'; end if;
  perform 1 from public.profiles p where p.id=owner_v and p.organization_id=org and p.active and p.role='empleado' for share;
  if not found then raise exception using errcode='42501',message='Contexto no autorizado'; end if;
  for receipt_line in select value from jsonb_array_elements(version_row.payload->'lines') order by value->>'companyId',value->>'teamId' loop
   perform 1 from public.company_memberships cm where cm.organization_id=org and cm.company_id=app_private.api_uuid(receipt_line,'companyId') and cm.profile_id=owner_v and cm.active for share;
   if not found then raise exception using errcode='42501',message='Contexto no autorizado'; end if;
   perform 1 from public.team_members tm where tm.organization_id=org and tm.team_id=app_private.api_uuid(receipt_line,'teamId') and tm.profile_id=owner_v for share;
   if not found then raise exception using errcode='42501',message='Contexto no autorizado'; end if;
  end loop;
  return existing.result;
 end if;
 if period_v<>current_period then raise exception using errcode='22023',message='El período debe ser el mes actual'; end if;
 select * into req from public.onboarding_requests where id=req_id and organization_id=org;
 if not found or req.status not in ('submitted','approved') then raise exception using errcode='40001',message='La solicitud o revisión cambió'; end if;
 select * into version_row from public.onboarding_request_versions where request_id=req_id and organization_id=org and revision=req.current_revision;
 if not found then raise exception using errcode='40001',message='No existe el contenido enviado'; end if;
 if version_row.payload->>'schemaVersion'<>'2' then raise exception using errcode='0A000',message='La revisión requiere reenvío por API'; end if;
 expected_rev:=app_private.api_expected(expected,'onboarding:'||req_id);
 template_ids:=app_private.api_validate_onboarding_v2(version_row.payload,true,org,true);
 select coalesce(array_agg(distinct 'template:'||v.template_id::text order by 'template:'||v.template_id::text),'{}'::text[]),coalesce(array_agg(distinct v.template_id order by v.template_id),'{}'::uuid[])
 into catalog_locks,template_ids from public.task_template_versions v where v.id in (select (x->'source'->>'templateVersionId')::uuid from jsonb_array_elements(version_row.payload->'lines') x where x->'source'->>'type'='catalogue');
 catalog_locks:=coalesce(catalog_locks,'{}'::text[])||array['onboarding:'||req_id,'creation:'||req.owner_id];
 expected_keys:=array['onboarding:'||req_id]||coalesce((select array_agg('catalogue:'||x::text order by x) from unnest(template_ids) x),'{}'::text[]);
 if not app_private.api_exact_keys(expected,expected_keys) then raise exception using errcode='22023',message='Revisiones inválidas'; end if;
 for override_line,override_weight in select (x->>'lineId')::uuid,(x->>'weight')::numeric from jsonb_array_elements(payload->'weightOverrides') x loop
  if not app_private.api_exact_keys((select value from jsonb_array_elements(payload->'weightOverrides') z where z->>'lineId'=override_line::text limit 1),array['lineId','weight']) then raise exception using errcode='22023',message='Pesos particulares inválidos'; end if;
  if override_weight<=0 or override_weight>100 then raise exception using errcode='22023',message='Pesos particulares inválidos'; end if;
  given_override_ids:=array_append(given_override_ids,override_line);
 end loop;
 if cardinality(given_override_ids)<>(select count(distinct x) from unnest(given_override_ids) x) then raise exception using errcode='22023',message='Pesos particulares inválidos'; end if;
 for line in select value from jsonb_array_elements(version_row.payload->'lines') loop
  if line->'source'->>'type'='custom' and line->'source'->'definition'->>'kind'='resultado' then expected_override_ids:=array_append(expected_override_ids,(line->>'lineId')::uuid); end if;
 end loop;
 if (select coalesce(array_agg(x order by x),array[]::uuid[]) from unnest(given_override_ids) x) is distinct from (select coalesce(array_agg(x order by x),array[]::uuid[]) from unnest(expected_override_ids) x) then raise exception using errcode='22023',message='Pesos particulares incompletos'; end if;
 months:=jsonb_build_array(jsonb_build_object('ownerId',req.owner_id,'period',period_v));
 plan:=public._coordination_prepare('{}'::uuid[],array[actor],array[req.owner_id],months,catalog_locks,jsonb_build_object('kind','materialize','owner',req.owner_id,'period',period_v,'request',req_id));
 perform app_private._coordination_acquire_m22b(plan);
 perform app_private.api_touch_month_fences(org,plan->'months');
 for template_version_v in select distinct (x->'source'->>'templateVersionId')::uuid from jsonb_array_elements(version_row.payload->'lines') x where x->'source'->>'type'='catalogue' loop
  select v.template_id,v.version,t.version into template_v,template_version_no,expected_catalog from public.task_template_versions v join public.task_templates t on t.id=v.template_id and t.organization_id=v.organization_id where v.id=template_version_v and v.organization_id=org and t.active;
  if not found or not (expected ? ('catalogue:'||template_v)) or app_private.api_expected(expected,'catalogue:'||template_v)<>expected_catalog or template_version_no<>expected_catalog then raise exception using errcode='40001',message='El catálogo cambió; recargue'; end if;
 end loop;
 perform app_private.api_validate_onboarding_v2(version_row.payload,true,org);
 c:=app_private.api_require_business(true);
 if (c->'principal'->>'organizationId')::uuid<>org or c->'principal'->>'role'<>'jefe' or c->'authentication'->>'aal'<>'aal2' then raise exception using errcode='42501',message='Contexto no autorizado'; end if;
 select * into req from public.onboarding_requests where id=req_id and organization_id=org for update;
 if not found or req.owner_id is distinct from (plan->'snapshot'->'request'->>'owner_id')::uuid or req.status<>'submitted' or req.current_revision<>(version_row.revision) or expected_rev<>req.current_revision then raise exception using errcode='40001',message='La solicitud o revisión cambió'; end if;
 select * into version_row from public.onboarding_request_versions where request_id=req_id and organization_id=org and revision=req.current_revision for share;
 if not found or version_row.payload is distinct from (plan->'snapshot'->'requestVersions'->0->'payload') then raise exception using errcode='40001',message='El envío cambió; recargue'; end if;
 if not exists(select 1 from public.profiles where id=req.owner_id and organization_id=org and active and role='empleado') then raise exception using errcode='42501',message='El empleado ya no está activo'; end if;
 perform public._coordination_assert_month(req.owner_id,period_v);
 if exists(select 1 from jsonb_array_elements(version_row.payload->'lines') l where not exists(select 1 from public.company_memberships cm where cm.organization_id=org and cm.company_id=(l->>'companyId')::uuid and cm.profile_id=req.owner_id and cm.active) or not exists(select 1 from public.team_members tm where tm.organization_id=org and tm.team_id=(l->>'teamId')::uuid and tm.profile_id=req.owner_id)) then raise exception using errcode='42501',message='La empresa o el equipo cambió'; end if;
 -- Count all occurrences the command will create for its approved lines before any assignment write.
 for line in select value from jsonb_array_elements(version_row.payload->'lines') loop
  sched:=line->'schedule'; start_v:=(sched->>'startDate')::date; end_v:=case when sched->>'endDate' is null then null else (sched->>'endDate')::date end; freq_v:=sched->>'frequency'; interval_v:=(sched->>'interval')::smallint; month_day_v:=(sched->>'monthDay')::smallint; weekdays_v:=array(select (x#>>'{}')::smallint from jsonb_array_elements(sched->'weekdays') x); offset_v:=(sched->>'dueOffsetDays')::smallint; deadline_v:=(sched->>'hasDeadline')::boolean;
  for candidate_day in select g::date from generate_series(period_v::timestamp,least((period_v+interval '1 month - 1 day')::date,today_v)::timestamp,interval '1 day') g where g::date>=start_v and (end_v is null or g::date<=end_v) and (freq_v<>'unica' or g::date=start_v) and (freq_v<>'diaria' or mod(g::date-start_v,interval_v)=0) and (freq_v<>'semanal' or (extract(dow from g)::integer=any(weekdays_v) and ((g::date-(start_v-((extract(isodow from start_v)::integer-1))::integer))/7)%interval_v=0)) and (freq_v<>'mensual' or ((((extract(year from g)::integer*12+extract(month from g)::integer)-(extract(year from start_v)::integer*12+extract(month from start_v)::integer))%interval_v=0) and extract(day from g)::integer=least(month_day_v,extract(day from (date_trunc('month',g)+interval '1 month - 1 day'))::integer))) loop occurrence_count:=occurrence_count+1; if occurrence_count>1000 then raise exception using errcode='22023',message='La aprobación excede 1000 ocurrencias'; end if; end loop;
 end loop;
 -- Reuse the prepared month core before inserting the new assignments. No nested lock acquisition occurs; later inserts remain in this transaction.
 perform public._coordination_materialize_core(req.owner_id,period_v);
 for line in select value from jsonb_array_elements(version_row.payload->'lines') loop
  line_id:=(line->>'lineId')::uuid; company_v:=(line->>'companyId')::uuid; team_v:=(line->>'teamId')::uuid; source_v:=line->'source'; sched:=line->'schedule'; start_v:=(sched->>'startDate')::date; end_v:=case when sched->>'endDate' is null then null else (sched->>'endDate')::date end; freq_v:=sched->>'frequency'; interval_v:=(sched->>'interval')::smallint; weekdays_v:=array(select (x#>>'{}')::smallint from jsonb_array_elements(sched->'weekdays') x); month_day_v:=(sched->>'monthDay')::smallint; deadline_v:=(sched->>'hasDeadline')::boolean; offset_v:=(sched->>'dueOffsetDays')::smallint;
  template_version_v:=null; tv:=null;
  if source_v->>'type'='catalogue' then
   template_version_v:=(source_v->>'templateVersionId')::uuid; select * into tv from public.task_template_versions v where v.id=template_version_v and v.organization_id=org;
   if not found or not exists(select 1 from public.task_templates t where t.id=tv.template_id and t.organization_id=org and t.active and t.version=tv.version) or tv.effective_on is null or start_v<tv.effective_on then raise exception using errcode='40001',message='El catálogo cambió; recargue'; end if;
   title_v:=tv.title; objective_v:=tv.objective; sector_v:=tv.sector; kind_v:=tv.kind; weight_v:=tv.weight; unit_v:=tv.unit; target_v:=tv.monthly_target; checklist_v:=tv.checklist; measurement_v:=tv.measurement_version;
   if exists(select 1 from public.task_assignments a where a.owner_id=req.owner_id and a.company_id=company_v and a.template_version_id=template_version_v and a.frequency=freq_v and a.start_date=start_v and a.end_date is not distinct from end_v) then raise exception using errcode='22023',message='El estándar ya está asignado a esa empresa'; end if;
  else
   def_v:=source_v->'definition'; title_v:=def_v->>'title'; objective_v:=def_v->>'objective'; sector_v:=def_v->>'sector'; kind_v:=def_v->>'kind'; checklist_v:=case when kind_v='resultado' then (select coalesce(jsonb_agg(jsonb_build_object('id',x->>'id','text',x->>'text')), '[]'::jsonb) from jsonb_array_elements(def_v->'checklist') x) else '[]'::jsonb end;
   if kind_v='resultado' then override_weight:=(select (x->>'weight')::numeric from jsonb_array_elements(payload->'weightOverrides') x where x->>'lineId'=line_id::text); weight_v:=override_weight; unit_v:=null; target_v:=null; measurement_v:=1;
   else weight_v:=null; unit_v:=def_v->>'unit'; target_v:=null; measurement_v:=2; end if;
  end if;
  insert into public.task_assignments(organization_id,template_id,template_version_id,company_id,owner_id,team_id,title,kind,weight,unit,target,frequency,start_month,due_day,checklist,start_date,end_date,interval_count,weekdays,month_day,has_deadline,due_offset_days,measurement_version,definition_revision)
   values(org,tv.template_id,template_version_v,company_v,req.owner_id,team_v,title_v,kind_v,weight_v,unit_v,target_v,freq_v,date_trunc('month',start_v)::date,extract(day from start_v)::integer,coalesce(checklist_v,'[]'::jsonb),start_v,end_v,interval_v,case when cardinality(weekdays_v)=0 then array[1]::smallint[] else weekdays_v end,month_day_v,deadline_v,offset_v,measurement_v,0) returning id into assignment_id;
  assignment_ids:=array_append(assignment_ids,assignment_id);
  insert into public.onboarding_activations(organization_id,request_id,revision,line_id,assignment_id) values(org,req_id,req.current_revision,line_id,assignment_id);
 end loop;
 -- New assignments start only through today's date; future starts remain active without an occurrence in this month.
 insert into public.task_instances(organization_id,assignment_id,template_version_id,company_id,owner_id,team_id,period,scheduled_on,title,kind,weight,unit,target,due_date,checklist,measurement_version)
 select a.organization_id,a.id,a.template_version_id,a.company_id,a.owner_id,a.team_id,period_v,d.day_v,a.title,a.kind,a.weight,a.unit,a.target,case when a.has_deadline then d.day_v+a.due_offset_days else null end,
  coalesce((select jsonb_agg(jsonb_build_object('id',coalesce(nullif(x->>'id',''),gen_random_uuid()::text),'text',x->>'text','done',false) order by pos) from jsonb_array_elements(a.checklist) with ordinality it(x,pos)),'[]'::jsonb),a.measurement_version
 from public.task_assignments a cross join lateral (select g::date day_v from generate_series(period_v::timestamp,least((period_v+interval '1 month - 1 day')::date,today_v)::timestamp,interval '1 day') g where g::date>=a.start_date and (a.end_date is null or g::date<=a.end_date) and (a.frequency<>'unica' or g::date=a.start_date) and (a.frequency<>'diaria' or mod(g::date-a.start_date,a.interval_count)=0) and (a.frequency<>'semanal' or (extract(dow from g)::integer=any(a.weekdays) and ((g::date-(a.start_date-((extract(isodow from a.start_date)::integer-1))::integer))/7)%a.interval_count=0)) and (a.frequency<>'mensual' or ((((extract(year from g)::integer*12+extract(month from g)::integer)-(extract(year from a.start_date)::integer*12+extract(month from a.start_date)::integer))%a.interval_count=0) and extract(day from g)::integer=least(a.month_day,extract(day from (date_trunc('month',g)+interval '1 month - 1 day'))::integer))) ) d
 where a.id=any(assignment_ids);
 get diagnostics created_count=row_count;
 select coalesce(array_agg(ti.id order by ti.scheduled_on,ti.id),'{}'::uuid[]) into task_ids from public.task_instances ti where ti.assignment_id=any(assignment_ids) and ti.period=period_v and ti.scheduled_on<=today_v;
 update public.onboarding_requests set status='approved',approved_at=clock_timestamp(),approved_by=actor,updated_at=clock_timestamp() where id=req_id;
 insert into app_private.api_creation_heads(organization_id,owner_id) values(org,req.owner_id) on conflict(organization_id,owner_id) do update set fence_epoch=app_private.api_creation_heads.fence_epoch+1;
 update app_private.api_creation_heads set revision=revision+1 where organization_id=org and owner_id=req.owner_id;
 insert into public.onboarding_reviews(organization_id,request_id,revision,actor_id,action,note) values(org,req_id,req.current_revision,actor,'approved','');
 result_v:=jsonb_build_object('contractVersion',1,'operationId',op,'kind','onboarding.approve','result',jsonb_build_object('requestId',req_id,'revision',req.current_revision::text,'status','approved','activationCount',cardinality(assignment_ids),'assignmentIds',to_jsonb(assignment_ids),'createdTaskIds',to_jsonb(task_ids)));
 insert into app_private.api_command_receipts(actor_id,operation_id,organization_id,kind,arguments,result) values(actor,op,org,'onboarding.approve',args,result_v);
 insert into public.audit_events(organization_id,actor_id,action,entity_id,details) values(org,actor,'onboarding.approved',req_id,jsonb_build_object('revision',req.current_revision,'activationCount',cardinality(assignment_ids)));
 return result_v;
end $$;

create function app_private.api_assert_month_open(p_owner uuid,p_period date) returns void
language plpgsql set search_path='' as $$
begin
 perform public._coordination_assert_month(p_owner,p_period);
exception when raise_exception then
 if sqlerrm='El mes está cerrado' then raise exception using errcode='55000',message='GP_CLOSED_UNIT'; end if;
 raise;
end $$;
revoke all on function app_private.api_assert_month_open(uuid,date) from public,anon,authenticated,service_role;

create function app_private.api_creation_command(p jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare
 actor uuid:=auth.uid(); c jsonb; org uuid; role_v text; kind_v text; op uuid; payload jsonb; expected jsonb; args jsonb;
 existing app_private.api_command_receipts%rowtype; owner_v uuid; owner_active boolean; owner_role text; manager_v uuid;
 company_v uuid; team_v uuid; source_v jsonb; definition_v jsonb; schedule_v jsonb; template_version_v uuid; template_id_v uuid;
 template_version_no integer; expected_template bigint; expected_creation bigint; creation_rev bigint; current_catalog_revision integer; catalog_active boolean; period_v date; start_v date; end_v date;
 due_v date; freq_v text; interval_v smallint; weekdays_v smallint[]; month_day_v smallint; deadline_v boolean; offset_v smallint;
 title_v text; objective_v text; sector_v text; task_kind text; weight_v numeric; unit_v text; target_v integer;
 checklist_v jsonb; measurement_v smallint; catalog_locks text[]:='{}'; expected_keys text[]; months jsonb; plan jsonb;
 assignment_v uuid; task_v uuid; task_revision bigint; created_tasks uuid[]:='{}'; previous_tasks uuid[]:='{}'; result_v jsonb;
 day_v date; occurrence_count integer:=0;
begin
 if actor is null then raise exception using errcode='28000',message='Autenticación requerida'; end if;
 if octet_length(coalesce(p::text,''))>32768 or not app_private.api_exact_keys(p,array['contractVersion','operationId','kind','expectedRevisions','payload']) or jsonb_typeof(p->'contractVersion') is distinct from 'number' or p->>'contractVersion'<>'1' then raise exception using errcode='22023',message='Solicitud inválida'; end if;
 kind_v:=p->>'kind'; if kind_v not in ('assignment.create','task.createOneOff','month.materialize') then raise exception using errcode='0A000',message='Operación no disponible'; end if;
 op:=app_private.api_uuid(p,'operationId'); payload:=p->'payload'; expected:=p->'expectedRevisions';
 if jsonb_typeof(expected) is distinct from 'object' or jsonb_typeof(payload) is distinct from 'object' then raise exception using errcode='22023',message='Solicitud inválida'; end if;
 if kind_v='assignment.create' and not app_private.api_exact_keys(payload,array['ownerId','companyId','teamId','source','schedule']) or kind_v='task.createOneOff' and not app_private.api_exact_keys(payload,array['ownerId','companyId','teamId','source','scheduledOn','dueDate','priority']) or kind_v='month.materialize' and not app_private.api_exact_keys(payload,array['ownerId','period']) then raise exception using errcode='22023',message='Solicitud inválida'; end if;
 owner_v:=app_private.api_uuid(payload,'ownerId'); c:=app_private.api_require_business(false); org:=(c->'principal'->>'organizationId')::uuid; role_v:=c->'principal'->>'role';
 if kind_v in ('assignment.create','month.materialize') and (role_v<>'jefe' or c->'authentication'->>'aal'<>'aal2') then raise exception using errcode='42501',message='Contexto no autorizado'; end if;
 if kind_v='task.createOneOff' and role_v<>'empleado' and c->'authentication'->>'aal'<>'aal2' then raise exception using errcode='42501',message='Contexto no autorizado'; end if;
 args:=jsonb_build_object('kind',kind_v,'payload',payload,'expectedRevisions',expected);
 perform public._coordination_receipt_lock(actor,op);
 perform public._coordination_lock_keys(1102,array[actor::text]);
 -- For this narrow replay family, compare the immutable receipt identity and
 -- arguments before revalidating the current actor. A reused operation id with
 -- changed arguments is always a conflict (40001), even if authorization has
 -- changed since the original request.
 if kind_v='assignment.create' then
  select * into existing from app_private.api_command_receipts where actor_id=actor and operation_id=op;
  if existing.actor_id is not null then
   if existing.kind<>kind_v or existing.arguments is distinct from args then raise exception using errcode='40001',message='Identificador de operación ya utilizado'; end if;
   if existing.organization_id<>org then raise exception using errcode='42501',message='Contexto no autorizado'; end if;
  end if;
 elsif kind_v='month.materialize' then
  select * into existing from app_private.api_command_receipts where actor_id=actor and operation_id=op;
  if existing.actor_id is not null then
   if existing.kind<>kind_v or existing.arguments is distinct from args then raise exception using errcode='40001',message='Identificador de operación ya utilizado'; end if;
   if existing.organization_id<>org then raise exception using errcode='42501',message='Contexto no autorizado'; end if;
  end if;
 end if;
 c:=app_private.api_require_business(false);
 if (c->'principal'->>'organizationId')::uuid<>org then raise exception using errcode='42501',message='Contexto no autorizado'; end if;
 role_v:=c->'principal'->>'role';
 if kind_v in ('assignment.create','month.materialize') and (role_v<>'jefe' or c->'authentication'->>'aal'<>'aal2') then raise exception using errcode='42501',message='Contexto no autorizado'; end if;
 if kind_v='task.createOneOff' and role_v<>'empleado' and c->'authentication'->>'aal'<>'aal2' then raise exception using errcode='42501',message='Contexto no autorizado'; end if;
 select * into existing from app_private.api_command_receipts where actor_id=actor and operation_id=op;
 if existing.actor_id is not null then
  if existing.kind<>kind_v or existing.arguments is distinct from args then raise exception using errcode='40001',message='Identificador de operación ya utilizado'; end if;
  if existing.organization_id<>org then raise exception using errcode='42501',message='Contexto no autorizado'; end if;
  if kind_v='task.createOneOff' then
   company_v:=app_private.api_uuid(payload,'companyId'); team_v:=app_private.api_uuid(payload,'teamId');
   start_v:=app_private.api_date(payload,'scheduledOn'); period_v:=date_trunc('month',start_v)::date;
   months:=jsonb_build_array(jsonb_build_object('ownerId',owner_v,'period',period_v));
   -- Exact replay stays ahead of catalogue, month and revision eligibility,
   -- but current actor/owner and company/team authorization still serialize
   -- against revocation. The read-only plan takes advisory locks before rows
   -- and must not create/increment membership fences.
   plan:=public._coordination_prepare('{}'::uuid[],array[actor],array[actor,owner_v],months,array[]::text[],'{}'::jsonb);
   perform app_private._coordination_acquire_m22b(plan,false);
   c:=app_private.api_require_business(false);
   if (c->'principal'->>'organizationId')::uuid<>org or c->'principal'->>'role'<>role_v then raise exception using errcode='42501',message='Contexto no autorizado'; end if;
   perform 1 from public.profiles p where p.id=actor and p.organization_id=org and p.active for share;
   if not found then raise exception using errcode='42501',message='Contexto no autorizado'; end if;
   select p.active,p.role,p.manager_id into owner_active,owner_role,manager_v from public.profiles p where p.id=owner_v and p.organization_id=org for share;
   if not found or not owner_active or owner_role<>'empleado' or (role_v='empleado' and owner_v<>actor) or (role_v='encargado' and manager_v is distinct from actor) then raise exception using errcode='42501',message='Contexto no autorizado'; end if;
   perform 1 from public.company_memberships cm where cm.organization_id=org and cm.profile_id=owner_v and cm.company_id=company_v and cm.active for share;
   if not found then raise exception using errcode='42501',message='La empresa o el equipo no está asignado'; end if;
   perform 1 from public.team_members tm where tm.organization_id=org and tm.profile_id=owner_v and tm.team_id=team_v for share;
   if not found then raise exception using errcode='42501',message='La empresa o el equipo no está asignado'; end if;
  elsif kind_v='assignment.create' then
   company_v:=app_private.api_uuid(payload,'companyId'); team_v:=app_private.api_uuid(payload,'teamId');
   start_v:=app_private.api_date(payload->'schedule','startDate'); period_v:=date_trunc('month',start_v)::date;
   -- An exact assignment replay is an authorized read of historical work.
   -- Reuse the membership writer's actor/profile/month/scope locks so a revoke
   -- serializes with the replay, without creating or advancing any fences.
   plan:=public._coordination_prepare('{}'::uuid[],array[actor],array[actor,owner_v],
    jsonb_build_array(jsonb_build_object('ownerId',owner_v,'period',period_v)),
    array['membership:'||company_v::text||':'||owner_v::text],
    jsonb_build_object('membership',owner_v,'company',company_v));
   perform app_private._coordination_acquire_m22b(plan,false);
   c:=app_private.api_require_business(false);
   if (c->'principal'->>'organizationId')::uuid<>org or c->'principal'->>'role'<>'jefe'
      or c->'authentication'->>'aal'<>'aal2'
      or not exists(select 1 from public.profiles p where p.id=actor and p.organization_id=org and p.active and p.role='jefe') then
    raise exception using errcode='42501',message='Contexto no autorizado';
   end if;
   select p.active,p.role into owner_active,owner_role from public.profiles p
    where p.id=owner_v and p.organization_id=org for share;
   if not found or not owner_active or owner_role<>'empleado' then
    raise exception using errcode='42501',message='El responsable no está activo';
   end if;
   perform 1 from public.company_memberships cm
    where cm.organization_id=org and cm.profile_id=owner_v and cm.company_id=company_v and cm.active for share;
   if not found then raise exception using errcode='42501',message='La empresa o el equipo no está asignado'; end if;
   perform 1 from public.team_members tm
    where tm.organization_id=org and tm.profile_id=owner_v and tm.team_id=team_v for share;
   if not found then raise exception using errcode='42501',message='La empresa o el equipo no está asignado'; end if;
  elsif kind_v='month.materialize' then
   period_v:=app_private.api_date(payload,'period');
   if extract(day from period_v)<>1 then raise exception using errcode='22023',message='Período inválido'; end if;
   -- Historical replay is an authorized read: lock actor/owner profiles and
   -- owner-period only. Do not request a materialize scope or write fences.
   months:=jsonb_build_array(jsonb_build_object('ownerId',owner_v,'period',period_v));
   plan:=public._coordination_prepare('{}'::uuid[],array[actor],array[actor,owner_v],months,array[]::text[],'{}'::jsonb);
   perform app_private._coordination_acquire_m22b(plan,false);
   c:=app_private.api_require_business(false);
   if (c->'principal'->>'organizationId')::uuid<>org
      or c->'principal'->>'role'<>'jefe' or c->'authentication'->>'aal'<>'aal2'
      or not exists(select 1 from public.profiles p where p.id=actor and p.organization_id=org and p.active and p.role='jefe') then
    raise exception using errcode='42501',message='Contexto no autorizado';
   end if;
   select p.active,p.role into owner_active,owner_role from public.profiles p
    where p.id=owner_v and p.organization_id=org for share;
   if not found or not owner_active or owner_role<>'empleado' then
    raise exception using errcode='42501',message='El responsable no está activo';
   end if;
  else
   perform 1 from public.profiles p where p.id=actor and p.organization_id=org and p.active for share;
   if not found then raise exception using errcode='42501',message='Contexto no autorizado'; end if;
  end if;
  return existing.result;
 end if;
 perform 1 from public.profiles p where p.id=actor and p.organization_id=org and p.active for share;
 if not found then raise exception using errcode='42501',message='Contexto no autorizado'; end if;
 if kind_v='month.materialize' then
  period_v:=app_private.api_date(payload,'period'); if extract(day from period_v)<>1 then raise exception using errcode='22023',message='Período inválido'; end if;
 else
  company_v:=app_private.api_uuid(payload,'companyId'); team_v:=app_private.api_uuid(payload,'teamId'); source_v:=payload->'source';
  if source_v->>'type'='custom' and app_private.api_exact_keys(source_v,array['type','definition']) then definition_v:=source_v->'definition'; perform app_private.api_validate_definition_v2(definition_v);
  elsif source_v->>'type'='catalogue' and app_private.api_exact_keys(source_v,array['type','templateVersionId']) then template_version_v:=app_private.api_uuid(source_v,'templateVersionId');
   select v.template_id,v.version into template_id_v,template_version_no from public.task_template_versions v join public.task_templates t on t.id=v.template_id and t.organization_id=v.organization_id where v.id=template_version_v and v.organization_id=org;
   if not found then raise exception using errcode='42501',message='Contexto no autorizado'; end if; catalog_locks:=array['template:'||template_id_v::text];
  else raise exception using errcode='22023',message='Origen inválido'; end if;
  if kind_v='assignment.create' then schedule_v:=payload->'schedule';
  else
   start_v:=app_private.api_date(payload,'scheduledOn'); period_v:=date_trunc('month',start_v)::date; due_v:=case when payload->'dueDate'='null'::jsonb then null else app_private.api_date(payload,'dueDate') end;
   if due_v is not null and (due_v<start_v or date_trunc('month',due_v)::date<>period_v) or payload->>'priority' not in ('Alta','Media','Baja') then raise exception using errcode='22023',message='Tarea inválida'; end if;
   schedule_v:=jsonb_build_object('frequency','unica','startDate',start_v,'endDate',start_v,'interval',1,'weekdays','[]'::jsonb,'monthDay',extract(day from start_v)::integer,'hasDeadline',due_v is not null,'dueOffsetDays',coalesce(due_v-start_v,0));
  end if;
  -- Structural validation may read a historical catalogue version before locks;
  -- current eligibility is checked only after exact replay and fence/revision checks.
  perform app_private.api_validate_onboarding_v2(jsonb_build_object('schemaVersion',2,'lines',jsonb_build_array(jsonb_build_object('lineId',gen_random_uuid(),'companyId',company_v,'teamId',team_v,'source',source_v,'schedule',schedule_v))),true,org,true);
  start_v:=coalesce(start_v,(schedule_v->>'startDate')::date); period_v:=date_trunc('month',start_v)::date;
 end if;
 expected_keys:=array['creation:'||owner_v::text]||case when template_id_v is null then '{}'::text[] else array['catalogue:'||template_id_v::text] end;
 if not app_private.api_exact_keys(expected,expected_keys) then raise exception using errcode='22023',message='Revisiones inválidas'; end if;
 expected_creation:=app_private.api_expected(expected,'creation:'||owner_v); if template_id_v is not null then expected_template:=app_private.api_expected(expected,'catalogue:'||template_id_v); end if;
 months:=jsonb_build_array(jsonb_build_object('ownerId',owner_v,'period',period_v));
 if kind_v='month.materialize' then plan:=public._coordination_prepare('{}'::uuid[],array[actor],array[owner_v],months,catalog_locks||array['creation:'||owner_v],jsonb_build_object('kind','materialize','owner',owner_v,'period',period_v));
 else plan:=public._coordination_prepare('{}'::uuid[],array[actor],array[owner_v],months,catalog_locks||array['creation:'||owner_v],'{}'::jsonb); end if;
 perform app_private._coordination_acquire_m22b(plan);
 c:=app_private.api_require_business(false); if (c->'principal'->>'organizationId')::uuid<>org or c->'principal'->>'role'<>role_v then raise exception using errcode='42501',message='Contexto no autorizado'; end if;
 if template_id_v is not null then
  select version,active into current_catalog_revision,catalog_active from public.task_templates where id=template_id_v and organization_id=org for share;
  if not found or not catalog_active or current_catalog_revision<>expected_template then raise exception using errcode='40001',message='El catálogo cambió; recargue'; end if;
  perform app_private.api_validate_onboarding_v2(jsonb_build_object('schemaVersion',2,'lines',jsonb_build_array(jsonb_build_object('lineId',gen_random_uuid(),'companyId',company_v,'teamId',team_v,'source',source_v,'schedule',schedule_v))),true,org,false);
 end if;
 select p.active,p.role,p.manager_id into owner_active,owner_role,manager_v from public.profiles p where p.id=owner_v and p.organization_id=org for share;
 if not found or not owner_active or owner_role<>'empleado' then raise exception using errcode='42501',message='El responsable no está activo'; end if;
 if role_v='empleado' and owner_v<>actor or role_v='encargado' and manager_v is distinct from actor then raise exception using errcode='42501',message='Contexto no autorizado'; end if;
 if kind_v<>'month.materialize' then
  if not exists(select 1 from public.company_memberships cm where cm.organization_id=org and cm.profile_id=owner_v and cm.company_id=company_v and cm.active) or not exists(select 1 from public.team_members tm where tm.organization_id=org and tm.profile_id=owner_v and tm.team_id=team_v) then raise exception using errcode='42501',message='La empresa o el equipo no está asignado'; end if;
 end if;
 if existing.actor_id is not null then return existing.result; end if;
 perform app_private.api_touch_month_fences(org,plan->'months');
 if kind_v<>'month.materialize' then
  if template_version_v is not null then
   select v.template_id,v.version,v.measurement_version,v.title,v.objective,v.sector,v.kind,v.weight,v.unit,v.monthly_target,v.checklist,v.effective_on into template_id_v,template_version_no,measurement_v,title_v,objective_v,sector_v,task_kind,weight_v,unit_v,target_v,checklist_v,end_v from public.task_template_versions v join public.task_templates t on t.id=v.template_id and t.organization_id=v.organization_id where v.id=template_version_v and v.organization_id=org and t.active and t.version=v.version for share of t;
   if not found or template_version_no<>expected_template or end_v is null or start_v<end_v then raise exception using errcode='40001',message='El catálogo cambió; recargue'; end if;
  else
   title_v:=definition_v->>'title'; objective_v:=definition_v->>'objective'; sector_v:=definition_v->>'sector'; task_kind:=definition_v->>'kind'; checklist_v:=case when task_kind='resultado' then (select coalesce(jsonb_agg(jsonb_build_object('id',x->>'id','text',x->>'text')),'[]'::jsonb) from jsonb_array_elements(definition_v->'checklist') x) else '[]'::jsonb end; measurement_v:=case when task_kind='operativa' then 2 else 1 end; unit_v:=definition_v->>'unit'; target_v:=null; weight_v:=case when task_kind='resultado' then (definition_v->>'weight')::numeric else null end;
   if kind_v='task.createOneOff' and role_v<>'jefe' and task_kind='resultado' then weight_v:=1; end if;
  end if;
  perform app_private.api_assert_month_open(owner_v,period_v);
 end if;
 insert into app_private.api_creation_heads(organization_id,owner_id) values(org,owner_v) on conflict(organization_id,owner_id) do update set fence_epoch=app_private.api_creation_heads.fence_epoch+1;
 select revision into creation_rev from app_private.api_creation_heads where organization_id=org and owner_id=owner_v for update;
 if expected_creation<>creation_rev then raise exception using errcode='40001',message='La creación cambió; recargue'; end if;
 insert into app_private.api_operation_fences(actor_id,operation_id) values(actor,op);
 if kind_v='month.materialize' then
  perform app_private.api_assert_month_open(owner_v,period_v);
  select coalesce(array_agg(t.id),'{}'::uuid[]) into previous_tasks from public.task_instances t where t.organization_id=org and t.owner_id=owner_v and t.period=period_v;
  select count(*)::integer into occurrence_count from public.task_assignments a cross join lateral generate_series(greatest(a.start_date,period_v)::timestamp,least(coalesce(a.end_date,(period_v+interval '1 month - 1 day')::date),(period_v+interval '1 month - 1 day')::date)::timestamp,interval '1 day') d where a.organization_id=org and a.owner_id=owner_v and a.start_date<period_v+interval '1 month' and (a.end_date is null or a.end_date>=period_v) and (a.frequency<>'unica' or d::date=a.start_date) and (a.frequency<>'diaria' or mod(d::date-a.start_date,a.interval_count)=0) and (a.frequency<>'semanal' or (extract(dow from d)::integer=any(a.weekdays) and ((d::date-(a.start_date-((extract(isodow from a.start_date)::integer-1))::integer))/7)%a.interval_count=0)) and (a.frequency<>'mensual' or ((((extract(year from d)::integer*12+extract(month from d)::integer)-(extract(year from a.start_date)::integer*12+extract(month from a.start_date)::integer))%a.interval_count=0) and extract(day from d)::integer=least(a.month_day,extract(day from (date_trunc('month',d)+interval '1 month - 1 day'))::integer)));
  if occurrence_count>1000 then raise exception using errcode='22023',message='La materialización excede 1000 ocurrencias'; end if;
  perform public._coordination_materialize_core(owner_v,period_v);
  select coalesce(array_agg(t.id order by t.scheduled_on,t.id),'{}'::uuid[]) into created_tasks from public.task_instances t where t.organization_id=org and t.owner_id=owner_v and t.period=period_v and not (t.id=any(previous_tasks));
  update app_private.api_creation_heads set revision=revision+1 where organization_id=org and owner_id=owner_v returning revision into creation_rev;
  result_v:=jsonb_build_object('contractVersion',1,'operationId',op,'kind',kind_v,'result',jsonb_build_object('ownerId',owner_v,'period',period_v,'createdTaskIds',to_jsonb(created_tasks),'creationRevision',creation_rev::text));
 else
  if kind_v='assignment.create' then freq_v:=schedule_v->>'frequency'; start_v:=(schedule_v->>'startDate')::date; end_v:=nullif(schedule_v->>'endDate','')::date; interval_v:=(schedule_v->>'interval')::smallint; weekdays_v:=array(select (x#>>'{}')::smallint from jsonb_array_elements(schedule_v->'weekdays') x); month_day_v:=(schedule_v->>'monthDay')::smallint; deadline_v:=(schedule_v->>'hasDeadline')::boolean; offset_v:=(schedule_v->>'dueOffsetDays')::smallint;
  else freq_v:='unica'; start_v:=(payload->>'scheduledOn')::date; end_v:=start_v; interval_v:=1; weekdays_v:=array[1]::smallint[]; month_day_v:=extract(day from start_v)::smallint; deadline_v:=due_v is not null; offset_v:=coalesce(due_v-start_v,0)::smallint; end_v:=start_v;
  end if;
  insert into public.task_assignments(organization_id,template_id,template_version_id,company_id,owner_id,team_id,title,kind,weight,unit,target,frequency,start_month,due_day,checklist,start_date,end_date,interval_count,weekdays,month_day,has_deadline,due_offset_days,measurement_version,definition_revision)
  values(org,template_id_v,template_version_v,company_v,owner_v,team_v,title_v,task_kind,weight_v,unit_v,target_v,freq_v,date_trunc('month',start_v)::date,extract(day from start_v)::integer,coalesce(checklist_v,'[]'::jsonb),start_v,end_v,interval_v,case when cardinality(weekdays_v)=0 then array[1]::smallint[] else weekdays_v end,month_day_v,deadline_v,offset_v,measurement_v,1) returning id into assignment_v;
  if kind_v='task.createOneOff' then
   insert into public.task_instances(organization_id,assignment_id,template_version_id,company_id,owner_id,team_id,period,scheduled_on,title,kind,weight,unit,target,due_date,checklist,measurement_version,priority)
   values(org,assignment_v,template_version_v,company_v,owner_v,team_v,period_v,start_v,title_v,task_kind,weight_v,unit_v,target_v,due_v,coalesce((select jsonb_agg(jsonb_build_object('id',gen_random_uuid(),'text',x->>'text','done',false) order by pos) from jsonb_array_elements(coalesce(checklist_v,'[]'::jsonb)) with ordinality it(x,pos)),'[]'::jsonb),measurement_v,payload->>'priority') returning id,state_revision into task_v,task_revision;
   if source_v->>'type'='custom' and task_kind='resultado' and role_v<>'jefe' then insert into app_private.assignment_parameterization(assignment_id,organization_id,created_by) values(assignment_v,org,actor); end if;
  end if;
  update app_private.api_creation_heads set revision=revision+1 where organization_id=org and owner_id=owner_v returning revision into creation_rev;
  if kind_v='assignment.create' then result_v:=jsonb_build_object('contractVersion',1,'operationId',op,'kind',kind_v,'result',jsonb_build_object('assignmentId',assignment_v,'assignmentRevision','1'));
  else result_v:=jsonb_build_object('contractVersion',1,'operationId',op,'kind',kind_v,'result',jsonb_build_object('assignmentId',assignment_v,'taskId',task_v,'taskRevision',task_revision::text)); end if;
 end if;
 insert into app_private.api_command_receipts(actor_id,operation_id,organization_id,kind,arguments,result) values(actor,op,org,kind_v,args,result_v);
 insert into public.audit_events(organization_id,actor_id,action,entity_id,details) values(org,actor,kind_v,coalesce(assignment_v,owner_v),jsonb_build_object('ownerId',owner_v,'period',period_v));
 return result_v;
end $$;
revoke all on function app_private.api_creation_command(jsonb) from public,anon,authenticated,service_role;

create function app_private.api_legacy_onboarding_projection(p_payload jsonb) returns jsonb
language plpgsql immutable security definer set search_path='' as $$
declare line jsonb; projected jsonb:='[]'::jsonb; out_line jsonb; line_count integer;
begin
 if jsonb_typeof(p_payload)='object' and p_payload->>'schemaVersion'='2' then return p_payload; end if;
 if jsonb_typeof(p_payload) is distinct from 'object' or jsonb_typeof(p_payload->'lines') is distinct from 'array' then return jsonb_build_object('requiresResubmission',true,'lineCount',0); end if;
 line_count:=jsonb_array_length(p_payload->'lines');
 for line in select value from jsonb_array_elements(p_payload->'lines') loop
  if jsonb_typeof(line) is distinct from 'object' then return jsonb_build_object('requiresResubmission',true,'lineCount',line_count); end if;
  if coalesce(line->>'line_id','') !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
   or coalesce(line->>'company_id','') !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
   or coalesce(line->>'team_id','') !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' then
   return jsonb_build_object('requiresResubmission',true,'lineCount',line_count);
  end if;
  out_line:=jsonb_build_object('line_id',line->>'line_id','company_id',line->>'company_id','team_id',line->>'team_id',
   'template_version_id',line->>'template_version_id','custom_title',line->>'custom_title','kind',line->>'kind','unit',line->>'unit','target',line->'target','checklist',coalesce(line->'checklist','[]'::jsonb),
   'frequency',line->>'frequency','start_date',line->>'start_date','end_date',line->'end_date','interval_count',line->'interval_count','weekdays',coalesce(line->'weekdays','[]'::jsonb),'month_day',line->'month_day','has_deadline',line->'has_deadline','due_offset_days',line->'due_offset_days');
  projected:=projected||jsonb_build_array(out_line);
 end loop;
 return jsonb_build_object('schemaVersion',1,'lines',projected);
end $$;

create function app_private.api_onboarding_submitted_projection(p_request uuid,p_revision integer,p_org uuid,p_status text) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare r public.onboarding_requests%rowtype; v public.onboarding_request_versions%rowtype; reviews jsonb; revisions jsonb; payload_v jsonb; version_v integer;
begin
 select * into r from public.onboarding_requests where id=p_request and organization_id=p_org;
 select * into v from public.onboarding_request_versions where request_id=p_request and organization_id=p_org and revision=p_revision;
 if not found then return null; end if;
 version_v:=case when v.payload->>'schemaVersion'='2' then 2 else 1 end;
 payload_v:=case when version_v=2 then v.payload else app_private.api_legacy_onboarding_projection(v.payload) end;
 select coalesce(jsonb_agg(jsonb_build_object('action',x.action,'actorId',x.actor_id,'at',x.created_at,'reason',nullif(x.note,'')) order by x.created_at,x.id),'[]'::jsonb) into reviews
 from public.onboarding_reviews x where x.request_id=p_request and x.organization_id=p_org and x.revision=p_revision;
 select jsonb_object_agg(key_v,val_v) into revisions from (
  select 'onboarding:'||r.id::text key_v,p_revision::text val_v
  union all
  select 'catalogue:'||t.id::text,t.version::text from public.task_template_versions tv join public.task_templates t on t.id=tv.template_id and t.organization_id=tv.organization_id
   where tv.id in (select (x->'source'->>'templateVersionId')::uuid from jsonb_array_elements(v.payload->'lines') x where x->'source'->>'type'='catalogue')
 ) q;
 return jsonb_build_object('requestId',r.id,'ownerId',r.owner_id,'status',p_status,'revision',p_revision::text,'submittedAt',v.submitted_at,'payloadVersion',version_v,'payload',payload_v,'reviewEvents',reviews,'requiredRevisions',coalesce(revisions,'{}'::jsonb));
end $$;

create function app_private.api_onboarding_query(p jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare c jsonb; actor uuid:=auth.uid(); org uuid; role_v text; k text; f jsonb; cur text; curj jsonb; lim integer; status_v text; owner_filter uuid; owner_v uuid; owner_revision bigint; creation_revision bigint; req public.onboarding_requests%rowtype; draft_v jsonb; submitted_v jsonb; payload_version integer; items jsonb; next_cursor text; last_at timestamptz; last_id uuid; cursor_at timestamptz; cursor_id uuid; op uuid; receipt app_private.api_command_receipts%rowtype; receipt_owner uuid; receipt_request uuid; receipt_plan jsonb; receipt_draft jsonb; receipt_lines jsonb; receipt_scopes text[]; receipt_req_revision bigint; receipt_line jsonb; receipt_company uuid; receipt_team uuid; receipt_period date; owner_active boolean; owner_role text; manager_v uuid;
begin
 if actor is null then raise exception using errcode='28000',message='Autenticación requerida'; end if;
 if octet_length(coalesce(p::text,''))>32768 or not app_private.api_exact_keys(p,array['contractVersion','kind','filters','cursor','limit']) or jsonb_typeof(p->'contractVersion') is distinct from 'number' or p->>'contractVersion'<>'1' or jsonb_typeof(p->'kind') is distinct from 'string' then raise exception using errcode='22023',message='Consulta inválida'; end if;
 c:=app_private.api_require_business(false); org:=(c->'principal'->>'organizationId')::uuid; role_v:=c->'principal'->>'role'; k:=p->>'kind'; f:=p->'filters';
 if jsonb_typeof(p->'cursor') not in ('string','null') or jsonb_typeof(p->'limit') is distinct from 'number' then raise exception using errcode='22023',message='Consulta inválida'; end if;
 cur:=p->>'cursor'; lim:=app_private.api_integer(p,'limit',1,100);
 if k='commandReceipt' then
  if not app_private.api_exact_keys(f,array['operationId']) or lim<>1 or cur is not null then raise exception using errcode='22023',message='Consulta inválida'; end if;
  op:=app_private.api_uuid(f,'operationId'); select * into receipt from app_private.api_command_receipts where actor_id=actor and operation_id=op;
  if not found then return jsonb_build_object('contractVersion',1,'kind',k,'data',jsonb_build_object('found',false)); end if;
  if receipt.kind='companyMembership.setActive' then
   -- Keep the lookup actor-scoped and hide receipts from another organization.
   if receipt.organization_id<>org then return jsonb_build_object('contractVersion',1,'kind',k,'data',jsonb_build_object('found',false)); end if;
    -- A receipt is still an authorized read. Take the read-only ordered locks
    -- before rechecking the principal so stale RR snapshots abort naturally;
    -- this path must never create or increment coordination fences.
    receipt_plan:=public._coordination_prepare('{}'::uuid[],array[actor],array[actor],'[]'::jsonb,'{}'::text[],'{}'::jsonb);
    perform app_private._coordination_acquire_m22b(receipt_plan,false);
    perform app_private.api_revalidate_actor(actor,c);
    select * into receipt from app_private.api_command_receipts where actor_id=actor and operation_id=op;
    if not found or receipt.organization_id<>org or receipt.kind<>'companyMembership.setActive' then
     return jsonb_build_object('contractVersion',1,'kind',k,'data',jsonb_build_object('found',false));
    end if;
   if role_v<>'jefe' or c->'authentication'->>'aal'<>'aal2'
      or not exists(select 1 from public.profiles p where p.id=actor and p.organization_id=org and p.active and p.role='jefe')
      or not exists(select 1 from public.companies co where co.id=(receipt.arguments->'payload'->>'companyId')::uuid and co.organization_id=org)
      or not exists(select 1 from public.profiles subject where subject.id=(receipt.arguments->'payload'->>'profileId')::uuid and subject.organization_id=org) then
    raise exception using errcode='42501',message='Consulta no disponible';
   end if;
   return jsonb_build_object('contractVersion',1,'kind',k,'data',jsonb_build_object('found',true,'command',receipt.result));
  end if;
  if receipt.kind in ('onboarding.saveDraft','onboarding.submit') then
   if receipt.organization_id<>org then return jsonb_build_object('contractVersion',1,'kind',k,'data',jsonb_build_object('found',false)); end if;
   if role_v<>'empleado' then raise exception using errcode='42501',message='Consulta no disponible'; end if;
   if receipt.kind='onboarding.saveDraft' then
    receipt_draft:=receipt.arguments->'payload'->'draft';
   else
    receipt_request:=app_private.api_uuid(receipt.arguments->'payload','requestId');
    receipt_req_revision:=app_private.api_expected(receipt.result->'result','revision');
    if receipt_req_revision<1 then raise exception using errcode='42501',message='Consulta no disponible'; end if;
    select v.payload into receipt_draft
     from public.onboarding_requests r
     join public.onboarding_request_versions v on v.request_id=r.id and v.organization_id=r.organization_id and v.revision=receipt_req_revision
     where r.id=receipt_request and r.organization_id=org and r.owner_id=actor;
    if not found then raise exception using errcode='42501',message='Consulta no disponible'; end if;
   end if;
   receipt_lines:=receipt_draft->'lines';
   if jsonb_typeof(receipt_lines) is distinct from 'array' then raise exception using errcode='42501',message='Consulta no disponible'; end if;
   select coalesce(array_agg(distinct 'membership:'||(line->>'companyId')||':'||actor::text order by 'membership:'||(line->>'companyId')||':'||actor::text),'{}'::text[])
    into receipt_scopes from jsonb_array_elements(receipt_lines) line;
   -- Serialize this authorized read with company-membership revocation using
   -- the same actor/profile/company lock order as writers. Read-only acquisition
   -- does not create fences. Submit checks the immutable submitted version
   -- named by this receipt, not a later mutable draft.
   receipt_plan:=public._coordination_prepare('{}'::uuid[],array[actor],array[actor],'[]'::jsonb,receipt_scopes,'{}'::jsonb);
   perform app_private._coordination_acquire_m22b(receipt_plan,false);
   perform app_private.api_revalidate_actor(actor,c);
   select * into receipt from app_private.api_command_receipts where actor_id=actor and operation_id=op;
   if not found or receipt.organization_id<>org or receipt.kind not in ('onboarding.saveDraft','onboarding.submit') then
    return jsonb_build_object('contractVersion',1,'kind',k,'data',jsonb_build_object('found',false));
   end if;
   perform 1 from public.profiles p where p.id=actor and p.organization_id=org and p.active and p.role='empleado' for share;
   if not found then raise exception using errcode='42501',message='Consulta no disponible'; end if;
   for receipt_line in select value from jsonb_array_elements(receipt_lines) order by value->>'companyId',value->>'teamId' loop
    perform 1 from public.company_memberships cm where cm.organization_id=org and cm.company_id=app_private.api_uuid(receipt_line,'companyId') and cm.profile_id=actor and cm.active for share;
    if not found then raise exception using errcode='42501',message='Consulta no disponible'; end if;
    perform 1 from public.team_members tm where tm.organization_id=org and tm.team_id=app_private.api_uuid(receipt_line,'teamId') and tm.profile_id=actor for share;
    if not found then raise exception using errcode='42501',message='Consulta no disponible'; end if;
   end loop;
   return jsonb_build_object('contractVersion',1,'kind',k,'data',jsonb_build_object('found',true,'command',receipt.result));
  end if;
  if receipt.kind='task.createOneOff' then
   receipt_owner:=app_private.api_uuid(receipt.arguments->'payload','ownerId');
   receipt_company:=app_private.api_uuid(receipt.arguments->'payload','companyId');
   receipt_team:=app_private.api_uuid(receipt.arguments->'payload','teamId');
   receipt_period:=date_trunc('month',app_private.api_date(receipt.arguments->'payload','scheduledOn'))::date;
   if receipt.organization_id<>org then return jsonb_build_object('contractVersion',1,'kind',k,'data',jsonb_build_object('found',false)); end if;
   -- A one-off receipt is an authorized read of the assigned work. Use the
   -- same membership coordination key and profile/month locks as creation and
   -- revocation, without writing fences. This makes RC reads serialize with a
   -- revoker and forces a stale RR snapshot to abort before revealing the row.
   receipt_scopes:=array['membership:'||receipt_company::text||':'||receipt_owner::text];
   receipt_plan:=public._coordination_prepare('{}'::uuid[],array[actor],array[actor,receipt_owner],
    jsonb_build_array(jsonb_build_object('ownerId',receipt_owner,'period',receipt_period)),receipt_scopes,'{}'::jsonb);
   perform app_private._coordination_acquire_m22b(receipt_plan,false);
   perform app_private.api_revalidate_actor(actor,c);
   role_v:=c->'principal'->>'role';
   select * into receipt from app_private.api_command_receipts where actor_id=actor and operation_id=op;
   if not found or receipt.organization_id<>org or receipt.kind<>'task.createOneOff' then
    return jsonb_build_object('contractVersion',1,'kind',k,'data',jsonb_build_object('found',false));
   end if;
   if role_v not in ('empleado','encargado','jefe')
      or role_v<>'empleado' and c->'authentication'->>'aal'<>'aal2' then
    raise exception using errcode='42501',message='Consulta no disponible';
   end if;
   perform 1 from public.profiles p where p.id=actor and p.organization_id=org and p.active for share;
   if not found then raise exception using errcode='42501',message='Consulta no disponible'; end if;
   select p.active,p.role,p.manager_id into owner_active,owner_role,manager_v
    from public.profiles p where p.id=receipt_owner and p.organization_id=org for share;
   if not found or not owner_active or owner_role<>'empleado'
      or (role_v='empleado' and receipt_owner<>actor)
      or (role_v='encargado' and manager_v is distinct from actor) then
    raise exception using errcode='42501',message='Consulta no disponible';
   end if;
   perform 1 from public.company_memberships cm where cm.organization_id=org
    and cm.profile_id=receipt_owner and cm.company_id=receipt_company and cm.active for share;
   if not found then raise exception using errcode='42501',message='Consulta no disponible'; end if;
   perform 1 from public.team_members tm where tm.organization_id=org
    and tm.profile_id=receipt_owner and tm.team_id=receipt_team for share;
   if not found then raise exception using errcode='42501',message='Consulta no disponible'; end if;
   return jsonb_build_object('contractVersion',1,'kind',k,'data',jsonb_build_object('found',true,'command',receipt.result));
  end if;
  if receipt.kind in ('assignment.create','month.materialize') then
   receipt_owner:=app_private.api_uuid(receipt.arguments->'payload','ownerId');
   if receipt.organization_id<>org then return jsonb_build_object('contractVersion',1,'kind',k,'data',jsonb_build_object('found',false)); end if;
   if receipt.kind='assignment.create' then
    receipt_company:=app_private.api_uuid(receipt.arguments->'payload','companyId');
    receipt_team:=app_private.api_uuid(receipt.arguments->'payload','teamId');
    receipt_period:=date_trunc('month',app_private.api_date(receipt.arguments->'payload'->'schedule','startDate'))::date;
    receipt_scopes:=array['membership:'||receipt_company::text||':'||receipt_owner::text];
   else
    receipt_period:=app_private.api_date(receipt.arguments->'payload','period');
    if extract(day from receipt_period)<>1 then raise exception using errcode='42501',message='Consulta no disponible'; end if;
    receipt_scopes:=array[]::text[];
   end if;
   receipt_plan:=public._coordination_prepare('{}'::uuid[],array[actor],array[actor,receipt_owner],
    jsonb_build_array(jsonb_build_object('ownerId',receipt_owner,'period',receipt_period)),receipt_scopes,
    case when receipt.kind='assignment.create' then jsonb_build_object('membership',receipt_owner,'company',receipt_company) else '{}'::jsonb end);
   perform app_private._coordination_acquire_m22b(receipt_plan,false);
   perform app_private.api_revalidate_actor(actor,c);
   role_v:=c->'principal'->>'role';
   select * into receipt from app_private.api_command_receipts where actor_id=actor and operation_id=op;
   if not found or receipt.organization_id<>org or receipt.kind not in ('assignment.create','month.materialize') then
    return jsonb_build_object('contractVersion',1,'kind',k,'data',jsonb_build_object('found',false));
   end if;
   if role_v<>'jefe' or c->'authentication'->>'aal'<>'aal2' then raise exception using errcode='42501',message='Consulta no disponible'; end if;
   perform 1 from public.profiles p where p.id=actor and p.organization_id=org and p.active and p.role='jefe' for share;
   if not found then raise exception using errcode='42501',message='Consulta no disponible'; end if;
   select p.active,p.role into owner_active,owner_role from public.profiles p
    where p.id=receipt_owner and p.organization_id=org for share;
   if not found or not owner_active or owner_role<>'empleado' then raise exception using errcode='42501',message='Consulta no disponible'; end if;
   if receipt.kind='assignment.create' then
    perform 1 from public.company_memberships cm where cm.organization_id=org
     and cm.profile_id=receipt_owner and cm.company_id=receipt_company and cm.active for share;
    if not found then raise exception using errcode='42501',message='Consulta no disponible'; end if;
    perform 1 from public.team_members tm where tm.organization_id=org
     and tm.profile_id=receipt_owner and tm.team_id=receipt_team for share;
    if not found then raise exception using errcode='42501',message='Consulta no disponible'; end if;
   end if;
   return jsonb_build_object('contractVersion',1,'kind',k,'data',jsonb_build_object('found',true,'command',receipt.result));
  end if;
  if receipt.organization_id<>org or receipt.kind not in ('onboarding.saveDraft','onboarding.submit','onboarding.requestChanges','onboarding.approve','assignment.create','task.createOneOff','month.materialize') then return null; end if;
  if receipt.kind in ('onboarding.saveDraft','onboarding.submit') and role_v<>'empleado' then raise exception using errcode='42501',message='Consulta no disponible'; end if;
  if receipt.kind in ('onboarding.requestChanges','onboarding.approve','assignment.create','month.materialize') and (role_v<>'jefe' and not (receipt.kind='onboarding.requestChanges' and role_v='encargado') or c->'authentication'->>'aal'<>'aal2') then raise exception using errcode='42501',message='Consulta no disponible'; end if;
  if receipt.kind='onboarding.approve' then
   receipt_request:=app_private.api_uuid(receipt.arguments->'payload','requestId');
   receipt_req_revision:=app_private.api_expected(receipt.result->'result','revision');
   if receipt_req_revision<1 or receipt.result#>>'{result,requestId}' is distinct from receipt_request::text then raise exception using errcode='42501',message='Consulta no disponible'; end if;
   select r.owner_id,v.payload into receipt_owner,receipt_draft
    from public.onboarding_requests r join public.onboarding_request_versions v
     on v.request_id=r.id and v.organization_id=r.organization_id and v.revision=receipt_req_revision and v.submitted_by=r.owner_id
    where r.id=receipt_request and r.organization_id=org;
   if not found then raise exception using errcode='42501',message='Consulta no disponible'; end if;
   receipt_lines:=receipt_draft->'lines';
   if jsonb_typeof(receipt_lines) is distinct from 'array' then raise exception using errcode='42501',message='Consulta no disponible'; end if;
   select coalesce(array_agg(distinct 'membership:'||(line->>'companyId')||':'||receipt_owner::text order by 'membership:'||(line->>'companyId')||':'||receipt_owner::text),'{}'::text[])
    into receipt_scopes from jsonb_array_elements(receipt_lines) line;
   receipt_plan:=public._coordination_prepare('{}'::uuid[],array[actor],array[actor,receipt_owner],'[]'::jsonb,receipt_scopes,'{}'::jsonb);
   perform app_private._coordination_acquire_m22b(receipt_plan,false);
   perform app_private.api_revalidate_actor(actor,c);
   select * into receipt from app_private.api_command_receipts where actor_id=actor and operation_id=op;
   if not found or receipt.organization_id<>org or receipt.kind<>'onboarding.approve' then return jsonb_build_object('contractVersion',1,'kind',k,'data',jsonb_build_object('found',false)); end if;
   perform 1 from public.profiles p where p.id=actor and p.organization_id=org and p.active and p.role='jefe' for share;
   if not found then raise exception using errcode='42501',message='Consulta no disponible'; end if;
   perform 1 from public.profiles p where p.id=receipt_owner and p.organization_id=org and p.active and p.role='empleado' for share;
   if not found then raise exception using errcode='42501',message='Consulta no disponible'; end if;
   for receipt_line in select value from jsonb_array_elements(receipt_lines) order by value->>'companyId',value->>'teamId' loop
    perform 1 from public.company_memberships cm where cm.organization_id=org and cm.company_id=app_private.api_uuid(receipt_line,'companyId') and cm.profile_id=receipt_owner and cm.active for share;
    if not found then raise exception using errcode='42501',message='Consulta no disponible'; end if;
    perform 1 from public.team_members tm where tm.organization_id=org and tm.team_id=app_private.api_uuid(receipt_line,'teamId') and tm.profile_id=receipt_owner for share;
    if not found then raise exception using errcode='42501',message='Consulta no disponible'; end if;
   end loop;
   return jsonb_build_object('contractVersion',1,'kind',k,'data',jsonb_build_object('found',true,'command',receipt.result));
  end if;
  if receipt.kind='onboarding.requestChanges' and role_v='encargado' then
   receipt_request:=nullif(receipt.arguments->'payload'->>'requestId','')::uuid;
   if not exists(select 1 from public.onboarding_requests r join public.profiles o on o.id=r.owner_id and o.organization_id=r.organization_id where r.id=receipt_request and r.organization_id=org and o.active and o.manager_id=actor) then raise exception using errcode='42501',message='Consulta no disponible'; end if;
  end if;
  if receipt.kind='task.createOneOff' then
   receipt_owner:=nullif(receipt.arguments->'payload'->>'ownerId','')::uuid;
   if role_v not in ('empleado','encargado','jefe') or role_v<>'empleado' and c->'authentication'->>'aal'<>'aal2' or role_v='empleado' and receipt_owner<>actor or role_v='encargado' and not exists(select 1 from public.profiles o where o.id=receipt_owner and o.organization_id=org and o.active and o.manager_id=actor) then raise exception using errcode='42501',message='Consulta no disponible'; end if;
   if not exists(select 1 from public.profiles o where o.id=receipt_owner and o.organization_id=org and o.active and o.role='empleado') or not exists(select 1 from public.company_memberships cm where cm.organization_id=org and cm.profile_id=receipt_owner and cm.company_id=(receipt.arguments->'payload'->>'companyId')::uuid and cm.active) or not exists(select 1 from public.team_members tm where tm.organization_id=org and tm.profile_id=receipt_owner and tm.team_id=(receipt.arguments->'payload'->>'teamId')::uuid) then raise exception using errcode='42501',message='Consulta no disponible'; end if;
  end if;
  return jsonb_build_object('contractVersion',1,'kind',k,'data',jsonb_build_object('found',true,'command',receipt.result));
 elsif k='ownOnboarding' then
  if not app_private.api_exact_keys(f,array[]::text[]) or cur is not null or lim<>1 or role_v<>'empleado' then raise exception using errcode='42501',message='Consulta no disponible'; end if;
  select coalesce(h.revision,0) into owner_revision from app_private.api_onboarding_owner_heads h where h.organization_id=org and h.owner_id=actor;
  owner_revision:=coalesce(owner_revision,0); select * into req from public.onboarding_requests where organization_id=org and owner_id=actor;
  if not found then return jsonb_build_object('contractVersion',1,'kind',k,'data',jsonb_build_object('ownerRevision',owner_revision::text,'request',null)); end if;
  draft_v:=case when req.draft_payload->>'schemaVersion'='2' then req.draft_payload else app_private.api_legacy_onboarding_projection(req.draft_payload) end;
  payload_version:=case when req.draft_payload->>'schemaVersion'='2' then 2 else 1 end;
  submitted_v:=case when req.current_revision>0 then app_private.api_onboarding_submitted_projection(req.id,req.current_revision,org,req.status) else null end;
  return jsonb_build_object('contractVersion',1,'kind',k,'data',jsonb_build_object('ownerRevision',owner_revision::text,'request',jsonb_build_object('requestId',req.id,'status',req.status,'revision',req.current_revision::text,'draftRevision',req.draft_revision::text,'payloadVersion',payload_version,'draft',draft_v,'submitted',submitted_v)));
 elsif k='parameterInbox' then
  if not app_private.api_exact_keys(f,array['status','ownerId']) or f->>'status' not in ('submitted','changes_requested','approved') or jsonb_typeof(f->'ownerId') not in ('string','null') then raise exception using errcode='22023',message='Consulta inválida'; end if;
  if role_v not in ('jefe','encargado') or c->'authentication'->>'aal'<>'aal2' then raise exception using errcode='42501',message='Consulta no disponible'; end if;
  status_v:=f->>'status'; owner_filter:=case when f->>'ownerId' is null then null else app_private.api_uuid(f,'ownerId') end;
  if cur is not null then
   begin
    curj:=convert_from(decode(translate(cur,'-_','+/')||repeat('=',(4-char_length(cur)%4)%4),'base64'),'UTF8')::jsonb;
    if not app_private.api_exact_keys(curj,array['kind','status','ownerId','submittedAt','requestId']) or curj->>'kind'<>'parameterInbox' or curj->>'status' is distinct from status_v or curj->>'ownerId' is distinct from coalesce(owner_filter::text,'') then raise exception using errcode='22023',message='Cursor inválido'; end if;
    cursor_at:=(curj->>'submittedAt')::timestamptz; cursor_id:=app_private.api_uuid(curj,'requestId');
   exception when others then raise exception using errcode='22023',message='Consulta inválida'; end;
  end if;
  select coalesce(jsonb_agg(item order by submitted_at desc,request_id desc),'[]'::jsonb) into items from (
   select app_private.api_onboarding_submitted_projection(r.id,r.current_revision,org,r.status) item,v.submitted_at submitted_at,r.id request_id
   from public.onboarding_requests r join public.onboarding_request_versions v on v.request_id=r.id and v.organization_id=r.organization_id and v.revision=r.current_revision
   where r.organization_id=org and r.status=status_v and (owner_filter is null or r.owner_id=owner_filter)
    and (role_v='jefe' or exists(select 1 from public.profiles o where o.id=r.owner_id and o.organization_id=org and o.active and o.manager_id=actor))
    and (cur is null or (v.submitted_at,r.id)<(cursor_at,cursor_id))
   order by v.submitted_at desc,r.id desc limit lim+1
  ) q;
  if jsonb_array_length(items)>lim then
   select v.submitted_at,r.id into last_at,last_id from public.onboarding_requests r join public.onboarding_request_versions v on v.request_id=r.id and v.organization_id=r.organization_id and v.revision=r.current_revision
   where r.organization_id=org and r.status=status_v and (owner_filter is null or r.owner_id=owner_filter) and (role_v='jefe' or exists(select 1 from public.profiles o where o.id=r.owner_id and o.organization_id=org and o.active and o.manager_id=actor)) and (cur is null or (v.submitted_at,r.id)<(cursor_at,cursor_id)) order by v.submitted_at desc,r.id desc offset lim-1 limit 1;
   next_cursor:=rtrim(translate(replace(encode(convert_to(jsonb_build_object('kind','parameterInbox','status',status_v,'ownerId',coalesce(owner_filter::text,''),'submittedAt',last_at,'requestId',last_id)::text,'UTF8'),'base64'),E'\n',''),'+/','-_'),'=');
   select coalesce(jsonb_agg(item order by submitted_at desc,request_id desc),'[]'::jsonb) into items from (
    select app_private.api_onboarding_submitted_projection(r.id,r.current_revision,org,r.status) item,v.submitted_at submitted_at,r.id request_id from public.onboarding_requests r join public.onboarding_request_versions v on v.request_id=r.id and v.organization_id=r.organization_id and v.revision=r.current_revision
    where r.organization_id=org and r.status=status_v and (owner_filter is null or r.owner_id=owner_filter) and (role_v='jefe' or exists(select 1 from public.profiles o where o.id=r.owner_id and o.organization_id=org and o.active and o.manager_id=actor)) and (cur is null or (v.submitted_at,r.id)<(cursor_at,cursor_id)) order by v.submitted_at desc,r.id desc limit lim
   ) q;
  end if;
  return jsonb_build_object('contractVersion',1,'kind',k,'data',jsonb_build_object('items',coalesce(items,'[]'::jsonb),'nextCursor',next_cursor));
 elsif k='creationContext' then
  if not app_private.api_exact_keys(f,array['ownerId']) or cur is not null or lim<>1 then raise exception using errcode='22023',message='Consulta inválida'; end if;
  owner_v:=app_private.api_uuid(f,'ownerId');
  if not exists(select 1 from public.profiles o where o.id=owner_v and o.organization_id=org and o.active and (role_v='jefe' or role_v='encargado' and o.manager_id=actor or role_v='empleado' and owner_v=actor)) then raise exception using errcode='42501',message='Consulta no disponible'; end if;
  select coalesce(revision,0) into creation_revision from app_private.api_creation_heads where organization_id=org and owner_id=owner_v; creation_revision:=coalesce(creation_revision,0);
  return jsonb_build_object('contractVersion',1,'kind',k,'data',jsonb_build_object('ownerId',owner_v,'creationRevision',creation_revision::text,'companies',coalesce((select jsonb_agg(jsonb_build_object('id',co.id,'name',co.name) order by co.name,co.id) from public.company_memberships cm join public.companies co on co.id=cm.company_id and co.organization_id=cm.organization_id where cm.organization_id=org and cm.profile_id=owner_v and cm.active),'[]'::jsonb),'teams',coalesce((select jsonb_agg(jsonb_build_object('id',tm.id,'name',tm.name) order by tm.name,tm.id) from public.team_members m join public.teams tm on tm.id=m.team_id and tm.organization_id=m.organization_id where m.organization_id=org and m.profile_id=owner_v),'[]'::jsonb)));
 else raise exception using errcode='0A000',message='Consulta no disponible'; end if;
end $$;

alter function api.query_v1(jsonb) rename to query_v1_c;
revoke all on function api.query_v1_c(jsonb) from public,anon,authenticated,service_role;
create function api.query_v1(p jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare k text; c_result jsonb;
begin
 if jsonb_typeof(p->'kind')='string' then k:=p->>'kind'; else return api.query_v1_c(p); end if;
 if k in ('cataloguePage','catalogueHistory','commandReceipt') then c_result:=app_private.api_catalogue_query(p); if c_result is not null then return c_result; end if; end if;
 return api.query_v1_c(p);
end $$;

alter function api.query_v1(jsonb) rename to query_v1_d;
revoke all on function api.query_v1_d(jsonb) from public,anon,authenticated,service_role;
create function api.query_v1(p jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare k text; result_v jsonb;
begin
 if jsonb_typeof(p->'kind') is distinct from 'string' then return api.query_v1_d(p); end if;
 k:=p->>'kind';
 if k in ('ownOnboarding','parameterInbox','creationContext','commandReceipt') then result_v:=app_private.api_onboarding_query(p); if result_v is not null then return result_v; end if; end if;
 if k in ('cataloguePage','catalogueHistory','commandReceipt') then result_v:=app_private.api_catalogue_query(p); if result_v is not null then return result_v; end if; end if;
 return api.query_v1_d(p);
end $$;

revoke all on function app_private.api_validate_definition_v2(jsonb),app_private.api_catalogue_command(jsonb) from public,anon,authenticated,service_role;
revoke all on function app_private.api_catalogue_definition(uuid),app_private.api_catalogue_query(jsonb) from public,anon,authenticated,service_role;
revoke all on function app_private.api_validate_onboarding_v2(jsonb,boolean,uuid,boolean),app_private.api_onboarding_command(jsonb),app_private.api_onboarding_approve(jsonb),app_private.api_legacy_onboarding_projection(jsonb),app_private.api_onboarding_submitted_projection(uuid,integer,uuid,text),app_private.api_onboarding_query(jsonb) from public,anon,authenticated,service_role;
revoke all on function api.command_v1(jsonb),api.query_v1(jsonb) from public,anon,authenticated,service_role;
grant execute on function api.command_v1(jsonb),api.query_v1(jsonb) to authenticated;
revoke all on function app_private.reject_immutable_operational_history(),app_private.guard_task_tracking_scope(),app_private.guard_task_dependency_scope(),app_private.guard_operational_activity_snapshot(),app_private.guard_operational_unit_change(),app_private.guard_legacy_operational_closure() from public,anon,authenticated,service_role;

-- M2.2C-R membership revocation: preserve membership identity for historical
-- assignments while making current authorization explicit and reversible.
create table app_private.company_membership_events(
 id uuid primary key default gen_random_uuid(), organization_id uuid not null,
 company_id uuid not null, profile_id uuid not null, revision bigint not null check(revision>0),
 active boolean not null, reason text not null check(char_length(app_private.normalize_context_name(reason)) between 5 and 1000),
 actor_id uuid not null, created_at timestamptz not null default clock_timestamp(),
 unique(company_id,profile_id,revision),
 foreign key(company_id,profile_id) references public.company_memberships(company_id,profile_id),
 foreign key(actor_id,organization_id) references public.profiles(id,organization_id)
);
alter table app_private.company_membership_events enable row level security;
revoke all on table app_private.company_membership_events from public,anon,authenticated,service_role;
create table app_private.api_membership_fences(
 organization_id uuid not null references public.organizations(id), profile_id uuid not null,
 fence_epoch bigint not null default 0 check(fence_epoch>=0), primary key(organization_id,profile_id),
 foreign key(profile_id,organization_id) references public.profiles(id,organization_id) on update cascade
);
insert into app_private.api_membership_fences(organization_id,profile_id)
 select p.organization_id,p.id from public.profiles p on conflict do nothing;
create function app_private.init_membership_fence_for_profile() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 insert into app_private.api_membership_fences(organization_id,profile_id) values(new.organization_id,new.id) on conflict do nothing;
 return new;
end $$;
create trigger profiles_membership_fence_init after insert on public.profiles
 for each row execute function app_private.init_membership_fence_for_profile();
alter table app_private.api_membership_fences enable row level security;
revoke all on table app_private.api_membership_fences from public,anon,authenticated,service_role;
revoke all on function app_private.init_membership_fence_for_profile() from public,anon,authenticated,service_role;
alter function public._coordination_acquire(uuid[],uuid[],jsonb,text[]) rename to _coordination_acquire_membership_base;
revoke all on function public._coordination_acquire_membership_base(uuid[],uuid[],jsonb,text[]) from public,anon,authenticated,service_role;
create function public._coordination_acquire(p_actors uuid[],p_profiles uuid[],p_months jsonb,p_catalog text[]) returns void
language plpgsql security definer set search_path='' as $$
declare actor_org uuid;
begin
 perform public._coordination_acquire_membership_base(p_actors,p_profiles,p_months,p_catalog);
 if auth.uid() is not null then
   select p.organization_id into actor_org from public.profiles p where p.id=auth.uid();
   if actor_org is null
      or exists(select 1 from unnest(coalesce(p_profiles,'{}'::uuid[])) x left join public.profiles p on p.id=x where x is null or p.id is null or p.organization_id is distinct from actor_org)
      or exists(select 1 from unnest(coalesce(p_actors,'{}'::uuid[])) x left join public.profiles p on p.id=x where p.id is null or p.organization_id is distinct from actor_org)
      or exists(select 1 from jsonb_array_elements(coalesce(p_months,'[]'::jsonb)) m left join public.profiles p on p.id=(m->>'ownerId')::uuid where p.id is null or p.organization_id is distinct from actor_org) then
    raise exception using errcode='42501',message='Contexto no autorizado';
   end if;
  insert into app_private.api_membership_fences(organization_id,profile_id,fence_epoch)
    select actor_org,x,1 from unnest(coalesce(p_profiles,'{}'::uuid[])) x where x is not null
   on conflict(organization_id,profile_id) do update set fence_epoch=app_private.api_membership_fences.fence_epoch+1;
 end if;
end $$;
-- Replace the active 011 plan overload as well: its original body was bound to
-- the renamed array overload and would otherwise bypass the membership fence.
create or replace function public._coordination_acquire(p_plan jsonb) returns void
language plpgsql security definer set search_path='' as $$
declare r jsonb; s jsonb:=p_plan->'snapshot';
begin
 if p_plan->>'actor' is distinct from auth.uid()::text or jsonb_typeof(p_plan->'input')<>'object' then raise exception 'Plan interno inválido'; end if;
 perform public._coordination_acquire(array(select x::uuid from jsonb_array_elements_text(p_plan->'actors') x),array(select x::uuid from jsonb_array_elements_text(p_plan->'profiles') x),p_plan->'months',array(select x from jsonb_array_elements_text(p_plan->'catalog') x));
 for r in select value from jsonb_array_elements(s->'templates') loop perform 1 from public.task_templates where id=(r->>'id')::uuid for update; end loop;
 for r in select value from jsonb_array_elements(s->'assignments') loop perform 1 from public.task_assignments where id=(r->>'id')::uuid for update; end loop;
 if s->'request'<>'null'::jsonb then perform 1 from public.onboarding_requests where id=(s->'request'->>'id')::uuid for update; end if;
 for r in select value from jsonb_array_elements(s->'plans') loop perform 1 from public.task_coverage_plans where id=(r->>'id')::uuid for update; end loop;
 for r in select value from jsonb_array_elements(s->'absences') loop perform 1 from public.employee_absences where id=(r->>'id')::uuid for update; end loop;
 for r in select value from jsonb_array_elements(s->'tasks') loop perform 1 from public.task_instances where id=(r->>'id')::uuid for update; end loop;
 for r in select value from jsonb_array_elements(s->'sets') loop perform 1 from public.task_responsibility_sets where id=(r->>'id')::uuid for update; end loop;
 for r in select value from jsonb_array_elements(s->'heads') loop perform 1 from public.task_responsibility_heads where instance_id=(r->>'instance_id')::uuid for update; end loop;
 for r in select value from jsonb_array_elements(s->'bindings') loop perform 1 from public.task_coverage_bindings where id=(r->>'id')::uuid for update; end loop;
 for r in select value from jsonb_array_elements(s->'sessions') loop perform 1 from public.task_time_sessions where id=(r->>'id')::uuid for update; end loop;
 if s->'privateNote'<>'null'::jsonb then perform 1 from public.task_private_block_notes where id=(s->'privateNote'->>'id')::uuid for update; end if;
 perform public._coordination_revalidate(p_plan);
end $$;
create trigger company_membership_events_immutable before update or delete on app_private.company_membership_events
 for each row execute function app_private.reject_immutable_operational_history();

create function app_private.api_company_membership_active(p_org uuid,p_company uuid,p_profile uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.company_memberships cm where cm.organization_id=p_org and cm.company_id=p_company and cm.profile_id=p_profile and cm.active)
$$;
create or replace function app_private.api_company_membership_valid_at(p_org uuid,p_company uuid,p_profile uuid,p_at timestamptz) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.company_memberships cm where cm.organization_id=p_org and cm.company_id=p_company and cm.profile_id=p_profile and cm.active and (cm.access_valid_from is null or cm.access_valid_from<=p_at))
$$;

create function app_private.api_company_membership_set_active(p jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); c jsonb; org uuid; role_v text; op uuid; payload jsonb; expected jsonb; args jsonb;
 company uuid; subject uuid; enable_v boolean; expected_revision bigint; current_revision bigint; existing app_private.api_command_receipts%rowtype;
 reason_v text; access_from timestamptz; result_v jsonb; plan jsonb; task_ids uuid[]; profiles uuid[]; months jsonb; catalog text[];
begin
 if actor is null then raise exception using errcode='28000',message='Autenticación requerida'; end if;
 if octet_length(coalesce(p::text,''))>32768 or not app_private.api_exact_keys(p,array['contractVersion','operationId','kind','expectedRevisions','payload']) or jsonb_typeof(p->'contractVersion') is distinct from 'number' or p->>'contractVersion'<>'1' then raise exception using errcode='22023',message='Solicitud inválida'; end if;
 if p->>'kind'<>'companyMembership.setActive' or jsonb_typeof(p->'payload') is distinct from 'object' or jsonb_typeof(p->'expectedRevisions') is distinct from 'object' then raise exception using errcode='22023',message='Solicitud inválida'; end if;
 op:=app_private.api_uuid(p,'operationId'); payload:=p->'payload'; expected:=p->'expectedRevisions';
 if not app_private.api_exact_keys(payload,array['companyId','profileId','active','reason']) or jsonb_typeof(payload->'active') is distinct from 'boolean' then raise exception using errcode='22023',message='Solicitud inválida'; end if;
 company:=app_private.api_uuid(payload,'companyId'); subject:=app_private.api_uuid(payload,'profileId'); enable_v:=(payload->>'active')::boolean; reason_v:=app_private.api_text(payload,'reason',5,1000);
 c:=app_private.api_require_business(true); org:=(c->'principal'->>'organizationId')::uuid; role_v:=c->'principal'->>'role';
 if role_v<>'jefe' or c->'authentication'->>'aal'<>'aal2' then raise exception using errcode='42501',message='Contexto no autorizado'; end if;
 if not app_private.api_exact_keys(expected,array['membership:'||company::text||':'||subject::text]) then raise exception using errcode='22023',message='Revisiones inválidas'; end if;
 expected_revision:=app_private.api_expected(expected,'membership:'||company::text||':'||subject::text);
 args:=jsonb_build_object('kind','companyMembership.setActive','payload',payload,'expectedRevisions',expected);
 perform public._coordination_receipt_lock(actor,op);
 -- Exact replay is reauthorized after taking the receipt lock, before reading
 -- mutable target state or acquiring any writer fence/graph epoch.
 c:=app_private.api_require_business(true);
 if (c->'principal'->>'organizationId')::uuid<>org or c->'principal'->>'role'<>'jefe' or c->'authentication'->>'aal'<>'aal2' then raise exception using errcode='42501',message='Contexto no autorizado'; end if;
 if not exists(select 1 from public.profiles where id=actor and organization_id=org and active and role='jefe') then raise exception using errcode='42501',message='Contexto no autorizado'; end if;
 select coalesce(array_agg(distinct t.id order by t.id),'{}'::uuid[]) into task_ids from public.task_instances t where t.organization_id=org and t.company_id=company and
  (t.owner_id=subject or exists(select 1 from public.task_responsibility_heads h join public.task_responsibility_members m on m.set_id=h.set_id and m.organization_id=h.organization_id where h.instance_id=t.id and m.profile_id=subject) or
   exists(select 1 from public.task_coverage_bindings b where b.instance_id=t.id and (b.responsible_id=subject or b.replacement_id=subject)) or exists(select 1 from public.task_time_sessions s where s.instance_id=t.id and s.actor_id=subject));
 select coalesce(array_agg(distinct profile_id order by profile_id),'{}'::uuid[]) into profiles from (
  select actor profile_id union select subject union select t.owner_id from public.task_instances t where t.id=any(task_ids)
  union select s.actor_id from public.task_time_sessions s where s.instance_id=any(task_ids)
  union select m.profile_id from public.task_responsibility_heads h join public.task_responsibility_members m on m.set_id=h.set_id and m.organization_id=h.organization_id where h.instance_id=any(task_ids)
  union select b.responsible_id from public.task_coverage_bindings b where b.instance_id=any(task_ids)
  union select b.replacement_id from public.task_coverage_bindings b where b.instance_id=any(task_ids)
 ) pp;
 select coalesce(jsonb_agg(jsonb_build_object('ownerId',x.owner_id,'period',x.period) order by x.owner_id,x.period),'[]'::jsonb) into months from
  (select distinct t.owner_id,t.period from public.task_instances t where t.id=any(task_ids)) x;
 select coalesce(array_agg(distinct 'dependencies:'||t.organization_id||':'||t.company_id||':'||t.period order by 'dependencies:'||t.organization_id||':'||t.company_id||':'||t.period),'{}'::text[]) into catalog
  from public.task_instances t where t.id=any(task_ids) and t.kind='resultado';
 plan:=public._coordination_prepare(task_ids,array[actor],profiles,months,catalog||array['membership:'||company::text||':'||subject::text],jsonb_build_object('stopSessions',true,'membership',subject,'company',company));
 -- Acquire the complete lock plan without advancing any writer epoch; a true
 -- no-op must remain inert. If the locked row shows a real state transition,
 -- publish fences while the same advisory/row lock plan is still held.
 perform app_private._coordination_acquire_m22b(plan,false);
 c:=app_private.api_require_business(true);
 if (c->'principal'->>'organizationId')::uuid<>org or c->'principal'->>'role'<>'jefe' or c->'authentication'->>'aal'<>'aal2' then raise exception using errcode='42501',message='Contexto no autorizado'; end if;
 perform 1 from public.profiles where id=actor and organization_id=org and active and role='jefe' for share;
 if not found then raise exception using errcode='42501',message='Contexto no autorizado'; end if;
 select * into existing from app_private.api_command_receipts where actor_id=actor and operation_id=op;
 if existing.actor_id is not null then
  if existing.organization_id<>org then raise exception using errcode='42501',message='Contexto no autorizado'; end if;
  if existing.kind<>'companyMembership.setActive' or existing.arguments is distinct from args then raise exception using errcode='40001',message='Identificador de operación ya utilizado'; end if;
  return existing.result;
 end if;
 perform 1 from public.company_memberships where organization_id=org and company_id=company and profile_id=subject for update;
 if not found then raise exception using errcode='42501',message='Membresía no disponible'; end if;
 select revision,active into current_revision,enable_v from public.company_memberships where organization_id=org and company_id=company and profile_id=subject;
 if current_revision<>expected_revision then raise exception using errcode='40001',message='La membresía cambió; recargue'; end if;
 if enable_v is distinct from (payload->>'active')::boolean then
  perform app_private._coordination_acquire_m22b(plan,true);
  access_from:=case when (payload->>'active')::boolean then clock_timestamp() else null end;
  update public.company_memberships set active=(payload->>'active')::boolean,revision=revision+1,changed_at=clock_timestamp(),changed_by=actor,access_valid_from=access_from where organization_id=org and company_id=company and profile_id=subject returning revision into current_revision;
  insert into app_private.api_membership_fences(organization_id,profile_id,fence_epoch) values(org,subject,1) on conflict(organization_id,profile_id) do update set fence_epoch=app_private.api_membership_fences.fence_epoch+1;
  if not (payload->>'active')::boolean then
   update public.task_time_sessions s set ended_at=greatest(s.started_at,public._effective_session_end(s.id,clock_timestamp())) where s.ended_at is null and s.actor_id=subject and s.instance_id=any(task_ids);
   update public.task_coverage_bindings b set status='cancelled',cancelled_by=actor,cancelled_at=clock_timestamp(),cancel_reason=reason_v where b.status='active' and (b.responsible_id=subject or b.replacement_id=subject) and (b.company_id_snapshot=company or exists(select 1 from public.task_assignments a where a.id=b.assignment_id and a.organization_id=org and a.company_id=company));
   update public.task_instances t set state_revision=t.state_revision+1 where t.id=any(task_ids) and t.status<>'Completada';
  end if;
  insert into app_private.company_membership_events(organization_id,company_id,profile_id,revision,active,reason,actor_id) values(org,company,subject,current_revision,(payload->>'active')::boolean,reason_v,actor);
  insert into app_private.api_operation_fences(actor_id,operation_id) values(actor,op);
  insert into public.audit_events(organization_id,actor_id,action,entity_id,details) values(org,actor,'companyMembership.setActive',company,jsonb_build_object('profileId',subject,'active',(payload->>'active')::boolean,'membershipRevision',current_revision::text));
 else
  current_revision:=expected_revision;
 end if;
 result_v:=jsonb_build_object('contractVersion',1,'operationId',op,'kind','companyMembership.setActive','result',jsonb_build_object('companyId',company,'profileId',subject,'active',(payload->>'active')::boolean,'membershipRevision',current_revision::text));
 insert into app_private.api_command_receipts(actor_id,operation_id,organization_id,kind,arguments,result) values(actor,op,org,'companyMembership.setActive',args,result_v);
 return result_v;
end $$;

create or replace function app_private.api_task_actor_can_execute(p_task uuid,p_actor uuid,p_at date) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.task_instances t where t.id=p_task and t.owner_id=p_actor and app_private.api_company_membership_valid_at(t.organization_id,t.company_id,p_actor,p_at::timestamp at time zone 'America/Argentina/Buenos_Aires'))
  or exists(select 1 from public.task_instances t join public.task_responsibility_heads h on h.instance_id=t.id and h.organization_id=t.organization_id join public.task_responsibility_members m on m.set_id=h.set_id and m.organization_id=h.organization_id where t.id=p_task and m.profile_id=p_actor and app_private.api_company_membership_valid_at(t.organization_id,t.company_id,p_actor,p_at::timestamp at time zone 'America/Argentina/Buenos_Aires'))
  or exists(select 1 from public.task_instances t join public.task_coverage_bindings b on b.instance_id=t.id and b.organization_id=t.organization_id where t.id=p_task and b.replacement_id=p_actor and b.responsible_id=t.owner_id and b.status='active' and b.period_snapshot=t.period and b.company_id_snapshot=t.company_id and p_at between b.starts_on and b.ends_on and app_private.api_company_membership_valid_at(t.organization_id,t.company_id,p_actor,p_at::timestamp at time zone 'America/Argentina/Buenos_Aires'))
  or exists(select 1 from public.task_instances t join public.employee_absences a on a.owner_id=t.owner_id and a.organization_id=t.organization_id join public.employee_absence_companies c on c.absence_id=a.id and c.organization_id=a.organization_id and c.company_id=t.company_id where t.id=p_task and a.replacement_id=p_actor and a.cancelled_at is null and a.authorization_sealed and p_at between a.starts_on and a.ends_on and t.period between date_trunc('month',a.starts_on)::date and date_trunc('month',a.ends_on)::date and app_private.api_company_membership_valid_at(t.organization_id,t.company_id,p_actor,p_at::timestamp at time zone 'America/Argentina/Buenos_Aires'))
$$;

create or replace function public._coordination_materialize_core(p_owner uuid,p_period date) returns integer
language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); org uuid:=public.actor_org(); inserted integer:=0; inserted_now integer:=0; bound integer:=0; bound_now integer:=0;
 assignment_row public.task_assignments%rowtype; task_row public.task_instances%rowtype; day_row date;
begin
 for day_row in select g::date from generate_series(p_period::timestamp,(p_period+interval '1 month - 1 day')::timestamp,interval '1 day') g loop
  for assignment_row in select * from public.task_assignments a where a.owner_id=p_owner and a.organization_id=org
    and a.start_date<=day_row and (a.end_date is null or a.end_date>=day_row)
    and (a.frequency<>'unica' or day_row=a.start_date)
    and (a.frequency<>'mensual' or ((((extract(year from day_row)::integer*12+extract(month from day_row)::integer)-(extract(year from a.start_date)::integer*12+extract(month from a.start_date)::integer)) % a.interval_count=0) and extract(day from day_row)::integer=least(a.month_day,extract(day from (date_trunc('month',day_row)+interval '1 month - 1 day'))::integer)))
    and (a.frequency<>'diaria' or mod(day_row-a.start_date,a.interval_count)=0)
    and (a.frequency<>'semanal' or ((extract(dow from day_row)::integer=any(a.weekdays)) and (((day_row-(a.start_date-((extract(isodow from a.start_date)::integer-1))::integer))/7) % a.interval_count=0)))
    and exists(select 1 from public.company_memberships cm where cm.organization_id=org and cm.company_id=a.company_id and cm.profile_id=a.owner_id and cm.active and (cm.access_valid_from is null or cm.access_valid_from<=day_row::timestamp at time zone 'America/Argentina/Buenos_Aires'))
    and (public.actor_role()='jefe' or app_private.api_company_membership_valid_at(org,a.company_id,actor,clock_timestamp()))
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
  insert into public.task_coverage_bindings(organization_id,plan_id,instance_id,responsible_id,replacement_id,starts_on,ends_on,company_id_snapshot,period_snapshot,scheduled_on_snapshot,approved_by,source_rule_id)
  select cb.organization_id,cb.plan_id,task_row.id,cb.responsible_id,cb.replacement_id,cb.starts_on,cb.ends_on,task_row.company_id,task_row.period,task_row.scheduled_on,cb.approved_by,cb.id
   from public.task_coverage_bindings cb where cb.assignment_id=task_row.assignment_id and cb.responsible_id=task_row.owner_id and cb.status='active' and task_row.scheduled_on between cb.starts_on and cb.ends_on
    and app_private.api_company_membership_active(org,task_row.company_id,cb.replacement_id)
    and not exists(select 1 from public.task_coverage_bindings oldb where oldb.instance_id=task_row.id and oldb.replacement_id=cb.replacement_id and oldb.status='active')
  on conflict(instance_id,replacement_id,starts_on,ends_on) where status='active' and instance_id is not null do nothing;
  get diagnostics bound_now=row_count; bound:=bound+bound_now;
 end loop;
 if inserted>0 or bound>0 then insert into public.audit_events(organization_id,actor_id,action,entity_id,details) values(org,actor,'month.materialized',p_owner,jsonb_build_object('period',p_period,'count',inserted,'coverageBindings',bound)); end if;
 return inserted;
end $$;

alter function api.command_v1(jsonb) rename to command_v1_membership_base;
revoke all on function api.command_v1_membership_base(jsonb) from public,anon,authenticated,service_role;
create function api.command_v1(p jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
begin
 if jsonb_typeof(p->'kind')='string' and p->>'kind'='companyMembership.setActive' then return app_private.api_company_membership_set_active(p); end if;
 return api.command_v1_membership_base(p);
end $$;

create or replace function app_private.api_can_execute(p_task uuid,p_actor uuid,p_work_date date) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.task_instances t where t.id=p_task and t.kind='operativa' and
   app_private.api_company_membership_valid_at(t.organization_id,t.company_id,p_actor,p_work_date::timestamp at time zone 'America/Argentina/Buenos_Aires') and
   (t.owner_id=p_actor or exists(select 1 from public.task_responsibility_heads h join public.task_responsibility_members m on m.set_id=h.set_id and m.organization_id=h.organization_id where h.instance_id=t.id and m.profile_id=p_actor)))
 or exists(select 1 from public.task_instances t join public.task_coverage_bindings b on b.instance_id=t.id and b.organization_id=t.organization_id
   where t.id=p_task and t.kind='operativa' and b.replacement_id=p_actor and b.responsible_id=t.owner_id and b.status='active' and t.period=b.period_snapshot and p_work_date between b.starts_on and b.ends_on and app_private.api_company_membership_valid_at(t.organization_id,t.company_id,p_actor,p_work_date::timestamp at time zone 'America/Argentina/Buenos_Aires'))
 or exists(select 1 from public.task_instances t join public.employee_absences a on a.owner_id=t.owner_id and a.organization_id=t.organization_id
   join public.employee_absence_companies c on c.absence_id=a.id and c.organization_id=a.organization_id and c.company_id=t.company_id
   where t.id=p_task and t.kind='operativa' and a.replacement_id=p_actor and a.cancelled_at is null and a.authorization_sealed and p_work_date between a.starts_on and a.ends_on and t.period between date_trunc('month',a.starts_on)::date and date_trunc('month',a.ends_on)::date and app_private.api_company_membership_valid_at(t.organization_id,t.company_id,p_actor,p_work_date::timestamp at time zone 'America/Argentina/Buenos_Aires'))
$$;

revoke all on function app_private.api_company_membership_active(uuid,uuid,uuid),app_private.api_company_membership_valid_at(uuid,uuid,uuid,timestamptz),app_private.api_company_membership_set_active(jsonb) from public,anon,authenticated,service_role;
revoke all on function public._coordination_acquire(uuid[],uuid[],jsonb,text[]) from public,anon,authenticated,service_role;
revoke all on function api.command_v1(jsonb) from public,anon,authenticated,service_role;
grant execute on function api.command_v1(jsonb) to authenticated;

-- Current context and row authorization projections use active memberships;
-- jefe retains organization-wide authority as established by 001/011.
alter function api.get_context_v1() rename to get_context_v1_membership_base;
revoke all on function api.get_context_v1_membership_base() from public,anon,authenticated,service_role;
create function api.get_context_v1() returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare c jsonb; actor uuid:=auth.uid(); org uuid;
begin
 c:=api.get_context_v1_membership_base();
 if c->'principal'->>'kind'<>'business' then return c; end if;
 org:=(c->'principal'->>'organizationId')::uuid;
 return jsonb_set(c,'{principal,companyIds}',coalesce((select jsonb_agg(cm.company_id order by cm.company_id) from public.company_memberships cm where cm.organization_id=org and cm.profile_id=actor and cm.active),'[]'::jsonb),true);
end $$;

create or replace function public.can_access_instance(p_instance_id uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select public._can_access_instance_at(p_instance_id,clock_timestamp()) and exists(
   select 1 from public.task_instances t where t.id=p_instance_id and
    (public.actor_role()='jefe' or app_private.api_company_membership_valid_at(t.organization_id,t.company_id,auth.uid(),clock_timestamp())))
$$;
drop policy if exists assignments_read on public.task_assignments;
create policy assignments_read on public.task_assignments for select to authenticated
 using(public.can_access_owner(owner_id) and (public.actor_role()='jefe' or exists(select 1 from public.company_memberships cm where cm.organization_id=task_assignments.organization_id and cm.company_id=task_assignments.company_id and cm.profile_id=auth.uid() and cm.active)));
drop policy if exists company_members_read on public.company_memberships;
create or replace function public.can_read_company_membership(p_org uuid,p_company uuid,p_profile uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select p_org=public.actor_org() and public.can_access_owner(p_profile) and
   (public.actor_role()='jefe' or app_private.api_company_membership_active(p_org,p_company,auth.uid()))
$$;
revoke all on function public.can_read_company_membership(uuid,uuid,uuid) from public,anon,service_role;
grant execute on function public.can_read_company_membership(uuid,uuid,uuid) to authenticated;
create policy company_members_read on public.company_memberships for select to authenticated
 using(public.can_read_company_membership(organization_id,company_id,profile_id));
drop policy if exists coordinated_session_read on public.task_time_sessions;
create policy coordinated_session_read on public.task_time_sessions for select to authenticated using(
 public.can_access_instance(instance_id) and (actor_id=auth.uid() or exists(
   select 1 from public.task_instances t join public.profiles session_actor
     on session_actor.id=task_time_sessions.actor_id and session_actor.organization_id=t.organization_id
   where t.id=task_time_sessions.instance_id and public.actor_role() in ('jefe','encargado')
     and public.can_access_owner(session_actor.id)
     and (public.actor_role()='jefe' or exists(select 1 from public.company_memberships cm
       where cm.profile_id=auth.uid() and cm.company_id=t.company_id and cm.organization_id=t.organization_id and cm.active))
  )));
drop policy if exists coordinated_activity_read on public.activity_entries;
create policy coordinated_activity_read on public.activity_entries for select to authenticated using(
 public.can_access_instance(instance_id) and (actor_id=auth.uid() or exists(
   select 1 from public.task_instances task_row
   where task_row.id=activity_entries.instance_id and public.actor_role() in ('jefe','encargado')
     and public.can_access_owner(activity_entries.actor_id)
     and (public.actor_role()='jefe' or exists(select 1 from public.company_memberships cm
       where cm.profile_id=auth.uid() and cm.company_id=task_row.company_id and cm.organization_id=task_row.organization_id and cm.active))
  )));
drop policy if exists closures_read on public.monthly_closures;
create or replace function public.can_read_monthly_closure(p_closure uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.monthly_closures c where c.id=p_closure and c.organization_id=public.actor_org() and public.can_access_owner(c.owner_id)
   and (public.actor_role()='jefe' or not exists(select 1 from jsonb_array_elements(coalesce(c.snapshot->'tasks','[]'::jsonb)) task_row
     where not app_private.api_company_membership_active(c.organization_id,coalesce(task_row->>'companyId',task_row->>'company_id')::uuid,auth.uid()))))
$$;
revoke all on function public.can_read_monthly_closure(uuid) from public,anon,service_role;
grant execute on function public.can_read_monthly_closure(uuid) to authenticated;
create policy closures_read on public.monthly_closures for select to authenticated using(
 public.can_read_monthly_closure(id));

create or replace function public.can_read_period_report(p_report uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.period_reports r where r.id=p_report and r.organization_id=public.actor_org() and public.can_access_owner(r.owner_id)
  and (public.actor_role()='jefe' or not exists(select 1 from jsonb_array_elements(r.snapshot->'tasks') t
   where not app_private.api_company_membership_active(r.organization_id,coalesce(t->>'companyId',t->>'company_id')::uuid,auth.uid()))))
$$;

-- Keep legacy block-note visibility aligned with current company membership.
-- SQL 009's supervisor branch intentionally remains scoped to the task owner,
-- but revoking that supervisor's company membership must revoke both current
-- note and immutable-version reads immediately.
create or replace function public.can_read_private_block_note(p_note uuid) returns boolean
language sql stable security definer set search_path='' as $$
  select exists(
    select 1
    from public.task_private_block_notes n
    join public.task_instances t on t.id=n.instance_id and t.organization_id=n.organization_id
    join public.profiles actor on actor.id=auth.uid() and actor.active
      and actor.organization_id=n.organization_id and actor.role in ('empleado','encargado','jefe')
    join public.profiles author on author.id=n.author_id and author.organization_id=n.organization_id
    where n.id=p_note and (
      actor.id=n.author_id
      or actor.role='jefe'
      or (actor.role='encargado' and author.manager_id=actor.id
        and app_private.api_company_membership_valid_at(
          t.organization_id,t.company_id,actor.id,clock_timestamp()))
    )
  )
$$;
revoke all on function api.get_context_v1(),public.can_access_instance(uuid),public.can_read_period_report(uuid) from public,anon,authenticated,service_role;
grant execute on function api.get_context_v1() to authenticated;
grant execute on function public.can_access_instance(uuid) to authenticated;
grant execute on function public.can_read_period_report(uuid) to authenticated;

-- Membership revocation plans must include task and assignment rows that a
-- concurrent materializer/creator commits while the revoker waits. Preserve
-- the 011 planner for all other writers and extend only membership-scoped
-- plans so revalidation detects the newly visible footprint and forces retry.
alter function public._coordination_prepare(uuid[],uuid[],uuid[],jsonb,text[],jsonb)
  rename to _coordination_prepare_membership_base;
create function public._coordination_prepare(p_tasks uuid[],p_actors uuid[],p_profiles uuid[],p_months jsonb,p_catalog text[],p_scope jsonb default '{}'::jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_subject_id uuid; v_company_id uuid; expanded_tasks uuid[]; plan jsonb; new_assignments jsonb;
begin
 if not (p_scope ? 'membership') then
   return public._coordination_prepare_membership_base(p_tasks,p_actors,p_profiles,p_months,p_catalog,p_scope);
 end if;
 v_subject_id:=(p_scope->>'membership')::uuid;
 v_company_id:=(p_scope->>'company')::uuid;
 select coalesce(array_agg(distinct t.id order by t.id),'{}'::uuid[]) into expanded_tasks
 from public.task_instances t where t.organization_id=public.actor_org() and t.company_id=v_company_id and
  (t.owner_id=v_subject_id or exists(select 1 from public.task_responsibility_heads h join public.task_responsibility_members m on m.set_id=h.set_id and m.organization_id=h.organization_id where h.instance_id=t.id and m.profile_id=v_subject_id)
   or exists(select 1 from public.task_coverage_bindings b where b.instance_id=t.id and (b.responsible_id=v_subject_id or b.replacement_id=v_subject_id))
   or exists(select 1 from public.task_time_sessions s where s.instance_id=t.id and s.actor_id=v_subject_id));
 select coalesce(array_agg(distinct task_id order by task_id),'{}'::uuid[]) into expanded_tasks
 from unnest(coalesce(p_tasks,'{}'::uuid[])||expanded_tasks) task_id;
 plan:=public._coordination_prepare_membership_base(expanded_tasks,p_actors,p_profiles,p_months,p_catalog,p_scope);
 select coalesce(jsonb_agg(to_jsonb(a) order by a.id),'[]'::jsonb) into new_assignments
 from public.task_assignments a where a.organization_id=public.actor_org() and a.company_id=v_company_id and a.owner_id=v_subject_id
  and not exists(select 1 from jsonb_array_elements(coalesce(plan#>'{snapshot,assignments}','[]'::jsonb)) planned where planned->>'id'=a.id::text);
 plan:=jsonb_set(plan,'{snapshot,assignments}',coalesce(plan#>'{snapshot,assignments}','[]'::jsonb)||new_assignments,true);
 return plan;
end $$;
revoke all on function public._coordination_prepare(uuid[],uuid[],uuid[],jsonb,text[],jsonb),public._coordination_prepare_membership_base(uuid[],uuid[],uuid[],jsonb,text[],jsonb) from public,anon,authenticated,service_role;
commit;
