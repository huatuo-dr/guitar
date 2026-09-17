// Numbered notation and lyrics transcribed from the images supplied by the user.
const esc = value => String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const text = (x,y,value,cls) => `<text x="${x}" y="${y}" class="${cls}" text-anchor="middle">${esc(value)}</text>`;
const line = (x1,y1,x2,y2,cls='melody-beam') => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" class="${cls}"/>`;
export const eventBeats = note => 4 / note.duration * (note.dotted ? 1.5 : 1) * (note.tuplet===3?2/3:1);
const beatRound = value => Math.round(value*960)/960;

export function attachVocals(score,vocals) {
  if(vocals.bars.length!==score.bars.length) throw new Error('简谱与伴奏小节数不一致');
  const bars=score.bars.map((bar,i)=>{
    const vocal=vocals.bars[i];
    if(vocal.number!==bar.number) throw new Error('简谱小节编号不连续');
    if(!Array.isArray(vocal.events)||!vocal.events.length) throw new Error(`第${bar.number}小节缺少简谱`);
    const beats=vocal.events.reduce((sum,n)=>sum+eventBeats(n),0);
    if(Math.abs(beats-(vocal.beats??4))>1e-8) throw new Error(`第${bar.number}小节简谱时值为${beats}拍`);
    if(Math.abs(beats-(bar.beats??4))>1e-8) throw new Error(`第${bar.number}小节简谱与伴奏时值不一致`);
    if(vocal.crossBarTieStart!==undefined && (!Number.isInteger(vocal.crossBarTieStart)||!vocal.events[vocal.crossBarTieStart]||vocal.events[vocal.crossBarTieStart].hold||vocal.events[vocal.crossBarTieStart].degree===0)) throw new Error('跨小节延音起点无效');
    for(const [index,note] of vocal.events.entries()){
      if(![1,2,4,8,16,32].includes(note.duration)) throw new Error('简谱时值无效');
      if(note.tuplet!==undefined && note.tuplet!==3) throw new Error('简谱连音分组无效');
      if(note.accidental!==undefined && !['b','#','n'].includes(note.accidental)) throw new Error('简谱变音记号无效');
      if(!note.hold && (!Number.isInteger(note.degree)||note.degree<0||note.degree>7)) throw new Error('简谱音级无效');
      if(!Number.isInteger(note.octave??0)||Math.abs(note.octave??0)>2) throw new Error('简谱八度无效');
      if(note.lyrics && (!Array.isArray(note.lyrics)||note.lyrics.some(word=>typeof word!=='string'))) throw new Error('歌词无效');
      if(note.slurEnd!==undefined && (!Number.isInteger(note.slurEnd)||note.slurEnd<=index||note.slurEnd>=vocal.events.length)) throw new Error('简谱连奏弧终点无效');
      for(const grace of note.grace??[]){
        if(!Number.isInteger(grace.degree)||grace.degree<1||grace.degree>7||!Number.isInteger(grace.octave??0)||Math.abs(grace.octave??0)>2) throw new Error('简谱装饰音无效');
      }
    }
    return {...bar,vocal};
  });
  return {...score,bars,vocalSources:vocals.sources,vocalNotes:vocals.notes??[]};
}

export function lyricLines(vocal) {
  return Math.max(0,...(vocal?.events??[]).map(n=>n.lyrics?.length??0));
}

// Both staves use the same time positions. Reserve room for grace groups before
// their main note, then distribute the remaining width by musical duration.
export function createBeatPositioner(events,vocal,beats,left,width) {
  if(!vocal) return beat=>left+(beat-1)/beats*width;
  const points=new Set([0,beats]);const ornament=new Map();const dotted=new Set();
  for(const sequence of [events,vocal.events]){
    let time=0;
    for(const n of sequence){points.add(time);if(n.grace?.length||n.accidental)ornament.set(time,(n.grace?.length??0)+(n.accidental?1:0));if(n.dotted)dotted.add(time);time=beatRound(time+eventBeats(n));}
  }
  const times=[...points].sort((a,b)=>a-b);
  const minimum=times.slice(1).map((t,i)=>14+9*(ornament.get(t)??0)+(dotted.has(times[i])?3:0));
  const total=minimum.reduce((a,b)=>a+b,0);
  const positions=[left];
  times.slice(1).forEach((t,i)=>{
    const space=total>width ? minimum[i]*width/total : minimum[i]+(width-total)*(t-times[i])/beats;
    positions.push(positions.at(-1)+space);
  });
  return beat=>{
    const time=beat-1;const index=times.findIndex(t=>t>=time);
    if(index<0)return left+width;
    if(times[index]===time || index===0)return positions[index];
    return positions[index-1]+(positions[index]-positions[index-1])*(time-times[index-1])/(times[index]-times[index-1]);
  };
}

function octaveDots(x,y,octave,small=false) {
  let svg='';
  for(let i=0;i<Math.abs(octave??0);i++){
    const dotY=octave>0?y-(small?13:21)-i*5:y+18+i*5;
    svg+=`<circle cx="${x}" cy="${dotY}" r="${small?1:1.3}" class="melody-octave"/>`;
  }
  return svg;
}

function arc(x1,x2,y,cls='melody-slur',height=9) {
  return `<path d="M ${x1} ${y} Q ${(x1+x2)/2} ${y-height} ${x2} ${y}" fill="none" class="${cls}"/>`;
}

export function renderNumberedMelody(vocal,{position,left,right,incomingTie=false,incomingSlur=false}) {
  const baseline=235;
  let elapsed=0;
  const notes=vocal.events.map(note=>{
    const placed={...note,time:elapsed,x:position(elapsed+1)};elapsed=beatRound(elapsed+eventBeats(note));return placed;
  });
  let svg='<g class="numbered-melody">';
  const startAt=vocal.parenthesisStartAt??(vocal.parenthesisStart?0:undefined);
  const endAt=vocal.parenthesisEndAt??(vocal.parenthesisEnd?notes.length-1:undefined);
  if(startAt!==undefined)svg+=text(notes[startAt].x-12,baseline,'(','melody-parenthesis');
  notes.forEach((note,index)=>{
    svg+=`<g class="melody-event" data-onset="${note.time}">`;
    svg+=text(note.x,baseline,note.hold?'—':note.degree,'melody-number');
    if(note.accidental)svg+=text(note.x-10,baseline-4,{b:'♭','#':'♯',n:'♮'}[note.accidental],'melody-accidental');
    if(!note.hold)svg+=octaveDots(note.x,baseline,note.octave);
    if(note.dotted)svg+=`<circle cx="${note.x+9}" cy="${baseline-5}" r="1.6" class="melody-duration-dot"/>`;
    const grace=note.grace??[];
    grace.forEach((g,i)=>{
      const x=note.x-10*(grace.length-i)-4;
      svg+=`<g class="melody-grace">${text(x,baseline-5,g.degree,'grace-number')}${octaveDots(x,baseline-5,g.octave,true)}</g>`;
    });
    if(grace.length){
      const start=note.x-10*grace.length-4;
      svg+=line(start-3,baseline-2,note.x-11,baseline-2,'grace-beam');
      svg+=arc(start,note.x,baseline-30,'grace-slur',6);
    }
    if(note.tieToNext && index<notes.length-1)svg+=arc(note.x,notes[index+1].x,baseline-31,'melody-tie');
    if(note.slurEnd!==undefined)svg+=arc(note.x,notes[note.slurEnd].x,baseline-35,'melody-slur',note.slurEnd-index>1?17:9);
    for(const [verse,word] of (note.lyrics??[]).entries()) if(word)svg+=text(note.x,278+verse*24,word,'lyric');
    svg+='</g>';
  });
  for(let i=0;i<notes.length;i++){
    if(notes[i].tuplet!==3)continue;
    const group=notes.slice(i,i+3);
    if(group.length!==3 || group.some(n=>n.tuplet!==3))throw new Error('三连音必须以三个音符成组');
    const center=(group[0].x+group[2].x)/2;
    svg+='<g class="melody-tuplet">'+arc(group[0].x,group[2].x,207,'melody-slur',10)+`<rect x="${center-5}" y="192" width="10" height="12" class="note-background"/>`+text(center,202,3,'tuplet-number')+'</g>';
    i+=2;
  }
  for(let beat=0;beat<elapsed;beat++){
    const group=notes.filter(n=>Math.floor(n.time)===beat);
    for(const [duration,y] of [[8,242],[16,247],[32,252]]){
      let run=[];
      const flush=()=>{if(run.length)svg+=line(run[0].x-5,y,run.at(-1).x+5,y);run=[];};
      for(const n of group){if(n.duration>=duration&&!n.hold)run.push(n);else flush();}
      flush();
    }
  }
  if(incomingTie||incomingSlur)svg+=`<path d="M ${left} ${baseline-37} Q ${(left+notes[0].x)/2} ${baseline-40} ${notes[0].x} ${baseline-31}" fill="none" class="${incomingTie?'melody-tie':'melody-slur'}"/>`;
  const tieStart = vocal.crossBarTieStart!==undefined ? notes[vocal.crossBarTieStart] : notes.at(-1);
  if(vocal.crossBarTieStart!==undefined||tieStart.tieToNext||tieStart.slurToNext)svg+=`<path d="M ${tieStart.x} ${baseline-31} Q ${(tieStart.x+right)/2} ${baseline-40} ${right} ${baseline-37}" fill="none" class="${vocal.crossBarTieStart!==undefined||tieStart.tieToNext?'melody-tie':'melody-slur'}"/>`;
  if(endAt!==undefined)svg+=text(notes[endAt].x+12,baseline,')','melody-parenthesis');
  return svg+'</g>';
}
