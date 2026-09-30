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
  const context=await browser.newContext({offline:true,hasTouch:true,viewport:{width:1440,height:1050}});
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
  assert.deepEqual(await page.locator('.key-nav [data-key]').evaluateAll(ns=>ns.map(n=>n.dataset.key)),['all','C','D','E','F','G','A','B','none']);
  assert.equal(await page.locator('[data-key="none"]').innerText(),'全不');
  assert.equal(await page.locator('.key-nav [aria-pressed="true"]').count(),8,'初始全部及七个调均选中');
  await page.locator('[data-key="C"]').click();
  assert.equal(await page.locator('.key-section:visible').count(),6,'取消一个调时其他调仍显示');
  assert.equal(await page.locator('[data-key="all"]').getAttribute('aria-pressed'),'false');
  await page.locator('[data-key="none"]').click();
  assert.equal(await page.locator('.key-section:visible').count(),0);
  assert.equal(await page.locator('[data-key="none"]').getAttribute('aria-pressed'),'true');
  assert.match(await page.locator('.result-count').innerText(),/未选择调性/);
  for(const key of ['C','G','A'])await page.locator(`[data-key="${key}"]`).click();
  assert.deepEqual(await page.locator('.key-section:visible').evaluateAll(ns=>ns.map(n=>n.dataset.keySection)),['C','G','A']);
  await page.locator('[data-key="G"]').click();
  assert.deepEqual(await page.locator('.key-section:visible').evaluateAll(ns=>ns.map(n=>n.dataset.keySection)),['C','A']);
  await page.locator('[data-key="all"]').click();
  assert.equal(await page.locator('.key-section:visible').count(),7);

  for(const key of ['C','D','E','F','G','A','B']){
    await page.locator('[data-key="none"]').click();
    await page.locator(`[data-key="${key}"]`).click();
    assert.equal(await page.locator('.key-section:visible').count(),1);
    assert.equal(await page.locator('.key-section:visible').getAttribute('data-key-section'),key);
    const positions=await page.locator('.key-section:visible .full-board .scale-note').evaluateAll(nodes=>nodes.map(n=>n.dataset));
    assert.ok(positions.length>50);
    assert.equal(await page.locator('[aria-pressed="true"]').count(),1);
  }
  await page.locator('[data-key="none"]').click();
  await page.locator('[data-key="C"]').click();
  const cBoard=page.locator('[data-key-section="C"] .full-board');
  assert.equal(await cBoard.locator('.pattern-control').count(),5);
  assert.equal(await cBoard.locator('.fret-label,.position-dot').count(),0,'C 调用上下区域放指型名称');
  assert.equal(await page.locator('[data-key-section="D"] .full-board .fret-label').count(),16,'其他调保留品位提示');
  const originalSize=await cBoard.boundingBox();
  for(const [id,first,last] of [['mi',0,3],['sol',2,6],['la',4,8],['si',7,10],['re',9,13]]){
    const button=cBoard.locator(`[data-pattern="${id}"]`);
    await button.click();
    assert.equal(await button.getAttribute('aria-pressed'),'true');
    assert.equal(await cBoard.locator('.pattern-band.is-active').count(),1);
    const highlighted=await cBoard.locator('.scale-note.is-highlighted').evaluateAll(ns=>ns.map(n=>Number(n.dataset.fret)));
    const expected=await cBoard.locator('.scale-note').evaluateAll((ns,range)=>ns.map(n=>Number(n.dataset.fret)).filter(f=>f>=range[0]&&f<=range[1]),[first,last]);
    assert.deepEqual(highlighted,expected);
    assert.equal(await page.locator('[data-key-section]:not([data-key-section="C"]) .is-highlighted').count(),0);
    assert.deepEqual(await cBoard.boundingBox(),originalSize,'切换指型不改变指板尺寸');
  }
  await page.screenshot({path:'artifacts/fretboard-scales/pattern-desktop.png'});
  const selected=cBoard.locator('[data-pattern="re"]');
  await selected.press('Enter');
  assert.equal(await cBoard.locator('.pattern-band.is-active').count(),0,'再次选择取消高亮');
  await cBoard.locator('[data-pattern="la"]').press('Space');
  assert.equal(await cBoard.locator('[data-pattern="la"]').getAttribute('aria-pressed'),'true');
  const notation=page.locator('.notation-toggle');
  assert.equal(await notation.count(),1,'只有 C 调提供显示方式切换');
  assert.equal(await notation.innerText(),'方式1');
  const cNotes=page.locator('[data-key-section="C"] .scale-note');
  const dotCount=await cNotes.locator('.octave-dot').count();
  await notation.click();
  assert.equal(await notation.innerText(),'方式2');
  assert.ok(await cNotes.evaluateAll(ns=>ns.every(n=>n.querySelector('text').textContent==='CDEFGAB'[Number(n.dataset.degree)-1])),'全部数字按音级映射为音名');
  const colors=await cBoard.locator('.scale-note').evaluateAll(ns=>Object.fromEntries(ns.map(n=>[n.dataset.note,getComputedStyle(n.querySelector('text')).fill])));
  assert.equal(new Set(Object.values(colors)).size,7,'七个音名各有固定配色');
  assert.equal(await cNotes.locator('.octave-dot').count(),dotCount,'切换保留高低音点');
  assert.equal(await cBoard.locator('[data-pattern="la"]').getAttribute('aria-pressed'),'true','切换保留指型高亮');
  assert.ok(await page.locator('[data-key-section]:not([data-key-section="C"]) .scale-note').evaluateAll(ns=>ns.every(n=>n.querySelector('text').textContent===n.dataset.degree)),'其他调仍显示数字');
  await page.screenshot({path:'artifacts/fretboard-scales/letters-desktop.png',fullPage:true});
  await cBoard.locator('[data-note="E"]').first().click();
  assert.ok(await cNotes.evaluateAll(ns=>ns.every(n=>n.classList.contains('note-focused')===(n.dataset.note==='E'))),'跨八度及分段聚焦同名音符');
  assert.ok(await cNotes.evaluateAll(ns=>ns.every(n=>{
    const selected=n.dataset.note==='E';
    const text=getComputedStyle(n.querySelector('text'));
    const head=getComputedStyle(n.querySelector('circle'));
    return selected ? text.fill==='rgb(255, 255, 255)'&&head.fill==='rgb(162, 77, 40)'&&getComputedStyle(n).opacity==='1' : Number(getComputedStyle(n).opacity)<0.3;
  })),'同名字母白字填色，其他整个音符组半透明');
  assert.equal(await cNotes.locator('.octave-dot').count(),dotCount);
  assert.equal(await cBoard.locator('[data-pattern="la"]').getAttribute('aria-pressed'),'true');
  await page.screenshot({path:'artifacts/fretboard-scales/note-focus-desktop.png',fullPage:true});
  await page.locator('[data-note-key="D"]').press('Enter');
  assert.ok(await cNotes.evaluateAll(ns=>ns.every(n=>n.classList.contains('note-focused')===(n.dataset.note==='D'))),'从音名对照切换聚焦');
  await cBoard.locator('[data-note="D"]').first().press('Space');
  assert.equal(await cNotes.filter({has:page.locator('text')}).evaluateAll(ns=>ns.filter(n=>n.classList.contains('note-muted')||n.classList.contains('note-focused')).length),0,'再次点击同音取消');
  await cBoard.locator('[data-note="B"]').first().click();

  await notation.press('Enter');
  assert.equal(await notation.innerText(),'方式1');
  assert.ok(await cNotes.evaluateAll(ns=>ns.every(n=>n.querySelector('text').textContent===n.dataset.degree)));
  assert.ok(await cNotes.evaluateAll(ns=>ns.every(n=>!n.classList.contains('note-focused')&&!n.classList.contains('note-muted'))),'数字模式清除聚焦');
  await cBoard.locator('[data-note="E"]').first().click();
  assert.ok(await cNotes.evaluateAll(ns=>ns.every(n=>!n.classList.contains('note-focused'))),'数字模式不触发聚焦');
  await notation.click();
  for(const width of [320,390,768,1024]){
    await page.setViewportSize({width,height:844});
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${width}px 无横向溢出`);
    assert.equal(await page.locator('.key-section:visible svg:visible').count(),width<=760?3:1);
    const full=await page.locator('[data-key-section="C"] .full-board .scale-note').evaluateAll(ns=>ns.map(n=>n.dataset.string+':'+n.dataset.fret).sort());
    const visible=await page.locator('[data-key-section="C"] .scale-note:visible').evaluateAll(ns=>ns.map(n=>n.dataset.string+':'+n.dataset.fret).sort());
    assert.deepEqual(visible,full,'手机与电脑展示相同音位');
    assert.ok(await cNotes.evaluateAll(ns=>ns.every(n=>n.querySelector('text').textContent===n.dataset.note)),'手机分段同步字母显示');
  }
  await page.setViewportSize({width:390,height:844});
  const mobileNotes=page.locator('[data-key-section="C"] .split-boards .scale-note');
  await mobileNotes.locator('text').filter({hasText:/^C$/}).first().tap();
  assert.ok(await cNotes.evaluateAll(ns=>ns.every(n=>n.classList.contains('note-focused')===(n.dataset.note==='C'))),'手机触摸在全部分段同步聚焦');
  await page.screenshot({path:'artifacts/fretboard-scales/note-focus-mobile.png',fullPage:true});
  await mobileNotes.locator('text').filter({hasText:/^C$/}).first().tap();
  await page.screenshot({path:'artifacts/fretboard-scales/mobile.png',fullPage:true});
  const mobileLa=page.locator('[data-key-section="C"] .split-boards [data-pattern="la"]');
  assert.equal(await mobileLa.count(),2,'跨分段指型均可操作');
  assert.deepEqual(await mobileLa.evaluateAll(ns=>ns.map(n=>n.getAttribute('aria-pressed'))),['true','true']);
  await mobileLa.first().tap();
  assert.equal(await page.locator('[data-key-section="C"] .pattern-band.is-active').count(),0);
  await page.locator('[data-key-section="C"] .split-boards [data-pattern="si"]').tap();
  assert.equal(await cBoard.locator('[data-pattern="si"]').getAttribute('aria-pressed'),'true','手机和完整指板同步状态');
  await page.locator('[data-key="G"]').tap();
  assert.equal(await page.locator('.key-section:visible').count(),2,'手机可同时选择 C 与 G');
  await page.locator('[data-key="none"]').tap();
  assert.equal(await page.locator('.key-section:visible').count(),0);
  await page.locator('[data-key="C"]').tap();
  assert.equal(await cBoard.locator('[data-pattern="si"]').getAttribute('aria-pressed'),'true','隐藏再显示保留 C 指型选择');
  assert.equal(await notation.innerText(),'方式2','隐藏再显示保留音名方式');
  await notation.tap();
  assert.equal(await notation.innerText(),'方式1');
  assert.ok(await cNotes.evaluateAll(ns=>ns.every(n=>n.querySelector('text').textContent===n.dataset.degree)),'手机恢复数字');
  await notation.tap();

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
