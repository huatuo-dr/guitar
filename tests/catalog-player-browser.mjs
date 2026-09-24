import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';

const root=new URL('../',import.meta.url);
const cases=[
  {file:'老男孩弹唱伴奏.html',count:89,repeat:'bar-21-repeat-4',boundaries:[[29,7],[27,30],[45,21],[26,46],[47,21],[27,48]]},
  {file:'空心弹唱伴奏.html',count:72,repeat:'bar-5-repeat-2',boundaries:[[30,5],[29,31]]},
  {file:'突然好想你弹唱伴奏.html',count:62,repeat:'bar-5-repeat-2',boundaries:[[12,5],[11,13]]},
  {file:'卡农指弹.html',count:69,fingerstyle:true,boundaries:[[16,13],[15,17],[21,18],[19,22],[27,24],[27,28],[51,48],[51,52]]},
  {file:'卡农指弹版本2.html',count:9,fingerstyle:true,boundaries:[]}
];
const browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH}:{})});
await mkdir(new URL('artifacts/',root),{recursive:true});
try {
  for(const item of cases) {
    const context=await browser.newContext({offline:true,viewport:{width:390,height:800},reducedMotion:'reduce'});
    const page=await context.newPage(),errors=[],external=[];
    page.on('pageerror',e=>errors.push(e.message));
    page.on('request',r=>{if(/^https?:/.test(r.url()))external.push(r.url());});
    await page.goto(new URL(`sheet_music/${item.file}`,root).href);
    assert.equal(await page.locator('#player-play').count(),1,`${item.file} 缺少播放控件`);
    await page.waitForFunction(()=>!document.getElementById('player-play').disabled);
    const payload=await page.locator('#accompaniment-playback-data').evaluate(n=>{
      const {sequence,totalTicks}=JSON.parse(n.textContent);return {sequence,totalTicks};
    });
    assert.equal(payload.sequence.length,item.count);
    assert.equal(await page.locator('#player-speed').inputValue(),'60');
    assert.equal(await page.evaluate(()=>scrollY),0,'初始不自动滚动');
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'手机页面无横向溢出');
    assert.match(await page.locator('#player-play').getAttribute('aria-label'),new RegExp(item.fingerstyle?'指弹':'伴奏'));
    if(item.file!=='突然好想你弹唱伴奏.html')assert.match(await page.locator('#player-capo-note').textContent(),/未夹变调夹/);
    const play=page.locator('#player-play');
    const start=async()=>{await play.click();await page.waitForFunction(()=>document.body.dataset.playerState==='playing');};
    const pause=async()=>{await play.click();await page.waitForFunction(()=>document.body.dataset.playerState==='paused');};
    await start();
    await page.waitForFunction(()=>accompanimentPlayer.api.tickPosition>100);
    await page.evaluate(()=>{
      const node=accompanimentPlayer.api._player.instance._output._audioNode,generate=node.onaudioprocess;
      window.audioPeak=0;
      node.onaudioprocess=event=>{generate(event);for(const sample of event.outputBuffer.getChannelData(0))window.audioPeak=Math.max(window.audioPeak,Math.abs(sample));};
    });
    await page.waitForFunction(()=>window.audioPeak>0.001);
    assert.equal(await page.locator('#bar-1.player-current').count(),1);
    const cursor=await page.locator('.playback-cursor').evaluate(n=>({height:n.getBoundingClientRect().height,stroke:getComputedStyle(n).stroke}));
    assert.ok(cursor.height>0);assert.equal(cursor.stroke,'rgb(212, 119, 36)');
    await pause();
    const paused=await page.evaluate(()=>accompanimentPlayer.api.tickPosition);
    await page.waitForTimeout(100);
    assert.equal(await page.evaluate(()=>accompanimentPlayer.api.tickPosition),paused);
    await page.locator('#bar-5').dispatchEvent('click');
    assert.ok(Math.abs(await page.evaluate(()=>accompanimentPlayer.api.tickPosition)-4*3840)<=1,'跳播允许音频时钟1 tick舍入');
    await start();
    for(const rows of ['4','2']){
      await page.locator('#bars-per-row').selectOption(rows);
      await page.waitForFunction(()=>!!document.querySelector('#bar-5.player-current .playback-cursor'));
    }
    await page.locator('#zoom').selectOption('1.3');
    await page.waitForFunction(()=>!!document.querySelector('#bar-5.player-current .playback-cursor'));
    await page.locator('#zoom').selectOption('fit');
    if(!item.fingerstyle) {
      await page.locator('#score-mode').click();
      await page.waitForFunction(()=>!!document.querySelector('#score .player-current'));
      assert.equal(await page.locator('body').getAttribute('data-player-state'),'playing');
      await pause();
      await page.locator('#'+item.repeat).dispatchEvent('click');
      const repeat=payload.sequence.find(s=>s.id===item.repeat);
      assert.ok(Math.abs(await page.evaluate(()=>accompanimentPlayer.api.tickPosition)-repeat.startTick)<=1);
      assert.equal(await page.locator('#'+item.repeat+'.player-current').count(),1);
      await page.locator('#score-mode').click();
      await page.waitForFunction(bar=>!!document.querySelector(`#bar-${bar}.player-current`),repeat.bar);
      await page.locator('#score-mode').click();
      await page.waitForFunction(id=>!!document.getElementById(id)?.classList.contains('player-current'),item.repeat);
      await start();
      await page.screenshot({path:fileURLToPath(new URL(`artifacts/player-simple-${item.file}.png`,root))});
      await pause();
      await page.locator('#score-mode').click();
    } else await pause();
    for(const [previous,next] of item.boundaries) {
      const index=payload.sequence.findIndex((s,i)=>i>0&&s.bar===next&&payload.sequence[i-1].bar===previous);
      assert.ok(index>0);
      await page.evaluate(t=>{accompanimentPlayer.api.tickPosition=t;},payload.sequence[index].startTick-160);
      await start();
      await page.waitForFunction(i=>document.body.dataset.playerOccurrence===String(i),index);
      assert.equal(await page.locator(`#bar-${next}.player-current`).count(),1);
      await pause();
    }
    if(item.file==='老男孩弹唱伴奏.html') {
      await page.locator('#bar-18').dispatchEvent('click');
      assert.ok(Math.abs(await page.evaluate(()=>accompanimentPlayer.api.tickPosition)-17*3840)<=1);
      await page.evaluate(()=>{accompanimentPlayer.api.tickPosition=17*3840+1920-160;});
      await start();
      await page.waitForFunction(()=>document.body.dataset.playerBar==='19');
      await pause();
    }
    await page.setViewportSize({width:1280,height:900});
    await page.locator('#bar-5').dispatchEvent('click');
    await start();
    await page.screenshot({path:fileURLToPath(new URL(`artifacts/player-full-${item.file}.png`,root))});
    await pause();
    await page.locator('#player-stop').click();
    await page.waitForFunction(()=>document.body.dataset.playerState==='stopped');
    assert.equal(await page.locator('#score .player-current').count(),0);
    await page.waitForFunction(()=>accompanimentPlayer.api.tickPosition<=1);
    await page.evaluate(t=>{accompanimentPlayer.api.tickPosition=t;},payload.totalTicks-160);
    await start();
    await page.waitForFunction(()=>document.body.dataset.playerState==='stopped');
    assert.equal(await page.locator('#score .player-current').count(),0);
    const downloading=page.waitForEvent('download');await page.locator('#download').click();
    const saved=new URL(`artifacts/player-download-${item.file}`,root);
    await (await downloading).saveAs(fileURLToPath(saved));
    const reopened=await context.newPage();
    reopened.on('pageerror',e=>errors.push(e.message));
    reopened.on('request',r=>{if(/^https?:/.test(r.url()))external.push(r.url());});
    await reopened.goto(saved.href);
    await reopened.waitForFunction(()=>!document.getElementById('player-play').disabled);
    assert.equal(await reopened.evaluate(()=>scrollY),0);
    await reopened.locator('#player-play').click();
    await reopened.waitForFunction(()=>accompanimentPlayer.api.tickPosition>100);
    assert.deepEqual(errors,[]);assert.deepEqual(external,[]);
    await context.close();
    console.log(`PASS: ${item.file} 离线音频、${item.count}小节路线、完整/简易谱高亮、变拍、排版、暂停停止、末尾和下载重开。`);
  }
} finally {await browser.close();}
