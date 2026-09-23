import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH}:{})});
const url=new URL('../sheet_music/突然好想你弹唱伴奏.html',import.meta.url).href;
try{
 const context=await browser.newContext({offline:true,viewport:{width:1440,height:1000},reducedMotion:'reduce'});
 const page=await context.newPage();const errors=[],requests=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(/^https?:/.test(r.url()))requests.push(r.url());});
 await page.goto(url);
 assert.equal(await page.locator('h1').innerText(),'《突然好想你》弹唱伴奏');
 assert.match(await page.locator('.metadata').innerText(),/五月天[\s\S]*D[\s\S]*C 指法[\s\S]*2 品/);
 assert.equal(await page.locator('.measure').count(),55);assert.equal(await page.locator('.score-system').count(),14);
 assert.match(await page.locator('.source-link').innerText(),/革命吉他/);
 assert.equal(await page.locator('.chord-card').count(),11);
 assert.equal(await page.locator('#bar-3 .tab-tie').count(),1);
 assert.equal(await page.locator('.slide-label, .hammer, .melody-accidental').count(),0);
 assert.deepEqual(await page.locator('#bar-55 .melody-number').allTextContents(),['0','0','0','0']);
 assert.deepEqual(await page.locator('.route [data-jump]').evaluateAll(nodes=>nodes.map(n=>Number(n.dataset.jump))),[1,5,13]);
 assert.equal(await page.locator('.source-link a').count(),0,'截图来源不虚构网页链接');
 for(const rows of ['4','2']){
  await page.locator('#bars-per-row').selectOption(rows);
  assert.equal(await page.locator('.numbered-melody').count(),55);
  assert.equal(await page.locator('#bar-5 > circle[cx="58"][cy="137"]').count(),1,'第5小节左侧显示反复起点圆点');
  for(const bar of [53,54]){assert.equal(await page.locator(`#bar-${bar} .melody-tie`).count(),1);assert.equal(await page.locator(`#bar-${bar} .tab-tie`).count(),1);}
  assert.equal(await page.locator('.score-system').count(),Math.ceil(55/Number(rows)));
  const overlaps=await page.locator('.measure').evaluateAll(bars=>bars.flatMap(bar=>{
   const lyrics=[...bar.querySelectorAll('.lyric')];return lyrics.flatMap((a,i)=>lyrics.slice(i+1).filter(b=>a.getAttribute('y')===b.getAttribute('y')&&Math.min(a.getBBox().x+a.getBBox().width,b.getBBox().x+b.getBBox().width)-Math.max(a.getBBox().x,b.getBBox().x)>0.5).map(b=>[bar.dataset.bar,a.textContent,b.textContent]));
  }));assert.deepEqual(overlaps,[],'同一行歌词不重叠');
  const overflow=await page.locator('.measure').evaluateAll(bars=>bars.flatMap(bar=>{
   const r=bar.querySelector('.measure-highlight').getBBox();return [...bar.querySelectorAll('.numbered-melody text')].filter(t=>{const b=t.getBBox();return b.x<r.x-2||b.x+b.width>r.x+r.width+2;}).map(t=>[bar.dataset.bar,t.textContent]);
  }));assert.deepEqual(overflow,[],'简谱与歌词不能伸入邻小节');
 }
 await page.locator('#bars-per-row').selectOption('4');await page.locator('#zoom').selectOption('1');
 await page.screenshot({path:'artifacts/turanhaoxiangni-desktop.png',fullPage:true});
 await page.pdf({path:'artifacts/turanhaoxiangni-print.pdf',preferCSSPageSize:true,printBackground:true});
 for(const width of [320,390]){
  await page.setViewportSize({width,height:844});await page.locator('#bars-per-row').selectOption('auto');await page.locator('#zoom').selectOption('fit');
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  assert.equal(await page.locator('#score').getAttribute('data-bars-per-row'),'2');
 }
 await page.screenshot({path:'artifacts/turanhaoxiangni-mobile.png',fullPage:true});
 for(const value of ['0.5','0.65']){
  await page.locator('#zoom').selectOption(value);
  assert.ok(Math.abs(await page.locator('#score').evaluate(el=>el.clientWidth)-600*Number(value))<2);
 }
 await page.reload();assert.equal(await page.locator('#zoom').inputValue(),'0.65');
 await page.locator('#zoom').selectOption('fit');
 await page.locator('.section-nav [data-jump="50"]').click();
 assert.equal(await page.locator('#bar-50').evaluate(el=>el===document.activeElement),true);
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
 assert.equal(await staticPage.locator('.measure').count(),55);assert.ok(await staticPage.locator('.lyric').count()>0);await staticContext.close();
 await page.goto(new URL('../index.html',import.meta.url).href);await page.locator('#search').fill('五月天');
 assert.equal(await page.locator('.score-card').count(),1);await page.locator('[data-score-id="tu-ran-hao-xiang-ni-accompaniment"] .open-score').click();assert.equal(await page.locator('h1').innerText(),'《突然好想你》弹唱伴奏');
 console.log('PASS: 突然好想你新版本55小节、前奏、反复、跨小节延音、歌词边界与间距、手机、打印、离线和首页入口通过。');
}finally{await browser.close();}
