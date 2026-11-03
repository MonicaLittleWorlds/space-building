import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import kit from './kit.mjs';
import {walls,floors} from './approved-finishes.mjs';
import {STUDIO_WALL_VARIANTS,STUDIO_FLOOR_VARIANTS} from './native-export.mjs';

test('every approved editor finish is available in the default game export',()=>{
  for(const [materials,catalog,variants] of [[walls,kit.wallMaterials,STUDIO_WALL_VARIANTS],[floors,kit.floorMaterials,STUDIO_FLOOR_VARIANTS]]){
    for(const material of materials){
      assert.equal(variants[material.gameId],material.id,material.name+' missing from native export');
      const entry=catalog.find(candidate=>candidate.id===material.id);
      assert.ok(entry,material.name+' missing from editor picker');
      assert.ok(existsSync(new URL(entry.texture,import.meta.url)),material.name+' texture missing');
    }
  }
});

test('old Liberty Plaster saves resolve to the original Softline replacement',()=>{
  const replacement=kit.wallMaterials.find(m=>m.id===STUDIO_WALL_VARIANTS.studio_panel);
  assert.equal(replacement.name,'Softline Plaster');
  assert.equal(replacement.texture,'assets/materials/lw-softline-plaster.png');
  assert.equal(replacement.paintable,true);
  assert.equal(existsSync(new URL('assets/materials/legacy-liberty.svg',import.meta.url)),false);
});
