// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import ProcessQuality from "../src/components/ProcessQuality";
import { seed } from "../src/data/repository";
import {
  createFiveSReview,
  createKaizenProposal,
  FIVE_S_AREAS,
  reviewKaizenProposal,
  type KaizenInput,
} from "../src/domain/processImprovement";

beforeEach(() => {
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute("open", ""); };
  HTMLDialogElement.prototype.close = function () { this.removeAttribute("open"); };
});
afterEach(() => cleanup());

it("retira tarjetas y formularios de calidad al revocar empresa con el módulo abierto", () => {
  const base = seed();
  const owner = base.profiles.find((profile) => profile.id === "e0")!;
  const manager = base.profiles.find((profile) => profile.id === "m1")!;
  const input: KaizenInput = {
    templateId: "cat1", companyId: "c1", problemObserved: "Diferencias de conciliación de prueba",
    baselineValue: 24, objectiveValue: 12, unit: "minutos", direction: "lower",
    baselineEvidence: "Muestra de prueba de diez casos.", baselineContext: "Octubre · diez casos equivalentes.",
    proposedChange: "Validar el extracto antes de conciliar.", responsibleId: "e0",
    trialFrom: "2026-10-01", trialThrough: "2026-10-31",
  };
  const proposal = createKaizenProposal(base, owner, input, "2026-10-06T10:00:00.000Z", () => "proposal-ui-scope");
  const testing = reviewKaizenProposal({ ...base, improvementProposals: [proposal] }, manager, proposal.id, "test", "Prueba acotada.", "2026-10-06T11:00:00.000Z");
  const review = createFiveSReview(testing, owner, {
    companyId: "c1", templateId: "", scopeTitle: "Orden de documentación de prueba", reviewedOn: "2026-10-06",
    items: FIVE_S_AREAS.map((area) => ({
      id: area.id, result: "hallazgo", evidence: `Evidencia ${area.id}`,
      finding: `Hallazgo ${area.id}`, action: `Acción ${area.id}`, responsibleId: "e0", dueOn: "2026-10-20",
    })),
  }, "2026-10-06T12:00:00.000Z", () => "review-ui-scope");
  expect(review.scopeTitle).toBe("Orden de documentación de prueba");
  const state = { ...testing, fiveSReviews: [review] };
  const commit = vi.fn(() => true);
  const notify = vi.fn();
  const view = render(<ProcessQuality state={state} actor={manager} commit={commit} notify={notify} />);

  fireEvent.click(screen.getByRole("button", { name: "Desplegar Mejorar un proceso con evidencia" }));
  expect(screen.getByText("Diferencias de conciliación de prueba")).toBeTruthy();
  expect(screen.getByRole("button", { name: "Guardar medición" })).toBeTruthy();
  fireEvent.click(screen.getByRole("tab", { name: /Revisiones 5S/ }));
  fireEvent.click(screen.getByRole("button", { name: "Desplegar Orden y documentación de trabajo" }));
  expect(screen.getByText(/Orden de documentación de prueba/)).toBeTruthy();
  fireEvent.click(screen.getAllByRole("button", { name: "Registrar verificación" })[0]!);
  expect(screen.getByRole("button", { name: /Cerrar acción/ })).toBeTruthy();

  const revokedManager = { ...manager, companyIds: manager.companyIds.filter((companyId) => companyId !== "c1") };
  const revoked = { ...state, profiles: state.profiles.map((profile) => profile.id === manager.id ? revokedManager : profile) };
  view.rerender(<ProcessQuality state={revoked} actor={revokedManager} commit={commit} notify={notify} />);

  expect(screen.queryByText(/Orden de documentación de prueba/)).toBeNull();
  expect(screen.queryByRole("button", { name: /Cerrar acción/ })).toBeNull();
  fireEvent.click(screen.getByRole("tab", { name: /Mejora Kaizen/ }));
  expect(screen.queryByText("Diferencias de conciliación de prueba")).toBeNull();
  expect(screen.queryByRole("button", { name: "Guardar medición" })).toBeNull();
  expect(commit).not.toHaveBeenCalled();
});

it("conserva la evidencia 5S y permite reintentar si el guardado falla", () => {
  const base = seed();
  const owner = base.profiles.find((profile) => profile.id === "e0")!;
  const review = createFiveSReview(base, owner, {
    companyId: "c1", templateId: "", scopeTitle: "Revisión para reintento", reviewedOn: "2026-10-06",
    items: FIVE_S_AREAS.map((area) => ({
      id: area.id, result: "hallazgo", evidence: `Evidencia ${area.id}`,
      finding: `Hallazgo ${area.id}`, action: `Acción ${area.id}`, responsibleId: owner.id, dueOn: "2026-10-20",
    })),
  }, "2026-10-06T12:00:00.000Z", () => "review-retry-ui");
  const state = { ...base, fiveSReviews: [review] };
  const commit = vi.fn(() => false);
  const notify = vi.fn();
  render(<ProcessQuality state={state} actor={owner} commit={commit} notify={notify} />);

  fireEvent.click(screen.getByRole("tab", { name: /Revisiones 5S/ }));
  fireEvent.click(screen.getByRole("button", { name: "Desplegar Orden y documentación de trabajo" }));
  fireEvent.click(screen.getAllByRole("button", { name: "Registrar verificación" })[0]!);
  const evidence = screen.getByLabelText("Evidencia de corrección") as HTMLTextAreaElement;
  fireEvent.change(evidence, { target: { value: "Verifiqué la corrección en el laboratorio." } });
  fireEvent.click(screen.getByRole("button", { name: /Cerrar acción/ }));

  expect(commit).toHaveBeenCalledTimes(1);
  expect(screen.getByLabelText("Evidencia de corrección")).toBeTruthy();
  expect((screen.getByLabelText("Evidencia de corrección") as HTMLTextAreaElement).value).toBe("Verifiqué la corrección en el laboratorio.");
  expect(screen.getByRole("button", { name: /Cerrar acción/ })).toBeTruthy();
  expect(notify).toHaveBeenCalledWith(expect.stringContaining("Tus datos siguen en el formulario; podés reintentar."));
});
