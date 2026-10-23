-- Add the first remote workspace page without changing the SQL014 query RPC.
-- All existing query kinds continue through the exact SQL014 function body.

create function app_private.api_workspace_page(p jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare
 actor uuid:=auth.uid(); org uuid; role_name text; ctx jsonb;
 f jsonb; kind text; subject uuid; explicit_subject boolean;
 period_v date; company_v uuid; team_v uuid; sector_v text;
 cursor_value text; cursor_json jsonb; cursor_due date; cursor_scheduled date; cursor_task uuid;
 lim integer; evaluated_at timestamptz; today date; has_more boolean:=false;
 task_row public.task_instances%rowtype; item jsonb; items jsonb:='[]'::jsonb;
 seconds_v numeric; movement_count bigint; quantity_v numeric; rated_v numeric; unrated_v numeric;
 fully_weighted boolean; weighted_v numeric; blocker_codes jsonb; ready_v boolean; hidden_deps boolean;
 out_cursor text; cursor_payload jsonb; subject_exists boolean;
begin
 if actor is null then raise exception using errcode='28000',message='Autenticación requerida'; end if;
 if octet_length(coalesce(p::text,''))>4096 or not app_private.api_exact_keys(p,array['contractVersion','kind','filters','cursor','limit'])
   or jsonb_typeof(p->'contractVersion') is distinct from 'number' or p->>'contractVersion' is distinct from '1'
   or p->>'kind' is distinct from 'workspacePage' then raise exception using errcode='22023',message='Consulta inválida'; end if;
 ctx:=app_private.api_require_business(false);
 org:=(ctx->'principal'->>'organizationId')::uuid; role_name:=ctx->'principal'->>'role';
 f:=p->'filters';
 if not app_private.api_exact_keys(f,array['subjectId','period','companyId','teamId','sector']) then raise exception using errcode='22023',message='Consulta inválida'; end if;
 explicit_subject:=jsonb_typeof(f->'subjectId')='string';
 if jsonb_typeof(f->'subjectId') not in ('string','null') then raise exception using errcode='22023',message='Consulta inválida'; end if;
 subject:=case when explicit_subject then app_private.api_uuid(f,'subjectId') else actor end;
 if jsonb_typeof(f->'period') is distinct from 'string' or (f->>'period') !~ '^[0-9]{4}-[0-9]{2}-01$' then raise exception using errcode='22023',message='Consulta inválida'; end if;
 period_v:=app_private.api_date(f,'period');
 if (jsonb_typeof(f->'companyId') not in ('string','null')) or (jsonb_typeof(f->'teamId') not in ('string','null')) or (jsonb_typeof(f->'sector') not in ('string','null')) then raise exception using errcode='22023',message='Consulta inválida'; end if;
 company_v:=case when f->>'companyId' is null then null else app_private.api_uuid(f,'companyId') end;
 team_v:=case when f->>'teamId' is null then null else app_private.api_uuid(f,'teamId') end;
 sector_v:=case when jsonb_typeof(f->'sector')='null' then null else nullif(trim(f->>'sector'),'') end;
 if jsonb_typeof(f->'sector')='string' and (sector_v is null or char_length(sector_v)>200) then raise exception using errcode='22023',message='Consulta inválida'; end if;
 if jsonb_typeof(p->'limit') is distinct from 'number' then raise exception using errcode='22023',message='Consulta inválida'; end if;
 lim:=app_private.api_integer(p,'limit',1,100);
 if jsonb_typeof(p->'cursor') not in ('string','null') then raise exception using errcode='22023',message='Consulta inválida'; end if;
 cursor_value:=p->>'cursor';
 if cursor_value is not null then
  if char_length(cursor_value)>2048 then raise exception using errcode='22023',message='Consulta inválida'; end if;
  begin
   cursor_json:=convert_from(decode(translate(cursor_value,'-_','+/')||repeat('=',(4-char_length(cursor_value)%4)%4),'base64'),'UTF8')::jsonb;
   if not app_private.api_exact_keys(cursor_json,array['kind','cursorVersion','subjectId','period','companyId','teamId','sector','orderVersion','dueDate','scheduledOn','taskId'])
    or cursor_json->>'kind' is distinct from 'workspacePage' or cursor_json->>'cursorVersion' is distinct from '1'
    or cursor_json->>'orderVersion' is distinct from '1' or cursor_json->>'subjectId' is distinct from subject::text
    or cursor_json->>'period' is distinct from period_v::text or cursor_json->>'companyId' is distinct from company_v::text
    or cursor_json->>'teamId' is distinct from team_v::text or cursor_json->>'sector' is distinct from sector_v then raise exception using errcode='22023',message='Cursor inválido'; end if;
   cursor_due:=case when jsonb_typeof(cursor_json->'dueDate')='null' then null else app_private.api_date(cursor_json,'dueDate') end;
   cursor_scheduled:=case when jsonb_typeof(cursor_json->'scheduledOn')='null' then null else app_private.api_date(cursor_json,'scheduledOn') end;
   cursor_task:=app_private.api_uuid(cursor_json,'taskId');
  exception when others then raise exception using errcode='22023',message='Consulta inválida'; end;
 end if;
 perform app_private.api_revalidate_actor(actor,ctx);
 select exists(select 1 from public.profiles pr where pr.id=subject and pr.organization_id=org and pr.active) into subject_exists;
 if not subject_exists or (subject<>actor and (role_name not in ('jefe','encargado') or not public.can_access_owner(subject))) then raise exception using errcode='42501',message='Consulta no disponible'; end if;
 -- Explicit filters are authorization requests and fail closed when revoked.
 if company_v is not null and not exists(select 1 from public.companies c where c.id=company_v and c.organization_id=org
   and (role_name='jefe' or exists(select 1 from public.company_memberships cm where cm.company_id=c.id and cm.organization_id=org and cm.profile_id=actor and cm.active))) then raise exception using errcode='42501',message='Consulta no disponible'; end if;
 if team_v is not null and not exists(select 1 from public.teams tm where tm.id=team_v and tm.organization_id=org
   and (role_name='jefe'
     or (subject=actor and exists(select 1 from public.team_members m where m.team_id=tm.id and m.organization_id=org and m.profile_id=actor))
     or (role_name='encargado' and subject<>actor and tm.manager_id=actor
       and exists(select 1 from public.team_members m where m.team_id=tm.id and m.organization_id=org and m.profile_id=subject)
       and exists(select 1 from public.profiles pr where pr.id=subject and pr.organization_id=org and pr.active and pr.manager_id=actor)))) then raise exception using errcode='42501',message='Consulta no disponible'; end if;
 evaluated_at:=clock_timestamp(); today:=(evaluated_at at time zone 'America/Argentina/Buenos_Aires')::date;
 for task_row in
  select t.* from public.task_instances t
  where t.organization_id=org and t.period=period_v
   and (company_v is null or t.company_id=company_v) and (team_v is null or t.team_id=team_v)
   and (sector_v is null or exists(select 1 from public.task_responsibility_heads h join public.task_responsibility_sets s on s.id=h.set_id and s.organization_id=h.organization_id where h.instance_id=t.id and coalesce(s.sector_snapshot,'')=sector_v))
   and public.can_access_instance(t.id)
   and (subject=actor or (role_name='jefe' or (role_name='encargado' and exists(select 1 from public.teams managed where managed.id=t.team_id and managed.organization_id=org and managed.manager_id=actor)
     and exists(select 1 from public.team_members tm where tm.team_id=t.team_id and tm.organization_id=org and tm.profile_id=subject)
     and exists(select 1 from public.profiles pr where pr.id=subject and pr.organization_id=org and pr.active and pr.manager_id=actor))))
   and (t.owner_id=subject
     or exists(select 1 from public.task_responsibility_heads h join public.task_responsibility_members m on m.set_id=h.set_id and m.organization_id=h.organization_id where h.instance_id=t.id and m.profile_id=subject)
     or exists(select 1 from public.task_coverage_bindings b where b.instance_id=t.id and b.organization_id=org and b.replacement_id=subject and b.responsible_id=t.owner_id and b.status='active' and b.period_snapshot=t.period and b.company_id_snapshot=t.company_id and t.scheduled_on between b.starts_on and b.ends_on)
     or exists(select 1 from public.activity_entries e where e.instance_id=t.id and e.actor_id=subject)
     or exists(select 1 from public.task_time_sessions s where s.instance_id=t.id and s.actor_id=subject))
   and (cursor_value is null or (coalesce(t.due_date,'9999-12-31'::date),coalesce(t.scheduled_on,'9999-12-31'::date),t.id)>(coalesce(cursor_due,'9999-12-31'::date),coalesce(cursor_scheduled,'9999-12-31'::date),cursor_task))
  order by t.due_date asc nulls last,t.scheduled_on asc nulls last,t.id asc limit lim+1
 loop
  if jsonb_array_length(items)>=lim then has_more:=true; exit; end if;
  select coalesce(sum(greatest(0,extract(epoch from (least(coalesce(s.ended_at,evaluated_at),evaluated_at,public._effective_session_end(s.id,evaluated_at),coalesce(public._session_cutoff(s.id),evaluated_at))-s.started_at)))),0)
   into seconds_v from public.task_time_sessions s where s.instance_id=task_row.id and s.actor_id=subject;
  seconds_v:=round(seconds_v);
  select count(*),coalesce(sum(e.quantity),0),coalesce(sum(e.quantity*e.operational_unit_weight) filter(where e.operational_unit_weight is not null),0),coalesce(sum(e.quantity) filter(where e.operational_unit_weight is null),0),bool_and(e.operational_unit_weight is not null)
   into movement_count,quantity_v,rated_v,unrated_v,fully_weighted from public.activity_entries e where e.instance_id=task_row.id and e.actor_id=subject;
  fully_weighted:=coalesce(fully_weighted,true) and (movement_count=0 or unrated_v=0);
  weighted_v:=case when fully_weighted then rated_v else null end;
  select coalesce(jsonb_agg(code order by code),'[]'::jsonb) into blocker_codes from (
    select 'external_wait'::text code where task_row.blocked_by is not null
    union select 'available_later' where exists(select 1 from app_private.task_tracking tr where tr.instance_id=task_row.id and tr.available_from>today)
    union select 'dependencies_pending' where exists(select 1 from app_private.task_dependencies d join public.task_instances dep on dep.id=d.prerequisite_id and dep.organization_id=d.organization_id where d.instance_id=task_row.id and dep.status<>'Completada')
  ) codes;
  ready_v:=jsonb_array_length(blocker_codes)=0;
  select exists(select 1 from app_private.task_dependencies d where d.instance_id=task_row.id and not exists(
    select 1 from public.task_instances dep where dep.id=d.prerequisite_id and public.can_access_instance(dep.id)
     and (subject=actor or role_name='jefe' or exists(select 1 from public.teams mt where mt.id=dep.team_id and mt.organization_id=org and mt.manager_id=actor)
       and exists(select 1 from public.team_members mm where mm.team_id=dep.team_id and mm.organization_id=org and mm.profile_id=subject)
       and exists(select 1 from public.profiles sp where sp.id=subject and sp.organization_id=org and sp.active and sp.manager_id=actor)))) into hidden_deps;
  item:=jsonb_build_object('taskId',task_row.id,'taskRevision',task_row.state_revision::text,'ownerId',task_row.owner_id,
   'ownerDisplayName',(select left(pr.name,200) from public.profiles pr where pr.id=task_row.owner_id),
   'teamId',task_row.team_id,'teamName',(select left(tm.name,200) from public.teams tm where tm.id=task_row.team_id),
   'companyId',task_row.company_id,'companyName',(select left(co.name,200) from public.companies co where co.id=task_row.company_id),
   'period',task_row.period,'scheduledOn',task_row.scheduled_on,'title',task_row.title,'kind',task_row.kind,'measurementVersion',task_row.measurement_version,
   'status',task_row.status,'dueDate',task_row.due_date,'priority',task_row.priority,
   'weight',case when task_row.kind='resultado' or task_row.measurement_version=1 then task_row.weight::text else null end,
   'target',case when task_row.kind='operativa' and task_row.measurement_version=1 then task_row.target else null end,
   'unit',case when task_row.kind='operativa' then task_row.unit else null end,
   'checklist',case when task_row.kind='operativa' and task_row.measurement_version=2 then '[]'::jsonb else coalesce((select jsonb_agg(jsonb_build_object(
      'id',case when jsonb_typeof(c.value)='object' and c.value->>'id' ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then c.value->>'id' else
        substr(md5(task_row.id::text||':'||c.ordinality::text),1,8)||'-'||substr(md5(task_row.id::text||':'||c.ordinality::text),9,4)||'-'||substr(md5(task_row.id::text||':'||c.ordinality::text),13,4)||'-'||substr(md5(task_row.id::text||':'||c.ordinality::text),17,4)||'-'||substr(md5(task_row.id::text||':'||c.ordinality::text),21,12) end,
      'text',case when jsonb_typeof(c.value)='string' then c.value#>>'{}' else c.value->>'text' end,
      'done',case when jsonb_typeof(c.value)='object' then coalesce((c.value->>'done')::boolean,false) else false end) order by c.ordinality) from jsonb_array_elements(task_row.checklist) with ordinality c(value,ordinality)),'[]'::jsonb) end,
   'ready',ready_v,'blockerCodes',blocker_codes,'hasHiddenDependencies',hidden_deps,
   'subjectWork',case when task_row.kind='resultado' then jsonb_build_object('recordedSeconds',seconds_v::bigint::text)
    else jsonb_build_object('recordedSeconds',seconds_v::bigint::text,'movementCount',movement_count::text,'quantity',quantity_v::text,'unit',task_row.unit,
     'ratedLoad',rated_v::text,'weightedLoad',case when weighted_v is null then null else weighted_v::text end,'unratedQuantity',unrated_v::text) end);
  items:=items||jsonb_build_array(item);
 end loop;
 out_cursor:=null;
 if has_more and jsonb_array_length(items)>0 then
  item:=items->(jsonb_array_length(items)-1);
  cursor_payload:=jsonb_build_object('kind','workspacePage','cursorVersion',1,'subjectId',subject,'period',period_v,'companyId',company_v,'teamId',team_v,'sector',sector_v,'orderVersion',1,
   'dueDate',item->'dueDate','scheduledOn',item->'scheduledOn','taskId',item->'taskId');
  out_cursor:=rtrim(translate(encode(convert_to(cursor_payload::text,'UTF8'),'base64'),'+/','-_'),'=');
 end if;
 return jsonb_build_object('contractVersion',1,'kind','workspacePage','data',jsonb_build_object('evaluatedAt',evaluated_at,'items',items,'nextCursor',out_cursor));
end $$;

alter function api.query_v1(jsonb) rename to query_v1_workspace_base;
revoke all on function api.query_v1_workspace_base(jsonb) from public,anon,authenticated,service_role;
create function api.query_v1(p jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
begin
 if jsonb_typeof(p->'kind')='string' and p->>'kind'='workspacePage' then return app_private.api_workspace_page(p); end if;
 return api.query_v1_workspace_base(p);
end $$;
revoke all on function app_private.api_workspace_page(jsonb) from public,anon,authenticated,service_role;
revoke all on function api.query_v1_workspace_base(jsonb),api.query_v1(jsonb) from public,anon,authenticated,service_role;
grant execute on function api.query_v1(jsonb) to authenticated;
