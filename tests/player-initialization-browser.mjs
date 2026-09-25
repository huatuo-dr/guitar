import assert from 'node:assert/strict';
import {mkdir,readFile} from 'node:fs/promises';
import {createServer} from 'node:http';
import {chromium} from 'playwright';
const root=new URL('../',import.meta.url);
await mkdir(new URL('artifacts/',root),{recursive:true});
const server=createServer(async(req,res)=>{
  try {
    const path=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
    if(!path.startsWith('/guitar/sheet_music/'))throw new Error('Unknown file');
    res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});
    res.end(await readFile(new URL(path.slice('/guitar/'.length),root)));
  } catch {res.writeHead(404);res.end();}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH}:{})});
try {
 for(const file of ['偏爱指弹.html','卡农指弹.html'])for(const fault of ['constructor','script','timeout']) {
  const context=await browser.newContext({viewport:{width:393,height:852},isMobile:true,hasTouch:true});
  await context.addInitScript(fault=>{
    const NativeWorker=Worker;
    window.failedWorkers=[];
    window.Worker=class extends NativeWorker {
      constructor() {
        if(fault==='constructor')throw new DOMException('Worker is blocked','SecurityError');
        super(URL.createObjectURL(new Blob([fault==='script'?'throw new Error("Worker script failed")':'self.onmessage=()=>{}'],{type:'text/javascript'})));
        window.failedWorkers.push(this);
      }
      terminate(){this.terminated=true;super.terminate();}
    };
  },fault);
  const page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  if(fault==='timeout')await page.clock.install();
  // Exercise the website path, as reported on the phone; script-failure case
  // additionally exercises the opaque origin of the standalone download.
  const url=fault==='script'?new URL(`sheet_music/${file}`,root).href:`http://127.0.0.1:${server.address().port}/guitar/sheet_music/${encodeURIComponent(file)}`;
  await page.goto(url);
  if(fault==='timeout'){await page.clock.fastForward(21000);await page.clock.resume();}
  await page.waitForFunction(()=>!document.getElementById('player-play').disabled,{},{timeout:3000});
  assert.equal(await page.locator('#player-play').textContent(),'重试播放');
  assert.match(await page.locator('#player-status').textContent(),/失败|超时/);
  assert.equal(await page.evaluate(()=>scrollY),0);
  if(file==='卡农指弹.html'&&fault==='timeout')await page.screenshot({path:'artifacts/mobile-player-retry.png'});
  const apiExpression=file.startsWith('偏爱')?'api':'accompanimentPlayer.api';
  await page.evaluate(expression=>{window.testPlayer=eval(expression);},apiExpression);
  await page.locator('#player-play').tap();
  await page.waitForFunction(()=>document.body.dataset.playerState==='playing');
  await page.waitForFunction(()=>testPlayer.tickPosition>150);
  if(file.startsWith('偏爱'))await page.waitForFunction(()=>document.querySelectorAll('.at-highlight').length>0);
  else assert.equal(await page.locator('#bar-1.player-current .playback-cursor').count(),1);
  assert.equal(await page.evaluate(()=>testPlayer.player.instance.constructor.name),'AlphaSynth','重试不依赖Worker');
  assert.ok(await page.evaluate(()=>failedWorkers.every(w=>w.terminated)),'退出失效Worker');
  await page.evaluate(()=>{
    const node=testPlayer.player.output._audioNode,generate=node.onaudioprocess;
    window.peak=0;node.onaudioprocess=event=>{generate(event);for(const n of event.outputBuffer.getChannelData(0))window.peak=Math.max(peak,Math.abs(n));};
  });
  await page.waitForFunction(()=>peak>0.001);
  await page.locator('#player-play').tap();
  await page.waitForFunction(()=>document.body.dataset.playerState==='paused');
  await page.locator('#player-stop').tap();
  await page.waitForFunction(()=>testPlayer.tickPosition<=1);
  // Expired timers must not overwrite a successful retry later.
  await page.waitForTimeout(100);
  assert.equal(await page.locator('#player-play').textContent(),'播放');
  assert.deepEqual(errors,[]);
  await context.close();
  console.log(`PASS: ${file} ${fault} 初始化失败可恢复，兼容模式实际发声。`);
 }
} finally {await browser.close();await new Promise(resolve=>server.close(resolve));}
