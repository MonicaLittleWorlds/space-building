import {demoProject,blankProject,key,edgeKey} from './model.mjs';
import {ensureDecor} from './decor.mjs';
export function joinReview(){const p=ensureDecor(demoProject());p.name='Original LW kit · join review';const l=p.levels[0];for(let x=-2;x<11;x++)for(let z=-2;z<10;z++){const interior=x>=0&&x<9&&z>=0&&z<7;const material=interior?'blank':z===7||z===8?'pavement':'grass';l.tiles[key(x,z)]={walk:true,place:true,material,size:2,piece:`2:${Math.floor(x/2)*2},${Math.floor(z/2)*2}`,decorGroup:interior?'lw_floor_interior':'lw_floor_outdoor'};}for(let x=-2;x<11;x++)l.walls[`z:${x},10`]={axis:'z',x,z:10,kind:'fence',collapse:false,mount:false,fenceStyle:['rail','picket','metal','privacy','slat'][Math.min(4,Math.floor((x+2)/3))],material:'wood',facing:1};for(const w of Object.values(l.walls))if(w.kind!=='fence')w.decorGroup='lw_wall_interior';p.stairs[0].a={...p.stairs[0].a,x:6,z:4,width:2,style:'timber',depth:4,rise:-1};p.stairs[0].b={...p.stairs[0].b,x:6,z:4,width:1,style:'open',depth:4,rise:-1};const windows=Object.values(l.walls).filter(w=>w.kind==='wall'&&w.axis==='z');for(const [i,w] of windows.filter((_,i)=>i%2===0).slice(0,3).entries()){w.kind='window';w.windowStyle=['plain','divided','high'][i];w.mount=false;}return p;}

export function stairReview(){const p=joinReview();p.name='Original LW stair options';for(const l of p.levels){l.walls={};l.tiles={};for(let x=0;x<11;x++)for(let z=-1;z<6;z++)l.tiles[key(x,z)]={walk:true,place:true,material:'blank'};}p.stairs=['masonry','timber','open'].map((style,i)=>({id:'review-stair-'+i,a:{level:p.levels[0].id,x:i*4,z:4,width:i===0?1:2,axis:'x',angle:90,style,depth:4,rise:-1},b:{level:p.levels[1].id,x:i*4,z:4,width:i===0?1:2,axis:'x',angle:90,style,depth:4,rise:-1}}));p.spawn={level:p.levels[0].id,x:5,z:5};return p;}

export function doorReview(){const p=stairReview();p.name='Original LW doorway options';p.stairs=[];for(const l of p.levels){for(let x=0;x<9;x++)l.walls[`z:${x},0`]={x,z:0,axis:'z',kind:x%3===1?'door':'wall',doorStyle:['square','wide','arch'][Math.floor(x/3)],collapse:true,mount:false,material:'blank',facing:1};}return p;}

export function roomReview(){
 const p=blankProject(),l=p.levels[0];p.name='LW room cutaway preview';
 for(let x=-2;x<=8;x++)for(let z=-2;z<=8;z++)l.tiles[key(x,z)]={walk:true,place:true,material:x>=0&&x<6&&z>=0&&z<6?'blank':'grass'};
 const add=(axis,x,z,kind='wall')=>l.walls[edgeKey({axis,x,z})]={axis,x,z,kind,collapse:true,mount:kind==='wall',material:'blank'};
 for(let i=0;i<6;i++){add('x',0,i);add('x',6,i);add('z',i,0,i===1||i===4?'window':'wall');add('z',i,6,i===1?'door':'wall');add('x',3,i,i===3?'door':'wall');}
 p.spawn={level:l.id,x:1,z:2};return p;
}

export function fenceReview(){const p=blankProject(),l=p.levels[0];p.name='LW detailed fence collection';for(let x=-1;x<13;x++)for(let z=-1;z<10;z++)l.tiles[key(x,z)]={walk:true,place:true,material:'grass'};for(const [i,fenceStyle] of ['rail','picket','metal','privacy','slat'].entries()){const x=(i%3)*4,z=Math.floor(i/3)*5;for(let n=0;n<3;n++)for(const axis of ['x','z']){const w={axis,x:axis==='x'?x:x+n,z:axis==='x'?z+n:z,kind:'fence',fenceStyle,...(axis==='z'&&n===1?{gate:true}:{}),collapse:false,mount:false,material:'wood'};l.walls[edgeKey(w)]=w;}}p.spawn={level:l.id,x:11,z:8};return p;}

export function materialReview(){
 const p=roomReview(),l=p.levels[0];p.name='LW finish showroom';
 for(const [key,t] of Object.entries(l.tiles)){const [x,z]=key.split(',').map(Number);t.material=x>=0&&x<6&&z>=0&&z<6?(x<3?'wood':'marble'):(z>5?'stone':'grass');}
 for(const w of Object.values(l.walls)){w.material=w.axis==='x'?(w.x===3?'panel':'stone'):'brick';w.exteriorMaterial=w.material;if(w.kind==='window')w.windowStyle='colonial';if(w.kind==='door')w.doorStyle='craftsman';}
 return p;
}

export function craftedReview(){
 const p=ensureDecor(demoProject());p.name='Crafted architecture preview';
 for(const l of p.levels){
  for(const t of Object.values(l.tiles))t.material='cc0-woodfloor051';
  delete l.walls['x:4,3'];
  for(const w of Object.values(l.walls))w.material='blank';
  for(const x of [1,5])l.walls['z:'+x+',0']={axis:'z',x,z:0,kind:'window',windowStyle:'colonial',collapse:true,mount:false,material:'blank'};
  l.walls['x:0,3']={axis:'x',x:0,z:3,kind:'door',doorStyle:'craftsman',collapse:true,mount:false,material:'blank'};
  for(let x=0;x<8;x++)l.walls['z:'+x+',7']={axis:'z',x,z:7,kind:'fence',fenceStyle:x<4?'picket':'metal',collapse:false,mount:false};
 }
 for(const e of [p.stairs[0].a,p.stairs[0].b])Object.assign(e,{x:6,z:5,width:1,depth:4,rise:-1,style:'classic'});
 return p;
}
