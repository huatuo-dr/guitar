export const display = name => name.replaceAll('#', '♯').replaceAll('b', '♭');
export const escape = value => String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));

export function chordDiagram(name, shape, id) {
  const start = shape.baseFret ?? shape.barre?.fret ?? 1;
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

