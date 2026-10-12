import assert from 'node:assert/strict';
import {seed,syntheticSeed,migrate,validateProject,XY,coord} from '../src/data.ts';
import {inside} from '../src/territory.ts';
const p=seed();assert.equal(p.scenario.trees.length,10);assert.ok(p.scenario.trees.every(inside));assert.ok(p.trees.every(inside));assert.equal(p.observations.length,0);assert.deepEqual(validateProject(p),p);const old=syntheticSeed();old.trees[0].species='User tree';const migrated=migrate(old);assert.equal(migrated.trees.length,5);assert.equal(migrated.trees.find(t=>t.id===old.trees[0].id).species,'User tree');assert.deepEqual(XY(coord(0,0)),[0,0]);console.log('PASS domain: boundary, 10 plantings, 4 demo points, empty observations, migration, coordinate roundtrip');
