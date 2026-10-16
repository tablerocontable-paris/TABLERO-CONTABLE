// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import RemoteWorkspace from '../../src/components/RemoteWorkspace';
import { operationalSeed, projectState } from '../../src/server/site-policy';
import type { State } from '../../src/domain/model';
vi.mock('recharts',()=>Object.fromEntries(['ResponsiveContainer','BarChart','Bar','LabelList','XAxis','YAxis','CartesianGrid','Tooltip','Legend','LineChart','Line','ReferenceLine','PieChart','Pie','Cell'].map(name=>[name,()=>null])));
function dto(view='admin', revision=4, name='Inicial') {
  const source=operationalSeed('ficticio@example.test');
  source.activeId=view;
  source.onboarding[view].completedAt=new Date().toISOString();source.onboarding[view].step=5;
  const state=projectState(source,source.profiles.find(p=>p.id===view)!);
  state.companies[0].name=name;
  return {state,revision,isOwner:true,presence:{}};
}
beforeEach(()=>{localStorage.clear();vi.stubGlobal('matchMedia',()=>({matches:false,addEventListener(){},removeEventListener(){}}));});
afterEach(()=>{cleanup();vi.restoreAllMocks();vi.unstubAllGlobals();});
it('S44 independent: an interval cannot supersede an explicit open while it is pending',async()=>{
  let resolveOpen!:(response:Response)=>void;
  const fetch=vi.fn(async(path:unknown)=>new URL(String(path),'https://lab.test').searchParams.get('view')==='e0'
    ? new Promise<Response>(resolve=>{resolveOpen=resolve;}) : Response.json(dto()));
  vi.stubGlobal('fetch',fetch);
  const interval=vi.spyOn(window,'setInterval');render(<RemoteWorkspace/>);
  await screen.findByLabelText('Mi espacio');
  const poll=interval.mock.calls.find(([,delay])=>delay===30000)![0] as ()=>Promise<void>;
  fireEvent.change(screen.getByLabelText('Vista de usuario'),{target:{value:'e0'}});
  await waitFor(()=>expect(fetch).toHaveBeenCalledTimes(2));
  await act(async()=>{await poll();await poll();});
  expect(fetch).toHaveBeenCalledTimes(2);
  expect(screen.getByText('Actualizando…')).toBeTruthy();
  await act(async()=>{resolveOpen(Response.json(dto('e0',7,'Apertura vigente')));});
  await waitFor(()=>expect(screen.getByText(/Guardado en el servidor/)).toBeTruthy());
  expect(screen.getAllByText('Apertura vigente').length).toBeGreaterThan(0);
});
it('S44 independent: an old mount cannot replace the remounted workspace',async()=>{
  let resolveOld!:(response:Response)=>void;let reads=0;
  const fetch=vi.fn(async()=>{
    reads++;
    if(reads===2)return new Promise<Response>(resolve=>{resolveOld=resolve;});
    return Response.json(dto('admin',reads===1?4:9,reads===1?'Inicial':'Montaje nuevo'));
  });
  vi.stubGlobal('fetch',fetch);const interval=vi.spyOn(window,'setInterval');
  const first=render(<RemoteWorkspace/>);await screen.findByLabelText('Mi espacio');
  const poll=interval.mock.calls.find(([,delay])=>delay===30000)![0] as ()=>Promise<void>;
  let polling!:Promise<void>;await act(async()=>{polling=poll();await Promise.resolve();});
  first.unmount();render(<RemoteWorkspace/>);await screen.findByLabelText('Mi espacio');
  await act(async()=>{resolveOld(Response.json(dto('admin',5,'Montaje anterior')));await polling;});
  expect(screen.queryAllByText('Montaje anterior')).toHaveLength(0);
  expect(screen.getAllByText('Montaje nuevo').length).toBeGreaterThan(0);
});
it('S44 independent: a GET resolved before debounce cannot overwrite a proposal or its base revision',async()=>{
  let resolvePoll!:(response:Response)=>void;let reads=0;let post:{state:State;revision:number}|undefined;
  vi.stubGlobal('fetch',vi.fn(async(_path:unknown,init?:RequestInit)=>{
    if(init?.method==='POST'){post=JSON.parse(String(init.body));return Response.json({...dto(),state:post!.state,revision:5});}
    if(++reads===2)return new Promise<Response>(resolve=>{resolvePoll=resolve;});
    return Response.json({...dto(),state:post?.state??dto().state,revision:post?5:4});
  }));
  const interval=vi.spyOn(window,'setInterval');
  const originalTimeout=window.setTimeout.bind(window);let flush!:(()=>void);
  vi.spyOn(window,'setTimeout').mockImplementation((handler,timeout,...args)=>{
    if(timeout===450){flush=handler as ()=>void;return 0;}
    return originalTimeout(handler,timeout,...args);
  });
  render(<RemoteWorkspace/>);await screen.findByLabelText('Mi espacio');
  const poll=interval.mock.calls.find(([,delay])=>delay===30000)![0] as ()=>Promise<void>;
  let polling!:Promise<void>;await act(async()=>{polling=poll();await Promise.resolve();});
  fireEvent.click(document.querySelector('[data-nav="team"]')!);
  fireEvent.change(await screen.findByLabelText('Empresa 1'),{target:{value:'Propuesta pendiente'}});
  fireEvent.click(screen.getByRole('button',{name:'Guardar empresas'}));
  expect(post).toBeUndefined();expect(flush).toBeDefined();
  await act(async()=>{resolvePoll(Response.json(dto('admin',8,'GET anterior')));await polling;});
  expect(screen.queryAllByText('GET anterior')).toHaveLength(0);
  expect(screen.getByText('Guardado pendiente…')).toBeTruthy();
  await act(async()=>{flush();});
  await waitFor(()=>expect(screen.getByText(/Guardado en el servidor/)).toBeTruthy());
  expect(post?.revision).toBe(4);expect(post?.state.companies[0].name).toBe('Propuesta pendiente');
});
