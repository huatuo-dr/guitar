import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';
import * as alphaTab from '@coderline/alphatab';
import {expandBars,performanceOrder,validateScore,renderScore} from '../scripts/accompaniment-svg.mjs';
import {attachVocals,eventBeats} from '../scripts/numbered-notation.mjs';
import {projectSimpleBar,simpleSections,renderSimpleScore,simpleLyricLines} from '../scripts/simple-score.mjs';
import {buildAccompanimentPlayback} from '../scripts/accompaniment-playback.mjs';
const read=async id=>JSON.parse(await readFile(new URL('../score/'+id+'.json',import.meta.url),'utf8'));
const data=attachVocals(await read('tongnian'),await read('tongnian-vocal'));
const range=(a,b)=>Array.from({length:b-a+1},(_,i)=>a+i);
const route=[...range(1,20),...range(5,20),...range(5,20),...range(5,20),...range(5,19),...range(21,26)];
const verses=[
 '池塘边的榕树上知了在声声的叫着夏天操场边的秋千上只有蝴蝶还停在上面黑板上老师的粉笔还在拼命唧唧喳喳写个不停等待着下课等待着放学等待游戏的童年',
 '福利社里面什么都有就是口袋里没有半毛钱诸葛四郎和魔鬼到底谁抢到那支宝剑隔壁班的那个女孩怎么还没经过我的窗前嘴里的零食手里的漫画心里初恋的童年',
 '总是要等到睡觉以前才知道功课只做了一点点总是要等到考试以后才知道该念的书都没有念一寸光阴一寸金老师说过寸金难买寸光阴一天有一天一年又一年迷迷糊糊的童年',
 '没有人知道为什么太阳总下到山的那一边没有人能够告诉我山里面有没有住着神仙多少的日子里总是一个人面对着天空发呆就这么好奇就这么幻想这么孤单的童年',
 '阳光下蜻蜓飞过来一片片绿油油的稻田水彩蜡笔和万花筒画不出天边的那一条彩虹什么时候才能像高年级的同学有张成熟与长大的脸盼望着假期盼望着明天盼望长大的童年'
];
test('童年两页26小节的G调、前奏弦品、扫弦切分与换和弦',()=>{
 assert.equal(validateScore(data),true);assert.equal(data.bars.length,26);
 assert.equal(data.key,'G');assert.equal(data.fingeringKey,'G');assert.equal(data.capo,undefined);
 assert.deepEqual(data.chordShapes.Gsus4.frets,[3,2,0,0,1,3]);
 assert.deepEqual(data.chordShapes.Bm.frets,[-1,2,4,4,3,2]);
 const bars=expandBars(data);
 for(const bar of bars){
  assert.equal(bar.events.reduce((sum,e)=>sum+eventBeats(e),0),4);
  assert.equal(bar.vocal.events.reduce((sum,e)=>sum+eventBeats(e),0),4);
 }
 assert.deepEqual(bars[0].events[0].notes,[{string:6,fret:3},{string:3,fret:0},{string:2,fret:0}]);
 assert.deepEqual(bars[0].events.map(e=>e.duration),[8,4,8,16,16,8,4]);
 assert.deepEqual(bars[0].events.slice(4).map(e=>[e.notes[0].string,e.notes[0].fret]),[[3,2],[3,0],[3,0]]);
 assert.equal(bars[0].events[5].notes[0].tieToNext,true);
 assert.deepEqual(bars[2].events.map(e=>e.strings),[[2,3],[2,3],[2,3],[2,3],[2,3],[1,2]]);
 for(const number of [8,12,16])assert.deepEqual(data.bars[number-1].chords,[[1,'D'],[2.5,'Dsus4'],[4,'D']]);
 assert.deepEqual(data.bars[19].chords,[[1,'G'],[2.5,'Gsus4']]);
 for(const bar of bars.slice(3,25)){
  assert.deepEqual(bar.events.map(e=>e.kind),['down','down','up','hold','up','down','up']);
  assert.equal(bar.events[2].tieToNext,true);assert.equal(bar.events[3].sourceArrow,'down');
 }
 assert.equal(bars[6].vocal.events[1].dotted,true);assert.equal(bars[6].vocal.events[2].duration,16);
 assert.equal(bars[24].vocal.crossBarTieStart,0);
});
test('五行歌词完整保留，简易谱五遍展开并保留第五遍第19小节',()=>{
 for(let verse=0;verse<5;verse++){
  const text=data.bars.slice(4,19).map(bar=>projectSimpleBar(data,bar,{verse}).vocal.events.map(e=>e.lyrics?.join('')??'').join('')).join('')+projectSimpleBar(data,data.bars[verse===4?20:19],{verse}).vocal.events[0].lyrics.join('');
  assert.equal(text,verses[verse],`第${verse+1}段歌词`);
 }
 assert.deepEqual(data.bars[19].vocal.events[0].lyrics,['年','年','年','年',''],'第20小节仅供前四遍演唱');
 assert.equal(projectSimpleBar(data,data.bars[19],{verse:4}).vocal.events.map(e=>e.lyrics?.join('')??'').join(''),'');
 assert.deepEqual(performanceOrder(data),route);assert.equal(route.length,89);
 assert.equal(data.bars[4].repeatStart,true);assert.equal(data.bars[18].volta,undefined);
 assert.equal(data.bars[19].volta,'1–4');assert.equal(data.bars[19].repeatEnd,true);assert.equal(data.bars[20].volta,5);
 const sections=simpleSections(data),singing=sections.filter(s=>!s.full);
 const text=simpleLyricLines(data,singing).flat(2).map(cell=>cell.token.lyrics.join('')).join('');
 assert.equal(text,verses.join('')+'哦一天有一天一年又一年盼望长大的童年');
 for(const perRow of [2,4]){
  const html=renderSimpleScore(data,perRow);
  const ids=[...html.matchAll(/id="(bar-[^"]+)"/g)].map(m=>m[1]);
  assert.equal(ids.length,89);assert.equal(new Set(ids).size,89);
  assert.ok(ids.includes('bar-19-repeat-5'));assert.ok(!ids.includes('bar-20-repeat-5'));
  assert.equal((html.match(/<g class="measure"/g)||[]).length,5,'前奏4小节与尾奏1小节保留完整谱');
  assert.doesNotMatch(html,/NaN|undefined/);
  const full=renderScore(data,perRow);
  assert.equal((full.match(/class="numbered-melody"/g)||[]).length,26);
  assert.match(full,/1–4\./);assert.doesNotMatch(full,/<image|NaN|undefined/);
 }
});
test('童年播放89小节356拍，按G调实音、延音扫弦与第五遍跳尾发声',()=>{
 const playback=buildAccompanimentPlayback(data);
 assert.deepEqual(playback.sequence.map(s=>s.bar),route);assert.equal(playback.totalTicks,356*960);
 const importer=new alphaTab.importer.AlphaTexImporter();importer.initFromString(playback.tex,new alphaTab.Settings());
 const score=importer.readScore();assert.equal(score.masterBars.length,89);assert.equal(score.tempo,60);
 assert.ok(score.masterBars.every(bar=>bar.calculateDuration()===3840));
 const bars=score.tracks[0].staves[0].bars;
 assert.deepEqual(bars[0].voices[0].beats[0].notes.map(n=>n.realValue).sort((a,b)=>a-b),[43,55,59]);
 const strum=bars[4].voices[0].beats;
 assert.equal(strum[2].brushType,alphaTab.model.BrushType.BrushUp);
 assert.ok(strum[3].notes.every(n=>n.isTieDestination));assert.equal(strum[3].brushType,alphaTab.model.BrushType.None);
 assert.deepEqual(playback.sequence.slice(-8).map(s=>s.bar),[18,19,21,22,23,24,25,26]);
});
