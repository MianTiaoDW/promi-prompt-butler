// Run with: node scripts/test-default-prompts.cjs (after npm ci).
const assert = require("node:assert/strict");
const path = require("node:path");
const esbuild = require("esbuild");

(async () => {
  const result = await esbuild.build({
    stdin: { contents: 'export * from "./src/lib/prompt-library";', resolveDir: path.resolve(__dirname, "..") },
    bundle: true,
    write: false,
    platform: "node",
    format: "cjs"
  });
  const loaded = { exports: {} };
  new Function("module", "exports", "require", result.outputFiles[0].text)(loaded, loaded.exports, require);
  const api = loaded.exports;
  const data = {};
  global.chrome = {
    storage: {
      local: {
        get: async key => ({ [key]: structuredClone(data[key]) }),
        set: async values => Object.assign(data, structuredClone(values))
      }
    }
  };

  data[api.PROMPT_STORAGE_KEYS.favorites] = [];
  const added = await api.ensureDefaultPrompts();
  assert.equal(added.length, 6);
  assert.equal(new Set(added.map(record => record.title)).size, 6);
  assert.ok(added.every(record => record.category === "收藏"));
  assert.ok(added.every(record => record.isFavorite === false));
  assert.ok(added.every(record => !record.folderIds?.length));
  assert.deepEqual(added.map(record => record.group.steps.length), [4, 1, 1, 1, 1, 3]);

  const secondRun = await api.ensureDefaultPrompts();
  assert.equal(secondRun.length, 0);
  assert.equal(data[api.PROMPT_STORAGE_KEYS.favorites].length, 6);

  console.log("PASS: six unliked, unfiled default prompts are seeded exactly once");
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
