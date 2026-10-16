import type { TaskTimeliness } from "../domain/timeliness";

function label(value: TaskTimeliness): string {
  const subject = value.evidence === "registered-target" ? "Meta registrada" : "Completada";
  switch (value.status) {
    case "early": {
      const days = value.daysAhead || 0;
      return `${subject} ${days} ${days === 1 ? "día" : "días"} antes`;
    }
    case "on-date":
      return `${value.evidence === "registered-target" ? "Meta registrada" : "Completada"} en fecha`;
    case "late": {
      const days = Math.abs(value.daysAhead || 0);
      return `${subject} ${days} ${days === 1 ? "día" : "días"} después`;
    }
    case "pending": return "Plazo pendiente";
    case "overdue": return "Plazo vencido";
    case "no-deadline": return "Sin plazo para medir";
    case "unknown": return "Sin medición";
  }
}

export default function TimelinessBadge({ value }: { value: TaskTimeliness }) {
  return <span className={`timeliness-badge timeliness-${value.status}`}>{label(value)}</span>;
}
