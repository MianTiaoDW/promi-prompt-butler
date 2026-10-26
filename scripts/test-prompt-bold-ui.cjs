// Isolated real-extension acceptance test. Requires Playwright through NODE_PATH.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { chromium } = require('playwright');
const { unzipSync, strFromU8 } = require('fflate');

const root = path.resolve(__dirname, '..');
const dist = path.join(root, 'dist');
const fixtureText = '保留原文 重点信息 保留原文';
const fixture = {
  id: 'emphasis-fixture', title: '重点标记验收', content: fixtureText,
  category: '收藏', source: 'user-created', provider: 'chatgpt', model: '',
  format: 'cnPrompt', tags: [], createdAt: '2026-10-26T00:00:00Z',
  imageStorageVersion: 2, exampleImageIds: [],
  group: { notes: '', steps: [{ name: '', content: fixtureText }] }
};
function size(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).reduce((sum, item) =>
    sum + (item.isDirectory() ? size(path.join(directory, item.name)) : fs.statSync(path.join(directory, item.name)).size), 0);
}

(async () => {
  const baseline = process.argv.includes('--baseline');
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'promi-emphasis-'));
  const context = await chromium.launchPersistentContext(profile, {
    executablePath: process.env.CHROMIUM_EXECUTABLE || 'C:\\Users\\财源滚滚\\AppData\\Local\\ms-playwright\\chromium-1228\\chrome-win64\\chrome.exe',
    headless: true, viewport: { width: 1100, height: 950 },
    acceptDownloads: true, downloadsPath: path.join(profile, 'downloads'),
    args: [`--disable-extensions-except=${dist}`, `--load-extension=${dist}`]
  });
  try {
    const worker = context.serviceWorkers()[0] || await context.waitForEvent('serviceworker');
    const extensionId = new URL(worker.url()).host;
    const page = await context.newPage();
    page.setDefaultTimeout(12000);
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(`chrome-extension://${extensionId}/options.html?view=app`);
    await page.evaluate(async record => chrome.storage.local.set({
      'prompt-butler-tutorial-seen-v1': true,
      'prompt-butler-default-prompts-version': 1,
      'prompt-butler-theme': 'light',
      'prompt-butler-overlay-ui-state': { activeTab: '收藏', assetFilter: 'all', searchQuery: '', scrollTop: 0, selectedPromptId: null },
      'prompt-butler-favorites': [record]
    }), fixture);
    await page.reload();
    await page.getByRole('button', { name: /重点标记验收.*保留原文/ }).click();
    await page.getByRole('dialog').waitFor();
    await page.waitForTimeout(350);
    const cdp = await context.newCDPSession(page);
    await cdp.send('Performance.enable');
    await cdp.send('HeapProfiler.collectGarbage');
    const metrics = Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map(item => [item.name, item.value]));
    const measurement = {
      phase: baseline ? 'baseline' : 'after', version: JSON.parse(fs.readFileSync(path.join(dist, 'manifest.json'), 'utf8')).version,
      distBytes: size(dist), jsHeapUsedSize: metrics.JSHeapUsedSize, nodes: metrics.Nodes, documents: metrics.Documents,
      scenario: 'fresh isolated extension, one group fixture, open library detail, collect garbage'
    };
    fs.mkdirSync(path.join(root, 'exports'), { recursive: true });
    fs.writeFileSync(path.join(root, `exports/emphasis-${baseline ? 'baseline' : 'after'}.json`), JSON.stringify(measurement, null, 2) + '\n');
    console.log(JSON.stringify(measurement));
    if (baseline) return;
    const panel = page.getByRole('region', { name: '重点标记色板' });
    const reader = page.locator('.prompt-preview-modal .prompt-mark-field > pre').first();
    const saved = () => page.evaluate(async () => (await chrome.storage.local.get('prompt-butler-favorites'))['prompt-butler-favorites']);
    async function selectRange(locator, start, end) {
      await locator.evaluate((element, range) => {
        if (element instanceof HTMLTextAreaElement) {
          element.focus(); element.setSelectionRange(range.start, range.end);
          element.dispatchEvent(new Event('select', { bubbles: true }));
          element.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
          return;
        }
        const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
        const nodes = []; let node; let offset = 0;
        while ((node = walker.nextNode())) { nodes.push({ node, start: offset, end: offset + node.length }); offset += node.length; }
        const first = nodes.find(item => item.end > range.start);
        const last = nodes.find(item => item.end >= range.end);
        const selection = window.getSelection(); const domRange = document.createRange();
        domRange.setStart(first.node, range.start - first.start); domRange.setEnd(last.node, range.end - last.start);
        selection.removeAllRanges(); selection.addRange(domRange);
        element.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
      }, { start, end });
      await page.getByRole("toolbar", { name: "文字格式工具栏" }).getByRole("button", { name: "背景高亮", exact: true }).click();
      await panel.waitFor();
    }
    async function apply() {
      await panel.getByRole('button', { name: '应用标记', exact: true }).click();
      await panel.waitFor({ state: 'hidden' });
    }
    async function rangeInput(label, value) {
      await panel.getByLabel(label, { exact: true }).evaluate((input, next) => {
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, String(next));
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
      }, value);
    }

    for (const theme of ['light', 'dark']) {
      await page.evaluate(theme => chrome.storage.local.set({ 'prompt-butler-theme': theme }), theme);
      await page.setViewportSize({ width: theme === 'light' ? 900 : 420, height: 950 });
      await selectRange(reader, 5, 9);
      const button = panel.getByRole('button', { name: '加粗', exact: true });
      assert.equal(await button.getAttribute('aria-pressed'), 'false');
      await button.click();
      await panel.waitFor({ state: 'hidden' });
      let record = (await saved()).find(item => item.id === fixture.id);
      assert.deepEqual(record.group.steps[0].marks.map(mark => mark.kind), ['bold'], 'Bold must not persist the automatic color preview');
      assert.equal(await reader.locator('[data-mark-bold]').textContent(), '重点信息');
      assert.equal(await reader.locator('[data-mark-bold]').evaluate(el => getComputedStyle(el).fontWeight), '700');
      assert.equal(await reader.textContent(), fixtureText);
      await selectRange(reader, 5, 9);
      assert.equal(await button.getAttribute('aria-pressed'), 'true');
      await page.waitForTimeout(250);
      await page.screenshot({ path: path.join(root, `output/playwright/bold-${theme}.png`) });
      await panel.getByRole('button', { name: '绿色预设', exact: true }).click();
      await apply();
      record = (await saved()).find(item => item.id === fixture.id);
      assert.ok(record.group.steps[0].marks.some(mark => mark.kind === 'bold'));
      assert.ok(record.group.steps[0].marks.some(mark => mark.kind === 'background'));
      await page.reload();
      await reader.waitFor();
      assert.equal(await reader.locator('[data-mark-bold]').evaluate(el => getComputedStyle(el).fontWeight), '700', 'Refresh keeps bold');
      await selectRange(reader, 5, 9);
      await button.click();
      await panel.waitFor({ state: 'hidden' });
      record = (await saved()).find(item => item.id === fixture.id);
      assert.equal(record.group.steps[0].marks.some(mark => mark.kind === 'bold'), false);
      assert.equal(record.group.steps[0].marks.some(mark => mark.kind === 'background'), true, 'Unbold keeps highlight');
      await selectRange(reader, 5, 9);
      await panel.getByRole('button', { name: '清除全部标记', exact: true }).click();
      await panel.waitFor({ state: 'hidden' });
    }
    assert.deepEqual(errors, []);
    console.log('PASS: real-extension bold toggle, active button, theme/narrow view, color coexistence, refresh and plain text');
  } finally {
    await context.close();
    fs.rmSync(profile, { recursive: true, force: true });
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
