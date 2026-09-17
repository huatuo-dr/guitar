import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {chromium} from 'playwright';

const browser = await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ? {executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH} : {})});
await mkdir(new URL('../artifacts/',import.meta.url),{recursive:true});
try {
  const context = await browser.newContext({offline:true,viewport:{width:1440,height:1000}});
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror',error => errors.push(error.message));
  await page.goto(new URL('../sheet_music/偏爱指弹.html',import.meta.url).href);
  await page.waitForFunction(() => document.body.dataset.renderState === 'ready');
  const expected = await page.evaluate(() => api.score.tracks[0].staves[0].bars.flatMap(bar => bar.voices[0].beats.flatMap(beat => beat.lyrics || [])));
  assert.ok(expected.length > 300,'全曲应有完整歌词');
  async function checkLayout(label) {
    await page.waitForFunction(() => document.body.dataset.renderState === 'ready');
    const layout = await page.evaluate(() => {
      const text = [];
      const collisions = [];
      const clipped = [];
      const selector = 'text[style*="Microsoft YaHei"]';
      for (const svg of document.querySelectorAll('#score svg')) {
        const nodes = [...svg.querySelectorAll(selector)];
        // SMuFL glyphs use the music font's large em box, not their visible ink
        // bounds (e.g. the tuplet digit). Compare ordinary notation text here.
        const notes = [...svg.querySelectorAll('text')].filter(n => !n.matches(selector) && !/[\uE000-\uF8FF]/u.test(n.textContent));
        const noteRects = notes.map(n => n.getBoundingClientRect());
        const limit = svg.getBoundingClientRect();
        nodes.forEach((node,i) => {
          text.push(node.textContent);
          const rect = node.getBoundingClientRect();
          if (noteRects.some(other => rect.left < other.right-1 && rect.right > other.left+1 && rect.top < other.bottom-1 && rect.bottom > other.top+1)) collisions.push(`歌词碰到音符/技法/打板：${node.textContent}`);
          if (rect.left < limit.left-1 || rect.right > limit.right+1 || rect.bottom > limit.bottom+1) clipped.push(node.textContent);
          if (i) {
            const prev=nodes[i-1].getBoundingClientRect();
            if (Math.abs(prev.top-rect.top)<1 && prev.right>rect.left+1) collisions.push(`歌词相互重叠：${nodes[i-1].textContent}${node.textContent}`);
          }
        });
      }
      return {text,collisions,clipped};
    });
    assert.deepEqual(layout.text,expected,`${label}：歌词不丢失、不重复`);
    assert.deepEqual(layout.collisions,[],`${label}：文字间距`);
    assert.deepEqual(layout.clipped,[],`${label}：歌词在SVG范围内`);
  }
  for (const [label,width,rows,zoom] of [
    ['desktop-four',1440,'4','fit'],['desktop-two',1440,'2','fit'],
    ['mobile-two',390,'2','fit'],['mobile-four',320,'4','fit'],
    ['mobile-65',390,'2','0.65'],['desktop-140',1440,'4','1.4']
  ]) {
    await page.setViewportSize({width,height:1000});
    await page.locator('#bars-per-row').selectOption(rows);
    await page.locator('#zoom').selectOption(zoom);
    await checkLayout(label);
  }
  await page.setViewportSize({width:1440,height:1000});
  await page.locator('#zoom').selectOption('fit');
  await page.locator('#bars-per-row').selectOption('4');
  await checkLayout('desktop-final');
  await page.evaluate(() => {
    const bounds=api.renderer.boundsLookup.findMasterBarByIndex(4).visualBounds;
    const rect=document.getElementById('score').getBoundingClientRect();
    window.scrollTo(0,scrollY+rect.top+bounds.y-80);
  });
  await page.screenshot({path:'artifacts/pianai-lyrics-review.png'});
  await page.emulateMedia({media:'print'});
  await checkLayout('print');
  await page.pdf({path:'artifacts/pianai-lyrics-print.pdf',preferCSSPageSize:true,printBackground:true});
  assert.deepEqual(errors,[]);
  console.log('PASS: 偏爱全曲歌词在2/4小节、手机、缩放及打印下完整，无文字重叠或裁切。');
} finally {await browser.close();}
