import test from 'node:test';
import assert from 'node:assert/strict';
import {sanitizeCart,cartTotal} from '../assets/catalog.js';
test('mixed bag uses the given prices in integer cents',()=>{
  assert.equal(cartTotal([{scent:'aloe',format:'shampoo',quantity:2},{scent:'argan',format:'refill',quantity:3}]),3850);
});
test('corrupt session data cannot inject SKUs, prices or invalid quantities',()=>{
  assert.deepEqual(sanitizeCart([null,{scent:'unknown',format:'shampoo',quantity:1},{scent:'aloe',format:'shampoo',quantity:-1},{scent:'aloe',format:'refill',quantity:1.5},{scent:'bamboo',format:'refill',quantity:1,price:0}]),[{scent:'bamboo',format:'refill',quantity:1}]);
  assert.deepEqual(sanitizeCart({}),[]);
});
test('duplicates are merged and capped while formats stay separate',()=>{
  assert.deepEqual(sanitizeCart([{scent:'aloe',format:'refill',quantity:12},{scent:'aloe',format:'refill',quantity:15},{scent:'aloe',format:'shampoo',quantity:2}]),[{scent:'aloe',format:'refill',quantity:20},{scent:'aloe',format:'shampoo',quantity:2}]);
});
