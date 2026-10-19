import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';
import * as alphaTab from '@coderline/alphatab';
import {expandBars,performanceOrder,validateScore,renderScore} from '../scripts/accompaniment-svg.mjs';
import {attachVocals,eventBeats} from '../scripts/numbered-notation.mjs';
import {renderSimpleScore,projectSimpleBar} from '../scripts/simple-score.mjs';
import {buildAccompanimentPlayback} from '../scripts/accompaniment-playback.mjs';
const read=async suffix=>JSON.parse(await readFile(new URL('../score/chuxianyoulikai-chorus'+suffix+'.json',import.meta.url),'utf8'));
const data=attachVocals(await read(''),await read('-vocal'));
const order=Array.from({length:44},(_,i)=>i%22+1);
const words=b=>b.vocal.events.flatMap(e=>e.lyrics??[]).join('');
test('第一页全部19小节及第二页前三小节，保留两行主歌和共同副歌',()=>{
 assert.equal(validateScore(data),true);assert.equal(data.bars.length,22);
 assert.deepEqual([data.scoreType,data.key,data.fingeringKey,data.capo],['chorus','A','G',2]);
 assert.equal(data.bars.filter(b=>b.sourcePage===1).length,19);
 const verse=v=>data.bars.slice(4,13).map(b=>words(projectSimpleBar(data,b,{verse:v}))).join('');
 assert.equal(verse(0),'我跟你本应该各自好各自坏各自生活的自在毫无关联的存在直到你出现在我眼中躲不开我也占领你的心海充实着你的空白');
 assert.equal(verse(1),'我和你不应该制造感觉表达爱试探未知和未来相信那胡言一派当天空暗下来当周围又安静起来当我突然梦里醒来就等着太阳出来');
 assert.equal(data.bars.slice(13).map(words).join(''),'为何出现在彼此的生活又离开只留下在心里深深浅浅的表白谁也没有想过再更改谁也没有想过再想回来Oh我不明白');
 assert.ok(data.bars.every(b=>!b.volta));assert.ok(data.bars[0].repeatStart&&data.bars.at(-1).repeatEnd);
});
test('首小节补三拍休止至4拍，保留两拍过渡与装饰音',()=>{
 const expanded=expandBars(data);
 for(const b of expanded)for(const events of [b.events,b.vocal.events])assert.ok(Math.abs(events.reduce((n,e)=>n+eventBeats(e),0)-b.beats)<1e-8);
 assert.equal(expanded[0].beats,4);assert.equal(expanded[12].beats,2);
 assert.deepEqual(expanded[0].events.map(e=>[e.kind,e.duration,e.string,e.fret]),[['rest',2,undefined,undefined],['rest',4,undefined,undefined],['rest',16,undefined,undefined],['note',16,4,0],['note',16,4,2],['note',16,3,0]]);
 assert.ok(expanded[0].events[3].hammerToNext);assert.deepEqual(expanded[3].events[4].grace,[{string:4,fret:0}]);
 assert.ok(expanded[13].events.filter(e=>e.duration===32).length===2);
 assert.ok(expanded.slice(-2).every(b=>b.events.at(-1).kind==='rest'&&b.events.at(-1).duration===2));
 const html=renderScore(data,4);assert.match(html,/tab-grace/);assert.match(html,/tab-rest-sixteenth/);assert.match(html,/tab-rest-half/);
 assert.doesNotMatch(html,/data-meter="1\/4"/);assert.equal((html.match(/class="time-signature"/g)||[]).length,3);
 const invalid=structuredClone(data);invalid.bars[0].beats=1;assert.throws(()=>validateScore(invalid),/拍号/);
 const badGrace=structuredClone(data);badGrace.patterns['intro-c-em'][4].grace[0].string=3;assert.throws(()=>validateScore(badGrace),/装饰音/);
});
test('两遍44个播放小节共172拍，简易谱切换歌词并保留两次前奏',()=>{
 assert.deepEqual(performanceOrder(data),order);
 const playback=buildAccompanimentPlayback(data);assert.equal(playback.totalTicks,172*960);assert.deepEqual(playback.sequence.map(s=>s.bar),order);
 const importer=new alphaTab.importer.AlphaTexImporter();importer.initFromString(playback.tex,new alphaTab.Settings());
 const score=importer.readScore();assert.equal(score.masterBars.length,44);assert.equal(score.tempo,60);
 assert.deepEqual(score.masterBars.map(b=>b.calculateDuration()),order.map(n=>(n===13?2:4)*960));
 assert.ok(!score.masterBars[0].isAnacrusis&&!score.masterBars[22].isAnacrusis);
 assert.equal(playback.sequence[1].startTick,3840);
 assert.ok(score.tracks[0].staves[0].bars[0].voices[0].beats.slice(0,3).every(b=>b.isRest));
 const bars=score.tracks[0].staves[0].bars;
 assert.equal(bars[0].voices[0].beats[3].notes[0].realValue,52,'4弦空弦加变调夹2品为E3');
 assert.equal(bars[3].voices[0].beats.filter(b=>b.graceType!==0).length,1);
 for(const perRow of [2,4]){
  const full=renderScore(data,perRow),simple=renderSimpleScore(data,perRow);
  assert.equal((full.match(/class="numbered-melody"/g)||[]).length,22);
  assert.equal((simple.match(/<g class="measure"/g)||[]).length,10);
  assert.doesNotMatch(full+simple,/NaN|undefined|<image/);assert.doesNotMatch(simple,/volta-label/);assert.match(simple,/bar-22-repeat-2/);
 }
});
