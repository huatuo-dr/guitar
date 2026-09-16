import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as alphaTab from '@coderline/alphatab';
const read=name=>JSON.parse(readFileSync(new URL(`../score/${name}.json`,import.meta.url)));
const remaining=read('remaining');
const original=[...read('intro').bars,...read('a-section').bars,...read('b-section').bars,...read('c-section').bars];
const expected=new Map(original.map(bar=>[bar.number,bar]));
for(const bar of remaining.bars)expected.set(bar.number,bar.repeatOf?{...expected.get(bar.repeatOf),number:bar.number}:bar);

test('全谱1–61小节连续无重复，重复段来源正确，每小节四拍',()=>{
  assert.deepEqual([...expected.keys()],Array.from({length:61},(_,i)=>i+1));
  const repeats=[...Array.from({length:7},(_,i)=>[41+i,17+i]),...Array.from({length:6},(_,i)=>[50+i,18+i]),...Array.from({length:4},(_,i)=>[57+i,25+i])];
  assert.deepEqual(remaining.bars.filter(b=>b.repeatOf).map(b=>[b.number,b.repeatOf]),repeats);
  for(const bar of expected.values()){
    const count=bar.beats.reduce((sum,b)=>sum+(b.grace?0:4/b.duration*(b.dotted?1.5:1)*(b.tuplet?b.tuplet[1]/b.tuplet[0]:1)),0);
    assert.ok(Math.abs(count-4)<1e-9,`第${bar.number}小节应为4拍`);
  }
});

test('全谱解析不丢音，32分、滑音差异、连续击勾弦、打板与结尾延音完整',()=>{
  const importer=new alphaTab.importer.AlphaTexImporter();
  importer.initFromString(readFileSync(new URL('../score/score.alphatex',import.meta.url),'utf8'),new alphaTab.Settings());
  const score=importer.readScore();
  assert.equal(score.masterBars.length,61);
  for(const section of remaining.sections)assert.equal(score.masterBars[section.start-1].section.text,section.name);
  const bars=score.tracks[0].staves[0].bars;
  for(const original of expected.values()){
    const beats=bars[original.number-1].voices[0].beats;
    assert.equal(beats.length,original.beats.length,`第${original.number}小节`);
    assert.equal(beats.reduce((sum,b)=>sum+b.displayDuration,0),3840);
    beats.forEach((beat,i)=>{
      const source=original.beats[i];
      assert.equal(beat.duration,source.duration);
      assert.equal(beat.dots,source.dotted?1:0);
      assert.equal(beat.text,source.text??null);
      assert.equal(beat.graceType!==alphaTab.model.GraceType.None,!!source.grace);
      assert.equal(beat.brushType===alphaTab.model.BrushType.ArpeggioDown,source.arpeggio==='up');
      assert.equal(beat.hasTuplet,!!source.tuplet);
      if(source.tuplet)assert.deepEqual([beat.tupletNumerator,beat.tupletDenominator],source.tuplet);
      assert.equal(beat.notes.length,source.notes.length);
      for(const note of source.notes){
        const n=beat.notes.find(n=>n.string===7-note.string);
        assert.ok(n);
        assert.equal(n.isDead,note.fret==='x');
        if(note.fret!=='x')assert.equal(n.fret,note.fret);
        assert.equal(n.isTieDestination,!!note.tie);
        assert.equal(n.isGhost,false);
        assert.equal(n.isHammerPullOrigin,!!note.legato);
        assert.equal(n.slideOutType===alphaTab.model.SlideOutType.Legato,note.slide==='legato');
        assert.equal(n.harmonicType===alphaTab.model.HarmonicType.Natural,!!note.harmonic);
        if(note.tie)assert.ok(n.tieOrigin);
        if(note.legato)assert.ok(n.hammerPullDestination);
        if(note.slide)assert.ok(n.slideTarget);
      }
    });
  }
  const b34=bars[33].voices[0].beats;
  assert.deepEqual(b34.filter(b=>b.duration===32).map(b=>b.notes[0].fret),[3,5]);
  const b48=bars[47].voices[0].beats;
  assert.equal(b48[3].notes[0].slideTarget,b48[4].notes[0]);
  assert.equal(b48[4].notes[0].slideOutType,alphaTab.model.SlideOutType.None,'第48小节5→3应重新拨弦，不复制第24小节下滑');
  const ending=bars[60].voices[0].beats;
  assert.equal(ending.length,4);
  assert.equal(ending[0].brushType,alphaTab.model.BrushType.ArpeggioDown);
  for(const index of [1,2,3])for(const n of ending[index].notes)assert.equal(n.tieOrigin,ending[index-1].notes.find(prior=>prior.string===n.string));
});
