import test from 'node:test';
import assert from 'node:assert/strict';
import { prefetchDestination, initializeNavigation } from '../assets/navigation.js';
const base='/bamboo-shampoo-demo',current=`https://rabenreiter1.github.io${base}/de/`;

test('navigation warming accepts only another localized document on this shop origin',()=>{
 assert.equal(prefetchDestination(`${base}/de/products/aloe/?format=refill#main`,current,base),`${current}products/aloe/?format=refill`);
 assert.equal(prefetchDestination(`${base}/en/story/`,current,base),`https://rabenreiter1.github.io${base}/en/story/`);
 for(const href of ['#ritual',current,'https://example.com/de/shop/',`${base}/assets/app.js`,`${base}/assembly/`,'mailto:hello@example.com'])assert.equal(prefetchDestination(href,current,base),null,href);
});

function harness(connection={}){
 const listeners=new Map(),hints=[],closed=[];
 const doc={head:{append:hint=>hints.push(hint)},createElement:()=>({}),querySelectorAll:()=>[{close:()=>closed.push(true)}],addEventListener:(event,fn)=>listeners.set(event,fn),removeEventListener:event=>listeners.delete(event)};
 const win={navigator:{connection},location:new URL(current),addEventListener(){},removeEventListener(){}};
 const nav=initializeNavigation({base,document:doc,window:win,limit:2});
 const link=href=>({href,target:'',hasAttribute:()=>false});
 const send=(event,href,extra={})=>listeners.get(event)?.({target:{closest:()=>link(href)},button:0,...extra});
 return {nav,hints,closed,send,listeners};
}
test('intent warming is bounded, deduplicated and respects data-saving connections',()=>{
 const h=harness();
 for(const route of ['shop/','shop/','story/','refill/'])h.send('focusin',current+route);
 assert.deepEqual(h.hints.map(x=>x.href),[current+'shop/',current+'story/']);
 assert.ok(h.hints.every(x=>x.rel==='prefetch'&&x.as==='document'));
 for(const connection of [{saveData:true},{effectiveType:'2g'}]){const c=harness(connection);c.send('focusin',current+'shop/');assert.equal(c.hints.length,0);}
 h.nav.destroy();assert.equal(h.listeners.size,0);
});
test('native route changes close a drawer without intercepting history or modified clicks',()=>{
 const h=harness();
 h.send('click',current+'shop/',{ctrlKey:true});h.send('click',current+'#ritual');h.send('click','https://example.com');assert.equal(h.closed.length,0);
 let intercepted=false;h.send('click',current+'shop/',{preventDefault(){intercepted=true;}});
 assert.equal(h.closed.length,1);assert.equal(intercepted,false);h.nav.destroy();
});
