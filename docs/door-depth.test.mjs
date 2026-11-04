import test from 'node:test';
import assert from 'node:assert/strict';
import {createNativePackage} from './native-export.mjs';
test('arched doorways export a full visual volume without blocking passage',async()=>{
 const p={format:'lw-space-studio',version:1,name:'Door depth',levels:[{id:'ground',name:'Ground',tiles:{'0,0':{walk:true,place:true,material:'blank'},'1,0':{walk:true,place:true,material:'blank'}},walls:{'x:1,0':{axis:'x',x:1,z:0,kind:'door',doorStyle:'arch',material:'white',collapse:true,mount:false}},rooms:[],items:[]}],stairs:[],spawn:{level:'ground',x:0,z:0},decorGroups:[]};
 const b=await createNativePackage(JSON.stringify(p),{wallVariants:{},floorVariants:{},loadFloorImage:async()=>'',rasterize:async()=>'',assetFilter:()=>false});
 const m=b.native.manifest.find(m=>m.kind==='opening');assert.ok(m.box);assert.equal(m.box[1][1],3.5);
 const xml=b.native.files[m.id+'.xml'].content;assert.match(xml,/gridActive="false"/);assert.doesNotMatch(xml,/key="gridEdge"/);assert.match(xml,/<volume><box/);
 assert.equal(b.project.levels[0].tiles['0,0'].walk,true);assert.equal(b.project.levels[0].tiles['1,0'].walk,true);
});
