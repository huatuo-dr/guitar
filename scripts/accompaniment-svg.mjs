// Build-time SVG engraving for the accompaniment voice. No browser library is needed.
import {createBeatPositioner,eventBeats,lyricLines,renderNumberedMelody} from './numbered-notation.mjs';
const escape = value => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
const kinds = {d:'down', u:'up', h:'hold', a:'arpeggio'};

export function expandBars(data) {
  return data.bars.map(bar => ({
    ...bar,
    beats:bar.beats ?? 4,
    chords:bar.chords.map(([beat, name]) => ({beat, name})),
    events:data.patterns[bar.pattern].map(event => {
      if (typeof event !== 'string') return {...event};
      const match = /^([duha])(4|8|16|32)$/.exec(event);
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
    const base=shape.baseFret??1;
    if (!Number.isInteger(base)||base<1||shape.frets.length !== 6 || shape.frets.some(f => !Number.isInteger(f) || f < -1 || f > base+3 || (f>0&&f<base))) throw new Error(`和弦指法无效：${name}`);
  }
  const expanded=expandBars(data);
  for (const [i, bar] of expanded.entries()) {
    if (bar.number !== i + 1) throw new Error('小节编号不连续');
    const duration = bar.events.reduce((n, e) => n + eventBeats(e), 0);
    if (duration !== bar.beats || ![2,4].includes(bar.beats)) throw new Error(`第${bar.number}小节时值与拍号不符`);
    let previous = 0;
    for (const chord of bar.chords) {
      if (!data.chordShapes[chord.name] || chord.beat <= previous || chord.beat > bar.beats) throw new Error(`第${bar.number}小节和弦无效`);
      previous = chord.beat;
    }
    if (bar.chords[0]?.beat !== 1) throw new Error('每小节必须指定起始和弦');
    for (const [eventIndex,event] of bar.events.entries()) {
      if (!['down','up','hold','arpeggio','note','pluck','rest','fretted'].includes(event.kind) || ![4,8,16,32].includes(event.duration)) throw new Error('事件无效');
      if (event.kind === 'note' && (!Number.isInteger(event.string) || event.string < 1 || event.string > 6 || !Number.isInteger(event.fret) || event.fret < 0)) throw new Error('品位或弦号无效');
      if(event.kind==='pluck'){
        if(!Array.isArray(event.strings)||!event.strings.length||event.strings.some(s=>!Number.isInteger(s)||s<1||s>6)||new Set(event.strings).size!==event.strings.length)throw new Error('拨弦弦位无效');
        for(const n of event.notes??[])if(!Number.isInteger(n.string)||n.string<1||n.string>6||!Number.isInteger(n.fret)||n.fret<0||event.strings.includes(n.string))throw new Error('同时拨弦品位无效');
      }
      if(event.kind==='fretted'){
        if(!Array.isArray(event.notes)||!event.notes.length||new Set(event.notes.map(n=>n.string)).size!==event.notes.length||event.notes.some(n=>!Number.isInteger(n.string)||n.string<1||n.string>6||!Number.isInteger(n.fret)||n.fret<0))throw new Error('指弹弦品无效');
        if(event.arpeggio!==undefined&&event.arpeggio!=='up')throw new Error('指弹琶音方向无效');
        for(const note of event.notes){
          if(!(note.hammerToNext||note.pullToNext||note.slideToNext||note.tieToNext))continue;
          const next=bar.events[eventIndex+1]??(note.tieToNext?expanded[i+1]?.events[0]:undefined);
          const target=next?.notes?.find(n=>n.string===note.string);
          if(!target||(note.tieToNext&&target.fret!==note.fret))throw new Error(`第${bar.number}小节技法终点无效`);
        }
      }
      for(const string of [event.startString,event.endString])if(string!==undefined&&(!Number.isInteger(string)||string<1||string>6))throw new Error('扫弦范围无效');
      if(event.kind==='rest' && event.duration!==8)throw new Error('当前仅支持八分休止');
      if(event.sourceArrow!==undefined && (event.kind!=='hold'||!['up','down'].includes(event.sourceArrow)))throw new Error('延音扫弦箭头无效');
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
  const base=shape.baseFret??1;
  const fretCount=Math.max(3,...shape.frets.filter(f=>f>0).map(f=>f-base+1));
  const step=36/fretCount;
  let svg = `<g class="chord-diagram" transform="translate(${x},${y})"><title>${escape(name)}：6弦至1弦 ${shape.frets.map(f => f < 0 ? '×' : f).join(' ')}${shape.reference ? '，补充参考指法' : ''}</title>`;
  svg += text(17,-17, name + (shape.reference ? '†' : ''), 'chord-name', 'middle');
  for (let s = 0; s < 6; s++) svg += line(s * 7,0,s * 7,36);
  for (let f = 0; f <= fretCount; f++) svg += line(0,f * step,35,f * step, f === 0 && base===1 ? 'stroke-width="2"' : '');
  if(base>1)svg+=text(-6,8,base,'position-label','end');
  if (shape.barre) {
    const {from,to,fret} = shape.barre;
    svg += line((6-from)*7,(fret-base+.5)*step,(6-to)*7,(fret-base+.5)*step,'stroke-width="5" stroke-linecap="round"');
  }
  shape.frets.forEach((fret, s) => {
    if (fret <= 0) svg += text(s*7,-4,fret === 0 ? '○' : '×','open-string','middle');
    else svg += dot(s*7,(fret-base+.5)*step);
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
  const action = {rest:'休止',down:'下扫',up:'上扫',hold:'延续',arpeggio:'向上箭头琶音'};
  const events = bar.events.map(e => `${e.kind==='fretted'?e.notes.map(n=>`${n.string}弦${n.fret}品${n.hammerToNext?'击弦':n.pullToNext?'勾弦':n.slideToNext?'滑音':n.tieToNext?'延音':''}`).join('、'):e.kind === 'note' ? `${e.string}弦${e.fret}品${e.hammerToNext ? '击弦至下一音' : e.pullToNext?'勾弦至下一音':e.slideToNext?'滑音至下一音':''}` : e.kind==='pluck'?`拨${e.strings.join('、')}弦${(e.notes??[]).map(n=>`与${n.string}弦${n.fret}品`).join('')}`:action[e.kind]}·${e.duration}分`).join('，');
  return `第${bar.number}小节；${bar.beats}/4拍；${bar.chords.map(c => `第${c.beat}拍${c.name}`).join('，')}；${events}${bar.note ? '；'+bar.note : ''}`;
}

function renderFrettedEvent(event,next,right) {
  const at=event.x;let svg='';
  if(event.arpeggio==='up'){
    const strings=event.notes.map(n=>n.string);
    svg+='<g class="fretted-arpeggio">'+arrow(at-10,TOP+(Math.max(...strings)-1)*STRING_GAP,TOP+(Math.min(...strings)-1)*STRING_GAP,true)+'</g>';
  }
  for(const note of event.notes){
    const y=TOP+(note.string-1)*STRING_GAP;
    const width=String(note.fret).length>1?16:10;
    svg+=`<rect x="${at-width/2}" y="${y-6}" width="${width}" height="13" class="note-background"/>`+text(at,y+4,note.fret,'fret','middle');
    if(note.hammerToNext||note.pullToNext||note.slideToNext||note.tieToNext){
      const end=next?.x??right;
      svg+=`<path class="${note.tieToNext?'tab-tie':'tab-legato'}" d="M ${at} ${y-9} Q ${(at+end)/2} ${y-20} ${end} ${y-9}" fill="none"/>`;
      if(!note.tieToNext)svg+=text((at+end)/2,y-17,note.pullToNext?'P':note.slideToNext?'S':'H',note.slideToNext?'slide-label':'hammer','middle');
    }
  }
  return svg;
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
    elapsed += eventBeats(event);
    return result;
  });
  const previousBar=data.bars[bar.number-2];
  const previousEvent=previousBar?data.patterns[previousBar.pattern].at(-1):undefined;
  if(previousEvent?.kind==='fretted'){
    for(const note of previousEvent.notes.filter(n=>n.tieToNext)){
      const y=TOP+(note.string-1)*STRING_GAP-9;
      svg+=`<path class="tab-tie" d="M ${x} ${y-4} Q ${(x+placed[0].x)/2} ${y-8} ${placed[0].x} ${y}" fill="none"/>`;
    }
  }
  if(previousEvent?.tieToNext){
    const first=placed[0],y=first.kind==='pluck'?TOP+(first.strings[0]-1)*STRING_GAP-6:TOP-8;
    svg+=`<path class="tab-tie" d="M ${x} ${y-4} Q ${(x+first.x)/2} ${y-8} ${first.x} ${y}" fill="none"/>`;
  }
  placed.forEach((event, i) => {
    const at = event.x;
    if(event.kind==='fretted')svg+=renderFrettedEvent(event,placed[i+1],x+BAR_WIDTH);
    const chord = bar.chords.findLast(c => c.beat <= event.beat);
    const bassIndex = data.chordShapes[chord.name].frets.findIndex(f => f >= 0);
    const bassY = TOP + (5-bassIndex) * STRING_GAP;
    const strokeKind = event.sourceArrow ?? event.kind;
    if (strokeKind === 'down') svg += arrow(at,event.startString?TOP+(event.startString-1)*STRING_GAP:Number.isInteger(event.beat)?bassY:TOP+24,event.endString?TOP+(event.endString-1)*STRING_GAP:TOP);
    if (strokeKind === 'up') svg += arrow(at,event.startString?TOP+(event.startString-1)*STRING_GAP:TOP,event.endString?TOP+(event.endString-1)*STRING_GAP:TOP+24);
    if (event.kind === 'arpeggio') svg += arrow(at,event.startString?TOP+(event.startString-1)*STRING_GAP:bassY,event.endString?TOP+(event.endString-1)*STRING_GAP:TOP,true);
    if (event.kind === 'hold' && !event.sourceArrow) svg += text(at,TOP+23,'–','hold','middle');
    if(event.kind==='rest') svg+=`<g class="tab-rest"><ellipse cx="${at-2}" cy="${TOP+22}" rx="2.5" ry="2" fill="currentColor"/><path d="M ${at-2} ${TOP+24} Q ${at+2} ${TOP+25} ${at+4} ${TOP+19} L ${at-1} ${TOP+34}" fill="none" stroke-width="1.8"/></g>`;
    if(event.kind==='pluck'){
      for(const string of event.strings){
        const y=TOP+(string-1)*STRING_GAP;
        svg+=`<path class="pluck-cross" d="M ${at-3} ${y-3} l 6 6 M ${at-3} ${y+3} l 6 -6" fill="none"/>`;
      }
      for(const n of event.notes??[]){
        const y=TOP+(n.string-1)*STRING_GAP;
        svg+=`<rect x="${at-5}" y="${y-6}" width="10" height="13" class="note-background"/>`+text(at,y+4,n.fret,'fret','middle');
      }
    }
    if (event.kind === 'note') {
      const y = TOP + (event.string-1) * STRING_GAP;
      svg += `<rect x="${at-5}" y="${y-6}" width="10" height="13" class="note-background"/>` + text(at,y+4,event.fret,'fret','middle');
      if (event.hammerToNext || event.pullToNext || event.slideToNext) {
        const end = placed[i+1].x;
        svg += `<path d="M ${at} ${y-9} Q ${(at+end)/2} ${y-20} ${end} ${y-9}" fill="none"/>`;
        svg += text((at+end)/2,y-17,event.pullToNext?'P':event.slideToNext?'S':'H',event.slideToNext?'slide-label':'hammer','middle');
      }
    }
    if(event.tieToNext){
      const y=event.kind==='pluck'?TOP+(event.strings[0]-1)*STRING_GAP-6:TOP-8;
      const end=placed[i+1]?.x??x+BAR_WIDTH;
      svg+=`<path class="tab-tie" d="M ${at} ${y} Q ${(at+end)/2} ${y-9} ${end} ${y}" fill="none"/>`;
    }
    if (event.kind !== 'rest' && (event.kind !== 'hold' || event.sourceArrow)) svg += line(at,BOTTOM+7,at,STEM_END);
    for(let i=0;i<(event.doubleDotted?2:event.dotted?1:0);i++)svg+=`<circle class="tab-duration-dot" cx="${at+6+i*5}" cy="${STEM_END-3}" r="1.5"/>`;
  });
  // Beam within each quarter-note pulse; connect only contiguous eighth/sixteenth events.
  for (let beat = 1; beat <= bar.beats; beat++) {
    const group = placed.filter(e => Math.floor(e.beat) === beat);
    for (const [duration, y] of [[8,STEM_END],[16,STEM_END-5],[32,STEM_END-10]]) {
      let run = [];
      const flush = () => {
        if (run.length > 1) svg += line(run[0].x,y,run.at(-1).x,y,'stroke-width="2.5"');
        else if (run.length) svg += line(run[0].x,y,run[0].x+5,y,'stroke-width="2.5"');
        run = [];
      };
      for (const event of group) {
        if (event.duration >= duration && event.kind!=='rest' && (event.kind!=='hold'||event.sourceArrow)) run.push(event); else flush();
      }
      flush();
    }
  }
  if(bar.vocal){
    svg+=line(x,216,x,252,'class="bar-line"')+line(x+BAR_WIDTH,216,x+BAR_WIDTH,252,'class="bar-line"');
    if(meterChange)svg+='<g class="melody-time-signature">'+text(x+15,228,bar.beats,'meter-number','middle')+text(x+15,247,4,'meter-number','middle')+'</g>';
    const previous=data.bars[bar.number-2]?.vocal;
    svg+=renderNumberedMelody(bar.vocal,{position:eventX,left:x,right:x+BAR_WIDTH,incomingTie:!!previous?.events.at(-1).tieToNext||previous?.crossBarTieStart!==undefined,incomingSlur:bar.vocal.incomingSlur||previous?.events.at(-1).slurToNext||false});
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
