import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {chromium} from 'playwright';

const root = new URL('../', import.meta.url);
const scores = [
  ['偏爱指弹.html', 'pianai'],
  ['老男孩弹唱伴奏.html', 'laonanhai'],
  ['后来弹唱伴奏.html', 'houlai'],
];
const browser = await chromium.launch({
  headless: true,
  ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
    ? {executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH} : {}),
});
await mkdir(new URL('artifacts/', root), {recursive: true});
const errors = [];
const external = [];

async function openScore(name, options = {}) {
  const context = await browser.newContext({
    offline: true, viewport: {width: 1280, height: 800}, reducedMotion: 'reduce', ...options,
  });
  const page = await context.newPage();
  page.setDefaultTimeout(5000);
  page.on('pageerror', error => errors.push(`${name}: ${error.message}`));
  page.on('request', request => {
    if (/^https?:/.test(request.url())) external.push(request.url());
  });
  await page.goto(new URL(`sheet_music/${name}`, root).href);
  return {context, page};
}

async function state(page, active) {
  const toggle = page.locator('#auto-scroll-toggle');
  assert.equal(await toggle.getAttribute('aria-pressed'), String(active));
  assert.equal(await toggle.getAttribute('aria-label'), active ? '停止自动滚动' : '开始自动滚动');
  assert.equal((await toggle.innerText()).trim(), active ? '停' : '滚');
}

async function displacement(page, milliseconds = 1100) {
  const before = await page.evaluate(() => ({y: scrollY, time: performance.now()}));
  await page.waitForTimeout(milliseconds);
  const after = await page.evaluate(() => ({y: scrollY, time: performance.now()}));
  return {pixels: after.y - before.y, seconds: (after.time - before.time) / 1000};
}

async function moving(page, message) {
  const movement = await displacement(page);
  assert.ok(movement.pixels >= 5, `${message}: moved ${movement.pixels}px in ${movement.seconds.toFixed(2)}s`);
}

async function chooseSpeed(page, speed) {
  if (!await page.locator('#auto-scroll-speed-panel').isVisible()) {
    await page.locator('#auto-scroll-speed').click();
  }
  await page.locator(`input[name="auto-scroll-speed"][value="${speed}"]`).check();
  await page.keyboard.press('Escape');
}

async function longPress(page, active) {
  const bounds = await page.locator('#auto-scroll-toggle').boundingBox();
  await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(650);
  assert.equal(await page.locator('#auto-scroll-speed-panel').isVisible(), true, '长按应打开速度面板');
  await page.mouse.up();
  await state(page, active);
  await page.keyboard.press('Escape');
}

try {
  for (const [name, id] of scores) {
    const {context, page} = await openScore(name);
    await page.locator('#auto-scroll-toggle').waitFor({state: 'visible'});
    await state(page, false);
    assert.equal(await page.locator('.auto-scroll').evaluate(node => getComputedStyle(node).position), 'fixed');
    assert.match(await page.locator('#auto-scroll-speed').innerText(), /速度[：:]\s*适中/);
    assert.equal(await page.locator('#auto-scroll-speed-panel').isVisible(), false);
    await page.locator('#auto-scroll-toggle').click();
    await state(page, true);
    await moving(page, `${name} 启动后持续向下滚动`);
    await page.mouse.move(200, 200);
    await page.mouse.wheel(0, 300);
    await page.waitForTimeout(450);
    await state(page, true);
    await moving(page, `${name} 手动滚动后继续`);
    await page.locator('#auto-scroll-toggle').click();
    await state(page, false);
    await page.waitForTimeout(120);
    assert.equal((await displacement(page, 500)).pixels, 0, `${name} 点击停止后位置应稳定`);
    await chooseSpeed(page, 'fast');
    assert.equal(await page.evaluate(key => localStorage.getItem(key), `guitar-view:${id}:v1:auto-scroll`), 'fast');
    await page.locator('#auto-scroll-toggle').click();
    await page.reload();
    await state(page, false);
    await page.locator('#auto-scroll-speed').click();
    assert.equal(await page.locator('input[name="auto-scroll-speed"][value="fast"]').isChecked(), true);
    await page.keyboard.press('Escape');
    console.log(`PASS: ${name} 离线运行、开始/停止、手动滚动续行、速度持久化及刷新默认停止`);
    await context.close();
  }

  const {context, page} = await openScore(scores[1][0]);
  const key = 'guitar-view:laonanhai:v1:auto-scroll';
  await longPress(page, false);
  await page.locator('#auto-scroll-speed').click();
  const panel = page.locator('#auto-scroll-speed-panel');
  assert.equal(await panel.getAttribute('role'), 'dialog');
  assert.notEqual(await panel.getAttribute('aria-modal'), 'true', '速度面板不应阻挡页面');
  assert.deepEqual(await panel.locator('input[name="auto-scroll-speed"]').evaluateAll(inputs => inputs.map(input => input.value)),
    ['very-slow', 'slow', 'medium', 'fast', 'very-fast']);
  await page.mouse.click(30, 100);
  assert.equal(await panel.isVisible(), false, '点击面板外关闭');
  await page.locator('#auto-scroll-toggle').click();
  await longPress(page, true);

  for (const [speed, rate] of [['very-slow', 8], ['slow', 14], ['medium', 22], ['fast', 34], ['very-fast', 50]]) {
    await chooseSpeed(page, speed);
    await state(page, true);
    await page.waitForTimeout(350);
    const movement = await displacement(page, 1400);
    const actual = movement.pixels / movement.seconds;
    assert.ok(Math.abs(actual - rate) <= rate * 0.25 + 1.5,
      `${speed} 应约 ${rate}px/s，实测 ${actual.toFixed(2)}px/s`);
  }
  await page.evaluate(() => scrollTo(0, document.documentElement.scrollHeight));
  await page.waitForTimeout(400);
  await state(page, true);
  assert.equal((await displacement(page, 500)).pixels, 0, '到底部后不应继续移动');
  await page.mouse.move(200, 300);
  await page.mouse.wheel(0, -450);
  await page.waitForTimeout(500);
  await state(page, true);
  await moving(page, '到底后手动向上移动应继续自动向下');

  await page.evaluate(() => scrollTo(0, 0));
  await page.waitForTimeout(300);
  // The page is intentionally moving: send a real click without waiting for
  // Playwright's two-frame position stability, which auto-scroll can prevent.
  await page.locator('.section-picker > summary').click({force:true});
  const sectionJump = page.locator('.section-nav [data-jump="21"]');
  assert.equal(await sectionJump.isVisible(),true);
  await sectionJump.click({force:true});
  await page.waitForTimeout(500);
  await state(page, true);
  assert.equal(await page.locator('#bar-21').evaluate(node => node === document.activeElement), true);
  await moving(page, '段定位后应保持自动滚动');
  await page.screenshot({path: new URL('artifacts/auto-scroll-desktop.png', root).pathname});

  // Chromium's PDF operation sends the real beforeprint/afterprint lifecycle.
  await page.emulateMedia({media: 'print'});
  assert.equal(await page.locator('.auto-scroll').isVisible(), false, '打印隐藏整个控件');
  await page.waitForTimeout(150);
  await state(page, true);
  assert.equal((await displacement(page, 600)).pixels, 0, '打印期间动画暂停但保持运行状态');
  await page.pdf({preferCSSPageSize: true});
  await page.emulateMedia({media: 'screen'});
  await state(page, true);
  await page.waitForTimeout(400);
  await moving(page, '打印结束继续之前的滚动状态');

  for (const width of [390, 320]) {
    await page.setViewportSize({width, height: 844});
    await page.locator('#auto-scroll-speed').click();
    const geometry = await page.locator('.auto-scroll').evaluate(node => {
      const box = node.getBoundingClientRect();
      const panelBox = document.querySelector('#auto-scroll-speed-panel').getBoundingClientRect();
      return {left: box.left, right: box.right, bottom: box.bottom,
        panelLeft: panelBox.left, panelRight: panelBox.right,
        width: innerWidth, height: innerHeight, documentWidth: document.documentElement.scrollWidth};
    });
    assert.ok(geometry.left >= 0 && geometry.right <= width && geometry.bottom <= geometry.height,
      `${width}px浮动控件应位于视口内`);
    assert.ok(geometry.panelLeft >= 0 && geometry.panelRight <= width, `${width}px速度面板应位于视口内`);
    assert.ok(geometry.documentWidth <= width, `${width}px页面不应横向溢出`);
    await page.screenshot({path: new URL(`artifacts/auto-scroll-mobile-${width}.png`, root).pathname});
    await page.keyboard.press('Escape');
  }

  for (const invalid of ['broken', '{"speed":"fast","active":true}', '', '900']) {
    await page.evaluate(([storageKey, value]) => localStorage.setItem(storageKey, value), [key, invalid]);
    await page.reload();
    await state(page, false);
    assert.match(await page.locator('#auto-scroll-speed').innerText(), /适中/, '损坏存储回退到适中');
  }
  await context.close();

  const blocked = await browser.newContext({offline: true, viewport: {width: 390, height: 844}, hasTouch: true});
  await blocked.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', {get() {throw new DOMException('Storage disabled', 'SecurityError');}});
  });
  const blockedPage = await blocked.newPage();
  blockedPage.setDefaultTimeout(5000);
  blockedPage.on('pageerror', error => errors.push(`storage disabled: ${error.message}`));
  await blockedPage.goto(new URL(`sheet_music/${scores[2][0]}`, root).href);
  const touchSession = await blocked.newCDPSession(blockedPage);
  async function touchLongPress(active) {
    const box = await blockedPage.locator('#auto-scroll-toggle').boundingBox();
    await touchSession.send('Input.dispatchTouchEvent', {
      type: 'touchStart', touchPoints: [{x: box.x + box.width / 2, y: box.y + box.height / 2}],
    });
    await blockedPage.waitForTimeout(650);
    assert.equal(await blockedPage.locator('#auto-scroll-speed-panel').isVisible(), true, '手机长按打开速度面板');
    await touchSession.send('Input.dispatchTouchEvent', {type: 'touchEnd', touchPoints: []});
    await blockedPage.waitForTimeout(100);
    await state(blockedPage, active);
    await blockedPage.keyboard.press('Escape');
  }
  await touchLongPress(false);
  await chooseSpeed(blockedPage, 'fast');
  await blockedPage.locator('#auto-scroll-toggle').tap();
  await state(blockedPage, true);
  await moving(blockedPage, '禁用存储时手机触摸启动仍可滚动');
  await touchLongPress(true);
  const scoreSystem = blockedPage.locator('.score-system').first();
  await scoreSystem.scrollIntoViewIfNeeded();
  const scoreBox = await scoreSystem.boundingBox();
  await touchSession.send('Input.dispatchTouchEvent', {
    type: 'touchStart', touchPoints: [{x: scoreBox.x + scoreBox.width / 2, y: scoreBox.y + scoreBox.height / 2}],
  });
  await blockedPage.waitForTimeout(100);
  assert.equal((await displacement(blockedPage, 500)).pixels, 0, '手指按住页面时自动滚动应让行');
  await state(blockedPage, true);
  await touchSession.send('Input.dispatchTouchEvent', {type: 'touchEnd', touchPoints: []});
  await blockedPage.waitForTimeout(350);
  await moving(blockedPage, '手指抬起后继续自动滚动');
  await blockedPage.locator('#auto-scroll-toggle').tap();
  await state(blockedPage, false);
  await blocked.close();
  assert.deepEqual(errors, [], '页面不得出现脚本异常');
  assert.deepEqual(external, [], '独立乐谱不得依赖在线资源');
  console.log('PASS: 五档实际速度、长按、面板关闭、到底持续运行、手动上移续行、段定位、打印恢复、手机布局、损坏/禁用存储');
} finally {
  await browser.close();
}
