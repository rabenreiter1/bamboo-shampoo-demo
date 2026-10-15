import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {CAP_SOURCE} from '../assets/assembly/cap-data.js';
const correction=JSON.parse(fs.readFileSync('scripts/cap-profile-correction.json','utf8'));
const hash=b=>createHash('sha256').update(b).digest('hex');
test('approved button-tip correction fills only the mistaken bridge-overlap cutout',()=>{
 const original=structuredClone(correction.originalButton);
 assert.equal(original[0].points.length,668);
 original[0].points.splice(338,14);
 assert.deepEqual(CAP_SOURCE.button[0].points,original[0].points);
 assert.deepEqual(CAP_SOURCE.button,correction.correctedButton);
 const [a,b]=CAP_SOURCE.button[0].points.slice(337,339);
 assert.equal(a[1],b[1]);assert.ok(a[0]>1&&b[0]<-1);
 assert.ok(CAP_SOURCE.button[0].area>correction.originalButton[0].area);
 assert.equal(hash(fs.readFileSync('assets/assembly/cap-reference.jpg')),correction.referenceSha256);
 assert.equal(hash(fs.readFileSync('assets/assembly/original-engraving.svg')),'67a2b2534da5cbeaf044e115d4db34ff7c604d190435ba393ea85ea2485f47aa');
});
