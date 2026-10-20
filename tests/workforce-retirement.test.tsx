// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Absences, Workforce } from "../src/components/Workforce";
import { seed } from "../src/data/repository";
import { currentMonth, dateART, dueDate } from "../src/domain/model";
import { defaultSchedule } from "../src/domain/schedule";

beforeEach(() => {
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute("open", ""); };
  HTMLDialogElement.prototype.close = function () { this.removeAttribute("open"); };
});
afterEach(() => cleanup());

describe("baja y reasignación auditada en el laboratorio", () => {
  it("retira una tarea seleccionada si cambia el ámbito con el formulario de cobertura abierto", () => {
    const state = seed();
    state.activeId = "m1";
    const manager = state.profiles.find((profile) => profile.id === "m1")!;
    const task = state.tasks.find((row) => row.ownerId === "e0" && row.companyId === "c1" && row.status !== "Completada")!;
    const companyName = state.companies.find((company) => company.id === task.companyId)!.name;
    const taskLabel = new RegExp(`${task.title}.*${companyName}`);
    state.tasks = state.tasks.map((row) => row.id === task.id ? { ...row, scheduledOn: dateART(), due: dateART() } : row);
    const commit = vi.fn(() => true);
    const notify = vi.fn();
    const view = render(<Absences state={state} commit={commit} notify={notify} />);
    fireEvent.click(screen.getByRole("button", { name: "Registrar ausencia" }));
    fireEvent.change(screen.getByLabelText("Persona ausente"), { target: { value: "e0" } });
    fireEvent.change(screen.getByLabelText("Desde"), { target: { value: dateART() } });
    fireEvent.change(screen.getByLabelText("Hasta"), { target: { value: dateART() } });
    fireEvent.change(screen.getByLabelText("Quién cubre"), { target: { value: "e1" } });
    fireEvent.click(screen.getByLabelText(taskLabel));

    const revokedManager = { ...manager, companyIds: manager.companyIds.filter((companyId) => companyId !== "c1") };
    const revoked = { ...state, profiles: state.profiles.map((profile) => profile.id === manager.id ? revokedManager : profile) };
    view.rerender(<Absences state={revoked} commit={commit} notify={notify} />);
    expect(screen.queryByLabelText(taskLabel)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Guardar ausencia" }));
    expect(commit).not.toHaveBeenCalled();
    expect(notify).toHaveBeenCalledWith(expect.stringContaining("Cambió el alcance"));
  });

  it("no ofrece reglas recurrentes de empresas fuera del ámbito del encargado", () => {
    const state = seed();
    state.activeId = "m1";
    const manager = state.profiles.find((profile) => profile.id === "m1")!;
    state.profiles = state.profiles.map((profile) => profile.id === manager.id
      ? { ...profile, companyIds: profile.companyIds.filter((companyId) => companyId !== "c1") }
      : profile);
    const month = currentMonth();
    const baseRule = state.assignments.find((assignment) => assignment.ownerId === "e0" && assignment.companyId === "c1")!;
    state.assignments = [{
      ...baseRule, id: "revoked-monthly-rule-ui", frequency: "mensual", startMonth: month, day: 15,
      schedule: { ...defaultSchedule(`${month}-01`, "mensual"), monthDay: 15, hasDeadline: false },
    }];
    const view = render(<Absences state={state} commit={vi.fn(() => true)} notify={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Registrar ausencia" }));
    fireEvent.change(screen.getByLabelText("Persona ausente"), { target: { value: "e0" } });
    fireEvent.change(screen.getByLabelText("Desde"), { target: { value: `${month}-01` } });
    fireEvent.change(screen.getByLabelText("Hasta"), { target: { value: dueDate(month, 31) } });
    fireEvent.change(screen.getByLabelText("Quién cubre"), { target: { value: "e1" } });

    expect(screen.queryByText(/Conciliación.*Empresa 1/)).toBeNull();
    expect(screen.queryByText("Reglas recurrentes incluidas en el rango")).toBeNull();
    view.unmount();
  });

  it("oculta presencia del equipo al retirar empresa mientras el organigrama está abierto", () => {
    const state = seed();
    state.activeId = "m1";
    const now = Date.parse("2026-10-08T15:00:00.000Z");
    const employee = state.profiles.find((profile) => profile.id === "e0")!;
    const manager = state.profiles.find((profile) => profile.id === "m1")!;
    const presence = { [employee.id]: "2026-10-08T14:59:30.000Z" };
    const view = render(<Workforce state={state} commit={vi.fn(() => true)} notify={vi.fn()} remote presence={presence} now={now} />);
    let row = screen.getAllByRole("row", { name: /Valentino Magni/ })[0]!;
    expect(within(row).getByText("En línea")).toBeTruthy();

    const sharedCompanies = new Set(employee.companyIds);
    const revoked = { ...state, profiles: state.profiles.map((profile) => profile.id === manager.id
      ? { ...profile, companyIds: profile.companyIds.filter((companyId) => !sharedCompanies.has(companyId)) }
      : profile) };
    view.rerender(<Workforce state={revoked} commit={vi.fn(() => true)} notify={vi.fn()} remote presence={presence} now={now} />);
    row = screen.getAllByRole("row", { name: /Valentino Magni/ })[0]!;
    expect(within(row).queryByText("En línea")).toBeNull();
    expect(within(row).getByLabelText("Presencia no disponible").textContent).toBe("—");
  });

  it("muestra la presencia del equipo con vencimiento de 90 segundos en la vista conectada", () => {
    const state = seed();
    const now = Date.parse("2026-10-08T15:00:00.000Z");
    const onlineId = state.profiles.find((profile) => profile.name === "Valentino Magni")!.id;
    const offlineId = state.profiles.find((profile) => profile.name === "Carolina Díaz")!.id;
    render(<Workforce state={state} commit={vi.fn(() => true)} notify={vi.fn()} remote presence={{ [onlineId]: "2026-10-08T14:59:00.000Z", [offlineId]: "2026-10-08T14:57:00.000Z" }} now={now} />);
    const online = screen.getAllByRole("row", { name: /Valentino Magni/ })[0]!;
    const offline = screen.getAllByRole("row", { name: /Carolina Díaz/ })[0]!;
    expect(within(online).getByText("En línea").className).toContain("is-online");
    expect(within(offline).getByText(/Fuera de línea · última señal/).className).toContain("is-offline");
  });

  it("solicita motivo, conserva el perfil y permite reasignar trabajo futuro", async () => {
    let state = seed();
    const employee = state.profiles.find((person) => person.id === "e0")!;
    const task = state.tasks.find((row) => row.ownerId === employee.id)!;
    const [year, month] = dateART().slice(0, 7).split("-").map(Number);
    const nextMonth = new Date(Date.UTC(year, month, 1)).toISOString().slice(0, 7);
    const due = `${nextMonth}-20`;
    state = {
      ...state,
      tasks: state.tasks.map((row) => row.id === task.id
        ? { ...row, status: "Pendiente", due, scheduledOn: due, sessions: [], startedAt: null, completedAt: null,
            checklist: row.checklist.map((check) => ({ ...check, done: false })) }
        : row),
      activity: state.activity.filter((entry) => entry.taskId !== task.id),
    };
    const commit = vi.fn((next: typeof state) => { state = next; return true; });
    const notify = vi.fn();
    const user = userEvent.setup();
    const view = render(<Workforce state={state} commit={commit} notify={notify} />);

    fireEvent.click(within(screen.getAllByRole("row", { name: /Valentino Magni/ })[0]!).getByRole("button", { name: "Dar de baja" }));
    fireEvent.change(screen.getByLabelText("Motivo de baja"), { target: { value: "Cambio de puesto" } });
    fireEvent.click(screen.getByRole("button", { name: "Confirmar baja" }));

    expect(state.profiles.find((person) => person.id === employee.id)?.active).toBe(false);
    expect(state.assignments.filter((assignment) => assignment.ownerId === employee.id).every((assignment) => assignment.retired)).toBe(true);
    const orphan = state.orphanedWork?.find((item) => item.taskId === task.id);
    expect(orphan).toMatchObject({ formerOwnerName: employee.name, reason: "Cambio de puesto", resolution: "ready", status: "pending" });

    view.rerender(<Workforce state={state} commit={commit} notify={notify} />);
    const card = screen.getAllByText(task.title).map((element) => element.closest(".orphaned-work-card"))
      .find((element) => element?.querySelector("select")) as HTMLElement;
    await user.selectOptions(within(card).getByLabelText(`Reasignar ${task.title}`), "e1");
    fireEvent.click(within(card).getByRole("button", { name: "Confirmar reasignación" }));
    expect(state.tasks.find((row) => row.id === task.id)).toMatchObject({ ownerId: "e1", teamId: "t1" });
    expect(state.orphanedWork?.find((item) => item.id === orphan?.id)?.status).toBe("reassigned");
    expect(notify).not.toHaveBeenCalled();
  });

  it("registra desde la bandeja el traspaso de una tarea iniciada con su motivo", async () => {
    let state = seed();
    const employee = state.profiles.find((person) => person.id === "e0")!;
    const task = state.tasks.find((row) => row.ownerId === employee.id && row.kind === "resultado")!;
    state = {
      ...state,
      tasks: state.tasks.map((row) => row.id === task.id
        ? { ...row, status: "En curso", startedAt: "2026-10-05T10:00:00.000Z", sessions: [], completedAt: null }
        : row),
    };
    const commit = vi.fn((next: typeof state) => { state = next; return true; });
    const notify = vi.fn();
    const user = userEvent.setup();
    const view = render(<Workforce state={state} commit={commit} notify={notify} />);

    fireEvent.click(within(screen.getAllByRole("row", { name: /Valentino Magni/ })[0]!).getByRole("button", { name: "Dar de baja" }));
    fireEvent.change(screen.getByLabelText("Motivo de baja"), { target: { value: "Cambio de puesto" } });
    fireEvent.click(screen.getByRole("button", { name: "Confirmar baja" }));
    expect(state.orphanedWork?.find((item) => item.taskId === task.id)?.resolution).toBe("handoff_required");

    view.rerender(<Workforce state={state} commit={commit} notify={notify} />);
    const card = screen.getAllByText(task.title).map((element) => element.closest(".orphaned-work-card"))
      .find((element) => element?.querySelector("textarea")) as HTMLElement;
    await user.selectOptions(within(card).getByLabelText(`Traspasar ${task.title}`), "e1");
    fireEvent.change(within(card).getByLabelText(`Motivo para ${task.title}`), { target: { value: "Continuidad del cierre mensual" } });
    fireEvent.click(within(card).getByRole("button", { name: "Registrar traspaso" }));

    expect(state.tasks.find((row) => row.id === task.id)?.ownerId).toBe("e1");
    expect(state.taskTransfers?.[0]).toMatchObject({ formerOwnerName: employee.name, newOwnerName: "Lucía Fernández", reason: "Continuidad del cierre mensual" });
    view.rerender(<Workforce state={state} commit={commit} notify={notify} />);
    expect(screen.getByRole("heading", { name: "Historial de traspasos" })).toBeTruthy();
    expect(screen.getByText("Continuidad del cierre mensual")).toBeTruthy();
    expect(notify).not.toHaveBeenCalled();
  });
});
