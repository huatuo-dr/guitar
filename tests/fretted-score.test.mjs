import assert from 'node:assert/strict';
import test from 'node:test';
import {validateScore,renderScore} from '../scripts/accompaniment-svg.mjs';
const fixture=()=>({chordShapes:{C:{frets:[-1,3,2,0,1,0]}},sections:[],route:[{start:1,end:1}],patterns:{notes:[
 {kind:'fretted',duration:8,notes:[{string:1,fret:1,hammerToNext:true},{string:5,fret:3}]},
 {kind:'fretted',duration:8,notes:[{string:1,fret:3,pullToNext:true}]},
 {kind:'fretted',duration:8,notes:[{string:1,fret:0}]},
 {kind:'fretted',duration:8,notes:[{string:2,fret:3,slideToNext:true}]},
 {kind:'fretted',duration:4,notes:[{string:2,fret:5}]},
 {kind:'fretted',duration:4,arpeggio:'up',notes:[{string:1,fret:0},{string:2,fret:1},{string:3,fret:0},{string:5,fret:3}]}]},bars:[{number:1,chords:[[1,'C']],pattern:'notes'}]});
test('指弹同时发声的品位、H/P/S与琶音完整绘制',()=>{
 const data=fixture();assert.equal(validateScore(data),true);
 const svg=renderScore(data);
 assert.equal((svg.match(/class="fret"/g)||[]).length,10);
 assert.match(svg,/class="hammer"[^>]*>H<\/text>/);assert.match(svg,/class="hammer"[^>]*>P<\/text>/);assert.match(svg,/class="slide-label"[^>]*>S<\/text>/);
 assert.match(svg,/class="fretted-arpeggio"/);assert.doesNotMatch(svg,/undefined|NaN/);
});
test('指弹输入拒绝重复弦位以及缺少同弦技法终点',()=>{
 const repeated=fixture();repeated.patterns.notes[0].notes.push({string:1,fret:2});assert.throws(()=>validateScore(repeated),/指弹弦品/);
 const noTarget=fixture();noTarget.patterns.notes[1].notes[0].string=2;assert.throws(()=>validateScore(noTarget),/技法终点/);
});
test('无和弦单旋律谱保留末尾全音符的圆圈与四拍时值',()=>{
 const data={chordShapes:{},sections:[],route:[{start:1,end:1}],patterns:{ending:[{kind:'fretted',duration:1,notes:[{string:2,fret:1}]}]},bars:[{number:1,chords:[],pattern:'ending'}]};
 assert.equal(validateScore(data),true);const svg=renderScore(data);
 assert.match(svg,/class="whole-note"/);assert.doesNotMatch(svg,/class="chord-diagram"|NaN|undefined/);
 assert.doesNotMatch(svg,/<line[^>]*y1="172"[^>]*y2="189"/,'全音符没有节拍符干');
 data.patterns.ending=[{kind:'pluck',duration:4,strings:[2]},{kind:'hold',duration:4},{kind:'hold',duration:4},{kind:'hold',duration:4}];
 assert.throws(()=>validateScore(data),/起始和弦/,'叉号拨弦仍需要和弦指法');
});
