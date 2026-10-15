begin;

-- M2.2A only. This migration is deliberately local until B/C are accepted.
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
   (exists(select 1 from public.activity_entries e where e.instance_id=t.id and e.measurement_version=2) or
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
   case when jsonb_typeof(p_value) is distinct from 'object' or p_keys is null then false
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

create function app_private.api_can_execute(p_task uuid,p_actor uuid,p_work_date date) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.task_instances t where t.id=p_task and t.kind='operativa' and
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
 task_id uuid; company_id uuid; v_company uuid; template_id uuid; expected bigint; expected_assessment bigint; new_revision bigint;
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
   if jsonb_typeof(payload->'quantity') is distinct from 'number' or (payload->>'quantity') !~ '^[1-9][0-9]{0,6}$' or (payload->>'quantity')::integer>1000000 or (jsonb_typeof(payload->'reference') is distinct from 'string' and jsonb_typeof(payload->'reference') is distinct from 'null') then raise exception using errcode='22023',message='Solicitud inválida'; end if;
   amount:=(payload->>'quantity')::integer;
   if jsonb_typeof(payload->'reference')='string' then ref:=nullif(app_private.normalize_context_name(payload->>'reference'),''); if ref is not null and char_length(ref)>2000 then raise exception using errcode='22023',message='Solicitud inválida'; end if; else ref:=null; end if;
 elsif kind='operation.rate' then
   if not app_private.api_exact_keys(payload,array['companyId','templateId','taskId','effectiveOn','unitWeight','reason']) then raise exception using errcode='22023',message='Solicitud inválida'; end if;
   if (payload->>'templateId' is null)=(payload->>'taskId' is null) then raise exception using errcode='22023',message='Solicitud inválida'; end if;
   company_id:=app_private.api_uuid(payload,'companyId'); v_company:=company_id; template_id:=case when payload->>'templateId' is null then null else app_private.api_uuid(payload,'templateId') end;
   task_id:=case when payload->>'taskId' is null then null else app_private.api_uuid(payload,'taskId') end;
   if not app_private.api_exact_keys(revisions,array[case when template_id is not null then 'rate:'||company_id||':template:'||template_id else 'rate:'||company_id||':task:'||task_id end]) then raise exception using errcode='22023',message='Solicitud inválida'; end if;
   work_date:=app_private.api_date(payload,'effectiveOn'); reason:=app_private.api_text(payload,'reason',5,1000);
   if jsonb_typeof(payload->'unitWeight') is distinct from 'string' or (payload->>'unitWeight') !~ '^(0|[1-9][0-9]*)(\.[0-9]{1,6})?$' then raise exception using errcode='22023',message='Solicitud inválida'; end if;
   begin coeff:=(payload->>'unitWeight')::numeric(20,6); exception when others then raise exception using errcode='22023',message='Solicitud inválida'; end;
   if coeff<=0 or coeff>1000000 then raise exception using errcode='22023',message='Solicitud inválida'; end if;
 elsif kind='operation.assess' then
   if not app_private.api_exact_keys(payload,array['taskId','quality','order','timeliness','observation']) then raise exception using errcode='22023',message='Solicitud inválida'; end if;
   task_id:=app_private.api_uuid(payload,'taskId');
   if not app_private.api_exact_keys(revisions,array['task:'||task_id,'assessment:'||task_id]) then raise exception using errcode='22023',message='Solicitud inválida'; end if;
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
   if h.config_revision<>app_private.api_expected(revisions,'rate:'||company_id||case when template_id is not null then ':template:'||template_id else ':task:'||task_id end) then raise exception using errcode='40001',message='La configuración cambió; reintente'; end if;
   rate_version:=h.config_revision+1; now_at:=clock_timestamp(); rate_id:=gen_random_uuid();
   insert into app_private.operational_rate_versions(id,organization_id,head_id,version,effective_on,unit,unit_weight,reason,created_by,created_at) values(rate_id,org,h.id,rate_version,work_date,unit_value,coeff,reason,actor,now_at);
   update app_private.operational_rate_heads set config_revision=rate_version where id=h.id;
   insert into public.audit_events(organization_id,actor_id,action,entity_id,at,details) values(org,actor,'operational.rate.created',rate_id,now_at,jsonb_build_object('companyId',company_id,'scopeId',coalesce(template_id,task_id),'version',rate_version,'effectiveOn',work_date));
   result_data:=jsonb_build_object('contractVersion',1,'operationId',op,'kind',kind,'result',jsonb_build_object('rateId',rate_id,'scopeRevision',rate_version::text,'version',rate_version::text,'effectiveOn',work_date,'unit',unit_value,'unitWeight',coeff::text));
 else
   select * into t from public.task_instances where id=task_id and organization_id=org;
   if not found or t.kind<>'operativa' or not public.can_access_instance(task_id) then raise exception using errcode='42501',message='Contexto no autorizado'; end if;
   if kind='operation.record' and not app_private.api_can_execute(task_id,actor,work_date) then raise exception using errcode='42501',message='Contexto no autorizado'; end if;
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
   perform app_private.api_touch_month_fences(org,months);
   perform public._coordination_revalidate(plan);
   select * into t from public.task_instances where id=task_id and organization_id=org;
   if not found or t.state_revision<>app_private.api_expected(revisions,'task:'||task_id) or not public.can_access_instance(task_id) then raise exception using errcode='40001',message='La tarea o el acceso cambiaron; reintente'; end if;
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
     if t.state_revision<>app_private.api_expected(revisions,'task:'||task_id) then raise exception using errcode='40001',message='La tarea cambió; reintente'; end if;
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
 elsif kind in ('activityPage','operationalSummary','quality') then
   if not app_private.api_exact_keys(f,array['taskId']) then raise exception using errcode='22023',message='Consulta inválida'; end if;
   task_id:=app_private.api_uuid(f,'taskId');
 elsif kind='rateHistory' then
   if not app_private.api_exact_keys(f,array['companyId','templateId','taskId']) or ((f->>'templateId' is null)=(f->>'taskId' is null)) then raise exception using errcode='22023',message='Consulta inválida'; end if;
 elsif kind not in ('activityPage','operationalSummary','quality','rateHistory','commandReceipt') then
   raise exception using errcode='0A000',message='Consulta no disponible';
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
       if r.kind='operation.record' then target_date:=app_private.api_date(r.arguments->'payload','workDate'); if not app_private.api_can_execute(task_id,actor,target_date) then raise exception using errcode='42501',message='Consulta no disponible'; end if;
       elsif role_name<>'jefe' or c->'authentication'->>'aal'<>'aal2' then raise exception using errcode='42501',message='Consulta no disponible'; end if;
     end if;
     return jsonb_build_object('contractVersion',1,'kind',kind,'data',jsonb_build_object('found',true,'command',r.result));
   end if;
   return jsonb_build_object('contractVersion',1,'kind',kind,'data',jsonb_build_object('found',false));
 end if;
 if kind='activityPage' or kind='operationalSummary' or kind='quality' then
   if not app_private.api_exact_keys(f,array['taskId']) then raise exception using errcode='22023',message='Consulta inválida'; end if;
   task_id:=app_private.api_uuid(f,'taskId'); perform app_private.api_lock_task_scope(actor,org,task_id); select * into t from public.task_instances where id=task_id and organization_id=org;
   if not found or t.kind<>'operativa' or not public.can_access_instance(task_id) then raise exception using errcode='42501',message='Consulta no disponible'; end if;
 elsif kind='rateHistory' then
   if role_name<>'jefe' or c->'authentication'->>'aal'<>'aal2' then raise exception using errcode='42501',message='Consulta no disponible'; end if;
   company_id:=app_private.api_uuid(f,'companyId'); v_company:=company_id; template_id:=case when f->>'templateId' is null then null else app_private.api_uuid(f,'templateId') end; v_template:=template_id; task_id:=case when f->>'taskId' is null then null else app_private.api_uuid(f,'taskId') end;
   if not exists(select 1 from public.companies co where co.organization_id=org and co.id=v_company) then raise exception using errcode='42501',message='Consulta no disponible'; end if;
   if v_template is not null and not exists(select 1 from public.task_templates tt where tt.organization_id=org and tt.id=v_template and tt.kind='operativa') then raise exception using errcode='42501',message='Consulta no disponible'; end if;
   if task_id is not null and not exists(select 1 from public.task_instances ti where ti.id=task_id and ti.organization_id=org and ti.company_id=v_company and ti.kind='operativa') then raise exception using errcode='42501',message='Consulta no disponible'; end if;
 elsif kind not in ('activityPage','operationalSummary','quality') then raise exception using errcode='0A000',message='Consulta no disponible'; end if;
 if kind in ('operationalSummary','quality') and (lim<>1 or cursor_value is not null) then raise exception using errcode='22023',message='Consulta inválida'; end if;
 if kind='quality' and role_name<>'jefe' and t.owner_id<>actor then raise exception using errcode='42501',message='Consulta no disponible'; end if;
 if kind='quality' and role_name='jefe' and c->'authentication'->>'aal'<>'aal2' then raise exception using errcode='42501',message='Consulta no disponible'; end if;
 if kind='activityPage' then
   if cursor_value is not null then begin cursor_json:=convert_from(decode(translate(cursor_value,'-_','+/')||repeat('=',(4-char_length(cursor_value)%4)%4),'base64'),'UTF8')::jsonb; if not app_private.api_exact_keys(cursor_json,array['kind','taskId','createdAt','entryId']) or cursor_json->>'kind' is distinct from 'activityPage' or cursor_json->>'taskId' is distinct from task_id::text then raise exception using errcode='22023',message='Cursor inválido'; end if; cursor_at:=app_private.api_timestamp(cursor_json,'createdAt'); cursor_id:=app_private.api_uuid(cursor_json,'entryId'); exception when others then raise exception using errcode='22023',message='Consulta inválida'; end; end if;
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
   if cursor_value is not null then begin cursor_json:=convert_from(decode(translate(cursor_value,'-_','+/')||repeat('=',(4-char_length(cursor_value)%4)%4),'base64'),'UTF8')::jsonb; if not app_private.api_exact_keys(cursor_json,array['kind','companyId','templateId','taskId','version','rateId']) or cursor_json->>'kind' is distinct from 'rateHistory' or cursor_json->>'companyId' is distinct from v_company::text or cursor_json->>'templateId' is distinct from v_template::text or cursor_json->>'taskId' is distinct from task_id::text then raise exception using errcode='22023',message='Cursor inválido'; end if; cursor_version:=app_private.api_expected(cursor_json,'version'); cursor_id:=app_private.api_uuid(cursor_json,'rateId'); exception when others then raise exception using errcode='22023',message='Consulta inválida'; end; end if;
   select coalesce(rh.config_revision,0) into scope_rev from (select 1) x left join app_private.operational_rate_heads rh on rh.organization_id=org and rh.company_id=v_company and rh.template_id is not distinct from v_template and rh.instance_id is not distinct from task_id;
   select coalesce(jsonb_agg(item order by version desc,id desc),'[]'::jsonb) into data from (select jsonb_build_object('rateId',v.id,'version',v.version::text,'effectiveOn',v.effective_on,'unit',v.unit,'unitWeight',v.unit_weight::text,'createdAt',v.created_at,'createdBy',v.created_by,'reason',v.reason) item,v.version,v.id from app_private.operational_rate_heads h join app_private.operational_rate_versions v on v.head_id=h.id where h.organization_id=org and h.company_id=v_company and h.template_id is not distinct from v_template and h.instance_id is not distinct from task_id and (cursor_json is null or (v.version,v.id)<(cursor_version,cursor_id)) order by v.version desc,v.id desc limit lim+1) q;
   if jsonb_array_length(data)>lim then next_cursor:=rtrim(translate(replace(encode(convert_to(jsonb_build_object('kind',kind,'companyId',company_id,'templateId',template_id,'taskId',task_id,'version',(data->(lim-1)->>'version'),'rateId',(data->(lim-1)->>'rateId'))::text,'UTF8'),'base64'),E'\n',''),'+/','-_'),'='); data:=(select jsonb_agg(value order by ord) from jsonb_array_elements(data) with ordinality x(value,ord) where ord<=lim); else next_cursor:=null; end if;
   return jsonb_build_object('contractVersion',1,'kind',kind,'data',jsonb_build_object('scopeRevision',coalesce(scope_rev,0)::text,'items',coalesce(data,'[]'::jsonb),'nextCursor',next_cursor));
 end if;
end $$;

revoke all on function app_private.api_require_business(boolean),app_private.api_exact_keys(jsonb,text[]),app_private.api_text(jsonb,text,integer,integer),app_private.api_date(jsonb,text),app_private.api_timestamp(jsonb,text),app_private.api_uuid(jsonb,text),app_private.api_expected(jsonb,text),app_private.api_integer(jsonb,text,integer,integer),app_private.api_can_execute(uuid,uuid,date),app_private.touch_api_month_fence(uuid,uuid,date),app_private.guard_api_month_close_fence(),app_private.api_revalidate_actor(uuid,jsonb),app_private.api_lock_task_scope(uuid,uuid,uuid),app_private.api_touch_month_fences(uuid,jsonb) from public,anon,authenticated,service_role;
revoke all on function api.command_v1(jsonb),api.query_v1(jsonb) from public,anon,authenticated,service_role;
grant execute on function api.command_v1(jsonb),api.query_v1(jsonb) to authenticated;

revoke all on function app_private.reject_immutable_operational_history(),app_private.guard_operational_activity_snapshot(),app_private.guard_operational_unit_change(),app_private.guard_legacy_operational_closure() from public,anon,authenticated,service_role;
commit;
