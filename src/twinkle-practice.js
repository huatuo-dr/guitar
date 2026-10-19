(() => {
  const reference=document.querySelector('#reference');
  const melody=document.querySelector('#melody');
  const keySelect=document.querySelector('#practice-key');
  const notationButton=document.querySelector('#notation-toggle');
  let key=practiceData[0],mode='scale',letters=false,focused=null,pattern=null;
  function renderFocus(){
    reference.querySelectorAll('.fretboard svg').forEach(svg=>svg.setAttribute('role','group'));
    document.querySelectorAll('[data-focus-degree]').forEach(node=>node.setAttribute('aria-pressed',String(Number(node.dataset.focusDegree)===focused)));
    reference.querySelectorAll('.scale-note').forEach(node=>{
      const degree=Number(node.dataset.degree),selected=degree===focused;
      node.classList.toggle('note-focused',selected);
      node.classList.toggle('note-muted',focused!==null&&!selected);
      node.querySelector('text').textContent=letters?key.notes[degree-1]:degree;
      if(degree<=7){
        node.setAttribute('role','button');node.setAttribute('tabindex','0');
        node.setAttribute('aria-pressed',String(selected));
        node.setAttribute('aria-label',`${node.dataset.string}弦${node.dataset.fret}品，${degree}级 ${key.notes[degree-1]}，${selected?'取消高亮':'高亮同级音'}`);
      }
    });
    reference.querySelectorAll('[data-chord-degree]').forEach(node=>{
      const selected=Number(node.dataset.chordDegree)===focused;
      node.classList.toggle('is-focused',selected);node.classList.toggle('note-muted',focused!==null&&!selected);
    });
    document.querySelector('#clear-focus').hidden=focused===null;
    const selectedChord=focused?reference.querySelector(`[data-chord-degree="${focused}"] strong`).textContent:'';
    document.querySelector('#focus-status').textContent=`${key.name} 大调 · ${mode==='scale'?'音阶':'和弦级数'}练习${focused?` · ${focused}级 ${mode==='scale'?key.notes[focused-1]:selectedChord}`:''}`;
  }
  function renderMode(){
    document.body.dataset.mode=mode;
    document.querySelectorAll('.mode-selector button').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.mode===mode)));
    reference.querySelector('.scale-view').hidden=mode!=='scale';
    reference.querySelector('.chord-view').hidden=mode!=='chord';
    reference.classList.toggle('letter-mode',letters);
    notationButton.hidden=mode!=='scale';
    notationButton.setAttribute('aria-pressed',String(letters));
    notationButton.textContent=letters?'数字显示':'音名显示';
    document.querySelector('#reference-title').textContent=`${key.name} 大调${mode==='scale'?'音阶':'和弦 · 1—7级'}`;
    document.querySelector('#tonic').textContent=`1 = ${key.name}`;
    document.querySelector('.scale-help').hidden=mode!=='scale';
    document.querySelector('.chord-help').hidden=mode!=='chord';
    document.querySelector('#practice-hint').textContent=mode==='scale'?'按简谱逐音弹奏。点击音级或指板上的音，查看对应位置；圆点表示八度。':'每个旋律音级对应同级和弦：1→I、2→ii、3→iii、4→IV、5→V、6→vi、7→vii°。本曲使用1—6级，第7级供对照练习。';
    document.querySelector('#song-hint').textContent=mode==='scale'?'点击简谱数字，高亮上方指板中的同级音。':'每个数字弹一次上方标注的和弦；重复音再次弹奏同一和弦，延长线保持前一个和弦一拍。';
    melody.querySelectorAll('[data-focus-degree]').forEach(node=>node.setAttribute('aria-label',`${node.dataset.focusDegree}级${mode==='chord'?'，和弦'+node.querySelector('.event-chord').textContent:''}，${node.querySelector('.event-lyric').textContent}，点击高亮`));
    renderFocus();
  }
  function toggleDegree(degree){if(degree<1||degree>7)return;focused=focused===degree?null:degree;renderFocus();}
  function togglePattern(control){
    pattern=pattern===control.dataset.pattern?null:control.dataset.pattern;
    const first=Number(control.dataset.first),last=Number(control.dataset.last);
    reference.querySelectorAll('[data-pattern]').forEach(node=>node.setAttribute('aria-pressed',String(node.dataset.pattern===pattern)));
    reference.querySelectorAll('[data-pattern-band]').forEach(node=>node.classList.toggle('is-active',node.dataset.patternBand===pattern));
    reference.querySelectorAll('.scale-note').forEach(node=>{
      const active=pattern!==null&&Number(node.dataset.fret)>=first&&Number(node.dataset.fret)<=last;
      node.classList.toggle('is-highlighted',active);
      if(active)node.style.setProperty('--pattern-color',control.style.getPropertyValue('--pattern-color'));
      else node.style.removeProperty('--pattern-color');
    });
  }
  document.querySelectorAll('.mode-selector button').forEach(button=>button.addEventListener('click',()=>{mode=button.dataset.mode;renderMode();}));
  keySelect.addEventListener('change',()=>{
    key=practiceData.find(item=>item.name===keySelect.value);
    reference.innerHTML=key.reference;melody.innerHTML=key.melody;
    focused=null;pattern=null;renderMode();
  });
  notationButton.addEventListener('click',()=>{letters=!letters;renderMode();});
  document.querySelector('#clear-focus').addEventListener('click',()=>{focused=null;renderFocus();});
  document.querySelector('main').addEventListener('click',event=>{
    const control=event.target.closest('.pattern-control');
    if(control){togglePattern(control);return;}
    const target=event.target.closest('[data-focus-degree],.scale-note');
    if(target)toggleDegree(Number(target.dataset.focusDegree??target.dataset.degree));
  });
  reference.addEventListener('keydown',event=>{
    const target=event.target.closest('.pattern-control,.scale-note[role="button"]');
    if(target&&(event.key==='Enter'||event.key===' ')){event.preventDefault();target.dispatchEvent(new MouseEvent('click',{bubbles:true}));}
  });
  renderMode();
})();
