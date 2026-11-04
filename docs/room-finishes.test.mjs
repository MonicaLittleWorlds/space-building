import test from 'node:test';
import assert from 'node:assert/strict';
import {wallFaceMaterial,applyRoomFinish} from './room-finishes.mjs';
import {ensureGroundLot} from './ground-lot.mjs';
import {blankProject,parseProject} from './model.mjs';
import {wallPattern,wallPatternSVG} from './material-surfaces.mjs';
import kit from './kit.mjs';

test('room wallpaper owns its side of every partition, door and window at all four rotations',()=>{
 const level={tiles:{'0,0':{},'1,0':{},'0,1':{}},rooms:[
  {id:'a',kind:'indoor',x:0,z:0,width:1,depth:1,wallMaterial:'lw-cosmic'},
  {id:'b',kind:'indoor',x:1,z:0,width:1,depth:1,wallMaterial:'lw-redlounge'},
  {id:'c',kind:'indoor',x:0,z:1,width:1,depth:1,wallMaterial:'lw-glass'}]};
 for(const kind of ['wall','door','window'])for(const r of [0,1,2,3]){
  assert.equal(wallFaceMaterial(level,{axis:'x',x:1,z:0,kind,material:'blank'},r),r<2?'lw-redlounge':'lw-cosmic');
  assert.equal(wallFaceMaterial(level,{axis:'z',x:0,z:1,kind,material:'blank'},r),[0,3].includes(r)?'lw-glass':'lw-cosmic');
 }
 applyRoomFinish(level,'a','wall','lw-sunflower');
 assert.equal(level.rooms[1].wallMaterial,'lw-redlounge');
 applyRoomFinish(level,'a','floor','lw-arcade');
 assert.equal(level.tiles['0,0'].material,'lw-arcade');assert.equal(level.tiles['1,0'].material,undefined);
});
test('grass lot fills holes, grows with construction, preserves paths and leaves upper floors alone',()=>{
 const p=blankProject();p.groundLot={x:0,z:0,width:3,depth:3};p.levels[0].tiles['1,1']={walk:true,place:true,material:'lw-cinema'};
 p.levels.push({id:'upper',tiles:{}});ensureGroundLot(p);
 assert.equal(Object.keys(p.levels[0].tiles).length,9);assert.equal(p.levels[0].tiles['1,1'].material,'lw-cinema');
 delete p.levels[0].tiles['0,0'];ensureGroundLot(p);assert.equal(p.levels[0].tiles['0,0'].material,'legacy-grass');
 p.levels[0].tiles['-1,0']={walk:true,place:true};ensureGroundLot(p);assert.equal(Object.keys(p.levels[0].tiles).length,12);
 assert.deepEqual(p.levels[1].tiles,{});
 const old={levels:[{tiles:{'0,0':{}}}]};ensureGroundLot(old);assert.equal(Object.keys(old.levels[0].tiles).length,1);
});
test('obsolete procedural wall choices migrate to their replacements and disappear from the picker',()=>{
 const p=blankProject();p.levels[0].walls['x:0,0']={axis:'x',x:0,z:0,kind:'wall',material:'panel',exteriorMaterial:'brick',collapse:true,mount:true};
 const migrated=parseProject(p);assert.equal(migrated.levels[0].walls['x:0,0'].material,'legacy-liberty');
 assert.equal(migrated.levels[0].walls['x:0,0'].exteriorMaterial,'cc0-red-brick-03');
 assert.ok(!kit.wallMaterials.some(m=>['wood','panel','brick','stone'].includes(m.id)));
});
test('wall pattern uses full wall height and the same mirrored repeat definition for editor and export',()=>{
 const m=kit.wallMaterials.find(m=>m.id==='lw-redlounge');
 const transform=wallPattern([[0,0,0],[1,0,0],[1,0,274]],p=>[p[0]*64,p[2]],null,m);
 assert.ok(Math.abs(transform[3]+274.342851)<.01);
 const svg=wallPatternSVG('test',transform,'assets/materials/lw-redlounge.png',null,null,1,m);
 assert.match(svg,/width="2" height="1"/);assert.match(svg,/scale\(-1 1\)/);
});
test('nearer room partitions lower when they obscure the active room, and restore outdoors',async()=>{
 const {roomCutawayEdges}=await import('./room-cutaway.mjs');
 const walls={'z:2,4':{axis:'z',x:2,z:4,collapse:true},'z:3,4':{axis:'z',x:3,z:4,collapse:true},'z:2,0':{axis:'z',x:2,z:0,collapse:true}};
 const cells=(x,z,w,d)=>Array.from({length:w*d},(_,i)=>`${x+i%w},${z+Math.floor(i/w)}`);
 const rear={id:'rear',kind:'indoor',cells:cells(0,0,4,3),boundaries:[{edge:'z:2,0',outward:-1}]};
 const front={id:'front',kind:'indoor',cells:cells(0,3,4,3),boundaries:[{edge:'z:2,4',outward:1},{edge:'z:3,4',outward:1}]};
 const selected=roomCutawayEdges([rear,front],walls,rear,0);
 assert.ok(selected.has('z:2,4')&&selected.has('z:3,4'));
 assert.ok(!selected.has('z:2,0'));
 assert.equal(roomCutawayEdges([rear,front],walls,{kind:'outdoor'},0).size,0);
 assert.ok(!roomCutawayEdges([rear,front],walls,rear,2).has('z:2,4'));
});

test('building exterior owns only outward faces and does not repaint room wallpapers',async()=>{
 const {ensureExteriorFinishes}=await import('./exterior-finishes.mjs');
 const p=blankProject(),l=p.levels[0];p.exteriorFinish='cc0-red-brick-03';
 l.tiles={'0,0':{},'1,0':{}};l.rooms=[{id:'a',name:'A',kind:'indoor',x:0,z:0,width:1,depth:1,wallMaterial:'lw-cosmic'},{id:'b',name:'B',kind:'indoor',x:1,z:0,width:1,depth:1,wallMaterial:'lw-sunflower'}];
 l.walls={'x:0,0':{axis:'x',x:0,z:0,kind:'wall',facing:-1,material:'lw-cosmic'},'x:1,0':{axis:'x',x:1,z:0,kind:'door',material:'blank'}};
 ensureExteriorFinishes(p);
 assert.equal(wallFaceMaterial(l,l.walls['x:0,0'],0),'lw-cosmic');
 assert.equal(wallFaceMaterial(l,l.walls['x:0,0'],2),'cc0-red-brick-03');
 assert.equal(l.walls['x:1,0'].exteriorDecorGroup,undefined);
 assert.equal(wallFaceMaterial(l,l.walls['x:1,0'],0),'lw-sunflower');
 p.exteriorFinish='cc0-sandstone-blocks-05';ensureExteriorFinishes(p,{repaint:true});
 assert.equal(wallFaceMaterial(l,l.walls['x:0,0'],2),'cc0-sandstone-blocks-05');
 assert.equal(l.rooms[0].wallMaterial,'lw-cosmic');
});

test('glass blocks have recessed geometry and glass caps, with no timber trim',async()=>{
 const {wallFaces}=await import('./architecture.mjs');
 const w={axis:'x',x:0,z:0,kind:'wall',material:'lw-glass'},l={id:'g',tiles:{'0,0':{}},walls:{'x:0,0':w}};
 for(let r=0;r<4;r++){
  const faces=wallFaces(w,{level:l,rotation:r,paint:{material:'lw-glass',fill:'#9caea7',opacity:1,back:false}});
  const relief=faces.filter(f=>f.attrs?.['data-part']==='glass-block-relief');
  assert.ok(relief.length>=60);
  const depth=relief.flatMap(f=>f.vertices.map(v=>v[0]));
  assert.ok(Math.max(...depth)-Math.min(...depth)>.09);
  assert.ok(faces.some(f=>f.attrs?.['data-part']==='glass-cap'));
  assert.ok(faces.every(f=>f.vertices.every(p=>p.every(Number.isFinite))));
 }
});

test('sloped glass transitions retain the complete low section beneath the cap',async()=>{
 const {glassBlockRelief}=await import('./glass-block-surfaces.mjs');
 const contains=(poly,x,y)=>{let inside=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++)if((poly[i][1]>y)!==(poly[j][1]>y)&&x<(poly[j][0]-poly[i][0])*(y-poly[i][1])/(poly[j][1]-poly[i][1])+poly[i][0])inside=!inside;return inside;};
 for(const flip of [1,-1])for(let r=0;r<4;r++){
  const outline=[[-.5,0],[.5,0],[.5,26],[-.1,26],[-.5,274]].map(([u,h])=>[0,u*flip,h]);
  const faces=glassBlockRelief([{vertices:outline,attrs:{'data-texture':'lw-glass','data-part':'front'}}],'lw-glass',r);
  assert.ok(faces.some(f=>f.attrs['data-part']==='glass-front-reflection'&&contains(f.vertices.map(p=>[p[1],p[2]]),.25*flip,12)),`Missing glass beneath transition at rotation ${r}`);
 }
});
