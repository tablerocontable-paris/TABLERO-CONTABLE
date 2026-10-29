// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { useState } from "react";
import Onboarding from "../src/components/Onboarding";
import { seed } from "../src/data/repository";
import { defaultSchedule } from "../src/domain/schedule";
import type { Onboarding as Draft } from "../src/domain/model";
import { NEUTRAL_STARTER_CATALOG, NEUTRAL_STARTER_CATALOG_VERSION, NEUTRAL_STARTER_GROUP_DESCRIPTIONS, NEUTRAL_STARTER_SUGGESTIONS, NEUTRAL_STARTER_SUGGESTIONS_VERSION } from "../src/domain/neutralStarterCatalog";

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
  it("conserva sugerencias y selección de un onboarding legado; preserva los IDs v1", () => {
    const state = seed();
    const ids = NEUTRAL_STARTER_CATALOG.map((task) => task.id);
    expect(NEUTRAL_STARTER_CATALOG_VERSION).toBe(1);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.every((id) => id.startsWith("starter-v1-"))).toBe(true);
    expect(ids.some((id) => state.templates.some((template) => template.id === id))).toBe(false);
    expect(new Set(state.templates.map((template) => template.id)).size).toBe(state.templates.length);
    const update = vi.fn<(value: Draft) => void>();
    const legacyDraft: Draft = { ...draft(2), selectedTemplateIds: ["cat3"] };
    const view = render(<Onboarding state={state} month="2026-10" profile={state.profiles.find((profile) => profile.id === "e0")!} draft={legacyDraft} update={update} finish={() => {}} pause={() => {}} laboratory />);
    expect(NEUTRAL_STARTER_SUGGESTIONS_VERSION).toBe(2);
    expect(Object.keys(NEUTRAL_STARTER_GROUP_DESCRIPTIONS)).toHaveLength(5);
    expect(NEUTRAL_STARTER_SUGGESTIONS).toHaveLength(26);
    expect(view.container.querySelectorAll(".starter-suggestion-group")).toHaveLength(5);
    expect(screen.getByText(/no crean trabajo ni fijan metas, pesos o vencimientos/i)).toBeTruthy();
    expect(view.container.querySelectorAll(".starter-suggestion-detail[open]")).toHaveLength(0);
    expect(view.container.querySelectorAll(".starter-suggestion-detail .primary")).toHaveLength(26);
    expect((screen.getByLabelText(/Sólo seleccionadas/) as HTMLInputElement).checked).toBe(false);
    expect(legacyDraft.habitualTaskProposals).toHaveLength(0);
    expect(legacyDraft.selectedTemplateIds).toEqual(["cat3"]);
    expect(NEUTRAL_STARTER_CATALOG.map((entry) => entry.id)).toEqual([
      "starter-v1-bank-reconciliation", "starter-v1-tax-obligations", "starter-v1-document-recording",
      "starter-v1-procedure-follow-up", "starter-v1-payment-processing", "starter-v1-accounting-close",
    ]);
  });

  it("selects a normalized bank preset and stores its canonical code without allowing a renamed task", () => {
    const state = seed();
    const initial: Draft = { ...draft(2), selectedTemplateIds: [], selectedBusinessUnitCodes: ["paris_autos"], habitualTaskProposals: [] };
    let saved = initial;
    function Harness() {
      const [current, setCurrent] = useState(initial);
      return <Onboarding state={state} month="2026-10" profile={state.profiles.find((profile) => profile.id === "e0")!} draft={current} update={(next) => { saved = next; setCurrent(next); }} finish={() => {}} pause={() => {}} laboratory />;
    }
    render(<Harness />);
    expect(document.querySelectorAll(".paris-task-catalog-item")).toHaveLength(57);
    expect(screen.getByText(/30 opciones provisionales están marcadas/i)).toBeTruthy();
    expect(screen.queryByText(/Opciones provisionales \(30\)/i)).toBeNull();
    fireEvent.change(screen.getByLabelText("Buscar tarea estándar"), { target: { value: "CONC BANC FRANC" } });
    expect(document.querySelectorAll(".paris-task-catalog-item")).toHaveLength(1);
    const bankRow = Array.from(document.querySelectorAll(".paris-task-catalog-item"))
      .find((row) => row.textContent?.includes("Conciliación bancaria")) as HTMLElement;
    expect(bankRow.textContent).toContain("Conciliación Banco Francés");
    fireEvent.click(within(bankRow).getByRole("button", { name: /PARIS AUTOS/ }));
    expect((screen.getByLabelText("banco · fijado por selección") as HTMLSelectElement).value).toBe("frances");
    expect((screen.getByLabelText("banco · fijado por selección") as HTMLSelectElement).disabled).toBe(true);
    fireEvent.change(screen.getByLabelText("cuenta · obligatorio"), { target: { value: "Cuenta principal" } });
    expect(saved.habitualTaskProposals).toHaveLength(1);
    expect(saved.habitualTaskProposals?.[0]).toMatchObject({
      taskCode: "gpar_bank_reconciliation", taskCatalogVersion: 7, businessUnitCode: "paris_autos",
      taskParameters: { banco: "frances", cuenta: "Cuenta principal" },
      title: "Conciliación bancaria", kind: "resultado",
    });
    expect(screen.queryByLabelText("Nombre editable")).toBeNull();
  });

  it("blocks the next onboarding step until required canonical task parameters are complete", () => {
    const state = seed();
    const initial: Draft = { ...draft(2), selectedTemplateIds: [], selectedBusinessUnitCodes: ["paris_autos"], habitualTaskProposals: [] };
    function Harness() {
      const [current, setCurrent] = useState(initial);
      return <Onboarding state={state} month="2026-10" profile={state.profiles.find((profile) => profile.id === "e0")!} draft={current} update={setCurrent} finish={() => {}} pause={() => {}} laboratory />;
    }
    render(<Harness />);
    fireEvent.change(screen.getByLabelText("Buscar tarea estándar"), { target: { value: "Conciliación Banco Francés" } });
    const bankRow = document.querySelector<HTMLElement>(".paris-task-catalog-item")!;
    fireEvent.click(within(bankRow).getByRole("button", { name: /PARIS AUTOS/ }));

    const next = screen.getByRole("button", { name: /^Continuar/ }) as HTMLButtonElement;
    expect(next.disabled).toBe(true);
    expect(screen.getByRole("status").textContent).toContain("Conciliación bancaria · PARIS AUTOS: completá cuenta.");

    fireEvent.change(screen.getByLabelText("cuenta · obligatorio"), { target: { value: "Cuenta principal" } });
    expect(next.disabled).toBe(false);
    fireEvent.click(next);
    expect(document.querySelector(".induction-top")?.textContent).toContain("PASO 4 DE 6");
  });

  it("offers a separate canonical bank option and flags unlisted bank names", () => {
    const state = seed();
    const initial: Draft = { ...draft(2), selectedTemplateIds: [], selectedBusinessUnitCodes: ["paris_autos"], habitualTaskProposals: [] };
    let saved = initial;
    function Harness() {
      const [current, setCurrent] = useState(initial);
      return <Onboarding state={state} month="2026-10" profile={state.profiles.find((profile) => profile.id === "e0")!} draft={current} update={(next) => { saved = next; setCurrent(next); }} finish={() => {}} pause={() => {}} laboratory />;
    }
    render(<Harness />);
    fireEvent.change(screen.getByLabelText("Buscar tarea estándar"), { target: { value: "Conciliación Banco Nación" } });
    const bankRow = document.querySelector<HTMLElement>(".paris-task-catalog-item")!;
    expect(bankRow.textContent).toContain("Conciliación Banco Nación");
    fireEvent.click(within(bankRow).getByRole("button", { name: /PARIS AUTOS/ }));
    expect(saved.habitualTaskProposals?.[0]?.taskParameters).toEqual({ banco: "nacion" });
    fireEvent.change(screen.getByLabelText("Buscar tarea estándar"), { target: { value: "frances" } });
    expect(document.querySelectorAll(".paris-task-catalog-item")).toHaveLength(1);
    expect(document.querySelector(".paris-task-catalog-item")?.textContent).toContain("Conciliación Banco Francés");
    fireEvent.change(screen.getByLabelText("Buscar tarea estándar"), { target: { value: "Conciliación bancaria" } });
    const canonicalRow = Array.from(document.querySelectorAll<HTMLElement>(".paris-task-catalog-item"))
      .find((row) => row.textContent?.includes("Conciliación bancaria"))!;
    fireEvent.click(within(canonicalRow).getByRole("button", { name: /PARIS AUTOS/ }));
    fireEvent.change(screen.getByLabelText("banco · obligatorio"), { target: { value: "unverified" } });
    expect((screen.getByRole("textbox", { name: "Nombre del banco · pendiente de normalizar · obligatorio" }) as HTMLInputElement).required).toBe(true);
    expect(saved.habitualTaskProposals).toHaveLength(2);
  });

  it("allows a provisional observed task while requiring its subtype for later comparison", () => {
    const state = seed();
    const initial: Draft = { ...draft(2), selectedTemplateIds: [], selectedBusinessUnitCodes: ["paris_autos"], habitualTaskProposals: [] };
    let saved = initial;
    function Harness() {
      const [current, setCurrent] = useState(initial);
      return <Onboarding state={state} month="2026-10" profile={state.profiles.find((profile) => profile.id === "e0")!} draft={current} update={(next) => { saved = next; setCurrent(next); }} finish={() => {}} pause={() => {}} laboratory />;
    }
    render(<Harness />);
    const row = Array.from(document.querySelectorAll(".paris-task-catalog-item"))
      .find((item) => item.textContent?.includes("Carga de otras facturas")) as HTMLElement;
    expect(row.textContent).toContain("Provisional");
    fireEvent.click(within(row).getByRole("button", { name: /PARIS AUTOS/ }));
    expect(saved.habitualTaskProposals?.[0]).toMatchObject({
      taskCode: "invoice_load_other", taskCatalogVersion: 7, businessUnitCode: "paris_autos",
    });
    expect((screen.getByLabelText("tipo específico · obligatorio") as HTMLInputElement).required).toBe(true);
  });

  it("offers canonical branch choices and flags branches outside the observed sample", () => {
    const state = seed();
    const initial: Draft = { ...draft(2), selectedTemplateIds: [], selectedBusinessUnitCodes: ["paris_cars"], habitualTaskProposals: [] };
    let saved = initial;
    function Harness() {
      const [current, setCurrent] = useState(initial);
      return <Onboarding state={state} month="2026-10" profile={state.profiles.find((profile) => profile.id === "e0")!} draft={current} update={(next) => { saved = next; setCurrent(next); }} finish={() => {}} pause={() => {}} laboratory />;
    }
    render(<Harness />);
    fireEvent.change(screen.getByLabelText("Buscar tarea estándar"), { target: { value: "Carga de facturas de repuestos" } });
    const row = document.querySelector<HTMLElement>(".paris-task-catalog-item")!;
    fireEvent.click(within(row).getByRole("button", { name: /PARIS CARS/ }));
    const branch = screen.getByLabelText("sucursal · obligatorio") as HTMLSelectElement;
    const next = screen.getByRole("button", { name: /^Continuar/ }) as HTMLButtonElement;
    expect(next.disabled).toBe(true);
    expect(Array.from(branch.options).map((option) => option.textContent)).toEqual([
      "Seleccioná una opción", "Sucursal 3", "Sucursal 81", "Otra sucursal · pendiente de normalizar",
    ]);
    fireEvent.change(branch, { target: { value: "81" } });
    expect(next.disabled).toBe(false);
    expect(saved.habitualTaskProposals?.[0]).toMatchObject({
      taskCode: "parts_invoice_load", taskCatalogVersion: 7, businessUnitCode: "paris_cars",
      taskParameters: { sucursal: "81" },
    });
    fireEvent.change(branch, { target: { value: "unverified" } });
    const otherBranch = screen.getByRole("textbox", { name: "Nombre o número de sucursal · pendiente de normalizar · obligatorio" }) as HTMLInputElement;
    expect(otherBranch.required).toBe(true);
    expect(next.disabled).toBe(true);
    fireEvent.change(otherBranch, { target: { value: "Sucursal 4" } });
    expect(next.disabled).toBe(false);
    expect(saved.habitualTaskProposals?.[0]?.taskParameters).toEqual({ sucursal: "unverified", sucursal_no_catalogada: "Sucursal 4" });
    expect(screen.getByPlaceholderText("Se mantendrá fuera de comparaciones hasta normalizarlo")).toBeTruthy();
  });

  it("permite continuar con una sugerencia válida aunque quede abierto un formulario habitual incompleto", async () => {
    const state = seed();
    const starter = NEUTRAL_STARTER_SUGGESTIONS[0]!;
    const initial: Draft = {
      ...draft(2), selectedTemplateIds: [],
      habitualTaskProposals: [{ id: `${starter.id}:e0`, starterId: starter.id, title: starter.title,
        process: "", description: starter.description, kind: starter.suggestedKind, unit: starter.suggestedUnit,
        steps: [...starter.suggestedSteps], companyIds: ["c1"] }],
      habitualProposalForm: { title: "Borrador sin terminar", process: "", description: "", kind: "resultado", unit: "", steps: ["x".repeat(301)] },
    };
    function Harness() {
      const [current, setCurrent] = useState(initial);
      return <Onboarding state={state} month="2026-10" profile={state.profiles.find((profile) => profile.id === "e0")!} draft={current} update={setCurrent} finish={() => {}} pause={() => {}} laboratory />;
    }
    render(<Harness />);
    const next = screen.getByRole("button", { name: /^Continuar/ });
    expect((next as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(next);
    expect(document.querySelector(".induction-top")?.textContent).toContain("4 DE 6");
  });

  it("reinicia el editor local al cambiar de perfil y guarda el nuevo control sólo en el perfil nuevo", () => {
    const state = seed();
    const profiles = state.profiles.filter((profile) => profile.id === "e0" || profile.id === "e1");
    const drafts: Record<string, Draft> = { e0: { ...draft(2), customSteps: "Control anterior de otro perfil" }, e1: { ...draft(2), customTitle: "Tarea perfil nuevo", customSteps: "", customTasks: [] } };
    function Harness() {
      const [profileId, setProfileId] = useState("e0");
      const profile = profiles.find((row) => row.id === profileId)!;
      return <>
        <button onClick={() => setProfileId("e1")}>Cambiar perfil</button>
        <Onboarding key={profile.id} state={state} month="2026-10" profile={profile} draft={drafts[profileId]} update={(next) => { drafts[profileId] = next; }} finish={() => {}} pause={() => {}} laboratory />
      </>;
    }
    render(<Harness />);
    fireEvent.click(screen.getByText("Agregar un trabajo esporádico · una sola vez"));
    expect((screen.getByLabelText("Paso 1") as HTMLInputElement).value).toBe("Control anterior de otro perfil");
    fireEvent.click(screen.getByText("Cambiar perfil"));
    fireEvent.click(screen.getByText("Agregar un trabajo esporádico · una sola vez"));
    expect(screen.queryByLabelText("Paso 1")).toBeNull();
    fireEvent.click(document.querySelector<HTMLElement>(".step-add")!);
    fireEvent.change(screen.getByLabelText("Paso 1"), { target: { value: "Control exclusivo del perfil nuevo" } });
    fireEvent.click(screen.getByRole("button", { name: /Agregar esta tarea/ }));
    expect(drafts.e1.customTasks?.[0]?.steps).toBe("Control exclusivo del perfil nuevo");
    expect(drafts.e0.customTasks).toHaveLength(0);
    expect(drafts.e0.customSteps).toBe("Control anterior de otro perfil");
  });

  it("describe operativas por unidad sin mostrar el peso legacy como puntos", () => {
    const state = seed();
    const view = render(<Onboarding state={state} month="2026-10" profile={state.profiles.find((profile) => profile.id === "e0")!} draft={draft(2)} update={() => {}} finish={() => {}} pause={() => {}} laboratory />);
    expect(screen.getByText(/Los entregables se evalúan por controles y puntos/)).toBeTruthy();
    const operation = [...view.container.querySelectorAll<HTMLElement>(".catalog-option")].find((row) => row.textContent?.includes("Carga de facturas"));
    expect(operation?.textContent).toContain("facturas · sin cuota");
    expect(operation?.textContent).not.toContain("pts");
    expect(operation?.textContent).not.toContain("120");
    expect(screen.getByText(/tarea puntual con peso 1/i)).toBeTruthy();
    expect(screen.queryByText(/no va a generar tareas ni puntos hasta que la revise jefatura/i)).toBeNull();
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

  it("permite programar cada propuesta v2 por empresa y parte sin vencimiento", () => {
    const state = seed();
    const starter = NEUTRAL_STARTER_SUGGESTIONS[0]!;
    const initial: Draft = {
      ...draft(3), selectedTemplateIds: [],
      habitualTaskProposals: [{
        id: `${starter.id}:e0`, starterId: starter.id, title: starter.title, process: "",
        description: starter.description, kind: starter.suggestedKind, unit: starter.suggestedUnit,
        steps: [...starter.suggestedSteps], companyIds: ["c1", "c2"],
      }],
      companySchedules: {},
    };
    let saved = initial;
    function Harness() {
      const [current, setCurrent] = useState(initial);
      return <Onboarding state={state} month="2026-10" profile={state.profiles.find((profile) => profile.id === "e0")!} draft={current} update={(next) => { saved = next; setCurrent(next); }} finish={() => {}} pause={() => {}} laboratory />;
    }
    render(<Harness />);
    const proposal = document.querySelector<HTMLElement>(".habitual-proposal-schedule")!;
    const companySections = within(proposal).getAllByText(/Empresa/).length;
    expect(companySections).toBeGreaterThan(0);
    const schedules = proposal.querySelectorAll<HTMLElement>(".induction-company-schedule");
    expect(schedules).toHaveLength(2);
    for (const section of schedules) expect((within(section).getByLabelText("Tiene vencimiento") as HTMLInputElement).checked).toBe(false);
    fireEvent.change(within(schedules[0]!).getByLabelText("Frecuencia de la tarea"), { target: { value: "mensual" } });
    fireEvent.change(within(schedules[1]!).getByLabelText("Frecuencia de la tarea"), { target: { value: "semanal" } });
    expect(saved.companySchedules?.[`${starter.id}:e0`]?.c1?.frequency).toBe("mensual");
    expect(saved.companySchedules?.[`${starter.id}:e0`]?.c2?.frequency).toBe("semanal");
    expect(saved.companySchedules?.[`${starter.id}:e0`]?.c1?.hasDeadline).toBe(false);
    expect(saved.companySchedules?.[`${starter.id}:e0`]?.c2?.hasDeadline).toBe(false);
  });

  it("sólo muestra sugerencias v2 a perfiles que preparan propuestas para jefatura", () => {
    const state = seed();
    const boss = state.profiles.find((profile) => profile.role === "jefe")!;
    const starter = NEUTRAL_STARTER_SUGGESTIONS[0]!;
    const draftWithSavedSuggestion: Draft = {
      ...state.onboarding[boss.id]!, step: 2, selectedCompanyIds: [boss.companyIds[0]!],
      habitualTaskProposals: [{ id: `${starter.id}:${boss.id}`, starterId: starter.id, title: starter.title,
        process: "", description: starter.description, kind: starter.suggestedKind, unit: starter.suggestedUnit,
        steps: [...starter.suggestedSteps], companyIds: [] }],
    };
    render(<Onboarding state={state} month="2026-10" profile={boss} draft={draftWithSavedSuggestion} update={() => {}} finish={() => {}} pause={() => {}} laboratory />);
    expect(screen.queryByRole("heading", { name: /Sugerencias para propuestas/ })).toBeNull();
    expect(screen.getByLabelText("Borradores v2 conservados").textContent).toMatch(/se conservan estos borradores; no se enviarán desde jefatura/i);
  });

  it("no muestra sugerencias v2 cuando el guardado no es sólo de laboratorio", () => {
    const state = seed();
    render(<Onboarding state={state} month="2026-10" profile={state.profiles.find((profile) => profile.id === "e0")!} draft={{ ...draft(2), selectedTemplateIds: [] }} update={() => {}} finish={() => {}} pause={() => {}} laboratory remote />);
    expect(screen.queryByRole("heading", { name: /Sugerencias para propuestas/ })).toBeNull();
    expect(document.querySelectorAll(".starter-suggestion-group")).toHaveLength(0);
  });

  it("permite quitar una selección v1 restaurada sin ofrecerla en un onboarding nuevo", () => {
    const state = seed();
    const v1 = NEUTRAL_STARTER_CATALOG[0]!;
    const initial: Draft = { ...draft(2), selectedTemplateIds: [v1.id] };
    const update = vi.fn<(value: Draft) => void>();
    render(<Onboarding state={state} month="2026-10" profile={state.profiles.find((profile) => profile.id === "e0")!} draft={initial} update={update} finish={() => {}} pause={() => {}} laboratory />);
    fireEvent.click(screen.getByText("Historial v1 · conservar borradores antiguos"));
    expect(screen.getAllByText(v1.title).length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("button", { name: `Quitar selección histórica ${v1.title}` }));
    expect(update.mock.calls.at(-1)?.[0].selectedTemplateIds).not.toContain(v1.id);
  });

  it("solo conserva nombres libres para una propuesta explícita de tarea aún no catalogada", () => {
    const state = seed();
    const initial: Draft = { ...draft(2), selectedTemplateIds: [], companySchedules: {} };
    let saved = initial;
    function Harness() {
      const [current, setCurrent] = useState(initial);
      return <Onboarding state={state} month="2026-10" profile={state.profiles.find((profile) => profile.id === "e0")!} draft={current} update={(next) => { saved = next; setCurrent(next); }} finish={() => {}} pause={() => {}} laboratory />;
    }
    render(<Harness />);
    fireEvent.click(screen.getByText("Proponer una tarea habitual que falta"));
    fireEvent.change(screen.getByLabelText("Nombre de la tarea"), { target: { value: "Control de documentación pendiente" } });
    fireEvent.change(screen.getByLabelText("Banco o nombre del proceso · opcional"), { target: { value: "Documentación" } });
    fireEvent.change(screen.getByLabelText("¿Qué trabajo realizás?"), { target: { value: "Conciliar movimientos y dejar evidencia." } });
    const proposalForm = within(document.querySelector(".habitual-proposal-form")!);
    fireEvent.click(proposalForm.getByRole("button", { name: "Agregar paso" }));
    fireEvent.change(proposalForm.getByLabelText("Paso 1"), { target: { value: "Descargar el extracto" } });
    fireEvent.click(screen.getByRole("button", { name: "Agregar propuesta" }));
    expect(saved.habitualTaskProposals).toHaveLength(1);
    expect(saved.habitualTaskProposals?.[0]).toMatchObject({ title: "Control de documentación pendiente", process: "Documentación", companyIds: ["c1", "c2"], steps: ["Descargar el extracto"] });
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
