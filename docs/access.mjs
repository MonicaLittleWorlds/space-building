import {openOwnerPanel,hasCodeService,verifyBuilderCode} from './owner.mjs';
import config from './access-config.mjs';
const encode=new TextEncoder();
export async function codeDigest(code,salt,iterations=210000){
 const key=await crypto.subtle.importKey('raw',encode.encode(code.trim()),'PBKDF2',false,['deriveBits']);
 const bits=await crypto.subtle.deriveBits({name:'PBKDF2',hash:'SHA-256',salt:encode.encode(salt),iterations},key,256);
 return Array.from(new Uint8Array(bits),n=>n.toString(16).padStart(2,'0')).join('');
}
export async function matchesCode(code,settings=config){
 if(!code.trim()||code.length>128)return false;
 return await codeDigest(code,settings.salt,settings.iterations)===settings.digest;
}
function entryClouds(){
 const sky=document.createElement('div');sky.className='entry-sky';sky.setAttribute('aria-hidden','true');
 const positions=[[-12,76,94,-21],[9,58,123,-68],[30,92,151,-47],[52,66,112,-83],[72,84,143,-110],[91,70,104,-39]];
 sky.innerHTML='<div class="entry-sky-glow"></div>'+positions.map(([top,width,duration,delay],i)=>{
  const puffs=Array.from({length:13},(_,j)=>{
   const x=35+j*31,y=70+Math.sin(j*1.71+i)*19,rx=36+(j*7+i*11)%23,ry=22+(j*13+i*3)%20;
   return `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="${j%3===0?'#638c73':'#365e51'}" opacity="${.25+(j%4)*.1}"/>`;
  }).join('');
  return `<div class="entry-cloud" style="--cloud-top:${top}%;--cloud-width:${width}vw;--cloud-speed:${duration}s;--cloud-delay:${delay}s;--cloud-light:${17+i*4}s"><svg viewBox="0 0 460 160" focusable="false"><defs><filter id="entry-mist-${i}" x="-20%" y="-60%" width="140%" height="220%"><feGaussianBlur stdDeviation="7"/></filter></defs><g filter="url(#entry-mist-${i})">${puffs}</g><path class="entry-cloud-light" d="M135 85 L159 102 L151 112 L177 139 M158 103 L179 105 L192 123" fill="none" stroke="#bde4d0" stroke-width="1.2"/></svg></div>`;
 }).join('');
 return sky;
}
export async function requireUniversalCode({checkUpdates}={}){
 if(!config.enabled){document.body.removeAttribute('data-locked');return;}
 document.body.setAttribute('data-locked','');
 const gate=document.createElement('section');gate.id='entry-gate';gate.setAttribute('aria-label','Open Space Studio');
 gate.innerHTML='<form class="entry-card"><div class="entry-brand"><button type="button" id="owner-entry" aria-label="Owner settings">LW</button> <span>SPACE STUDIO</span></div><h1>Let’s build something.</h1><p>Enter the shared access code to open Space Studio.</p><label for="entry-code">Access code</label><input id="entry-code" type="password" autocomplete="off" maxlength="128" required autofocus><label class="entry-reveal"><input type="checkbox" id="entry-reveal"> Show code</label><button type="submit" class="primary">Open Space Studio</button><p id="entry-message" role="status"></p><button type="button" id="entry-update">Check for updates</button><small>Your projects stay on this device. Ask the person who shared the app for the code.</small></form>';
 gate.prepend(entryClouds());
 document.body.append(gate);
 const form=gate.querySelector('form'),input=gate.querySelector('#entry-code'),button=gate.querySelector('button[type=submit]'),message=gate.querySelector('#entry-message');
 gate.querySelector('#owner-entry').onclick=()=>{input.value='';openOwnerPanel(gate);};
 gate.querySelector('#entry-reveal').onchange=e=>{input.type=e.target.checked?'text':'password';};
 const update=gate.querySelector('#entry-update');update.hidden=!checkUpdates;
 update.onclick=async()=>{update.disabled=true;message.textContent='Checking the current app version…';try{if(await checkUpdates())message.textContent='You have the latest app version. Enter your code to continue.';}catch{message.textContent='Reconnect to check for updates.';}finally{update.disabled=false;}};
 input.focus();
 await new Promise(resolve=>{form.onsubmit=async e=>{
  e.preventDefault();if(button.disabled)return;button.disabled=true;message.textContent='Checking code…';
  try{
   if(!(hasCodeService()?await verifyBuilderCode(input.value):await matchesCode(input.value))){message.textContent='That code doesn’t match. Please try again.';input.select();return;}
   input.value='';gate.remove();document.body.removeAttribute('data-locked');resolve();
  }catch(e){message.textContent=hasCodeService()?'Unable to contact the code service. Reconnect and try again.':'Unable to check the code. Open the app in an up-to-date browser over HTTPS.';}
  finally{button.disabled=false;}
 };});
}
