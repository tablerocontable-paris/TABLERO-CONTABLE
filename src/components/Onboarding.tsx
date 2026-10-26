import { useState } from "react";
import ScheduleEditor from "./ScheduleEditor";
import ThemeControl from "./ThemeControl";
import {
  defaultSchedule,
  occurrences,
  describeSchedule,
} from "../domain/schedule";
import { id } from "../domain/model";
import { NEUTRAL_STARTER_CATALOG, NEUTRAL_STARTER_GROUP_DESCRIPTIONS, NEUTRAL_STARTER_SUGGESTIONS } from "../domain/neutralStarterCatalog";
import StepListEditor, { parseSteps, validateSteps } from "./StepListEditor";
import {
  ArrowRight,
  ArrowLeft,
  Check,
  Building2,
  BriefcaseBusiness,
  CalendarDays,
  Sparkles,
  Plus,
  Trash2,
} from "lucide-react";
import type { State, Profile, Onboarding as Draft } from "../domain/model";

function withoutKey<T>(record: Record<string, T> | undefined, key: string) {
  if (!record || !(key in record)) return record;
  const next = { ...record };
  delete next[key];
  return next;
}

export default function Onboarding({
  state,
  month,
  profile,
  draft,
  update,
  finish,
  pause,
  remote=false,
  laboratory=false,
}: {
  state: State;
  month: string;
  profile: Profile;
  draft: Draft;
  update: (d: Draft) => void;
  finish: () => void;
  pause: () => void;
  remote?:boolean;
  laboratory?:boolean;
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
  const [starterSearch, setStarterSearch] = useState("");
  const [starterOnlySelected, setStarterOnlySelected] = useState(false);
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
  const proposalForm = draft.habitualProposalForm || { title: "", process: "", description: "", kind: "resultado" as const, unit: "", steps: [] };
  const proposalStepError = (() => {
    if (!proposalForm.title.trim()) return "";
    try { validateSteps(proposalForm.steps); return ""; }
    catch (error) { return (error as Error).message; }
  })();
  const proposalStepValues = (() => {
    try { return validateSteps(proposalForm.steps); } catch { return []; }
  })();
  const starterCatalog = laboratory && !remote ? NEUTRAL_STARTER_CATALOG : [];
  const starterSuggestions = laboratory && !remote && profile.role !== "jefe" ? NEUTRAL_STARTER_SUGGESTIONS : [];
  const starterLegacySelection = starterCatalog.filter((entry) => draft.selectedTemplateIds.includes(entry.id));
  const availableTemplates = [...state.templates, ...starterCatalog];
  const chosen = availableTemplates.filter((t) => draft.selectedTemplateIds.includes(t.id));
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
  const effectiveAll = profile.role === "jefe" ? [] : all;
  const scheduleFor = (tid: string, cid?: string) =>
    (laboratory && cid ? draft.companySchedules?.[tid]?.[cid] : undefined) ||
    draft.schedules?.[tid] || defaultSchedule(month + "-25");
  const scheduleForProposal = (proposal: NonNullable<Draft["habitualTaskProposals"]>[number], companyId: string) =>
    draft.companySchedules?.[proposal.id]?.[companyId] || draft.schedules?.[proposal.id] ||
    (proposal.starterId ? { ...defaultSchedule(month + "-25"), hasDeadline: false } : defaultSchedule(month + "-25"));
  const targetFor = (tid: string, cid: string, fallback: number) =>
    laboratory ? (draft.companyTargets?.[tid]?.[cid] ?? fallback) : fallback;
  const companiesFor = (tid: string) =>
    (draft.assignmentCompanyIds?.[tid] || draft.selectedCompanyIds).filter(
      (cid) => draft.selectedCompanyIds.includes(cid),
    );
  const proposalCompaniesFor = (proposal: NonNullable<Draft["habitualTaskProposals"]>[number]) =>
    proposal.companyIds.filter((cid) => draft.selectedCompanyIds.includes(cid));
  const starterDrafts = (draft.habitualTaskProposals || []).filter((proposal) => !!proposal.starterId);
  const starterDraftFor = (starterId: string) => starterDrafts.find((proposal) => proposal.starterId === starterId);
  const normalizedStarterSearch = starterSearch.trim().toLocaleLowerCase("es-AR");
  const matchingStarterSuggestionCount = starterSuggestions.filter((item) => {
    const matches = !normalizedStarterSearch || `${item.title} ${item.group} ${item.aliases.join(" ")}`.toLocaleLowerCase("es-AR").includes(normalizedStarterSearch);
    return matches && (!starterOnlySelected || !!starterDraftFor(item.id));
  }).length;
  const patchStarterDraft = (starterId: string, change: (proposal: NonNullable<Draft["habitualTaskProposals"]>[number]) => NonNullable<Draft["habitualTaskProposals"]>[number]) =>
    patch({ habitualTaskProposals: (draft.habitualTaskProposals || []).map((proposal) => proposal.starterId === starterId ? change(proposal) : proposal) });
  const patchProposalCompanies = (proposal: NonNullable<Draft["habitualTaskProposals"]>[number], companyIds: string[]) => {
    const removedCompanyIds = proposal.companyIds.filter((companyId) => !companyIds.includes(companyId));
    let companySchedules = draft.companySchedules;
    let companyTargets = draft.companyTargets;
    for (const companyId of removedCompanyIds) {
      const schedules = withoutKey(companySchedules?.[proposal.id], companyId);
      const targets = withoutKey(companyTargets?.[proposal.id], companyId);
      if (companySchedules && schedules) companySchedules = { ...companySchedules, [proposal.id]: schedules };
      if (companyTargets && targets) companyTargets = { ...companyTargets, [proposal.id]: targets };
    }
    patch({
      habitualTaskProposals: (draft.habitualTaskProposals || []).map((row) => row.id === proposal.id ? { ...row, companyIds } : row),
      ...(companySchedules ? { companySchedules } : {}),
      ...(companyTargets ? { companyTargets } : {}),
    });
  };
  let validSchedules = true;
  let count = 0;
  for (const t of effectiveAll) {
    const companies = companiesFor(t.id);
    if (!companies.length) validSchedules = false;
    for (const cid of companies) {
      try {
        count += occurrences(scheduleFor(t.id, cid), month).length;
        if (!laboratory) {
          const target = targetFor(t.id, cid, "target" in t ? t.target : 0);
          if (!Number.isFinite(target) || target < 0) validSchedules = false;
        }
      } catch {
        validSchedules = false;
      }
    }
  }
  const proposals = laboratory && profile.role !== "jefe" ? draft.habitualTaskProposals || [] : [];
  let proposalCount = 0;
  for (const proposal of proposals) {
    const companies = proposalCompaniesFor(proposal);
    if (!companies.length) validSchedules = false;
    for (const cid of companies) {
      try {
        occurrences(scheduleForProposal(proposal, cid), month);
        if (!laboratory && proposal.kind === "operativa") {
          const target = targetFor(proposal.id, cid, 0);
          if (!Number.isFinite(target) || target < 0 || !proposal.unit.trim()) validSchedules = false;
        }
        proposalCount++;
      } catch {
        validSchedules = false;
      }
    }
  }
  const valid =
    draft.step === 0
      ? draft.name.trim().length > 1
      : draft.step === 1
        ? draft.selectedCompanyIds.length > 0
        : draft.step === 2
          ? profile.role === "jefe" || ((effectiveAll.length > 0 || proposals.length > 0) && !customStepError)
          : draft.step === 3
            ? validSchedules
            : true;
  const patch = (v: Partial<Draft>) => update({ ...draft, ...v });
  const clearDraftReferences = (key: string) => ({
    schedules: withoutKey(draft.schedules, key),
    companySchedules: withoutKey(draft.companySchedules, key),
    companyTargets: withoutKey(draft.companyTargets, key),
    assignmentCompanyIds: withoutKey(draft.assignmentCompanyIds, key),
  });
  const removeProposalDraft = (proposal: NonNullable<Draft["habitualTaskProposals"]>[number]) => patch({
    habitualTaskProposals: (draft.habitualTaskProposals || []).filter((row) => row.id !== proposal.id),
    ...clearDraftReferences(proposal.id),
  });
  const removeLegacyStarter = (starter: (typeof NEUTRAL_STARTER_CATALOG)[number]) => patch({
    selectedTemplateIds: draft.selectedTemplateIds.filter((selectedId) => selectedId !== starter.id),
    ...clearDraftReferences(starter.id),
  });
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
          {remote ? 'Inducción personal · progreso guardado en el servidor' : 'Inducción de demostración · progreso guardado en este navegador'}
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
              <h2>{profile.role === "jefe" ? "Prepará la gestión de tu equipo." : "Contanos qué hacés habitualmente."}</h2>
              <p>
                {profile.role === "jefe"
                  ? "Este perfil administra personas, empresas y parámetros. Las tareas de ejecución se asignan a los equipos desde sus perfiles."
                  : laboratory
                    ? "Elegí del catálogo. Los entregables se evalúan por controles y puntos; las operativas se registran por unidad, movimientos y tiempo. El coeficiente vigente de cada operativa lo configura la jefatura. La frecuencia y el vencimiento se conservan por empresa."
                    : "Elegí del catálogo. Los pesos y las metas son definidos por el jefe. El nombre, proceso y controles son iguales para todas las empresas; la empresa, fecha y meta corresponden a tu asignación."}
              </p>
              {profile.role === "jefe" ? (
                <div className="note">
                  La inducción de jefatura no crea tareas personales. Podés continuar y luego configurar el organigrama y el catálogo.
                  {starterDrafts.length > 0 && <section className="starter-manager-drafts" aria-label="Borradores v2 conservados">
                    <p>Se conservan estos borradores; no se enviarán desde jefatura.</p>
                    {starterDrafts.map((proposal) => <div className="custom-task-row" key={proposal.starterId}>
                      <b>{proposal.title}</b>
                      <button type="button" onClick={() => removeProposalDraft(proposal)}>Quitar borrador</button>
                    </div>)}
                  </section>}
                </div>
              ) : (
                <>
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
                            ? laboratory ? `${t.unit || "Movimientos"} · sin cuota` : `${t.target} ${t.unit}/mes · ${t.weight} pts`
                            : `${t.steps.length} pasos · ${t.weight} pts`}{" "}
                          {t.sector === profile.sector
                            ? "· Sugerida para tu sector"
                            : ""}
                        </small>
                      </div>
                    </label>
                  ))}
              </div>
              {(starterSuggestions.length > 0 || starterLegacySelection.length > 0) && (
                <section className="neutral-starter-catalog" aria-labelledby="neutral-starter-heading">
                  {starterSuggestions.length > 0 && <h3 id="neutral-starter-heading">Sugerencias para propuestas · opcionales</h3>}
                  {starterSuggestions.length > 0 && <>
                  <p>Las descripciones, tipo, unidad y controles son propuestas configurables, no datos fuente. Al finalizar la inducción se envían a jefatura para revisión; no crean trabajo ni fijan metas, pesos o vencimientos.</p>
                  <label className="starter-search">Buscar sugerencias
                    <input type="search" value={starterSearch} onChange={(event) => setStarterSearch(event.target.value)} placeholder="Buscar por nombre, alias o grupo" />
                  </label>
                  <label className="starter-filter"><input type="checkbox" checked={starterOnlySelected} onChange={(event) => setStarterOnlySelected(event.target.checked)} /> Sólo seleccionadas ({starterDrafts.length})</label>
                  <div className="starter-suggestion-groups">
                    {Object.entries(NEUTRAL_STARTER_GROUP_DESCRIPTIONS).map(([group, groupDescription]) => {
                      const groupItems = starterSuggestions.filter((item) => item.group === group);
                      const groupSelectedCount = groupItems.filter((item) => !!starterDraftFor(item.id)).length;
                      const visibleItems = groupItems.filter((item) => {
                        const query = starterSearch.trim().toLocaleLowerCase("es-AR");
                        const matchesSearch = !query || `${item.title} ${item.group} ${item.aliases.join(" ")}`.toLocaleLowerCase("es-AR").includes(query);
                        return matchesSearch && (!starterOnlySelected || !!starterDraftFor(item.id));
                      });
                      if (!visibleItems.length) return null;
                      return <details className="starter-suggestion-group" key={group}>
                        <summary><b>{group}</b><span>{groupItems.length} sugerencias · {groupSelectedCount} seleccionadas</span></summary>
                        <p>{groupDescription}</p>
                        <div className="starter-suggestion-list">
                          {visibleItems.map((item) => {
                            const selected = starterDraftFor(item.id);
                            const initial = {
                              id: `${item.id}:${profile.id}`, starterId: item.id, title: item.title, process: "",
                              description: item.description, kind: item.suggestedKind, unit: item.suggestedUnit,
                              steps: [...item.suggestedSteps], companyIds: [] as string[],
                            };
                            const value = selected || initial;
                            const patchValue = (change: Partial<typeof initial>) => patchStarterDraft(item.id, (current) => ({ ...current, ...change }));
                            return <details className="starter-suggestion-detail" key={item.id}>
                              <summary><span><b>{item.title}</b>{selected && <small> · En borrador</small>}</span><small>{item.aliases.slice(0, 3).join(" · ")}</small></summary>
                              <p>{item.description}</p>
                              <p className="starter-configurable-note">Configuración inicial sugerida · editable · no es dato fuente</p>
                              <dl className="starter-suggestion-meta"><dt>Tipo</dt><dd>{item.suggestedKind === "operativa" ? "Actividad con cantidad" : "Entregable con controles"}</dd>{item.suggestedUnit && <><dt>Unidad</dt><dd>{item.suggestedUnit}</dd></>}<dt>Controles sugeridos</dt><dd>{item.suggestedSteps.length} pasos</dd></dl>
                              {!selected ? <button type="button" className="primary" onClick={() => patch({ habitualTaskProposals: [...(draft.habitualTaskProposals || []), initial] })}>Preparar propuesta editable</button> : <div className="starter-suggestion-editor">
                                <label>Nombre editable<input value={value.title} maxLength={120} onChange={(event) => patchValue({ title: event.target.value })} /></label>
                                <label>Descripción editable<textarea value={value.description} maxLength={1000} rows={3} onChange={(event) => patchValue({ description: event.target.value })} /></label>
                                <label>Tipo editable<select value={value.kind} onChange={(event) => patchValue({ kind: event.target.value as Draft["customKind"], unit: event.target.value === "operativa" ? value.unit || item.suggestedUnit : "" })}><option value="resultado">Entregable con controles</option><option value="operativa">Actividad con cantidad</option></select></label>
                                {value.kind === "operativa" && <label>Unidad editable<input value={value.unit} maxLength={40} onChange={(event) => patchValue({ unit: event.target.value })} /></label>}
                                <label>Controles sugeridos editables</label>
                                <StepListEditor value={value.steps} onChange={(steps) => patchValue({ steps })} />
                                <fieldset><legend>Empresas para esta propuesta · selección manual</legend><div className="company-options">{state.companies.filter((company) => draft.selectedCompanyIds.includes(company.id)).map((company) => <label key={company.id}><input type="checkbox" checked={value.companyIds.includes(company.id)} onChange={(event) => {
                                  const companyIds = event.target.checked ? [...new Set([...value.companyIds, company.id])] : value.companyIds.filter((companyId) => companyId !== company.id);
                                  patchValue({ companyIds });
                                  if (!event.target.checked) {
                                    const selected = starterDraftFor(item.id);
                                    if (selected) patchProposalCompanies(selected, companyIds);
                                  }
                                }} />{company.name}</label>)}</div></fieldset>
                                <small>Se guardará como propuesta pendiente de revisión de jefatura. No se generan tareas, metas, pesos ni vencimientos.</small>
                                <button type="button" onClick={() => removeProposalDraft(selected)}>Quitar selección</button>
                              </div>}
                            </details>;
                          })}
                        </div>
                      </details>;
                    })}
                  </div>
                  {matchingStarterSuggestionCount === 0 && <p>{starterOnlySelected ? "No hay sugerencias seleccionadas que coincidan con el filtro." : "No hay sugerencias con ese texto."}</p>}
                  </>}
                  <details>
                    <summary>Historial v1 · conservar borradores antiguos</summary>
                    <p>Los borradores antiguos conservan su selección, controles y frecuencia. Podés quitar una selección desde acá; las selecciones existentes mantienen su preview y materialización original.</p>
                  <div className="catalog-options">
                    {starterLegacySelection.map((t) => (
                      <div className="catalog-option selected" key={t.id}>
                        <div>
                          <b>{t.title}</b>
                          <p>{t.description}</p>
                          <small>{t.kind === "operativa" ? `${t.unit} · sin cuota` : `${t.steps.length} controles sugeridos`}</small>
                        </div>
                        <button type="button" aria-label={`Quitar selección histórica ${t.title}`} onClick={() => removeLegacyStarter(t)}>Quitar</button>
                      </div>
                    ))}
                  </div>
                  </details>
                </section>
              )}
              <details>
                <summary>Agregar un trabajo esporádico · una sola vez</summary>
                <p>
                  Este espacio es para auditorías y correcciones puntuales. Si
                  falta un proceso habitual, cargalo en la propuesta de abajo;
                  jefatura decide si lo incorpora al catálogo.
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
                <p>Se agrega al tablero como tarea puntual con peso 1. Jefatura puede revisar más adelante si corresponde incorporarla al catálogo.</p>
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
              {laboratory && (
                <details className="habitual-proposal-form">
                  <summary>Proponer una tarea habitual que falta</summary>
                  <p>
                    Conservamos tu nombre original y lo mostramos junto a posibles coincidencias.
                    Jefatura decide si usa un estándar existente o crea uno; no se combina nada automáticamente.
                  </p>
                  <label>
                    Nombre de la tarea
                    <input
                      value={proposalForm.title}
                      maxLength={120}
                      onChange={(e) => patch({ habitualProposalForm: { ...proposalForm, title: e.target.value } })}
                    />
                  </label>
                  <label>
                    Banco o nombre del proceso · opcional
                    <input
                      value={proposalForm.process}
                      maxLength={160}
                      placeholder="Banco Nación, IVA, conciliación…"
                      onChange={(e) => patch({ habitualProposalForm: { ...proposalForm, process: e.target.value } })}
                    />
                  </label>
                  <label>
                    ¿Qué trabajo realizás?
                    <textarea
                      value={proposalForm.description}
                      maxLength={1000}
                      rows={3}
                      onChange={(e) => patch({ habitualProposalForm: { ...proposalForm, description: e.target.value } })}
                    />
                  </label>
                  <div className="form-grid">
                    <label>
                      Tipo de tarea
                      <select
                        value={proposalForm.kind}
                        onChange={(e) => patch({ habitualProposalForm: { ...proposalForm, kind: e.target.value as Draft["customKind"], unit: e.target.value === "operativa" ? proposalForm.unit : "" } })}
                      >
                        <option value="resultado">Entregable con controles</option>
                        <option value="operativa">{laboratory ? "Actividad con cantidad" : "Actividad con cantidad y meta"}</option>
                      </select>
                    </label>
                    {proposalForm.kind === "operativa" && (
                      <label>
                        Unidad
                        <input
                          value={proposalForm.unit}
                          maxLength={40}
                          placeholder="facturas, trámites…"
                          onChange={(e) => patch({ habitualProposalForm: { ...proposalForm, unit: e.target.value } })}
                        />
                      </label>
                    )}
                  </div>
                  <label>Controles o pasos sugeridos</label>
                  <StepListEditor
                    value={proposalForm.steps}
                    error={proposalStepError}
                    onChange={(steps) => patch({ habitualProposalForm: { ...proposalForm, steps } })}
                  />
                  <button
                    type="button"
                    className="primary"
                    disabled={!proposalForm.title.trim() || !proposalForm.description.trim() || !proposalStepValues.length || !!proposalStepError || (proposalForm.kind === "operativa" && !proposalForm.unit.trim())}
                    onClick={() => {
                      patch({
                        habitualTaskProposals: [...(draft.habitualTaskProposals || []), {
                          id: id(),
                          title: proposalForm.title.trim(),
                          process: proposalForm.process.trim(),
                          description: proposalForm.description.trim(),
                          kind: proposalForm.kind,
                          unit: proposalForm.kind === "operativa" ? proposalForm.unit.trim() : "",
                          steps: proposalStepValues,
                          companyIds: [...draft.selectedCompanyIds],
                        }],
                        habitualProposalForm: { title: "", process: "", description: "", kind: "resultado", unit: "", steps: [] },
                      });
                    }}
                  >
                    <Plus size={15} /> Agregar propuesta
                  </button>
                </details>
              )}
              {proposals.map((proposal) => (
                <div className="custom-task-row habitual-proposal-row" key={proposal.id}>
                  <span><b>{proposal.title}</b><small>Propuesta · todavía no crea tareas ni KPI</small></span>
                  <button type="button" aria-label={`Quitar propuesta ${proposal.title}`} onClick={() => removeProposalDraft(proposal)}>
                    <Trash2 size={15} />
                  </button>
                </div>
              ))}
                </>
              )}
            </>
          ) : draft.step === 3 ? (
            <>
              <CalendarDays className="intro-icon" />
              <h2>Cada tarea tiene su propio ritmo.</h2>
              <p>
                {laboratory
                  ? "Programá cada proceso por empresa y definí si tiene vencimiento. Los entregables conservan sus controles y puntos; las operativas se miden por movimientos registrados y tiempo, sin meta mensual. Una tarea puntual no vuelve el mes siguiente."
                  : "Indicá frecuencia, vencimiento y meta para cada empresa. Una tarea puntual no vuelve el mes siguiente."}
              </p>
              {all.map((t) => (
                <details
                  className="schedule-task"
                  key={t.id}
                  open={all.length === 1 || undefined}
                >
                  <summary>
                    <b>{t.title}</b>
                    <small>{companiesFor(t.id).length} empresas asignadas</small>
                  </summary>
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
                  {companiesFor(t.id).map((cid) => {
                    const companyName = state.companies.find((row) => row.id === cid)?.name || "Empresa";
                    return (
                      <section className="induction-company-schedule" key={cid}>
                        <h3>{companyName}</h3>
                        {laboratory && t.kind === "operativa" && (
                          <p className="note">Se registran movimientos y tiempo, sin cuota mensual. La jefatura puede configurar el peso por movimiento.</p>
                        )}
                        <ScheduleEditor
                          onlyOnce={!chosen.some((x) => x.id === t.id)}
                          value={scheduleFor(t.id, cid)}
                          onChange={(schedule) => laboratory
                            ? patch({ companySchedules: { ...draft.companySchedules, [t.id]: { ...draft.companySchedules?.[t.id], [cid]: schedule } } })
                            : patch({ schedules: { ...draft.schedules, [t.id]: schedule } })}
                          month={month}
                        />
                      </section>
                    );
                  })}
                </details>
              ))}
              {proposals.length > 0 && (
                <div className="habitual-proposal-schedules">
                  <h3>Propuestas que revisará jefatura</h3>
                  <p>La frecuencia se configura por empresa. Las sugerencias v2 comienzan sin vencimiento; cualquier ajuste de frecuencia o plazo es una elección explícita y sigue siendo sólo una propuesta.</p>
                  {proposals.map((proposal) => (
                    <section className="habitual-proposal-schedule" key={proposal.id}>
                      <h4>{proposal.title}</h4>
                      <fieldset>
                        <legend>Empresas de esta propuesta</legend>
                        <div className="company-options">
                          {state.companies.filter((c) => draft.selectedCompanyIds.includes(c.id)).map((c) => (
                            <label key={c.id}>
                              <input
                                type="checkbox"
                                checked={proposalCompaniesFor(proposal).includes(c.id)}
                                onChange={(e) => patchProposalCompanies(proposal, e.target.checked ? [...new Set([...proposal.companyIds, c.id])] : proposal.companyIds.filter((companyId) => companyId !== c.id))}
                              />
                              {c.name}
                            </label>
                          ))}
                        </div>
                      </fieldset>
                      {proposalCompaniesFor(proposal).map((cid) => (
                        <section className="induction-company-schedule" key={cid}>
                          <h3>{state.companies.find((row) => row.id === cid)?.name}</h3>
                          {proposal.kind === "operativa" && (
                            <p className="note">Actividad por movimientos, sin meta. La jefatura configura el coeficiente por empresa y vigencia en Coeficientes por movimiento; hasta entonces la carga queda pendiente de parametrizar.</p>
                          )}
                          <ScheduleEditor
                            value={scheduleForProposal(proposal, cid)}
                            onChange={(schedule) => patch({ companySchedules: { ...draft.companySchedules, [proposal.id]: { ...draft.companySchedules?.[proposal.id], [cid]: schedule } } })}
                            month={month}
                          />
                        </section>
                      ))}
                    </section>
                  ))}
                </div>
              )}
              <div className="note">
                El vencimiento se calcula desde cada nueva ocurrencia. El día 31
                se ajusta al último día del mes. Cada empresa conserva su propia
                regla; un plazo de 2 días vence dos días después de cada
                realización.
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
                en {draft.selectedCompanyIds.length} empresas
                {proposalCount ? <> y <strong>{proposalCount} propuestas pendientes</strong> de confirmación</> : null}.
                {" "}Podés volver atrás y ajustar.
              </p>
              <div className="preview-list">
                {draft.selectedCompanyIds.map((cid) => (
                  <section key={cid}>
                    <h3>{state.companies.find((c) => c.id === cid)?.name}</h3>
                    {effectiveAll.filter((t) => companiesFor(t.id).includes(cid)).map((t) => (
                      <div key={t.id}>
                        <span>
                          {t.title}
                          <small>{describeSchedule(scheduleFor(t.id, cid))}</small>
                        </span>
                        <b>{laboratory && t.kind === "operativa" ? `${t.unit || "Movimientos"} · sin cuota` : `${"weight" in t ? t.weight : 1} pts`}</b>
                      </div>
                    ))}
                    {proposals.filter((proposal) => proposalCompaniesFor(proposal).includes(cid)).map((proposal) => (
                      <div className="preview-proposal" key={proposal.id}>
                        <span>{proposal.title}<small>Propuesta · {describeSchedule(scheduleForProposal(proposal, cid))}</small></span>
                        <b>{proposal.kind === "operativa" ? `${proposal.unit || "Movimientos"} · sin cuota` : "Pendiente"}</b>
                      </div>
                    ))}
                  </section>
                ))}
              </div>
              <div className="note">
                Las tareas del catálogo y los trabajos puntuales se preparan ahora.
                Las propuestas habituales quedan separadas y no crean tareas ni
                puntos hasta que jefatura confirme el estándar. Cada empresa
                conserva su frecuencia. Las tareas operativas se miden por movimientos registrados, no por una meta mensual.
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
