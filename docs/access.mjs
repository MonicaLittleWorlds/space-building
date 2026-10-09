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
export async function requireUniversalCode(){
 if(!config.enabled){document.body.removeAttribute('data-locked');return;}
 document.body.setAttribute('data-locked','');
 const gate=document.createElement('section');gate.id='entry-gate';gate.setAttribute('aria-label','Open Space Studio');
 gate.innerHTML='<form class="entry-card"><div class="entry-brand">LW <span>SPACE STUDIO</span></div><h1>Let’s build something.</h1><p>Enter the shared access code to open Space Studio.</p><label for="entry-code">Access code</label><input id="entry-code" type="password" autocomplete="off" maxlength="128" required autofocus><label class="entry-reveal"><input type="checkbox" id="entry-reveal"> Show code</label><button type="submit" class="primary">Open Space Studio</button><p id="entry-message" role="status"></p><small>Your projects stay on this device. Ask the person who shared the app for the code.</small></form>';
 document.body.append(gate);
 const form=gate.querySelector('form'),input=gate.querySelector('#entry-code'),button=gate.querySelector('button'),message=gate.querySelector('#entry-message');
 gate.querySelector('#entry-reveal').onchange=e=>{input.type=e.target.checked?'text':'password';};
 input.focus();
 await new Promise(resolve=>{form.onsubmit=async e=>{
  e.preventDefault();if(button.disabled)return;button.disabled=true;message.textContent='Checking code…';
  try{
   if(!await matchesCode(input.value)){message.textContent='That code doesn’t match. Please try again.';input.select();return;}
   input.value='';gate.remove();document.body.removeAttribute('data-locked');resolve();
  }catch{message.textContent='Unable to check the code. Open the app in an up-to-date browser over HTTPS.';}
  finally{button.disabled=false;}
 };});
}
