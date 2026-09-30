import type { Schedule } from "../domain/schedule";
import { occurrences, describeSchedule } from "../domain/schedule";
export default function ScheduleEditor({
  value: s,
  onChange,
  month,
  compact = false,
}: {
  value: Schedule;
  onChange: (v: Schedule) => void;
  month: string;
  compact?: boolean;
}) {
  const patch = (v: Partial<Schedule>) => onChange({ ...s, ...v });
  let preview: { date: string; due: string }[] = [];
  let error = "";
  try {
    preview = occurrences(s, month);
  } catch (e) {
    error = (e as Error).message;
  }
  return (
    <div className="schedule-editor">
      <div className="form-grid">
        <label>
          ¿Se repite?
          <select
            aria-label="Frecuencia de la tarea"
            value={s.frequency}
            onChange={(e) =>
              patch({ frequency: e.target.value as Schedule["frequency"] })
            }
          >
            <option value="única">No · una sola vez</option>
            <option value="diaria">Diaria</option>
            <option value="semanal">Semanal</option>
            <option value="mensual">Mensual</option>
          </select>
        </label>
        <label>
          {s.frequency === "única" ? "Fecha de realización" : "A partir de"}
          <input
            aria-label="Fecha de realización"
            type="date"
            required
            value={s.startDate}
            onChange={(e) => patch({ startDate: e.target.value })}
          />
        </label>
        {s.frequency !== "única" && (
          <>
            <label>
              Cada cuántos{" "}
              {s.frequency === "semanal"
                ? "semanas"
                : s.frequency === "mensual"
                  ? "meses"
                  : "días"}
              <input
                type="number"
                min={1}
                max={12}
                required
                value={s.interval}
                onChange={(e) => patch({ interval: Number(e.target.value) })}
              />
            </label>
            <label>
              Finaliza la repetición · opcional
              <input
                type="date"
                min={s.startDate}
                value={s.endDate}
                onChange={(e) => patch({ endDate: e.target.value })}
              />
            </label>
          </>
        )}
        {s.frequency === "mensual" && (
          <label>
            Día del mes
            <input
              type="number"
              min={1}
              max={31}
              required
              value={s.monthDay}
              onChange={(e) => patch({ monthDay: Number(e.target.value) })}
            />
          </label>
        )}
      </div>
      {s.frequency === "semanal" && (
        <div className="weekday-picker">
          {[1, 2, 3, 4, 5, 6, 0].map((d) => (
            <button
              type="button"
              key={d}
              aria-pressed={s.weekdays.includes(d)}
              className={s.weekdays.includes(d) ? "selected" : ""}
              onClick={() =>
                patch({
                  weekdays: s.weekdays.includes(d)
                    ? s.weekdays.filter((x) => x !== d)
                    : [...s.weekdays, d].sort(),
                })
              }
            >
              {["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"][d]}
            </button>
          ))}
        </div>
      )}
      <label className="check-line">
        <input
          type="checkbox"
          checked={s.hasDeadline}
          onChange={(e) => patch({ hasDeadline: e.target.checked })}
        />
        Tiene vencimiento
      </label>
      {s.hasDeadline && (
        <label>
          Plazo desde cada fecha de realización · 0 = ese mismo día
          <input
            type="number"
            min={0}
            max={31}
            required
            value={s.dueOffsetDays}
            onChange={(e) => patch({ dueOffsetDays: Number(e.target.value) })}
          />
        </label>
      )}
      <div className="note">
        {error || describeSchedule(s)}
        {!error && !compact && (
          <>
            <p>
              {preview.length} ocurrencias en {month}. Cada una tendrá
              checklist, estado y cronómetro propios.
            </p>
            <div className="occurrence-preview">
              {preview.slice(0, 8).map((o) => (
                <span key={o.date}>
                  {o.date} → {o.due || "sin vencimiento"}
                </span>
              ))}
              {preview.length > 8 && <span>+{preview.length - 8} más</span>}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
