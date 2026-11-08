// Index observed channels once so a signal remains visible when its count returns to zero.
export function inspectionChannels(timeline) {
  const networks=timeline.networks.map(()=>new Set()),outputs=new Map();
  for(const frame of timeline.frames){
    frame.networks.forEach((bus,i)=>Object.keys(bus).forEach(id=>networks[i].add(Number(id))));
    for(const [entity,bus]of Object.entries(frame.outputs)){
      if(!outputs.has(Number(entity)))outputs.set(Number(entity),new Set());
      Object.keys(bus).forEach(id=>outputs.get(Number(entity)).add(Number(id)));
    }
  }
  return {networks,outputs};
}

export function inspectSimulation(context,channels,entity,{port,color}={}) {
  const {timeline,frame}=context;
  const values=(bus,ids)=>[...(ids??[])].sort((a,b)=>a-b).map(id=>({signal:timeline.signals[id],count:bus?.[id]??0}));
  const sections=[];
  if(!port)sections.push({title:'Emitted output',values:values(frame.outputs[entity],channels.outputs.get(entity))});
  for(const network of timeline.networks){
    const ports=network.ports.filter(p=>p.entity===entity&&(!port||p.port===port));
    if(!ports.length||(color&&network.color!==color)||(!port&&!network.connected))continue;
    const name=`${network.color==='red'?'Red R':'Green G'}${network.id+1}`;
    sections.push({network:network.id,color:network.color,title:`${name} · ${[...new Set(ports.map(p=>p.port))].join(' / ')}`,values:values(frame.networks[network.id],channels.networks[network.id])});
  }
  return sections;
}
