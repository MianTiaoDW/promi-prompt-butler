// After npm run build; Playwright must be available through NODE_PATH.
const assert = require("node:assert/strict");
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright");

(async () => {
  const dist = path.resolve(__dirname, "../dist");
  const server = http.createServer((req, res) => {
    const file = path.resolve(dist, `.${new URL(req.url, "http://localhost").pathname}`);
    if (!file.startsWith(dist + path.sep) || !fs.existsSync(file)) { res.writeHead(404); res.end(); return; }
    res.setHeader("Content-Type", file.endsWith(".js") ? "application/javascript" : file.endsWith(".css") ? "text/css" : file.endsWith(".html") ? "text/html" : "image/png");
    fs.createReadStream(file).pipe(res);
  });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  const browser = await chromium.launch({ headless: true, channel: "chrome" });
  try {
    for (const theme of ["light", "dark"]) {
      const context = await browser.newContext({ viewport: { width: 560, height: 950 } });
      await context.addInitScript(({ theme }) => {
        const initial = {
          "prompt-butler-theme": theme,
          "prompt-butler-default-prompts-version": 1,
          "prompt-butler-folders": [{ id: "folder", name: "个人常用", category: "收藏", order: 0 }],
          "prompt-butler-favorites": [{ id: "demo", title: "测试提示词", content: "一只星空下的小熊", category: "收藏", tags: [], folderIds: ["folder"], isFavorite: false, createdAt: "2026-10-13", provider: "chatgpt", model: "", format: "cnPrompt" }]
        };
        let data = JSON.parse(localStorage.getItem("test-storage") || JSON.stringify(initial));
        const listeners = [];
        const area = {
          get: async key => ({ [key]: data[key] }),
          set: async values => {
            const changes = {};
            for (const key in values) changes[key] = { oldValue: data[key], newValue: values[key] };
            Object.assign(data, values); localStorage.setItem("test-storage", JSON.stringify(data));
            listeners.forEach(listener => listener(changes, "local"));
          }
        };
        window.testRequests = [];
        window.chrome = {
          storage: { local: area, session: area, onChanged: { addListener: fn => listeners.push(fn), removeListener: fn => { const i = listeners.indexOf(fn); if (i >= 0) listeners.splice(i, 1); } } },
          runtime: {
            getURL: name => location.origin + "/" + name,
            sendNativeMessage: async () => ({ ok: false, message: "Test has no native access" }),
            sendMessage: (message, callback) => { window.testRequests.push(message.type); if (message.type === "open-options-page" && message.tutorial) window.open(location.origin + "/options.html?tutorial=settings", "_blank"); callback?.({ ok: true, images: [], assets: [], records: [], totalBytes: 0, usage: { usedBytes: 0, limitBytes: 30 * 1024 * 1024, imageCount: 0 } }); },
            onMessage: { addListener() {}, removeListener() {} }
          }
        };
      }, { theme });
      const page = await context.newPage();
      const errors = [];
      page.on("pageerror", error => errors.push(error.message));
      if (!process.argv.includes("--settings-only")) {
      await page.goto(`http://127.0.0.1:${server.address().port}/options.html?view=app`);
      await page.getByRole("heading", { name: "欢迎使用 Promi" }).waitFor();
      await page.getByRole("button", { name: "从头开始", exact: true }).click();
      for (let i = 0; i < 21; i++) {
        await page.waitForTimeout(450);
        const metrics = await page.evaluate(() => {
          const panel = document.querySelector(".fluxora-shell").getBoundingClientRect();
          const bubble = document.querySelector(".tutorial-bubble").getBoundingClientRect();
          const hole = document.querySelector(".tutorial-spotlight");
          return { inside: bubble.left >= panel.left && bubble.right <= panel.right + 1 && bubble.top >= panel.top && bubble.bottom <= panel.bottom + 1, hasTarget: Boolean(hole), requests: window.testRequests };
        });
        assert(metrics.inside, `${theme} step ${i + 1}: bubble outside panel`);
        assert(metrics.hasTarget, `${theme} step ${i + 1}: missing target`);
        if (i === 0) {
          fs.mkdirSync(path.resolve(__dirname, "../output/playwright"), { recursive: true });
          await page.screenshot({ path: path.resolve(__dirname, `../output/playwright/tutorial-${theme}.png`) });
        }
        if (i === 1) {
          const [settingsPage] = await Promise.all([page.waitForEvent("popup"), page.getByRole("button", { name: "进入设置教程" }).click()]);
          await settingsPage.getByRole("heading", { name: "先选你要用的平台" }).waitFor();
          assert(settingsPage.url().includes("tutorial=settings"));
          await settingsPage.close();
        } else await page.getByRole("button", { name: i === 20 ? "完成教程" : "下一步", exact: true }).click();
      }
      await page.reload();
      await page.waitForTimeout(600);
      assert.equal(await page.locator(".new-user-tutorial").count(), 0, "Completed tutorial must not start again");
      await page.getByRole("button", { name: "打开新手教程" }).click();
      await page.getByRole("button", { name: /收藏夹/ }).click();
      await page.waitForTimeout(500);
      assert((await page.locator(".tutorial-progress").textContent()).includes("收藏夹"));
      await page.getByRole("button", { name: "跳过引导" }).click();
      await page.reload();
      await page.waitForTimeout(500);
      assert.equal(await page.locator(".new-user-tutorial").count(), 0);
      await page.setViewportSize({ width: 420, height: 780 });
      await page.getByRole("button", { name: "打开新手教程" }).click();
      const headerFits = await page.evaluate(() => {
        const parent = document.querySelector(".fluxora-titlebar").getBoundingClientRect();
        const controls = document.querySelector(".workspace-system-controls").getBoundingClientRect();
        return controls.right <= parent.right && controls.left >= parent.left;
      });
      assert(headerFits, "Compact header controls must fit");
      await page.getByRole("button", { name: "从头开始", exact: true }).click();
      for (let i = 0; i < 21; i++) {
        await page.waitForTimeout(450);
        const fits = await page.evaluate(() => {
          const panel = document.querySelector(".fluxora-shell").getBoundingClientRect();
          const bubble = document.querySelector(".tutorial-bubble").getBoundingClientRect();
          return bubble.left >= panel.left && bubble.right <= panel.right + 1 && bubble.top >= panel.top && bubble.bottom <= panel.bottom + 1;
        });
        assert(fits, `${theme} 420px step ${i + 1}: bubble outside panel`);
        if (i === 1) {
          const [settingsPage] = await Promise.all([page.waitForEvent("popup"), page.getByRole("button", { name: "进入设置教程" }).click()]);
          await settingsPage.getByRole("heading", { name: "先选你要用的平台" }).waitFor();
          await settingsPage.close();
        } else await page.getByRole("button", { name: i === 20 ? "完成教程" : "下一步", exact: true }).click();
      }
      assert.equal(errors.length, 0, errors.join("\n"));
      assert(!(await page.evaluate(() => window.testRequests)).some(type => /generate|download/.test(type)), "Tutorial must not generate or download");
      }
      await page.goto(`http://127.0.0.1:${server.address().port}/options.html`);
      await page.waitForTimeout(500);
      assert.equal(errors.length, 0, errors.join("\n"));
      for (const label of ["服务商", "图像比例", "分辨率", "生成数量"]) {
        const trigger = page.getByRole("button", { name: label, exact: true });
        await trigger.click();
        const menu = page.getByRole("listbox", { name: label, exact: true });
        await menu.waitFor();
        assert((await menu.getAttribute("class")).includes("image-parameter-menu"));
        if (label === "服务商") {
          assert.equal(await menu.getByRole("link").count(), 10);
          fs.mkdirSync(path.resolve(__dirname, "../output/playwright"), { recursive: true });
          await page.screenshot({ path: path.resolve(__dirname, `../output/playwright/settings-provider-menu-${theme}.png`) });
        }
        const option = menu.getByRole("option").last();
        const text = label === "服务商" ? await option.locator(".provider-option-name").textContent() : await option.textContent();
        await option.click();
        assert((await trigger.textContent()).includes(text));
        await trigger.click();
        await page.keyboard.press("Escape");
        assert.equal(await menu.count(), 0);
      }
      const model = page.getByRole("combobox").first();
      await model.fill("my-custom-model");
      assert.equal(await model.inputValue(), "my-custom-model", "Manual model IDs must remain supported");
      assert((await page.locator(".model-combobox-menu").getAttribute("class")).includes("image-parameter-menu"));
      await page.keyboard.press("Escape");
      assert.equal(await page.locator(".model-combobox-menu").count(), 0);
      await context.route("https://**", route => route.fulfill({ status: 200, contentType: "text/html", body: "<h1>Mock official API console</h1>" }));
      const providerTrigger = page.getByRole("button", { name: "服务商", exact: true });
      for (const label of ["DeepSeek", "火山引擎", "Kimi"]) {
        await providerTrigger.click();
        const before = await providerTrigger.textContent();
        const link = page.getByRole("link", { name: `${label}官方 API 平台`, exact: true });
        const href = await link.getAttribute("href");
        const [popup] = await Promise.all([page.waitForEvent("popup"), link.click()]);
        await popup.waitForURL(href);
        assert.equal(await providerTrigger.textContent(), before, "Official link must not switch provider");
        await popup.close();
        await page.keyboard.press("Escape");
      }
      await providerTrigger.click();
      assert.equal(await page.getByRole("link", { name: /中转站/ }).count(), 0, "Relay has no fixed official site");
      await page.keyboard.press("Escape");
      for (const width of [420, 1100]) {
        await page.setViewportSize({ width, height: 850 });
        await page.getByRole("button", { name: "打开设置教程" }).click();
        const configBefore = await page.evaluate(() => localStorage.getItem("test-storage"));
        for (let i = 0; i < 10; i++) {
          await page.waitForTimeout(400);
          const metrics = await page.evaluate(() => {
            const bubble = document.querySelector(".tutorial-bubble").getBoundingClientRect();
            return { target: Boolean(document.querySelector(".tutorial-spotlight")), fits: bubble.left >= 0 && bubble.right <= innerWidth + 1 && bubble.top >= 0 && bubble.bottom <= innerHeight + 1 };
          });
          assert(metrics.target && metrics.fits, `${theme} settings step ${i + 1}, width ${width}`);
          if (i === 0) {
            await providerTrigger.click();
            await page.getByRole("link", { name: "DeepSeek官方 API 平台", exact: true }).waitFor();
            await page.waitForTimeout(200);
            if (width === 1100) await page.screenshot({ path: path.resolve(__dirname, `../output/playwright/settings-guide-${theme}.png`) });
            await providerTrigger.click();
          }
          await page.getByRole("button", { name: i === 9 ? "完成教程" : "下一步", exact: true }).click();
        }
        const beforeData = JSON.parse(configBefore || "{}");
        const afterData = await page.evaluate(() => JSON.parse(localStorage.getItem("test-storage")));
        assert.deepEqual(afterData["prompt-butler-extension-settings"], beforeData["prompt-butler-extension-settings"], "Guide must not save/change config");
      }
      assert.equal(errors.length, 0, errors.join("\n"));
      assert(!(await page.evaluate(() => window.testRequests)).some(type => /generate|download|provider:test-connection|provider:detect-models/.test(type)), "Guide must not trigger model/provider calls");
      await context.close();
    }
    console.log(process.argv.includes("--settings-only")
      ? "PASS: official links do not switch providers; settings guide 10 steps at 420/1100px in both themes; manual model IDs; no provider calls"
      : "PASS: main tutorial and real settings-page handoff; official links preserve selection; settings guide in both themes and widths; no provider calls");
  } finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
})().catch(error => { console.error(error); process.exitCode = 1; });
