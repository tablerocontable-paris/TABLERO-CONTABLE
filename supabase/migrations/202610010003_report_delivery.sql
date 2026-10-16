-- Cierre + reporte inmutable + outbox. Sólo base nueva; ningún correo desde SQL.
begin;
create table public.report_settings(
 organization_id uuid primary key references public.organizations,
 recipient_id uuid not null, updated_by uuid not null, updated_at timestamptz not null default now(),
 foreign key(recipient_id,organization_id) references public.profiles(id,organization_id),
 foreign key(updated_by,organization_id) references public.profiles(id,organization_id)
);
alter table public.monthly_closures add constraint closure_report_identity unique(id,organization_id,owner_id,period);
create table public.period_reports(
 id uuid primary key default gen_random_uuid(), organization_id uuid not null,
 closure_id uuid not null unique, owner_id uuid not null,
 period date not null, snapshot jsonb not null, created_at timestamptz not null default now(),
 unique(id,organization_id), unique(owner_id,period),
 foreign key(closure_id,organization_id,owner_id,period) references public.monthly_closures(id,organization_id,owner_id,period),
 foreign key(owner_id,organization_id) references public.profiles(id,organization_id)
);
create table public.report_deliveries(
 id uuid primary key default gen_random_uuid(), organization_id uuid not null,
 report_id uuid not null, recipient_id uuid not null, recipient_email text not null,
 channel text not null default 'email' check(channel='email'),
 status text not null default 'pending' check(status in ('pending','processing','sent','retry_wait','failed')),
 attempts integer not null default 0 check(attempts between 0 and 5),
 total_attempts integer not null default 0 check(total_attempts>=attempts),
 next_attempt_at timestamptz not null default now(), lease_until timestamptz, lease_token uuid,
 provider_message_id text, last_error text, sent_at timestamptz, created_at timestamptz not null default now(),
 unique(report_id,recipient_id,channel), unique(id,organization_id),
 foreign key(report_id,organization_id) references public.period_reports(id,organization_id),
 foreign key(recipient_id,organization_id) references public.profiles(id,organization_id),
 check((status='processing')=(lease_until is not null and lease_token is not null)),
 check((status='sent')=(sent_at is not null and provider_message_id is not null))
);
create index report_delivery_due_idx on public.report_deliveries(next_attempt_at) where status in ('pending','retry_wait','processing');
create table public.report_outbox_events(
 id uuid primary key default gen_random_uuid(), organization_id uuid not null, delivery_id uuid not null unique,
 event_type text not null default 'period_report.ready' check(event_type='period_report.ready'), created_at timestamptz not null default now(),
 foreign key(delivery_id,organization_id) references public.report_deliveries(id,organization_id)
);
create function public.reject_report_change() returns trigger language plpgsql set search_path='' as $$begin raise exception 'El reporte y evento de cierre son inmutables'; end$$;
create trigger report_immutable before update or delete on public.period_reports for each row execute function public.reject_report_change();
create trigger report_outbox_immutable before update or delete on public.report_outbox_events for each row execute function public.reject_report_change();
create function public.can_read_period_report(p_report uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.period_reports r where r.id=p_report and r.organization_id=public.actor_org() and public.can_access_owner(r.owner_id)
 and (public.actor_role()='jefe' or not exists(select 1 from jsonb_array_elements(r.snapshot->'tasks') t where not exists(select 1 from public.company_memberships m where m.profile_id=auth.uid() and m.company_id=(t->>'company_id')::uuid))))
$$;
alter table public.report_settings enable row level security;
alter table public.period_reports enable row level security;
alter table public.report_deliveries enable row level security;
alter table public.report_outbox_events enable row level security;
create policy report_settings_read on public.report_settings for select to authenticated using(organization_id=public.actor_org() and public.actor_role()='jefe');
create policy period_reports_read on public.period_reports for select to authenticated using(public.can_read_period_report(id));
create policy report_deliveries_read on public.report_deliveries for select to authenticated using(organization_id=public.actor_org() and public.actor_role()='jefe');
create policy report_outbox_read on public.report_outbox_events for select to authenticated using(organization_id=public.actor_org() and public.actor_role()='jefe');
revoke all on public.report_settings,public.period_reports,public.report_deliveries,public.report_outbox_events from anon,authenticated;
grant select on public.report_settings,public.period_reports,public.report_deliveries,public.report_outbox_events to authenticated;
create function public.set_report_recipient(p_recipient uuid) returns void language plpgsql security definer set search_path='' as $$begin
 perform public.require_privileged_session();
 if public.actor_role()<>'jefe' then raise exception 'Sólo jefatura configura los reportes'; end if;
 if not exists(select 1 from public.profiles p join auth.users u on u.id=p.id where p.id=p_recipient and p.organization_id=public.actor_org() and p.active and p.role='jefe' and nullif(trim(u.email),'') is not null and u.email_confirmed_at is not null) then raise exception 'Destinatario gerente activo con correo verificado requerido'; end if;
 insert into public.report_settings(organization_id,recipient_id,updated_by) values(public.actor_org(),p_recipient,auth.uid()) on conflict(organization_id) do update set recipient_id=excluded.recipient_id,updated_by=excluded.updated_by,updated_at=now();
 insert into public.audit_events(organization_id,actor_id,action,entity_id) values(public.actor_org(),auth.uid(),'report.recipient_set',p_recipient);
end$$;

create or replace function public.close_employee_month(p_owner uuid,p_period date,p_note text) returns uuid
language plpgsql security definer set search_path='' as $$
declare snapshot_data jsonb; new_id uuid; report_id uuid; delivery_id uuid; recipient uuid; recipient_mail text;begin
  perform public.require_privileged_session();
  if not public.can_access_owner(p_owner) then raise exception 'Sin permiso';end if;
  if p_period is null or extract(day from p_period)<>1 or p_period>date_trunc('month',now() at time zone 'America/Argentina/Buenos_Aires')::date then raise exception 'Período inválido';end if;
  if nullif(trim(p_note),'') is null then raise exception 'La revisión requiere una nota';end if;
  -- Cierre íntegro: un encargado sin acceso a alguna empresa no puede cerrar parcialmente.
  if public.actor_role()<>'jefe' and exists(select 1 from public.task_instances t where t.owner_id=p_owner and t.period=p_period and not public.can_access_instance(t.id)) then raise exception 'Se requiere acceso a todas las empresas del mes';end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_owner::text||p_period::text,0));
  select id into new_id from public.monthly_closures where owner_id=p_owner and period=p_period;
  if found then return new_id; end if;
  select p.id,u.email into recipient,recipient_mail from public.report_settings s join public.profiles p on p.id=s.recipient_id and p.organization_id=s.organization_id join auth.users u on u.id=p.id
    where s.organization_id=public.actor_org() and p.active and p.role='jefe' and u.email_confirmed_at is not null and nullif(trim(u.email),'') is not null;
  if recipient is null then raise exception 'Configure un gerente con correo verificado antes del cierre'; end if;
  perform public.lock_open_month(p_owner,p_period);
  if exists(select 1 from public.task_time_sessions s join public.task_instances t on t.id=s.instance_id where t.owner_id=p_owner and t.period=p_period and s.ended_at is null) then raise exception 'Hay cronómetros activos; pausar antes del cierre'; end if;
  if not exists(select 1 from public.task_instances where owner_id=p_owner and period=p_period) then raise exception 'No hay tareas para cerrar';end if;
  with work as (
    select t.*,coalesce((select sum(e.quantity) from public.activity_entries e where e.instance_id=t.id and date_trunc('month',e.work_date)::date=p_period),0) as quantity
    from public.task_instances t where t.owner_id=p_owner and t.period=p_period
  ), values_per_task as (
    select *,weight*case when kind='resultado' then case when status='Completada' then 1 else 0 end else least(quantity::numeric/target,1) end as earned from work
  ), totals as (
    select sum(weight) as points,sum(earned) as earned,count(*) filter(where kind='resultado') as assigned,count(*) filter(where kind='resultado' and status='Completada') as done,
      count(*) filter(where kind='resultado' and status='Completada' and due_date is not null) as done_with_deadline,
      count(*) filter(where kind='resultado' and status='Completada' and (completed_at at time zone 'America/Argentina/Buenos_Aires')::date<=due_date) as on_time,
      count(*) filter(where kind='resultado' and status<>'Completada' and due_date<(now() at time zone 'America/Argentina/Buenos_Aires')::date) as late,
      count(*) filter(where blocked_by is not null) as blocked,count(*) filter(where kind='operativa') as operational,count(*) filter(where kind='operativa' and quantity>=target) as operational_target from values_per_task
  ) select jsonb_build_object('version',2,'evaluated_at',now(),'timezone','America/Argentina/Buenos_Aires','period',p_period,
      'tasks',(select jsonb_agg(to_jsonb(t) order by t.company_id,t.id) from work t),
      'activity',coalesce((select jsonb_agg(to_jsonb(e) order by e.work_date,e.id) from public.activity_entries e join work t on t.id=e.instance_id where date_trunc('month',e.work_date)::date=p_period),'[]'::jsonb),
      'sessions',coalesce((select jsonb_agg(to_jsonb(s) order by s.started_at,s.id) from public.task_time_sessions s join work t on t.id=s.instance_id),'[]'::jsonb),
      'reopen_events',coalesce((select jsonb_agg(to_jsonb(e) order by e.at,e.id) from public.audit_events e join work t on t.id=e.entity_id where e.action='task.transition' and e.details->>'from'='Completada' and e.details->>'to'<>'Completada'),'[]'::jsonb),
      'metrics',jsonb_build_object('points',points,'earned',round(earned,2),'weighted',round(earned/nullif(points,0)*100),'assigned',assigned,'done',done,'onTime',round(on_time::numeric/nullif(done_with_deadline,0)*100),'completedWithDeadline',done_with_deadline,'recordedSeconds',coalesce((select sum(extract(epoch from (s.ended_at-s.started_at))) from public.task_time_sessions s join work t on t.id=s.instance_id),0),'late',late,'blocked',blocked,'operational',operational,'operationalTarget',operational_target)) into snapshot_data from totals;
  insert into public.monthly_closures(organization_id,owner_id,period,snapshot,closed_by,note) values(public.actor_org(),p_owner,p_period,snapshot_data,auth.uid(),trim(p_note)) returning id into new_id;
  insert into public.audit_events(organization_id,actor_id,action,entity_id,details) values(public.actor_org(),auth.uid(),'month.closed',new_id,jsonb_build_object('owner',p_owner,'period',p_period));
  insert into public.period_reports(organization_id,closure_id,owner_id,period,snapshot) values(public.actor_org(),new_id,p_owner,p_period,snapshot_data) returning id into report_id;
  insert into public.report_deliveries(organization_id,report_id,recipient_id,recipient_email) values(public.actor_org(),report_id,recipient,recipient_mail) returning id into delivery_id;
  insert into public.report_outbox_events(organization_id,delivery_id) values(public.actor_org(),delivery_id);
  return new_id;
end$$;


-- Sólo el consumidor de servidor puede reclamar/confirmar; lease_token evita ACK tardíos.
create function public.claim_report_deliveries(p_limit integer default 10) returns setof public.report_deliveries
language plpgsql security definer set search_path='' as $$begin
 if p_limit is null or p_limit not between 1 and 100 then raise exception 'Límite inválido'; end if;
 update public.report_deliveries set status='failed',last_error='lease_expired',lease_until=null,lease_token=null where status='processing' and lease_until<=now() and attempts>=5;
 -- Cambiar usuario/correo invalida la entrega; no redirigir silenciosamente un reporte privado.
 update public.report_deliveries d set status='failed',last_error='recipient_changed',lease_until=null,lease_token=null
 where (d.status in ('pending','retry_wait') or (d.status='processing' and d.lease_until<=now()))
 and not exists(select 1 from public.profiles p join auth.users u on u.id=p.id where p.id=d.recipient_id and p.organization_id=d.organization_id and p.active and p.role='jefe' and u.email_confirmed_at is not null and u.email=d.recipient_email);
 return query with ready as (
  select d.id from public.report_deliveries d where attempts<5 and ((status in ('pending','retry_wait') and next_attempt_at<=now()) or (status='processing' and lease_until<=now()))
  order by next_attempt_at,id for update skip locked limit p_limit
 ) update public.report_deliveries d set status='processing',attempts=d.attempts+1,total_attempts=d.total_attempts+1,lease_until=now()+interval '2 minutes',lease_token=gen_random_uuid(),last_error=null
 from ready r where d.id=r.id returning d.*;
end$$;
create function public.complete_report_delivery(p_delivery uuid,p_lease uuid,p_provider_message text) returns void
language plpgsql security definer set search_path='' as $$begin
 if nullif(trim(p_provider_message),'') is null or length(p_provider_message)>200 then raise exception 'Confirmación del proveedor inválida'; end if;
 update public.report_deliveries set status='sent',provider_message_id=p_provider_message,sent_at=now(),lease_until=null,lease_token=null,last_error=null
 where id=p_delivery and status='processing' and lease_token=p_lease and lease_until>now();
 if not found then raise exception 'Lease vencido o reemplazado'; end if;
end$$;
create function public.fail_report_delivery(p_delivery uuid,p_lease uuid,p_error_code text,p_retryable boolean) returns void
language plpgsql security definer set search_path='' as $$begin
 if p_error_code is null or p_error_code not in ('provider_unavailable','provider_rejected','acceptance_unknown','recipient_changed') or p_retryable is null then raise exception 'Código de error inválido'; end if;
 update public.report_deliveries set status=case when p_retryable and attempts<5 then 'retry_wait' else 'failed' end,
 next_attempt_at=now()+case attempts when 1 then interval '1 minute' when 2 then interval '5 minutes' when 3 then interval '15 minutes' else interval '60 minutes' end,
 last_error=p_error_code,lease_until=null,lease_token=null
 where id=p_delivery and status='processing' and lease_token=p_lease and lease_until>now();
 if not found then raise exception 'Lease vencido o reemplazado'; end if;
end$$;
create function public.retry_report_delivery(p_delivery uuid) returns void language plpgsql security definer set search_path='' as $$begin
 perform public.require_privileged_session();
 if public.actor_role()<>'jefe' then raise exception 'Sólo jefatura reintenta entregas'; end if;
 update public.report_deliveries d set status='pending',attempts=0,next_attempt_at=now(),last_error=null
 where id=p_delivery and organization_id=public.actor_org() and status='failed'
 and exists(select 1 from public.profiles p join auth.users u on u.id=p.id where p.id=d.recipient_id and p.active and p.role='jefe' and u.email=d.recipient_email and u.email_confirmed_at is not null);
 if not found then raise exception 'Entrega o destinatario inválido'; end if;
 insert into public.audit_events(organization_id,actor_id,action,entity_id) values(public.actor_org(),auth.uid(),'report.delivery_retried',p_delivery);
end$$;
revoke execute on function public.reject_report_change(),public.can_read_period_report(uuid),public.set_report_recipient(uuid),public.claim_report_deliveries(integer),public.complete_report_delivery(uuid,uuid,text),public.fail_report_delivery(uuid,uuid,text,boolean),public.retry_report_delivery(uuid) from public,anon,authenticated;
grant execute on function public.can_read_period_report(uuid),public.set_report_recipient(uuid),public.retry_report_delivery(uuid) to authenticated;
grant execute on function public.claim_report_deliveries(integer),public.complete_report_delivery(uuid,uuid,text),public.fail_report_delivery(uuid,uuid,text,boolean) to service_role;
commit;
