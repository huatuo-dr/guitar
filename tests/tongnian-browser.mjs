import assert from 'node:assert/strict';
import {mkdir,readFile} from 'node:fs/promises';
import {chromium} from 'playwright';
const root=new URL('../',import.meta.url);
const output=new URL('artifacts/tongnian/',root);await mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH}:{})});
try{
 const context=await browser.newContext({offline:true,viewport:{width:1280,height:900},reducedMotion:'reduce'});
 const page=await context.newPage(),errors=[],remote=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(/^https?:/.test(r.url()))remote.push(r.url());});
 await page.goto(new URL('sheet_music/童年弹唱伴奏.html',root).href);
 assert.equal(await page.locator('h1').innerText(),'《童年》弹唱伴奏');
 assert.match(await page.locator('.metadata').innerText(),/罗大佑[\s\S]*4\/4[\s\S]*G[\s\S]*G 指法/);
 assert.equal(await page.locator('#score .measure').count(),26);assert.equal(await page.locator('.chord-card').count(),8);
 assert.equal(await page.locator('.section-picker').getAttribute('open'),null);
 const picker=await page.locator('.section-picker').boundingBox(),controls=await page.locator('.toolbar > .controls').boundingBox();
 assert.ok(controls.y>=picker.y+picker.height);
 for(const rows of ['4','2']){
  await page.locator('#bars-per-row').selectOption(rows);
  assert.equal(await page.locator('#score .score-system').count(),Math.ceil(26/Number(rows)));
  assert.equal(await page.locator('#score .numbered-melody').count(),26);
  assert.deepEqual(await page.locator('#bar-20 .volta-label').allTextContents(),['1–4.']);
  assert.deepEqual(await page.locator('#bar-19 .volta-label').allTextContents(),[]);
  assert.deepEqual(await page.locator('#bar-20 .lyric').allTextContents(),['年','年','年','年']);
  assert.deepEqual(await page.locator('#bar-21 .lyric').allTextContents(),['年','哦']);
  const overlaps=await page.locator('#score .measure').evaluateAll(bars=>bars.flatMap(bar=>{
   const lyrics=[...bar.querySelectorAll('.lyric')];return lyrics.flatMap((a,i)=>lyrics.slice(i+1).filter(b=>a.getAttribute('y')===b.getAttribute('y')&&Math.min(a.getBBox().x+a.getBBox().width,b.getBBox().x+b.getBBox().width)-Math.max(a.getBBox().x,b.getBBox().x)>0.5).map(b=>[bar.dataset.bar,a.textContent,b.textContent]));
  }));assert.deepEqual(overlaps,[],'五行歌词及同音多字之间不重叠');
  const overflow=await page.locator('#score .measure').evaluateAll(bars=>bars.flatMap(bar=>{
   const r=bar.querySelector('.measure-highlight').getBBox();return [...bar.querySelectorAll('.numbered-melody text')].filter(t=>{const b=t.getBBox();return b.x<r.x-2||b.x+b.width>r.x+r.width+2;}).map(t=>[bar.dataset.bar,t.textContent]);
  }));assert.deepEqual(overflow,[],'简谱歌词不进入相邻小节');
 }
 await page.locator('#bars-per-row').selectOption('4');
 await page.screenshot({path:new URL('full-desktop.png',output).pathname,fullPage:true});
 await page.pdf({path:new URL('full-print.pdf',output).pathname,preferCSSPageSize:true,printBackground:true});
 await page.locator('#score-mode').click();
 assert.equal(await page.locator('#score .measure').count(),89);assert.equal(await page.locator('.simple-instrument-score .measure').count(),5);
 assert.equal(await page.locator('#bar-19-repeat-5').count(),1);assert.equal(await page.locator('#bar-20-repeat-5').count(),0);
 const words=(await page.locator('.simple-lyric').allTextContents()).join('').replace(/\s/g,'');
 assert.match(words,/什么时候才能像高年级的同学有张成熟与长大的脸/);
 assert.match(words,/盼望着明天盼望长大的童年哦一天有一天/);
 await page.screenshot({path:new URL('simple-desktop.png',output).pathname,fullPage:true});
 await page.pdf({path:new URL('simple-print.pdf',output).pathname,preferCSSPageSize:true,printBackground:true});
 for(const width of [320,393]){
  await page.setViewportSize({width,height:852});await page.locator('#bars-per-row').selectOption('auto');
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await page.locator('#score-mode').click();
  assert.equal(await page.locator('#score').getAttribute('data-bars-per-row'),'2');
  assert.ok(await page.locator('.score-viewport').evaluate(el=>el.scrollWidth-el.clientWidth<=2));
  await page.screenshot({path:new URL(`full-${width}.png`,output).pathname,fullPage:true});
  await page.locator('#score-mode').click();
  await page.screenshot({path:new URL(`simple-${width}.png`,output).pathname,fullPage:true});
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
 await page.locator('#bar-19-repeat-5').dispatchEvent('click');
 assert.equal(await page.locator('#bar-19-repeat-5.player-current').count(),1);
 const payload=await page.locator('#accompaniment-playback-data').evaluate(n=>JSON.parse(n.textContent));
 const ending=payload.sequence.find(s=>s.bar===21);
 await page.evaluate(t=>{accompanimentPlayer.api.tickPosition=t;},ending.startTick-160);
 await page.locator('#player-play').click();await page.waitForFunction(()=>document.body.dataset.playerBar==='21');
 await page.locator('#player-play').click();
 await page.locator('#score-mode').click();
 assert.equal(await page.locator('#bar-21.player-current').count(),1);
 await page.locator('#player-stop').click();
 const downloadPromise=page.waitForEvent('download');await page.locator('.export-menu > summary').click();await page.locator('#download').click();
 const download=await downloadPromise,saved=new URL('download.html',output);await download.saveAs(saved.pathname);
 assert.equal(download.suggestedFilename(),'童年弹唱伴奏.html');assert.ok(!(await readFile(saved,'utf8')).includes('class="auto-scroll"'));
 const fresh=await browser.newContext({offline:true}),reopened=await fresh.newPage();await reopened.goto(saved.href);
 assert.equal(await reopened.locator('#score .measure').count(),26);await reopened.locator('#score-mode').click();assert.equal(await reopened.locator('#score .measure').count(),89);await fresh.close();
 assert.deepEqual(errors,[]);assert.deepEqual(remote,[]);
 await page.goto(new URL('index.html',root).href);await page.locator('#search').fill('童年');
 assert.equal(await page.locator('.score-card').count(),1);await page.locator('[data-score-id="tong-nian-accompaniment"] .open-score').click();assert.equal(await page.locator('h1').innerText(),'《童年》弹唱伴奏');
 await context.close();
 console.log('PASS: 童年26小节、五行歌词间距、89小节展开、第五遍跳尾、手机、打印、离线音频与下载、首页入口。');
}finally{await browser.close();}
