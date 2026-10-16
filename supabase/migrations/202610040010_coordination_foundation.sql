-- B2a: staged responsibility and selected coverage. No operational authorization.
-- Preserve all 001–009 rows, RPCs, policies, indexes and immutable report snapshots.
begin;

create function public._coordination_text_present(p_text text) returns boolean
language sql immutable strict set search_path='' as $$
  select pg_catalog.length(pg_catalog.btrim(p_text,
    U&'\0009\000A\000B\000C\000D\0020\00A0\1680\2000\2001\2002\2003\2004\2005\2006\2007\2008\2009\200A\2028\2029\202F\205F\3000\FEFF')) > 0;
$$;

create table public.task_responsibility_sets (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  instance_id uuid not null,
  revision bigint not null check (revision between 1 and 9007199254740991),
  mode text not null check (mode in ('individual','conjunta')),
  origin text not null check (origin in ('baseline_legacy','explicit')),
  sealed boolean not null default false,
  anchor_owner_id uuid not null,
  company_id_snapshot uuid not null,
  period_snapshot date not null check (isfinite(period_snapshot) and extract(day from period_snapshot)=1),
  team_id_snapshot uuid not null,
  sector_snapshot text,
  sector_source text not null check (sector_source in ('catalog','unknown')),
  captured_at timestamptz not null default clock_timestamp(),
  captured_by uuid,
  reason text,
  unique (instance_id,revision),
  unique (id,instance_id,organization_id),
  unique (id,organization_id),
  foreign key (instance_id,organization_id) references public.task_instances(id,organization_id),
  foreign key (anchor_owner_id,organization_id) references public.profiles(id,organization_id),
  foreign key (company_id_snapshot,organization_id) references public.companies(id,organization_id),
  foreign key (team_id_snapshot,organization_id) references public.teams(id,organization_id),
  foreign key (captured_by,organization_id) references public.profiles(id,organization_id),
  check ((sector_source='unknown' and sector_snapshot is null) or
    (sector_source='catalog' and sector_snapshot is not null and public._coordination_text_present(sector_snapshot))),
  check ((origin='baseline_legacy' and captured_by is null and reason is null) or
    (origin='explicit' and captured_by is not null and reason is not null and public._coordination_text_present(reason)))
);

create table public.task_responsibility_members (
  set_id uuid not null,
  organization_id uuid not null,
  profile_id uuid not null,
  share_bps smallint not null check (share_bps between 1 and 10000),
  primary key (set_id,profile_id),
  foreign key (set_id,organization_id) references public.task_responsibility_sets(id,organization_id),
  foreign key (profile_id,organization_id) references public.profiles(id,organization_id)
);

create table public.task_responsibility_heads (
  instance_id uuid primary key,
  organization_id uuid not null,
  set_id uuid not null,
  foreign key (instance_id,organization_id) references public.task_instances(id,organization_id),
  foreign key (set_id,instance_id,organization_id) references public.task_responsibility_sets(id,instance_id,organization_id)
);

create function public._validate_task_responsibility_set(p_set uuid) returns void
language plpgsql security definer set search_path='' as $$
declare
  s public.task_responsibility_sets%rowtype;
  t public.task_instances%rowtype;
  catalog_sector text;
  member_count integer;
  total_share integer;
begin
  select * into s from public.task_responsibility_sets where id=p_set;
  if not found then raise exception 'Conjunto de responsabilidad inexistente'; end if;
  select * into t from public.task_instances where id=s.instance_id and organization_id=s.organization_id;
  if not found or (s.anchor_owner_id,s.company_id_snapshot,s.period_snapshot,s.team_id_snapshot)
    is distinct from (t.owner_id,t.company_id,t.period,t.team_id)
    then raise exception 'Identidad de responsabilidad incoherente'; end if;
  select v.sector into catalog_sector from public.task_template_versions v
    where v.id=t.template_version_id and v.organization_id=t.organization_id;
  if coalesce(public._coordination_text_present(catalog_sector),false) then
    if s.sector_source<>'catalog' or s.sector_snapshot is distinct from catalog_sector
      then raise exception 'Sector de catálogo incoherente'; end if;
  elsif s.sector_source<>'unknown' or s.sector_snapshot is not null then
    raise exception 'Sector histórico desconocido';
  end if;
  select count(*)::integer,coalesce(sum(share_bps),0)::integer into member_count,total_share
    from public.task_responsibility_members where set_id=s.id and organization_id=s.organization_id;
  if total_share<>10000 or (s.mode='individual' and member_count<>1) or
     (s.mode='conjunta' and member_count<>2) then
    raise exception 'Participantes y cuotas deben representar el 100%%';
  end if;
  if s.mode='conjunta' and not exists(select 1 from public.task_assignments a
    where a.id=t.assignment_id and a.organization_id=t.organization_id and a.frequency='unica')
    then raise exception 'Conjunta sólo para tareas puntuales'; end if;
  if s.origin='baseline_legacy' and (s.mode<>'individual' or member_count<>1 or
    not exists(select 1 from public.task_responsibility_members m
      where m.set_id=s.id and m.organization_id=s.organization_id and m.profile_id=t.owner_id and m.share_bps=10000))
    then raise exception 'Baseline debe conservar al titular con 100%%'; end if;
end;
$$;

create function public._guard_task_responsibility_set() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if tg_op='INSERT' then
    if new.sealed then raise exception 'El conjunto debe crearse como borrador'; end if;
    return new;
  end if;
  if tg_op='DELETE' then raise exception 'La responsabilidad es inmutable'; end if;
  if old.sealed or not new.sealed or
    (pg_catalog.to_jsonb(new)-'sealed') is distinct from (pg_catalog.to_jsonb(old)-'sealed')
    then raise exception 'Sólo se permite sellar el conjunto sin cambiar su identidad'; end if;
  perform public._validate_task_responsibility_set(old.id);
  return new;
end;
$$;
create trigger task_responsibility_set_guard before insert or update or delete
  on public.task_responsibility_sets for each row execute function public._guard_task_responsibility_set();

create function public._guard_task_responsibility_member() returns trigger
language plpgsql security definer set search_path='' as $$
declare parent_id uuid; parent_org uuid; parent_sealed boolean;
begin
  if tg_op='UPDATE' and (new.set_id,new.organization_id) is distinct from (old.set_id,old.organization_id)
    then raise exception 'No se puede mover el participante de conjunto'; end if;
  if tg_op='DELETE' then parent_id:=old.set_id; parent_org:=old.organization_id;
  else parent_id:=new.set_id; parent_org:=new.organization_id; end if;
  -- Serialize membership edits with the seal transition on the parent row.
  select sealed into parent_sealed from public.task_responsibility_sets
    where id=parent_id and organization_id=parent_org for update;
  if not found then raise exception 'Conjunto de responsabilidad inexistente'; end if;
  if parent_sealed then raise exception 'Los participantes sellados son inmutables'; end if;
  if tg_op='DELETE' then return old; end if;
  return new;
end;
$$;
create trigger task_responsibility_member_guard before insert or update or delete
  on public.task_responsibility_members for each row execute function public._guard_task_responsibility_member();

create function public._guard_task_responsibility_head() returns trigger
language plpgsql security definer set search_path='' as $$
declare s public.task_responsibility_sets%rowtype;
begin
  if tg_op<>'INSERT' then raise exception 'La cabecera de responsabilidad permanece inmutable en 010'; end if;
  select * into s from public.task_responsibility_sets
    where id=new.set_id and instance_id=new.instance_id and organization_id=new.organization_id for update;
  if not found or not s.sealed or s.origin<>'baseline_legacy' or s.mode<>'individual'
    then raise exception '010 sólo admite cabecera baseline individual sellada'; end if;
  perform public._validate_task_responsibility_set(s.id);
  return new;
end;
$$;
create trigger task_responsibility_head_guard before insert or update or delete
  on public.task_responsibility_heads for each row execute function public._guard_task_responsibility_head();

create table public.task_coverage_plans (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  responsible_id uuid not null,
  replacement_id uuid not null,
  starts_on date not null,
  ends_on date not null,
  kind text not null check (kind in ('vacaciones','licencia','otra')),
  handover_note text not null default '' check (length(handover_note) between 0 and 2000),
  created_by uuid not null,
  created_at timestamptz not null default clock_timestamp(),
  sealed boolean not null default false,
  sealed_by uuid,
  sealed_at timestamptz,
  unique (id,organization_id),
  foreign key (responsible_id,organization_id) references public.profiles(id,organization_id),
  foreign key (replacement_id,organization_id) references public.profiles(id,organization_id),
  foreign key (created_by,organization_id) references public.profiles(id,organization_id),
  foreign key (sealed_by,organization_id) references public.profiles(id,organization_id),
  check (responsible_id<>replacement_id),
  check (isfinite(starts_on) and isfinite(ends_on) and starts_on<=ends_on),
  check ((not sealed and sealed_by is null and sealed_at is null) or
    (sealed and sealed_by is not null and sealed_at is not null))
);

create table public.task_coverage_plan_instances (
  plan_id uuid not null,
  organization_id uuid not null,
  instance_id uuid not null,
  company_id_snapshot uuid not null,
  period_snapshot date not null check (isfinite(period_snapshot) and extract(day from period_snapshot)=1),
  responsibility_set_id uuid,
  primary key (plan_id,instance_id),
  foreign key (plan_id,organization_id) references public.task_coverage_plans(id,organization_id),
  foreign key (instance_id,organization_id) references public.task_instances(id,organization_id),
  foreign key (company_id_snapshot,organization_id) references public.companies(id,organization_id),
  foreign key (responsibility_set_id,instance_id,organization_id) references public.task_responsibility_sets(id,instance_id,organization_id)
);

create table public.task_coverage_plan_assignment_rules (
  plan_id uuid not null,
  organization_id uuid not null,
  assignment_id uuid not null,
  company_id_snapshot uuid not null,
  assignment_snapshot jsonb not null check (jsonb_typeof(assignment_snapshot)='object'),
  primary key (plan_id,assignment_id),
  foreign key (plan_id,organization_id) references public.task_coverage_plans(id,organization_id),
  foreign key (assignment_id,organization_id) references public.task_assignments(id,organization_id),
  foreign key (company_id_snapshot,organization_id) references public.companies(id,organization_id)
);

create function public._validate_task_coverage_plan(p_plan uuid) returns void
language plpgsql security definer set search_path='' as $$
declare p public.task_coverage_plans%rowtype;
begin
  select * into p from public.task_coverage_plans where id=p_plan;
  if not found then raise exception 'Plan de cobertura inexistente'; end if;
  if p.responsible_id=p.replacement_id or p.starts_on>p.ends_on
    then raise exception 'Personas o fechas de cobertura inválidas'; end if;
  if not exists(select 1 from public.task_coverage_plan_instances where plan_id=p.id) and
     not exists(select 1 from public.task_coverage_plan_assignment_rules where plan_id=p.id)
    then raise exception 'La cobertura requiere una selección'; end if;
  if exists(
    select 1 from public.task_coverage_plan_instances x
    join public.task_instances t on t.id=x.instance_id and t.organization_id=x.organization_id
    left join public.task_responsibility_sets s on s.id=x.responsibility_set_id
      and s.organization_id=x.organization_id and s.instance_id=x.instance_id
    where x.plan_id=p.id and (
      x.organization_id<>p.organization_id or
      (x.company_id_snapshot,x.period_snapshot) is distinct from (t.company_id,t.period) or
      (x.responsibility_set_id is null and t.owner_id<>p.responsible_id) or
      (x.responsibility_set_id is not null and (s.id is null or not s.sealed or
        not exists(select 1 from public.task_responsibility_members m where m.set_id=s.id
          and m.organization_id=p.organization_id and m.profile_id=p.responsible_id)))
    )) then raise exception 'Selección de ocurrencia incoherente'; end if;
  if exists(
    select 1 from public.task_coverage_plan_assignment_rules x
    join public.task_assignments a on a.id=x.assignment_id and a.organization_id=x.organization_id
    where x.plan_id=p.id and (x.organization_id<>p.organization_id or
      x.company_id_snapshot<>a.company_id or a.owner_id<>p.responsible_id or
      x.assignment_snapshot is distinct from pg_catalog.to_jsonb(a))
    ) then raise exception 'Regla de cobertura o snapshot incoherente'; end if;
end;
$$;

create function public._guard_task_coverage_plan() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if tg_op='INSERT' then
    if new.sealed then raise exception 'El plan debe crearse como borrador'; end if;
    return new;
  end if;
  if tg_op='DELETE' then raise exception 'El plan de cobertura es inmutable'; end if;
  if old.sealed or not new.sealed or new.sealed_by is null or new.sealed_at is null or
    (pg_catalog.to_jsonb(new)-array['sealed','sealed_by','sealed_at']) is distinct from
    (pg_catalog.to_jsonb(old)-array['sealed','sealed_by','sealed_at'])
    then raise exception 'Sólo se permite sellar el plan sin cambiar su identidad'; end if;
  perform public._validate_task_coverage_plan(old.id);
  return new;
end;
$$;
create trigger task_coverage_plan_guard before insert or update or delete
  on public.task_coverage_plans for each row execute function public._guard_task_coverage_plan();

create function public._guard_task_coverage_selection() returns trigger
language plpgsql security definer set search_path='' as $$
declare parent_id uuid; parent_org uuid; parent_sealed boolean;
begin
  if tg_op='UPDATE' and (new.plan_id,new.organization_id) is distinct from (old.plan_id,old.organization_id)
    then raise exception 'No se puede mover la selección de plan'; end if;
  if tg_op='DELETE' then parent_id:=old.plan_id; parent_org:=old.organization_id;
  else parent_id:=new.plan_id; parent_org:=new.organization_id; end if;
  select sealed into parent_sealed from public.task_coverage_plans
    where id=parent_id and organization_id=parent_org for update;
  if not found then raise exception 'Plan de cobertura inexistente'; end if;
  if parent_sealed then raise exception 'La selección sellada es inmutable'; end if;
  if tg_op='DELETE' then return old; end if;
  return new;
end;
$$;
create trigger task_coverage_instance_selection_guard before insert or update or delete
  on public.task_coverage_plan_instances for each row execute function public._guard_task_coverage_selection();
create trigger task_coverage_rule_selection_guard before insert or update or delete
  on public.task_coverage_plan_assignment_rules for each row execute function public._guard_task_coverage_selection();

-- Capture the current legacy identity once. The timestamp is capture time,
-- not an invented historical assignment time. Never derive sector from profiles.
insert into public.task_responsibility_sets(organization_id,instance_id,revision,mode,origin,
  anchor_owner_id,company_id_snapshot,period_snapshot,team_id_snapshot,sector_snapshot,sector_source)
select t.organization_id,t.id,1,'individual','baseline_legacy',t.owner_id,t.company_id,t.period,t.team_id,
  case when coalesce(public._coordination_text_present(v.sector),false) then v.sector else null end,
  case when coalesce(public._coordination_text_present(v.sector),false) then 'catalog' else 'unknown' end
from public.task_instances t left join public.task_template_versions v
  on v.id=t.template_version_id and v.organization_id=t.organization_id;
insert into public.task_responsibility_members(set_id,organization_id,profile_id,share_bps)
select id,organization_id,anchor_owner_id,10000 from public.task_responsibility_sets;
update public.task_responsibility_sets set sealed=true;
insert into public.task_responsibility_heads(instance_id,organization_id,set_id)
select instance_id,organization_id,id from public.task_responsibility_sets;

create function public._legacy_task_responsibility(p_instance uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare t public.task_instances%rowtype; s public.task_responsibility_sets%rowtype;
  catalog_sector text;
begin
  select * into t from public.task_instances where id=p_instance;
  if not found then raise exception 'Ocurrencia inexistente'; end if;
  select x.* into s from public.task_responsibility_heads h join public.task_responsibility_sets x
    on x.id=h.set_id and x.instance_id=h.instance_id and x.organization_id=h.organization_id
    where h.instance_id=t.id and h.organization_id=t.organization_id;
  if found then
    return pg_catalog.jsonb_build_object('schemaVersion',2,'instanceId',s.instance_id,'setId',s.id,
      'revision',s.revision,'origin',s.origin,'mode',s.mode,'anchorOwnerId',s.anchor_owner_id,
      'companyId',s.company_id_snapshot,'period',s.period_snapshot,'teamId',s.team_id_snapshot,
      'sector',s.sector_snapshot,'sectorSource',s.sector_source,
      'members',(select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('profileId',m.profile_id,'shareBps',m.share_bps) order by m.profile_id)
        from public.task_responsibility_members m where m.set_id=s.id and m.organization_id=s.organization_id));
  end if;
  select v.sector into catalog_sector from public.task_template_versions v
    where v.id=t.template_version_id and v.organization_id=t.organization_id;
  return pg_catalog.jsonb_build_object('schemaVersion',2,'instanceId',t.id,'setId',null,
    'revision',0,'origin','legacy_fallback','mode','individual','anchorOwnerId',t.owner_id,
    'companyId',t.company_id,'period',t.period,'teamId',t.team_id,
    'sector',case when coalesce(public._coordination_text_present(catalog_sector),false) then catalog_sector else null end,
    'sectorSource',case when coalesce(public._coordination_text_present(catalog_sector),false) then 'catalog' else 'unknown' end,
    'members',pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object('profileId',t.owner_id,'shareBps',10000)));
end;
$$;

alter table public.task_responsibility_sets enable row level security;
alter table public.task_responsibility_members enable row level security;
alter table public.task_responsibility_heads enable row level security;
alter table public.task_coverage_plans enable row level security;
alter table public.task_coverage_plan_instances enable row level security;
alter table public.task_coverage_plan_assignment_rules enable row level security;
revoke all on public.task_responsibility_sets,public.task_responsibility_members,
  public.task_responsibility_heads,public.task_coverage_plans,public.task_coverage_plan_instances,
  public.task_coverage_plan_assignment_rules from public,anon,authenticated,service_role;
revoke all on function public._coordination_text_present(text),public._validate_task_responsibility_set(uuid),
  public._guard_task_responsibility_set(),public._guard_task_responsibility_member(),public._guard_task_responsibility_head(),
  public._validate_task_coverage_plan(uuid),public._guard_task_coverage_plan(),public._guard_task_coverage_selection(),
  public._legacy_task_responsibility(uuid) from public,anon,authenticated,service_role;

commit;
