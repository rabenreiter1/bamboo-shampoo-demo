/** Hash the exact recipe and verify factory serialization before invoking Cycles. */
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import {spawn} from 'node:child_process';
import {verifyCyclesBundle} from './verify-cycles-bundle.mjs';
const [blender,bundleFile,outputDirectory,...options]=process.argv.slice(2);
if(!blender||!bundleFile||!outputDirectory)throw Error('Usage: node scripts/cycles-job.mjs <blender-executable> <source-bundle.json> <output-directory>');
const output=path.resolve(outputDirectory),recipe=path.resolve('scripts/cycles-render.py');
const bundle=JSON.parse(await fs.readFile(bundleFile,'utf8')),verification=verifyCyclesBundle(bundle);
const bytes=await fs.readFile(recipe),stat=await fs.stat(recipe);
await fs.mkdir(output,{recursive:true});
await fs.writeFile(path.join(output,'executed-render-script.py'),bytes);
await fs.writeFile(path.join(output,'geometry-serialization-check.json'),JSON.stringify(verification,null,2)+'\n');
const job={method:'Recipe snapshotted and serialized factory geometry verified before launching Blender',recipeLastWriteUtc:stat.mtime.toISOString(),snapshotCapturedUtc:new Date().toISOString(),renderRecipeSha256:crypto.createHash('sha256').update(bytes).digest('hex'),renderRecipeSnapshot:'executed-render-script.py',processStartedUtc:new Date().toISOString()};
await fs.writeFile(path.join(output,'job-provenance.json'),JSON.stringify(job,null,2)+'\n');
const child=spawn(blender,['--background','--factory-startup','--python',recipe,'--',path.resolve(bundleFile),output,...options],{stdio:'inherit',windowsHide:true,shell:false});
child.on('error',error=>{console.error(error.message);process.exitCode=1;});
child.on('exit',code=>{process.exitCode=code??1;});
