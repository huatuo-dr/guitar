import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import * as alphaTab from '@coderline/alphatab';

const section = JSON.parse(readFileSync(new URL('../score/a-section.json', import.meta.url)));
const texUrl = new URL('../score/score.alphatex', import.meta.url);

test('A段为第5–12小节，装饰音不另占拍，其余每小节合计四拍', () => {
  assert.deepEqual(section.bars.map(bar=>bar.number),[5,6,7,8,9,10,11,12]);
  assert.deepEqual(section.bars.map(bar=>bar.beats.length),[9,8,11,8,11,11,9,10]);
  for(const bar of section.bars){
    assert.equal(bar.beats.reduce((sum,beat)=>sum+(beat.grace ? 0 : 4/beat.duration*(beat.dotted?1.5:1)),0),4,`第${bar.number}小节`);
    for(const beat of bar.beats){
      assert.equal(new Set(beat.notes.map(n=>n.string)).size,beat.notes.length);
      for(const note of beat.notes){
        assert.ok(Number.isInteger(note.string)&&note.string>=1&&note.string<=6);
        assert.ok(note.fret==='x'||Number.isInteger(note.fret)&&note.fret>=0&&note.fret<=24);
      }
    }
  }
});

test('完整曲谱保留前奏，并正确解析A段的延音、装饰音及连续击勾弦', () => {
  assert.ok(existsSync(texUrl),'需要生成前奏+A段乐谱');
  const importer = new alphaTab.importer.AlphaTexImporter();
  importer.initFromString(readFileSync(texUrl,'utf8'),new alphaTab.Settings());
  const score=importer.readScore();
  assert.equal(score.title,'《偏爱》指弹');
  assert.equal(score.masterBars.length,61);
  assert.equal(score.masterBars[0].section.text,'前奏');
  assert.equal(score.masterBars[4].section.text,'A段');
  const bars=score.tracks[0].staves[0].bars;
  const intro=JSON.parse(readFileSync(new URL('../score/intro.json',import.meta.url)));
  for(const source of [...intro.bars,...section.bars]){
    const beats=bars[source.number-1].voices[0].beats;
    assert.equal(beats.length,source.beats.length,`第${source.number}小节不应丢音或补音`);
    beats.forEach((beat,index)=>{
      const expected=source.beats[index];
      assert.equal(beat.duration,expected.duration);
      assert.equal(beat.graceType!==alphaTab.model.GraceType.None,!!expected.grace);
      assert.equal(beat.notes.length,expected.notes.length);
      expected.notes.forEach(note=>{
        const parsed=beat.notes.find(n=>n.string===7-note.string);
        assert.ok(parsed);
        assert.equal(parsed.isDead,note.fret==='x');
        if(note.fret!=='x')assert.equal(parsed.fret,note.fret);
        assert.equal(parsed.isTieDestination,!!note.tie);
        assert.equal(parsed.isHammerPullOrigin,!!note.legato);
        assert.equal(parsed.harmonicType===alphaTab.model.HarmonicType.Natural,!!note.harmonic);
      });
    });
  }
  const fifth=bars[4].voices[0].beats;
  assert.equal(fifth[8].notes[0].tieOrigin,fifth[7].notes[0]);
  const eighth=bars[7].voices[0].beats;
  assert.equal(eighth[0].notes[0].hammerPullDestination,eighth[1].notes[0]);
  const eleventh=bars[10].voices[0].beats;
  for(const index of [5,6,7])assert.equal(eleventh[index].notes[0].hammerPullDestination,eleventh[index+1].notes[0]);
});
