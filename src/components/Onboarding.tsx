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
  profile,
  draft,
  update,
  finish,
  pause,
}: {
  state: State;
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
  const chosen = state.templates.filter((t) =>
    draft.selectedTemplateIds.includes(t.id),
  );
  const count =
    (chosen.length + (draft.customTitle.trim() ? 1 : 0)) *
    draft.selectedCompanyIds.length;
  const valid =
    draft.step === 0
      ? draft.name.trim().length > 1
      : draft.step === 1
        ? draft.selectedCompanyIds.length > 0
        : draft.step === 2
          ? chosen.length > 0 || !!draft.customTitle.trim()
          : draft.step === 3
            ? draft.day >= 1 && draft.day <= 31
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
                jefe; después podés agregar tareas particulares.
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
                <summary>Agregar una tarea particular</summary>
                <label>
                  Título
                  <input
                    value={draft.customTitle}
                    onChange={(e) => patch({ customTitle: e.target.value })}
                    maxLength={120}
                  />
                </label>
                <label>
                  Checklist · un paso por línea
                  <textarea
                    value={draft.customSteps}
                    onChange={(e) => patch({ customSteps: e.target.value })}
                  />
                </label>
                <p>Se propone con peso 1 para revisión del jefe.</p>
              </details>
            </>
          ) : draft.step === 3 ? (
            <>
              <CalendarDays className="intro-icon" />
              <h2>Dale un lugar en tu mes.</h2>
              <p>
                Esta configuración inicial se aplica a las tareas seleccionadas.
                Cada tarea conserva su propio checklist.
              </p>
              <label>
                Frecuencia
                <select
                  value={draft.frequency}
                  onChange={(e) =>
                    patch({ frequency: e.target.value as Draft["frequency"] })
                  }
                >
                  <option value="mensual">Todos los meses</option>
                  <option value="única">Sólo este mes</option>
                </select>
              </label>
              <label>
                Día de vencimiento
                <input
                  type="number"
                  min="1"
                  max="31"
                  value={draft.day}
                  onChange={(e) => patch({ day: Number(e.target.value) })}
                />
              </label>
              <div className="note">
                En meses más cortos, un vencimiento 31 se ajusta al último día.
                Las operativas acumulan registros fechados dentro de cada mes.
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
                    {chosen.map((t) => (
                      <div key={t.id}>
                        <span>
                          {t.title}
                          <small>
                            {t.kind === "operativa"
                              ? `${t.target} ${t.unit}`
                              : t.steps.join(" → ")}
                          </small>
                        </span>
                        <b>{t.weight} pts</b>
                      </div>
                    ))}
                    {draft.customTitle && (
                      <div>
                        {draft.customTitle}
                        <b>1 pt</b>
                      </div>
                    )}
                  </section>
                ))}
              </div>
              <div className="note">
                Frecuencia: {draft.frequency} · día {draft.day}. Al confirmar,
                el tablero tendrá estas tareas y empezará el recorrido guiado.
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
