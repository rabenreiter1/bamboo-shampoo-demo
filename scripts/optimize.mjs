import {createRequire} from 'node:module';
import path from 'node:path';
// Optional authoring helper; build and website need no dependencies.
// node scripts/optimize.mjs SOURCE.png NAME [SHARP_MODULE_DIRECTORY]
const [source,name,moduleDirectory]=process.argv.slice(2);
if (!source || !/^[a-z]+$/.test(name||'')) throw new Error('Provide source image and lowercase asset name');
const require=createRequire(moduleDirectory ? path.resolve(moduleDirectory,'package.json') : import.meta.url);
const sharp=require('sharp');
const info=await sharp(source).resize({width:['product','aloe','argan'].includes(name)?1100:1536,withoutEnlargement:true}).webp({quality:85,effort:5}).toFile(`assets/${name}.webp`);
console.log(`${name}: ${Math.round(info.size/1024)} KB`);
