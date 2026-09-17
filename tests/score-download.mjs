import assert from 'node:assert/strict';
import {mkdir, readFile} from 'node:fs/promises';
import {createServer} from 'node:http';
import {chromium} from 'playwright';
import {fileURLToPath} from 'node:url';

const root = new URL('../',import.meta.url);
const output = new URL('artifacts/downloads/',root);
await mkdir(output,{recursive:true});
const server = createServer(async (req,res) => {
  try {
    const file = decodeURIComponent(new URL(req.url,'http://localhost').pathname);
    if (!file.startsWith('/guitar/sheet_music/')) throw new Error('Unknown path');
    const content = await readFile(new URL(file.slice('/guitar/'.length),root));
    res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});
    res.end(content);
  } catch {res.writeHead(404);res.end();}
});
await new Promise(resolve => server.listen(0,'127.0.0.1',resolve));
const browser = await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ? {executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH} : {})});
const files = ['偏爱指弹.html','老男孩弹唱伴奏.html','后来弹唱伴奏.html','空心弹唱伴奏.html'];
async function ready(page,file) {
  if (file === files[0]) await page.waitForFunction(() => document.body.dataset.renderState === 'ready');
  else await page.waitForSelector('.measure');
  assert.equal(await page.locator('#auto-scroll-toggle').count(),1);
}
try {
  for (const hosted of [false,true]) {
    const context = await browser.newContext({offline:!hosted,viewport:{width:390,height:844}});
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror',error => errors.push(error.message));
    for (const file of files) {
      const url = hosted ? `http://127.0.0.1:${server.address().port}/guitar/sheet_music/${encodeURIComponent(file)}` : new URL(`sheet_music/${file}`,root).href;
      await page.goto(url);
      await ready(page,file);
      assert.equal(await page.locator('#print + #download').count(),1,'下载紧跟打印');
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),true);
      await page.locator('#bars-per-row').selectOption('2');
      await page.locator('#auto-scroll-toggle').click();
      const pending = page.waitForEvent('download');
      await page.locator('#download').click();
      const download = await pending;
      assert.equal(download.suggestedFilename(),file);
      assert.equal(page.url(),url,'下载不应导航');
      const saved = new URL(`${hosted?'web':'local'}-${file}`,output);
      await download.saveAs(fileURLToPath(saved));
      const html = await readFile(saved,'utf8');
      assert.ok(html.startsWith('<!DOCTYPE html>'));
      assert.ok(!html.includes('class="auto-scroll"'),'下载不包含运行时生成的浮动控件');

      const offline = await browser.newContext({offline:true});
      const reopened = await offline.newPage();
      reopened.on('pageerror',error => errors.push(error.message));
      await reopened.goto(saved.href);
      await ready(reopened,file);
      assert.equal(await reopened.locator('#auto-scroll-toggle').innerText(),'滚');
      for (const rows of ['2','4']) {
        await reopened.locator('#bars-per-row').selectOption(rows);
        await reopened.waitForFunction(value => document.getElementById('score').dataset.barsPerRow === value,rows);
        if (file !== files[0]) assert.equal(await reopened.locator('#score .measure').count(),file === files[1] ? 55 : file === files[2] ? 49 : 47);
      }
      const again = reopened.waitForEvent('download');
      await reopened.locator('#download').click();
      assert.equal(await readFile(await (await again).path(),'utf8'),html,'再次下载不叠加谱面或控件');
      await reopened.emulateMedia({media:'print'});
      assert.equal(await reopened.locator('#download').isVisible(),false);
      await offline.close();
    }
    assert.deepEqual(errors,[]);
    await context.close();
  }
  console.log('PASS: 四份曲谱本地/网站下载、按钮位置、移动端布局、离线重开、2/4小节切换、重复下载与打印隐藏通过。');
} finally {
  await browser.close();
  await new Promise(resolve => server.close(resolve));
}
