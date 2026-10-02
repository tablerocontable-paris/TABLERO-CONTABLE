// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import Annotations from "../src/components/Annotations";
import { seed } from "../src/data/repository";
import type { Annotation } from "../src/domain/model";

afterEach(cleanup);
const note: Annotation = {
  id: "n1",
  ownerId: "employee",
  title: "Conciliación",
  content: "=BUSCARX(A2;Tabla[Clave];Tabla[Saldo])",
  kind: "formula",
  reminderOn: null,
  createdAt: "2026-10-01T00:00:00Z",
  updatedAt: "2026-10-01T00:00:00Z",
  convertedTaskId: null,
};

describe("anotaciones personales", () => {
  it("guarda contenido, tipo y recordatorio mediante el formulario", () => {
    const onSave = vi.fn();
    render(
      <Annotations
        rows={[]}
        tasks={[]}
        onSave={onSave}
        onDelete={vi.fn()}
        onConvert={vi.fn()}
        onOpenTask={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Nueva anotación" }));
    fireEvent.change(
      screen.getByLabelText("Título"),
      { target: { value: "Cierre" } },
    );
    fireEvent.change(
      screen.getByPlaceholderText(
        "Guardá la fórmula, el criterio o el detalle que quieras recordar…",
      ),
      { target: { value: "Controlar saldos" } },
    );
    fireEvent.change(screen.getByLabelText("Tipo"), {
      target: { value: "Recordatorio" },
    });
    fireEvent.change(screen.getByLabelText("Recordarme el"), {
      target: { value: "2026-10-30" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Guardar anotación" }));
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "",
        title: "Cierre",
        content: "Controlar saldos",
        kind: "reminder",
        reminderOn: "2026-10-30",
      }),
    );
  });

  it("filtra por tipo y permite convertir la anotación sin perder su texto", () => {
    const onConvert = vi.fn();
    render(
      <Annotations
        rows={[note]}
        tasks={[]}
        onSave={vi.fn()}
        onDelete={vi.fn()}
        onConvert={onConvert}
        onOpenTask={vi.fn()}
      />,
    );
    fireEvent.change(screen.getByLabelText("Filtrar tipo de anotación"), {
      target: { value: "Recordatorio" },
    });
    expect(
      screen.getByText("No hay resultados con estos filtros."),
    ).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Filtrar tipo de anotación"), {
      target: { value: "Fórmula de Excel" },
    });
    expect(screen.getByText(note.content)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Convertir en tarea" }));
    expect(onConvert).toHaveBeenCalledWith(note);
    expect(seed().tasks.length).toBeGreaterThan(0);
  });

  it("conserva el vínculo y permite abrir la tarea sin ofrecer una segunda conversión", () => {
    const linked = { ...note, convertedTaskId: "task-linked" };
    const task = {
      ...seed().tasks[0],
      id: "task-linked",
      title: "Conciliación",
    };
    const onOpenTask = vi.fn();
    render(
      <Annotations
        rows={[linked]}
        tasks={[task]}
        onSave={vi.fn()}
        onDelete={vi.fn()}
        onConvert={vi.fn()}
        onOpenTask={onOpenTask}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /Tarea creada/ }));
    expect(onOpenTask).toHaveBeenCalledWith("task-linked");
    expect(
      screen.queryByRole("button", { name: "Convertir en tarea" }),
    ).toBeNull();
  });
});
