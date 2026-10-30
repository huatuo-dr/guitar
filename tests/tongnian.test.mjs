import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';
import * as alphaTab from '@coderline/alphatab';
import {expandBars,performanceOrder,validateScore,renderScore} from '../scripts/accompaniment-svg.mjs';
import {attachVocals,eventBeats} from '../scripts/numbered-notation.mjs';
import {projectSimpleBar,simpleSections,renderSimpleScore,simpleLyricLines} from '../scripts/simple-score.mjs';
import {buildAccompanimentPlayback} from '../scripts/accompaniment-playback.mjs';
const read=async id=>JSON.parse(await readFile(new URL('../score/'+id+'.json',import.meta.url),'utf8'));
const data=attachVocals(await read('tongnian'),await read('tongnian-vocal'));
const range=(a,b)=>Array.from({length:b-a+1},(_,i)=>a+i);
const route=[...range(1,20),...range(5,20),...range(5,20)];
const verses=[
 '池塘边的榕树上知了在声声地叫着夏天操场边的秋千上只有蝴蝶停在上面黑板上老师的粉笔还在拼命唧唧喳喳写个不停等待着下课等待着放学等待游戏的童年',
 '总是要等到睡觉前才知道功课只做了一点点总是要等到考试以后才知道该念的书都没有念一寸光阴一寸金老师说过寸金难买寸光阴一天又一天一年又一年迷迷糊糊的童年',
 '阳光下蜻蜓飞过来一片片绿油油的稻田水彩蜡笔和万花筒画不出天边那一道彩虹什么时候才能像高年级的同学有张成熟与长大的脸盼望着假期盼望着明天盼望长大的童年'
];
test('新单页C调20小节：前奏弦品、延音空符干和低音分区扫弦',()=>{
 assert.equal(validateScore(data),true);assert.equal(data.bars.length,20);
 assert.equal(data.key,'C');assert.equal(data.fingeringKey,'C');assert.equal(data.capo,undefined);
 assert.deepEqual(Object.keys(data.chordShapes),['C','F','G','Am','Em','Dm']);assert.ok(Object.values(data.chordShapes).every(s=>!s.reference));
 const bars=expandBars(data);
 for(const b of bars)for(const events of [b.events,b.vocal.events])assert.equal(events.reduce((s,e)=>s+eventBeats(e),0),4,`第${b.number}小节4拍`);
 assert.deepEqual(bars[0].events.map(e=>e.duration),[8,8,8,8,8,8,4]);
 assert.deepEqual(bars[0].events.slice(-2).map(e=>[e.string,e.fret]),[[2,3],[2,3]]);
 assert.equal(bars[1].events.at(-1).string,3);assert.equal(bars[1].events.at(-1).fret,0);
 assert.deepEqual(bars[2].events.slice(-4).map(e=>[e.string,e.fret]),[[3,2],[3,0],[2,3],[1,0]]);
 for(const b of bars.slice(0,3)){assert.equal(b.events[1].kind,'up');assert.equal(b.events[1].tieToNext,true);assert.equal(b.events[2].kind,'hold');assert.equal(b.events[2].sourceStem,true);}
 assert.deepEqual([bars[3].events[0].startString,bars[3].events[0].endString],[5,1]);
 for(const b of bars.slice(4)){
  assert.deepEqual(b.events.map(e=>e.kind),['down','down','up','down','up','down','up']);
  assert.deepEqual(b.events.map(e=>e.duration),[4,8,8,8,8,8,8]);
  const bass={C:5,Am:5,F:4,G:6,Em:6,Dm:4}[b.chords[0].name];
  for(const i of [0,3])assert.deepEqual([b.events[i].startString,b.events[i].endString],[bass,3]);
  assert.ok(b.events.every(e=>!e.tieToNext));
 }
 const invalid=structuredClone(data);invalid.patterns['intro-c'][2].kind='down';assert.throws(()=>validateScore(invalid),/空符干/);
});
test('三行歌词依新图展开三遍，不沿用旧版五段歌词、跳尾和尾奏',()=>{
 for(let verse=0;verse<3;verse++){
  const text=data.bars.slice(4).map(b=>projectSimpleBar(data,b,{verse}).vocal.events.flatMap(e=>e.lyrics??[]).join('')).join('');
  assert.equal(text,verses[verse],`第${verse+1}段歌词`);
 }
 assert.deepEqual(data.bars[15].vocal.events[0].lyrics,['停','','脸'],'第二段“寸光阴”在前一小节结束，不能补入其他行歌词');
 assert.deepEqual(performanceOrder(data),route);assert.equal(route.length,52);
 assert.ok(data.bars[4].repeatStart);assert.ok(data.bars[19].repeatEnd);assert.ok(data.bars.every(b=>!b.volta));
 const sections=simpleSections(data),singing=sections.filter(s=>!s.full);
 assert.equal(simpleLyricLines(data,singing).flat(2).map(c=>c.token.lyrics.join('')).join(''),verses.join(''));
 for(const perRow of [2,4]){
  const simple=renderSimpleScore(data,perRow),full=renderScore(data,perRow);
  const ids=[...simple.matchAll(/id="(bar-[^"]+)"/g)].map(m=>m[1]);
  assert.equal(ids.length,52);assert.equal(new Set(ids).size,52);assert.ok(ids.includes('bar-20-repeat-3'));assert.ok(!ids.includes('bar-5-repeat-4'));
  assert.equal((simple.match(/<g class="measure"/g)||[]).length,4,'仅前奏4小节完整保留');
  assert.equal((full.match(/class="numbered-melody"/g)||[]).length,20);assert.equal((full.match(/class="tab-sustain-stem"/g)||[]).length,3);
  assert.doesNotMatch(full+simple,/<image|NaN|undefined|volta-label/);
 }
});
test('童年按C调播放52小节208拍，前奏延音不拨弦、演唱扫弦均重新发声',()=>{
 const playback=buildAccompanimentPlayback(data);assert.deepEqual(playback.sequence.map(s=>s.bar),route);assert.equal(playback.totalTicks,208*960);
 const importer=new alphaTab.importer.AlphaTexImporter();importer.initFromString(playback.tex,new alphaTab.Settings());
 const score=importer.readScore(),bars=score.tracks[0].staves[0].bars;
 assert.equal(score.masterBars.length,52);assert.equal(score.tempo,60);assert.equal(score.tracks[0].staves[0].capo,0);assert.ok(score.masterBars.every(b=>b.calculateDuration()===3840));
 assert.deepEqual(bars[0].voices[0].beats[0].notes.map(n=>n.realValue).sort((a,b)=>a-b),[48,52,55,60,64]);
 for(const b of bars.slice(0,3)){
  const beat=b.voices[0].beats[2];assert.ok(beat.notes.every(n=>n.isTieDestination));assert.equal(beat.brushType,alphaTab.model.BrushType.None);
 }
 for(const b of bars.slice(4))assert.ok(b.voices[0].beats.every(beat=>beat.notes.every(n=>!n.isTieDestination)));
 assert.deepEqual(playback.sequence.slice(-3).map(s=>[s.bar,s.visit]),[[18,3],[19,3],[20,3]]);
});
