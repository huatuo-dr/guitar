import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import * as alphaTab from '@coderline/alphatab';
import {buildAccompanimentPlayback} from '../scripts/accompaniment-playback.mjs';

const data=JSON.parse(readFileSync(new URL('../score/houlai.json',import.meta.url),'utf8'));
function parse(playback) {
  const importer=new alphaTab.importer.AlphaTexImporter();
  importer.initFromString(playback.tex,new alphaTab.Settings());
  return importer.readScore();
}

test('后来播放按反复展开80小节，第二遍对应简易谱独立ID，共320拍',()=>{
  const playback=buildAccompanimentPlayback(data);
  assert.equal(playback.sequence.length,80);
  assert.deepEqual(playback.sequence.slice(64).map(s=>s.bar),[45,46,47,48,49,50,51,52,53,54,55,65,66,67,68,69]);
  assert.equal(playback.sequence[64].id,'bar-45-repeat-2');
  assert.equal(playback.sequence[75].id,'bar-65');
  assert.equal(playback.sequence[64].startTick,64*4*960);
  assert.equal(playback.totalTicks,320*960);
  const score=parse(playback);
  assert.equal(score.masterBars.length,80);
  assert.equal(score.tempo,60);
  assert.equal(score.tracks[0].staves[0].capo,3);
  assert.ok(score.masterBars.every(b=>b.calculateDuration()===3840));
});

test('按实际和弦弦品发声，保留前奏H/P、延音、间奏三连音和扫弦方向',()=>{
  const score=parse(buildAccompanimentPlayback(data));
  const bars=score.tracks[0].staves[0].bars;
  const beats=n=>bars[n-1].voices[0].beats;
  const frets=b=>b.notes.map(n=>[7-n.string,n.fret]).sort((a,b)=>a[0]-b[0]);
  assert.deepEqual(frets(beats(1)[0]),[[1,0],[5,3]]);
  assert.deepEqual(frets(beats(1)[4]),[[1,0],[5,2]],'第三拍换Em');
  assert.deepEqual(frets(beats(5)[2]),[[1,0],[2,1]],'人声段仍按旧版一二弦同拨');
  assert.ok(beats(4)[2].notes[0].isHammerPullOrigin);
  assert.ok(beats(4)[3].notes[0].isHammerPullOrigin);
  assert.equal(beats(4).at(-1).notes.length,3);
  assert.ok(beats(4).at(-1).notes.every(n=>n.isTieDestination));
  assert.ok(beats(57).slice(-3).every(b=>b.tupletNumerator===3&&b.tupletDenominator===2));
  assert.equal(beats(45)[0].brushType,alphaTab.model.BrushType.BrushDown);
  assert.equal(beats(45)[3].brushType,alphaTab.model.BrushType.BrushUp);
  assert.equal(beats(60)[4].brushType,alphaTab.model.BrushType.ArpeggioDown);
});

test('拒绝把和弦图禁弹弦静默转换为其他音高',()=>{
  const invalid=structuredClone(data);
  invalid.patterns['pattern-1'][0].strings=[6];
  assert.throws(()=>buildAccompanimentPlayback(invalid),/第1小节.*6弦/);
});
