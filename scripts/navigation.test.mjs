import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { prefetchDestination, initializeNavigation, initializeDialogDisclosures } from '../assets/navigation.js';
const base='/bamboo-shampoo-demo',current=`https://rabenreiter1.github.io${base}/de/`;

test('navigation warming accepts only another localized document on this shop origin',()=>{
 assert.equal(prefetchDestination(`${base}/de/products/aloe/?format=refill#main`,current,base),`${current}products/aloe/?format=refill`);
 assert.equal(prefetchDestination(`${base}/en/story/`,current,base),`https://rabenreiter1.github.io${base}/en/story/`);
 assert.equal(prefetchDestination(`${base}/design/classic/en/products/argan/?format=refill`,current,base),`https://rabenreiter1.github.io${base}/design/classic/en/products/argan/?format=refill`);
 const classicBase=`${base}/design/classic`,classicCurrent=`https://rabenreiter1.github.io${classicBase}/de/`;
 assert.equal(prefetchDestination(`${classicBase}/en/story/`,classicCurrent,classicBase),`https://rabenreiter1.github.io${classicBase}/en/story/`);
 assert.equal(prefetchDestination(`${base}/en/story/`,classicCurrent,classicBase),null,'alternate prefetch stays inside its route base');
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


function disclosureHarness() {
 const attrs = () => new Map();
 const opener = id => ({attributes: attrs(), getAttribute: key => key === 'aria-controls' ? id : null,
  setAttribute(key, value) {this.attributes.set(key, value);}, focus() {throw new Error('Native focus must not be overridden');}});
 const menu = {tagName:'DIALOG',open:false,listeners:new Map(),addEventListener(name,fn){this.listeners.set(name,fn);},removeEventListener(name){this.listeners.delete(name);}};
 const bag = {...menu,listeners:new Map()};
 const menuButton=opener('menu-dialog'),bagButton=opener('bag-dialog'),secondBagButton=opener('bag-dialog');
 const missing=opener('missing');
 let callback,disconnected=false; const observed=[];
 class Observer {constructor(fn){callback=fn;} observe(target,options){observed.push({target,options});} disconnect(){disconnected=true;}}
 const doc={querySelectorAll:()=>[menuButton,bagButton,secondBagButton,missing],getElementById:id=>({'menu-dialog':menu,'bag-dialog':bag}[id])};
 const controller=initializeDialogDisclosures({document:doc,window:{MutationObserver:Observer}});
 return {menu,bag,menuButton,bagButton,secondBagButton,controller,observed,change:()=>callback(),disconnected:()=>disconnected};
}

test('menu and bag disclose independent native state, including repeated openers',()=>{
 const h=disclosureHarness();
 for(const opener of [h.menuButton,h.bagButton,h.secondBagButton])assert.equal(opener.attributes.get('aria-expanded'),'false');
 h.menu.open=true;h.change();
 assert.equal(h.menuButton.attributes.get('aria-expanded'),'true');
 assert.equal(h.bagButton.attributes.get('aria-expanded'),'false');
 h.bag.open=true;h.change();
 assert.equal(h.bagButton.attributes.get('aria-expanded'),'true');
 assert.equal(h.secondBagButton.attributes.get('aria-expanded'),'true');
 assert.equal(h.observed.length,2,'One observer subscription per dialog');
 assert.deepEqual(h.observed[0].options,{attributes:true,attributeFilter:['open']});
 h.controller.destroy();
});

test('native Escape or close resets disclosure without stealing restored focus and teardown removes observers',()=>{
 const h=disclosureHarness();h.menu.open=true;h.change();
 h.menu.open=false;h.menu.listeners.get('close')();
 assert.equal(h.menuButton.attributes.get('aria-expanded'),'false');
 h.controller.destroy();assert.equal(h.disconnected(),true);
 assert.equal(h.menu.listeners.size,0);assert.equal(h.bag.listeners.size,0);
});

test('both localized shop headers publish dialog ownership before JavaScript loads',()=>{
 const builder=fs.readFileSync(new URL('./shop-build.mjs',import.meta.url),'utf8');
 for(const [button,dialog]of [['bag','bag'],['menu','menu']]){
  assert.match(builder,new RegExp('class="'+button+'-button" data-open-'+button+' aria-haspopup="dialog" aria-controls="'+dialog+'-dialog" aria-expanded="false"'));
 }
});
