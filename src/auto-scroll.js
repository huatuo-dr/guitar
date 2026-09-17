// Shared by all standalone scores. Only the speed is persisted, never running state.
function setupScoreAutoScroll({storageKey}) {
  const speeds = [
    {id:'very-slow',label:'很慢',pixels:8},
    {id:'slow',label:'慢',pixels:14},
    {id:'medium',label:'适中',pixels:22},
    {id:'fast',label:'快',pixels:34},
    {id:'very-fast',label:'很快',pixels:50}
  ];
  let speed = speeds[2];
  try {speed = speeds.find(item=>item.id===localStorage.getItem(storageKey))??speed;} catch { /* Reading works without storage. */ }

  const widget = document.createElement('aside');
  widget.className = 'auto-scroll';
  widget.setAttribute('aria-label','自动滚动');
  widget.innerHTML = `<div id="auto-scroll-speed-panel" class="auto-scroll-panel" role="dialog" aria-label="滚动速度" hidden>
    <fieldset><legend>滚动速度</legend>${speeds.map(item=>`<label><input type="radio" name="auto-scroll-speed" value="${item.id}"><span>${item.label}</span></label>`).join('')}</fieldset>
    <p>点击空白处或按 Esc 关闭</p>
  </div>
  <button type="button" id="auto-scroll-toggle" class="auto-scroll-toggle" aria-label="开始自动滚动" aria-pressed="false" title="点击开始或停止滚动；长按选择速度">滚</button>
  <button type="button" id="auto-scroll-speed" class="auto-scroll-speed" aria-haspopup="dialog" aria-expanded="false" aria-controls="auto-scroll-speed-panel"></button>`;
  document.body.append(widget);
  const toggle = widget.querySelector('#auto-scroll-toggle');
  const speedButton = widget.querySelector('#auto-scroll-speed');
  const panel = widget.querySelector('#auto-scroll-speed-panel');
  let menuTrigger = speedButton;
  function showSpeed() {
    speedButton.textContent = `速度：${speed.label}`;
    for(const radio of panel.querySelectorAll('input')) radio.checked = radio.value===speed.id;
  }
  function closeMenu(restoreFocus=false) {
    panel.hidden = true;
    speedButton.setAttribute('aria-expanded','false');
    if(restoreFocus)menuTrigger.focus({preventScroll:true});
  }
  function openMenu(trigger) {
    menuTrigger = trigger;
    panel.hidden = false;
    speedButton.setAttribute('aria-expanded','true');
    panel.querySelector('input:checked').focus({preventScroll:true});
  }
  speedButton.addEventListener('click',()=>panel.hidden?openMenu(speedButton):closeMenu(true));
  panel.addEventListener('change',event=>{
    const next = speeds.find(item=>item.id===event.target.value);
    if(!next)return;
    speed = next;
    showSpeed();
    try {localStorage.setItem(storageKey,speed.id);} catch { /* Current speed still works for this visit. */ }
  });
  document.addEventListener('pointerdown',event=>{if(!widget.contains(event.target))closeMenu();},{passive:true});
  document.addEventListener('keydown',event=>{
    if(event.key==='Escape'&&!panel.hidden){event.preventDefault();closeMenu(true);}
  });
  showSpeed();

  const printMedia = matchMedia('print');
  let printing = printMedia.matches;
  let running = false;
  let frame = 0;
  let previousTime = null;
  let remainder = 0;
  let expectedY = window.scrollY;
  let yieldUntil = 0;
  let touching = false;
  const pointers = new Set();
  const yieldToReader = () => {yieldUntil=performance.now()+220;remainder=0;};
  function resetClock() {
    previousTime = null;
    expectedY = window.scrollY;
    remainder = 0;
  }
  function tick(now) {
    if(!running)return;
    const seconds = previousTime===null?0:Math.min((now-previousTime)/1000,.1);
    previousTime = now;
    const currentY = window.scrollY;
    // External scrolling (including touch inertia and section jumps) owns the
    // position. Start again from wherever the reader leaves the page.
    if(Math.abs(currentY-expectedY)>.5){expectedY=currentY;yieldToReader();}
    if(document.hidden||printing||touching||pointers.size||now<yieldUntil)remainder=0;
    else {
      remainder += speed.pixels*seconds;
      const pixels = Math.floor(remainder);
      if(pixels>0){
        remainder -= pixels;
        window.scrollBy({top:pixels,left:0,behavior:'instant'});
        expectedY = window.scrollY;
      }
    }
    // Reaching the bottom deliberately keeps this loop and the running state.
    frame = requestAnimationFrame(tick);
  }
  function setRunning(value) {
    running = value;
    toggle.textContent = running?'停':'滚';
    toggle.setAttribute('aria-pressed',String(running));
    toggle.setAttribute('aria-label',running?'停止自动滚动':'开始自动滚动');
    cancelAnimationFrame(frame);
    resetClock();
    if(running)frame=requestAnimationFrame(tick);
  }

  let holdTimer = 0;
  let suppressClick = false;
  let downPoint = null;
  const clearHold = () => {clearTimeout(holdTimer);holdTimer=0;};
  toggle.addEventListener('pointerdown',event=>{
    if(!event.isPrimary||event.button!==0)return;
    clearHold();
    suppressClick = false;
    downPoint = {x:event.clientX,y:event.clientY};
    toggle.setPointerCapture(event.pointerId);
    holdTimer = setTimeout(()=>{
      holdTimer = 0;
      suppressClick = true;
      openMenu(toggle);
    },500);
  });
  toggle.addEventListener('pointermove',event=>{
    if(downPoint&&Math.hypot(event.clientX-downPoint.x,event.clientY-downPoint.y)>10){clearHold();suppressClick=true;}
  });
  for(const name of ['pointerup','pointercancel','lostpointercapture'])toggle.addEventListener(name,()=>{clearHold();downPoint=null;});
  toggle.addEventListener('contextmenu',event=>event.preventDefault());
  toggle.addEventListener('click',event=>{
    if(suppressClick&&event.detail!==0){suppressClick=false;return;}
    closeMenu();
    setRunning(!running);
  });

  document.addEventListener('wheel',yieldToReader,{passive:true});
  document.addEventListener('pointerdown',event=>{
    if(event.pointerType!=='touch'&&!widget.contains(event.target)){pointers.add(event.pointerId);yieldToReader();}
  },{passive:true});
  for(const name of ['pointerup','pointercancel'])window.addEventListener(name,event=>{
    if(pointers.delete(event.pointerId))yieldToReader();
  },{passive:true});
  // Touch scrolling cancels pointer events at the start of a native pan; keep
  // tracking actual touches until lift-off so a stationary finger still wins.
  for(const name of ['touchstart','touchend','touchcancel'])document.addEventListener(name,event=>{
    touching=event.touches.length>0;
    yieldToReader();
  },{passive:true});
  document.addEventListener('keydown',event=>{
    if(!widget.contains(event.target)&&['ArrowUp','ArrowDown','PageUp','PageDown','Home','End',' '].includes(event.key))yieldToReader();
  });
  window.addEventListener('blur',()=>{pointers.clear();touching=false;clearHold();downPoint=null;resetClock();});
  document.addEventListener('visibilitychange',resetClock);
  const print = value => {printing=value;resetClock();};
  printMedia.addEventListener('change',event=>print(event.matches));
  window.addEventListener('beforeprint',()=>print(true));
  window.addEventListener('afterprint',()=>print(printMedia.matches));
  window.addEventListener('pagehide',()=>{cancelAnimationFrame(frame);clearHold();});
  window.addEventListener('pageshow',()=>{
    cancelAnimationFrame(frame);resetClock();
    if(running)frame=requestAnimationFrame(tick);
  });
}
