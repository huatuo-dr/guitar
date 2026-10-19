import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';
import * as alphaTab from '@coderline/alphatab';
import {expandBars,performanceOrder,validateScore,renderScore} from '../scripts/accompaniment-svg.mjs';
import {attachVocals,eventBeats} from '../scripts/numbered-notation.mjs';
import {renderSimpleScore} from '../scripts/simple-score.mjs';
import {buildAccompanimentPlayback} from '../scripts/accompaniment-playback.mjs';
const read=async suffix=>JSON.parse(await readFile(new URL('../score/airencuoguo'+suffix+'.json',import.meta.url),'utf8'));
const data=attachVocals(await read(''),await read('-vocal'));
const order=[1,2,3,4,5,6,7,8,1,2,3,4,5,6,...Array.from({length:58},(_,i)=>i+9),...Array.from({length:15},(_,i)=>i+27),67];
test('三页完整67小节，两声部均为四拍，C指法夹1品',()=>{
 assert.equal(validateScore(data),true);assert.equal(data.bars.length,67);
 assert.deepEqual([data.scoreType,data.key,data.fingeringKey,data.capo],['accompaniment','C♯','C',1]);
 for(const b of expandBars(data))for(const events of [b.events,b.vocal.events])assert.ok(Math.abs(events.reduce((n,e)=>n+eventBeats(e),0)-4)<1e-8);
 const words=data.bars.map(b=>b.vocal.events.map(e=>e.lyrics?.join('')??'').join(''));
 assert.equal(words.slice(10,26).join(''),'我肯定在几百年前就说过爱你只是你忘了我也没记起我肯定在几百年前就说过爱你只是你忘了我也没记起');
 assert.equal(words.slice(26,42).join(''),'走过路过没遇过回头转头还是错你我不曾感受过相撞在街口相撞在街口你妈没有告诉你撞到人要说对不起本来今天好好的爱人就错过爱人就错过Oh');
 assert.equal(words.slice(50).join(''),'我肯定在几百年前就说过爱你只是你忘了我也没记起我肯定在几百年前就说过爱你只是你忘了我也没记起就错过');
});
test('闷音圈叉和短促奏独立渲染，播放保留对应效果及切分延音',()=>{
 const full=renderScore(data,4);
 assert.equal((full.match(/class="tab-muted"/g)||[]).length,26);
 assert.equal((full.match(/class="tab-staccato"/g)||[]).length,30);
 const playback=buildAccompanimentPlayback(data);
 const importer=new alphaTab.importer.AlphaTexImporter();importer.initFromString(playback.tex,new alphaTab.Settings());
 const score=importer.readScore(),bars=score.tracks[0].staves[0].bars;
 assert.equal(score.masterBars.length,88);assert.ok(score.masterBars.every(b=>b.calculateDuration()===3840));
 assert.ok(bars[16].voices[0].beats.slice(1).every(b=>b.notes.length===1&&b.notes[0].isDead));
 assert.ok(bars[32].voices[0].beats[1].notes.every(n=>n.isStaccato));
 assert.ok(bars[32].voices[0].beats[5].notes.every(n=>n.isStaccato));
 assert.ok(bars[1].voices[0].beats[0].notes.every(n=>n.isTieDestination));
 assert.equal(bars[0].voices[0].beats[0].notes[0].realValue,54);
 const invalid=structuredClone(data);invalid.patterns.muted[0].string=7;
 assert.throws(()=>validateScore(invalid),/弦号/);
});
test('前奏双跳尾与副歌反复，简易谱与试听同步展开',()=>{
 assert.deepEqual(performanceOrder(data),order);
 assert.equal(data.bars[0].repeatStart,true);
 assert.deepEqual(data.bars.slice(6,10).map(b=>b.volta),['1','1','2','2']);
 assert.ok(data.bars[6].voltaStart&&data.bars[7].voltaEnd&&data.bars[7].repeatEnd);
 assert.ok(data.bars[8].voltaStart&&data.bars[9].voltaEnd);
 assert.equal(buildAccompanimentPlayback(data).sequence[8].id,'bar-1-repeat-2');
 const playback=buildAccompanimentPlayback(data);assert.deepEqual(playback.sequence.map(s=>s.bar),order);assert.equal(playback.totalTicks,352*960);
 assert.equal(playback.sequence[72].id,'bar-27-repeat-2');
 for(const perRow of [2,4]){
  const full=renderScore(data,perRow),simple=renderSimpleScore(data,perRow);
  assert.equal((full.match(/class="numbered-melody"/g)||[]).length,67);
  assert.equal((simple.match(/<g class="measure"/g)||[]).length,25);
  assert.doesNotMatch(full+simple,/NaN|undefined|<image/);
  assert.doesNotMatch(simple,/volta-label/);
  assert.equal((full.match(/class="chord-diagram"/g)||[]).length,34);
  assert.match(simple,/bar-27-repeat-2/);
 }
});
