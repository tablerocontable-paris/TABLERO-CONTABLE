// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import DeadlineAgenda from "../src/components/DeadlineAgenda";
import { currentMonth } from "../src/domain/model";
import { createCalendarEvent } from "../src/domain/laboratory-work";
import { createFiscalObligation } from "../src/domain/fiscalObligations";
import { seed } from "../src/data/repository";
import type { State } from "../src/domain/model";

afterEach(() => cleanup());

describe("agenda compartida del laboratorio", () => {
  it("expone una grilla de calendario accesible con navegación por flechas y meses", () => {
    const state = seed();
    const actor = state.profiles.find((profile) => profile.id === "boss")!;
    const month = currentMonth();
    render(<DeadlineAgenda state={state} month={month} company="" owner="" sector=""
      openTask={vi.fn()} openNotes={vi.fn()} actor={actor} laboratory commit={() => true} notify={vi.fn()} />);

    const grid = screen.getByRole("grid", { name: "Calendario mensual" });
    const rows = within(grid).getAllByRole("row");
    expect(within(rows[0]!).getAllByRole("columnheader")).toHaveLength(7);
    const dayButtons = within(grid).getAllByRole("button");
    expect(dayButtons.filter((button) => button.tabIndex === 0)).toHaveLength(1);

    const firstDay = grid.querySelector<HTMLButtonElement>(`[data-calendar-day="${month}-01"]`)!;
    fireEvent.keyDown(firstDay, { key: "ArrowLeft" });
    const [year, monthNumber] = month.split("-").map(Number);
    const previousMonth = new Date(Date.UTC(year, monthNumber - 2, 1)).toISOString().slice(0, 7);
    const previousLastDay = new Date(Date.UTC(year, monthNumber - 1, 0)).getUTCDate();
    const previousLastDayText = `${previousMonth}-${String(previousLastDay).padStart(2, "0")}`;
    const previousLastDayButton = grid.querySelector<HTMLButtonElement>(`[data-calendar-day="${previousLastDayText}"]`);
    expect(previousLastDayButton).toBe(document.activeElement);
    expect(previousLastDayButton?.tabIndex).toBe(0);

    fireEvent.keyDown(previousLastDayButton!, { key: "PageDown" });
    const followingMonth = new Date(Date.UTC(year, monthNumber - 1, 1)).toISOString().slice(0, 7);
    const followingMonthDay = grid.querySelector<HTMLButtonElement>(`[data-calendar-day="${followingMonth}-${String(previousLastDay).padStart(2, "0")}"]`);
    expect(followingMonthDay).toBe(document.activeElement);
    expect(within(grid).getAllByRole("button").filter((button) => button.tabIndex === 0)).toHaveLength(1);
  });

  it("permite al autor cambiar una fecha y deja aviso a sus destinatarios", () => {
    const state = seed();
    const actor = state.profiles.find((profile) => profile.id === "boss")!;
    const day = `${currentMonth()}-01`;
    const withEvent = createCalendarEvent(state, actor.id, {
      companyId: "c1", kind: "audit", title: "Auditoría de prueba", description: "Plan inicial",
      startOn: day, endOn: day, recipientIds: ["e0"], linkedTaskId: null,
    });
    const committed: State[] = [];
    const commit = (next: State) => { committed.push(next); return true; };
    const notify = vi.fn();

    render(<DeadlineAgenda state={withEvent} month={currentMonth()} company="" owner="" sector=""
      openTask={vi.fn()} openNotes={vi.fn()} actor={actor} laboratory commit={commit} notify={notify} />);

    expect(screen.getByText(/Auditoría · Empresa 1/)).toBeTruthy();
    expect(screen.getByText("Plan inicial")).toBeTruthy();
    expect(screen.getByText(/Compartida con:/)).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Editar fecha" }));
    fireEvent.change(screen.getByLabelText("Título"), { target: { value: "Auditoría reprogramada" } });
    fireEvent.change(screen.getByLabelText("Detalle"), { target: { value: "Nuevo alcance documentado" } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar cambios y avisar" }));

    const saved = committed[0]!;
    expect(saved.calendarEvents?.[0]).toMatchObject({ title: "Auditoría reprogramada", description: "Nuevo alcance documentado", revision: 2 });
    expect(saved.calendarNotices?.some((notice) => notice.eventId === withEvent.calendarEvents?.[0]?.id && notice.kind === "changed")).toBe(true);
    expect(notify).toHaveBeenCalledWith("Fecha actualizada y aviso local enviado.");
  });

  it("actualiza destinatarios y tareas vinculables al cambiar la empresa del formulario", () => {
    const state = seed();
    const actor = state.profiles.find((profile) => profile.id === "e0")!;
    render(<DeadlineAgenda state={state} month={currentMonth()} company="c1" owner="" sector=""
      openTask={vi.fn()} openNotes={vi.fn()} actor={actor} laboratory commit={() => true} notify={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: /Nueva fecha/i }));
    const company = screen.getByLabelText("Empresa") as HTMLSelectElement;
    const linkedTask = screen.getByLabelText("Vincular tarea (opcional)") as HTMLSelectElement;
    expect(company.value).toBe("c1");
    expect(within(linkedTask).getByRole("option", { name: /Conciliación Banco Nación.*Empresa 1/ })).toBeTruthy();
    expect(within(linkedTask).queryByRole("option", { name: /Conciliación Banco Nación.*Empresa 2/ })).toBeNull();
    expect(screen.getAllByText(/Superior obligatorio/)).toHaveLength(2);

    fireEvent.change(company, { target: { value: "c2" } });
    expect(within(linkedTask).getByRole("option", { name: /Conciliación Banco Nación.*Empresa 2/ })).toBeTruthy();
    expect(within(linkedTask).queryByRole("option", { name: /Conciliación Banco Nación.*Empresa 1/ })).toBeNull();
  });

  it("no ofrece vínculos si la fecha abarca todas las empresas", () => {
    const state = seed();
    const actor = state.profiles.find((profile) => profile.id === "e0")!;
    render(<DeadlineAgenda state={state} month={currentMonth()} company="" owner="" sector=""
      openTask={vi.fn()} openNotes={vi.fn()} actor={actor} laboratory commit={() => true} notify={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /Nueva fecha/i }));
    const linkedTask = screen.getByLabelText("Vincular tarea (opcional)") as HTMLSelectElement;
    expect(within(linkedTask).getAllByRole("option")).toHaveLength(2);
    expect((within(linkedTask).getByRole("option", { name: /Seleccioná una empresa/ }) as HTMLOptionElement).disabled).toBe(true);
  });

  it("la fecha de una obligación identifica período y origen y enfoca su ficha original", () => {
    const state = seed();
    const actor = state.profiles.find((profile) => profile.id === "boss")!;
    const day = `${currentMonth()}-01`;
    const withObligation = createFiscalObligation(state, {
      companyId: "c1", obligationCode: "IVA-LAB", title: "IVA mensual de prueba",
      fiscalPeriod: currentMonth(), milestone: "presentation", dueOn: day,
      sourceLabel: "Calendario fiscal ficticio", sourceRevision: "DEMO-02",
      sourceCheckedAt: day, requiredTaskIds: [],
    }, actor.id);
    render(<DeadlineAgenda state={withObligation} month={currentMonth()} company="" owner="" sector=""
      openTask={vi.fn()} openNotes={vi.fn()} actor={actor} laboratory commit={() => true} notify={vi.fn()} />);

    const calendarEntry = [...document.querySelectorAll(".calendar-day-detail article")]
      .find((entry) => entry.textContent?.includes("IVA mensual de prueba"));
    expect(calendarEntry?.textContent).toContain(`período fiscal ${currentMonth()}`);
    expect(calendarEntry?.textContent).toContain("origen: Calendario fiscal ficticio · revisión DEMO-02");
    fireEvent.click(screen.getByRole("button", { name: "Abrir obligación de origen" }));
    expect(document.activeElement).toBe(document.getElementById(`fiscal-obligation-${withObligation.fiscalObligations?.[0]?.id}`));
  });

  it("abre la ficha original de otro período con el panel fiscal plegado sin cambiar el mes del calendario", () => {
    const state = seed();
    const actor = state.profiles.find((profile) => profile.id === "boss")!;
    const dueMonth = currentMonth();
    const [year, monthNumber] = dueMonth.split("-").map(Number);
    const fiscalPeriod = new Date(Date.UTC(year, monthNumber - 2, 1)).toISOString().slice(0, 7);
    const dueOn = `${dueMonth}-01`;
    const withObligation = createFiscalObligation(state, {
      companyId: "c1", obligationCode: "IVA-ORIGEN", title: "Origen fiscal de otro período",
      fiscalPeriod, milestone: "presentation", dueOn,
      sourceLabel: "Referencia ficticia", sourceRevision: "DEMO-03",
      sourceCheckedAt: dueOn, requiredTaskIds: [],
    }, actor.id);
    const oldMatchMedia = Object.getOwnPropertyDescriptor(window, "matchMedia");
    const oldScrollIntoView = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "scrollIntoView");
    const matchMedia = vi.fn().mockReturnValue({ matches: true });
    const scrollIntoView = vi.fn();
    Object.defineProperty(window, "matchMedia", { configurable: true, value: matchMedia });
    Object.defineProperty(HTMLElement.prototype, "scrollIntoView", { configurable: true, value: scrollIntoView });
    const { container } = render(<DeadlineAgenda state={withObligation} month={dueMonth} company="" owner="" sector=""
      openTask={vi.fn()} openNotes={vi.fn()} actor={actor} laboratory commit={() => true} notify={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "Plegar Obligaciones por empresa" }));
    expect(screen.getByRole("button", { name: "Desplegar Obligaciones por empresa" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Abrir obligación de origen" }));

    const origin = document.getElementById(`fiscal-obligation-${withObligation.fiscalObligations?.[0]?.id}`)!;
    expect(screen.getByRole("button", { name: "Plegar Obligaciones por empresa" })).toBeTruthy();
    expect(origin.closest("[hidden]")).toBeNull();
    expect(document.activeElement).toBe(origin);
    const fiscalPanel = screen.getByRole("heading", { name: "Obligaciones por empresa" }).closest(".panel") as HTMLElement;
    expect(within(fiscalPanel).getByText(new RegExp(`período fiscal ${fiscalPeriod}`))).toBeTruthy();
    expect(matchMedia).toHaveBeenCalledWith("(prefers-reduced-motion: reduce)");
    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: "auto", block: "center" });
    expect(container.querySelector("#fiscal-obligation-" + withObligation.fiscalObligations?.[0]?.id)).toBe(origin);
    expect(container.querySelector(".calendar-toolbar strong")?.textContent).toContain(new Date(`${dueMonth}-15T12:00:00`).toLocaleDateString("es-AR", { month: "long", year: "numeric" }));
    if (oldMatchMedia) Object.defineProperty(window, "matchMedia", oldMatchMedia);
    else Reflect.deleteProperty(window, "matchMedia");
    if (oldScrollIntoView) Object.defineProperty(HTMLElement.prototype, "scrollIntoView", oldScrollIntoView);
    else Reflect.deleteProperty(HTMLElement.prototype, "scrollIntoView");
  });

  it("no mezcla recordatorios privados de otra persona en la agenda", () => {
    const state = seed();
    const actor = state.profiles.find((profile) => profile.id === "e0")!;
    const day = `${currentMonth()}-01`;
    state.annotations = [{ id: "private-note", ownerId: "e1", title: "Nota privada ajena", content: "No mostrar", kind: "personal", reminderOn: day,
      createdAt: `${day}T12:00:00.000Z`, updatedAt: `${day}T12:00:00.000Z`, convertedTaskId: null }];

    render(<DeadlineAgenda state={state} month={currentMonth()} company="" owner="" sector=""
      openTask={vi.fn()} openNotes={vi.fn()} actor={actor} laboratory />);

    expect(screen.queryByText("Nota privada ajena")).toBeNull();
    expect(screen.queryByText("No mostrar")).toBeNull();
  });

  it("no revela títulos ni movimientos de una empresa fuera del ámbito del encargado", () => {
    const state = seed();
    const month = currentMonth();
    const manager = state.profiles.find((profile) => profile.id === "m1")!;
    state.profiles = state.profiles.map((profile) => profile.id === manager.id
      ? { ...profile, companyIds: profile.companyIds.filter((companyId) => companyId !== "c1") }
      : profile);
    const base = state.tasks.find((task) => task.ownerId === "e0" && task.companyId === "c1")!;
    state.tasks.push({ ...base, id: "out-of-scope-agenda-task", title: "Detalle confidencial Empresa 1", month, due: `${month}-15`, status: "Pendiente", completedAt: null });

    render(<DeadlineAgenda state={state} month={month} company="" owner="" sector=""
      openTask={vi.fn()} openNotes={vi.fn()} actor={{ ...manager, companyIds: manager.companyIds.filter((companyId) => companyId !== "c1") }} laboratory commit={() => true} notify={vi.fn()} />);

    expect(screen.queryByText("Detalle confidencial Empresa 1")).toBeNull();
    expect(screen.queryByText("Empresa 1")).toBeNull();
  });

  it("filtra fechas por participación y no sólo por titularidad de la tarea", () => {
    const state = seed();
    const month = currentMonth();
    const actor = state.profiles.find((profile) => profile.id === "e1")!;
    const base = state.tasks.find((task) => task.ownerId === "e0" && task.companyId === "c1" && task.kind === "resultado")!;
    const joint: typeof base = {
      ...base,
      id: "joint-calendar-secondary-owner",
      title: "Tarea conjunta visible al participante",
      due: `${month}-15`,
      month,
      responsibility: {
        version: 1 as const, revision: 1 as const, mode: "joint" as const,
        activatedAt: `${month}-01T12:00:00.000Z`, activatedBy: "boss", reason: "Control compartido",
        members: [
          { profileId: "e0", shareBps: 5000, name: "Empleado 0", teamId: "t1", sector: "Tesorería" },
          { profileId: "e1", shareBps: 5000, name: "Empleado 1", teamId: "t1", sector: "Tesorería" },
        ],
      },
    };
    state.tasks = [joint];

    render(<DeadlineAgenda state={state} month={month} company="" owner="e1" sector=""
      openTask={vi.fn()} openNotes={vi.fn()} actor={actor} laboratory commit={() => true} notify={vi.fn()} />);

    fireEvent.click(document.querySelector(`[data-calendar-day="${month}-15"]`) as HTMLButtonElement);
    expect(screen.getAllByText("Tarea conjunta visible al participante")).toHaveLength(2);
  });
});
