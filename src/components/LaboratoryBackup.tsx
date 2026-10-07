import { useRef, useState, type ChangeEvent } from "react";
import { Archive, Download, Upload } from "lucide-react";
import type { State } from "../domain/model";
import {
  createLaboratoryBackup,
  inspectLaboratoryBackup,
  restoreLaboratoryBackup,
  type LaboratoryBackup as LaboratoryBackupData,
} from "../data/repository";
import { Dialog } from "./ui";

function dateStamp(date = new Date()) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

function readFile(file: File): Promise<string> {
  if (typeof file.text === "function") return file.text();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () =>
      typeof reader.result === "string"
        ? resolve(reader.result)
        : reject(new Error("No pudimos leer el archivo."));
    reader.onerror = () => reject(new Error("No pudimos leer el archivo."));
    reader.readAsText(file);
  });
}

export default function LaboratoryBackup({ state }: { state: State }) {
  const [open, setOpen] = useState(false);
  const [backup, setBackup] = useState<
    (LaboratoryBackupData & { fileName: string; contents: string }) | null
  >(null);
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState("");
  const input = useRef<HTMLInputElement>(null);

  function download() {
    setError("");
    try {
      const file = new Blob([createLaboratoryBackup(state)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(file);
      const link = document.createElement("a");
      link.href = url;
      link.download = `grupo-paris-laboratorio-${dateStamp()}.json`;
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      setError(
        "No pudimos crear la descarga. El laboratorio actual sigue intacto.",
      );
    }
  }

  async function selectBackup(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    setError("");
    setBackup(null);
    setConfirmed(false);
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      setError("El archivo supera el límite de 10 MB.");
      return;
    }
    try {
      const contents = await readFile(file);
      const inspected = inspectLaboratoryBackup(contents);
      setBackup({ ...inspected, fileName: file.name, contents });
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "No pudimos leer esta copia.",
      );
    }
  }

  function restore() {
    if (!backup || !confirmed) return;
    try {
      restoreLaboratoryBackup(backup.contents);
      location.reload();
    } catch {
      setError(
        "No se pudo guardar la copia. El estado actual del laboratorio se conserva.",
      );
    }
  }

  return (
    <>
      <button
        type="button"
        className="lab-backup-trigger"
        onClick={() => setOpen(true)}
      >
        <Archive size={15} aria-hidden="true" /> Copia del laboratorio
      </button>
      {open && (
        <Dialog
          title="Copia del laboratorio"
          onClose={() => setOpen(false)}
          className="lab-backup-dialog"
        >
          <p className="lab-backup-intro">
            Guardá o trasladá la simulación ficticia entre computadoras sin
            conectar cuentas ni servicios.
          </p>
          <div className="lab-backup-actions">
            <button type="button" onClick={download}>
              <Download size={15} aria-hidden="true" /> Descargar copia
            </button>
            <button type="button" onClick={() => input.current?.click()}>
              <Upload size={15} aria-hidden="true" /> Elegir copia para
              restaurar
            </button>
            <input
              ref={input}
              type="file"
              accept=".json,application/json"
              onChange={selectBackup}
              hidden
              aria-label="Elegir archivo de copia del laboratorio"
            />
          </div>
          <p className="lab-backup-note">
            El archivo puede incluir tareas, comentarios, notas y actividad de
            prueba. Guardalo en un lugar privado.
          </p>
          {error && (
            <p className="lab-backup-error" role="alert">
              {error}
            </p>
          )}
          {backup && (
            <section className="lab-backup-preview" aria-live="polite">
              <b>Copia válida: {backup.fileName}</b>
              <p>
                {backup.counts.profiles} perfiles · {backup.counts.companies}{" "}
                empresas · {backup.counts.tasks} tareas · {backup.counts.notes}{" "}
                notas/comentarios
              </p>
              <label>
                <input
                  type="checkbox"
                  checked={confirmed}
                  onChange={(event) => setConfirmed(event.target.checked)}
                />
                Reemplazar la simulación guardada en este navegador por esta
                copia.
              </label>
              <button
                type="button"
                className="danger"
                disabled={!confirmed}
                onClick={restore}
              >
                Restaurar y recargar
              </button>
            </section>
          )}
          <p className="lab-backup-boundary">
            Restaurar sólo reemplaza la simulación local de este navegador. No
            modifica el tablero operativo, el sitio publicado, Git ni servicios
            externos.
          </p>
        </Dialog>
      )}
    </>
  );
}
