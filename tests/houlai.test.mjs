import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import {expandBars,performanceOrder,validateScore,renderScore} from '../scripts/accompaniment-svg.mjs';
import {attachVocals,eventBeats} from '../scripts/numbered-notation.mjs';
const read=async name=>JSON.parse(await readFile(new URL('../score/'+name+'.json',import.meta.url),'utf8'));
test('后来49小节与原谱拍数、指法、前奏技法一致',async()=>{
 const data=await read('houlai');assert.equal(validateScore(data),true);
 assert.equal(data.capo,3);assert.equal(data.key,'E♭');assert.equal(data.fingeringKey,'C');
 const bars=expandBars(data);assert.equal(bars.length,49);
 for(const b of bars)assert.equal(b.events.reduce((a,e)=>a+eventBeats(e),0),4,`第${b.number}小节`);
 assert.deepEqual(data.chordShapes['F<5>'].frets,[5,8,7,5,6,5]);
 assert.equal(bars[2].events.filter(e=>e.pullToNext).length,2);
 assert.ok(bars[3].events.some(e=>e.duration===32&&e.hammerToNext));
 assert.deepEqual(bars[4].events.map(e=>e.strings),[[5],[3],[1,2],[3],[1,2],[3],[1,2],[3]]);
 const range=(a,b)=>Array.from({length:b-a+1},(_,i)=>i+a);
 assert.deepEqual(performanceOrder(data),[...range(1,28),...range(13,26),...range(29,43),...range(31,41),...range(44,49)]);
});
test('后来简谱保留双行歌词、三连音、降号与跨小节连线',async()=>{
 const data=attachVocals(await read('houlai'),await read('houlai-vocal'));
 for(const b of data.bars)assert.ok(Math.abs(b.vocal.events.reduce((a,n)=>a+eventBeats(n),0)-4)<1e-8);
 for(const n of [27,29])assert.equal(data.bars[n-1].vocal.events.filter(e=>e.tuplet===3).length,3);
 assert.ok(data.bars[22].vocal.events.some(e=>e.accidental==='b'));
 assert.equal(data.bars[12].vocal.events.filter(e=>e.lyrics?.[1]).map(e=>e.lyrics[1]).join(''),'那时候的爱情');
 for(const perRow of [2,4]){
  const svg=renderScore(data,perRow);
  assert.equal((svg.match(/class="measure"/g)||[]).length,49);
  assert.equal((svg.match(/class="numbered-melody"/g)||[]).length,49);
  assert.match(svg,/class="pluck-cross"/);assert.match(svg,/class="melody-tuplet"/);assert.match(svg,/class="melody-accidental"/);
  assert.match(svg,/class="hammer"[^>]*>P<\/text>/);
  assert.doesNotMatch(svg,/NaN|undefined|<image/);
 }
});
