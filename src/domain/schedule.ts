export type Frequency = "única" | "diaria" | "semanal" | "mensual";
export interface Schedule {
  frequency: Frequency;
  startDate: string;
  endDate: string;
  interval: number;
  weekdays: number[];
  monthDay: number;
  hasDeadline: boolean;
  dueOffsetDays: number;
}
export const dayNumber = (d: string) => Date.parse(d + "T12:00:00Z") / 86400000;
export const addDays = (d: string, n: number) =>
  new Date((dayNumber(d) + n) * 86400000).toISOString().slice(0, 10);
export function validDate(d: string) {
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(d) &&
    Number.isFinite(dayNumber(d)) &&
    new Date(d + "T12:00:00Z").toISOString().slice(0, 10) === d
  );
}
export function defaultSchedule(
  startDate: string,
  frequency: Frequency = "única",
): Schedule {
  return {
    frequency,
    startDate,
    endDate: "",
    interval: 1,
    weekdays: [1],
    monthDay: Number(startDate.slice(-2)),
    hasDeadline: true,
    dueOffsetDays: 0,
  };
}
export function validateSchedule(s: Schedule) {
  if (
    !validDate(s.startDate) ||
    (s.endDate && (!validDate(s.endDate) || s.endDate < s.startDate))
  )
    throw Error("Revisá las fechas de inicio y fin.");
  if (!Number.isInteger(s.interval) || s.interval < 1 || s.interval > 12)
    throw Error("El intervalo debe ser de 1 a 12.");
  if (!Number.isInteger(s.monthDay) || s.monthDay < 1 || s.monthDay > 31)
    throw Error("El día mensual debe estar entre 1 y 31.");
  if (
    !Number.isInteger(s.dueOffsetDays) ||
    s.dueOffsetDays < 0 ||
    s.dueOffsetDays > 31
  )
    throw Error("El plazo debe estar entre 0 y 31 días.");
  if (
    s.frequency === "semanal" &&
    (!s.weekdays.length ||
      s.weekdays.some((d) => !Number.isInteger(d) || d < 0 || d > 6))
  )
    throw Error("Seleccioná al menos un día de la semana.");
}
export function occurrences(
  s: Schedule,
  month: string,
): { date: string; due: string }[] {
  validateSchedule(s);
  if (!/^\d{4}-\d{2}$/.test(month) || !validDate(month + "-01"))
    throw Error("Período inválido.");
  const first = month + "-01";
  const [y, m] = month.split("-").map(Number);
  const last = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
  const start = new Date(s.startDate + "T12:00:00Z");
  const anchorMonday = dayNumber(s.startDate) - ((start.getUTCDay() + 6) % 7);
  const out = [];
  for (let d = first; d <= last; d = addDays(d, 1)) {
    if (d < s.startDate || (s.endDate && d > s.endDate)) continue;
    const dt = new Date(d + "T12:00:00Z");
    const days = dayNumber(d) - dayNumber(s.startDate);
    const months =
      (y - start.getUTCFullYear()) * 12 + m - 1 - start.getUTCMonth();
    const match =
      s.frequency === "única"
        ? d === s.startDate
        : s.frequency === "diaria"
          ? days % s.interval === 0
          : s.frequency === "semanal"
            ? s.weekdays.includes(dt.getUTCDay()) &&
              Math.floor((dayNumber(d) - anchorMonday) / 7) % s.interval === 0
            : months % s.interval === 0 &&
              Number(d.slice(-2)) ===
                Math.min(s.monthDay, Number(last.slice(-2)));
    if (match)
      out.push({
        date: d,
        due: s.hasDeadline ? addDays(d, s.dueOffsetDays) : "",
      });
  }
  return out;
}
export function describeSchedule(s: Schedule) {
  const f =
    s.frequency === "única"
      ? "Una sola vez"
      : s.frequency === "mensual"
        ? `Cada ${s.interval} mes(es), día ${s.monthDay}`
        : s.frequency === "semanal"
          ? `Cada ${s.interval} semana(s) · ${s.weekdays.map((d) => ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"][d]).join(", ")}`
          : `Cada ${s.interval} día(s)`;
  return `${f} · ${s.hasDeadline ? `vence ${s.dueOffsetDays === 0 ? "ese día" : s.dueOffsetDays + " días después"}` : "sin vencimiento"}`;
}
