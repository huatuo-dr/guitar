import assert from 'node:assert/strict';
import {mkdir, readFile} from 'node:fs/promises';
import {createServer} from 'node:http';
import {chromium} from 'playwright';

const root = new URL('../',import.meta.url);
const path = 'sheet_music/老男孩弹唱伴奏.html';
const launch = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ? {executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH} : {};
const browser = await chromium.launch({headless:true,...launch});
await mkdir(new URL('artifacts/',root),{recursive:true});
const server = createServer(async (req,res) => {
  const pathname = decodeURIComponent(new URL(req.url,'http://localhost').pathname);
  if (!pathname.startsWith('/guitar/') || pathname.split('/').includes('..')) {res.writeHead(404);res.end();return;}
  const relative = pathname.slice('/guitar/'.length) || 'index.html';
  try {
    const body = await readFile(new URL(relative,root));
    const type = relative.endsWith('.js') ? 'text/javascript' : relative.endsWith('.css') ? 'text/css' : relative.endsWith('.svg') ? 'image/svg+xml' : 'text/html';
    res.writeHead(200,{'Content-Type':type+'; charset=utf-8'});res.end(body);
  } catch {res.writeHead(404);res.end();}
});
try {
  const context = await browser.newContext({offline:true,viewport:{width:1440,height:1100},reducedMotion:'reduce'});
  const page = await context.newPage();const errors=[];const external=[];
  page.on('pageerror',e => errors.push(e.message));
  page.on('request',r => {if (/^https?:/.test(r.url())) external.push(r.url());});
  await page.goto(new URL(path,root).href);
  assert.equal(await page.locator('h1').innerText(),'《老男孩》弹唱伴奏');
  assert.equal(await page.locator('.measure').count(),55);
  assert.equal(await page.locator('.score-system').count(),14);
  assert.equal(await page.locator('.score-system').last().locator('.measure').count(),3);
  assert.equal(await page.locator('.numbered-melody').count(),55);
  assert.deepEqual(await page.locator('#bar-7 .lyric').evaluateAll(nodes=>[278,302].map(y=>nodes.filter(n=>Number(n.getAttribute('y'))===y).map(n=>n.textContent).join(''))),['那是我日夜思念深','转眼过去多年时间']);
  assert.equal(await page.locator('#bar-7').evaluate(bar=>{
    const stemX=[...bar.querySelectorAll('line[y1="172"]')].map(n=>Number(n.getAttribute('x1')));
    return [0,1,1.5,2,3,3.5].every(time=>stemX.includes(Number(bar.querySelector(`.melody-event[data-onset="${time}"] .melody-number`).getAttribute('x'))));
  }),true,'歌词简谱与对应的伴奏拍点应对齐');
  assert.deepEqual(await page.locator('.route [data-jump]').evaluateAll(links => links.map(a => Number(a.dataset.jump))),[1,7,30,21,46,21,48]);
  await page.locator('#bars-per-row').selectOption('4');
  await page.locator('.section-nav [data-jump="50"]').click();
  assert.equal(await page.locator('#bar-50').evaluate(el => el === document.activeElement),true);
  assert.equal(await page.locator('#bar-50').evaluate(el => {const r=el.getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight;}),true);
  await page.locator('#zoom').selectOption('1.3');
  assert.equal(await page.locator('#score').evaluate(el => el.clientWidth),1482);
  await page.locator('#zoom').selectOption('1');
  await page.evaluate(() => {document.querySelector('.score-viewport').scrollLeft=0;window.scrollTo(0,0);});
  await page.screenshot({path:'artifacts/laonanhai-desktop.png',fullPage:true});
  await page.locator('.score-system').first().screenshot({path:'artifacts/laonanhai-first-system.png'});
  await page.locator('.score-system').nth(6).screenshot({path:'artifacts/laonanhai-volta-start.png'});
  await page.locator('.score-system').nth(7).screenshot({path:'artifacts/laonanhai-volta-end.png'});
  await page.locator('.score-system').last().screenshot({path:'artifacts/laonanhai-last-system.png'});
  for (const width of [390,320]) {
    await page.setViewportSize({width,height:844});
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth<=innerWidth),true,`${width}px页面不可横向溢出`);
    assert.equal(await page.locator('.score-viewport').evaluate(el => el.scrollWidth>el.clientWidth),true);
  }
  await page.setViewportSize({width:390,height:844});
  await page.evaluate(() => window.scrollTo(0,0));
  await page.screenshot({path:'artifacts/laonanhai-mobile.png',fullPage:true});
  await page.locator('#zoom').selectOption('1.3');
  await page.emulateMedia({media:'print'});
  assert.equal(await page.locator('#score').evaluate(el => el.clientWidth<=el.parentElement.clientWidth),true,'打印忽略交互缩放');
  assert.equal(await page.locator('#bar-50').evaluate(el => getComputedStyle(el).outlineStyle),'none','打印去掉定位焦点框');
  await page.pdf({path:'artifacts/laonanhai-print.pdf',preferCSSPageSize:true,printBackground:true});
  assert.deepEqual(errors,[]);assert.deepEqual(external,[]);
  await context.close();

  // Engraving stays readable even with scripts disabled.
  const noScript = await browser.newContext({javaScriptEnabled:false,offline:true});
  const staticPage = await noScript.newPage();await staticPage.goto(new URL(path,root).href);
  assert.equal(await staticPage.locator('.score-system').count(),14);
  assert.equal(await staticPage.locator('.numbered-melody').count(),55);
  assert.ok(await staticPage.locator('.lyric').count()>0);await noScript.close();

  await new Promise(resolve => server.listen(0,'127.0.0.1',resolve));
  const address = `http://127.0.0.1:${server.address().port}/guitar/`;
  const hosted = await browser.newPage();await hosted.goto(address);
  await hosted.locator('#search').fill('筷子兄弟');
  const card = hosted.locator('[data-score-id="lao-nan-hai-accompaniment"]');
  assert.equal(await hosted.locator('.score-card').count(),1);
  await card.locator('.open-score').click();assert.equal(await hosted.locator('.measure').count(),55);
  assert.ok(hosted.url().includes('/guitar/sheet_music/'));
  await hosted.locator('.back').click();assert.equal(await hosted.locator('[data-score-id="lao-nan-hai-accompaniment"]').count(),1);
  console.log('PASS: 老男孩55小节、段定位、缩放、手机横向滚动、离线/禁用脚本、打印、首页搜索及子路径打开/返回通过。');
} finally {
  await browser.close();
  if (server.listening) await new Promise(resolve => server.close(resolve));
}
