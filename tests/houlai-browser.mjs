import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH}:{})});
const url=new URL('../sheet_music/后来弹唱伴奏.html',import.meta.url).href;
try{
 const context=await browser.newContext({offline:true,viewport:{width:1440,height:1000},reducedMotion:'reduce'});
 const page=await context.newPage();const errors=[],requests=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(/^https?:/.test(r.url()))requests.push(r.url());});
 await page.goto(url);
 assert.equal(await page.locator('h1').innerText(),'《后来》弹唱伴奏');
 assert.match(await page.locator('.metadata').innerText(),/刘若英[\s\S]*E♭[\s\S]*C 指法[\s\S]*3 品/);
 assert.equal(await page.locator('.measure').count(),49);assert.equal(await page.locator('.score-system').count(),13);
 assert.equal(await page.locator('.melody-tuplet').count(),2);
 assert.equal(await page.locator('#bar-23 .melody-accidental').textContent(),'♭');
 assert.equal(await page.locator('#bar-3 .hammer').allTextContents().then(t=>t.join('')),'PP');
 assert.equal(await page.locator('#bar-4 .hammer').allTextContents().then(t=>t.join('')),'HP');
 assert.deepEqual(await page.locator('.route [data-jump]').evaluateAll(nodes=>nodes.map(n=>Number(n.dataset.jump))),[1,13,29,31,44]);
 assert.equal(await page.locator('.source-link a').count(),0,'截图来源不虚构网页链接');
 for(const rows of ['4','2']){
  await page.locator('#bars-per-row').selectOption(rows);
  assert.equal(await page.locator('.numbered-melody').count(),49);
  assert.ok(await page.locator('#bar-29 .melody-slur').count()>0,'第二结尾保留入弧');
  const overflow=await page.locator('.measure').evaluateAll(bars=>bars.flatMap(bar=>{
   const r=bar.querySelector('.measure-highlight').getBBox();return [...bar.querySelectorAll('.numbered-melody text')].filter(t=>{const b=t.getBBox();return b.x<r.x-2||b.x+b.width>r.x+r.width+2;}).map(t=>[bar.dataset.bar,t.textContent]);
  }));assert.deepEqual(overflow,[],'简谱与歌词不能伸入邻小节');
 }
 await page.locator('#bars-per-row').selectOption('4');await page.locator('#zoom').selectOption('1');
 await page.screenshot({path:'artifacts/houlai-desktop.png',fullPage:true});
 await page.pdf({path:'artifacts/houlai-print.pdf',preferCSSPageSize:true,printBackground:true});
 for(const width of [320,390]){
  await page.setViewportSize({width,height:844});await page.locator('#bars-per-row').selectOption('auto');await page.locator('#zoom').selectOption('fit');
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  assert.equal(await page.locator('#score').getAttribute('data-bars-per-row'),'2');
 }
 await page.screenshot({path:'artifacts/houlai-mobile.png',fullPage:true});
 assert.deepEqual(errors,[]);assert.deepEqual(requests,[]);
 const staticContext=await browser.newContext({offline:true,javaScriptEnabled:false});const staticPage=await staticContext.newPage();await staticPage.goto(url);
 assert.equal(await staticPage.locator('.measure').count(),49);assert.ok(await staticPage.locator('.lyric').count()>0);await staticContext.close();
 await page.goto(new URL('../index.html',import.meta.url).href);await page.locator('#search').fill('刘若英');
 assert.equal(await page.locator('.score-card').count(),1);await page.locator('[data-score-id="hou-lai-accompaniment"] .open-score').click();assert.equal(await page.locator('h1').innerText(),'《后来》弹唱伴奏');
 console.log('PASS: 后来49小节、技法、三连音、降号、歌词边界、手机、打印、离线和首页入口通过。');
}finally{await browser.close();}
