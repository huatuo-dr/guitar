// alphaTab 1.8.4's worker errors do not reach api.error. Monitor that boundary
// as well as readiness, and keep a user-initiated fallback in the same HTML.
function setupPlayerInitialization(api,{soundFontBase64,onReady,onUnavailable}) {
  const status=document.getElementById('player-status');
  const play=document.getElementById('player-play');
  const stop=document.getElementById('player-stop');
  let phase='idle',timer=null,engine=null,unwatch=()=>{};
  let soundFontLoaded=false,midiLoaded=false,playAfterReady=false;
  let soundFontBytes;
  function clearWait() {
    clearTimeout(timer);
    timer=null;
    unwatch();
    unwatch=()=>{};
  }
  function fail(message,error) {
    if(phase!=='loading')return;
    phase='failed';
    clearWait();
    onUnavailable();
    play.disabled=false;
    play.textContent='重试播放';
    play.setAttribute('aria-label','重试播放');
    stop.disabled=true;
    status.textContent=message+'，点击重试播放';
    // Short diagnostic detail for browser inspection, without printing a large
    // embedded data URL or technical stack trace in the score's toolbar.
    status.dataset.error=String(error?.message??error??message).replace(/data:[^\s]+/g,'[内嵌脚本]').slice(0,180);
    document.body.dataset.playerInitialization=phase;
  }
  function progress() {
    if(phase!=='loading')return;
    status.textContent=!engine?.isReady?'正在启动声音…':!soundFontLoaded?'正在加载内置音色…':!midiLoaded?'正在准备播放乐谱…':'正在完成声音准备…';
  }
  api.soundFontLoaded.on(()=>{soundFontLoaded=true;progress();});
  api.midiLoaded.on(()=>{midiLoaded=true;progress();});
  api.error.on(error=>fail('播放准备失败',error));
  api.playerReady.on(()=>{
    if(phase!=='loading')return;
    phase='ready';
    clearWait();
    document.body.dataset.playerInitialization=phase;
    delete status.dataset.error;
    onReady();
    if(playAfterReady)api.play();
  });
  function watchEngine() {
    // Pinned alphaTab exposes a wrapper through api.player. The concrete
    // engine is needed only here to observe/clean up the worker boundary.
    engine=api.player?.instance;
    if(!engine)throw new Error('浏览器未能创建音频播放器');
    const worker=engine.worker;
    const failed=event=>{
      event.preventDefault();
      fail('后台音频启动失败',event);
    };
    worker?.addEventListener('error',failed);
    worker?.addEventListener('messageerror',failed);
    const offReady=engine.ready.on(progress);
    unwatch=()=>{
      worker?.removeEventListener('error',failed);
      worker?.removeEventListener('messageerror',failed);
      offReady();
    };
    progress();
  }
  function begin(createPlayer) {
    phase='loading';
    document.body.dataset.playerInitialization=phase;
    soundFontLoaded=false;midiLoaded=false;
    play.disabled=true;stop.disabled=true;
    play.textContent='播放';
    status.textContent='正在启动声音…';
    timer=setTimeout(()=>fail('声音准备超时'),20000);
    try {
      if(!window.AudioContext&&!window.webkitAudioContext)throw new Error('浏览器不支持Web Audio');
      createPlayer();
      watchEngine();
      soundFontBytes??=Uint8Array.from(atob(soundFontBase64),char=>char.charCodeAt(0));
      if(!api.loadSoundFont(soundFontBytes))throw new Error('音色格式无法加载');
    } catch(error) {fail('播放准备失败',error);}
  }
  function retry() {
    if(phase!=='failed')return;
    playAfterReady=true;
    begin(()=>{
      const previous=engine;
      api.settings.player.enablePlayer=false;
      api.settings.player.playerMode=alphaTab.PlayerMode.Disabled;
      try {api.updateSettings();}
      finally {
        // A failed/stalled worker cannot process alphaTab's asynchronous
        // destroy request. Release its output and terminate it explicitly.
        if(previous?.worker){previous.worker.terminate();previous.output.destroy();}
      }
      api.uiFacade.createWorkerPlayer=()=>new alphaTab.synth.AlphaSynth(
        new alphaTab.synth.AlphaSynthScriptProcessorOutput(),api.settings.player.bufferTimeInMilliseconds
      );
      api.settings.player.enablePlayer=true;
      api.settings.player.playerMode=alphaTab.PlayerMode.EnabledSynthesizer;
      api.updateSettings();
    });
  }
  return {start:begin,retry};
}
