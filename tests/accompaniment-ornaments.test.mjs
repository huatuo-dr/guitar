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
test('跨小节琶音延音从实际起音跨过延长线，续音保留波浪箭头',()=>{
 const data=fixture([{kind:'arpeggio',duration:4},{kind:'hold',duration:4},{kind:'arpeggio',duration:4},{kind:'hold',duration:4}]);
 data.bars[0].crossBarTieStart=2;
 data.patterns.two=[{kind:'hold',sourceArrow:'arpeggio',duration:4,startString:4,endString:1},...Array.from({length:3},()=>({kind:'hold',duration:4}))];
 assert.equal(validateScore(data),true);
 for(const rows of [2,4]){
  const svg=renderScore(data,rows);
  assert.equal((svg.match(/class="tab-tie"/g)||[]).length,2);
  assert.equal((svg.match(/ q -4 -2 0 -4/g)||[]).length,11,'两次起音与一次延续的波浪箭头');
 }
 data.bars[0].crossBarTieStart=3;assert.throws(()=>validateScore(data),/延音起点/);
});
test('伴奏三连音等分一拍，显示括号3并拒绝不完整分组',()=>{
 const triplet=[3,1,0].map(fret=>({kind:'note',string:1,fret,duration:8,tuplet:3}));
 const data=fixture([...Array.from({length:3},()=>({kind:'pluck',strings:[3],duration:4})),...triplet]);
 assert.equal(validateScore(data),true);
 for(const rows of [2,4]){
  const svg=renderScore(data,rows);
  assert.equal((svg.match(/class="tab-tuplet"/g)||[]).length,1);
  assert.match(svg,/class="tuplet-number"[^>]*>3<\/text>/);
  assert.doesNotMatch(svg,/NaN|undefined/);
 }
 const invalid=fixture([{kind:'note',string:1,fret:0,duration:4,tuplet:2},...Array.from({length:3},()=>({kind:'hold',duration:4}))]);
 assert.throws(()=>validateScore(invalid),/连音/);
 const incomplete=fixture([{kind:'note',string:1,fret:0,duration:4,tuplet:3},{kind:'hold',duration:4},{kind:'note',string:1,fret:0,duration:4,tuplet:3},{kind:'hold',duration:4},{kind:'note',string:1,fret:0,duration:4,tuplet:3}]);
 assert.throws(()=>validateScore(incomplete),/连音/);
});
