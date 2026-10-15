begin;

create schema if not exists api;
create schema if not exists app_private;

-- PostgreSQL grants EXECUTE on newly created functions to PUBLIC globally by default.
-- Existing functions keep their current ACL; future functions require explicit grants.
alter default privileges revoke all on functions from public, anon, authenticated, service_role;
alter default privileges in schema api revoke all on tables from public, anon, authenticated, service_role;
alter default privileges in schema api revoke all on functions from public, anon, authenticated, service_role;
alter default privileges in schema app_private revoke all on tables from public, anon, authenticated, service_role;
alter default privileges in schema app_private revoke all on functions from public, anon, authenticated, service_role;

revoke all on schema api from public, anon, authenticated, service_role;
revoke all on schema app_private from public, anon, authenticated, service_role;
grant usage on schema api to authenticated;
revoke create on schema public from public, anon, authenticated, service_role;
revoke create on schema api from public, anon, authenticated, service_role;
revoke create on schema app_private from public, anon, authenticated, service_role;


-- Match ECMAScript String.trim without changing stored names.
create function app_private.normalize_context_name(value text)
returns text language sql immutable strict set search_path = ''
as $$select pg_catalog.btrim(value,U&'\0009\000A\000B\000C\000D\0020\00A0\1680\2000\2001\2002\2003\2004\2005\2006\2007\2008\2009\200A\2028\2029\202F\205F\3000\FEFF')$$;
revoke all on function app_private.normalize_context_name(text) from public, anon, authenticated, service_role;

-- The row write forces stale snapshot transactions to serialize or abort.
create table app_private.principal_identity_fences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  revision bigint not null default 0 check (revision >= 0)
);
alter table app_private.principal_identity_fences enable row level security;
revoke all on table app_private.principal_identity_fences from public, anon, authenticated, service_role;

create table app_private.technical_accounts (
  user_id uuid primary key references auth.users(id),
  organization_id uuid not null references public.organizations(id),
  display_name text not null check (
    pg_catalog.char_length(app_private.normalize_context_name(display_name)) between 1 and 200
  ),
  active boolean not null default true,
  created_at timestamptz not null default pg_catalog.now()
);
alter table app_private.technical_accounts enable row level security;
revoke all on table app_private.technical_accounts from public, anon, authenticated, service_role;

create function app_private.guard_principal_identity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  principal_id uuid;
  conflict_found boolean;
begin
  if tg_table_schema = 'public' then
    principal_id := new.id;
  else
    principal_id := new.user_id;
  end if;
  perform pg_catalog.pg_advisory_xact_lock(1110, pg_catalog.hashtext(principal_id::text));
  insert into app_private.principal_identity_fences(user_id,revision)
    values(principal_id,1)
    on conflict(user_id) do update
    set revision=app_private.principal_identity_fences.revision+1;

  if tg_table_schema = 'public' then
    select exists(select 1 from app_private.technical_accounts t where t.user_id = principal_id)
      into conflict_found;
  else
    select exists(select 1 from public.profiles p where p.id = principal_id)
      into conflict_found;
  end if;

  if conflict_found then
    raise exception using errcode = '23514', message = 'Identidad de principal inválida';
  end if;
  return new;
end;
$$;

create trigger profiles_principal_identity_guard
before insert or update of id on public.profiles
for each row execute function app_private.guard_principal_identity();
create trigger technical_accounts_principal_identity_guard
before insert or update of user_id on app_private.technical_accounts
for each row execute function app_private.guard_principal_identity();

create function api.get_context_v1()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  token_role text := auth.jwt()->>'role';
  aal text := auth.jwt()->>'aal';
  profile_row record;
  technical_row record;
  principal_count integer;
  team_ids uuid[];
  company_ids uuid[];
  needs_mfa boolean;
begin
  if actor_id is null or token_role is distinct from 'authenticated' or aal is null or aal not in ('aal1','aal2') then
    raise exception using errcode = '42501', message = 'Contexto no disponible';
  end if;

  select count(*) into principal_count from (
    select 1 from public.profiles p where p.id = actor_id
    union all
    select 1 from app_private.technical_accounts t where t.user_id = actor_id
  ) active_principals;

  if principal_count <> 1 then
    raise exception using errcode = '42501', message = 'Contexto no disponible';
  end if;

  select p.id, p.organization_id, app_private.normalize_context_name(p.name) as display_name, p.role
    into profile_row
    from public.profiles p
    where p.id = actor_id and p.active;

  if found then
    if profile_row.role not in ('empleado','encargado','jefe')
      or profile_row.display_name is null
      or pg_catalog.char_length(profile_row.display_name) not between 1 and 200 then
      raise exception using errcode = '42501', message = 'Contexto no disponible';
    end if;

    select coalesce(pg_catalog.array_agg(m.team_id order by m.team_id), array[]::uuid[])
      into team_ids
      from public.team_members m
      join public.teams t on t.id = m.team_id and t.organization_id = m.organization_id
      where m.profile_id = actor_id and m.organization_id = profile_row.organization_id;
    select coalesce(pg_catalog.array_agg(m.company_id order by m.company_id), array[]::uuid[])
      into company_ids
      from public.company_memberships m
      join public.companies c on c.id = m.company_id and c.organization_id = m.organization_id
      where m.profile_id = actor_id and m.organization_id = profile_row.organization_id;

    needs_mfa := aal = 'aal1' and profile_row.role in ('jefe','encargado');
    return pg_catalog.jsonb_build_object(
      'contractVersion', 1,
      'principal', pg_catalog.jsonb_build_object(
        'kind','business','id',profile_row.id,'organizationId',profile_row.organization_id,
        'displayName',profile_row.display_name,'role',profile_row.role,
        'teamIds',to_jsonb(team_ids),'companyIds',to_jsonb(company_ids)
      ),
      'authentication', pg_catalog.jsonb_build_object('aal',aal,'requiresMfa',needs_mfa),
      'capabilities', '[]'::jsonb
    );
  end if;

  select t.user_id, t.organization_id, app_private.normalize_context_name(t.display_name) as display_name
    into technical_row
    from app_private.technical_accounts t
    where t.user_id = actor_id and t.active;
  if not found or pg_catalog.char_length(technical_row.display_name) not between 1 and 200 then
    raise exception using errcode = '42501', message = 'Contexto no disponible';
  end if;

  return pg_catalog.jsonb_build_object(
    'contractVersion', 1,
    'principal', pg_catalog.jsonb_build_object(
      'kind','technical','id',technical_row.user_id,'organizationId',technical_row.organization_id,
      'displayName',technical_row.display_name,'role','maintainer'
    ),
    'authentication', pg_catalog.jsonb_build_object('aal',aal,'requiresMfa',aal = 'aal1'),
    'capabilities', '[]'::jsonb
  );
end;
$$;

revoke all on function app_private.guard_principal_identity() from public, anon, authenticated, service_role;
revoke all on function api.get_context_v1() from public, anon, authenticated, service_role;
grant execute on function api.get_context_v1() to authenticated;

commit;
