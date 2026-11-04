// Bake AO into the opaque surface paint, including its anti-aliased outline.
// A separate transparent polygon leaves the base paint's stroke unshaded.
export function bakeAmbientFaces(faces) {
 const key=f=>JSON.stringify(f.vertices.map(p=>p.map(n=>Math.round(n*1e7))).sort((a,b)=>String(a).localeCompare(String(b))));
 const effects=new Map();
 for(const f of faces)if(/wall-(base|corner)-ambient/.test(f.attrs?.['data-part']||'')){
  const k=key(f);if(!effects.has(k))effects.set(k,[]);effects.get(k).push(f.attrs);
 }
 return faces.filter(f=>!/wall-(base|corner)-ambient/.test(f.attrs?.['data-part']||''))
  .map(f=>({...f,ambient:effects.get(key(f))||[]}));
}
