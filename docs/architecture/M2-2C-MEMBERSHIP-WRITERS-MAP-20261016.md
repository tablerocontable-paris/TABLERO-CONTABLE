# M2.2C membership fencing map — accepted local scope R89, 17/10/2026

Scope: M2.2C membership soft-inactivation contract from Sol. Migration 014 is
still local. This inventory tracks active definitions and consumers; it is not
acceptance evidence. The final local cut was accepted by Sol for the scope
listed below. `company_memberships` primary and foreign keys remain unchanged.
Migrations 001–013 remain read-only.

| Family / active entry point | Status in 014 | Local evidence |
| --- | --- | --- |
| Membership state: `company_memberships` | Added `active`, `revision`, `changed_at`, `changed_by`, `access_valid_from`; existing rows remain active and access-unbounded | Focused lifecycle passed; native state transitions appear in `review.json` below |
| Membership history / private receipt | Immutable `app_private.company_membership_events`, private RLS, `companyMembership.setActive`, replay, no-op and expected revision | R89 covers exact replay/no-op, actor-scoped receipt, demotion race, stale RR replay/retry, argument conflicts under RC and fresh RR snapshots, and injected rollback/retry under RC and RR |
| Shared advisory acquisition | 014 replaces active UUID-array and JSON-plan overloads; lock order remains 1101→1102→1103→1104→1105→current profile/fence share locks→rows. Read-only exact replay uses existing actor/footprint fence rows and never creates/increments epochs. Write paths derive organization from durable `profiles` identity (without requiring active status), validate task/profile/month scope, and fail closed on missing/cross-org footprint. Fence FK uses `ON UPDATE CASCADE` only to preserve profile-ID writer behavior; no delete cascade | R62 native PostgreSQL 17.11: 115/115, `40P01=0`; stale replay and inactive-profile legacy pause tests pass |
| Context and access projections | `api.get_context_v1`, `can_access_instance`, `assignments_read`, `api_can_execute`, report predicate, and SQL009 block-note visibility include current membership as applicable; jefe organization authority preserved | R89 synthetic native PostgreSQL covers employee, scoped encargado, jefe AAL1/AAL2, inactive, foreign organization, anon and technical principals; revoked encargado loses legacy block-note and version reads and regains them on restore. Hosted Auth/HTTP is not tested |
| API onboarding/creation | Draft, submit, approval, one-off, assignment and `creationContext` check current active membership; exact creation receipt replay is returned after reauth before stale current catalogue eligibility | Native R29 includes assignment replay after catalogue revise, stale revision `40001`, malformed structure `22023`; full membership replay/revocation matrix pending |
| Month materialization | Inactive memberships and dates before explicit restore are filtered; no backfill is intended | R39 verifies inactive company gets no lapse occurrence, active B gets one, restore/rematerialize remains `0|1`, and materialize-first→revoke blocks, stale-aborts `40001`, retries and preserves the new occurrence (`false|1|1|1|1|1`) |
| Sessions, task revisions, coverage | Revocation plans task/profile/month/graph locks, ends sessions, cancels company coverage, and revises open tasks | R89 covers timer-first/revoke-first with observed blockers, preserves unrelated company/executor sessions, stops only the revoked actor's open session, and tests membership revoke vs coverage cancellation and plan approval/reassignment across RC/RR orderings. Recurrent-rule-specific branch is not separately exercised |
| Legacy writers from 001–013 | JSON `_coordination_acquire(plan)` is replaced and routes legacy writers through shared order/fences; legacy timer uses same month/profile fence | Stale RR timer native case passed. Assignment, responsibility, absence, coverage, movement, transition and other legacy writer revocation cases remain pending |
| Stored reports and snapshots | `can_read_period_report` and `can_read_monthly_closure` deny non-jefe if any represented company is no longer active; persisted snapshots remain literal | R35 direct authenticated RLS: closure/report visible pre-revoke (`1|1`), hidden after one of two company memberships is revoked (`0|0`), jefe still sees both (`1|1`), restore reopens them with identical snapshot text |

## Minimum soft-revocation acceptance matrix

| Case | Status | Evidence / remaining work |
| --- | --- | --- |
| 1. Revoke-first vs approval; stale RR abort and clean retry | Passed | R35: revoke `00000`, blocker, stale approval `40001`, retry `42501`; final `false|1|submitted|0|0|0|1` |
| 2. Approval-first vs soft revoke; blocker, stale RR abort, retry succeeds | Passed | R35: approval `00000`, blocker, stale soft revoke `40001`, retry `00000`; final `false|1|approved|1|1|1|1`, assignment retained. No DELETE/23503 in current path; old DELETE probe is historical only |
| 3. One profile in two companies; only target-company access removed | Passed | R35: context A+B then B; task access `false|true`; A session stop `0|1`, B timer `00000`; A materialization `0`, B `1`; restore leaves `0|1` (no backfill/duplicate) |
| 4. Revoke vs creation and assignment | Passed | R39 proves both orders: revoke-first blocks/stale-aborts assignment `40001`, retry denies `42501` without partial writes; assignment-first blocks/stale-aborts RR revoke `40001`, retry revokes `00000` and retains assignment, receipt and event (`false|1|1|1|1|1`) |
| 5. Revoke vs month materialization | Passed | R39 proves both orders: revoke-first blocks/stale-aborts materialize `40001`, retry creates none; materialize-first blocks/stale-aborts RR revoke `40001`, retry revokes `00000` and preserves occurrence/revision/receipt/event (`false|1|1|1|1|1`) |
| 6. Revoke vs timer with eligible and ineligible sessions | Passed in reviewed local scope | R89 observes timer/revoke blocking in both orders, verifies one actor's session stops once, and confirms unrelated actor/company sessions remain intact; schema allows one open session per actor globally plus an actor+instance uniqueness index |
| 7. Revoke vs movement and transition | Passed in reviewed local scope | R89 verifies record-first/revoke-first and transition-first/revoke-first stale aborts, clean retries, retained contributions and no partial status/receipt writes |
| 8. Revoke vs live coverage cancellation/reassignment | Passed in reviewed local scope | R89 covers cancel-first/revoke-first across RC/RR and approve/reassignment-first/revoke-first across RC/RR, with blockers, stale aborts/retries and final binding/session/event/receipt/fence state. The recurrent-rule-specific branch is not separately exercised |
| 9. Restore; no backfill and no canceled-coverage resurrection | Passed | R35 restore + rematerialize preserves `0|1`; the active coverage binding becomes `cancelled` on revoke and remains `cancelled` after restore (`cancelled|cancelled`) |
| 10. Stored report privacy; snapshot remains literal | Passed | R35 direct authenticated RLS: closure/report `1|1` before, `0|0` after revoke, jefe `1|1`; runner captures stored snapshot text before revoke and asserts exact string equality after restore (not a digest) |
| 11. RLS/API role matrix, including AAL1/AAL2 and other organization | Passed in reviewed local scope | R89 exercises employee, scoped encargado, jefe AAL1/AAL2, inactive profile, O1/O2, anon and technical claims through API/RLS; includes SQL009 note/version revocation. Hosted Auth/HTTP and future M2.5 personal_annotations remain out of scope |
| 12. Replay/no-op/stale/argument conflict/fence rollback and exactly-once event | Passed in reviewed local scope | R89 tests changed active/reason/revision conflicts under RC and fresh RR transactions; injected failure/rollback/retry under matching RC and RR, with identical rollback state and one committed event/audit/receipt |

Latest native evidence:
`review-evidence/m2-2c-membership-r90-20261017.json`, PostgreSQL 17.11,
128/128 passed, `40P01=0`, working-tree migration SHA256
`3ff379002c37c43fb8c91d2b41bd47658d73d0386b2c5bc1518f22c6b4cc86c6`.
Sol accepted only the enumerated SQL014 and runner scenarios/hashes in R90.
The committed SQL blob has SHA256
`7c96727b7f1ecd8c5bb2b457640b824deddc06346da3f1a70e9bdb879e730a56` because
Git normalized CRLF to LF; normalized SQL logic is unchanged. R90 regenerated the
128-case behavior report after correcting a runner comment. The evidence
uses synthetic JWT claims; it is not a hosted Supabase Auth/HTTP test. The full
suite passed 727/727 in 74 files; TypeScript, client build, Worker build, runner
syntax, and `git diff --check` passed. This is a scoped review of the listed R90
scenarios only; it does not close M2.2C or Gate L. Full membership
replay/revocation coverage for API onboarding and creation, revocation behavior
for legacy assignment/responsibility/absence/coverage/movement/transition
writers, the recurrent-rule-specific branch, and the remaining
concurrency/failure-injection families in contract §9 are still pending. Hosted
authentication and the separate Data API exposure preflight are also open
gates. Do not apply 014 or start hosted rehearsal before final C/Gate L
acceptance.
Historical note (superseded 17/10/2026): the focused Vitest result and the
warning that the full suite/builds had not yet run referred to an earlier tree.
The current R90 report and full local checks are recorded above and in
`M2-2C-SOL-ACCEPTANCE-20261017.md`. M2.2C is accepted only for the listed local
scope; hosted Auth/HTTP, recurring-rule-specific coverage, Data API preflight,
and remote application remain separate gates.

## Local follow-up after R90 — 17/10/2026 (scoped acceptance by Sol)

An expanded native case exposed a concrete receipt reauthorization defect:
after an employee's company membership was revoked, exact `onboarding.submit`
replay returned the old receipt (`00000`) instead of denying with `42501`.
Exact `onboarding.saveDraft` replay already denied (`42501`). The cause was
that submit's company/team membership check ran after the exact-receipt return.
The minimal local 014 change repeats active company membership and team
membership checks after the coordination locks and before receipt return for
both saveDraft and submit. The migration remains unapplied remotely.

The first follow-up candidate passed 129/129 but was rejected by Sol because
it used stale request data for replay and had removed the first-execution guard.
The corrected candidate re-reads the request under `FOR UPDATE`, reauthorizes
before receipt return, and preserves the guard after the first-execution
`FOR UPDATE`. PostgreSQL 17.11 passed **130/130**, `40P01=0`; exact replay
observes `42501` for both saveDraft and submit, and the first-submit race
preserves authorization under a stale RR snapshot. Focused Vitest: **11/11**.
Exact commands, hashes, and the
pre-fix repro are recorded in
`review-evidence/m2-2c-gatel-onboarding-replay-20261017.json` and
`M2-2C-GATEL-REPLAY-DEFECT-20261017.md`. Corrected candidate SQL014 SHA256 is
`13e88c8549f969187294367161c3ce6cf458d7f4618ddba40cb5058254982a26`.
The full local suite also passed **727/727 in 74 files**; TypeScript, client
and Worker builds, runner syntax, `git diff --check`, and the unchanged status
of migrations 001–013 were verified on this tree.
The candidate is committed locally; Sol accepted only the
enumerated replay cases. R90 acceptance does not transfer to these changed
hashes. This follow-up closes only the specific exact submit replay case. Gate L remains open: onboarding/creation
replay matrix is not exhaustive; legacy assignment/responsibility/absence/
coverage/movement/transition races, recurrent-rule-specific coverage, and
remaining §9 concurrency/failure-injection families still lack complete native
coverage. No claim is made that the entire §9 matrix ran.
