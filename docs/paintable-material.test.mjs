import test from 'node:test';import assert from 'node:assert/strict';
import {parseMaterialColour,tintNeutralMaterial} from './paintable-material.mjs';
test('paint preserves transparent pixels and the moulding shadow/highlight range',()=>{
 const input=new Uint8ClampedArray([0,0,0,255,190,190,190,255,255,255,255,255,100,100,100,0]);
 const out=tintNeutralMaterial(input,'#4d8066');
 assert.deepEqual([...out.slice(0,4)],[0,0,0,255]);assert.deepEqual([...out.slice(4,8)],[77,128,102,255]);assert.deepEqual([...out.slice(8,12)],[255,255,255,255]);assert.equal(out[15],0);
 assert.deepEqual([...input.slice(4,8)],[190,190,190,255]);
});
test('custom paint accepts only canonical hex colours',()=>{
 for(const bad of ['red','#fff','#12345678','url(x)',null])assert.equal(parseMaterialColour(bad),null);
 assert.deepEqual(parseMaterialColour('#ABCDEF'),[171,205,239]);
 assert.throws(()=>tintNeutralMaterial(new Uint8ClampedArray(4),'red'));
});
