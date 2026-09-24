import assert from 'node:assert/strict';
import {chromium} from 'playwright';

const browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH}:{})});
try {
  const context=await browser.newContext({offline:true,viewport:{width:390,height:800},reducedMotion:'reduce'});
  const page=await context.newPage();
  const errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.goto(new URL('../sheet_music/偏爱指弹.html',import.meta.url).href);
  const play=page.locator('#player-play');
  const stop=page.locator('#player-stop');
  const speed=page.locator('#player-speed');
  await play.waitFor({state:'visible'});
  assert.equal(await speed.inputValue(),'60');
  assert.deepEqual(await speed.locator('option').evaluateAll(options=>options.map(option=>option.value)),['30','40','50','60','70','80','90','100','120']);
  await page.waitForFunction(()=>document.body.dataset.renderState==='ready');
  await page.waitForFunction(()=>!document.getElementById('player-play').disabled);
  await page.waitForTimeout(900);
  assert.equal(await page.evaluate(()=>scrollY),0,'首次打开并完成音色加载后应停留在页面顶部');
  const autoScroll=page.locator('#auto-scroll-toggle');
  await autoScroll.click();
  await page.waitForTimeout(1100);
  assert.ok(await page.evaluate(()=>scrollY)>5,'“滚”启动后应移动页面');
  await play.click();
  await page.waitForFunction(()=>document.body.dataset.playerState==='playing',null,{timeout:30000});
  await page.waitForFunction(()=>api?.tickPosition>0,null,{timeout:15000});
  assert.equal(await page.evaluate(()=>api._player.instance._output.context.state),'running','音频输出应已激活');
  await page.evaluate(()=>window.scrollTo({top:300,behavior:'instant'}));
  await page.waitForTimeout(450);
  const duringPlayback=await page.evaluate(()=>scrollY);
  await page.waitForTimeout(1100);
  assert.ok(Math.abs(await page.evaluate(()=>scrollY)-duringPlayback)<5,'播放时“滚”应暂缓位移');
  assert.equal(await autoScroll.getAttribute('aria-pressed'),'true');
  for(const bpm of [30,40,50,80,60]) {
    await speed.selectOption(String(bpm));
    assert.ok(Math.abs(await page.evaluate(()=>api.playbackSpeed)-bpm/60)<.001,`${bpm} BPM 速度比例正确`);
  }
  await play.click();
  await page.waitForFunction(()=>document.body.dataset.playerState==='paused');
  const beforeResume=await page.evaluate(()=>scrollY);
  await page.waitForTimeout(1100);
  assert.ok(await page.evaluate(()=>scrollY)>beforeResume+5,'暂停后“滚”应恢复');
  const pausedTick=await page.evaluate(()=>api.tickPosition);
  await page.waitForTimeout(500);
  assert.ok(Math.abs(await page.evaluate(()=>api.tickPosition)-pausedTick)<=2,'暂停后播放位置应稳定');
  await stop.click();
  await page.waitForFunction(()=>document.body.dataset.playerState==='stopped');
  await page.waitForFunction(()=>api.tickPosition<=1);
  await page.evaluate(()=>{
    const bar=api.renderer.boundsLookup.findMasterBarByIndex(20);
    const score=document.getElementById('score').getBoundingClientRect();
    window.scrollTo({top:window.scrollY+score.top+bar.visualBounds.y-180,behavior:'instant'});
  });
  const seekPoint=await page.evaluate(()=>{
    const beat=api.renderer.boundsLookup.findMasterBarByIndex(20).bars[0].beats[0];
    const score=document.getElementById('score').getBoundingClientRect();
    return {x:score.left+beat.visualBounds.x+beat.visualBounds.w/2,y:score.top+beat.visualBounds.y+beat.visualBounds.h/2};
  });
  await page.mouse.click(seekPoint.x,seekPoint.y);
  await page.waitForFunction(()=>api.tickPosition>70000);
  assert.equal(await page.evaluate(()=>api.playbackRange),null,'点击小节应从该位置播放到全曲末尾');
  await autoScroll.click();
  assert.equal(await autoScroll.getAttribute('aria-pressed'),'false');
  await page.evaluate(()=>{
    window.scrollTo({top:0,behavior:'instant'});
  });
  await play.click();
  await page.waitForFunction(()=>document.body.dataset.playerState==='playing');
  await page.waitForFunction(()=>api.tickPosition>75000);
  await page.waitForFunction(()=>scrollY>200);
  await page.waitForFunction(()=>document.querySelectorAll('.at-highlight').length>0);
  assert.equal(await page.locator('.at-cursor-bar').count(),1,'播放时应显示小节游标');
  await page.waitForTimeout(800);
  for(const selector of ['.at-cursor-bar','.at-cursor-beat']) {
    const cursor=await page.locator(selector).evaluate(node=>{
      const style=getComputedStyle(node),rect=node.getBoundingClientRect();
      return {background:style.backgroundColor,visibility:style.visibility,top:rect.top,bottom:rect.bottom,width:rect.width};
    });
    assert.notEqual(cursor.background,'rgba(0, 0, 0, 0)',`${selector} 应有可见的高亮颜色`);
    assert.equal(cursor.visibility,'visible');
    assert.ok(cursor.width>0&&cursor.top>=0&&cursor.bottom<=800,`${selector} 应在视口内可见：${JSON.stringify(cursor)}`);
  }
  const note=await page.locator('.at-highlight text[fill]').first().evaluate(node=>({fill:getComputedStyle(node).fill,original:node.getAttribute('fill')}));
  assert.equal(note.fill,'rgb(23, 102, 75)','正在播放的品位数字应明显变色');
  const previousRowTop=await page.evaluate(()=>{
    const row=api.renderer.boundsLookup.findMasterBarByIndex(20).staffSystemBounds;
    const previous=row.boundsLookup.staffSystems[row.index-1];
    return document.getElementById('score').getBoundingClientRect().top+previous.realBounds.y;
  });
  assert.ok(previousRowTop>=95,`当前小节上方应保留一整行曲谱，上一行顶部为 ${previousRowTop}px`);
  await stop.click();
  await page.waitForFunction(()=>api.tickPosition<=1);
  await page.locator('#bars-per-row').selectOption('4');
  await page.locator('#zoom').selectOption('1');
  await page.waitForFunction(()=>document.body.dataset.renderState==='ready');
  await page.evaluate(()=>{
    api.tickPosition=api.score.masterBars[22].start;
    document.getElementById('score-area').scrollLeft=0;
  });
  await play.click();
  await page.waitForFunction(()=>document.body.dataset.playerState==='playing');
  await page.waitForFunction(()=>document.getElementById('score-area').scrollLeft>50,null,{timeout:7000});
  await stop.click();
  await page.waitForFunction(()=>api.tickPosition<=1);
  await page.evaluate(()=>{
    document.getElementById('score-area').scrollLeft=0;
    const bar=api.renderer.boundsLookup.findMasterBarByIndex(60);
    const score=document.getElementById('score').getBoundingClientRect();
    window.scrollTo({top:window.scrollY+score.top+bar.visualBounds.y-180,behavior:'instant'});
  });
  const lastBeat=await page.evaluate(()=>{
    const beat=api.renderer.boundsLookup.findMasterBarByIndex(60).bars[0].beats[0];
    const score=document.getElementById('score').getBoundingClientRect();
    return {x:score.left+beat.visualBounds.x+beat.visualBounds.w/2,y:score.top+beat.visualBounds.y+beat.visualBounds.h/2};
  });
  await page.mouse.click(lastBeat.x,lastBeat.y);
  await page.waitForFunction(()=>api.tickPosition>=api.score.masterBars[60].start);
  await play.click();
  await page.waitForFunction(()=>document.body.dataset.playerState==='playing');
  await page.waitForFunction(()=>document.body.dataset.playerState==='stopped',null,{timeout:15000});
  assert.equal(errors.length,0,errors.join('\n'));
  await context.close();
  console.log('PASS: 《偏爱》离线播放、暂停、变速、跳播、跟谱及末小节结束。');
} finally {
  await browser.close();
}
