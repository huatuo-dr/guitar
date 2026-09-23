import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import {expandBars,performanceOrder,validateScore,renderScore} from '../scripts/accompaniment-svg.mjs';
import {attachVocals,eventBeats} from '../scripts/numbered-notation.mjs';
const read=async suffix=>JSON.parse(await readFile(new URL(`../score/turanhaoxiangni${suffix}.json`,import.meta.url),'utf8'));
test('突然好想你替换为革命吉他三页55小节，各声部4拍并保留一二房子',async()=>{
 const source=await read(''),vocals=await read('-vocal'),data=attachVocals(source,vocals);
 assert.equal(data.bars.length,55);assert.equal(validateScore(data),true);
 assert.match(data.sourceTitle,/革命吉他/);assert.equal(data.key,'D');assert.equal(data.fingeringKey,'C');assert.equal(data.capo,2);
 for(const b of expandBars(data))for(const events of [b.events,b.vocal.events])assert.equal(events.reduce((a,e)=>a+eventBeats(e),0),4,`第${b.number}小节`);
 assert.equal(Object.keys(data.chordShapes).length,11);
 assert.deepEqual(data.chordShapes.Fm.frets,[1,3,3,1,1,1]);
 assert.deepEqual(data.chordShapes['Am7/G'].frets,[3,0,2,0,1,0]);
 const range=(a,b)=>Array.from({length:b-a+1},(_,i)=>i+a);
 assert.deepEqual(performanceOrder(data),[...range(1,12),...range(5,11),...range(13,55)]);
 assert.deepEqual(data.bars.filter(b=>b.repeatEnd).map(b=>b.number),[12]);
 assert.deepEqual(data.bars.filter(b=>b.repeatStart).map(b=>b.number),[5]);assert.equal(data.bars[11].volta,1);assert.equal(data.bars[12].volta,2);
});
test('突然好想你按新图保留前奏品位、三弦同音延音、尾声与双行歌词',async()=>{
 const data=attachVocals(await read(''),await read('-vocal')),bars=expandBars(data);
 assert.deepEqual(bars[0].events.filter(e=>e.kind==='note').map(e=>[e.string,e.fret]),[[1,3],[1,1],[1,0],[2,3],[2,1]]);
 assert.equal(bars[2].events[6].notes[0].tieToNext,true);
 assert.deepEqual(bars[3].events.filter(e=>e.kind==='fretted').map(e=>e.notes),[[{string:2,fret:1},{string:3,fret:0}],[{string:2,fret:0},{string:3,fret:0}]]);
 assert.equal(bars[4].vocal.events.map(e=>e.lyrics?.[1]??'').join(''),'念如果会有声音');
 assert.equal(bars[12].vocal.events[0].lyrics[0],'己');
 assert.ok(bars[54].vocal.events.every(e=>e.degree===0));
 assert.deepEqual(bars[54].events.map(e=>e.kind),['arpeggio','hold','hold','hold']);
 assert.equal(bars[52].crossBarTieStart,2);assert.equal(bars[53].events[0].sourceArrow,'arpeggio');assert.equal(bars[53].events[0].kind,'hold');
 assert.deepEqual(data.chordShapes['G/B'].frets,[0,2,0,0,3,0]);
 for(const n of [23,44])assert.deepEqual(bars[n-1].events[1].strings,[4]);
 assert.ok(bars.flatMap(b=>b.events).every(e=>!e.hammerToNext&&!e.slideToNext));
 for(const perRow of [2,4]){
  const svg=renderScore(data,perRow);
  assert.equal((svg.match(/class="measure"/g)||[]).length,55);
  assert.equal((svg.match(/class="numbered-melody"/g)||[]).length,55);
  assert.doesNotMatch(svg,/NaN|undefined|<image|class="slide-label"|class="hammer"|class="melody-accidental"/);
 }
});
