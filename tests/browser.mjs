import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';

await mkdir(new URL('../artifacts/', import.meta.url), { recursive:true });
const browser = await chromium.launch({
  headless:true,
  ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ? { executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH } : {})
});
const errors = [];
const remoteRequests = [];
try {
  const context = await browser.newContext({viewport:{width:1440,height:1100},offline:true});
  const page = await context.newPage();
  page.on('pageerror',error=>errors.push(error.message));
  page.on('request',request=>{if(/^https?:/.test(request.url()))remoteRequests.push(request.url());});
  await page.goto(new URL('../sheet_music/偏爱指弹.html', import.meta.url).href);
  await page.waitForFunction(()=>document.body.dataset.renderState === 'ready');
  assert.ok(await page.locator('#score svg').count() >= 2);
  const info = await page.evaluate(() => ({
    bars:api.score.masterBars.length,
    barRows:Array.from({length:61},(_,index)=>api.renderer.boundsLookup.findMasterBarByIndex(index).visualBounds.y),
    bounds:api.renderer.boundsLookup.findMasterBarByIndex(60).visualBounds,
    legendBeforeScore:document.querySelector('.legend').getBoundingClientRect().bottom<=document.getElementById('score-area').getBoundingClientRect().top,
    extraDynamics:Array.from(document.querySelectorAll('#score svg text')).filter(n=>n.textContent === 'f').length,
    scoreWidth:document.getElementById('score').clientWidth
  }));
  assert.equal(await page.locator('h1').innerText(),'《偏爱》指弹');
  assert.equal(info.legendBeforeScore,true,'演奏记号说明必须位于曲谱之前');
  assert.equal(info.bars,61);
  assert.equal(new Set(info.barRows).size,16,'全谱61小节共16行，末行1小节');
  for(const start of Array.from({length:15},(_,i)=>4*i))assert.equal(new Set(info.barRows.slice(start,start+4)).size,1,'每行应为四小节');
  assert.deepEqual(await page.locator('[data-section-start]>span').allTextContents(),['前奏','A段','B段','C段','D段','E段','F段','G段']);
  assert.deepEqual(await page.locator('[data-section-start]>small').allTextContents(),['1–4 小节','5–12 小节','13–16 小节','17–28 小节','29–36 小节','37–40 小节','41–55 小节','56–61 小节']);
  assert.equal(await page.locator('#score svg text').filter({hasText:/^\(2\)$/}).count(),1,'第16小节延音滑音起点应保留括号品号(2)');
  assert.equal(await page.locator('#score svg text').filter({hasText:/^\*$/}).count(),90,'全谱打板标记应全部保留');
  assert.equal(info.extraDynamics,0,'不可添加原谱未标注的力度');
  assert.ok(info.bounds.x+info.bounds.w <= info.scoreWidth+2,'末小节应在谱面宽度内');
  await page.screenshot({path:'artifacts/score-desktop.png',fullPage:true});

  await page.locator('[data-section-start="56"]').click();
  assert.equal(await page.locator('[data-section-start="56"]').getAttribute('aria-pressed'),'true');
  await page.locator('#zoom').selectOption('1.4');
  await page.waitForFunction(()=>Math.abs(api.settings.display.scale-1.26)<0.001);
  await page.screenshot({path:'artifacts/score-zoom.png',fullPage:true});
  await page.locator('#zoom').selectOption('1');
  await page.evaluate(()=>window.scrollTo(0,0));

  await page.pdf({path:'artifacts/score-print.pdf',preferCSSPageSize:true,printBackground:true});
  await page.emulateMedia({media:'print'});
  const printedRows=await page.locator('.at-surface>div').evaluateAll(rows=>rows.map(row=>({
    position:getComputedStyle(row).position,
    breakInside:getComputedStyle(row).breakInside,
    top:row.getBoundingClientRect().top,
    bottom:row.getBoundingClientRect().bottom
  })));
  for(const [index,row] of printedRows.entries()){
    assert.equal(row.position,'static','打印时谱行必须参与分页，避免绝对定位使下一页谱行重叠');
    assert.equal(row.breakInside,'avoid','打印时不可从谱行中间截断');
    if(index)assert.ok(row.top>=printedRows[index-1].bottom-1,'打印谱行不可相互重叠');
  }
  await page.screenshot({path:'artifacts/score-print.png',fullPage:true});
  await page.emulateMedia({media:'screen'});

  await page.setViewportSize({width:390,height:844});
  await page.waitForFunction(()=>document.getElementById('score-area').clientWidth < 390);
  await page.evaluate(()=>window.scrollTo(0,0));
  const mobile = await page.evaluate(()=>({
    page:document.documentElement.scrollWidth,
    viewport:window.innerWidth,
    scoreArea:document.getElementById('score-area').clientWidth,
    score:document.getElementById('score').scrollWidth
  }));
  assert.ok(mobile.page <= mobile.viewport,'手机页面本身不能横向溢出');
  assert.ok(mobile.score > mobile.scoreArea,'窄屏应允许在谱面内部横向滚动');
  await page.screenshot({path:'artifacts/score-mobile.png',fullPage:true});
  await page.evaluate(()=>document.getElementById('score-area').scrollLeft=500);
  await page.locator('[data-section-start="56"]').click();
  assert.equal(await page.locator('[data-section-start="56"]').getAttribute('aria-pressed'),'true');
  await page.waitForFunction(()=>{
    const score=document.getElementById('score');
    const bounds=api.renderer.boundsLookup.findMasterBarByIndex(55).visualBounds;
    const target=Math.min(document.documentElement.scrollHeight-window.innerHeight,window.scrollY+score.getBoundingClientRect().top+bounds.y-100);
    return Math.abs(window.scrollY-target)<2 && Math.abs(document.getElementById('score-area').scrollLeft-Math.min(document.getElementById('score-area').scrollWidth-document.getElementById('score-area').clientWidth,Math.max(0,bounds.x-20)))<2;
  });
  assert.deepEqual(errors,[],'浏览器不可出现脚本错误');
  assert.deepEqual(remoteRequests,[],'独立 HTML 不应发起网络请求');
  console.log('PASS: 离线 file URL、61小节16行SVG、标题、谱前图例、缩放、定位、打印与窄屏；无脚本错误或网络请求。');
} finally {
  await browser.close();
}
