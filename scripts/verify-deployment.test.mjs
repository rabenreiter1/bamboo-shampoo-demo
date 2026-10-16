import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {createRuntimeRelease} from './runtime-release.mjs';
import {deploymentInventory,verifyDeployment} from './verify-deployment.mjs';

async function fixture(t){
 const temporary=await fs.mkdtemp(path.join(os.tmpdir(),'bamboo-deployment-'));
 t.after(async()=>{assert.ok(temporary.startsWith(path.join(os.tmpdir(),'bamboo-deployment-')));await fs.rm(temporary,{recursive:true,force:true});});
 const source=path.join(temporary,'source'),directory=path.join(temporary,'docs');
 await fs.mkdir(source,{recursive:true});await fs.writeFile(path.join(source,'app.js'),'export const version="reviewed";\n');
 const release=createRuntimeRelease({sourceRoot:source,outputRoot:directory,files:['app.js']});
 const runtimeBase='/bamboo-shampoo-demo'+release.baseSuffix;
 const html=`<!doctype html><html lang="de"><head><link href="/bamboo-shampoo-demo/assets/test.css" rel="stylesheet"></head><body><script type="application/json" id="ui-copy">${JSON.stringify({runtimeBase})}</script></body></html>`;
 for(const page of ['de/index.html','en/index.html','design/classic/de/index.html','404.html']){await fs.mkdir(path.dirname(path.join(directory,page)),{recursive:true});await fs.writeFile(path.join(directory,page),html);}
 return {directory,release};
}

test('deployment inventory discovers routes and every active immutable file without stale poster provenance',async t=>{
 const {directory,release}=await fixture(t),inventory=await deploymentInventory({directory});
 assert.equal(inventory.requests.filter(row=>row.kind==='page').length,4);
 assert.ok(inventory.requests.some(row=>row.file===release.baseSuffix.slice(1)+'/runtime-release.json'));
 for(const file of Object.keys(release.files))assert.ok(inventory.requests.some(row=>row.file===release.baseSuffix.slice(1)+'/'+file));
 assert.equal(inventory.requests.some(row=>row.file.includes('ritual-product-')),false);
});

test('delivery verification rejects a changed runtime byte and accepts an HTTP 404 document with matching content',async t=>{
 const {directory,release}=await fixture(t),inventory=await deploymentInventory({directory});
 for(const {file}of inventory.requests){
  const destination=path.join(directory,file);try{await fs.access(destination);continue;}catch{}
  await fs.mkdir(path.dirname(destination),{recursive:true});
  const source=file.startsWith('assembly/')?path.join('assets',file):file;
  let bytes;try{bytes=await fs.readFile(source);}catch{bytes=Buffer.from('fixture\n');}
  await fs.writeFile(destination,bytes);
 }
 let tampered=false;
 const fetcher=async url=>{
  const file=decodeURIComponent(url.pathname.slice('/bamboo-shampoo-demo/'.length));
  let bytes=await fs.readFile(path.join(directory,file));
  if(tampered&&file===release.baseSuffix.slice(1)+'/app.js')bytes=Buffer.concat([bytes,Buffer.from(' ')]);
  return new Response(bytes,{status:file==='404.html'?404:200});
 };
 const options={commit:'a'.repeat(40),directory,reportFile:null,fetcher};
 const accepted=await verifyDeployment(options);assert.equal(accepted.verified,true,JSON.stringify(accepted.failures));
 tampered=true;
 const rejected=await verifyDeployment(options);assert.equal(rejected.verified,false);assert.equal(rejected.failures.length,1);
 assert.equal(rejected.failures[0].file,release.baseSuffix.slice(1)+'/app.js');
});
