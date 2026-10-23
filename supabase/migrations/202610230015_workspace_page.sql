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
   if cursor_value='' or cursor_value !~ '^[A-Za-z0-9_-]+$' or char_length(cursor_value)%4=1 then
    raise exception using errcode='22023',message='Cursor inválido';
   end if;
   cursor_json:=convert_from(decode(translate(cursor_value,'-_','+/')||repeat('=',(4-char_length(cursor_value)%4)%4),'base64'),'UTF8')::jsonb;
   -- PostgreSQL's base64 encoder may wrap lines at 76 characters. Cursors are
   -- canonical, unpadded base64url so the exact returned token is reusable.
   if rtrim(translate(regexp_replace(encode(convert_to(cursor_json::text,'UTF8'),'base64'),E'[\\r\\n]','','g'),'+/','-_'),'=') is distinct from cursor_value then
    raise exception using errcode='22023',message='Cursor inválido';
   end if;
   if not app_private.api_exact_keys(cursor_json,array['kind','cursorVersion','subjectId','period','companyId','teamId','sector','orderVersion','dueDate','scheduledOn','taskId'])
    or jsonb_typeof(cursor_json->'kind') is distinct from 'string' or cursor_json->>'kind' is distinct from 'workspacePage'
    or jsonb_typeof(cursor_json->'cursorVersion') is distinct from 'number' or cursor_json->'cursorVersion' is distinct from '1'::jsonb
    or jsonb_typeof(cursor_json->'orderVersion') is distinct from 'number' or cursor_json->'orderVersion' is distinct from '1'::jsonb
    or jsonb_typeof(cursor_json->'subjectId') is distinct from 'string' or cursor_json->>'subjectId' is distinct from subject::text
    or jsonb_typeof(cursor_json->'period') is distinct from 'string'
    or (jsonb_typeof(cursor_json->'companyId') not in ('string','null'))
    or (jsonb_typeof(cursor_json->'teamId') not in ('string','null'))
    or (jsonb_typeof(cursor_json->'sector') not in ('string','null'))
    or cursor_json->>'period' is distinct from period_v::text or cursor_json->>'companyId' is distinct from company_v::text
    or cursor_json->>'teamId' is distinct from team_v::text or cursor_json->>'sector' is distinct from sector_v then raise exception using errcode='22023',message='Cursor inválido'; end if;
   if (jsonb_typeof(cursor_json->'dueDate') not in ('string','null'))
      or (jsonb_typeof(cursor_json->'scheduledOn') not in ('string','null'))
      or jsonb_typeof(cursor_json->'taskId') is distinct from 'string' then
    raise exception using errcode='22023',message='Cursor inválido';
   end if;
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
     or (subject=actor and (exists(select 1 from public.team_members m where m.team_id=tm.id and m.organization_id=org and m.profile_id=actor)
       or (role_name='encargado' and tm.manager_id=actor)))
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
     or exists(select 1 from public.task_coverage_bindings b where b.instance_id=t.id and b.organization_id=org and b.replacement_id=subject and b.responsible_id=t.owner_id and b.status='active' and b.period_snapshot=t.period and b.company_id_snapshot=t.company_id and today between b.starts_on and b.ends_on)
     or exists(select 1 from public.employee_absences x join public.employee_absence_companies xc on xc.absence_id=x.id and xc.organization_id=x.organization_id and xc.company_id=t.company_id
       where x.organization_id=org and x.owner_id=t.owner_id and x.replacement_id=subject and x.cancelled_at is null and x.authorization_sealed
        and public._legacy_coverage_scope_allowed(t.owner_id,subject,evaluated_at)
        and x.starts_on<=x.ends_on and today between x.starts_on and x.ends_on
        and t.period between date_trunc('month',x.starts_on)::date and date_trunc('month',x.ends_on)::date)
     or exists(select 1 from public.activity_entries e where e.instance_id=t.id and e.actor_id=subject)
     or exists(select 1 from public.task_time_sessions s where s.instance_id=t.id and s.actor_id=subject))
   -- Explicit null ranks are part of the stable order. A date sentinel alone
   -- collides with a real 9999-12-31 value and can skip or reorder valid rows.
   and (cursor_value is null or
     ((t.due_date is null),coalesce(t.due_date,'0001-01-01'::date),
      (t.scheduled_on is null),coalesce(t.scheduled_on,'0001-01-01'::date),t.id)>
     ((cursor_due is null),coalesce(cursor_due,'0001-01-01'::date),
      (cursor_scheduled is null),coalesce(cursor_scheduled,'0001-01-01'::date),cursor_task))
  order by (t.due_date is null) asc,t.due_date asc nulls last,
           (t.scheduled_on is null) asc,t.scheduled_on asc nulls last,t.id asc limit lim+1
 loop
  if jsonb_array_length(items)>=lim then has_more:=true; exit; end if;
  -- The compact DTO keeps every historical checklist control. Reject legacy
  -- values that cannot be represented instead of truncating or dropping them.
  if (task_row.kind='resultado' or task_row.measurement_version=1) and (
    jsonb_array_length(task_row.checklist)>100
    or exists(select 1 from jsonb_array_elements(task_row.checklist) c(value)
      where jsonb_typeof(c.value) not in ('string','object')
        or jsonb_typeof(case when jsonb_typeof(c.value)='string' then c.value else c.value->'text' end) is distinct from 'string'
        or char_length(case when jsonb_typeof(c.value)='string' then c.value#>>'{}' else c.value->>'text' end) not between 1 and 1000
        or (jsonb_typeof(c.value)='object' and c.value ? 'done' and jsonb_typeof(c.value->'done') is distinct from 'boolean'))
   ) then raise exception using errcode='22023',message='Control histórico fuera de formato; requiere revisión antes de mostrarlo'; end if;
  if task_row.kind='operativa' and (task_row.unit is null or char_length(task_row.unit) not between 1 and 80) then
   raise exception using errcode='22023',message='Unidad histórica fuera de formato; requiere revisión antes de mostrarla';
  end if;
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
   'ownerDisplayName',(select coalesce(left(nullif(btrim(pr.name),''),200),'[Sin nombre · '||left(pr.id::text,8)||']') from public.profiles pr where pr.id=task_row.owner_id),
   'teamId',task_row.team_id,'teamName',(select coalesce(left(nullif(btrim(tm.name),''),200),'[Sin nombre · '||left(tm.id::text,8)||']') from public.teams tm where tm.id=task_row.team_id),
   'companyId',task_row.company_id,'companyName',(select coalesce(left(nullif(btrim(co.name),''),200),'[Sin nombre · '||left(co.id::text,8)||']') from public.companies co where co.id=task_row.company_id),
   'period',task_row.period,'scheduledOn',task_row.scheduled_on,'title',left(task_row.title,200),'kind',task_row.kind,'measurementVersion',task_row.measurement_version,
   'status',task_row.status,'dueDate',task_row.due_date,'priority',task_row.priority,
   'weight',case when task_row.kind='resultado' or task_row.measurement_version=1 then task_row.weight::text else null end,
   'target',case when task_row.kind='operativa' and task_row.measurement_version=1 then task_row.target else null end,
   'unit',case when task_row.kind='operativa' then task_row.unit else null end,
   'checklist',case when task_row.kind='operativa' and task_row.measurement_version=2 then '[]'::jsonb else coalesce((select jsonb_agg(jsonb_build_object(
      'id',case when jsonb_typeof(c.value)='object' and c.value->>'id' ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then c.value->>'id' else
        substr(md5(task_row.id::text||':'||c.ordinality::text),1,8)||'-'||substr(md5(task_row.id::text||':'||c.ordinality::text),9,4)||'-'||substr(md5(task_row.id::text||':'||c.ordinality::text),13,4)||'-'||substr(md5(task_row.id::text||':'||c.ordinality::text),17,4)||'-'||substr(md5(task_row.id::text||':'||c.ordinality::text),21,12) end,
      'text',case when jsonb_typeof(c.value)='string' then c.value#>>'{}' else c.value->>'text' end,
      'done',case when jsonb_typeof(c.value)='object' and jsonb_typeof(c.value->'done')='boolean' then (c.value->>'done')::boolean else false end) order by c.ordinality) from jsonb_array_elements(task_row.checklist) with ordinality c(value,ordinality)),'[]'::jsonb) end,
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
  out_cursor:=rtrim(translate(regexp_replace(encode(convert_to(cursor_payload::text,'UTF8'),'base64'),E'[\\r\\n]','','g'),'+/','-_'),'=');
 end if;
 return jsonb_build_object('contractVersion',1,'kind','workspacePage','data',jsonb_build_object('evaluatedAt',evaluated_at,'items',items,'nextCursor',out_cursor));
end $$;


-- V2 is an additive read DTO. V1 above remains byte-for-byte unchanged.
create function app_private.api_workspace_page_v2(p jsonb) returns jsonb
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
 checklist_count integer; checklist_state text; checklist_bad boolean; checklist_long boolean;
begin
 if actor is null then raise exception using errcode='28000',message='Autenticación requerida'; end if;
 if octet_length(coalesce(p::text,''))>4096 or not app_private.api_exact_keys(p,array['contractVersion','kind','filters','cursor','limit'])
   or jsonb_typeof(p->'contractVersion') is distinct from 'number' or p->>'contractVersion' is distinct from '1'
   or p->>'kind' is distinct from 'workspacePageV2' then raise exception using errcode='22023',message='Consulta inválida'; end if;
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
   if cursor_value='' or cursor_value !~ '^[A-Za-z0-9_-]+$' or char_length(cursor_value)%4=1 then
    raise exception using errcode='22023',message='Cursor inválido';
   end if;
   cursor_json:=convert_from(decode(translate(cursor_value,'-_','+/')||repeat('=',(4-char_length(cursor_value)%4)%4),'base64'),'UTF8')::jsonb;
   -- PostgreSQL's base64 encoder may wrap lines at 76 characters. Cursors are
   -- canonical, unpadded base64url so the exact returned token is reusable.
   if rtrim(translate(regexp_replace(encode(convert_to(cursor_json::text,'UTF8'),'base64'),E'[\\r\\n]','','g'),'+/','-_'),'=') is distinct from cursor_value then
    raise exception using errcode='22023',message='Cursor inválido';
   end if;
   if not app_private.api_exact_keys(cursor_json,array['kind','cursorVersion','subjectId','period','companyId','teamId','sector','orderVersion','dueDate','scheduledOn','taskId'])
    or jsonb_typeof(cursor_json->'kind') is distinct from 'string' or cursor_json->>'kind' is distinct from 'workspacePageV2'
    or jsonb_typeof(cursor_json->'cursorVersion') is distinct from 'number' or cursor_json->'cursorVersion' is distinct from '1'::jsonb
    or jsonb_typeof(cursor_json->'orderVersion') is distinct from 'number' or cursor_json->'orderVersion' is distinct from '1'::jsonb
    or jsonb_typeof(cursor_json->'subjectId') is distinct from 'string' or cursor_json->>'subjectId' is distinct from subject::text
    or jsonb_typeof(cursor_json->'period') is distinct from 'string'
    or (jsonb_typeof(cursor_json->'companyId') not in ('string','null'))
    or (jsonb_typeof(cursor_json->'teamId') not in ('string','null'))
    or (jsonb_typeof(cursor_json->'sector') not in ('string','null'))
    or cursor_json->>'period' is distinct from period_v::text or cursor_json->>'companyId' is distinct from company_v::text
    or cursor_json->>'teamId' is distinct from team_v::text or cursor_json->>'sector' is distinct from sector_v then raise exception using errcode='22023',message='Cursor inválido'; end if;
   if (jsonb_typeof(cursor_json->'dueDate') not in ('string','null'))
      or (jsonb_typeof(cursor_json->'scheduledOn') not in ('string','null'))
      or jsonb_typeof(cursor_json->'taskId') is distinct from 'string' then
    raise exception using errcode='22023',message='Cursor inválido';
   end if;
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
     or (subject=actor and (exists(select 1 from public.team_members m where m.team_id=tm.id and m.organization_id=org and m.profile_id=actor)
       or (role_name='encargado' and tm.manager_id=actor)))
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
     or exists(select 1 from public.task_coverage_bindings b where b.instance_id=t.id and b.organization_id=org and b.replacement_id=subject and b.responsible_id=t.owner_id and b.status='active' and b.period_snapshot=t.period and b.company_id_snapshot=t.company_id and today between b.starts_on and b.ends_on)
     or exists(select 1 from public.employee_absences x join public.employee_absence_companies xc on xc.absence_id=x.id and xc.organization_id=x.organization_id and xc.company_id=t.company_id
       where x.organization_id=org and x.owner_id=t.owner_id and x.replacement_id=subject and x.cancelled_at is null and x.authorization_sealed
        and public._legacy_coverage_scope_allowed(t.owner_id,subject,evaluated_at)
        and x.starts_on<=x.ends_on and today between x.starts_on and x.ends_on
        and t.period between date_trunc('month',x.starts_on)::date and date_trunc('month',x.ends_on)::date)
     or exists(select 1 from public.activity_entries e where e.instance_id=t.id and e.actor_id=subject)
     or exists(select 1 from public.task_time_sessions s where s.instance_id=t.id and s.actor_id=subject))
   -- Explicit null ranks are part of the stable order. A date sentinel alone
   -- collides with a real 9999-12-31 value and can skip or reorder valid rows.
   and (cursor_value is null or
     ((t.due_date is null),coalesce(t.due_date,'0001-01-01'::date),
      (t.scheduled_on is null),coalesce(t.scheduled_on,'0001-01-01'::date),t.id)>
     ((cursor_due is null),coalesce(cursor_due,'0001-01-01'::date),
      (cursor_scheduled is null),coalesce(cursor_scheduled,'0001-01-01'::date),cursor_task))
  order by (t.due_date is null) asc,t.due_date asc nulls last,
           (t.scheduled_on is null) asc,t.scheduled_on asc nulls last,t.id asc limit lim+1
 loop
  if jsonb_array_length(items)>=lim then has_more:=true; exit; end if;
  if jsonb_typeof(task_row.checklist) is distinct from 'array' then
   raise exception using errcode='XX000',message='Invariante de checklist inválida';
  end if;
  checklist_count:=jsonb_array_length(task_row.checklist);
  checklist_state:='inline';
  if task_row.kind='operativa' and task_row.measurement_version=2 then
   if checklist_count<>0 then raise exception using errcode='XX000',message='Invariante de checklist operativa inválida'; end if;
  elsif checklist_count>100 then
   checklist_state:='paged';
  else
   select exists(select 1 from jsonb_array_elements(task_row.checklist) c(value) where
     jsonb_typeof(c.value) not in ('string','object')
     or (jsonb_typeof(c.value)='object' and not (c.value ? 'text'))
     or (jsonb_typeof(c.value)='object' and c.value ? 'text' and jsonb_typeof(c.value->'text') is distinct from 'string')
     or (jsonb_typeof(c.value)='string' and char_length(c.value#>>'{}')=0)
     or (jsonb_typeof(c.value)='object' and jsonb_typeof(c.value->'text')='string' and char_length(c.value->>'text')=0)
     or (jsonb_typeof(c.value)='object' and c.value ? 'done' and jsonb_typeof(c.value->'done') is distinct from 'boolean'))
     into checklist_bad;
   select exists(select 1 from jsonb_array_elements(task_row.checklist) c(value) where
     (jsonb_typeof(c.value)='string' and char_length(c.value#>>'{}')>1000)
     or (jsonb_typeof(c.value)='object' and jsonb_typeof(c.value->'text')='string' and char_length(c.value->>'text')>1000))
     into checklist_long;
   if checklist_bad then checklist_state:='requires_review';
   elsif checklist_long then checklist_state:='paged'; end if;
  end if;
  if task_row.kind='operativa' and (task_row.unit is null or char_length(task_row.unit) not between 1 and 80) then
   raise exception using errcode='22023',message='Unidad histórica fuera de formato; requiere revisión antes de mostrarla';
  end if;
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
   'ownerDisplayName',(select coalesce(left(nullif(btrim(pr.name),''),200),'[Sin nombre · '||left(pr.id::text,8)||']') from public.profiles pr where pr.id=task_row.owner_id),
   'teamId',task_row.team_id,'teamName',(select coalesce(left(nullif(btrim(tm.name),''),200),'[Sin nombre · '||left(tm.id::text,8)||']') from public.teams tm where tm.id=task_row.team_id),
   'companyId',task_row.company_id,'companyName',(select coalesce(left(nullif(btrim(co.name),''),200),'[Sin nombre · '||left(co.id::text,8)||']') from public.companies co where co.id=task_row.company_id),
   'period',task_row.period,'scheduledOn',task_row.scheduled_on,'title',left(task_row.title,200),'kind',task_row.kind,'measurementVersion',task_row.measurement_version,
   'status',task_row.status,'dueDate',task_row.due_date,'priority',task_row.priority,
   'weight',case when task_row.kind='resultado' or task_row.measurement_version=1 then task_row.weight::text else null end,
   'target',case when task_row.kind='operativa' and task_row.measurement_version=1 then task_row.target else null end,
   'unit',case when task_row.kind='operativa' then task_row.unit else null end,
   'checklistState',checklist_state,'checklistControlCount',checklist_count,
   'checklist',case when checklist_state<>'inline' then '[]'::jsonb else coalesce((select jsonb_agg(jsonb_build_object(
      'id',case when jsonb_typeof(c.value)='object' and jsonb_typeof(c.value->'id')='string' and c.value->>'id' ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then c.value->>'id' else
        substr(md5(task_row.id::text||':'||c.ordinality::text),1,8)||'-'||substr(md5(task_row.id::text||':'||c.ordinality::text),9,4)||'-'||substr(md5(task_row.id::text||':'||c.ordinality::text),13,4)||'-'||substr(md5(task_row.id::text||':'||c.ordinality::text),17,4)||'-'||substr(md5(task_row.id::text||':'||c.ordinality::text),21,12) end,
      'text',case when jsonb_typeof(c.value)='string' then c.value#>>'{}' else c.value->>'text' end,
      'done',case when jsonb_typeof(c.value)='string' then false when jsonb_typeof(c.value->'done')='boolean' then (c.value->>'done')::boolean else false end) order by c.ordinality) from jsonb_array_elements(task_row.checklist) with ordinality c(value,ordinality)),'[]'::jsonb) end,
   'ready',ready_v,'blockerCodes',blocker_codes,'hasHiddenDependencies',hidden_deps,
   'subjectWork',case when task_row.kind='resultado' then jsonb_build_object('recordedSeconds',seconds_v::bigint::text)
    else jsonb_build_object('recordedSeconds',seconds_v::bigint::text,'movementCount',movement_count::text,'quantity',quantity_v::text,'unit',task_row.unit,
     'ratedLoad',rated_v::text,'weightedLoad',case when weighted_v is null then null else weighted_v::text end,'unratedQuantity',unrated_v::text) end);
  items:=items||jsonb_build_array(item);
 end loop;
 out_cursor:=null;
 if has_more and jsonb_array_length(items)>0 then
  item:=items->(jsonb_array_length(items)-1);
  cursor_payload:=jsonb_build_object('kind','workspacePageV2','cursorVersion',1,'subjectId',subject,'period',period_v,'companyId',company_v,'teamId',team_v,'sector',sector_v,'orderVersion',1,
   'dueDate',item->'dueDate','scheduledOn',item->'scheduledOn','taskId',item->'taskId');
  out_cursor:=rtrim(translate(regexp_replace(encode(convert_to(cursor_payload::text,'UTF8'),'base64'),E'[\\r\\n]','','g'),'+/','-_'),'=');
 end if;
 return jsonb_build_object('contractVersion',1,'kind','workspacePageV2','data',jsonb_build_object('evaluatedAt',evaluated_at,'items',items,'nextCursor',out_cursor));
end $$;

create function app_private.api_task_checklist_page(p jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare
 actor uuid:=auth.uid(); org uuid; role_name text; ctx jsonb; f jsonb;
 task_id uuid; subject uuid; task_revision bigint; requested_revision text;
 cursor_value text; cursor_json jsonb; ordinal_v integer:=1; offset_v integer:=0;
 total_controls integer; lim integer; task_row public.task_instances%rowtype;
 evaluated_at timestamptz:=clock_timestamp(); control jsonb; control_type text;
 control_text text; text_length integer; text_part text; text_offset integer;
 control_id text; done_v boolean; issue_code text; recognized_text boolean;
 segment jsonb; items jsonb:='[]'::jsonb; next_cursor text; next_payload jsonb;
 response_v jsonb; current_ordinal integer; current_offset integer;
 item_count integer; subject_exists boolean; b64 text; prepared_ordinal integer:=0;
begin
 if actor is null then raise exception using errcode='28000',message='Autenticación requerida'; end if;
 if octet_length(coalesce(p::text,''))>4096 or not app_private.api_exact_keys(p,array['contractVersion','kind','filters','cursor','limit'])
  or jsonb_typeof(p->'contractVersion') is distinct from 'number' or p->>'contractVersion' is distinct from '1'
  or p->>'kind' is distinct from 'taskChecklistPage' then
  raise exception using errcode='22023',message='Consulta inválida';
 end if;
 f:=p->'filters';
 if not app_private.api_exact_keys(f,array['taskId','subjectId','taskRevision'])
  or jsonb_typeof(f->'taskId') is distinct from 'string'
  or (f->>'taskId') !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  or jsonb_typeof(f->'subjectId') not in ('string','null')
  or (jsonb_typeof(f->'subjectId')='string' and (f->>'subjectId') !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$')
  or jsonb_typeof(f->'taskRevision') is distinct from 'string'
  or (f->>'taskRevision') !~ '^(0|[1-9][0-9]*)$'
  or (f->>'taskRevision')::numeric>9223372036854775807 then
  raise exception using errcode='22023',message='Consulta inválida';
 end if;
 task_id:=(f->>'taskId')::uuid;
 requested_revision:=f->>'taskRevision'; task_revision:=requested_revision::bigint;
 subject:=case when jsonb_typeof(f->'subjectId')='string' then (f->>'subjectId')::uuid else actor end;
 if jsonb_typeof(p->'limit') is distinct from 'number' then raise exception using errcode='22023',message='Consulta inválida'; end if;
 lim:=app_private.api_integer(p,'limit',1,16);
 if jsonb_typeof(p->'cursor') not in ('string','null') then raise exception using errcode='22023',message='Consulta inválida'; end if;
 cursor_value:=p->>'cursor';
 if cursor_value is not null then
  if char_length(cursor_value)>2048 or cursor_value='' or cursor_value !~ '^[A-Za-z0-9_-]+$' or char_length(cursor_value)%4=1 then
   raise exception using errcode='22023',message='Consulta inválida';
  end if;
  begin
   cursor_json:=convert_from(decode(translate(cursor_value,'-_','+/')||repeat('=',(4-char_length(cursor_value)%4)%4),'base64'),'UTF8')::jsonb;
   b64:=rtrim(translate(regexp_replace(encode(convert_to(cursor_json::text,'UTF8'),'base64'),E'[\r\n]','','g'),'+/','-_'),'=');
   if b64 is distinct from cursor_value
    or not app_private.api_exact_keys(cursor_json,array['kind','cursorVersion','taskId','subjectId','taskRevision','ordinal','textOffset'])
    or cursor_json->>'kind' is distinct from 'taskChecklistPage'
    or jsonb_typeof(cursor_json->'cursorVersion') is distinct from 'number' or cursor_json->'cursorVersion' is distinct from '1'::jsonb
    or cursor_json->>'taskId' is distinct from task_id::text
    or cursor_json->>'subjectId' is distinct from subject::text
    or cursor_json->>'taskRevision' is distinct from requested_revision
    or jsonb_typeof(cursor_json->'ordinal') is distinct from 'number'
    or (cursor_json->>'ordinal') !~ '^(0|[1-9][0-9]*)$'
    or jsonb_typeof(cursor_json->'textOffset') is distinct from 'number'
    or (cursor_json->>'textOffset') !~ '^(0|[1-9][0-9]*)$'
    or (cursor_json->>'ordinal')::numeric>2147483647 or (cursor_json->>'textOffset')::numeric>2147483647 then
    raise exception using errcode='22023',message='Consulta inválida';
   end if;
   ordinal_v:=(cursor_json->>'ordinal')::integer;
   offset_v:=(cursor_json->>'textOffset')::integer;
  exception when others then raise exception using errcode='22023',message='Consulta inválida'; end;
 end if;

 ctx:=app_private.api_require_business(false);
 org:=(ctx->'principal'->>'organizationId')::uuid; role_name:=ctx->'principal'->>'role';
 perform app_private.api_revalidate_actor(actor,ctx);
 -- Authorization and row snapshot are evaluated in this single SELECT. No
 -- revision, checklist size, or cursor is disclosed before the access check.
 select t.* into task_row from public.task_instances t
  join public.profiles sp on sp.id=subject and sp.organization_id=org and sp.active
  where t.id=task_id and t.organization_id=org and public.can_access_instance(t.id)
   and (subject=actor or (role_name in ('jefe','encargado') and public.can_access_owner(subject)
    and (role_name='jefe' or (role_name='encargado'
      and exists(select 1 from public.teams mt where mt.id=t.team_id and mt.organization_id=org and mt.manager_id=actor)
      and exists(select 1 from public.team_members tm where tm.team_id=t.team_id and tm.organization_id=org and tm.profile_id=subject)
      and sp.manager_id=actor))))
   and (t.owner_id=subject
    or exists(select 1 from public.task_responsibility_heads h join public.task_responsibility_members m on m.set_id=h.set_id and m.organization_id=h.organization_id where h.instance_id=t.id and m.profile_id=subject)
    or exists(select 1 from public.task_coverage_bindings b where b.instance_id=t.id and b.organization_id=org and b.replacement_id=subject and b.responsible_id=t.owner_id and b.status='active' and b.period_snapshot=t.period and b.company_id_snapshot=t.company_id and (clock_timestamp() at time zone 'America/Argentina/Buenos_Aires')::date between b.starts_on and b.ends_on)
    or exists(select 1 from public.employee_absences x join public.employee_absence_companies xc on xc.absence_id=x.id and xc.organization_id=x.organization_id and xc.company_id=t.company_id where x.organization_id=org and x.owner_id=t.owner_id and x.replacement_id=subject and x.cancelled_at is null and x.authorization_sealed and public._legacy_coverage_scope_allowed(t.owner_id,subject,clock_timestamp()) and t.period between date_trunc('month',x.starts_on)::date and date_trunc('month',x.ends_on)::date and (clock_timestamp() at time zone 'America/Argentina/Buenos_Aires')::date between x.starts_on and x.ends_on)
    or exists(select 1 from public.activity_entries e where e.instance_id=t.id and e.actor_id=subject)
    or exists(select 1 from public.task_time_sessions s where s.instance_id=t.id and s.actor_id=subject));
 if not found then raise exception using errcode='42501',message='Consulta no disponible'; end if;
 if task_row.state_revision<>task_revision then raise exception using errcode='40001',message='task_changed'; end if;
 if jsonb_typeof(task_row.checklist) is distinct from 'array' then raise exception using errcode='XX000',message='Invariante de checklist inválida'; end if;
 total_controls:=jsonb_array_length(task_row.checklist);
 if total_controls=0 then
  if cursor_value is not null then raise exception using errcode='22023',message='Consulta inválida'; end if;
  items:='[]'::jsonb;
 else
  if cursor_value is null then ordinal_v:=1; offset_v:=0; end if;
  if ordinal_v<1 or ordinal_v>total_controls then raise exception using errcode='22023',message='Consulta inválida'; end if;
  loop
   exit when ordinal_v>total_controls or jsonb_array_length(items)>=lim;
   current_ordinal:=ordinal_v; current_offset:=offset_v;
   if prepared_ordinal<>ordinal_v then
   control:=task_row.checklist->(ordinal_v-1); control_type:=jsonb_typeof(control);
   issue_code:=null; control_text:=null; done_v:=null; recognized_text:=false;
   if control_type='string' then control_text:=control#>>'{}'; recognized_text:=true; done_v:=false;
   elsif control_type='object' then
    if not (control ? 'text') then issue_code:='text_missing';
    elsif jsonb_typeof(control->'text') is distinct from 'string' then issue_code:='text_invalid';
    else control_text:=control->>'text'; recognized_text:=true; end if;
    if not (control ? 'done') then done_v:=false;
    elsif jsonb_typeof(control->'done')='boolean' then done_v:=(control->>'done')::boolean; else done_v:=null; end if;
   else issue_code:='invalid_type'; end if;
   if recognized_text then
    text_length:=char_length(control_text);
    if text_length=0 and issue_code is null then issue_code:='text_empty'; end if;
    if issue_code is null and control_type='object' and control ? 'done' and jsonb_typeof(control->'done') is distinct from 'boolean' then issue_code:='done_invalid'; end if;
   else text_length:=0; done_v:=null; end if;
   if control_type='object' and jsonb_typeof(control->'id')='string' and control->>'id' ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then control_id:=control->>'id';
   else control_id:=substr(md5(task_id::text||':'||ordinal_v::text),1,8)||'-'||substr(md5(task_id::text||':'||ordinal_v::text),9,4)||'-'||substr(md5(task_id::text||':'||ordinal_v::text),13,4)||'-'||substr(md5(task_id::text||':'||ordinal_v::text),17,4)||'-'||substr(md5(task_id::text||':'||ordinal_v::text),21,12); end if;
   prepared_ordinal:=ordinal_v;
   end if;
   if recognized_text and text_length>0 then
    if offset_v%512<>0 or offset_v>=text_length then raise exception using errcode='22023',message='Consulta inválida'; end if;
    text_offset:=offset_v; text_part:=substring(control_text from offset_v+1 for 512);
   else
    if offset_v<>0 then raise exception using errcode='22023',message='Consulta inválida'; end if;
    text_offset:=0; text_part:='';
   end if;
   segment:=jsonb_build_object('id',control_id,'ordinal',ordinal_v,'textPart',text_part,'textOffset',text_offset,'textLength',text_length,'textComplete',(text_offset+char_length(text_part)=text_length),'done',done_v,'issueCode',issue_code);
   items:=items||jsonb_build_array(segment);
   if recognized_text and text_length>0 and text_offset+char_length(text_part)<text_length then offset_v:=text_offset+512;
   else ordinal_v:=ordinal_v+1; offset_v:=0; end if;
   if ordinal_v<=total_controls then
    next_payload:=jsonb_build_object('kind','taskChecklistPage','cursorVersion',1,'taskId',task_id,'subjectId',subject,'taskRevision',requested_revision,'ordinal',ordinal_v,'textOffset',offset_v);
    next_cursor:=rtrim(translate(regexp_replace(encode(convert_to(next_payload::text,'UTF8'),'base64'),E'[\r\n]','','g'),'+/','-_'),'=');
   else next_cursor:=null; end if;
   response_v:=jsonb_build_object('contractVersion',1,'kind','taskChecklistPage','data',jsonb_build_object('evaluatedAt',evaluated_at,'taskId',task_id,'taskRevision',requested_revision,'totalControls',total_controls,'items',items,'nextCursor',next_cursor));
   if octet_length(convert_to(response_v::text,'UTF8'))>65536 then
    if jsonb_array_length(items)<=1 then raise exception using errcode='54000',message='checklist_response_too_large'; end if;
    items:=items-(jsonb_array_length(items)-1);
    next_payload:=jsonb_build_object('kind','taskChecklistPage','cursorVersion',1,'taskId',task_id,'subjectId',subject,'taskRevision',requested_revision,'ordinal',current_ordinal,'textOffset',current_offset);
    next_cursor:=rtrim(translate(regexp_replace(encode(convert_to(next_payload::text,'UTF8'),'base64'),E'[\r\n]','','g'),'+/','-_'),'=');
    exit;
   end if;
  end loop;
 end if;
 response_v:=jsonb_build_object('contractVersion',1,'kind','taskChecklistPage','data',jsonb_build_object('evaluatedAt',evaluated_at,'taskId',task_id,'taskRevision',requested_revision,'totalControls',total_controls,'items',items,'nextCursor',next_cursor));
 if octet_length(convert_to(response_v::text,'UTF8'))>65536 then raise exception using errcode='54000',message='checklist_response_too_large'; end if;
 return response_v;
end $$;

-- Any checklist update through an authorized database function advances the
-- task revision. Existing reviewed writers already do so; this guard also
-- closes accidental future writer omissions without changing their result.
create function app_private.bump_checklist_revision() returns trigger
language plpgsql set search_path='' as $$
begin
 if new.checklist is distinct from old.checklist and new.state_revision<=old.state_revision then
  new.state_revision:=old.state_revision+1;
 end if;
 return new;
end $$;
create trigger task_instances_checklist_revision_guard
 before update of checklist on public.task_instances
 for each row execute function app_private.bump_checklist_revision();

alter function api.query_v1(jsonb) rename to query_v1_workspace_base;
revoke all on function api.query_v1_workspace_base(jsonb) from public,anon,authenticated,service_role;
create function api.query_v1(p jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
begin
 if jsonb_typeof(p->'kind')='string' and p->>'kind'='workspacePage' then return app_private.api_workspace_page(p); end if;
 if jsonb_typeof(p->'kind')='string' and p->>'kind'='workspacePageV2' then return app_private.api_workspace_page_v2(p); end if;
 if jsonb_typeof(p->'kind')='string' and p->>'kind'='taskChecklistPage' then return app_private.api_task_checklist_page(p); end if;
 return api.query_v1_workspace_base(p);
end $$;
revoke all on function app_private.api_workspace_page(jsonb) from public,anon,authenticated,service_role;
revoke all on function app_private.api_workspace_page_v2(jsonb),app_private.api_task_checklist_page(jsonb) from public,anon,authenticated,service_role;
revoke all on function api.query_v1_workspace_base(jsonb),api.query_v1(jsonb) from public,anon,authenticated,service_role;
grant execute on function api.query_v1(jsonb) to authenticated;
