// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { useState } from "react";
import Onboarding from "../src/components/Onboarding";
import { seed } from "../src/data/repository";
import { defaultSchedule } from "../src/domain/schedule";
import type { Onboarding as Draft } from "../src/domain/model";

beforeEach(() => {
  vi.stubGlobal("matchMedia", () => ({ matches: false, addEventListener() {}, removeEventListener() {} }));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

function draft(step: number): Draft {
  const state = seed();
  return {
    ...state.onboarding.e0,
    step,
    completedAt: null,
    selectedCompanyIds: ["c1", "c2"],
    selectedTemplateIds: ["cat3"],
    assignmentCompanyIds: { cat3: ["c1", "c2"] },
    schedules: {},
    companySchedules: {
      cat3: {
        c1: defaultSchedule("2026-10-05", "diaria"),
        c2: defaultSchedule("2026-10-06", "semanal"),
      },
    },
    companyTargets: { cat3: { c1: 40, c2: 90 } },
    habitualTaskProposals: [],
  };
}

describe("inducción de tareas habituales", () => {
  it("describe operativas por unidad sin mostrar el peso legacy como puntos", () => {
    const state = seed();
    const view = render(<Onboarding state={state} month="2026-10" profile={state.profiles.find((profile) => profile.id === "e0")!} draft={draft(2)} update={() => {}} finish={() => {}} pause={() => {}} laboratory />);
    expect(screen.getByText(/Los entregables se evalúan por controles y puntos/)).toBeTruthy();
    const operation = [...view.container.querySelectorAll<HTMLElement>(".catalog-option")].find((row) => row.textContent?.includes("Carga de facturas"));
    expect(operation?.textContent).toContain("facturas · sin cuota");
    expect(operation?.textContent).not.toContain("pts");
    expect(operation?.textContent).not.toContain("120");
  });
  it("guarda la frecuencia de cada empresa por separado", () => {
    const state = seed();
    const update = vi.fn();
    const view = render(<Onboarding state={state} month="2026-10" profile={state.profiles.find((profile) => profile.id === "e0")!} draft={draft(3)} update={update} finish={() => {}} pause={() => {}} laboratory />);
    const companySections = document.querySelectorAll<HTMLElement>(".induction-company-schedule");
    expect(companySections).toHaveLength(2);
    fireEvent.change(within(companySections[0]).getByLabelText("Frecuencia de la tarea"), { target: { value: "mensual" } });
    const saved = update.mock.calls[0][0] as Draft;
    expect(saved.companySchedules?.cat3?.c1.frequency).toBe("mensual");
    expect(saved.companySchedules?.cat3?.c2.frequency).toBe("semanal");
    expect(screen.getAllByText(/sin cuota mensual/i)).toHaveLength(2);
    expect(screen.queryByLabelText("Meta mensual · facturas")).toBeNull();
    expect(screen.getByText(/las operativas se miden por movimientos registrados y tiempo, sin meta mensual/i)).toBeTruthy();
  });

  it("captura el nombre libre como propuesta pendiente, no como tarea esporádica", () => {
    const state = seed();
    const initial: Draft = { ...draft(2), selectedTemplateIds: [], companySchedules: {} };
    let saved = initial;
    function Harness() {
      const [current, setCurrent] = useState(initial);
      return <Onboarding state={state} month="2026-10" profile={state.profiles.find((profile) => profile.id === "e0")!} draft={current} update={(next) => { saved = next; setCurrent(next); }} finish={() => {}} pause={() => {}} laboratory />;
    }
    render(<Harness />);
    fireEvent.click(screen.getByText("Proponer una tarea habitual que falta"));
    fireEvent.change(screen.getByLabelText("Nombre de la tarea"), { target: { value: "CONC BNA Empresa 1" } });
    fireEvent.change(screen.getByLabelText("Banco o nombre del proceso · opcional"), { target: { value: "Banco Nación" } });
    fireEvent.change(screen.getByLabelText("¿Qué trabajo realizás?"), { target: { value: "Conciliar movimientos y dejar evidencia." } });
    const proposalForm = within(document.querySelector(".habitual-proposal-form")!);
    fireEvent.click(proposalForm.getByRole("button", { name: "Agregar paso" }));
    fireEvent.change(proposalForm.getByLabelText("Paso 1"), { target: { value: "Descargar el extracto" } });
    fireEvent.click(screen.getByRole("button", { name: "Agregar propuesta" }));
    expect(saved.habitualTaskProposals).toHaveLength(1);
    expect(saved.habitualTaskProposals?.[0]).toMatchObject({ title: "CONC BNA Empresa 1", process: "Banco Nación", companyIds: ["c1", "c2"], steps: ["Descargar el extracto"] });
    expect(saved.customTasks).toHaveLength(0);
  });

  it("explica que la propuesta no parametriza el coeficiente por sí sola", () => {
    const state = seed();
    const initial: Draft = {
      ...draft(3),
      habitualTaskProposals: [{ id: "draft-ops", title: "Control de pagos", process: "Pagos", description: "Registrar pagos procesados.", kind: "operativa", unit: "pagos", steps: ["Procesar el lote"], companyIds: ["c1"] }],
    };
    render(<Onboarding state={state} month="2026-10" profile={state.profiles.find((profile) => profile.id === "e0")!} draft={initial} update={() => {}} finish={() => {}} pause={() => {}} laboratory />);
    expect(screen.getByText(/La jefatura configura el coeficiente por empresa y vigencia en Coeficientes por movimiento/)).toBeTruthy();
    expect(screen.queryByText(/El peso unitario se define al aprobar la propuesta/)).toBeNull();
  });
});
