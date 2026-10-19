import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {diagram} from './build-fretboard-scales.mjs';
import {chordDiagram,display,escape} from './chord-diagram.mjs';
const root=new URL('../',import.meta.url);

export function practiceBars(song,key){
  return song.bars.map(bar=>({...bar,events:bar.events.map(event=>{
    if(event.hold)return {...event};
    if(!Number.isInteger(event.degree)||event.degree<1||event.degree>6)throw new Error('练习音级应为1—6');
    const chord=key.chords[event.degree-1];
    if(!chord)throw new Error('缺少对应级数和弦');
    return {...event,chord};
  })}));
}

export function renderMelody(bars){
  return bars.map(bar=>`<div class="melody-bar" data-bar="${bar.number}">${bar.events.map(event=>event.hold
    ? '<span class="melody-event held"><span class="event-chord" aria-hidden="true"></span><span class="event-degree" aria-label="延长一拍">—</span><span class="event-lyric"></span></span>'
    : `<button type="button" class="melody-event" data-focus-degree="${event.degree}" data-chord="${escape(event.chord)}" aria-pressed="false"><span class="event-chord">${display(event.chord)}</span><span class="event-degree">${event.degree}</span><span class="event-lyric">${escape(event.lyric)}</span></button>`).join('')}</div>`).join('\n');
}

async function build(){
  const read=async path=>JSON.parse(await readFile(new URL(path,root),'utf8'));
  const [song,scales,chords,sevenths]=await Promise.all([read('knowledge/twinkle-practice.json'),read('knowledge/fretboard-scales.json'),read('knowledge/chord-charts.json'),read('knowledge/twinkle-seventh-chords.json')]);
  const panels=scales.keys.map(key=>{
    const chordKey=chords.keys.find(k=>k.name===key.name);
    const spelling=key.notes.slice(0,6).map((note,i)=>`<button type="button" data-focus-degree="${i+1}" aria-pressed="false"><b>${i+1}</b> ${note}</button>`).join('');
    const practiceChords=[...chordKey.chords.slice(0,6).map((name,i)=>({name,shape:chords.shapes[name],label:chords.degrees[i].label})),{...sevenths[key.name],label:'vii°'}];
    const cards=practiceChords.map(({name,shape,label},i)=>`<article class="chord-card" data-chord-degree="${i+1}"><button type="button" class="chord-heading" data-focus-degree="${i+1}" aria-pressed="false"><span>${i+1}级 · ${label}</span><strong>${display(name)}</strong></button>${chordDiagram(name,shape,`twinkle-chord-${key.name}-${i}`)}<p class="shape-note">${escape(shape.note||'\u00a0')}</p></article>`).join('');
    const scalesHTML=`<div class="scale-view"><div class="scale-spelling">${spelling}</div><div class="fretboard full-board">${diagram(scales,key,0,15,`twinkle-${key.name}-full`,{compact:true})}</div><div class="split-boards">${[[0,5],[6,10],[11,15]].map(([first,last])=>`<figure class="fretboard"><figcaption>${first===0?'空弦':first+' 品'} — ${last} 品</figcaption>${diagram(scales,key,first,last,`twinkle-${key.name}-${first}`,{compact:true})}</figure>`).join('')}</div></div><div class="chord-view" hidden><div class="chord-grid">${cards}</div></div>`;
    return {name:key.name,notes:key.notes,reference:scalesHTML,melody:renderMelody(practiceBars(song,chordKey))};
  });
  const template=await readFile(new URL('src/twinkle-practice.html',root),'utf8');
  const script=await readFile(new URL('src/twinkle-practice.js',root),'utf8');
  const css=await readFile(new URL('src/twinkle-practice.css',root),'utf8');
  const options=panels.map(key=>`<option value="${key.name}">${key.name} 大调</option>`).join('');
  const data=JSON.stringify(panels).replaceAll('<','\\u003c');
  await mkdir(new URL('tools/',root),{recursive:true});
  await writeFile(new URL('tools/小星星练习.html',root),template.replace('/* STYLES */',css).replace('<!-- KEYS -->',options).replace('<!-- REFERENCE -->',panels[0].reference).replace('<!-- MELODY -->',panels[0].melody).replace('/* DATA */',`const practiceData=${data};`).replace('/* SCRIPT */',script));
  console.log('已生成小星星练习：7个大调，音阶/逐音级和弦，12小节48拍。');
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))await build();
