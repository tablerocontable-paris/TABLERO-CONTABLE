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

vi.mock("recharts", () => Object.fromEntries(["ResponsiveContainer", "BarChart", "Bar", "XAxis", "YAxis", "CartesianGrid", "Tooltip", "Legend", "LineChart", "Line", "ReferenceLine"].map(key => [key, () => null])));
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
  const state=prepare(); state.tour.e0=7; state.tourVersion={e0:4};save(state);
  render(<App/>);fireEvent.click(screen.getByRole("button",{name:"Recorrido guiado"}));
  vi.spyOn(Storage.prototype,"setItem").mockImplementation(()=>{throw new DOMException("Full","QuotaExceededError");});
  fireEvent.click(screen.getByRole("button",{name:"Anterior"}));
  expect(document.querySelector("nav button.active")?.getAttribute("data-nav")).toBe("operations");
  expect(document.querySelector(".tour-coach small")?.textContent).toContain("8/11");
  expect(stored().tour.e0).toBe(7);
});

it("A-R10: consulted employee remains the owner while the manager is timer and audit actor", () => {
  const state=prepare("m1");const example=seed().tasks.find(t=>t.ownerId==="e0"&&t.kind==="resultado")!;
  state.tasks=[{...example,id:"review-actor",title:"Actor de revisión",status:"Pendiente",sessions:[],blockedBy:""}];save(state);
  render(<App/>);nav("tasks");fireEvent.change(screen.getByLabelText("Perfil que estás viendo"),{target:{value:"e0"}});
  fireEvent.click(screen.getByRole("button",{name:"Iniciar Actor de revisión"}));
  const saved=stored();expect(saved.tasks[0].ownerId).toBe("e0");
  expect(saved.tasks[0].sessions?.at(-1)?.actorId).toBe("m1");
  expect(saved.audit.at(-1)?.actorId).toBe("m1");
});

it("A-V40: every role completes the complete tour with exactly one highlight", async () => {
  for (const [role,total] of [["e0",11],["m1",14],["boss",16]] as const) {
    const state=prepare(role);
    state.tasks=[{...seed().tasks[0],id:"role-tour",ownerId:role,month:currentMonth(),status:"Pendiente",kind:"resultado"}];
    save(state);const view=render(<App/>);
    fireEvent.click(screen.getByRole("button",{name:"Recorrido guiado"}));
    for(let step=0;step<total;step++){
      await waitFor(()=>expect(document.querySelectorAll(".spotlight")).toHaveLength(1));
      expect(document.querySelector(".tour-coach small")?.textContent).toContain(`${step+1}/${total}`);
      fireEvent.click(screen.getByRole("button",{name:step===total-1?"Listo":"Siguiente"}));
    }
    expect(document.querySelector(".spotlight")).toBeNull();
    expect(stored().tour[role]).toBe(total);
    fireEvent.click(screen.getByRole("button",{name:"Recorrido guiado"}));
    fireEvent.change(screen.getByLabelText("Vista de usuario"),{target:{value:role==="e0"?"m1":"e0"}});
    expect(document.querySelector(".tour-coach")).toBeNull();
    expect(document.querySelector(".spotlight")).toBeNull();
    view.unmount();localStorage.clear();
  }
});

it("A-V40: filtering and folding recover one target without opening columns automatically", async () => {
  const state=prepare("e0");state.tour.e0=5;state.tourVersion={e0:4};
  const example=seed().tasks.find(t=>t.ownerId==="e0"&&t.kind==="resultado")!;
  state.tasks=[{...example,id:"target-one",month:currentMonth(),status:"Pendiente"},{...example,id:"target-two",month:currentMonth(),status:"Pendiente"}];save(state);
  render(<App/>);fireEvent.click(screen.getByRole("button",{name:"Recorrido guiado"}));
  const expectTimer=()=>expect(document.querySelectorAll('[data-tour="task-timers"].spotlight')).toHaveLength(1);
  await waitFor(expectTimer);
  fireEvent.change(screen.getByLabelText("Buscar tareas"),{target:{value:"sin coincidencias xyz"}});
  await waitFor(()=>expect(document.querySelector(".heading.spotlight")).not.toBeNull());
  fireEvent.change(screen.getByLabelText("Buscar tareas"),{target:{value:""}});
  await waitFor(expectTimer);
  const toggle=document.querySelector(".column-toggle")!;
  fireEvent.click(toggle);
  await waitFor(()=>expect(document.querySelector(".heading.spotlight")).not.toBeNull());
  expect(toggle.getAttribute("aria-expanded")).toBe("false");
  fireEvent.click(toggle);
  await waitFor(expectTimer);
  expect(document.querySelectorAll(".spotlight")).toHaveLength(1);
});
