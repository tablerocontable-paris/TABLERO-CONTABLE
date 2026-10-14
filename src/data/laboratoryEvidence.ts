import type { State } from "../domain/model";
import type { TaskEvidence } from "../domain/laboratory-work";

const DATABASE = "grupo-paris-laboratory-evidence-v1";
const STORE = "files";
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_PDF_BYTES = 10 * 1024 * 1024;
const MAX_FILES_PER_RECORD = 3;
const recordKeyFor = (taskId: string, activityId: string | null) => `${taskId}\u001f${activityId || "task"}`;
const EVIDENCE_MUTATION_LOCK = "grupo-paris-laboratory-evidence-mutation-v1";
let localEvidenceQueue = Promise.resolve();

/** Hold this lock across the full blob + state commit/restore sequence, not just the IndexedDB write. */
export async function acquireEvidenceMutationLock(): Promise<() => void> {
  const locks = typeof navigator !== "undefined" ? navigator.locks : undefined;
  if (locks?.request) {
    let acquired!: () => void;
    let rejectAcquired!: (reason: unknown) => void;
    let release!: () => void;
    let didAcquire = false;
    const acquiredPromise = new Promise<void>((resolve, reject) => { acquired = resolve; rejectAcquired = reject; });
    const releasePromise = new Promise<void>((resolve) => { release = resolve; });
    let request: Promise<unknown>;
    try {
      request = locks.request(EVIDENCE_MUTATION_LOCK, { mode: "exclusive" }, async () => {
        didAcquire = true;
        acquired();
        await releasePromise;
      });
    } catch (error) {
      rejectAcquired(error);
      await acquiredPromise;
      throw error;
    }
    void request.catch((error) => { if (!didAcquire) rejectAcquired(error); });
    await acquiredPromise;
    return () => { release(); void request.catch(() => undefined); };
  }

  const previous = localEvidenceQueue;
  let release!: () => void;
  localEvidenceQueue = new Promise<void>((resolve) => { release = resolve; });
  await previous;
  return release;
}

interface StoredEvidence {
  id: string;
  name: string;
  blob: Blob;
  mimeType: TaskEvidence["mimeType"];
  size: number;
  sha256: string;
  recordKey?: string;
}

export interface EvidenceBundleFile {
  id: string;
  taskId?: string;
  activityId?: string | null;
  name: string;
  mimeType: TaskEvidence["mimeType"];
  size: number;
  sha256: string;
  contents: string;
}

function openDatabase(): Promise<IDBDatabase> {
  if (typeof indexedDB === "undefined") return Promise.reject(new Error("Este navegador no permite guardar evidencia local del laboratorio."));
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE, 2);
    request.onupgradeneeded = () => {
      const store = request.result.objectStoreNames.contains(STORE)
        ? request.transaction!.objectStore(STORE)
        : request.result.createObjectStore(STORE, { keyPath: "id" });
      if (!store.indexNames.contains("recordKey")) store.createIndex("recordKey", "recordKey", { unique: false });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("No se pudo abrir el almacenamiento de evidencia."));
  });
}

function transactionDone(transaction: IDBTransaction) {
  return new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onabort = transaction.onerror = () => reject(transaction.error || new Error("No se pudo guardar la evidencia."));
  });
}

async function fileType(file: File): Promise<TaskEvidence["mimeType"]> {
  const bytes = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  const detected = detectedFileType(bytes);
  if (detected) return detected;
  throw new Error(`${file.name}: el contenido no es una imagen admitida ni un PDF válido.`);
}

function detectedFileType(bytes: Uint8Array): TaskEvidence["mimeType"] | null {
  const ascii = (from: number, length: number) => String.fromCharCode(...bytes.slice(from, from + length));
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if ([137, 80, 78, 71, 13, 10, 26, 10].every((value, index) => bytes[index] === value)) return "image/png";
  if (ascii(0, 4) === "RIFF" && ascii(8, 4) === "WEBP") return "image/webp";
  if (ascii(0, 5) === "%PDF-") return "application/pdf";
  return null;
}

async function optimizeImage(file: File, mimeType: TaskEvidence["mimeType"]): Promise<File> {
  if (mimeType === "application/pdf" || typeof createImageBitmap !== "function" || typeof document === "undefined") return file;
  let bitmap: ImageBitmap | undefined;
  try {
    bitmap = await createImageBitmap(file);
    const maxDimension = 2400;
    const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext("2d");
    if (!context) return file;
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const compressed = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", 0.9));
    if (!compressed || compressed.size > MAX_IMAGE_BYTES || compressed.size >= file.size) return file;
    const base = file.name.replace(/\.[^.]+$/, "") || "evidencia";
    return new File([compressed], `${base}.webp`, { type: "image/webp", lastModified: file.lastModified });
  } catch {
    return file;
  } finally {
    bitmap?.close();
  }
}

async function sha256(blob: Blob) {
  if (!globalThis.crypto?.subtle) throw new Error("No está disponible la verificación de integridad de archivos en este navegador.");
  const digest = await crypto.subtle.digest("SHA-256", await blob.arrayBuffer());
  return [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, "0")).join("");
}

export async function storeTaskEvidence(files: File[], context: Pick<TaskEvidence, "taskId" | "activityId" | "profileId" | "completionAt">, existingCount: number, createdAt = new Date().toISOString()): Promise<TaskEvidence[]> {
  if (!files.length) return [];
  if (files.length + existingCount > MAX_FILES_PER_RECORD) throw new Error(`Se admiten hasta ${MAX_FILES_PER_RECORD} archivos por tarea o movimiento.`);
  const processed: Array<{ file: File; mimeType: TaskEvidence["mimeType"] }> = [];
  for (const file of files) {
    const mimeType = await fileType(file);
    const limit = mimeType === "application/pdf" ? MAX_PDF_BYTES : MAX_IMAGE_BYTES;
    if (file.size <= 0 || file.size > limit) throw new Error(`${file.name}: el máximo es ${mimeType === "application/pdf" ? "10 MB para PDF" : "5 MB para imágenes"}.`);
    const optimized = await optimizeImage(file, mimeType);
    const finalMime = optimized.type === "image/webp" ? "image/webp" : mimeType;
    if (optimized.size > (finalMime === "application/pdf" ? MAX_PDF_BYTES : MAX_IMAGE_BYTES)) throw new Error(`${file.name}: supera el límite después de optimizar.`);
    const normalized = optimized.type === finalMime ? optimized : new File([optimized], optimized.name, { type: finalMime, lastModified: optimized.lastModified });
    processed.push({ file: normalized, mimeType: finalMime });
  }

  const records = await Promise.all(processed.map(async ({ file, mimeType }) => {
    const fileId = crypto.randomUUID();
    const digest = await sha256(file);
    return {
      row: { id: fileId, taskId: context.taskId, activityId: context.activityId, profileId: context.profileId, completionAt: context.completionAt ?? null, name: file.name.slice(0, 240), mimeType, size: file.size, sha256: digest, createdAt } satisfies TaskEvidence,
      blob: { id: fileId, name: file.name, blob: file, mimeType, size: file.size, sha256: digest, recordKey: recordKeyFor(context.taskId, context.activityId) } satisfies StoredEvidence,
    };
  }));
  const database = await openDatabase();
  try {
    const transaction = database.transaction(STORE, "readwrite");
    const done = transactionDone(transaction);
    let exceedsLimit = false;
    let writeError: unknown;
    const store = transaction.objectStore(STORE);
    const count = store.index("recordKey").count(recordKeyFor(context.taskId, context.activityId));
    count.onerror = () => transaction.abort();
    count.onsuccess = () => {
      const persistedCount = count.result;
      if (Math.max(existingCount, persistedCount) + records.length > MAX_FILES_PER_RECORD) {
        exceedsLimit = true;
        transaction.abort();
        return;
      }
      try { for (const record of records) store.add(record.blob); }
      catch (error) { writeError = error; transaction.abort(); }
    };
    try { await done; }
    catch (error) {
      if (exceedsLimit) throw new Error(`Se admiten hasta ${MAX_FILES_PER_RECORD} archivos por tarea o movimiento.`);
      if (writeError instanceof Error) throw writeError;
      throw error;
    }
    return records.map((record) => record.row);
  } catch (error) {
    throw error instanceof Error ? error : new Error("No pudimos guardar los archivos en el laboratorio.");
  } finally {
    database.close();
  }
}

export async function removeStoredEvidence(evidenceIds: string[]) {
  if (!evidenceIds.length || typeof indexedDB === "undefined") return;
  const database = await openDatabase();
  try {
    const transaction = database.transaction(STORE, "readwrite");
    const done = transactionDone(transaction);
    const store = transaction.objectStore(STORE);
    for (const evidenceId of evidenceIds) store.delete(evidenceId);
    await done;
  } finally { database.close(); }
}

export async function readStoredEvidence(evidenceId: string): Promise<Blob | null> {
  const database = await openDatabase();
  try {
    const transaction = database.transaction(STORE, "readonly");
    const result = await new Promise<StoredEvidence | undefined>((resolve, reject) => {
      const request = transaction.objectStore(STORE).get(evidenceId);
      request.onsuccess = () => resolve(request.result as StoredEvidence | undefined);
      request.onerror = () => reject(request.error);
    });
    return result?.blob || null;
  } finally { database.close(); }
}

/** Reconcile only the quota index after a restored state is durable; orphaned bytes remain recoverable. */
export async function reconcileEvidenceRecordKeys(state: State) {
  const expected = new Map<string, string>();
  for (const evidence of state.taskEvidence || []) {
    if (expected.has(evidence.id)) throw new Error(`La evidencia ${evidence.id} aparece más de una vez en el estado.`);
    expected.set(evidence.id, recordKeyFor(evidence.taskId, evidence.activityId));
  }
  if (typeof indexedDB === "undefined" && expected.size === 0) return;
  const database = await openDatabase();
  try {
    const transaction = database.transaction(STORE, "readwrite");
    const done = transactionDone(transaction);
    const store = transaction.objectStore(STORE);
    const request = store.getAll();
    request.onerror = () => transaction.abort();
    request.onsuccess = () => {
      const records = request.result as StoredEvidence[];
      const found = new Set<string>();
      for (const record of records) {
        const wanted = expected.get(record.id);
        if (!wanted) continue;
        if (record.recordKey && record.recordKey !== wanted) {
          transaction.abort();
          return;
        }
        if (record.size !== record.blob.size || record.size !== state.taskEvidence?.find((row) => row.id === record.id)?.size ||
          record.sha256 !== state.taskEvidence?.find((row) => row.id === record.id)?.sha256 || record.mimeType !== state.taskEvidence?.find((row) => row.id === record.id)?.mimeType) {
          transaction.abort();
          return;
        }
        record.recordKey = wanted;
        store.put(record);
        found.add(record.id);
      }
      if (found.size !== expected.size) { transaction.abort(); return; }
      for (const record of records) if (!expected.has(record.id) && record.recordKey) {
        delete record.recordKey;
        store.put(record);
      }
    };
    try { await done; }
    catch { throw new Error("No se pudo reconciliar el índice local de evidencia; los archivos y la copia anterior se conservaron."); }
  } finally { database.close(); }
}

function readDurableLaboratoryState(): State | null {
  const raw = localStorage.getItem("paris-state-lab");
  if (raw === null) return null;
  const parsed = JSON.parse(raw) as State;
  if (!parsed || (parsed.taskEvidence !== undefined && !Array.isArray(parsed.taskEvidence))) throw new Error("No se pudo verificar el estado durable del laboratorio.");
  parsed.taskEvidence ||= [];
  return parsed;
}

/** Reconcile against the actual persisted references; callers first compare normalized state. */
export async function reconcileEvidenceAgainstDurableState(expected: State): Promise<boolean> {
  const durable = readDurableLaboratoryState();
  await reconcileEvidenceRecordKeys(durable || expected);
  return true;
}

/** Cleanup recovery must use confirmed durable references, never the previous React snapshot. */
export async function reconcileEvidenceFromDurableState(): Promise<void> {
  const durable = readDurableLaboratoryState();
  await reconcileEvidenceRecordKeys(durable || { taskEvidence: [] } as unknown as State);
}

function toBase64(bytes: Uint8Array) {
  let binary = "";
  for (let start = 0; start < bytes.length; start += 0x8000)
    binary += String.fromCharCode(...bytes.subarray(start, Math.min(start + 0x8000, bytes.length)));
  return btoa(binary);
}

function fromBase64(contents: string) {
  let binary: string;
  try { binary = atob(contents); } catch { throw new Error("La copia incluye un archivo con contenido Base64 inválido."); }
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

export async function createEvidenceBundle(state: State): Promise<EvidenceBundleFile[]> {
  if (!(state.taskEvidence || []).length) return [];
  const database = await openDatabase();
  try {
    const output: EvidenceBundleFile[] = [];
    for (const metadata of state.taskEvidence || []) {
      const transaction = database.transaction(STORE, "readonly");
      const file = await new Promise<StoredEvidence | undefined>((resolve, reject) => {
        const request = transaction.objectStore(STORE).get(metadata.id);
        request.onsuccess = () => resolve(request.result as StoredEvidence | undefined);
        request.onerror = () => reject(request.error);
      });
      if (!file || file.size !== metadata.size || file.sha256 !== metadata.sha256 || file.mimeType !== metadata.mimeType)
        throw new Error(`No se encontró una copia íntegra de “${metadata.name}”. La copia de seguridad no se generó.`);
      const bytes = new Uint8Array(await file.blob.arrayBuffer());
      if (await sha256(file.blob) !== metadata.sha256) throw new Error(`La huella de “${metadata.name}” no coincide; revisá el almacenamiento local.`);
      output.push({ id: file.id, taskId: metadata.taskId, activityId: metadata.activityId, name: metadata.name, mimeType: file.mimeType, size: file.size, sha256: file.sha256, contents: toBase64(bytes) });
    }
    return output;
  } finally { database.close(); }
}

export async function restoreEvidenceBundle(files: EvidenceBundleFile[]): Promise<string[]> {
  if (!files.length) return [];
  const records: StoredEvidence[] = [];
  const seenIds = new Set<string>();
  for (const file of files) {
    if (!file.id || seenIds.has(file.id) || !file.name?.trim() || file.name.length > 240 ||
      !["image/jpeg", "image/png", "image/webp", "application/pdf"].includes(file.mimeType) ||
      !/^[a-f0-9]{64}$/.test(file.sha256))
      throw new Error(`La evidencia “${file.id || "sin ID"}” tiene metadatos inválidos o repetidos.`);
    seenIds.add(file.id);
    const bytes = fromBase64(file.contents);
    const limit = file.mimeType === "application/pdf" ? MAX_PDF_BYTES : MAX_IMAGE_BYTES;
    if (!file.id || !Number.isInteger(file.size) || bytes.length !== file.size || bytes.length <= 0 || bytes.length > limit)
      throw new Error(`La evidencia “${file.id || "sin ID"}” tiene tamaño o tipo inválido.`);
    if (detectedFileType(bytes.subarray(0, 16)) !== file.mimeType)
      throw new Error(`El contenido de “${file.name}” no coincide con el tipo de archivo declarado.`);
    const blob = new Blob([bytes], { type: file.mimeType });
    if (await sha256(blob) !== file.sha256) throw new Error(`La huella de “${file.id}” no coincide.`);
    records.push({ id: file.id, name: file.name, blob, mimeType: file.mimeType, size: file.size, sha256: file.sha256, ...(file.taskId && file.activityId !== undefined ? { recordKey: recordKeyFor(file.taskId, file.activityId) } : {}) });
  }
  const database = await openDatabase();
  try {
    // Check ID collisions before writing. A matching digest alone is not enough:
    // the blob and declared MIME/size must also agree with the backup metadata.
    const existingFiles = await Promise.all(records.map(async (record) => {
      const transaction = database.transaction(STORE, "readonly");
      return await new Promise<StoredEvidence | undefined>((resolve, reject) => {
        const request = transaction.objectStore(STORE).get(record.id);
        request.onsuccess = () => resolve(request.result as StoredEvidence | undefined);
        request.onerror = () => reject(request.error || new Error("No se pudo revisar la evidencia local."));
      });
    }));
    for (let index = 0; index < records.length; index++) {
      const record = records[index]!;
      const existing = existingFiles[index];
      if (!existing) continue;
      if (existing.sha256 !== record.sha256 || existing.size !== record.size || existing.mimeType !== record.mimeType ||
        existing.blob.size !== record.size || await sha256(existing.blob) !== record.sha256)
        throw new Error(`El identificador de “${record.name}” ya existe con contenido distinto o dañado.`);
    }
    const transaction = database.transaction(STORE, "readwrite");
    const store = transaction.objectStore(STORE);
    const done = transactionDone(transaction);
    const added: string[] = [];
    let remaining = records.length;
    for (const record of records) {
      const request = store.get(record.id);
      request.onerror = () => transaction.abort();
      request.onsuccess = () => {
        const existing = request.result as StoredEvidence | undefined;
        if (existing && (existing.sha256 !== record.sha256 || existing.size !== record.size || existing.mimeType !== record.mimeType)) {
          transaction.abort();
          return;
        }
        if (!existing) {
          store.add(record);
          added.push(record.id);
        }
        remaining--;
      };
    }
    await done;
    return added;
  } finally { database.close(); }
}
