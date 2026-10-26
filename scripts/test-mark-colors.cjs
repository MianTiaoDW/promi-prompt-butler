// Run with: node scripts/test-mark-colors.cjs
const assert = require("node:assert/strict");
const path = require("node:path");
const esbuild = require("esbuild");

(async () => {
  const result = await esbuild.build({ entryPoints: [path.resolve(__dirname, "../src/lib/mark-colors.ts")], bundle: true, write: false, platform: "node", format: "cjs" });
  const loaded = { exports: {} };
  new Function("module", "exports", "require", result.outputFiles[0].text)(loaded, loaded.exports, require);
  const { normalizeHex, hsvToHex, hexToHsv, contrastRatio, compositeColor, readableTextColor, PRESET_MARK_COLORS, MARK_THEME_BASES } = loaded.exports;
  assert.equal(normalizeHex(" #aBc "), "#aabbcc");
  assert.equal(normalizeHex("ABCDEF"), "#abcdef");
  for (const invalid of ["", "#abcd", "#12345678", "red", "#gggggg"]) assert.equal(normalizeHex(invalid), null);
  assert.equal(hsvToHex(0, 100, 100), "#ff0000");
  assert.equal(hsvToHex(120, 100, 100), "#00ff00");
  assert.equal(hsvToHex(360, 100, 100), "#ff0000");
  assert.equal(hsvToHex(-120, 100, 100), "#0000ff");
  assert.equal(hsvToHex(NaN, Infinity, -10), "#000000");
  for (let h = 0; h < 360; h += 15) {
    for (const s of [25, 50, 100]) {
      for (const v of [25, 50, 100]) {
        const actual = hexToHsv(hsvToHex(h, s, v));
        assert.ok(Math.min(Math.abs(actual.h - h), 360 - Math.abs(actual.h - h)) < 2);
        assert.ok(Math.abs(actual.s - s) < 1);
        assert.ok(Math.abs(actual.v - v) < 1);
      }
    }
  }
  assert.deepEqual(hexToHsv("invalid"), { h: 0, s: 0, v: 0 });
  assert.equal(contrastRatio("#000", "#fff"), 21);
  assert.equal(contrastRatio("#123456", "#123456"), 1);
  assert.equal(compositeColor("#fff", "#000", 0.5), "#808080");
  assert.equal(compositeColor("#fff", "#000", -1), "#000000");
  assert.equal(compositeColor("#fff", "#000", 2), "#ffffff");
  assert.equal(compositeColor("#fff", "#000", NaN), "#000000");
  assert.deepEqual(PRESET_MARK_COLORS.map(color => color.name), ["红色", "橙色", "黄色", "绿色", "青色", "蓝色", "紫色", "粉色", "棕色", "灰色"]);
  for (const theme of ["light", "dark"]) {
    const base = MARK_THEME_BASES[theme];
    for (const preset of PRESET_MARK_COLORS) {
      assert.ok(contrastRatio(preset.text[theme], base.background) >= 4.5, `${theme} ${preset.name} foreground`);
      for (const opacity of [0.45, 1]) {
        assert.ok(contrastRatio(base.text, compositeColor(preset.background[theme], base.background, opacity)) >= 4.5, `${theme} ${preset.name} background ${opacity}`);
      }
    }
    for (const background of [base.background, "#777777", "#ffffff", "#000000"]) {
      for (let h = 0; h < 360; h += 15) {
        const input = hsvToHex(h, 80, 65);
        const output = readableTextColor(input, background);
        assert.ok(contrastRatio(output, background) >= 4.5, `${input} on ${background}`);
        if (contrastRatio(input, background) >= 4.5) assert.equal(output, input);
      }
    }
  }
  console.log("Mark color conversions, contrast, alpha and theme presets passed.");
})().catch(error => { console.error(error); process.exitCode = 1; });
