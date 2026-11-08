import {createCircuitPreview} from './circuit-preview';
import './simulation-view.css';
import {graphTraces, chartScale, waveformPath, networkChannels, networkLabel, signalLabel as label, describeNetworks, visibleSimulationNetworks, defaultGraphSelection, MAX_GRAPH_TRACES} from './simulation-chart';
import {tickPage, tableColumns, TICKS_PER_PAGE} from './simulation-table';
const el=(tag,cls,text)=>{const node=document.createElement(tag);node.className=cls;if(text!==undefined)node.textContent=text;return node;};
export function createSimulationView(container) {
  const visual=el('div','circuit-preview');container.append(visual);
  const preview=createCircuitPreview(visual,{simulation:true}),header=el('div','simulation-header');preview.setHeader(header);
  let scenarios=[],scenario,networkList=[],tick=0,timer,stale=false;
  let selectedNetworks=new Set(),selectedSignals=new Set(),channelsByNetwork=[],traces=[],tableTraces=[],graphLimited=false;
  let networkDescriptions=new Map(),catalog=new Map();
  let presentation='graph',graphButton,tableButton,tickTablePanel,tickTableScroll,tickTableBody,pageLabel,previousPage,nextPage;
  let renderedPage=-1,selectedTableRow;
  let chartWidth=900;
  let scenarioPicker,slider,tickInput,tickText,playButton,networkPicker,signalPicker,chart,cursor,table,staleLabel,chartMessage,networkSummary;
  const pause=()=>{clearInterval(timer);timer=null;if(playButton)playButton.textContent='Play';};
  const button=(name,action)=>{const node=el('button','text-button',name);node.type='button';node.onclick=action;return node;};
  function options(select,values,current){select.replaceChildren();for(const [value,text]of values){const option=el('option','',text);option.value=value;select.append(option);}select.value=String(current);}
  const availableNetworks=()=>networkList;
  const tickLabel=()=>`/ ${scenario.timeline.ticks} ticks · ${presentation==='table'?tableTraces.length:traces.length} ${presentation==='table'?'signal columns':traces.length===1?'trace':'traces'}`;
  function showPresentation(value){
    presentation=value;graphButton.setAttribute('aria-pressed',String(value==='graph'));tableButton.setAttribute('aria-pressed',String(value==='table'));
    tickText.textContent=tickLabel();
    chart.toggleAttribute('hidden',value!=='graph');tickTablePanel.hidden=value!=='table'||!tableTraces.length;
    chartMessage.textContent=!networkList.length?'No circuit networks to inspect. Wire a Driver to a combinator to view its injected signals.':graphLimited?`Choose fewer networks or signals to display up to ${MAX_GRAPH_TRACES} traces.`:!traces.length?'Select at least one network and signal to plot.':value==='table'&&!tableTraces.length?'The selected signals stay zero on these networks for the entire simulation.':'';
    chartMessage.hidden=!chartMessage.textContent;
    if(value==='table')renderTickTable();
  }
  function renderTickTable(rebuild=false){
    if(!tickTablePanel||presentation!=='table'||!tableTraces.length)return;
    const page=tickPage(scenario.timeline.ticks,tick);
    if(rebuild||renderedPage!==page.page){
      renderedPage=page.page;tickTableScroll.replaceChildren();selectedTableRow=null;
      const grid=el('table','simulation-ticks');grid.setAttribute('aria-label','Simulation values by tick');
      const caption=el('caption','simulation-table-caption',`Ticks ${page.first}–${page.last}. Select a row to inspect that tick.`);grid.append(caption);
      const head=el('thead'),groups=el('tr'),columns=el('tr'),tickHeading=el('th','','Tick');tickHeading.scope='col';tickHeading.rowSpan=2;groups.append(tickHeading);
      const byNetwork=[];
      for(const trace of tableTraces){
        let group=byNetwork.at(-1);if(!group||group.network!==trace.network){group={network:trace.network,traces:[]};byNetwork.push(group);}group.traces.push(trace);
      }
      for(const group of byNetwork){
        const description=networkDescriptions.get(group.network),th=el('th','simulation-ticks-network');th.scope='colgroup';th.colSpan=group.traces.length;th.title=description.endpoints;
        th.append(el('span',`simulation-network-badge ${description.color}`,`${description.color==='red'?'Red':'Green'} · ${networkLabel(description)}`),el('span','',description.role),el('small','',description.title));groups.append(th);
        for(const trace of group.traces){
          const signal=scenario.timeline.signals[trace.signal],column=el('th');column.scope='col';column.title=`${label(signal)} · ${networkText(description)}`;
          column.setAttribute('aria-label',`${label(signal)} on ${networkText(description)}`);
          const content=el('span','simulation-ticks-signal');content.append(signalIcon(signal));column.append(content);columns.append(column);
        }
      }
      head.append(groups,columns);tickTableBody=el('tbody');
      for(let rowTick=page.first;rowTick<=page.last;rowTick++){
        const row=el('tr');row.dataset.tick=String(rowTick);
        const index=el('th');index.scope='row';const choose=button(String(rowTick),()=>seek(rowTick));choose.setAttribute('aria-label',`Inspect tick ${rowTick}`);index.append(choose);row.append(index);
        for(const trace of tableTraces){
          const value=trace.values[rowTick],changed=rowTick>0&&value!==trace.values[rowTick-1];
          const cell=el('td',`${value===0?'is-zero':''}${changed?' is-changed':''}`,String(value));
          if(changed){
            const previous=trace.values[rowTick-1];
            cell.title=`Changed from ${previous} to ${value} (${value-previous>0?'+':''}${value-previous})`;
            cell.setAttribute('aria-label',`${value}, changed from ${previous}`);
          }
          row.append(cell);
        }
        row.onclick=event=>{if(!event.target.closest('button'))seek(rowTick);};tickTableBody.append(row);
      }
      grid.append(head,tickTableBody);tickTableScroll.append(grid);
      const omitted=traces.length-tableTraces.length;
      pageLabel.textContent=`Ticks ${page.first}–${page.last} of 0–${scenario.timeline.ticks} · Page ${page.page+1}/${page.pages}${omitted?` · ${omitted} all-zero ${omitted===1?'column':'columns'} hidden`:''}`;
      previousPage.disabled=page.page===0;nextPage.disabled=page.page===page.pages-1;
    }
    selectedTableRow?.classList.remove('is-current');selectedTableRow?.removeAttribute('aria-current');
    selectedTableRow=tickTableBody.querySelector(`[data-tick="${tick}"]`);
    if(selectedTableRow){
      selectedTableRow.classList.add('is-current');selectedTableRow.setAttribute('aria-current','true');
      const headHeight=tickTableBody.previousElementSibling.offsetHeight;
      const top=selectedTableRow.offsetTop-headHeight,bottom=selectedTableRow.offsetTop+selectedTableRow.offsetHeight;
      if(top<tickTableScroll.scrollTop)tickTableScroll.scrollTop=top;
      else if(bottom>tickTableScroll.scrollTop+tickTableScroll.clientHeight)tickTableScroll.scrollTop=bottom-tickTableScroll.clientHeight;
    }
  }
  const networkText=n=>{const d=networkDescriptions.get(n.id);return `${d.role}: ${d.title} (${n.color==='red'?'Red':'Green'} ${networkLabel(n)})`;};
  function signalIcon(signal){
    const node=el('span','simulation-signal-icon');node.setAttribute('aria-hidden','true');
    node.title=`${label(signal)} · ${signal.type??'item'} · ${signal.name}`;
    const paint=(target,item,size)=>{
      for(const layer of item.icons){
        const part=el('span'),scale=(layer.scale??32/layer.size)*size/32;
        Object.assign(part.style,{width:`${layer.size*scale}px`,height:`${layer.size*scale}px`,backgroundImage:`url("${layer.src}")`,backgroundSize:`${layer.width*scale}px ${layer.height*scale}px`,left:`calc(50% + ${(layer.shift?.[0]??0)*size/32}px)`,top:`calc(50% + ${(layer.shift?.[1]??0)*size/32}px)`});target.append(part);
      }
    };
    const item=catalog.get(`${signal.type??'item'}:${signal.name}`);
    if(item?.icons?.length)paint(node,item,20);else node.append(el('span','simulation-missing-icon','◇'));
    if(signal.quality&&signal.quality!=='normal'){
      const badge=el('span','simulation-signal-quality'),quality=catalog.get(`quality:${signal.quality}`);
      if(quality?.icons?.length)paint(badge,quality,12);else badge.textContent=signal.quality.slice(0,1).toUpperCase();
      node.append(badge);
    }
    return node;
  }
  function multiselect(name){
    const details=el('details','simulation-multiselect'),summary=el('summary'),body=el('div','simulation-options');
    details.append(summary,body);body.setAttribute('role','group');body.setAttribute('aria-label',name);
    return {node:details,summary,body,name};
  }
  function choices(picker,items,selected,onchange){
    const focusKey=picker.body.contains(document.activeElement)?document.activeElement.dataset.choiceKey:undefined;
    const selectedLabels=items.filter(([id])=>selected.has(id)).map(([,text])=>text);
    const summaryLabels=picker===networkPicker?items.filter(([id])=>selected.has(id)).map(([,text,meta])=>meta?`${meta.color==='red'?'Red':'Green'} ${networkLabel(meta)} · ${meta.role}`:text):selectedLabels;
    if(picker===signalPicker){
      picker.node.classList.add('simulation-signal-picker');
      const icons=el('span','simulation-summary-icons'),selectedItems=items.filter(([id])=>selected.has(id));
      for(const [,text,signal]of selectedItems.slice(0,8))icons.append(signalIcon(signal));
      if(selectedItems.length>8)icons.append(el('span','',`+${selectedItems.length-8}`));
      picker.summary.replaceChildren(el('span','',`${picker.name} (${selected.size})`),icons);
      picker.summary.setAttribute('aria-label',`${picker.name} (${selected.size}): ${selectedLabels.join(', ')||'None'}`);
    }else picker.summary.textContent=`${picker.name} (${selected.size}): ${summaryLabels.join(', ')||'None'}`;
    picker.summary.title=selectedLabels.join('\n');
    picker.body.replaceChildren();
    const actions=el('div','simulation-selection-actions');
    const all=button('All',()=>{items.forEach(([id])=>selected.add(id));onchange();}),none=button('None',()=>{selected.clear();onchange();});all.dataset.choiceKey='all';none.dataset.choiceKey='none';actions.append(all,none);
    picker.body.append(actions);
    for(const [id,text,meta]of items){
      const row=el('label','simulation-choice'),input=el('input');input.type='checkbox';input.checked=selected.has(id);input.dataset.choiceKey=String(id);
      input.onchange=()=>{if(input.checked)selected.add(id);else selected.delete(id);onchange();};
      input.setAttribute('aria-label',text);row.append(input);
      if(picker===signalPicker&&meta){row.append(signalIcon(meta));row.title=`${text} · ${meta.type??'item'} · ${meta.name}`;}
      else{
        const content=el('span','simulation-choice-text',text);
        if(meta){row.title=meta.endpoints;content.append(el('small','',meta.endpoints));}
        row.append(content);
      }
      picker.body.append(row);
    }
    if(!items.length)picker.body.append(el('span','simulation-empty','No signals on the selected networks.'));
    if(focusKey!==undefined)picker.body.querySelector(`[data-choice-key="${focusKey}"]`)?.focus();
  }
  function channels(initial=false){
    const active=[...new Set([...selectedNetworks].flatMap(id=>[...channelsByNetwork[id]]))].sort((a,b)=>a-b);
    const ids=active.length?active:scenario.timeline.signals.map((_,i)=>i).filter(i=>!['signal-each','signal-anything','signal-everything'].includes(scenario.timeline.signals[i].name));
    selectedSignals=new Set([...selectedSignals].filter(id=>ids.includes(id)));
    if(initial&&!selectedSignals.size&&ids.length)selectedSignals.add(ids[0]);
    choices(networkPicker,networkList.map(n=>[n.id,networkText(n),networkDescriptions.get(n.id)]),selectedNetworks,()=>channels());
    choices(signalPicker,ids.map(i=>[i,label(scenario.timeline.signals[i]),scenario.timeline.signals[i]]),selectedSignals,()=>channels());
    drawChart();
  }
  function drawChart(){
    const ns='http://www.w3.org/2000/svg';chart.replaceChildren();
    chartWidth=Math.max(300,chart.clientWidth);chart.setAttribute('viewBox',`0 0 ${chartWidth} 234`);
    const graph=graphTraces(scenario.timeline,selectedNetworks,selectedSignals),{min,max}=graph;traces=graph.traces;
    graphLimited=graph.limited;tableTraces=tableColumns(traces);
    const {x,y,zeroY}=chartScale(min,max,scenario.timeline.ticks,chartWidth);
    const zero=document.createElementNS(ns,'line');zero.setAttribute('class','simulation-zero-axis');
    zero.setAttribute('x1',String(x(0)));zero.setAttribute('x2',String(x(scenario.timeline.ticks)));zero.setAttribute('y1',String(zeroY));zero.setAttribute('y2',String(zeroY));
    const zeroTitle=document.createElementNS(ns,'title');zeroTitle.textContent='Zero signal count';zero.append(zeroTitle);chart.append(zero);
    for(const trace of traces){
      const d=waveformPath(trace.values,x,y);
      const path=document.createElementNS(ns,'path');path.setAttribute('d',d);path.setAttribute('class','simulation-wave');path.setAttribute('stroke',trace.color);if(trace.dash)path.setAttribute('stroke-dasharray',trace.dash);
      const description=networkDescriptions.get(trace.network),signal=scenario.timeline.signals[trace.signal];
      const title=document.createElementNS(ns,'title');title.textContent=`${label(signal)} · ${networkText(description)}`;path.append(title);chart.append(path);
    }
    for(const count of [...new Set([max,min,0])]){const node=document.createElementNS(ns,'text');node.setAttribute('x','56');node.setAttribute('y',String(y(count)+4));node.setAttribute('text-anchor','end');if(count===0)node.setAttribute('class','simulation-zero-label');node.textContent=String(count);chart.append(node);}
    for(const [position,anchor]of [[0,'start'],[.5,'middle'],[1,'end']]){const node=document.createElementNS(ns,'text');node.setAttribute('x',String(x(position*scenario.timeline.ticks)));node.setAttribute('y','220');node.setAttribute('text-anchor',anchor);node.textContent=`Tick ${Math.round(position*scenario.timeline.ticks)}`;chart.append(node);}
    cursor=document.createElementNS(ns,'line');cursor.setAttribute('y1','14');cursor.setAttribute('y2','198');cursor.setAttribute('class','simulation-cursor');chart.append(cursor);renderedPage=-1;showPresentation(presentation);update();
  }
  function update(){
    const frame=scenario.timeline.frames[tick];slider.value=String(tick);tickInput.value=String(tick);
    tickText.textContent=tickLabel();
    networkSummary.textContent=`Network values at tick ${tick}`;
    const xx=chartScale(0,1,scenario.timeline.ticks,chartWidth).x(tick);cursor?.setAttribute('x1',String(xx));cursor?.setAttribute('x2',String(xx));
    preview.setSimulationFrame({frame,timeline:scenario.timeline,selectedNetworks});
    renderTickTable();
    table.replaceChildren();
    if(!table.closest('details').open)return;
    for(const network of availableNetworks()){
      const row=el('button',`simulation-network-row${selectedNetworks.has(network.id)?' selected':''}`);row.type='button';row.setAttribute('aria-pressed',String(selectedNetworks.has(network.id)));row.title='Toggle this network in the graph';
      const description=networkDescriptions.get(network.id);
      row.title=description.endpoints;row.append(el('strong',network.color,`${network.color==='red'?'Red':'Green'} ${networkLabel(network)}`),el('span','',`${description.role}: ${description.title}`));
      const values=el('span','simulation-network-values');
      const ids=new Set([...Object.keys(frame.networks[network.id]).map(Number),...selectedSignals]);
      for(const id of ids){
        const signal=scenario.timeline.signals[id],count=frame.networks[network.id][id]??0,trace=traces.find(t=>t.network===network.id&&t.signal===id);
        const value=el('span','simulation-network-value');value.title=`${label(signal)} · ${signal.type??'item'} · ${signal.name}`;value.setAttribute('role','group');value.setAttribute('aria-label',`${label(signal)}: ${count}`);
        if(trace){const swatch=document.createElementNS('http://www.w3.org/2000/svg','svg');swatch.setAttribute('viewBox','0 0 24 8');swatch.setAttribute('aria-hidden','true');const line=document.createElementNS('http://www.w3.org/2000/svg','path');line.setAttribute('d','M0 4 H24');line.setAttribute('stroke',trace.color);line.setAttribute('stroke-width','2');if(trace.dash)line.setAttribute('stroke-dasharray',trace.dash);swatch.append(line);value.append(swatch);}
        value.append(signalIcon(signal),el('strong','',String(count)));values.append(value);
      }
      if(!ids.size)values.textContent='0';
      row.append(values);row.onclick=()=>{if(selectedNetworks.has(network.id))selectedNetworks.delete(network.id);else selectedNetworks.add(network.id);channels();};table.append(row);
    }
  }
  function seek(value){tick=Math.max(0,Math.min(scenario.timeline.ticks,Math.round(Number(value)||0)));update();}
  function activate(){
    pause();scenario=scenarios[Number(scenarioPicker.value)||0];tick=0;
    channelsByNetwork=networkChannels(scenario.timeline);
    networkDescriptions=describeNetworks(scenario.data,scenario.timeline);
    networkList=visibleSimulationNetworks(scenario.timeline.networks,networkDescriptions,channelsByNetwork);
    const selection=defaultGraphSelection(availableNetworks(),networkDescriptions,channelsByNetwork);selectedNetworks=selection.networks;selectedSignals=selection.signals;
    slider.max=tickInput.max=String(scenario.timeline.ticks);
    preview.render(scenario.data);channels(true);
  }
  function build(){
    if(!container.contains(visual))container.replaceChildren(visual);
    header.replaceChildren();const controls=el('div','simulation-controls');preview.setHeader(header,controls);
    scenarioPicker=el('select');scenarioPicker.setAttribute('aria-label','Simulation scenario');options(scenarioPicker,scenarios.map((s,i)=>[i,s.name]),0);scenarioPicker.onchange=activate;
    playButton=button('Play',()=>{if(timer){pause();return;}if(tick===scenario.timeline.ticks)seek(0);playButton.textContent='Pause';timer=setInterval(()=>{if(tick>=scenario.timeline.ticks){pause();return;}seek(tick+1);},60);});
    tickInput=el('input');tickInput.type='number';tickInput.min='0';tickInput.setAttribute('aria-label','Simulation tick');tickInput.oninput=()=>{pause();seek(tickInput.value);};
    slider=el('input','simulation-scrubber');slider.type='range';slider.min='0';slider.step='1';slider.setAttribute('aria-label','Timeline tick');slider.oninput=()=>{pause();seek(slider.value);};
    tickText=el('span','simulation-tick-label');staleLabel=el('span','simulation-stale');
    controls.append(scenarioPicker,button('Previous tick',()=>{pause();seek(tick-1);}),playButton,button('Next tick',()=>{pause();seek(tick+1);}),tickInput,tickText);header.append(controls,slider,staleLabel);
    const picks=el('div','simulation-picks');networkPicker=multiselect('Networks');signalPicker=multiselect('Signals');
    const views=el('div','simulation-view-toggle');views.setAttribute('role','group');views.setAttribute('aria-label','Simulation presentation');graphButton=button('Graph',()=>showPresentation('graph'));tableButton=button('Table',()=>showPresentation('table'));views.append(graphButton,tableButton);picks.append(networkPicker.node,signalPicker.node,views);header.append(picks);
    chart=document.createElementNS('http://www.w3.org/2000/svg','svg');chart.setAttribute('viewBox','0 0 900 234');chart.setAttribute('preserveAspectRatio','none');chart.setAttribute('aria-label','Signal timeline');chart.setAttribute('class','simulation-chart');chart.onclick=event=>{const box=chart.getBoundingClientRect();pause();seek(((event.clientX-box.left)/box.width*chartWidth-64)/(chartWidth-80)*scenario.timeline.ticks);};header.append(chart);
    chartMessage=el('p','simulation-chart-message');header.append(chartMessage);
    tickTablePanel=el('div','simulation-tick-table');tickTablePanel.hidden=true;
    const paging=el('div','simulation-table-paging');pageLabel=el('span');
    previousPage=button('Previous ticks',()=>seek((tickPage(scenario.timeline.ticks,tick).page-1)*TICKS_PER_PAGE));nextPage=button('Next ticks',()=>seek((tickPage(scenario.timeline.ticks,tick).page+1)*TICKS_PER_PAGE));paging.append(pageLabel,previousPage,nextPage);
    tickTableScroll=el('div','simulation-table-scroll');tickTableScroll.tabIndex=0;tickTableScroll.setAttribute('role','region');tickTableScroll.setAttribute('aria-label','Scrollable simulation tick table');tickTablePanel.append(paging,tickTableScroll);header.append(tickTablePanel);
    const details=el('details','simulation-networks');details.open=true;networkSummary=el('summary','','Network values at tick 0');details.append(networkSummary);table=el('div','simulation-network-table');details.append(table);details.ontoggle=update;header.append(details);
    header.append(el('p','simulation-note','Tick 0 is the initial state. Combinator outputs arrive one tick later; conditions shown evaluate the selected tick for the next update.'));
    activate();
  }
  addEventListener('pagehide',pause,{once:true});
  new ResizeObserver(()=>{if(scenario&&chart&&!chart.hidden&&Math.abs(chart.clientWidth-chartWidth)>1)drawChart();}).observe(visual);
  return {
    render(next,changed=false){stale=changed;if(next!==scenarios){scenarios=next;pause();if(!scenarios.length){container.textContent='Define a Simulation in this script, then Run.';return;}build();}if(staleLabel){staleLabel.textContent=stale?'Source changed — Run to rebuild this timeline.':'';staleLabel.hidden=!stale;}},
    setCatalog(manifest){catalog=new Map(Object.values(manifest).flat().map(item=>[`${item.type}:${item.name}`,item]));preview.setCatalog(manifest);if(scenario)channels();},pause,
  };
}
