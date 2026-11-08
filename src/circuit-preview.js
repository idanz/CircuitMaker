import { renderFactorioInspector } from './factorio-inspector';
import { describeCircuit } from './circuit-model.js';
import {layoutCircuit} from './circuit-layout.js';
import {inspectionChannels,inspectSimulation} from './simulation-inspection.js';
import {signalLabel,networkLabel} from './simulation-chart.js';
import './circuit-preview.css';

const element = (tag, className, text) => {
  const node = document.createElement(tag); node.className = className ?? '';
  if (text !== undefined) node.textContent = text;
  return node;
};
export function createCircuitPreview(container,{simulation=false}={}) {
  let data, lastMessage, catalog = new Map(), circuit, selected, zoom = 1, diagram, inspector, map, scene, dimensions, entitySelect, layoutOpen = simulation;
  let configurationOpen=!simulation,tooltip,hoverTarget,observedTimeline,observedChannels;
  let expandButton, restoreFocus;
  let extraHeader, expandTarget, simulationContext;
  const collapse = () => {container.classList.remove('is-expanded');container.removeAttribute('aria-modal');container.removeAttribute('role');if(expandButton){expandButton.textContent='Expand';expandButton.setAttribute('aria-expanded','false');}restoreFocus?.focus();};
  document.addEventListener('keydown',event=>{
    if(!container.classList.contains('is-expanded'))return;
    if(event.key==='Escape'){event.preventDefault();collapse();}
    if(event.key==='Tab'){
      const focusable=[...container.querySelectorAll('button:not(:disabled),select,input:not(:disabled),summary,[tabindex="0"]')].filter(node=>node.offsetParent!==null);
      const first=focusable[0],last=focusable.at(-1);
      if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}
      else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}
    }
  });
  const icon = (signal, size = 24) => {
    const node = element('span', 'signal-thumbnail circuit-icon'); node.setAttribute('aria-hidden', 'true');
    const item = catalog.get(`${signal.type ?? 'item'}:${signal.name}`);
    if (!item?.icons?.length) { node.textContent = signal.name === 'signal-each' ? '*' : signal.name === 'signal-anything' ? '?' : signal.name === 'signal-everything' ? '∀' : '◇'; return node; }
    for (const layer of item.icons) {
      const image = element('span'); const scale = (layer.scale ?? 32 / layer.size) * size / 32;
      Object.assign(image.style, { width: `${layer.size * scale}px`, height: `${layer.size * scale}px`, backgroundImage: `url("${layer.src}")`, backgroundSize: `${layer.width * scale}px ${layer.height * scale}px`, left: `calc(50% + ${(layer.shift[0] ?? 0) * size / 32}px)`, top: `calc(50% + ${(layer.shift[1] ?? 0) * size / 32}px)` });
      node.append(image);
    }
    return node;
  };
  function hideTooltip(){hoverTarget?.removeAttribute('aria-describedby');hoverTarget=null;if(tooltip)tooltip.hidden=true;}
  function showTooltip(target){
    if(!simulationContext||!tooltip||!target)return;
    if(hoverTarget!==target)hoverTarget?.removeAttribute('aria-describedby');hoverTarget=target;const id=Number(target.dataset.entity??target.dataset.from);
    const entity=circuit.entities.find(e=>e.id===id);if(!entity)return;
    const port=target.dataset.simulationPort??target.dataset.fromPort,color=target.dataset.color;
    const sections=inspectSimulation(simulationContext,observedChannels,id,{port,color});
    tooltip.replaceChildren(element('strong','circuit-tooltip-title',`${entity.label} · tick ${simulationContext.frame.tick}`));
    for(const section of sections){
      const group=element('div','circuit-tooltip-section');group.append(element('span',`circuit-tooltip-heading ${section.color??''}`,section.title));
      if(!section.values.length)group.append(element('span','circuit-tooltip-empty','No signals · 0'));
      for(const {signal,count}of section.values.slice(0,8)){
        const row=element('div','circuit-tooltip-signal');row.title=`${signalLabel(signal)} · ${signal.type??'item'} · ${signal.name}`;row.setAttribute('role','group');row.setAttribute('aria-label',`${signalLabel(signal)}: ${count}`);row.append(icon(signal,20),element('strong','',String(count)));group.append(row);
      }
      if(section.values.length>8)group.append(element('span','circuit-tooltip-empty',`+${section.values.length-8} more signals`));
      tooltip.append(group);
    }
    tooltip.hidden=false;target.setAttribute('aria-describedby',tooltip.id);
    const box=target.getBoundingClientRect(),bounds=tooltip.getBoundingClientRect();
    tooltip.style.left=`${Math.max(8,Math.min(innerWidth-bounds.width-8,box.left))}px`;
    tooltip.style.top=`${box.bottom+8+bounds.height<innerHeight?box.bottom+8:Math.max(8,box.top-bounds.height-8)}px`;
  }
  function updateSimulationDiagram(){
    if(!simulationContext||!scene)return;
    if(observedTimeline!==simulationContext.timeline){observedTimeline=simulationContext.timeline;observedChannels=inspectionChannels(observedTimeline);}
    for(const node of scene.querySelectorAll('.circuit-node')){
      const id=Number(node.dataset.entity),signals=node.querySelector('.circuit-node-signals'),entity=circuit.entities.find(e=>e.id===id);if(!signals)continue;
      signals.replaceChildren(element('small','','Out'));
      const ids=[...(observedChannels.outputs.get(id)??[])];
      for(const i of ids.slice(0,4)){const signal=observedTimeline.signals[i],badge=icon(signal,18);badge.title=signalLabel(signal);signals.append(badge);}
      if(ids.length>4)signals.append(element('small','',`+${ids.length-4}`));
      if(!ids.length)signals.append(element('small','','0'));
      for(const dot of node.querySelectorAll('[data-simulation-port]')){
        const network=observedTimeline.networks.find(n=>n.color===dot.dataset.color&&n.ports.some(p=>p.entity===id&&p.port===dot.dataset.simulationPort));
        dot.textContent=network&&(network.connected||(entity.type!=='Driver'&&dot.dataset.simulationPort==='output'))?networkLabel(network):'';
        dot.classList.toggle('is-plotted',!!network&&!!simulationContext.selectedNetworks?.has(network.id));
      }
    }
    for(const wire of scene.querySelectorAll('.circuit-wire')){
      const network=observedTimeline.networks.find(n=>n.color===wire.dataset.color&&n.ports.some(p=>p.entity===Number(wire.dataset.from)&&p.port===wire.dataset.fromPort));
      wire.classList.toggle('is-plotted',!!network&&!!simulationContext.selectedNetworks?.has(network.id));
    }
    if(hoverTarget?.isConnected)showTooltip(hoverTarget);
  }
  function inspect() {
    const entity = circuit.entities.find(entity => entity.id === selected);
    if (!entity) return;
    renderFactorioInspector(inspector, entity, circuit, icon, simulationContext);
    if (entitySelect) entitySelect.value = String(selected);
    for (const node of diagram.querySelectorAll('.circuit-node')) node.setAttribute('aria-pressed', String(Number(node.dataset.entity) === selected));
    for (const wire of diagram.querySelectorAll('[data-from]')) wire.classList.toggle('connected', Number(wire.dataset.from) === selected || Number(wire.dataset.to) === selected);
  }
  function applyZoom() {
    scene.style.transform = `scale(${zoom})`; map.style.width = `${dimensions.width * zoom}px`; map.style.height = `${dimensions.height * zoom}px`;
    if(simulation){scene.style.left=`${Math.max(0,(diagram.clientWidth-dimensions.width*zoom)/2)}px`;scene.style.top=`${Math.max(0,(diagram.clientHeight-dimensions.height*zoom)/2)}px`;}
  }
  const layoutSize=new ResizeObserver(()=>{if(scene&&dimensions)applyZoom();});
  function draw() {
    const ns = 'http://www.w3.org/2000/svg';
    const positions = layoutCircuit(circuit);
    dimensions = { width: Math.max(360, ...[...positions.values()].map(p => p.x + 205)), height: Math.max(170, ...[...positions.values()].map(p => p.y + 125)) };
    map = element('div', 'circuit-map'); scene = element('div', 'circuit-scene');
    Object.assign(scene.style, {width:`${dimensions.width}px`,height:`${dimensions.height}px`}); map.append(scene); diagram.append(map);
    const svg = document.createElementNS(ns, 'svg'); svg.setAttribute('width', dimensions.width); svg.setAttribute('height', dimensions.height); svg.setAttribute('aria-label', 'Circuit wire connections'); scene.append(svg);
    const point = endpoint => { const p = positions.get(endpoint.id); return {x: p.x + (endpoint.port === 'input' ? 0 : 136), y: p.y + (endpoint.color === 'red' ? 32 : 46)}; };
    for (const wire of circuit.wires) {
      const a = point(wire.from), b = point(wire.to), self = wire.from.id === wire.to.id;
      const path = document.createElementNS(ns,'path');
      path.setAttribute('d', self ? `M${a.x},${a.y} C${a.x+75},${a.y-100} ${b.x-75},${b.y-100} ${b.x},${b.y}` : `M${a.x},${a.y} C${a.x+(wire.from.port==='output'?55:-55)},${a.y-25} ${b.x+(wire.to.port==='output'?55:-55)},${b.y-25} ${b.x},${b.y}`);
      path.setAttribute('class', `circuit-wire ${wire.color}`); path.dataset.from=wire.from.id; path.dataset.to=wire.to.id;path.dataset.fromPort=wire.from.port;path.dataset.color=wire.color;
      const description=`${wire.color}: #${wire.from.id} ${wire.from.port} ↔ #${wire.to.id} ${wire.to.port}`;
      if(simulation){const hit=path.cloneNode();hit.setAttribute('class','circuit-wire-hit');hit.setAttribute('tabindex','0');hit.setAttribute('aria-label',description);svg.append(path,hit);}
      else{const title = document.createElementNS(ns,'title'); title.textContent=description;path.append(title);svg.append(path);}
    }
    for (const entity of circuit.entities) {
      const p = positions.get(entity.id), node = element('button','circuit-node'); node.type='button'; node.dataset.entity=entity.id;
      Object.assign(node.style,{left:`${p.x}px`,top:`${p.y}px`}); node.setAttribute('aria-label',`Inspect ${entity.label}, ${entity.type}, entity ${entity.id}`);
      const top = element('span','circuit-node-top'); top.append(icon({name:entity.entity.name,type:'item'}),element('span','',`#${entity.id} ${entity.type}`));
      node.append(top,element('span','circuit-node-label',entity.label));
      for (const port of ['Constant','Driver'].includes(entity.type)?['output']:['input','output']) for (const color of ['red','green']) {const dot=element('span',`circuit-port port-${port} ${color}`);if(simulation){dot.dataset.simulationPort=port;dot.dataset.entity=entity.id;dot.dataset.color=color;dot.tabIndex=0;dot.setAttribute('aria-label',`${entity.label}: ${color} ${port} network`);}else dot.title=`${color} ${port}`;node.append(dot);}
      if(simulation)node.append(element('span','circuit-node-signals'));
      node.onclick=()=>{selected=entity.id;inspect();}; scene.append(node);
    }
    if(simulation){
      const target=event=>event.target.closest('[data-simulation-port],.circuit-node,.circuit-wire-hit');
      scene.onpointerover=event=>{const item=target(event);if(item)showTooltip(item);else hideTooltip();};
      scene.onpointerleave=hideTooltip;
      scene.addEventListener('focusin',event=>showTooltip(target(event)));
      scene.addEventListener('focusout',hideTooltip);
      diagram.onscroll=()=>{if(hoverTarget&&document.activeElement===hoverTarget)showTooltip(hoverTarget);else hideTooltip();};
    }
    zoom = Math.max(.6, Math.min(1, (diagram.clientWidth - 12) / dimensions.width, (diagram.clientHeight - 12) / dimensions.height)); applyZoom();
  }
  return {
    setHeader(node,expansionControls) {extraHeader=node;expandTarget=expansionControls;},
    setSimulationFrame(context) {simulationContext=context;if(circuit?.entities.length){inspect();updateSimulationDiagram();}},
    setCatalog(manifest) { catalog = new Map(Object.values(manifest).flat().map(item => [`${item.type}:${item.name}`,item])); if(data) this.render(data, undefined, true); },
    render(nextData, message, force = false) {
      if (nextData === data && container.childElementCount && message === lastMessage && !force) return;
      const changed = nextData !== data; data=nextData; lastMessage=message; circuit=describeCircuit(data);hideTooltip();layoutSize.disconnect();expandButton?.remove();container.replaceChildren();if(changed)simulationContext=undefined;
      container.classList.toggle('simulation-preview',simulation);
      if (!circuit.entities.length || message) {container.append(element('p','circuit-empty',message || 'Run a file to preview its generated circuit.'));return;}
      if (changed || !circuit.entities.some(e=>e.id===selected)) selected=circuit.entities[0].id;
      if(extraHeader)container.append(extraHeader);
      const bar = element('div','circuit-preview-toolbar');
      const hint = element('label','circuit-entity-picker'); hint.append(element('span','','Inspect:'));
      entitySelect = element('select'); entitySelect.setAttribute('aria-label','Inspect combinator');
      for(const entity of circuit.entities) { const option=element('option','',`#${entity.id} ${entity.label}`);option.value=entity.id;entitySelect.append(option); }
      entitySelect.onchange=()=>{selected=Number(entitySelect.value);inspect();};hint.append(entitySelect);bar.append(hint);
      const controls=element('div','circuit-zoom');
      const zoomButtons=[];
      for(const [label,action] of [['−',()=>{zoom=Math.max(.2,zoom/1.25);applyZoom();}],['Fit',()=>{zoom=Math.max(.15,Math.min(1,(diagram.clientWidth-12)/dimensions.width,(diagram.clientHeight-12)/dimensions.height));applyZoom();}],['+',()=>{zoom=Math.min(2,zoom*1.25);applyZoom();}]]){const button=element('button','text-button',label);button.type='button';button.setAttribute('aria-label',label==='Fit'?'Fit circuit':label==='+'?'Zoom in':'Zoom out');button.onclick=action;button.disabled=!layoutOpen;zoomButtons.push(button);controls.append(button);}
      bar.append(controls);container.append(bar);
    const body=element('div',`circuit-body${layoutOpen?' layout-open':''}${configurationOpen?' configuration-open':''}`);diagram=element('div','circuit-diagram');diagram.setAttribute('aria-label','Circuit layout');inspector=element('div','circuit-inspector');inspector.setAttribute('aria-label','Combinator configuration');inspector.hidden=!configurationOpen;diagram.hidden=!layoutOpen;body.append(diagram,inspector);container.append(body);
      const toggle=element('button','text-button',layoutOpen?'Hide layout':'Show layout'); toggle.setAttribute('aria-pressed',String(layoutOpen));
      toggle.onclick=()=>{layoutOpen=!layoutOpen;diagram.hidden=!layoutOpen;body.classList.toggle('layout-open',layoutOpen);toggle.textContent=layoutOpen?'Hide layout':'Show layout';toggle.setAttribute('aria-pressed',String(layoutOpen));zoomButtons.forEach(button=>{button.disabled=!layoutOpen;});hideTooltip();};controls.prepend(toggle);
      if(simulation){
        const config=element('button','text-button',configurationOpen?'Hide configuration':'Show configuration');config.setAttribute('aria-pressed',String(configurationOpen));
        config.onclick=()=>{configurationOpen=!configurationOpen;inspector.hidden=!configurationOpen;body.classList.toggle('configuration-open',configurationOpen);config.textContent=configurationOpen?'Hide configuration':'Show configuration';config.setAttribute('aria-pressed',String(configurationOpen));};controls.append(config);
        tooltip=element('div','circuit-simulation-tooltip');tooltip.id=`simulation-tooltip-${crypto.randomUUID()}`;tooltip.setAttribute('role','tooltip');tooltip.hidden=true;container.append(tooltip);
        container.append(element('p','circuit-layout-hint','Hover or focus a combinator, network badge or wire to inspect signals at the selected tick.'));
      }
      expandButton=element('button',`text-button${simulation?' simulation-expand':''}`,container.classList.contains('is-expanded')?'Collapse':'Expand');
      expandButton.type='button';expandButton.setAttribute('aria-label',simulation?'Expand or collapse simulation':'Expand or collapse circuit preview');expandButton.title=simulation?'Expand the simulation and diagram · Escape to return':'Expand preview · Escape to return';
      expandButton.setAttribute('aria-expanded',String(container.classList.contains('is-expanded')));
      expandButton.onclick=()=>{if(container.classList.contains('is-expanded'))collapse();else{restoreFocus=document.activeElement;container.classList.add('is-expanded');container.setAttribute('role','dialog');container.setAttribute('aria-modal','true');container.setAttribute('aria-label',simulation?'Simulation':'Circuit configuration');expandButton.setAttribute('aria-expanded','true');expandButton.textContent='Collapse';}};(expandTarget??controls).append(expandButton);
      draw();layoutSize.observe(diagram);inspect();if(simulationContext)updateSimulationDiagram();
    },
  };
}
