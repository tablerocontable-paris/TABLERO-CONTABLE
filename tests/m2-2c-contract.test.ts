import { describe, expect, it } from "vitest";
import { decodeCommandResponseV1, decodeCommandV1, decodeQueryV1, decodeQueryResponseV1, definitionV2Schema, onboardingDraftV2Schema } from "../src/data/supabase/operational-contract";
import { AccountingLab, ids, stages } from "./helpers/accounting-lab";

const id = (n: number) => `00000000-0000-0000-0000-${String(n).padStart(12, "0")}`;
const schedule: { frequency: string; startDate: string; endDate: string | null; interval: number; weekdays: number[]; monthDay: number | null; hasDeadline: boolean; dueOffsetDays: number } = { frequency: "unica", startDate: "2026-10-20", endDate: "2026-10-20", interval: 1, weekdays: [], monthDay: 20, hasDeadline: true, dueOffsetDays: 0 };

describe("M2.2C versioned creation protocol", () => {
  it("keeps operative v2 free of weight and target while accepting exact result definitions", () => {
    const operative = { kind: "operativa", title: "Conciliar", objective: "", sector: "Impuestos", unit: "comprobantes" };
    expect(definitionV2Schema.safeParse(operative).success).toBe(true);
    expect(definitionV2Schema.safeParse({ ...operative, weight: "1" }).success).toBe(false);
    expect(definitionV2Schema.safeParse({ ...operative, target: 1 }).success).toBe(false);
    expect(definitionV2Schema.safeParse({ ...operative, unit: "x".repeat(81) }).success).toBe(false);
    expect(definitionV2Schema.safeParse({ kind: "resultado", title: "Presentar", objective: "", sector: "IVA", weight: "12.500000", checklist: [{ id: id(1), text: "Verificar" }] }).success).toBe(true);
    expect(definitionV2Schema.safeParse({ kind: "resultado", title: "Presentar", objective: "", sector: "IVA", weight: "0", checklist: [] }).success).toBe(false);
  });

  it("requires schemaVersion 2, exact line keys, and one-off custom work", () => {
    const draft = { schemaVersion: 2, lines: [{ lineId: id(1), companyId: id(2), teamId: id(3), source: { type: "custom", definition: { kind: "operativa", title: "Conciliar", objective: "", sector: "Impuestos", unit: "comprobantes" } }, schedule }] };
    expect(onboardingDraftV2Schema.safeParse(draft).success).toBe(true);
    expect(onboardingDraftV2Schema.safeParse({ ...draft, schemaVersion: 1 }).success).toBe(false);
    expect(onboardingDraftV2Schema.safeParse({ ...draft, lines: [{ ...draft.lines[0], privateNote: "no" }] }).success).toBe(false);
    expect(onboardingDraftV2Schema.safeParse({ ...draft, lines: [{ ...draft.lines[0], schedule: { ...schedule, frequency: "mensual", endDate: null } }] }).success).toBe(false);
  });

  it("accepts exact C command, query, and receipt DTOs", () => {
    const org = id(99);
    const command = { contractVersion: 1, operationId: id(90), kind: "catalogue.create", expectedRevisions: { [`catalogue:${org}`]: "0" }, payload: { definition: { kind: "operativa", title: "Conciliar", objective: "", sector: "Impuestos", unit: "comprobantes" }, effectiveOn: "2026-10-16", reason: "Alta aprobada" } };
    expect(decodeCommandV1(command).ok).toBe(true);
    expect(decodeCommandV1({ ...command, expectedRevisions: { [`catalogue:${org}`]: "0", extra: "0" } }).ok).toBe(false);
    expect(decodeCommandV1({ ...command, payload: { ...command.payload, custom: true } }).ok).toBe(false);
    expect(decodeCommandResponseV1({ contractVersion: 1, operationId: id(90), kind: "catalogue.create", result: { templateId: id(1), versionId: id(2), version: "1", catalogueRevision: "1" } }).ok).toBe(true);
    expect(decodeQueryV1({ contractVersion: 1, kind: "ownOnboarding", filters: {}, cursor: null, limit: 1 }).ok).toBe(true);
    expect(decodeQueryV1({ contractVersion: 1, kind: "creationContext", filters: { ownerId: id(1) }, cursor: "bad", limit: 1 }).ok).toBe(false);
    expect(decodeQueryResponseV1({ contractVersion: 1, kind: "ownOnboarding", data: { ownerRevision: "0", request: null } }).ok).toBe(true);
    const oneOff = { contractVersion: 1, operationId: id(91), kind: "task.createOneOff", expectedRevisions: { [`creation:${id(1)}`]: "0", [`catalogue:${id(2)}`]: "3" }, payload: { ownerId: id(1), companyId: id(3), teamId: id(4), source: { type: "catalogue", templateVersionId: id(5) }, scheduledOn: "2026-10-16", dueDate: null, priority: "Media" } };
    expect(decodeCommandV1(oneOff).ok).toBe(true);
    expect(decodeCommandV1({ ...oneOff, expectedRevisions: { ...oneOff.expectedRevisions, extra: "0" } }).ok).toBe(false);
    const membership = { contractVersion: 1, operationId: id(92), kind: "companyMembership.setActive", expectedRevisions: { [`membership:${id(3)}:${id(4)}`]: "0" }, payload: { companyId: id(3), profileId: id(4), active: false, reason: "Baja solicitada" } };
    expect(decodeCommandV1(membership).ok).toBe(true);
    expect(decodeCommandV1({ ...membership, expectedRevisions: { extra: "0" } }).ok).toBe(false);
    expect(decodeCommandResponseV1({ contractVersion: 1, operationId: id(92), kind: "companyMembership.setActive", result: { companyId: id(3), profileId: id(4), active: false, membershipRevision: "1" } }).ok).toBe(true);
  });

  it("soft-inactivates memberships with event, revision, fence, exact replay, no-op, and explicit restore", async () => {
    const lab = await new AccountingLab().init(stages.m014);
    try {
      await lab.actor(ids.boss, "aal2", "authenticated");
      const setActive = (operationId: number, active: boolean, revision: number) => ({ contractVersion: 1, operationId: id(operationId), kind: "companyMembership.setActive", expectedRevisions: { [`membership:${ids.company}:${ids.owner}`]: String(revision) }, payload: { companyId: ids.company, profileId: ids.owner, active, reason: "Cambio autorizado" } });
      const revoke = setActive(970, false, 0);
      const first = (await lab.first("select api.command_v1($1::jsonb) result", [JSON.stringify(revoke)])).result;
      expect(first.result).toMatchObject({ companyId: ids.company, profileId: ids.owner, active: false, membershipRevision: "1" });
      await lab.admin();
      expect(await lab.first("select active,revision,access_valid_from from company_memberships where company_id=$1 and profile_id=$2", [ids.company, ids.owner])).toMatchObject({ active: false, revision: 1 });
      expect(await lab.first("select count(*)::integer count from app_private.company_membership_events where company_id=$1 and profile_id=$2", [ids.company, ids.owner])).toEqual({ count: 1 });
      expect(await lab.first("select fence_epoch from app_private.api_membership_fences where organization_id=$1 and profile_id=$2", [ids.org, ids.owner])).toEqual({ fence_epoch: 1 });
      expect(await lab.first("select details ? 'reason' has_reason from audit_events where actor_id=$1 and action='companyMembership.setActive'", [ids.boss])).toEqual({ has_reason: false });
      await lab.actor(ids.boss, "aal2", "authenticated");
      expect((await lab.first("select api.command_v1($1::jsonb) result", [JSON.stringify(revoke)])).result).toEqual(first);
      await lab.admin();
      expect(await lab.first("select count(*)::integer count from app_private.company_membership_events where company_id=$1 and profile_id=$2", [ids.company, ids.owner])).toEqual({ count: 1 });
      await lab.actor(ids.owner, "aal1", "authenticated");
      const context = (await lab.first("select api.get_context_v1() result")).result;
      expect(context.principal.companyIds).not.toContain(ids.company);
      const denied = await lab.rows("select api.query_v1($1::jsonb)", [JSON.stringify({ contractVersion: "1", kind: "ownOnboarding", filters: {}, cursor: null, limit: 1 })]).catch((error: { code?: string }) => error);
      expect((denied as { code?: string }).code).toBe("22023");
      await lab.actor(ids.boss, "aal2", "authenticated");
      const restore = setActive(971, true, 1);
      const restored = (await lab.first("select api.command_v1($1::jsonb) result", [JSON.stringify(restore)])).result;
      expect(restored.result).toMatchObject({ active: true, membershipRevision: "2" });
      await lab.admin();
      expect(await lab.first("select active,revision,access_valid_from is not null restored_at from company_memberships where company_id=$1 and profile_id=$2", [ids.company, ids.owner])).toEqual({ active: true, revision: 2, restored_at: true });
      const noOp = setActive(972, true, 2);
      await lab.actor(ids.boss, "aal2", "authenticated");
      expect((await lab.first("select api.command_v1($1::jsonb) result", [JSON.stringify(noOp)])).result.result.membershipRevision).toBe("2");
      await lab.admin();
      expect(await lab.first("select fence_epoch from app_private.api_membership_fences where organization_id=$1 and profile_id=$2", [ids.org, ids.owner])).toEqual({ fence_epoch: 2 });
      expect(await lab.first("select count(*)::integer count from app_private.company_membership_events where company_id=$1 and profile_id=$2", [ids.company, ids.owner])).toEqual({ count: 2 });
      await lab.actor(ids.boss, "aal2", "authenticated");
      expect((await lab.first("select api.command_v1($1::jsonb) result", [JSON.stringify(revoke)])).result).toEqual(first);
    } finally { await lab.close(); }
  }, 20_000);

  it("rejects JSON string versions and non-string checklist UUIDs at the SQL boundary", async () => {
    const lab = await new AccountingLab().init(stages.m014);
    try {
      await lab.actor(ids.boss, "aal2", "authenticated");
      const query = await lab.rows("select api.query_v1($1::jsonb)", [JSON.stringify({ contractVersion: "1", kind: "cataloguePage", filters: { kind: null, active: true }, cursor: null, limit: 1 })]).catch((error: { code?: string }) => error);
      expect((query as { code?: string }).code).toBe("22023");
      const malformed = { contractVersion: 1, operationId: id(973), kind: "catalogue.create", expectedRevisions: { [`catalogue:${ids.org}`]: "0" }, payload: { definition: { kind: "resultado", title: "Presentación", objective: "", sector: "IVA", weight: "10", checklist: [{ id: null, text: "Controlar" }] }, effectiveOn: lab.day, reason: "Prueba de tipo" } };
      const error = await lab.rows("select api.command_v1($1::jsonb)", [JSON.stringify(malformed)]).catch((cause: { code?: string }) => cause);
      expect((error as { code?: string }).code).toBe("22023");
      const badSchema = { contractVersion: 1, operationId: id(974), kind: "onboarding.saveDraft", expectedRevisions: { [`onboardingOwner:${ids.owner}`]: "0" }, payload: { requestId: null, draft: { schemaVersion: "2", lines: [] } } };
      await lab.actor(ids.owner, "aal1", "authenticated");
      const draftError = await lab.rows("select api.command_v1($1::jsonb)", [JSON.stringify(badSchema)]).catch((cause: { code?: string }) => cause);
      expect((draftError as { code?: string }).code).toBe("22023");
    } finally { await lab.close(); }
  }, 20_000);

  it("keeps legacy rows at definition v1 and blocks legacy month closure for v2 even without activity", async () => {
    const lab = await new AccountingLab().init(stages.m014);
    try {
      const task = await lab.task({ kind: "operativa", period: lab.period });
      const assignment = (await lab.first("select assignment_id from task_instances where id=$1", [task])).assignment_id as string;
      expect(await lab.first("select measurement_version from task_assignments where id=$1", [assignment])).toEqual({ measurement_version: 1 });
      expect(await lab.first("select measurement_version from task_instances where id=$1", [task])).toEqual({ measurement_version: 1 });
      await lab.admin();
      await lab.db.exec("begin");
      await lab.db.query("update task_assignments set measurement_version=2,weight=null,target=null,checklist='[]'::jsonb where id=$1", [assignment]);
      await lab.db.query("update task_instances set measurement_version=2,weight=null,target=null,checklist='[]'::jsonb where id=$1", [task]);
      await lab.expectError(
        "insert into monthly_closures(id,organization_id,owner_id,period,snapshot,closed_by,note) values($1,$2,$3,$4,'{}'::jsonb,$5,'Revisión')",
        [id(900), ids.org, ids.owner, lab.period, ids.boss],
        /GP_V2_REQUIRES_COMPANY_CLOSE/,
      );
      await lab.expectError("update task_instances set weight=0 where id=$1", [task], /task_instances_measurement_shape/);
      await lab.db.exec("commit");
    } finally {
      await lab.close();
    }
  }, 20_000);

  it("creates and replays a versioned v2 catalogue entry under boss AAL2", async () => {
    const lab = await new AccountingLab().init(stages.m014);
    try {
      await lab.actor(ids.boss, "aal2", "authenticated");
      const command = { contractVersion: 1, operationId: id(910), kind: "catalogue.create", expectedRevisions: { [`catalogue:${ids.org}`]: "0" }, payload: { definition: { kind: "operativa", title: "Conciliación operativa", objective: "", sector: "Impuestos", unit: "comprobantes" }, effectiveOn: "2026-10-16", reason: "Alta de catálogo" } };
      await lab.db.exec("begin");
      const first = (await lab.first("select api.command_v1($1::jsonb) result", [JSON.stringify(command)])).result;
      expect(first).toMatchObject({ kind: "catalogue.create", result: { version: "1", catalogueRevision: "1" } });
      expect((await lab.first("select api.command_v1($1::jsonb) result", [JSON.stringify(command)])).result).toEqual(first);
      const row = await lab.first("select t.measurement_version,t.weight,t.monthly_target,t.unit,t.checklist,v.effective_on::text effective_on,v.created_by,v.reason from task_templates t join task_template_versions v on v.template_id=t.id where t.id=$1", [first.result.templateId]);
      expect(row).toEqual({ measurement_version: 2, weight: null, monthly_target: null, unit: "comprobantes", checklist: [], effective_on: "2026-10-16", created_by: ids.boss, reason: "Alta de catálogo" });
      const standardDraft = (scheduleOverride: typeof schedule) => ({ schemaVersion: 2, lines: [{ lineId: id(920), companyId: ids.company, teamId: ids.team, source: { type: "catalogue", templateVersionId: first.result.versionId }, schedule: scheduleOverride }] });
      await lab.admin();
      await lab.expectError("select app_private.api_validate_onboarding_v2($1::jsonb,false,$2::uuid)", [JSON.stringify(standardDraft({ ...schedule, startDate: "2026-10-15", endDate: "2026-10-15" })), ids.org], /Estándar no elegible/);
      await lab.expectError("select app_private.api_validate_onboarding_v2($1::jsonb,false,$2::uuid)", [JSON.stringify(standardDraft({ ...schedule, frequency: "semanal", endDate: null, weekdays: [1, 1] })), ids.org], /Calendario inválido/);
      await lab.actor(ids.boss, "aal2", "authenticated");
      await lab.expectError("select api.command_v1($1::jsonb)", [JSON.stringify({ ...command, payload: { ...command.payload, reason: "Parámetros diferentes" } })], /Identificador de operación ya utilizado/);
      const revised = { ...command, operationId: id(912), kind: "catalogue.revise", expectedRevisions: { [`catalogue:${ids.org}`]: "1", [`catalogue:${first.result.templateId}`]: "1" }, payload: { templateId: first.result.templateId, definition: { kind: "operativa", title: "Conciliación operativa", objective: "", sector: "Impuestos", unit: "documentos" }, effectiveOn: "2026-10-17", reason: "Unidad actualizada" } };
      const revisionResult = (await lab.first("select api.command_v1($1::jsonb) result", [JSON.stringify(revised)])).result;
      expect(revisionResult.result).toMatchObject({ version: "2", catalogueRevision: "2" });
      const resultDefinition = { kind: "resultado", title: "Presentar IVA", objective: "", sector: "Impuestos", weight: "10.5", checklist: [] };
      const resultCommand = { ...command, operationId: id(913), expectedRevisions: { [`catalogue:${ids.org}`]: "2" }, payload: { definition: resultDefinition, effectiveOn: "2026-10-16", reason: "Alta resultado" } };
      const resultCreated = (await lab.first("select api.command_v1($1::jsonb) result", [JSON.stringify(resultCommand)])).result;
      const weightCommand = { ...command, operationId: id(914), kind: "catalogue.weight", expectedRevisions: { [`catalogue:${ids.org}`]: "3", [`catalogue:${resultCreated.result.templateId}`]: "1" }, payload: { templateId: resultCreated.result.templateId, weight: "12.25", effectiveOn: "2026-10-17", reason: "Peso actualizado" } };
      expect((await lab.first("select api.command_v1($1::jsonb) result", [JSON.stringify(weightCommand)])).result.result).toMatchObject({ version: "2", catalogueRevision: "4" });
      const changedWeight = await lab.first("select weight::text weight from task_template_versions where template_id=$1 order by version desc limit 1", [resultCreated.result.templateId]);
      expect(changedWeight.weight).toBe("12.25");
      await lab.first("select api.command_v1($1::jsonb) result", [JSON.stringify({ ...weightCommand, operationId: id(915), expectedRevisions: { [`catalogue:${ids.org}`]: "4", [`catalogue:${resultCreated.result.templateId}`]: "2" }, payload: { ...weightCommand.payload, weight: "13.5", effectiveOn: "2026-10-18", reason: "Segundo ajuste" } })]);
      const query = async (kind: string, filters: unknown, cursor: string | null = null, limit = 1) => lab.first("select api.query_v1($1::jsonb) result", [JSON.stringify({ contractVersion: 1, kind, filters, cursor, limit })]);
      const receipt = (await query("commandReceipt", { operationId: id(910) })).result;
      expect(receipt.data).toMatchObject({ found: true, command: first });
      const pageOne = (await query("cataloguePage", { kind: null, active: true })).result;
      expect(pageOne.data.items).toHaveLength(1);
      expect(pageOne.data.nextCursor).toEqual(expect.any(String));
      const pageTwo = (await query("cataloguePage", { kind: null, active: true }, pageOne.data.nextCursor)).result;
      expect(pageTwo.data.items).toHaveLength(1);
      expect(pageTwo.data.nextCursor).toBeNull();
      const historyOne = (await query("catalogueHistory", { templateId: resultCreated.result.templateId })).result;
      expect(historyOne.data.items).toHaveLength(1);
      expect(historyOne.data.nextCursor).toEqual(expect.any(String));
      const historyTwo = (await query("catalogueHistory", { templateId: resultCreated.result.templateId }, historyOne.data.nextCursor)).result;
      expect(historyTwo.data.items[0].version).toBe("2");
      expect(historyTwo.data.nextCursor).toEqual(expect.any(String));
      const historyThree = (await query("catalogueHistory", { templateId: resultCreated.result.templateId }, historyTwo.data.nextCursor)).result;
      expect(historyThree.data.items[0].version).toBe("1");
      expect(historyThree.data.nextCursor).toBeNull();
      await lab.first("select api.command_v1($1::jsonb) result", [JSON.stringify({ ...weightCommand, operationId: id(916), expectedRevisions: { [`catalogue:${ids.org}`]: "5", [`catalogue:${resultCreated.result.templateId}`]: "3" }, payload: { ...weightCommand.payload, weight: "14", effectiveOn: "2026-10-19", reason: "Cambio posterior a consulta" } })]);
      const staleCatalogPage = await lab.rows("select api.query_v1($1::jsonb)", [JSON.stringify({ contractVersion: 1, kind: "cataloguePage", filters: { kind: null, active: true }, cursor: pageOne.data.nextCursor, limit: 1 })]).catch((error: { code?: string }) => error);
      expect((staleCatalogPage as { code?: string }).code).toBe("40001");
      await lab.db.exec("commit");
      await lab.actor(ids.boss, "aal1", "authenticated");
      const denied = await lab.rows("select api.command_v1($1::jsonb)", [JSON.stringify({ ...command, operationId: id(911), expectedRevisions: { [`catalogue:${ids.org}`]: "1" } })]).catch((error: { code?: string }) => error);
      expect((denied as { code?: string }).code).toBe("42501");
    } finally {
      await lab.close();
    }
  }, 20_000);

  it("saves a private v2 draft, submits a version, and routes authorized inbox queries", async () => {
    const lab = await new AccountingLab().init(stages.m014);
    try {
      const draft = { schemaVersion: 2, lines: [{ lineId: id(930), companyId: ids.company, teamId: ids.team, source: { type: "custom", definition: { kind: "operativa", title: "Revisión puntual", objective: "", sector: "IVA", unit: "comprobantes" } }, schedule }] };
      await lab.actor(ids.owner, "aal1", "authenticated");
      const save = { contractVersion: 1, operationId: id(931), kind: "onboarding.saveDraft", expectedRevisions: { [`onboardingOwner:${ids.owner}`]: "0" }, payload: { requestId: null, draft } };
      const saved = (await lab.first("select api.command_v1($1::jsonb) result", [JSON.stringify(save)])).result;
      expect(saved).toMatchObject({ kind: "onboarding.saveDraft", result: { revision: "0", draftRevision: "1", status: "draft" } });
      const requestId = saved.result.requestId as string;
      expect((await lab.first("select api.command_v1($1::jsonb) result", [JSON.stringify(save)])).result).toEqual(saved);
      const own = (await lab.first("select api.query_v1($1::jsonb) result", [JSON.stringify({ contractVersion: 1, kind: "ownOnboarding", filters: {}, cursor: null, limit: 1 })])).result;
      expect(own.data.request.draft).toEqual(draft);
      const submit = { contractVersion: 1, operationId: id(932), kind: "onboarding.submit", expectedRevisions: { [`onboarding:${requestId}`]: "0", [`onboardingDraft:${requestId}`]: "1" }, payload: { requestId } };
      const submitted = (await lab.first("select api.command_v1($1::jsonb) result", [JSON.stringify(submit)])).result;
      expect(submitted).toMatchObject({ kind: "onboarding.submit", result: { requestId, revision: "1", draftRevision: "1", status: "submitted" } });
      expect(await lab.first("select count(*)::integer count from onboarding_request_versions where request_id=$1", [requestId])).toEqual({ count: 1 });
      await lab.admin();
      await lab.db.query("update company_memberships set active=false,revision=revision+1 where organization_id=$1 and company_id=$2 and profile_id=$3", [ids.org, ids.company, ids.owner]);
      await lab.actor(ids.owner, "aal1", "authenticated");
      const revokedSubmitReplay = await lab.rows("select api.command_v1($1::jsonb)", [JSON.stringify(submit)]).then(() => null, (error: { code?: string }) => error);
      expect(revokedSubmitReplay).not.toBeNull();
      expect((revokedSubmitReplay as { code?: string } | null)?.code).toBe("42501");
      await lab.admin();
      await lab.db.query("update company_memberships set active=true,revision=revision+1 where organization_id=$1 and company_id=$2 and profile_id=$3", [ids.org, ids.company, ids.owner]);
      await lab.actor(ids.peer, "aal1", "authenticated");
      const peerDraft = { schemaVersion: 2, lines: [{ lineId: id(934), companyId: ids.otherCompany, teamId: ids.team, source: { type: "custom", definition: { kind: "operativa", title: "Carga puntual", objective: "", sector: "IVA", unit: "comprobantes" } }, schedule }] };
      const peerSave = { contractVersion: 1, operationId: id(935), kind: "onboarding.saveDraft", expectedRevisions: { [`onboardingOwner:${ids.peer}`]: "0" }, payload: { requestId: null, draft: peerDraft } };
      const peerSaved = (await lab.first("select api.command_v1($1::jsonb) result", [JSON.stringify(peerSave)])).result;
      const peerRequestId = peerSaved.result.requestId as string;
      const peerSubmit = { contractVersion: 1, operationId: id(936), kind: "onboarding.submit", expectedRevisions: { [`onboarding:${peerRequestId}`]: "0", [`onboardingDraft:${peerRequestId}`]: "1" }, payload: { requestId: peerRequestId } };
      await lab.admin();
      await lab.db.query("update company_memberships set active=false,revision=revision+1 where organization_id=$1 and company_id=$2 and profile_id=$3", [ids.org, ids.otherCompany, ids.peer]);
      await lab.actor(ids.peer, "aal1", "authenticated");
      const firstSubmitAfterRevoke = await lab.rows("select api.command_v1($1::jsonb)", [JSON.stringify(peerSubmit)]).then(() => null, (error: { code?: string }) => error);
      expect((firstSubmitAfterRevoke as { code?: string } | null)?.code).toBe("42501");
      expect(await lab.first("select count(*)::integer count from onboarding_request_versions where request_id=$1", [peerRequestId])).toEqual({ count: 0 });
      await lab.admin();
      await lab.db.query("update company_memberships set active=true,revision=revision+1 where organization_id=$1 and company_id=$2 and profile_id=$3", [ids.org, ids.otherCompany, ids.peer]);
      await lab.actor(ids.peer, "aal1", "authenticated");
      await lab.first("select api.command_v1($1::jsonb) result", [JSON.stringify(peerSubmit)]);
      await lab.actor(ids.boss, "aal2", "authenticated");
      const inbox = (await lab.first("select api.query_v1($1::jsonb) result", [JSON.stringify({ contractVersion: 1, kind: "parameterInbox", filters: { status: "submitted", ownerId: null }, cursor: null, limit: 20 })])).result;
      expect(inbox.data.items).toHaveLength(2);
      expect(inbox.data.items).toContainEqual(expect.objectContaining({ requestId, ownerId: ids.owner, payloadVersion: 2, payload: draft }));
      expect(inbox.data.items).toContainEqual(expect.objectContaining({ requestId: peerRequestId, ownerId: ids.peer, payloadVersion: 2, payload: peerDraft }));
      const pageOne = (await lab.first("select api.query_v1($1::jsonb) result", [JSON.stringify({ contractVersion: 1, kind: "parameterInbox", filters: { status: "submitted", ownerId: null }, cursor: null, limit: 1 })])).result;
      expect(pageOne.data.items).toHaveLength(1);
      expect(pageOne.data.nextCursor).toEqual(expect.any(String));
      const pageTwo = (await lab.first("select api.query_v1($1::jsonb) result", [JSON.stringify({ contractVersion: 1, kind: "parameterInbox", filters: { status: "submitted", ownerId: null }, cursor: pageOne.data.nextCursor, limit: 1 })])).result;
      expect(pageTwo.data.items).toHaveLength(1);
      expect(pageTwo.data.items[0].requestId).not.toBe(pageOne.data.items[0].requestId);
      expect(pageTwo.data.nextCursor).toBeNull();
      await lab.actor(ids.manager, "aal2", "authenticated");
      const change = { contractVersion: 1, operationId: id(933), kind: "onboarding.requestChanges", expectedRevisions: { [`onboarding:${requestId}`]: "1" }, payload: { requestId, reason: "Falta aclarar el alcance" } };
      expect((await lab.first("select api.command_v1($1::jsonb) result", [JSON.stringify(change)])).result.result.status).toBe("changes_requested");
      expect(await lab.first("select count(*)::integer count from audit_events where entity_id=$1 and details::text like '%Falta aclarar%'", [requestId])).toEqual({ count: 0 });
      const context = (await lab.first("select api.query_v1($1::jsonb) result", [JSON.stringify({ contractVersion: 1, kind: "creationContext", filters: { ownerId: ids.owner }, cursor: null, limit: 1 })])).result;
      expect(context.data).toMatchObject({ ownerId: ids.owner, companies: expect.arrayContaining([{ id: ids.company, name: "A" }]), teams: [{ id: ids.team, name: "Team" }] });
      const outsideContext = await lab.rows("select api.query_v1($1::jsonb)", [JSON.stringify({ contractVersion: 1, kind: "creationContext", filters: { ownerId: ids.peer }, cursor: null, limit: 1 })]).catch((error: { code?: string }) => error);
      expect((outsideContext as { code?: string }).code).toBe("42501");
      await lab.actor(ids.boss, "aal1", "authenticated");
      const denied = await lab.rows("select api.query_v1($1::jsonb)", [JSON.stringify({ contractVersion: 1, kind: "parameterInbox", filters: { status: "changes_requested", ownerId: null }, cursor: null, limit: 20 })]).catch((error: { code?: string }) => error);
      expect((denied as { code?: string }).code).toBe("42501");
    } finally { await lab.close(); }
  }, 20_000);

  it("approves a submitted v2 request atomically and replays its receipt", async () => {
    const lab = await new AccountingLab().init(stages.m014);
    try {
      const draft = { schemaVersion: 2, lines: [{ lineId: id(940), companyId: ids.company, teamId: ids.team, source: { type: "custom", definition: { kind: "operativa", title: "Revisión puntual", objective: "", sector: "IVA", unit: "comprobantes" } }, schedule: { ...schedule, startDate: lab.day, endDate: lab.day, monthDay: Number(lab.day.slice(-2)) } }] };
      await lab.actor(ids.peer, "aal1", "authenticated");
      const save = { contractVersion: 1, operationId: id(941), kind: "onboarding.saveDraft", expectedRevisions: { [`onboardingOwner:${ids.peer}`]: "0" }, payload: { requestId: null, draft } };
      const saved = (await lab.first("select api.command_v1($1::jsonb) result", [JSON.stringify(save)])).result;
      const requestId = saved.result.requestId as string;
      const submit = { contractVersion: 1, operationId: id(942), kind: "onboarding.submit", expectedRevisions: { [`onboarding:${requestId}`]: "0", [`onboardingDraft:${requestId}`]: "1" }, payload: { requestId } };
      const submitted = (await lab.first("select api.command_v1($1::jsonb) result", [JSON.stringify(submit)])).result;
      expect(submitted.result.status).toBe("submitted");
      await lab.actor(ids.boss, "aal2", "authenticated");
      expect(await lab.rows("select draft_payload from onboarding_requests where id=$1", [requestId])).toEqual([]);
      expect(await lab.rows("select * from onboarding_progress where profile_id=$1", [ids.peer])).toEqual([]);
      const approve = { contractVersion: 1, operationId: id(943), kind: "onboarding.approve", expectedRevisions: { [`onboarding:${requestId}`]: "1" }, payload: { requestId, weightOverrides: [], period: lab.period } };
      await lab.actor(ids.boss, "aal1", "authenticated");
      const denied = await lab.rows("select api.command_v1($1::jsonb)", [JSON.stringify(approve)]).catch((error: { code?: string }) => error);
      expect((denied as { code?: string }).code).toBe("42501");
      await lab.admin();
      await lab.db.query("delete from team_members where organization_id=$1 and team_id=$2 and profile_id=$3", [ids.org, ids.team, ids.peer]);
      await lab.actor(ids.boss, "aal2", "authenticated");
      const revoked = await lab.rows("select api.command_v1($1::jsonb)", [JSON.stringify(approve)]).catch((error: { code?: string }) => error);
      expect((revoked as { code?: string }).code).toBe("42501");
      await lab.admin();
      expect(await lab.first("select status from onboarding_requests where id=$1", [requestId])).toEqual({ status: "submitted" });
      expect(await lab.first("select count(*)::integer count from onboarding_activations where request_id=$1", [requestId])).toEqual({ count: 0 });
      expect(await lab.first("select count(*)::integer count from app_private.api_command_receipts where actor_id=$1 and operation_id=$2", [ids.boss, id(943)])).toEqual({ count: 0 });
      await lab.db.query("insert into team_members(organization_id,team_id,profile_id) values($1,$2,$3)", [ids.org, ids.team, ids.peer]);
      await lab.actor(ids.boss, "aal2", "authenticated");
      const first = (await lab.first("select api.command_v1($1::jsonb) result", [JSON.stringify(approve)])).result;
      expect(first.result).toMatchObject({ requestId, revision: "1", status: "approved", activationCount: 1 });
      expect((await lab.first("select api.command_v1($1::jsonb) result", [JSON.stringify(approve)])).result).toEqual(first);
      await lab.admin();
      expect(await lab.first("select status from onboarding_requests where id=$1", [requestId])).toEqual({ status: "approved" });
      expect(await lab.first("select count(*)::integer count from onboarding_activations where request_id=$1", [requestId])).toEqual({ count: 1 });
      expect(await lab.first("select count(*)::integer count from task_assignments where owner_id=$1 and title='Revisión puntual'", [ids.peer])).toEqual({ count: 1 });
      expect(await lab.first("select revision from app_private.api_creation_heads where organization_id=$1 and owner_id=$2", [ids.org, ids.peer])).toEqual({ revision: 1 });
    } finally { await lab.close(); }
  }, 20_000);

  it("creates a private one-off v2 operative occurrence and replays it", async () => {
    const lab = await new AccountingLab().init(stages.m014);
    try {
      await lab.actor(ids.owner, "aal1", "authenticated");
      const task = { contractVersion: 1, operationId: id(950), kind: "task.createOneOff", expectedRevisions: { [`creation:${ids.owner}`]: "0" }, payload: { ownerId: ids.owner, companyId: ids.company, teamId: ids.team, source: { type: "custom", definition: { kind: "operativa", title: "Presentación puntual", objective: "", sector: "IVA", unit: "comprobantes" } }, scheduledOn: lab.day, dueDate: null, priority: "Alta" } };
      const first = (await lab.first("select api.command_v1($1::jsonb) result", [JSON.stringify(task)])).result;
      expect(first.result).toMatchObject({ assignmentId: expect.any(String), taskId: expect.any(String), taskRevision: "0" });
      expect((await lab.first("select api.command_v1($1::jsonb) result", [JSON.stringify(task)])).result).toEqual(first);
      await lab.admin();
      expect(await lab.first("select kind,measurement_version,weight,unit,target,priority from task_instances where id=$1", [first.result.taskId])).toEqual({ kind: "operativa", measurement_version: 2, weight: null, unit: "comprobantes", target: null, priority: "Alta" });
      expect(await lab.first("select frequency from task_assignments where id=$1", [first.result.assignmentId])).toEqual({ frequency: "unica" });
      await lab.actor(ids.owner, "aal1", "authenticated");
      const resultTask = { contractVersion: 1, operationId: id(951), kind: "task.createOneOff", expectedRevisions: { [`creation:${ids.owner}`]: "1" }, payload: { ownerId: ids.owner, companyId: ids.company, teamId: ids.team, source: { type: "custom", definition: { kind: "resultado", title: "Presentar DDJJ", objective: "", sector: "IVA", weight: "12.5", checklist: [] } }, scheduledOn: lab.day, dueDate: null, priority: "Media" } };
      const resultMade = (await lab.first("select api.command_v1($1::jsonb) result", [JSON.stringify(resultTask)])).result;
      await lab.admin();
      expect(await lab.first("select kind,measurement_version,weight from task_assignments where id=$1", [resultMade.result.assignmentId])).toEqual({ kind: "resultado", measurement_version: 1, weight: "1" });
      expect(await lab.first("select pending from app_private.assignment_parameterization where assignment_id=$1", [resultMade.result.assignmentId])).toEqual({ pending: true });
      await lab.db.query("update profiles set active=false where id=$1 and organization_id=$2", [ids.owner, ids.org]);
      await lab.actor(ids.owner, "aal1", "authenticated");
      const receiptQuery = { contractVersion: 1, kind: "commandReceipt", filters: { operationId: id(950) }, cursor: null, limit: 1 };
      const receiptDenied = await lab.rows("select api.query_v1($1::jsonb)", [JSON.stringify(receiptQuery)]).catch((error: { code?: string }) => error);
      expect((receiptDenied as { code?: string }).code).toBe("42501");
      const replayDenied = await lab.rows("select api.command_v1($1::jsonb)", [JSON.stringify(task)]).catch((error: { code?: string }) => error);
      expect((replayDenied as { code?: string }).code).toBe("42501");
    } finally { await lab.close(); }
  }, 20_000);

  it("creates a scheduled v2 assignment and materializes it exactly once", async () => {
    const lab = await new AccountingLab().init(stages.m014);
    try {
      await lab.actor(ids.boss, "aal2", "authenticated");
      const standard = { contractVersion: 1, operationId: id(958), kind: "catalogue.create", expectedRevisions: { [`catalogue:${ids.org}`]: "0" }, payload: { definition: { kind: "operativa", title: "Control mensual estándar", objective: "", sector: "IVA", unit: "comprobantes" }, effectiveOn: lab.day, reason: "Alta para asignación" } };
      const standardResult = (await lab.first("select api.command_v1($1::jsonb) result", [JSON.stringify(standard)])).result;
      const schedule = { frequency: "mensual", startDate: lab.day, endDate: null, interval: 1, weekdays: [], monthDay: Number(lab.day.slice(-2)), hasDeadline: true, dueOffsetDays: 0 };
      const assignment = { contractVersion: 1, operationId: id(960), kind: "assignment.create", expectedRevisions: { [`creation:${ids.owner}`]: "0", [`catalogue:${standardResult.result.templateId}`]: "1" }, payload: { ownerId: ids.owner, companyId: ids.company, teamId: ids.team, source: { type: "catalogue", templateVersionId: standardResult.result.versionId }, schedule } };
      const made = (await lab.first("select api.command_v1($1::jsonb) result", [JSON.stringify(assignment)])).result;
      expect(made.result).toMatchObject({ assignmentId: expect.any(String), assignmentRevision: "1" });
      const materialize = { contractVersion: 1, operationId: id(961), kind: "month.materialize", expectedRevisions: { [`creation:${ids.owner}`]: "1" }, payload: { ownerId: ids.owner, period: lab.period } };
      const first = (await lab.first("select api.command_v1($1::jsonb) result", [JSON.stringify(materialize)])).result;
      expect(first.result).toMatchObject({ ownerId: ids.owner, period: lab.period, creationRevision: "2" });
      expect(first.result.createdTaskIds).toHaveLength(1);
      expect((await lab.first("select api.command_v1($1::jsonb) result", [JSON.stringify(materialize)])).result).toEqual(first);
      await lab.admin();
      expect(await lab.first("select count(*)::integer count from task_instances where assignment_id=$1", [made.result.assignmentId])).toEqual({ count: 1 });
    } finally { await lab.close(); }
  }, 20_000);
});
