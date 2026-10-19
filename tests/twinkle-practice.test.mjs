import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {practiceBars,renderMelody} from '../scripts/build-twinkle-practice.mjs';
const read=async name=>JSON.parse(await readFile(new URL('../knowledge/'+name+'.json',import.meta.url),'utf8'));
const song=await read('twinkle-practice'),chords=await read('chord-charts'),scales=await read('fretboard-scales');
test('按截图保留小星星12小节48拍、42次起音及6次延长，使用1—6全部音级',()=>{
 assert.deepEqual(song.timeSignature,[4,4]);assert.equal(song.bars.length,12);
 assert.deepEqual(song.bars.map(b=>b.events.map(e=>e.hold?'-':e.degree).join('')),['1155','665-','4433','221-','5544','332-','5544','332-','1155','665-','4433','221-']);
 assert.ok(song.bars.every(b=>b.events.reduce((sum,e)=>sum+e.beats,0)===4));
 const events=song.bars.flatMap(b=>b.events);
 assert.equal(events.filter(e=>e.hold).length,6);assert.equal(events.filter(e=>e.degree).length,42);
 assert.deepEqual([...new Set(events.map(e=>e.degree).filter(Boolean))].sort(),[1,2,3,4,5,6]);
 assert.equal(events.map(e=>e.lyric??'').join(''),'一闪一闪亮晶晶漫天都是小星星高高挂在天空中好像宝石放光明一闪一闪亮晶晶漫天都是小星星');
});
test('七个调逐音映射同级三和弦，含升降号；延长线不新增和弦',()=>{
 const expected={C:['C','Dm','Em','F','G','Am'],D:['D','Em','F#m','G','A','Bm'],E:['E','F#m','G#m','A','B','C#m'],F:['F','Gm','Am','Bb','C','Dm'],G:['G','Am','Bm','C','D','Em'],A:['A','Bm','C#m','D','E','F#m'],B:['B','C#m','D#m','E','F#','G#m']};
 for(const key of scales.keys){
  const chart=chords.keys.find(k=>k.name===key.name),bars=practiceBars(song,chart);
  for(const e of bars.flatMap(b=>b.events))if(e.hold)assert.equal(e.chord,undefined);else assert.equal(e.chord,expected[key.name][e.degree-1]);
  const html=renderMelody(bars);assert.equal((html.match(/data-focus-degree=/g)||[]).length,42);assert.equal((html.match(/class="melody-event held"/g)||[]).length,6);assert.doesNotMatch(html,/NaN|undefined|<img/);
 }
 const c=practiceBars(song,chords.keys[0]);assert.deepEqual(c.slice(0,2).flatMap(b=>b.events.map(e=>e.chord??'-')),['C','C','G','G','Am','Am','G','-']);
 assert.ok(renderMelody(practiceBars(song,chords.keys.find(k=>k.name==='B'))).includes('D♯m'));
 assert.ok(renderMelody(practiceBars(song,chords.keys.find(k=>k.name==='F'))).includes('B♭'));
 const bad=structuredClone(song);bad.bars[0].events[0].degree=7;assert.throws(()=>practiceBars(bad,chords.keys[0]),/1—6/);
});
test('七个调的第7级使用减三和弦，指法只含根音、小三度和减五度',async()=>{
 const sevenths=await read('twinkle-seventh-chords');
 const tuning=[40,45,50,55,59,64];
 const names={C:'Bdim',D:'C#dim',E:'D#dim',F:'Edim',G:'F#dim',A:'G#dim',B:'A#dim'};
 for(const key of scales.keys){
  const {name,shape}=sevenths[key.name];assert.equal(name,names[key.name]);
  const root=(key.root+11)%12;
  const intervals=shape.frets.flatMap((f,i)=>f<0?[]:[(tuning[i]+f-root+120)%12]);
  assert.deepEqual([...new Set(intervals)].sort((a,b)=>a-b),[0,3,6]);
  assert.ok(shape.frets.every(f=>f<0||(f>=shape.baseFret&&f<=shape.baseFret+3)));
  assert.equal((tuning[1]+shape.frets[1])%12,root,'最低音为第7级根音');
 }
});
