import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';
import * as alphaTab from '@coderline/alphatab';
import {validateScore,renderScore} from '../scripts/accompaniment-svg.mjs';
import {buildAccompanimentPlayback} from '../scripts/accompaniment-playback.mjs';
const base=JSON.parse(await readFile(new URL('../score/jiayibingding-chorus.json',import.meta.url),'utf8'));
test('四分休止绘制独立符号，播放整拍静音，不延续前音',()=>{
 const data={...base,bars:[{number:1,pattern:'rest',chords:[[1,'C']]}],patterns:{rest:[{kind:'pluck',duration:4,strings:[1]},'h4','h4',{kind:'rest',duration:4}]},route:[{start:1,end:1}],sections:[{name:'休止验证',start:1,end:1}]};
 assert.equal(validateScore(data),true);
 const svg=renderScore(data);assert.match(svg,/class="tab-rest tab-rest-quarter"/);
 const payload=buildAccompanimentPlayback(data);
 const importer=new alphaTab.importer.AlphaTexImporter();importer.initFromString(payload.tex,new alphaTab.Settings());
 const score=importer.readScore(),beats=score.tracks[0].staves[0].bars[0].voices[0].beats;
 assert.equal(beats.at(-1).isRest,true);assert.equal(beats.at(-1).duration,4);
 assert.equal(score.masterBars[0].calculateDuration(),3840);
});
