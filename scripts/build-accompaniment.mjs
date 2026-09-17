import {mkdir, readFile, writeFile} from 'node:fs/promises';
import {renderScore, renderChordGuide, validateScore} from './accompaniment-svg.mjs';
import {attachVocals} from './numbered-notation.mjs';

const root = new URL('../', import.meta.url);
const escape = value => String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const metadataItem = (label,value) => `<div><span>${escape(label)}</span><strong>${escape(value)}</strong></div>`;

export async function buildAccompaniment(id,filename) {
  const accompaniment = JSON.parse(await readFile(new URL(`score/${id}.json`,root),'utf8'));
  const vocals = JSON.parse(await readFile(new URL(`score/${id}-vocal.json`,root),'utf8'));
  const data = attachVocals(accompaniment,vocals);
  validateScore(data);

  const meters = [...new Set(data.bars.map(bar => `${bar.beats??data.timeSignature?.[0]??4}/${data.timeSignature?.[1]??4}`))];
  const metadata = [];
  if(data.artist)metadata.push([data.artistLabel??'演唱',data.artist]);
  metadata.push(['拍号',meters.join(' · ')]);
  if(data.fingeringKey) metadata.push(['原调',`1 = ${data.key}`],['指法',`${data.fingeringKey} 指法`]);
  else metadata.push(['调式',`1 = ${data.key}`]);
  if(data.capo!==undefined) metadata.push(['变调夹',`${data.capo} 品`]);
  else if(data.capoText) metadata.push(['变调夹建议',data.capoText]);
  if(data.tempoText)metadata.push(['速度',data.tempoText]);

  const referenceNames = Object.entries(data.chordShapes).filter(([,shape]) => shape.reference).map(([name]) => name).join('、');
  const referenceLegend = referenceNames ? `　　†：补充的 ${referenceNames} 参考指法` : '';
  const techniqueLegend = data.techniqueLegend ?? (data.fingeringKey
    ? '六线谱 ×：按和弦在指定弦拨弦　　H：击弦；P：勾弦　　弧线上的 3：三连音　　—：延续前音'
    : `H：击弦，后一个音不再拨弦　　—：延续前音，不再扫弦${referenceLegend}`);
  const melodyLegend = data.melodyLegend ?? (data.fingeringKey
    ? '简谱：上下圆点表示八度，数字下短线表示减时，0 为休止，— 为延长前音；同音弧线为延音，异音弧线为连音，♭ 为降号，弧线上的 3 为三连音。双行歌词对应两段演唱。'
    : '简谱：上下圆点表示八度，数字下短线表示减时，0 为休止，— 为延长前音；小字号音符为装饰音，同音弧线为延音。双行歌词对应两段演唱。');
  const sourceLink = label => `<a href="${escape(data.source)}" target="_blank" rel="noopener noreferrer">${escape(label)}</a>`;
  const routeNote = data.routeNote??(data.notes??[]).find(note => note.startsWith('第1房子'))??'';
  const routePrint = `演奏顺序：${data.route.map(({start,end}) => `${start}–${end}`).join(' → ')}。${routeNote}`;
  const fingerstyle=data.scoreType==='fingerstyle';
  const hasChords=Object.keys(data.chordShapes).length>0;
  const tokens = {
    ROUTE_HEADING:escape(data.routeHeading??'演奏顺序 · 按原谱反复与跳尾'),
    CHORD_GUIDE:hasChords ? `<details class="optional"><summary>和弦指法速查 · ${Object.keys(data.chordShapes).length} 个和弦</summary><p class="guide-text">图中左至右为 6 弦至 1 弦；○ 空弦，× 不弹，圆点为按弦位置，粗横线为横按。${referenceNames ? `† ${escape(referenceNames)} 为补充参考指法。` : ''}</p><div class="chord-guide">${renderChordGuide(data)}</div></details>` : '',

    PRIMARY_LEGEND:data.primaryLegend ? escape(data.primaryLegend) : fingerstyle ? '<span>六线谱数字：品位</span><span>同列音符：同时拨响</span><span><strong>波浪 ↑</strong> 琶音：低音弦 → 高音弦</span>' : '<span><strong>↑</strong> 下扫：低音弦 → 高音弦</span><span><strong>↓</strong> 上扫：高音弦 → 低音弦</span><span><strong>波浪 ↑</strong> 琶音：低音弦 → 高音弦</span>',
    ACCESSIBLE_DESCRIPTION:fingerstyle ? '吉他六线谱与旋律简谱，可横向滚动' : '吉他六线谱、简谱与歌词，可横向滚动',
    CONTENT_DESCRIPTION:fingerstyle ? `本页依据用户提供的截图整理指弹六线谱${hasChords?'、和弦指法':''}与旋律简谱。` : '本页整理和弦、扫弦、过门，并依据用户提供的截图补充简谱与歌词。',
    SOURCE_DETAIL:fingerstyle ? '六线谱与旋律简谱据用户提供截图整理' : '简谱与歌词据用户提供截图整理',
    FILENAME:escape(filename), TITLE:escape(data.title), METADATA:metadata.map(([label,value]) => metadataItem(label,value)).join(''),
    TECHNIQUE_LEGEND:escape(techniqueLegend), MELODY_LEGEND:escape(melodyLegend),
    SOURCE_CREDIT:data.source ? sourceLink(data.sourceTitle) : escape(data.sourceTitle),
    SOURCE_COMPARISON:data.source ? `可对照${sourceLink('网页原谱')}。` : '可对照用户提供的原谱截图。',
    SECTIONS:data.sections.map(s => `<a class="jump-link" href="#bar-${s.start}" data-jump="${s.start}">${escape(s.name)}<small>${s.start}–${s.end} 小节</small></a>`).join(''),
    ROUTE:data.route.map((r,i) => `<a href="#bar-${r.start}" data-jump="${r.start}"><span>${i+1}. ${escape(r.label)}</span><strong>${r.start}–${r.end}</strong></a>`).join(''),
    ROUTE_PRINT:escape(routePrint), BAR_COUNT:data.bars.length,
    SCORE:renderScore(data), SCORE_TWO:renderScore(data,2),
    VIEW:await readFile(new URL('src/score-view.js',root),'utf8')+'\n'+await readFile(new URL('src/auto-scroll.js',root),'utf8'),
    AUTO_SCROLL_CSS:await readFile(new URL('src/auto-scroll.css',root),'utf8'),
    STORAGE_KEY:JSON.stringify(`guitar-view:${id}:v1`).replaceAll('<','\\u003c'),
    NOTES:[...(data.notes??[]),...data.vocalNotes].map(note => `<li>${escape(note)}</li>`).join('')
  };
  const template = await readFile(new URL('src/accompaniment.html',root),'utf8');
  const html = template.replace(/@@([A-Z_]+)@@/g, (_,key) => {
    if (!(key in tokens)) throw new Error(`未知模板字段：${key}`);
    return tokens[key];
  });
  await mkdir(new URL('sheet_music/',root),{recursive:true});
  await writeFile(new URL(`sheet_music/${filename}`,root),html);
  console.log(`生成 sheet_music/${filename}：${data.bars.length}小节，${Math.ceil(data.bars.length/4)}行，${(Buffer.byteLength(html)/1024).toFixed(0)} KB，离线矢量谱面。`);
}
