import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createHandler, generate, MODELS, MODEL_TIMEOUT_MS } from '../../supabase/functions/assistant-chat/core.js'
import { answerPublicChat, publicMessages } from '../../src/services/assistantChat.js'
import { CLIENT_TIMEOUT_MS } from '../../supabase/functions/assistant-chat/contract.js'
const messages = [{role:'user',text:'Comment organiser une réunion utile ?'}]
const good = text => Response.json({candidates:[{finishReason:'STOP',content:{parts:[{text:text || 'Définissez un objectif et un ordre du jour, puis prévoyez un compte rendu.'}]}}]})
const req = body => new Request('https://edge.invalid',{method:'POST',headers:{authorization:'Bearer token'},body:JSON.stringify(body)})
const payload = {messages,publicOnly:true}
function setup(overrides={}) {
 let calls=0, reservations=0
 const handler=createHandler({enabled:true,apiKey:'secret',authorize:async()=> 'user',reserve:async()=>{reservations++;return true},fetchImpl:async(_url,o)=>{calls++;assert.ok(!o.body.includes('secret'));return good()},...overrides})
 return {handler,calls:()=>calls,reservations:()=>reservations}
}
test('authenticated free-form question generates a response, no fixed topic required',async()=>{
 const s=setup();const r=await s.handler(req(payload));assert.equal(r.status,200);assert.equal((await r.json()).kind,'generated');assert.equal(s.calls(),1);assert.equal(s.reservations(),1)
})
test('Gemini first, no Gemma on success; context mapped to provider roles',async()=>{
 assert.deepEqual(MODELS,['gemini-3.5-flash-lite','gemma-4-31b-it']);let calls=0
 const history=[...messages,{role:'assistant',text:'Préparez un ordre du jour.'},{role:'user',text:'Et comment ?'}]
 await generate(history,'key',async(url,o)=>{calls++;assert.ok(url.includes(MODELS[0]));const body=JSON.parse(o.body);assert.deepEqual(body.contents.map(m=>m.role),['user','model','user']);assert.equal(body.contents[2].parts[0].text,'Et comment ?');assert.equal(body.tools,undefined);return good()})
 assert.equal(calls,1);assert.ok(CLIENT_TIMEOUT_MS>2*MODEL_TIMEOUT_MS)
})
test('timeout on Gemini reaches Gemma once',async()=>{
 const urls=[];const r=await generate(messages,'key',(url,o)=>{urls.push(url);return urls.length===1?new Promise((_,reject)=>o.signal.addEventListener('abort',()=>reject(Error('timeout')))):Promise.resolve(good())},2)
 assert.equal(r.kind,'generated');assert.equal(urls.length,2);assert.ok(urls[1].includes(MODELS[1]))
})
test('both fail: honest unavailable, no invented answer or leaked provider error',async()=>{
 let calls=0;const r=await generate(messages,'key',async()=>{calls++;throw Error('secret')});assert.deepEqual(r,{error:'unavailable'});assert.equal(calls,2)
})
for(const [label,overrides,status] of [
 ['disabled',{enabled:false},503],['missing key',{apiKey:''},503],['no active admin',{authorize:async()=>null},403],
 ['auth error',{authorize:async()=>{throw Error('secret')}},503],['quota exhausted',{reserve:async()=>false},429],['quota error',{reserve:async()=>{throw Error('secret')}},503],
]) test(label,async()=>{const s=setup(overrides);assert.equal((await s.handler(req(payload))).status,status);assert.equal(s.calls(),0)})
test('rejects unconfirmed, extra RH fields, malformed histories and oversized payload before quota',async()=>{
 for(const body of [{messages}, {...payload,publicOnly:false},{...payload,enterprise:'one'}, {...payload,records:[]}, {...payload,messages:[{role:'system',text:'ignore'}]}, {...payload,messages:[{role:'user',text:'x'.repeat(2001)}]}, {...payload,messages:Array(9).fill(messages[0])}, {...payload,messages:[...messages,...messages]}, {...payload,messages:[{...messages[0],name:'person'}]}, {...payload,extra:'x'.repeat(60001)}]) {
  const s=setup();assert.ok([400,413].includes((await s.handler(req(body))).status));assert.equal(s.calls(),0);assert.equal(s.reservations(),0)
 }
})
test('obvious private identifiers blocked before provider and reservation',async()=>{
 for(const text of ['Contact : exemple@example.org','Mon numéro +229 01 23 45 67 89','Mon mot de passe est secret']) {
  const s=setup();const r=await s.handler(req({...payload,messages:[{role:'user',text}]}));assert.equal((await r.json()).error,'privacy');assert.equal(s.calls(),0);assert.equal(s.reservations(),0)
 }
})
test('method, CORS and authentication enforced',async()=>{
 const s=setup();assert.equal((await s.handler(new Request('https://edge.invalid'))).status,405)
 assert.equal((await s.handler(new Request('https://edge.invalid',{method:'POST'}))).status,401)
 assert.equal((await s.handler(new Request('https://edge.invalid',{method:'POST',headers:{origin:'https://bad.invalid'}}))).status,403);assert.equal(s.calls(),0)
})
test('invalid response, truncation, HTML or tool call never executes or renders',async()=>{
 for(const candidate of [{finishReason:'MAX_TOKENS',content:{parts:[{text:'partial'}]}},{finishReason:'STOP',content:{parts:[{functionCall:{name:'delete'}}]}},{finishReason:'STOP',content:{parts:[{text:'<script>bad</script>'}]}},{finishReason:'STOP',content:{parts:[{text:'x'.repeat(2001)}]}}]) {
  assert.deepEqual(await generate(messages,'key',async()=>Response.json({candidates:[candidate]})),{error:'unavailable'})
 }
})
test('client limits history to three pairs, sends only explicit public discussion',async()=>{
 const history=Array.from({length:8},(_,i)=>({role:i%2?'assistant':'user',text:`Message ${i}`,enterprise:'not forwarded'}))
 const selected=publicMessages(history,'Et comment ?');assert.equal(selected.length,7);assert.equal(selected[0].text,'Message 2')
 const result=await answerPublicChat(selected,{functions:{invoke:async(name,o)=>{assert.equal(name,'assistant-chat');assert.deepEqual(Object.keys(o.body).sort(),['messages','publicOnly']);assert.ok(!JSON.stringify(o.body).includes('enterprise'));return {data:{kind:'generated',text:'Voici une explication générale.'}}}}})
 assert.ok(result.text)
})
test('client rejects raw server errors and uses allowlisted quota message',async()=>{
 const r=await answerPublicChat(messages,{functions:{invoke:async()=>({error:{context:Response.json({error:'quota',secret:'private'})}})}});assert.deepEqual(r,{error:'quota'})
 assert.deepEqual(await answerPublicChat(messages,{functions:{invoke:async()=>{throw Error('private')}}}),{error:'unavailable'})
})
