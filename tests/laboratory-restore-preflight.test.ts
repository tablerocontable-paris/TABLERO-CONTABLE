// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";
import { seed, restoreLaboratoryBackupWithEvidence } from "../src/data/repository";

const evidenceMocks = vi.hoisted(() => ({
  acquire: vi.fn(async () => vi.fn()),
  restore: vi.fn(async () => ["preflight-file"]),
}));
vi.mock("../src/data/laboratoryEvidence", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../src/data/laboratoryEvidence")>()),
  acquireEvidenceMutationLock: evidenceMocks.acquire,
  restoreEvidenceBundle: evidenceMocks.restore,
}));

beforeEach(() => {
  localStorage.clear();
  evidenceMocks.acquire.mockClear();
  evidenceMocks.restore.mockClear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

function backupWithEvidence() {
  const state = seed();
  const task = state.tasks.find((row) => row.kind === "resultado" && !row.responsibility)!;
  const bytes = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const fileId = "preflight-file";
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  state.tasks = state.tasks.map((row) => row.id === task.id ? { ...row, evidenceIds: [fileId] } : row);
  state.taskEvidence = [{
    id: fileId, taskId: task.id, activityId: null, profileId: task.ownerId,
    name: "respaldo.png", mimeType: "image/png", size: bytes.length, sha256,
    createdAt: "2026-10-13T12:00:00.000Z",
  }];
  return JSON.stringify({
    format: "grupo-paris-lab-backup", formatVersion: 2,
    createdAt: "2026-10-13T12:00:00.000Z", state,
    files: [{
      id: fileId, taskId: task.id, activityId: null, name: "respaldo.png",
      mimeType: "image/png", size: bytes.length, sha256, contents: bytes.toString("base64"),
    }],
  });
}

describe("preflight de restauración con evidencia", () => {
  it("no empieza a escribir archivos si no puede leer el estado local previo", async () => {
    localStorage.setItem("paris-state-lab", "copia-anterior");
    const release = vi.fn();
    evidenceMocks.acquire.mockResolvedValue(release);
    const originalGetItem = Storage.prototype.getItem;
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(function (this: Storage, key) {
      if (key === "paris-state-lab") throw new DOMException("storage blocked", "SecurityError");
      return originalGetItem.call(this, key);
    });
    const setItem = vi.spyOn(Storage.prototype, "setItem");

    await expect(restoreLaboratoryBackupWithEvidence(backupWithEvidence()))
      .rejects.toThrow("No se pudo leer la copia actual del laboratorio; no se modificó nada.");

    expect(evidenceMocks.restore).not.toHaveBeenCalled();
    expect(setItem).not.toHaveBeenCalled();
    expect(evidenceMocks.acquire).toHaveBeenCalledTimes(1);
    expect(release).toHaveBeenCalledTimes(1);
  });
});
