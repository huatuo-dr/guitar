import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';
import {simpleBarTokens,renderSimpleScore,simpleSections,simpleLyricLines} from '../scripts/simple-score.mjs';
import {attachVocals} from '../scripts/numbered-notation.mjs';
const read=async name=>JSON.parse(await readFile(new URL(`../score/${name}.json`,import.meta.url),'utf8'));

test('和弦按实际拍点与歌词配对，无新歌词时保留独立占位',()=>{
 const tokens=simpleBarTokens({chords:[[1,'C'],[2,'G'],[3,'Am']],vocal:{events:[
  {duration:4,lyrics:['来']},{duration:8},{duration:8,lyrics:['我']},{duration:4,lyrics:['爱']},{duration:4,hold:true}
 ]}});
 assert.deepEqual(tokens.map(t=>[t.beat,t.chord,t.lyrics]),[[1,'C',['来']],[2,'G',[]],[2.5,'',['我']],[3,'Am',['爱']]]);
});

test('三连音拍点合并准确，保留多行歌词',()=>{
 const tokens=simpleBarTokens({chords:[[1,'C'],[3,'G']],vocal:{events:[
  {duration:4,tuplet:3,lyrics:['甲','一']},{duration:4,tuplet:3},{duration:4,tuplet:3},
  {duration:4,lyrics:['乙','二']},{duration:4,hold:true}
 ]}});
 assert.equal(tokens.length,2);assert.deepEqual(tokens[1],{beat:3,chord:'G',lyrics:['乙','二']});
});

test('后来简易谱保留全部歌词和和弦，以及前奏间奏12个完整小节，演唱段不显示编号和跳尾',async()=>{
 const data=attachVocals(await read('houlai'),await read('houlai-vocal'));
 const singing=data.bars.filter(b=>b.number>4&&(b.number<57||b.number>64));
 for(const bar of singing){
  const tokens=simpleBarTokens(bar);
  assert.deepEqual(tokens.filter(t=>t.chord).map(t=>[t.beat,t.chord]),bar.chords);
  assert.deepEqual(tokens.flatMap(t=>t.lyrics),bar.vocal.events.flatMap(e=>e.lyrics??[]));
 }
 for(const rows of [2,4]){
  const html=renderSimpleScore(data,rows);
  assert.equal((html.match(/class="simple-cell simple-measure measure"/g)||[]).length,68);
  assert.equal((html.match(/<g class="measure"/g)||[]).length,12);
  const ids=[...html.matchAll(/id="(bar-[^"]+)"/g)].map(m=>m[1]);
  const numbers=ids.map(id=>Number(id.split('-')[1]));
  assert.equal(new Set(ids).size,80,'每次出现有独立定位ID');
  assert.deepEqual(numbers,[...Array.from({length:64},(_,i)=>i+1),...Array.from({length:11},(_,i)=>i+45),65,66,67,68,69]);
  assert.doesNotMatch(html,/simple-bar-number|simple-mark|跳尾|<small>/);
  assert.equal((html.match(/class="simple-line"/g)||[]).length,10,'仅在较大的语义段落间换行，避免逐句独占一行');
  assert.doesNotMatch(html,/undefined|NaN/);
 }
});

test('简易谱段定位遵循展开路线，第二遍副歌不包括第一跳尾',async()=>{
 const sections=simpleSections(await read('houlai'));
 assert.deepEqual(sections.map(s=>[s.start,s.end]),[[1,4],[5,12],[13,28],[29,44],[45,48],[49,56],[57,64],[45,48],[49,55],[65,69]]);
 assert.equal(sections[7].target,'bar-45-repeat-2');
 assert.equal(sections[8].label,'副歌（再唱）');
});

test('按语义断句，跨小节和段落连接歌词，重复副歌正确接尾声',async()=>{
 const data=attachVocals(await read('houlai'),await read('houlai-vocal'));
 const sections=simpleSections(data).filter(s=>!data.simpleScore.fullSections.includes(s.sourceStart));
 const text=[...simpleLyricLines(data,sections.slice(0,5)),...simpleLyricLines(data,sections.slice(5))].map(line=>line.map(phrase=>phrase.map(cell=>cell.token.lyrics.join('')).join('')).join(' '));
 assert.ok(text.some(line=>line.includes('来 我总算学会了如何去爱')));
 assert.equal(text.filter(line=>line.includes('可惜你 早已远去 消失在人海')).length,3);
 assert.ok(text.some(line=>line.includes('你都如何回忆我 带着笑 或是很沉默')));
 assert.ok(text.some(line=>line.includes('后来 我总算学会了如何去爱')));
 assert.ok(text.some(line=>line.includes('有些人 一旦错过就不在')));
 assert.ok(text.some(line=>line.includes('有一个男孩 爱着那个女孩')));
 const invalid=structuredClone(data);invalid.simpleScore.lyricBreaks.push({bar:5,beat:1.123,kind:'line'});
 assert.throws(()=>simpleLyricLines(invalid,sections),/断句/);
});
