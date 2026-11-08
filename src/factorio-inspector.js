const el = (tag, name, text) => {
  const node = document.createElement(tag); node.className = name;
  if (text !== undefined) node.textContent = text;
  return node;
};
const symbols = { '*':'×', '/':'÷', '!=':'≠', '>=':'≥', '<=':'≤' };
const spriteSizes = { Decider:[156,132], Arithmetic:[144,124], Constant:[114,102] };

export function inspectorSignals(entity) {
  const inputs = [], outputs = [];
  if (entity.groups) {
    for (const group of entity.groups) for (const condition of group) {
      if (condition.left.signal) inputs.push(condition.left.signal);
      if (condition.right.signal) inputs.push(condition.right.signal);
    }
    for (const output of entity.outputs) {
      if (output.copy) inputs.push(output.signal);
      outputs.push({ signal:output.signal, count:output.copy ? null : output.count });
    }
  } else if (entity.arithmetic) {
    const math = entity.arithmetic;
    if (math.left.signal) inputs.push(math.left.signal);
    if (math.right.signal) inputs.push(math.right.signal);
    if (math.output) outputs.push({signal:math.output,count:null});
  } else for (const section of entity.sections ?? []) for (const slot of section.slots) outputs.push({signal:slot,count:slot.count});
  const unique = values => [...new Map(values.map(signal => [`${signal.type ?? 'item'}:${signal.name}:${signal.quality ?? 'normal'}`,signal])).values()];
  return {inputs:unique(inputs),outputs};
}

export function renderFactorioInspector(container, entity, circuit, icon, simulation) {
  container.replaceChildren(); container.dataset.type=entity.type.toLowerCase();
  const signalKey=signal=>`${signal.type??'item'}:${signal.name}:${signal.quality??'normal'}`;
  const signalIds=new Map((simulation?.timeline.signals??[]).map((s,i)=>[signalKey(s),i]));
  const inputValues=(selection={red:true,green:true})=>{
    const values={};
    for(const network of simulation?.timeline.networks??[])if(selection[network.color]!==false&&network.ports.some(p=>p.entity===entity.id&&p.port==='input'))for(const [signal,count]of Object.entries(simulation.frame.networks[network.id])){
      values[signal]=((values[signal]??0)+count)|0;if(!values[signal])delete values[signal];
    }
    return values;
  };
  const currentOutput=simulation?.frame.outputs[entity.id]??{};
  const inputCount=(signal,selection)=>inputValues(selection)[signalIds.get(signalKey(signal))]??0;
  const outputCount=signal=>currentOutput[signalIds.get(signalKey(signal))]??0;
  const captured=values=>Object.entries(values).map(([i,count])=>({signal:simulation.timeline.signals[Number(i)],count}));
  const frame = el('div','fui-window'); container.append(frame);
  const title = el('header','fui-title'); title.append(el('h3','',entity.driver?'Simulation Driver':`${entity.type} combinator`),el('span','fui-title-grip'),el('span','fui-entity-id',`#${entity.id}`)); frame.append(title);
  const connectionBar=el('div','fui-connection-bar');
  for(const port of ['Constant','Driver'].includes(entity.type)?['output']:['input','output']) {
    const line=el('div','fui-port-summary');
    const wires=circuit.wires.flatMap(w=>[w.from,w.to]).filter(endpoint=>endpoint.id===entity.id&&endpoint.port===port);
    if(entity.type!=='Constant')line.append(el('strong','',port==='input'?'Input:':'Output:'),el('span','','Connected to:'));
    else if(wires.length)line.append(el('span','','Connected to network:'));
    for(const color of ['red','green']) {
      const network=simulation?.timeline.networks.find(n=>n.color===color&&n.ports.some(p=>p.entity===entity.id&&p.port===port));
      if(wires.some(w=>w.color===color)||(network&&port==='output'&&!entity.driver))line.append(el('span',`fui-network-label ${color}`,`${color==='red'?'Red':'Green'}${network?` · ${color==='red'?'R':'G'}${network.id+1}${network.connected?'':' (unwired)'}`:''}`));
    }
    if(!wires.length&&(!(simulation&&port==='output')||entity.driver))line.append(el('span','fui-muted','Not connected'));
    connectionBar.append(line);
  }
  frame.append(connectionBar);
  const status=el('div','fui-preview-status');status.append(el('span','fui-status-dot'),el('span',simulation?'fui-simulation-status':'',simulation?`Simulation · tick ${simulation.frame.tick}`:'Blueprint configuration'),el('span','fui-muted',simulation?(entity.type==='Driver'||entity.type==='Constant'?'Source signals are available immediately at this tick':'Conditions evaluate this tick; outputs have one-tick delay'):'Read only · Live values unavailable'));frame.append(status);
  const stage=el('div','fui-entity-stage');stage.setAttribute('aria-label',`${entity.type} combinator entity preview`);
  const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 800 140');svg.setAttribute('preserveAspectRatio','none');svg.setAttribute('aria-hidden','true');stage.append(svg);
  const activeColors=[...new Set(circuit.wires.filter(w=>w.from.id===entity.id||w.to.id===entity.id).map(w=>w.color))];
  for(const [index,color]of activeColors.entries()){
    const path=document.createElementNS(svg.namespaceURI,'path');path.setAttribute('d',`M ${210+index*80},145 Q 470,110 390,20`);path.setAttribute('class',`fui-stage-wire ${color}`);svg.append(path);
  }
  const [width,height]=spriteSizes[entity.type]??spriteSizes.Decider;
  const sprite=el('span','fui-entity-sprite');const scale=.68,rotation=Math.floor((entity.entity.direction??0)/4)%4;
  Object.assign(sprite.style,{width:`${width*scale}px`,height:`${height*scale}px`,backgroundImage:`url('/inspector/${entity.entity.name}.png')`,backgroundSize:`${width*4*scale}px ${height*scale}px`,backgroundPosition:`-${rotation*width*scale}px 0`});
  if(entity.driver)stage.append(el('span','fui-driver-source','DRIVER'));else stage.append(sprite);
  const indicator=el('span','fui-display-symbol',entity.arithmetic ? entity.arithmetic.operation : entity.groups?.[0]?.[0]?.comparator??'');stage.append(indicator);
  if(!['Constant','Driver'].includes(entity.type))stage.append(el('span','fui-direction top'),el('span','fui-direction bottom'));frame.append(stage);

  function slot(signal,count) {
    const node=el('span','fui-slot');node.append(icon(signal,32));
    const name=`${signal.name}${signal.quality&&signal.quality!=='normal'?` (${signal.quality})`:''}`;
    node.title=`${name}${count!==undefined&&count!==null?`: ${count}`:''}`;node.setAttribute('aria-label',node.title);
    node.append(el('span','fui-sr-only',name));
    if(count!==undefined&&count!==null)node.append(el('span','fui-slot-count',String(count)));
    if(signal.quality&&signal.quality!=='normal')node.append(el('span','fui-quality',signal.quality.slice(0,1).toUpperCase()));
    return node;
  }
  function networks(colors,muted=false) {
    const node=el('span',`fui-networks${muted?' muted':''}`);
    for(const color of ['red','green']){
      const selected=colors.includes(color),line=el('span',`fui-network-row ${color}${selected?' selected':''}`);
      line.setAttribute('aria-label',`${color} input ${selected?'selected':'not selected'}`);
      line.append(el('span','fui-check',selected?'✓':''),el('span','',color==='red'?'R':'G'));node.append(line);
    }
    return node;
  }
  function operand(value) {
    const node=el('span','fui-operand');
    if(value.signal)node.append(slot(value.signal,simulation?inputCount(value.signal,value.networks):undefined));else node.append(el('span','fui-value',String(value.value)));
    return node;
  }
  function panel(title,className) {
    const node=el('section',`fui-panel ${className}`);node.append(el('h4','',title));return node;
  }
  function tray(title,signals,known=false) {
    const node=panel(title,'fui-signals');const grid=el('div','fui-signal-tray');
    grid.title=simulation?'Captured signal values at the selected simulation tick.':known?'Configured output signals and fixed counts; copied input counts are unknown until run in Factorio.':'Signals referenced by the configuration. No live input counts are available.';
    for(const value of signals)grid.append(slot(known?value.signal:value,known?value.count:undefined));
    for(let index=signals.length;index<12;index++)grid.append(el('span','fui-empty-slot'));
    node.append(grid);return node;
  }
  function disabledAction(text) {
    const button=el('button','fui-add',text);button.disabled=true;button.title='Edit the source code to change this configuration.';return button;
  }
  const columns=el('div','fui-columns'),left=el('div','fui-column'),right=el('div','fui-column');columns.append(left,right);frame.append(columns);
  if(entity.groups) {
    const conditions=panel('Conditions','fui-conditions');const inset=el('div','fui-inset'),tree=el('div','fui-condition-tree');
    entity.groups.forEach((group,groupIndex)=>{
      const groupNode=el('div','fui-logic-group');
      group.forEach((condition,rowIndex)=>{
        const line=el('div','fui-tree-line'),join=el('span',`fui-join${rowIndex?' and':''}`);
        if(groupIndex||rowIndex)join.append(el('span','fui-logic-button',rowIndex?'AND':'OR'));
        const row=el('div','fui-rule');row.tabIndex=0;row.setAttribute('aria-label',`Condition ${groupIndex+1}.${rowIndex+1}`);
        if(simulation?.frame.conditions[entity.id]?.[groupIndex]?.[rowIndex])row.classList.add('is-true');
        const comparator=el('span','fui-comparator',symbols[condition.comparator]??condition.comparator);comparator.append(el('span','fui-caret','▾'));
        row.append(networks(condition.left.networks??['red','green']),operand(condition.left),comparator,networks(condition.right.networks??['red','green'],!condition.right.signal),operand(condition.right),el('span','fui-row-grip'));
        row.addEventListener('click',()=>{tree.querySelectorAll('.is-selected').forEach(n=>n.classList.remove('is-selected'));row.classList.add('is-selected');});
        line.append(join,row);groupNode.append(line);
      });tree.append(groupNode);
    });
    inset.append(tree,disabledAction('+ Add condition'));conditions.append(inset);left.append(conditions);
    const outputs=panel('Outputs','fui-outputs'),list=el('div','fui-inset fui-output-list');
    for(const output of entity.outputs){
      const row=el('div','fui-output'),modes=el('div','fui-modes');
      const fixed=el('span','fui-mode');fixed.append(el('span',`fui-radio${!output.copy?' selected':''}`),el('span','',String(output.count)));
      const copy=el('span','fui-mode');copy.append(el('span',`fui-radio${output.copy?' selected':''}`),el('span','','Input count'),networks(output.networks,!output.copy));
      modes.append(fixed,copy);row.append(slot(output.signal,simulation?outputCount(output.signal):undefined),modes,el('span','fui-row-grip'));list.append(row);
    }
    list.append(disabledAction('+ Add output'));outputs.append(list);right.append(outputs);
  } else if(entity.arithmetic){
    const math=entity.arithmetic,p=panel('Input','fui-arithmetic-input'),row=el('div','fui-arithmetic-row');
    const operation=el('span','fui-comparator',math.operation);operation.append(el('span','fui-caret','▾'));
    row.append(networks(math.left.networks??['red','green'],!math.left.signal),operand(math.left),operation,networks(math.right.networks??['red','green'],!math.right.signal),operand(math.right));p.append(row);left.append(p);
    const out=panel('Output','fui-arithmetic-output');if(math.output)out.append(slot(math.output,simulation?outputCount(math.output):undefined));right.append(out);
  } else if(entity.driver) {
    columns.classList.add('constant');const p=panel('Scheduled signal source','fui-driver'),schedule=el('div','fui-driver-events');
    const describe=signals=>(signals??[]).map(o=>`${o.signal.name}: ${o.count}`).join(', ')||'0';
    schedule.append(el('p','',`Initial held values: ${describe(entity.driver.initial)}`));
    for(const event of entity.driver.events??[])schedule.append(el('div','',`Tick ${event.tick}: ${event.duration?`pulse for ${event.duration} tick(s)`:'replace held values'} · ${describe(event.signals)}`));
    p.append(schedule);left.append(p);
    if(simulation)left.append(tray('Injected signals at this tick',captured(currentOutput),true));
  } else {
    columns.classList.add('constant');const p=panel('Output','fui-constant');
    const state=el('div',`fui-constant-toggle${entity.enabled?' enabled':''}`);state.setAttribute('role','img');state.setAttribute('aria-label',entity.enabled?'Output on':'Output off');
    state.append(el('span','fui-off-label','Off'),el('span','fui-toggle-track'),el('span','fui-on-label','On'));p.append(state);
    const inset=el('div','fui-inset fui-constant-sections');
    for(const section of entity.sections??[]){
      const block=el('div',`fui-constant-section${section.enabled?'':' inactive'}`);
      const heading=el('div','fui-section-heading');heading.setAttribute('aria-label',`${section.group||'No group assigned'}, ${section.enabled?'enabled':'disabled'}`);
      heading.append(el('span','fui-check',section.enabled?'✓':''),el('strong','',section.group||'[No group assigned]'),el('span','fui-section-pencil','✎'),el('span','fui-row-grip'));
      const remove=el('button','fui-remove-section','▥');remove.disabled=true;remove.setAttribute('aria-label','Remove section');remove.title='Edit the source code to remove a section.';heading.append(remove);block.append(heading);
      const grid=el('div','fui-signal-tray fui-constant-slots');for(const value of section.slots)grid.append(slot(value,value.count));for(let i=section.slots.length;i<20;i++)grid.append(el('span','fui-empty-slot'));block.append(grid);inset.append(block);
    }
    inset.append(disabledAction('Add section'));p.append(inset);left.append(p);
  }
  const signals=inspectorSignals(entity);
  if(!['Constant','Driver'].includes(entity.type)) {
    left.append(simulation?tray(`Input signals · tick ${simulation.frame.tick}`,captured(inputValues()),true):tray('Input signals · referenced',signals.inputs));
    right.append(simulation?tray(`Output signals · tick ${simulation.frame.tick}`,captured(currentOutput),true):tray('Output signals · configured',signals.outputs,true));
  }
  const footer=el('footer','fui-footer');footer.append(el('span','fui-description',entity.label),el('span','fui-muted','Edit configuration in source'));frame.append(footer);
}
