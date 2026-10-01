-- Fixture reproducible para PostgreSQL local descartable ya migrado hasta 007.
-- Ejecutar como el dueño de la base antes de abrir las dos conexiones autenticadas.
begin;
insert into public.organizations(id,name) values('00000000-0000-0000-0000-000007000001','Synthetic concurrency fixture');
insert into auth.users(id,email,email_confirmed_at) values
 ('10000000-0000-0000-0000-000007000001','boss@example.test',clock_timestamp()),
 ('10000000-0000-0000-0000-000007000002','owner@example.test',clock_timestamp()),
 ('10000000-0000-0000-0000-000007000003','replacement@example.test',clock_timestamp());
insert into public.profiles(id,organization_id,name,role,manager_id,sector,branch,position) values
 ('10000000-0000-0000-0000-000007000001','00000000-0000-0000-0000-000007000001','Boss','jefe',null,'Contabilidad','Laboratorio','Jefe'),
 ('10000000-0000-0000-0000-000007000002','00000000-0000-0000-0000-000007000001','Owner','empleado','10000000-0000-0000-0000-000007000001','Contabilidad','Laboratorio','Empleado'),
 ('10000000-0000-0000-0000-000007000003','00000000-0000-0000-0000-000007000001','Replacement','empleado','10000000-0000-0000-0000-000007000001','Contabilidad','Laboratorio','Reemplazo');
insert into public.companies(id,organization_id,name) values
 ('20000000-0000-0000-0000-000007000001','00000000-0000-0000-0000-000007000001','Empresa A'),
 ('20000000-0000-0000-0000-000007000002','00000000-0000-0000-0000-000007000001','Empresa B');
insert into public.teams(id,organization_id,name,manager_id) values
 ('30000000-0000-0000-0000-000007000001','00000000-0000-0000-0000-000007000001','Equipo laboratorio','10000000-0000-0000-0000-000007000001');
insert into public.team_members(organization_id,team_id,profile_id) values
 ('00000000-0000-0000-0000-000007000001','30000000-0000-0000-0000-000007000001','10000000-0000-0000-0000-000007000002'),
 ('00000000-0000-0000-0000-000007000001','30000000-0000-0000-0000-000007000001','10000000-0000-0000-0000-000007000003');
insert into public.company_memberships(organization_id,company_id,profile_id) values
 ('00000000-0000-0000-0000-000007000001','20000000-0000-0000-0000-000007000001','10000000-0000-0000-0000-000007000002'),
 ('00000000-0000-0000-0000-000007000001','20000000-0000-0000-0000-000007000001','10000000-0000-0000-0000-000007000003'),
 ('00000000-0000-0000-0000-000007000001','20000000-0000-0000-0000-000007000002','10000000-0000-0000-0000-000007000002'),
 ('00000000-0000-0000-0000-000007000001','20000000-0000-0000-0000-000007000002','10000000-0000-0000-0000-000007000003');
insert into public.task_assignments(id,organization_id,company_id,owner_id,team_id,title,kind,weight,frequency,start_month,due_day,checklist) values
 ('40000000-0000-0000-0000-000007000001','00000000-0000-0000-0000-000007000001','20000000-0000-0000-0000-000007000001','10000000-0000-0000-0000-000007000002','30000000-0000-0000-0000-000007000001','Banco A','resultado',5,'mensual',date_trunc('month',current_date)::date,extract(day from current_date)::int,'[]'),
 ('40000000-0000-0000-0000-000007000002','00000000-0000-0000-0000-000007000001','20000000-0000-0000-0000-000007000002','10000000-0000-0000-0000-000007000002','30000000-0000-0000-0000-000007000001','Banco B','resultado',5,'mensual',date_trunc('month',current_date)::date,extract(day from current_date)::int,'[]');
insert into public.task_instances(id,organization_id,assignment_id,company_id,owner_id,team_id,period,scheduled_on,title,kind,weight,due_date,checklist) values
 ('50000000-0000-0000-0000-000007000001','00000000-0000-0000-0000-000007000001','40000000-0000-0000-0000-000007000001','20000000-0000-0000-0000-000007000001','10000000-0000-0000-0000-000007000002','30000000-0000-0000-0000-000007000001',date_trunc('month',current_date)::date,current_date,'Banco A','resultado',5,current_date,'[]'),
 ('50000000-0000-0000-0000-000007000002','00000000-0000-0000-0000-000007000001','40000000-0000-0000-0000-000007000002','20000000-0000-0000-0000-000007000002','10000000-0000-0000-0000-000007000002','30000000-0000-0000-0000-000007000001',date_trunc('month',current_date)::date,current_date,'Banco B','resultado',5,current_date,'[]');
insert into public.report_settings(organization_id,recipient_id,updated_by)
 values('00000000-0000-0000-0000-000007000001','10000000-0000-0000-0000-000007000001','10000000-0000-0000-0000-000007000001');
commit;

-- Ausencia sintética autorizada para probar sólo Empresa A. La inserción sin
-- sello representa el estado transaccional interno de la RPC de aprobación.
select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000007000001',false);
select set_config('request.jwt.claims','{"aal":"aal2"}',false);
insert into public.employee_absences(id,organization_id,owner_id,replacement_id,kind,starts_on,ends_on,note,approved_by,approved_at,authorization_sealed)
 values('60000000-0000-0000-0000-000007000001','00000000-0000-0000-0000-000007000001','10000000-0000-0000-0000-000007000002','10000000-0000-0000-0000-000007000003','licencia',current_date-1,current_date+7,'Cobertura sintética de PostgreSQL','10000000-0000-0000-0000-000007000001',clock_timestamp(),false);
insert into public.employee_absence_companies(absence_id,organization_id,company_id)
 values('60000000-0000-0000-0000-000007000001','00000000-0000-0000-0000-000007000001','20000000-0000-0000-0000-000007000001');
update public.employee_absences set authorization_sealed=true where id='60000000-0000-0000-0000-000007000001';
insert into public.audit_events(organization_id,actor_id,action,entity_id,at,details)
select organization_id,approved_by,'absence.approved',id,approved_at,'{"synthetic":true}'::jsonb
from public.employee_absences where id='60000000-0000-0000-0000-000007000001';
