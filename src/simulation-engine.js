// Shared by the Python and TypeScript execution workers. No DOM or language runtime dependencies.
const wildcard = signal => signal?.type === 'virtual' && ['signal-each','signal-anything','signal-everything'].includes(signal.name) ? signal.name.slice(7) : null;
const empty = () => Object.create(null);
function add(target, source) {
  for (const [signal,count] of Object.entries(source)) {
    const value=((target[signal]??0)+count)|0;
    if(value)target[signal]=value;else delete target[signal];
  }
  return target;
}
function compare(a,op,b) {
  switch(op){case '>':return a>b;case '<':return a<b;case '=':return a===b;case '≥':return a>=b;case '≤':return a<=b;case '≠':return a!==b;default:throw new Error(`Unsupported comparator ${op}`);}
}
export function arithmetic(a,op,b) {
  switch(op) {
    case '+':return(a+b)|0;case '-':return(a-b)|0;case '*':return Math.imul(a,b);
    case '/':return b?Math.trunc(a/b)|0:0;case '%':return b?(a%b)|0:0;
    case 'AND':return a&b;case 'OR':return a|b;case 'XOR':return a^b;
    case '<<':case '>>':
      if(b<0||b>31)throw new Error('Simulation currently supports shift counts 0..31.');
      return op==='<<'?a<<b:a>>b;
    case '^': {
      if(b<0)return Number.isFinite(a**b)?Math.trunc(a**b)|0:0;
      let base=BigInt.asUintN(32,BigInt(a)),exponent=BigInt(b),result=1n;
      while(exponent){if(exponent&1n)result=BigInt.asUintN(32,result*base);base=BigInt.asUintN(32,base*base);exponent>>=1n;}
      return Number(BigInt.asIntN(32,result));
    }
    default:throw new Error(`Unsupported arithmetic operation ${op}`);
  }
}

export function simulateScenario(plan) {
  if(!Number.isInteger(plan.ticks)||plan.ticks<1||plan.ticks>2000)throw new Error('Simulation ticks must be 1..2000.');
  const bp=plan.data?.blueprint,entities=bp?.entities;
  if(!Array.isArray(entities)||!entities.length||entities.length>256)throw new Error('Simulation requires 1..256 entities.');
  const allowed=new Set(['decider-combinator','arithmetic-combinator','constant-combinator','circuitmaker-driver']);
  if(entities.some(e=>!allowed.has(e.name)))throw new Error('Only Decider, Arithmetic, Constant and Driver can be simulated.');
  const ids=new Set(entities.map(e=>e.entity_number));if(ids.size!==entities.length)throw new Error('Duplicate simulation entity IDs.');
  const signals=[],signalIds=new Map();
  const signalId=signal=>{
    if(!signal||typeof signal.name!=='string')throw new Error('Invalid simulation signal.');
    const normalized={type:signal.type??'item',name:signal.name,quality:signal.quality??'normal'};
    const key=JSON.stringify(normalized);
    if(!signalIds.has(key)){if(signals.length>=2048)throw new Error('Simulation exceeds 2048 signals.');signalIds.set(key,signals.length);signals.push(normalized);}
    return signalIds.get(key);
  };
  const values=entries=>{
    const result=empty();
    for(const entry of entries??[]){if(!Number.isInteger(entry.count)||entry.count<-(2**31)||entry.count>=2**31)throw new Error('Simulation signal counts must be signed 32-bit integers.');if(wildcard(entry.signal??entry))throw new Error('Sources cannot emit wildcard signals.');add(result,{[signalId(entry.signal??entry)]:entry.count});}
    return result;
  };
  const parents=new Map();const key=(id,port)=>`${id}:${port}`;
  const find=value=>{if(!parents.has(value))parents.set(value,value);let root=value;while(parents.get(root)!==root)root=parents.get(root);while(value!==root){const next=parents.get(value);parents.set(value,root);value=next;}return root;};
  const source=e=>['constant-combinator','circuitmaker-driver'].includes(e.name);
  for(const e of entities)for(const port of source(e)?[1,2]:[1,2,3,4])find(key(e.entity_number,port));
  for(const [a,p,b,q]of bp.wires??[]){if(!ids.has(a)||!ids.has(b)||![1,2,3,4].includes(p)||![1,2,3,4].includes(q)||p%2!==q%2||!parents.has(key(a,p))||!parents.has(key(b,q)))throw new Error('Invalid simulation wire.');parents.set(find(key(a,p)),find(key(b,q)));}
  const networks=[],roots=new Map(),ports=new Map();
  for(const e of entities)for(const connector of source(e)?[1,2]:[1,2,3,4]){
    const root=find(key(e.entity_number,connector));
    if(!roots.has(root)){roots.set(root,networks.length);networks.push({id:networks.length,color:connector%2?'red':'green',ports:[],connected:false});}
    const index=roots.get(root);ports.set(key(e.entity_number,connector),index);
    networks[index].ports.push({entity:e.entity_number,port:source(e)||connector>=3?'output':'input'});
  }
  for(const [a,p]of bp.wires??[])networks[ports.get(key(a,p))].connected=true;
  const drivers=new Map(),constants=new Map();
  for(const e of entities){
    if(e.driver){
      const events=(e.driver.events??[]).map((event,index)=>{
        if(!Number.isInteger(event.tick)||event.tick<0||event.tick>2000||(event.duration!==undefined&&(!Number.isInteger(event.duration)||event.duration<1||event.duration>2000)))throw new Error('Invalid Driver schedule.');
        if(event.reset_others!==undefined&&typeof event.reset_others!=='boolean')throw new Error('Invalid Driver reset_others flag.');
        const counts=values(event.signals);
        // Preserve explicit zeros so an update can remove a previously held signal.
        for(const entry of event.signals??[])counts[signalId(entry.signal??entry)]??=0;
        return{...event,index,values:counts};
      }).sort((a,b)=>a.tick-b.tick||a.index-b.index);
      drivers.set(e.entity_number,{initial:values(e.driver.initial),events});
    }
    if(e.name==='constant-combinator'){
      const signals=empty();if(e.control_behavior?.is_on!==false)for(const section of e.control_behavior?.sections?.sections??[])if(section.active!==false)add(signals,values(section.filters));constants.set(e.entity_number,signals);
    }
    const behavior=e.control_behavior??{},math=behavior.arithmetic_conditions,decider=behavior.decider_conditions;
    if(math){
      for(const field of ['first_signal','second_signal','output_signal'])if(math[field])signalId(math[field]);
      if(['anything','everything'].includes(wildcard(math.first_signal))||['anything','everything'].includes(wildcard(math.second_signal)))throw new Error('Arithmetic simulations support specific signals or Each.');
      if(wildcard(math.first_signal)==='each'&&wildcard(math.second_signal)==='each')throw new Error('Arithmetic may use Each in only one operand.');
    }
    if(decider){
      for(const condition of decider.conditions??[]){if(condition.first_signal)signalId(condition.first_signal);if(condition.second_signal)signalId(condition.second_signal);if(['anything','everything'].includes(wildcard(condition.second_signal)))throw new Error('Anything and Everything are not supported as second operands in simulations.');}
      for(const output of decider.outputs??[])signalId(output.signal);
    }
  }
  const scheduled=(driver,tick)=>{
    let held=add(empty(),driver.initial);
    for(const event of driver.events)if(event.duration===undefined&&event.tick<=tick){
      if(event.reset_others)held=empty();
      for(const [signal,count]of Object.entries(event.values)){
        if(count)held[signal]=count;else delete held[signal];
      }
    }
    const result=add(empty(),held);for(const event of driver.events)if(event.duration!==undefined&&event.tick<=tick&&tick<event.tick+event.duration)add(result,event.values);return result;
  };
  let outputs=new Map(),nets=[],bytes=0;const frames=[];
  const read=(id,selection={red:true,green:true})=>{
    const result=empty();for(const [color,connector]of [['red',1],['green',2]])if(selection[color]!==false)add(result,nets[ports.get(key(id,connector))]??{});return result;
  };
  function evaluate(e) {
    const id=e.entity_number,behavior=e.control_behavior??{},out=empty();
    const math=behavior.arithmetic_conditions;
    if(math){
      const left=read(id,math.first_signal_networks),right=read(id,math.second_signal_networks);
      const eachLeft=wildcard(math.first_signal)==='each',eachRight=wildcard(math.second_signal)==='each';
      const candidates=eachLeft?Object.keys(left):eachRight?Object.keys(right):[null];
      if(wildcard(math.output_signal)&&!(eachLeft||eachRight))throw new Error('Each output requires an Each operand.');
      for(const candidate of candidates){
        const a=math.first_signal?(left[eachLeft?candidate:signalId(math.first_signal)]??0):math.first_constant??0;
        const b=math.second_signal?(right[eachRight?candidate:signalId(math.second_signal)]??0):math.second_constant??0;
        const target=wildcard(math.output_signal)==='each'?candidate:signalId(math.output_signal);
        add(out,{[target]:arithmetic(a,math.operation,b)});
      }
      return {out};
    }
    const decider=behavior.decider_conditions;if(!decider)return {out};
    const groups=[];for(const condition of decider.conditions??[]){if(!groups.length||condition.compare_type==='or')groups.push([]);groups.at(-1).push(condition);}
    const eachInputs=groups.flat().flatMap(c=>[['first_signal','first_signal_networks'],['second_signal','second_signal_networks']].filter(([field])=>wildcard(c[field])==='each').map(([,selection])=>read(id,c[selection])));
    const candidates=eachInputs.length?[...new Set(eachInputs.flatMap(bus=>Object.keys(bus)))]:[null];
    const rows=groups.map(group=>group.map(()=>false)),matched=[];
    for(const candidate of candidates){
      const passed=groups.map((group,g)=>group.map((c,r)=>{
        const left=read(id,c.first_signal_networks),right=read(id,c.second_signal_networks),kind=wildcard(c.first_signal);
        const rhs=c.second_signal?(right[wildcard(c.second_signal)==='each'?candidate:signalId(c.second_signal)]??0):c.constant??0;
        let truth;
        if(kind==='anything'||kind==='everything'){
          const values=Object.values(left);truth=kind==='anything'?values.some(value=>compare(value,c.comparator,rhs)):values.every(value=>compare(value,c.comparator,rhs));
        }else truth=compare(left[kind==='each'?candidate:signalId(c.first_signal)]??0,c.comparator,rhs);
        rows[g][r] ||= truth;return truth;
      }).every(Boolean)).some(Boolean);
      if(passed)matched.push(candidate);
    }
    for(const output of decider.outputs??[]){
      const pass=matched.length>0;if(!pass)continue;
      const counts=read(id,output.networks),kind=wildcard(output.signal),copy=output.copy_count_from_input!==false;
      if(eachInputs.length&&kind==='everything')throw new Error('Everything output cannot be combined with Each conditions.');
      if(kind==='each'&&!eachInputs.length)throw new Error('Each output requires Each conditions.');
      let targets=kind==='each'?matched:kind==='everything'?Object.keys(counts):kind==='anything'?(eachInputs.length?matched:Object.keys(counts)):[signalId(output.signal)];
      if(kind==='anything'&&targets.length>1)throw new Error('Anything output with multiple candidates needs Factorio signal ordering. Use one output candidate at a time in this simulation.');
      for(const target of targets){
        const count=eachInputs.length&&!kind?matched.reduce((sum,candidate)=>(sum+(copy?(counts[candidate]??0):output.constant??1))|0,0):copy?(counts[target]??0):output.constant??1;
        add(out,{[target]:count});
      }
    }
    return {out,conditions:rows};
  }
  for(let tick=0;tick<=plan.ticks;tick++){
    nets=networks.map(()=>empty());const current=new Map(outputs);
    for(const e of entities){
      const id=e.entity_number;
      if(constants.has(id))current.set(id,constants.get(id));if(drivers.has(id))current.set(id,scheduled(drivers.get(id),tick));
      const emitterPorts=source(e)?[1,2]:[3,4];
      for(const net of new Set(emitterPorts.map(p=>ports.get(key(id,p)))))add(nets[net],current.get(id)??{});
    }
    const next=new Map(),conditions={};
    for(const e of entities)if(!source(e)){const evaluated=evaluate(e);next.set(e.entity_number,evaluated.out);if(evaluated.conditions)conditions[e.entity_number]=evaluated.conditions;}
    const frame={tick,networks:nets,outputs:Object.fromEntries(current),conditions};
    bytes+=JSON.stringify(frame).length;if(bytes>2_500_000)throw new Error('Simulation timeline exceeds 2.5 MB. Reduce ticks, entities or signals.');
    frames.push(frame);outputs=next;
  }
  for(const expectation of plan.expectations??[]) {
    const {tick,entity,color,port='input'}=expectation;
    if(!Number.isInteger(tick)||tick<0||tick>plan.ticks||!ids.has(entity))throw new Error('Invalid simulation expectation tick or entity.');
    let bus=frames[tick].outputs[entity]??{};
    if(color!==undefined){
      if(!['red','green'].includes(color)||!['input','output'].includes(port))throw new Error('Invalid expectation network color or port.');
      const network=networks.find(n=>n.color===color&&n.ports.some(p=>p.entity===entity&&p.port===port));
      if(!network)throw new Error('Entity has no such simulation port.');
      bus=frames[tick].networks[network.id];
    }
    if(!Array.isArray(expectation.signals)||!expectation.signals.length)throw new Error('Expectations require specific signals.');
    for(const {signal,count:expected} of expectation.signals){
      if(wildcard(signal)||!Number.isInteger(expected)||expected<-(2**31)||expected>=2**31)throw new Error('Expectations require fixed counts for specific signals.');
      const identity={type:signal.type??'item',name:signal.name,quality:signal.quality??'normal'};
      const index=signalIds.get(JSON.stringify(identity)),actual=bus[index]??0;
      if(actual!==expected){
        const label=bp.description?.split('\n').find(line=>line.startsWith(`${entity}: `))?.slice(`${entity}: `.length)??entities.find(e=>e.entity_number===entity).name;
        const location=color===undefined?'output':`${color} ${port} network`;
        const error=new Error(`Simulation ${JSON.stringify(plan.name)}, tick ${tick}, ${JSON.stringify(label)} (entity ${entity}) ${location}: ${identity.type}:${identity.name} [${identity.quality}] expected ${expected}, got ${actual}.`);
        error.name='SimulationAssertionError';throw error;
      }
    }
  }
  return {name:plan.name,data:plan.data,timeline:{signals,networks,frames,ticks:plan.ticks}};
}

export function runSimulations(plans=[]) {
  if(!Array.isArray(plans)||plans.length>8)throw new Error('Define up to 8 simulations per script.');
  if(new Set(plans.map(p=>p.name)).size!==plans.length)throw new Error('Simulation names must be unique.');
  const results=plans.map(simulateScenario);
  if(JSON.stringify(results).length>3_000_000)throw new Error('Combined simulations exceed 3 MB. Reduce the scenario count or ticks.');
  return results;
}
