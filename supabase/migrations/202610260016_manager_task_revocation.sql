-- Close the legacy manager read path after company membership revocation.
-- Preserve the existing public signature, schemaVersion 3 DTO and ACL.
create or replace function public.read_coordinated_task_for_manager(p_instance uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare
 actor_id uuid := auth.uid();
 actor_org_id uuid := public.actor_org();
 role_name text := public.actor_role();
 captured_clock_timestamp timestamptz := clock_timestamp();
 task_row public.task_instances%rowtype;
begin
 if actor_id is null or actor_org_id is null or role_name is null or role_name not in ('jefe','encargado') then
  raise exception using errcode='42501',message='Sin permiso';
 end if;

 select * into task_row
  from public.task_instances t
  where t.id=p_instance and t.organization_id=actor_org_id;
 if not found
    or not public.can_access_owner(task_row.owner_id)
    or not public._can_access_instance_at(task_row.id,captured_clock_timestamp) then
  raise exception using errcode='42501',message='Fuera del ámbito';
 end if;

 return public._coordinated_task_payload(task_row.id);
end $$;
