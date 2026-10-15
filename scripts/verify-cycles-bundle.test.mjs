import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {Matrix4,Vector3,Quaternion} from 'three';
import {verifyCyclesBundle} from './verify-cycles-bundle.mjs';

const sha=buffer=>crypto.createHash('sha256').update(buffer).digest('hex');
const raw=array=>Buffer.from(array.buffer,array.byteOffset,array.byteLength);

/** Four source vertices, split into two independently indexed material draws.
 * Strided/prefixed positions and prefixed UVs exercise actual accessor decoding,
 * rather than hashing a conveniently contiguous bufferView.
 */
function fixture(){
 const positions=new Float32Array([0,0,0, 1,0,0, 1,1,0, 0,1,0]);
 const uvs=new Float32Array([0,0, 1,0, 1,1, 0,1]);
 const indices=new Uint16Array([0,1,2, 0,2,3]);
 const positionData=Buffer.alloc(68,0x7f);
 for(let i=0;i<4;i++)raw(positions).copy(positionData,4+i*16,i*12,i*12+12);
 const uvData=Buffer.concat([Buffer.alloc(4,0x2a),raw(uvs)]);
 const parts=[positionData,uvData,raw(indices.subarray(0,3)),raw(indices.subarray(3))];
 const bufferViews=[];let offset=0;
 const packed=[];
 for(const part of parts){
  bufferViews.push({buffer:0,byteOffset:offset,byteLength:part.length});
  const padding=Buffer.alloc((4-part.length%4)%4);packed.push(part,padding);offset+=part.length+padding.length;
 }
 bufferViews[0].byteStride=16;
 const bin=Buffer.concat(packed);
 const json={asset:{version:'2.0'},scene:0,scenes:[{nodes:[0]}],
  nodes:[{name:'Millimetres_to_metres',scale:[.001,.001,.001],children:[1]},
   {name:'Fixture_surface',mesh:0,translation:[3,5,7]}],
  meshes:[{primitives:[
   {attributes:{POSITION:0,TEXCOORD_0:1},indices:2,material:0,mode:4},
   {attributes:{POSITION:0,TEXCOORD_0:1},indices:3,material:1,mode:4},
  ]}],materials:[{name:'Surface_front'},{name:'Surface_back'}],
  buffers:[{byteLength:bin.length}],bufferViews,
  accessors:[
   {bufferView:0,byteOffset:4,componentType:5126,count:4,type:'VEC3'},
   {bufferView:1,byteOffset:4,componentType:5126,count:4,type:'VEC2'},
   {bufferView:2,componentType:5123,count:3,type:'SCALAR'},
   {bufferView:3,componentType:5123,count:3,type:'SCALAR'},
  ]};
 const local=new Matrix4().compose(new Vector3(3,5,7),new Quaternion(),new Vector3(1,1,1));
 const world=new Matrix4().makeScale(.001,.001,.001).multiply(local);
 const source={name:'Fixture_surface',
  attributes:{
   position:{sha256:sha(raw(positions)),count:4,itemSize:3,type:'Float32Array'},
   uv:{sha256:sha(raw(uvs)),count:4,itemSize:2,type:'Float32Array'},
  },index:{sha256:sha(raw(indices)),count:6,type:'Uint16Array'},
  groups:[{start:0,count:3,materialIndex:0},{start:3,count:3,materialIndex:1}],
  matrix:local.toArray(),matrixWorld:world.toArray(),materials:['Surface_front','Surface_back']};
 const bundle={schema:'bamboo-cycles-source-bundle-v1',geometry:{beforeExport:[source]}};
 function serialize(change=()=>{}){
  const nextJson=structuredClone(json),nextBin=Buffer.from(bin);change(nextJson,nextBin);
  const text=Buffer.from(JSON.stringify(nextJson)),jsonBytes=Buffer.concat([text,Buffer.alloc((4-text.length%4)%4,0x20)]);
  const header=Buffer.alloc(12),jsonHeader=Buffer.alloc(8),binHeader=Buffer.alloc(8);
  header.writeUInt32LE(0x46546c67,0);header.writeUInt32LE(2,4);header.writeUInt32LE(12+8+jsonBytes.length+8+nextBin.length,8);
  jsonHeader.writeUInt32LE(jsonBytes.length,0);jsonHeader.writeUInt32LE(0x4e4f534a,4);
  binHeader.writeUInt32LE(nextBin.length,0);binHeader.writeUInt32LE(0x004e4942,4);
  const glb=Buffer.concat([header,jsonHeader,jsonBytes,binHeader,nextBin]);
  return {...bundle,glb:{base64:glb.toString('base64'),byteLength:glb.length,sha256:sha(glb)}};
 }
 return {serialize};
}

test('serialized material splits preserve strided positions, UVs, original index order and source transforms',()=>{
 const result=verifyCyclesBundle(fixture().serialize());
 assert.equal(result.verified,true);
 assert.equal(result.meshCount,1);assert.equal(result.primitiveCount,2);
 assert.equal(result.exactPositionBuffers,true);assert.equal(result.exactUvBuffers,true);
 assert.equal(result.exactIndexBuffersAfterMaterialSplitReassembly,true);
 assert.equal(result.sourceTransformsPreserved,true);assert.deepEqual(result.normalTransforms,[]);
});

test('changed serialized position bytes fail even when the GLB artifact hash is refreshed',()=>{
 const source=fixture().serialize((json,bin)=>bin.writeFloatLE(.125,json.bufferViews[0].byteOffset+4));
 assert.throws(()=>verifyCyclesBundle(source),/POSITION: exact serialized byte hash/);
});

test('changed serialized UV bytes fail independently of source positions',()=>{
 const source=fixture().serialize((json,bin)=>bin.writeFloatLE(.25,json.bufferViews[1].byteOffset+4));
 assert.throws(()=>verifyCyclesBundle(source),/TEXCOORD_0: exact serialized byte hash/);
});

test('mutating an index in the second material primitive fails source index reassembly',()=>{
 const source=fixture().serialize((json,bin)=>bin.writeUInt16LE(1,json.bufferViews[3].byteOffset));
 assert.throws(()=>verifyCyclesBundle(source),/concatenated material primitives reproduce exact source index bytes/);
});

test('omitting a material primitive cannot silently omit part of the surface',()=>{
 const source=fixture().serialize(json=>json.meshes[0].primitives.pop());
 assert.throws(()=>verifyCyclesBundle(source),/material primitive split count/);
});

test('omitting the operative mesh from the serialized hierarchy fails',()=>{
 const source=fixture().serialize(json=>{json.nodes[0].children=[];});
 assert.throws(()=>verifyCyclesBundle(source),/Every operative source mesh serialized exactly once/);
});

test('an altered unit-conversion root fails world-transform verification',()=>{
 const source=fixture().serialize(json=>{json.nodes[0].scale=[.002,.002,.002];});
 assert.throws(()=>verifyCyclesBundle(source),/world transform: matrix entry/);
});

test('an altered component translation fails local-transform verification',()=>{
 const source=fixture().serialize(json=>{json.nodes[1].translation=[3,5,8];});
 assert.throws(()=>verifyCyclesBundle(source),/local transform: matrix entry/);
});

test('swapping material assignments without changing triangles fails',()=>{
 const source=fixture().serialize(json=>{json.meshes[0].primitives[1].material=0;});
 assert.throws(()=>verifyCyclesBundle(source),/named material assignment/);
});
