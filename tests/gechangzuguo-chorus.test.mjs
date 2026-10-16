import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';
import * as alphaTab from '@coderline/alphatab';
import {expandBars,performanceOrder,validateScore,renderScore} from '../scripts/accompaniment-svg.mjs';
import {attachVocals,eventBeats} from '../scripts/numbered-notation.mjs';
import {renderSimpleScore} from '../scripts/simple-score.mjs';
import {buildAccompanimentPlayback} from '../scripts/accompaniment-playback.mjs';
const read=async suffix=>JSON.parse(await readFile(new URL('../score/gechangzuguo-chorus'+suffix+'.json',import.meta.url),'utf8'));
const data=attachVocals(await read(''),await read('-vocal'));
const words=bar=>bar.vocal.events.map(e=>e.lyrics?.join('')??'').join('');
const lyrics='五星红旗迎风飘扬胜利歌声多么响亮歌唱我们亲爱的祖国从今走向繁荣富强歌唱我们亲爱的祖国从今走向繁荣富强';
test('摘录至第15小节“强”，保留前奏及完整副歌，不纳入后续主歌',()=>{
 assert.equal(validateScore(data),true);assert.equal(data.scoreType,'chorus');assert.equal(data.bars.length,15);
 assert.deepEqual([data.key,data.fingeringKey,data.capo],['F','C',undefined]);
 assert.match(data.tempoText,/95 BPM/);
 assert.deepEqual(data.bars.map(b=>b.sourceBar),Array.from({length:15},(_,i)=>i+1));
 assert.equal(data.bars.map(words).join(''),lyrics);
 assert.equal(words(data.bars[2]),'五星');assert.equal(words(data.bars[14]),'强');
 for(const b of expandBars(data)){
  assert.equal(b.events.reduce((n,e)=>n+eventBeats(e),0),4);
  assert.equal(b.vocal.events.reduce((n,e)=>n+eventBeats(e),0),4);
 }
});
test('前奏休止、切分延音、明确品位、二分音符和低音换弦按原图保留',()=>{
 const bars=expandBars(data);
 assert.deepEqual(bars[0].events.map(e=>[e.kind,e.duration]),[['rest',4],['rest',4],['rest',4],['rest',8],['note',16],['note',16]]);
 assert.ok(bars[0].events.slice(-2).every(e=>e.string===3&&e.fret===0));
 assert.deepEqual(bars[1].events.filter(e=>e.tieToNext).map(e=>e.strings),[[5,3],[5,3]]);
 assert.deepEqual(bars[2].events.filter(e=>e.kind==='note').map(e=>[e.string,e.fret]),[[4,3],[4,0]]);
 assert.deepEqual(bars[2].events.at(-1),{kind:'pluck',strings:[5],duration:2});
 assert.deepEqual(bars[10].events.at(-1),{kind:'pluck',strings:[1],duration:2});
 assert.deepEqual(bars[7].events.map(e=>e.strings[0]),[5,3,2,3,4,3,2,3]);
 assert.deepEqual(bars[8].chords,[{beat:1,name:'G'},{beat:3,name:'Em'}]);
 assert.equal(data.bars[8].vocal.events.at(-1).octave,-1);
 for(const perRow of [2,4]){
  const full=renderScore(data,perRow),simple=renderSimpleScore(data,perRow);
  assert.equal((full.match(/class="numbered-melody"/g)||[]).length,15);
  assert.equal((full.match(/class="tab-half-stem"/g)||[]).length,2);
  assert.equal((simple.match(/<g class="measure"/g)||[]).length,3);
  assert.doesNotMatch(full+simple,/NaN|undefined|<image|volta-label/);
 }
});
test('按顺序播放15小节60拍，首小节保留静音等待，两处长音各持续两拍',()=>{
 const order=Array.from({length:15},(_,i)=>i+1);
 assert.deepEqual(performanceOrder(data),order);
 const playback=buildAccompanimentPlayback(data);
 assert.equal(playback.totalTicks,60*960);assert.deepEqual(playback.sequence.map(s=>s.bar),order);
 const importer=new alphaTab.importer.AlphaTexImporter();importer.initFromString(playback.tex,new alphaTab.Settings());
 const score=importer.readScore();assert.equal(score.masterBars.length,15);assert.equal(score.tempo,60);
 assert.ok(score.masterBars.every(b=>b.calculateDuration()===3840));
 const bars=score.tracks[0].staves[0].bars;
 assert.ok(bars[0].voices[0].beats.slice(0,4).every(b=>b.isRest));
 assert.equal(bars[0].voices[0].beats.at(-1).notes[0].realValue,55);
 for(const index of [2,10])assert.equal(bars[index].voices[0].beats.at(-1).duration,2);
});
