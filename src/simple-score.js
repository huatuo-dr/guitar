// Optional compact view. Both layouts are embedded so it also works offline.
function setupSimpleScore({score,layouts,storageKey}) {
  const button=document.getElementById('score-mode');
  const compact={2:document.getElementById('simple-two-bar-score').innerHTML,4:document.getElementById('simple-four-bar-score').innerHTML};
  const navigation=document.querySelector('.section-nav');
  const navLayouts={full:navigation.innerHTML,simple:document.getElementById('simple-section-nav').innerHTML};
  let navMode='full';
  let mode='full';
  try {if(localStorage.getItem(storageKey+':mode')==='simple')mode='simple';} catch { /* Use the default without storage. */ }
  let current='full:4';
  let settings;
  function render(next) {
    settings=next;
    const {barsPerRow,width,printing}=settings;
    const key=mode+':'+barsPerRow;
    if(current!==key){
      const remap=id=>mode==='full'?id?.replace(/-repeat-\d+$/,''):id;
      const selected=remap(score.querySelector('.measure.current')?.id??score.querySelector('.measure:target')?.id);
      const focused=score.contains(document.activeElement)?remap(document.activeElement.id):null;
      score.innerHTML=mode==='simple'?compact[barsPerRow]:layouts[barsPerRow];
      if(selected)document.getElementById(selected)?.classList.add('current');
      if(focused)document.getElementById(focused)?.focus({preventScroll:true});
      current=key;
    }
    if(navMode!==mode){
      navigation.innerHTML=navLayouts[mode];
      const selected=score.querySelector('.measure.current')?.id;
      if(selected){
        navigation.querySelector(`[href="#${selected}"]`)?.setAttribute('aria-current','location');
        if(location.hash)history.replaceState(null,'','#'+selected);
      }
      navMode=mode;
    }
    document.body.dataset.scoreMode=mode;
    score.dataset.barsPerRow=barsPerRow;
    score.dataset.viewMode=mode;
    score.style.width=mode==='simple'||printing?'100%':width+'px';
    score.style.setProperty('--instrument-width',printing?'100%':width+'px');
    button.textContent=mode==='simple'?'切换为完整谱':'切换为简易谱';
  }
  button.hidden=false;
  button.addEventListener('click',()=>{
    mode=mode==='full'?'simple':'full';
    try {localStorage.setItem(storageKey+':mode',mode);} catch { /* Switching still works for this visit. */ }
    render(settings);
  });
  return {render};
}
