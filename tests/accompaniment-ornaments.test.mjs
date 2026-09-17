import assert from 'node:assert/strict';
import test from 'node:test';
import {eventBeats,renderNumberedMelody} from '../scripts/numbered-notation.mjs';
import {renderScore,validateScore} from '../scripts/accompaniment-svg.mjs';
const fixture=events=>({title:'测试',chordShapes:{C:{frets:[-1,3,2,0,1,0]}},patterns:{one:events,two:[{kind:'pluck',strings:[3],duration:4},{kind:'hold',duration:4},{kind:'hold',duration:4},{kind:'hold',duration:4}]},bars:[{number:1,chords:[[1,'C']],pattern:'one'},{number:2,chords:[[1,'C']],pattern:'two'}],sections:[],route:[{start:1,end:2}]});
test('双附点延长至原时值1.75倍并显示两点',()=>{
 assert.equal(eventBeats({duration:4,doubleDotted:true}),1.75);
 const svg=renderNumberedMelody({events:[{degree:5,duration:4,doubleDotted:true},{degree:5,duration:16},{degree:6,duration:2}]},{position:b=>b*40,left:0,right:270});
 assert.equal((svg.match(/class="melody-duration-dot"/g)||[]).length,2);
});
test('八分休止与12到0滑音保持真实节拍和技法',()=>{
 const data=fixture([{kind:'rest',duration:8},{kind:'note',string:6,fret:12,duration:8,slideToNext:true},{kind:'note',string:6,fret:0,duration:8},{kind:'pluck',strings:[3],duration:4,dotted:true},{kind:'hold',duration:4}]);
 assert.equal(validateScore(data),true);
 const svg=renderScore(data);
 assert.match(svg,/class="tab-rest"/);assert.match(svg,/class="slide-label"[^>]*>S<\/text>/);assert.match(svg,/class="tab-duration-dot"/);
 assert.doesNotMatch(svg,/NaN|undefined/);
});
test('伴奏跨小节延音在2/4小节版保留两端',()=>{
 const data=fixture([{kind:'pluck',strings:[3],duration:4},{kind:'hold',duration:4},{kind:'hold',duration:4},{kind:'pluck',strings:[3],duration:4,tieToNext:true}]);
 for(const rows of [2,4])assert.equal((renderScore(data,rows).match(/class="tab-tie"/g)||[]).length,2);
});
