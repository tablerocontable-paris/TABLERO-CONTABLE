// @vitest-environment jsdom
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import App from "../src/App";
import DeadlineAgenda from "../src/components/DeadlineAgenda";
import RemoteWorkspace from "../src/components/RemoteWorkspace";
import {
  operationalSeed,
  projectState,
  applyProposal,
} from "../src/server/site-policy";
import {
  materialize,
  currentMonth,
  dateART,
  type Assignment,
  type State,
} from "../src/domain/model";
import { defaultSchedule } from "../src/domain/schedule";
vi.mock("recharts", () =>
  Object.fromEntries(
    [
      "ResponsiveContainer",
      "BarChart",
      "Bar",
      "LabelList",
      "XAxis",
      "YAxis",
      "CartesianGrid",
      "Tooltip",
      "Legend",
      "LineChart",
      "Line",
      "ReferenceLine",
      "PieChart",
      "Pie",
      "Cell",
    ].map((k) => [k, () => null]),
  ),
);
const email = "valentino@example.test";
function prepared(id = "e0") {
  const s = operationalSeed(email);
  s.activeId = id;
  s.onboarding[id].completedAt = new Date().toISOString();
  s.onboarding[id].step = 5;
  const t = s.templates[0];
  const a: Assignment = {
    id: "a1",
    templateId: t.id,
    title: t.title,
    ownerId: "e0",
    companyId: "c1",
    sector: t.sector,
    kind: t.kind,
    weight: t.weight,
    unit: t.unit,
    target: t.target,
    day: Number(dateART().slice(-2)),
    frequency: "única",
    schedule: defaultSchedule(dateART()),
    steps: t.steps,
    startMonth: currentMonth(),
    priority: "Media",
  };
  s.assignments = [a, { ...a, id: "a2", companyId: "c2" }];
  return materialize(s, currentMonth());
}
beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal("matchMedia", () => ({
    matches: false,
    addEventListener() {},
    removeEventListener() {},
  }));
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute("open");
  };
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
describe("UI conectada: recorrido diario sin simulación", () => {
  it("abre Mi tablero con identidad fija y pliega tarjetas independientemente", () => {
    const s = prepared();
    const p = projectState(
      s,
      s.profiles.find((p) => p.id === "e0")!,
    );
    const save = vi.fn(async (next: State) => next);
    render(<App initialState={p} remoteSave={save} remoteOwner />);
    expect(
      screen.getByLabelText("Mi espacio").querySelectorAll("option"),
    ).toHaveLength(2);
    expect(screen.queryByText("Vista de usuario · simulación")).toBeNull();
    expect(screen.queryByText("Laboratorio de pruebas")).toBeNull();
    fireEvent.click(document.querySelector('[data-nav="tasks"]')!);
    const cards = document.querySelectorAll(".task-card");
    expect(cards).toHaveLength(2);
    fireEvent.click(
      within(cards[0] as HTMLElement).getByRole("button", {
        name: /Plegar tarjeta/,
      }),
    );
    expect(
      within(cards[0] as HTMLElement)
        .getByRole("button", { name: /Desplegar tarjeta/ })
        .getAttribute("aria-expanded"),
    ).toBe("false");
    expect(
      within(cards[1] as HTMLElement)
        .getByRole("button", { name: /Plegar tarjeta/ })
        .getAttribute("aria-expanded"),
    ).toBe("true");
    expect(localStorage.getItem("paris-state-v3")).toBeNull();
  });
  it("inicia timer, tilda checklist y termina la tarjeta en el servidor sin tocar la otra empresa", async () => {
    let s = prepared();
    const p = projectState(
      s,
      s.profiles.find((p) => p.id === "e0")!,
    );
    const persist = vi.fn(
      async (next: State, action?: string, entityId?: string) => {
        s = applyProposal(
          s,
          next,
          s.profiles.find((p) => p.id === "e0")!,
          action || "",
          entityId || "",
        );
        return projectState(
          s,
          s.profiles.find((p) => p.id === "e0")!,
        );
      },
    );
    render(<App initialState={p} remoteSave={persist} />);
    fireEvent.click(document.querySelector('[data-nav="tasks"]')!);
    const cards = document.querySelectorAll(".task-card");
    const targetId = cards[0].getAttribute("data-task-id")!;
    const selected = () => s.tasks.find((t) => t.id === targetId)!;
    fireEvent.click(
      within(cards[0] as HTMLElement).getByRole("button", {
        name: /^Iniciar /,
      }),
    );
    await waitFor(() => expect(selected().sessions).toHaveLength(1));
    fireEvent.click(document.querySelector('[data-nav="calendar"]')!);
    const company = s.companies.find(
      (c) => c.id === selected().companyId,
    )!.name;
    const row = (await screen.findByRole("cell", { name: company })).closest(
      "tr",
    )!;
    fireEvent.click(within(row).getByRole("button", { name: "Abrir tarjeta" }));
    for (const step of selected().checklist) {
      fireEvent.click(screen.getByLabelText(step.text));
      await waitFor(() =>
        expect(selected().checklist.find((c) => c.id === step.id)?.done).toBe(
          true,
        ),
      );
    }
    await waitFor(() => expect(selected().status).toBe("Completada"));
    expect(s.tasks.find((t) => t.id !== targetId)!.status).toBe("Pendiente");
    expect(selected().sessions?.[0].end).toBeTruthy();
  });
  it("la agenda muestra metas operativas y recordatorios personales además de los entregables", () => {
    const s = prepared();
    const t = {
      ...s.tasks[0],
      id: "op",
      title: "Control de facturas",
      kind: "operativa" as const,
      unit: "facturas",
      target: 25,
      checklist: [],
    };
    s.tasks.push(t);
    const now = new Date().toISOString();
    s.annotations = [
      {
        id: "note",
        ownerId: "e0",
        title: "Revisar presentación",
        content: "Control",
        kind: "reminder",
        reminderOn: dateART(),
        createdAt: now,
        updatedAt: now,
        convertedTaskId: null,
      },
    ];
    render(
      <DeadlineAgenda
        state={s}
        month={currentMonth()}
        company=""
        owner="e0"
        sector=""
        openTask={() => {}}
        openNotes={() => {}}
      />,
    );
    expect(screen.getByText("Control de facturas")).toBeTruthy();
    expect(screen.getByText("0 / 25 facturas")).toBeTruthy();
    expect(screen.getByText("Revisar presentación")).toBeTruthy();
    fireEvent.click(
      screen.getByLabelText("Mostrar también objetivos cumplidos"),
    );
    expect(
      screen.getAllByRole("button", { name: "Abrir tarjeta" }),
    ).toHaveLength(3);
  });
  it("configura empresas en la cuenta técnica y conserva sus identidades", async () => {
    const s = prepared("admin");
    const save = vi.fn(async (next: State) => next);
    render(
      <App
        initialState={projectState(
          s,
          s.profiles.find((p) => p.id === "admin")!,
        )}
        remoteSave={save}
        remoteOwner
      />,
    );
    fireEvent.click(document.querySelector('[data-nav="team"]')!);
    fireEvent.change(await screen.findByLabelText("Empresa 1"), {
      target: { value: "Razón social real" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Guardar empresas" }));
    await waitFor(() => expect(save).toHaveBeenCalled());
    expect(save.mock.calls.at(-1)?.[0].companies[0]).toEqual({
      id: "c1",
      name: "Razón social real",
    });
  });
  it("un error de red conserva la propuesta y ofrece reintento sin volver a localStorage", async () => {
    const s = prepared("admin");
    const initial = {
      state: projectState(
        s,
        s.profiles.find((p) => p.id === "admin")!,
      ),
      revision: 0,
      isOwner: true,
      presence: {},
    };
    const fetch = vi.fn(async (_path: unknown, init?: RequestInit) => {
      if (init?.method === "POST") throw Error("offline");
      return Response.json(initial);
    });
    vi.stubGlobal("fetch", fetch);
    render(<RemoteWorkspace />);
    await screen.findByLabelText("Mi espacio");
    fireEvent.click(document.querySelector('[data-nav="team"]')!);
    fireEvent.change(await screen.findByLabelText("Empresa 1"), {
      target: { value: "Cambio recuperable" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Guardar empresas" }));
    await screen.findByRole("button", { name: "Reintentar guardado" });
    expect(
      screen.getByRole("button", { name: "Descargar cambio pendiente" }),
    ).toBeTruthy();
    expect(localStorage.getItem("paris-state-v3")).toBeNull();
  });
});
