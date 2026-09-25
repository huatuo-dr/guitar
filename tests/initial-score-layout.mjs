import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createServer} from 'node:http';
import {chromium} from 'playwright';
const root=new URL('../',import.meta.url);
const html=await readFile(new URL('sheet_music/后来弹唱伴奏.html',root),'utf8');
const split=html.indexOf('<div id="accompaniment-audio"');
assert.ok(split>0);
let release;
const server=createServer((req,res)=>{
 res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});
 res.write(html.slice(0,split));release=()=>{if(!res.writableEnded)res.end(html.slice(split));};
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH}:{})});
try {
 const page=await browser.newPage({viewport:{width:393,height:852},isMobile:true,hasTouch:true});
 await page.goto(`http://127.0.0.1:${server.address().port}/guitar/sheet_music/houlai.html`,{waitUntil:'commit'});
 await page.waitForSelector('.score-system');
 const initial=await page.locator('.score-viewport').evaluate(el=>({overflow:el.scrollWidth-el.clientWidth,domReady:document.readyState}));
 assert.equal(initial.domReady,'loading','模拟音频脚本和音色仍在下载');
 assert.ok(initial.overflow<=2,`首屏无需等音频脚本下载即可适应宽度，溢出 ${initial.overflow}px`);
 release();await page.waitForLoadState('load');
 await page.waitForFunction(()=>document.querySelector('#score').dataset.barsPerRow==='2');
 assert.equal(await page.evaluate(()=>scrollY),0);
 await page.close();
 console.log('PASS: 音频资源仍在下载时，首屏曲谱已适应手机宽度。');
 for(const file of ['偏爱指弹.html','后来弹唱伴奏.html','卡农指弹.html']){
  const context=await browser.newContext({offline:true,viewport:{width:393,height:852},isMobile:true,hasTouch:true});
  await context.addInitScript(()=>{
   window.viewFrames=0;
   const frame=()=>{
    const score=document.querySelector('#score');
    if(score?.dataset.barsPerRow==='2'&&document.body.dataset.renderState==='ready')window.viewFrames++;
    requestAnimationFrame(frame);
   };requestAnimationFrame(frame);
   const NativeWorker=Worker;
   window.Worker=class extends NativeWorker{
    constructor(){
     window.audioStartedAfterFrames=window.viewFrames;
     super(URL.createObjectURL(new Blob(['self.onmessage=()=>{}'],{type:'text/javascript'})));
    }
   };
  });
  const tab=await context.newPage();await tab.goto(new URL('sheet_music/'+file,root).href);
  await tab.waitForFunction(()=>window.audioStartedAfterFrames!==undefined);
  assert.ok(await tab.evaluate(()=>audioStartedAfterFrames>=1),'声音初始化必须排在适配后的谱面已获得绘制帧之后');
  assert.equal(await tab.locator('#player-play').isDisabled(),true);
  assert.equal(await tab.evaluate(()=>document.body.dataset.playerInitialization),'loading');
  const viewport=tab.locator(file.startsWith('偏爱')?'#score-area':'.score-viewport');
  assert.ok(await viewport.evaluate(el=>el.scrollWidth-el.clientWidth<=2));
  assert.equal(await tab.locator('#score').getAttribute('data-bars-per-row'),'2');
  await tab.setViewportSize({width:320,height:740});
  await tab.waitForFunction(()=>document.querySelector('#score').clientWidth<=document.querySelector('#score').parentElement.clientWidth+2);
  assert.equal(await tab.evaluate(()=>scrollY),0);
  await context.close();console.log('PASS: 音色未就绪仍可阅读、自适应及旋转排版：'+file);
 }
} finally {release?.();await browser.close();await new Promise(resolve=>server.close(resolve));}
