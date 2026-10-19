import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createHandler, explain, MODELS } from '../../supabase/functions/assistant-explain/core.js'
import { answerExplanation } from '../../src/services/assistantExplanation.js'
const text = 'Une sortie présumée est une estimation, pas un badge réel. Elle doit être examinée avant une décision.'
const good = () => Response.json({candidates:[{finishReason:'STOP',content:{parts:[{text:JSON.stringify({explanation:text})}]}}]})
const request = body => new Request('https://edge.invalid',{method:'POST',headers:{authorization:'Bearer session'},body:JSON.stringify(body)})
function setup(overrides={}) {
 let calls=0,reserved=0
 const handler=createHandler({enabled:true,apiKey:'secret',authorize:async()=> 'user',reserve:async()=>{reserved++;return true},fetchImpl:async(_,o)=>{calls++;assert.ok(!o.body.includes('session'));return good()},...overrides})
 return {handler,calls:()=>calls,reserved:()=>reserved}
}
test('one primary call on success, fixed documentation only',async()=>{
 const s=setup(); const r=await s.handler(request({topic:'presumed_exit'}));assert.equal((await r.json()).kind,'generated');assert.equal(s.calls(),1);assert.equal(s.reserved(),1)
})
test('primary unavailable then second model, at most two calls',async()=>{
 const urls=[];const r=await explain('lateness','key',async url=>{urls.push(url);return urls.length===1?new Response('',{status:429}):good()})
 assert.equal(r.kind,'generated');assert.equal(urls.length,2);assert.ok(urls[0].includes(MODELS[0]));assert.ok(urls[1].includes(MODELS[1]))
})
test('both fail, safe reference without raw error',async()=>{
 let calls=0;const r=await explain('lateness','secret',async()=>{calls++;throw Error('private')})
 assert.equal(r.kind,'reference');assert.equal(calls,2);assert.ok(!JSON.stringify(r).includes('private'))
})
test('invalid model JSON falls back',async()=>{
 const r=await explain('lateness','secret',async()=>Response.json({candidates:[{finishReason:'STOP',content:{parts:[{text:'{"tool":"read_all"}'}]}}]}))
 assert.equal(r.kind,'reference')
})
test('timeouts bounded, no automatic infinite retry',async()=>{
 let calls=0;const r=await explain('lateness','key',(_,o)=>new Promise((_,reject)=>{calls++;o.signal.addEventListener('abort',()=>reject(Error('timeout')))}),2)
 assert.equal(calls,2);assert.equal(r.kind,'reference')
})
for(const [label,overrides,status] of [
 ['disabled',{enabled:false},200],['no key',{apiKey:''},200],['quota exhausted',{reserve:async()=>false},200],
 ['quota unavailable',{reserve:async()=>{throw Error('private')}},200],['no active admin',{authorize:async()=>null},403],
]) test(label,async()=>{const s=setup(overrides);const r=await s.handler(request({topic:'lateness'}));assert.equal(r.status,status);assert.equal(s.calls(),0)})
test('free text, employee, enterprise, unknown topics, extra fields rejected before reservation',async()=>{
 for(const body of [{topic:'lateness',query:'private'}, {topic:'lateness',enterprise:'id'},{topic:'private'}, {topic:'constructor'}, {query:'x'.repeat(200)}]) {
  const s=setup();const r=await s.handler(request(body));assert.ok([400,413].includes(r.status));assert.equal(s.calls(),0);assert.equal(s.reserved(),0)
 }
})
test('method, session and CORS block provider access',async()=>{
 const s=setup();assert.equal((await s.handler(new Request('https://edge.invalid'))).status,405)
 assert.equal((await s.handler(new Request('https://edge.invalid',{method:'POST'}))).status,401)
 assert.equal((await s.handler(new Request('https://edge.invalid',{method:'POST',headers:{origin:'https://bad.invalid'}}))).status,403)
 assert.equal(s.calls(),0)
})
test('client transmits only topic, never original query',async()=>{
 let calls=0;const client={functions:{invoke:async(name,options)=>{calls++;assert.equal(name,'assistant-explain');assert.deepEqual(options.body,{topic:'presumed_exit'});return {data:{kind:'generated',topic:'presumed_exit',text}}}}}
 assert.ok((await answerExplanation("Qu'est-ce qu'une sortie présumée ?",client)).source.includes('IA'))
 assert.equal(await answerExplanation('Explique une sortie présumée de Sara',client),null)
 assert.equal(await answerExplanation('Sara gagne 200000',client),null);assert.equal(calls,1)
})
test('undeployed function or network failure keeps reference usable',async()=>{
 const r=await answerExplanation('Explique les retards',{functions:{invoke:async()=>{throw Error('secret')}}})
 assert.ok(r.source.startsWith('Référence'));assert.ok(!JSON.stringify(r).includes('secret'))
})
