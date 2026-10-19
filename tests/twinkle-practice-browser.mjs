import assert from 'node:assert/strict';
import {mkdir,readFile} from 'node:fs/promises';
import {chromium} from 'playwright';
const root=new URL('../',import.meta.url),out=new URL('artifacts/twinkle-practice/',root);
await mkdir(out,{recursive:true});
const data=JSON.parse(await readFile(new URL('knowledge/chord-charts.json',root),'utf8'));
const display=s=>s.replaceAll('#','♯').replaceAll('b','♭');
const browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH}:{})});
try{
 const context=await browser.newContext({offline:true,viewport:{width:1280,height:960}}),page=await context.newPage();const errors=[],remote=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(/^https?:/.test(r.url()))remote.push(r.url());});
 await page.goto(new URL('tools/小星星练习.html',root).href);
 assert.equal(await page.locator('h1').innerText(),'小星星练习');
 assert.equal(await page.locator('#melody .melody-bar').count(),12);assert.equal(await page.locator('#melody .event-chord:visible').count(),0);
 assert.equal(await page.locator('#practice-key option').count(),7);
 assert.ok(await page.locator('.full-board svg').evaluate(svg=>svg.viewBox.baseVal.height===214&&svg.getBoundingClientRect().height/svg.getBoundingClientRect().width<0.26));
 await page.screenshot({path:new URL('scale-desktop.png',out).pathname,fullPage:true});
 await page.locator('.full-board [data-pattern="mi"]').click();
 assert.ok(await page.locator('.full-board .pattern-band.is-active').count()===1);
 await page.locator('#notation-toggle').click();
 await page.locator('.full-board .scale-note[data-degree="6"]').first().focus();await page.keyboard.press('Enter');
 assert.equal(await page.locator('#melody [aria-pressed="true"]').count(),4);
 assert.ok(await page.locator('.full-board .scale-note.note-focused').evaluateAll(nodes=>nodes.length>0&&nodes.every(n=>n.dataset.degree==='6'&&n.querySelector('text').textContent==='A')));
 await page.locator('#clear-focus').click();assert.equal(await page.locator('.scale-note.note-focused').count(),0);
 const degrees=await page.locator('#melody [data-focus-degree]').evaluateAll(nodes=>nodes.map(n=>Number(n.dataset.focusDegree)));
 for(const key of ['C','D','E','F','G','A','B']){
  await page.locator('#practice-key').selectOption(key);
  assert.equal(await page.locator('#tonic').innerText(),`1 = ${key}`);
  assert.equal(await page.locator('.pattern-band.is-active').count(),0);
  assert.ok(await page.locator('.full-board svg').evaluate(svg=>{
   const dots=[...svg.querySelectorAll('.octave-dot')],circles=[...svg.querySelectorAll('.scale-note>circle:not(.octave-dot)')];
   return dots.every(dot=>circles.every(circle=>Math.hypot(Number(dot.getAttribute('cx'))-Number(circle.getAttribute('cx')),Number(dot.getAttribute('cy'))-Number(circle.getAttribute('cy')))>=Number(dot.getAttribute('r'))+Number(circle.getAttribute('r'))));
  }),'压缩后八度点不碰到音符圆圈');
  const chart=data.keys.find(k=>k.name===key);
  const seventhNames={C:'Bdim',D:'C♯dim',E:'D♯dim',F:'Edim',G:'F♯dim',A:'G♯dim',B:'A♯dim'};
  await page.locator('.mode-selector [data-mode="chord"]').click();
  assert.equal(await page.locator('.chord-card:visible').count(),7);
  assert.equal(await page.locator('[data-chord-degree="7"] strong').textContent(),seventhNames[key]);
  await page.locator('[data-chord-degree="7"] button').click();
  assert.match(await page.locator('#focus-status').innerText(),/7级/);
  assert.equal(await page.locator('#melody [aria-pressed="true"]').count(),0);
  assert.deepEqual(await page.locator('#melody button .event-chord').allTextContents(),degrees.map(d=>display(chart.chords[d-1])));
  assert.ok((await page.locator('#melody .held .event-chord').allTextContents()).every(t=>t===''));
  assert.equal(await page.locator('.scale-view').isVisible(),false);
  await page.locator('#melody button').first().click();assert.ok(await page.locator('.chord-card[data-chord-degree="1"]').evaluate(n=>n.classList.contains('is-focused')));
  await page.locator('.mode-selector [data-mode="scale"]').click();
  assert.ok(await page.locator('.full-board .scale-note.note-focused').evaluateAll(nodes=>nodes.length>0&&nodes.every(n=>n.dataset.degree==='1')));
  assert.equal(await page.locator('.full-board .scale-note[data-degree="3"] text').first().textContent(),display(chart.chords[2]).replace(/m$/,''));
 }
 await page.locator('#practice-key').selectOption('D');await page.locator('.mode-selector [data-mode="chord"]').click();
 await page.screenshot({path:new URL('chord-desktop.png',out).pathname,fullPage:true});
 for(const width of [320,393,768]){
  await page.setViewportSize({width,height:852});
  for(const mode of ['scale','chord']){
   await page.locator(`.mode-selector [data-mode="${mode}"]`).click();
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'页面不横向溢出');
   assert.ok(await page.locator('#melody button .event-chord').evaluateAll(nodes=>nodes.filter(n=>n.getBoundingClientRect().width).every(n=>n.scrollWidth<=n.clientWidth+1)),'和弦名称不裁切');
   assert.ok(await page.locator('.melody-bar').evaluateAll(nodes=>nodes.every(n=>n.scrollWidth<=n.clientWidth+1)));
   if(width===393)await page.screenshot({path:new URL(`${mode}-mobile.png`,out).pathname,fullPage:true});
  }
 }
 await page.pdf({path:new URL('practice.pdf',out).pathname,preferCSSPageSize:true,printBackground:true});
 await page.locator('.back').click();assert.equal(await page.locator('[data-type="tools"]').getAttribute('aria-pressed'),'true');
 await page.locator('#search').fill('小星星');assert.equal(await page.locator('.tool-card').count(),1);
 await page.locator('[data-tool-id="twinkle-practice"] a').click();assert.equal(await page.locator('h1').innerText(),'小星星练习');
 assert.deepEqual(errors,[]);assert.deepEqual(remote,[]);
 console.log('PASS: 小星星七调音阶/逐音级和弦、延长线、聚焦、C指型、键盘、手机、离线、打印和工具入口。');
}finally{await browser.close();}
