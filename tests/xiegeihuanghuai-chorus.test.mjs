import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';
import * as alphaTab from '@coderline/alphatab';
import {expandBars,performanceOrder,validateScore,renderScore} from '../scripts/accompaniment-svg.mjs';
import {attachVocals,eventBeats} from '../scripts/numbered-notation.mjs';
import {renderSimpleScore} from '../scripts/simple-score.mjs';
import {buildAccompanimentPlayback} from '../scripts/accompaniment-playback.mjs';
const read=async suffix=>JSON.parse(await readFile(new URL('../score/xiegeihuanghuai-chorus'+suffix+'.json',import.meta.url),'utf8'));
const data=attachVocals(await read(''),await read('-vocal'));
const words=b=>b.vocal.events.flatMap(e=>e.lyrics??[]).join('');
const expectedWords='十九岁的那一天我来到黄淮的面前为了能和你在这遇见我支付了我的四年二十岁的那一天吉他在我身边张开了笨拙的手对你的爱涌上了心头你是我患得患失的梦我是你可有可无的人毕竟这穿越山河的箭刺的都是用情致疾的人你是我辗转反侧的梦我是你如梦山河的故人就让这牵肠挂肚的酒硫酸一样刺激在你我的心头';
test('保留第一页16小节与第二页17小节，末尾去字保音，歌词准确',()=>{
 assert.equal(validateScore(data),true);assert.equal(data.bars.length,33);
 assert.deepEqual([data.scoreType,data.key,data.capo],['chorus','G',3]);
 assert.deepEqual(data.bars.map(b=>b.sourcePage),[...Array(16).fill(1),...Array(17).fill(2)]);
 assert.equal(data.bars.map(words).join(''),expectedWords);
 assert.equal(words(data.bars[8]),'十');assert.equal(words(data.bars.at(-1)),'');
 assert.deepEqual(data.bars.at(-1).vocal.events.at(-1),{degree:5,duration:16});
 assert.deepEqual(data.bars[9].vocal.events.filter(e=>e.tieToNext).map(e=>e.degree),[7,1]);
 assert.ok(data.bars.every(b=>!b.volta&&!b.repeatStart&&!b.repeatEnd));
});
test('一拍弱起及其余32个四拍小节，保留同响弦位、击勾滑弦和三连音',()=>{
 const b=expandBars(data);
 for(const bar of b)for(const events of [bar.events,bar.vocal.events])assert.ok(Math.abs(events.reduce((n,e)=>n+eventBeats(e),0)-bar.beats)<1e-8);
 assert.deepEqual(b[0].events,[{kind:'rest',duration:8,dotted:true},{kind:'note',string:3,fret:2,duration:16}]);
 assert.equal(b[0].pickup,true);assert.equal(b[0].beats,1);assert.ok(b.slice(1).every(bar=>bar.beats===4));
 assert.deepEqual(b[1].events[0].strings,[6,2]);
 assert.deepEqual(b[1].events.slice(-3).map(e=>[e.string,e.fret,e.hammerToNext??false,e.pullToNext??false]),[[3,2,true,false],[3,4,false,true],[3,2,false,false]]);
 assert.deepEqual(b[6].events.filter(e=>e.kind==='note').map(e=>e.fret),[0,2,3,5,3,5,5,7,5]);
 assert.ok(b[6].events[7].slideToNext);
 assert.deepEqual(b[27].events.slice(-3).map(e=>[e.string,e.fret,e.duration,e.tuplet]),[[2,3,8,3],[2,1,8,3],[2,0,8,3]]);
 assert.equal(data.chordShapes.D.frets[1],0);
 for(const i of [28,32])assert.deepEqual(b[i].events[1].strings,[5]);
 assert.deepEqual(b[32].events.slice(-4).map(e=>[e.string,e.fret]),[[4,0],[4,2],[4,4],[3,0]]);
 assert.ok(b[32].events.at(-3).slideToNext);
 for(const i of [11,12,13,14,15,16,19,20,21,22,23])assert.ok(b[i].events[4].tieToNext);
 const invalid=structuredClone(data);invalid.chordShapes.D.frets[1]=-1;assert.throws(()=>buildAccompanimentPlayback(invalid),/第29小节.*5弦/);
});
test('顺序播放33小节129拍，简易谱保留17小节器乐，原生谱不增加1/4拍号',()=>{
 const order=Array.from({length:33},(_,i)=>i+1);assert.deepEqual(performanceOrder(data),order);
 const playback=buildAccompanimentPlayback(data);assert.equal(playback.totalTicks,129*960);
 assert.deepEqual(playback.sequence.map(s=>s.bar),order);assert.equal(playback.sequence[1].startTick,960);
 const importer=new alphaTab.importer.AlphaTexImporter();importer.initFromString(playback.tex,new alphaTab.Settings());
 const parsed=importer.readScore();assert.equal(parsed.masterBars.length,33);assert.equal(parsed.tempo,60);assert.ok(parsed.masterBars[0].isAnacrusis);
 assert.deepEqual(parsed.masterBars.map(b=>b.calculateDuration()),[960,...Array(32).fill(3840)]);
 const bars=parsed.tracks[0].staves[0].bars;
 assert.equal(bars[0].voices[0].beats[1].notes[0].realValue,60,'3弦2品加变调夹3品为C4');
 for(const i of [28,32])assert.equal(bars[i].voices[0].beats[1].notes[0].realValue,48,'5弦空弦加变调夹3品为C3');
 for(const perRow of [2,4]){
  const full=renderScore(data,perRow),simple=renderSimpleScore(data,perRow);
  assert.equal((full.match(/class="numbered-melody"/g)||[]).length,33);
  assert.equal((simple.match(/<g class="measure"/g)||[]).length,17);
  assert.doesNotMatch(full+simple,/NaN|undefined|<image|volta-label|-repeat-/);
  assert.doesNotMatch(full,/data-meter="1\/4"/);assert.equal((full.match(/class="time-signature"/g)||[]).length,1);
 }
});
