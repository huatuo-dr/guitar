import assert from 'node:assert/strict';
import {readFile,mkdir} from 'node:fs/promises';
import {chromium} from 'playwright';
import {eventBeats} from '../scripts/numbered-notation.mjs';
const root=new URL('../',import.meta.url);
await mkdir(new URL('artifacts/',root),{recursive:true});
const browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH}:{})});
const entries=[['laonanhai','老男孩弹唱伴奏.html',89],['kongxin','空心弹唱伴奏.html',72],['turanhaoxiangni','突然好想你弹唱伴奏.html',62]];
try{
 for(const [id,file,total] of entries){
  const data=JSON.parse(await readFile(new URL(`score/${id}.json`,root),'utf8'));
  const vocals=JSON.parse(await readFile(new URL(`score/${id}-vocal.json`,root),'utf8'));
  const order=[],lyrics=[],chords=[];
  // Derive expected performance directly from the written voices and route.
  data.route.forEach((route,r)=>{
   for(let number=route.start;number<=route.end;number++){
    order.push(number);chords.push(...data.bars[number-1].chords.map(c=>c[1]));
    const events=vocals.bars[number-1].events;
    const dual=events.some(e=>(e.lyrics?.length??0)>1);
    const verse=dual?data.simpleScore.routeVerses[r]:0;let beat=1;
    for(const event of events){
     if(event.lyrics?.[verse])lyrics.push(event.lyrics[verse]);
     beat+=eventBeats(event);
    }
   }
  });
  const context=await browser.newContext({offline:true,viewport:{width:1280,height:900},reducedMotion:'reduce'});
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(new URL('sheet_music/'+file,root).href);
  assert.equal(await page.locator('#score').getAttribute('data-view-mode'),'full');
  assert.equal(await page.locator('#score .measure').count(),data.bars.length);
  await page.locator('#score-mode').click();
  assert.equal(await page.locator('#score .measure').count(),total);
  assert.deepEqual(await page.locator('#score .measure').evaluateAll(bars=>bars.map(b=>+b.dataset.bar)),order);
  const ids=await page.locator('#score .measure').evaluateAll(bars=>bars.map(b=>b.id));assert.equal(new Set(ids).size,total);
  assert.deepEqual(await page.locator('#score .simple-lyric:not(.simple-placeholder),#score svg .lyric').allTextContents(),lyrics,'展开后每遍使用正确歌词，单行公共歌词复用');
  assert.deepEqual((await page.locator('#score .simple-chord,#score svg .chord-name').allTextContents()).filter(Boolean).map(name=>name.replace(/†$/,'')),chords);
  assert.equal(await page.locator('.simple-cell').evaluateAll(cells=>cells.filter(c=>c.querySelectorAll('.simple-lyric').length!==1).length),0);
  await page.locator('.section-picker > summary').click();
  const targets=await page.locator('.section-nav [data-jump]').evaluateAll(links=>links.map(l=>l.dataset.jump));
  assert.equal(new Set(targets).size,targets.length);
  for(const target of targets){await page.locator(`.section-nav [data-jump="${target}"]`).click();assert.equal(await page.evaluate(()=>document.activeElement.id),'bar-'+target);}
  const repeat=targets.find(target=>target.includes('-repeat-'));
  await page.locator(`.section-nav [data-jump="${repeat}"]`).click();await page.reload();
  await page.locator('#score-mode').click();
  assert.equal(await page.evaluate(()=>location.hash),'#bar-'+repeat.replace(/-repeat-\d+$/,''));
  assert.equal(await page.locator('#score .measure').count(),data.bars.length);
  await page.locator('#score-mode').click();
  for(const width of [1280,390,320]){
   await page.setViewportSize({width,height:900});
   await page.locator('#bars-per-row').selectOption('auto');await page.locator('#zoom').selectOption('fit');
   await page.waitForFunction(n=>+document.getElementById('score').dataset.barsPerRow===n,width<700?2:4);
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
   const collisions=await page.locator('.simple-line').evaluateAll(lines=>lines.flatMap(line=>{
    const cells=[...line.querySelectorAll('.simple-cell')].map(c=>c.getBoundingClientRect());
    return cells.flatMap((a,i)=>cells.slice(i+1).filter(b=>Math.min(a.right,b.right)-Math.max(a.left,b.left)>1&&Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top)>1));
   }));assert.equal(collisions.length,0);
   const bad=await page.locator('.simple-cell').evaluateAll(cells=>cells.filter(c=>{
    const ch=c.querySelector('.simple-chord'),ly=c.querySelector('.simple-lyric');
    const a=ch.getBoundingClientRect(),b=ly.getBoundingClientRect();
    return Math.abs(a.left-b.left)>1||a.bottom>b.top+1||(ch.textContent&&(!getComputedStyle(ly).textDecorationLine.includes('underline')||getComputedStyle(ly).textDecorationThickness!=='2px'||(ly.classList.contains('simple-placeholder')&&ly.textContent!=='\u3000')));
   }).length);assert.equal(bad,0);
   assert.equal(await page.locator('#score .bar-number:visible,.simple-line .simple-section-heading').count(),0);
   if(width!==320)await page.locator('#score').screenshot({path:`artifacts/${id}-simple-${width}.png`});
  }
  await page.locator('#bars-per-row').selectOption('2');await page.locator('#zoom').selectOption('0.65');
  await page.pdf({path:`artifacts/${id}-simple-print.pdf`,preferCSSPageSize:true,printBackground:true});
  assert.equal(await page.locator('#score').getAttribute('data-view-mode'),'simple');assert.equal(await page.locator('#score').getAttribute('data-bars-per-row'),'2');
  const promise=page.waitForEvent('download');await page.locator('.export-menu > summary').click();await page.locator('#download').click();const download=await promise;
  const saved=new URL(`artifacts/${id}-simple-download.html`,root);await download.saveAs(saved.pathname);
  const fresh=await browser.newContext({offline:true});const restored=await fresh.newPage();await restored.goto(saved.href);
  assert.equal(await restored.locator('#score').getAttribute('data-view-mode'),'full');await restored.locator('#score-mode').click();assert.equal(await restored.locator('#score .measure').count(),total);await fresh.close();
  await page.reload();assert.equal(await page.locator('#score').getAttribute('data-view-mode'),'simple');
  assert.deepEqual(errors,[]);await context.close();
  console.log(`PASS: ${file} 展开${total}小节、分遍歌词、和弦下划线、全部定位、2/4小节、手机、打印、离线下载与模式记忆。`);
 }
 for(const file of ['偏爱指弹.html','卡农指弹.html','卡农指弹版本2.html']){
  const page=await browser.newPage();await page.goto(new URL('sheet_music/'+file,root).href);assert.equal(await page.locator('#score-mode').count(),0,'指弹不增加简易谱');await page.close();
 }
}finally{await browser.close();}
