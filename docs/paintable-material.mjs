export function parseMaterialColour(value){
 if(typeof value!=='string'||!/^#[0-9a-f]{6}$/i.test(value))return null;
 return value.slice(1).match(/../g).map(v=>parseInt(v,16));
}
// Apply paint to a neutral relief map. The middle tone takes the selected
// colour, while crevices remain shaded and highlights can still approach white.
// Run once per selected material/colour, never in the animation frame loop.
export function tintNeutralMaterial(source,colour,{midpoint=190}={}){
 const rgb=parseMaterialColour(colour);if(!rgb)throw new TypeError('Expected a six-digit hex paint colour');
 if(!Number.isFinite(midpoint)||midpoint<=0||midpoint>=255)throw new RangeError('Invalid neutral midpoint');
 const out=new Uint8ClampedArray(source.length);
 for(let i=0;i<source.length;i+=4){
  const light=.2126*source[i]+.7152*source[i+1]+.0722*source[i+2];
  for(let c=0;c<3;c++)out[i+c]=light<=midpoint?rgb[c]*light/midpoint:rgb[c]+(255-rgb[c])*(light-midpoint)/(255-midpoint);
  out[i+3]=source[i+3];
 }
 return out;
}
