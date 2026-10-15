import {createCyclesBundle} from './cycles-export.js';
const status=document.querySelector('#status'),button=document.querySelector('#export');
let downloadUrl;
button.onclick=async()=>{
 button.disabled=true;
 try{
  const bundle=await createCyclesBundle({status:text=>status.textContent=text});
  if(downloadUrl)URL.revokeObjectURL(downloadUrl);
  downloadUrl=URL.createObjectURL(new Blob([JSON.stringify(bundle)],{type:'application/json'}));
  const link=document.querySelector('#download');link.href=downloadUrl;
  link.download='bamboo-cycles-source-20261015-v1.json';link.hidden=false;
 }catch(error){status.textContent='Export failed: '+error.message;console.error(error);}
 finally{button.disabled=false;}
};
