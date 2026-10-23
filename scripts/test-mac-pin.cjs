const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { chromium } = require('playwright');

(async () => {
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'promi-pin-'));
  const dist = path.resolve('dist');
  let context;
  try {
    context = await chromium.launchPersistentContext(profile, {
      headless: false, executablePath: chromium.executablePath(),
      args: [`--disable-extensions-except=${dist}`, `--load-extension=${dist}`]
    });
    const worker = context.serviceWorkers()[0] || await context.waitForEvent('serviceworker');
    await worker.evaluate(() => chrome.storage.local.set({ 'prompt-butler-tutorial-seen-v1': true }));
    const page = await context.newPage();
    await page.goto(`chrome-extension://${new URL(worker.url()).host}/options.html?view=app`);
    assert.match(await page.evaluate(() => navigator.platform), /Mac/);
    await page.getByRole('button', { name: '置顶工作台', exact: true }).click();
    await page.waitForFunction(() => Boolean(window.documentPictureInPicture.window));
    const popupWindow = await page.evaluateHandle(() => window.documentPictureInPicture.window);
    await page.waitForFunction(() => Boolean(window.documentPictureInPicture.window.document.querySelector('iframe')?.contentDocument?.querySelector('.fluxora-shell')));
    assert.equal(await popupWindow.evaluate(w => w.document.querySelector('iframe').contentDocument.querySelector('[aria-label="取消置顶工作台"]').getAttribute('aria-pressed')), 'true');
    await popupWindow.evaluate(w => [...w.document.querySelector('iframe').contentDocument.querySelectorAll('[role="radio"]')].find(el => el.textContent.trim() === '创作').click());
    await page.waitForFunction(() => [...window.documentPictureInPicture.window.document.querySelector('iframe').contentDocument.querySelectorAll('[role="radio"]')].some(el => el.textContent.trim() === '创作' && el.getAttribute('aria-checked') === 'true'));
    await popupWindow.evaluate(w => w.document.querySelector('iframe').contentDocument.querySelector('[aria-label="取消置顶工作台"]').click());
    await page.waitForFunction(() => !window.documentPictureInPicture.window);
    await page.getByRole('button', { name: '置顶工作台', exact: true }).waitFor();
    await page.evaluate(() => Object.defineProperty(window, 'documentPictureInPicture', { configurable: true, value: undefined }));
    await page.getByRole('button', { name: '置顶工作台', exact: true }).click();
    await page.getByText('置顶失败：请使用支持画中画窗口的新版 Chrome 或 Edge 浏览器', { exact: true }).waitFor();
    const windowsPage = await context.newPage();
    await windowsPage.addInitScript(() => {
      Object.defineProperty(navigator, 'platform', { value: 'Win32' });
      window.nativeCalls = [];
      chrome.runtime.sendNativeMessage = async (host, message) => {
        window.nativeCalls.push({ host, ...message });
        return { ok: true, enabled: message.enabled === true };
      };
    });
    await windowsPage.goto(page.url());
    await windowsPage.getByRole('button', { name: '置顶工作台', exact: true }).click();
    await windowsPage.getByRole('button', { name: '取消置顶工作台', exact: true }).waitFor();
    assert.ok(await windowsPage.evaluate(() => window.nativeCalls.some(call => call.host === 'com.promptbutler.window' && call.type === 'window:set-always-on-top' && call.enabled)));
    await page.reload();
    await page.getByRole('button', { name: '置顶工作台', exact: true }).click();
    await page.waitForFunction(() => Boolean(window.documentPictureInPicture.window));
    await page.evaluate(() => window.documentPictureInPicture.window.close());
    await page.getByRole('button', { name: '置顶工作台', exact: true }).waitFor();
    console.log('PASS: macOS real extension opens interactive PiP, unpins, reopens and restores pin state after close');
  } finally {
    await context?.close();
    fs.rmSync(profile, { recursive: true, force: true });
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
