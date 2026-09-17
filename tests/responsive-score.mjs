import assert from 'node:assert/strict';
import {chromium} from 'playwright';

const browser = await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ? {executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH} : {})});
const root = new URL('../',import.meta.url);
async function ready(page, bars) {
  await page.waitForFunction(expected => document.body.dataset.renderState === 'ready' && Number(document.getElementById('score').dataset.barsPerRow) === expected, bars);
}
async function checkRows(page, fingerstyle, total, perRow) {
  if(!fingerstyle){
    assert.equal(await page.locator('.numbered-melody').count(),total,'换行后每小节仍保留简谱');
    assert.ok(await page.locator('#bar-46 .melody-tie').count()>0,'跨小节延音保留起点');
    assert.ok(await page.locator('#bar-47 .melody-tie').count()>0,'跨行延音保留终点');
  }
  const rows = await page.evaluate(({fingerstyle,total}) => fingerstyle
    ? Array.from({length:total},(_,i) => api.renderer.boundsLookup.findMasterBarByIndex(i).visualBounds.y)
    : [...document.querySelectorAll('.score-system')].flatMap((row,i) => [...row.querySelectorAll('.measure')].map(() => i)), {fingerstyle,total});
  assert.equal(rows.length,total);
  assert.equal(new Set(rows).size,Math.ceil(total/perRow));
  for (let i=0;i<total;i+=perRow) assert.equal(new Set(rows.slice(i,i+perRow)).size,1);
}
async function fits(page, fingerstyle) {
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth<=innerWidth),true,'页面不能横向溢出');
  const overflow = await page.locator(fingerstyle ? '#score-area' : '.score-viewport').evaluate(el => el.scrollWidth-el.clientWidth);
  assert.ok(overflow<=2,`适应宽度不应要求横向滑动，实际溢出${overflow}px`);
}
try {
  for (const [file,fingerstyle,total] of [['偏爱指弹.html',true,61],['老男孩弹唱伴奏.html',false,55]]) {
    const context = await browser.newContext({offline:true,viewport:{width:390,height:844},reducedMotion:'reduce'});
    const page = await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
    const url = new URL('sheet_music/'+file,root).href;
    await page.goto(url);
    assert.equal(await page.locator('#bars-per-row').count(),1,'每份曲谱都应提供每行小节选择');
    await ready(page,2);
    assert.equal(await page.locator('#zoom').inputValue(),'fit');
    assert.equal(await page.locator('#bars-per-row').inputValue(),'auto');
    await checkRows(page,fingerstyle,total,2);await fits(page,fingerstyle);
    await page.screenshot({path:`artifacts/responsive-${fingerstyle?'pianai':'laonanhai'}-390.png`,fullPage:true});
    await page.setViewportSize({width:320,height:740});await ready(page,2);
    await page.waitForFunction(() => document.getElementById('score').clientWidth<=document.getElementById('score').parentElement.clientWidth+1);
    await fits(page,fingerstyle);
    await page.setViewportSize({width:844,height:390});await ready(page,4);
    await checkRows(page,fingerstyle,total,4);await fits(page,fingerstyle);
    await page.locator('#bars-per-row').selectOption('2');await ready(page,2);
    for (const value of ['0.5','0.65']) {
      await page.locator('#zoom').selectOption(value);await ready(page,2);
      assert.ok(Math.abs(await page.locator('#score').evaluate(el=>el.clientWidth)-600*Number(value))<2);
      await checkRows(page,fingerstyle,total,2);
    }
    await page.reload();await ready(page,2);
    assert.equal(await page.locator('#zoom').inputValue(),'0.65');
    assert.equal(await page.locator('#bars-per-row').inputValue(),'2');
    await page.locator('#bars-per-row').selectOption('4');await ready(page,4);
    await page.setViewportSize({width:390,height:844});await ready(page,4);
    await page.locator('#zoom').selectOption('1');await ready(page,4);
    assert.equal(await page.locator(fingerstyle?'#score-area':'.score-viewport').evaluate(el=>el.scrollWidth>el.clientWidth),true,'手动放大仍能横向滚动');
    await page.locator('#bars-per-row').selectOption('2');await ready(page,2);
    await page.locator('#zoom').selectOption('0.65');await ready(page,2);
    const stored = await page.evaluate(()=>JSON.stringify({...localStorage}));
    await page.evaluate(()=>{
      window.printLayouts=[];
      for(const event of ['beforeprint','afterprint']) window.addEventListener(event,()=>window.printLayouts.push([event,Number(document.getElementById('score').dataset.barsPerRow)]));
    });
    await page.pdf({path:`artifacts/responsive-${fingerstyle?'pianai':'laonanhai'}-print.pdf`,preferCSSPageSize:true,printBackground:true});
    await ready(page,2);
    assert.deepEqual(await page.evaluate(()=>window.printLayouts),[['beforeprint',4],['afterprint',2]],'直接打印应临时切换并恢复行数');
    await checkRows(page,fingerstyle,total,2);
    await page.emulateMedia({media:'print'});await ready(page,4);
    await checkRows(page,fingerstyle,total,4);
    await page.emulateMedia({media:'screen'});await ready(page,2);
    await checkRows(page,fingerstyle,total,2);
    assert.equal(await page.locator('#zoom').inputValue(),'0.65');
    assert.equal(await page.evaluate(()=>JSON.stringify({...localStorage})),stored,'打印不能覆盖用户偏好');
    await page.locator('#zoom').selectOption('fit');await ready(page,2);await fits(page,fingerstyle);
    if (fingerstyle) {
      await page.locator('[data-section-start="56"]').click();
      assert.equal(await page.locator('[data-section-start="56"]').getAttribute('aria-pressed'),'true');
      assert.equal(await page.locator('#score svg text').filter({hasText:/^\*$/}).count(),90);
    } else {
      await page.locator('.section-nav [data-jump="50"]').click();
      assert.equal(await page.locator('#bar-50').evaluate(el=>el===document.activeElement),true);
      assert.equal(await page.locator('#bar-29').locator('.volta-label').textContent(),'1.（续）');
    }
    assert.deepEqual(errors,[]);await context.close();

    const blocked = await browser.newContext({offline:true,viewport:{width:390,height:844}});
    await blocked.addInitScript(()=>Object.defineProperty(window,'localStorage',{get(){throw new DOMException('Blocked','SecurityError');}}));
    const fallback = await blocked.newPage();await fallback.goto(url);await ready(fallback,2);await fits(fallback,fingerstyle);
    await fallback.locator('#zoom').selectOption('0.5');await ready(fallback,2);await blocked.close();
  }
  console.log('PASS: 两份曲谱自动/2/4小节、适应宽度、50%/65%、横竖屏、偏好记忆、禁用存储、打印及定位回归通过。');
} finally {await browser.close();}
