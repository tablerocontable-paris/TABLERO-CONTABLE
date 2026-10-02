import { useState } from "react";
import ScheduleEditor from "./ScheduleEditor";
import ThemeControl from "./ThemeControl";
import {
  defaultSchedule,
  occurrences,
  describeSchedule,
} from "../domain/schedule";
import { id } from "../domain/model";
import StepListEditor, { parseSteps, validateSteps } from "./StepListEditor";
import {
  ArrowRight,
  ArrowLeft,
  Check,
  Building2,
  BriefcaseBusiness,
  CalendarDays,
  Sparkles,
} from "lucide-react";
import type { State, Profile, Onboarding as Draft } from "../domain/model";
export default function Onboarding({
  state,
  month,
  profile,
  draft,
  update,
  finish,
  pause,
}: {
  state: State;
  month: string;
  profile: Profile;
  draft: Draft;
  update: (d: Draft) => void;
  finish: () => void;
  pause: () => void;
}) {
  const steps = [
    "Tu identidad",
    "Tu contexto",
    "Tus tareas",
    "Tu frecuencia",
    "Preferencias",
    "Tu mes",
  ];
  const [customStepRows, setCustomStepRows] = useState<string[]>(() =>
    draft.customSteps ? draft.customSteps.split("\n") : [],
  );
  const customStepError = (() => {
    if (!draft.customTitle.trim()) return "";
    try {
      validateSteps(customStepRows);
      return "";
    } catch (error) {
      return (error as Error).message;
    }
  })();
  const customStepValues = (() => {
    try {
      return validateSteps(customStepRows);
    } catch {
      return [];
    }
  })();
  const chosen = state.templates.filter((t) =>
    draft.selectedTemplateIds.includes(t.id),
  );
  const custom = [
    ...(draft.customTasks || []),
    ...(draft.customTitle.trim()
      ? [
          {
            id: "custom",
            title: draft.customTitle,
            steps: customStepValues,
            kind: "resultado" as const,
            unit: "",
            target: 0,
          },
        ]
      : []),
  ];
  const all = [...chosen, ...custom];
  const scheduleFor = (tid: string) =>
    draft.schedules?.[tid] || defaultSchedule(month + "-25");
  const companiesFor = (tid: string) =>
    (draft.assignmentCompanyIds?.[tid] || draft.selectedCompanyIds).filter(
      (cid) => draft.selectedCompanyIds.includes(cid),
    );
  let validSchedules = true;
  let count = 0;
  for (const t of all) {
    try {
      count +=
        occurrences(scheduleFor(t.id), month).length *
        companiesFor(t.id).length;
      if (!companiesFor(t.id).length) validSchedules = false;
    } catch {
      validSchedules = false;
    }
  }
  const valid =
    draft.step === 0
      ? draft.name.trim().length > 1
      : draft.step === 1
        ? draft.selectedCompanyIds.length > 0
        : draft.step === 2
          ? all.length > 0 && !customStepError
          : draft.step === 3
            ? validSchedules
            : true;
  const patch = (v: Partial<Draft>) => update({ ...draft, ...v });
  return (
    <div className="induction">
      <aside className="induction-side">
        <img src="/logo-grupo-paris.svg" alt="Grupo París" />
        <span className="eyebrow">TU ESPACIO, A TU MEDIDA</span>
        <h1>
          Un buen comienzo
          <br />
          ordena todo el mes.
        </h1>
        <p>Vamos a preparar tus tareas y mostrarte cómo trabajar con ellas.</p>
        <ol>
          {steps.map((s, i) => (
            <li
              key={s}
              className={
                i === draft.step ? "current" : i < draft.step ? "complete" : ""
              }
            >
              <b>{i < draft.step ? <Check size={14} /> : i + 1}</b>
              {s}
            </li>
          ))}
        </ol>
        <small>
          Inducción de demostración · progreso guardado en este navegador
        </small>
      </aside>
      <section className="induction-body">
        <div className="induction-top">
          <span>PASO {draft.step + 1} DE 6</span>
          <ThemeControl />
          <button onClick={pause}>Guardar y continuar después</button>
        </div>
        <div className="induction-step" key={draft.step}>
          {draft.step === 0 ? (
            <>
              <Sparkles className="intro-icon" />
              <h2>Hola, {draft.name.split(" ")[0] || "bienvenido"}.</h2>
              <p>
                Este tablero se prepara con tu trabajo real. Empecemos por cómo
                querés aparecer.
              </p>
              <label>
                Nombre visible
                <input
                  value={draft.name}
                  onChange={(e) => patch({ name: e.target.value })}
                  maxLength={80}
                />
              </label>
              <div className="note">
                Tu rol y tu responsable los define administración. Esta
                inducción configura tu trabajo.
              </div>
            </>
          ) : draft.step === 1 ? (
            <>
              <Building2 className="intro-icon" />
              <h2>¿En qué empresas trabajás?</h2>
              <p>
                Seleccioná tus ambientes. Una misma tarea en dos empresas se
                crea y se sigue por separado.
              </p>
              <div className="context-facts">
                <span>
                  <b>{profile.position}</b>Puesto
                </span>
                <span>
                  <b>{profile.branch}</b>Sucursal
                </span>
                <span>
                  <b>
                    {state.profiles.find((p) => p.id === profile.managerId)
                      ?.name || "Dirección"}
                  </b>
                  Responsable
                </span>
                <span>
                  <b>{profile.sector}</b>Sector
                </span>
              </div>
              <div className="choices">
                {state.companies
                  .filter((c) => profile.companyIds.includes(c.id))
                  .map((c) => (
                    <label
                      key={c.id}
                      className={
                        draft.selectedCompanyIds.includes(c.id)
                          ? "choice selected"
                          : "choice"
                      }
                    >
                      <input
                        type="checkbox"
                        checked={draft.selectedCompanyIds.includes(c.id)}
                        onChange={(e) =>
                          patch({
                            selectedCompanyIds: e.target.checked
                              ? [...draft.selectedCompanyIds, c.id]
                              : draft.selectedCompanyIds.filter(
                                  (id) => id !== c.id,
                                ),
                          })
                        }
                      />
                      <Building2 size={18} />
                      {c.name}
                    </label>
                  ))}
              </div>
            </>
          ) : draft.step === 2 ? (
            <>
              <BriefcaseBusiness className="intro-icon" />
              <h2>Contanos qué hacés habitualmente.</h2>
              <p>
                Elegí del catálogo. Los pesos y las metas son definidos por el
                jefe. El nombre, proceso y controles son iguales para todas las
                empresas; la empresa, fecha y meta corresponden a tu asignación.
              </p>
              <div className="catalog-options">
                {[...state.templates]
                  .sort(
                    (a, b) =>
                      Number(b.sector === profile.sector) -
                      Number(a.sector === profile.sector),
                  )
                  .map((t) => (
                    <label
                      className={
                        "catalog-option " +
                        (draft.selectedTemplateIds.includes(t.id)
                          ? "selected"
                          : "")
                      }
                      key={t.id}
                    >
                      <input
                        type="checkbox"
                        checked={draft.selectedTemplateIds.includes(t.id)}
                        onChange={(e) =>
                          patch({
                            selectedTemplateIds: e.target.checked
                              ? [...draft.selectedTemplateIds, t.id]
                              : draft.selectedTemplateIds.filter(
                                  (id) => id !== t.id,
                                ),
                          })
                        }
                      />
                      <div>
                        <b>{t.title}</b>
                        <p>{t.description}</p>
                        <small>
                          {t.kind === "operativa"
                            ? `${t.target} ${t.unit}/mes`
                            : `${t.steps.length} pasos`}{" "}
                          · {t.weight} pts{" "}
                          {t.sector === profile.sector
                            ? "· Sugerida para tu sector"
                            : ""}
                        </small>
                      </div>
                    </label>
                  ))}
              </div>
              <details>
                <summary>Agregar un trabajo esporádico · una sola vez</summary>
                <p>
                  Para una tarea habitual que falta, pedí a Juan Pablo que
                  incorpore el proceso al catálogo antes de completar la
                  inducción. Auditorías y correcciones puntuales se registran
                  aquí.
                </p>
                <label>
                  Título
                  <input
                    value={draft.customTitle}
                    onChange={(e) => patch({ customTitle: e.target.value })}
                    maxLength={120}
                  />
                </label>
                <label>Controles propuestos</label>
                <StepListEditor
                  value={customStepRows}
                  error={customStepError}
                  onChange={(next) => {
                    setCustomStepRows(next);
                    patch({ customSteps: next.join("\n") });
                  }}
                />
                <p>Se propone con peso 1 para revisión de Juan Pablo.</p>
                <button
                  type="button"
                  disabled={!draft.customTitle.trim() || !!customStepError}
                  onClick={() => {
                    let safeSteps: string[];
                    try {
                      safeSteps = validateSteps(customStepRows);
                    } catch {
                      return;
                    }
                    patch({
                      customTasks: [
                        ...(draft.customTasks || []),
                        {
                          id: id(),
                          title: draft.customTitle.trim(),
                          steps: safeSteps.join("\n"),
                          kind: "resultado",
                          unit: "",
                          target: 0,
                        },
                      ],
                      customTitle: "",
                      customSteps: "",
                    });
                    setCustomStepRows([]);
                  }}
                >
                  Agregar esta tarea y escribir otra
                </button>
              </details>
              {(draft.customTasks || []).map((t) => (
                <div className="custom-task-row" key={t.id}>
                  <b>{t.title}</b>
                  <button
                    onClick={() =>
                      patch({
                        customTasks: draft.customTasks!.filter(
                          (x) => x.id !== t.id,
                        ),
                      })
                    }
                  >
                    Quitar
                  </button>
                </div>
              ))}
            </>
          ) : draft.step === 3 ? (
            <>
              <CalendarDays className="intro-icon" />
              <h2>Cada tarea tiene su propio ritmo.</h2>
              <p>
                Indicá cuándo la hacés, si se repite y si tiene vencimiento. Una
                tarea puntual no vuelve el mes siguiente.
              </p>
              {all.map((t) => (
                <details
                  className="schedule-task"
                  key={t.id}
                  open={all.length === 1 || undefined}
                >
                  <summary>
                    <b>{t.title}</b>
                    <small>{describeSchedule(scheduleFor(t.id))}</small>
                  </summary>
                  <ScheduleEditor
                    onlyOnce={!chosen.some((x) => x.id === t.id)}
                    value={scheduleFor(t.id)}
                    onChange={(schedule) =>
                      patch({
                        schedules: { ...draft.schedules, [t.id]: schedule },
                      })
                    }
                    month={month}
                  />
                  <fieldset>
                    <legend>¿En qué empresas realizás este proceso?</legend>
                    <div className="company-options">
                      {state.companies
                        .filter((c) => draft.selectedCompanyIds.includes(c.id))
                        .map((c) => (
                          <label key={c.id}>
                            <input
                              type="checkbox"
                              checked={companiesFor(t.id).includes(c.id)}
                              onChange={(e) =>
                                patch({
                                  assignmentCompanyIds: {
                                    ...draft.assignmentCompanyIds,
                                    [t.id]: e.target.checked
                                      ? [...companiesFor(t.id), c.id]
                                      : companiesFor(t.id).filter(
                                          (cid) => cid !== c.id,
                                        ),
                                  },
                                })
                              }
                            />
                            {c.name}
                          </label>
                        ))}
                    </div>
                  </fieldset>
                </details>
              ))}
              <div className="note">
                El vencimiento se calcula desde cada nueva ocurrencia. El día 31
                se ajusta al último día del mes. Un plazo de 2 días genera un
                vencimiento dos días después de cada realización.
              </div>
            </>
          ) : draft.step === 4 ? (
            <>
              <h2>Tu forma de empezar el día.</h2>
              <p>Elegí qué querés ver primero.</p>
              <div className="choices">
                {[
                  ["day", "Mi día · prioridades"],
                  ["tasks", "Mi tablero · todas las tareas"],
                ].map(([v, l]) => (
                  <label
                    className={"choice " + (draft.home === v ? "selected" : "")}
                    key={v}
                  >
                    <input
                      type="radio"
                      checked={draft.home === v}
                      onChange={() => patch({ home: v as Draft["home"] })}
                    />
                    {l}
                  </label>
                ))}
              </div>
              <label className="check-line">
                <input
                  type="checkbox"
                  checked={draft.reminders}
                  onChange={(e) => patch({ reminders: e.target.checked })}
                />
                Mostrar aviso de vencimientos al abrir Mi día
              </label>
              <p>
                Los recordatorios de esta versión se muestran dentro del
                tablero.
              </p>
            </>
          ) : (
            <>
              <h2>Así quedará tu mes de trabajo.</h2>
              <p>
                {draft.name}, vas a empezar con <strong>{count} tareas</strong>{" "}
                en {draft.selectedCompanyIds.length} empresas. Podés volver
                atrás y ajustar.
              </p>
              <div className="preview-list">
                {draft.selectedCompanyIds.map((cid) => (
                  <section key={cid}>
                    <h3>{state.companies.find((c) => c.id === cid)?.name}</h3>
                    {all.map((t) => (
                      <div key={t.id}>
                        <span>
                          {t.title}
                          <small>{describeSchedule(scheduleFor(t.id))}</small>
                        </span>
                        <b>{"weight" in t ? t.weight : 1} pts</b>
                      </div>
                    ))}
                  </section>
                ))}
              </div>
              <div className="note">
                Cada tarea conserva la frecuencia que elegiste. Al confirmar, el
                tablero tendrá estas tareas y empezará el recorrido guiado.
              </div>
            </>
          )}
        </div>
        <div className="induction-actions">
          <button
            disabled={draft.step === 0}
            onClick={() => patch({ step: draft.step - 1 })}
          >
            <ArrowLeft size={15} />
            Atrás
          </button>
          {draft.step === 5 ? (
            <button className="primary" onClick={finish}>
              Preparar mi tablero <Check size={16} />
            </button>
          ) : (
            <button
              className="primary"
              disabled={!valid}
              onClick={() => patch({ step: draft.step + 1 })}
            >
              Continuar <ArrowRight size={16} />
            </button>
          )}
        </div>
      </section>
    </div>
  );
}
