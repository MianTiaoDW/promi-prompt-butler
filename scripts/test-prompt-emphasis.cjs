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

    // A live preview must stay visible and must not write to storage until Apply.
    await selectRange(reader, 5, 9);
    await panel.getByRole('button', { name: '绿色预设', exact: true }).click();
    await page.waitForFunction(() => Boolean(document.querySelector('.prompt-mark-field > pre [data-prompt-mark]')));
    let live = await reader.locator('[data-prompt-mark]').filter({ hasText: '重点信息' }).boundingBox();
    let popup = await panel.boundingBox();
    assert(live && popup && (popup.x >= live.x + live.width || popup.x + popup.width <= live.x || popup.y >= live.y + live.height || popup.y + popup.height <= live.y), 'Palette must not cover selected words');
    assert.equal((await saved()).find(item => item.id === fixture.id).group.steps[0].marks, undefined, 'Preview must not persist marks');
    await panel.getByRole('button', { name: '关闭重点色板', exact: true }).click();
    assert.equal(await reader.locator('[data-prompt-mark]').count(), 0, 'Cancel restores original appearance');
    await selectRange(reader, 5, 9);
    const square = panel.locator('.mark-sv-square'); await square.scrollIntoViewIfNeeded();
    const squareRect = await square.boundingBox();
    await page.mouse.move(squareRect.x + 20, squareRect.y + 20); await page.mouse.down();
    await square.evaluate(element => {
      const rect = element.getBoundingClientRect();
      for(let i=0;i<100;i++) element.dispatchEvent(new PointerEvent('pointermove', { pointerId: 1, bubbles: true, clientX: rect.left + rect.width * i / 100, clientY: rect.top + rect.height / 2 }));
      element.dispatchEvent(new PointerEvent('pointermove', { pointerId: 1, bubbles: true, clientX: rect.left, clientY: rect.top + rect.height / 2 }));
    });
    await page.mouse.up();
    await page.waitForFunction(() => document.querySelector('[aria-label="颜色 HEX"]')?.value === '#808080');
    assert.equal((await saved()).find(item => item.id === fixture.id).group.steps[0].marks, undefined, 'Dragging only previews');
    await panel.getByRole('button', { name: '关闭重点色板', exact: true }).click();

    await selectRange(reader, 5, 9);
    assert.equal(await panel.getByRole('button', { name: /预设$/ }).count(), 10);
    await panel.getByRole('button', { name: '黄色预设', exact: true }).click();
    await rangeInput('背景不透明度', 55);
    await apply();
    let record = (await saved()).find(item => item.id === fixture.id);
    assert.deepEqual(record.group.steps[0].marks.map(({ start, end, kind, opacity }) => ({ start, end, kind, opacity })), [{ start: 5, end: 9, kind: 'background', opacity: .55 }]);

    await selectRange(reader, 5, 9);
    await panel.getByRole('button', { name: '文字颜色', exact: true }).click();
    await panel.getByRole('button', { name: '蓝色预设', exact: true }).click();
    await apply();
    record = (await saved()).find(item => item.id === fixture.id);
    assert.deepEqual(record.group.steps[0].marks.map(item => item.kind).sort(), ['background', 'text'], 'Foreground and background coexist');
    assert.equal(await reader.innerText(), fixtureText);
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.getByRole('button', { name: '复制第 1 步', exact: true }).click();
    assert.equal(await page.evaluate(() => navigator.clipboard.readText()), fixtureText, 'Copy contains only unchanged original text');

    // Select only the second occurrence: identical strings must not share a mark.
    await selectRange(reader, 10, 14);
    await panel.getByRole('button', { name: '背景高亮', exact: true }).click();
    await panel.getByLabel('颜色 HEX', { exact: true }).fill('#123456');
    await rangeInput('色相', 240);
    await panel.getByLabel('饱和度', { exact: true }).fill('65');
    await panel.getByLabel('明度', { exact: true }).fill('80');
    await panel.getByRole('button', { name: '夜间', exact: true }).click();
    await panel.getByLabel('颜色 HEX', { exact: true }).fill('#654321');
    await panel.getByRole('button', { name: '日间', exact: true }).click();
    await panel.getByLabel('颜色 HEX', { exact: true }).fill('#123456');
    await rangeInput('背景不透明度', 60);
    await apply();
    record = (await saved()).find(item => item.id === fixture.id);
    const duplicateMark = record.group.steps[0].marks.find(item => item.start === 10);
    assert.equal(duplicateMark.light, '#123456'); assert.equal(duplicateMark.dark, '#654321');
    assert.equal(duplicateMark.opacity, .6);
    assert(!record.group.steps[0].marks.some(item => item.start < 4), 'First repeated substring remains unmarked');

    // Explicitly choose an unreadable foreground on an unmarked light surface.
    await selectRange(reader, 0, 4);
    await panel.getByRole('button', { name: '文字颜色', exact: true }).click();
    await panel.getByLabel('颜色 HEX', { exact: true }).fill('#ffffff');
    assert.match(await panel.getByRole('status').innerText(), /当前颜色不易阅读/);
    fs.mkdirSync(path.join(root, 'output/playwright'), { recursive: true });
    await page.screenshot({ path: path.join(root, 'output/playwright/emphasis-low-contrast.png') });
    await panel.getByRole('button', { name: '调整为清晰颜色', exact: true }).click();
    assert.match(await panel.getByRole('status').innerText(), /清晰可读/);
    await panel.getByRole('button', { name: '关闭重点色板', exact: true }).click();
    await page.reload();
    await page.getByRole('dialog').waitFor();
    assert.equal(await reader.innerText(), fixtureText);
    assert((await reader.locator('[data-prompt-mark]').count()) >= 2, 'Saved marks render after reload');
    await selectRange(reader, 10, 14);
    await panel.getByRole('button', { name: '清除全部标记', exact: true }).click();
    await panel.waitFor({ state: 'hidden' });
    record = (await saved()).find(item => item.id === fixture.id);
    assert(record.group.steps[0].marks.every(item => item.start === 5), 'Clear only affects selected range');
    await page.setViewportSize({ width: 420, height: 850 });
    for (const theme of ['dark', 'light']) {
      await page.evaluate(theme => chrome.storage.local.set({ 'prompt-butler-theme': theme }), theme);
      await selectRange(reader, 5, 9);
      const bounds = await panel.boundingBox();
      assert(bounds.x >= 0 && bounds.x + bounds.width <= 421 && bounds.y >= 0 && bounds.y + bounds.height <= 851, `${theme} palette fits 420px viewport`);
      await page.screenshot({ path: path.join(root, `output/playwright/emphasis-${theme}-420.png`) });
      await page.keyboard.press('Escape');
      await panel.waitFor({ state: 'hidden' });
      assert(await page.getByRole('dialog').isVisible(), 'Escape dismisses only the color panel');
    }
    await page.setViewportSize({ width: 1100, height: 950 });
    await page.getByRole('button', { name: '关闭预览', exact: true }).click();
    await page.getByRole('button', { name: '添加提示词', exact: true }).click();
    const create = page.getByRole('dialog', { name: '新建提示词组', exact: true });
    await create.getByLabel('提示词组标题', { exact: true }).fill('可编辑重点验收');
    await create.getByLabel('备注（可选）', { exact: true }).fill('测试备注');
    await create.getByLabel('第 1 步名称', { exact: true }).fill('第一阶段');
    const editor = create.getByLabel('第 1 步正文', { exact: true });
    await editor.fill(fixtureText);
    await selectRange(editor, 5, 9);
    await panel.locator('.mark-sv-square').click({ position: { x: 100, y: 40 } });
    assert(await create.isVisible(), 'SV click inside data-enter-confirm must not save the dialog');
    assert(!(await saved()).some(item => item.title === '可编辑重点验收'), 'SV changes remain unsaved draft');
    await panel.getByRole('button', { name: '绿色预设', exact: true }).click();
    await apply();
    await selectRange(editor, 5, 9);
    await panel.getByRole('button', { name: '文字颜色', exact: true }).click();
    await panel.getByRole('button', { name: '蓝色预设', exact: true }).click();
    await apply();
    const mirrorAlignment = await editor.evaluate(input => {
      const mirror = input.parentElement.querySelector('.prompt-mark-mirror pre');
      const a = getComputedStyle(input), b = getComputedStyle(mirror);
      const ra = input.getBoundingClientRect(), rb = mirror.getBoundingClientRect();
      return { font: [a, b].map(style => ({ family: style.fontFamily, size: style.fontSize, weight: style.fontWeight, lineHeight: style.lineHeight, letterSpacing: style.letterSpacing })), padding: [a.padding, b.padding], textTop: [ra.top + parseFloat(a.borderTopWidth) + parseFloat(a.paddingTop), rb.top + parseFloat(b.borderTopWidth) + parseFloat(b.paddingTop)] };
    });
    assert.deepEqual(mirrorAlignment.font[0], mirrorAlignment.font[1], 'Mirror matches textarea font');
    assert.equal(mirrorAlignment.padding[0], mirrorAlignment.padding[1], 'Mirror matches textarea padding');
    assert(Math.abs(mirrorAlignment.textTop[0] - mirrorAlignment.textTop[1]) <= 1, 'Mirror text top aligns within one pixel');
    assert.equal(await editor.inputValue(), fixtureText, 'Textarea original value stays plain');
    await create.getByRole('button', { name: '新增提示词步骤', exact: true }).click();
    const secondEditor = create.getByLabel('第 2 步正文', { exact: true });
    await secondEditor.fill('第二段正文');
    await selectRange(secondEditor, 1, 4);
    await panel.getByRole('button', { name: '紫色预设', exact: true }).click();
    await apply();
    await create.getByRole('button', { name: '保存提示词组', exact: true }).click();
    await create.waitFor({ state: 'hidden' });
    const created = (await saved()).find(item => item.title === '可编辑重点验收');
    assert.equal(created.group.steps[0].marks[0].start, 5);
    assert.equal(created.group.steps[0].content, fixtureText);
    assert.equal(created.group.steps[0].marks.length, 2);

    // Chrome's downloads API may omit the frame-specific Playwright event.
    const downloadPromise = page.waitForEvent('download', { timeout: 2000 }).catch(() => null);
    await page.getByRole('button', { name: '导出提示词 ZIP', exact: true }).click();
    const download = await downloadPromise;
    const zipPath = path.join(profile, 'emphasis-backup.zip');
    if (download) await download.saveAs(zipPath);
    else {
      const nativeDownload = await page.waitForFunction(async () => {
        const items = await chrome.downloads.search({ state: 'complete' });
        return items.find(item => item.filename.endsWith('.zip')) || false;
      });
      fs.copyFileSync((await nativeDownload.jsonValue()).filename, zipPath);
    }
    const exported = JSON.parse(strFromU8(unzipSync(fs.readFileSync(zipPath))['prompts.json']));
    assert.deepEqual(exported.favorites.find(item => item.id === created.id).group, created.group, 'ZIP preserves all annotations');
    const chooserPromise = page.waitForEvent('filechooser');
    await page.getByRole('button', { name: '导入提示词', exact: true }).click();
    await (await chooserPromise).setFiles(zipPath);
    await page.getByRole('button', { name: '覆盖导入', exact: true }).click();
    await page.getByRole('button', { name: '确认覆盖', exact: true }).click();
    await page.getByRole('dialog').waitFor({ state: 'hidden' });
    assert.deepEqual((await saved()).find(item => item.id === created.id).group, created.group, 'Actual ZIP import restores annotations');
    const generated = {
      ...fixture, id: 'generated-emphasis-fixture', title: '生成提示词重点验收', source: 'ai-generated', group: undefined,
      marks: [{ start: 0, end: 4, kind: 'text', light: '#2459a9', dark: '#a6c8ff' }],
      contentVariants: { cnPrompt: fixtureText, enPrompt: 'English emphasis sample' },
      variantMarks: { cnPrompt: [{ start: 0, end: 4, kind: 'text', light: '#2459a9', dark: '#a6c8ff' }], enPrompt: [{ start: 8, end: 16, kind: 'text', light: '#256b38', dark: '#91d5a4' }] }
    };
    await page.evaluate(async generated => {
      const data = (await chrome.storage.local.get('prompt-butler-favorites'))['prompt-butler-favorites'];
      await chrome.storage.local.set({ 'prompt-butler-favorites': [...data, generated] });
    }, generated);
    await page.getByRole('button', { name: /生成提示词重点验收/ }).click();
    await selectRange(reader, 5, 9);
    await panel.getByRole('button', { name: '黄色预设', exact: true }).click();
    await apply();
    const markedGenerated = (await saved()).find(item => item.id === generated.id);
    assert.equal(markedGenerated.marks.length, 2);
    assert.deepEqual(markedGenerated.variantMarks.cnPrompt, markedGenerated.marks, 'Primary plain-record marks and variant marks stay synchronized');
    assert.deepEqual(markedGenerated.variantMarks.enPrompt, generated.variantMarks.enPrompt, 'Annotating primary variant preserves other variant marks');
    await page.getByRole('button', { name: '发送到图像工坊', exact: true }).click();
    const workspace = await page.evaluate(async () => (await chrome.storage.local.get('prompt-butler-image-workspace'))['prompt-butler-image-workspace']);
    assert.equal(workspace.prompt, markedGenerated.content);
    assert.deepEqual(workspace.marks, markedGenerated.marks, 'Existing AI-generated detail handoff preserves newly persisted annotations');
    await page.waitForFunction(text => document.querySelector('[aria-label="图片提示词"]')?.value === text, markedGenerated.content);
    assert.equal(await page.getByLabel('图片提示词', { exact: true }).inputValue(), markedGenerated.content);

    // Seed a completed background task: no provider configuration or API call.
    await page.evaluate(async fixtureText => chrome.storage.local.set({
      'prompt-butler-prompt-task': {
        status: 'success', taskId: 'emphasis-task-fixture', workerSessionId: null,
        startedAt: '2026-10-26T01:00:00Z', finishedAt: '2026-10-26T01:00:01Z', errorMessage: null,
        result: { ok: true, provider: 'chatgpt', model: 'fixture', generatedAt: '2026-10-26T01:00:00Z', output: {
          cnPrompt: fixtureText, enPrompt: 'test text',
          structuredPrompt: { characterCore: { identity: 'a', appearance: 'b', personality: 'c' }, sceneDesign: { environment: 'x', lighting: 'x', camera: 'x', action: 'x' }, styleDirectives: [], negativePrompt: [], usageNotes: [] }
        } }
      }
    }), fixtureText);
    await page.getByRole('radio', { name: '创作', exact: true }).click();
    const requirement = page.getByLabel('创意描述', { exact: true });
    await requirement.fill(fixtureText);
    await selectRange(requirement, 0, 4);
    await panel.getByRole('button', { name: '橙色预设', exact: true }).click();
    await apply();
    const creatorOutput = page.locator('pre.creator-output-content').first();
    assert.equal(await creatorOutput.innerText(), fixtureText);
    await selectRange(creatorOutput, 5, 9);
    await panel.getByRole('button', { name: '绿色预设', exact: true }).click();
    await apply();
    const creatorWorkspace = () => page.evaluate(async () => (await chrome.storage.local.get('prompt-butler-workspace'))['prompt-butler-workspace']);
    const beforeReload = await creatorWorkspace();
    assert.deepEqual(beforeReload.requirementMarks.map(mark => [mark.start, mark.end]), [[0, 4]]);
    assert.deepEqual(beforeReload.resultMarks.variants.cnPrompt.map(mark => [mark.start, mark.end]), [[5, 9]]);
    await page.reload();
    await creatorOutput.waitFor();
    assert.equal(await creatorOutput.innerText(), fixtureText);
    assert.deepEqual((await creatorWorkspace()).resultMarks, beforeReload.resultMarks, 'Generated result annotations survive reload');
    assert.deepEqual((await creatorWorkspace()).requirementMarks, beforeReload.requirementMarks, 'Creative description annotations survive reload');
    await page.evaluate(() => window.getSelection().removeAllRanges());
    await creatorOutput.click();
    const creatorEditor = page.locator('textarea.creator-output-editor').first();
    await creatorEditor.fill('新' + fixtureText);
    await page.getByRole('button', { name: '确认', exact: true }).click();
    await creatorEditor.waitFor({ state: 'hidden' });
    await page.reload();
    await creatorOutput.waitFor();
    assert.equal(await creatorOutput.innerText(), '新' + fixtureText, 'Confirmed generated text survives task restoration');
    assert.deepEqual((await creatorWorkspace()).resultMarks.variants.cnPrompt.map(mark => [mark.start, mark.end]), [[6, 10]], 'Generated edit shifts saved annotation offsets');
    assert.equal(await creatorOutput.locator('[data-prompt-mark]').innerText(), '重点信息');
    assert.deepEqual(errors, [], 'Extension must not throw browser errors');
    console.log('PASS: isolated extension selection, layered colors, exact duplicate ranges, HSV/HEX/theme/opacity, contrast repair, clipboard, reload/clear, Escape, narrow themes, draft SV no-save, mirror alignment, two-step ZIP roundtrip, AI-generated image handoff, creative description and edited generated result restoration');
  } finally {
    await context.close();
    assert(path.resolve(profile).startsWith(path.resolve(os.tmpdir()) + path.sep + 'promi-emphasis-'));
    fs.rmSync(profile, { recursive: true, force: true });
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
