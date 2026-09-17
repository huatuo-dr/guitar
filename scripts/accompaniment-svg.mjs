// Build-time SVG engraving for the accompaniment voice. No browser library is needed.
import {createBeatPositioner,lyricLines,renderNumberedMelody} from './numbered-notation.mjs';
const escape = value => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
const kinds = {d:'down', u:'up', h:'hold', a:'arpeggio'};

export function expandBars(data) {
  return data.bars.map(bar => ({
    ...bar,
    beats:bar.beats ?? 4,
    chords:bar.chords.map(([beat, name]) => ({beat, name})),
    events:data.patterns[bar.pattern].map(event => {
      if (typeof event !== 'string') return {...event};
      const match = /^([duha])(4|8|16)$/.exec(event);
      if (!match) throw new Error(`未知节奏事件：${event}`);
      return {kind:kinds[match[1]], duration:Number(match[2])};
    })
  }));
}

export function performanceOrder(data) {
  return data.route.flatMap(({start, end}) => Array.from({length:end - start + 1}, (_, i) => start + i));
}

export function validateScore(data) {
  for (const [name, shape] of Object.entries(data.chordShapes)) {
    if (shape.frets.length !== 6 || shape.frets.some(f => !Number.isInteger(f) || f < -1 || f > 3)) throw new Error(`和弦指法无效：${name}`);
  }
  for (const [i, bar] of expandBars(data).entries()) {
    if (bar.number !== i + 1) throw new Error('小节编号不连续');
    const duration = bar.events.reduce((n, e) => n + 4 / e.duration, 0);
    if (duration !== bar.beats || ![2,4].includes(bar.beats)) throw new Error(`第${bar.number}小节时值与拍号不符`);
    let previous = 0;
    for (const chord of bar.chords) {
      if (!data.chordShapes[chord.name] || chord.beat <= previous || chord.beat > bar.beats) throw new Error(`第${bar.number}小节和弦无效`);
      previous = chord.beat;
    }
    if (bar.chords[0]?.beat !== 1) throw new Error('每小节必须指定起始和弦');
    for (const event of bar.events) {
      if (!['down','up','hold','arpeggio','note'].includes(event.kind) || ![4,8,16].includes(event.duration)) throw new Error('事件无效');
      if (event.kind === 'note' && (!Number.isInteger(event.string) || event.string < 1 || event.string > 6 || !Number.isInteger(event.fret) || event.fret < 0)) throw new Error('品位或弦号无效');
    }
  }
  for (const route of data.route) {
    if (!Number.isInteger(route.start) || !Number.isInteger(route.end) || route.start < 1 || route.end > data.bars.length || route.start > route.end) throw new Error('演奏顺序引用了不存在的小节');
  }
  return true;
}

const line = (x1,y1,x2,y2,extra='') => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" ${extra}/>`;
const text = (x,y,content,cls='',anchor='start') => `<text x="${x}" y="${y}" class="${cls}" text-anchor="${anchor}">${escape(content)}</text>`;
const dot = (x,y,r=2.8) => `<circle cx="${x}" cy="${y}" r="${r}"/>`;

function chordDiagram(name, shape, x, y) {
  let svg = `<g class="chord-diagram" transform="translate(${x},${y})"><title>${escape(name)}：6弦至1弦 ${shape.frets.map(f => f < 0 ? '×' : f).join(' ')}${shape.reference ? '，补充参考指法' : ''}</title>`;
  svg += text(17,-17, name + (shape.reference ? '†' : ''), 'chord-name', 'middle');
  for (let s = 0; s < 6; s++) svg += line(s * 7,0,s * 7,36);
  for (let f = 0; f < 4; f++) svg += line(0,f * 12,35,f * 12, f === 0 ? 'stroke-width="2"' : '');
  if (shape.barre) {
    const {from,to,fret} = shape.barre;
    svg += line((6-from)*7,(fret-.5)*12,(6-to)*7,(fret-.5)*12,'stroke-width="5" stroke-linecap="round"');
  }
  shape.frets.forEach((fret, s) => {
    if (fret <= 0) svg += text(s*7,-4,fret === 0 ? '○' : '×','open-string','middle');
    else svg += dot(s*7,(fret-.5)*12);
  });
  return svg + '</g>';
}

export function renderChordGuide(data) {
  return Object.entries(data.chordShapes).map(([name, shape]) => `<div class="chord-card"><svg viewBox="0 0 100 102" role="img" aria-label="${escape(name)}和弦指法">${chordDiagram(name,shape,32,35)}${text(50,93,shape.frets.map(f => f < 0 ? '×' : f).join(' '),'fret-code','middle')}</svg></div>`).join('');
}

const BAR_WIDTH = 270;
const LEFT = 46;
const TOP = 125;
const STRING_GAP = 8;
const BOTTOM = TOP + STRING_GAP * 5;
const STEM_END = 189;
const ROW_HEIGHT = 237;

function arrow(x, from, to, wavy = false) {
  let svg = '';
  if (wavy) {
    let path = `M ${x} ${from}`;
    for (let y = from; y > to + 5; y -= 8) path += ` q -4 -2 0 -4 q 4 -2 0 -4`;
    svg += `<path d="${path}" fill="none"/>`;
  } else svg += line(x,from,x,to);
  const offset = to < from ? 5 : -5;
  return svg + `<path d="M ${x-3.5} ${to+offset} L ${x} ${to} L ${x+3.5} ${to+offset}" fill="none"/>`;
}

function measureDescription(bar) {
  const action = {down:'下扫',up:'上扫',hold:'延续',arpeggio:'向上箭头琶音'};
  const events = bar.events.map(e => `${e.kind === 'note' ? `${e.string}弦${e.fret}品${e.hammerToNext ? '击弦至下一音' : ''}` : action[e.kind]}·${e.duration}分`).join('，');
  return `第${bar.number}小节；${bar.beats}/4拍；${bar.chords.map(c => `第${c.beat}拍${c.name}`).join('，')}；${events}${bar.note ? '；'+bar.note : ''}`;
}

function renderBar(bar, data, index, rowHeight) {
  const x = LEFT + index * BAR_WIDTH;
  const meterChange=bar.number===1 || (data.bars[bar.number-2].beats??4)!==bar.beats;
  const inset=meterChange?45:21;
  const span = BAR_WIDTH - inset - 21;
  const eventX = createBeatPositioner(bar.events,bar.vocal,bar.beats,x+inset,span);
  const section = data.sections.find(s => s.start === bar.number);
  let svg = `<g class="measure" id="bar-${bar.number}" data-bar="${bar.number}" tabindex="-1"><title>${escape(measureDescription(bar))}</title>`;
  svg += `<rect class="measure-highlight" x="${x+2}" y="1" width="${BAR_WIDTH-4}" height="${rowHeight-2}" rx="5"/>`;
  svg += text(x+2,TOP-6,bar.number,'bar-number','end');
  if (section) svg += text(x+37,13,section.name,'section-label');
  if (bar.startLabel) svg += text(x+8,30,bar.startLabel,'navigation-label');
  if (bar.volta) {
    svg += line(x+5,39,x+BAR_WIDTH-4,39);
    if (bar.voltaStart || index === 0) {
      svg += line(x+5,39,x+5,50);
      svg += text(x+10,51,`${bar.volta}.${!bar.voltaStart ? '（续）' : ''}`,'volta-label');
    }
    if (bar.voltaEnd) svg += line(x+BAR_WIDTH-4,39,x+BAR_WIDTH-4,50);
  }
  for (const chord of bar.chords) svg += chordDiagram(chord.name,data.chordShapes[chord.name],eventX(chord.beat)-8,83);
  for (let s = 0; s < 6; s++) svg += line(x,TOP+s*STRING_GAP,x+BAR_WIDTH,TOP+s*STRING_GAP,'class="staff-line"');
  svg += line(x,TOP,x,BOTTOM,'class="bar-line"');
  svg += line(x+BAR_WIDTH,TOP,x+BAR_WIDTH,BOTTOM,'class="bar-line"');
  if(meterChange){
    svg+=`<g class="time-signature" data-bar="${bar.number}" data-meter="${bar.beats}/4"><rect x="${x+5}" y="${TOP+1}" width="20" height="38" class="note-background"/>`;
    svg+=text(x+15,TOP+17,bar.beats,'meter-number','middle')+text(x+15,TOP+34,4,'meter-number','middle')+'</g>';
  }
  if (bar.repeatStart) {
    svg += line(x+2,TOP,x+2,BOTTOM,'stroke-width="3"') + line(x+7,TOP,x+7,BOTTOM);
    svg += dot(x+12,TOP+12,2) + dot(x+12,TOP+28,2);
  }
  if (bar.repeatEnd) {
    svg += line(x+BAR_WIDTH-2,TOP,x+BAR_WIDTH-2,BOTTOM,'stroke-width="3"') + line(x+BAR_WIDTH-7,TOP,x+BAR_WIDTH-7,BOTTOM);
    svg += dot(x+BAR_WIDTH-12,TOP+12,2) + dot(x+BAR_WIDTH-12,TOP+28,2);
  }
  if (bar.number === data.bars.length) svg += line(x+BAR_WIDTH-4,TOP,x+BAR_WIDTH-4,BOTTOM,'stroke-width="3"');
  let elapsed = 0;
  const placed = bar.events.map(event => {
    const result = {...event, beat:elapsed+1, x:eventX(elapsed+1)};
    elapsed += 4 / event.duration;
    return result;
  });
  placed.forEach((event, i) => {
    const at = event.x;
    const chord = bar.chords.findLast(c => c.beat <= event.beat);
    const bassIndex = data.chordShapes[chord.name].frets.findIndex(f => f >= 0);
    const bassY = TOP + (5-bassIndex) * STRING_GAP;
    if (event.kind === 'down') svg += arrow(at, Number.isInteger(event.beat) ? bassY : TOP+24, TOP);
    if (event.kind === 'up') svg += arrow(at,TOP,TOP+24);
    if (event.kind === 'arpeggio') svg += arrow(at,bassY,TOP,true);
    if (event.kind === 'hold') svg += text(at,TOP+23,'–','hold','middle');
    if (event.kind === 'note') {
      const y = TOP + (event.string-1) * STRING_GAP;
      svg += `<rect x="${at-5}" y="${y-6}" width="10" height="13" class="note-background"/>` + text(at,y+4,event.fret,'fret','middle');
      if (event.hammerToNext) {
        const end = placed[i+1].x;
        svg += `<path d="M ${at} ${y-9} Q ${(at+end)/2} ${y-20} ${end} ${y-9}" fill="none"/>`;
        svg += text((at+end)/2,y-17,'H','hammer','middle');
      }
    }
    if (event.kind !== 'hold') svg += line(at,BOTTOM+7,at,STEM_END);
  });
  // Beam within each quarter-note pulse; connect only contiguous eighth/sixteenth events.
  for (let beat = 1; beat <= bar.beats; beat++) {
    const group = placed.filter(e => Math.floor(e.beat) === beat && e.duration >= 8);
    for (const [duration, y] of [[8,STEM_END],[16,STEM_END-5]]) {
      let run = [];
      const flush = () => {
        if (run.length > 1) svg += line(run[0].x,y,run.at(-1).x,y,'stroke-width="2.5"');
        else if (run.length) svg += line(run[0].x,y,run[0].x+5,y,'stroke-width="2.5"');
        run = [];
      };
      for (const event of group) {
        if (event.duration >= duration) run.push(event); else flush();
      }
      flush();
    }
  }
  if(bar.vocal){
    svg+=line(x,216,x,252,'class="bar-line"')+line(x+BAR_WIDTH,216,x+BAR_WIDTH,252,'class="bar-line"');
    if(meterChange)svg+='<g class="melody-time-signature">'+text(x+15,228,bar.beats,'meter-number','middle')+text(x+15,247,4,'meter-number','middle')+'</g>';
    const previous=data.bars[bar.number-2]?.vocal;
    svg+=renderNumberedMelody(bar.vocal,{position:eventX,left:x,right:x+BAR_WIDTH,incomingTie:previous?.events.at(-1).tieToNext??false});
  }
  if (bar.note) svg += text(x+10,rowHeight-10,bar.note,'source-note');
  if (bar.endLabel) svg += text(x+BAR_WIDTH-10,rowHeight-10,bar.endLabel,'navigation-label','end');
  return svg + '</g>';
}

export function renderScore(data, barsPerRow = 4) {
  if (![2,4].includes(barsPerRow)) throw new Error('每行小节数只支持2或4');
  validateScore(data);
  const bars = expandBars(data);
  let html = '';
  for (let start = 0; start < bars.length; start += barsPerRow) {
    const group = bars.slice(start,start+barsPerRow);
    const verseCount=Math.max(0,...group.map(bar=>lyricLines(bar.vocal)));
    const rowHeight=group.some(b=>b.vocal)?(verseCount?280+verseCount*24:272):ROW_HEIGHT;
    html += `<svg class="score-system" viewBox="0 0 ${LEFT + BAR_WIDTH * barsPerRow + 14} ${rowHeight}" role="group" aria-label="第${group[0].number}至${group.at(-1).number}小节">`;
    html += text(12,TOP+6,'T','tab-label') + text(12,TOP+22,'A','tab-label') + text(12,TOP+38,'B','tab-label');
    if(group.some(b=>b.vocal))html+=text(3,235,'简谱','voice-label');
    html += group.map((bar,index) => renderBar(bar,data,index,rowHeight)).join('') + '</svg>';
  }
  return html;
}
