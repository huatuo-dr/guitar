import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';
import * as alphaTab from '@coderline/alphatab';
import {expandBars,performanceOrder,validateScore,renderScore} from '../scripts/accompaniment-svg.mjs';
import {attachVocals,eventBeats} from '../scripts/numbered-notation.mjs';
import {renderSimpleScore} from '../scripts/simple-score.mjs';
import {buildAccompanimentPlayback} from '../scripts/accompaniment-playback.mjs';
const read=async suffix=>JSON.parse(await readFile(new URL('../score/ninameaita-chorus'+suffix+'.json',import.meta.url),'utf8'));
const data=attachVocals(await read(''),await read('-vocal'));
const words=b=>b.vocal.events.map(e=>e.lyrics?.join('')??'').join('');
test('选取第一页末行和第二页前两行加第三行首小节，共10小节',()=>{
 assert.equal(validateScore(data),true);assert.equal(data.bars.length,10);
 assert.deepEqual([data.scoreType,data.key,data.fingeringKey,data.capo],['chorus','♭B','G',3]);
 assert.deepEqual(data.bars.map(b=>b.sourceBar),Array.from({length:10},(_,i)=>i+13));
 assert.equal(words(data.bars[0]),'你那么爱');assert.equal(words(data.bars[9]),'拔');
 assert.equal(data.bars.map(words).join(''),'你那么爱她为什么不把她留下为什么不说心里话你深爱她这是每个人都知道啊你那么爱她为什么不把她留下是不是你有深爱的两个她所以你不想再让自己无法自拔');
 for(const b of expandBars(data))for(const events of [b.events,b.vocal.events])assert.ok(Math.abs(events.reduce((n,e)=>n+eventBeats(e),0)-4)<1e-8);
});
test('引入拨弦、扫弦范围、Gadd9第三拍起和弦与收尾明确品位准确',()=>{
 const b=expandBars(data);
 assert.deepEqual(b[0].events.slice(0,4).map(e=>e.strings),[[4],[3],[1,2],[3]]);
 assert.deepEqual(b[1].events.map(e=>e.duration),[8,8,8,16,16,8,8,8,16,16]);
 assert.deepEqual(b[2].events[5],{kind:'down',duration:8,startString:5,endString:3});
 assert.deepEqual(b[4].events[5],{kind:'down',duration:8,startString:4,endString:2});
 assert.deepEqual(b[9].events.slice(0,4).map(e=>[e.string,e.fret]),[[6,3],[4,0],[2,1],[3,2]]);
 assert.deepEqual(data.bars[9].chords,[[3,'Gadd9']]);
 assert.deepEqual(b[9].events[4],{kind:'arpeggio',duration:4,startString:6,endString:2});
 const invalid=structuredClone(data);invalid.patterns.ending[0]={kind:'pluck',strings:[6],duration:8};
 assert.throws(()=>validateScore(invalid),/和弦/,'依赖和弦的拨弦不能早于首个和弦');
 assert.deepEqual(data.chordShapes['D/F#'].frets,[2,-1,0,2,3,2]);
 assert.deepEqual(data.chordShapes.Bm7.frets,[-1,2,4,2,3,2]);
 assert.ok([1,2,5].every(i=>data.bars[i].vocal.events.at(-1).tieToNext));
 assert.equal(data.bars[1].vocal.events[6].tieToNext,undefined);
 assert.equal(data.bars[5].vocal.events[6].tieToNext,true,'两次“把她留下”的原图弧线差异保留');
});
test('无范围外跳转，完整谱、简易谱与播放均顺序演奏10小节',()=>{
 const order=Array.from({length:10},(_,i)=>i+1);
 assert.deepEqual(performanceOrder(data),order);assert.ok(data.bars.every(b=>!b.repeatStart&&!b.repeatEnd&&!b.volta));
 for(const perRow of [2,4]){
  const full=renderScore(data,perRow),simple=renderSimpleScore(data,perRow);
  assert.equal((full.match(/class="numbered-melody"/g)||[]).length,10);
  assert.equal((simple.match(/<g class="measure"/g)||[]).length,2);
  assert.doesNotMatch(full+simple,/NaN|undefined|<image|volta-label|-repeat-/);
 }
 const playback=buildAccompanimentPlayback(data);assert.equal(playback.totalTicks,40*960);
 const importer=new alphaTab.importer.AlphaTexImporter();importer.initFromString(playback.tex,new alphaTab.Settings());
 const score=importer.readScore();assert.equal(score.masterBars.length,10);assert.equal(score.tempo,60);
 assert.ok(score.masterBars.every(b=>b.calculateDuration()===3840));
 const bars=score.tracks[0].staves[0].bars;
 assert.equal(bars[0].voices[0].beats[0].notes[0].realValue,53);
 assert.equal(bars[9].voices[0].beats[0].notes[0].realValue,46);
});
