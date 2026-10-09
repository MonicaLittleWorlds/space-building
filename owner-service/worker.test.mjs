import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {handle,codeHash} from './worker.mjs';
const origin='https://monicalittleworlds.github.io';
function fixture(){const db=new DatabaseSync(':memory:');db.exec(readFileSync(new URL('./schema.sql',import.meta.url),'utf8'));const wrap=(sql,args=[])=>({bind(...values){return wrap(sql,values);},async first(){return db.prepare(sql).get(...args)||null;},async run(){return db.prepare(sql).run(...args);}});return {env:{MASTER_CODE:'test-only-master-value',DB:{prepare:wrap,async batch(statements){db.exec('BEGIN');try{for(const s of statements)await s.run();db.exec('COMMIT');}catch(e){db.exec('ROLLBACK');throw e;}}}},db};}
const req=(path,body={},token='',otherOrigin=origin)=>new Request('https://codes.test'+path,{method:'POST',headers:{Origin:otherOrigin,'Content-Type':'application/json','CF-Connecting-IP':'192.0.2.1',...(token?{Authorization:'Bearer '+token}:{})},body:JSON.stringify(body)});
test('only an authenticated owner can change the code, and old codes stop working',async()=>{
 const {env,db}=fixture();db.prepare('INSERT INTO builder_code VALUES (1,?,?)').run('seed',await codeHash('old-builder','seed'));
 assert.equal((await handle(req('/owner/code',{code:'new-builder'}),env)).status,401);
 assert.equal((await handle(req('/owner/login',{code:'wrong'}),env)).status,401);
 const login=await (await handle(req('/owner/login',{code:env.MASTER_CODE}),env)).json();
 assert.equal((await handle(req('/owner/code',{code:'new-builder'},login.token),env)).status,200);
 assert.deepEqual(await (await handle(req('/access/verify',{code:'old-builder'}),env)).json(),{valid:false});
 assert.deepEqual(await (await handle(req('/access/verify',{code:'new-builder'}),env)).json(),{valid:true});
 assert.equal((await handle(req('/owner/code',{code:'again-builder'},login.token),env)).status,401);
 const row=db.prepare('SELECT * FROM builder_code').get();assert.notEqual(row.digest,'new-builder');
});
test('expiry, origin restrictions, unconfigured service, and rate limits fail closed',async()=>{
 const {env}=fixture(),now=1800000000000;
 assert.equal((await handle(req('/owner/login',{code:env.MASTER_CODE},'','https://unrelated.test'),env)).status,403);
 assert.equal((await handle(req('/owner/login'),{})).status,503);
 const login=await (await handle(req('/owner/login',{code:env.MASTER_CODE}),env,now)).json();
 assert.equal((await handle(req('/owner/code',{code:'new-value'},login.token),env,now+900001)).status,401);
 for(let i=0;i<15;i++)await handle(req('/owner/login',{code:'incorrect'}),env,now+1800000);
 assert.equal((await handle(req('/owner/login',{code:env.MASTER_CODE}),env,now+1800000)).status,429);
});
