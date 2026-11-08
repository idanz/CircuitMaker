import { Blueprint, Decider, Arithmetic, Device, encode } from './circuit';
import { session, type Entity } from './graph-session';
import { components, isCombinator, serializeGraph } from './serialize-graph';

export function collectGraphs(exports: Record<string, unknown>) {
  const groups=Object.entries(exports).filter(([,v])=>v instanceof Blueprint && v.entities.some(isCombinator)) as [string,Blueprint][];
  const artifacts=groups.map(([name,bp])=>({name,label:name.toLowerCase()==='all'?`${name} (export)`:name,kind:'named',data:bp.toDict(),string:bp.toString()}));
  const covered=new Set<Entity>(groups.flatMap(([,bp])=>[...bp.entities]));
  const all=[...new Set([...session.entities,...groups.flatMap(([,bp])=>[...bp.entities])])].filter(isCombinator);
  const singletons=new Set<Entity>();
  for(const [,bp]of groups){const members=bp.entities.filter(isCombinator);if(members.length===1)singletons.add(members[0]);}
  const remaining=all.filter(e=>!covered.has(e));
  for(const entities of components(remaining,session.wires)) {
    if(entities.length===1)singletons.add(entities[0]);
    const label=entities[0].name;let name=label,suffix=2;
    while(artifacts.some(a=>a.name===name))name=`${label} (${suffix++})`;
    const data=serializeGraph(entities,label,session.wires);
    artifacts.push({name,label:name.toLowerCase()==='all'?`${name} (export)`:name,kind:'component',data,string:encode(data)});
  }
  for(const entity of all)if(!singletons.has(entity)){
    const type=entity instanceof Decider?'Decider':entity instanceof Arithmetic?'Arithmetic':'Constant';
    const base=`${entity.name} (${type})`;let name=base,suffix=2;
    while(artifacts.some(a=>a.name===name))name=`${base} (${suffix++})`;
    const data=serializeGraph([entity],entity.name,session.wires);
    artifacts.push({name,label:name,kind:'entity',data,string:encode(data)});
  }
  if(all.length){
    let name='__all__';while(artifacts.some(a=>a.name===name))name+='.';
    const data=serializeGraph(all,'All',session.wires,true);
    artifacts.unshift({name,label:'All',kind:'all',data,string:encode(data)});
  }
  const omitted=[...new Set([...session.entities,...groups.flatMap(([,bp])=>[...bp.entities])])].filter(e=>e instanceof Device).length;
  if(omitted)console.info(`Omitted ${omitted} Device placeholder(s) and their wires; only combinators are exported.`);
  return artifacts;
}
