import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';
import * as alphaTab from '@coderline/alphatab';
import {expandBars,performanceOrder,validateScore,renderScore} from '../scripts/accompaniment-svg.mjs';
import {attachVocals,eventBeats} from '../scripts/numbered-notation.mjs';
import {renderSimpleScore} from '../scripts/simple-score.mjs';
import {buildAccompanimentPlayback} from '../scripts/accompaniment-playback.mjs';
const read=async suffix=>JSON.parse(await readFile(new URL('../score/hongsegaogenxie-chorus'+suffix+'.json',import.meta.url),'utf8'));
const data=attachVocals(await read(''),await read('-vocal'));
const words=b=>b.vocal.events.flatMap(e=>e.lyrics??[]).join('');
const order=Array.from({length:28},(_,i)=>i+1);
const expectedWords='该怎么去形容你最贴切拿什么跟你做比较才算特别对你的感觉强烈却又不太了解只凭直觉你像窝在被子里的舒服却又像风捉摸不住像手腕上散发的香水味像爱不释手的呢红色高跟鞋';
test('只保留8小节前奏与20小节反复内内容，按用户确认演奏一次',()=>{
 assert.equal(validateScore(data),true);assert.equal(data.bars.length,28);
 assert.deepEqual([data.scoreType,data.key,data.fingeringKey,data.capo],['chorus','D','C',2]);
 assert.equal(data.bars.filter(b=>b.sourcePage===1).length,17);
 assert.deepEqual(performanceOrder(data),order);assert.ok(data.bars.every(b=>!b.repeatStart&&!b.repeatEnd&&!b.volta));
 assert.equal(data.bars.map(words).join(''),expectedWords);
 assert.ok(data.bars.slice(0,8).every(b=>words(b)===''));assert.ok(data.bars.slice(24).every(b=>words(b)===''));
 assert.deepEqual(Object.keys(data.chordShapes),['F','G','Am','C']);
 for(const b of expandBars(data))for(const events of [b.events,b.vocal.events])assert.ok(Math.abs(events.reduce((n,e)=>n+eventBeats(e),0)-4)<1e-8);
});
test('扫弦弦区、Am过门、休止、简谱装饰音与跨小节延音准确',()=>{
 const bars=expandBars(data);
 assert.deepEqual(bars[0].chords,[{beat:1,name:'F'},{beat:3,name:'G'}]);
 assert.deepEqual(bars[0].events.map(e=>[e.startString,e.endString]),[[6,4],[6,4],[6,2],[6,4],[6,4],[6,4],[6,2],[6,4]]);
 for(const i of [1,3,25,27])assert.deepEqual(bars[i].events.slice(4).map(e=>e.notes.map(n=>[n.string,n.fret])),[0,1,0,1].map(f=>[[4,2],[3,2],[2,f]]));
 assert.deepEqual(bars[8].events.map(e=>e.duration),[8,8,8,16,16,8,8,8,16,16]);
 assert.deepEqual(bars[9].events.map(e=>e.duration),[8,8,8,16,16,16,16,8,8,16,16]);
 assert.deepEqual(bars[13].chords,[{beat:1,name:'C'},{beat:3,name:'Am'}]);
 assert.deepEqual(bars[23].events.slice(-2),[{kind:'rest',duration:8},{kind:'rest',duration:4}]);
 assert.deepEqual(data.bars[18].vocal.events[2].grace,[{degree:5,octave:1}]);
 for(const i of [8,10,11,13,14,15,16,17,18,19,20,22])assert.ok(data.bars[i].vocal.events.at(-1).tieToNext);
 assert.ok(data.bars[23].vocal.events.at(-1).slurToNext);assert.equal(data.bars[24].vocal.events[0].degree,6);
});
test('P.M.保留实际音高并在第4、28小节第3拍放开，播放112拍',()=>{
 const playback=buildAccompanimentPlayback(data);assert.equal(playback.totalTicks,112*960);assert.deepEqual(playback.sequence.map(s=>s.bar),order);
 const importer=new alphaTab.importer.AlphaTexImporter();importer.initFromString(playback.tex,new alphaTab.Settings());const parsed=importer.readScore();
 assert.equal(parsed.masterBars.length,28);assert.equal(parsed.tempo,60);assert.ok(parsed.masterBars.every(b=>b.calculateDuration()===3840));
 const bars=parsed.tracks[0].staves[0].bars;
 for(const i of [0,1,2,24,25,26])assert.ok(bars[i].voices[0].beats.every(b=>b.notes.length>0&&b.notes.every(n=>n.isPalmMute&&!n.isDead)),'闷音是保留音高的掌根制音');
 for(const i of [3,27]){
  assert.ok(bars[i].voices[0].beats.slice(0,4).every(b=>b.notes.every(n=>n.isPalmMute)));
  assert.ok(bars[i].voices[0].beats.slice(4).every(b=>b.notes.every(n=>!n.isPalmMute)));
 }
 assert.ok(bars[4].voices[0].beats.every(b=>b.notes.every(n=>!n.isPalmMute)));
 assert.equal(bars[0].voices[0].beats[0].notes[0].realValue,43,'F低音夹2品为G2');
 const invalid=structuredClone(data);invalid.patterns['g-pause'].at(-1).palmMute=true;assert.throws(()=>validateScore(invalid),/闷音/);
 for(const perRow of [2,4]){
  const full=renderScore(data,perRow),simple=renderSimpleScore(data,perRow);
  assert.equal((full.match(/class="numbered-melody"/g)||[]).length,28);assert.equal((simple.match(/<g class="measure"/g)||[]).length,12);
  assert.doesNotMatch(full+simple,/NaN|undefined|<image|volta-label|-repeat-/);assert.match(full,/P.M./);
 }
});
test('补充图3–6替换前奏5–8：扫弦击弦装饰与Am提前换和弦、跨小节延音',()=>{
 const bars=expandBars(data),pairs=e=>e.notes.map(n=>[n.string,n.fret]);
 for(const i of [4,6]){
  const b=bars[i];assert.deepEqual(b.chords,[{beat:1,name:'F'},{beat:3,name:'G'},{beat:4.5,name:'Am'}]);
  assert.deepEqual(b.events.map(e=>e.duration),Array(8).fill(8));
  assert.deepEqual(b.chordShapes.F.frets,[1,3,3,2,1,-1]);assert.deepEqual(b.chordShapes.G.frets,[3,-1,0,0,0,-1]);
  assert.deepEqual(pairs(b.events[0]),[[6,1],[5,3],[4,3]]);
  assert.deepEqual(pairs(b.events[2].graceChord),[[5,3],[4,3],[3,0],[2,1]]);
  assert.deepEqual(pairs(b.events[4].graceChord),[[4,0],[3,0],[2,0]]);
  for(const index of [2,4]){assert.equal(b.events[index].string,3);assert.equal(b.events[index].fret,2);assert.ok(b.events[index].graceChord.notes.find(n=>n.string===3).hammerToNext);}
  assert.deepEqual(pairs(b.events[5]),[[6,3],[4,0]]);
  assert.ok(b.events.at(-1).notes.every(n=>n.tieToNext));
  const next=bars[i+1];assert.deepEqual(pairs(b.events.at(-1)),pairs(next.events[0]));assert.ok(next.events[0].notes.every(n=>n.tie));assert.equal(next.events[0].brush,undefined);
  assert.deepEqual(next.events.map(e=>e.duration),[8,8,8,16,16,8,8,8,8]);assert.equal(next.events[4].brush,'up');
  assert.deepEqual(next.events.slice(5).map(e=>e.notes.find(n=>n.string===2).fret),[0,1,0,1]);
 }
 const importer=new alphaTab.importer.AlphaTexImporter();importer.initFromString(buildAccompanimentPlayback(data).tex,new alphaTab.Settings());const parsed=importer.readScore().tracks[0].staves[0].bars;
 for(const i of [4,6]){
  const beats=parsed[i].voices[0].beats,graces=beats.filter(b=>b.graceType!==0);
  assert.equal(graces.length,2);assert.equal(beats.filter(b=>b.graceType===0).length,8);
  assert.ok(graces.every(b=>b.notes.find(n=>n.string===4).isHammerPullOrigin));
  assert.ok(parsed[i+1].voices[0].beats[0].notes.every(n=>n.isTieDestination),'延音不能重新拨弦');
 }
 for(const perRow of [2,4]){
  for(const svg of [renderScore(data,perRow),renderSimpleScore(data,perRow)]){
   assert.equal((svg.match(/class="tab-grace-chord"/g)||[]).length,4);
   assert.equal((svg.match(/>\([012]\)<\/text>/g)||[]).length,10);
  }
 }
 const invalid=structuredClone(data);invalid.patterns['intro-hammer'][2].graceChord.notes[0].string=3;assert.throws(()=>validateScore(invalid),/装饰和弦/);
});
