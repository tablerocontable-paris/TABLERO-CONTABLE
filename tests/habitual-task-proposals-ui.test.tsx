// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { seed } from "../src/data/repository";
import { currentMonth, materialize, type State } from "../src/domain/model";
import { defaultSchedule } from "../src/domain/schedule";
import { requestHabitualProposalChanges, submitHabitualTaskProposal } from "../src/domain/habitualTaskProposals";
import { HabitualTaskProposalInbox, MyHabitualTaskProposals } from "../src/components/HabitualTaskProposals";
import NotificationCenter from "../src/components/NotificationCenter";
import { pendingParameterizations } from "../src/domain/parameterization";
import { PARIS_TASK_CATALOG_VERSION, selectableParisTasks } from "../src/domain/parisTaskCatalog";

beforeEach(() => {
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute("open", ""); };
  HTMLDialogElement.prototype.close = function () { this.removeAttribute("open"); };
});
afterEach(cleanup);

function pendingProposals(canonical = false) {
  let state = seed();
  state.assignments = [];
  state.tasks = [];
  state.notifications = [];
  const input = {
    title: canonical ? "Conciliación bancaria" : "Conciliación Banco Nación",
    process: canonical ? "" : "Banco Nación",
    description: "Comparar los movimientos y dejar las diferencias documentadas.",
    kind: "resultado" as const,
    unit: "",
    target: 0,
    schedule: defaultSchedule("2026-10-10", "mensual"),
    steps: ["Descargar el extracto", "Comparar movimientos"],
    ...(canonical ? { taskCode: "gpar_bank_reconciliation", taskCatalogVersion: PARIS_TASK_CATALOG_VERSION, businessUnitCode: "paris_autos" as const, taskParameters: { banco: "Banco Nación", cuenta: "Principal" } } : {}),
  };
  state = submitHabitualTaskProposal(state, state.profiles.find((profile) => profile.id === "e0")!, {
    ...input, id: "proposal-c1", companyId: "c1",
  }, "2026-10-07T12:00:00.000Z");
  state = submitHabitualTaskProposal(state, state.profiles.find((profile) => profile.id === "e1")!, {
    ...input, id: "proposal-c2", companyId: "c2",
  }, "2026-10-07T12:01:00.000Z");
  return state;
}

describe("interfaz de propuestas de tareas habituales", () => {
  it("mantiene bloqueada una revisión si el historial anterior contiene una clasificación parcial", () => {
    const base = pendingProposals();
    const original = base.habitualTaskProposals![0]!;
    const paris = {
      ...original,
      taskCode: "gpar_bank_reconciliation",
      taskCatalogVersion: PARIS_TASK_CATALOG_VERSION,
      businessUnitCode: "paris_autos" as const,
      taskParameters: { banco: "nacion", cuenta: "Principal" },
      revision: 2,
      submissions: [
        { ...original.submissions[0]!, revision: 1, taskCode: "gpar_bank_reconciliation", taskCatalogVersion: PARIS_TASK_CATALOG_VERSION },
        { ...original.submissions[0]!, revision: 2, taskCode: "gpar_bank_reconciliation", taskCatalogVersion: PARIS_TASK_CATALOG_VERSION, businessUnitCode: "paris_autos" as const, taskParameters: { banco: "nacion", cuenta: "Principal" } },
      ],
    };
    const state = { ...base, habitualTaskProposals: [paris] };
    render(<HabitualTaskProposalInbox state={state} actor={state.profiles.find((profile) => profile.id === "boss")!} month={currentMonth()} commit={() => true} notify={() => {}} />);
    expect(screen.getByRole("note").textContent).toMatch(/historial contiene datos de clasificación parciales/i);
    expect(screen.queryByRole("button", { name: /Vincular y activar/ })).toBeNull();
    expect(screen.queryByText(/Crear un estándar para/)).toBeNull();
    expect(screen.getAllByText(/Solicitar correcciones/).length).toBeGreaterThan(0);
  });

  it("mantiene propuestas neutrales pendientes hasta seleccionar la tarea estándar", () => {
    const state = pendingProposals();
    const manager = state.profiles.find((profile) => profile.id === "boss")!;
    render(<HabitualTaskProposalInbox state={state} actor={manager} month={currentMonth()} commit={() => true} notify={() => {}} />);
    expect(screen.getByText(/completar una revisión explícita del catálogo París/i)).toBeTruthy();
    expect(screen.getByText(/el titular podrá elegir tarea, unidad y parámetros en una nueva revisión/i)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Vincular y activar/ })).toBeNull();
    expect(screen.queryByText(/Crear un estándar para/)).toBeNull();
    expect(screen.getAllByText(/Solicitar correcciones/).length).toBeGreaterThan(0);
  });

  it("permite al titular clasificar una propuesta antigua al reenviarla desde el catálogo", () => {
    let state = pendingProposals();
    const manager = state.profiles.find((profile) => profile.id === "boss")!;
    const employee = state.profiles.find((profile) => profile.id === "e0")!;
    state = requestHabitualProposalChanges(state, manager, "proposal-c1", "Elegí tarea y unidad del catálogo París.", "2026-10-08T12:00:00.000Z");
    const notify = vi.fn();
    let committed: State | undefined;
    render(<MyHabitualTaskProposals
      state={state}
      actor={employee}
      month={currentMonth()}
      commit={(next) => { committed = next; return true; }}
      notify={notify}
    />);

    fireEvent.change(screen.getByRole("combobox", { name: "Tarea del catálogo París" }), { target: { value: "gpar_bank_reconciliation" } });
    fireEvent.change(screen.getByRole("combobox", { name: "Unidad de negocio" }), { target: { value: "doral" } });
    fireEvent.change(screen.getByRole("combobox", { name: "banco · obligatorio" }), { target: { value: "frances" } });
    fireEvent.change(screen.getByRole("textbox", { name: "cuenta · obligatorio" }), { target: { value: "Cuenta principal" } });
    fireEvent.click(screen.getByRole("button", { name: "Reenviar para revisión" }));

    const updated = committed?.habitualTaskProposals?.find((proposal) => proposal.id === "proposal-c1");
    expect(updated).toMatchObject({ status: "pending", revision: 2, taskCode: "gpar_bank_reconciliation", businessUnitCode: "doral", taskParameters: { banco: "frances", cuenta: "Cuenta principal" } });
    expect(updated?.originalTitle).toBe("Conciliación Banco Nación");
    expect(updated?.submissions).toHaveLength(2);
    expect(updated?.submissions[0]).not.toHaveProperty("taskCode");
    expect(updated?.submissions[1]).toMatchObject({ revision: 2, title: "Conciliación bancaria", taskCode: "gpar_bank_reconciliation", businessUnitCode: "doral" });
    expect(notify).toHaveBeenCalledWith("La propuesta volvió a la bandeja de revisión de jefatura.");
  });

  it("permite activar propuestas canónicas conservando la asignación por persona y empresa", () => {
    const state = pendingProposals(true);
    const manager = state.profiles.find((profile) => profile.id === "boss")!;
    const notify = vi.fn();
    let committed: State | undefined;
    render(<HabitualTaskProposalInbox
      state={state}
      actor={manager}
      month={currentMonth()}
      commit={(next) => { committed = next; return true; }}
      notify={notify}
    />);

    expect(screen.getByRole("button", { name: "Plegar Propuestas de tareas habituales" }).getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByText("Posible coincidencia · 2")).toBeTruthy();
    expect(screen.getByText(/La coincidencia sólo orienta la revisión/)).toBeTruthy();
    const approve = screen.getByRole("button", { name: "Vincular y activar 2 asignaciones" });
    expect((approve as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByText("Crear un estándar para el grupo"));
    fireEvent.click(screen.getByRole("button", { name: "Crear estándar y activar 2 asignaciones" }));

    expect(committed?.habitualTaskProposals?.every((proposal) => proposal.status === "approved")).toBe(true);
    expect(committed?.assignments).toHaveLength(2);
    expect(committed?.assignments.map((assignment) => [assignment.ownerId, assignment.companyId])).toEqual([["e0", "c1"], ["e1", "c2"]]);
    const materialized = materialize(committed!, currentMonth());
    expect(materialized.tasks.map((task) => task.companyId).sort()).toEqual(["c1", "c2"]);
    expect(committed?.templates.find((template) => template.taskCode === "gpar_bank_reconciliation")).toBeTruthy();
    expect(notify).toHaveBeenCalledWith("Se activaron 2 asignaciones independientes en el laboratorio.");
  });

  it("suma las propuestas pendientes al contador y ofrece ir a revisarlas", () => {
    const state = pendingProposals();
    const openProposals = vi.fn();
    const expectedPending = pendingParameterizations(state).length + 2;
    render(<NotificationCenter
      state={state}
      commit={() => true}
      notify={() => {}}
      onOpenTask={() => {}}
      onOpenProposals={openProposals}
    />);

    fireEvent.click(screen.getByRole("button", { name: `Notificaciones: ${expectedPending} pendientes` }));
    fireEvent.click(screen.getByRole("button", { name: "Revisar propuestas" }));
    expect(openProposals).toHaveBeenCalledOnce();
  });
});
