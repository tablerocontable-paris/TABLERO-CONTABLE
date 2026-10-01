-- Contrato de ocurrencias 0.4. Sólo agregar; conservar el esquema 0.3 aplicado.
-- Probar desde cero y mediante upgrade fixture. No aplicar a una base remota aquí.
begin;

create table public.task_template_versions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  template_id uuid not null,
  version integer not null check (version > 0),
  title text not null check (length(trim(title)) > 0),
  objective text not null default '',
  sector text not null default 'Contabilidad general',
  kind text not null check (kind in ('resultado','operativa')),
  weight numeric not null check (weight > 0 and weight <= 100),
  unit text,
  monthly_target integer,
  checklist jsonb not null default '[]' check (jsonb_typeof(checklist)='array'),
  created_at timestamptz not null default now(),
  unique(id,organization_id),
  unique(template_id,version),
  foreign key(template_id,organization_id) references public.task_templates(id,organization_id),
  check(kind='resultado' or (monthly_target is not null and monthly_target>0 and nullif(trim(unit),'') is not null))
);

-- Congelar la definición que ya está activa en 0.3. Las revisiones nuevas reciben UUID/version propios.
insert into public.task_template_versions(organization_id,template_id,version,title,objective,sector,kind,weight,unit,monthly_target,checklist)
select t.organization_id,t.id,t.version,t.title,'Importado de 0.3; descripción pendiente de revisión.',
  coalesce((select min(p.sector) from public.task_assignments a join public.profiles p on p.id=a.owner_id where a.template_id=t.id),'Contabilidad general'),
  t.kind,t.weight,t.unit,t.monthly_target,t.checklist from public.task_templates t;
create function public.reject_template_version_change() returns trigger language plpgsql set search_path='' as $$begin
  raise exception 'Las revisiones del catálogo son inmutables; cree una revisión nueva';
end$$;
create trigger task_template_version_immutable before update or delete on public.task_template_versions for each row execute function public.reject_template_version_change();
alter table public.task_assignments add column template_version_id uuid;
update public.task_assignments a set template_version_id=v.id from public.task_template_versions v where v.template_id=a.template_id and v.organization_id=a.organization_id;
alter table public.task_assignments add constraint assignment_template_version_fk foreign key(template_version_id,organization_id) references public.task_template_versions(id,organization_id);
alter table public.task_instances add column template_version_id uuid;
update public.task_instances i set template_version_id=a.template_version_id from public.task_assignments a where a.id=i.assignment_id and a.organization_id=i.organization_id;
alter table public.task_instances add constraint instance_template_version_fk foreign key(template_version_id,organization_id) references public.task_template_versions(id,organization_id);

-- Preserve applied 0.3 rows and widen the old recurrence constraint.
alter table public.task_assignments drop constraint if exists task_assignments_frequency_check;
alter table public.task_assignments add constraint task_assignments_frequency_check check(frequency in ('mensual','unica','diaria','semanal'));
alter table public.task_assignments add column start_date date;
alter table public.task_assignments add column end_date date;
alter table public.task_assignments add column interval_count smallint not null default 1 check(interval_count between 1 and 12);
alter table public.task_assignments add column weekdays smallint[] not null default array[1]::smallint[];
alter table public.task_assignments add column month_day smallint;
alter table public.task_assignments add column has_deadline boolean not null default true;
alter table public.task_assignments add column due_offset_days smallint not null default 0 check(due_offset_days between 0 and 31);
update public.task_assignments set
  start_date=start_month + least(due_day-1,extract(day from (start_month+interval '1 month - 1 day'))::integer),
  month_day=due_day,
  due_offset_days=0;
-- Mantener compatibilidad con RPC antiguos durante la migración versionada;
-- cualquier escritura que omita los campos nuevos se normaliza en el servidor.
create function public.normalize_assignment_schedule() returns trigger language plpgsql set search_path='' as $$begin
  if new.start_date is null then
    new.start_date:=new.start_month+least(new.due_day-1,extract(day from (new.start_month+interval '1 month - 1 day'))::integer);
  end if;
  if new.month_day is null then new.month_day:=new.due_day; end if;
  return new;
end$$;
create trigger normalize_assignment_schedule before insert or update on public.task_assignments for each row execute function public.normalize_assignment_schedule();
alter table public.task_assignments alter column start_date set not null;
alter table public.task_assignments alter column month_day set not null;
alter table public.task_assignments add constraint assignment_schedule_valid check(end_date is null or end_date>=start_date);
alter table public.task_assignments add constraint assignment_weekdays_valid check(cardinality(weekdays)>0 and weekdays <@ array[0,1,2,3,4,5,6]::smallint[]);

-- 0.3 kept one task per assignment/month. Replace that identity with an occurrence date.
alter table public.task_instances add column scheduled_on date;
update public.task_instances set scheduled_on=due_date; -- best available legacy date; do not alter locked closure snapshots
alter table public.task_instances alter column due_date drop not null;
alter table public.task_instances alter column scheduled_on set not null;
alter table public.task_instances drop constraint if exists task_instances_assignment_id_period_key;
do $$ declare c record; begin
  for c in select conname from pg_constraint where conrelid='public.task_instances'::regclass and contype='c'
    and pg_get_constraintdef(oid) ilike '%due_date%' loop
    execute format('alter table public.task_instances drop constraint %I',c.conname);
  end loop;
end $$;
alter table public.task_instances add constraint instance_scheduled_period_valid check(period=date_trunc('month',scheduled_on)::date);
alter table public.task_instances add constraint instance_due_not_before_schedule check(due_date is null or due_date>=scheduled_on);
create unique index task_instances_assignment_occurrence_key on public.task_instances(assignment_id,scheduled_on);
create index task_instances_period_schedule_idx on public.task_instances(organization_id,scheduled_on,owner_id,company_id);

create table public.task_time_sessions(
  id uuid primary key default gen_random_uuid(), organization_id uuid not null,
  instance_id uuid not null, actor_id uuid not null,
  started_at timestamptz not null, ended_at timestamptz,
  created_at timestamptz not null default now(),
  unique(id,organization_id),
  foreign key(instance_id,organization_id) references public.task_instances(id,organization_id),
  foreign key(actor_id,organization_id) references public.profiles(id,organization_id),
  check(ended_at is null or ended_at>=started_at)
);
create unique index one_open_session_per_actor on public.task_time_sessions(actor_id) where ended_at is null;
create index sessions_instance_time_idx on public.task_time_sessions(instance_id,started_at);

create table public.employee_absences(
  id uuid primary key default gen_random_uuid(), organization_id uuid not null,
  owner_id uuid not null, replacement_id uuid, kind text not null check(kind in ('vacaciones','licencia')),
  starts_on date not null, ends_on date not null, note text not null default '',
  approved_by uuid not null, approved_at timestamptz not null default now(), cancelled_at timestamptz,
  foreign key(owner_id,organization_id) references public.profiles(id,organization_id),
  foreign key(replacement_id,organization_id) references public.profiles(id,organization_id),
  foreign key(approved_by,organization_id) references public.profiles(id,organization_id),
  check(ends_on>=starts_on), check(replacement_id is distinct from owner_id)
);
create index employee_absences_scope_idx on public.employee_absences(organization_id,owner_id,starts_on,ends_on) where cancelled_at is null;

alter table public.task_template_versions enable row level security;
alter table public.task_time_sessions enable row level security;
alter table public.employee_absences enable row level security;
create policy template_versions_read on public.task_template_versions for select to authenticated using(organization_id=public.actor_org());
create policy sessions_read on public.task_time_sessions for select to authenticated using(public.can_access_instance(instance_id));
create policy absences_read on public.employee_absences for select to authenticated using(public.can_access_owner(owner_id));
revoke all on public.task_template_versions,public.task_time_sessions,public.employee_absences from anon,authenticated;
grant select on public.task_template_versions,public.task_time_sessions,public.employee_absences to authenticated;

-- Drop only the old month-level uniqueness; this function remains idempotent by occurrence date.
create or replace function public.materialize_month(p_owner uuid,p_period date) returns integer
language plpgsql security definer set search_path='' as $$
declare inserted integer;begin
  if not public.can_access_owner(p_owner) or public.actor_role()='auditor' then raise exception 'Sin permiso';end if;
  if p_period is null or extract(day from p_period)<>1 then raise exception 'Período inválido';end if;
  perform public.lock_open_month(p_owner,p_period);
  insert into public.task_instances(organization_id,assignment_id,template_version_id,company_id,owner_id,team_id,period,scheduled_on,title,kind,weight,unit,target,due_date,checklist)
  select a.organization_id,a.id,a.template_version_id,a.company_id,a.owner_id,a.team_id,p_period,d.day::date,a.title,a.kind,a.weight,a.unit,a.target,
    case when a.has_deadline then d.day::date+a.due_offset_days else null end,
    coalesce((select jsonb_agg(jsonb_build_object('id',gen_random_uuid(),'text',case when jsonb_typeof(x)='string' then x#>>'{}' else x->>'text' end,'done',false) order by pos) from jsonb_array_elements(a.checklist) with ordinality items(x,pos)),'[]'::jsonb)
  from public.task_assignments a join public.profiles p on p.id=a.owner_id and p.active
  cross join lateral generate_series(p_period::timestamp,(p_period+interval '1 month - 1 day')::timestamp,interval '1 day') d(day)
  where a.owner_id=p_owner and a.organization_id=public.actor_org() and a.start_date<=d.day::date and (a.end_date is null or a.end_date>=d.day::date)
    and (a.frequency<>'unica' or d.day::date=a.start_date)
    and (a.frequency<>'mensual' or ((((extract(year from d.day)::integer*12+extract(month from d.day)::integer)-(extract(year from a.start_date)::integer*12+extract(month from a.start_date)::integer)) % a.interval_count=0) and extract(day from d.day)::integer=least(a.month_day,extract(day from (date_trunc('month',d.day)+interval '1 month - 1 day'))::integer)))
    and (a.frequency<>'diaria' or mod(d.day::date-a.start_date,a.interval_count)=0)
    and (a.frequency<>'semanal' or ((extract(dow from d.day)::integer=any(a.weekdays)) and (((d.day::date-(a.start_date-((extract(isodow from a.start_date)::integer-1))::integer))/7) % a.interval_count=0)))
    and (public.actor_role()='jefe' or exists(select 1 from public.company_memberships cm where cm.profile_id=auth.uid() and cm.company_id=a.company_id))
  on conflict(assignment_id,scheduled_on) do nothing;
  get diagnostics inserted=row_count;
  if inserted>0 then insert into public.audit_events(organization_id,actor_id,action,entity_id,details) values(public.actor_org(),auth.uid(),'month.materialized',p_owner,jsonb_build_object('period',p_period,'count',inserted));end if;
  return inserted;
end $$;

revoke execute on function public.materialize_month(uuid,date) from public,anon;
grant execute on function public.materialize_month(uuid,date) to authenticated;

-- Escribir una asignación desde la versión aprobada del estándar, no desde títulos/pesos del cliente.
create or replace function public.create_catalog_assignment(p_template uuid,p_company uuid,p_owner uuid,p_team uuid,p_period date,p_due_day integer,p_frequency text) returns uuid
language plpgsql security definer set search_path='' as $$
declare tpl public.task_template_versions; base_template public.task_templates; new_id uuid;
begin
  if not public.can_access_owner(p_owner) or public.actor_role()='auditor' then raise exception 'Sin permiso';end if;
  if extract(day from p_period)<>1 or p_due_day not between 1 and 31 then raise exception 'Período o fecha inválida';end if;
  if not exists(select 1 from public.company_memberships where profile_id=p_owner and company_id=p_company and organization_id=public.actor_org())
     or not exists(select 1 from public.team_members where profile_id=p_owner and team_id=p_team and organization_id=public.actor_org()) then raise exception 'Empresa o equipo fuera del ámbito del responsable';end if;
  if public.actor_role()<>'jefe' and not exists(select 1 from public.company_memberships where profile_id=auth.uid() and company_id=p_company) then raise exception 'Sin permiso para la empresa';end if;
  perform public.lock_open_month(p_owner,p_period);
  select * into base_template from public.task_templates where id=p_template and organization_id=public.actor_org() and active;
  if not found then raise exception 'Plantilla inválida';end if;
  select * into tpl from public.task_template_versions where template_id=p_template and organization_id=public.actor_org() order by version desc limit 1;
  if not found then raise exception 'La plantilla no tiene revisión activa';end if;
  insert into public.task_assignments(organization_id,template_id,template_version_id,company_id,owner_id,team_id,title,kind,weight,unit,target,frequency,start_month,due_day,checklist)
    values(tpl.organization_id,tpl.template_id,tpl.id,p_company,p_owner,p_team,tpl.title,tpl.kind,tpl.weight,tpl.unit,tpl.monthly_target,p_frequency,p_period,p_due_day,tpl.checklist) returning id into new_id;
  insert into public.audit_events(organization_id,actor_id,action,entity_id,details) values(tpl.organization_id,auth.uid(),'assignment.created',new_id,jsonb_build_object('company',p_company,'template_version',tpl.version));
  return new_id;
end $$;

create or replace function public.update_template_weight(p_template uuid,p_weight numeric) returns void
language plpgsql security definer set search_path='' as $$
declare old_version public.task_template_versions; new_version integer; org uuid;
begin
  perform public.require_privileged_session();
  if public.actor_role()<>'jefe' then raise exception 'Sólo jefatura define pesos';end if;
  if p_weight<=0 or p_weight>100 then raise exception 'Peso inválido';end if;
  select * into old_version from public.task_template_versions where template_id=p_template and organization_id=public.actor_org() order by version desc limit 1;
  if not found then raise exception 'Plantilla inválida';end if;
  update public.task_templates set weight=p_weight,version=version+1 where id=p_template and organization_id=public.actor_org() and active returning organization_id,version into org,new_version;
  if not found then raise exception 'Plantilla inactiva';end if;
  insert into public.task_template_versions(organization_id,template_id,version,title,objective,sector,kind,weight,unit,monthly_target,checklist)
    values(org,p_template,new_version,old_version.title,old_version.objective,old_version.sector,old_version.kind,p_weight,old_version.unit,old_version.monthly_target,old_version.checklist);
  insert into public.audit_events(organization_id,actor_id,action,entity_id,details) values(org,auth.uid(),'template.weight',p_template,jsonb_build_object('weight',p_weight,'version',new_version));
end $$;

create function public.create_task_template(p_title text,p_objective text,p_sector text,p_kind text,p_weight numeric,p_unit text,p_monthly_target integer,p_checklist jsonb) returns uuid
language plpgsql security definer set search_path='' as $$
declare org uuid; template_id uuid; clean_unit text;
begin
  perform public.require_privileged_session();
  if public.actor_role()<>'jefe' then raise exception 'Sólo jefatura administra el catálogo';end if;
  if nullif(trim(p_title),'') is null or length(trim(p_title))>120 or nullif(trim(p_objective),'') is null or nullif(trim(p_sector),'') is null then raise exception 'Nombre, objetivo y sector son obligatorios';end if;
  if p_kind not in ('resultado','operativa') or p_weight<=0 or p_weight>100 or jsonb_typeof(p_checklist)<>'array' or jsonb_array_length(p_checklist)=0 then raise exception 'Tipo, peso o controles inválidos';end if;
  if exists(select 1 from jsonb_array_elements(p_checklist) x where nullif(trim(coalesce(x->>'text',case when jsonb_typeof(x)='string' then x#>>'{}' end,'')),'') is null) then raise exception 'Cada control necesita una descripción';end if;
  clean_unit:=nullif(trim(p_unit),'');
  if p_kind='operativa' and (clean_unit is null or p_monthly_target is null or p_monthly_target<=0) then raise exception 'Una operativa requiere unidad y meta positiva';end if;
  org:=public.actor_org();
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(org::text||lower(regexp_replace(trim(p_title),'\s+',' ','g')),0));
  if exists(select 1 from public.task_template_versions v where v.organization_id=org and lower(regexp_replace(trim(v.title),'\s+',' ','g'))=lower(regexp_replace(trim(p_title),'\s+',' ','g'))) then raise exception 'Ese proceso ya existe en el catálogo';end if;
  insert into public.task_templates(organization_id,title,kind,weight,unit,monthly_target,checklist,version)
    values(org,trim(p_title),p_kind,p_weight,clean_unit,p_monthly_target,p_checklist,1) returning id into template_id;
  insert into public.task_template_versions(organization_id,template_id,version,title,objective,sector,kind,weight,unit,monthly_target,checklist)
    values(org,template_id,1,trim(p_title),trim(p_objective),trim(p_sector),p_kind,p_weight,clean_unit,p_monthly_target,p_checklist);
  insert into public.audit_events(organization_id,actor_id,action,entity_id,details) values(org,auth.uid(),'template.created',template_id,jsonb_build_object('version',1));
  return template_id;
end $$;
revoke execute on function public.create_catalog_assignment(uuid,uuid,uuid,uuid,date,integer,text),public.update_template_weight(uuid,numeric),public.create_task_template(text,text,text,text,numeric,text,integer,jsonb) from public,anon;
grant execute on function public.create_catalog_assignment(uuid,uuid,uuid,uuid,date,integer,text),public.update_template_weight(uuid,numeric),public.create_task_template(text,text,text,text,numeric,text,integer,jsonb) to authenticated;
commit;
