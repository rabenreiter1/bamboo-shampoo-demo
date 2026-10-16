import fs from 'node:fs/promises';
import crypto from 'node:crypto';
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const manifest=JSON.parse(await fs.readFile('scripts/surface-finish-manifest.json','utf8'));
manifest.code={};
for(const file of ['assembly/surface-finish.js','assembly/studio-environment.js'])manifest.code[file]=sha(Buffer.from((await fs.readFile(`assets/${file}`,'utf8')).replaceAll('\r\n','\n')));
const capture=JSON.parse(await fs.readFile('qa/motion-poster-metadata.json','utf8'));
manifest.loadingFrames={method:capture.source.method,source:capture.source.factorySha256,assets:{}};
for(const name of Object.keys(capture.frames)){
 if(!/^shop-(detail-product|guide-product|teaser-product|ritual-product)-/.test(name))continue;
 const bytes=await fs.readFile(`assets/${name}.webp`);
 const frame=capture.frames[name];
 manifest.loadingFrames.assets[`${name}.webp`]={sha256:sha(bytes),bytes:bytes.length,scent:frame.scent,mode:frame.mode,progress:frame.progress,automaticYaw:frame.automaticYaw,cameraRegion:frame.cameraRegion,framing:frame.framing};
}
await fs.writeFile('scripts/surface-finish-manifest.json',JSON.stringify(manifest,null,2)+'\n');
