import assert from 'node:assert/strict';
import {readFile,stat,mkdir} from 'node:fs/promises';
import {createServer} from 'node:http';
import {runInNewContext} from 'node:vm';
import {chromium} from 'playwright';

const root=new URL('../',import.meta.url);
const catalogWindow={};
runInNewContext(await readFile(new URL('assets/catalog.js',root),'utf8'),{window:catalogWindow});
const catalog=JSON.parse(JSON.stringify(catalogWindow.GUITAR_SCORES));
assert.ok(Array.isArray(catalog)&&catalog.length>0);
assert.equal(new Set(catalog.map(s=>s.id)).size,catalog.length);
const reference=catalog.find(score=>score.id==='pian-ai-fingerstyle');
assert.ok(reference,'保留已完成《偏爱》作为真实曲谱回归样本');
const referenceCard='[data-score-id="pian-ai-fingerstyle"]';
for(const score of catalog){
  assert.ok(score.id&&score.title);
  assert.ok(['fingerstyle','accompaniment'].includes(score.type));
  assert.match(score.updatedAt,/^\d{4}-\d{2}-\d{2}$/);
  assert.equal(new Date(score.updatedAt).toISOString().slice(0,10),score.updatedAt);
  assert.match(score.path,/^sheet_music\/.+\.html$/);
  assert.ok(!score.path.split('/').includes('..'));
  assert.ok((await stat(new URL(score.path,root))).isFile());
}
assert.equal((await stat(new URL('.nojekyll',root))).size,0);

const server=createServer(async(req,res)=>{
  const pathname=new URL(req.url,'http://localhost').pathname;
  if(!pathname.startsWith('/guitar/')){res.writeHead(404);res.end();return;}
  let relative=decodeURIComponent(pathname.slice('/guitar/'.length))||'index.html';
  if(relative.split('/').includes('..')){res.writeHead(400);res.end();return;}
  const mime=relative.endsWith('.js')?'text/javascript':relative.endsWith('.css')?'text/css':relative.endsWith('.svg')?'image/svg+xml':'text/html';
  try{res.writeHead(200,{'Content-Type':`${mime}; charset=utf-8`});res.end(await readFile(new URL(relative,root)));}
  catch{res.writeHead(404);res.end();}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
server.unref();
const address=`http://127.0.0.1:${server.address().port}/guitar/`;
const browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH}:{})});
await mkdir(new URL('artifacts/',root),{recursive:true});
try{
  const local=await browser.newContext({offline:true,viewport:{width:1440,height:1000}});
  const page=await local.newPage();const errors=[];const remote=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(/^https?:/.test(r.url()))remote.push(r.url())});
  await page.goto(new URL('index.html',root).href);
  await page.waitForSelector('.score-card');
  assert.equal(await page.title(),'曲谱库 · 小k吉他练习');
  assert.equal(await page.locator('.score-card').count(),catalog.length);
  assert.equal(await page.locator(`${referenceCard} .score-title`).innerText(),reference.title);
  await page.locator('#search').fill('  偏爱  ');
  assert.equal(await page.locator('.score-card').count(),catalog.filter(s=>`${s.title} ${s.artist||''}`.includes('偏爱')).length);
  await page.locator('#search').fill('不存在的曲谱');
  assert.equal(await page.locator('.score-card').count(),0);
  assert.equal(await page.locator('.empty-state').isVisible(),true);
  await page.screenshot({path:'artifacts/home-empty.png'});
  await page.locator('#reset-filters').click();
  assert.equal(await page.locator('#search').inputValue(),'');
  await page.locator('[data-type="accompaniment"]').click();
  assert.equal(await page.locator('.score-card').count(),catalog.filter(s=>s.type==='accompaniment').length);
  assert.equal(await page.locator('[data-type="accompaniment"]').getAttribute('aria-pressed'),'true');
  await page.locator('[data-type="all"]').click();
  await page.screenshot({path:'artifacts/home-desktop.png',fullPage:true});
  for(const width of [390,320]){
    await page.setViewportSize({width,height:844});
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${width}px页面不能横向溢出`);
  }
  await page.setViewportSize({width:390,height:844});
  await page.screenshot({path:'artifacts/home-mobile.png',fullPage:true});
  await page.locator(`${referenceCard} .open-score`).click();
  await page.waitForFunction(()=>document.body.dataset.renderState==='ready');
  assert.equal(await page.locator('h1').innerText(),'《偏爱》指弹');
  assert.deepEqual(errors,[]);assert.deepEqual(remote,[]);
  await local.close();

  const hosted=await browser.newContext({viewport:{width:1440,height:1000}});
  const web=await hosted.newPage();const failures=[];
  web.on('pageerror',e=>failures.push(e.message));
  web.on('response',r=>{if(r.status()>=400)failures.push(`${r.status()} ${r.url()}`)});
  await web.goto(address);await web.waitForSelector('.score-card');
  assert.ok((await web.locator(`${referenceCard} .open-score`).getAttribute('href')).startsWith('./sheet_music/'));
  const downloaded=web.waitForEvent('download');
  await web.locator(`${referenceCard} .download-score`).click();
  const download=await downloaded;
  assert.equal(download.suggestedFilename(),'偏爱指弹.html');
  assert.deepEqual(await readFile(await download.path()),await readFile(new URL(reference.path,root)));
  await web.locator('nav a[href="./docs/制谱.html"]').click();
  assert.equal(await web.locator('h1').innerText(),'如何把原谱制作成网页吉他谱');
  await web.goto(address);await web.locator(`${referenceCard} .open-score`).click();
  await web.waitForFunction(()=>document.body.dataset.renderState==='ready');
  assert.ok(web.url().includes('/guitar/sheet_music/'));

  // Multiple entries exist only in this test response, never in the real catalog.
  const fixtures=[
    {...reference,id:'z',title:'Zebra',artist:'Alice',type:'accompaniment',updatedAt:'2026-03-01'},
    {...reference,id:'a',title:'Alpha',type:'fingerstyle',updatedAt:'2026-01-01'},
    {...reference,id:'b',title:'Beta',type:'accompaniment',updatedAt:'2026-02-01'}
  ];
  await web.route('**/assets/catalog.js',route=>route.fulfill({contentType:'text/javascript',body:`window.GUITAR_SCORES=${JSON.stringify(fixtures)};`}));
  await web.goto(address);await web.waitForSelector('.score-card');
  assert.deepEqual(await web.locator('.score-title').allTextContents(),['Zebra','Beta','Alpha']);
  assert.equal(await web.locator('[data-count="all"]').innerText(),'3');
  assert.equal(await web.locator('[data-count="accompaniment"]').innerText(),'2');
  await web.locator('#sort').selectOption('title');
  assert.deepEqual(await web.locator('.score-title').allTextContents(),['Alpha','Beta','Zebra']);
  await web.locator('#search').fill(' aLiCe ');
  assert.deepEqual(await web.locator('.score-title').allTextContents(),['Zebra']);
  await web.locator('[data-type="fingerstyle"]').click();
  assert.equal(await web.locator('.score-card').count(),0);
  await web.locator('#reset-filters').click();
  assert.equal(await web.locator('.score-card').count(),3);
  assert.deepEqual(failures,[]);
  await web.unroute('**/assets/catalog.js');
  await web.route('**/assets/catalog.js',route=>route.fulfill({contentType:'text/javascript',body:''}));
  await web.goto(address);
  assert.ok((await web.locator('#catalog-status').innerText()).includes('未能加载'));
  assert.equal(await web.locator('.empty-state').isVisible(),false);
  console.log('PASS: 曲谱清单有效；首页离线、搜索、分类、排序、空态恢复、手机显示、真实HTML下载、曲谱/文档链接及GitHub Pages子路径检查通过。');
  await hosted.close();
}finally{
  await browser.close();
  await new Promise(resolve=>server.close(resolve));
}
