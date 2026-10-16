-- Only a fresh disposable PostgreSQL database migrated through 009.
-- This file remains unsealed; scenarios seal it explicitly when needed.
begin;
insert into organizations values('00000000-0000-0000-0000-000009000001','009 SQL laboratory');
insert into auth.users(id,email,email_confirmed_at) values
 ('10000000-0000-0000-0000-000009000001','boss@example.test',clock_timestamp()),
 ('10000000-0000-0000-0000-000009000002','owner@example.test',clock_timestamp()),
 ('10000000-0000-0000-0000-000009000003','replacement@example.test',clock_timestamp()),
 ('10000000-0000-0000-0000-000009000004','manager@example.test',clock_timestamp());
insert into profiles(id,organization_id,name,role,manager_id,sector,branch,position) values
 ('10000000-0000-0000-0000-000009000001','00000000-0000-0000-0000-000009000001','Boss','jefe',null,'Contabilidad','Lab','Boss'),
 ('10000000-0000-0000-0000-000009000004','00000000-0000-0000-0000-000009000001','Manager','encargado','10000000-0000-0000-0000-000009000001','Contabilidad','Lab','Manager'),
 ('10000000-0000-0000-0000-000009000002','00000000-0000-0000-0000-000009000001','Owner','empleado','10000000-0000-0000-0000-000009000004','Contabilidad','Lab','Owner'),
 ('10000000-0000-0000-0000-000009000003','00000000-0000-0000-0000-000009000001','Replacement','empleado','10000000-0000-0000-0000-000009000001','Contabilidad','Lab','Replacement');
insert into companies values
 ('20000000-0000-0000-0000-000009000001','00000000-0000-0000-0000-000009000001','A'),
 ('20000000-0000-0000-0000-000009000002','00000000-0000-0000-0000-000009000001','B');
insert into teams values('30000000-0000-0000-0000-000009000001','00000000-0000-0000-0000-000009000001','Lab','10000000-0000-0000-0000-000009000004');
insert into team_members select '00000000-0000-0000-0000-000009000001'::uuid,'30000000-0000-0000-0000-000009000001'::uuid,id from profiles where role<>'jefe';
insert into company_memberships select c.organization_id,c.id,p.id from companies c cross join profiles p where p.role<>'jefe';
insert into task_assignments(id,organization_id,company_id,owner_id,team_id,title,kind,weight,frequency,start_month,due_day,checklist)
 select x.id,'00000000-0000-0000-0000-000009000001',x.company_id,'10000000-0000-0000-0000-000009000002','30000000-0000-0000-0000-000009000001',x.title,'resultado',5,'mensual',
 date_trunc('month',clock_timestamp() at time zone 'America/Argentina/Buenos_Aires')::date-case when x.old_month then interval '1 month' else interval '0 month' end,
 1,'[{"id":"checked","text":"Control A","done":true},{"id":"pending","text":"Control B","done":false}]'
 from (values
 ('40000000-0000-0000-0000-000009000001'::uuid,'20000000-0000-0000-0000-000009000001'::uuid,'Bank A',false),
 ('40000000-0000-0000-0000-000009000002'::uuid,'20000000-0000-0000-0000-000009000002'::uuid,'Bank B',false),
 ('40000000-0000-0000-0000-000009000003'::uuid,'20000000-0000-0000-0000-000009000001'::uuid,'Previous month',true)
 ) x(id,company_id,title,old_month);
insert into task_instances(id,organization_id,assignment_id,company_id,owner_id,team_id,period,scheduled_on,title,kind,weight,due_date,checklist)
 select replace(id::text,'40000000','50000000')::uuid,organization_id,id,company_id,owner_id,team_id,start_month,start_month,title,kind,weight,start_month,checklist from task_assignments;
insert into report_settings(organization_id,recipient_id,updated_by) values('00000000-0000-0000-0000-000009000001','10000000-0000-0000-0000-000009000001','10000000-0000-0000-0000-000009000001');
select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000009000001',false),set_config('request.jwt.claims','{"aal":"aal2"}',false);
insert into employee_absences(id,organization_id,owner_id,replacement_id,kind,starts_on,ends_on,note,approved_by,approved_at,authorization_sealed)
 values('60000000-0000-0000-0000-000009000001','00000000-0000-0000-0000-000009000001','10000000-0000-0000-0000-000009000002','10000000-0000-0000-0000-000009000003','licencia',
 (clock_timestamp() at time zone 'America/Argentina/Buenos_Aires')::date-1,(clock_timestamp() at time zone 'America/Argentina/Buenos_Aires')::date,
 'Synthetic 009 coverage','10000000-0000-0000-0000-000009000001',clock_timestamp(),false);
insert into employee_absence_companies values('60000000-0000-0000-0000-000009000001','00000000-0000-0000-0000-000009000001','20000000-0000-0000-0000-000009000001');
create schema lab009;
create function lab009.assert_true(p_test boolean,p_label text) returns void language plpgsql as $$begin
 if p_test is distinct from true then raise exception '009 assertion failed: %',p_label; end if;
end$$;
grant usage on schema lab009 to authenticated;
grant execute on function lab009.assert_true(boolean,text) to authenticated;
create table lab009.sessions(name text primary key,id uuid not null);
grant select on lab009.sessions to authenticated;
create table lab009.results(connection text primary key,value jsonb not null);
grant select,insert on lab009.results to authenticated;
commit;
reset role;
select set_config('request.jwt.claim.sub','',false),set_config('request.jwt.claims','{}',false);
