import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';
import * as alphaTab from '@coderline/alphatab';
import {expandBars,performanceOrder,validateScore,renderScore} from '../scripts/accompaniment-svg.mjs';
import {attachVocals,eventBeats} from '../scripts/numbered-notation.mjs';
import {renderSimpleScore} from '../scripts/simple-score.mjs';
import {buildAccompanimentPlayback} from '../scripts/accompaniment-playback.mjs';
const read=async suffix=>JSON.parse(await readFile(new URL('../score/jiayibingding-chorus'+suffix+'.json',import.meta.url),'utf8'));
const data=attachVocals(await read(''),await read('-vocal'));
const lyrics='是你教我勇敢让我绚烂却把我丢在原地不堪你我怎么两清怎么忍心怎么做回甲乙丙丁难道非要耗尽所有委屈再赔上这一条烂命爱情这场酷刑教人看清爱与不爱之间的差距若我落下泪滴能否换来一点同情';
test('仅副歌范围、完整引入伴奏及最后“是你”歌词准确',()=>{
 assert.equal(data.scoreType,'chorus');assert.equal(data.bars.length,15);assert.equal(validateScore(data),true);
 assert.deepEqual([data.key,data.fingeringKey,data.capo],['F','C',5]);
 assert.deepEqual(data.bars.map(b=>b.sourceBar),Array.from({length:15},(_,i)=>i+14));
 const bars=expandBars(data);
 assert.deepEqual(bars[0].events.map(e=>e.strings[0]),[6,4,3,2,1,3,2,3,6,4,3,2,1,3,2,3]);
 assert.ok(bars[0].events.every(e=>e.duration===16));
 const pickup=data.bars[0].vocal.events;
 assert.equal(pickup.map(e=>e.lyrics?.join('')??'').join(''),'是你');
 assert.equal(pickup.slice(0,-2).reduce((n,e)=>n+eventBeats(e),0),3.5);
 assert.deepEqual(pickup.slice(-2).map(e=>[e.degree,e.octave,e.duration,e.lyrics[0]]),[[1,1,16,'是'],[6,0,16,'你']]);
 for(const b of bars){assert.equal(b.events.reduce((n,e)=>n+eventBeats(e),0),4);assert.equal(b.vocal.events.reduce((n,e)=>n+eventBeats(e),0),4);}
 assert.equal(data.bars.flatMap(b=>b.vocal.events).map(e=>e.lyrics?.join('')??'').join(''),lyrics);
 assert.ok(data.bars.slice(11).every(b=>b.vocal.events.every(e=>e.degree===0)));
 assert.deepEqual(data.chordShapes.Fmaj7.frets,[1,0,3,2,1,0]);
 assert.deepEqual(data.bars[1].chords,[[1,'Dm7'],[3,'D7']]);
 assert.deepEqual(data.bars[14].chords,[[1,'Gsus4'],[3,'G']]);
});
test('摘录单次路线、完整和简易视图保留引入及器乐',()=>{
 assert.deepEqual(performanceOrder(data),Array.from({length:15},(_,i)=>i+1));
 assert.ok(data.bars.every(b=>!b.repeatStart&&!b.repeatEnd&&!b.volta));
 for(const perRow of [2,4]){
  const full=renderScore(data,perRow),simple=renderSimpleScore(data,perRow);
  assert.equal((full.match(/class="numbered-melody"/g)||[]).length,15);
  assert.equal((simple.match(/<g class="measure"/g)||[]).length,5);
  assert.doesNotMatch(full+simple,/NaN|undefined|<image/);
 }
});
test('播放15小节60拍，变调夹5品生效',()=>{
 const playback=buildAccompanimentPlayback(data);
 assert.equal(playback.totalTicks,60*960);assert.equal(playback.sequence.length,15);
 const importer=new alphaTab.importer.AlphaTexImporter();importer.initFromString(playback.tex,new alphaTab.Settings());
 const score=importer.readScore();assert.equal(score.masterBars.length,15);assert.equal(score.tempo,60);
 assert.ok(score.masterBars.every(b=>b.calculateDuration()===3840));
 assert.equal(score.tracks[0].staves[0].bars[0].voices[0].beats[0].notes[0].realValue,45);
});
