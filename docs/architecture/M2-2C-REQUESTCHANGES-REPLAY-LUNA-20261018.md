# `onboarding.requestChanges` replay local block — 18/10/2026

This local SQL014 block authorizes exact replay and `commandReceipt` from the
receipt's immutable submitted version. Both paths take read-only coordination
locks and share-lock actor, owner, and request rows before the final
authorization check. Exact replay also share-locks the receipt-named version
before returning; `commandReceipt` checks that version exists before the
authorization predicate and takes its share lock after that predicate. Neither
path compares mutable draft/status, current catalogue activity, month closure,
company membership, or team membership.

Current policy is rechecked after lock acquisition: an active AAL2 `jefe` keeps
organization-wide access even when the owner is inactive; an AAL2 `encargado`
must remain active, and the owner must remain active with `manager_id` pointing
to that actor. A changed operation id payload remains SQLSTATE `40001`.

Evidence and the native PostgreSQL matrix are recorded in
`review-evidence/m2-2c-onboarding-requestchanges-replay-20261018.json`. The
native report uses a fresh disposable PostgreSQL 17.11 cluster and synthetic
rows. In read-first cases, the unchanged snapshot is checked after the read
while the writer remains blocked, before it commits. In writer-first cases,
the snapshot taken after the writer commit is compared after stale and fresh
denied reads. The runner does not take a later same-transaction snapshot after
a blocked writer is released. The focused read-only comparisons and SQL
inspection support the no-write claim; this timing is a P3 evidence limit.
Sol accepted this scoped block with no P0–P2 findings.

The runner does not apply SQL014 to Supabase or alter any remote environment.

The test block intentionally does not claim a legacy requestChanges fixture;
it checks that replay reads the receipt-named version without validating its
payload against a newer schema. Catalogue deactivation and month closure are
also unmodeled post-submission mutations, recorded as P3 evidence limits.
