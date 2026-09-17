import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';

const read = async path => JSON.parse(await readFile(new URL('../'+path,import.meta.url),'utf8'));
const accompaniment = await read('score/laonanhai.json');

test('简谱逐小节与55小节伴奏对应，歌词、八度、附点及装饰音保留', async () => {
  const vocals = await read('score/laonanhai-vocal.json');
  const {attachVocals,eventBeats} = await import('../scripts/numbered-notation.mjs');
  const score = attachVocals(await read('score/laonanhai.json'),vocals);
  assert.equal(score.bars.length,55);
  for(const bar of score.bars){
    assert.ok(bar.vocal.events.length>0);
    assert.equal(bar.vocal.events.reduce((sum,n)=>sum+eventBeats(n),0),bar.vocal.beats??4,`第${bar.number}小节简谱时值`);
    assert.equal(bar.vocal.beats??4,bar.beats??4,`第${bar.number}小节两声部拍数应一致`);
    assert.equal(bar.vocal.pendingReview,undefined);
  }
  assert.equal(score.bars[6].vocal.events.map(n=>n.lyrics?.[0]||'').join(''),'那是我日夜思念深');
  assert.equal(score.bars[6].vocal.events.map(n=>n.lyrics?.[1]||'').join(''),'转眼过去多年时间');
  assert.ok(score.bars.some(b=>b.vocal.events.some(n=>n.octave===2)));
  assert.ok(score.bars.some(b=>b.vocal.events.some(n=>n.grace?.length)));
  assert.ok(score.bars.some(b=>b.vocal.events.some(n=>n.dotted)));
  const invalid=structuredClone(vocals);invalid.bars[0].events[0].duration=8;
  assert.throws(()=>attachVocals(accompaniment,invalid),/时值/);
  const mismatched=structuredClone(accompaniment);
  mismatched.bars[17].beats=4;
  assert.throws(()=>attachVocals(mismatched,vocals),/简谱与伴奏时值不一致/);
  assert.deepEqual(vocals.bars[42].events.map(n=>n.duration),[8,16,16,8,8]);
});

test('两种换行均绘制完整简谱与两行歌词，节拍数字不回到谱下', async () => {
  const {attachVocals} = await import('../scripts/numbered-notation.mjs');
  const {renderScore} = await import('../scripts/accompaniment-svg.mjs');
  const data = attachVocals(accompaniment,await read('score/laonanhai-vocal.json'));
  for(const perRow of [2,4]){
    const svg=renderScore(data,perRow);
    assert.equal((svg.match(/class="numbered-melody"/g)||[]).length,55);
    assert.equal((svg.match(/class="measure"/g)||[]).length,55);
    assert.match(svg,/class="melody-tie"/);
    assert.match(svg,/class="melody-grace"/);
    assert.match(svg,/class="lyric"/);
    assert.doesNotMatch(svg,/class="pulse"|NaN|undefined/);
  }
});
