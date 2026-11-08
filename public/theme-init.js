// Restore appearance before the editor bundle loads. This owns no source data.
(() => {
  let theme = 'dark';
  try {
    const saved = localStorage.getItem('circuitmaker-theme:v1');
    if (['dark', 'light', 'forest'].includes(saved)) theme = saved;
  } catch { /* Appearance remains usable when browser storage is unavailable. */ }
  document.documentElement.dataset.theme = theme;
  document.querySelector('meta[name="theme-color"]').content = {dark:'#15171b',light:'#f2f4f7',forest:'#151817'}[theme];
})();
