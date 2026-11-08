// Schematic positions are independent of in-game blueprint placement.
// Resolve wire buses first: input-input and output-output joins carry dependencies too.
export function layoutCircuit({entities,wires}) {
  const byId=new Map(entities.map(e=>[e.id,e])),parents=new Map(),ports=new Map();
  const key=p=>`${p.id}:${p.port}:${p.color}`;
  const find=k=>{
    if(!parents.has(k))parents.set(k,k);
    if(parents.get(k)!==k)parents.set(k,find(parents.get(k)));
    return parents.get(k);
  };
  for(const wire of wires){
    if(!byId.has(wire.from.id)||!byId.has(wire.to.id))continue;
    for(const p of [wire.from,wire.to])ports.set(key(p),p);
    parents.set(find(key(wire.from)),find(key(wire.to)));
  }
  const buses=new Map(),edges=new Map(entities.map(e=>[e.id,new Set()]));
  for(const [k,p]of ports){const root=find(k);if(!buses.has(root))buses.set(root,[]);buses.get(root).push(p);}
  for(const bus of buses.values())for(const from of bus.filter(p=>p.port==='output'))for(const to of bus.filter(p=>p.port==='input')){
    if(from.id!==to.id)edges.get(from.id).add(to.id);
  }

  // Collapse feedback loops before sorting so a cycle cannot strand downstream nodes.
  const index=new Map(),low=new Map(),stack=[],onStack=new Set(),groups=[];
  let nextIndex=0;
  function visit(id){
    index.set(id,nextIndex);low.set(id,nextIndex++);stack.push(id);onStack.add(id);
    for(const target of edges.get(id)){
      if(!index.has(target)){visit(target);low.set(id,Math.min(low.get(id),low.get(target)));}
      else if(onStack.has(target))low.set(id,Math.min(low.get(id),index.get(target)));
    }
    if(low.get(id)===index.get(id)){
      const members=[];let member;
      do{member=stack.pop();onStack.delete(member);members.push(member);}while(member!==id);
      groups.push(members);
    }
  }
  for(const e of entities)if(!index.has(e.id))visit(e.id);
  const rank=id=>byId.get(id).type==='Driver'?0:byId.get(id).type==='Constant'?1:2;
  const compare=(a,b)=>rank(a)-rank(b)||a-b;
  groups.forEach(group=>group.sort(compare));
  const groupOf=new Map(groups.flatMap((group,i)=>group.map(id=>[id,i])));
  const outgoing=groups.map(()=>new Set()),indegree=groups.map(()=>0);
  for(const [id,targets]of edges)for(const target of targets){
    const a=groupOf.get(id),b=groupOf.get(target);
    if(a!==b&&!outgoing[a].has(b)){outgoing[a].add(b);indegree[b]++;}
  }
  const ready=groups.map((_,i)=>i).filter(i=>!indegree[i]),ordered=[];
  while(ready.length){
    ready.sort((a,b)=>compare(groups[a][0],groups[b][0]));
    const group=ready.shift();ordered.push(...groups[group]);
    for(const target of outgoing[group])if(--indegree[target]===0)ready.push(target);
  }
  // Keep one horizontal lane, including on narrow screens; larger circuits scroll.
  return new Map(ordered.map((id,i)=>[id,{x:65+i*232,y:65}]));
}
