import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import {expandBars,performanceOrder,validateScore,renderScore} from '../scripts/accompaniment-svg.mjs';
import {attachVocals,eventBeats} from '../scripts/numbered-notation.mjs';
const read=async suffix=>JSON.parse(await readFile(new URL(`../score/turanhaoxiangni${suffix}.json`,import.meta.url),'utf8'));
test('突然好想你62小节完整、各声部4拍，保留原谱反复与不同指法',async()=>{
 const source=await read(''),vocals=await read('-vocal');const data=attachVocals(source,vocals);
 assert.equal(validateScore(data),true);assert.equal(data.bars.length,62);
 assert.equal(data.key,'D');assert.equal(data.fingeringKey,'C');assert.equal(data.capo,2);
 for(const b of expandBars(data))for(const events of [b.events,b.vocal.events])assert.equal(events.reduce((a,e)=>a+eventBeats(e),0),4,`第${b.number}小节`);
 assert.deepEqual(data.chordShapes["G'"].frets,[3,2,0,0,3,3]);
 assert.deepEqual(data.chordShapes['G(3)'],{frets:[3,5,5,4,3,3],baseFret:3});
 assert.deepEqual(data.chordShapes.Fm.frets,[-1,-1,3,1,1,1]);
 assert.deepEqual(data.chordShapes["Fm'"].frets,[1,3,3,1,1,1]);
 const range=(a,b)=>Array.from({length:b-a+1},(_,i)=>i+a);
 assert.deepEqual(performanceOrder(data),[...range(1,12),...range(5,11),...range(13,62)]);
 assert.equal(data.bars[13].repeatStart,true);assert.deepEqual(data.bars.filter(b=>b.repeatEnd).map(b=>b.number),[12]);
 assert.match(data.routeNote,/缺少终止/);
});
test('突然好想你保留双附点、击弦、滑音、休止及前后奏',async()=>{
 const data=attachVocals(await read(''),await read('-vocal')),bars=expandBars(data);
 for(const n of [11,28,52,56])assert.equal(bars[n-1].vocal.events[0].doubleDotted,true);
 assert.equal(bars[11].events.filter(e=>e.hammerToNext).length,1);
 assert.equal(bars[12].events[5].kind,'rest');
 assert.deepEqual(bars[12].events.slice(-2).map(e=>[e.string,e.fret]),[[6,12],[6,0]]);
 assert.equal(bars[12].events.at(-2).slideToNext,true);
 assert.ok([bars[55].events[0],bars[55].events[2]].every(e=>e.startString===5&&e.endString===1));
 assert.equal(bars[55].events.at(-1).tieToNext,true);assert.equal(bars[55].vocal.events.at(-1).tieToNext,true);
 for(const n of [17,41])assert.ok(bars[n-1].events.some(e=>e.kind==='hold'&&e.sourceArrow==='down'));
 assert.equal(bars[0].vocal.parenthesisStart,true);assert.equal(bars[3].vocal.parenthesisEndAt,4);
 assert.equal(bars[57].vocal.parenthesisStart,true);assert.equal(bars[61].vocal.parenthesisEnd,true);
 assert.equal(bars[60].vocal.events[0].accidental,'b');
 assert.equal(bars[12].vocal.events[0].lyrics[0],'己');
 assert.equal(bars[4].vocal.events.map(e=>e.lyrics?.[1]??'').join(''),'念如果会有声音');
 for(const perRow of [2,4]){
  const svg=renderScore(data,perRow);
  assert.equal((svg.match(/class="measure"/g)||[]).length,62);
  assert.equal((svg.match(/class="numbered-melody"/g)||[]).length,62);
  assert.equal((svg.match(/class="tab-rest"/g)||[]).length,1);
  assert.match(svg,/class="slide-label"[^>]*>S<\/text>/);assert.doesNotMatch(svg,/NaN|undefined|<image/);
 }
});
