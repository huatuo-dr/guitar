import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {chromium} from 'playwright';

const browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH}:{})});
try {
  const context=await browser.newContext({offline:true,viewport:{width:390,height:800},reducedMotion:'reduce'});
  const page=await context.newPage();
  const errors=[],external=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('request',r=>{if(/^https?:/.test(r.url()))external.push(r.url());});
  await page.goto(new URL('../sheet_music/后来弹唱伴奏.html',import.meta.url).href);
  const play=page.locator('#player-play');
  await play.waitFor({state:'visible',timeout:5000});
  await page.waitForFunction(()=>!document.getElementById('player-play').disabled);
  assert.equal(await page.locator('#player-speed').inputValue(),'60');
  assert.equal(await page.evaluate(()=>scrollY),0);
  await play.click();
  await page.waitForFunction(()=>document.body.dataset.playerState==='playing');
  await page.waitForFunction(()=>accompanimentPlayer.api.tickPosition>200);
  // Inspect the actual output buffer, not just the advancing transport clock.
  await page.evaluate(()=>{
    const node=accompanimentPlayer.api._player.instance._output._audioNode;
    const generate=node.onaudioprocess;
    window.audioPeak=0;
    node.onaudioprocess=event=>{
      generate(event);
      for(const sample of event.outputBuffer.getChannelData(0))window.audioPeak=Math.max(window.audioPeak,Math.abs(sample));
    };
  });
  await page.waitForFunction(()=>window.audioPeak>0.001);
  assert.equal(await page.locator('#bar-1.player-current').count(),1);
  assert.notEqual(await page.locator('#bar-1 .measure-highlight').evaluate(n=>getComputedStyle(n).fill),'rgba(0, 0, 0, 0)');
  const cursor=await page.locator('.playback-cursor').evaluate(n=>({stroke:getComputedStyle(n).stroke,height:n.getBoundingClientRect().height}));
  assert.equal(cursor.stroke,'rgb(212, 119, 36)');
  assert.ok(cursor.height>0);
  await play.click();
  await page.waitForFunction(()=>document.body.dataset.playerState==='paused');
  const paused=await page.evaluate(()=>accompanimentPlayer.api.tickPosition);
  await page.waitForTimeout(350);
  assert.equal(await page.evaluate(()=>accompanimentPlayer.api.tickPosition),paused);
  await page.locator('#player-stop').click();
  await page.waitForFunction(()=>accompanimentPlayer.api.tickPosition<=1);
  assert.equal(await page.locator('#score .player-current').count(),0);

  for(const bpm of ['30','40','50','60','70','80','90','100','120']) {
    await page.locator('#player-speed').selectOption(bpm);
    assert.equal(await page.evaluate(()=>accompanimentPlayer.api.playbackSpeed),Number(bpm)/60);
  }
  await page.locator('#player-speed').selectOption('60');
  await page.locator('#bar-5').dispatchEvent('click');
  assert.equal(await page.evaluate(()=>accompanimentPlayer.api.tickPosition),4*3840);
  await play.click();
  await page.locator('#score-mode').click();
  await page.waitForFunction(()=>document.querySelector('.simple-cell.player-current')?.dataset.bar==='5');
  const moving=await page.evaluate(()=>accompanimentPlayer.api.tickPosition);
  await page.waitForFunction(t=>accompanimentPlayer.api.tickPosition>t,moving);
  await page.locator('#score-mode').click();
  await page.waitForFunction(()=>document.querySelector('#bar-5.player-current'));
  for(const rows of ['2','4']) {
    await page.locator('#bars-per-row').selectOption(rows);
    await page.waitForFunction(()=>!!document.querySelector('#score .measure.player-current .playback-cursor'));
    assert.equal(await page.locator('body').getAttribute('data-player-state'),'playing');
  }
  await play.click();
  await page.locator('#score-mode').click();
  await page.locator('#bar-45-repeat-2').dispatchEvent('click');
  assert.equal(await page.evaluate(()=>accompanimentPlayer.api.tickPosition),64*3840);
  assert.equal(await page.locator('body').getAttribute('data-player-visit'),'2');
  await page.locator('#score-mode').click();
  await page.waitForFunction(()=>!!document.querySelector('#bar-45.player-current'));
  await page.locator('#score-mode').click();
  await page.waitForFunction(()=>!!document.querySelector('#bar-45-repeat-2.player-current'));

  // Exercise both repeat boundaries through the real audio clock.
  for(const [index,nextBar,visit] of [[64,45,2],[75,65,1]]) {
    await page.evaluate(t=>{accompanimentPlayer.api.tickPosition=t;},index*3840-250);
    await play.click();
    await page.waitForFunction(([bar,pass])=>document.body.dataset.playerBar===String(bar)&&document.body.dataset.playerVisit===String(pass),[nextBar,visit]);
    assert.ok(await page.locator('#score .player-current').count());
    await play.click();
  }
  await page.locator('#score-mode').click();
  await page.locator('#bar-13').dispatchEvent('click');
  await page.locator('#auto-scroll-toggle').click();
  await play.click();
  await page.waitForTimeout(150);
  const scrollStart=await page.evaluate(()=>scrollY);
  await page.waitForTimeout(350);
  assert.equal(await page.evaluate(()=>scrollY),scrollStart,'自动滚动不与播放跟随争抢位置');
  await page.evaluate(()=>window.scrollBy(0,100));
  assert.equal(await page.locator('body').getAttribute('data-player-state'),'playing','手动滚动不停止音频');
  await play.click();
  const resumedAt=await page.evaluate(()=>scrollY);
  await page.waitForFunction(y=>scrollY>y+2,resumedAt);
  await page.locator('#auto-scroll-toggle').click();

  await play.click();
  await page.waitForFunction(()=>document.body.dataset.playerState==='playing');
  await page.evaluate(()=>window.dispatchEvent(new Event('beforeprint')));
  await page.waitForFunction(()=>document.body.dataset.playerState==='paused');
  await page.emulateMedia({media:'print'});
  assert.equal(await page.locator('.playback-cursor').isVisible(),false);
  assert.equal(await play.isVisible(),false);
  await page.emulateMedia({media:null});
  await page.evaluate(()=>window.dispatchEvent(new Event('afterprint')));
  await page.evaluate(()=>{accompanimentPlayer.api.tickPosition=80*3840-250;});
  await play.click();
  await page.waitForFunction(()=>document.body.dataset.playerState==='stopped');
  assert.equal(await page.locator('#score .player-current').count(),0);

  await mkdir(new URL('../artifacts/',import.meta.url),{recursive:true});
  const downloading=page.waitForEvent('download');
  await page.locator('.export-menu > summary').click();await page.locator('#download').click();
  const saved=new URL('../artifacts/houlai-player-download.html',import.meta.url);
  await (await downloading).saveAs(saved.pathname);
  const downloaded=await context.newPage();
  downloaded.on('pageerror',e=>errors.push(e.message));
  downloaded.on('request',r=>{if(/^https?:/.test(r.url()))external.push(r.url());});
  await downloaded.goto(saved.href);
  await downloaded.waitForFunction(()=>!document.getElementById('player-play').disabled);
  assert.equal(await downloaded.evaluate(()=>scrollY),0);
  await downloaded.locator('#player-play').click();
  await downloaded.waitForFunction(()=>accompanimentPlayer.api.tickPosition>200);
  assert.deepEqual(errors,[]);
  assert.deepEqual(external,[]);
  console.log('PASS: 后来离线音频、变速、双视图高亮与切换、反复跳转、滚动协调、打印、结尾停止及下载重开。');
  await context.close();
} finally {await browser.close();}
