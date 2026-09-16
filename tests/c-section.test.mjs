import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as alphaTab from '@coderline/alphatab';

const source=JSON.parse(readFileSync(new URL('../score/c-section.json',import.meta.url)));
test('C段17–28连续，三连音及装饰音计时正确，每小节四拍',()=>{
  assert.deepEqual(source.bars.map(b=>b.number),Array.from({length:12},(_,i)=>17+i));
  assert.deepEqual(source.bars.map(b=>b.beats.length),[12,13,12,14,10,13,12,12,15,9,11,6]);
  for(const bar of source.bars){
    const total=bar.beats.reduce((sum,b)=>sum+(b.grace?0:4/b.duration*(b.dotted?1.5:1)*(b.tuplet?b.tuplet[1]/b.tuplet[0]:1)),0);
    assert.ok(Math.abs(total-4)<1e-9,`第${bar.number}小节为${total}拍`);
    for(const beat of bar.beats){
      assert.equal(new Set(beat.notes.map(n=>n.string)).size,beat.notes.length);
      for(const note of beat.notes){
        assert.ok(Number.isInteger(note.string)&&note.string>=1&&note.string<=6);
        assert.ok(note.fret==='x'||Number.isInteger(note.fret)&&note.fret>=0&&note.fret<=24);
      }
    }
  }
});

test('C段保留三连音、延音、击勾弦、双向滑音、泛音、琶音及原谱星号',()=>{
  const importer=new alphaTab.importer.AlphaTexImporter();
  importer.initFromString(readFileSync(new URL('../score/score.alphatex',import.meta.url),'utf8'),new alphaTab.Settings());
  const score=importer.readScore();
  assert.equal(score.masterBars.length,61);
  assert.equal(score.masterBars[16].section.text,'C段');
  const bars=score.tracks[0].staves[0].bars;
  for(const bar of source.bars){
    const parsed=bars[bar.number-1].voices[0].beats;
    assert.equal(parsed.length,bar.beats.length);
    assert.equal(parsed.reduce((sum,b)=>sum+b.displayDuration,0),3840);
    parsed.forEach((beat,i)=>{
      const original=bar.beats[i];
      assert.equal(beat.duration,original.duration);
      assert.equal(beat.graceType!==alphaTab.model.GraceType.None,!!original.grace);
      assert.equal(beat.text,original.text??null);
      if(original.tuplet)assert.deepEqual([beat.tupletNumerator,beat.tupletDenominator],original.tuplet);
      else assert.equal(beat.hasTuplet,false);
      assert.equal(beat.brushType===alphaTab.model.BrushType.ArpeggioDown,original.arpeggio==='up');
      assert.equal(beat.notes.length,original.notes.length);
      for(const note of original.notes){
        const n=beat.notes.find(n=>n.string===7-note.string);
        assert.ok(n);
        assert.equal(n.isDead,note.fret==='x');
        if(note.fret!=='x')assert.equal(n.fret,note.fret);
        assert.equal(n.isTieDestination,!!note.tie);
        if(note.tie)assert.ok(n.tieOrigin,'延音应有真实起点');
        assert.equal(n.isGhost,false);
        assert.equal(n.isHammerPullOrigin,!!note.legato);
        if(note.legato)assert.ok(n.hammerPullDestination,'击勾弦应有目标');
        assert.equal(n.harmonicType===alphaTab.model.HarmonicType.Natural,!!note.harmonic);
        assert.equal(n.slideOutType===alphaTab.model.SlideOutType.Legato,note.slide==='legato');
        if(note.slide)assert.ok(n.slideTarget);
      }
    });
  }
  const twentieth=bars[19].voices[0].beats;
  assert.equal(twentieth.slice(0,3).reduce((s,b)=>s+b.playbackDuration,0),960,'三个八分三连音合为一拍');
  for(const i of [3,4,5])assert.equal(twentieth[i].notes.find(n=>n.string===5).tieOrigin,twentieth[i-1].notes.find(n=>n.string===5));
  const slide=bars[23].voices[0].beats;
  assert.equal(slide[3].notes[0].slideTarget,slide[4].notes[0]);
  assert.equal(slide[4].notes[0].slideTarget,slide[5].notes[0]);
});
