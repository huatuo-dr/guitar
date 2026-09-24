import {expandBars,performanceOrder,validateScore} from './accompaniment-svg.mjs';
import {eventBeats} from './numbered-notation.mjs';

// Convert the written guitar part, not the separate numbered melody, to a
// performed voice. Explicit frets take precedence; crosses use the current shape.
export function buildAccompanimentPlayback(data) {
  validateScore(data);
  const bars=expandBars(data);
  const visits=new Map();
  const sequence=[];
  const texBars=[];
  let tick=0;
  let lastNotes=[];
  let tiedStrings=new Set();
  for(const number of performanceOrder(data)) {
    const bar=bars[number-1];
    const visit=(visits.get(number)??0)+1;
    visits.set(number,visit);
    sequence.push({bar:number,visit,id:`bar-${number}${visit>1?`-repeat-${visit}`:''}`,startTick:tick,duration:bar.beats*960});
    let elapsed=0;
    const events=[];
    for(const event of bar.events) {
      const beat=1+elapsed/960;
      const chord=bar.chords.findLast(c=>c.beat<=beat+1e-8);
      const frets=chord?data.chordShapes[chord.name].frets:[];
      const fromShape=string=>{
        const fret=frets[6-string];
        if(!Number.isInteger(fret)||fret<0)throw new Error(`第${number}小节第${beat}拍的${string}弦没有可弹奏品位`);
        return {string,fret};
      };
      let notes=[];
      if(event.kind==='note')notes=[{string:event.string,fret:event.fret,hammerToNext:event.hammerToNext,pullToNext:event.pullToNext,slideToNext:event.slideToNext}];
      else if(event.kind==='pluck')notes=[...event.strings.map(fromShape),...(event.notes??[])];
      else if(event.kind==='fretted')notes=event.notes;
      else if(['down','up','arpeggio'].includes(event.kind)) {
        const bass=6-frets.findIndex(f=>f>=0);
        const start=event.startString??(event.kind==='up'?1:event.kind==='down'&&!Number.isInteger(beat)?4:bass);
        const end=event.endString??(event.kind==='up'?4:1);
        const step=start<=end?1:-1;
        for(let string=start;step>0?string<=end:string>=end;string+=step)if(frets[6-string]>=0)notes.push(fromShape(string));
      } else if(event.kind==='hold') {
        if(!lastNotes.length)throw new Error(`第${number}小节延音缺少起音`);
        notes=lastNotes.map(n=>({string:n.string,fret:n.fret,tie:true}));
      } else if(event.kind!=='rest')throw new Error(`不支持的播放事件：${event.kind}`);
      const pitches=notes.map(note=>{
        const tied=note.tie||tiedStrings.has(note.string);
        if(tied&&!lastNotes.some(n=>n.string===note.string&&n.fret===note.fret))throw new Error(`第${number}小节延音音高不一致`);
        const effects=[tied&&'t',(note.hammerToNext||note.pullToNext)&&'h',note.slideToNext&&'sl'].filter(Boolean);
        return `${note.fret}.${note.string}${effects.length?`{${effects.join(' ')}}`:''}`;
      });
      const brush={down:'bd',up:'bu',arpeggio:'ad'}[event.kind]??(event.arpeggio==='up'?'ad':null);
      const effects=[brush,event.doubleDotted?'dd':event.dotted?'d':null,event.tuplet===3?'tu 3 2':null].filter(Boolean);
      events.push(`${pitches.length?`(${pitches.join(' ')})`:'r'}.${event.duration}${effects.length?`{${effects.join(' ')}}`:''}`);
      tiedStrings=new Set(notes.filter(n=>n.tieToNext||event.tieToNext).map(n=>n.string));
      lastNotes=notes;
      elapsed+=Math.round(eventBeats(event)*960);
    }
    if(elapsed!==bar.beats*960)throw new Error(`第${number}小节播放时值不完整`);
    texBars.push(`\\ts ${bar.beats} 4 ${events.join(' ')}`);
    tick+=elapsed;
  }
  return {
    label:data.scoreType==='fingerstyle'?'指弹':'伴奏',
    capoNote:data.capo===undefined?'试听按未夹变调夹音高':'',
    tempo:60,totalTicks:tick,sequence,
    tex:`\\title "${data.title}"\n\\instrument 25\n\\capo ${data.capo??0}\n\\tempo 60\n.\n${texBars.join('\n|\n')}\n`
  };
}
