import fs from 'node:fs/promises';
const families = [
  ['Cormorant+Garamond:ital,wght@0,400;0,500;0,600;1,400','editorial'],
  ['Manrope:wght@400;500;600','sans']
];
const headers={'User-Agent':'Mozilla/5.0 AppleWebKit/537.36 Chrome/130.0.0.0 Safari/537.36'};
for(const [family,name] of families){
  const response=await fetch(`https://fonts.googleapis.com/css2?family=${family}&display=swap`,{headers});
  if(!response.ok)throw new Error(`Font CSS ${response.status}`);
  const css=await response.text();
  const blocks=[...css.matchAll(/\/\* latin \*\/\s*(@font-face\s*\{[^}]+\})/g)].map(m=>m[1]);
  if(!blocks.length)throw new Error('Latin font block missing');
  const picked=new Map();
  for(const block of blocks){const italic=block.includes('font-style: italic');if(!picked.has(italic))picked.set(italic,block);}
  for(const [italic,block] of picked){
    const url=block.match(/url\(([^)]+)\)/)?.[1];if(!url)throw new Error('Font URL missing');
    const binary=await fetch(url);if(!binary.ok)throw new Error(`Font download ${binary.status}`);
    await fs.writeFile(`assets/${name}${italic?'-italic':''}.woff2`,Buffer.from(await binary.arrayBuffer()));
  }
}
for(const [folder,name] of [['cormorantgaramond','editorial'],['manrope','sans']]){
  const response=await fetch(`https://raw.githubusercontent.com/google/fonts/main/ofl/${folder}/OFL.txt`);
  if(!response.ok)throw new Error(`License ${response.status}`);
  await fs.writeFile(`assets/${name}-LICENSE.txt`,await response.text());
}
console.log('Downloaded and self-hosted Latin fonts and SIL Open Font Licenses.');
