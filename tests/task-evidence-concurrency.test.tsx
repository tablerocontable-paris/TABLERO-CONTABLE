// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import TaskEvidencePanel, { EvidenceLinks } from "../src/components/TaskEvidencePanel";
import { seed } from "../src/data/repository";
import type { State } from "../src/domain/model";
import type { TaskEvidence } from "../src/domain/laboratory-work";

const evidenceMocks = vi.hoisted(() => ({
  acquireEvidenceMutationLock: vi.fn(async () => () => {}),
  reconcileEvidenceAgainstDurableState: vi.fn(async () => true),
  reconcileEvidenceFromDurableState: vi.fn(async () => {}),
  reconcileEvidenceRecordKeys: vi.fn(async () => {}),
  storeTaskEvidence: vi.fn(),
  removeStoredEvidence: vi.fn(async () => {}),
  readStoredEvidence: vi.fn<(id: string) => Promise<Blob | null>>(() => Promise.resolve(null)),
}));
vi.mock("../src/data/laboratoryEvidence", () => evidenceMocks);

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.unstubAllGlobals();
  evidenceMocks.readStoredEvidence.mockResolvedValue(null);
});

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}

describe("adjuntos del laboratorio frente a cambios durante la carga", () => {
  it("conserva los bytes cuando el resultado del commit es ambiguo", async () => {
    const initial = seed();
    const actor = initial.profiles.find((profile) => profile.id === "e0")!;
    initial.activeId = actor.id;
    const task = initial.tasks.find((row) => row.ownerId === actor.id && row.kind === "resultado" && row.status !== "Completada" && !row.responsibility)!;
    const metadata: TaskEvidence = {
      id: "ambiguous-commit", taskId: task.id, activityId: null, profileId: actor.id,
      name: "prueba.png", mimeType: "image/png", size: 4, sha256: "9".repeat(64), createdAt: new Date().toISOString(),
    };
    evidenceMocks.storeTaskEvidence.mockResolvedValue([metadata]);
    const commitLatest = vi.fn(() => ({ status: "unknown" as const }));
    render(<TaskEvidencePanel state={initial} task={task} actor={actor} commitLatest={commitLatest} notify={() => {}} canAdd />);
    fireEvent.click(screen.getByRole("button", { name: /Desplegar Evidencia del entregable/ }));
    fireEvent.change(screen.getByLabelText(/Adjuntar imagen o PDF/), {
      target: { files: [new File(["fake"], metadata.name, { type: metadata.mimeType })] },
    });
    fireEvent.click(screen.getByRole("button", { name: "Guardar evidencia" }));

    expect((await screen.findByRole("alert")).textContent).toMatch(/archivos se conservó|archivo se conservó|revisá el entregable/i);
    expect(commitLatest).toHaveBeenCalledTimes(1);
    expect(evidenceMocks.removeStoredEvidence).not.toHaveBeenCalled();
  });

  it("rechaza la carga antes de reconciliar si el estado durable cambió mientras esperaba el lock", async () => {
    const initial = seed();
    const actor = initial.profiles.find((profile) => profile.id === "e0")!;
    initial.activeId = actor.id;
    const task = initial.tasks.find((row) => row.ownerId === actor.id && row.kind === "resultado" && row.status !== "Completada" && !row.responsibility)!;
    evidenceMocks.reconcileEvidenceAgainstDurableState.mockResolvedValueOnce(false);
    const commitLatest = vi.fn(() => ({ status: "committed" as const }));
    render(<TaskEvidencePanel state={initial} task={task} actor={actor} commitLatest={commitLatest} notify={() => {}} canAdd />);
    fireEvent.click(screen.getByRole("button", { name: /Desplegar Evidencia del entregable/ }));
    fireEvent.change(screen.getByLabelText(/Adjuntar imagen o PDF/), {
      target: { files: [new File(["fake"], "obsoleta.png", { type: "image/png" })] },
    });
    fireEvent.click(screen.getByRole("button", { name: "Guardar evidencia" }));

    expect((await screen.findByRole("alert")).textContent).toMatch(/cambió en otra pestaña.*recargá/i);
    expect(evidenceMocks.storeTaskEvidence).not.toHaveBeenCalled();
    expect(commitLatest).not.toHaveBeenCalled();
    expect(evidenceMocks.removeStoredEvidence).not.toHaveBeenCalled();
  });

  it("explica el rechazo por almacenamiento sin atribuirlo a un cambio de permisos", async () => {
    const initial = seed();
    const actor = initial.profiles.find((profile) => profile.id === "e0")!;
    initial.activeId = actor.id;
    const task = initial.tasks.find((row) => row.ownerId === actor.id && row.kind === "resultado" && row.status !== "Completada" && !row.responsibility)!;
    const metadata: TaskEvidence = {
      id: "storage-rejection", taskId: task.id, activityId: null, profileId: actor.id,
      name: "prueba.png", mimeType: "image/png", size: 4, sha256: "6".repeat(64), createdAt: new Date().toISOString(),
    };
    evidenceMocks.storeTaskEvidence.mockResolvedValue([metadata]);
    const notify = vi.fn();
    const commitLatest = vi.fn(() => ({ status: "rejected" as const, reason: "storage" as const }));
    render(<TaskEvidencePanel state={initial} task={task} actor={actor} commitLatest={commitLatest} notify={notify} canAdd />);
    fireEvent.click(screen.getByRole("button", { name: /Desplegar Evidencia del entregable/ }));
    fireEvent.change(screen.getByLabelText(/Adjuntar imagen o PDF/), {
      target: { files: [new File(["fake"], metadata.name, { type: metadata.mimeType })] },
    });
    fireEvent.click(screen.getByRole("button", { name: "Guardar evidencia" }));

    expect((await screen.findByRole("alert")).textContent).toMatch(/no se pudo guardar el estado del trabajo.*archivo temporal se retiró/i);
    expect(screen.queryByRole("alert")?.textContent).not.toMatch(/permiso.*cambió/i);
    expect(evidenceMocks.removeStoredEvidence).toHaveBeenCalledWith([metadata.id]);
    expect(notify).not.toHaveBeenCalled();
  });

  it("explica una preparación fallida sin atribuirla a un cambio de permisos", async () => {
    const initial = seed();
    const actor = initial.profiles.find((profile) => profile.id === "e0")!;
    initial.activeId = actor.id;
    const task = initial.tasks.find((row) => row.ownerId === actor.id && row.kind === "resultado" && row.status !== "Completada" && !row.responsibility)!;
    const metadata: TaskEvidence = { id: "preparation-rejection", taskId: task.id, activityId: null, profileId: actor.id, name: "prueba.png", mimeType: "image/png", size: 4, sha256: "5".repeat(64), createdAt: new Date().toISOString() };
    evidenceMocks.storeTaskEvidence.mockResolvedValue([metadata]);
    const commitLatest = vi.fn(() => ({ status: "rejected" as const, reason: "preparation" as const }));
    render(<TaskEvidencePanel state={initial} task={task} actor={actor} commitLatest={commitLatest} notify={() => {}} canAdd />);
    fireEvent.click(screen.getByRole("button", { name: /Desplegar Evidencia del entregable/ }));
    fireEvent.change(screen.getByLabelText(/Adjuntar imagen o PDF/), { target: { files: [new File(["fake"], metadata.name, { type: metadata.mimeType })] } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar evidencia" }));

    expect((await screen.findByRole("alert")).textContent).toMatch(/no se pudo preparar el cambio.*retiró/i);
    expect(screen.queryByRole("alert")?.textContent).not.toMatch(/permiso.*cambió/i);
    expect(evidenceMocks.removeStoredEvidence).toHaveBeenCalledWith([metadata.id]);
  });

  it("conserva los bytes si una excepción ocurre en una fase de commit desconocida", async () => {
    const initial = seed();
    const actor = initial.profiles.find((profile) => profile.id === "e0")!;
    initial.activeId = actor.id;
    const task = initial.tasks.find((row) => row.ownerId === actor.id && row.kind === "resultado" && row.status !== "Completada" && !row.responsibility)!;
    const metadata: TaskEvidence = {
      id: "precommit-failure", taskId: task.id, activityId: null, profileId: actor.id,
      name: "prueba.png", mimeType: "image/png", size: 4, sha256: "8".repeat(64), createdAt: new Date().toISOString(),
    };
    evidenceMocks.storeTaskEvidence.mockResolvedValue([metadata]);
    const observed: { persisted: State | null } = { persisted: null };
    const commitLatest = vi.fn((update: (current: State) => State | null) => {
      observed.persisted = update(initial);
      throw new Error("Fallo después de persistir");
    });
    render(<TaskEvidencePanel state={initial} task={task} actor={actor} commitLatest={commitLatest} notify={() => {}} canAdd />);
    fireEvent.click(screen.getByRole("button", { name: /Desplegar Evidencia del entregable/ }));
    fireEvent.change(screen.getByLabelText(/Adjuntar imagen o PDF/), {
      target: { files: [new File(["fake"], metadata.name, { type: metadata.mimeType })] },
    });
    fireEvent.click(screen.getByRole("button", { name: "Guardar evidencia" }));

    expect((await screen.findByRole("alert")).textContent).toMatch(/no se pudo determinar.*archivos se conservaron/i);
    expect(observed.persisted?.taskEvidence).toContainEqual(expect.objectContaining(metadata));
    expect(evidenceMocks.removeStoredEvidence).not.toHaveBeenCalled();
  });

  it("explica una compensación fallida y conserva el archivo como temporal recuperable", async () => {
    const initial = seed();
    const actor = initial.profiles.find((profile) => profile.id === "e0")!;
    initial.activeId = actor.id;
    const task = initial.tasks.find((row) => row.ownerId === actor.id && row.kind === "resultado" && row.status !== "Completada" && !row.responsibility)!;
    const metadata: TaskEvidence = {
      id: "failed-compensation", taskId: task.id, activityId: null, profileId: actor.id,
      name: "prueba.png", mimeType: "image/png", size: 4, sha256: "4".repeat(64), createdAt: new Date().toISOString(),
    };
    evidenceMocks.storeTaskEvidence.mockResolvedValue([metadata]);
    evidenceMocks.removeStoredEvidence.mockRejectedValueOnce(new Error("IndexedDB write failed"));
    const commitLatest = vi.fn(() => ({ status: "rejected" as const, reason: "storage" as const }));
    render(<TaskEvidencePanel state={initial} task={task} actor={actor} commitLatest={commitLatest} notify={() => {}} canAdd />);
    fireEvent.click(screen.getByRole("button", { name: /Desplegar Evidencia del entregable/ }));
    fireEvent.change(screen.getByLabelText(/Adjuntar imagen o PDF/), {
      target: { files: [new File(["fake"], metadata.name, { type: metadata.mimeType })] },
    });
    fireEvent.click(screen.getByRole("button", { name: "Guardar evidencia" }));

    expect((await screen.findByRole("alert")).textContent).toMatch(/ya no ocupa el cupo de adjuntos/i);
    expect(evidenceMocks.removeStoredEvidence).toHaveBeenCalledWith([metadata.id]);
    expect(evidenceMocks.reconcileEvidenceFromDurableState).toHaveBeenCalledTimes(1);
    expect(initial.taskEvidence || []).toHaveLength(0);
    expect(commitLatest).toHaveBeenCalledTimes(1);
  });

  it("conserva bytes vinculados si falla la notificación después del commit", async () => {
    const initial = seed();
    const actor = initial.profiles.find((profile) => profile.id === "e0")!;
    initial.activeId = actor.id;
    const task = initial.tasks.find((row) => row.ownerId === actor.id && row.kind === "resultado" && row.status !== "Completada" && !row.responsibility)!;
    const metadata: TaskEvidence = {
      id: "notify-after-commit", taskId: task.id, activityId: null, profileId: actor.id,
      name: "prueba.png", mimeType: "image/png", size: 4, sha256: "7".repeat(64), createdAt: new Date().toISOString(),
    };
    evidenceMocks.storeTaskEvidence.mockResolvedValue([metadata]);
    let latest: State = initial;
    const commitLatest = (update: (current: State) => State | null) => {
      const next = update(latest);
      if (!next) return { status: "rejected" as const };
      latest = next;
      return { status: "committed" as const };
    };
    const notify = vi.fn(() => { throw new Error("Fallo al mostrar confirmación"); });
    render(<TaskEvidencePanel state={initial} task={task} actor={actor} commitLatest={commitLatest} notify={notify} canAdd />);
    fireEvent.click(screen.getByRole("button", { name: /Desplegar Evidencia del entregable/ }));
    fireEvent.change(screen.getByLabelText(/Adjuntar imagen o PDF/), {
      target: { files: [new File(["fake"], metadata.name, { type: metadata.mimeType })] },
    });
    fireEvent.click(screen.getByRole("button", { name: "Guardar evidencia" }));

    expect((await screen.findByRole("alert")).textContent).toMatch(/quedó guardada/i);
    expect(latest.taskEvidence).toContainEqual(expect.objectContaining(metadata));
    expect(evidenceMocks.removeStoredEvidence).not.toHaveBeenCalled();
  });

  it("asocia a la finalización vigente la evidencia añadida después de completar el entregable", async () => {
    const initial = seed();
    const actor = initial.profiles.find((profile) => profile.id === "e0")!;
    initial.activeId = actor.id;
    const task = initial.tasks.find((row) => row.ownerId === actor.id && row.kind === "resultado" && row.status !== "Completada" && !row.responsibility)!;
    const completedAt = "2026-10-07T15:00:00.000Z";
    const completedTask = { ...task, status: "Completada" as const, completedAt };
    initial.tasks = initial.tasks.map((row) => row.id === task.id ? completedTask : row);
    const metadata: TaskEvidence = {
      id: "after-completion", taskId: task.id, activityId: null, profileId: actor.id,
      completionAt: completedAt, name: "comprobante.pdf", mimeType: "application/pdf", size: 4,
      sha256: "d".repeat(64), createdAt: new Date().toISOString(),
    };
    evidenceMocks.storeTaskEvidence.mockResolvedValue([metadata]);
    let latest: State = initial;
    const commitLatest = (update: (current: State) => State | null) => {
      const next = update(latest);
      if (!next) return { status: "rejected" as const };
      latest = next;
      return { status: "committed" as const };
    };
    render(<TaskEvidencePanel state={initial} task={completedTask} actor={actor} commitLatest={commitLatest} notify={() => {}} canAdd />);
    fireEvent.click(screen.getByRole("button", { name: /Desplegar Evidencia del entregable/ }));
    fireEvent.change(screen.getByLabelText(/Adjuntar imagen o PDF/), {
      target: { files: [new File(["fake"], "comprobante.pdf", { type: "application/pdf" })] },
    });
    fireEvent.click(screen.getByRole("button", { name: "Guardar evidencia" }));

    await waitFor(() => expect(evidenceMocks.storeTaskEvidence).toHaveBeenCalledWith(
      expect.any(Array),
      { taskId: task.id, activityId: null, profileId: actor.id, completionAt: completedAt },
      0,
    ));
    await waitFor(() => expect(latest.taskEvidence).toContainEqual(metadata));
  });

  it("borra el blob y no agrega referencias si cambia el actor mientras se guarda", async () => {
    const initial = seed();
    const actor = initial.profiles.find((profile) => profile.id === "e0")!;
    initial.activeId = actor.id;
    const task = initial.tasks.find((row) => row.ownerId === actor.id && row.kind === "resultado" && row.status !== "Completada" && !row.responsibility)!;
    const stored = deferred<TaskEvidence[]>();
    evidenceMocks.storeTaskEvidence.mockReturnValue(stored.promise);
    let latest: State = initial;
    const commitLatest = (update: (current: State) => State | null) => {
      const next = update(latest);
      if (!next) return { status: "rejected" as const };
      latest = next;
      return { status: "committed" as const };
    };
    render(<TaskEvidencePanel state={initial} task={task} actor={actor} commitLatest={commitLatest} notify={() => {}} canAdd />);
    fireEvent.click(screen.getByRole("button", { name: /Desplegar Evidencia del entregable/ }));
    fireEvent.change(screen.getByLabelText(/Adjuntar imagen o PDF/), {
      target: { files: [new File(["fake"], "prueba.png", { type: "image/png" })] },
    });
    fireEvent.click(screen.getByRole("button", { name: "Guardar evidencia" }));
    await waitFor(() => expect(evidenceMocks.storeTaskEvidence).toHaveBeenCalledTimes(1));

    latest = { ...latest, activeId: "boss" };
    const metadata: TaskEvidence = {
      id: "upload-race", taskId: task.id, activityId: null, profileId: actor.id,
      name: "prueba.png", mimeType: "image/png", size: 4, sha256: "a".repeat(64), createdAt: new Date().toISOString(),
    };
    stored.resolve([metadata]);

    expect((await screen.findByRole("alert")).textContent).toMatch(/cambió durante la carga/i);
    expect(latest.taskEvidence || []).toHaveLength(0);
    expect(latest.tasks.find((row) => row.id === task.id)?.evidenceIds || []).toHaveLength(0);
    expect(evidenceMocks.removeStoredEvidence).toHaveBeenCalledWith([metadata.id]);
  });

  it("mantiene visible el rechazo si el permiso desaparece durante la carga", async () => {
    const initial = seed();
    const actor = initial.profiles.find((profile) => profile.id === "e0")!;
    initial.activeId = actor.id;
    const task = initial.tasks.find((row) => row.ownerId === actor.id && row.kind === "resultado" && row.status !== "Completada" && !row.responsibility)!;
    const stored = deferred<TaskEvidence[]>();
    evidenceMocks.storeTaskEvidence.mockReturnValue(stored.promise);
    let latest: State = initial;
    const commitLatest = (update: (current: State) => State | null) => {
      const next = update(latest);
      if (!next) return { status: "rejected" as const };
      latest = next;
      return { status: "committed" as const };
    };
    const view = render(<TaskEvidencePanel state={initial} task={task} actor={actor} commitLatest={commitLatest} notify={() => {}} canAdd />);
    fireEvent.click(screen.getByRole("button", { name: /Desplegar Evidencia del entregable/ }));
    fireEvent.change(screen.getByLabelText(/Adjuntar imagen o PDF/), {
      target: { files: [new File(["fake"], "prueba.png", { type: "image/png" })] },
    });
    fireEvent.click(screen.getByRole("button", { name: "Guardar evidencia" }));
    await waitFor(() => expect(evidenceMocks.storeTaskEvidence).toHaveBeenCalledTimes(1));

    latest = { ...latest, activeId: "boss" };
    view.rerender(<TaskEvidencePanel state={latest} task={task} actor={actor} commitLatest={commitLatest} notify={() => {}} canAdd={false} />);
    const metadata: TaskEvidence = {
      id: "permission-revoked", taskId: task.id, activityId: null, profileId: actor.id,
      name: "prueba.png", mimeType: "image/png", size: 4, sha256: "e".repeat(64), createdAt: new Date().toISOString(),
    };
    stored.resolve([metadata]);

    expect((await screen.findByRole("alert")).textContent).toMatch(/cambió durante la carga/i);
    expect(screen.queryByLabelText(/Adjuntar imagen o PDF/)).toBeNull();
    expect(latest.taskEvidence || []).toHaveLength(0);
    expect(evidenceMocks.removeStoredEvidence).toHaveBeenCalledWith([metadata.id]);
  });

  it("notifica el rechazo si el panel se desmonta mientras termina una carga sin permiso", async () => {
    const initial = seed();
    const actor = initial.profiles.find((profile) => profile.id === "e0")!;
    initial.activeId = actor.id;
    const task = initial.tasks.find((row) => row.ownerId === actor.id && row.kind === "resultado" && row.status !== "Completada" && !row.responsibility)!;
    const stored = deferred<TaskEvidence[]>();
    const notify = vi.fn();
    evidenceMocks.storeTaskEvidence.mockReturnValue(stored.promise);
    let latest: State = initial;
    const commitLatest = (update: (current: State) => State | null) => {
      const next = update(latest);
      if (!next) return { status: "rejected" as const };
      latest = next;
      return { status: "committed" as const };
    };
    const view = render(<TaskEvidencePanel state={initial} task={task} actor={actor} commitLatest={commitLatest} notify={notify} canAdd />);
    fireEvent.click(screen.getByRole("button", { name: /Desplegar Evidencia del entregable/ }));
    fireEvent.change(screen.getByLabelText(/Adjuntar imagen o PDF/), {
      target: { files: [new File(["fake"], "prueba.png", { type: "image/png" })] },
    });
    fireEvent.click(screen.getByRole("button", { name: "Guardar evidencia" }));
    await waitFor(() => expect(evidenceMocks.storeTaskEvidence).toHaveBeenCalledTimes(1));

    latest = { ...latest, activeId: "boss" };
    view.unmount();
    const metadata: TaskEvidence = {
      id: "permission-revoked-unmounted", taskId: task.id, activityId: null, profileId: actor.id,
      name: "prueba.png", mimeType: "image/png", size: 4, sha256: "f".repeat(64), createdAt: new Date().toISOString(),
    };
    stored.resolve([metadata]);

    await waitFor(() => expect(notify).toHaveBeenCalledWith(expect.stringMatching(/cambió durante la carga/i)));
    expect(evidenceMocks.removeStoredEvidence).toHaveBeenCalledWith([metadata.id]);
    expect(latest.taskEvidence || []).toHaveLength(0);
  });

  it("vincula la evidencia a la finalización que ocurrió mientras se guardaba", async () => {
    const initial = seed();
    const actor = initial.profiles.find((profile) => profile.id === "e0")!;
    initial.activeId = actor.id;
    const task = initial.tasks.find((row) => row.ownerId === actor.id && row.kind === "resultado" && row.status !== "Completada" && !row.responsibility)!;
    const stored = deferred<TaskEvidence[]>();
    evidenceMocks.storeTaskEvidence.mockReturnValue(stored.promise);
    let latest: State = initial;
    const commitLatest = (update: (current: State) => State | null) => {
      const next = update(latest);
      if (!next) return { status: "rejected" as const };
      latest = next;
      return { status: "committed" as const };
    };
    render(<TaskEvidencePanel state={initial} task={task} actor={actor} commitLatest={commitLatest} notify={() => {}} canAdd />);
    fireEvent.click(screen.getByRole("button", { name: /Desplegar Evidencia del entregable/ }));
    fireEvent.change(screen.getByLabelText(/Adjuntar imagen o PDF/), {
      target: { files: [new File(["fake"], "comprobante.pdf", { type: "application/pdf" })] },
    });
    fireEvent.click(screen.getByRole("button", { name: "Guardar evidencia" }));
    await waitFor(() => expect(evidenceMocks.storeTaskEvidence).toHaveBeenCalledTimes(1));

    const completedAt = "2026-10-08T14:30:00.000Z";
    latest = { ...latest, tasks: latest.tasks.map((row) => row.id === task.id ? { ...row, status: "Completada", completedAt } : row) };
    const metadata: TaskEvidence = {
      id: "upload-during-completion", taskId: task.id, activityId: null, profileId: actor.id,
      completionAt: null, name: "comprobante.pdf", mimeType: "application/pdf", size: 4,
      sha256: "c".repeat(64), createdAt: new Date().toISOString(),
    };
    stored.resolve([metadata]);

    await waitFor(() => expect(latest.taskEvidence?.find((row) => row.id === metadata.id)?.completionAt).toBe(completedAt));
    expect(latest.tasks.find((row) => row.id === task.id)?.evidenceIds).toContain(metadata.id);
    expect(evidenceMocks.removeStoredEvidence).not.toHaveBeenCalled();
  });

  it("no confirma adjuntos si la empresa se cierra durante la carga", async () => {
    const initial = seed();
    const actor = initial.profiles.find((profile) => profile.id === "e0")!;
    initial.activeId = actor.id;
    const task = initial.tasks.find((row) => row.ownerId === actor.id && row.kind === "resultado" && row.status !== "Completada" && !row.responsibility)!;
    const stored = deferred<TaskEvidence[]>();
    evidenceMocks.storeTaskEvidence.mockReturnValue(stored.promise);
    let latest: State = initial;
    const commitLatest = (update: (current: State) => State | null) => {
      const next = update(latest);
      if (!next) return { status: "rejected" as const };
      latest = next;
      return { status: "committed" as const };
    };
    render(<TaskEvidencePanel state={initial} task={task} actor={actor} commitLatest={commitLatest} notify={() => {}} canAdd />);
    fireEvent.click(screen.getByRole("button", { name: /Desplegar Evidencia del entregable/ }));
    fireEvent.change(screen.getByLabelText(/Adjuntar imagen o PDF/), {
      target: { files: [new File(["fake"], "prueba.png", { type: "image/png" })] },
    });
    fireEvent.click(screen.getByRole("button", { name: "Guardar evidencia" }));
    await waitFor(() => expect(evidenceMocks.storeTaskEvidence).toHaveBeenCalledTimes(1));

    latest = {
      ...latest,
      companyClosures: [...(latest.companyClosures || []), {
        id: "closed-during-upload", ownerId: task.ownerId, companyId: task.companyId, month: task.month,
        at: new Date().toISOString(), by: "boss", note: "Cierre de prueba", metrics: {} as never,
        tasks: [task], activity: [], coveredActivity: [], schemaVersion: 1,
      }],
    };
    const metadata: TaskEvidence = {
      id: "upload-after-close", taskId: task.id, activityId: null, profileId: actor.id,
      name: "prueba.png", mimeType: "image/png", size: 4, sha256: "b".repeat(64), createdAt: new Date().toISOString(),
    };
    stored.resolve([metadata]);

    expect((await screen.findByRole("alert")).textContent).toMatch(/cambió durante la carga/i);
    expect(latest.taskEvidence || []).toHaveLength(0);
    expect(evidenceMocks.removeStoredEvidence).toHaveBeenCalledWith([metadata.id]);
  });

  it("no crea URLs de vista previa si la lectura termina después del desmontaje", async () => {
    const read = deferred<Blob | null>();
    evidenceMocks.readStoredEvidence.mockReturnValue(read.promise);
    const create = vi.fn(() => "blob:late-preview");
    const revoke = vi.fn();
    vi.stubGlobal("URL", { createObjectURL: create, revokeObjectURL: revoke });
    const record: TaskEvidence = { id: "late", taskId: "t1", activityId: null, profileId: "e0", name: "x.png", mimeType: "image/png", size: 1, sha256: "a".repeat(64), createdAt: "2026-10-01T00:00:00Z" };
    const view = render(<EvidenceLinks records={[record]} />);
    view.unmount();
    read.resolve(new Blob(["image"]));
    await waitFor(() => expect(evidenceMocks.readStoredEvidence).toHaveBeenCalledWith("late"));
    await Promise.resolve();
    expect(create).not.toHaveBeenCalled();
    expect(revoke).not.toHaveBeenCalled();
  });

  it("descarta lecturas anteriores cuando cambian las evidencias visibles", async () => {
    const oldRead = deferred<Blob | null>();
    const currentRead = deferred<Blob | null>();
    evidenceMocks.readStoredEvidence.mockImplementation((id: string) => id === "old" ? oldRead.promise : currentRead.promise);
    const create = vi.fn((blob: Blob) => blob.size === 3 ? "blob:old" : "blob:current");
    const revoke = vi.fn();
    vi.stubGlobal("URL", { createObjectURL: create, revokeObjectURL: revoke });
    const oldRecord: TaskEvidence = { id: "old", taskId: "t1", activityId: null, profileId: "e0", name: "old.png", mimeType: "image/png", size: 3, sha256: "a".repeat(64), createdAt: "2026-10-01T00:00:00Z" };
    const currentRecord: TaskEvidence = { ...oldRecord, id: "current", name: "current.png", size: 7 };
    const view = render(<EvidenceLinks records={[oldRecord]} />);
    view.rerender(<EvidenceLinks records={[currentRecord]} />);
    oldRead.resolve(new Blob(["old"]));
    currentRead.resolve(new Blob(["current"]));
    expect((await screen.findByRole("link", { name: /Abrir imagen/ })).getAttribute("href")).toBe("blob:current");
    expect(create).toHaveBeenCalledTimes(1);
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ size: 7 }));
  });
});
