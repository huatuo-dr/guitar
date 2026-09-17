import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { showTiedSlideFrets } from './alphatab-display.mjs';

const root = new URL('../', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');
const intro = JSON.parse(await read('score/intro.json'));
const aSection = JSON.parse(await read('score/a-section.json'));
const bSection = JSON.parse(await read('score/b-section.json'));
const cSection = JSON.parse(await read('score/c-section.json'));
const remaining = JSON.parse(await read('score/remaining.json'));
const bars = [...intro.bars,...aSection.bars,...bSection.bars,...cSection.bars];
for (const bar of remaining.bars) {
  if (bar.number !== bars.length + 1) throw new Error(`小节编号不连续：${bar.number}`);
  const original = bar.repeatOf ? bars.find(source => source.number === bar.repeatOf) : bar;
  if (!original) throw new Error(`第 ${bar.number} 小节的重复来源不存在`);
  bars.push({...structuredClone(original),number:bar.number,...(bar.repeatOf ? {repeatOf:bar.repeatOf} : {})});
}
const data = {
  ...intro,
  title:'《偏爱》指弹',
  source:'截图目录中的完整小节截图；截图/小节信息.txt',
  notes:[...intro.notes,...aSection.notes,...bSection.notes,...cSection.notes,...remaining.notes],
  sections:[{start:1,end:4,name:'前奏'},{start:5,end:12,name:'A段'},{start:13,end:16,name:'B段'},{start:17,end:28,name:'C段'},...remaining.sections],
  bars
};

function toAlphaTex(score) {
  const bars = score.bars.map(bar => {
    const section = score.sections?.find(section => section.start === bar.number);
    const content = bar.beats.map(beat => {
      const notes = beat.notes.map(note => {
        const effects = [note.legato && 'h', note.harmonic && 'nh', note.tie && 't', note.slide === 'legato' && 'sl'].filter(Boolean);
        return `${note.fret}.${note.string}${effects.length ? `{${effects.join(' ')}}` : ''}`;
      });
      const effects = [beat.dotted && 'd', beat.arpeggio === 'up' && 'ad', beat.grace && 'gr beforeBeat', beat.tuplet && `tu ${beat.tuplet.join(' ')}`, beat.text && `txt ${JSON.stringify(beat.text)}`].filter(Boolean);
      return `(${notes.join(' ')}).${beat.duration}${effects.length ? `{${effects.join(' ')}}` : ''}`;
    }).join(' ');
    return (section ? `\\section "${section.name}"\n` : '') + content;
  });
  return `\\title "${score.title}"\n\\capo ${score.capo}\n.\n\\ts ${score.timeSignature.join(' ')}\n${bars.join('\n|\n')}\n`;
}

const tex = toAlphaTex(data);
await writeFile(new URL('score/intro.alphatex', root), toAlphaTex({...intro,title:data.title}));
await writeFile(new URL('score/score.alphatex', root), tex);

const [template, library, font, license, fontLicense] = await Promise.all([
  read('src/template.html'),
  read('node_modules/@coderline/alphatab/dist/alphaTab.js'),
  readFile(new URL('node_modules/@coderline/alphatab/dist/font/Bravura.woff2', root)),
  read('node_modules/@coderline/alphatab/LICENSE'),
  read('node_modules/@coderline/alphatab/dist/font/Bravura-OFL.txt')
]);
const escapeJson = value => JSON.stringify(value).replaceAll('<', '\\u003c');
const tokens = {
  VIEW: await read('src/score-view.js')+'\n'+await read('src/auto-scroll.js'),
  AUTO_SCROLL_CSS: await read('src/auto-scroll.css'),
  LIBRARY: showTiedSlideFrets(library).replace(/\/\/# sourceMappingURL=.*$/gm, '').replace(/<\/script/gi, '<\\/script'),
  FONT: font.toString('base64'),
  TEX: escapeJson(tex),
  DATA: escapeJson(data),
  LICENSE: `${license}\n\n${fontLicense}`.replaceAll('&', '&amp;').replaceAll('<', '&lt;')
};
const html = template.replace(/@@(LIBRARY|FONT|TEX|DATA|LICENSE|VIEW|AUTO_SCROLL_CSS)@@/g, (_, token) => tokens[token]);
await mkdir(new URL('sheet_music/', root), {recursive:true});
await writeFile(new URL('sheet_music/偏爱指弹.html', root), html);
console.log(`生成 sheet_music/偏爱指弹.html：${(Buffer.byteLength(html) / 1024 / 1024).toFixed(2)} MB，${data.bars.length} 小节，脚本与字体已内嵌。`);
