import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';
import {attachVocals} from '../scripts/numbered-notation.mjs';
import {simpleSections,simpleLyricLines,renderSimpleScore,projectSimpleBar} from '../scripts/simple-score.mjs';
const read=async id=>JSON.parse(await readFile(new URL(`../score/${id}.json`,import.meta.url),'utf8'));
const range=(start,end)=>Array.from({length:end-start+1},(_,i)=>start+i);
for(const [id,expectedCount] of [['laonanhai',89],['kongxin',72],['turanhaoxiangni',62]]){
 test(`${id}简易谱按实际路线展开，完整保留器乐段，并选择每遍歌词`,async()=>{
  const data=attachVocals(await read(id),await read(id+'-vocal'));
  const sections=simpleSections(data);
  const order=data.route.flatMap(r=>range(r.start,r.end));
  assert.equal(order.length,expectedCount);
  assert.deepEqual(sections.flatMap(s=>range(s.start,s.end)),order);
  const keys=sections.flatMap(s=>range(s.start,s.end).map(n=>s.barIds[n]));assert.equal(new Set(keys).size,expectedCount);
  for(const rows of [2,4]){
   const html=renderSimpleScore(data,rows);
   assert.equal([...html.matchAll(/id="bar-[^"]+"/g)].length,expectedCount);
   assert.equal((html.match(/<g class="measure"/g)||[]).length,sections.filter(s=>s.full).reduce((sum,s)=>sum+s.end-s.start+1,0));
   assert.doesNotMatch(html,/NaN|undefined|simple-bar-number|simple-mark/);
  }
  for(const section of sections.filter(s=>!s.full))for(const line of simpleLyricLines(data,[section]))for(const phrase of line)for(const cell of phrase)assert.ok(cell.token.lyrics.length<=1,'每遍仅显示对应单行歌词');
  if(id==='laonanhai'){
   const projected=(n,v)=>projectSimpleBar(data,data.bars[n-1],{verse:v,routeIndex:0}).vocal.events.flatMap(e=>e.lyrics??[]).join('');
   assert.equal(projected(7,0),'那是我日夜思念深');assert.equal(projected(7,1),'转眼过去多年时间');
   assert.ok(sections.some(s=>s.full&&s.start===32&&s.end===39));
   assert.ok(sections.some(s=>s.start===21&&s.verse===0&&s.routeIndex===3));
   assert.ok(sections.some(s=>s.start===21&&s.verse===1&&s.routeIndex===5));
  }
  if(id==='kongxin'){
   const projected=(n,v)=>projectSimpleBar(data,data.bars[n-1],{verse:v,routeIndex:1}).vocal.events.flatMap(e=>e.lyrics??[]).join('');
   assert.equal(projected(5,1),'有个怀抱暖的像张');assert.equal(projected(26,1),'漆黑空心也想被释');
   assert.ok(!projected(24,1).includes('要'),'第二段空白歌词不回填第一段的字');
   assert.ok(sections.some(s=>s.full&&s.start===21&&s.end===21));
  }
  if(id==='turanhaoxiangni'){
   const lyric=(n,r)=>projectSimpleBar(data,data.bars[n-1],{verse:r?1:0,routeIndex:r}).vocal.events.flatMap(e=>e.lyrics??[]).join('');
   assert.equal(lyric(4,0),'最');assert.equal(order.filter(n=>n===4).length,1,'前奏只弹一遍');assert.equal(lyric(12,0),'息想');assert.equal(lyric(5,1),'念如果会有声音');
   assert.equal(sections.find(s=>s.start===13).target,'bar-13','首次实际出现的第二跳尾不被误认为第三遍');
  }
 });
}
