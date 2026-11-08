export const SPLIT_KEY = 'circuitmaker-results-ratio:v1';
export const DEFAULT_SPLIT = .46;
export function paneBounds(available) {
  const max = Math.max(0, available - Math.min(80, available * .3));
  return { min: Math.min(150, max), max };
}
export function resultsHeight(available, ratio) {
  const { min, max } = paneBounds(available);
  return Math.max(min, Math.min(max, available * (Number.isFinite(ratio) ? ratio : DEFAULT_SPLIT)));
}
export function initializePaneSplitters(panes) {
  let ratio = DEFAULT_SPLIT, drag;
  try { const saved = JSON.parse(localStorage.getItem(SPLIT_KEY)); if (typeof saved === 'number' && saved > 0 && saved < 1) ratio = saved; } catch {}
  const records = [...panes].map(pane => {
    const handle = pane.querySelector('.pane-splitter'), output = pane.querySelector('.output');
    return { pane, handle, output };
  });
  const availableFor = ({pane,handle}) => pane.clientHeight - pane.querySelector('.filebar').offsetHeight - pane.querySelector('.editor-footer').offsetHeight - handle.offsetHeight;
  const save = () => { try { localStorage.setItem(SPLIT_KEY, JSON.stringify(ratio)); } catch {} };
  function apply() {
    for (const record of records) {
      if (!record.pane.clientHeight) continue;
      const available = Math.max(0, availableFor(record)), {min,max} = paneBounds(available);
      const height = resultsHeight(available, ratio);
      record.pane.querySelector('.editor').style.minHeight = `${available - max}px`;
      record.output.style.height = `${height}px`;
      record.handle.setAttribute('aria-valuemin', String(Math.round(min / (available || 1) * 100)));
      record.handle.setAttribute('aria-valuemax', String(Math.round(max / (available || 1) * 100)));
      record.handle.setAttribute('aria-valuenow', String(Math.round(height / (available || 1) * 100)));
      record.handle.setAttribute('aria-valuetext', `${Math.round(height)} pixels for results`);
    }
  }
  for (const record of records) {
    const {handle,output} = record;
    handle.addEventListener('pointerdown', event => {
      if (event.button !== 0 || drag) return;
      event.preventDefault(); handle.focus({preventScroll:true});
      drag = {record, y:event.clientY, height:output.getBoundingClientRect().height};
      handle.setPointerCapture(event.pointerId); document.body.classList.add('resizing-panes');
    });
    handle.addEventListener('pointermove', event => {
      if (drag?.record !== record) return;
      const available = availableFor(record);
      if (available <= 0) return;
      ratio = resultsHeight(available, (drag.height + drag.y - event.clientY) / available) / available;
      apply();
    });
    const stop = () => { if (drag?.record !== record) return; drag = null; document.body.classList.remove('resizing-panes'); save(); };
    handle.addEventListener('pointerup', stop); handle.addEventListener('pointercancel', stop); handle.addEventListener('lostpointercapture', stop);
    handle.addEventListener('dblclick', () => {ratio = DEFAULT_SPLIT;apply();save();});
    handle.addEventListener('keydown', event => {
      if (!['ArrowUp','ArrowDown','Home','End','Enter'].includes(event.key)) return;
      event.preventDefault(); const available = availableFor(record), {min,max} = paneBounds(available);
      if (available <= 0) return;
      const current = resultsHeight(available, ratio), step = event.shiftKey ? 64 : 24;
      ratio = event.key === 'Enter' ? DEFAULT_SPLIT : (event.key === 'Home' ? min : event.key === 'End' ? max : current + (event.key === 'ArrowUp' ? step : -step)) / available;
      apply();save();
    });
  }
  const observer = new ResizeObserver(apply);
  records.forEach(({pane}) => {
    observer.observe(pane); observer.observe(pane.querySelector('.filebar')); observer.observe(pane.querySelector('.editor-footer'));
  }); apply();
  addEventListener('pagehide',()=>observer.disconnect(),{once:true});
}
