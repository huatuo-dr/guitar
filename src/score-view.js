// Inlined into each standalone score by the build scripts.
function setupScoreView({storageKey, viewport, baseWidths, apply}) {
  const rowsControl = document.getElementById('bars-per-row');
  const zoomControl = document.getElementById('zoom');
  const hint = document.getElementById('view-hint');
  const allowed = (control,value) => [...control.options].some(option => option.value === value);
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey));
    if (saved && allowed(rowsControl,saved.rows)) rowsControl.value = saved.rows;
    if (saved && allowed(zoomControl,saved.zoom)) zoomControl.value = saved.zoom;
  } catch { /* Private browsing, blocked storage or an old invalid preference. */ }

  const printMedia = matchMedia('print');
  let printing = printMedia.matches;
  let previous = '';
  function update() {
    const barsPerRow = printing ? 4 : rowsControl.value === 'auto' ? (innerWidth < 700 ? 2 : 4) : Number(rowsControl.value);
    const baseWidth = baseWidths[barsPerRow];
    const zoom = printing ? 1 : zoomControl.value === 'fit' ? viewport.clientWidth / baseWidth : Number(zoomControl.value);
    const width = printing ? null : Math.max(1,Math.floor(baseWidth * zoom));
    const signature = JSON.stringify([printing,barsPerRow,width,zoom]);
    if (signature === previous) return;
    previous = signature;
    apply({barsPerRow,zoom,width,printing});
    if (hint) hint.textContent = `每行 ${barsPerRow} 小节 · ${zoomControl.value === 'fit' ? '适应宽度' : '放大后可在谱面内左右滑动'}`;
  }
  for (const control of [rowsControl,zoomControl]) control.addEventListener('change',() => {
    try {localStorage.setItem(storageKey,JSON.stringify({rows:rowsControl.value,zoom:zoomControl.value}));} catch { /* Settings still work for this visit. */ }
    update();
  });
  let frame;
  const schedule = () => {cancelAnimationFrame(frame);frame=requestAnimationFrame(update);};
  new ResizeObserver(schedule).observe(viewport);
  window.addEventListener('resize',schedule);
  const print = value => {printing=value;update();};
  printMedia.addEventListener('change',event=>print(event.matches));
  window.addEventListener('beforeprint',()=>print(true));
  window.addEventListener('afterprint',()=>print(printMedia.matches));
  update();
}
