// Recompress PNG scanlines without changing pixels, filters, dimensions or alpha.
// Canvas PNGs favour export speed; native packages benefit from normal deflate.
const signature=[137,80,78,71,13,10,26,10];
const crc32=bytes=>{let crc=0xffffffff;for(const byte of bytes){crc^=byte;for(let i=0;i<8;i++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}return (crc^0xffffffff)>>>0;};
const concat=parts=>{const out=new Uint8Array(parts.reduce((n,p)=>n+p.length,0));let i=0;for(const p of parts){out.set(p,i);i+=p.length;}return out;};
const transform=async(bytes,stream)=>new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(stream)).arrayBuffer());
export async function compressPNG(bytes){
 if(typeof CompressionStream==='undefined'||typeof DecompressionStream==='undefined'||!signature.every((n,i)=>bytes[i]===n))return bytes;
 const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),chunks=[],data=[];
 for(let at=8;at<bytes.length;){
  const size=view.getUint32(at),end=at+size+12;if(end>bytes.length)throw Error('Invalid PNG chunk');
  const type=String.fromCharCode(...bytes.subarray(at+4,at+8));
  chunks.push({type,bytes:bytes.subarray(at,end)});
  if(type==='IDAT')data.push(bytes.subarray(at+8,at+8+size));at=end;
 }
 if(!data.length)return bytes;
 const raw=await transform(concat(data),new DecompressionStream('deflate'));
 const packed=await transform(raw,new CompressionStream('deflate'));
 const idat=new Uint8Array(packed.length+12),header=new DataView(idat.buffer);
 header.setUint32(0,packed.length);idat.set([73,68,65,84],4);idat.set(packed,8);header.setUint32(idat.length-4,crc32(idat.subarray(4,idat.length-4)));
 let inserted=false;const result=concat([bytes.subarray(0,8),...chunks.flatMap(chunk=>chunk.type!=='IDAT'?[chunk.bytes]:inserted?[]:(inserted=true,[idat]))]);
 return result.length<bytes.length?result:bytes;
}
export async function compressPNGBase64(base64){
 const input=Uint8Array.from(atob(base64),c=>c.charCodeAt(0)),bytes=await compressPNG(input);
 if(bytes===input)return base64;
 const chunks=[];for(let i=0;i<bytes.length;i+=8192)chunks.push(String.fromCharCode(...bytes.subarray(i,i+8192)));
 return btoa(chunks.join(''));
}
