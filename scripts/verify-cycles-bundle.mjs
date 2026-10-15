/** Verify the serialized fresh GLB against the operative pre-export buffers.
 * Read-only: no Blender invocation, geometry writes or source-model imports.
 * node scripts/verify-cycles-bundle.mjs [source-bundle.json]
 */
import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';
import {Matrix4, Quaternion, Vector3} from 'three';

const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const components={5120:{bytes:1,type:'Int8Array'},5121:{bytes:1,type:'Uint8Array'},5122:{bytes:2,type:'Int16Array'},5123:{bytes:2,type:'Uint16Array'},5125:{bytes:4,type:'Uint32Array'},5126:{bytes:4,type:'Float32Array'}};
const sizes={SCALAR:1,VEC2:2,VEC3:3,VEC4:4,MAT2:4,MAT3:9,MAT4:16};

function parseGlb(buffer){
 assert.equal(buffer.readUInt32LE(0),0x46546c67,'GLB magic');
 assert.equal(buffer.readUInt32LE(4),2,'GLB version');
 assert.equal(buffer.readUInt32LE(8),buffer.length,'GLB declared length');
 let json,bin,offset=12;
 while(offset<buffer.length){
  assert.ok(offset+8<=buffer.length,'Complete GLB chunk header');
  const length=buffer.readUInt32LE(offset),type=buffer.readUInt32LE(offset+4);offset+=8;
  assert.ok(offset+length<=buffer.length,'Complete GLB chunk payload');
  const data=buffer.subarray(offset,offset+length);
  if(type===0x4e4f534a){assert.equal(json,undefined,'Single JSON chunk');json=JSON.parse(data.toString('utf8'));}
  else if(type===0x004e4942){assert.equal(bin,undefined,'Single BIN chunk');bin=data;}
  offset+=length;
 }
 assert.ok(json&&bin,'GLB JSON and BIN chunks exist');
 assert.equal(json.buffers.length,1,'Only one embedded source buffer');
 assert.equal(json.buffers[0].uri,undefined,'No external data dependencies');
 assert.ok(json.buffers[0].byteLength<=bin.length&&bin.length-json.buffers[0].byteLength<4,'Only GLB alignment padding follows buffer');
 return {json,bin};
}

function accessorReader(json,bin){
 const cache=new Map();
 return id=>{
  if(cache.has(id))return cache.get(id);
  const accessor=json.accessors[id];assert.ok(accessor,`Accessor ${id} exists`);
  assert.equal(accessor.sparse,undefined,`Accessor ${id}: no undisclosed sparse substitutions`);
  assert.ok(!accessor.normalized,`Accessor ${id}: no quantization normalization`);
  const component=components[accessor.componentType],itemSize=sizes[accessor.type];
  assert.ok(component&&itemSize,`Accessor ${id}: supported type`);
  const view=json.bufferViews[accessor.bufferView];assert.ok(view,`Accessor ${id}: embedded bufferView`);assert.equal(view.buffer,0);
  const elementSize=component.bytes*itemSize,stride=view.byteStride||elementSize;
  assert.ok(stride>=elementSize,`Accessor ${id}: valid stride`);
  const relative=accessor.byteOffset||0,start=(view.byteOffset||0)+relative;
  assert.ok(relative+Math.max(0,accessor.count-1)*stride+elementSize<=view.byteLength,`Accessor ${id}: within bufferView`);
  const data=Buffer.alloc(accessor.count*elementSize);
  for(let i=0;i<accessor.count;i++)bin.copy(data,i*elementSize,start+i*stride,start+i*stride+elementSize);
  const result={data,sha256:sha(data),count:accessor.count,itemSize,type:component.type,componentType:accessor.componentType};
  cache.set(id,result);return result;
 };
}

function checkAttribute(actual,expected,label){
 assert.equal(actual.count,expected.count,`${label}: vertex count`);
 assert.equal(actual.itemSize,expected.itemSize,`${label}: item size`);
 assert.equal(actual.type,expected.type,`${label}: stored component type`);
 assert.equal(actual.sha256,expected.sha256,`${label}: exact serialized byte hash`);
}
function matrixOf(node){
 if(node.matrix)return new Matrix4().fromArray(node.matrix);
 return new Matrix4().compose(new Vector3(...(node.translation||[0,0,0])),new Quaternion(...(node.rotation||[0,0,0,1])),new Vector3(...(node.scale||[1,1,1])));
}
function checkMatrix(actual,expected,label){
 assert.equal(expected.length,16,`${label}: expected matrix`);
 for(let i=0;i<16;i++)assert.ok(Math.abs(actual.elements[i]-expected[i])<=1e-10,`${label}: matrix entry ${i} ${actual.elements[i]} != ${expected[i]}`);
}

export function verifyCyclesBundle(bundle){
 assert.equal(bundle.schema,'bamboo-cycles-source-bundle-v1');
 const bytes=Buffer.from(bundle.glb.base64,'base64');
 assert.equal(bytes.length,bundle.glb.byteLength,'GLB byte count');
 assert.equal(sha(bytes),bundle.glb.sha256,'GLB artifact SHA-256');
 const {json,bin}=parseGlb(bytes),read=accessorReader(json,bin);
 const source=new Map(bundle.geometry.beforeExport.map(mesh=>[mesh.name,mesh]));
 assert.equal(source.size,bundle.geometry.beforeExport.length,'Unique source mesh names');
 const checked=new Set(),meshes=[],normalTransforms=[];
 const selected=json.scenes[json.scene??0];assert.ok(selected,'Default GLB scene exists');
 function visit(index,parent,ancestors=new Set()){
  assert.ok(!ancestors.has(index),'No hierarchy cycles');
  const node=json.nodes[index];assert.ok(node,`Node ${index} exists`);
  const local=matrixOf(node),world=parent.clone().multiply(local);
  if(node.mesh!==undefined){
   assert.ok(!checked.has(node.name),`Unique serialized mesh instance ${node.name}`);
   const expected=source.get(node.name);assert.ok(expected,`No unexpected serialized mesh: ${node.name}`);
   checkMatrix(local,expected.matrix,`${node.name} local transform`);checkMatrix(world,expected.matrixWorld,`${node.name} world transform`);
   const mesh=json.meshes[node.mesh];assert.ok(mesh,`${node.name}: mesh exists`);
   const groups=expected.groups.length?expected.groups:[{start:0,count:expected.index?.count??expected.attributes.position.count,materialIndex:0}];
   assert.equal(mesh.primitives.length,groups.length,`${node.name}: material primitive split count`);
   const indexParts=[];let nextIndex=0,normalChanged=false;
   for(let p=0;p<mesh.primitives.length;p++){
    const primitive=mesh.primitives[p],group=groups[p];
    assert.equal(primitive.mode??4,4,`${node.name}: triangle primitive`);
    checkAttribute(read(primitive.attributes.POSITION),expected.attributes.position,`${node.name} primitive ${p} POSITION`);
    if(expected.attributes.uv)checkAttribute(read(primitive.attributes.TEXCOORD_0),expected.attributes.uv,`${node.name} primitive ${p} TEXCOORD_0`);
    else assert.equal(primitive.attributes.TEXCOORD_0,undefined,`${node.name}: no injected UV array`);
    if(primitive.attributes.NORMAL!==undefined&&expected.attributes.normal){
     const actualNormal=read(primitive.attributes.NORMAL);
     assert.equal(actualNormal.count,expected.attributes.normal.count,`${node.name}: normal count`);
     normalChanged ||= actualNormal.sha256!==expected.attributes.normal.sha256;
    }
    if(expected.index){
     assert.equal(group.start,nextIndex,`${node.name}: ordered, contiguous material index groups`);
     const actual=read(primitive.indices);
     assert.equal(actual.type,expected.index.type,`${node.name}: index component type`);
     assert.equal(actual.itemSize,1,`${node.name}: scalar indices`);
     assert.equal(actual.count,group.count,`${node.name}: primitive index count`);
     indexParts.push(actual.data);nextIndex+=actual.count;
    }else{
     assert.equal(primitive.indices,undefined,`${node.name}: source unindexed triangle order preserved`);
     assert.equal(groups.length,1,`${node.name}: no unverified non-indexed material slicing`);
    }
    const wantedMaterial=expected.materials[group.materialIndex??0];
    // The export manifest falls back to a runtime UUID for unnamed materials.
    // GLTFExporter intentionally does not serialize that ephemeral UUID.
    if(!/^[a-f0-9]{8}-[a-f0-9-]{27}$/i.test(wantedMaterial))assert.equal(json.materials[primitive.material]?.name,wantedMaterial,`${node.name}: named material assignment`);
   }
   if(expected.index){
    assert.equal(nextIndex,expected.index.count,`${node.name}: all source indices covered once`);
    assert.equal(sha(Buffer.concat(indexParts)),expected.index.sha256,`${node.name}: concatenated material primitives reproduce exact source index bytes`);
   }
   if(normalChanged)normalTransforms.push({mesh:node.name,change:'GLTFExporter normal-only normalization; no position, UV, index or transform change',sourceHash:expected.attributes.normal.sha256,serializedHash:read(mesh.primitives[0].attributes.NORMAL).sha256});
   checked.add(node.name);meshes.push({name:node.name,primitives:mesh.primitives.length,vertices:expected.attributes.position.count,positionSha256:expected.attributes.position.sha256,uvSha256:expected.attributes.uv?.sha256??null,indexSha256:expected.index?.sha256??null,transformsVerified:true});
  }
  const branch=new Set(ancestors);branch.add(index);
  for(const child of node.children||[])visit(child,world,branch);
 }
 for(const node of selected.nodes)visit(node,new Matrix4());
 assert.equal(checked.size,source.size,'Every operative source mesh serialized exactly once');
 for(const name of source.keys())assert.ok(checked.has(name),`Source mesh not omitted: ${name}`);
 return {schema:'bamboo-cycles-serialized-geometry-verification-v1',verified:true,glbSha256:bundle.glb.sha256,
  meshCount:meshes.length,primitiveCount:meshes.reduce((sum,mesh)=>sum+mesh.primitives,0),
  exactPositionBuffers:true,exactUvBuffers:true,exactIndexBuffersAfterMaterialSplitReassembly:true,sourceTransformsPreserved:true,
  sourceUnitConversion:'Original millimetre position arrays remain byte-identical. The existing root scale0.001 converts the whole hierarchy to glTF metres.',
  normalTransforms,meshes,
  limits:'Verifies factory buffer hashes against serialized GLB accessors and hierarchy. Does not assert Blender import topology identity, watertight liquid boundaries or measured material coefficients.'};
}

if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
 const filename=process.argv[2];
 if(!filename)throw new Error('Usage: node scripts/verify-cycles-bundle.mjs <source-bundle.json>');
 const bundle=JSON.parse(await fs.readFile(filename,'utf8'));
 console.log(JSON.stringify(verifyCyclesBundle(bundle),null,2));
}
