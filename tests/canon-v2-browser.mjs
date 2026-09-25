import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {expandBars} from '../scripts/accompaniment-svg.mjs';
import {chromium} from 'playwright';
const browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH}:{})});
const url=new URL('../sheet_music/卡农指弹版本2.html',import.meta.url).href;
const data=JSON.parse(await readFile(new URL('../score/canon-v2.json',import.meta.url),'utf8'));
const expectedFrets=expandBars(data).flatMap(b=>b.events.flatMap(e=>(e.notes??[]).map(n=>String(n.fret))));
try{
 const context=await browser.newContext({offline:true,viewport:{width:1440,height:1000},reducedMotion:'reduce'});
 const page=await context.newPage();const errors=[],requests=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(/^https?:/.test(r.url()))requests.push(r.url());});
 await page.goto(url);
 assert.equal(await page.locator('h1').innerText(),'《卡农》指弹·版本 2');
 assert.match(await page.locator('.metadata').innerText(),/C[\s\S]*60 拍/);
 assert.equal(await page.locator('.measure').count(),9);assert.equal(await page.locator('.score-system').count(),3);
 assert.equal(await page.locator('.chord-diagram').count(),0);
 assert.equal(await page.locator('.chord-guide').count(),0);
 assert.doesNotMatch(await page.locator('.metadata').innerText(),/编配|演唱|变调夹/);
 assert.equal(await page.locator('#bar-9 .whole-note').count(),1);
 assert.deepEqual(await page.locator('#bar-9 .melody-number').allTextContents(),['1','—','—','—']);
 assert.equal(await page.locator('.lyric').count(),0);
 assert.doesNotMatch(await page.locator('.legend-content').textContent(),/歌词|下扫|上扫/);
 assert.deepEqual(await page.locator('.route [data-jump]').evaluateAll(nodes=>nodes.map(n=>Number(n.dataset.jump))),[1]);
 assert.equal(await page.locator('.source-link a').count(),0,'截图来源不虚构网页链接');
 for(const rows of ['4','2']){
  await page.locator('#bars-per-row').selectOption(rows);
  assert.equal(await page.locator('.numbered-melody').count(),9);
  assert.equal(await page.locator('.fret').count(),expectedFrets.length);
  assert.deepEqual(await page.locator('.fret').allTextContents(),expectedFrets);
  assert.equal(await page.locator('.score-system').count(),Math.ceil(9/Number(rows)));
  const overlaps=await page.locator('.measure').evaluateAll(bars=>bars.flatMap(bar=>{
   const lyrics=[...bar.querySelectorAll('.fret')];return lyrics.flatMap((a,i)=>lyrics.slice(i+1).filter(b=>a.getAttribute('y')===b.getAttribute('y')&&Math.min(a.getBBox().x+a.getBBox().width,b.getBBox().x+b.getBBox().width)-Math.max(a.getBBox().x,b.getBBox().x)>0.5).map(b=>[bar.dataset.bar,a.textContent,b.textContent]));
  }));assert.deepEqual(overlaps,[],'同弦相邻品数不重叠');
  const overflow=await page.locator('.measure').evaluateAll(bars=>bars.flatMap(bar=>{
   const r=bar.querySelector('.measure-highlight').getBBox();return [...bar.querySelectorAll('.numbered-melody text')].filter(t=>{const b=t.getBBox();return b.x<r.x-2||b.x+b.width>r.x+r.width+2;}).map(t=>[bar.dataset.bar,t.textContent]);
  }));assert.deepEqual(overflow,[],'简谱不能伸入邻小节');
 }
 await page.locator('#bars-per-row').selectOption('4');await page.locator('#zoom').selectOption('1');
 await page.screenshot({path:'artifacts/canon-v2-desktop.png',fullPage:true});
 await page.pdf({path:'artifacts/canon-v2-print.pdf',preferCSSPageSize:true,printBackground:true});
 for(const width of [320,390]){
  await page.setViewportSize({width,height:844});await page.locator('#bars-per-row').selectOption('auto');await page.locator('#zoom').selectOption('fit');
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  assert.equal(await page.locator('#score').getAttribute('data-bars-per-row'),'2');
 }
 await page.screenshot({path:'artifacts/canon-v2-mobile.png',fullPage:true});
 for(const value of ['0.5','0.65']){
  await page.locator('#zoom').selectOption(value);
  assert.ok(Math.abs(await page.locator('#score').evaluate(el=>el.clientWidth)-600*Number(value))<2);
 }
 await page.reload();assert.equal(await page.locator('#zoom').inputValue(),'0.65');
 await page.locator('#zoom').selectOption('fit');
 await page.locator('.section-picker > summary').click();
 await page.locator('.section-nav [data-jump="9"]').click();
 assert.equal(await page.locator('#bar-9').evaluate(el=>el===document.activeElement),true);
 await page.evaluate(()=>scrollTo(0,0));
 await page.locator('#auto-scroll-toggle').click();
 assert.equal(await page.locator('#auto-scroll-toggle').innerText(),'停');
 await page.waitForFunction(()=>scrollY>5);
 await page.evaluate(()=>scrollTo(0,document.documentElement.scrollHeight));
 assert.equal(await page.locator('#auto-scroll-toggle').innerText(),'停');
 await page.evaluate(()=>scrollTo(0,100));await page.waitForFunction(()=>scrollY>110);
 await page.locator('#auto-scroll-toggle').click();assert.equal(await page.locator('#auto-scroll-toggle').innerText(),'滚');
 assert.deepEqual(errors,[]);assert.deepEqual(requests,[]);
 const staticContext=await browser.newContext({offline:true,javaScriptEnabled:false});const staticPage=await staticContext.newPage();await staticPage.goto(url);
 assert.equal(await staticPage.locator('.measure').count(),9);assert.equal(await staticPage.locator('.fret').count(),expectedFrets.length);await staticContext.close();
 await page.goto(new URL('../index.html',import.meta.url).href);await page.locator('#search').fill('版本 2');
 assert.equal(await page.locator('.score-card').count(),1);await page.locator('[data-score-id="canon-v2-fingerstyle"] .open-score').click();assert.equal(await page.locator('h1').innerText(),'《卡农》指弹·版本 2');
 console.log('PASS: 卡农版本2共9小节、113个品数、全音符、无虚构和弦、简谱边界、手机、打印、离线和首页入口通过。');
}finally{await browser.close();}
