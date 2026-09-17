import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as alphaTab from '@coderline/alphatab';
import {attachLyrics} from '../scripts/pianai-lyrics.mjs';

const read = file => JSON.parse(readFileSync(new URL(`../score/${file}.json`,import.meta.url)));
const lyrics = read('pianai-lyrics');
const bars = ['intro','a-section','b-section','c-section'].flatMap(file => read(file).bars);
for (const bar of read('remaining').bars) bars.push(bar.repeatOf ? {...structuredClone(bars[bar.repeatOf-1]),number:bar.number} : bar);
const phrase = bar => bar.beats.map(beat => beat.lyric || '').join('');

test('歌词逐拍对应截图，重复副歌避开装饰音且不改变原有音符', () => {
  const original = structuredClone(bars);
  const result = attachLyrics(bars,lyrics);
  assert.deepEqual(bars,original,'不改输入谱面');
  assert.deepEqual(result.map(bar => ({...bar,beats:bar.beats.map(({lyric,...beat}) => beat)})),original);
  assert.equal(phrase(result[4]),'把昨天都作废');
  assert.equal(phrase(result[13]),'顽固的人不喊累');
  assert.equal(phrase(result[16]),'我说过我不闪躲我');
  assert.equal(phrase(result[48]),phrase(result[16]));
  assert.equal(result[16].beats[0].lyric,undefined);
  assert.equal(result[16].beats[1].lyric,'我');
  assert.equal(result[48].beats[0].lyric,'我');
  assert.equal(phrase(result[47]),'赖','接入副歌前不追加另一条收尾乐句');
  assert.equal(phrase(result[55]),'赖对你偏爱');
  for (const n of [1,2,3,4,28,60,61]) assert.equal(phrase(result[n-1]),'');
  for (const row of lyrics.bars.filter(row => row.copyFrom)) assert.equal(phrase(result[row.number-1]),phrase(result[row.copyFrom-1]));
});

test('歌词配置拒绝越界、重复索引、装饰音与不存在的复制来源', () => {
  for (const row of [
    {number:62,syllables:[[0,'字']]},
    {number:5,syllables:[[99,'字']]},
    {number:5,syllables:[[2,'字'],[2,'字']]},
    {number:8,syllables:[[0,'字']]},
    {number:5,copyFrom:999}
  ]) assert.throws(() => attachLyrics(bars,{bars:[row]}));
});

test('生成AlphaTex保留61小节、全部歌词及90个打板标记', () => {
  const importer = new alphaTab.importer.AlphaTexImporter();
  importer.initFromString(readFileSync(new URL('../score/score.alphatex',import.meta.url),'utf8'),new alphaTab.Settings());
  const parsed = importer.readScore().tracks[0].staves[0].bars;
  const expected = attachLyrics(bars,lyrics);
  assert.equal(parsed.length,61);
  let markers=0;
  parsed.forEach((bar,i) => {
    const beats=bar.voices[0].beats;
    assert.equal(beats.length,expected[i].beats.length);
    beats.forEach((beat,j) => {
      assert.equal(beat.lyrics?.[0] || '',expected[i].beats[j].lyric || '',`第${i+1}小节，第${j}音`);
      if (beat.text === '*') markers++;
    });
  });
  assert.equal(markers,90);
});
