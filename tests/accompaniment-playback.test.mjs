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

const range=(start,end)=>Array.from({length:end-start+1},(_,i)=>start+i);
const catalog=[
  {id:'laonanhai',beats:350,capo:0,label:'伴奏',route:[...range(1,29),...range(7,27),...range(30,45),...range(21,26),46,47,...range(21,27),...range(48,55)]},
  {id:'kongxin',beats:288,capo:0,label:'伴奏',route:[...range(1,30),...range(5,29),...range(31,47)]},
  {id:'turanhaoxiangni',beats:248,capo:2,label:'伴奏',route:[...range(1,12),...range(5,11),...range(13,55)]},
  {id:'canon',beats:276,capo:0,label:'指弹',route:[...range(1,16),...range(13,15),...range(17,21),18,19,...range(22,27),...range(24,27),...range(28,51),...range(48,51),...range(52,56)]},
  {id:'canon-v2',beats:36,capo:0,label:'指弹',route:range(1,9)}
];
for(const expected of catalog)test(`${expected.id} 的完整路线、时值、音高与试听说明`,()=>{
  const source=JSON.parse(readFileSync(new URL(`../score/${expected.id}.json`,import.meta.url),'utf8'));
  const playback=buildAccompanimentPlayback(source),score=parse(playback);
  assert.equal(playback.label,expected.label);
  assert.equal(playback.capoNote,source.capo===undefined?'试听按未夹变调夹音高':'');
  assert.deepEqual(playback.sequence.map(s=>s.bar),expected.route);
  assert.equal(new Set(playback.sequence.map(s=>s.id)).size,expected.route.length);
  assert.equal(playback.totalTicks,expected.beats*960);
  assert.equal(score.tracks.length,1,'不附加人声简谱声部');
  assert.equal(score.tracks[0].staves.length,1);
  assert.equal(score.tracks[0].staves[0].capo,expected.capo);
  assert.equal(score.masterBars.length,expected.route.length);
  const durations=score.masterBars.map(b=>b.calculateDuration());
  assert.deepEqual(durations,playback.sequence.map(s=>s.duration));
  assert.equal(durations.reduce((sum,d)=>sum+d,0),expected.beats*960);
  const bars=score.tracks[0].staves[0].bars;
  const original=n=>bars[expected.route.indexOf(n)].voices[0].beats;
  const notes=beat=>beat.notes.map(n=>[7-n.string,n.fret]);
  const pitches=beat=>beat.notes.map(n=>n.realValue).sort((a,b)=>a-b);
  if(expected.id==='laonanhai') {
    assert.deepEqual(durations.flatMap((d,i)=>d===1920?[i+1]:[]),[18,41,64]);
    assert.equal(playback.sequence.at(-1).startTick,346*960);
    assert.ok(original(1)[3].notes[0].isHammerPullOrigin);
    assert.deepEqual(pitches(original(1)[0]),[48,52,55,60,64]);
  } else if(expected.id==='kongxin') {
    assert.ok(original(4)[4].notes.every(n=>n.isTieDestination),'延音箭头不重新扫弦');
    assert.equal(original(4)[4].brushType,alphaTab.model.BrushType.None);
    assert.deepEqual(pitches(original(1)[0]),[45,53,57,60,64]);
    assert.ok(original(47).slice(1).every(b=>b.notes.every(n=>n.isTieDestination)));
  } else if(expected.id==='turanhaoxiangni') {
    assert.deepEqual(pitches(original(1)[0]),[50,66],'按第2品升高两半音');
    assert.ok(original(3)[7].notes[0].isTieDestination);
    assert.ok(original(54).every(b=>b.notes.every(n=>n.isTieDestination)),'跨小节G和弦持续至54末尾');
    assert.ok(original(54).every(b=>b.brushType===alphaTab.model.BrushType.None));
    assert.ok(original(55)[0].notes.every(n=>!n.isTieDestination),'尾声C重新起音');
  } else if(expected.id==='canon') {
    assert.equal(original(14)[6].notes[0].slideOutType,alphaTab.model.SlideOutType.Legato);
    assert.ok(original(18)[9].notes[0].isHammerPullOrigin);
    assert.deepEqual(notes(original(25)[4]),[[4,2]],'按六线谱而非不同的简谱音高播放');
    assert.ok(original(25)[4].notes[0].isHammerPullOrigin);
    assert.ok(original(56).slice(1).every(b=>b.notes.every(n=>n.isTieDestination)));
    assert.deepEqual(pitches(original(1)[0]),[48,55,60,64]);
  } else {
    assert.equal(bars.flatMap(b=>b.voices[0].beats).flatMap(b=>b.notes).length,113,'不补加和弦或低音');
    assert.equal(original(9).length,1);
    assert.equal(original(9)[0].playbackDuration,3840);
    assert.deepEqual(notes(original(9)[0]),[[2,1]]);
    assert.deepEqual(pitches(original(1)[0]),[67]);
  }
});
