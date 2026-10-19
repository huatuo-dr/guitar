import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';
import * as alphaTab from '@coderline/alphatab';
import {expandBars,performanceOrder,validateScore,renderScore} from '../scripts/accompaniment-svg.mjs';
import {attachVocals,eventBeats} from '../scripts/numbered-notation.mjs';
import {renderSimpleScore} from '../scripts/simple-score.mjs';
import {buildAccompanimentPlayback} from '../scripts/accompaniment-playback.mjs';
const read=async suffix=>JSON.parse(await readFile(new URL('../score/wozhendeaishangni'+suffix+'.json',import.meta.url),'utf8'));
const data=attachVocals(await read(''),await read('-vocal'));
const order=[...Array.from({length:45},(_,i)=>i+1),...Array.from({length:22},(_,i)=>i+15),...Array.from({length:15},(_,i)=>i+46)];
const words=b=>b.vocal.events.flatMap(e=>e.lyrics??[]).join('');
test('四页60小节、E调夹4品、尾段升半音，歌词按原落点纠错',()=>{
 assert.equal(validateScore(data),true);assert.equal(data.bars.length,60);
 assert.deepEqual([data.key,data.fingeringKey,data.capo,data.sourceTempo],['E → F','C → C♯',4,75]);
 for(const b of expandBars(data))for(const events of [b.events,b.vocal.events])assert.ok(Math.abs(events.reduce((n,e)=>n+eventBeats(e),0)-4)<1e-8);
 const text=data.bars.map(words).join('');assert.doesNotMatch(text,/一只|发像/);assert.match(text,/一双会说话/);assert.match(text,/一双深情/);assert.match(text,/你的发香/);
 assert.equal(data.bars.slice(6,14).map(words).join(''),'你有一双会说话的眼睛你有善解人意的心不知天高地厚的我你的微笑总是让我为你着迷');
 assert.equal(data.bars.slice(14,28).map(words).join(''),'你有一双深情的眼睛你有融化冰雪的魔力从来不敢奢求的我你的美丽总是让我躲不过去什么原因你的发香总挥之不去我的世界什么时候开始昼夜难分翻天覆地来去都是因为想你喔喔喔喔喔');
});
test('逐弦延音、明确品位扫弦、全音符和末小节全休止可显示并播放',()=>{
 const full=renderScore(data,4);assert.equal((full.match(/class="pluck-tie"/g)||[]).length,3);
 assert.match(full,/tab-rest-whole/);assert.equal((full.match(/class="explicit-brush"/g)||[]).length,2);
 const playback=buildAccompanimentPlayback(data),importer=new alphaTab.importer.AlphaTexImporter();importer.initFromString(playback.tex,new alphaTab.Settings());
 const score=importer.readScore(),bars=score.tracks[0].staves[0].bars;
 assert.equal(score.masterBars.length,82);assert.ok(score.masterBars.every(b=>b.calculateDuration()===3840));
 const second=bars[1].voices[0].beats[1].notes;
 assert.equal(second.filter(n=>n.isTieDestination).length,2,'只延续高音两弦');
 assert.equal(second.filter(n=>!n.isTieDestination).length,1,'低音重新拨响');
 assert.ok(bars[4].voices[0].beats[0].duration===1);assert.ok(bars.at(-1).voices[0].beats[0].isRest);
 assert.equal(bars[0].voices[0].beats[0].notes[0].realValue,52,'C指法五弦3品夹4品为E3');
 const explicit=bars[31].voices[0].beats[7];assert.equal(explicit.notes.length,6);assert.ok(explicit.notes.some(n=>n.realValue===44),'原图Em全弦扫弦保留六弦空弦音高');
 const invalid=structuredClone(data);invalid.bars[3].chords.at(-1)[0]=5;assert.throws(()=>validateScore(invalid),/和弦/);
 const badTie=structuredClone(data);badTie.patterns.intro2[0].tieToNextStrings=[6];assert.throws(()=>validateScore(badTie),/延音/);
 assert.match(playback.tex,/\\capo 4/);assert.equal(playback.sourceTempo,75);
});
test('反复1–45 → 15–36 → 46–60共82小节，简易谱按实际顺序展开',()=>{
 assert.deepEqual(performanceOrder(data),order);
 const playback=buildAccompanimentPlayback(data);assert.deepEqual(playback.sequence.map(s=>s.bar),order);assert.equal(playback.totalTicks,328*960);
 for(const perRow of [2,4]){
  const full=renderScore(data,perRow),simple=renderSimpleScore(data,perRow);
  assert.equal((full.match(/class="numbered-melody"/g)||[]).length,60);
  assert.equal((simple.match(/<g class="measure"/g)||[]).length,19);
  assert.doesNotMatch(full+simple,/NaN|undefined|<image/);assert.doesNotMatch(simple,/volta-label/);assert.match(simple,/bar-15-repeat-2/);
 }
});
