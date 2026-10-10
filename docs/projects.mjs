import {parseProject} from './model.mjs';
const TRASH='lw-studio-trash:';
const PREFIX='lw-studio-project:',ACTIVE='lw-studio-active-project',RECOVERY='lw-studio-session-draft';
export class ProjectLibrary{
 constructor(storage,session,locks,id=()=>crypto.randomUUID()){Object.assign(this,{storage,session,locks,id});this.current=null;this.release=null;}
 list(){const result=[];for(let i=0;i<this.storage.length;i++){const key=this.storage.key(i);if(!key?.startsWith(PREFIX))continue;try{const r=JSON.parse(this.storage.getItem(key));parseProject(r.project);result.push(r);}catch{}}return result.sort((a,b)=>b.updated-a.updated);}
 get(id){const raw=this.storage.getItem(PREFIX+id);if(!raw)throw Error('This project is no longer available.');const r=JSON.parse(raw);r.project=parseProject(r.project);return r;}
 async claim(id){
  if(!this.locks)return false;
  return new Promise((resolve,reject)=>{this.locks.request(PREFIX+id,{ifAvailable:true},async lock=>{if(!lock){resolve(false);return;}await new Promise(release=>{this.release=release;resolve(true);});}).catch(reject);});
 }
 async start(fallback,recovery){
  let migrated=null;
  if(!this.storage.getItem('lw-studio-migrated-v1')){
   const legacy=this.storage.getItem('lw-space-studio-v1');
   if(legacy){try{const p=parseProject(legacy);const id='previous-draft';if(!this.storage.getItem(PREFIX+id))this.storage.setItem(PREFIX+id,JSON.stringify({id,project:p,updated:Date.now()}));migrated=id;}catch{}}
   this.storage.setItem('lw-studio-migrated-v1','1');
  }
  const active=this.session.getItem(ACTIVE)||migrated;
  if(active){try{const r=this.get(active);let snapshot=null;try{snapshot=JSON.parse(this.session.getItem(RECOVERY));}catch{}const p=recovery||(snapshot?.id===active?snapshot.project:r.project);return await this.open(active,p);}catch{}}
  return this.create(recovery||fallback);
 }
 async open(id,override){
  const r=this.get(id),project=parseProject(override||r.project);
  if(this.current===id){this.save(project);return {project,id,copied:false};}
  this.release?.();this.release=null;
  const exclusive=await this.claim(id);
  if(!exclusive){project.name=(project.name.slice(0,109)+' (tab copy)');return this.create(project,true);}
  this.current=id;this.save(project);return {project,id,copied:false};
 }
 async create(project,copied=false){
  project=parseProject(project);this.release?.();this.release=null;const id=this.id();await this.claim(id);this.current=id;this.save(project);return {project,id,copied};
 }
 save(project){if(!this.current)throw Error('No active project.');const r={id:this.current,updated:Date.now(),project};this.session.setItem(RECOVERY,JSON.stringify(r));this.storage.setItem(PREFIX+this.current,JSON.stringify(r));this.session.setItem(ACTIVE,this.current);}
 deleted(){const rows=[];for(let i=0;i<this.storage.length;i++){const k=this.storage.key(i);if(!k?.startsWith(TRASH))continue;try{const r=JSON.parse(this.storage.getItem(k));parseProject(r.project);rows.push(r);}catch{}}return rows.sort((a,b)=>b.deleted-a.deleted);}
 async trash(id){
  const remove=()=>{const r=this.get(id);this.storage.setItem(TRASH+id,JSON.stringify({...r,deleted:Date.now()}));this.storage.removeItem(PREFIX+id);if(this.current===id){this.current=null;this.session.removeItem(ACTIVE);this.session.removeItem(RECOVERY);this.close();}return r;};
  if(this.current===id)return remove();
  if(!this.locks)throw Error('Open this project in this tab before deleting it.');
  return this.locks.request(PREFIX+id,{ifAvailable:true},lock=>{if(!lock)throw Error('This project is open in another tab. Close that tab before deleting it.');return remove();});
 }
 restore(id){
  const raw=this.storage.getItem(TRASH+id);if(!raw)throw Error('This deleted project is no longer available.');
  const r=JSON.parse(raw),project=parseProject(r.project),restored={id:this.id(),project,updated:Date.now()};
  this.storage.setItem(PREFIX+restored.id,JSON.stringify(restored));this.storage.removeItem(TRASH+id);return restored;
 }
 close(){this.release?.();this.release=null;}
}
