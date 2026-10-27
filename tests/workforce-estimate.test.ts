import { describe, expect, it } from "vitest";
import {
  ANONYMIZED_HEADERS,
  anonymizeWorkforceTables,
  calculateWorkforceEstimate,
  serializeCsv,
  SOURCE_HEADERS,
} from "../scripts/workforce-estimate-core.mjs";

const key = Buffer.alloc(32, 7);
const asTables = (files: Record<string, string>) => ({
  people: files["people.csv"]!,
  tasks: files["tasks.csv"]!,
  events: files["task-events.csv"]!,
  movements: files["movements.csv"]!,
});
const source = {
  people: serializeCsv(SOURCE_HEADERS.people, [
    { source_person_id: "person-opaque-001", active_from: "2025-01-01T00:00:00-03:00", active_until: "" },
    { source_person_id: "person-opaque-002", active_from: "2025-01-01T00:00:00-03:00", active_until: "2026-10-27T22:00:00-03:00" },
  ]),
  tasks: serializeCsv(SOURCE_HEADERS.tasks, [
    { source_task_id: "task-opaque-001", period_code: "2026-10", concept_code: "document_recording", status_at_cutoff: "completed", source_owner_id: "person-opaque-001", scheduled_at: "2026-10-27", last_completed_at: "2026-10-28T01:00:00Z", cancelled_at: "", source_joint_group_id: "joint-opaque-001", source_coverage_id: "" },
    { source_task_id: "task-opaque-002", period_code: "2026-10", concept_code: "payment_processing", status_at_cutoff: "in_progress", source_owner_id: "person-opaque-001", scheduled_at: "2026-10-27", last_completed_at: "2026-10-27T10:00:00-03:00", cancelled_at: "", source_joint_group_id: "", source_coverage_id: "" },
    { source_task_id: "task-opaque-003", period_code: "2026-10", concept_code: "other_pending_review", status_at_cutoff: "pending", source_owner_id: "", scheduled_at: "", last_completed_at: "", cancelled_at: "", source_joint_group_id: "", source_coverage_id: "" },
    { source_task_id: "task-opaque-004", period_code: "2026-10", concept_code: "document_recording", status_at_cutoff: "completed", source_owner_id: "person-opaque-002", scheduled_at: "2026-10-27", last_completed_at: "2026-10-28T01:00:00Z", cancelled_at: "", source_joint_group_id: "joint-opaque-001", source_coverage_id: "" },
  ]),
  events: serializeCsv(SOURCE_HEADERS.events, [
    { source_event_id: "event-001", source_task_id: "task-opaque-001", event_type: "completed", event_at: "2026-10-28T01:00:00Z" },
    { source_event_id: "event-002", source_task_id: "task-opaque-002", event_type: "completed", event_at: "2026-10-27T10:00:00-03:00" },
    { source_event_id: "event-003", source_task_id: "task-opaque-002", event_type: "reopened", event_at: "2026-10-27T12:00:00-03:00" },
    { source_event_id: "event-004", source_task_id: "task-opaque-003", event_type: "completed", event_at: "2026-10-28T02:31:00Z" },
    { source_event_id: "event-005", source_task_id: "task-opaque-004", event_type: "completed", event_at: "2026-10-28T01:00:00Z" },
  ]),
  movements: serializeCsv(SOURCE_HEADERS.movements, [
    { source_movement_id: "movement-001", source_task_id: "task-opaque-001", source_person_id: "person-opaque-001", movement_at: "2026-10-27T23:00:00-03:00", quantity: "1.25", unit: "invoice" },
    { source_movement_id: "movement-002", source_task_id: "task-opaque-001", source_person_id: "person-opaque-001", movement_at: "2026-10-27T23:15:00-03:00", quantity: "2.75", unit: "invoice" },
    { source_movement_id: "movement-003", source_task_id: "task-opaque-001", source_person_id: "person-opaque-001", movement_at: "2026-10-28T02:31:00Z", quantity: "10", unit: "invoice" },
  ]),
};

describe("estimador local de dotación y trabajo", () => {
  it("seudonimiza identificadores, suma cantidades exactas y separa estado final, eventos y reaperturas", () => {
    const files = anonymizeWorkforceTables(source, key);
    const report = calculateWorkforceEstimate(asTables(files), {
      cutoff: "2026-10-28T02:30:00Z",
      timezone: "America/Argentina/Buenos_Aires",
    });

    expect(report).toMatchObject({
      localDate: "2026-10-27",
      activePeople: 1,
      taskCount: 3,
      taskAssignmentCount: 4,
      tasksByStatus: { pending: 1, in_progress: 1, blocked: 0, completed: 1, cancelled: 0 },
      today: {
        completedTasksStillCompletedAtCutoff: 1,
        completionEvents: 3,
        distinctTasksWithCompletionEvent: 2,
        reopenEvents: 1,
        distinctTasksReopened: 1,
        operationalMovementCount: 2,
        operationalQuantityByUnit: [{ unit: "invoice", quantity: "4" }],
      },
    });
    expect(JSON.stringify(files)).not.toContain("person-opaque");
    expect(JSON.stringify(files)).not.toContain("task-opaque");
  });

  it("permite intervalos laborales no superpuestos para una misma persona y rechaza solapamientos", () => {
    const rehired = {
      ...source,
      people: serializeCsv(SOURCE_HEADERS.people, [
        { source_person_id: "person-opaque-001", active_from: "2024-01-01T00:00:00Z", active_until: "2025-01-01T00:00:00Z" },
        { source_person_id: "person-opaque-001", active_from: "2025-02-01T00:00:00Z", active_until: "" },
        { source_person_id: "person-opaque-002", active_from: "2025-01-01T00:00:00Z", active_until: "" },
      ]),
    };
    expect(() => anonymizeWorkforceTables(rehired, key)).not.toThrow();
    const overlap = { ...rehired, people: rehired.people.replace("2025-01-01T00:00:00Z", "2025-03-01T00:00:00Z") };
    expect(() => anonymizeWorkforceTables(overlap, key)).toThrow(/períodos activos superpuestos/);
  });

  it("rechaza textos fuera del vocabulario neutro y columnas que podrían traer datos personales", () => {
    const unsafeConcept = { ...source, tasks: source.tasks.replace("document_recording", "empresa_acme") };
    expect(() => anonymizeWorkforceTables(unsafeConcept, key)).toThrow(/catálogo neutral cerrado/);
    const unsafeUnit = { ...source, movements: source.movements.replace("invoice", "empresa_acme") };
    expect(() => anonymizeWorkforceTables(unsafeUnit, key)).toThrow(/unidades nuevas requieren revisión/);
    const unsafeHeaders = Object.values(ANONYMIZED_HEADERS);
    expect(unsafeHeaders).toHaveLength(4);
    const rowsWithName = serializeCsv(["person_id", "name", "active_from", "active_until"], []);
    expect(() => calculateWorkforceEstimate({ ...asTables(anonymizeWorkforceTables(source, key)), people: rowsWithName }, {
      cutoff: "2026-10-28T02:30:00Z", timezone: "America/Argentina/Buenos_Aires",
    })).toThrow(/columnas no válidas/);
  });

  it("valida fechas de alta y baja antes de crear extractos", () => {
    const invalid = { ...source, people: source.people.replace("2025-01-01T00:00:00-03:00", "2025-02-30T00:00:00-03:00") };
    expect(() => anonymizeWorkforceTables(invalid, key)).toThrow(/no es una fecha válida/);
  });
});
