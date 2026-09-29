import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {scalePositions} from '../scripts/build-fretboard-scales.mjs';
const data=JSON.parse(await readFile(new URL('../knowledge/fretboard-scales.json',import.meta.url),'utf8'));

test('七个大调的音名、音程与标准调弦一致',()=>{
  const pitch={C:0,D:2,E:4,F:5,G:7,A:9,B:11};
  assert.deepEqual(data.keys.map(k=>k.name),['C','D','E','F','G','A','B']);
  assert.deepEqual(data.strings.map(s=>[s.number,s.midi]),[[1,64],[2,59],[3,55],[4,50],[5,45],[6,40]]);
  for(const key of data.keys){
    const notes=key.notes.map(n=>(pitch[n[0]]+(n.includes('♯')?1:n.includes('♭')?-1:0)+12)%12);
    assert.deepEqual(notes.map((n,i)=>(notes[(i+1)%7]-n+12)%12),[2,2,1,2,2,2,1]);
    for(const pos of scalePositions(data,key))assert.equal((data.strings[pos.string-1].midi+pos.fret)%12,notes[pos.degree-1]);
  }
});

test('原图空弦音级与关键品位一致，12品重复空弦音级',()=>{
  const open={C:[3,7,5,2,6,3],D:[2,6,4,1,5,2],E:[1,5,null,null,4,1],F:[7,null,2,6,3,7],G:[6,3,1,5,2,6],A:[5,2,null,4,1,5],B:[4,1,null,null,null,4]};
  for(const key of data.keys){
    const positions=scalePositions(data,key);
    assert.deepEqual(data.strings.map(s=>positions.find(p=>p.string===s.number&&p.fret===0)?.degree??null),open[key.name]);
    for(const p of positions.filter(p=>p.fret<=3))assert.equal(positions.find(n=>n.string===p.string&&n.fret===p.fret+12)?.degree,p.degree);
    assert.equal(new Set(positions.map(p=>`${p.string}:${p.fret}`)).size,positions.length);
    assert.deepEqual([...scalePositions(data,key,0,5),...scalePositions(data,key,6,10),...scalePositions(data,key,11,15)].sort((a,b)=>a.string-b.string||a.fret-b.fret),positions,'手机分段无缺失或重复品位');
  }
  assert.equal(scalePositions(data,data.keys[0]).find(p=>p.string===1&&p.fret===8).degree,1);
  assert.equal(scalePositions(data,data.keys[1]).find(p=>p.string===1&&p.fret===2).note,'F♯');
});

test('八度点与参考图一致，跨十二品加一组高八度',()=>{
  const at=(name,string,fret)=>scalePositions(data,data.keys.find(k=>k.name===name)).find(p=>p.string===string&&p.fret===fret);
  // 原图 C 调：五弦3品的1无点，一弦空弦3一点，8品1两点。
  assert.equal(at('C',5,3).octave,0);
  assert.equal(at('C',1,0).octave,1);
  assert.equal(at('C',1,8).octave,2);
  assert.equal(at('C',6,0).octave,-1);
  assert.equal(at('D',4,0).octave,0);
  assert.equal(at('D',2,3).octave,1);
  assert.equal(at('B',6,0).octave,-2);
  for(const key of data.keys){
    const positions=scalePositions(data,key);
    for(const p of positions){
      assert.equal(key.tonicMidi+12*p.octave+data.majorIntervals[p.degree-1],data.strings[p.string-1].midi+p.fret,'音级及八度还原实际音高');
      if(p.fret<=3)assert.equal(positions.find(n=>n.string===p.string&&n.fret===p.fret+12).octave,p.octave+1);
    }
  }
});
