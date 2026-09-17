import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import {expandBars,performanceOrder,validateScore,renderScore} from '../scripts/accompaniment-svg.mjs';
import {attachVocals,eventBeats} from '../scripts/numbered-notation.mjs';
const read=async name=>JSON.parse(await readFile(new URL('../score/'+name+'.json',import.meta.url),'utf8'));
test('空心47小节保留原谱扫弦、指法和反复跳尾',async()=>{
 const data=await read('kongxin');assert.equal(validateScore(data),true);
 assert.equal(data.capo,undefined);assert.match(data.capoText,/男声 5–7 品.*女声 0–2 品/);
 const bars=expandBars(data);assert.equal(bars.length,47);
 for(const b of bars)assert.equal(b.events.reduce((sum,e)=>sum+eventBeats(e),0),4,`第${b.number}小节`);
 assert.deepEqual(data.chordShapes.Fmaj7.frets,[0,0,3,2,1,0]);
 assert.deepEqual(data.chordShapes.Em7.frets,[0,2,2,0,3,0]);
 for(const n of [4,12]){
  assert.equal(bars[n-1].events[3].tieToNext,true);
  assert.deepEqual(bars[n-1].events[4],{kind:'hold',duration:4,sourceArrow:'up',startString:1,endString:5});
  assert.deepEqual(bars[n-1].events.at(-1),{kind:'arpeggio',duration:4,startString:6,endString:2});
 }
 assert.ok(bars[20].events.slice(0,2).every(e=>e.startString===6&&e.endString===3));
 for(const n of [39,40,41,47])assert.deepEqual(bars[n-1].events.map(e=>e.kind),['arpeggio','hold','hold','hold']);
 assert.equal(bars[4].repeatStart,true);assert.equal(bars[29].repeatEnd,true);
 assert.equal(bars[29].volta,1);assert.equal(bars[30].volta,2);assert.equal(bars[30].voltaEnd,undefined);
 const range=(a,b)=>Array.from({length:b-a+1},(_,i)=>i+a);
 assert.deepEqual(performanceOrder(data),[...range(1,30),...range(5,29),...range(31,47)]);
});
test('空心简谱保留十六分三连音、装饰音、双高八度与长延音',async()=>{
 const score=await read('kongxin'),vocals=await read('kongxin-vocal');
 const data=attachVocals(score,vocals);
 for(const b of data.bars)assert.ok(Math.abs(b.vocal.events.reduce((a,n)=>a+eventBeats(n),0)-4)<1e-8);
 const triplet=data.bars[23].vocal.events.filter(e=>e.tuplet===3);
 assert.equal(triplet.length,3);assert.ok(triplet.every(e=>e.duration===16));
 assert.equal(triplet.map(e=>e.lyrics[0]).join(''),'终究要');
 assert.ok(data.bars[19].vocal.events.some(e=>e.grace?.length));
 assert.ok(data.bars[25].vocal.events.some(e=>e.octave===2));
 assert.equal(data.bars[34].vocal.events.at(-1).lyrics[0],'一');
 assert.equal(data.bars[45].vocal.crossBarTieStart,0);
 for(const perRow of [2,4]){
  const svg=renderScore(data,perRow);
  assert.equal((svg.match(/class="measure"/g)||[]).length,47);
  assert.equal((svg.match(/class="numbered-melody"/g)||[]).length,47);
  assert.equal((svg.match(/class="tab-tie"/g)||[]).length,2);
  assert.match(svg,/class="melody-tuplet"/);assert.match(svg,/class="melody-grace"/);
  assert.doesNotMatch(svg,/NaN|undefined|<image/);
 }
 vocals.bars[45].crossBarTieStart=1;
 assert.throws(()=>attachVocals(score,vocals),/跨小节延音起点无效/);
});
