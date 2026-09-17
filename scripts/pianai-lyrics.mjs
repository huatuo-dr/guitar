// Keep the user's original engraving data independent from lyric alignment.
export function attachLyrics(bars,lyrics) {
  const result = structuredClone(bars);
  const byNumber = new Map(result.map(bar => [bar.number,bar]));
  const entries = new Map();
  for (const row of lyrics.bars) {
    if (entries.has(row.number)) throw new Error(`歌词小节重复：${row.number}`);
    entries.set(row.number,row);
  }
  const resolved = new Map();
  const resolving = new Set();
  function resolve(number) {
    if (resolved.has(number)) return resolved.get(number);
    const row = entries.get(number);
    if (!row || resolving.has(number)) throw new Error(`歌词复制来源不存在或循环：${number}`);
    resolving.add(number);
    const syllables = row.copyFrom ? resolve(row.copyFrom) : row.syllables;
    if (!Array.isArray(syllables)) throw new Error(`歌词数据无效：${number}`);
    resolving.delete(number);
    resolved.set(number,syllables);
    return syllables;
  }
  for (const row of lyrics.bars) {
    const bar = byNumber.get(row.number);
    if (!bar) throw new Error(`歌词小节不存在：${row.number}`);
    const used = new Set();
    for (const [index,text] of resolve(row.number)) {
      const beat = bar.beats[index];
      if (!Number.isInteger(index) || !beat || beat.grace || used.has(index) || typeof text !== 'string' || !text.trim()) {
        throw new Error(`歌词落点无效：第${row.number}小节，第${index}音`);
      }
      used.add(index);
      beat.lyric = text;
    }
  }
  return result;
}
