import assert from 'node:assert/strict';
import {mkdir,readFile} from 'node:fs/promises';
import {chromium} from 'playwright';
const root=new URL('../',import.meta.url);
const output=new URL('artifacts/xiegeihuanghuai/',root);await mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH}:{})});
try{
 const context=await browser.newContext({offline:true,viewport:{width:1280,height:900},reducedMotion:'reduce'});
 const page=await context.newPage(),errors=[],remote=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(/^https?:/.test(r.url()))remote.push(r.url());});
 await page.goto(new URL('sheet_music/写给黄淮仅副歌.html',root).href);
 assert.equal(await page.locator('h1').innerText(),'《写给黄淮》仅副歌');
 assert.match(await page.locator('.metadata').innerText(),/4\/4[\s\S]*1 = G[\s\S]*3 品/);
 assert.equal(await page.locator('#score .measure').count(),33);assert.equal(await page.locator('.chord-card').count(),5);
 assert.equal(await page.locator('.section-picker').getAttribute('open'),null);
 assert.ok(await page.locator('#bar-1').evaluate(bar=>{
  const rest=bar.querySelector('.tab-rest').getBBox(),dot=bar.querySelector('.tab-duration-dot');
  const x=Number(dot.getAttribute('cx')),y=Number(dot.getAttribute('cy'));
  return x>rest.x+rest.width&&y>=rest.y&&y<=rest.y+rest.height;
 }),'附点必须在休止符右侧及其高度范围内');
 for(const rows of ['4','2']){
  await page.locator('#bars-per-row').selectOption(rows);
  assert.equal(await page.locator('#score .measure').count(),33);
  assert.equal(await page.locator('#score .numbered-melody').count(),33);
  assert.deepEqual(await page.locator('#bar-9 .lyric').allTextContents(),['十']);
  assert.deepEqual(await page.locator('#bar-33 .lyric').allTextContents(),[]);
  assert.equal(await page.locator('#score .volta-label').count(),0);
  const overlaps=await page.locator('#score .measure').evaluateAll(bars=>bars.flatMap(bar=>{
   const lyrics=[...bar.querySelectorAll('.lyric')];return lyrics.flatMap((a,i)=>lyrics.slice(i+1).filter(b=>a.getAttribute('y')===b.getAttribute('y')&&Math.min(a.getBBox().x+a.getBBox().width,b.getBBox().x+b.getBBox().width)-Math.max(a.getBBox().x,b.getBBox().x)>0.5).map(b=>[bar.dataset.bar,a.textContent,b.textContent]));
  }));assert.deepEqual(overlaps,[],'歌词不重叠');
 }
 await page.locator('#bars-per-row').selectOption('4');
 await page.screenshot({path:new URL('full-desktop.png',output).pathname,fullPage:true});
 await page.pdf({path:new URL('full-print.pdf',output).pathname,preferCSSPageSize:true,printBackground:true});
 await page.locator('#score-mode').click();
 assert.equal(await page.locator('#score .measure').count(),33);
 assert.equal(await page.locator('.simple-instrument-score .measure').count(),17);
 const words=(await page.locator('.simple-lyric').allTextContents()).join('').replace(/\s/g,'');
 assert.equal(words,'九岁的那一天我来到黄淮的面前为了能和你在这遇见我支付了我的四年二十岁的那一天吉他在我身边张开了笨拙的手对你的爱涌上了心头你是我患得患失的梦我是你可有可无的人毕竟这穿越山河的箭刺的都是用情致疾的人你是我辗转反侧的梦我是你如梦山河的故人就让这牵肠挂肚的酒硫酸一样刺激在你我的心头');
 assert.doesNotMatch(words,/第一次|的时候|闽南语/);
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
 assert.deepEqual(payload.sequence.map(s=>s.bar),Array.from({length:33},(_,i)=>i+1));
 await page.locator('#bar-33').dispatchEvent('click');
 assert.equal(await page.locator('#bar-33.player-current').count(),1);
 await page.locator('#player-stop').click();
 const downloadPromise=page.waitForEvent('download');await page.locator('.export-menu > summary').click();await page.locator('#download').click();
 const download=await downloadPromise,saved=new URL('download.html',output);await download.saveAs(saved.pathname);
 assert.equal(download.suggestedFilename(),'写给黄淮仅副歌.html');assert.ok(!(await readFile(saved,'utf8')).includes('class="auto-scroll"'));
 const fresh=await browser.newContext({offline:true}),reopened=await fresh.newPage();await reopened.goto(saved.href);
 assert.equal(await reopened.locator('#score .measure').count(),33);await reopened.locator('#score-mode').click();assert.equal(await reopened.locator('#score .measure').count(),33);await fresh.close();
 assert.deepEqual(errors,[]);assert.deepEqual(remote,[]);
 await page.goto(new URL('index.html',root).href);await page.locator('#search').fill('写给黄淮');
 assert.equal(await page.locator('.score-card').count(),1);await page.locator('[data-score-id="xiegeihuanghuai-chorus"] .open-score').click();assert.equal(await page.locator('h1').innerText(),'《写给黄淮》仅副歌');
 await context.close();
 console.log('PASS: 写给黄淮仅副歌33小节、一拍弱起、17小节器乐、单次播放路线、简易谱、手机、打印/PNG、离线播放与下载、首页入口。');
}finally{await browser.close();}
