import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import {expandBars,performanceOrder,validateScore,renderScore} from '../scripts/accompaniment-svg.mjs';
import {attachVocals,eventBeats} from '../scripts/numbered-notation.mjs';
const read=async suffix=>JSON.parse(await readFile(new URL(`../score/canon-v2${suffix}.json`,import.meta.url),'utf8'));
test('卡农版本2的9小节113音、36拍与C调简谱逐音一致',async()=>{
 const data=attachVocals(await read(''),await read('-vocal'));assert.equal(validateScore(data),true);
 const bars=expandBars(data);assert.equal(bars.length,9);assert.equal(data.tempoText,'60 拍/分钟');assert.equal(data.capo,undefined);
 assert.deepEqual(data.chordShapes,{});assert.ok(bars.every(b=>b.chords.length===0&&!b.repeatStart&&!b.repeatEnd));
 assert.deepEqual(performanceOrder(data),[1,2,3,4,5,6,7,8,9]);
 const tuning=[0,64,59,55,50,45,40],semitones=[0,0,2,4,5,7,9,11];
 for(const bar of bars){
  assert.equal(bar.events.reduce((s,e)=>s+eventBeats(e),0),4);assert.equal(bar.vocal.events.reduce((s,e)=>s+eventBeats(e),0),4);
  const melody=bar.vocal.events.filter(e=>!e.hold);
  assert.equal(bar.events.length,bar.number===9?1:14);
  assert.deepEqual(bar.events.map(e=>{assert.equal(e.notes.length,1);const n=e.notes[0];return tuning[n.string]+n.fret;}),melody.map(n=>48+12*(n.octave??0)+semitones[n.degree]));
  if(bar.number!==9)assert.deepEqual(bar.events.map(e=>e.duration),[8,16,16,8,...Array(10).fill(16)]);
 }
 assert.equal(bars.reduce((s,b)=>s+b.events.length,0),113);assert.deepEqual(bars[2].events,bars[6].events);
 assert.deepEqual(bars[8].events,[{kind:'fretted',duration:1,notes:[{string:2,fret:1}]}]);
 for(const rows of [2,4]){
  const svg=renderScore(data,rows);
  assert.match(svg,/viewBox="0 70 (600|1140) 202"/,'无和弦图时收起空白页头');
  assert.equal((svg.match(/class="fret"/g)||[]).length,113);assert.equal((svg.match(/class="whole-note"/g)||[]).length,1);
  assert.equal((svg.match(/class="measure"/g)||[]).length,9);assert.equal((svg.match(/class="numbered-melody"/g)||[]).length,9);
  assert.doesNotMatch(svg,/class="chord-diagram"|class="hammer"|class="slide-label"|NaN|undefined/);
 }
});
