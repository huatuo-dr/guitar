import assert from 'node:assert/strict';
import {mkdir,readFile} from 'node:fs/promises';
import {chromium} from 'playwright';
const root=new URL('../',import.meta.url);
const output=new URL('artifacts/wozhende/',root);await mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH}:{})});
try{
 const context=await browser.newContext({offline:true,viewport:{width:1280,height:900},reducedMotion:'reduce'});
 const page=await context.newPage(),errors=[],remote=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(/^https?:/.test(r.url()))remote.push(r.url());});
 await page.goto(new URL('sheet_music/我是真的爱上你弹唱伴奏.html',root).href);
 assert.equal(await page.locator('h1').innerText(),'《我是真的爱上你》弹唱伴奏');
 assert.match(await page.locator('.metadata').innerText(),/4\/4[\s\S]*E → F[\s\S]*C → C♯ 指法/);
 assert.equal(await page.locator('#score .measure').count(),60);assert.equal(await page.locator('.chord-card').count(),27);
 assert.equal(await page.locator('.section-picker').getAttribute('open'),null);
 for(const rows of ['4','2']){
  await page.locator('#bars-per-row').selectOption(rows);
  assert.equal(await page.locator('#score .measure').count(),60);
  assert.equal(await page.locator('#score .numbered-melody').count(),60);
  assert.deepEqual(await page.locator('#bar-7 .lyric').allTextContents(),['你','有','一','双','会','说','话','的']);
  assert.deepEqual(await page.locator('#bar-55 .lyric').allTextContents(),['你']);
  assert.deepEqual(await page.locator('#bar-37 .volta-label').allTextContents(),['1.']);
  assert.deepEqual(await page.locator('#bar-46 .volta-label').allTextContents(),['2.']);
  assert.equal(await page.locator('#score .pluck-tie').count(),3);
  assert.equal(await page.locator('#score .tab-rest-whole').count(),1);
  const chordOverlaps=await page.locator('#score .measure').evaluateAll(bars=>bars.flatMap(bar=>{
   const nodes=[...bar.querySelectorAll('.chord-diagram')];return nodes.flatMap((a,i)=>nodes.slice(i+1).filter(b=>{const x=a.getBoundingClientRect(),y=b.getBoundingClientRect();return Math.min(x.right,y.right)-Math.max(x.left,y.left)>1}).map(b=>bar.dataset.bar));
  }));assert.deepEqual(chordOverlaps,[],'密集换和弦的指法图不重叠');
  const overlaps=await page.locator('#score .measure').evaluateAll(bars=>bars.flatMap(bar=>{
   const lyrics=[...bar.querySelectorAll('.lyric')];return lyrics.flatMap((a,i)=>lyrics.slice(i+1).filter(b=>a.getAttribute('y')===b.getAttribute('y')&&Math.min(a.getBBox().x+a.getBBox().width,b.getBBox().x+b.getBBox().width)-Math.max(a.getBBox().x,b.getBBox().x)>0.5).map(b=>[bar.dataset.bar,a.textContent,b.textContent]));
  }));assert.deepEqual(overlaps,[],'歌词不重叠');
 }
 await page.locator('#bars-per-row').selectOption('4');
 await page.screenshot({path:new URL('full-desktop.png',output).pathname,fullPage:true});
 await page.pdf({path:new URL('full-print.pdf',output).pathname,preferCSSPageSize:true,printBackground:true});
 await page.locator('#score-mode').click();
 assert.equal(await page.locator('#score .measure').count(),82);
 assert.equal(await page.locator('.simple-instrument-score .measure').count(),19);
 assert.equal(await page.locator('#score .volta-label').count(),0);
 const words=(await page.locator('.simple-lyric').allTextContents()).join('').replace(/\s/g,'');
 assert.equal((words.match(/你有一双深情的眼睛/g)||[]).length,2);
 assert.equal((words.match(/你的发香/g)||[]).length,2);
 assert.doesNotMatch(words,/一只|发像/);
 assert.ok(await page.locator('.simple-line').evaluateAll(lines=>lines.every(line=>[...line.querySelectorAll('.simple-lyric:not(.simple-placeholder)')].some(n=>n.textContent.trim()))),'不产生仅含空白和弦的歌词行');
 assert.equal(await page.locator('#bar-15-repeat-2').count(),1);

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
 await page.locator('#player-speed').selectOption('75');
 await page.locator('#player-play').click();await page.waitForFunction(()=>document.body.dataset.playerState==='playing');
 await page.evaluate(()=>{
  const node=accompanimentPlayer.api._player.instance._output._audioNode,generate=node.onaudioprocess;window.audioPeak=0;
  node.onaudioprocess=event=>{generate(event);for(const sample of event.outputBuffer.getChannelData(0))window.audioPeak=Math.max(window.audioPeak,Math.abs(sample));};
 });
 await page.waitForFunction(()=>window.audioPeak>0.001);
 await page.locator('#player-play').click();await page.waitForFunction(()=>document.body.dataset.playerState==='paused');
 const payload=await page.locator('#accompaniment-playback-data').evaluate(n=>JSON.parse(n.textContent));
 assert.deepEqual(payload.sequence.map(s=>s.bar),[...Array.from({length:45},(_,i)=>i+1),...Array.from({length:22},(_,i)=>i+15),...Array.from({length:15},(_,i)=>i+46)]);
 await page.locator('#bar-60').dispatchEvent('click');
 assert.equal(await page.locator('#bar-60.player-current').count(),1);
 await page.locator('#player-stop').click();
 const downloadPromise=page.waitForEvent('download');await page.locator('.export-menu > summary').click();await page.locator('#download').click();
 const download=await downloadPromise,saved=new URL('download.html',output);await download.saveAs(saved.pathname);
 assert.equal(download.suggestedFilename(),'我是真的爱上你弹唱伴奏.html');assert.ok(!(await readFile(saved,'utf8')).includes('class="auto-scroll"'));
 const fresh=await browser.newContext({offline:true}),reopened=await fresh.newPage();await reopened.goto(saved.href);
 assert.equal(await reopened.locator('#score .measure').count(),60);await reopened.locator('#score-mode').click();assert.equal(await reopened.locator('#score .measure').count(),82);await fresh.close();
 assert.deepEqual(errors,[]);assert.deepEqual(remote,[]);
 await page.goto(new URL('index.html',root).href);await page.locator('#search').fill('我是真的爱上你');
 assert.equal(await page.locator('.score-card').count(),1);await page.locator('[data-score-id="wozhendeaishangni"] .open-score').click();assert.equal(await page.locator('h1').innerText(),'《我是真的爱上你》弹唱伴奏');
 await context.close();
 console.log('PASS: 我是真的爱上你60小节、82小节演奏路线、简易谱、逐弦延音、手机、打印/PNG、离线播放与下载、首页入口。');
}finally{await browser.close();}
