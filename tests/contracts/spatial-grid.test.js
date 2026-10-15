import test from 'node:test';
import assert from 'node:assert/strict';
import { createSpatialGrid, clearSpatialGrid, insertParticle, queryNeighbors } from '../../src/sim/spatial-grid.js';

test('grid inserts and returns local neighbors across toroidal boundaries', () => {
  const grid=createSpatialGrid({worldSize:12,dim:3});
  assert.equal(insertParticle(grid,7,.1,2,2).inserted,true);
  const out=new Int32Array(8);
  const result=queryNeighbors(grid,11.9,2,2,out);
  assert.equal(result.truncated,false);
  assert.equal(result.count,1);
  assert.equal(out[0],7);
});

test('finite cell capacity reports overflow rather than silently claiming insertion', () => {
  const grid=createSpatialGrid({worldSize:10,dim:2,cellCap:1});
  assert.equal(insertParticle(grid,1,1,1,1).inserted,true);
  const second=insertParticle(grid,2,1.1,1.1,1.1);
  assert.equal(second.inserted,false);
  assert.equal(second.reason,'cell-capacity');
  assert.equal(grid.overflowCount,1);
});

test('neighbor output cap explicitly reports truncation', () => {
  const grid=createSpatialGrid({worldSize:10,dim:2});
  insertParticle(grid,1,1,1,1);
  insertParticle(grid,2,2,1,1);
  const result=queryNeighbors(grid,1,1,1,new Int32Array(1));
  assert.equal(result.count,1);
  assert.equal(result.truncated,true);
});

test('clear only resets touched cells and overflow diagnostics', () => {
  const grid=createSpatialGrid({worldSize:10,dim:2,cellCap:1});
  insertParticle(grid,1,1,1,1);
  insertParticle(grid,2,1.1,1.1,1.1);
  clearSpatialGrid(grid);
  assert.equal(grid.touchedCount,0);
  assert.equal(grid.overflowCount,0);
  assert.equal(grid.counts.reduce((a,b)=>a+b,0),0);
});

test('rejects invalid grid and coordinate inputs', () => {
  assert.throws(()=>createSpatialGrid({worldSize:0}),/worldSize/);
  assert.throws(()=>createSpatialGrid({worldSize:10,dim:0}),/dim/);\n  assert.throws(()=>createSpatialGrid({worldSize:10,dim:64}),/cell budget/);
  const grid=createSpatialGrid({worldSize:10});
  assert.throws(()=>insertParticle(grid,1,NaN,1,1),/coordinates/);
});
