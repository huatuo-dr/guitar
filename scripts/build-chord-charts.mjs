import {readFile, writeFile, mkdir} from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const data = JSON.parse(await readFile(new URL('knowledge/chord-charts.json', root), 'utf8'));
import {display,escape,chordDiagram as diagram} from './chord-diagram.mjs';

const filters = [{name:'all'}, ...data.keys].map(({name}) => `<button type="button" data-key="${name}" aria-pressed="${name === 'all'}">${name === 'all' ? '全部' : `${display(name)} 调`}</button>`).join('\n');
const charts = data.keys.map(key => `<section class="key-section" data-key-section="${key.name}" aria-labelledby="key-${key.name}">
  <h2 id="key-${key.name}">${display(key.name)} <span>大调</span></h2>
  <div class="chord-grid">${key.chords.map((name, index) => {
    const shape = data.shapes[name];
    const degree = data.degrees[index];
    return `<article class="chord-card" data-chord="${name}"><div class="degree"><span>${degree.label}</span><span>${degree.tones}</span></div><h3>${display(name)}</h3>${diagram(name, shape, `chord-${key.name}-${index}`)}<p class="shape-note">${escape(shape.note || '\u00a0')}</p></article>`;
  }).join('\n')}</div>
</section>`).join('\n');
const template = await readFile(new URL('src/chord-charts.html', root), 'utf8');
await mkdir(new URL('tools/', root), {recursive:true});
await writeFile(new URL('tools/各调和弦图.html', root), template.replace('<!-- KEY_FILTERS -->', filters).replace('<!-- CHORD_CHARTS -->', charts));
console.log(`已生成各调和弦图：${data.keys.length} 个调，${data.keys.length * data.degrees.length} 张指法图。`);
