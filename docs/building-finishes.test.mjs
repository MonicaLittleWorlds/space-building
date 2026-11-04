import test from 'node:test';import assert from 'node:assert/strict';
import {walls,floors} from './building-finishes.mjs';
import {STUDIO_WALL_VARIANTS,STUDIO_FLOOR_VARIANTS} from './native-export.mjs';
import {wallFaces} from './architecture.mjs';import {capTextureBasis,finishWallSurfaces} from './wall-finishing.mjs';
import {wallCorners,wallCornerFaces,KIT} from './geometry.mjs';
test('approved building finishes are exported under stable game IDs',()=>{assert.equal(walls.length,6);assert.equal(floors.length,6);for(const [rows,variants]of [[walls,STUDIO_WALL_VARIANTS],[floors,STUDIO_FLOOR_VARIANTS]])for(const m of rows)assert.equal(variants[m.gameId],m.id)});
test('all six finishes texture caps and exposed ends in every view and cut state',()=>{for(const m of walls)for(const axis of ['x','z'])for(let r=0;r<4;r++)for(const profile of [null,[[0,26],[1,26]],[[0,KIT.wallHeight],[.4,26],[1,26]],[[0,26],[.6,26],[1,KIT.wallHeight]]]){
 const w={kind:'wall',axis,x:2,z:3,material:m.id},level={id:'g',walls:{wall:w},tiles:{}};
 const faces=wallFaces(w,{level,rotation:r,collapsed:!!profile,profileOverride:profile,paint:{material:m.id,fill:m.color,opacity:1}});
 const caps=faces.filter(f=>f.attrs?.['data-part']==='cap');assert.ok(caps.length);
 for(const f of faces.filter(f=>['cap','end'].includes(f.attrs?.['data-part']))){assert.equal(f.attrs['data-texture'],m.id);assert.equal(f.attrs['data-texture-basis'].length,3);assert.ok(f.attrs['data-texture-basis'].flat().every(Number.isFinite));}
}});
test('sloping cap texture follows its actual plane without stretching vertical UVs',()=>{const w={axis:'z',x:0,z:0},v=[[-.5,-.44,270],[.5,-.44,26],[.5,-.56,26],[-.5,-.56,270]],b=capTextureBasis(w,v,{period:2});assert.equal(b[1][2]-b[0][2],-488);assert.equal(b[2][2],b[0][2]);assert.equal(b[1][0]-b[0][0],2)});
test('corner caps retain the material of each wall side',()=>{const a={kind:'wall',axis:'x',x:0,z:0},b={kind:'wall',axis:'z',x:0,z:0},c=wallCorners({a,b})[0];assert.ok(c);for(let r=0;r<4;r++){const f=wallCornerFaces(c,r).map(f=>({...f,attrs:{'data-material':walls[f.wall.axis==='x'?0:1].id}}));for(const face of finishWallSurfaces(f,null,r).filter(f=>f.part==='cap'))assert.equal(face.attrs['data-texture'],walls[face.wall.axis==='x'?0:1].id)}});

test('four approved masonry and concrete finishes are available for exterior lots',async()=>{const {EXTERIOR_MATERIALS}=await import('./exterior-finishes.mjs');for(const m of walls.slice(1,5))assert.ok(EXTERIOR_MATERIALS.includes(m.id));});
