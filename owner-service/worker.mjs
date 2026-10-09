const SCHEMA=["CREATE TABLE IF NOT EXISTS builder_code (id INTEGER PRIMARY KEY CHECK(id=1), salt TEXT NOT NULL, digest TEXT NOT NULL)","CREATE TABLE IF NOT EXISTS owner_sessions (token TEXT PRIMARY KEY, expires INTEGER NOT NULL, master TEXT NOT NULL)","CREATE INDEX IF NOT EXISTS owner_sessions_expiry ON owner_sessions(expires)","CREATE TABLE IF NOT EXISTS access_limits (key TEXT NOT NULL, bucket INTEGER NOT NULL, attempts INTEGER NOT NULL, PRIMARY KEY(key,bucket))","CREATE INDEX IF NOT EXISTS access_limits_bucket ON access_limits(bucket)"];
const INITIAL_CODE={"salt":"ca36f5bf-5a42-47e3-9c54-f6d8c8a633fd","digest":"7d1893bc16e6f20a73455d2b81771ffc984afcaa70eb3398617bd5f7dd280f76"};
const initialized=new WeakMap();
async function initialize(db){if(!initialized.has(db)){const job=db.batch([...SCHEMA.map(sql=>db.prepare(sql)),db.prepare("INSERT OR IGNORE INTO builder_code (id,salt,digest) VALUES (1,?,?)").bind(INITIAL_CODE.salt,INITIAL_CODE.digest)]).catch(e=>{initialized.delete(db);throw e;});initialized.set(db,job);}await initialized.get(db);}
const encoder=new TextEncoder();
const hex=bytes=>Array.from(new Uint8Array(bytes),n=>n.toString(16).padStart(2,'0')).join('');
const digest=async text=>hex(await crypto.subtle.digest('SHA-256',encoder.encode(text)));
const random=()=>hex(crypto.getRandomValues(new Uint8Array(32)));
const equal=(a,b)=>{if(a.length!==b.length)return false;let diff=0;for(let i=0;i<a.length;i++)diff|=a.charCodeAt(i)^b.charCodeAt(i);return diff===0;};
export async function codeHash(code,salt){const key=await crypto.subtle.importKey('raw',encoder.encode(code.trim()),'PBKDF2',false,['deriveBits']);return hex(await crypto.subtle.deriveBits({name:'PBKDF2',hash:'SHA-256',salt:encoder.encode(salt),iterations:100000},key,256));}
export async function handle(request,env,now=Date.now()){
 const origin=request.headers.get('Origin'),allowed=(env.ALLOWED_ORIGINS||'https://monicalittleworlds.github.io').split(',').map(s=>s.trim());
 const headers={'Content-Type':'application/json','Cache-Control':'no-store','Vary':'Origin','X-Content-Type-Options':'nosniff'};
 const reply=(status,body)=>new Response(JSON.stringify(body),{status,headers});
 if(!origin||!allowed.includes(origin))return reply(403,{error:'This app origin is not allowed.'});
 headers['Access-Control-Allow-Origin']=origin;headers['Access-Control-Allow-Methods']='POST, OPTIONS';headers['Access-Control-Allow-Headers']='Content-Type, Authorization';
 if(request.method==='OPTIONS')return new Response(null,{status:204,headers});
 if(request.method!=='POST')return reply(405,{error:'Use POST.'});
 const path=new URL(request.url).pathname.replace(/\/$/,'');
 if(!['/owner/login','/owner/logout','/owner/code','/access/verify'].includes(path))return reply(404,{error:'Not found.'});
 if(!env.DB||!env.MASTER_CODE||env.MASTER_CODE.length<12)return reply(503,{error:'The owner service is not configured yet.'});
 if(!request.headers.get('Content-Type')?.startsWith('application/json'))return reply(415,{error:'Use JSON.'});
 if(+(request.headers.get('Content-Length')||0)>2048)return reply(413,{error:'Request too large.'});
 try{
  const reader=request.body?.getReader();if(!reader)return reply(400,{error:'Missing request.'});let size=0,raw='';const decoder=new TextDecoder();
  for(;;){const {value,done}=await reader.read();if(done)break;size+=value.length;if(size>2048){await reader.cancel();return reply(413,{error:'Request too large.'});}raw+=decoder.decode(value,{stream:true});}raw+=decoder.decode();
  let body;try{body=JSON.parse(raw);}catch{return reply(400,{error:'Invalid JSON.'});}if(!body||typeof body!=='object'||Array.isArray(body))return reply(400,{error:'Invalid request.'});
  await initialize(env.DB);
  const db=env.DB,masterDigest=await digest(env.MASTER_CODE),ip=await digest((request.headers.get('CF-Connecting-IP')||'unknown')+masterDigest),bucket=Math.floor(now/900000),action=path.startsWith('/owner/')?'owner':'builder';
  const rate=await db.prepare('INSERT INTO access_limits (key, bucket, attempts) VALUES (?, ?, 1) ON CONFLICT(key, bucket) DO UPDATE SET attempts=attempts+1 RETURNING attempts').bind(action+':'+ip,bucket).first();
  if(rate.attempts>(action==='owner'?15:60))return reply(429,{error:'Too many attempts. Please wait 15 minutes and try again.'});
  await db.prepare('DELETE FROM access_limits WHERE bucket < ?').bind(bucket-1).run();
  await db.prepare('DELETE FROM owner_sessions WHERE expires <= ?').bind(now).run();
  const code=typeof body.code==='string'?body.code.trim():'';
  if(path==='/owner/login'){
   if(!code||code.length>128||!equal(await digest(code),masterDigest))return reply(401,{error:'That master code does not match.'});
   const token=random();await db.prepare('INSERT INTO owner_sessions (token, expires, master) VALUES (?, ?, ?)').bind(await digest(token),now+900000,masterDigest).run();
   return reply(200,{token,expiresIn:900});
  }
  if(path==='/access/verify'){
   if(!code||code.length>128)return reply(200,{valid:false});
   const settings=await db.prepare('SELECT salt, digest FROM builder_code WHERE id = 1').first();if(!settings)return reply(503,{error:'The builder code is not configured yet.'});
   return reply(200,{valid:equal(await codeHash(code,settings.salt),settings.digest)});
  }
  const bearer=request.headers.get('Authorization')||'',token=bearer.startsWith('Bearer ')?bearer.slice(7):'';
  if(!/^[a-f0-9]{64}$/.test(token))return reply(401,{error:'Owner login required.'});
  const tokenDigest=await digest(token),session=await db.prepare('SELECT expires, master FROM owner_sessions WHERE token = ?').bind(tokenDigest).first();
  if(!session||session.expires<=now||!equal(session.master,masterDigest))return reply(401,{error:'Owner session expired. Log in again.'});
  if(path==='/owner/logout'){await db.prepare('DELETE FROM owner_sessions WHERE token = ?').bind(tokenDigest).run();return reply(200,{ok:true});}
  if(code.length<4||code.length>128)return reply(400,{error:'Use 4–128 characters for the builder code.'});
  if(equal(await digest(code),masterDigest))return reply(400,{error:'The builder code must be different from the master code.'});
  const salt=random(),hash=await codeHash(code,salt);
  await db.batch([
   db.prepare('INSERT INTO builder_code (id, salt, digest) VALUES (1, ?, ?) ON CONFLICT(id) DO UPDATE SET salt=excluded.salt,digest=excluded.digest').bind(salt,hash),
   db.prepare('DELETE FROM owner_sessions')
  ]);
  return reply(200,{saved:true});
 }catch{return reply(503,{error:'The code service is unavailable. Please try again shortly.'});}
}
export default {fetch(request,env){return handle(request,env);}};
