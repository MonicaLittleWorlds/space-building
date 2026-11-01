import test from 'node:test';
import assert from 'node:assert/strict';
import {deflateSync,inflateSync} from 'node:zlib';
import {compressPNG} from './png-compress.mjs';
const chunk=(type,data)=>{const b=Buffer.alloc(data.length+12);b.writeUInt32BE(data.length);b.write(type,4);b.set(data,8);return b;};
test('PNG optimisation preserves the exact filtered image bytes and other chunks',async()=>{
 const raw=Buffer.alloc(4096);for(let i=0;i<raw.length;i++)raw[i]=i%16;
 const ancillary=chunk('tEXt',Buffer.from('asset:wall'));
 const png=Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),ancillary,chunk('IDAT',deflateSync(raw,{level:0})),chunk('IEND',Buffer.alloc(0))]);
 const out=Buffer.from(await compressPNG(png));assert.ok(out.length<png.length);
 assert.deepEqual(out.subarray(8,8+ancillary.length),ancillary);
 const at=8+ancillary.length,size=out.readUInt32BE(at);
 assert.deepEqual(inflateSync(out.subarray(at+8,at+8+size)),raw);
});
test('unrecognised input remains unchanged',async()=>{const bytes=new Uint8Array([1,2,3]);assert.equal(await compressPNG(bytes),bytes);});
