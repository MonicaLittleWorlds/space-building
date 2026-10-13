import * as THREE from './assets/daylight/three.module.min.js';
import kit from './kit.mjs';
import {daylightGeometry,daylightSettings,sunlightPosition} from './daylight-geometry.mjs';

// One renderer, one material per finish and one texture per URL for the entire session.
export async function openDaylightView(project,active,onSave){
 const manifest=await fetch(new URL('./assets/daylight/materials.json',import.meta.url)).then(r=>{if(!r.ok)throw Error('Material catalog unavailable');return r.json();});
 const dialog=document.createElement('dialog');dialog.className='daylight-dialog';
 dialog.innerHTML=`<header><strong>Daylight material view</strong><select aria-label="Floor"></select><label><input type="checkbox" data-action="cutaway" checked> Cutaway</label><button data-action="rotate">Rotate ↻</button><button data-action="fit">Fit</button><button data-action="close">Back to builder</button></header><div class="daylight-stage"></div><footer><label>Sun direction <input data-setting="azimuth" type="range" min="0" max="360"></label><label>Sun height <input data-setting="elevation" type="range" min="10" max="85"></label><label>Daylight strength <input data-setting="intensity" type="range" min="0" max="4" step="0.1"></label><button data-action="save">Save lighting to project</button><span role="status"></span></footer>`;
 document.body.append(dialog);dialog.showModal();
 const host=dialog.querySelector('.daylight-stage'),status=dialog.querySelector('[role=status]'),levelSelect=dialog.querySelector('select');
 for(const l of project.levels){const o=document.createElement('option');o.value=l.id;o.textContent=l.name;levelSelect.append(o);}levelSelect.value=active;
 let renderer;
 try{renderer=new THREE.WebGLRenderer({antialias:true,alpha:false});}catch(e){dialog.remove();throw Error('Live daylight needs WebGL. Your project is unchanged.');}
 renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.1;host.append(renderer.domElement);
 const scene=new THREE.Scene();scene.background=new THREE.Color('#f1efe7');
 const camera=new THREE.OrthographicCamera(-10,10,10,-10,.1,500),sun=new THREE.DirectionalLight('#fff0d9',2.3),ambient=new THREE.HemisphereLight('#dce9ff','#807259',1.6);
 sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);sun.shadow.normalBias=.025;sun.shadow.bias=-.0001;sun.shadow.radius=3;scene.add(sun,sun.target,ambient);
 const textures=new Map(),materials=new Map(),loader=new THREE.TextureLoader();let content=new THREE.Group();scene.add(content);
 let settings=daylightSettings(project.daylight),rotation=0,span=20,center=new THREE.Vector3(),closed=false,frame=null,drag=null;
 function draw(){if(closed||frame!==null)return;frame=requestAnimationFrame(()=>{frame=null;renderer.render(scene,camera);});}
 function texture(url,color=false){if(textures.has(url))return textures.get(url);const t=loader.load(new URL(url,import.meta.url).href,draw,undefined,()=>{status.textContent='A material failed to load. Showing its base color.';});t.wrapS=t.wrapT=THREE.RepeatWrapping;t.colorSpace=color?THREE.SRGBColorSpace:THREE.NoColorSpace;t.anisotropy=Math.min(4,renderer.capabilities.getMaxAnisotropy());textures.set(url,t);return t;}
 function material(face){
  const m=face.material,category=face.kind==='floor'?'floor':'wall';
  const study=category==='floor'?(['wood','weathered-wood'].includes(m)?'timber':['grass','short-grass'].includes(m)?'grass':null):face.kind==='wall'&&['blank','plaster','brick'].includes(m)?'plaster':null;
  const existing=(category==='floor'?kit.floorMaterials:kit.wallMaterials).find(v=>v.id===m),maps=study?manifest[study]:existing?.texture?{map:existing.texture}:{};
  const key=JSON.stringify([study||m,face.sprite,face.sprite?null:maps.map?null:face.color,face.opacity]);if(materials.has(key))return materials.get(key);
  const props={color:maps.map||face.sprite?'#ffffff':face.color,roughness:.82,metalness:/metal/.test(face.part)?.55:0,side:THREE.DoubleSide,opacity:face.opacity,transparent:face.opacity<1};
  for(const [k,v]of Object.entries(maps))if(['map','normalMap','roughnessMap'].includes(k))props[k]=texture(v,k==='map');
  if(face.sprite){props.map=texture(face.sprite,true);props.alphaTest=.15;props.transparent=false;}
  const mat=new THREE.MeshStandardMaterial(props);if(study==='plaster'){mat.onBeforeCompile=shader=>{shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>', '#include <map_fragment>\n diffuseColor.rgb = mix(diffuseColor.rgb, vec3(1.0) - (vec3(1.0)-diffuseColor.rgb)*(vec3(1.0)-vec3(.67,.58,.43)), .65);');};mat.customProgramCacheKey=()=>"lime-plaster-v1";}if(mat.normalMap)mat.normalScale.set(.45,.45);materials.set(key,mat);return mat;
 }
 function moveCamera(){const angle=Math.PI/4-rotation*Math.PI/2;camera.position.copy(center).add(new THREE.Vector3(Math.cos(angle)*40,32.66,Math.sin(angle)*40));camera.lookAt(center);resize();}
 function resize(){const w=host.clientWidth,h=host.clientHeight;if(!w||!h)return;renderer.setSize(w,h,false);const aspect=w/h;camera.left=-span*aspect/2;camera.right=span*aspect/2;camera.top=span/2;camera.bottom=-span/2;camera.updateProjectionMatrix();draw();}
 function light(){const delta=sunlightPosition(settings,50);sun.position.copy(center).add(new THREE.Vector3(...delta));sun.target.position.copy(center);sun.intensity=settings.intensity;draw();}
 function loadLevel(){
  for(const child of content.children)child.geometry.dispose();scene.remove(content);content=new THREE.Group();scene.add(content);
  const data=daylightGeometry(project,levelSelect.value,{rotation,cutaway:dialog.querySelector('[data-action=cutaway]').checked}),groups=new Map();
  for(const f of data.faces){const mat=material(f);if(!groups.has(mat))groups.set(mat,{positions:[],uv:[]});const group=groups.get(mat);
   let uv=f.uv;if(f.sprite&&f.basis){const [a,b,c]=f.basis.map(p=>new THREE.Vector3(...p)),u=b.clone().sub(a),v=c.clone().sub(a),uu=u.dot(u),vv=v.dot(v),uvv=u.dot(v),den=uu*vv-uvv*uvv;uv=f.vertices.map(p=>{const q=new THREE.Vector3(...p).sub(a),qu=q.dot(u),qv=q.dot(v);return [(qu*vv-qv*uvv)/den,1-(qv*uu-qu*uvv)/den];});}
   for(let i=1;i<f.vertices.length-1;i++)for(const j of [0,i,i+1]){group.positions.push(...f.vertices[j]);group.uv.push(...uv[j]);}
  }
  for(const [mat,g]of groups){const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(g.positions,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(g.uv,2));geometry.computeVertexNormals();const mesh=new THREE.Mesh(geometry,mat);mesh.castShadow=true;mesh.receiveShadow=true;content.add(mesh);}
  const box=new THREE.Box3().setFromObject(content);if(box.isEmpty()){center.set(0,0,0);span=10;}else{box.getCenter(center);const size=box.getSize(new THREE.Vector3());span=Math.max(size.x,size.z)*.85+size.y+3;}
  const extent=Math.max(10,span);Object.assign(sun.shadow.camera,{left:-extent,right:extent,top:extent,bottom:-extent,near:1,far:150});sun.shadow.camera.updateProjectionMatrix();
  status.textContent=data.warnings.join(' ')||'Live shared materials · existing game export retained.';moveCamera();light();dialog.dataset.ready='true';
 }
 for(const input of dialog.querySelectorAll('[data-setting]')){input.value=settings[input.dataset.setting];input.oninput=()=>{settings={...settings,[input.dataset.setting]:Number(input.value)};light();};}
 levelSelect.onchange=loadLevel;dialog.querySelector('[data-action=cutaway]').onchange=loadLevel;
 dialog.querySelector('[data-action=rotate]').onclick=()=>{rotation=(rotation+1)%4;loadLevel();};dialog.querySelector('[data-action=fit]').onclick=loadLevel;
 dialog.querySelector('[data-action=save]').onclick=()=>{onSave(daylightSettings(settings));status.textContent='Lighting saved to this project. Game export still uses the native renderer.';};
 host.onwheel=e=>{e.preventDefault();span=Math.max(2,Math.min(200,span*Math.exp(e.deltaY*.001)));resize();};
 host.onpointerdown=e=>{drag={x:e.clientX,y:e.clientY};host.setPointerCapture(e.pointerId);};host.onpointerup=()=>{drag=null;};host.onpointermove=e=>{if(!drag)return;const dx=(e.clientX-drag.x)*span/host.clientHeight,dy=(e.clientY-drag.y)*span/host.clientHeight;const right=new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld,0),up=new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld,1);center.addScaledVector(right,-dx).addScaledVector(up,dy);drag={x:e.clientX,y:e.clientY};moveCamera();light();};
 const observer=new ResizeObserver(resize);observer.observe(host);
 const close=()=>{if(closed)return;closed=true;observer.disconnect();if(frame!==null)cancelAnimationFrame(frame);for(const c of content.children)c.geometry.dispose();for(const m of materials.values())m.dispose();for(const t of textures.values())t.dispose();renderer.dispose();dialog.remove();};
 dialog.querySelector('[data-action=close]').onclick=()=>dialog.close();dialog.addEventListener('close',close,{once:true});loadLevel();
 return {close,stats:()=>({textures:textures.size,materials:materials.size,drawCalls:renderer.info.render.calls,level:levelSelect.value})};
}
