import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const digest=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const posterPattern=/^shop-(?:detail-product|guide-product|teaser-product|ritual-product)(?:-[a-z0-9-]+)?\.webp$/i;
const assemblyExtensions=new Set(['.js','.json','.svg','.jpg','.png','.webp']);

/** Content-addressed runtime tree. Existing releases are never rewritten or removed. */
export function createRuntimeRelease({sourceRoot='assets',outputRoot='docs',files:allowedModules}={}){
  const source=path.resolve(sourceRoot),entries=new Map();
  function collect(relative){
    const original=fs.readFileSync(path.join(source,relative));
    // Git's Windows checkout line endings must not change a release URL.
    const bytes=/\.(js|json)$/i.test(relative)?Buffer.from(original.toString('utf8').replaceAll('\r\n','\n')):original;
    entries.set(relative.replaceAll('\\','/'),bytes);
  }
  const modules=allowedModules??fs.readdirSync(source,{withFileTypes:true}).filter(entry=>entry.isFile()&&entry.name.endsWith('.js')).map(entry=>entry.name);
  for(const name of new Set(modules)){
    if(name==='product-scene.js')continue;
    if(typeof name!=='string'||name!==path.basename(name)||name.includes('\\')||!name.endsWith('.js'))throw new Error(`Runtime module allowlist requires top-level JS filenames: ${String(name)}`);
    collect(name);
  }
  const assembly=path.join(source,'assembly');
  function walkAssembly(directory,relative='assembly'){
    for(const entry of fs.readdirSync(directory,{withFileTypes:true})){
      if(entry.isDirectory()){
        if(entry.name==='models')continue;
        walkAssembly(path.join(directory,entry.name),`${relative}/${entry.name}`);
      }else if(entry.isFile()&&assemblyExtensions.has(path.extname(entry.name).toLowerCase()))collect(`${relative}/${entry.name}`);
    }
  }
  if(fs.existsSync(assembly))walkAssembly(assembly);
  for(const entry of fs.readdirSync(source,{withFileTypes:true}))if(entry.isFile()&&posterPattern.test(entry.name))collect(entry.name);
  const names=[...entries.keys()].sort(),hashState=crypto.createHash('sha256').update('bamboo-runtime-release-v1\0');
  for(const name of names){const bytes=entries.get(name);hashState.update(name+'\0'+bytes.length+'\0');hashState.update(bytes);}
  const hash=hashState.digest('hex').slice(0,16),baseSuffix=`/assets/releases/${hash}`;
  const directory=path.resolve(outputRoot,'assets','releases',hash);
  const files=Object.fromEntries(names.map(name=>[name,{sha256:digest(entries.get(name)),bytes:entries.get(name).length}]));
  function writeImmutable(filename,bytes){
    if(fs.existsSync(filename)){
      if(!fs.readFileSync(filename).equals(bytes))throw new Error(`Immutable runtime release already contains different bytes: ${filename}`);
      return;
    }
    fs.mkdirSync(path.dirname(filename),{recursive:true});fs.writeFileSync(filename,bytes,{flag:'wx'});
  }
  for(const name of names)writeImmutable(path.join(directory,name),entries.get(name));
  writeImmutable(path.join(directory,'runtime-release.json'),Buffer.from(JSON.stringify({schema:1,hash,baseSuffix,files},null,2)+'\n'));
  return {hash,baseSuffix,directory,files};
}

/** Verify both the content address and local dependency closure without writing files. */
export function verifyRuntimeRelease(directory){
  const root=path.resolve(directory),manifest=JSON.parse(fs.readFileSync(path.join(root,'runtime-release.json'),'utf8'));
  if(manifest.schema!==1||!manifest.files||!/^[a-f0-9]{16}$/.test(manifest.hash)||path.basename(root)!==manifest.hash||manifest.baseSuffix!==`/assets/releases/${manifest.hash}`)throw new Error('Invalid runtime release identity.');
  const names=Object.keys(manifest.files).sort(),hashState=crypto.createHash('sha256').update('bamboo-runtime-release-v1\0'),modules=new Map();
  for(const name of names){
    if(name.includes('\\')||name.includes('\0')||name.split('/').some(part=>!part||part==='.'||part==='..')||path.isAbsolute(name))throw new Error(`Invalid runtime release filename: ${name}`);
    const bytes=fs.readFileSync(path.join(root,name)),metadata=manifest.files[name];
    if(bytes.length!==metadata.bytes||digest(bytes)!==metadata.sha256)throw new Error(`Runtime release bytes differ: ${name}`);
    hashState.update(name+'\0'+bytes.length+'\0');hashState.update(bytes);
    if(name.endsWith('.js'))modules.set(name,bytes.toString('utf8'));
  }
  if(hashState.digest('hex').slice(0,16)!==manifest.hash)throw new Error('Runtime release content address differs.');
  // The copied standalone assembly entry retains its own separate-site URLs.
  // Traverse live shop roots, including lazy checkout, scene and worker entries.
  const queue=['app.js','shop-scene.js','checkout.js','assembly/surface-worker.js'].filter(name=>modules.has(name)),visited=new Set();
  while(queue.length){
    const name=queue.shift();if(visited.has(name))continue;visited.add(name);
    for(const imported of modules.get(name).matchAll(/(?:\bfrom\s*|\bimport\s*(?:\(\s*)?)["']([^"']+)["']/g)){
      const specifier=imported[1];
      if(specifier==='three'){
        if(!('assembly/vendor/three.module.js' in manifest.files))throw new Error(`Runtime dependency missing: three in ${name}`);
        queue.push('assembly/vendor/three.module.js');
      }else if(specifier.startsWith('.')){
        const target=new URL(specifier,`https://runtime.test/${name}`).pathname.slice(1);
        if(!(target in manifest.files))throw new Error(`Runtime dependency missing: ${specifier} in ${name}`);
        if(modules.has(target))queue.push(target);
      }else if(!/^(?:https?:|data:)/.test(specifier))throw new Error(`Unmapped runtime dependency: ${specifier} in ${name}`);
    }
  }
  return manifest;
}
