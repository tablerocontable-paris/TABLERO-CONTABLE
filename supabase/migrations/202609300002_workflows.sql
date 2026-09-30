-- Aplicar después de foundation, únicamente en el proyecto nuevo.
-- La identidad de la instancia no puede separarse del responsable/empresa de su asignación.
alter table public.task_assignments add constraint assignment_identity unique(id,organization_id,company_id,owner_id,team_id);
alter table public.task_assignments add constraint assignment_company_member foreign key(company_id,owner_id) references public.company_memberships(company_id,profile_id);
alter table public.task_assignments add constraint assignment_team_member foreign key(team_id,owner_id) references public.team_members(team_id,profile_id);
alter table public.task_instances add constraint instance_assignment_identity foreign key(assignment_id,organization_id,company_id,owner_id,team_id) references public.task_assignments(id,organization_id,company_id,owner_id,team_id);

create function public.require_privileged_session() returns void
language plpgsql security definer set search_path='' as $$begin
  if coalesce(public.actor_role(),'') not in ('jefe','encargado') or coalesce(auth.jwt()->>'aal','aal1')<>'aal2' then
    raise exception 'Se requiere sesión de responsable con MFA';
  end if;
end$$;

create function public.set_checklist_item(p_instance_id uuid,p_check_id text,p_done boolean) returns void
language plpgsql security definer set search_path='' as $$
declare t public.task_instances; updated jsonb; next_status text;begin
  if not public.can_access_instance(p_instance_id) then raise exception 'Sin permiso';end if;
  select * into t from public.task_instances where id=p_instance_id;
  perform public.lock_open_month(t.owner_id,t.period);
  select * into t from public.task_instances where id=p_instance_id for update;
  if p_done is null or not exists(select 1 from jsonb_array_elements(t.checklist) x where x->>'id'=p_check_id) then raise exception 'Paso inválido';end if;
  select jsonb_agg(case when x->>'id'=p_check_id then jsonb_set(x,'{done}',to_jsonb(p_done)) else x end order by pos)
    into updated from jsonb_array_elements(t.checklist) with ordinality items(x,pos);
  next_status:=t.status;
  if p_done or t.status='Completada' then next_status:='En curso';end if;
  if p_done and t.kind='resultado' and t.blocked_by is null and not exists(select 1 from jsonb_array_elements(updated) x where coalesce((x->>'done')::boolean,false)=false) then next_status:='Completada';end if;
  update public.task_instances set checklist=updated,status=next_status,
    started_at=case when next_status<>'Pendiente' then coalesce(started_at,now()) else started_at end,
    completed_at=case when next_status='Completada' then now() else null end where id=t.id;
  insert into public.audit_events(organization_id,actor_id,action,entity_id,details)
    values(t.organization_id,auth.uid(),'task.checklist',t.id,jsonb_build_object('step',p_check_id,'done',p_done));
end$$;

create function public.create_catalog_assignment(p_template uuid,p_company uuid,p_owner uuid,p_team uuid,p_period date,p_due_day integer,p_frequency text) returns uuid
language plpgsql security definer set search_path='' as $$
declare tpl public.task_templates; new_id uuid;begin
  if not public.can_access_owner(p_owner) or public.actor_role()='auditor' then raise exception 'Sin permiso';end if;
  if extract(day from p_period)<>1 then raise exception 'Período inválido';end if;
  if not exists(select 1 from public.company_memberships where profile_id=p_owner and company_id=p_company and organization_id=public.actor_org())
     or not exists(select 1 from public.team_members where profile_id=p_owner and team_id=p_team and organization_id=public.actor_org()) then raise exception 'Empresa o equipo fuera del ámbito del responsable';end if;
  if public.actor_role()<>'jefe' and not exists(select 1 from public.company_memberships where profile_id=auth.uid() and company_id=p_company) then raise exception 'Sin permiso para la empresa';end if;
  perform public.lock_open_month(p_owner,p_period);
  select * into tpl from public.task_templates where id=p_template and organization_id=public.actor_org() and active;
  if not found then raise exception 'Plantilla inválida';end if;
  insert into public.task_assignments(organization_id,template_id,company_id,owner_id,team_id,title,kind,weight,unit,target,frequency,start_month,due_day,checklist)
    values(tpl.organization_id,tpl.id,p_company,p_owner,p_team,tpl.title,tpl.kind,tpl.weight,tpl.unit,tpl.monthly_target,p_frequency,p_period,p_due_day,tpl.checklist) returning id into new_id;
  insert into public.audit_events(organization_id,actor_id,action,entity_id) values(tpl.organization_id,auth.uid(),'assignment.created',new_id);
  return new_id;
end$$;

create function public.materialize_month(p_owner uuid,p_period date) returns integer
language plpgsql security definer set search_path='' as $$
declare inserted integer;begin
  if not public.can_access_owner(p_owner) or public.actor_role()='auditor' then raise exception 'Sin permiso';end if;
  if p_period is null or extract(day from p_period)<>1 then raise exception 'Período inválido';end if;
  perform public.lock_open_month(p_owner,p_period);
  insert into public.task_instances(organization_id,assignment_id,company_id,owner_id,team_id,period,title,kind,weight,unit,target,due_date,checklist)
    select a.organization_id,a.id,a.company_id,a.owner_id,a.team_id,p_period,a.title,a.kind,a.weight,a.unit,a.target,
      p_period+(least(a.due_day,extract(day from (p_period+interval '1 month - 1 day'))::integer)-1),
      coalesce((select jsonb_agg(jsonb_build_object('id',gen_random_uuid(),'text',case when jsonb_typeof(x)='string' then x#>>'{}' else x->>'text' end,'done',false) order by pos) from jsonb_array_elements(a.checklist) with ordinality items(x,pos)),'[]'::jsonb)
    from public.task_assignments a join public.profiles p on p.id=a.owner_id and p.active
    where a.owner_id=p_owner and a.organization_id=public.actor_org() and a.start_month<=p_period and (a.frequency='mensual' or a.start_month=p_period)
      and (public.actor_role()='jefe' or exists(select 1 from public.company_memberships cm where cm.profile_id=auth.uid() and cm.company_id=a.company_id))
    on conflict(assignment_id,period) do nothing;
  get diagnostics inserted=row_count;
  if inserted>0 then insert into public.audit_events(organization_id,actor_id,action,entity_id,details) values(public.actor_org(),auth.uid(),'month.materialized',p_owner,jsonb_build_object('period',p_period,'count',inserted));end if;
  return inserted;
end$$;

create function public.update_template_weight(p_template uuid,p_weight numeric) returns void
language plpgsql security definer set search_path='' as $$declare org uuid;begin
  perform public.require_privileged_session();
  if public.actor_role()<>'jefe' then raise exception 'Sólo jefatura define pesos';end if;
  update public.task_templates set weight=p_weight,version=version+1 where id=p_template and organization_id=public.actor_org() returning organization_id into org;
  if not found then raise exception 'Plantilla inválida';end if;
  insert into public.audit_events(organization_id,actor_id,action,entity_id,details) values(org,auth.uid(),'template.weight',p_template,jsonb_build_object('weight',p_weight));
  -- Las asignaciones e instancias anteriores conservan su peso pactado.
end$$;

create function public.close_employee_month(p_owner uuid,p_period date,p_note text) returns uuid
language plpgsql security definer set search_path='' as $$
declare snapshot_data jsonb; new_id uuid;begin
  perform public.require_privileged_session();
  if not public.can_access_owner(p_owner) then raise exception 'Sin permiso';end if;
  if p_period is null or extract(day from p_period)<>1 or p_period>date_trunc('month',now() at time zone 'America/Argentina/Buenos_Aires')::date then raise exception 'Período inválido';end if;
  if nullif(trim(p_note),'') is null then raise exception 'La revisión requiere una nota';end if;
  -- Cierre íntegro: un encargado sin acceso a alguna empresa no puede cerrar parcialmente.
  if public.actor_role()<>'jefe' and exists(select 1 from public.task_instances t where t.owner_id=p_owner and t.period=p_period and not public.can_access_instance(t.id)) then raise exception 'Se requiere acceso a todas las empresas del mes';end if;
  perform public.lock_open_month(p_owner,p_period);
  if not exists(select 1 from public.task_instances where owner_id=p_owner and period=p_period) then raise exception 'No hay tareas para cerrar';end if;
  with work as (
    select t.*,coalesce((select sum(e.quantity) from public.activity_entries e where e.instance_id=t.id and date_trunc('month',e.work_date)::date=p_period),0) as quantity
    from public.task_instances t where t.owner_id=p_owner and t.period=p_period
  ), values_per_task as (
    select *,weight*case when kind='resultado' then case when status='Completada' then 1 else 0 end else least(quantity::numeric/target,1) end as earned from work
  ), totals as (
    select sum(weight) as points,sum(earned) as earned,count(*) filter(where kind='resultado') as assigned,count(*) filter(where kind='resultado' and status='Completada') as done,
      count(*) filter(where kind='resultado' and status='Completada' and (completed_at at time zone 'America/Argentina/Buenos_Aires')::date<=due_date) as on_time,
      count(*) filter(where kind='resultado' and status<>'Completada' and due_date<(now() at time zone 'America/Argentina/Buenos_Aires')::date) as late,
      count(*) filter(where blocked_by is not null) as blocked,count(*) filter(where kind='operativa') as operational,count(*) filter(where kind='operativa' and quantity>=target) as operational_target from values_per_task
  ) select jsonb_build_object('version',1,'timezone','America/Argentina/Buenos_Aires','period',p_period,
      'tasks',(select jsonb_agg(to_jsonb(t) order by t.company_id,t.id) from work t),
      'activity',coalesce((select jsonb_agg(to_jsonb(e) order by e.work_date,e.id) from public.activity_entries e join work t on t.id=e.instance_id where date_trunc('month',e.work_date)::date=p_period),'[]'::jsonb),
      'metrics',jsonb_build_object('points',points,'earned',round(earned,2),'weighted',round(earned/nullif(points,0)*100),'assigned',assigned,'done',done,'onTime',round(on_time::numeric/nullif(done,0)*100),'late',late,'blocked',blocked,'operational',operational,'operationalTarget',operational_target)) into snapshot_data from totals;
  insert into public.monthly_closures(organization_id,owner_id,period,snapshot,closed_by,note) values(public.actor_org(),p_owner,p_period,snapshot_data,auth.uid(),trim(p_note)) returning id into new_id;
  insert into public.audit_events(organization_id,actor_id,action,entity_id,details) values(public.actor_org(),auth.uid(),'month.closed',new_id,jsonb_build_object('owner',p_owner,'period',p_period));
  return new_id;
end$$;

revoke execute on function public.require_privileged_session(),public.set_checklist_item(uuid,text,boolean),public.create_catalog_assignment(uuid,uuid,uuid,uuid,date,integer,text),public.materialize_month(uuid,date),public.update_template_weight(uuid,numeric),public.close_employee_month(uuid,date,text) from public,anon;
grant execute on function public.set_checklist_item(uuid,text,boolean),public.create_catalog_assignment(uuid,uuid,uuid,uuid,date,integer,text),public.materialize_month(uuid,date),public.update_template_weight(uuid,numeric),public.close_employee_month(uuid,date,text) to authenticated;
