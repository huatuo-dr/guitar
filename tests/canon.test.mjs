import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import {expandBars,performanceOrder,validateScore,renderScore} from '../scripts/accompaniment-svg.mjs';
import {attachVocals,eventBeats} from '../scripts/numbered-notation.mjs';
const read=async suffix=>JSON.parse(await readFile(new URL(`../score/canon${suffix}.json`,import.meta.url),'utf8'));
test('卡农56小节六线谱和简谱各4拍，完整保留四组反复',async()=>{
 const data=attachVocals(await read(''),await read('-vocal'));assert.equal(validateScore(data),true);
 const bars=expandBars(data);assert.equal(bars.length,56);
 for(const bar of bars)for(const events of [bar.events,bar.vocal.events])assert.equal(events.reduce((a,e)=>a+eventBeats(e),0),4,`第${bar.number}小节`);
 assert.equal(data.key,'C');assert.equal(data.capo,undefined);assert.equal(data.tempoText,'60–65 拍/分钟');
 const range=(a,b)=>Array.from({length:b-a+1},(_,i)=>a+i);
 assert.deepEqual(performanceOrder(data),[[1,16],[13,15],[17,21],[18,19],[22,27],[24,27],[28,51],[48,51],[52,56]].flatMap(([a,b])=>range(a,b)));
 assert.deepEqual(bars.filter(b=>b.repeatStart).map(b=>b.number),[13,18,24,48]);
 assert.deepEqual(bars.filter(b=>b.repeatEnd).map(b=>b.number),[16,21,27,51]);
 assert.deepEqual(bars.filter(b=>b.volta===1).map(b=>b.number),[16,20,21]);assert.deepEqual(bars.filter(b=>b.volta===2).map(b=>b.number),[17,22,23]);
});
test('卡农逐弦品数与H/P/S、末尾琶音不遗漏',async()=>{
 const data=attachVocals(await read(''),await read('-vocal'));const bars=expandBars(data);
 const all=bars.flatMap(b=>b.events.flatMap(e=>e.notes??[]));
 assert.equal(all.length,742);assert.equal(all.filter(n=>n.hammerToNext).length,20);assert.equal(all.filter(n=>n.pullToNext).length,3);assert.equal(all.filter(n=>n.slideToNext).length,1);
 assert.deepEqual(bars[0].events[0].notes.map(n=>[n.string,n.fret]),[[1,0],[2,1],[3,0],[5,3]]);
 assert.ok(bars[14].events[0].notes.some(n=>n.string===4&&n.fret===3));
 assert.deepEqual(bars[55].events,[{kind:'arpeggio',startString:5,endString:2,duration:4},{kind:'hold',duration:4},{kind:'hold',duration:4},{kind:'hold',duration:4}]);
 assert.match(data.vocalNotes.join(''),/第25小节/);assert.equal(bars[31].vocal.events[0].octave??0,0);
 for(const n of [52,53,54,55])assert.ok(bars[n-1].vocal.events.every(e=>e.degree===0));
 for(const perRow of [2,4]){
  const svg=renderScore(data,perRow);
  assert.equal((svg.match(/class="measure"/g)||[]).length,56);assert.equal((svg.match(/class="fret"/g)||[]).length,742);
  assert.equal((svg.match(/class="numbered-melody"/g)||[]).length,56);
  assert.equal((svg.match(/class="hammer"[^>]*>H<\/text>/g)||[]).length,20);
  assert.equal((svg.match(/class="hammer"[^>]*>P<\/text>/g)||[]).length,3);
  assert.equal((svg.match(/class="slide-label"[^>]*>S<\/text>/g)||[]).length,1);
  assert.doesNotMatch(svg,/NaN|undefined|<image|class="lyric"/);
 }
});
