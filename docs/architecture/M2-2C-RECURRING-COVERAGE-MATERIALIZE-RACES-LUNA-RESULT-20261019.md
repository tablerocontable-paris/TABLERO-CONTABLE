# Luna result — recurring coverage approval vs materialization

Date: 19/10/2026. Local synthetic PostgreSQL only.

## Result

The runner now covers four same-isolation races between
`public.approve_task_coverage_plan` and `api.command_v1(month.materialize)`: both
winner orders under READ COMMITTED and REPEATABLE READ. Every case observed the
winner in `pg_blocking_pids`, received SQLSTATE `40001` on the first attempt by
the blocked operation, and converged after a fresh-session retry with SQLSTATE
`00000`.

The runner now asserts these SQLSTATEs directly. Before retry, approve-first
must show one active rule root, zero occurrences and zero children;
materialize-first must show one occurrence and zero bindings. All four
intermediate-state assertions pass.

Each final state contains exactly one recurring occurrence, one active coverage
rule root and one active child. The child's `source_rule_id` points to that
root. Approval and materialization receipts are present for their own
operation IDs. Snapshots include the assignment and its rule snapshot, plan,
occurrences, bindings, creation and month fences, membership fences, receipts
and related audit events, before the race, after the first attempt and after
retry.

For each case the captured approval integer equals `receipt.result.count`
(`1` approval-first, `2` materialize-first). The materialization response
matches the stored receipt result exactly, including `operationId`, `kind`,
`createdTaskIds` and `creationRevision`; its one task ID matches the sole final
occurrence.

## Validation

- Native runner on PostgreSQL 17.11: 309/309, 0 failures, 0 deadlocks (`40P01`).
- Full Vitest suite: 738/738 in 74 files.
- `npm run build`: exit 0; TypeScript, Vite client and Worker bundle.
- `node --check tests/review/m2-1-native-review.mjs`: exit 0.
- `git diff --check`: exit 0 after the runner and evidence updates.
- SQL011 and SQL014 were not edited. No remote service was called.

Hashes and the complete native report, runner output and PostgreSQL log are
recorded in
`docs/architecture/review-evidence/m2-2c-recurring-coverage-materialize-races-luna-20261019.json`.

## Review boundary

GPT-6.1 Sol accepted these four cases on the hashes recorded in the evidence
manifest; the independent decision and P3 limits are in
`M2-2C-RECURRING-COVERAGE-MATERIALIZE-RACES-SOL-ACCEPTANCE-20261019.md`.
This does not close the remaining §9 cases or Gate L, verify hosted
Supabase/Auth/HTTP, or authorize applying SQL014 remotely.
