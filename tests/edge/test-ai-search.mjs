import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createHandler, testModel, MODELS, PROMPT } from '../../supabase/functions/test-ai-search/core.js'
const text = '{"intent":"rechercher_pointages","filters":{"sortie":"presumee","decision":"en_attente","periode":"semaine_courante"}}'
const good = () => Response.json({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text }] } }], usageMetadata: { promptTokenCount: 100 } })
const request = (body = { action: 'test' }, extra = {}) => new Request('https://test.invalid', {
 method: 'POST', headers: { Authorization: 'Bearer session', 'Content-Type':'application/json', ...extra }, body: JSON.stringify(body),
})
function setup(overrides = {}) {
 let calls = 0, reservations = 0
 const handler = createHandler({ enabled:true, apiKey:'secret-not-for-output',
 authorize:async()=>true, reserve:async()=>{ reservations++;return {allowed:true,remaining:2} },
 fetchImpl:async(url, options)=>{
   calls++
   assert.ok(MODELS.some(m=>url.endsWith(`${m}:generateContent`)))
   assert.ok(!url.includes('secret-not-for-output'))
   const payload=JSON.parse(options.body)
   assert.equal(payload.contents[0].parts[0].text,PROMPT)
   assert.equal(payload.tools,undefined)
   assert.equal(payload.generationConfig.maxOutputTokens,256)
   return good()
 }, ...overrides })
 return { handler, calls:()=>calls, reservations:()=>reservations }
}
test('two fixed synthetic calls, no key or raw prompt returned',async()=>{
 const s=setup();const response=await s.handler(request());const result=await response.json()
 assert.equal(response.status,200);assert.equal(result.ok,true);assert.equal(s.calls(),2)
 assert.equal(result.results.length,2);assert.equal(result.runs_remaining,2)
 assert.ok(!JSON.stringify(result).includes('secret-not-for-output'))
})
for (const [name, overrides, status] of [
 ['disabled',{enabled:false},503], ['non-admin',{authorize:async()=>false},403],
 ['auth outage',{authorize:async()=>{throw Error('sensitive')}},503],
 ['no secret',{apiKey:''},503], ['daily limit',{reserve:async()=>({allowed:false})},429],
 ['quota outage',{reserve:async()=>{throw Error('sensitive')}},503],
]) test(name, async()=>{const s=setup(overrides);const r=await s.handler(request());assert.equal(r.status,status);assert.equal(s.calls(),0);assert.ok(!(await r.text()).includes('sensitive'))})
test('missing auth rejected before authorization and quota',async()=>{
 const s=setup();const r=await s.handler(new Request('https://test.invalid',{method:'POST',body:'{}'}))
 assert.equal(r.status,401);assert.equal(s.reservations(),0)
})
test('client prompt / model / oversized payload never reaches provider',async()=>{
 for(const body of [{action:'test',prompt:'personal data'},{action:'test',model:'other'},{action:'x'.repeat(200)}]){
  const s=setup();const r=await s.handler(request(body));assert.ok([400,413].includes(r.status));assert.equal(s.calls(),0);assert.equal(s.reservations(),0)
 }
})
test('CORS allowlist, preflight, method restriction',async()=>{
 const s=setup({allowedOrigins:['https://admin.example']})
 assert.equal((await s.handler(request({action:'test'},{origin:'https://evil.example'}))).status,403)
 const r=await s.handler(new Request('https://test.invalid',{method:'OPTIONS',headers:{origin:'https://admin.example'}}))
 assert.equal(r.status,204);assert.equal(r.headers.get('access-control-allow-origin'),'https://admin.example')
 assert.equal((await s.handler(new Request('https://test.invalid'))).status,405)
 assert.equal(s.calls(),0)
})
test('provider errors are redacted and not retried',async()=>{
 let calls=0
 const r=await testModel(MODELS[0],'key',async()=>{calls++;return new Response('secret provider error',{status:429})})
 assert.equal(r.code,'quota_provider');assert.equal(calls,1);assert.ok(!JSON.stringify(r).includes('secret'))
})
test('malformed, truncated, tool calls and extra result fields are rejected',async()=>{
 for(const candidate of [
 {finishReason:'MAX_TOKENS',content:{parts:[{text}]}},
 {finishReason:'STOP',content:{parts:[{functionCall:{name:'delete'}}]}},
 {finishReason:'STOP',content:{parts:[{text:'not JSON'}]}},
 {finishReason:'STOP',content:{parts:[{text:text.replace('"intent":','"employees":["fake"],"intent":')}]}},
 ]){
  const r=await testModel(MODELS[0],'key',async()=>Response.json({candidates:[candidate]}))
  assert.equal(r.interpretation_valid,false);assert.equal(r.interpretation,null)
 }
})
test('timeout aborts the call',async()=>{
 const r=await testModel(MODELS[0],'key',(_,options)=>new Promise((_,reject)=>{
   options.signal.addEventListener('abort',()=>reject(Error('abort')))
 }),5)
 assert.equal(r.code,'provider_timeout')
})
