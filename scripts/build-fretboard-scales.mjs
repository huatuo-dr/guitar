import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';

const root=new URL('../',import.meta.url);
export function scalePositions(data,key,first=data.firstFret,last=data.lastFret){
  return data.strings.flatMap(string=>Array.from({length:last-first+1},(_,i)=>{
    const fret=first+i;
    const degree=data.majorIntervals.indexOf((string.midi+fret-key.root+120)%12)+1;
    const octave=Math.floor((string.midi+fret-key.tonicMidi)/12);
    return degree?{string:string.number,fret,degree,note:key.notes[degree-1],octave}:null;
  }).filter(Boolean));
}

function diagram(data,key,first,last,id){
  const width=76+(last-first+0.5)*50;
  const x=fret=>76+(fret-first)*50;
  const y=string=>64+(string-1)*48;
  const description=`${key.name}大调，${first===0?'空弦':first+'品'}至${last}品；从上到下为1至6弦，绿色实心圆为主音1`;
  let svg=`<svg viewBox="0 0 ${width} 365" role="img" aria-labelledby="${id}"><title id="${id}">${description}</title>`;
  for(let fret=first;fret<=last;fret++){
    if(fret>0)svg+=`<path class="fret${fret===1?' nut':''}" d="M${x(fret)-25} 64V304"/>`;
    svg+=`<text class="fret-label" x="${x(fret)}" y="27">${fret===0?'空弦':fret}</text>`;
    if([3,5,7,9,15].includes(fret))svg+=`<circle class="position-dot" cx="${x(fret)}" cy="345" r="3"/>`;
    if(fret===12)svg+=`<circle class="position-dot" cx="${x(fret)-5}" cy="345" r="3"/><circle class="position-dot" cx="${x(fret)+5}" cy="345" r="3"/>`;
  }
  svg+=`<path class="fret" d="M${width} 64V304"/>`;
  for(const string of data.strings){
    svg+=`<text class="string-label" x="3" y="${y(string.number)+5}">${string.number}弦 ${string.note}</text><path class="string" style="stroke-width:${0.7+string.number*0.16}" d="M51 ${y(string.number)}H${width}"/>`;
  }
  for(const pos of scalePositions(data,key,first,last)){
    const register=pos.octave===0?'中音':`${pos.octave>0?'高':'低'}${Math.abs(pos.octave)}个八度`;
    const dots=Array.from({length:Math.abs(pos.octave)},(_,i)=>`<circle class="octave-dot" cx="${x(pos.fret)}" cy="${y(pos.string)+(pos.octave>0?-1:1)*(18+i*6)}" r="2.2"/>`).join('');
    svg+=`<g class="scale-note${pos.degree===1?' tonic':''}" data-string="${pos.string}" data-fret="${pos.fret}" data-degree="${pos.degree}" data-octave="${pos.octave}"><title>${pos.string}弦${pos.fret===0?'空弦':pos.fret+'品'}：${pos.note}，${pos.degree}级，${register}</title><circle cx="${x(pos.fret)}" cy="${y(pos.string)}" r="12"/><text x="${x(pos.fret)}" y="${y(pos.string)+6}">${pos.degree}</text>${dots}</g>`;
  }
  return svg+'</svg>';
}

async function build(){
  const data=JSON.parse(await readFile(new URL('knowledge/fretboard-scales.json',root),'utf8'));
  const filters=['all',...data.keys.map(key=>key.name)].map(name=>`<button type="button" data-key="${name}" aria-pressed="${name==='all'}">${name==='all'?'全部':name+' 调'}</button>`).join('\n');
  const charts=data.keys.map(key=>`<section class="key-section" data-key-section="${key.name}" aria-labelledby="key-${key.name}">
<h2 id="key-${key.name}">${key.name} <span>大调</span></h2>
<p class="scale-spelling">${key.notes.map((note,i)=>`<span><b>${i+1}</b> ${note}</span>`).join('')}</p>
<div class="fretboard full-board">${diagram(data,key,0,15,`${key.name}-full`)}</div>
<div class="split-boards">${[[0,5],[6,10],[11,15]].map(([first,last])=>`<figure class="fretboard"><figcaption>${first===0?'空弦':first+' 品'} — ${last} 品</figcaption>${diagram(data,key,first,last,`${key.name}-${first}`)}</figure>`).join('\n')}</div>
</section>`).join('\n');
  const template=await readFile(new URL('src/fretboard-scales.html',root),'utf8');
  await mkdir(new URL('tools/',root),{recursive:true});
  await writeFile(new URL('tools/各调指板音阶.html',root),template.replace('<!-- KEY_FILTERS -->',filters).replace('<!-- SCALE_CHARTS -->',charts));
  console.log('已生成各调指板音阶：7 个大调，空弦至第 15 品。');
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))await build();
