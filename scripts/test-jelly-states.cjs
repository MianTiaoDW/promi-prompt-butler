const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { chromium } = require('playwright');

(async () => {
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'promi-jelly-'));
  let context;
  try {
    const dist = path.resolve('dist');
    context = await chromium.launchPersistentContext(profile, {
      headless: true,
      executablePath: process.env.CHROMIUM_EXECUTABLE || chromium.executablePath(),
      viewport: { width: 680, height: 1000 },
      args: [`--disable-extensions-except=${dist}`, `--load-extension=${dist}`]
    });
    const worker = context.serviceWorkers()[0] || await context.waitForEvent('serviceworker');
    const page = await context.newPage();
    await worker.evaluate(() => chrome.storage.local.set({ 'prompt-butler-tutorial-seen-v1': true }));
    await page.goto(`chrome-extension://${new URL(worker.url()).host}/options.html?view=app`);
    await page.getByRole('radio', { name: '提示词库', exact: true }).click();
    await page.evaluate(() => chrome.storage.local.set({
      'prompt-butler-favorites': [],
      'prompt-butler-folders': [{ id: 'empty', name: '空收藏夹', scope: '收藏', color: 'blue', order: 0 }]
    }));
    const state = expression => page.locator(`[data-jelly-state="${expression}"]`).first();
    const task = async (key, status) => page.evaluate(({ key, status }) => chrome.storage[key === 'prompt-butler-prompt-task' ? 'local' : 'session'].set({
      [key]: { status, taskId: 'fixture', workerSessionId: null, startedAt: null, finishedAt: null,
        result: null, errorMessage: status === 'error' ? '测试连接超时，请重试。' : null }
    }), { key, status });
    for (const theme of ['light', 'dark']) {
      await page.setViewportSize({ width: theme === 'dark' ? 420 : 680, height: 1000 });
      await page.evaluate(theme => chrome.storage.local.set({ 'prompt-butler-theme': theme }), theme);
      await page.getByRole('radio', { name: '提示词库', exact: true }).click();
      await page.getByRole('button', { name: '全部', exact: true }).click();
      const search = page.locator('input[placeholder*="搜索提示词"]');
      await search.fill('');
      await page.evaluate(() => chrome.storage.local.set({ 'prompt-butler-favorites': [{ id: 'fixture', title: '有效提示词', content: '测试内容', category: '收藏', tags: [], createdAt: '2026-10-23', provider: 'chatgpt', format: 'cnPrompt' }] }));
      await page.locator('.prompt-asset-card').waitFor();
      await page.waitForFunction(() => document.querySelectorAll('[data-jelly-state]').length === 0);
      await page.evaluate(() => chrome.storage.local.set({ 'prompt-butler-favorites': [] }));
      await state('welcome').waitFor();
      await search.fill('不存在的关键词');
      await state('searching').waitFor();
      await page.waitForTimeout(400);
      await page.screenshot({ path: `output/playwright/jelly-search-${theme}.png` });
      assert.equal(await page.locator('[data-jelly-state="welcome"]').count(), 0);
      await search.fill('');
      await page.getByRole('button', { name: '我的收藏夹', exact: true }).click();
      assert.equal(await page.locator('[data-jelly-state]').count(), 0, 'Populated folder browser has no mascot');
      await page.locator('.collection-folder').filter({ hasText: '空收藏夹' }).click();
      await state('welcome').waitFor();
      await page.getByRole('button', { name: '添加提示词', exact: true }).waitFor();
      await page.waitForTimeout(400);
      await page.screenshot({ path: `output/playwright/jelly-folder-${theme}.png` });
      await page.getByRole('button', { name: '返回收藏夹', exact: true }).click();
      await page.getByRole('radio', { name: '创作', exact: true }).click();
      await task('prompt-butler-prompt-task', 'generating');
      await state('thinking').waitFor();
      await task('prompt-butler-prompt-task', 'error');
      await state('sad').waitFor();
      assert.equal(await page.locator('[data-jelly-state="thinking"]').count(), 0);
      await task('prompt-butler-prompt-task', 'idle');
      await page.getByRole('radio', { name: '图像工坊', exact: true }).click();
      await task('prompt-butler-image-task', 'generating');
      await state('thinking').waitFor();
      await task('prompt-butler-image-task', 'error');
      await state('sad').waitFor();
      await page.getByRole('button', { name: '重试生成', exact: true }).waitFor();
      await page.waitForTimeout(400);
      await page.screenshot({ path: `output/playwright/jelly-error-${theme}.png` });
      assert.equal(await page.locator('[data-jelly-state="thinking"]').count(), 0);
      await page.waitForFunction(() => [...document.querySelectorAll('.jelly-state img')].every(img => img.complete && img.naturalWidth > 0));
      assert.ok(await state('sad').locator('img').evaluate(el => el.getBoundingClientRect().width <= 160));
      await task('prompt-butler-image-task', 'idle');
    }
    console.log('PASS: real extension empty/search/folder states and prompt/image waiting/error transitions in light/dark; no AI calls');
  } finally {
    if (context) await context.close();
    fs.rmSync(profile, { recursive: true, force: true });
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
