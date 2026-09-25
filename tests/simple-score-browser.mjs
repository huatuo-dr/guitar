import assert from 'node:assert/strict';
import {mkdir,readFile} from 'node:fs/promises';
import {chromium} from 'playwright';
const root=new URL('../',import.meta.url);
const browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH}:{})});
await mkdir(new URL('artifacts/',root),{recursive:true});
const url=new URL('sheet_music/后来弹唱伴奏.html',root).href;
try {
 const context=await browser.newContext({offline:true,viewport:{width:1280,height:900},reducedMotion:'reduce'});
 const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(url);
 const mode=()=>page.locator('#score').getAttribute('data-view-mode');
 assert.equal(await mode(),'full');assert.equal(await page.locator('#score .measure').count(),69);
 const hint=await page.locator('#view-hint').boundingBox(),button=await page.locator('#score-mode').boundingBox();
 assert.ok(button.y>=hint.y+hint.height,'切换按钮位于视图提示下方');
 const order=[...Array.from({length:64},(_,i)=>i+1),...Array.from({length:11},(_,i)=>i+45),65,66,67,68,69];
 const fullLyrics=await page.locator('#score .measure').evaluateAll((bars,order)=>order.flatMap(n=>[...bars[n-1].querySelectorAll('.lyric')].map(e=>e.textContent)),order);
 const fullChords=await page.locator('#score .measure').evaluateAll((bars,order)=>order.flatMap(n=>[...bars[n-1].querySelectorAll('.chord-name')].map(e=>e.textContent)),order);
 const originalInstrument=await page.locator('#score .measure').evaluateAll(bars=>bars.filter(b=>+b.dataset.bar<=4||(+b.dataset.bar>=57&&+b.dataset.bar<=64)).map(b=>b.outerHTML));
 await page.locator('#score-mode').click();assert.equal(await mode(),'simple');
 assert.equal(await page.locator('#score .simple-measure').count(),68);
 assert.equal(await page.locator('#score svg .measure').count(),12);
 assert.deepEqual(await page.locator('#score .measure').evaluateAll(bars=>bars.map(b=>+b.dataset.bar)),order);
 const ids=await page.locator('#score .measure').evaluateAll(bars=>bars.map(b=>b.id));assert.equal(new Set(ids).size,80);
 assert.equal(await page.locator('[data-score-route]').isVisible(),false);
 assert.equal(await page.locator('.section-nav [data-jump]').count(),10);
 assert.equal(await page.locator('.section-nav a').first().isVisible(),false,'切换简易谱后保持收起');
 await page.locator('.section-picker > summary').click();
 for(const target of ['1','5','13','29','45','49','57','45-repeat-2','49-repeat-2','65']){
  await page.locator(`.section-nav [data-jump="${target}"]`).click();assert.equal(await page.evaluate(()=>document.activeElement.id),'bar-'+target);
 }
 await page.locator('.section-nav [data-jump="45-repeat-2"]').click();
 await page.locator('#bars-per-row').selectOption('2');assert.equal(await page.locator('#bar-45-repeat-2').getAttribute('class'),'simple-cell simple-measure measure current');
 await page.locator('#bars-per-row').selectOption('4');
 await page.reload();assert.equal(await page.evaluate(()=>location.hash),'#bar-45-repeat-2');
 assert.equal(await page.locator('.section-nav a').first().isVisible(),false,'刷新后默认收起');
 await page.locator('.section-picker > summary').click();
 await page.locator('#score-mode').click();assert.equal(await page.locator('.section-nav [data-jump]').count(),8);
 assert.equal(await page.evaluate(()=>location.hash),'#bar-45','刷新后切回完整谱也映射重复段定位');
 assert.equal(await page.locator('#bar-45').getAttribute('class'),'measure current');assert.equal(await page.locator('[data-score-route]').isVisible(),true);
 await page.locator('#score-mode').click();
 await page.locator('.section-nav [data-jump="65"]').click();
 assert.deepEqual(await page.locator('#score svg .measure').evaluateAll(bars=>bars.map(b=>b.outerHTML)),originalInstrument,'前奏间奏SVG逐字一致');
 assert.deepEqual(await page.locator('#score .lyric, #score .simple-lyric:not(.simple-placeholder)').allTextContents(),fullLyrics,'所有歌词顺序不变');
 assert.deepEqual((await page.locator('#score .chord-name, #score .simple-chord').allTextContents()).filter(Boolean),fullChords,'所有和弦顺序不变');
 assert.equal(await page.locator('#bar-14 .simple-placeholder').textContent(),'\u3000','无新歌词的换和弦使用独立下划线');
 const checkUnderlines=async()=>{
  const invalid=await page.locator('#score .simple-cell').evaluateAll(cells=>cells.filter(cell=>{
   const chord=cell.querySelector('.simple-chord').textContent;
   const lyric=cell.querySelector('.simple-lyric');
   const style=getComputedStyle(lyric);
   const underline=style.textDecorationLine.includes('underline');
   return chord?(!underline||style.textDecorationThickness!=='2px'||(lyric.classList.contains('simple-placeholder')&&lyric.textContent!=='\u3000')):underline;
  }).length);
  assert.equal(invalid,0,'和弦对应的歌词及空位均使用 2px 下划线');
  const widths=await page.evaluate(()=>[
   document.querySelector('#score .simple-chord-lyric'),
   document.querySelector('#score .simple-placeholder:not(:empty)')
  ].map(el=>el.getBoundingClientRect().width));
  assert.ok(Math.abs(widths[0]-widths[1])<0.1,'独立下划线与单字下划线等长');
 };
 await checkUnderlines();
 await page.emulateMedia({media:'print'});await checkUnderlines();await page.emulateMedia({media:null});
 assert.equal(await page.locator('#score .bar-number:visible, #score .simple-bar-number, #score .simple-mark').count(),0,'简易谱不显示小节号与跳尾');
 assert.equal(await page.locator('#score .simple-section-heading small').count(),0,'段标题没有小节范围');
 assert.deepEqual(await page.locator('#score-mode').evaluate(el=>{const s=getComputedStyle(el);return [s.backgroundColor,s.color,s.borderTopColor];}),['rgb(49, 94, 77)','rgb(255, 255, 255)','rgb(49, 94, 77)']);
 assert.equal(await page.locator('.simple-line .simple-section-heading').count(),0,'歌词区不显示段名');
 for(const width of [1280,390,320]){
  await page.setViewportSize({width,height:900});
  await page.locator('#bars-per-row').selectOption('auto');await page.locator('#zoom').selectOption('fit');
  await page.waitForFunction(expected=>Number(document.getElementById('score').dataset.barsPerRow)===expected,width<700?2:4);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'页面无水平溢出');
  const collisions=await page.locator('#score .simple-line').evaluateAll(bars=>bars.flatMap(bar=>{
   const cells=[...bar.querySelectorAll('.simple-cell')].map(c=>c.getBoundingClientRect());
   return cells.flatMap((a,i)=>cells.slice(i+1).filter(b=>Math.min(a.right,b.right)-Math.max(a.left,b.left)>1&&Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top)>1));
  }));assert.equal(collisions.length,0,'和弦歌词单元不相互覆盖');
  const misaligned=await page.locator('#score .simple-cell').evaluateAll(cells=>cells.filter(cell=>{
   const chord=cell.querySelector('.simple-chord').getBoundingClientRect(),lyric=cell.querySelector('.simple-lyric').getBoundingClientRect();
   return Math.abs(chord.left-lyric.left)>1||chord.bottom>lyric.top+1;
  }).length);assert.equal(misaligned,0,'换行后和弦仍在对应歌词正上方');
  await page.locator('#score').screenshot({path:`artifacts/houlai-simple-${width}.png`});
 }
 const lyricLayout=()=>page.locator('.simple-line').evaluateAll(lines=>lines.map(line=>{
  const origin=line.getBoundingClientRect();
  return [...line.querySelectorAll('.simple-cell')].map(cell=>{const r=cell.getBoundingClientRect();return [r.left-origin.left,r.top-origin.top];});
 }));
 await page.locator('#bars-per-row').selectOption('2');const twoLayout=await lyricLayout();
 await page.locator('#bars-per-row').selectOption('4');assert.deepEqual(await lyricLayout(),twoLayout,'歌词换行与每行小节设置无关');
 const wrapsWithinBar=await page.locator('.simple-line').evaluateAll(lines=>lines.some(line=>{
  const bars=new Map();
  for(const cell of line.querySelectorAll('.simple-cell')){const key=cell.dataset.bar;if(!bars.has(key))bars.set(key,new Set());bars.get(key).add(cell.getBoundingClientRect().top);}
  return [...bars.values()].some(rows=>rows.size>1);
 }));assert.ok(wrapsWithinBar,'窄屏可以在小节内部自然换行');
 await page.locator('#zoom').selectOption('1.3');
 assert.ok(await page.locator('.simple-instrument-scroll').first().evaluate(e=>e.scrollWidth>e.clientWidth));
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 await page.locator('.section-nav [data-jump="65"]').click();
 assert.equal(await page.evaluate(()=>document.activeElement.id),'bar-65');
 await page.locator('#score-mode').click();assert.equal(await mode(),'full');
 assert.equal(await page.locator('#score .measure').count(),69);assert.equal(await page.locator('#bar-65').getAttribute('class'),'measure current');
 await page.locator('#score-mode').click();
 await page.reload();assert.equal(await mode(),'simple');
 await page.locator('#bars-per-row').selectOption('2');
 const preferences=await page.evaluate(()=>JSON.stringify({...localStorage}));
 await page.pdf({path:'artifacts/houlai-simple-print.pdf',preferCSSPageSize:true,printBackground:true});
 assert.equal(await mode(),'simple');assert.equal(await page.locator('#score').getAttribute('data-bars-per-row'),'2');
 assert.equal(await page.evaluate(()=>JSON.stringify({...localStorage})),preferences);
 await page.locator('#auto-scroll-toggle').click();
 assert.equal(await page.locator('#auto-scroll-toggle').textContent(),'停');
 await page.locator('#score-mode').click();assert.equal(await page.locator('#auto-scroll-toggle').textContent(),'停');
 await page.locator('#auto-scroll-toggle').click();
 await page.locator('#score-mode').click();
 const downloadPromise=page.waitForEvent('download');await page.locator('.export-menu > summary').click();await page.locator('#download').click();const download=await downloadPromise;
 const downloadPath=new URL('artifacts/houlai-simple-download.html',root);
 await download.saveAs(downloadPath.pathname);
 const downloaded=await readFile(downloadPath,'utf8');assert.match(downloaded,/simple-four-bar-score/);
 const clean=await browser.newContext({offline:true});const downloadedPage=await clean.newPage();
 await downloadedPage.goto(downloadPath.href);assert.equal(await downloadedPage.locator('#score').getAttribute('data-view-mode'),'full');
 await downloadedPage.locator('#score-mode').click();assert.equal(await downloadedPage.locator('.simple-measure').count(),68);await clean.close();
 assert.deepEqual(errors,[]);await context.close();
 const blocked=await browser.newContext({offline:true});
 await blocked.addInitScript(()=>Object.defineProperty(window,'localStorage',{get(){throw new DOMException('Blocked','SecurityError');}}));
 const blockedPage=await blocked.newPage();await blockedPage.goto(url);await blockedPage.locator('#score-mode').click();
 assert.equal(await blockedPage.locator('#score').getAttribute('data-view-mode'),'simple');await blocked.close();
 const noJS=await browser.newContext({offline:true,javaScriptEnabled:false});const staticPage=await noJS.newPage();await staticPage.goto(url);
 assert.equal(await staticPage.locator('#score .measure').count(),69);assert.equal(await staticPage.locator('#score-mode').isVisible(),false);await noJS.close();
 console.log('PASS: 简易谱切换、歌词和弦保真、前奏间奏原样、响应式对齐、定位、记忆、打印、自动滚动、离线下载及无存储/无JS回退。');
} finally {await browser.close();}
