// Chart data stays separate from simulation state: changing a selection never reruns it.
import {describeCircuit} from './circuit-model.js';
export const MAX_GRAPH_TRACES = 64;
export function waveformPath(values,x,y) {
  if(!values.length)return '';
  let path=`M${x(0)},${y(values[0])}`;
  for(let i=1;i<values.length;i++)path+=` L${x(i)},${y(values[i])}`;
  return path;
}
export function chartScale(min,max,ticks,width=900) {
  const x=tick=>64+tick/Math.max(1,ticks)*(width-80);
  const y=value=>190-(value-min)/(max-min||1)*164;
  return {x,y,zeroY:y(0)};
}
export const networkLabel = network => `${network.color === 'red' ? 'R' : 'G'}${network.id + 1}`;
export const signalLabel = signal => {
  const name=signal.type==='virtual'||signal.name.startsWith('signal-')?signal.name.replace(/^signal-/,''):signal.name;
  const friendly=name.charAt(0).toUpperCase()+name.slice(1).replaceAll('-',' ');
  return `${friendly}${signal.quality && signal.quality !== 'normal' ? ` [${signal.quality}]` : ''}`;
};

export function describeNetworks(data,timeline) {
  const entities=new Map(describeCircuit(data).entities.map(entity=>[entity.id,entity]));
  return new Map(timeline.networks.map(network=>{
    const ports=network.ports??[],outputs=ports.filter(p=>p.port==='output'),inputs=ports.filter(p=>p.port==='input');
    const unique=ports=>[...new Set(ports.map(p=>entities.get(p.entity)?.label??`Entity ${p.entity}`))].join(' + ');
    const drivers=outputs.filter(p=>entities.get(p.entity)?.type==='Driver');
    const combinators=outputs.filter(p=>!['Driver','Constant'].includes(entities.get(p.entity)?.type));
    const feedback=combinators.some(p=>inputs.some(q=>q.entity===p.entity));
    const source=unique(outputs),target=unique(inputs);
    const role=feedback?(drivers.length?'Injected signals + feedback':'Feedback / output'):drivers.length?(combinators.length?'Injected signals + output':'Injected signals'):combinators.length?(inputs.length?'Circuit link':'Circuit output'):outputs.length?'Constant source':'Circuit input';
    const title=feedback?`${source} · feedback`:source&&target?`${source} → ${target}`:source?`${source} · output`:`${target||'Unconnected'} · input`;
    const endpoints=ports.map(p=>`${entities.get(p.entity)?.label??'Entity'} (#${p.entity}) ${p.port}`).join(' · ');
    return [network.id,{...network,role,title,endpoints,feedback,hasDriver:drivers.length>0,hasOutput:combinators.length>0,
      terminal:combinators.length>0&&!inputs.length,
      detail:feedback?'Output loops back to input':!network.connected?'Unwired output port':endpoints}];
  }));
}

export function visibleSimulationNetworks(networks,descriptions,channels) {
  // Unwired combinator outputs are useful observations; an unused Driver port
  // only mirrors the stimulus and is not a circuit network.
  return networks.filter(network=>network.connected||(!descriptions.get(network.id).hasDriver&&channels[network.id]?.size));
}

export function defaultGraphSelection(networks,descriptions,channels) {
  networks=visibleSimulationNetworks(networks,descriptions,channels);
  const live=networks.filter(n=>channels[n.id]?.size);
  const output=live.find(n=>descriptions.get(n.id).feedback)
    ??live.filter(n=>descriptions.get(n.id).terminal).sort((a,b)=>b.ports.length-a.ports.length)[0]
    ??live.find(n=>descriptions.get(n.id).hasOutput);
  const input=live.find(n=>n.connected&&descriptions.get(n.id).hasDriver)
    ??live.find(n=>n.connected&&!descriptions.get(n.id).hasOutput);
  const common=output&&input?[...channels[output.id]].filter(id=>channels[input.id].has(id)):[];
  const selected=common.length?[input,output]:output?[output]:input?[input]:live.length?[live[0]]:networks.slice(0,1);
  const signals=common.length?common:channels[selected[0]?.id]?[...channels[selected[0].id]]:[];
  return {networks:new Set(selected.map(n=>n.id)),signals:new Set(signals.slice(0,4))};
}

export function networkChannels(timeline) {
  const channels = timeline.networks.map(() => new Set());
  for (const frame of timeline.frames) {
    frame.networks.forEach((values, network) => {
      for (const signal of Object.keys(values)) channels[network].add(Number(signal));
    });
  }
  return channels;
}

export function graphTraces(timeline, networks, signals) {
  if (networks.size * signals.size > MAX_GRAPH_TRACES) {
    return {traces: [], min: 0, max: 1, limited: true};
  }
  let min = 0, max = 1;
  const traces = [];
  for (const network of networks) for (const signal of signals) {
    const values = timeline.frames.map(frame => frame.networks[network]?.[signal] ?? 0);
    for (const value of values) { min = Math.min(min, value); max = Math.max(max, value); }
    const dash = ['', '7 3', '2 3', '9 3 2 3'][network % 4];
    traces.push({network, signal, values, dash,
      color: signals.size===1?(timeline.networks[network].color==='red'?'#d98577':'#8bc980'):`hsl(${Math.round(signal * 137.508 + 205) % 360} 65% 56%)`,
      label: `${networkLabel(timeline.networks[network])} · ${signalLabel(timeline.signals[signal])}`});
  }
  return {traces, min, max, limited: false};
}
