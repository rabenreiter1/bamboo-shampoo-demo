import test from 'node:test';
import assert from 'node:assert/strict';
import {canonicalGeometryManifest,verifySurfaceParity} from './verify-surface-parity.mjs';

const id1='01234567-89ab-cdef-0123-456789abcdef',id2='12345678-9abc-def0-1234-56789abcdef0',other='abcdefab-cdef-abcd-efab-cdefabcdefab';
const mesh=(materials,hash='position-bytes')=>({name:'cap',materials,attributes:{position:{sha256:hash}},index:{sha256:'index-bytes'},matrix:[1],matrixWorld:[1],groups:[]});
test('normalization ignores random unnamed material UUID values while preserving sharing topology and named materials',()=>{
 assert.deepEqual(canonicalGeometryManifest([mesh([id1]),mesh([id1,'named'])]),canonicalGeometryManifest([mesh([id2]),mesh([id2,'named'])]));
 assert.notDeepEqual(canonicalGeometryManifest([mesh([id1]),mesh([id1])]),canonicalGeometryManifest([mesh([id2]),mesh([other])]));
 assert.notDeepEqual(canonicalGeometryManifest([mesh(['named'])]),canonicalGeometryManifest([mesh(['different-name'])]));
 assert.notDeepEqual(canonicalGeometryManifest([mesh([id1])]),canonicalGeometryManifest([mesh([id2],'changed-position')]));
});
function glb(materials,material=0){
 const json=Buffer.from(JSON.stringify({materials,meshes:[{name:'cap',primitives:[{material}]}]})),padded=Buffer.concat([json,Buffer.alloc((4-json.length%4)%4,32)]),header=Buffer.alloc(20);
 header.writeUInt32LE(0x46546c67,0);header.writeUInt32LE(2,4);header.writeUInt32LE(20+padded.length,8);header.writeUInt32LE(padded.length,12);header.writeUInt32LE(0x4e4f534a,16);return {base64:Buffer.concat([header,padded]).toString('base64')};
}
test('parity gate rejects actual material changes or primitive reassignment even if UUID-normalized meshes match',async()=>{
 const original={schema:'test',threeRevision:186,geometry:{beforeExport:[mesh([id1])],positionIndexUvTransformsUnchanged:true},glb:glb([{roughness:.46}]),palette:{},textures:[],source:{}};
 const changed=structuredClone(original);changed.geometry.beforeExport=[mesh([id2])];changed.glb=glb([{roughness:.6}]);
 await assert.rejects(verifySurfaceParity(original,changed),/material parameters/);
 changed.glb=glb([{roughness:.46}],1);await assert.rejects(verifySurfaceParity(original,changed),/primitive assignments/);
});
