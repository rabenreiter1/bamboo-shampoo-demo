import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import sharp from 'sharp';

const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const invariant=(condition,message)=>{if(!condition)throw new Error(message);};
const textureKey=texture=>JSON.stringify(texture.uses.map(use=>[use.mesh,use.material,use.slot]).sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b))));
export function canonicalGeometryManifest(meshes){
 const aliases=new Map();
 return meshes.map(mesh=>({...mesh,materials:mesh.materials.map(material=>{
  if(!/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(material))return material;
  if(!aliases.has(material))aliases.set(material,`unnamed-material-${aliases.size}`);
  return aliases.get(material);
 })}));
}
function materialManifest(bundle){
 const bytes=Buffer.from(bundle.glb.base64,'base64');
 invariant(bytes.readUInt32LE(0)===0x46546c67&&bytes.readUInt32LE(4)===2&&bytes.readUInt32LE(16)===0x4e4f534a,'Source export is not a valid GLB JSON container.');
 const json=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)).toString());
 return {materials:json.materials,assignments:json.meshes.map(mesh=>({name:mesh.name,materials:mesh.primitives.map(primitive=>primitive.material)}))};
}
export async function verifySurfaceParity(baseline,current){
 invariant(baseline.schema===current.schema,'Factory export schemas differ.');
 invariant(baseline.threeRevision===current.threeRevision,'THREE versions differ.');
 const before=canonicalGeometryManifest(baseline.geometry.beforeExport),after=canonicalGeometryManifest(current.geometry.beforeExport);
 invariant(JSON.stringify(before)===JSON.stringify(after),'A mesh attribute, index, transform, group or material-sharing assignment changed.');
 const oldMaterials=materialManifest(baseline),newMaterials=materialManifest(current);
 invariant(JSON.stringify(oldMaterials)===JSON.stringify(newMaterials),'Exported material parameters or primitive assignments changed.');
 invariant(current.geometry.positionIndexUvTransformsUnchanged===true,'Export changed positions, indices, UVs or transforms.');
 invariant(JSON.stringify(baseline.palette)===JSON.stringify(current.palette),'Pastel material colours changed.');
 const currentTextures=new Map(current.textures.map(texture=>[textureKey(texture),texture]));
 invariant(currentTextures.size===baseline.textures.length,'Texture assignments changed.');const textures=[];
 for(const texture of baseline.textures){
  const key=textureKey(texture),other=currentTextures.get(key);invariant(other,'A source texture assignment is missing.');
  invariant(texture.width===other.width&&texture.height===other.height,'Texture dimensions changed.');
  const oldPng=Buffer.from(texture.base64,'base64'),newPng=Buffer.from(other.base64,'base64');
  const [oldRaster,newRaster]=await Promise.all([sharp(oldPng).ensureAlpha().raw().toBuffer(),sharp(newPng).ensureAlpha().raw().toBuffer()]);
  invariant(oldRaster.equals(newRaster),'Decoded material texels changed: '+key);
  textures.push({uses:texture.uses,width:texture.width,height:texture.height,rgbaSha256:sha(oldRaster),pngByteIdentical:oldPng.equals(newPng)});
 }
 const runtimeFiles=['assembly/surface-finish.js','assembly/surface-buffers.js','assembly/surface-worker.js'];
 return {schema:'bamboo-surface-runtime-parity-v1',verified:true,visualVersion:'studio-20261015-2',
  baselineSource:baseline.source,currentSource:current.source,baselineGeometrySha256:sha(Buffer.from(JSON.stringify(before))),currentGeometrySha256:sha(Buffer.from(JSON.stringify(after))),
  materialIdentityNormalization:'Only random UUID aliases for unnamed THREE materials are replaced in first-use order. Material sharing topology, complete exported material definitions and primitive assignments must remain identical.',
  exactMaterialDefinitions:true,exactMaterialAssignments:true,materialDefinitionsSha256:sha(Buffer.from(JSON.stringify(newMaterials))),
  exactMeshAttributes:true,exactIndices:true,exactTransforms:true,exactDecodedTextureRgba:true,textures,
  runtime:Object.fromEntries(runtimeFiles.map(file=>[file,sha(Buffer.from(fs.readFileSync(path.join('assets',file),'utf8').replaceAll('\r\n','\n')))]))};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const [before,after,output]=process.argv.slice(2);if(!before||!after)throw new Error('Usage: node scripts/verify-surface-parity.mjs <before.json> <after.json> [proof.json]');
 const baseline=JSON.parse(fs.readFileSync(before,'utf8')),current=JSON.parse(fs.readFileSync(after,'utf8'));
 const proof=await verifySurfaceParity(baseline,current);if(output)fs.writeFileSync(output,JSON.stringify(proof,null,2)+'\n');
 console.log(`Verified byte-identical geometry for ${current.geometry.beforeExport.length} meshes and exact RGBA pixels for ${proof.textures.length} material textures.`);
}
