const assert = require('node:assert/strict');
const path = require('node:path');
const esbuild = require('esbuild');

(async () => {
  const result = await esbuild.build({ entryPoints: [path.resolve(__dirname, '../src/lib/prompt-marks.ts')], bundle: true, write: false, platform: 'node', format: 'cjs' });
  const loaded = { exports: {} };
  new Function('module', 'exports', 'require', result.outputFiles[0].text)(loaded, loaded.exports, require);
  const { normalizeMarks, applyMark, clearMarks, remapMarks, getMarkedSegments } = loaded.exports;
  const background = { kind: 'background', light: '#ffee00', dark: '#887700', opacity: 0.4 };
  const foreground = { kind: 'text', light: '#001122', dark: '#aabbcc' };
  const mark = (start, end, style = background) => ({ start, end, ...style });

  assert.deepEqual(normalizeMarks('hello', null), []);
  assert.deepEqual(normalizeMarks('hello', [null, {}, mark(NaN, 3), mark(0.2, 3), mark(4, 2), mark(0, 2, { ...background, kind: 'html' }), mark(0, 2, { ...background, light: 'red' }), mark(0, 2, { ...background, opacity: 1.1 })]), []);
  assert.deepEqual(normalizeMarks('hello', [mark(-2, 99), { ...mark(1, 3), injected: '<script>' }]), [mark(0, 5), mark(1, 3)]);
  assert.deepEqual(normalizeMarks('A😀B', [mark(2, 3)]), [mark(1, 3)]);
  assert.deepEqual(applyMark('same same', [], 5, 9, background), [mark(5, 9)], 'only the selected duplicate is annotated');
  assert.deepEqual(applyMark('abcdef', [mark(0, 6), mark(1, 5, foreground)], 2, 4, { ...background, light: '#ff0000' }), [mark(0, 2), mark(1, 5, foreground), mark(2, 4, { ...background, light: '#ff0000' }), mark(4, 6)]);
  assert.deepEqual(clearMarks('abcdef', [mark(0, 6), mark(1, 5, foreground)], 2, 4, 'background'), [mark(0, 2), mark(1, 5, foreground), mark(4, 6)]);
  assert.deepEqual(clearMarks('abcdef', [mark(0, 6), mark(1, 5, foreground)], 2, 4), [mark(0, 2), mark(1, 2, foreground), mark(4, 5, foreground), mark(4, 6)]);
  assert.deepEqual(applyMark('abc', [mark(0, 2)], 1, 1, foreground), [mark(0, 2)], 'collapsed selection is a no-op');
  assert.deepEqual(remapMarks('abcd', 'abXcd', [mark(0, 4)]), [mark(0, 5)], 'typing strictly within a mark inherits its style');
  assert.deepEqual(remapMarks('abcd', 'Xabcd', [mark(0, 4)]), [mark(1, 5)]);
  assert.deepEqual(remapMarks('abcd', 'abcdX', [mark(0, 4)]), [mark(0, 4)]);
  assert.deepEqual(remapMarks('abcdef', 'abXYef', [mark(0, 6)]), [mark(0, 2), mark(4, 6)], 'replacement text does not inherit deleted styles');
  assert.deepEqual(remapMarks('abcdef', 'abef', [mark(1, 5)]), [mark(1, 3)]);
  assert.deepEqual(remapMarks('same same', 'same', [mark(5, 9)]), [], 'deleted duplicate is never relocated to the surviving occurrence');
  assert.deepEqual(remapMarks('abc', 'xyz', [mark(0, 3)]), []);
  assert.deepEqual(remapMarks('😀a', '😃a', [mark(0, 2)]), [], 'a shared high surrogate is not unchanged text');
  assert.deepEqual(remapMarks('e\u0301 x', 'e\u0301 !x', [mark(0, 2)]), [mark(0, 2)]);
  const segments = getMarkedSegments('abcdef', [mark(1, 4), mark(2, 5, foreground)]);
  assert.deepEqual(segments.map(s => [s.text, s.start, s.marks.map(m => m.kind)]), [['a', 0, []], ['b', 1, ['background']], ['cd', 2, ['background', 'text']], ['e', 4, ['text']], ['f', 5, []]]);
  assert.equal(getMarkedSegments('A😀e\u0301', [mark(2, 3)]).map(s => s.text).join(''), 'A😀e\u0301');
  assert.deepEqual(getMarkedSegments('', []), []);
  console.log('PASS: prompt annotation validation, independent styles, duplicate offsets, edit remapping and Unicode segments');
})().catch(error => { console.error(error); process.exitCode = 1; });
