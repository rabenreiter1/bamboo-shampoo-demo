// Encode only a completed source-locked browser capture, never generated images.
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
const sharp=createRequire('C:/Users/bruno/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/package.json')('sharp');
const input=process.argv[2];if(!input)throw Error('Pass the downloaded bamboo-source-stills JSON bundle.');
const bundle=JSON.parse(await fs.readFile(input,'utf8'));
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const canonicalCode=bytes=>Buffer.from(bytes.toString('utf8').replaceAll('\r\n','\n'));
const check=(ok,message)=>{if(!ok)throw Error(message);};
check(bundle.schema==='bamboo-source-stills-v1','Not a source-derived still export.');
check(bundle.captureScriptSha256===sha(await fs.readFile('scripts/still-studio.js')),'Capture code changed since rendering.');
if(await fs.stat('qa/reference/material-photo.jpg').catch(()=>null))check(bundle.materialReference.sha256===sha(await fs.readFile('qa/reference/material-photo.jpg')),'Real material reference changed.');
check(bundle.geometry.identical&&JSON.stringify(bundle.geometry.before)===JSON.stringify(bundle.geometry.after),'Material stage changed geometry.');
for(const [name,hash] of Object.entries(bundle.source))check(hash===sha(await fs.readFile(name==='actual250Drawing'?'qa/reference/actual250.pdf':`assets/${name}`)),`Source changed: ${name}`);
check(bundle.source.actual250Drawing==='7fe76412fe08f68561b2613a2a8d0cbaa771f14f38d3e1084c96b2b0522d9272','Wrong 250 ml drawing.');
check(bundle.source['assembly/original-engraving.svg']==='67a2b2534da5cbeaf044e115d4db34ff7c604d190435ba393ea85ea2485f47aa','Wrong original engraving.');
const d=bundle.body.confirmed;
check(d.shellHeight===170&&d.shellOuterDiameter===58&&d.shellInnerDiameter===48&&d.inlayBodyOuterDiameter===47&&d.inlayBodyHeight===165&&d.flangeOuterDiameter===58&&d.flangeRadialWidth===5.5,'Drawing/user dimensions differ.');
const expected=['aloe','argan','bamboo'].flatMap(id=>[`photo-product-${id}`,`photo-refill-${id}`]).concat(['photo-shell','photo-cap-argan','photo-refill-detail']);
check(Object.keys(bundle.images).length===expected.length&&expected.every(name=>Object.hasOwn(bundle.images,name)),'Incomplete or unexpected image set.');
const prepared=[];
for(const name of expected){
 const frame=bundle.frames[name],detail=name==='photo-refill-detail',url=bundle.images[name];
 check(frame.sourceGeometryIdentical&&frame.engravingSha256===bundle.source['assembly/original-engraving.svg'],'Frame source is unverified.');
 check(/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(url),'Not a PNG capture.');
 const png=Buffer.from(url.split(',')[1],'base64'),meta=await sharp(png).metadata();
 check(meta.width===(detail?1536:1280)&&meta.height===(detail?1024:1600)&&meta.hasAlpha,`Wrong RGBA capture: ${name}`);
 prepared.push({name,png,detail});
}
await fs.mkdir('qa/source-stills',{recursive:true});
// Preserve binary source hashes exactly. Normalize only code line endings so
// the tracked provenance test works on Windows and Unix checkouts alike.
const source={...bundle.source};
for(const name of Object.keys(source))if(name.endsWith('.js'))source[name]=sha(canonicalCode(await fs.readFile(`assets/${name}`)));
const manifest={schema:bundle.schema,method:'Deterministic WebGL rendering of approved animation factories. No generative product imagery.',source,codeHashConvention:'UTF-8 with LF newlines; binary references and SVG remain byte-exact',captureScriptSha256:sha(canonicalCode(await fs.readFile('scripts/still-studio.js'))),
 geometry:{identical:true,meshes:bundle.geometry.after},dimensions:bundle.body.confirmed,
 limits:[...bundle.body.assumptions,...bundle.cap.assumptions,...bundle.seal.assumptions],materialReference:bundle.materialReference,frames:bundle.frames,assets:{}};
for(const {name,png,detail} of prepared){
 await fs.writeFile(`qa/source-stills/${name}.png`,png);
 const bytes=await sharp(png).webp({quality:94,alphaQuality:100,effort:6}).toBuffer();
 await fs.writeFile(`assets/${name}.webp`,bytes);manifest.assets[`${name}.webp`]={sha256:sha(bytes),bytes:bytes.length};
 if(!detail){const small=await sharp(png).resize(640,800).webp({quality:90,alphaQuality:100,effort:6}).toBuffer();await fs.writeFile(`assets/${name}-640.webp`,small);manifest.assets[`${name}-640.webp`]={sha256:sha(small),bytes:small.length};}
 console.log(`${name}: ${(bytes.length/1024).toFixed(1)} kB`);
}
await fs.writeFile('scripts/still-capture-manifest.json',JSON.stringify(manifest,null,2)+'\n');
await fs.writeFile('qa/source-stills/full-capture.json',JSON.stringify({...bundle,images:undefined},null,2));
console.log('Encoded 9 source-derived stills; source and mesh fingerprints recorded.');
