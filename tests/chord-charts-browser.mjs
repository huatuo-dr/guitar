import assert from 'node:assert/strict';
import {mkdir, readFile} from 'node:fs/promises';
import {createServer} from 'node:http';
import {chromium} from 'playwright';

const root=new URL('../',import.meta.url);
const browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH}:{})});
const server=createServer(async(req,res)=>{
  const path=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
  if(!path.startsWith('/guitar/')||path.split('/').includes('..')){res.writeHead(404);res.end();return;}
  try{const body=await readFile(new URL(path.slice(8)||'index.html',root));res.setHeader('Content-Type',path.endsWith('.js')?'text/javascript; charset=utf-8':path.endsWith('.css')?'text/css':'text/html; charset=utf-8');res.end(body);}
  catch{res.writeHead(404);res.end();}
});
try {
  await mkdir(new URL('artifacts/chord-charts/',root),{recursive:true});
  const context=await browser.newContext({offline:true,viewport:{width:1440,height:1050}});
  const page=await context.newPage();const errors=[],requests=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(/^https?:/.test(r.url()))requests.push(r.url());});
  await page.goto(new URL('tools/各调和弦图.html',root).href);
  assert.equal(await page.title(),'各调和弦图 · 小k吉他练习');
  assert.equal(await page.locator('.chord-card svg').count(),56);
  const ids=await page.locator('[id]').evaluateAll(nodes=>nodes.map(n=>n.id));
  assert.equal(new Set(ids).size,ids.length,'SVG 可访问名称 ID 唯一');
  assert.equal(await page.locator('.key-section:visible').count(),8);
  await page.screenshot({path:'artifacts/chord-charts/desktop.png'});
  for(const key of ['C','D','E','F','G','A','B','Bb']){
    await page.locator(`[data-key="${key}"]`).click();
    assert.equal(await page.locator('.key-section:visible').count(),1);
    assert.equal(await page.locator('.chord-card:visible').count(),7);
    assert.equal(await page.locator('.key-section:visible').getAttribute('data-key-section'),key);
    assert.equal(await page.locator('[aria-pressed="true"]').count(),1);
  }
  for(const width of [320,390,768,1024]){
    await page.setViewportSize({width,height:844});
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${width}px 无横向溢出`);
  }
  await page.setViewportSize({width:390,height:844});
  await page.screenshot({path:'artifacts/chord-charts/mobile.png',fullPage:true});
  await page.locator('[data-key="all"]').click();
  assert.equal(await page.locator('.chord-card:visible').count(),56);
  await page.emulateMedia({media:'print'});
  assert.equal(await page.locator('.key-nav').isVisible(),false);
  assert.equal(await page.locator('.chord-card:visible').count(),56);
  await page.pdf({path:'artifacts/chord-charts/charts.pdf',preferCSSPageSize:true});
  await page.emulateMedia({media:'screen'});
  await page.locator('.back').click();
  assert.equal(await page.locator('[data-type="tools"]').getAttribute('aria-pressed'),'true');
  assert.equal(await page.locator('.tool-card').count(),1);
  assert.deepEqual(errors,[]);assert.deepEqual(requests,[],'离线无需请求远程资源');
  await context.close();

  const noScript=await browser.newContext({javaScriptEnabled:false,offline:true});
  const staticPage=await noScript.newPage();await staticPage.goto(new URL('tools/各调和弦图.html',root).href);
  assert.equal(await staticPage.locator('.chord-card:visible').count(),56,'图表直接写入 HTML，无脚本仍可阅读');
  await noScript.close();

  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const hosted=await browser.newPage();
  await hosted.goto(`http://127.0.0.1:${server.address().port}/guitar/index.html#tools`);
  await hosted.locator('.tool-card a').click();
  assert.equal(await hosted.locator('.chord-card').count(),56,'Pages 子路径可打开工具');
  await hosted.locator('.back').click();
  assert.equal(await hosted.locator('[data-type="tools"]').getAttribute('aria-pressed'),'true');
  console.log('PASS: 各调和弦图的 56 张 SVG、8 调筛选、手机适配、离线、无脚本阅读、打印和 Pages 往返导航。');
} finally {await browser.close();server.close();}
