// Exercise the real background route with isolated browser API substitutes.
const assert = require("node:assert/strict");
const path = require("node:path");
const { build } = require("esbuild");

(async () => {
  const data = {};
  const area = {
    get: async key => ({ [key]: data[key] }),
    set: async values => Object.assign(data, values),
    setAccessLevel: async () => {}
  };
  const created = [], updated = [], focused = [];
  let receive;
  global.chrome = {
    storage: { local: area, session: area },
    runtime: {
      getURL: name => `chrome-extension://test/${name}`,
      onConnect: { addListener() {} },
      onMessage: { addListener: handler => { receive = handler; } }
    },
    action: { onClicked: { addListener() {} } },
    windows: {
      create: async options => { created.push(options); return { id: 7 }; },
      get: async () => ({ id: 7, state: "minimized" }),
      update: async (id, options) => { focused.push({ id, ...options }); },
      onBoundsChanged: { addListener() {} },
      onRemoved: { addListener() {} }
    },
    tabs: {
      query: async ({ windowId }) => { assert.equal(windowId, 7); return [{ id: 12 }]; },
      update: async (id, options) => { updated.push({ id, ...options }); }
    }
  };
  const bundle = await build({ entryPoints: [path.resolve(__dirname, "../src/background/index.ts")], bundle: true, write: false, platform: "node", format: "cjs" });
  const loaded = { exports: {} };
  new Function("module", "exports", "require", bundle.outputFiles[0].text)(loaded, loaded.exports, require);
  const send = chapter => new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Tutorial route did not respond")), 1000);
    receive({ type: "tutorial:open-main", chapter }, {}, response => { clearTimeout(timer); resolve(response); });
  });
  assert.deepEqual(await send(2), { ok: true });
  assert.equal(created.length, 1);
  assert.equal(created[0].url, "options.html?view=app&tutorialChapter=2");
  assert.equal(created[0].type, "popup");
  assert.deepEqual(await send(4), { ok: true });
  assert.equal(created.length, 1, "Existing main window must be reused");
  assert.deepEqual(updated, [{ id: 12, url: "chrome-extension://test/options.html?view=app&tutorialChapter=4" }]);
  assert.deepEqual(focused, [{ id: 7, state: "normal" }, { id: 7, focused: true }]);
  assert.equal((await send(5)).ok, false);
  assert.equal(created.length, 1);
  assert.equal(updated.length, 1);
  console.log("PASS: tutorial opens main window at selected chapter, reuses and focuses existing window, rejects invalid chapters");
})().catch(error => { console.error(error); process.exitCode = 1; });
