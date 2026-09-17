import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';

const source = new URL('../score/laonanhai.json', import.meta.url);

test('老男孩保留55个书写小节及原谱两处短小节，不静默补拍', async () => {
  const data = JSON.parse(await readFile(source, 'utf8'));
  const {expandBars, validateScore} = await import('../scripts/accompaniment-svg.mjs');
  assert.equal(validateScore(data), true);
  const bars = expandBars(data);
  assert.equal(bars.length, 55);
  assert.deepEqual(bars.map(b => b.number), Array.from({length:55}, (_, i) => i + 1));
  const length = bar => bar.events.reduce((n, e) => n + 4 / e.duration, 0);
  assert.deepEqual(bars.filter(b => length(b) !== 4).map(b => b.number), [18, 43]);
  for (const number of [18, 43]) {
    const bar = bars[number - 1];
    assert.equal(length(bar), 2);
    assert.match(bar.note, /原谱.*两拍/);
  }
  const invalid = structuredClone(data);
  invalid.bars[0].beats = 3;
  assert.throws(() => validateScore(invalid), /时值/);
});

test('过门保持4弦0击2接3弦0，三和弦与琶音时点准确', async () => {
  const data = JSON.parse(await readFile(source, 'utf8'));
  const {expandBars} = await import('../scripts/accompaniment-svg.mjs');
  const bars = expandBars(data);
  for (const number of [1, 2, 28, 29, 50, 51]) {
    assert.deepEqual(bars[number - 1].events.filter(e => e.kind === 'note'), [
      {kind:'note', duration:16, string:4, fret:0, hammerToNext:true},
      {kind:'note', duration:16, string:4, fret:2},
      {kind:'note', duration:8, string:3, fret:0}
    ]);
  }
  for (const number of [14, 16, 39, 41]) {
    assert.deepEqual(bars[number - 1].chords, [{beat:1,name:'F'},{beat:2,name:'G'},{beat:3,name:'C'}]);
  }
  assert.equal(bars[49].events[0].kind, 'arpeggio');
  assert.deepEqual(bars[54].events.map(e => e.kind), ['arpeggio','hold','hold','hold']);
  assert.deepEqual(data.chordShapes.Dm7.frets, [-1,0,0,2,1,1]);
  assert.deepEqual(data.chordShapes.A7.frets, [0,0,2,2,2,3]);
});

test('反复、房子和两次D.S.的演奏顺序不会漏奏或误入房子', async () => {
  const data = JSON.parse(await readFile(source, 'utf8'));
  const {performanceOrder, validateScore} = await import('../scripts/accompaniment-svg.mjs');
  const range = (a,b) => Array.from({length:b-a+1}, (_,i) => a+i);
  assert.deepEqual(performanceOrder(data), [
    ...range(1,29), ...range(7,27), ...range(30,45),
    ...range(21,26), ...range(46,47), ...range(21,27), ...range(48,55)
  ]);
  const invalid = structuredClone(data);
  invalid.route[0].end = 56;
  assert.throws(() => validateScore(invalid), /演奏顺序/);
});

test('矢量谱面每行4小节，末行3小节，55小节都有唯一定位与文本说明', async () => {
  const data = JSON.parse(await readFile(source, 'utf8'));
  const {renderScore} = await import('../scripts/accompaniment-svg.mjs');
  const svg = renderScore(data);
  assert.equal((svg.match(/class="score-system"/g) || []).length, 14);
  assert.equal((svg.match(/class="measure"/g) || []).length, 55);
  for (let number = 1; number <= 55; number++) assert.equal((svg.match(new RegExp(`id="bar-${number}"`, 'g')) || []).length, 1);
  assert.match(svg, /D\.S\.1/);
  assert.match(svg, /D\.S\.2/);
  assert.match(svg, /原谱仅两拍/);
  assert.doesNotMatch(svg, /<image|https?:|NaN|undefined/);
  const narrow = renderScore(data,2);
  assert.equal((narrow.match(/class="score-system"/g) || []).length,28);
  assert.equal((narrow.match(/class="measure"/g) || []).length,55);
  assert.match(narrow,/viewBox="0 0 600 237"/);
  assert.throws(()=>renderScore(data,3),/只支持2或4/);
});
