// @vitest-environment jsdom
// Independent acceptance checks retained as regular regressions.
import { useState } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import App from "../src/App";
import Onboarding from "../src/components/Onboarding";
import Annotations from "../src/components/Annotations";
import { KEY, seed, blankOnboarding } from "../src/data/repository";
import { currentMonth } from "../src/domain/model";
import type { State } from "../src/domain/model";
import * as domain from "../src/domain/model";
import { chooseEmployee } from "./employee-picker-test-helpers";

vi.mock("recharts", () => Object.fromEntries(["ResponsiveContainer", "BarChart", "Bar", "LabelList", "XAxis", "YAxis", "CartesianGrid", "Tooltip", "Legend", "LineChart", "Line", "ReferenceLine", "PieChart", "Pie", "Cell"].map(key => [key, () => null])));
function prepare(activeId = "e0") {
  const state = seed();
  state.activeId = activeId;
  state.assignments = [];
  state.tasks = [];
  state.activity = [];
  state.audit = [];
  localStorage.setItem(KEY, JSON.stringify(state));
  return state;
}
const save = (state: State) => localStorage.setItem(KEY, JSON.stringify(state));
const stored = () => JSON.parse(localStorage.getItem(KEY)!) as State;
const nav = (page: string) => fireEvent.click(document.querySelector(`[data-nav="${page}"]`)!);
beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal("matchMedia", () => ({matches:false, addEventListener(){},removeEventListener(){}}));
  HTMLDialogElement.prototype.showModal = function(){this.setAttribute("open","");};
  HTMLDialogElement.prototype.close = function(){this.removeAttribute("open");};
});
afterEach(() => {cleanup();vi.restoreAllMocks();vi.unstubAllGlobals();});

it("A-R09: failed Previous leaves the tour page and persisted progress unchanged", () => {
  const state=prepare(); state.tour.e0=4; state.tourStepId={e0:"operations-movements"}; state.tourVersion={e0:6};save(state);
  render(<App/>);fireEvent.click(screen.getByRole("button",{name:"Recorrido guiado"}));
  vi.spyOn(Storage.prototype,"setItem").mockImplementation(()=>{throw new DOMException("Full","QuotaExceededError");});
  fireEvent.click(screen.getByRole("button",{name:"Anterior"}));
  expect(document.querySelector("nav button.active")?.getAttribute("data-nav")).toBe("operations");
  expect(document.querySelector(".tour-coach small")?.textContent).toContain("5/9");
  expect(stored().tour.e0).toBe(4);
});

it("A-R10: consulted employee remains the owner while the manager is timer and audit actor", () => {
  const state=prepare("m1");const example=seed().tasks.find(t=>t.ownerId==="e0"&&t.kind==="resultado")!;
  state.tasks=[{...example,id:"review-actor",assignmentId:null,title:"Actor de revisión",status:"Pendiente",sessions:[],blockedBy:""}];save(state);
  render(<App/>);nav("tasks");chooseEmployee("Perfil que estás viendo","e0");
  fireEvent.click(screen.getByRole("button",{name:"Iniciar Actor de revisión"}));
  const saved=stored();expect(saved.tasks[0].ownerId).toBe("e0");
  expect(saved.tasks[0].sessions?.at(-1)?.actorId).toBe("m1");
  expect(saved.audit.at(-1)?.actorId).toBe("m1");
});

it("A-V40: every role completes the complete tour with exactly one highlight", async () => {
  for (const [role,total] of [["e0",9],["m1",11],["boss",13]] as const) {
    const state=prepare(role);
    state.tasks=[{...seed().tasks[0],id:"role-tour",assignmentId:null,ownerId:role,month:currentMonth(),status:"Pendiente",kind:"resultado"}];
    save(state);const view=render(<App/>);
    const businessBefore = JSON.stringify(Object.fromEntries(["tasks","assignments","activity","audit","annotations","calendarEvents","closures","evidence"].map(key => [key, (state as unknown as Record<string, unknown>)[key] ?? null])));
    if(role==="e0"||role==="m1"){
      expect(document.querySelector('[data-nav="closing"]')).toBeNull();
      expect(document.querySelector('[data-nav="catalog"]')).toBeNull();
    } else {
      expect(document.querySelector('[data-nav="closing"]')).not.toBeNull();
      expect(document.querySelector('[data-nav="catalog"]')).not.toBeNull();
    }
    fireEvent.click(screen.getByRole("button",{name:"Recorrido guiado"}));
    for(let step=0;step<total;step++){
      await waitFor(()=>expect(document.querySelectorAll(".spotlight"),`${role} paso ${step+1}/${total}, página ${document.querySelector("nav button.active")?.getAttribute("data-nav")}, coach ${document.querySelector(".tour-coach")?.textContent}, destinos ${Array.from(document.querySelectorAll("[data-tour]")).map((node)=>node.getAttribute("data-tour")).join(",")}`).toHaveLength(1),{timeout:2500});
      const target=document.querySelector<HTMLElement>(".spotlight");
      expect(target?.closest(".main"),`${role} paso ${step+1} debe señalar contenido del módulo`).not.toBeNull();
      expect(target?.hasAttribute("data-nav")).toBe(false);
      expect(document.querySelector(".tour-coach small")?.textContent).toContain(`${step+1}/${total}`);
      fireEvent.click(screen.getByRole("button",{name:step===total-1?"Listo":"Siguiente"}));
    }
    expect(document.querySelector(".spotlight")).toBeNull();
    expect(stored().tour[role]).toBe(total);
    expect(stored().tourStepId?.[role]).toBe("__complete__");
    const after=stored();
    const businessAfter=JSON.stringify(Object.fromEntries(["tasks","assignments","activity","audit","annotations","calendarEvents","closures","evidence"].map(key => [key, (after as unknown as Record<string, unknown>)[key] ?? null])));
    expect(businessAfter).toBe(businessBefore);
    fireEvent.click(screen.getByRole("button",{name:"Recorrido guiado"}));
    chooseEmployee("Vista de usuario",role==="e0"?"m1":"e0");
    expect(document.querySelector(".tour-coach")).toBeNull();
    expect(document.querySelector(".spotlight")).toBeNull();
    view.unmount();localStorage.clear();
  }
},20000);

it("A-V40: filtering and folding recover one target without opening columns automatically", async () => {
  const state=prepare("e0");state.tour.e0=3;state.tourStepId={e0:"board-timer"};state.tourVersion={e0:6};
  const example=seed().tasks.find(t=>t.ownerId==="e0"&&t.kind==="resultado")!;
  state.tasks=[{...example,id:"target-one",assignmentId:null,month:currentMonth(),status:"Pendiente"},{...example,id:"target-two",assignmentId:null,month:currentMonth(),status:"Pendiente"}];save(state);
  render(<App/>);fireEvent.click(screen.getByRole("button",{name:"Recorrido guiado"}));
  const expectTimer=()=>expect(document.querySelectorAll('[data-tour="task-timers"].spotlight')).toHaveLength(1);
  await waitFor(expectTimer);
  fireEvent.change(screen.getByLabelText("Buscar tareas"),{target:{value:"sin coincidencias xyz"}});
  await waitFor(()=>expect(document.querySelector(".spotlight")?.getAttribute("data-tour")).toMatch(/task-column-(open|empty)/));
  fireEvent.change(screen.getByLabelText("Buscar tareas"),{target:{value:""}});
  await waitFor(expectTimer);
  const toggle=document.querySelector(".column-toggle")!;
  fireEvent.click(toggle);
  await waitFor(()=>expect(document.querySelector(".spotlight")?.getAttribute("data-tour")).toMatch(/task-column-(open|empty)/));
  expect(toggle.getAttribute("aria-expanded")).toBe("false");
  fireEvent.click(toggle);
  await waitFor(expectTimer);
  expect(document.querySelectorAll(".spotlight")).toHaveLength(1);
});


it("V43: mutation reducer no-op does not persist or append an audit", () => {
  const state = prepare();
  const example = seed().tasks.find(t => t.ownerId === "e0" && t.kind === "resultado")!;
  state.tasks = [{ ...example, id: "noop-task", assignmentId: null, title: "Control sin cambio", month: currentMonth(), status: "En curso", completedAt: null, blockedBy: "", checklist: [{ id: "check", text: "Control único", done: true }] }];
  save(state);
  render(<App />); nav("tasks");
  fireEvent.click(screen.getByRole("button", { name: /^En curso/ }));
  fireEvent.click(screen.getByRole("button", { name: "Control sin cambio" }));
  const reducer = vi.spyOn(domain, "checkTask").mockImplementation(t => t);
  const writes = vi.spyOn(Storage.prototype, "setItem");
  const before = localStorage.getItem(KEY);
  fireEvent.click(screen.getByRole("checkbox", { name: "Control único" }));
  expect(reducer).toHaveBeenCalledTimes(1);
  expect(writes).not.toHaveBeenCalled();
  expect(localStorage.getItem(KEY)).toBe(before);
  expect(stored().audit).toHaveLength(0);
});
