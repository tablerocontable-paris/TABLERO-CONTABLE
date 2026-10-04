-- B1 / 009. Private comments are stored outside task fields and shared receipts.
begin;

-- ECMAScript trim whitespace, shared with the wrapper; SQL trim alone removes spaces only.
create function public._normalize_private_block_note_body(p_body text) returns text
language sql immutable strict set search_path='' as $$
  select pg_catalog.btrim(p_body,U&'\0009\000A\000B\000C\000D\0020\00A0\1680\2000\2001\2002\2003\2004\2005\2006\2007\2008\2009\200A\2028\2029\202F\205F\3000\FEFF')
$$;
revoke all on function public._normalize_private_block_note_body(text) from public,anon,authenticated;

create table public.task_private_block_notes(
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  instance_id uuid not null,
  author_id uuid not null,
  body text not null,
  revision bigint not null default 1 check(revision between 1 and 9007199254740991),
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  cleared_at timestamptz,
  unique(instance_id,author_id),
  unique(id,organization_id),
  foreign key(instance_id,organization_id) references public.task_instances(id,organization_id),
  foreign key(author_id,organization_id) references public.profiles(id,organization_id),
  check((cleared_at is null and length(body) between 1 and 2000
       and body=public._normalize_private_block_note_body(body))
     or (cleared_at is not null and body=''))
);

create table public.task_private_block_note_versions(
  note_id uuid not null,
  organization_id uuid not null,
  revision bigint not null check(revision between 1 and 9007199254740991),
  body text not null,
  cleared_at timestamptz,
  at timestamptz not null,
  actor_id uuid not null,
  primary key(note_id,revision),
  foreign key(note_id,organization_id) references public.task_private_block_notes(id,organization_id),
  foreign key(actor_id,organization_id) references public.profiles(id,organization_id),
  check((cleared_at is null and length(body) between 1 and 2000
       and body=public._normalize_private_block_note_body(body))
     or (cleared_at is not null and body=''))
);

create table public.private_block_note_receipts(
  organization_id uuid not null,
  actor_id uuid not null,
  operation_id uuid not null,
  arguments jsonb not null,
  result jsonb not null,
  created_at timestamptz not null default clock_timestamp(),
  primary key(actor_id,operation_id),
  foreign key(actor_id,organization_id) references public.profiles(id,organization_id)
);

alter table public.task_private_block_notes enable row level security;
alter table public.task_private_block_note_versions enable row level security;
alter table public.private_block_note_receipts enable row level security;
revoke all on public.task_private_block_notes,public.task_private_block_note_versions,public.private_block_note_receipts from public,anon,authenticated;
grant select on public.task_private_block_notes,public.task_private_block_note_versions to authenticated;

create function public.can_read_private_block_note(p_note uuid) returns boolean
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
        and exists(select 1 from public.company_memberships m
          where m.profile_id=actor.id and m.company_id=t.company_id and m.organization_id=t.organization_id))
    )
  )
$$;

create policy private_block_notes_read on public.task_private_block_notes
  for select to authenticated using(public.can_read_private_block_note(id));
create policy private_block_note_versions_read on public.task_private_block_note_versions
  for select to authenticated using(public.can_read_private_block_note(note_id));

create function public.guard_private_block_note_versions() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  raise exception 'El historial de comentarios privados es inmutable';
end
$$;
create trigger task_private_block_note_versions_immutable
  before update or delete on public.task_private_block_note_versions
  for each row execute function public.guard_private_block_note_versions();
revoke all on function public.guard_private_block_note_versions() from public,anon,authenticated;

create function public.save_private_block_note(
  p_instance uuid,p_body text,p_expected_revision bigint,p_operation_id uuid
) returns jsonb
language plpgsql security definer set search_path='' as $$
declare
  actor_org_id uuid;
  actor_role_value text;
  planned public.task_instances;
  t public.task_instances;
  n public.task_private_block_notes;
  cached public.private_block_note_receipts;
  args jsonb;
  result jsonb;
  normalized_body text;
  cleared_time timestamptz;
  action_name text;
begin
  actor_org_id:=public.actor_org();
  actor_role_value:=public.actor_role();
  if auth.uid() is null or actor_org_id is null or actor_role_value not in ('empleado','encargado','jefe') then
    raise exception 'Sin permiso';
  end if;
  if p_instance is null or p_operation_id is null or p_expected_revision is null or p_expected_revision<0 then
    raise exception 'Identidad, operación y revisión requeridas';
  end if;
  normalized_body:=public._normalize_private_block_note_body(p_body);
  if p_body is not null and (length(normalized_body)=0 or length(normalized_body)>2000) then
    raise exception 'El comentario debe tener entre 1 y 2000 caracteres';
  end if;
  args:=jsonb_build_object('instance',p_instance,'body',p_body,'revision',p_expected_revision);

  -- Shared operation lock preserves the existing serialization boundary; receipts stay module-private.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(auth.uid()::text||p_operation_id::text,0));
  if public.actor_org() is distinct from actor_org_id
    or coalesce(public.actor_role() not in ('empleado','encargado','jefe'),true) then raise exception 'Sin permiso'; end if;
  select * into cached from public.private_block_note_receipts
    where actor_id=auth.uid() and operation_id=p_operation_id;
  if found then
    if cached.organization_id is distinct from actor_org_id or cached.arguments is distinct from args then
      raise exception 'La operación ya fue usada con otros argumentos';
    end if;
    return cached.result;
  end if;

  select * into planned from public.task_instances
    where id=p_instance and organization_id=actor_org_id;
  if not found then raise exception 'Sin permiso'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('work-owner:'||planned.owner_id::text,0));
  perform public.lock_open_month(planned.owner_id,planned.period);
  select * into t from public.task_instances where id=p_instance for update;
  if not found or (t.id,t.organization_id,t.assignment_id,t.company_id,t.owner_id,t.period)
      is distinct from (planned.id,planned.organization_id,planned.assignment_id,planned.company_id,planned.owner_id,planned.period) then
    raise exception 'La identidad de la tarea cambió';
  end if;
  cleared_time:=clock_timestamp();
  if public.actor_org() is distinct from actor_org_id or not public._can_access_instance_at(t.id,cleared_time)
    or coalesce(public.actor_role() not in ('empleado','encargado','jefe'),true) then
    raise exception 'Sin permiso';
  end if;

  select * into n from public.task_private_block_notes
    where instance_id=t.id and author_id=auth.uid() for update;
  if not found then
    if p_expected_revision<>0 or p_body is null then raise exception 'La revisión del comentario cambió'; end if;
    insert into public.task_private_block_notes(organization_id,instance_id,author_id,body,revision,created_at,updated_at)
      values(t.organization_id,t.id,auth.uid(),normalized_body,1,cleared_time,cleared_time) returning * into n;
    action_name:='private_block_note.created';
    insert into public.task_private_block_note_versions(note_id,organization_id,revision,body,cleared_at,at,actor_id)
      values(n.id,n.organization_id,n.revision,n.body,null,cleared_time,auth.uid());
  else
    if n.revision is distinct from p_expected_revision then raise exception 'La revisión del comentario cambió'; end if;
    normalized_body:=coalesce(normalized_body,'');
    if n.body=normalized_body and ((p_body is null)=(n.cleared_at is not null)) then
      result:=jsonb_build_object('note_id',n.id,'revision',n.revision,'cleared',n.cleared_at is not null);
      insert into public.private_block_note_receipts(organization_id,actor_id,operation_id,arguments,result)
        values(actor_org_id,auth.uid(),p_operation_id,args,result);
      return result;
    end if;
    if n.revision>=9007199254740991 then raise exception 'Se alcanzó el límite de revisiones'; end if;
    update public.task_private_block_notes set body=normalized_body,revision=n.revision+1,
      updated_at=cleared_time,cleared_at=case when p_body is null then cleared_time else null end
      where id=n.id returning * into n;
    action_name:=case when p_body is null then 'private_block_note.cleared' else 'private_block_note.updated' end;
    insert into public.task_private_block_note_versions(note_id,organization_id,revision,body,cleared_at,at,actor_id)
      values(n.id,n.organization_id,n.revision,n.body,n.cleared_at,cleared_time,auth.uid());
  end if;

  result:=jsonb_build_object('note_id',n.id,'revision',n.revision,'cleared',n.cleared_at is not null);
  insert into public.audit_events(organization_id,actor_id,action,entity_id,at,details)
    values(actor_org_id,auth.uid(),action_name,n.id,cleared_time,'{}'::jsonb);
  insert into public.private_block_note_receipts(organization_id,actor_id,operation_id,arguments,result)
    values(actor_org_id,auth.uid(),p_operation_id,args,result);
  return result;
end
$$;

revoke all on function public.can_read_private_block_note(uuid) from public,anon,authenticated;
grant execute on function public.can_read_private_block_note(uuid) to authenticated;
revoke all on function public.save_private_block_note(uuid,text,bigint,uuid) from public,anon,authenticated;
grant execute on function public.save_private_block_note(uuid,text,bigint,uuid) to authenticated;
commit;
