import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as alphaTab from '@coderline/alphatab';

const source=JSON.parse(readFileSync(new URL('../score/b-section.json',import.meta.url)));
test('B段四小节各为四拍，所有弦品及同时发音位置有效',()=>{
  assert.deepEqual(source.bars.map(b=>b.number),[13,14,15,16]);
  assert.deepEqual(source.bars.map(b=>b.beats.length),[10,11,11,6]);
  for(const bar of source.bars){
    assert.equal(bar.beats.reduce((sum,b)=>sum+4/b.duration,0),4);
    for(const beat of bar.beats){
      assert.equal(new Set(beat.notes.map(n=>n.string)).size,beat.notes.length);
      for(const note of beat.notes){
        assert.ok(Number.isInteger(note.string)&&note.string>=1&&note.string<=6);
        assert.ok(note.fret==='x'||Number.isInteger(note.fret)&&note.fret>=0&&note.fret<=24);
      }
    }
  }
});

test('B段保留五弦琶音、连奏滑音及延音滑音的真实关系',()=>{
  const importer=new alphaTab.importer.AlphaTexImporter();
  importer.initFromString(readFileSync(new URL('../score/score.alphatex',import.meta.url),'utf8'),new alphaTab.Settings());
  const score=importer.readScore();
  assert.equal(score.masterBars.length,61);
  assert.equal(score.masterBars[12].section.text,'B段');
  const bars=score.tracks[0].staves[0].bars;
  for(const bar of source.bars){
    const parsed=bars[bar.number-1].voices[0].beats;
    assert.equal(parsed.length,bar.beats.length);
    // Before-beat grace in bar 17 borrows playback time from bar 16;
    // the written duration of each bar remains four beats.
    assert.equal(parsed.reduce((sum,b)=>sum+b.displayDuration,0),3840);
    parsed.forEach((beat,i)=>{
      const original=bar.beats[i];
      assert.equal(beat.duration,original.duration);
      assert.equal(beat.notes.length,original.notes.length);
      for(const note of original.notes){
        const n=beat.notes.find(n=>n.string===7-note.string);
        assert.ok(n);
        assert.equal(n.isDead,note.fret==='x');
        if(note.fret!=='x')assert.equal(n.fret,note.fret);
        assert.equal(n.isTieDestination,!!note.tie);
        assert.equal(n.isGhost,false,'延音括号不能被转录为幽灵音');
        assert.equal(n.slideOutType===alphaTab.model.SlideOutType.Legato,note.slide==='legato');
      }
    });
  }
  assert.equal(bars[12].voices[0].beats[0].brushType,alphaTab.model.BrushType.ArpeggioDown);
  const fifteenth=bars[14].voices[0].beats;
  assert.equal(fifteenth[5].notes[0].slideTarget,fifteenth[6].notes[0]);
  const sixteenth=bars[15].voices[0].beats;
  const tiedSlide=sixteenth[3].notes.find(n=>n.string===4);
  assert.equal(tiedSlide.tieOrigin,sixteenth[2].notes.find(n=>n.string===4));
  assert.equal(tiedSlide.slideTarget,sixteenth[4].notes[0]);
});
