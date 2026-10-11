import kit from './kit.mjs';
import {fenceFaces,stairFaces} from './geometry.mjs';
import {wallFaces} from './architecture.mjs';
import {orderFaces} from './face-order.mjs';
const cache=new Map(),pickers=[];
const esc=value=>String(value).replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll('<','&lt;');
export function styleThumbnail(kind,value,span=1){
 if(kind==='wall'){const m=kit.wallMaterials.find(m=>m.id===value);if(m?.texture)return m.texture;}
 if(kind==='floor')return `assets/floor-${value}-1x1.png`;
 const key=kind+':'+value+':'+span;if(cache.has(key))return cache.get(key);
 let faces;
 if(kind==='stair')faces=stairFaces({x:0,z:0,axis:'x',width:2,depth:3,rise:-1,style:value},0);
 else if(kind==='fence')faces=fenceFaces({x:0,z:0,axis:'z',kind:'fence',fenceStyle:value},0);
 else{const w={x:0,z:0,axis:'z',kind:kind==='wall'?'wall':kind,windowStyle:value,doorStyle:value,material:kind==='wall'?value:'blank'};faces=wallFaces(w,{level:{id:'preview',tiles:{'0,0':{}},walls:{'z:0,0':w}},paint:{back:false,fill:kind==='wall'?(kit.wallMaterials.find(m=>m.id===value)?.color||'#d3d7c9'):'#d3d7c9',opacity:1}});}
 if(kind==='wall'&&span>1){const original=faces;faces=Array.from({length:span},(_,i)=>original.map(f=>({...f,vertices:f.vertices.map(([x,z,h])=>[x+i,z,h])}))).flat();}
 const projected=orderFaces(faces.map(f=>({...f,attrs:f.attrs||{fill:f.color}})),0).map(f=>({...f,points:f.vertices.map(([x,z,h])=>[(x-z)*64,(x+z)*32-h])}));
 const all=projected.flatMap(f=>f.points),xs=all.map(p=>p[0]),ys=all.map(p=>p[1]);
 const left=Math.min(...xs)-10,top=Math.min(...ys)-10,width=Math.max(...xs)-left+10,height=Math.max(...ys)-top+10;
 const svg=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="${left} ${top} ${width} ${height}">${projected.map(f=>`<polygon points="${f.points.map(p=>p.join(',')).join(' ')}" ${Object.entries(f.attrs).filter(([k])=>['fill','stroke','stroke-width','opacity'].includes(k)).map(([k,v])=>`${k}="${esc(v)}"`).join(' ')}/>`).join('')}</svg>`;
 const url='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svg);cache.set(key,url);return url;
}
export function installStylePickers(){
 for(const [id,kind] of [['floor-material','floor'],['wall-material','wall'],['door-style','door'],['window-style','window'],['fence-style','fence'],['stair-style','stair'],['decor-finish',()=>document.getElementById('decor-kind').value],['piece-style',()=>document.getElementById('piece-kind').value]]){
  const select=document.getElementById(id);if(!select)continue;
  const details=document.createElement('details');details.className='style-picker';details.dataset.for=id;
  const summary=document.createElement('summary'),list=document.createElement('div');list.className='style-options';list.setAttribute('role','group');list.setAttribute('aria-label','Available styles');details.append(summary,list);select.after(details);select.hidden=true;
  const update=()=>{
   const type=typeof kind==='function'?kind():kind,options=[...select.options],signature=JSON.stringify([type,options.map(o=>[o.value,o.textContent,o.disabled])]);
   details.classList.toggle('disabled',select.disabled);summary.setAttribute('aria-disabled',String(select.disabled));summary.setAttribute('aria-label',`${select.closest('label')?.firstChild?.textContent?.trim()||'Style'}: ${select.selectedOptions[0]?.textContent||'Choose a style'}`);
   if(details.dataset.options!==signature){details.dataset.options=signature;list.replaceChildren();for(const option of options){const button=document.createElement('button');button.type='button';button.dataset.value=option.value;button.disabled=option.disabled;const image=document.createElement('img');image.src=styleThumbnail(type,option.value);image.alt='';const label=document.createElement('span');label.textContent=option.textContent;button.append(image,label);button.onclick=e=>{e.preventDefault();if(select.disabled)return;select.value=option.value;select.dispatchEvent(new Event('change',{bubbles:true}));details.open=false;update();};list.append(button);}}
   const selected=options.find(o=>o.value===select.value);summary.replaceChildren();if(selected){const image=document.createElement('img');image.src=styleThumbnail(type,selected.value);image.alt='';const label=document.createElement('span');label.textContent=selected.textContent;summary.append(image,label);}
   for(const button of list.children)button.setAttribute('aria-pressed',String(button.dataset.value===select.value));
  };
  summary.onclick=e=>{if(select.disabled)e.preventDefault();};details.addEventListener('keydown',e=>{if(e.key==='Escape'){details.open=false;summary.focus();}});select.addEventListener('change',update);pickers.push(update);update();
 }
}
export function refreshStylePickers(){for(const update of pickers)update();}
