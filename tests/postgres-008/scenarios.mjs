// Produces reviewable SQL. Importing/rendering NEVER connects to PostgreSQL.
export const cases = [
  "start-start",
  "start-switch",
  "switch-pause",
  "checklist-pause",
  "close-start",
  "close-switch",
  "cancel-start",
  "permission-start",
  "expiry-wait",
  "company-seal",
  "replay-exact",
  "replay-different",
];
const id = (prefix, n) => `${prefix}0000000-0000-0000-0000-00000800000${n}`;
const boss = id(1, 1),
  owner = id(1, 2),
  peer = id(1, 3),
  manager = id(1, 4);
const org = id(0, 1),
  company = id(2, 1),
  companyB = id(2, 2),
  t1 = id(5, 1),
  t2 = id(5, 2),
  t3 = id(5, 3),
  absence = id(6, 1);
const op = (n) =>
  `90000000-0000-0000-0000-0000080000${String(n).padStart(2, "0")}`;
const sqlQuote = (s) => `'${s.replaceAll("'", "''")}'`;
export const login = (actor, privileged = false) =>
  `reset role;\nselect set_config('request.jwt.claim.sub','${actor}',false),set_config('request.jwt.claims','{"aal":"${privileged ? "aal2" : "aal1"}"}',false);\nset role authenticated;`;
const admin =
  "reset role;select set_config('request.jwt.claim.sub','',false),set_config('request.jwt.claims','{}',false);";
const start = (task, operation, switching = false, revision = 0) =>
  `public.start_task_timer('${task}',${revision},'${operation}',${switching})`;
const pause = (operation) =>
  `public.pause_task_timer((select id from lab008.sessions where name='origin'),'${operation}')`;
const month =
  "date_trunc('month',clock_timestamp() at time zone 'America/Argentina/Buenos_Aires')::date";
const ownerLock = `select pg_advisory_xact_lock(hashtextextended('work-owner:${owner}',0));`;
const close = `public.close_employee_month('${owner}',${month},'Synthetic 008 concurrent closure')`;
const cancel = `public.cancel_employee_absence('${absence}','Synthetic 008 cancellation','${op(2)}')`;
const seal = `update employee_absences set authorization_sealed=true where id='${absence}';`;
const insertCompany = `insert into employee_absence_companies values('${absence}','${org}','${companyB}');`;
const check = (condition, label) =>
  `perform lab008.assert_true((${condition}),${sqlQuote(label)});`;
// Exception block is a subtransaction: expected failure cannot leave partial RPC
// changes. Only the stated error is accepted; success and unrelated errors fail.
const reject = (statement, error) => `do $expected$ begin
 begin ${statement} raise exception 'UNEXPECTED_SUCCESS';
 exception when others then
  if SQLERRM !~ ${sqlQuote(error)} then raise; end if;
  raise notice 'EXPECTED_REJECTION: %',SQLERRM;
 end;
end $expected$;`;
const step = (actor, statement, error = null, privileged = false) =>
  login(actor, privileged) +
  "\nbegin;\n" +
  (error ? reject(statement, error) : statement);
const expirySleep = `select lab008.assert_true(clock_timestamp()<((ends_on+1)::timestamp at time zone 'America/Argentina/Buenos_Aires') and extract(epoch from (((ends_on+1)::timestamp at time zone 'America/Argentina/Buenos_Aires')-clock_timestamp()))<=120,'expiry requires real ART midnight within 120 seconds') from employee_absences where id='${absence}';
select pg_sleep(greatest(0,extract(epoch from (((ends_on+1)::timestamp at time zone 'America/Argentina/Buenos_Aires')-clock_timestamp())))+0.1) from employee_absences where id='${absence}';`;

export function scenario(name, order) {
  if (!cases.includes(name) || !["AB", "BA"].includes(order))
    throw Error("Unknown scenario/order");
  const ab = order === "AB";
  let setup = admin + (name === "company-seal" ? "" : seal),
    a,
    b,
    afterFirst = "",
    checks = [];
  const count = (table, where = "true") =>
    `(select count(*) from ${table} where ${where})`;
  const rev = (task) =>
    `(select state_revision from task_instances where id='${task}')`;
  const sessions = (task, open = true) =>
    count(
      "task_time_sessions",
      `instance_id='${task}'${open ? " and ended_at is null" : ""}`,
    );
  const receipts = count("task_mutation_receipts");
  const audit = (action) => count("audit_events", `action='${action}'`);
  const seedTimer = (task, actor = owner) =>
    login(actor) +
    `\nselect ${start(task, op(90))};\n` +
    admin +
    `insert into lab008.sessions select 'origin',id from task_time_sessions where instance_id='${task}' and ended_at is null;`;
  switch (name) {
    case "start-start":
    case "start-switch": {
      const switching = name === "start-switch",
        firstTask = ab ? t1 : t2,
        lastTask = ab ? t2 : t1;
      a = step(
        owner,
        `perform ${start(t1, op(1), !ab && switching)};`,
        !ab && !switching ? "Pause su cronómetro actual" : null,
      );
      b = step(
        owner,
        `perform ${start(t2, op(2), ab && switching)};`,
        ab && !switching ? "Pause su cronómetro actual" : null,
      );
      checks = [
        check(
          sessions(switching ? lastTask : firstTask) + "=1",
          "one winner clock",
        ),
        check(
          sessions(switching ? firstTask : lastTask) + "=0",
          "other clock closed or absent",
        ),
        check(rev(firstTask) + `=${switching ? 2 : 1}`, "winner revision"),
        check(rev(lastTask) + `=${switching ? 1 : 0}`, "destination revision"),
        check(
          receipts + `=${switching ? 2 : 1}`,
          "receipts only for successful starts",
        ),
        check(
          count("task_time_sessions") + `=${switching ? 2 : 1}`,
          "session count",
        ),
        check(
          audit("task.timer_switched") + `=${switching ? 1 : 0}`,
          "switch audit count",
        ),
      ];
      break;
    }
    case "switch-pause":
    case "checklist-pause": {
      setup += seedTimer(t1);
      a = step(
        owner,
        name === "switch-pause"
          ? `perform ${start(t2, op(1), true)};`
          : `perform public.set_checklist_item_reviewed('${t2}','pending',true,null,0,'${op(1)}');`,
      );
      b = step(owner, `perform ${pause(op(2))};`);
      checks = [
        check(rev(t1) + "=2", "source changed once"),
        check(rev(t2) + "=1", "destination changed once"),
        check(receipts + "=3", "three scalar receipts"),
        check(sessions(t1) + "=0", "source ended"),
        check(
          sessions(t2) + `=${name === "switch-pause" ? 1 : 0}`,
          "destination clock rule",
        ),
        check(
          count("task_time_sessions") + `=${name === "switch-pause" ? 2 : 1}`,
          "no extra sessions",
        ),
      ];
      if (name === "checklist-pause")
        checks.push(
          check(
            `(select status='Completada' from task_instances where id='${t2}')`,
            "last result control completes without clock",
          ),
          check(
            `not exists(select 1 from audit_events where action='task.checklist' and (details->>'session' is not null or details->>'ended_at' is not null))`,
            "destination does not inherit source context",
          ),
        );
      break;
    }
    case "close-start":
    case "close-switch": {
      const switching = name === "close-switch";
      if (switching) setup += seedTimer(t3);
      a = step(
        boss,
        `perform ${close};`,
        ab ? null : "Hay cronómetros activos",
        true,
      );
      b = step(
        owner,
        `perform ${start(t1, op(1), switching)};`,
        ab ? "mes.*cerrado|período.*cerrado|Mes cerrado" : null,
      );
      checks = [
        check(count("monthly_closures") + `=${ab ? 1 : 0}`, "closure winner"),
        check(sessions(t1) + `=${ab ? 0 : 1}`, "destination reflects winner"),
        check(rev(t1) + `=${ab ? 0 : 1}`, "no failed-start revision"),
        check(
          receipts + `=${(switching ? 1 : 0) + (ab ? 0 : 1)}`,
          "no receipt for rejected call",
        ),
      ];
      if (switching)
        checks.push(
          check(
            sessions(t3) + `=${ab ? 1 : 0}`,
            "closed-month conflict preserves source",
          ),
          check(rev(t3) + `=${ab ? 1 : 2}`, "source revision"),
          check(
            audit("task.timer_switched") + `=${ab ? 0 : 1}`,
            "no partial switch",
          ),
        );
      break;
    }
    case "cancel-start": {
      a = step(boss, `perform ${cancel};`, null, true);
      b = step(
        peer,
        `perform ${start(t1, op(1))};`,
        ab ? "Sin permiso|Cobertura" : null,
      );
      checks = [
        check(
          `(select cancelled_at is not null from employee_absences where id='${absence}')`,
          "cancelled",
        ),
        check(
          count("task_time_sessions") + `=${ab ? 0 : 1}`,
          "start winner session",
        ),
        check(sessions(t1) + "=0", "no covered open clock after cancellation"),
        check(
          rev(t1) + `=${ab ? 0 : 2}`,
          "single start and single stop revisions",
        ),
        check(receipts + `=${ab ? 1 : 2}`, "cancel/start receipts"),
        check(audit("absence.cancelled") + "=1", "one cancellation audit"),
        check(
          audit("absence.session_stopped") + `=${ab ? 0 : 1}`,
          "stop audit count",
        ),
      ];
      checks.push(
        check(
          `not exists(select 1 from task_time_sessions s join employee_absences a on a.id=s.absence_id where s.ended_at is distinct from least(a.cancelled_at,((a.ends_on+1)::timestamp at time zone 'America/Argentina/Buenos_Aires')))`,
          "exact effective cancellation cutoff",
        ),
      );
      break;
    }
    case "permission-start": {
      // Raw administrative mutation only in lab; no membership-removal RPC exists.
      a =
        admin +
        "\nbegin;\n" +
        ownerLock +
        `delete from company_memberships where profile_id='${manager}' and company_id='${company}';`;
      b = step(
        manager,
        `perform ${start(t1, op(1))};`,
        ab ? "Sin permiso" : null,
      );
      checks = [
        check(
          count(
            "company_memberships",
            `profile_id='${manager}' and company_id='${company}'`,
          ) + "=0",
          "membership withdrawn",
        ),
        check(
          rev(t1) + `=${ab ? 0 : 1}`,
          "permission rechecked after owner guard",
        ),
        check(
          count("task_time_sessions") + `=${ab ? 0 : 1}`,
          "history retained only if start committed first",
        ),
        check(receipts + `=${ab ? 0 : 1}`, "rejected start leaves no receipt"),
      ];
      break;
    }
    case "expiry-wait": {
      setup += seedTimer(t1, peer);
      a = admin + "\nbegin;\n" + ownerLock + (ab ? "" : expirySleep);
      if (ab) afterFirst = expirySleep;
      b = step(
        owner,
        `perform public.set_task_wait('${t1}','Synthetic wait',1,'${op(1)}');`,
      );
      checks = [
        check(sessions(t1) + "=0", "expired/wait clock closed"),
        check(rev(t1) + "=2", "one revision for expiration plus wait"),
        check(receipts + "=2", "seed plus wait receipts"),
        check(audit("task.wait") + "=1", "one wait event"),
        check(
          audit("task.timer_expired") + `=${ab ? 1 : 0}`,
          "expiration only after real boundary",
        ),
      ];
      checks.push(
        check(
          `(select ${ab ? "s.ended_at =" : "s.ended_at <"} ((a.ends_on+1)::timestamp at time zone 'America/Argentina/Buenos_Aires') from task_time_sessions s join employee_absences a on a.id=s.absence_id)`,
          "effective ART end",
        ),
      );
      break;
    }
    case "company-seal": {
      a = admin + "\nbegin;\n" + seal;
      b =
        admin +
        "\nbegin;\n" +
        (ab
          ? reject(insertCompany, "La autorización ya está sellada")
          : insertCompany);
      checks = [
        check(
          `(select authorization_sealed from employee_absences where id='${absence}')`,
          "sealed",
        ),
        check(
          count("employee_absence_companies") + `=${ab ? 1 : 2}`,
          "scope fixed by seal ordering",
        ),
        check(receipts + "=0", "no approval RPC fabricated"),
      ];
      break;
    }
    case "replay-exact":
    case "replay-different": {
      const different = name === "replay-different",
        winner = ab ? t1 : different ? t2 : t1;
      a = step(
        owner,
        `insert into lab008.results values('A',to_jsonb(${start(t1, op(1))}));`,
        !ab && different ? "Identificador de operación reutilizado" : null,
      );
      b = step(
        owner,
        `insert into lab008.results values('B',to_jsonb(${start(different ? t2 : t1, op(1))}));`,
        ab && different ? "Identificador de operación reutilizado" : null,
      );
      checks = [
        check(
          count("task_time_sessions") + "=1",
          "one session across concurrent replay",
        ),
        check(sessions(winner) + "=1", "winning task"),
        check(receipts + "=1", "one receipt"),
        check(rev(winner) + "=1", "one revision"),
        check(
          audit("task.timer_switched") + "=0",
          "replay leaves no extra timer audit",
        ),
        check(
          `(select (result->>'session_id')::uuid=(select id from task_time_sessions) from task_mutation_receipts)`,
          "replayed scalar has original session ID",
        ),
      ];
      checks.push(
        check(
          count("lab008.results") + `=${different ? 1 : 2}`,
          "actual return count",
        ),
        check(
          `not exists(select 1 from lab008.results where value is distinct from to_jsonb((select id from task_time_sessions)))`,
          "every actual return is original UUID",
        ),
      );
      break;
    }
  }
  // All successful SQL statements go in DO for PERFORM; transaction control stays
  // outside. Administrative DML/locks remain plain SQL.
  const wrap = (sql) =>
    sql.replace(/begin;\n(perform[\s\S]*)$/, (m, body) =>
      body.includes("$expected$")
        ? m
        : "begin;\ndo $call$ begin " + body + " end $call$;",
    );
  a = wrap(a);
  b = wrap(b);
  const common = [
    check(
      `not exists(select actor_id from task_time_sessions where ended_at is null group by actor_id having count(*)>1)`,
      "one open clock per actor",
    ),
    check(
      `not exists(select instance_id from task_time_sessions where ended_at is null group by instance_id having count(*)>1)`,
      "one open clock per task",
    ),
    check(
      `not exists(select 1 from task_time_sessions where ended_at<started_at)`,
      "no negative times",
    ),
    check(
      `not exists(select 1 from monthly_closures c join task_instances t on t.owner_id=c.owner_id and t.period=c.period join task_time_sessions s on s.instance_id=t.id where s.ended_at is null)`,
      "no open clock inside closed period",
    ),
    ...["period_reports", "report_deliveries", "report_outbox_events"].map(
      (table) =>
        check(
          count(table) + "=" + count("monthly_closures"),
          "one " + table + " per closure",
        ),
    ),
    check(
      `not exists(select 1 from audit_events e join task_time_sessions s on s.id=(e.details->>'session')::uuid where e.action in ('task.timer_expired','task.wait','absence.session_stopped','task.timer_paused','task.timer_switched') and ((e.details->>'started_at')::timestamptz is distinct from s.started_at or (e.details->>'ended_at')::timestamptz is distinct from s.ended_at or (e.details->>'executor')::uuid is distinct from s.actor_id or (e.details->>'absence')::uuid is distinct from s.absence_id))`,
      "audit context equals stored session",
    ),
    check(
      `not has_function_privilege('authenticated','public._can_access_instance_at(uuid,timestamptz)','execute') and not has_function_privilege('anon','public._can_access_instance_at(uuid,timestamptz)','execute') and has_function_privilege('authenticated','public.can_cover_instance(uuid)','execute')`,
      "helper ACL",
    ),
  ];
  let verify =
    admin +
    `\ndo $verify$ begin\n${[...checks, ...common].join("\n")}\nend $verify$;`;
  if (name === "company-seal")
    verify +=
      "\n" +
      login(peer) +
      `\nselect lab008.assert_true(can_cover_instance('${t1}'),'sealed A access'),lab008.assert_true(can_cover_instance('${t2}')=${!ab},'B scope by order');\n` +
      admin;
  return {
    setup,
    A: a + "\n",
    B: b + "\n",
    first: ab ? "A" : "B",
    second: ab ? "B" : "A",
    afterFirst,
    verify,
  };
}
