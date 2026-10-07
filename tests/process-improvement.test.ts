// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { seed, load, persist } from "../src/data/repository";
import type { Profile, State } from "../src/domain/model";
import {
  canViewKaizenProposal,
  completeFiveSAction,
  createFiveSReview,
  createKaizenProposal,
  decideKaizenProposal,
  ensureCatalogueVersions,
  FIVE_S_AREAS,
  recordKaizenMeasurement,
  reviewKaizenProposal,
  reviseCatalogueTemplate,
  type FiveSReviewInput,
  type KaizenInput,
} from "../src/domain/processImprovement";
import { standardizeAssignment } from "../src/domain/catalogue";

const ids = (() => { let n = 0; return () => "quality-" + (++n); })();
const profile = (state: State, id: string) => state.profiles.find((row) => row.id === id)!;
afterEach(() => localStorage.clear());
const proposalInput = (overrides: Partial<KaizenInput> = {}): KaizenInput => ({
  templateId: "cat1", companyId: "c1", problemObserved: "Se repiten diferencias por extractos incompletos.",
  baselineValue: 24, objectiveValue: 12, unit: "minutos por conciliación", direction: "lower",
  baselineEvidence: "Muestra de 10 conciliaciones revisadas.", baselineContext: "Octubre · 10 conciliaciones de complejidad media.",
  proposedChange: "Agregar verificación del extracto completo antes de comparar.", responsibleId: "e0",
  trialFrom: "2026-10-01", trialThrough: "2026-10-31", ...overrides,
});

describe("Kaizen, 5S y versionado del catálogo en el laboratorio", () => {
  it("crea fotos iniciales honestas y asigna v1 a ocurrencias nuevas", () => {
    localStorage.clear();
    const state = load(true);
    expect(state.catalogueVersions).toHaveLength(state.templates.length);
    expect(state.catalogueVersions?.every((row) => row.version === 1 && row.effectiveOn === null)).toBe(true);
    expect(state.assignments.every((assignment) => assignment.templateVersion === 1)).toBe(true);
    expect(state.tasks.filter((task) => task.templateId).every((task) => task.templateVersion === 1)).toBe(true);
  });

  it("versiona cambios de catálogo sin reescribir asignaciones, tareas o cierres anteriores", () => {
    const state = seed();
    const assignment = state.assignments.find((row) => row.templateId === "cat1")!;
    const task = state.tasks.find((row) => row.templateId === "cat1")!;
    const beforeAssignment = structuredClone(assignment);
    const beforeTask = structuredClone(task);
    const revised = reviseCatalogueTemplate(state, "cat1", profile(state, "boss"), { weight: 8 }, "Peso aprobado para una asignación futura.", "2026-10-06T12:00:00Z", ids);
    expect(revised.catalogueVersions?.filter((row) => row.templateId === "cat1").map((row) => row.version)).toEqual([1, 2]);
    expect(revised.assignments.find((row) => row.id === assignment.id)).toEqual(beforeAssignment);
    expect(revised.tasks.find((row) => row.id === task.id)).toEqual(beforeTask);
    expect(standardizeAssignment(revised, assignment).templateVersion).toBe(2);
    expect(standardizeAssignment(revised, assignment).weight).toBe(8);
  });

  it("ejecuta propuesta, prueba, medición y adopción en versión futura", () => {
    let state = seed();
    const proposal = createKaizenProposal(state, profile(state, "e0"), proposalInput(), "2026-10-06T10:00:00Z", ids);
    state = { ...state, improvementProposals: [proposal] };
    expect(() => reviewKaizenProposal(state, profile(state, "e1"), proposal.id, "test", "Sin autoridad.", "2026-10-06T11:00:00Z")).toThrow(/sólo el encargado/i);
    state = reviewKaizenProposal(state, profile(state, "m1"), proposal.id, "test", "La muestra es adecuada y la prueba queda acotada.", "2026-10-06T11:00:00Z");
    state = recordKaizenMeasurement(state, profile(state, "e0"), proposal.id, {
      afterValue: 15, afterEvidence: "Muestra de 10 conciliaciones posterior al cambio.",
      afterContext: "Octubre · 10 conciliaciones de complejidad media, igual que la base.", measuredOn: "2026-10-25",
    }, "2026-10-25T14:00:00Z");
    const assignment = state.assignments.find((row) => row.templateId === proposal.templateId && row.ownerId === "e0")!;
    const taskBase = state.tasks.find((row) => row.templateId === proposal.templateId && row.ownerId === "e0")!;
    const future = { ...taskBase, id: "future-open", month: "2026-11", scheduledOn: "2026-11-02", status: "Pendiente" as const, completedAt: null, startedAt: null, sessions: [], checklist: [{ id: "old-step", text: "Control anterior", done: false }] };
    const started = { ...future, id: "future-started", scheduledOn: "2026-11-03", status: "En curso" as const, startedAt: "2026-10-30T10:00:00Z" };
    const closed = { ...future, id: "future-closed-month", ownerId: "e1", scheduledOn: "2026-11-04" };
    state.tasks = [...state.tasks, future, started, closed];
    const closure = { id: "closure-e1", ownerId: "e1", month: "2026-11", at: "2026-10-31T10:00:00Z", by: "boss", metrics: { assigned: 0, done: 0, points: 0, earned: 0, weighted: null, onTime: null, late: 0, blocked: 0, operational: 0, operationalTarget: 0 }, tasks: [], activity: [], note: "Cierre de control" } as State["closures"][number];
    state.closures = [...state.closures, closure];
    const oldCompleted = structuredClone(taskBase);
    const oldAssignment = structuredClone(assignment);
    const beforeVersionCount = state.catalogueVersions?.filter((row) => row.templateId === proposal.templateId).length || 0;
    state = decideKaizenProposal(state, profile(state, "boss"), proposal.id, "adopt", "La medición baja con el mismo volumen y complejidad; se adoptan los controles revisados.", {
      description: "Validar integridad del extracto antes de conciliar.",
      steps: ["Confirmar período y empresa del extracto", "Comparar saldos y movimientos", "Documentar diferencias", "Revisar conciliación"],
    }, "2026-10-31T15:00:00Z", ids);
    expect(state.improvementProposals?.find((row) => row.id === proposal.id)).toMatchObject({ status: "adopted", adoptedVersion: 2 });
    expect(state.catalogueVersions?.filter((row) => row.templateId === proposal.templateId)).toHaveLength(Math.max(1, beforeVersionCount) + 1);
    expect(state.catalogueVersions?.find((row) => row.templateId === proposal.templateId && row.version === 2)?.sourceProposalId).toBe(proposal.id);
    expect(state.templates.find((row) => row.id === proposal.templateId)?.weight).toBe(5);
    expect(state.assignments.find((row) => row.id === assignment.id)).toMatchObject({ templateVersion: 2, steps: ["Confirmar período y empresa del extracto", "Comparar saldos y movimientos", "Documentar diferencias", "Revisar conciliación"] });
    expect(state.assignments.find((row) => row.id === assignment.id)?.title).toBe(oldAssignment.title);
    const revisedFuture = state.tasks.find((row) => row.id === "future-open")!;
    expect(revisedFuture.templateVersion).toBe(2);
    expect(revisedFuture.checklist.map((check) => check.text)).toEqual(["Confirmar período y empresa del extracto", "Comparar saldos y movimientos", "Documentar diferencias", "Revisar conciliación"]);
    expect(revisedFuture.checklist[0].id).toBe("old-step");
    expect(state.tasks.find((row) => row.id === "future-started")).toEqual(started);
    expect(state.tasks.find((row) => row.id === "future-closed-month")).toEqual(closed);
    expect(state.tasks.find((row) => row.id === taskBase.id)).toEqual(oldCompleted);
  });

  it("exige una meta direccional y no acepta una medición fuera del ensayo", () => {
    const state = seed();
    expect(() => createKaizenProposal(state, profile(state, "e0"), proposalInput({ direction: "lower", objectiveValue: 24 }), "2026-10-06T10:00:00Z", ids)).toThrow(/meta debe expresar/);
    const proposal = createKaizenProposal(state, profile(state, "e0"), proposalInput(), "2026-10-06T10:00:00Z", ids);
    const testing = reviewKaizenProposal({ ...state, improvementProposals: [proposal] }, profile(state, "boss"), proposal.id, "test", "Prueba aprobada.", "2026-10-06T11:00:00Z");
    expect(() => recordKaizenMeasurement(testing, profile(state, "e0"), proposal.id, { afterValue: 18, afterEvidence: "Detalle suficiente.", afterContext: "Mismo volumen.", measuredOn: "2026-11-01" })).toThrow(/dentro del período/);
  });

  const fiveSInput = (): FiveSReviewInput => ({
    companyId: "c1", templateId: "cat1", scopeTitle: "", reviewedOn: "2026-10-06",
    items: FIVE_S_AREAS.map((area) => ({ id: area.id, result: "conforme", evidence: "Control revisado: " + area.label, finding: "Sin hallazgo; se verificó la evidencia indicada.", action: "Mantener el control y revisar el próximo período.", responsibleId: "e0", dueOn: "2026-10-13" })),
  });

  it("exige las cinco áreas 5S con evidencia, hallazgo, acción, responsable y fecha", () => {
    const state = seed();
    const input = fiveSInput();
    expect(() => createFiveSReview(state, profile(state, "e0"), { ...input, items: input.items.slice(0, 4) }, "2026-10-06T12:00:00Z", ids)).toThrow(/cinco áreas/);
    expect(() => createFiveSReview(state, profile(state, "e0"), { ...input, items: input.items.map((item, index) => index === 0 ? { ...item, evidence: " " } : item) }, "2026-10-06T12:00:00Z", ids)).toThrow(/evidencia/);
  });

  it("cierra acciones con evidencia, restringe la vista entre pares y conserva el estado en localStorage", () => {
    let state = seed();
    const review = createFiveSReview(state, profile(state, "e0"), fiveSInput(), "2026-10-06T12:00:00Z", ids);
    state = { ...state, fiveSReviews: [review] };
    const proposal = createKaizenProposal(state, profile(state, "e0"), proposalInput(), "2026-10-06T10:00:00Z", ids);
    expect(canViewKaizenProposal(state, profile(state, "e1"), proposal)).toBe(false);
    expect(() => completeFiveSAction(state, profile(state, "e1"), review.id, "classify", "Cerrado.", "2026-10-07")).toThrow(/sólo la persona asignada/i);
    state = completeFiveSAction(state, profile(state, "e0"), review.id, "classify", "Se verificó el índice y se separó lo vigente.", "2026-10-07");
    expect(state.fiveSReviews?.[0].items.find((item) => item.id === "classify")).toMatchObject({ status: "done", completedBy: "e0", completedOn: "2026-10-07" });
    persist(state, true);
    expect(load(true).fiveSReviews).toEqual(state.fiveSReviews);
  });

  it("incorpora versionado a una simulación anterior sin inventar vigencias", () => {
    const state = seed();
    delete state.catalogueVersions;
    persist(state, true);
    const loaded = load(true);
    expect(loaded.catalogueVersions).toHaveLength(loaded.templates.length);
    expect(loaded.catalogueVersions?.every((row) => row.effectiveOn === null && row.source === "initial_snapshot")).toBe(true);
    expect(ensureCatalogueVersions(loaded).catalogueVersions).toHaveLength(loaded.templates.length);
  });
});
