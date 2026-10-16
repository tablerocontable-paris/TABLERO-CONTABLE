// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import App from "../src/App";
import { seed } from "../src/data/repository";
import { dateART, type State } from "../src/domain/model";
import type { TaskEvidence } from "../src/domain/laboratory-work";

const evidenceMocks = vi.hoisted(() => ({
  acquire: vi.fn(async () => () => {}),
  store: vi.fn(),
  remove: vi.fn(async () => {}),
}));
vi.mock("../src/data/laboratoryEvidence", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../src/data/laboratoryEvidence")>()),
  acquireEvidenceMutationLock: evidenceMocks.acquire,
  storeTaskEvidence: evidenceMocks.store,
  removeStoredEvidence: evidenceMocks.remove,
}));
vi.mock("recharts", () => Object.fromEntries([
  "ResponsiveContainer", "BarChart", "Bar", "LabelList", "XAxis", "YAxis", "CartesianGrid", "Tooltip", "Legend",
  "LineChart", "Line", "ReferenceLine", "PieChart", "Pie", "Cell",
].map((name) => [name, () => null])));

beforeEach(() => {
  localStorage.clear();
  history.replaceState(null, "", "/");
  vi.stubGlobal("matchMedia", () => ({ matches: false, addEventListener() {}, removeEventListener() {} }));
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute("open", ""); };
  HTMLDialogElement.prototype.close = function () { this.removeAttribute("open"); };
  evidenceMocks.store.mockImplementation(async (_files: File[], context: { taskId: string; activityId: string; profileId: string }) => [{
    id: "operational-evidence-1", taskId: context.taskId, activityId: context.activityId, profileId: context.profileId,
    name: "lote.png", mimeType: "image/png", size: 8, sha256: "a".repeat(64), createdAt: new Date().toISOString(),
  }]);
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

function stateWithOneOperation(): { state: State; taskId: string } {
  const state = seed();
  state.activeId = "e0";
  const task = state.tasks.find((row) => row.ownerId === "e0" && row.kind === "operativa" && !row.responsibility)!;
  state.tasks = [task];
  state.assignments = [];
  state.activity = [];
  state.taskEvidence = [];
  return { state, taskId: task.id };
}

async function openRegistration(state: State) {
  render(<App initialState={state} laboratoryMode />);
  fireEvent.click(document.querySelector('[data-nav="operations"]')!);
  fireEvent.click(await screen.findByRole("button", { name: "Registrar" }));
  fireEvent.change(screen.getByLabelText(/Cantidad de/), { target: { value: "3" } });
  const fileInput = document.querySelector<HTMLInputElement>('input[name="evidenceFiles"]')!;
  expect(fileInput).toBeTruthy();
  const evidenceFile = new window.File(["ficticio"], "lote.png", { type: "image/png" });
  vi.stubGlobal("FormData", class {
    get(name: string) { return ({ qty: "3", date: dateART(), note: "Lote de prueba" } as Record<string, string>)[name] ?? null; }
    getAll(name: string) { return name === "evidenceFiles" ? [evidenceFile] : []; }
  });
  fireEvent.click(screen.getByRole("button", { name: "Guardar registro" }));
}

describe("formulario integrado de movimiento operativo con evidencia", () => {
  it("libera el envío si Web Locks rechaza y permite reintentar sin duplicar", async () => {
    const { state, taskId } = stateWithOneOperation();
    evidenceMocks.acquire.mockRejectedValueOnce(new DOMException("Lock denied", "SecurityError"));

    await openRegistration(state);
    await waitFor(() => expect(evidenceMocks.acquire).toHaveBeenCalledTimes(1));
    expect(await screen.findByText(/No se pudo guardar la evidencia|Lock denied/)).toBeTruthy();
    expect(evidenceMocks.store).not.toHaveBeenCalled();
    expect(JSON.parse(localStorage.getItem("paris-state-lab") || "null")).toBeNull();
    expect(screen.getByRole("button", { name: "Guardar registro" }).getAttribute("aria-busy")).not.toBe("true");

    fireEvent.click(screen.getByRole("button", { name: "Guardar registro" }));
    await screen.findByText("Actividad y evidencia guardadas. Los indicadores se actualizaron.");
    const persisted = JSON.parse(localStorage.getItem("paris-state-lab")!) as State;
    expect(persisted.activity.filter((row) => row.taskId === taskId)).toHaveLength(1);
  });

  it("reconoce un write-then-throw confirmado y conserva el archivo vinculado", async () => {
    const { state, taskId } = stateWithOneOperation();
    const nativeSetItem = Storage.prototype.setItem;
    let thrown = false;
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (this: Storage, key, value) {
      nativeSetItem.call(this, key, value);
      if (key === "paris-state-lab" && !thrown) { thrown = true; throw new DOMException("QuotaExceededError"); }
    });

    await openRegistration(state);
    await waitFor(() => expect(evidenceMocks.store).toHaveBeenCalled());
    const persisted = JSON.parse(localStorage.getItem("paris-state-lab")!) as State;
    expect(persisted.activity.filter((row) => row.taskId === taskId)).toHaveLength(1);
    expect(persisted.activity.find((row) => row.taskId === taskId)?.evidenceIds).toEqual(["operational-evidence-1"]);
    expect(persisted.taskEvidence?.some((row) => row.id === "operational-evidence-1")).toBe(true);
    expect(evidenceMocks.remove).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog", { name: "Registrar actividad" })).toBeNull();
  });

  it("ignora un segundo envío durante la carga sin duplicar el movimiento", async () => {
    const { state, taskId } = stateWithOneOperation();
    let finishStore!: (rows: TaskEvidence[]) => void;
    evidenceMocks.store.mockReturnValueOnce(new Promise((resolve) => { finishStore = resolve; }));

    await openRegistration(state);
    await waitFor(() => expect(evidenceMocks.store).toHaveBeenCalledTimes(1));
    const form = screen.getByRole("button", { name: "Guardando…" }).closest("form");
    expect(form).toBeTruthy();
    fireEvent.submit(form!);
    expect(evidenceMocks.store).toHaveBeenCalledTimes(1);
    const context = evidenceMocks.store.mock.calls[0][1] as { activityId: string };

    finishStore([{
      id: "single-operational-evidence", taskId, activityId: context.activityId, profileId: state.activeId,
      name: "lote.png", mimeType: "image/png", size: 8, sha256: "a".repeat(64), createdAt: new Date().toISOString(),
    }]);
    await screen.findByText("Actividad y evidencia guardadas. Los indicadores se actualizaron.");
    const persisted = JSON.parse(localStorage.getItem("paris-state-lab")!) as State;
    expect(persisted.activity.filter((row) => row.taskId === taskId)).toHaveLength(1);
    expect(persisted.activity.find((row) => row.taskId === taskId)?.evidenceIds).toEqual(["single-operational-evidence"]);
  });

  it("clasifica como preparación fallida un error al generar la revisión durable", async () => {
    const { state } = stateWithOneOperation();
    // Keep the fixture out of the notification path so UUID #3 is the durable
    // revision generated inside commitAgainstResult's preparation try block.
    state.profiles = state.profiles.map((profile) => profile.id === state.activeId ? profile : { ...profile, active: false });
    const originalUuid = crypto.randomUUID.bind(crypto);
    let calls = 0;
    vi.spyOn(crypto, "randomUUID").mockImplementation(() => {
      calls += 1;
      if (calls === 3) throw new Error("No se pudo generar la revisión del laboratorio.");
      return originalUuid();
    });

    await openRegistration(state);
    await screen.findByText("No se pudo preparar la actividad. El archivo temporal se retiró y no quedó adjuntado. Podés volver a intentar.");
    expect(calls).toBe(3);
    expect(evidenceMocks.remove).toHaveBeenCalledWith(["operational-evidence-1"]);
    expect(localStorage.getItem("paris-state-lab")).toBeNull();
  });

  it("compensa el archivo tras rechazo seguro de almacenamiento y conserva el error preciso", async () => {
    const { state } = stateWithOneOperation();
    const nativeSetItem = Storage.prototype.setItem;
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (this: Storage, key, value) {
      if (key === "paris-state-lab") throw new DOMException("QuotaExceededError");
      return nativeSetItem.call(this, key, value);
    });

    await openRegistration(state);
    await screen.findByText("No se pudo guardar. Liberá espacio del navegador y volvé a intentar.");
    await waitFor(() => expect(evidenceMocks.remove).toHaveBeenCalledWith(["operational-evidence-1"]));
    expect(screen.queryByText(/cambió durante la carga/)).toBeNull();
    expect(localStorage.getItem("paris-state-lab")).toBeNull();
  });

  it("maneja una compensación fallida sin rechazar el envío ni afirmar que borró el archivo", async () => {
    const { state } = stateWithOneOperation();
    const nativeSetItem = Storage.prototype.setItem;
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (this: Storage, key, value) {
      if (key === "paris-state-lab") throw new DOMException("QuotaExceededError");
      return nativeSetItem.call(this, key, value);
    });
    evidenceMocks.remove.mockRejectedValueOnce(new DOMException("UnknownError"));

    await openRegistration(state);
    await screen.findByText(/archivo temporal quedó conservado para recuperación/i);
    expect(evidenceMocks.remove).toHaveBeenCalledWith(["operational-evidence-1"]);
    expect(localStorage.getItem("paris-state-lab")).toBeNull();
  });

  it("conserva los bytes y pide verificar cuando el resultado no puede determinarse", async () => {
    const { state } = stateWithOneOperation();
    const nativeSetItem = Storage.prototype.setItem;
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (this: Storage, key, value) {
      if (key === "paris-state-lab") throw new DOMException("QuotaExceededError");
      return nativeSetItem.call(this, key, value);
    });
    const getItem = Storage.prototype.getItem;
    let reads = 0;
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(function (this: Storage, key) {
      if (key === "paris-state-lab" && ++reads === 4) throw new DOMException("SecurityError");
      return getItem.call(this, key);
    });

    await openRegistration(state);
    await screen.findByText("No se pudo confirmar si la actividad quedó guardada. Los archivos se conservaron; revisá el historial antes de reintentar.");
    expect(evidenceMocks.remove).not.toHaveBeenCalled();
    vi.restoreAllMocks();
    expect(localStorage.getItem("paris-state-lab")).toBeNull();
  });
});
