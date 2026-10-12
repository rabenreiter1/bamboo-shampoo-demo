import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import validator from 'gltf-validator';
import {computeAssemblyState,COMPONENT_IDS} from '../assets/assembly/timeline.js';

const root=fileURLToPath(new URL('..',import.meta.url));
const file=path.join(root,'assets/assembly/models/bamboo-250ml-animated-assembly.glb');
const bytes=fs.readFileSync(file);
assert.equal(bytes.subarray(0,4).toString(),'glTF');
assert.equal(bytes.readUInt32LE(4),2);
assert.equal(bytes.readUInt32LE(8),bytes.length);
const jsonLength=bytes.readUInt32LE(12);
const model=JSON.parse(bytes.subarray(20,20+jsonLength).toString());
const bin=bytes.subarray(20+jsonLength+8);
const groups=model.nodes.filter(n=>COMPONENT_IDS.includes(n.extras?.component));
assert.deepEqual(groups.map(n=>n.extras.component).sort(),[...COMPONENT_IDS].sort());
assert.deepEqual(model.nodes[0].scale,[.001,.001,.001]);
assert.equal(model.animations.length,1);
const animation=model.animations[0];

function values(accessorId) {
  const accessor=model.accessors[accessorId],view=model.bufferViews[accessor.bufferView];
  const count={SCALAR:1,VEC3:3,VEC4:4}[accessor.type];
  assert.equal(accessor.componentType,5126);
  const offset=(view.byteOffset||0)+(accessor.byteOffset||0),stride=view.byteStride||count*4;
  return Array.from({length:accessor.count},(_,i)=>Array.from({length:count},(_,j)=>bin.readFloatLE(offset+i*stride+j*4)));
}

for(const channel of animation.channels) {
  const sampler=animation.samplers[channel.sampler],times=values(sampler.input).flat(),output=values(sampler.output);
  const component=model.nodes[channel.target.node].extras?.component;
  assert.equal(times.length,241);assert.equal(times.at(-1),14);
  for(let i=0;i<times.length;i++) {
    // Recreate the exporter sample index; float32 time quantization can move a
    // visibility threshold (e.g.0.1) a few billionths to its opposite side.
    const state=computeAssemblyState(i/(times.length-1));
    if(component&&channel.target.path==='translation')for(let j=0;j<3;j++)assert.ok(Math.abs(output[i][j]-state.components[component].position[j])<.0001);
    if(component==='seal'&&channel.target.path==='scale')assert.ok(Math.abs(output[i][0]-(state.components.seal.visible?1:.00001))<.000001);
  }
}
const report=await validator.validateBytes(new Uint8Array(bytes),{uri:path.basename(file),maxIssues:100});
fs.mkdirSync(path.join(root,'qa'),{recursive:true});
fs.writeFileSync(path.join(root,'qa','assembly-glb-validation.json'),JSON.stringify(report,null,2));
const summary={bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex'),components:groups.map(n=>n.extras.component),animationChannels:animation.channels.length,animationSeconds:14,errors:report.issues.numErrors,warnings:report.issues.numWarnings,information:report.issues.numInfos};
console.log(JSON.stringify(summary,null,2));
if(report.issues.numErrors) {
  console.error(JSON.stringify(report.issues.messages.filter(m=>m.severity===0).slice(0,12),null,2));
  process.exitCode=1;
}
