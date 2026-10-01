-- Inducción versionada; sólo la aprobación de jefatura genera trabajo activo.
-- Ejecutar únicamente en la base nueva tras 202610010001.
begin;

create table public.onboarding_requests (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null,
  owner_id uuid not null, status text not null default 'draft' check(status in ('draft','submitted','changes_requested','approved')),
  current_revision integer not null default 0 check(current_revision>=0), submitted_at timestamptz,
  approved_at timestamptz, approved_by uuid, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(owner_id), unique(id,organization_id),
  foreign key(owner_id,organization_id) references public.profiles(id,organization_id),
  foreign key(approved_by,organization_id) references public.profiles(id,organization_id),
  check((status='approved')=(approved_at is not null and approved_by is not null))
);
create table public.onboarding_request_versions (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null, request_id uuid not null,
  revision integer not null check(revision>0), payload jsonb not null check(jsonb_typeof(payload)='object'),
  submitted_by uuid not null, submitted_at timestamptz not null default now(),
  unique(request_id,revision), unique(id,organization_id),
  foreign key(request_id,organization_id) references public.onboarding_requests(id,organization_id),
  foreign key(submitted_by,organization_id) references public.profiles(id,organization_id)
);
create table public.onboarding_reviews (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null, request_id uuid not null,
  revision integer not null, actor_id uuid not null,
  action text not null check(action in ('submitted','changes_requested','approved')), note text not null default '', created_at timestamptz not null default now(),
  foreign key(request_id,organization_id) references public.onboarding_requests(id,organization_id),
  foreign key(actor_id,organization_id) references public.profiles(id,organization_id)
);
create table public.onboarding_activations (
  organization_id uuid not null, request_id uuid not null, revision integer not null, line_id uuid not null,
  assignment_id uuid not null, created_at timestamptz not null default now(), primary key(request_id,revision,line_id), unique(assignment_id),
  foreign key(request_id,organization_id) references public.onboarding_requests(id,organization_id),
  foreign key(assignment_id,organization_id) references public.task_assignments(id,organization_id)
);

alter table public.onboarding_requests enable row level security;
alter table public.onboarding_request_versions enable row level security;
alter table public.onboarding_reviews enable row level security;
alter table public.onboarding_activations enable row level security;
create policy onboarding_requests_read on public.onboarding_requests for select to authenticated using(public.can_access_owner(owner_id));
create policy onboarding_versions_read on public.onboarding_request_versions for select to authenticated using(exists(select 1 from public.onboarding_requests r where r.id=request_id and public.can_access_owner(r.owner_id)));
create policy onboarding_reviews_read on public.onboarding_reviews for select to authenticated using(exists(select 1 from public.onboarding_requests r where r.id=request_id and public.can_access_owner(r.owner_id)));
create policy onboarding_activations_read on public.onboarding_activations for select to authenticated using(exists(select 1 from public.onboarding_requests r where r.id=request_id and public.can_access_owner(r.owner_id)));
revoke all on public.onboarding_requests,public.onboarding_request_versions,public.onboarding_reviews,public.onboarding_activations from anon,authenticated;
grant select on public.onboarding_requests,public.onboarding_request_versions,public.onboarding_reviews,public.onboarding_activations to authenticated;

create function public.submit_onboarding(p_payload jsonb,p_expected_revision integer) returns uuid
language plpgsql security definer set search_path='' as $$
declare org uuid; req public.onboarding_requests; next_revision integer;
begin
  select organization_id into org from public.profiles where id=auth.uid() and active and role='empleado';
  if org is null then raise exception 'Sólo un empleado activo puede enviar su inducción'; end if;
  if jsonb_typeof(p_payload) is distinct from 'object' or jsonb_typeof(p_payload->'lines') is distinct from 'array' or jsonb_array_length(p_payload->'lines')=0 then raise exception 'La propuesta requiere al menos una tarea'; end if;
  if jsonb_array_length(p_payload->'lines')>100 then raise exception 'La propuesta excede el máximo de líneas'; end if;
  insert into public.onboarding_requests(organization_id,owner_id) values(org,auth.uid()) on conflict(owner_id) do nothing;
  select * into req from public.onboarding_requests where owner_id=auth.uid() for update;
  if p_expected_revision is distinct from req.current_revision then raise exception 'La revisión cambió; recargue la inducción'; end if;
  if req.status not in ('draft','changes_requested') then raise exception 'La inducción no admite edición en este estado'; end if;
  if exists(select 1 from jsonb_array_elements(p_payload->'lines') l where
    nullif(l->>'line_id','') is null or nullif(l->>'company_id','') is null or nullif(l->>'team_id','') is null or
    nullif(l->>'frequency','') not in ('unica','diaria','semanal','mensual') or nullif(l->>'start_date','') is null or
    (l->>'frequency'='unica' and coalesce(l->>'end_date',l->>'start_date')<>l->>'start_date') or
    (l->>'frequency'='semanal' and (jsonb_typeof(l->'weekdays')<>'array' or jsonb_array_length(l->'weekdays')=0)) or
    (l->>'has_deadline' not in ('true','false')) or coalesce((l->>'interval_count')::integer,0) not between 1 and 12) then
    raise exception 'Hay una tarea con proceso o regla de calendario inválida';
  end if;
  if exists(select 1 from jsonb_array_elements(p_payload->'lines') l group by l->>'line_id' having count(*)>1) then raise exception 'La propuesta repite identificadores de tarea'; end if;
  next_revision:=req.current_revision+1;
  insert into public.onboarding_request_versions(organization_id,request_id,revision,payload,submitted_by) values(org,req.id,next_revision,p_payload,auth.uid());
  update public.onboarding_requests set current_revision=next_revision,status='submitted',submitted_at=now(),approved_at=null,approved_by=null,updated_at=now() where id=req.id;
  insert into public.onboarding_reviews(organization_id,request_id,revision,actor_id,action) values(org,req.id,next_revision,auth.uid(),'submitted');
  insert into public.audit_events(organization_id,actor_id,action,entity_id,details) values(org,auth.uid(),'onboarding.submitted',req.id,jsonb_build_object('revision',next_revision,'lines',jsonb_array_length(p_payload->'lines')));
  return req.id;
end $$;

create function public.request_onboarding_changes(p_request uuid,p_expected_revision integer,p_note text) returns void
language plpgsql security definer set search_path='' as $$
declare r public.onboarding_requests;
begin
  perform public.require_privileged_session();
  if public.actor_role() not in ('jefe','encargado') or nullif(trim(p_note),'') is null then raise exception 'La solicitud requiere responsable y motivo'; end if;
  select * into r from public.onboarding_requests where id=p_request and organization_id=public.actor_org() for update;
  if not found or r.status<>'submitted' or r.current_revision<>p_expected_revision then raise exception 'Solicitud o revisión desactualizada'; end if;
  if public.actor_role()='encargado' and not exists(select 1 from public.profiles p where p.id=r.owner_id and p.manager_id=auth.uid()) then raise exception 'Fuera del equipo asignado'; end if;
  update public.onboarding_requests set status='changes_requested',updated_at=now() where id=r.id;
  insert into public.onboarding_reviews(organization_id,request_id,revision,actor_id,action,note) values(r.organization_id,r.id,r.current_revision,auth.uid(),'changes_requested',trim(p_note));
  insert into public.audit_events(organization_id,actor_id,action,entity_id,details) values(r.organization_id,auth.uid(),'onboarding.changes_requested',r.id,jsonb_build_object('revision',r.current_revision));
end $$;

create function public.approve_onboarding(p_request uuid,p_expected_revision integer,p_weight_overrides jsonb default '{}'::jsonb) returns integer
language plpgsql security definer set search_path='' as $$
declare r public.onboarding_requests; v public.onboarding_request_versions; line jsonb; line_id uuid; comp uuid; team uuid; start_on date; finish_on date; freq text; interval_n integer; wd smallint[]; md smallint; deadline boolean; offset_n integer; tpl public.task_template_versions; new_assignment uuid; line_count integer:=0; task_title text; task_kind text; task_weight numeric; task_unit text; target_n integer; checklist jsonb; org uuid; current_period date:=date_trunc('month',now() at time zone 'America/Argentina/Buenos_Aires')::date;
begin
  perform public.require_privileged_session();
  if public.actor_role()<>'jefe' then raise exception 'Sólo jefatura puede aprobar la inducción'; end if;
  if jsonb_typeof(coalesce(p_weight_overrides,'{}'::jsonb))<>'object' then raise exception 'Pesos particulares inválidos'; end if;
  select * into r from public.onboarding_requests where id=p_request and organization_id=public.actor_org() for update;
  if not found or r.current_revision<>p_expected_revision then raise exception 'Solicitud o revisión desactualizada'; end if;
  if r.status='approved' then return (select count(*)::integer from public.onboarding_activations where request_id=r.id and revision=r.current_revision); end if;
  if r.status<>'submitted' then raise exception 'Solicitud o revisión desactualizada'; end if;
  if not exists(select 1 from public.profiles where id=r.owner_id and organization_id=r.organization_id and active and role='empleado') then raise exception 'El empleado ya no está activo'; end if;
  select * into v from public.onboarding_request_versions where request_id=r.id and revision=r.current_revision and organization_id=r.organization_id;
  if not found then raise exception 'No existe el contenido enviado'; end if;
  org:=r.organization_id;
  for line in select value from jsonb_array_elements(v.payload->'lines') loop
    line_id:=(line->>'line_id')::uuid; comp:=(line->>'company_id')::uuid; team:=(line->>'team_id')::uuid;
    start_on:=(line->>'start_date')::date; finish_on:=nullif(line->>'end_date','')::date; freq:=line->>'frequency';
    interval_n:=(line->>'interval_count')::integer; deadline:=(line->>'has_deadline')::boolean; offset_n:=coalesce((line->>'due_offset_days')::integer,0);
    if start_on is null or (finish_on is not null and finish_on<start_on) or offset_n not between 0 and 31 then raise exception 'Calendario inválido en línea %',line_id; end if;
    if freq='unica' and (finish_on is not null and finish_on<>start_on) then raise exception 'La tarea puntual no puede repetirse'; end if;
    if not exists(select 1 from public.company_memberships where organization_id=org and company_id=comp and profile_id=r.owner_id)
       or not exists(select 1 from public.team_members where organization_id=org and team_id=team and profile_id=r.owner_id)
       or not exists(select 1 from public.teams where id=team and organization_id=org) then raise exception 'Empresa o equipo ya no asignado en línea %',line_id; end if;
    if exists(select 1 from public.monthly_closures c where c.owner_id=r.owner_id and c.period>=date_trunc('month',start_on)::date and c.period<=current_period) then raise exception 'La fecha de inicio cruza un período cerrado'; end if;
    tpl:=null;
    if coalesce(line->>'template_version_id','')<>'' then
      select tv.* into tpl from public.task_template_versions tv join public.task_templates t on t.id=tv.template_id and t.organization_id=tv.organization_id
       where tv.id=(line->>'template_version_id')::uuid and tv.organization_id=org and t.active and tv.version=t.version;
      if not found then raise exception 'El estándar cambió; debe actualizar y reenviar la inducción'; end if;
      task_title:=tpl.title; task_kind:=tpl.kind; task_weight:=tpl.weight; task_unit:=tpl.unit; target_n:=tpl.monthly_target; checklist:=tpl.checklist;
    else
      task_title:=nullif(trim(line->>'custom_title'),''); task_kind:=line->>'kind'; task_unit:=nullif(trim(line->>'unit'),'');
      target_n:=nullif(line->>'target','')::integer; checklist:=coalesce(line->'checklist','[]'::jsonb);
      task_weight:=nullif(p_weight_overrides->>line_id::text,'')::numeric;
      if task_title is null or task_kind not in ('resultado','operativa') or task_weight is null or task_weight<=0 or task_weight>100 or jsonb_typeof(checklist)<>'array' then raise exception 'La tarea particular requiere título, tipo, controles y peso aprobado'; end if;
      if task_kind='operativa' and (target_n is null or target_n<=0 or task_unit is null) then raise exception 'Tarea operativa requiere meta y unidad'; end if;
    end if;
    if tpl.id is not null and exists(select 1 from public.task_assignments a where a.owner_id=r.owner_id and a.company_id=comp and a.template_version_id=tpl.id and a.frequency=freq and a.start_date=start_on and a.end_date is not distinct from finish_on) then raise exception 'La tarea estándar ya está asignada a esa empresa'; end if;
    if freq='semanal' then
      select array_agg(distinct (x#>>'{}')::smallint order by (x#>>'{}')::smallint) into wd from jsonb_array_elements(line->'weekdays') x;
      if cardinality(wd)=0 or not wd<@array[0,1,2,3,4,5,6]::smallint[] then raise exception 'Días semanales inválidos'; end if;
    else wd:=array[1]::smallint[]; end if;
    if freq='mensual' then md:=coalesce((line->>'month_day')::smallint,extract(day from start_on)::smallint); if md not between 1 and 31 then raise exception 'Día mensual inválido'; end if; else md:=extract(day from start_on)::smallint; end if;
    insert into public.task_assignments(organization_id,template_id,template_version_id,company_id,owner_id,team_id,title,kind,weight,unit,target,frequency,start_month,due_day,checklist,start_date,end_date,interval_count,weekdays,month_day,has_deadline,due_offset_days)
      values(org,tpl.template_id,tpl.id,comp,r.owner_id,team,task_title,task_kind,task_weight,task_unit,target_n,freq,date_trunc('month',start_on)::date,extract(day from start_on)::integer,checklist,start_on,finish_on,interval_n,wd,md,deadline,offset_n) returning id into new_assignment;
    insert into public.onboarding_activations(organization_id,request_id,revision,line_id,assignment_id) values(org,r.id,r.current_revision,line_id,new_assignment);
    if start_on<=current_period+interval '1 month - 1 day' and (finish_on is null or finish_on>=current_period) then perform public.materialize_month(r.owner_id,current_period); end if;
    line_count:=line_count+1;
  end loop;
  update public.onboarding_requests set status='approved',approved_at=now(),approved_by=auth.uid(),updated_at=now() where id=r.id;
  insert into public.onboarding_reviews(organization_id,request_id,revision,actor_id,action,note) values(org,r.id,r.current_revision,auth.uid(),'approved','');
  insert into public.audit_events(organization_id,actor_id,action,entity_id,details) values(org,auth.uid(),'onboarding.approved',r.id,jsonb_build_object('revision',r.current_revision,'assignments',line_count));
  return line_count;
end $$;

revoke execute on function public.submit_onboarding(jsonb,integer),public.request_onboarding_changes(uuid,integer,text),public.approve_onboarding(uuid,integer,jsonb) from public,anon;
grant execute on function public.submit_onboarding(jsonb,integer),public.request_onboarding_changes(uuid,integer,text),public.approve_onboarding(uuid,integer,jsonb) to authenticated;
commit;
