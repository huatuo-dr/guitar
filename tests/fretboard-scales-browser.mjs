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
  await mkdir(new URL('artifacts/fretboard-scales/',root),{recursive:true});
  const context=await browser.newContext({offline:true,viewport:{width:1440,height:1050}});
  const page=await context.newPage();const errors=[],requests=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(/^https?:/.test(r.url()))requests.push(r.url());});
  await page.goto(new URL('tools/各调指板音阶.html',root).href);
  assert.equal(await page.title(),'各调指板音阶 · 小k吉他练习');
  assert.equal(await page.locator('.full-board svg:visible').count(),7);
  const ids=await page.locator('[id]').evaluateAll(nodes=>nodes.map(n=>n.id));
  assert.equal(new Set(ids).size,ids.length);
  for(const note of await page.locator('.scale-note').all()){
    const octave=Number(await note.getAttribute('data-octave'));
    assert.equal(await note.locator('.octave-dot').count(),Math.abs(octave));
    if(octave){
      const numberY=Number(await note.locator('circle').first().getAttribute('cy'));
      const dotYs=await note.locator('.octave-dot').evaluateAll(ns=>ns.map(n=>Number(n.getAttribute('cy'))));
      assert.ok(dotYs.every(y=>octave>0?y<numberY:y>numberY),'高音点在上，低音点在下');
    }
  }
  await page.screenshot({path:'artifacts/fretboard-scales/desktop.png'});
  for(const key of ['C','D','E','F','G','A','B']){
    await page.locator(`[data-key="${key}"]`).click();
    assert.equal(await page.locator('.key-section:visible').count(),1);
    assert.equal(await page.locator('.key-section:visible').getAttribute('data-key-section'),key);
    const positions=await page.locator('.key-section:visible .full-board .scale-note').evaluateAll(nodes=>nodes.map(n=>n.dataset));
    assert.ok(positions.length>50);
    assert.equal(await page.locator('[aria-pressed="true"]').count(),1);
  }
  await page.locator('[data-key="C"]').click();
  for(const width of [320,390,768,1024]){
    await page.setViewportSize({width,height:844});
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${width}px 无横向溢出`);
    assert.equal(await page.locator('.key-section:visible svg:visible').count(),width<=760?3:1);
    const full=await page.locator('[data-key-section="C"] .full-board .scale-note').evaluateAll(ns=>ns.map(n=>n.dataset.string+':'+n.dataset.fret).sort());
    const visible=await page.locator('[data-key-section="C"] .scale-note:visible').evaluateAll(ns=>ns.map(n=>n.dataset.string+':'+n.dataset.fret).sort());
    assert.deepEqual(visible,full,'手机与电脑展示相同音位');
  }
  await page.setViewportSize({width:390,height:844});
  await page.screenshot({path:'artifacts/fretboard-scales/mobile.png',fullPage:true});
  await page.locator('[data-key="all"]').click();
  assert.equal(await page.locator('.key-section:visible').count(),7);
  await page.emulateMedia({media:'print'});
  assert.equal(await page.locator('.full-board:visible').count(),7);
  assert.equal(await page.locator('.split-boards:visible').count(),0);
  await page.pdf({path:'artifacts/fretboard-scales/scales.pdf',preferCSSPageSize:true});
  await page.emulateMedia({media:'screen'});
  await page.locator('.back').click();
  assert.equal(await page.locator('[data-type="tools"]').getAttribute('aria-pressed'),'true');
  assert.equal(await page.locator('[data-tool-id="fretboard-scales"]').count(),1);
  assert.deepEqual(errors,[]);assert.deepEqual(requests,[],'离线无需请求远程资源');
  await context.close();

  const noScript=await browser.newContext({javaScriptEnabled:false,offline:true});
  const staticPage=await noScript.newPage();await staticPage.goto(new URL('tools/各调指板音阶.html',root).href);
  assert.equal(await staticPage.locator('.key-section:visible').count(),7,'图表直接写入 HTML，无脚本仍可阅读');
  await noScript.close();

  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const hosted=await browser.newPage();
  await hosted.goto(`http://127.0.0.1:${server.address().port}/guitar/index.html#tools`);
  await hosted.locator('[data-tool-id="fretboard-scales"] a').click();
  assert.equal(await hosted.locator('.key-section').count(),7,'Pages 子路径可打开工具');
  await hosted.locator('.back').click();
  assert.equal(await hosted.locator('[data-type="tools"]').getAttribute('aria-pressed'),'true');
  console.log('PASS: 各调指板音阶的 7 调指板、音位一致性、调性筛选、手机适配、离线、无脚本阅读、打印和 Pages 往返导航。');
} finally {await browser.close();server.close();}
