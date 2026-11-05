const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const html=fs.readFileSync(require('node:path').join(__dirname,'../index.html'),'utf8');
const block=html.split('// Thursday seasonal ad:')[1].split('// End Thursday seasonal ad.')[0];
const code='// Thursday seasonal ad:'+block;
function setup(iso='2026-11-05T04:00:00Z',saved=new Map()){
 const events=[];let value='',timers=[];
 const host={get innerHTML(){return value},set innerHTML(v){value=v;if(v)events.push(v.includes('疯狂星期四限定彩蛋')?'thursday':'regular')},get children(){return value?[{}]:[]}};
 class Clock extends Date{constructor(...args){super(...(args.length?args:[iso]))}}
 const ctx=vm.createContext({Date:Clock,screen:'ending',localStorage:{getItem:k=>saved.get(k)||null,setItem:(k,v)=>saved.set(k,v)},document:{getElementById:()=>host},setTimeout:fn=>(timers.push(fn),timers.length),clearTimeout:()=>{timers=[]},showAd:()=>{host.innerHTML='regular'}});
 vm.runInContext(code,ctx);
 return {ctx,host,events,saved,flush(){const pending=timers;timers=[];pending.forEach(fn=>fn())},close(){host.innerHTML='';ctx.showNextEndingAd()}};
}
test('Shanghai Thursday boundaries and only one claim until next Thursday',()=>{
 const {ctx}=setup();
 assert.equal(ctx.claimThursdayAd(new Date('2026-11-04T15:59:59Z')),false);
 assert.equal(ctx.claimThursdayAd(new Date('2026-11-04T16:00:00Z')),true);
 assert.equal(ctx.claimThursdayAd(new Date('2026-11-05T15:59:59Z')),false);
 assert.equal(ctx.claimThursdayAd(new Date('2026-11-05T16:00:00Z')),false);
 assert.equal(ctx.claimThursdayAd(new Date('2026-11-11T16:00:00Z')),true);
});
test('first ending only, persists across reload, ordinary five-game ad preserved',()=>{
 const a=setup();a.ctx.scheduleEndingAds(true);a.flush();
 assert.deepEqual(a.events,['thursday']);a.close();assert.deepEqual(a.events,['thursday','regular']);a.close();
 a.ctx.scheduleEndingAds(false);a.flush();assert.equal(a.events.length,2);
 const b=setup(undefined,a.saved);b.ctx.scheduleEndingAds(false);b.flush();assert.deepEqual(b.events,[]);
 b.ctx.scheduleEndingAds(true);b.flush();assert.deepEqual(b.events,['regular']);
});
test('other days keep only the normal advertisement',()=>{
 const a=setup('2026-11-06T04:00:00Z');a.ctx.scheduleEndingAds(true);a.flush();assert.deepEqual(a.events,['regular']);assert.equal(a.saved.size,0);
});
test('leaving ending before display does not consume weekly allowance',()=>{
 const a=setup();a.ctx.scheduleEndingAds(false);a.ctx.screen='home';a.flush();assert.equal(a.saved.size,0);assert.deepEqual(a.events,[]);
});
test('another modal is not overwritten; seasonal ad waits until it closes',()=>{
 const a=setup();a.host.innerHTML='CG';a.events.length=0;a.ctx.scheduleEndingAds(false);a.flush();assert.equal(a.saved.size,0);a.close();assert.deepEqual(a.events,['thursday']);
});
test('unavailable persistent storage never causes repeated popups',()=>{
 const a=setup();a.ctx.localStorage={getItem(){throw Error('blocked')}};a.ctx.scheduleEndingAds(false);a.flush();assert.deepEqual(a.events,[]);
});
