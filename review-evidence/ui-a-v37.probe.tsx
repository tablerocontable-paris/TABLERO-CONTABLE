// @vitest-environment jsdom
// Temporary independent acceptance probes; copied to review-evidence after execution.
import { useState } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import App from "../src/App";
import Onboarding from "../src/components/Onboarding";
import Annotations from "../src/components/Annotations";
import { KEY, seed, blankOnboarding } from "../src/data/repository";
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

it("A-R01: induction keeps the first empty checklist row", () => {
  const state = seed(); const profile = state.profiles.find(p => p.id === "e0")!;
  function Harness(){const [draft,setDraft]=useState({...blankOnboarding(profile.name),step:2});return <Onboarding state={state} profile={profile} month="2026-10" draft={draft} update={setDraft} finish={()=>{}} pause={()=>{}}/>;}
  render(<Harness/>);
  fireEvent.click(screen.getByRole("button",{name:"Agregar paso"}));
  expect(screen.queryByLabelText("Paso 1")).not.toBeNull();
});
it("A-R02: operative assignment stores the editable target", () => {
  prepare("boss"); render(<App/>); nav("tasks");
  fireEvent.click(screen.getByRole("button",{name:"Nueva tarea",exact:true}));
  fireEvent.change(screen.getByLabelText("Elegí del catálogo"),{target:{value:"cat3"}});
  fireEvent.change(screen.getByLabelText("Meta por ocurrencia"),{target:{value:"321"}});
  fireEvent.click(screen.getByRole("button",{name:"Crear tarea",exact:true}));
  expect(stored().assignments.find(a=>a.templateId==="cat3")?.target).toBe(321);
});
it("A-R03: new task defaults to the consulted employee", () => {
  prepare("m1"); render(<App/>); nav("tasks");
  fireEvent.change(screen.getByLabelText("Perfil que estás viendo"),{target:{value:"e0"}});
  fireEvent.click(screen.getByRole("button",{name:"Nueva tarea",exact:true}));
  expect((screen.getByLabelText("Responsable") as HTMLSelectElement).value).toBe("e0");
});
it("A-R04: Mi dia shows the consulted employee's pending task", () => {
  const state=prepare("m1");const example=seed().tasks.find(t=>t.ownerId==="e0"&&t.kind==="resultado")!;
  state.tasks=[{...example,id:"subordinate-task",title:"Pendiente de Valentino",status:"Pendiente"}];save(state);
  render(<App/>);nav("tasks");
  fireEvent.change(screen.getByLabelText("Perfil que estás viendo"),{target:{value:"e0"}});nav("day");
  expect(screen.queryByText("Pendiente de Valentino")).not.toBeNull();
});
it("A-P05: employee selector offers only the employee's own profile", () => {
  prepare("e0");render(<App/>);nav("tasks");
  const selector=screen.getByLabelText("Perfil que estás viendo") as HTMLSelectElement;
  expect(Array.from(selector.options).map(option=>option.value)).toEqual(["e0"]);
});
it("A-R06: changing demo profile closes task details", () => {
  const state=prepare("m1");const example=seed().tasks.find(t=>t.ownerId==="e0"&&t.kind==="resultado")!;
  state.tasks=[{...example,id:"subordinate-detail",title:"Detalle de Valentino",status:"Pendiente"}];save(state);
  render(<App/>);nav("tasks");fireEvent.change(screen.getByLabelText("Perfil que estás viendo"),{target:{value:"e0"}});
  fireEvent.click(screen.getByText("Detalle de Valentino"));
  expect(screen.queryByRole("dialog")).not.toBeNull();
  fireEvent.change(screen.getByLabelText("Vista de usuario"),{target:{value:"e5"}});
  expect(screen.queryByRole("dialog")).toBeNull();
});
it("A-R07: a short multiline annotation can be expanded", () => {
  const entry={id:"note",ownerId:"e0",title:"Cuatro lineas",content:"uno\ndos\ntres\ncuatro",kind:"personal" as const,reminderOn:null,createdAt:"2026-10-01T12:00:00Z",updatedAt:"2026-10-01T12:00:00Z",convertedTaskId:null};
  render(<Annotations rows={[entry]} tasks={[]} onSave={()=>true} onDelete={()=>{}} onConvert={()=>{}} onOpenTask={()=>{}}/>);
  expect(screen.queryByRole("button",{name:/Leer completo/})).not.toBeNull();
});
it("A-R08: conversion rejects an overlong checklist step without partial save", () => {
  const state=prepare("e0");
  state.annotations=[{id:"long-note",ownerId:"e0",title:"Referencia extensa",content:"x".repeat(301),kind:"personal",reminderOn:null,createdAt:"2026-10-01T12:00:00Z",updatedAt:"2026-10-01T12:00:00Z",convertedTaskId:null}];save(state);
  render(<App/>);nav("annotations");
  fireEvent.click(screen.getByRole("button",{name:"Convertir en tarea"}));
  fireEvent.click(screen.getByRole("button",{name:"Crear tarea",exact:true}));
  expect(stored().assignments).toHaveLength(0);
  expect(stored().annotations![0].convertedTaskId).toBeNull();
  expect(screen.queryByRole("dialog")).not.toBeNull();
});
