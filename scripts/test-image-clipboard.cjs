const assert = require("node:assert/strict");
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright");
const sharp = require("sharp");

(async () => {
  const images = Object.fromEntries(await Promise.all([["a", "#ef5577"], ["b", "#246bff"]].map(async ([id, background]) => [id, `data:image/${id === "a" ? "jpeg" : "webp"};base64,` + (await sharp({ create: { width: 160, height: 120, channels: 3, background } })[id === "a" ? "jpeg" : "webp"]().toBuffer()).toString("base64")])));
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
      const themeImages = theme === "dark" ? { ...images, a: "data:image/png;base64," + (await sharp({ create: { width: 160, height: 120, channels: 3, background: "#ef5577" } }).png().toBuffer()).toString("base64") } : images;
      const context = await browser.newContext({ permissions: ["clipboard-read", "clipboard-write"], viewport: { width: 560, height: 950 } });
      await context.addInitScript(({ theme, images }) => {
        const initial = {
          "prompt-butler-theme": theme, "prompt-butler-tutorial-seen-v1": true,
          "prompt-butler-default-prompts-version": 1,
          "prompt-butler-folders": [{ id: "one", name: "测试夹", scope: "收藏", order: 0 }, { id: "two", name: "保留夹", scope: "收藏", order: 1 }],
          "prompt-butler-overlay-ui-state": { activeTab: "收藏", assetFilter: "all", searchQuery: "", scrollTop: 0, selectedPromptId: null },
          "prompt-butler-favorites": [{ id: "demo", title: "示例图测试", content: "测试内容", category: "收藏/测试夹", folderIds: ["one", "two"], isFavorite: true, tags: [], exampleImageIds: ["a", "b"], imageStorageVersion: 2, createdAt: "2026-10-19", provider: "chatgpt", format: "cnPrompt" }]
        };
        const data = JSON.parse(localStorage.getItem("fixture") || JSON.stringify(initial));
        const listeners = [];
        const area = { get: async key => ({ [key]: data[key] }), set: async values => {
          const changes = Object.fromEntries(Object.entries(values).map(([key, value]) => [key, { oldValue: data[key], newValue: value }]));
          Object.assign(data, values); localStorage.setItem("fixture", JSON.stringify(data)); listeners.forEach(fn => fn(changes, "local"));
        } };
        window.deletedImages = [];
        window.imageDataUrls = images;
        window.fixtureData = data;
        window.chrome = {
          storage: { local: area, session: area, onChanged: { addListener: fn => listeners.push(fn), removeListener: fn => { const i = listeners.indexOf(fn); if (i >= 0) listeners.splice(i, 1); } } },
          runtime: { getURL: name => location.origin + "/" + name, sendNativeMessage: async () => ({ ok: false }), onMessage: { addListener() {}, removeListener() {} },
            sendMessage: (message, callback) => {
              if (message.type === "example-image:get") { callback({ ok: true, image: { id: message.payload.imageId, dataUrl: images[message.payload.imageId] } }); return; }
              if (message.type === "example-image:delete") window.deletedImages.push(message.payload.imageId);
              if (message.type === "storage:merge-collection") { const {key, after} = message.payload; void area.set({ [key]: after }).then(() => callback({ ok: true, records: after })); return; }
              callback?.({ ok: true, records: [], assets: [], images: [] });
            }
          }
        };
      }, { theme, images: themeImages });
      const page = await context.newPage();
      page.setDefaultTimeout(10000);
      const errors = [];
      page.on("pageerror", error => errors.push(error.message));
      await page.goto(`http://127.0.0.1:${server.address().port}/options.html?view=app`);
      async function verifyCopy(label) {
        const dialog = page.getByRole("dialog", { name: "图片大图预览", exact: true });
        await dialog.getByRole("button", { name: "复制", exact: true }).click();
        await page.getByText("已复制到剪贴板~", { exact: true }).first().waitFor();
        await page.waitForFunction(() => !document.querySelector(".image-preview-copy")?.disabled);
        const bytes = await page.evaluate(async () => {
          const items = await navigator.clipboard.read();
          const blob = await items[0].getType("image/png");
          return Array.from(new Uint8Array(await blob.arrayBuffer()));
        });
        const info = await sharp(Buffer.from(bytes)).metadata();
        assert.equal(info.format, "png", label);
        assert.equal(info.width, 160, label);
        assert.equal(info.height, 120, label);
        const pixel = await sharp(Buffer.from(bytes)).removeAlpha().raw().toBuffer();
        const expected = label.includes("WebP") ? [36, 107, 255] : [239, 85, 119];
        assert.ok(expected.every((value, i) => Math.abs(pixel[i] - value) <= 4), "Copied pixels must match the selected image");
      }
      await page.locator(".prompt-card-image-preview").click();
      await verifyCopy("JPEG/PNG from card preview");
      await page.getByRole("button", { name: "关闭图片预览", exact: true }).click();
      await page.getByRole("button", { name: /示例图测试.*测试内容/ }).click();
      const cases = page.locator(".prompt-preview-cases");
      assert.equal(await cases.getByRole("button", { name: "设为示例图", exact: true }).count(), 2, "Each example needs an explicit cover button");
      const view = cases.getByRole("button", { name: "查看示例图 2", exact: true });
      await page.waitForFunction(() => [...document.querySelectorAll('.prompt-example-view img')].filter(img => img.naturalWidth > 0).length === 2);
      await view.hover();
      await page.waitForFunction(() => getComputedStyle(document.querySelectorAll('.prompt-example-eye')[1]).opacity === '1');
      assert.equal(await view.locator(".prompt-example-eye").evaluate(el => getComputedStyle(el).opacity), "1");
      await view.dblclick();
      await page.getByRole("dialog", { name: "图片大图预览", exact: true }).waitFor();
      await verifyCopy("WebP from prompt details");
      assert.deepEqual(await page.evaluate(() => window.deletedImages), [], "Double click must never delete an image");
      await page.getByRole("button", { name: "关闭图片预览", exact: true }).click();
      await cases.getByRole("button", { name: "设为示例图", exact: true }).nth(1).click();
      await page.waitForFunction(() => window.fixtureData["prompt-butler-favorites"][0].exampleImageIds.join() === "b,a");
      await page.getByRole("button", { name: "关闭预览", exact: true }).click();
      await page.waitForFunction(async () => {
        const src = document.querySelector('.prompt-card-image-preview img')?.src;
        if (!src) return false;
        const bytes = new Uint8Array(await (await fetch(src)).arrayBuffer());
        return btoa(String.fromCharCode(...bytes)) === window.imageDataUrls.b.split(',')[1];
      });
      await page.reload();
      await page.getByRole("button", { name: /示例图测试.*测试内容/ }).click();
      assert.deepEqual(await page.evaluate(() => window.fixtureData["prompt-butler-favorites"][0].exampleImageIds), ["b", "a"], "Selected cover survives reopen/reload");
      await page.setViewportSize({ width: 420, height: 850 });
      await cases.scrollIntoViewIfNeeded();
      const fits = await cases.locator('.prompt-example-item').evaluateAll(items => items.every(item => {
        const bounds = item.getBoundingClientRect();
        return [...item.querySelectorAll('button')].every(button => { const rect = button.getBoundingClientRect(); return rect.left >= bounds.left && rect.right <= bounds.right + 1; });
      }));
      assert(fits, "Image controls must fit narrow cards");
      fs.mkdirSync(path.resolve(__dirname, '../output/playwright'), { recursive: true });
      await cases.getByRole("button", { name: "删除示例图 1", exact: true }).click();
      await page.waitForFunction(() => window.fixtureData["prompt-butler-favorites"][0].exampleImageIds.join() === "a");
      assert.deepEqual(await page.evaluate(() => window.deletedImages), ["b"], "Only the explicit close button deletes its own image");
      assert.equal(await cases.getByRole("button", { name: "设为示例图", exact: true }).count(), 1);
      await page.getByRole("button", { name: "关闭预览", exact: true }).click();
      await page.getByRole("button", { name: "我的收藏夹", exact: true }).click();
      await page.locator('.collection-folder').filter({ hasText: '测试夹' }).click();
      await page.getByRole("button", { name: "移出当前收藏夹", exact: true }).click();
      await page.getByText("这个收藏夹还没有提示词", { exact: true }).waitFor();
      const retained = await page.evaluate(() => window.fixtureData["prompt-butler-favorites"]);
      assert.equal(retained.length, 1);
      assert.deepEqual(retained[0].folderIds, ["two"]);
      assert.equal(retained[0].isFavorite, true);
      assert.deepEqual(retained[0].exampleImageIds, ["a"]);
      assert.deepEqual(await page.evaluate(() => window.deletedImages), ["b"], "Removing from a folder must not delete example image assets");
      await page.getByRole("button", { name: "全部", exact: true }).click();
      await page.getByRole("button", { name: /示例图测试.*测试内容/ }).waitFor();
      assert.deepEqual(errors, []);
      await context.close();
    }
    console.log("PASS: actual JPEG/PNG/WebP clipboard pixels from card and detail previews in both themes");
  } finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
})().catch(error => { console.error(error); process.exitCode = 1; });