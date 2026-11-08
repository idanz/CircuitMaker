// Narrow synchronous reference model for cookbook assertions, not a game engine.
// It handles the operations used by these recipes and models one-tick stages.
export function simulate(bp){
 const parents=new Map(),entities=bp.entities,outputs=new Map();
 const key=(id,port)=>`${id}:${port}`;
 const find=k=>{if(!parents.has(k))parents.set(k,k);if(parents.get(k)!==k)parents.set(k,find(parents.get(k)));return parents.get(k);};
 for(const [i,p,j,q] of bp.wires??[])parents.set(find(key(i,p)),find(key(j,q)));
 const add=(into,signals)=>{for(const [s,n] of Object.entries(signals)){into[s]=((into[s]??0)+n)|0;if(!into[s])delete into[s];}return into;};
 const constants=e=>e.control_behavior.is_on===false?{}:Object.fromEntries(e.control_behavior.sections.sections.flatMap(s=>s.filters.map(f=>[f.name,f.count])));
 let nets=new Map();
 function rebuild(extra){nets=new Map();const inject=(id,p,signals)=>{const k=find(key(id,p));if(!nets.has(k))nets.set(k,{});add(nets.get(k),signals);};
  for(const e of entities){const single=!['decider-combinator','arithmetic-combinator'].includes(e.name);const signals=e.name==='constant-combinator'?constants(e):outputs.get(e.entity_number)??{};if(e.name==='constant-combinator'||!single)for(const port of single?[1,2]:[3,4])inject(e.entity_number,port,signals);}
  if(extra)inject(extra.entity,extra.port,extra.signals);
 }
 function network(id,p){return {...(nets.get(find(key(id,p)))??{})};}
 function input(id,selection={red:true,green:true}){const s={};if(selection.red!==false)add(s,network(id,1));if(selection.green!==false)add(s,network(id,2));return s;}
 const compare=(a,op,b)=>({'>':a>b,'<':a<b,'=':a===b,'≥':a>=b,'≤':a<=b,'≠':a!==b}[op]);
 const arithmetic=(a,op,b)=>{switch(op){case '+':return(a+b)|0;case '-':return(a-b)|0;case '*':return Math.imul(a,b);case '/':return b?Math.trunc(a/b)|0:0;case '^':return (a**b)|0;default:throw new Error(`Unmodeled operation ${op}`);}};
 function tick(extra){rebuild(extra);const next=new Map();
  for(const e of entities){const id=e.entity_number,cb=e.control_behavior;let out={};
   if(cb.arithmetic_conditions){const c=cb.arithmetic_conditions,left=input(id,c.first_signal_networks),right=input(id,c.second_signal_networks);const signal=c.first_signal?.name;const calculate=s=>arithmetic(signal?left[s]??0:c.first_constant,c.operation,c.second_signal?right[c.second_signal.name]??0:c.second_constant);
    if(signal==='signal-each')for(const s of Object.keys(left)){const target=c.output_signal.name==='signal-each'?s:c.output_signal.name;add(out,{[target]:calculate(s)});}else add(out,{[c.output_signal.name]:calculate(signal)});
   }else if(cb.decider_conditions){const params=cb.decider_conditions,c=params.conditions[0],bus=input(id,c.first_signal_networks),rhs=c.second_signal?input(id,c.second_signal_networks)[c.second_signal.name]??0:c.constant;const signal=c.first_signal.name,all=Object.keys(bus);const matched=all.filter(s=>compare(bus[s],c.comparator,rhs));const passed=signal==='signal-each'?matched.length>0:signal==='signal-anything'?matched.length>0:signal==='signal-everything'?matched.length===all.length:compare(bus[signal]??0,c.comparator,rhs);
    if(passed)for(const o of params.outputs){const counts=input(id,o.networks),name=o.signal.name;const channels=name==='signal-each'?matched:name==='signal-everything'?Object.keys(counts):[name];
      if(signal==='signal-each'&&name!=='signal-each')add(out,{[name]:matched.reduce((sum,s)=>sum+(o.copy_count_from_input?(counts[s]??0):o.constant??1),0)});
      else for(const s of channels)add(out,{[s]:o.copy_count_from_input?(counts[s]??0):o.constant??1});
    }
   }
   next.set(id,out);
  }
  outputs.clear();for(const [k,v]of next)outputs.set(k,v);rebuild();
 }
 rebuild();return{tick,network};
}
