import { expect, it, vi } from "vitest";
import { createTaskReader, type TaskReadQuery } from "../src/data/remote/task-reader";
const ids=["abcdef01-2345-6789-abcd-ef0123456789","abcdef01-2345-6789-abcd-ef0123456790","abcdef01-2345-6789-abcd-ef0123456791"];
const instance="fedcba01-2345-6789-abcd-ef0123456789";
const rows=ids.map((id,index)=>({id:index===0?id.toUpperCase():id,organization_id:instance,instance_id:instance,actor_id:instance,started_at:"2026-10-02T10:00:00.123456Z",ended_at:"2026-10-02T10:01:00.654321Z",absence_id:null,metadata:{trace:index}}));
it("READ-V37-01: pages alphabetic and uppercase session UUIDs without skipping lookahead",async()=>{
  const read=vi.fn(async(query:TaskReadQuery)=>{
    if(query.kind!=="sessionPage")throw Error("Wrong query");
    return {data:rows.filter(row=>!query.afterId||row.id.toLowerCase()>query.afterId.toLowerCase()).slice(0,query.take),error:null};
  });
  const reader=createTaskReader({read});const traversed:unknown[]=[];let afterId:string|null=null;
  for(let index=0;index<3;index++){
    const page=await reader.listSessions({instanceIds:[instance.toUpperCase()],limit:1,afterId});
    expect(page).toMatchObject({ok:true,hasMore:index<2,nextCursor:index<2?rows[index].id:null});
    if(!page.ok)throw Error("Expected page");
    expect(page.rows).toEqual([rows[index]]);traversed.push(...page.rows);afterId=page.nextCursor;
  }
  expect(traversed).toEqual(rows);expect(read).toHaveBeenCalledTimes(3);
  expect(read.mock.calls.map(([q])=>q)).toEqual(rows.map((_,index)=>({kind:"sessionPage",table:"task_time_sessions",instanceIds:[instance.toUpperCase()],afterId:index?rows[index-1].id:null,take:2})));
});
it("READ-V37-02: rejects out of order and excessive otherwise-valid session pages",async()=>{
  for(const page of [[rows[1],rows[0]],[...rows]]){
    const read=vi.fn(async()=>({data:page,error:null}));
    expect(await createTaskReader({read}).listSessions({instanceIds:[instance],limit:1})).toMatchObject({ok:false,error:"protocol"});
    expect(read).toHaveBeenCalledOnce();
  }
});
