import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';
import * as alphaTab from '@coderline/alphatab';
import {expandBars,performanceOrder,validateScore,renderScore} from '../scripts/accompaniment-svg.mjs';
import {attachVocals,eventBeats} from '../scripts/numbered-notation.mjs';
import {renderSimpleScore} from '../scripts/simple-score.mjs';
import {buildAccompanimentPlayback} from '../scripts/accompaniment-playback.mjs';
const read=async suffix=>JSON.parse(await readFile(new URL('../score/xiangnideye-chorus'+suffix+'.json',import.meta.url),'utf8'));
const data=attachVocals(await read(''),await read('-vocal'));
const words=bar=>bar.vocal.events.map(e=>e.lyrics?.join('')??'').join('');
test('仅摘录第二页前两行与第三行首小节，首尾删词不删音',()=>{
 assert.equal(validateScore(data),true);assert.equal(data.scoreType,'chorus');assert.equal(data.bars.length,11);
 assert.deepEqual([data.key,data.fingeringKey,data.capo],['♭E','C',3]);
 assert.deepEqual(data.bars.map(b=>b.sourceBar),Array.from({length:11},(_,i)=>i+17));
 assert.equal(words(data.bars[0]),'想你的');assert.equal(words(data.bars[10]),'点');
 assert.equal(data.bars[0].vocal.events.slice(0,-3).reduce((n,e)=>n+eventBeats(e),0),3);
 assert.deepEqual(data.bars[10].vocal.events.slice(-3).map(e=>[e.degree,e.octave,e.duration,e.tuplet]),[[1,1,8,3],[2,1,8,3],[1,1,8,3]]);
 assert.equal(data.bars.map(words).join(''),'想你的夜多希望你能在我身边不知道你心里还能否为我改变wo想你的夜求你让我再爱你一遍让爱再回到原点爱再回到原点');
 for(const b of expandBars(data)){
  assert.ok(Math.abs(b.events.reduce((n,e)=>n+eventBeats(e),0)-4)<1e-8);
  assert.ok(Math.abs(b.vocal.events.reduce((n,e)=>n+eventBeats(e),0)-4)<1e-8);
 }
});
test('原图伴奏弦位、换和弦、三连音和四分休止保持准确',()=>{
 const b=expandBars(data);
 assert.deepEqual(b[1].events.map(e=>e.strings),[[4,3,2,1],[3,2,1],[4,3,2,1],[3,2,1]]);
 assert.deepEqual(b[2].events[2].strings,[6,3,2,1]);
 assert.deepEqual(b[6].chords,[{beat:1,name:'Em7'},{beat:3,name:'Am'},{beat:4,name:'A'}]);
 assert.deepEqual(b[8].events.slice(0,5).map(e=>[e.strings[0],e.duration]),[[5,8],[3,8],[2,8],[1,8],[1,4]]);
 assert.equal(b[8].events[3].tieToNext,true);
 for(const i of [0,10])assert.deepEqual(b[i].events.at(-1),{kind:'rest',duration:4});
 assert.deepEqual(b[9].vocal.events.slice(-3).map(e=>[e.degree,e.duration]),[[7,16],[6,8],[7,16]]);
 for(const perRow of [2,4]){
  const full=renderScore(data,perRow);
  assert.equal((full.match(/class="numbered-melody"/g)||[]).length,11);
  assert.equal((full.match(/class="tab-rest tab-rest-quarter"/g)||[]).length,2);
  assert.doesNotMatch(full,/NaN|undefined|<image/);
 }
});
test('副歌两遍依次走两跳尾，简易谱与播放一致且变调夹3品生效',()=>{
 const order=[1,2,3,4,5,6,7,8,9,1,2,3,4,5,6,7,10,11];
 assert.deepEqual(performanceOrder(data),order);
 assert.ok(data.bars[0].repeatStart&&data.bars[8].repeatEnd);
 assert.ok(data.bars.every(b=>!b.volta&&!b.voltaStart&&!b.voltaEnd));
 assert.doesNotMatch(renderScore(data),/class="volta-label"/);
 for(const perRow of [2,4]){
  const simple=renderSimpleScore(data,perRow);
  assert.equal((simple.match(/<g class="measure"/g)||[]).length,2);
  assert.match(simple,/id="bar-1-repeat-2"/);assert.doesNotMatch(simple,/NaN|undefined|<image/);
 }
 const playback=buildAccompanimentPlayback(data);
 assert.equal(playback.totalTicks,72*960);assert.deepEqual(playback.sequence.map(s=>s.bar),order);
 const importer=new alphaTab.importer.AlphaTexImporter();importer.initFromString(playback.tex,new alphaTab.Settings());
 const score=importer.readScore();assert.equal(score.masterBars.length,18);assert.equal(score.tempo,60);
 assert.ok(score.masterBars.every(b=>b.calculateDuration()===3840));
 const bars=score.tracks[0].staves[0].bars;
 assert.equal(bars[0].voices[0].beats[0].notes[0].realValue,46);
 assert.equal(bars[0].voices[0].beats.at(-1).isRest,true);assert.equal(bars.at(-1).voices[0].beats.at(-1).isRest,true);
});
