import * as THREE from './assets/daylight/three.module.min.js';
import kit from './kit.mjs';
import {indoorRoofFaces,authoredLights} from './daylight-rooms.mjs';
import {daylightGeometry,daylightSettings,sunlightPosition} from './daylight-geometry.mjs';

function faceTriangles(vertices){
 const a=new THREE.Vector3(...vertices[0]),normal=new THREE.Vector3();for(let i=1;i<vertices.length-1&&normal.lengthSq()<1e-12;i++)normal.crossVectors(new THREE.Vector3(...vertices[i]).sub(a),new THREE.Vector3(...vertices[i+1]).sub(a));const n=[Math.abs(normal.x),Math.abs(normal.y),Math.abs(normal.z)],drop=n.indexOf(Math.max(...n)),axes=[0,1,2].filter(i=>i!==drop);return THREE.ShapeUtils.triangulateShape(vertices.map(v=>new THREE.Vector2(v[axes[0]],v[axes[1]])),[]);
}
// One renderer, one material per finish and one texture per URL for the entire session.
export async function openDaylightView(project,active,onSave,options={}){
 const manifest=await fetch(new URL('./assets/daylight/materials.json',import.meta.url)).then(r=>{if(!r.ok)throw Error('Material catalog unavailable');return r.json();});
 const dialog=document.createElement(options.mount?'section':'dialog');dialog.className='daylight-dialog'+(options.mount?' daylight-inline':'');
 dialog.innerHTML=`<header><strong>Daylight material view</strong><select aria-label="Floor"></select><label><input type="checkbox" data-action="cutaway" checked> Cutaway</label><button data-action="rotate">Rotate ↻</button><button data-action="fit">Fit</button><button data-action="close">Back to builder</button></header><div class="daylight-stage"></div><footer><label>Sun direction <input data-setting="azimuth" type="range" min="0" max="360"></label><label>Sun height <input data-setting="elevation" type="range" min="10" max="85"></label><label>Daylight strength <input data-setting="intensity" type="range" min="0" max="4" step="0.1"></label><button data-action="save">Save lighting to project</button><span role="status"></span></footer>`;
 (options.mount||document.body).append(dialog);if(!options.mount)dialog.showModal();
 const host=dialog.querySelector('.daylight-stage'),status=dialog.querySelector('[role=status]'),levelSelect=dialog.querySelector('select');
 for(const l of project.levels){const o=document.createElement('option');o.value=l.id;o.textContent=l.name;levelSelect.append(o);}levelSelect.value=active;
 let renderer;
 try{renderer=new THREE.WebGLRenderer({antialias:true,alpha:false});}catch(e){dialog.remove();throw Error('Live daylight needs WebGL. Your project is unchanged.');}
 renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.1;host.append(renderer.domElement);
 const scene=new THREE.Scene();scene.background=new THREE.Color('#f1efe7');
 const camera=new THREE.OrthographicCamera(-10,10,10,-10,.1,500),sun=new THREE.DirectionalLight('#fff0d9',2.3),ambient=new THREE.HemisphereLight('#dce9ff','#807259',.95);
 sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);sun.shadow.normalBias=.025;sun.shadow.bias=-.0001;sun.shadow.radius=3;scene.add(sun,sun.target,ambient);
 const shadowMaterial=new THREE.MeshBasicMaterial({colorWrite:false,depthWrite:false,side:THREE.DoubleSide});let shadowShell=null,pointLights=[],bulbs=[];
 const avatarShadow=new THREE.Group();scene.add(avatarShadow);
 for(const [radius,height,y]of [[.22,.01,2.02],[.22,.7,1.38],[.11,.78,.48]]){const g=height<.1?new THREE.SphereGeometry(radius,10,8):new THREE.CapsuleGeometry(radius,height,3,8);const m=new THREE.Mesh(g,shadowMaterial);m.position.y=y;m.castShadow=true;avatarShadow.add(m);}avatarShadow.visible=false;
 const textures=new Map(),materials=new Map(),loader=new THREE.TextureLoader();let content=new THREE.Group();scene.add(content);
 let settings=daylightSettings(project.daylight),rotation=0,span=20,center=new THREE.Vector3(),closed=false,frame=null,drag=null,projectionState=null,geometryKey='',geometryCenter=new THREE.Vector3();
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
 function moveCamera(){if(projectionState){alignEditor();return;}const angle=Math.PI/4-rotation*Math.PI/2;camera.position.copy(center).add(new THREE.Vector3(Math.cos(angle)*40,40/Math.sqrt(3),Math.sin(angle)*40));camera.lookAt(center);resize();}
 function resize(){if(projectionState){alignEditor();return;}const w=host.clientWidth,h=host.clientHeight;if(!w||!h)return;renderer.setSize(w,h,false);const aspect=w/h;camera.left=-span*aspect/2;camera.right=span*aspect/2;camera.top=span/2;camera.bottom=-span/2;camera.updateProjectionMatrix();draw();}
 function light(){const target=projectionState?geometryCenter:center;const delta=sunlightPosition(settings,50);sun.position.copy(target).add(new THREE.Vector3(...delta));sun.target.position.copy(target);sun.intensity=settings.intensity;draw();}
 function loadLevel(){
  for(const child of content.children)child.geometry.dispose();scene.remove(content);content=new THREE.Group();scene.add(content);
  const level=project.levels.find(l=>l.id===levelSelect.value);
  if(shadowShell){shadowShell.geometry.dispose();scene.remove(shadowShell);}
  const physical=daylightGeometry(project,levelSelect.value,{rotation}).faces.filter(f=>f.kind==='wall'),roof=indoorRoofFaces(level),positions=[];
  for(const f of [...physical,...roof])for(const triangle of faceTriangles(f.vertices))for(const j of triangle)positions.push(...f.vertices[j]);
  const shell=new THREE.BufferGeometry();shell.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));shell.computeVertexNormals();shadowShell=new THREE.Mesh(shell,shadowMaterial);shadowShell.castShadow=true;scene.add(shadowShell);
  for(const l of pointLights){l.shadow.dispose();scene.remove(l);}for(const b of bulbs){b.geometry.dispose();b.material.dispose();scene.remove(b);}pointLights=[];bulbs=[];
  for(const source of authoredLights(level)){const light=new THREE.PointLight(source.color,source.intensity,source.range,2);light.position.set(source.x,source.height,source.z);light.castShadow=true;light.shadow.mapSize.set(512,512);light.shadow.bias=-.0002;light.shadow.normalBias=.02;scene.add(light);pointLights.push(light);const bulb=new THREE.Mesh(new THREE.SphereGeometry(.09,8,6),new THREE.MeshBasicMaterial({color:source.color}));bulb.position.copy(light.position);scene.add(bulb);bulbs.push(bulb);}
  const data=daylightGeometry(project,levelSelect.value,{rotation,cutaway:!options.mount&&dialog.querySelector('[data-action=cutaway]').checked,collapsed:projectionState?.collapsed||[],openGates:projectionState?.openGates||[]}),groups=new Map();
  for(const f of data.faces){const mat=material(f);if(!groups.has(mat))groups.set(mat,{positions:[],uv:[]});const group=groups.get(mat);
   let uv=f.uv;if(f.sprite&&f.basis){const [a,b,c]=f.basis.map(p=>new THREE.Vector3(...p)),u=b.clone().sub(a),v=c.clone().sub(a),uu=u.dot(u),vv=v.dot(v),uvv=u.dot(v),den=uu*vv-uvv*uvv;uv=f.vertices.map(p=>{const q=new THREE.Vector3(...p).sub(a),qu=q.dot(u),qv=q.dot(v);return [(qu*vv-qv*uvv)/den,1-(qv*uu-qu*uvv)/den];});}
   for(const triangle of faceTriangles(f.vertices))for(const j of triangle){group.positions.push(...f.vertices[j]);group.uv.push(...uv[j]);}
  }
  for(const [mat,g]of groups){const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(g.positions,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(g.uv,2));geometry.computeVertexNormals();const mesh=new THREE.Mesh(geometry,mat);mesh.castShadow=true;mesh.receiveShadow=true;content.add(mesh);}
  const box=new THREE.Box3().setFromObject(content);if(box.isEmpty()){center.set(0,0,0);span=10;}else{box.getCenter(center);const size=box.getSize(new THREE.Vector3());span=Math.max(size.x,size.z)*.85+size.y+3;}
  geometryCenter.copy(center);const extent=Math.max(10,span);Object.assign(sun.shadow.camera,{left:-extent,right:extent,top:extent,bottom:-extent,near:1,far:150});sun.shadow.camera.updateProjectionMatrix();
  status.textContent=data.warnings.join(' ')||'Live shared materials · existing game export retained.';moveCamera();light();dialog.dataset.ready='true';
 }
 for(const input of dialog.querySelectorAll('[data-setting]')){input.value=settings[input.dataset.setting];input.oninput=()=>{settings={...settings,[input.dataset.setting]:Number(input.value)};light();};}
 levelSelect.onchange=loadLevel;dialog.querySelector('[data-action=cutaway]').onchange=loadLevel;
 dialog.querySelector('[data-action=rotate]').onclick=()=>{rotation=(rotation+1)%4;loadLevel();};dialog.querySelector('[data-action=fit]').onclick=loadLevel;
 dialog.querySelector('[data-action=save]').onclick=()=>{onSave(daylightSettings(settings));status.textContent='Lighting saved to this project. Game export still uses the native renderer.';};
 if(!options.mount){host.onwheel=e=>{e.preventDefault();span=Math.max(2,Math.min(200,span*Math.exp(e.deltaY*.001)));resize();};
 host.onpointerdown=e=>{drag={x:e.clientX,y:e.clientY};host.setPointerCapture(e.pointerId);};host.onpointerup=()=>{drag=null;};host.onpointermove=e=>{if(!drag)return;const dx=(e.clientX-drag.x)*span/host.clientHeight,dy=(e.clientY-drag.y)*span/host.clientHeight;const right=new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld,0),up=new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld,1);center.addScaledVector(right,-dx).addScaledVector(up,dy);drag={x:e.clientX,y:e.clientY};moveCamera();light();};
 }
 const observer=new ResizeObserver(resize);observer.observe(host);
 const close=()=>{if(closed)return;closed=true;observer.disconnect();if(frame!==null)cancelAnimationFrame(frame);for(const c of content.children)c.geometry.dispose();for(const m of materials.values())m.dispose();for(const t of textures.values())t.dispose();if(shadowShell)shadowShell.geometry.dispose();for(const l of pointLights)l.shadow.dispose();for(const b of bulbs){b.geometry.dispose();b.material.dispose();}for(const m of avatarShadow.children)m.geometry.dispose();shadowMaterial.dispose();renderer.dispose();dialog.querySelector('footer')?.remove();controls.remove();dialog.remove();};
 dialog.querySelector('[data-action=close]').onclick=()=>options.mount?close():dialog.close();dialog.addEventListener('close',close,{once:true});
 const controls=dialog.querySelector('footer');if(options.controls)options.controls.append(controls);if(!options.mount)loadLevel();
 function alignEditor(){
  const {width,height,scale,pan}=projectionState,ppu=64*Math.SQRT2*scale,angle=Math.PI/4-rotation*Math.PI/2;
  renderer.setSize(width,height,false);const right=new THREE.Vector3(Math.sin(angle),0,-Math.cos(angle)),up=new THREE.Vector3(-Math.cos(angle)*.5,Math.sqrt(3)/2,-Math.sin(angle)*.5);
  const target=new THREE.Vector3(4,0,3).addScaledVector(right,-pan.x/ppu).addScaledVector(up,(height*.12+pan.y)/ppu);
  camera.position.copy(target).add(new THREE.Vector3(Math.cos(angle)*40,40/Math.sqrt(3),Math.sin(angle)*40));camera.lookAt(target);
  camera.left=-width/(2*ppu);camera.right=width/(2*ppu);camera.top=height/(2*ppu);camera.bottom=-height/(2*ppu);camera.updateProjectionMatrix();camera.updateMatrixWorld();draw();
 }
 function update(next,level,view){
  project=next;active=level;projectionState=view;avatarShadow.visible=!!view.avatar&&view.avatar.level===level;if(avatarShadow.visible)avatarShadow.position.set(view.avatar.x,0,view.avatar.z);rotation=view.rotation;settings=daylightSettings(project.daylight);
  for(const input of controls.querySelectorAll('[data-setting]'))input.value=settings[input.dataset.setting];
  if(![...levelSelect.options].some(o=>o.value===level)){const o=document.createElement('option');o.value=level;levelSelect.append(o);}levelSelect.value=level;
  const key=JSON.stringify([project.levels.find(l=>l.id===level),project.stairs,rotation,view.collapsed,view.openGates]);
  if(key!==geometryKey){geometryKey=key;loadLevel();}else{alignEditor();light();}
 }
 if(options.mount)for(const input of controls.querySelectorAll('[data-setting]')){input.oninput=()=>{settings={...settings,[input.dataset.setting]:Number(input.value)};light();};input.onchange=()=>onSave(daylightSettings(settings));}
 return {close,update,screenPoint:([x,z,h=0])=>{const p=new THREE.Vector3(x,h/Math.sqrt(6144),z).project(camera);return [(p.x+1)*host.clientWidth/2,(1-p.y)*host.clientHeight/2];},stats:()=>({textures:textures.size,materials:materials.size,drawCalls:renderer.info.render.calls,level:levelSelect.value,roofedCells:indoorRoofFaces(project.levels.find(l=>l.id===levelSelect.value)).length,lights:pointLights.length,avatarShadow:avatarShadow.visible})};
}
