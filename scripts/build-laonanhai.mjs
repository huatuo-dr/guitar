import {mkdir, readFile, writeFile} from 'node:fs/promises';
import {renderScore, renderChordGuide, validateScore} from './accompaniment-svg.mjs';

const root = new URL('../', import.meta.url);
const data = JSON.parse(await readFile(new URL('score/laonanhai.json', root), 'utf8'));
validateScore(data);
const escape = value => String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const tokens = {
  TITLE:escape(data.title), ARTIST:escape(data.artist), SOURCE:escape(data.source), SOURCE_TITLE:escape(data.sourceTitle),
  SECTIONS:data.sections.map(s => `<a class="jump-link" href="#bar-${s.start}" data-jump="${s.start}">${escape(s.name)}<small>${s.start}–${s.end} 小节</small></a>`).join(''),
  ROUTE:data.route.map((r,i) => `<a href="#bar-${r.start}" data-jump="${r.start}"><span>${i+1}. ${escape(r.label)}</span><strong>${r.start}–${r.end}</strong></a>`).join(''),
  CHORDS:renderChordGuide(data), SCORE:renderScore(data),
  NOTES:data.notes.map(note => `<li>${escape(note)}</li>`).join('')
};
const template = await readFile(new URL('src/accompaniment.html',root),'utf8');
const html = template.replace(/@@([A-Z_]+)@@/g, (_,key) => {
  if (!(key in tokens)) throw new Error(`未知模板字段：${key}`);
  return tokens[key];
});
await mkdir(new URL('sheet_music/',root),{recursive:true});
await writeFile(new URL('sheet_music/老男孩弹唱伴奏.html',root),html);
console.log(`生成 sheet_music/老男孩弹唱伴奏.html：${data.bars.length}小节，14行，${(Buffer.byteLength(html)/1024).toFixed(0)} KB，离线矢量谱面。`);
