import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const data = JSON.parse(await readFile(new URL('../knowledge/chord-charts.json', import.meta.url), 'utf8'));
const roots = {C:0,D:2,E:4,F:5,G:7,A:9,B:11};
const tuning = [40,45,50,55,59,64];
function chord(name) {
  const [,letter,accidental,quality] = /^([A-G])([#b]?)(m|7)?$/.exec(name);
  const root = (roots[letter] + (accidental === '#' ? 1 : accidental === 'b' ? -1 : 0) + 12) % 12;
  return {root, quality:quality || 'major', notes:(quality === 'm' ? [0,3,7] : quality === '7' ? [0,4,7,10] : [0,4,7]).map(n => (root+n)%12).sort((a,b)=>a-b)};
}

test('八个调的 I ii iii IV V vi V7 音级与和弦质量正确', () => {
  assert.deepEqual(data.keys.map(k=>k.name), ['C','D','E','F','G','A','B','Bb']);
  assert.deepEqual(data.degrees.map(d=>d.label), ['I','ii','iii','IV','V','vi','V7']);
  for (const key of data.keys) {
    assert.equal(key.chords.length,7);
    key.chords.forEach((name,i) => {
      const c = chord(name);
      assert.equal(c.root,(chord(key.name).root + [0,2,4,5,7,9,7][i])%12,`${key.name}: ${name}`);
      assert.equal(c.quality,['major','m','m','major','major','m','7'][i]);
      assert.ok(data.shapes[name]);
    });
  }
});

test('每种六弦指法包含必要和弦音且不含和弦外音', () => {
  for (const [name,shape] of Object.entries(data.shapes)) {
    assert.equal(shape.frets.length,6);
    assert.equal(shape.fingers.length,6);
    const sounding = [...new Set(shape.frets.flatMap((fret,i) => fret<0 ? [] : [(tuning[i]+fret)%12]))].sort((a,b)=>a-b);
    const expected = chord(name);
    // 原图常用 C7 指法 x32310 省略五音 G，保留根音、三音和七音。
    const expectedNotes = name === 'C7' ? expected.notes.filter(n=>n!==(expected.root+7)%12) : expected.notes;
    assert.deepEqual(sounding,expectedNotes,name);
    shape.frets.forEach((fret,i) => {
      assert.ok(Number.isInteger(fret)&&fret>=-1&&fret<=8,name);
      assert.ok(fret>0 ? shape.fingers[i]>=1&&shape.fingers[i]<=4 : shape.fingers[i]===0,name);
      if(fret>0)assert.ok(fret>=(shape.barre?.fret||1)&&fret<(shape.barre?.fret||1)+4,`${name}: 图内可见`);
    });
    if (shape.barre) {
      const {fret,from,to}=shape.barre;
      assert.ok(from>to&&from<=6&&to>=1);
      for(let string=from;string>=to;string--){
        assert.ok(shape.frets[6-string]>=fret,`${name}: 横按不可覆盖空弦或低品音`);
        if(shape.frets[6-string]===fret)assert.equal(shape.fingers[6-string],1);
      }
    }
  }
});

test('保留参考图中的转位、七和弦与高把位指法', () => {
  assert.deepEqual(data.shapes.C.frets,[3,3,2,0,1,0]);
  assert.deepEqual(data.shapes.A7.frets,[-1,0,2,2,2,3]);
  assert.deepEqual(data.shapes.E7.frets,[0,2,2,1,3,0]);
  assert.deepEqual(data.shapes.Eb.frets,[-1,6,5,3,4,3]);
  assert.deepEqual(data.shapes['D#m'].frets,[-1,6,8,8,7,6]);
});
