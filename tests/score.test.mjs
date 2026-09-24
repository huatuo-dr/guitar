import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import * as alphaTab from '@coderline/alphatab';

const dataUrl = new URL('../score/intro.json', import.meta.url);
const texUrl = new URL('../score/intro.alphatex', import.meta.url);

test('全曲提供 60 BPM 练习节奏，仍保留 61 小节', () => {
  const tex=readFileSync(new URL('../score/score.alphatex',import.meta.url),'utf8');
  assert.match(tex,/\\tempo 60\b/);
  const importer=new alphaTab.importer.AlphaTexImporter();
  importer.initFromString(tex,new alphaTab.Settings());
  assert.equal(importer.readScore().masterBars.length,61);
});

test('前奏包含第 1–4 小节，每小节恰为 4 拍，弦位与品位有效', () => {
  assert.ok(existsSync(dataUrl), '需要先转录前奏数据');
  const data = JSON.parse(readFileSync(dataUrl));
  assert.deepEqual(data.bars.map(bar => bar.number), [1, 2, 3, 4]);
  assert.equal(data.capo, 2);
  for (const bar of data.bars) {
    assert.equal(bar.beats.reduce((sum, beat) => sum + 4 / beat.duration * (beat.dotted ? 1.5 : 1), 0), 4, `小节 ${bar.number} 拍数`);
    for (const beat of bar.beats) {
      assert.equal(new Set(beat.notes.map(note => note.string)).size, beat.notes.length);
      for (const note of beat.notes) {
        assert.ok(Number.isInteger(note.string) && note.string >= 1 && note.string <= 6);
        assert.ok(note.fret === 'x' || Number.isInteger(note.fret) && note.fret >= 0 && note.fret <= 24);
      }
    }
  }
});

test('制谱库解析后的 4 小节与原始转录一致，保留附点、泛音及击勾弦', () => {
  assert.ok(existsSync(texUrl), '需要生成 alphaTex');
  const data = JSON.parse(readFileSync(dataUrl));
  const importer = new alphaTab.importer.AlphaTexImporter();
  importer.initFromString(readFileSync(texUrl, 'utf8'), new alphaTab.Settings());
  const score = importer.readScore();
  assert.equal(score.masterBars.length, 4);
  const staff = score.tracks[0].staves[0];
  assert.equal(staff.capo, 2);
  staff.bars.forEach((bar, i) => {
    const beats = bar.voices[0].beats;
    assert.equal(beats.length, data.bars[i].beats.length, `小节 ${i + 1} 不应自动补音或丢音`);
    assert.equal(beats.reduce((sum, beat) => sum + beat.playbackDuration, 0), 3840);
    beats.forEach((beat, j) => {
      const expected = data.bars[i].beats[j];
      assert.equal(beat.duration, expected.duration);
      assert.equal(beat.dots, expected.dotted ? 1 : 0);
      assert.equal(beat.notes.length, expected.notes.length);
      expected.notes.forEach(note => {
        const parsed = beat.notes.find(n => n.string === 7 - note.string);
        assert.ok(parsed, `小节 ${i + 1} 第 ${j + 1} 个音的弦位`);
        assert.equal(parsed.isDead, note.fret === 'x');
        if (note.fret !== 'x') assert.equal(parsed.fret, note.fret);
        assert.equal(parsed.isHammerPullOrigin, !!note.legato);
        assert.equal(parsed.harmonicType === alphaTab.model.HarmonicType.Natural, !!note.harmonic);
      });
    });
  });
  const pull = staff.bars[2].voices[0].beats[0].notes.find(n => n.string === 5);
  assert.equal(pull.hammerPullDestination.fret, 7);
  const hammer = staff.bars[0].voices[0].beats[12].notes[0];
  assert.equal(hammer.hammerPullDestination.fret, 10);
  assert.notEqual(staff.bars[3].voices[0].beats[3].brushType, 0);
});
