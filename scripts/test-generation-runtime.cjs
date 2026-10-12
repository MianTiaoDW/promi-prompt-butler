// Regression: disconnected generation ports must not produce unchecked errors;
// active tasks send keep-alive messages and release timers when finished.
const assert = require("node:assert/strict");
const path = require("node:path");
const esbuild = require("esbuild");

(async () => {
  const result = await esbuild.build({ entryPoints: [path.resolve(__dirname, "../src/lib/runtime.ts")], bundle: true, write: false, platform: "node", format: "cjs" });
  const loaded = { exports: {} };
  new Function("module", "exports", "require", result.outputFiles[0].text)(loaded, loaded.exports, require);
  const nativeSetInterval = global.setInterval;
  const nativeClearInterval = global.clearInterval;
  const timers = new Map();
  let timerId = 0;
  global.setInterval = (callback, milliseconds) => { timers.set(++timerId, { callback, milliseconds }); return timerId; };
  global.clearInterval = id => timers.delete(id);
  const request = { type: "prompt:generate", payload: {} };
  const success = { ok: true, output: "done" };
  let onDisconnect, responseCallback, errorActive = false, errorReads = 0, disconnects = 0;
  const messages = [];
  global.chrome = { runtime: {
    connect: () => ({
      onDisconnect: { addListener: callback => { onDisconnect = callback; } },
      postMessage: message => messages.push(message),
      disconnect: () => { disconnects++; }
    }),
    sendMessage: (_message, callback) => { responseCallback = callback; },
    get lastError() { if (errorActive) { errorReads++; return { message: "Could not establish connection. Receiving end does not exist." }; } }
  } };
  try {
    const recovered = loaded.exports.sendRuntimeMessageLong(request, async () => success);
    errorActive = true;
    onDisconnect();
    errorActive = false;
    assert.equal(errorReads, 1, "Port disconnect must consume runtime.lastError instead of logging an unchecked error");
    assert.equal([...timers.values()].some(timer => timer.milliseconds === 20000), false, "A disconnected port stops its heartbeat");
    await [...timers.values()].find(timer => timer.milliseconds === 2000).callback();
    assert.deepEqual(await recovered, success, "Stored task result recovers a disconnected request");
    assert.equal(timers.size, 0, "Recovery releases all task timers");

    const active = loaded.exports.sendRuntimeMessageLong(request, async () => null);
    const heartbeat = [...timers.values()].find(timer => timer.milliseconds === 20000);
    assert.ok(heartbeat, "Active generation sends messages before the worker idle timeout");
    heartbeat.callback();
    assert.deepEqual(messages.at(-1), { type: "task:keep-alive" });
    responseCallback(success);
    assert.deepEqual(await active, success);
    assert.equal(timers.size, 0, "A direct response releases heartbeat and polling timers");
    assert.equal(disconnects, 2);

    const failed = loaded.exports.sendRuntimeMessageLong(request, async () => null);
    responseCallback({ ok: false, message: "模型返回了空响应，请重试。" });
    assert.deepEqual(await failed, { ok: false, message: "模型返回了空响应，请重试。" }, "Actual provider failures remain visible");
    assert.equal(timers.size, 0);
    console.log("PASS: disconnect error handled, heartbeat lifecycle, polling recovery, cleanup and genuine provider errors");
  } finally { global.setInterval = nativeSetInterval; global.clearInterval = nativeClearInterval; }
})().catch(error => { console.error(error); process.exitCode = 1; });
