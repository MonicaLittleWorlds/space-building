import config from './version-config.mjs';

export async function checkRequiredVersion(build,url,request=fetch){
 const target=new URL(url);target.searchParams.set('check',Date.now().toString());
 const response=await request(target,{cache:'no-store',credentials:'omit',signal:AbortSignal.timeout(10000)});
 if(!response.ok)throw Error('The version check is unavailable. Reconnect and try again.');
 const policy=await response.json();
 if(policy.schema!==1||typeof policy.requiredBuild!=='string'||! /^[a-f0-9]{16}$/.test(policy.requiredBuild))throw Error('The version check returned an invalid response. Try again shortly.');
 return policy.requiredBuild===build;
}

export async function applyRequiredUpdate(registration,save,reload){
 await registration.update();
 const worker=registration.installing;
 if(worker&&worker.state!=='installed')await new Promise((resolve,reject)=>{
  const finish=()=>{if(!['installed','redundant'].includes(worker.state))return;clearTimeout(timeout);worker.removeEventListener('statechange',finish);worker.state==='installed'?resolve():reject(Error('The update download failed. Try again.'));};
  const timeout=setTimeout(()=>{worker.removeEventListener('statechange',finish);reject(Error('Update download timed out. Try again.'));},60000);
  worker.addEventListener('statechange',finish);finish();
 });
 await save();
 if(registration.waiting)registration.waiting.postMessage({type:'ACTIVATE_UPDATE'});
 else reload();
}

export async function requireCurrentVersion(){
 if(!config.enabled)return {setProjectActions(){}};
 let actions=null,busy=false,updating=false,locked=true,resolved=false,resolveOpening,backupRequired=false,backupDownloaded=false;
 const opening=new Promise(resolve=>resolveOpening=resolve);
 const gate=document.createElement('section');gate.id='version-gate';gate.setAttribute('aria-label','Required app update');
 gate.innerHTML='<div class="entry-card"><div class="entry-brand">LW <span>SPACE STUDIO</span></div><h1 id="version-heading">Checking app version…</h1><p id="version-message" role="status">Internet access is required to open the builder.</p><button id="version-retry">Check again</button><button id="version-update" class="primary" hidden>Update app · keep project</button><button id="version-backup" hidden>Download my project</button><small>Your saved projects remain on this device.</small></div>';
 document.body.append(gate);
 const heading=gate.querySelector('#version-heading'),message=gate.querySelector('#version-message'),retry=gate.querySelector('#version-retry'),update=gate.querySelector('#version-update'),backup=gate.querySelector('#version-backup');
 const surfaces=[...document.querySelectorAll('body > header,body > main,#web-app')];
 const block=()=>{locked=true;gate.hidden=false;document.body.setAttribute('data-version-locked','');for(const el of surfaces)el.inert=true;backup.hidden=!actions;};
 const unlock=()=>{backupRequired=false;backupDownloaded=false;locked=false;gate.hidden=true;document.body.removeAttribute('data-version-locked');for(const el of surfaces)el.inert=false;if(!resolved){resolved=true;resolveOpening();}};
 window.addEventListener('keydown',e=>{if(locked&&!gate.contains(e.target)){e.preventDefault();e.stopImmediatePropagation();}},true);
 const pause=async(title,detail,canUpdate=false)=>{
  if(actions&&!locked){
   actions.pause?.();
   try{await actions.save();backupRequired=false;}catch{backupRequired=true;}
  }
  block();heading.textContent=backupRequired?'Save your project first':title;
  message.textContent=backupRequired?'Automatic saving failed. Download your project before updating or closing this window.':detail+(actions?' Your latest changes are saved on this device.':'');
  update.hidden=!canUpdate;update.disabled=backupRequired&&!backupDownloaded;
 };
 const check=async()=>{
  if(busy||updating)return;busy=true;if(!resolved)block();retry.disabled=true;update.hidden=true;
  heading.textContent='Checking app version…';message.textContent='Connecting to Space Studio…';
  try{
   if(!navigator.onLine)throw Error('Connect to the internet to verify the current app version.');
   const current=await checkRequiredVersion(config.build,new URL('./required-version.json',import.meta.url));
   if(!navigator.onLine)throw Error('Reconnect to continue building.');
   if(current){unlock();return;}
   await pause('An update is required','Update Space Studio to continue building.',true);
  }catch(e){await pause('Internet check required',e.message);}
  finally{busy=false;retry.disabled=false;}
 };
 retry.onclick=check;
 backup.onclick=async()=>{try{await actions?.backup();backupDownloaded=true;update.disabled=false;message.textContent='Project download started. Keep the file as your backup before updating or closing.';}catch(e){message.textContent='Could not download: '+e.message;}};
 update.onclick=async()=>{
  updating=true;update.disabled=true;retry.disabled=true;message.textContent='Downloading the update…';
  try{
   const save=async()=>{if(actions&&!(backupRequired&&backupDownloaded))await actions.save();};
   if(!('serviceWorker' in navigator)){await save();location.reload();return;}
   const registration=await navigator.serviceWorker.register('./sw.js',{updateViaCache:'none'});
   await applyRequiredUpdate(registration,save,()=>location.reload());
  }catch(e){message.textContent='Update paused: '+e.message;}
  finally{updating=false;update.disabled=backupRequired&&!backupDownloaded;retry.disabled=false;}
 };
 navigator.serviceWorker?.addEventListener('controllerchange',()=>{if(locked)location.reload();});
 // Recheck open sessions as well as fresh launches. Never trust a cached policy.
 window.addEventListener('online',check);
 window.addEventListener('offline',()=>pause('Internet check required','Reconnect to continue building.'));
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)check();});
 setInterval(()=>{if(!document.hidden)check();},60000);
 await check();await opening;
 return {setProjectActions(value){actions=value;backup.hidden=!locked;}};
}
