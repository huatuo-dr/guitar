// Build a compact chord/lyric view from the same beat-aligned score data.
import {eventBeats,lyricLines} from './numbered-notation.mjs';
import {renderScore} from './accompaniment-svg.mjs';
const escape=value=>String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const tick=beat=>Math.round(beat*960);

export function simpleBarTokens(bar) {
  const points=new Map();
  const point=beat=>{
    const key=tick(beat);
    if(!points.has(key))points.set(key,{beat:key/960,chord:'',lyrics:[]});
    return points.get(key);
  };
  for(const [beat,chord] of bar.chords)point(beat).chord=chord;
  let beat=1;
  for(const event of bar.vocal?.events??[]){
    if(event.lyrics?.some(Boolean))point(beat).lyrics=[...event.lyrics];
    beat+=eventBeats(event);
  }
  return [...points.values()].sort((a,b)=>a.beat-b.beat);
}

// A single written voice may contain two verses. Select the performed verse;
// single-row bars are common to both passes, while blank slots stay blank.
export function projectSimpleBar(data,bar,{verse=0}) {
  const dual=lyricLines(bar.vocal)>1;
  const events=bar.vocal.events.map(event=>{
    const lyric=event.lyrics?.[dual?verse:0]??'';
    return {...event,...(event.lyrics?{lyrics:lyric?[lyric]:[]}: {})};
  });
  return {...bar,vocal:{...bar.vocal,events}};
}

function renderCell({bar,token,index,id}) {
  const verseCount=Math.max(1,lyricLines(bar.vocal));
  const lyrics=Array.from({length:verseCount},(_,i)=>token.lyrics[i]||'');
  const anchor=index===0?` id="${id}" tabindex="-1" aria-label="第${bar.number}小节"`:'';
  return `<span class="simple-cell${index===0?' simple-measure measure':''}"${anchor} data-bar="${bar.number}" data-beat="${token.beat}"><span class="simple-chord">${escape(token.chord)}</span>${lyrics.map(lyric=>`<span class="simple-lyric${lyric?(token.chord?' simple-chord-lyric':''):' simple-placeholder'}">${lyric?escape(lyric):(token.chord?'_':'')}</span>`).join('')}</span>`;
}

// Phrase boundaries refer to musical onsets, so lyrics/chords stay attached and
// repeated passages inherit exactly the same editorial phrasing.
export function simpleLyricLines(data,sections) {
  const breaks=new Map();
  for(const cue of data.simpleScore.lyricBreaks??[]){
    const bar=data.bars.find(bar=>bar.number===cue.bar);
    const key=`${cue.bar}:${tick(cue.beat)}:${cue.verse??'*'}`;
    if(!bar||!['line','space'].includes(cue.kind)||(cue.verse!==undefined&&![0,1].includes(cue.verse))||breaks.has(key)||!simpleBarTokens(bar).some(token=>tick(token.beat)===tick(cue.beat)))throw new Error(`歌词断句位置无效：${cue.bar}小节 ${cue.beat}拍`);
    breaks.set(key,cue.kind);
  }
  const lines=[];
  let line=[],phrase=[];
  const finishPhrase=()=>{if(phrase.length)line.push(phrase);phrase=[];};
  const finishLine=()=>{finishPhrase();if(line.length)lines.push(line);line=[];};
  for(const section of sections){
    for(const sourceBar of data.bars.filter(bar=>bar.number>=section.start&&bar.number<=section.end)){
      const bar=projectSimpleBar(data,sourceBar,section);
      for(const [index,token] of simpleBarTokens(bar).entries()){
        const cueKey=`${bar.number}:${tick(token.beat)}`;
        const boundary=breaks.get(`${cueKey}:${section.verse}`)??breaks.get(`${cueKey}:*`);
        if(boundary==='line')finishLine();
        else if(boundary==='space')finishPhrase();
        phrase.push({bar,token,index,id:section.barIds[bar.number]});
      }
    }
  }
  finishLine();
  return lines;
}

// Split the performance route at written sections and instrumental boundaries.
// IDs count actual occurrences of each bar, including partial-section returns.
export function simpleSections(data) {
  const visits=new Map(),result=[];
  const fullSections=new Set(data.simpleScore.fullSections??[]);
  const ranges=data.simpleScore.fullRanges??[];
  const routeVerses=data.simpleScore.routeVerses;
  if(routeVerses&&(routeVerses.length!==data.route.length||routeVerses.some(v=>![0,1].includes(v))))throw new Error('简易谱演唱段歌词行配置无效');
  data.route.forEach((route,routeIndex)=>{
    let group;
    for(let number=route.start;number<=route.end;number++){
      const source=data.sections.find(s=>number>=s.start&&number<=s.end);
      if(!source)throw new Error(`简易谱第${number}小节缺少段落`);
      const range=ranges.find(r=>number>=r.start&&number<=r.end);
      const full=fullSections.has(source.start)||!!range;
      const name=range?.name??source.name;
      const visit=(visits.get(number)??0)+1;
      visits.set(number,visit);
      const suffix=visit>1?`-repeat-${visit}`:'';
      const id=`bar-${number}${suffix}`;
      if(!group||group.sourceStart!==source.start||group.full!==full||group.name!==name){
        const label=name+(visit>2?`（第${visit}遍）`:visit===2?(full?'（再奏）':'（再唱）'):number!==source.start&&!range?.name?'（续）':'');
        group={name,start:number,end:number,sourceStart:source.start,full,routeIndex,verse:routeVerses?.[routeIndex]??0,suffix,target:id,label,barIds:{}};
        result.push(group);
      }
      group.end=number;
      group.barIds[number]=id;
    }
  });
  return result;
}

export function renderSimpleNavigation(data) {
  return '<span class="label">段定位</span>'+simpleSections(data).map(section=>`<a class="jump-link" href="#${section.target}" data-jump="${section.target.slice(4)}">${escape(section.label)}</a>`).join('');
}

export function renderSimpleScore(data,barsPerRow=4) {
  let html='<p class="simple-help">已按演奏顺序展开，直接向下阅读即可。歌词按段落排版，句间留空，随屏幕宽度换行；和弦对应的歌词下方加下划线，单独的“_”表示此处换和弦但没有新歌词。演唱段的详细节奏可切回完整谱查看。每行小节与缩放选项作用于完整保留的器乐段。</p>';
  let pending=[];
  const flushLyrics=()=>{
    if(!pending.length)return;
    const lines=simpleLyricLines(data,pending).map(line=>`<div class="simple-line">${line.map(phrase=>`<span class="simple-phrase">${phrase.map(renderCell).join('')}</span>`).join('')}</div>`).join('');
    html+=`<section class="simple-section" aria-label="演唱">${lines}</section>`;
    pending=[];
  };
  for(const section of simpleSections(data)){
    if(section.full){
      flushLyrics();
      const title=`<h2 class="simple-section-heading">${escape(section.name)}</h2>`;
      const projected={...data,bars:data.bars.map(bar=>projectSimpleBar(data,bar,section))};
      const score=renderScore(projected,barsPerRow,section).replace(/id="bar-(\d+)"/g,(_,number)=>`id="${section.barIds[number]}"`);
      html+=`<section class="simple-section" aria-label="${escape(section.label)}">${title}<div class="simple-instrument-scroll"><div class="simple-instrument-score">${score}</div></div></section>`;
    } else pending.push(section);
  }
  flushLyrics();
  return html;
}
