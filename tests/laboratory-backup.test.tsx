// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import {
  createLaboratoryBackup,
  inspectLaboratoryBackup,
  KEY,
  restoreLaboratoryBackup,
  seed,
} from "../src/data/repository";
import LaboratoryBackup from "../src/components/LaboratoryBackup";

beforeEach(() => {
  localStorage.clear();
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute("open");
  };
});

afterEach(() => cleanup());

describe("respaldo local del laboratorio", () => {
  it("serializes a versioned copy and validates its contents and preview counts", () => {
    const state = seed();
    state.activeId = "e0";
    state.annotations = [
      {
        id: "note-1",
        ownerId: "e0",
        title: "Prueba",
        content: "Dato ficticio",
        kind: "personal",
        reminderOn: null,
        createdAt: "2026-10-07T12:00:00.000Z",
        updatedAt: "2026-10-07T12:00:00.000Z",
        convertedTaskId: null,
      },
    ];
    const stateWithFutureField = Object.assign(state, {
      compatibleFutureField: "preserved",
    });
    const copy = createLaboratoryBackup(
      stateWithFutureField,
      "2026-10-07T12:00:00.000Z",
    );
    const inspected = inspectLaboratoryBackup(copy);

    expect(JSON.parse(copy).format).toBe("grupo-paris-lab-backup");
    expect(inspected.createdAt).toBe("2026-10-07T12:00:00.000Z");
    expect(inspected.state.activeId).toBe("e0");
    expect(inspected.state.annotations?.[0].content).toBe("Dato ficticio");
    expect(
      (inspected.state as typeof stateWithFutureField).compatibleFutureField,
    ).toBe("preserved");
    expect(inspected.counts).toEqual({
      companies: 4,
      profiles: 13,
      tasks: state.tasks.length,
      notes: 1,
    });
  });

  it("restores only the isolated lab key and leaves the operational board untouched", () => {
    const state = seed();
    state.profiles[0].name = "Jefatura de prueba restaurada";
    localStorage.setItem(KEY, "operational-board-must-not-change");

    const restored = restoreLaboratoryBackup(createLaboratoryBackup(state));

    expect(restored.state.profiles[0].name).toBe(
      "Jefatura de prueba restaurada",
    );
    expect(
      JSON.parse(localStorage.getItem("paris-state-lab")!).profiles[0].name,
    ).toBe("Jefatura de prueba restaurada");
    expect(localStorage.getItem(KEY)).toBe("operational-board-must-not-change");
    expect(localStorage.getItem("paris-environment")).toBeNull();
  });

  it("rejects invalid files before replacing any browser data", () => {
    localStorage.setItem("paris-state-lab", "existing-lab-copy");
    localStorage.setItem(KEY, "operational-board");
    const invalid = JSON.stringify({
      format: "grupo-paris-lab-backup",
      formatVersion: 1,
      createdAt: "today",
      state: { version: 99 },
    });

    expect(() => restoreLaboratoryBackup(invalid)).toThrow(/copia compatible/);
    const missingActor = seed();
    missingActor.activeId = "profile-missing";
    expect(() =>
      restoreLaboratoryBackup(createLaboratoryBackup(missingActor)),
    ).toThrow(/perfil activo válido/);
    expect(localStorage.getItem("paris-state-lab")).toBe("existing-lab-copy");
    expect(localStorage.getItem(KEY)).toBe("operational-board");
  });

  it("requires a checkbox after inspecting a copy before offering restoration", async () => {
    const state = seed();
    render(<LaboratoryBackup state={state} />);
    fireEvent.click(
      screen.getByRole("button", { name: /copia del laboratorio/i }),
    );
    const file = new File([createLaboratoryBackup(state)], "copia.json", {
      type: "application/json",
    });
    fireEvent.change(
      screen.getByLabelText("Elegir archivo de copia del laboratorio"),
      { target: { files: [file] } },
    );

    expect(await screen.findByText(/Copia válida: copia.json/)).toBeTruthy();
    const restore = screen.getByRole("button", {
      name: "Restaurar y recargar",
    }) as HTMLButtonElement;
    expect(restore.disabled).toBe(true);
    fireEvent.click(screen.getByRole("checkbox"));
    expect(restore.disabled).toBe(false);
    expect(screen.getByText(/No modifica el tablero operativo/)).toBeTruthy();
  });
});
