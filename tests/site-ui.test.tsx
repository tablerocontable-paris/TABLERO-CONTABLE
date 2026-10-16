// @vitest-environment jsdom
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { useState } from "react";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import App from "../src/App";
import { Dialog } from "../src/components/ui";
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
describe("restauración de foco en diálogos compartidos", () => {
  it("devuelve el foco al control que abrió el diálogo después de cerrarlo", async () => {
    function Harness() {
      const [open, setOpen] = useState(false);
      return <><button type="button" onClick={() => setOpen(true)}>Abrir diálogo</button>{open && <Dialog title="Prueba" onClose={() => setOpen(false)}><p>Contenido</p></Dialog>}</>;
    }
    render(<Harness />);
    const opener = screen.getByRole("button", { name: "Abrir diálogo" });
    opener.focus();
    fireEvent.click(opener);
    fireEvent.click(screen.getByRole("button", { name: "Cerrar" }));
    await waitFor(() => expect(document.activeElement).toBe(opener));
  });
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
    const row = (await screen.findByRole("cell", { name: company })).closest("tr")!;
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
    fireEvent.click(screen.getByRole("button", { name: "Cargar versión guardada" }));
  });
  it("S45: conserva la propuesta cuando el servidor responde 200 con un DTO inválido", async () => {
    const s = prepared("admin");
    const initial = {
      state: projectState(s, s.profiles.find((p) => p.id === "admin")!),
      revision: 0,
      isOwner: true,
      presence: {},
    };
    const fetch = vi.fn(async (_path: unknown, init?: RequestInit) =>
      init?.method === "POST"
        ? Response.json({ state: initial.state, revision: -1, isOwner: true, presence: {} })
        : Response.json(initial),
    );
    vi.stubGlobal("fetch", fetch);
    render(<RemoteWorkspace />);
    await screen.findByLabelText("Mi espacio");
    fireEvent.click(document.querySelector('[data-nav="team"]')!);
    fireEvent.change(await screen.findByLabelText("Empresa 1"), { target: { value: "Cambio no confirmado" } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar empresas" }));
    await screen.findByRole("button", { name: "Reintentar guardado" });
    expect(screen.getByRole("button", { name: "Descargar cambio pendiente" })).toBeTruthy();
    expect(screen.getAllByText("El servidor devolvió un tablero con formato inválido. Conservamos el cambio para reintentar.").length).toBeGreaterThan(0);
    expect(localStorage.getItem("paris-state-v3")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Cargar versión guardada" }));
  });
  it("S45: rechaza un DTO GET inválido sin fabricar estado inicial", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ state: {}, revision: "0", presence: {} })));
    render(<RemoteWorkspace />);
    expect((await screen.findByRole("alert")).textContent).toContain("formato inválido");
    expect(screen.queryByLabelText("Mi espacio")).toBeNull();
    expect(localStorage.getItem("paris-state-v3")).toBeNull();
  });
  it("S45: rechaza un perfil activo que no existe en el DTO GET", async () => {
    const s = prepared("admin");
    const state = projectState(s, s.profiles.find((p) => p.id === "admin")!);
    state.activeId = "perfil-ausente";
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ state, revision: 0, isOwner: true, presence: {} })));
    render(<RemoteWorkspace />);
    expect((await screen.findByRole("alert")).textContent).toContain("formato inválido");
    expect(screen.queryByLabelText("Mi espacio")).toBeNull();
    expect(localStorage.getItem("paris-state-v3")).toBeNull();
  });
  it("S45: rechaza un activeId que resuelve a un perfil inactivo", async () => {
    const s = prepared("admin");
    const state = projectState(s, s.profiles.find((p) => p.id === "admin")!);
    state.profiles.find((profile) => profile.id === state.activeId)!.active = false;
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ state, revision: 0, isOwner: true, presence: {} })));
    render(<RemoteWorkspace />);
    expect((await screen.findByRole("alert")).textContent).toContain("formato inválido");
    expect(screen.queryByLabelText("Mi espacio")).toBeNull();
  });
  it("S45: conserva la propuesta ante un POST cuyo perfil activo no existe", async () => {
    const s = prepared("admin");
    const initial = {
      state: projectState(s, s.profiles.find((p) => p.id === "admin")!),
      revision: 0,
      isOwner: true,
      presence: {},
    };
    const fetch = vi.fn(async (_path: unknown, init?: RequestInit) =>
      init?.method === "POST"
        ? Response.json({ ...initial, state: { ...initial.state, activeId: "perfil-ausente" }, revision: 1 })
        : Response.json(initial),
    );
    vi.stubGlobal("fetch", fetch);
    render(<RemoteWorkspace />);
    await screen.findByLabelText("Mi espacio");
    fireEvent.click(document.querySelector('[data-nav="team"]')!);
    fireEvent.change(await screen.findByLabelText("Empresa 1"), { target: { value: "Propuesta no confirmada" } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar empresas" }));
    await screen.findByRole("button", { name: "Reintentar guardado" });
    expect(screen.getByRole("button", { name: "Descargar cambio pendiente" })).toBeTruthy();
    expect(screen.getAllByText("El servidor devolvió un tablero con formato inválido. Conservamos el cambio para reintentar.").length).toBeGreaterThan(0);
    expect(localStorage.getItem("paris-state-v3")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Cargar versión guardada" }));
    await screen.findByLabelText("Mi espacio");
  });
  it("S44: descarta una lectura de empleado que llega después de cambiar de vista", async () => {
    const source = prepared("admin");
    const responseFor = (profileId: string, companyName: string) => {
      const state = projectState(source, source.profiles.find((p) => p.id === profileId)!);
      state.companies[0]!.name = companyName;
      return { state, revision: 0, isOwner: true, presence: {} };
    };
    let resolveEmployee!: (response: Response) => void;
    let adminReads = 0;
    const fetch = vi.fn(async (path: unknown) => {
      const url = new URL(String(path), "https://paris.test");
      const requested = url.searchParams.get("view") || "admin";
      if (requested === "e0") return new Promise<Response>((resolve) => { resolveEmployee = resolve; });
      if (requested === "admin") adminReads += 1;
      return Response.json(responseFor(requested, requested === "admin" && adminReads > 1 ? "Vista actual" : "Datos iniciales"));
    });
    vi.stubGlobal("fetch", fetch);
    render(<RemoteWorkspace />);
    const selector = await screen.findByLabelText("Vista de usuario") as HTMLSelectElement;
    fireEvent.change(selector, { target: { value: "e0" } });
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
    fireEvent.change(screen.getByLabelText("Vista de usuario"), { target: { value: "admin" } });
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(3));
    await waitFor(() => expect((screen.getByLabelText("Vista de usuario") as HTMLSelectElement).value).toBe("admin"));
    resolveEmployee(Response.json(responseFor("e0", "Respuesta obsoleta")));
    await waitFor(() => expect((screen.getByLabelText("Vista de usuario") as HTMLSelectElement).value).toBe("admin"));
    expect(screen.getAllByText("Vista actual").length).toBeGreaterThan(0);
    expect(screen.queryByText("Respuesta obsoleta")).toBeNull();
  });
  it("S44: descarta un polling iniciado antes del guardado y conserva la propuesta en App", async () => {
    const source = prepared("admin");
    const initial = {
      state: projectState(source, source.profiles.find((p) => p.id === "admin")!),
      revision: 4,
      isOwner: true,
      presence: {},
    };
    let pollResolve!: (response: Response) => void;
    let postResolve!: (response: Response) => void;
    let postBody: { state: State; revision: number } | undefined;
    let reads = 0;
    const fetch = vi.fn(async (_path: unknown, init?: RequestInit) => {
      if (init?.method === "POST") {
        postBody = JSON.parse(String(init.body)) as { state: State; revision: number };
        return new Promise<Response>((resolve) => { postResolve = resolve; });
      }
      reads += 1;
      if (reads === 1) return Response.json(initial);
      if (reads === 2)
        return new Promise<Response>((resolve) => { pollResolve = resolve; });
      return Response.json({
        ...initial,
        state: postBody?.state ?? initial.state,
        revision: postBody ? 5 : initial.revision,
      });
    });
    vi.stubGlobal("fetch", fetch);
    const interval = vi.spyOn(window, "setInterval");
    render(<RemoteWorkspace />);
    await screen.findByLabelText("Mi espacio");

    const pollCallback = interval.mock.calls.find(([, delay]) => delay === 30000)?.[0] as
      | (() => Promise<void>)
      | undefined;
    expect(pollCallback).toBeDefined();
    let polling!: Promise<void>;
    await act(async () => {
      polling = pollCallback!();
      await Promise.resolve();
    });
    await waitFor(() => expect(reads).toBe(2));

    fireEvent.click(document.querySelector('[data-nav="team"]')!);
    fireEvent.change(await screen.findByLabelText("Empresa 1"), {
      target: { value: "Cambio propio pendiente" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Guardar empresas" }));
    await waitFor(() => expect(postBody?.state.companies[0]?.name).toBe("Cambio propio pendiente"));

    const stale = structuredClone(initial);
    stale.revision = 5;
    stale.state.companies[0]!.name = "Respuesta vieja del polling";
    await act(async () => {
      pollResolve(Response.json(stale));
      await polling;
    });
    expect(screen.getAllByText("Cambio propio pendiente").length).toBeGreaterThan(0);
    expect(screen.queryByText("Respuesta vieja del polling")).toBeNull();

    await act(async () => {
      postResolve(Response.json({
        state: postBody!.state,
        revision: 5,
        isOwner: true,
        presence: {},
      }));
    });
    await waitFor(() => expect(screen.getByText(/Guardado en el servidor/)).toBeTruthy());
    expect(screen.getAllByText("Cambio propio pendiente").length).toBeGreaterThan(0);
    expect(screen.queryByText("Respuesta vieja del polling")).toBeNull();
  });
  it("S44: ignora la respuesta anterior cuando dos sondeos contestan fuera de orden y conserva la revisión nueva", async () => {
    const source = prepared("admin");
    const initial = {
      state: projectState(source, source.profiles.find((p) => p.id === "admin")!),
      revision: 0,
      isOwner: true,
      presence: {},
    };
    const pendingReads: ((response: Response) => void)[] = [];
    let reads = 0;
    let postBody: { state: State; revision: number } | undefined;
    let finishPost!: (response: Response) => void;
    let refreshResponse = initial;
    const fetch = vi.fn(async (_path: unknown, init?: RequestInit) => {
      if (init?.method === "POST") {
        postBody = JSON.parse(String(init.body)) as { state: State; revision: number };
        return new Promise<Response>((resolve) => { finishPost = resolve; });
      }
      reads += 1;
      if (reads === 1) return Response.json(initial);
      if (reads === 4) return Response.json(refreshResponse);
      return new Promise<Response>((resolve) => pendingReads.push(resolve));
    });
    vi.stubGlobal("fetch", fetch);
    const interval = vi.spyOn(window, "setInterval");
    render(<RemoteWorkspace />);
    await screen.findByLabelText("Mi espacio");
    const poll = interval.mock.calls.find(([, delay]) => delay === 30000)?.[0] as
      | (() => Promise<void>)
      | undefined;
    expect(poll).toBeDefined();

    let first!: Promise<void>;
    let second!: Promise<void>;
    await act(async () => {
      first = poll!();
      second = poll!();
      await Promise.resolve();
    });
    await waitFor(() => expect(pendingReads).toHaveLength(2));

    const newer = structuredClone(initial);
    newer.revision = 2;
    newer.state.companies[0]!.name = "Empresa versión nueva";
    await act(async () => {
      pendingReads[1]!(Response.json(newer));
      await second;
    });
    expect(screen.getAllByText("Empresa versión nueva").length).toBeGreaterThan(0);

    const older = structuredClone(initial);
    older.revision = 1;
    older.state.companies[0]!.name = "Empresa versión antigua";
    await act(async () => {
      pendingReads[0]!(Response.json(older));
      await first;
    });
    expect(screen.queryByText("Empresa versión antigua")).toBeNull();
    expect(screen.getAllByText("Empresa versión nueva").length).toBeGreaterThan(0);

    fireEvent.click(document.querySelector('[data-nav="team"]')!);
    fireEvent.change(await screen.findByLabelText("Empresa 1"), { target: { value: "Cambio propio" } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar empresas" }));
    await waitFor(() => expect(postBody?.state.companies[0]?.name).toBe("Cambio propio"));
    expect(postBody?.revision).toBe(2);
    refreshResponse = { ...newer, state: postBody!.state, revision: 3 };
    await act(async () => {
      finishPost(Response.json(refreshResponse));
    });
    await waitFor(() => expect(screen.getByText(/Guardado en el servidor/)).toBeTruthy());
  });
  it("S44: la apertura explícita prevalece sobre un sondeo pendiente y recupera el estado guardado", async () => {
    const source = prepared("admin");
    const responseFor = (profileId: string, companyName: string) => {
      const state = projectState(source, source.profiles.find((profile) => profile.id === profileId)!);
      state.onboarding[profileId]!.completedAt = new Date().toISOString();
      state.onboarding[profileId]!.step = 5;
      state.companies[0]!.name = companyName;
      return { state, revision: profileId === "e0" ? 7 : 5, isOwner: true, presence: {} };
    };
    let resolvePoll!: (response: Response) => void;
    let reads = 0;
    const fetch = vi.fn(async (path: unknown) => {
      const view = new URL(String(path), "https://paris.test").searchParams.get("view") || "admin";
      reads += 1;
      if (reads === 1) return Response.json(responseFor("admin", "Empresa inicial"));
      if (view === "e0") return Response.json(responseFor("e0", "Empresa del perfil abierto"));
      return new Promise<Response>((resolve) => { resolvePoll = resolve; });
    });
    vi.stubGlobal("fetch", fetch);
    const interval = vi.spyOn(window, "setInterval");
    render(<RemoteWorkspace />);
    await screen.findByLabelText("Mi espacio");
    const poll = interval.mock.calls.find(([, delay]) => delay === 30000)?.[0] as
      | (() => Promise<void>)
      | undefined;
    let polling!: Promise<void>;
    await act(async () => {
      polling = poll!();
      await Promise.resolve();
    });
    await waitFor(() => expect(reads).toBe(2));

    fireEvent.change(screen.getByLabelText("Vista de usuario"), { target: { value: "e0" } });
    await waitFor(() => expect((screen.getByLabelText("Vista de usuario") as HTMLSelectElement).value).toBe("e0"));
    expect(screen.getAllByText("Empresa del perfil abierto").length).toBeGreaterThan(0);
    expect(screen.getByText(/Guardado en el servidor/)).toBeTruthy();

    const stale = responseFor("admin", "Respuesta vieja del sondeo");
    await act(async () => {
      resolvePoll(Response.json(stale));
      await polling;
    });
    expect(screen.getAllByText("Empresa del perfil abierto").length).toBeGreaterThan(0);
    expect(screen.queryByText("Respuesta vieja del sondeo")).toBeNull();
    expect(screen.getByText(/Guardado en el servidor/)).toBeTruthy();
  });
  it("S44: conserva la propuesta y permite recuperarla tras desmontar durante la espera del guardado", async () => {
    const s = prepared("admin");
    const initial = { state: projectState(s, s.profiles.find((p) => p.id === "admin")!), revision: 0, isOwner: true, presence: {} };
    const fetch = vi.fn(async () => Response.json(initial));
    vi.stubGlobal("fetch", fetch);
    const firstRender = render(<RemoteWorkspace />);
    await screen.findByLabelText("Mi espacio");
    fireEvent.click(document.querySelector('[data-nav="team"]')!);
    fireEvent.change(await screen.findByLabelText("Empresa 1"), { target: { value: "Propuesta conservada" } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar empresas" }));
    firstRender.unmount();
    render(<RemoteWorkspace />);
    expect(await screen.findByRole("button", { name: "Descargar cambio pendiente" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Reintentar guardado" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Descartar cambio y cargar versión guardada" }));
    await screen.findByLabelText("Mi espacio");
  });
});
