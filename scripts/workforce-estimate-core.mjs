import { createHmac } from "node:crypto";

export const SOURCE_HEADERS = Object.freeze({
  people: ["source_person_id", "active_from", "active_until"],
  tasks: ["source_task_id", "period_code", "concept_code", "status_at_cutoff", "source_owner_id", "scheduled_at", "last_completed_at", "cancelled_at", "source_joint_group_id", "source_coverage_id"],
  events: ["source_event_id", "source_task_id", "event_type", "event_at"],
  movements: ["source_movement_id", "source_task_id", "source_person_id", "movement_at", "quantity", "unit"],
});

export const ANONYMIZED_HEADERS = Object.freeze({
  people: ["person_id", "active_from", "active_until"],
  tasks: ["task_id", "period_code", "concept_code", "status_at_cutoff", "owner_id", "scheduled_at", "last_completed_at", "cancelled_at", "joint_group_id", "coverage_id"],
  events: ["event_id", "task_id", "event_type", "event_at"],
  movements: ["movement_id", "task_id", "person_id", "movement_at", "quantity", "unit"],
});

const TASK_STATUSES = new Set(["pending", "in_progress", "blocked", "completed", "cancelled"]);
const EVENT_TYPES = new Set(["completed", "reopened", "cancelled", "restored"]);
const SAFE_CODE = /^[a-z0-9]+(?:[-_][a-z0-9]+)*$/;
export const CONCEPT_CODES = Object.freeze(new Set([
  "bank_reconciliation", "payment_processing", "cash_reconciliation", "collections_tracking",
  "card_coupon_settlement", "customer_refunds", "cheque_tracking", "credit_operations",
  "receipt_application", "payment_platform_reconciliation", "payment_plan_tracking",
  "document_recording", "document_organization", "accounting_entries", "payroll_records",
  "tax_obligations", "company_accounting_close", "inventory_control", "accounting_adjustments",
  "cost_analysis", "operations_analysis", "monthly_indicator_close", "procedure_tracking",
  "team_review", "service_register_update", "supplies_control", "other_pending_review",
]));
export const UNIT_CODES = Object.freeze(new Set([
  "invoice", "payment", "collection", "settlement", "refund", "cheque", "installment",
  "document", "entry", "employee_record", "tax_obligation", "company_close", "inventory_item",
  "adjustment", "procedure", "service_record", "supply_item", "operation", "movement", "other",
]));
const PSEUDONYM = /^(?:p|t|e|m|j|c)_[a-f0-9]{24}$/;
const OFFSET_TIMESTAMP = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,9})?(Z|([+-])(\d{2}):(\d{2}))$/;
const LOCAL_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

function csvError(file, row, reason) {
  throw new Error(`${file}, fila ${row}: ${reason}`);
}

function parseCsvDocument(text, file = "CSV") {
  if (typeof text !== "string") throw new Error(`${file}: el contenido no es texto.`);
  const source = text.replace(/^\uFEFF/, "");
  const records = [];
  let record = [];
  let field = "";
  let quoted = false;
  let closedQuote = false;

  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    if (quoted) {
      if (char === '"') {
        if (source[index + 1] === '"') {
          field += '"';
          index += 1;
        } else {
          quoted = false;
          closedQuote = true;
        }
      } else {
        field += char;
      }
      continue;
    }

    if (closedQuote && char !== "," && char !== "\r" && char !== "\n") {
      csvError(file, records.length + 1, "hay caracteres después de un campo entre comillas.");
    }
    if (char === '"') {
      if (field.length !== 0 || closedQuote) csvError(file, records.length + 1, "comillas CSV mal formadas.");
      quoted = true;
    } else if (char === ",") {
      record.push(field);
      field = "";
      closedQuote = false;
    } else if (char === "\r" || char === "\n") {
      record.push(field);
      if (!(record.length === 1 && record[0] === "")) records.push(record);
      record = [];
      field = "";
      closedQuote = false;
      if (char === "\r" && source[index + 1] === "\n") index += 1;
    } else {
      field += char;
    }
  }

  if (quoted) csvError(file, records.length + 1, "campo entre comillas sin cerrar.");
  if (record.length > 0 || field.length > 0 || closedQuote) {
    record.push(field);
    if (!(record.length === 1 && record[0] === "")) records.push(record);
  }
  if (records.length === 0) throw new Error(`${file}: falta la fila de encabezados.`);

  const headers = records[0];
  if (headers.some((header) => header.trim() !== header || header.length === 0)) {
    throw new Error(`${file}: los encabezados deben estar completos y sin espacios externos.`);
  }
  if (new Set(headers).size !== headers.length) throw new Error(`${file}: hay encabezados repetidos.`);

  const rows = records.slice(1).map((values, index) => {
    if (values.every((value) => value === "")) return null;
    if (values.length !== headers.length) csvError(file, index + 2, "la cantidad de columnas no coincide con el encabezado.");
    return Object.fromEntries(headers.map((header, column) => [header, values[column]]));
  }).filter(Boolean);
  return { headers, rows };
}

export function parseCsv(text, file = "CSV") {
  return parseCsvDocument(text, file).rows;
}

export function parseCsvTable(text, expectedHeaders, file = "CSV") {
  const { headers, rows } = parseCsvDocument(text, file);
  if (JSON.stringify(headers) !== JSON.stringify(expectedHeaders)) {
    throw new Error(`${file}: columnas no válidas. Usá sólo la plantilla anonimizada; no agregues nombres, correos, títulos originales, comentarios ni referencias.`);
  }
  return rows;
}

export function serializeCsv(headers, rows) {
  const escape = (value) => {
    const text = value == null ? "" : String(value);
    return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  return [headers, ...rows.map((row) => headers.map((header) => row[header] ?? ""))]
    .map((values) => values.map(escape).join(","))
    .join("\r\n") + "\r\n";
}

function sourceId(value, file, row, field) {
  if (!value || value.trim() !== value || value.length > 200) csvError(file, row, `${field} debe ser un identificador de origen estable, no un nombre o correo.`);
  return value;
}

export function pseudonymizeId(key, namespace, value) {
  if (!Buffer.isBuffer(key) || key.length !== 32) throw new Error("La clave local debe tener exactamente 32 bytes.");
  const prefixByNamespace = { person: "p", task: "t", event: "e", movement: "m", joint: "j", coverage: "c" };
  const prefix = prefixByNamespace[namespace];
  if (!prefix || typeof value !== "string" || value.length === 0) throw new Error("No se pudo seudonimizar una clave requerida.");
  const digest = createHmac("sha256", key).update(`${namespace}\0${value}`, "utf8").digest("hex").slice(0, 24);
  return `${prefix}_${digest}`;
}

function assertUnique(rows, field, file) {
  const seen = new Set();
  rows.forEach((row, index) => {
    if (!row[field] || seen.has(row[field])) csvError(file, index + 2, `identificador faltante o repetido en ${field}.`);
    seen.add(row[field]);
  });
  return seen;
}

function validateSafeCode(value, file, row, field) {
  if (!SAFE_CODE.test(value)) csvError(file, row, `${field} debe ser un código neutro en minúsculas, sin nombres ni texto libre.`);
  return value;
}

function validateSourceTables(tables) {
  const sourcePeople = parseCsvTable(tables.people, SOURCE_HEADERS.people, "people.csv");
  const sourceTasks = parseCsvTable(tables.tasks, SOURCE_HEADERS.tasks, "tasks.csv");
  const sourceEvents = parseCsvTable(tables.events, SOURCE_HEADERS.events, "task-events.csv");
  const sourceMovements = parseCsvTable(tables.movements, SOURCE_HEADERS.movements, "movements.csv");
  const personIds = new Set(sourcePeople.map((row) => row.source_person_id));
  const personIntervals = new Map();
  sourcePeople.forEach((row, index) => {
    const line = index + 2;
    sourceId(row.source_person_id, "people.csv", line, "source_person_id");
    const start = parseInstant(row.active_from, "people.csv", line, "active_from");
    const end = parseOptionalInstant(row.active_until, "people.csv", line, "active_until");
    if (end != null && end <= start) csvError("people.csv", line, "active_until debe ser posterior a active_from.");
    const intervals = personIntervals.get(row.source_person_id) ?? [];
    intervals.push({ start, end, line });
    personIntervals.set(row.source_person_id, intervals);
  });
  for (const intervals of personIntervals.values()) {
    intervals.sort((a, b) => a.start - b.start);
    for (let index = 1; index < intervals.length; index += 1) {
      if (intervals[index - 1].end == null || intervals[index].start < intervals[index - 1].end) csvError("people.csv", intervals[index].line, "hay períodos activos superpuestos para una misma clave.");
    }
  }
  const taskIds = assertUnique(sourceTasks, "source_task_id", "tasks.csv");
  assertUnique(sourceEvents, "source_event_id", "task-events.csv");
  assertUnique(sourceMovements, "source_movement_id", "movements.csv");

  sourcePeople.forEach((row, index) => sourceId(row.source_person_id, "people.csv", index + 2, "source_person_id"));
  sourceTasks.forEach((row, index) => {
    const line = index + 2;
    sourceId(row.source_task_id, "tasks.csv", line, "source_task_id");
    if (row.source_owner_id && !personIds.has(row.source_owner_id)) csvError("tasks.csv", line, "responsable sin fila correspondiente en people.csv.");
    validateSafeCode(row.period_code, "tasks.csv", line, "period_code");
    if (!CONCEPT_CODES.has(row.concept_code)) csvError("tasks.csv", line, "concept_code debe pertenecer al catálogo neutral cerrado; los conceptos nuevos requieren revisión.");
    validateTaskSnapshot(row, "tasks.csv", line);
    for (const field of ["source_joint_group_id", "source_coverage_id"]) if (row[field]) sourceId(row[field], "tasks.csv", line, field);
  });
  sourceEvents.forEach((row, index) => {
    const line = index + 2;
    sourceId(row.source_event_id, "task-events.csv", line, "source_event_id");
    sourceId(row.source_task_id, "task-events.csv", line, "source_task_id");
    if (!taskIds.has(row.source_task_id)) csvError("task-events.csv", line, "tarea no encontrada en tasks.csv.");
    if (!EVENT_TYPES.has(row.event_type)) csvError("task-events.csv", line, "event_type debe ser completed, reopened, cancelled o restored.");
    parseInstant(row.event_at, "task-events.csv", line, "event_at");
  });
  sourceMovements.forEach((row, index) => {
    const line = index + 2;
    sourceId(row.source_movement_id, "movements.csv", line, "source_movement_id");
    sourceId(row.source_task_id, "movements.csv", line, "source_task_id");
    if (!taskIds.has(row.source_task_id)) csvError("movements.csv", line, "tarea no encontrada en tasks.csv.");
    if (row.source_person_id && !personIds.has(row.source_person_id)) csvError("movements.csv", line, "persona no encontrada en people.csv.");
    parseInstant(row.movement_at, "movements.csv", line, "movement_at");
    parseQuantity(row.quantity, "movements.csv", line);
    if (!UNIT_CODES.has(row.unit)) csvError("movements.csv", line, "unit debe pertenecer al catálogo neutral cerrado; las unidades nuevas requieren revisión.");
  });
  return { sourcePeople, sourceTasks, sourceEvents, sourceMovements };
}

export function anonymizeWorkforceTables(tables, key) {
  if (!Buffer.isBuffer(key) || key.length !== 32) throw new Error("La clave local debe tener exactamente 32 bytes.");
  const { sourcePeople, sourceTasks, sourceEvents, sourceMovements } = validateSourceTables(tables);
  const id = (namespace, value) => value ? pseudonymizeId(key, namespace, value) : "";
  const people = sourcePeople.map((row) => ({ person_id: id("person", row.source_person_id), active_from: row.active_from, active_until: row.active_until }));
  const tasks = sourceTasks.map((row) => ({
    task_id: id("task", row.source_task_id), period_code: row.period_code, concept_code: row.concept_code,
    status_at_cutoff: row.status_at_cutoff, owner_id: id("person", row.source_owner_id), scheduled_at: row.scheduled_at,
    last_completed_at: row.last_completed_at, cancelled_at: row.cancelled_at,
    joint_group_id: id("joint", row.source_joint_group_id), coverage_id: id("coverage", row.source_coverage_id),
  }));
  const events = sourceEvents.map((row) => ({ event_id: id("event", row.source_event_id), task_id: id("task", row.source_task_id), event_type: row.event_type, event_at: row.event_at }));
  const movements = sourceMovements.map((row) => ({
    movement_id: id("movement", row.source_movement_id), task_id: id("task", row.source_task_id),
    person_id: id("person", row.source_person_id), movement_at: row.movement_at, quantity: row.quantity, unit: row.unit,
  }));
  return {
    "people.csv": serializeCsv(ANONYMIZED_HEADERS.people, people),
    "tasks.csv": serializeCsv(ANONYMIZED_HEADERS.tasks, tasks),
    "task-events.csv": serializeCsv(ANONYMIZED_HEADERS.events, events),
    "movements.csv": serializeCsv(ANONYMIZED_HEADERS.movements, movements),
  };
}

function parseInstant(value, file, row, field) {
  if (typeof value !== "string") csvError(file, row, `${field} requiere fecha y zona horaria explícita.`);
  const match = OFFSET_TIMESTAMP.exec(value);
  if (!match) csvError(file, row, `${field} debe ser ISO 8601 con Z o desfase horario.`);
  const [, yearText, monthText, dayText, hourText, minuteText, secondText, zone, , offsetHourText, offsetMinuteText] = match;
  const year = Number(yearText), month = Number(monthText), day = Number(dayText);
  const hour = Number(hourText), minute = Number(minuteText), second = Number(secondText);
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  if (month < 1 || month > 12 || day < 1 || day > daysInMonth || hour > 23 || minute > 59 || second > 59
      || (zone !== "Z" && (Number(offsetHourText) > 23 || Number(offsetMinuteText) > 59))) {
    csvError(file, row, `${field} no es una fecha válida.`);
  }
  const instant = Date.parse(value);
  if (!Number.isFinite(instant)) csvError(file, row, `${field} no es una fecha válida.`);
  return instant;
}

function parseOptionalInstant(value, file, row, field) {
  return value === "" ? null : parseInstant(value, file, row, field);
}

function parseLocalDate(value, file, row, field) {
  const match = LOCAL_DATE.exec(value);
  if (!match) csvError(file, row, `${field} debe usar YYYY-MM-DD.`);
  const [, yearText, monthText, dayText] = match;
  const year = Number(yearText), month = Number(monthText), day = Number(dayText);
  if (month < 1 || month > 12 || day < 1 || day > new Date(Date.UTC(year, month, 0)).getUTCDate()) csvError(file, row, `${field} no es una fecha válida.`);
  return value;
}

function validateTaskSnapshot(row, file, line) {
  if (!TASK_STATUSES.has(row.status_at_cutoff)) csvError(file, line, "status_at_cutoff debe ser pending, in_progress, blocked, completed o cancelled.");
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(row.period_code)) csvError(file, line, "period_code debe ser YYYY-MM.");
  if (row.scheduled_at) parseLocalDate(row.scheduled_at, file, line, "scheduled_at");
  const lastCompletedAt = parseOptionalInstant(row.last_completed_at, file, line, "last_completed_at");
  const cancelledAt = parseOptionalInstant(row.cancelled_at, file, line, "cancelled_at");
  if (row.status_at_cutoff === "completed" && lastCompletedAt == null) csvError(file, line, "una tarea completed requiere last_completed_at.");
  if (row.status_at_cutoff === "cancelled" && cancelledAt == null) csvError(file, line, "una tarea cancelled requiere cancelled_at.");
}

function validatePseudonym(value, prefix, file, line, field, optional = false) {
  if (optional && value === "") return;
  if (!PSEUDONYM.test(value) || value.slice(0, 1) !== prefix) csvError(file, line, `${field} debe usar una clave seudónima de la plantilla.`);
}

function parseQuantity(value, file, line) {
  if (!/^(?:0|[1-9]\d{0,29})(?:\.\d{1,6})?$/.test(value)) csvError(file, line, "quantity debe ser un decimal no negativo de hasta seis posiciones.");
  const [whole, fraction = ""] = value.split(".");
  const scale = fraction.length;
  const coefficient = BigInt(`${whole}${fraction}`);
  if (coefficient <= 0n) csvError(file, line, "quantity debe ser mayor que cero.");
  return { coefficient, scale };
}

function addDecimal(left, right) {
  const scale = Math.max(left.scale, right.scale);
  const leftValue = left.coefficient * 10n ** BigInt(scale - left.scale);
  const rightValue = right.coefficient * 10n ** BigInt(scale - right.scale);
  return { coefficient: leftValue + rightValue, scale };
}

function formatDecimal(value) {
  const digits = value.coefficient.toString().padStart(value.scale + 1, "0");
  if (value.scale === 0) return digits;
  const split = digits.length - value.scale;
  const fraction = digits.slice(split).replace(/0+$/, "");
  return fraction ? `${digits.slice(0, split)}.${fraction}` : digits.slice(0, split);
}

function dateInTimeZone(instant, timezone) {
  const parts = new Intl.DateTimeFormat("en", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date(instant));
  const part = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${part.year}-${part.month}-${part.day}`;
}

export function calculateWorkforceEstimate(tables, { cutoff, timezone }) {
  const cutoffInstant = parseInstant(cutoff, "options", 1, "cutoff");
  let localDate;
  try { localDate = dateInTimeZone(cutoffInstant, timezone); }
  catch { throw new Error("timezone debe ser un identificador IANA válido."); }

  const people = parseCsvTable(tables.people, ANONYMIZED_HEADERS.people, "people.csv");
  const tasks = parseCsvTable(tables.tasks, ANONYMIZED_HEADERS.tasks, "tasks.csv");
  const events = parseCsvTable(tables.events, ANONYMIZED_HEADERS.events, "task-events.csv");
  const movements = parseCsvTable(tables.movements, ANONYMIZED_HEADERS.movements, "movements.csv");
  const personIntervals = new Map();
  people.forEach((row, index) => {
    const line = index + 2;
    validatePseudonym(row.person_id, "p", "people.csv", line, "person_id");
    const start = parseInstant(row.active_from, "people.csv", line, "active_from");
    const end = parseOptionalInstant(row.active_until, "people.csv", line, "active_until");
    if (end != null && end <= start) csvError("people.csv", line, "active_until debe ser posterior a active_from.");
    const intervals = personIntervals.get(row.person_id) ?? [];
    intervals.push({ start, end });
    personIntervals.set(row.person_id, intervals);
  });
  for (const intervals of personIntervals.values()) {
    intervals.sort((a, b) => a.start - b.start);
    for (let index = 1; index < intervals.length; index += 1) {
      if (intervals[index - 1].end == null || intervals[index].start < intervals[index - 1].end) throw new Error("people.csv: hay períodos activos superpuestos para una misma clave.");
    }
  }
  const activePeople = [...personIntervals.entries()].filter(([, intervals]) => intervals.some(({ start, end }) => start <= cutoffInstant && (end == null || cutoffInstant < end))).length;

  const taskMap = new Map();
  const logicalTaskById = new Map();
  const logicalTasks = new Map();
  const tasksByStatus = Object.fromEntries([...TASK_STATUSES].map((status) => [status, 0]));
  const completedTaskIdsToday = new Set();
  tasks.forEach((row, index) => {
    const line = index + 2;
    validatePseudonym(row.task_id, "t", "tasks.csv", line, "task_id");
    if (taskMap.has(row.task_id)) csvError("tasks.csv", line, "task_id repetido; cada fila debe representar una ocurrencia única.");
    if (row.owner_id) {
      validatePseudonym(row.owner_id, "p", "tasks.csv", line, "owner_id");
      if (!personIntervals.has(row.owner_id)) csvError("tasks.csv", line, "owner_id no tiene historial en people.csv.");
    }
    if (row.joint_group_id) validatePseudonym(row.joint_group_id, "j", "tasks.csv", line, "joint_group_id");
    if (row.coverage_id) validatePseudonym(row.coverage_id, "c", "tasks.csv", line, "coverage_id");
    validateSafeCode(row.period_code, "tasks.csv", line, "period_code");
    if (!CONCEPT_CODES.has(row.concept_code)) csvError("tasks.csv", line, "concept_code debe pertenecer al catálogo neutral cerrado; los conceptos nuevos requieren revisión.");
    validateTaskSnapshot(row, "tasks.csv", line);
    const completedAt = parseOptionalInstant(row.last_completed_at, "tasks.csv", line, "last_completed_at");
    const cancelledAt = parseOptionalInstant(row.cancelled_at, "tasks.csv", line, "cancelled_at");
    if ((completedAt != null && completedAt > cutoffInstant) || (cancelledAt != null && cancelledAt > cutoffInstant)) csvError("tasks.csv", line, "el estado al corte contiene una fecha posterior al corte.");
    taskMap.set(row.task_id, row);
    const logicalId = row.joint_group_id || row.task_id;
    logicalTaskById.set(row.task_id, logicalId);
    const current = logicalTasks.get(logicalId);
    if (current && (current.period_code !== row.period_code || current.concept_code !== row.concept_code || current.status_at_cutoff !== row.status_at_cutoff)) {
      csvError("tasks.csv", line, "las asignaciones de una tarea conjunta deben coincidir en período, concepto y estado al corte.");
    }
    logicalTasks.set(logicalId, {
      period_code: row.period_code,
      concept_code: row.concept_code,
      status_at_cutoff: row.status_at_cutoff,
      last_completed_at: Math.max(current?.last_completed_at ?? -Infinity, completedAt ?? -Infinity),
    });
  });
  for (const [logicalId, task] of logicalTasks) {
    tasksByStatus[task.status_at_cutoff] += 1;
    if (task.status_at_cutoff === "completed" && task.last_completed_at !== -Infinity
        && dateInTimeZone(task.last_completed_at, timezone) === localDate) completedTaskIdsToday.add(logicalId);
  }

  const eventIds = new Set();
  const completionEvents = [];
  const reopenEvents = [];
  events.forEach((row, index) => {
    const line = index + 2;
    validatePseudonym(row.event_id, "e", "task-events.csv", line, "event_id");
    validatePseudonym(row.task_id, "t", "task-events.csv", line, "task_id");
    if (eventIds.has(row.event_id)) csvError("task-events.csv", line, "event_id repetido.");
    eventIds.add(row.event_id);
    if (!taskMap.has(row.task_id)) csvError("task-events.csv", line, "task_id no tiene una fila correspondiente en tasks.csv.");
    if (!EVENT_TYPES.has(row.event_type)) csvError("task-events.csv", line, "event_type no reconocido.");
    const eventInstant = parseInstant(row.event_at, "task-events.csv", line, "event_at");
    if (eventInstant <= cutoffInstant && dateInTimeZone(eventInstant, timezone) === localDate) {
      if (row.event_type === "completed") completionEvents.push(logicalTaskById.get(row.task_id));
      if (row.event_type === "reopened") reopenEvents.push(logicalTaskById.get(row.task_id));
    }
  });

  const movementIds = new Set();
  const movementTotals = new Map();
  let movementCount = 0;
  movements.forEach((row, index) => {
    const line = index + 2;
    validatePseudonym(row.movement_id, "m", "movements.csv", line, "movement_id");
    validatePseudonym(row.task_id, "t", "movements.csv", line, "task_id");
    if (movementIds.has(row.movement_id)) csvError("movements.csv", line, "movement_id repetido.");
    movementIds.add(row.movement_id);
    if (!taskMap.has(row.task_id)) csvError("movements.csv", line, "task_id no tiene una fila correspondiente en tasks.csv.");
    if (row.person_id) {
      validatePseudonym(row.person_id, "p", "movements.csv", line, "person_id");
      if (!personIntervals.has(row.person_id)) csvError("movements.csv", line, "person_id no tiene historial en people.csv.");
    }
    const quantity = parseQuantity(row.quantity, "movements.csv", line);
    if (!UNIT_CODES.has(row.unit)) csvError("movements.csv", line, "unit debe pertenecer al catálogo neutral cerrado; las unidades nuevas requieren revisión.");
    const movementInstant = parseInstant(row.movement_at, "movements.csv", line, "movement_at");
    if (movementInstant <= cutoffInstant && dateInTimeZone(movementInstant, timezone) === localDate) {
      movementCount += 1;
      movementTotals.set(row.unit, addDecimal(movementTotals.get(row.unit) ?? { coefficient: 0n, scale: 0 }, quantity));
    }
  });

  return {
    cutoff,
    timezone,
    localDate,
    activePeople,
    taskCount: logicalTasks.size,
    taskAssignmentCount: tasks.length,
    tasksByStatus,
    today: {
      completedTasksStillCompletedAtCutoff: completedTaskIdsToday.size,
      completionEvents: completionEvents.length,
      distinctTasksWithCompletionEvent: new Set(completionEvents).size,
      reopenEvents: reopenEvents.length,
      distinctTasksReopened: new Set(reopenEvents).size,
      operationalMovementCount: movementCount,
      operationalQuantityByUnit: [...movementTotals.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([unit, quantity]) => ({ unit, quantity: formatDecimal(quantity) })),
    },
  };
}
