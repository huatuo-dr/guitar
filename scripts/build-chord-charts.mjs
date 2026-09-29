import {readFile, writeFile, mkdir} from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const data = JSON.parse(await readFile(new URL('knowledge/chord-charts.json', root), 'utf8'));
const display = name => name.replaceAll('#', '♯').replaceAll('b', '♭');
const escape = value => String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));

function diagram(name, shape, id) {
  const start = shape.barre?.fret || 1;
  const x = string => 34 + (6 - string) * 20;
  const y = fret => 40 + (fret - start + 0.5) * 30;
  const description = shape.frets.map((fret, index) => `${6-index}弦${fret < 0 ? '不弹' : fret === 0 ? '空弦' : `${fret}品，${shape.fingers[index]}指`}`).join('；');
  let svg = `<svg viewBox="0 0 168 193" role="img" aria-labelledby="${id}"><title id="${id}">${escape(display(name))}：${description}${shape.barre ? `；食指横按第${start}品，${shape.barre.from}至${shape.barre.to}弦` : ''}</title>`;
  for (let fret = 0; fret <= 4; fret++) {
    svg += `<path class="fret${start === 1 && fret === 0 ? ' nut' : ''}" d="M34 ${40+fret*30}H134"/>`;
  }
  for (let string = 6; string >= 1; string--) {
    svg += `<path class="string" d="M${x(string)} 40V160"/><text class="string-number" x="${x(string)}" y="183">${string}</text>`;
  }
  svg += `<text class="fret-number" x="12" y="${y(start)+4}">${start}</text>`;
  shape.frets.forEach((fret, index) => {
    const cx = x(6-index);
    if (fret === 0) svg += `<circle class="open" cx="${cx}" cy="23" r="4"/>`;
    else if (fret < 0) svg += `<path class="mute" d="M${cx-4} 19l8 8m0-8l-8 8"/>`;
  });
  if (shape.barre) {
    const {from, to, fret} = shape.barre;
    svg += `<path class="barre" d="M${x(from)} ${y(fret)}H${x(to)}"/><text class="finger" x="${x(from)}" y="${y(fret)+4}">1</text>`;
  }
  shape.frets.forEach((fret, index) => {
    if (fret <= 0 || (shape.barre && fret === shape.barre.fret && 6-index <= shape.barre.from && 6-index >= shape.barre.to)) return;
    svg += `<circle class="dot" cx="${x(6-index)}" cy="${y(fret)}" r="8"/><text class="finger" x="${x(6-index)}" y="${y(fret)+4}">${shape.fingers[index]}</text>`;
  });
  return svg + '</svg>';
}

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
