import { useEffect, useState } from "react";
import { ChevronDown } from "lucide-react";
import type { Profile, State, Template } from "../domain/model";
import { currentCatalogueVersion, reviseCatalogueTemplate } from "../domain/processImprovement";

export default function CatalogueVersionCard({ state, template, actor, commit, notify, versioned }: {
  state: State;
  template: Template;
  actor: Profile;
  commit: (next: State, action: string, id?: string) => boolean;
  notify: (message: string) => void;
  versioned: boolean;
}) {
  const [targetDraft, setTargetDraft] = useState(String(template.target));
  useEffect(() => setTargetDraft(String(template.target)), [template.target]);
  const history = (state.catalogueVersions || []).filter((row) => row.templateId === template.id).sort((a, b) => b.version - a.version);
  const editable = actor.active && actor.role === "jefe";

  function save(patch: Partial<Pick<Template, "weight" | "target">>, label: string) {
    try {
      const next = versioned
        ? reviseCatalogueTemplate(state, template.id, actor, patch, label)
        : { ...state, templates: state.templates.map((row) => row.id === template.id ? { ...row, ...patch } : row) };
      if (commit(next, versioned ? "Versionó proceso del catálogo" : "Actualizó catálogo", template.id)) notify(versioned ? "Cambio guardado como nueva versión; no modifica cierres." : "Cambio guardado.");
    } catch (error) { notify((error as Error).message); }
  }

  const versionNumber = currentCatalogueVersion(state, template.id);
  return (
    <details className="catalog-item" key={template.id}>
      <summary className="catalog-summary">
        <span className="catalog-summary-main">
          <span className="catalog-summary-title">{template.title}</span>
          <small>{template.sector}</small>
        </span>
        <span className="catalog-summary-meta">
          <span className="badge">{template.kind === "operativa" ? "Operativa" : "Entregable"}</span>
          {versioned && <span className="catalog-version-badge">V{versionNumber || 1}</span>}
          <b>{template.weight} pts</b>
          <ChevronDown className="catalog-chevron" size={16} aria-hidden="true" />
        </span>
      </summary>
      <div className="catalog-item-details">
        <p>{template.description}</p>
        <div className="catalog-fields">
          <label>Peso de la tarea<select disabled={!editable} value={template.weight} onChange={(event) => {
            const weight = Number(event.target.value);
            if (weight !== template.weight) save({ weight }, `Peso ${template.weight} → ${weight} puntos`);
          }}>{[1, 2, 3, 5, 8].map((weight) => <option key={weight} value={weight}>{weight} puntos</option>)}</select></label>
          {template.kind === "operativa" && <label>Meta por ocurrencia<input type="number" min="1" max="1000000" disabled={!editable} value={targetDraft} onChange={(event) => setTargetDraft(event.target.value)} onBlur={() => {
            const target = Number(targetDraft);
            if (!Number.isFinite(target) || target < 1 || target > 1000000) { setTargetDraft(String(template.target)); notify("La meta debe estar entre 1 y 1.000.000."); return; }
            if (target !== template.target) save({ target }, `Meta ${template.target} → ${target} ${template.unit}`);
          }} /><small>{template.unit}</small></label>}
        </div>
        {template.steps.length > 0 && <ol>{template.steps.map((step, index) => <li key={`${index}-${step}`}>{step}</li>)}</ol>}
        {versioned && history.length > 0 && <details className="catalogue-version-history"><summary>Historial de versiones ({history.length})</summary><ol>{history.map((version) => <li key={version.id}><b>Versión {version.version}</b> · {version.changeReason}<small>{version.effectiveOn ? ` Vigente desde ${version.effectiveOn}.` : " Vigencia anterior desconocida."} · Registrada {new Date(version.capturedAt).toLocaleDateString("es-AR")}.</small><div>{version.weight} puntos{version.kind === "operativa" ? ` · meta ${version.target} ${version.unit}` : ""} · {version.steps.length} controles</div></li>)}</ol></details>}
      </div>
    </details>
  );
}
