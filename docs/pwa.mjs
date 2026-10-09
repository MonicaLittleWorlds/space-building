// Web installation and explicit updates preserve the current draft.
export async function initWebApp(saveForReload){
 if(location.protocol==='file:'||window.lwDesktop)return;
 const bar=document.getElementById('web-app'),note=document.getElementById('web-status'),install=document.getElementById('install-app'),update=document.getElementById('update-app');bar.hidden=false;
 let prompt=null,registration=null,reloading=false;
 install.onclick=async()=>{if(prompt){await prompt.prompt();await prompt.userChoice;prompt=null;install.hidden=true;}else alert('In Chrome or Edge, open the browser menu and choose Install Space Studio or Install this page as an app. The option appears after the first online setup.');};
 window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();prompt=e;install.hidden=false;});
 window.addEventListener('appinstalled',()=>{install.hidden=true;note.textContent='Installed · save project files to keep a backup';});
 const online=()=>{note.textContent=navigator.onLine?'Space Studio · preparing offline access…':'Offline · reconnect for updates';};online();
 if(!('serviceWorker' in navigator)){note.textContent='Browser editing available · installation requires a supported browser';return;}
 navigator.serviceWorker.addEventListener('message',e=>{if(e.data?.type==='OFFLINE_PROGRESS')note.textContent=`Preparing offline access · ${e.data.done}/${e.data.total} files`;if(e.data?.type==='OFFLINE_SETUP_FAILED')note.textContent='Offline setup interrupted · reconnect and reload to retry';});
 const showUpdate=()=>{if(registration?.waiting){update.hidden=false;note.textContent='Update ready · your design will be saved before reload';}};
 update.onclick=()=>{try{saveForReload();registration?.waiting?.postMessage({type:'ACTIVATE_UPDATE'});}catch(e){note.textContent='Update paused: '+e.message;}};
 navigator.serviceWorker.addEventListener('controllerchange',()=>{if(reloading)return;try{saveForReload();reloading=true;location.reload();}catch(e){note.textContent='Save your project file before reloading: '+e.message;}});
 try{
  registration=await navigator.serviceWorker.register('./sw.js',{updateViaCache:'none'});
  await Promise.race([navigator.serviceWorker.ready,new Promise((_,reject)=>setTimeout(()=>reject(Error('Offline setup timed out')),60000))]);
  const ready=()=>{note.textContent=navigator.onLine?'Offline ready · no account needed':'Offline · your editor is ready';showUpdate();};ready();
  window.addEventListener('online',()=>{ready();registration.update().catch(()=>{});});window.addEventListener('offline',ready);
  registration.addEventListener('updatefound',()=>{const worker=registration.installing;worker?.addEventListener('statechange',()=>{if(worker.state==='installed')ready();});});showUpdate();
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)registration.update().catch(()=>{});});
 }catch{note.textContent='Online editor ready · offline setup failed; reconnect and reload to retry';}
}
