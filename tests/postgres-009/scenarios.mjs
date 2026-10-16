// Emits disposable-lab SQL. No network or PostgreSQL execution on import.
export const cases = ["create-create", "revise-revise", "close-note", "deactivate-replay"];
const owner = "10000000-0000-0000-0000-000009000002";
const boss = "10000000-0000-0000-0000-000009000001";
const task = "50000000-0000-0000-0000-000009000001";
const op = (n) => `90000000-0000-0000-0000-000009${String(n).padStart(6, "0")}`;
const quote = (s) => `'${s.replaceAll("'", "''")}'`;
const admin = "reset role; select set_config('request.jwt.claim.sub','',false),set_config('request.jwt.claims','{}',false);";
const login = (actor, aal = "aal1") => `reset role; select set_config('request.jwt.claim.sub','${actor}',false),set_config('request.jwt.claims','{"aal":"${aal}"}',false); set role authenticated;`;
const save = (body, revision, operation) => `public.save_private_block_note('${task}',${quote(body)},${revision},'${operation}')`;
const reject = (sql, expected) => `do $expected$ begin begin ${sql} raise exception 'UNEXPECTED_SUCCESS'; exception when others then if SQLERRM !~ ${quote(expected)} then raise; end if; raise notice 'EXPECTED_REJECTION: %',SQLERRM; end; end $expected$;`;
const step = (actor, sql, expected, aal) => login(actor, aal) + "\nbegin;\n" + (expected ? reject(sql, expected) : sql);
const result = (label, sql) => `insert into lab009.results values('${label}',${sql});`;
const check = (sql, label) => `perform lab009.assert_true((${sql}),${quote(label)});`;
const count = (table, where = "true") => `(select count(*) from public.${table} where ${where})`;

export function scenario(name, order) {
  if (!cases.includes(name) || !["AB", "BA"].includes(order)) throw Error("Unknown case/order");
  const ab = order === "AB";
  let setup = admin, A, B, checks;
  if (name === "create-create" || name === "revise-revise") {
    const edit = name === "revise-revise";
    if (edit) setup += login(owner) + `\nselect ${save("Original", 0, op(90))};\n` + admin;
    const revision = edit ? 1 : 0;
    A = step(owner, result("A", save("A", revision, op(1))), ab ? null : "revisión");
    B = step(owner, result("B", save("B", revision, op(2))), ab ? "revisión" : null);
    checks = [
      check(count("task_private_block_notes") + "=1", "one note"),
      check(`(select body from task_private_block_notes)=${quote(ab ? "A" : "B")}`, "first writer wins"),
      check(count("task_private_block_note_versions") + `=${edit ? 2 : 1}`, "immutable version count"),
      check(count("private_block_note_receipts") + `=${edit ? 2 : 1}`, "no failed receipt"),
    ];
  } else if (name === "close-note") {
    const month = "date_trunc('month',clock_timestamp() at time zone 'America/Argentina/Buenos_Aires')::date";
    A = step(boss, `select public.close_employee_month('${owner}',${month},'009 synthetic closure');`, null, "aal2");
    B = step(owner, result("B", save("Private body must not leak", 0, op(1))), ab ? "mes está cerrado" : null);
    checks = [
      check(count("monthly_closures") + "=1", "one closure"),
      check(count("task_private_block_notes") + `=${ab ? 0 : 1}`, "note respects closure order"),
      check(count("private_block_note_receipts") + `=${ab ? 0 : 1}`, "no rejected receipt"),
      check("not exists(select 1 from period_reports where snapshot::text like '%Private body%')", "no report leak"),
    ];
  } else {
    setup += login(owner) + `\nselect ${save("Original", 0, op(1))};\n` + admin;
    A = admin + `\nbegin;\nselect pg_advisory_xact_lock(hashtextextended('${owner}'||'${op(1)}',0));\nupdate public.profiles set active=false where id='${owner}';`;
    B = step(owner, result("B", save("Original", 0, op(1))), ab ? "Sin permiso" : null);
    checks = [
      check(`(select active from profiles where id='${owner}')=false`, "actor inactive"),
      check(count("task_private_block_note_versions") + "=1", "no new version"),
      check(count("private_block_note_receipts") + "=1", "no new receipt"),
    ];
  }
  checks.push(check("not exists(select 1 from audit_events where action like 'private_block_note.%' and details<>'{}'::jsonb)", "audit contains no body"));
  return { setup, A, B, first: ab ? "A" : "B", second: ab ? "B" : "A", afterFirst: "", verify: admin + "\ndo $verify$ begin\n" + checks.join("\n") + "\nend $verify$;" };
}
