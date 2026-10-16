-- Nueva base exclusivamente. No ejecutar contra el proyecto legacy.
-- Esta migración crea el contrato inicial; no incluye invitaciones, Storage ni diagnóstico.
create table public.organizations(id uuid primary key default gen_random_uuid(), name text not null);
create table public.companies(id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations, name text not null, unique(id,organization_id));
create table public.profiles(id uuid primary key references auth.users(id), organization_id uuid not null references public.organizations, name text not null, role text not null check(role in ('jefe','encargado','empleado','auditor')), manager_id uuid, sector text not null, branch text not null, position text not null, active boolean not null default true, unique(id,organization_id), foreign key(manager_id,organization_id) references public.profiles(id,organization_id), check(manager_id is distinct from id));
create table public.teams(id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.organizations,name text not null,manager_id uuid not null,unique(id,organization_id),foreign key(manager_id,organization_id) references public.profiles(id,organization_id));
create table public.team_members(organization_id uuid not null,team_id uuid not null,profile_id uuid not null,primary key(team_id,profile_id),foreign key(team_id,organization_id) references public.teams(id,organization_id),foreign key(profile_id,organization_id) references public.profiles(id,organization_id));
create table public.company_memberships(organization_id uuid not null,company_id uuid not null,profile_id uuid not null,primary key(company_id,profile_id),foreign key(company_id,organization_id) references public.companies(id,organization_id),foreign key(profile_id,organization_id) references public.profiles(id,organization_id));
create table public.task_templates(id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.organizations,title text not null,kind text not null check(kind in ('resultado','operativa')),weight numeric not null check(weight>0 and weight<=100),unit text,monthly_target integer,checklist jsonb not null default '[]',version integer not null default 1,active boolean not null default true,unique(id,organization_id),check(kind='resultado' or (monthly_target is not null and monthly_target>0 and nullif(trim(unit),'') is not null)),check(jsonb_typeof(checklist)='array'));
create table public.task_assignments(id uuid primary key default gen_random_uuid(),organization_id uuid not null,template_id uuid,company_id uuid not null,owner_id uuid not null,team_id uuid not null,title text not null,kind text not null check(kind in ('resultado','operativa')),weight numeric not null check(weight>0 and weight<=100),unit text,target integer,frequency text not null check(frequency in ('mensual','unica')),start_month date not null,due_day integer not null check(due_day between 1 and 31),checklist jsonb not null default '[]',unique(id,organization_id),foreign key(template_id,organization_id) references public.task_templates(id,organization_id),foreign key(company_id,organization_id) references public.companies(id,organization_id),foreign key(owner_id,organization_id) references public.profiles(id,organization_id),foreign key(team_id,organization_id) references public.teams(id,organization_id),check(extract(day from start_month)=1),check(kind='resultado' or (target is not null and target>0 and nullif(trim(unit),'') is not null)),check(jsonb_typeof(checklist)='array'));
create table public.task_instances(id uuid primary key default gen_random_uuid(),organization_id uuid not null,assignment_id uuid not null,company_id uuid not null,owner_id uuid not null,team_id uuid not null,period date not null,title text not null,kind text not null check(kind in ('resultado','operativa')),weight numeric not null check(weight>0 and weight<=100),unit text,target integer,status text not null default 'Pendiente' check(status in ('Pendiente','En curso','Completada')),due_date date not null,started_at timestamptz,completed_at timestamptz,checklist jsonb not null default '[]',blocked_by text,blocked_since date,unique(assignment_id,period),unique(id,organization_id),foreign key(assignment_id,organization_id) references public.task_assignments(id,organization_id),foreign key(company_id,organization_id) references public.companies(id,organization_id),foreign key(owner_id,organization_id) references public.profiles(id,organization_id),foreign key(team_id,organization_id) references public.teams(id,organization_id),check(extract(day from period)=1),check(date_trunc('month',due_date)::date=period),check((status='Completada')=(completed_at is not null)),check((blocked_by is null)=(blocked_since is null)),check(kind='resultado' or (target is not null and target>0 and nullif(trim(unit),'') is not null and status<>'Completada')),check(jsonb_typeof(checklist)='array'));
create table public.activity_entries(id uuid primary key default gen_random_uuid(),organization_id uuid not null,instance_id uuid not null,work_date date not null,quantity integer not null check(quantity between 1 and 1000000),reference text not null check(length(trim(reference))>0),actor_id uuid not null references public.profiles,created_at timestamptz not null default now(),foreign key(instance_id,organization_id) references public.task_instances(id,organization_id));
create table public.onboarding_progress(profile_id uuid primary key references public.profiles,version integer not null default 1,step integer not null check(step between 0 and 5),draft jsonb not null default '{}',completed_at timestamptz,updated_at timestamptz not null default now());
create table public.monthly_closures(id uuid primary key default gen_random_uuid(),organization_id uuid not null,owner_id uuid not null,period date not null,snapshot jsonb not null,closed_by uuid not null references public.profiles,closed_at timestamptz not null default now(),note text not null,unique(owner_id,period),foreign key(owner_id,organization_id) references public.profiles(id,organization_id),check(extract(day from period)=1));
create table public.audit_events(id bigint generated always as identity primary key,organization_id uuid not null references public.organizations,actor_id uuid references public.profiles,action text not null,entity_id uuid,at timestamptz not null default now(),details jsonb not null default '{}');
create index task_scope_idx on public.task_instances(organization_id,period,owner_id,company_id);
create index activity_instance_date_idx on public.activity_entries(instance_id,work_date);
create index profiles_manager_idx on public.profiles(manager_id);

-- Helpers sin recursión de RLS. No se toma el rol desde parámetros del cliente.
create function public.actor_org() returns uuid language sql stable security definer set search_path='' as $$select organization_id from public.profiles where id=auth.uid() and active$$;
create function public.actor_role() returns text language sql stable security definer set search_path='' as $$select role from public.profiles where id=auth.uid() and active$$;
create function public.can_access_owner(target uuid) returns boolean language sql stable security definer set search_path='' as $$select exists(select 1 from public.profiles a join public.profiles p on p.organization_id=a.organization_id where a.id=auth.uid() and a.active and (a.role='jefe' or a.id=p.id or (a.role='encargado' and p.manager_id=a.id)) and p.id=target)$$;
create function public.can_access_instance(p_instance_id uuid) returns boolean language sql stable security definer set search_path='' as $$select exists(select 1 from public.task_instances t where t.id=p_instance_id and public.can_access_owner(t.owner_id) and (public.actor_role()='jefe' or exists(select 1 from public.company_memberships m where m.profile_id=auth.uid() and m.company_id=t.company_id)))$$;

alter table public.organizations enable row level security;
alter table public.companies enable row level security;
alter table public.profiles enable row level security;
alter table public.teams enable row level security;
alter table public.team_members enable row level security;
alter table public.company_memberships enable row level security;
alter table public.task_templates enable row level security;
alter table public.task_assignments enable row level security;
alter table public.task_instances enable row level security;
alter table public.activity_entries enable row level security;
alter table public.onboarding_progress enable row level security;
alter table public.monthly_closures enable row level security;
alter table public.audit_events enable row level security;
create policy org_read on public.organizations for select to authenticated using(id=public.actor_org());
create policy company_read on public.companies for select to authenticated using(organization_id=public.actor_org());
create policy profile_read on public.profiles for select to authenticated using(public.can_access_owner(id));
create policy teams_read on public.teams for select to authenticated using(organization_id=public.actor_org() and (public.actor_role()='jefe' or manager_id=auth.uid() or exists(select 1 from public.team_members m where m.team_id=id and m.profile_id=auth.uid())));
create policy team_members_read on public.team_members for select to authenticated using(public.can_access_owner(profile_id));
create policy company_members_read on public.company_memberships for select to authenticated using(public.can_access_owner(profile_id));
create policy templates_read on public.task_templates for select to authenticated using(organization_id=public.actor_org());
create policy assignments_read on public.task_assignments for select to authenticated using(public.can_access_owner(owner_id) and (public.actor_role()='jefe' or exists(select 1 from public.company_memberships m where m.profile_id=auth.uid() and m.company_id=task_assignments.company_id)));
create policy instance_read on public.task_instances for select to authenticated using(public.can_access_instance(id));
create policy activity_read on public.activity_entries for select to authenticated using(public.can_access_instance(instance_id));
create policy onboarding_read on public.onboarding_progress for select to authenticated using(profile_id=auth.uid() or (public.actor_role()='jefe' and public.can_access_owner(profile_id)));
create policy closures_read on public.monthly_closures for select to authenticated using(public.can_access_owner(owner_id));
create policy audit_read on public.audit_events for select to authenticated using(organization_id=public.actor_org() and public.actor_role()='jefe');

-- Bloqueo común evita competir entre cerrar un mes y registrar actividad.
create function public.lock_open_month(target_owner uuid,target_period date) returns void language plpgsql security definer set search_path='' as $$begin
perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(target_owner::text||target_period::text,0));
if exists(select 1 from public.monthly_closures where owner_id=target_owner and period=target_period) then raise exception 'El mes está cerrado';end if;
end$$;
create function public.transition_task(p_instance_id uuid,next_status text) returns void language plpgsql security definer set search_path='' as $$declare t public.task_instances;begin
if not public.can_access_instance(p_instance_id) then raise exception 'Sin permiso';end if;
select * into t from public.task_instances where id=p_instance_id;
perform public.lock_open_month(t.owner_id,t.period);
select * into t from public.task_instances where id=p_instance_id for update;
if next_status not in ('Pendiente','En curso','Completada') then raise exception 'Estado inválido';end if;
if next_status='Completada' then
if t.kind='operativa' or t.status='Pendiente' or t.blocked_by is not null then raise exception 'Transición inválida';end if;
if exists(select 1 from jsonb_array_elements(t.checklist) c where coalesce((c->>'done')::boolean,false)=false) then raise exception 'Checklist pendiente';end if;
end if;
update public.task_instances set status=next_status,started_at=case when next_status='En curso' then coalesce(started_at,now()) else started_at end,completed_at=case when next_status='Completada' then now() else null end where id=p_instance_id;
insert into public.audit_events(organization_id,actor_id,action,entity_id,details) values(t.organization_id,auth.uid(),'task.transition',p_instance_id,jsonb_build_object('from',t.status,'to',next_status));
end$$;
create function public.record_activity(p_instance_id uuid,work_day date,qty integer,note text) returns uuid language plpgsql security definer set search_path='' as $$declare t public.task_instances;entry_id uuid;begin
if not public.can_access_instance(p_instance_id) then raise exception 'Sin permiso';end if;
select * into t from public.task_instances where id=p_instance_id;
perform public.lock_open_month(t.owner_id,t.period);
if t.kind<>'operativa' or date_trunc('month',work_day)::date<>t.period or work_day>(now() at time zone 'America/Argentina/Buenos_Aires')::date then raise exception 'Fecha o tipo inválido';end if;
insert into public.activity_entries(organization_id,instance_id,work_date,quantity,reference,actor_id) values(t.organization_id,t.id,work_day,qty,note,auth.uid()) returning id into entry_id;
insert into public.audit_events(organization_id,actor_id,action,entity_id) values(t.organization_id,auth.uid(),'activity.created',entry_id);
return entry_id;end$$;
create function public.save_onboarding(step_number integer,draft_data jsonb) returns void language plpgsql security definer set search_path='' as $$begin
if public.actor_org() is null then raise exception 'Sin permiso';end if;
insert into public.onboarding_progress(profile_id,step,draft) values(auth.uid(),step_number,draft_data) on conflict(profile_id) do update set step=excluded.step,draft=excluded.draft,updated_at=now();
end$$;
-- Sin grants de INSERT/UPDATE/DELETE: el cliente sólo escribe mediante RPC autorizadas.
revoke all on all tables in schema public from anon,authenticated;
grant select on public.organizations,public.companies,public.profiles,public.teams,public.team_members,public.company_memberships,public.task_templates,public.task_assignments,public.task_instances,public.activity_entries,public.onboarding_progress,public.monthly_closures,public.audit_events to authenticated;
revoke execute on all functions in schema public from public,anon,authenticated;
grant execute on function public.actor_org(),public.actor_role(),public.can_access_owner(uuid),public.can_access_instance(uuid),public.transition_task(uuid,text),public.record_activity(uuid,date,integer,text),public.save_onboarding(integer,jsonb) to authenticated;
