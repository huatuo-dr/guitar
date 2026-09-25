// alphaTab owns timing, seeking and the playback cursor. The sound bank is
// embedded in the downloaded HTML so no runtime network request is needed.
function setupPianaiPlayer(api,soundFontBase64,loadScore,enablePlayer) {
  const play=document.getElementById('player-play');
  const stop=document.getElementById('player-stop');
  const speed=document.getElementById('player-speed');
  const status=document.getElementById('player-status');
  const score=document.getElementById('score');
  const viewport=document.getElementById('score-area');
  let ready=false;
  let state='stopped';
  document.body.dataset.playerState=state;
  document.body.dataset.playerPlaying='false';

  function showState(next) {
    state=next;
    document.body.dataset.playerState=next;
    document.body.dataset.playerPlaying=String(next==='playing');
    // Initial MIDI/cursor positioning must not move the page before playback.
    const scrollMode=next==='playing'?alphaTab.ScrollMode.Continuous:alphaTab.ScrollMode.Off;
    if(api.settings.player.scrollMode!==scrollMode) {
      api.settings.player.scrollMode=scrollMode;
      api.updateSettings();
    }
    play.textContent=next==='playing'?'暂停':'播放';
    play.setAttribute('aria-label',next==='playing'?'暂停播放':'播放乐谱');
    if(next==='stopped'&&ready)status.textContent=`可试听 · ${speed.value} BPM 为练习速度`;
  }

  const initialization=setupPlayerInitialization(api,{
    soundFontBase64,
    onReady(){
      ready=true;
      play.disabled=false;
      stop.disabled=false;
      api.playbackSpeed=Number(speed.value)/api.score.tempo;
      showState('stopped');
    },
    onUnavailable(){ready=false;api.pause();showState('stopped');}
  });
  api.playerStateChanged.on(event=>{
    if(ready)showState(event.state===1?'playing':event.stopped?'stopped':'paused');
  });
  api.playedBeatChanged.on(beat=>{
    if(state!=='playing')return;
    const index=beat.voice.bar.index;
    status.textContent=`第 ${index+1} / 61 小节`;
    const bounds=api.renderer.boundsLookup?.findMasterBarByIndex(index);
    if(!bounds)return;
    // Keep the preceding score row above the playing row, using rendered
    // spacing so the breathing room follows zoom and 2/4-bar layouts.
    const row=bounds.staffSystemBounds;
    if(row) {
      const previous=row.boundsLookup.staffSystems[row.index-1];
      const rowDistance=previous?row.realBounds.y-previous.realBounds.y:row.realBounds.h;
      const offset=-Math.min(100+rowDistance,Math.max(16,innerHeight-bounds.visualBounds.h-24));
      if(api.settings.player.scrollOffsetY!==offset) {
        api.settings.player.scrollOffsetY=offset;
        api.scrollToCursor();
      }
    }
    if(viewport.scrollWidth<=viewport.clientWidth)return;
    const left=score.getBoundingClientRect().left+bounds.visualBounds.x-viewport.getBoundingClientRect().left+viewport.scrollLeft;
    const right=left+bounds.visualBounds.w;
    if(left<viewport.scrollLeft+12)viewport.scrollTo({left:Math.max(0,left-16),behavior:'instant'});
    else if(right>viewport.scrollLeft+viewport.clientWidth-12)viewport.scrollTo({left:right-viewport.clientWidth+16,behavior:'instant'});
  });
  api.playerFinished.on(()=>{if(ready)showState('stopped');});

  play.addEventListener('click',()=>{
    if(!ready){initialization.retry();return;}
    if(state==='playing')api.pause();
    else api.play();
  });
  stop.addEventListener('click',()=>{
    if(!ready)return;
    api.stop();
    showState('stopped');
  });
  speed.addEventListener('change',()=>{
    if(ready)api.playbackSpeed=Number(speed.value)/api.score.tempo;
    if(state==='stopped'&&ready)status.textContent=`可试听 · ${speed.value} BPM 为练习速度`;
  });
  window.addEventListener('beforeprint',()=>{if(state==='playing')api.pause();});

  const rendered=api.renderFinished.on(()=>{
    rendered();
    scheduleScorePlayback(()=>initialization.start(enablePlayer));
  });
  loadScore();
}
