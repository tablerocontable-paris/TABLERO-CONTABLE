import { useEffect, useMemo, useState } from "react";
import { companyCloseGroups, companyCloseUnits, closeCompanyUnits, companyMetrics, companyUnitCloseBlocker, isLabCompanyClosed, type CloseBatchResult } from "../domain/laboratory-work";
import type { Profile, State } from "../domain/model";
import { Panel } from "./ui";

type Scope = "all" | "team" | "company" | "person";
function buildPreview(state: State, actor: Profile, month: string, scope: Scope, scopeId: string) {
  const selection = { scope, ...(scope === "all" ? {} : { id: scopeId }) } as { scope: Scope; id?: string };
  const candidates = companyCloseUnits(state, month, selection);
  const readiness = new Map<string, string | null>();
  const groupMembership: string[][] = [];
  for (const group of companyCloseGroups(state, candidates)) {
    const openGroup = group.filter((unit) => !isLabCompanyClosed(state, unit.ownerId, unit.companyId, unit.month));
    const containsClosedUnit = openGroup.length !== group.length;
    const reason = containsClosedUnit && openGroup.length
      ? "Una unidad vinculada ya está cerrada; el grupo requiere revisión."
      : openGroup.map((unit) => companyUnitCloseBlocker(state, unit, actor.id)).find((value) => !!value) || null;
    groupMembership.push(group.map((unit) => `${unit.ownerId}:${unit.companyId}:${unit.month}`).sort());
    for (const unit of openGroup) readiness.set(`${unit.ownerId}:${unit.companyId}`, reason);
  }
  const open = candidates.filter((unit) => !isLabCompanyClosed(state, unit.ownerId, unit.companyId, unit.month));
  const ready = open.filter((unit) => !readiness.get(`${unit.ownerId}:${unit.companyId}`));
  const pending = open.filter((unit) => !!readiness.get(`${unit.ownerId}:${unit.companyId}`));
  const fingerprint = JSON.stringify({
    actor: { id: actor.id, role: actor.role, active: actor.active, managerId: actor.managerId, teamId: actor.teamId, companyIds: [...actor.companyIds].sort() },
    month, scope, scopeId: scope === "all" ? "" : scopeId,
    groups: groupMembership.sort((a, b) => a.join("|").localeCompare(b.join("|"))),
    units: candidates.map((unit) => {
      const key = `${unit.ownerId}:${unit.companyId}`;
      return { key, closed: isLabCompanyClosed(state, unit.ownerId, unit.companyId, unit.month), reason: readiness.get(key) || null };
    }).sort((a, b) => a.key.localeCompare(b.key)),
  });
  return { candidates, open, ready, pending, readiness, fingerprint };
}

export default function CompanyClosureManager({ state, actor, month, commit, companyOf, nameOf, teamName, notify }: {
  state: State; actor: Profile; month: string; commit: (next: State, action?: string, entityId?: string) => boolean;
  companyOf: (id: string) => string; nameOf: (id: string) => string; teamName: (id: string) => string; notify: (message: string) => void;
}) {
  const [scope, setScope] = useState<Scope>("all");
  const [scopeId, setScopeId] = useState("");
  const [note, setNote] = useState("");
  const [confirmedFingerprint, setConfirmedFingerprint] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<{ result: CloseBatchResult; context: string } | null>(null);
  const preview = useMemo(() => buildPreview(state, actor, month, scope, scopeId), [state, actor, month, scope, scopeId]);
  const { candidates, open, ready, pending, readiness } = preview;
  const confirmed = confirmedFingerprint === preview.fingerprint;
  const context = JSON.stringify({ actorId: actor.id, month, scope, scopeId: scope === "all" ? "" : scopeId });
  useEffect(() => { setConfirmedFingerprint(null); }, [preview.fingerprint]);
  useEffect(() => { setLastResult(null); }, [context]);
  const choices = scope === "team" ? state.teams.map((team) => ({ id: team.id, label: team.name }))
    : scope === "company" ? state.companies.map((company) => ({ id: company.id, label: company.name }))
      : scope === "person" ? state.profiles.filter((profile) => profile.active && profile.role !== "jefe").map((profile) => ({ id: profile.id, label: profile.name })) : [];
  return <Panel title={`Cierres por empresa · ${month}`} sub="Cada unidad es una persona, una empresa y un período. Los grupos vinculados se cierran completos; un grupo pendiente no frena los grupos independientes listos." collapsible defaultOpen>
    <div className="lab-close-controls" data-tour="monthly-close">
      <label>Alcance<select value={scope} onChange={(event) => { setScope(event.target.value as Scope); setScopeId(""); setConfirmedFingerprint(null); }}>
        <option value="all">Todos</option><option value="team">Equipo</option><option value="company">Empresa</option><option value="person">Persona</option>
      </select></label>
      {scope !== "all" && <label>Seleccionar {scope === "team" ? "equipo" : scope === "company" ? "empresa" : "persona"}<select value={scopeId} onChange={(event) => { setScopeId(event.target.value); setConfirmedFingerprint(null); }}><option value="">Elegir…</option>{choices.map((choice) => <option key={choice.id} value={choice.id}>{choice.label}</option>)}</select></label>}
      <span className="lab-close-count">{ready.length} listas para cerrar · {pending.length} pendientes · {candidates.length - open.length} ya cerradas</span>
    </div>
    <p className="note">Revisá el alcance exacto antes de confirmar. Si una unidad vinculada está bloqueada, todas las del grupo quedan pendientes con el motivo.</p>
    {!open.length ? <p data-tour="closure-preview">No hay unidades abiertas para este alcance y período.</p> : <div className="table-wrap" data-tour="closure-preview"><table><thead><tr><th>Persona</th><th>Empresa</th><th>Entregables</th><th>Cumplimiento</th><th>Estado</th></tr></thead><tbody>
      {candidates.map((unit) => {
        const closed = isLabCompanyClosed(state, unit.ownerId, unit.companyId, unit.month);
        const metrics = companyMetrics(state, unit.ownerId, unit.companyId, unit.month);
        const blocked = lastResult?.result.blocked.find((entry) => entry.unit.ownerId === unit.ownerId && entry.unit.companyId === unit.companyId);
        const reason = blocked?.reason || readiness.get(`${unit.ownerId}:${unit.companyId}`);
        return <tr key={`${unit.ownerId}:${unit.companyId}`}><td>{nameOf(unit.ownerId)}<small>{state.profiles.find((profile) => profile.id === unit.ownerId)?.teamId ? teamName(state.profiles.find((profile) => profile.id === unit.ownerId)!.teamId) : ""}</small></td><td>{companyOf(unit.companyId)}</td><td>{metrics.done}/{metrics.assigned}</td><td>{metrics.weighted === null ? "Sin base" : `${Math.round(metrics.weighted)}%`}</td><td>{closed ? <span className="status success">Cerrado</span> : reason ? <span className="status danger">Pendiente: {reason}</span> : <span className="status">Lista para cerrar</span>}</td></tr>;
      })}
    </tbody></table></div>}
    {!!ready.length && <form className="lab-close-form" onSubmit={(event) => {
      event.preventDefault();
      if (!confirmed) { notify("Confirmá que revisaste las unidades indicadas."); return; }
      try {
        const currentPreview = buildPreview(state, actor, month, scope, scopeId);
        if (confirmedFingerprint !== currentPreview.fingerprint) {
          setConfirmedFingerprint(null);
          setLastResult(null);
          notify("Cambió el período, el alcance o el estado de las unidades. Revisá la vista previa y confirmá otra vez.");
          return;
        }
        const result = closeCompanyUnits(state, currentPreview.ready, actor.id, note);
        if (commit(result.state, "Cerró unidades por empresa", `${scope}:${scopeId || "all"}:${month}`)) {
          setLastResult({ result, context }); setConfirmedFingerprint(null);
          notify(`${result.closed.length} unidad(es) cerradas · ${result.blocked.length} pendiente(s) con motivo.`);
        }
      } catch (error) { notify(error instanceof Error ? error.message : "No se pudo preparar el cierre."); }
    }}>
      <label>Observación del cierre<textarea value={note} onChange={(event) => setNote(event.target.value)} maxLength={1000} minLength={5} required placeholder="Dejá constancia de los pendientes revisados y el criterio del cierre." /></label>
      <label className="check-line"><input type="checkbox" checked={confirmed} onChange={(event) => setConfirmedFingerprint(event.target.checked ? preview.fingerprint : null)} /> Revisé las {ready.length} unidades listas que se cerrarán. Las {pending.length} pendientes quedan abiertas.</label>
      <button className="primary" disabled={!confirmed || note.trim().length < 5 || month > new Date().toISOString().slice(0, 7)}>Cerrar {ready.length} unidades listas</button>
    </form>}
    {lastResult?.context === context && <div className="lab-close-result" role="status"><b>{lastResult.result.closed.length} cerradas · {lastResult.result.blocked.length} pendientes</b>{lastResult.result.blocked.map((entry) => <p key={`${entry.unit.ownerId}:${entry.unit.companyId}`}>{nameOf(entry.unit.ownerId)} · {companyOf(entry.unit.companyId)}: {entry.reason}</p>)}</div>}
  </Panel>;
}
