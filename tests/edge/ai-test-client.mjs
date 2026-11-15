import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { runAiSmokeTest, AI_TEST_MODELS } from '../../src/services/aiSmokeTest.js'
const good = () => ({ synthetic_test: true, runs_remaining: 2, results: AI_TEST_MODELS.map(model => ({model, code:'ok', connected:true, interpretation_valid:true})) })
function client(response, session = true) {
 let calls = 0
 return { auth: {getSession: async()=>({data:{session:session?{}:null}})}, functions: { invoke:async(name, options)=> {
  calls++; assert.equal(name,'test-ai-search'); assert.deepEqual(options.body,{action:'test'}); assert.ok(options.signal instanceof AbortSignal)
  return response
 }}, calls:()=>calls }
}
test('only the fixed action is sent using the existing session',async()=>{
 const c=client({data:good()});const r=await runAiSmokeTest(c)
 assert.equal(c.calls(),1);assert.equal(r.remaining,2);assert.ok(r.results.every(r=>r.success))
})
test('no session means no invocation',async()=>{
 const c=client(null,false);assert.equal((await runAiSmokeTest(c)).error,'authentication_required');assert.equal(c.calls(),0)
})
test('HTTP 200 alone is not a successful model test',async()=>{
 const data=good();data.results[1].interpretation_valid=false
 const r=await runAiSmokeTest(client({data}));assert.equal(r.results[0].success,true);assert.equal(r.results[1].success,false)
})
test('known errors and exhausted quota have safe messages; no retries',async()=>{
 for(const code of ['daily_test_limit','test_disabled','active_superadmin_required','origin_denied']) {
 const c=client({error:{context:Response.json({error:code})}})
 assert.equal((await runAiSmokeTest(c)).error,code);assert.equal(c.calls(),1)
 }
})
test('provider and network errors never reveal raw content',async()=>{
 for(const error of [{message:'secret'},{context:Response.json({error:'secret'})},{context:new Response('secret')}]) {
  const r=await runAiSmokeTest(client({error}));assert.equal(r.error,'network');assert.ok(!JSON.stringify(r).includes('secret'))
 }
})
test('unexpected model, duplicate model and malformed envelope rejected',async()=>{
 for(const data of [null,{}, {...good(),results:[]}, {...good(),results:[good().results[0],good().results[0]]}]) {
 assert.equal((await runAiSmokeTest(client({data}))).error,'unexpected_response')
 }
})
test('only normalized values survive, no arbitrary raw response or usage',async()=>{
 const data=good();data.raw='private';data.runs_remaining=300;data.results[0].interpretation={secret:'private'}
 const r=await runAiSmokeTest(client({data}));assert.equal(r.remaining,null);assert.ok(!JSON.stringify(r).includes('private'))
})
test('thrown transport exception is handled without leaking or retrying',async()=>{
 const c=client(null);c.functions.invoke=async()=>{throw Error('secret')}
 assert.deepEqual(await runAiSmokeTest(c),{error:'network'})
})
test('route/menu guard and explicit click only (source regression checks)',()=>{
 const app=readFileSync(new URL('../../src/App.jsx',import.meta.url),'utf8')
 assert.match(app, /path="\/test-ia" element=\{\s*<AdminRoute requireSuperAdmin>\s*<AiConnectionTest/)
 const menu=readFileSync(new URL('../../src/components/DashboardExperience.jsx',import.meta.url),'utf8')
 assert.match(menu,/path: '\/test-ia', show: isSuperAdmin/)
 const page=readFileSync(new URL('../../src/pages/AiConnectionTest.jsx',import.meta.url),'utf8')
 assert.ok(!page.includes('useEffect'))
 assert.match(page,/pending.current \|\| !acknowledged \|\| exhausted/)
 assert.match(page,/disabled=\{!acknowledged \|\| busy \|\| exhausted\}/)
 assert.match(page,/onClick=\{testConnection\}/)
})
