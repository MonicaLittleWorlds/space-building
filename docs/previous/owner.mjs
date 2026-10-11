import config from './owner-config.mjs';
export async function ownerRequest(path,body,token='',apiBase=config.apiBase,request=fetch){
 if(!apiBase)throw Error('Owner settings are not connected yet. The online code service needs to be set up first.');
 const base=new URL(apiBase);if(base.protocol!=='https:'&&!['127.0.0.1','localhost'].includes(base.hostname))throw Error('The code service must use HTTPS.');
 const response=await request(new URL(path,base.href.endsWith('/')?base.href:base.href+'/'),{method:'POST',cache:'no-store',credentials:'omit',headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:JSON.stringify(body),signal:AbortSignal.timeout(15000)});
 const result=await response.json();if(!response.ok)throw Error(result.error||'The request failed. Please try again.');return result;
}
export async function verifyBuilderCode(code){return (await ownerRequest('access/verify',{code})).valid===true;}
export function hasCodeService(settings=config){return !!settings.apiBase;}
export function openOwnerPanel(gate){
 if(gate.querySelector('#owner-panel'))return;
 const form=gate.querySelector('.entry-card');form.hidden=true;
 const panel=document.createElement('form');panel.id='owner-panel';panel.className='entry-card';panel.setAttribute('aria-label','Owner settings');
 panel.innerHTML='<div class="entry-brand">LW <span>OWNER SETTINGS</span></div><h1>Owner access</h1><p id="owner-help">Enter your master code to manage the shared builder code.</p><div id="owner-login-fields"><label for="owner-master">Master code</label><input id="owner-master" type="password" autocomplete="current-password" maxlength="128" required></div><div id="owner-change-fields" hidden><label for="owner-new">New builder code</label><input id="owner-new" type="password" autocomplete="new-password" minlength="4" maxlength="128"><label for="owner-confirm">Confirm builder code</label><input id="owner-confirm" type="password" autocomplete="new-password" minlength="4" maxlength="128"></div><button class="primary" type="submit" id="owner-submit">Unlock owner settings</button><p id="owner-message" role="status"></p><button type="button" id="owner-back">Back to builder login</button><small>The master code is separate from the shared builder code.</small>';
 gate.append(panel);let token='',expiry=null,busy=false;
 const message=panel.querySelector('#owner-message'),master=panel.querySelector('#owner-master'),submit=panel.querySelector('#owner-submit');
 const close=()=>{if(busy)return;clearTimeout(expiry);if(token)ownerRequest('owner/logout',{},token).catch(()=>{});token='';panel.reset();panel.remove();form.hidden=false;form.querySelector('#entry-code').focus();};
 panel.querySelector('#owner-back').onclick=close;
 if(!hasCodeService()){master.disabled=true;submit.disabled=true;message.textContent='Owner settings are not connected yet. The online code service must be set up before a master code can work.';}
 else master.focus();
 panel.onsubmit=async e=>{
  e.preventDefault();if(busy)return;busy=true;submit.disabled=true;message.textContent='Checking…';
  try{
   if(!token){
    const result=await ownerRequest('owner/login',{code:master.value});master.value='';token=result.token;if(typeof token!=='string'||!token)throw Error('Invalid owner session response.');
    panel.querySelector('#owner-login-fields').hidden=true;master.required=false;panel.querySelector('#owner-change-fields').hidden=false;
    for(const id of ['owner-new','owner-confirm'])panel.querySelector('#'+id).required=true;
    submit.textContent='Save shared code';message.textContent='Owner access unlocked for 15 minutes.';panel.querySelector('#owner-new').focus();
    expiry=setTimeout(()=>{token='';submit.disabled=true;panel.querySelector('#owner-change-fields').hidden=true;panel.reset();message.textContent='Owner session expired. Return to the builder login and open owner settings again.';},15*60*1000);
   }else{
    const code=panel.querySelector('#owner-new').value,confirm=panel.querySelector('#owner-confirm').value;
    if(code!==confirm)throw Error('The two builder codes do not match.');
    await ownerRequest('owner/code',{code},token);clearTimeout(expiry);token='';panel.reset();panel.querySelector('#owner-change-fields').hidden=true;submit.hidden=true;
    message.textContent='Shared code changed. Builders must use the new code the next time they log in. Projects have not been changed.';
   }
  }catch(e){master.value='';message.textContent=e.message;}
  finally{busy=false;submit.disabled=false;}
 };
}
