import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';

const root=fileURLToPath(new URL('..',import.meta.url));
const source=path.join(root,'assets','assembly');
const target=path.join(root,'docs','assembly');
for(const name of ['index.html','style.css','scene.js','timeline.js','body.js','cap.js','ritual-cap.js','ritual-effects.js','ritual-input.js','ritual-timeline.js','product-poster.jpg','original-engraving.svg']) {
  if(!fs.existsSync(path.join(source,name))) throw new Error(`Assembly source missing: ${name}`);
}
const deliver=fs.readFileSync(path.join(source,'original-engraving.svg'));
const hash=crypto.createHash('sha256').update(deliver).digest('hex');
if(hash!=='67a2b2534da5cbeaf044e115d4db34ff7c604d190435ba393ea85ea2485f47aa') throw new Error('Original engraving was modified');
const privateReference=path.join(root,'qa','reference','final-engraving.svg');
if(fs.existsSync(privateReference)&&!fs.readFileSync(privateReference).equals(deliver)) throw new Error('Original engraving differs from the supplied reference');
fs.mkdirSync(target,{recursive:true});
fs.cpSync(source,target,{recursive:true});
fs.writeFileSync(path.join(target,'source-integrity.json'),JSON.stringify({engravingSha256:hash,engravingUnchanged:true,nominalFillMl:250,units:'mm'},null,2));
console.log(`Built standalone /assembly/ (${hash.slice(0,16)} original engraving SHA-256). Existing shop files untouched.`);
