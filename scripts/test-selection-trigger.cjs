// Isolated real-extension acceptance test. Requires Playwright through NODE_PATH.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { chromium } = require('playwright');
const { unzipSync, strFromU8 } = require('fflate');

const root = path.resolve(__dirname, '..');
const dist = path.join(root, 'dist');
const fixtureText = '保留原文 重点信息 保留原文\n第二行：这是用于跨行拖选的正文，不应该因为在框外松开而漏掉。\n第三行：原文保持不变。';
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
      await page.getByRole("toolbar", { name: "文字格式工具栏" }).waitFor();
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

    const toolbar = page.getByRole('toolbar', { name: '文字格式工具栏' });
    // Model a selection whose mouse release is delivered to the document, not <pre>.
    async function releaseOutside(start, end) {
      await reader.evaluate((element, { start, end }) => {
        element.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 1 }));
        const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT), nodes = [];
        let node, offset = 0;
        while ((node = walker.nextNode())) { nodes.push({ node, start: offset, end: offset + node.length }); offset += node.length; }
        const first = nodes.find(item => item.end > start), last = nodes.find(item => item.end >= end);
        const range = document.createRange(); range.setStart(first.node, start - first.start); range.setEnd(last.node, end - last.start);
        const selection = window.getSelection(); selection.removeAllRanges(); selection.addRange(range);
        document.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 1 }));
        document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
      }, { start, end });
      await toolbar.waitFor();
    }
    await releaseOutside(5, 9);
    await toolbar.getByRole('button', { name: '加粗', exact: true }).click();
    await toolbar.waitFor({ state: 'hidden' });
    assert.equal((await saved()).find(item => item.id === fixture.id).group.steps[0].marks[0].kind, 'bold');
    assert.equal(await reader.textContent(), fixtureText, 'Reading formatting must never change body text');
    // Real mouse drag across lines and release just outside the rendered text box.
    const points = await reader.evaluate(element => {
      const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT), node = walker.nextNode();
      const range = document.createRange(); range.setStart(node, 1); range.setEnd(node, 2);
      const start = range.getBoundingClientRect(), end = element.getBoundingClientRect();
      return { x: start.left + 1, y: start.top + start.height / 2, endX: end.right + 4, endY: end.bottom + 4 };
    });
    await page.mouse.move(points.x, points.y); await page.mouse.down();
    await page.mouse.move(points.endX, points.endY, { steps: 12 }); await page.mouse.up();
    await toolbar.waitFor();
    assert.equal(await page.getByRole('toolbar', { name: '文字格式工具栏' }).count(), 1);
    await toolbar.getByRole('button', { name: '关闭文字工具栏', exact: true }).click();
    // A browser selectionchange, without mouseup inside the reading field.
    await page.getByRole('button', { name: '复制第 1 步', exact: true }).focus();
    await reader.focus();
    await reader.evaluate(element => { const node = document.createTreeWalker(element, NodeFilter.SHOW_TEXT).nextNode(); const range = document.createRange(); range.setStart(node, 0); range.setEnd(node, 2); const selection = window.getSelection(); selection.removeAllRanges(); selection.addRange(range); });
    await toolbar.waitFor(); await page.keyboard.press('Escape'); await toolbar.waitFor({ state: 'hidden' });
    await page.getByRole('button', { name: '编辑第 1 步', exact: true }).click();
    const input = page.getByRole('textbox', { name: '步骤正文', exact: true });
    await input.focus(); await page.keyboard.press('Control+Home'); await page.keyboard.down('Shift');
    await page.keyboard.press('ArrowRight'); await page.keyboard.press('ArrowRight'); await page.keyboard.up('Shift');
    await toolbar.waitFor();
    await toolbar.getByRole('button', { name: '加粗', exact: true }).click();
    await toolbar.waitFor({ state: 'hidden' });
    assert.equal((await saved()).find(item => item.id === fixture.id).group.steps[0].marks.length, 1, 'Editable formatting stays in draft until Save');
    await page.getByRole('button', { name: '保存', exact: true }).click();
    await reader.waitFor();
    const final = (await saved()).find(item => item.id === fixture.id);
    assert(final.group.steps[0].marks.some(mark => mark.start === 0 && mark.end === 2 && mark.kind === 'bold'));
    assert.equal(final.group.steps[0].content, fixtureText);
    assert.deepEqual(errors, []);
    console.log('PASS: outside-release reading selection, native cross-line mouse drag, reading selectionchange and keyboard editing selection, direct read save and draft edit save');
  } finally { await context.close(); fs.rmSync(profile, { recursive: true, force: true }); }
})().catch(error => { console.error(error); process.exitCode = 1; });
