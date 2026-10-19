import assert from 'node:assert/strict';
import {mkdir,readFile} from 'node:fs/promises';
import {chromium} from 'playwright';
const root=new URL('../',import.meta.url);
const output=new URL('artifacts/xiangnideye/',root);await mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH}:{})});
try{
 const context=await browser.newContext({offline:true,viewport:{width:1280,height:900},reducedMotion:'reduce'});
 const page=await context.newPage(),errors=[],remote=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(/^https?:/.test(r.url()))remote.push(r.url());});
 await page.goto(new URL('sheet_music/想你的夜仅副歌.html',root).href);
 assert.equal(await page.locator('h1').innerText(),'《想你的夜》仅副歌');
 assert.match(await page.locator('.metadata').innerText(),/关喆[\s\S]*4\/4[\s\S]*♭E[\s\S]*C 指法/);
 assert.equal(await page.locator('#score .measure').count(),9);assert.equal(await page.locator('.chord-card').count(),9);
 assert.equal(await page.locator('.section-picker').getAttribute('open'),null);
 for(const rows of ['4','2']){
  await page.locator('#bars-per-row').selectOption(rows);
  assert.equal(await page.locator('#score .measure').count(),9);
  assert.equal(await page.locator('#score .numbered-melody').count(),9);
  assert.deepEqual(await page.locator('#bar-1 .lyric').allTextContents(),['想','你','的']);
  assert.deepEqual(await page.locator('#bar-9 .lyric').allTextContents(),['原','点']);
  assert.equal(await page.locator('#score .volta-label').count(),0);
  assert.equal(await page.locator('#score .tab-rest-quarter').count(),1);
  const overlaps=await page.locator('#score .measure').evaluateAll(bars=>bars.flatMap(bar=>{
   const lyrics=[...bar.querySelectorAll('.lyric')];return lyrics.flatMap((a,i)=>lyrics.slice(i+1).filter(b=>a.getAttribute('y')===b.getAttribute('y')&&Math.min(a.getBBox().x+a.getBBox().width,b.getBBox().x+b.getBBox().width)-Math.max(a.getBBox().x,b.getBBox().x)>0.5).map(b=>[bar.dataset.bar,a.textContent,b.textContent]));
  }));assert.deepEqual(overlaps,[],'歌词不重叠');
 }
 await page.locator('#bars-per-row').selectOption('4');
 await page.screenshot({path:new URL('full-desktop.png',output).pathname,fullPage:true});
 await page.pdf({path:new URL('full-print.pdf',output).pathname,preferCSSPageSize:true,printBackground:true});
 await page.locator('#score-mode').click();
 assert.equal(await page.locator('#score .measure').count(),9);
 assert.equal(await page.locator('.simple-instrument-score .measure').count(),1);
 const words=(await page.locator('.simple-lyric').allTextContents()).join('').replace(/\s/g,'');
 assert.equal(words,'夜多希望你能在我身边不知道你心里还能否为我改变wo想你的夜求你让我再爱你一遍让爱再回到原点');
 assert.doesNotMatch(words,/切|分/);
 assert.equal(await page.locator('#bar-1-repeat-2').count(),0);
 await page.screenshot({path:new URL('simple-desktop.png',output).pathname,fullPage:true});
 for(const width of [320,393]){
  await page.setViewportSize({width,height:852});await page.locator('#bars-per-row').selectOption('auto');
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await page.locator('#score-mode').click();
  assert.equal(await page.locator('#score').getAttribute('data-bars-per-row'),'2');
  assert.ok(await page.locator('.score-viewport').evaluate(el=>el.scrollWidth-el.clientWidth<=2));
  await page.screenshot({path:new URL(`full-${width}.png`,output).pathname,fullPage:true});
  await page.locator('#score-mode').click();
 }
 for(const mode of ['simple','full']){
  if(await page.locator('#score').getAttribute('data-view-mode')!==mode)await page.locator('#score-mode').click();
  await page.locator('#bars-per-row').selectOption('4');
  await page.locator('.export-menu > summary').click();await page.locator('#export-image').click();
  await page.waitForFunction(()=>document.querySelector('.export-dialog')?.dataset.state==='ready',{},{timeout:60000});
  const coverage=await page.locator('.export-images figure').evaluateAll(nodes=>nodes.flatMap(n=>JSON.parse(n.dataset.bars)));
  assert.deepEqual(coverage,await page.locator('#score .measure').evaluateAll(nodes=>nodes.map(n=>n.id)));
  assert.ok(await page.locator('.export-images img').evaluateAll(nodes=>nodes.length>0&&nodes.every(n=>n.naturalWidth===1600&&n.naturalHeight<=2400)));
  const saving=page.waitForEvent('download');await page.locator('.export-images a[download]').first().click();
  const png=await saving;await png.saveAs(new URL('export-'+mode+'.png',output).pathname);
  assert.equal((await readFile(await png.path())).subarray(0,8).toString('hex'),'89504e470d0a1a0a');
  await page.locator('.export-close').click();
 }
 await page.locator('#score-mode').click();
 await page.waitForFunction(()=>!document.getElementById('player-play').disabled);
 await page.locator('#player-play').click();await page.waitForFunction(()=>document.body.dataset.playerState==='playing');
 await page.evaluate(()=>{
  const node=accompanimentPlayer.api._player.instance._output._audioNode,generate=node.onaudioprocess;window.audioPeak=0;
  node.onaudioprocess=event=>{generate(event);for(const sample of event.outputBuffer.getChannelData(0))window.audioPeak=Math.max(window.audioPeak,Math.abs(sample));};
 });
 await page.waitForFunction(()=>window.audioPeak>0.001);
 await page.locator('#player-play').click();await page.waitForFunction(()=>document.body.dataset.playerState==='paused');
 const payload=await page.locator('#accompaniment-playback-data').evaluate(n=>JSON.parse(n.textContent));
 assert.deepEqual(payload.sequence.map(s=>s.bar),[1,2,3,4,5,6,7,8,9]);
 await page.locator('#bar-9').dispatchEvent('click');
 assert.equal(await page.locator('#bar-9.player-current').count(),1);
 await page.locator('#player-stop').click();
 const downloadPromise=page.waitForEvent('download');await page.locator('.export-menu > summary').click();await page.locator('#download').click();
 const download=await downloadPromise,saved=new URL('download.html',output);await download.saveAs(saved.pathname);
 assert.equal(download.suggestedFilename(),'想你的夜仅副歌.html');assert.ok(!(await readFile(saved,'utf8')).includes('class="auto-scroll"'));
 const fresh=await browser.newContext({offline:true}),reopened=await fresh.newPage();await reopened.goto(saved.href);
 assert.equal(await reopened.locator('#score .measure').count(),9);await reopened.locator('#score-mode').click();assert.equal(await reopened.locator('#score .measure').count(),9);await fresh.close();
 assert.deepEqual(errors,[]);assert.deepEqual(remote,[]);
 await page.goto(new URL('index.html',root).href);await page.locator('#search').fill('想你的夜');
 assert.equal(await page.locator('.score-card').count(),1);await page.locator('[data-score-id="xiangnideye-chorus"] .open-score').click();assert.equal(await page.locator('h1').innerText(),'《想你的夜》仅副歌');
 await context.close();
 console.log('PASS: 想你的夜仅副歌9小节、首尾歌词、单次播放路线、简易谱、手机、打印/PNG、离线播放与下载、首页入口。');
}finally{await browser.close();}
