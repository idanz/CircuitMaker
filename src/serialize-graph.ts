import { Arithmetic, Constant, Decider, VERSION, type BlueprintJSON } from './circuit';
import type { Entity, Edge } from './graph-session';

export function isCombinator(entity: Entity): entity is Decider | Arithmetic | Constant {
  return entity instanceof Decider || entity instanceof Arithmetic || entity instanceof Constant;
}

export function components(entities: readonly Entity[], edges: readonly Edge[]): Entity[][] {
  const remaining = new Set(entities), result: Entity[][] = [];
  for (const seed of entities) {
    if (!remaining.has(seed)) continue;
    const found = new Set([seed]);
    for (const e of found) for (const [a,b] of edges) {
      if (a === e && remaining.has(b)) found.add(b);
      if (b === e && remaining.has(a)) found.add(a);
    }
    const group = entities.filter(e => found.has(e));
    group.forEach(e => remaining.delete(e)); result.push(group);
  }
  return result;
}

/** Serialize only supported combinators and wires whose endpoints are included. */
export function serializeGraph(members: readonly Entity[], label: string, edges: readonly Edge[], forcePacked = false): BlueprintJSON {
  const supported = members.filter(isCombinator), included = new Set<Entity>(supported);
  const wires = edges.filter(([a,b]) => included.has(a) && included.has(b));
  // Preserve the original decider-only Blueprint JSON and layout.
  const legacy = !forcePacked && !wires.length && supported.every(e => e instanceof Decider);
  const entities = legacy ? supported : [...new Set(supported)];
  const numbers = new Map<Entity,number>(entities.map((e,i) => [e,i+1]));
  const positions = new Map<Entity,{x:number;y:number}>();
  if (!legacy) {
    let x=0,y=0,rowHeight=0;
    for (const group of components(entities,wires)) {
      const width=Math.min(group.length,4)*2, height=Math.ceil(group.length/4)*2;
      if(x && x+width>24) {x=0;y+=rowHeight+3;rowHeight=0;}
      group.forEach((e,i) => positions.set(e,{x:x+(i%4)*2+.5,y:y+Math.floor(i/4)*2+(e instanceof Constant?.5:0)}));
      x+=width+3;rowHeight=Math.max(rowHeight,height);
    }
  }
  const seen=new Set<string>(), encodedWires:number[][]=[];
  const port=(e:Entity,p:string,c:string)=>(e instanceof Constant || p==='input'?1:3)+(c==='green'?1:0);
  for(const [a,b,c,ap,bp] of wires){
    const left=[numbers.get(a)!,port(a,ap,c)],right=[numbers.get(b)!,port(b,bp,c)];
    const edge=left[0]<right[0]||(left[0]===right[0]&&left[1]<=right[1])?[...left,...right]:[...right,...left];
    if(!seen.has(edge.join(','))){seen.add(edge.join(','));encodedWires.push(edge);}
  }
  return {blueprint:{item:'blueprint',label,version:VERSION,description:entities.map((e,i)=>`${i+1}: ${e.name}`).join('\n'),entities:entities.map((e,i)=>({...e.toEntity(i+1),...(legacy?{}:{position:positions.get(e)!})})),...(encodedWires.length?{wires:encodedWires}:{})}};
}
