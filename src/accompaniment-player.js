// The audio model is separate from the existing SVG/lyric layouts. One
// expanded performance timeline drives both views, including repeat visits.
function setupAccompanimentPlayer() {
  const data=JSON.parse(document.getElementById('accompaniment-playback-data').textContent);
  const score=document.getElementById('score');
  const play=document.getElementById('player-play');
  const stop=document.getElementById('player-stop');
  const speed=document.getElementById('player-speed');
  const status=document.getElementById('player-status');
  let ready=false,state='stopped',tick=0,occurrence=0;
  let targets=new Map(),highlighted=null,cursor=null,lastRowTop=null;
  const bytes=base64=>Uint8Array.from(atob(base64),char=>char.charCodeAt(0));
  const libraryBytes=new TextEncoder().encode(document.getElementById('accompaniment-audio-library').textContent);
  let binary='';
  for(let offset=0;offset<libraryBytes.length;offset+=32768)binary+=String.fromCharCode(...libraryBytes.subarray(offset,offset+32768));
  const api=new alphaTab.AlphaTabApi(document.getElementById('accompaniment-audio'),{
    core:{useWorkers:false,scriptFile:'data:text/javascript;base64,'+btoa(binary),fontDirectory:null,
      smuflFontSources:new Map([[alphaTab.FontFileFormat.Woff2,'data:font/woff2;base64,'+data.font]])},
    player:{enablePlayer:true,enableCursor:false,enableUserInteraction:false,scrollMode:alphaTab.ScrollMode.Off,
      outputMode:alphaTab.PlayerOutputMode.WebAudioScriptProcessor}
  });

  function clearHighlight() {
    highlighted?.classList.remove('player-current');
    highlighted=null;
    cursor?.remove();
    cursor=null;
  }
  function rebuildTargets() {
    targets=new Map();
    let anchor='';
    for(const element of score.querySelectorAll('.measure[data-bar],.simple-cell')) {
      if(element.matches('.simple-cell')) {
        if(element.id)anchor=element.id;
        if(!targets.has(anchor))targets.set(anchor,[]);
        targets.get(anchor).push(element);
      } else targets.set(element.id,[element]);
    }
    clearHighlight();
    paint(true);
  }
  function follow(target,force) {
    const svg=target.closest('.score-system');
    const row=svg??target;
    const rect=row.getBoundingClientRect();
    const rowTop=scrollY+rect.top;
    if(force||lastRowTop===null||Math.abs(rowTop-lastRowTop)>2) {
      lastRowTop=rowTop;
      const preceding=svg?.previousElementSibling;
      const rowHeight=preceding?.matches('.score-system')?preceding.getBoundingClientRect().height:rect.height;
      const padding=Math.min(100+rowHeight,Math.max(16,innerHeight-rect.height-24));
      window.scrollTo({top:Math.max(0,rowTop-padding),behavior:'instant'});
    }
    const viewport=target.closest('.simple-instrument-scroll')??document.querySelector('.score-viewport');
    const box=target.getBoundingClientRect(),view=viewport.getBoundingClientRect();
    if(box.left<view.left+8)viewport.scrollBy({left:box.left-view.left-12,behavior:'instant'});
    else if(box.right>view.right-8)viewport.scrollBy({left:box.right-view.right+12,behavior:'instant'});
  }
  function paint(force=false) {
    if(state==='stopped')return;
    occurrence=Math.max(0,data.sequence.findLastIndex(item=>item.startTick<=tick));
    const item=data.sequence[occurrence];
    const beat=1+Math.max(0,tick-item.startTick)/960;
    document.body.dataset.playerBar=String(item.bar);
    document.body.dataset.playerVisit=String(item.visit);
    document.body.dataset.playerOccurrence=String(occurrence);
    const text=`第 ${item.bar} 小节${item.visit>1?` · 第 ${item.visit} 遍`:''} · ${occurrence+1} / ${data.sequence.length}`;
    if(status.textContent!==text)status.textContent=text;
    const id=document.body.dataset.scoreMode==='simple'?item.id:`bar-${item.bar}`;
    const group=targets.get(id);
    if(!group?.length)return;
    const target=group[0].matches('.simple-cell')?(group.findLast(cell=>Number(cell.dataset.beat)<=beat+1e-6)??group[0]):group[0];
    if(highlighted!==target) {
      clearHighlight();
      highlighted=target;
      target.classList.add('player-current');
    }
    if(target.dataset.playbackPoints) {
      const points=JSON.parse(target.dataset.playbackPoints);
      const index=Math.min(points.length-2,Math.max(0,points.findLastIndex(p=>p[0]<=beat)));
      const [from,to]=[points[index],points[index+1]];
      const x=from[1]+(to[1]-from[1])*Math.min(1,(beat-from[0])/(to[0]-from[0]));
      if(!cursor) {
        cursor=document.createElementNS('http://www.w3.org/2000/svg','line');
        cursor.classList.add('playback-cursor');
        const rect=target.querySelector('.measure-highlight');
        cursor.setAttribute('y1',rect.getAttribute('y'));
        cursor.setAttribute('y2',Number(rect.getAttribute('y'))+Number(rect.getAttribute('height')));
        target.append(cursor);
      }
      cursor.setAttribute('x1',x);
      cursor.setAttribute('x2',x);
    }
    if(state==='playing')follow(target,force);
  }
  function showState(next) {
    state=next;
    document.body.dataset.playerState=next;
    document.body.dataset.playerPlaying=String(next==='playing');
    play.textContent=next==='playing'?'暂停':'播放';
    play.setAttribute('aria-label',next==='playing'?'暂停伴奏':'播放伴奏');
    if(next==='stopped') {
      clearHighlight();
      lastRowTop=null;
      if(ready)status.textContent=`可试听伴奏 · ${speed.value} BPM 为练习速度`;
    } else paint(next==='playing');
  }
  function fail(error) {
    ready=false;
    api.pause();
    showState('stopped');
    play.disabled=true;
    stop.disabled=true;
    status.textContent='播放暂不可用：'+error.message;
  }
  api.error.on(fail);
  api.playerReady.on(()=>{
    if(ready)return;
    ready=true;
    play.disabled=false;
    stop.disabled=false;
    api.playbackSpeed=Number(speed.value)/data.tempo;
    showState('stopped');
  });
  api.playerStateChanged.on(event=>showState(event.state===1?'playing':event.stopped?'stopped':'paused'));
  api.playerPositionChanged.on(event=>{tick=event.currentTick;paint();});
  api.playerFinished.on(()=>showState('stopped'));
  play.addEventListener('click',()=>{if(ready){if(state==='playing')api.pause();else api.play();}});
  stop.addEventListener('click',()=>{if(ready){api.stop();tick=0;occurrence=0;showState('stopped');}});
  speed.addEventListener('change',()=>{
    if(ready)api.playbackSpeed=Number(speed.value)/data.tempo;
    if(state==='stopped')showState('stopped');
  });
  score.addEventListener('click',event=>{
    if(!ready)return;
    const cell=event.target.closest('.simple-cell');
    const measure=event.target.closest('.measure[data-bar]');
    if(!cell&&!measure)return;
    let index=-1,beat=1;
    if(cell) {
      const entry=[...targets].find(([,group])=>group.includes(cell));
      index=data.sequence.findIndex(item=>item.id===entry?.[0]);
      beat=Number(cell.dataset.beat);
    } else if(document.body.dataset.scoreMode==='simple')index=data.sequence.findIndex(item=>item.id===measure.id);
    else {
      const candidates=data.sequence.map((item,i)=>({item,i})).filter(({item})=>item.bar===Number(measure.dataset.bar));
      index=(candidates.find(({item})=>item.visit===data.sequence[occurrence].visit)??candidates[0])?.i??-1;
    }
    if(index<0)return;
    tick=data.sequence[index].startTick+(beat-1)*960;
    occurrence=index;
    lastRowTop=null;
    api.tickPosition=tick;
    if(state!=='playing')showState('paused');
    else paint(true);
  });
  window.addEventListener('beforeprint',()=>{if(state==='playing')api.pause();});
  new MutationObserver(rebuildTargets).observe(score,{childList:true});
  new ResizeObserver(()=>paint(true)).observe(score);
  rebuildTargets();
  showState('stopped');
  api.tex(data.tex);
  try {if(!api.loadSoundFont(bytes(data.soundFont)))throw new Error('音色无法加载');}
  catch(error){fail(error);}
  return {api};
}
