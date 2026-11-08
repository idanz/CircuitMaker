export const TICKS_PER_PAGE = 100;

// Filter per network/signal pair across the complete capture, never just a page.
export function tableColumns(traces) {
  return traces.filter(trace => trace.values.some(value => value !== 0));
}

// The final frame is inclusive: 2000 simulated updates have ticks 0 through 2000.
export function tickPage(lastTick, selectedTick) {
  const page = Math.floor(Math.max(0, Math.min(lastTick, selectedTick)) / TICKS_PER_PAGE);
  const first = page * TICKS_PER_PAGE;
  return {page, first, last: Math.min(lastTick, first + TICKS_PER_PAGE - 1),
    pages: Math.ceil((lastTick + 1) / TICKS_PER_PAGE)};
}
