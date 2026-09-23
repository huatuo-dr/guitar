import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import {expandBars,performanceOrder,validateScore,renderScore} from '../scripts/accompaniment-svg.mjs';
import {attachVocals,eventBeats} from '../scripts/numbered-notation.mjs';
const read=async name=>JSON.parse(await readFile(new URL('../score/'+name+'.json',import.meta.url),'utf8'));
test('后来按新四页截图重制69小节，前奏弦位与反复间奏完整',async()=>{
 const data=await read('houlai');assert.equal(data.bars.length,69);assert.equal(validateScore(data),true);
 assert.equal(data.capo,3);assert.equal(data.key,'E♭');assert.equal(data.fingeringKey,'C');
 assert.doesNotMatch(data.sourceTitle,/无限延音/);
 const bars=expandBars(data);
 for(const b of bars)assert.ok(Math.abs(b.events.reduce((a,e)=>a+eventBeats(e),0)-4)<1e-8,`第${b.number}小节`);
 assert.deepEqual(data.chordShapes['F(3)'].frets,[0,0,1,3,0,3]);
 assert.equal(data.chordShapes['F(3)'].baseFret??1,1,'按截图原样记录，不猜测第三把位');
 assert.deepEqual(bars[0].events[4].strings,[1,5]);
 assert.deepEqual(bars[2].events.slice(-4).map(e=>[e.string,e.fret,e.duration]),[[1,5,16],[1,3,16],[1,1,16],[1,0,16]]);
 assert.equal(bars[3].events[2].hammerToNext,true);assert.equal(bars[3].events[3].pullToNext,true);
 assert.deepEqual(bars[56].events.slice(-3).map(e=>[e.string,e.fret]),[[1,3],[1,1],[1,0]]);
 assert.deepEqual(bars.filter(b=>b.events.some(e=>e.tuplet===3)).map(b=>b.number),[57,58,59,61,62,63]);
 assert.equal(bars[61].events.filter(e=>e.tuplet===3).length,9);
 const range=(a,b)=>Array.from({length:b-a+1},(_,i)=>i+a);
 assert.deepEqual(performanceOrder(data),[...range(1,64),...range(45,55),...range(65,69)]);
 assert.deepEqual(data.bars.filter(b=>b.repeatStart).map(b=>b.number),[45]);
 assert.deepEqual(data.bars.filter(b=>b.repeatEnd).map(b=>b.number),[64]);
});
test('后来保留单行歌词、升还原号、四分三连音与简谱连线',async()=>{
 const data=attachVocals(await read('houlai'),await read('houlai-vocal'));
 for(const b of data.bars){
  assert.ok(Math.abs(b.vocal.events.reduce((a,n)=>a+eventBeats(n),0)-4)<1e-8);
  assert.ok(b.vocal.events.every(e=>(e.lyrics?.length??0)<=1));
 }
 for(const n of [23,24,39,40]){
  assert.ok(data.bars[n-1].vocal.events.some(e=>e.accidental==='#'));
  assert.ok(data.bars[n-1].vocal.events.some(e=>e.accidental==='n'));
 }
 const triplets=data.bars[67].vocal.events.filter(e=>e.tuplet===3);
 assert.equal(triplets.length,3);assert.ok(triplets.every(e=>e.duration===4));
 for(const perRow of [2,4]){
  const svg=renderScore(data,perRow);
  assert.equal((svg.match(/class="measure"/g)||[]).length,69);
  assert.equal((svg.match(/class="numbered-melody"/g)||[]).length,69);
  assert.equal((svg.match(/class="tab-tuplet"/g)||[]).length,8);
  assert.equal((svg.match(/class="melody-tuplet"/g)||[]).length,1);
  assert.match(svg,/class="hammer"[^>]*>P<\/text>/);
  assert.doesNotMatch(svg,/NaN|undefined|<image/);
 }
});

test('后来演唱段采用旧版分解和弦与扫弦，按两段主歌的乐句对应',async()=>{
 const data=await read('houlai'),bars=expandBars(data);
 const pick5=[[5],[3],[1,2],[3],[1,2],[3],[1,2],[3]];
 for(const n of [5,6,7,12,13,14,15,24,25,28,29,30,31,40,41,44]){
  assert.deepEqual(bars[n-1].events.map(e=>e.strings),pick5,`第${n}小节采用旧版五弦低音分解`);
  assert.ok(bars[n-1].events.every(e=>e.kind==='pluck'&&e.duration===8));
 }
 for(const n of [6,14,30])assert.deepEqual(data.bars[n-1].chords,[[1,'Em7/B']]);
 for(const n of [19,35,47,67])assert.deepEqual(data.bars[n-1].chords,[[1,'F']]);
 assert.deepEqual(data.bars[40].chords,[[1,'Am']],'第二段如果当时我们对应旧版Am');
 for(const n of [...Array.from({length:12},(_,i)=>45+i),...Array.from({length:5},(_,i)=>65+i)]){
  assert.deepEqual(bars[n-1].events.map(e=>[e.kind,e.duration,e.startString,e.endString]),[
   ['down',4,5,1],['down',8,5,1],['down',16,5,1],['up',16,1,5],
   ['down',4,5,1],['down',8,5,1],['down',16,5,1],['up',16,1,5]
  ],`第${n}小节采用旧版扫弦`);
 }
 assert.deepEqual(data.bars[44].chords,[[1,'F'],[3,'G']]);
 for(const n of [55,68])assert.deepEqual(data.bars[n-1].chords,[[1,'Dm'],[3,'G']]);
});
