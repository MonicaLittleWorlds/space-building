import assert from 'node:assert/strict';
import { test } from 'node:test';
import { demoProject, rotatedStairEnd, stairFlightCells, validate, walkable } from './model.mjs';
import { stairwell } from './geometry.mjs';
import { roomCutaway, roomLayout } from './rooms.mjs';
import { buildSpace, openSpaceFile } from './build.mjs';

test('the sample stair opening contains its downstairs artwork', () => {
  const project = demoProject();
  const stair = project.stairs[0];
  const well = stairwell(project, stair);
  assert.deepEqual(well.cells.map(({ x, z }) => `${x},${z}`), ['6,2', '7,2', '6,3', '7,3']);
  assert.ok(well.faces.length > 0);
  assert.equal(Object.keys(project.levels[1].tiles).length, 63);
  assert.deepEqual(validate(project), []);
});

test('older stairs without a style still reserve their flight and export a well', () => {
  const project = demoProject();
  const stair = project.stairs[0];
  delete stair.a.style;
  delete stair.b.style;
  assert.ok(stairwell(project, stair)?.faces.length);
  assert.equal(stairFlightCells(stair.a).length, 4);
  assert.ok(stairFlightCells(stair.a).every(cell => !walkable(project, cell)));
  assert.equal(rotatedStairEnd(project, stair.id, 'a', 1).axis, 'z');
});

test('validation rejects a stair flight outside the floor', () => {
  const project = demoProject();
  project.stairs[0].a.rise = -1;
  assert.match(validate(project).join(' '), /full stair flight needs floor tiles/);
});

test('the sample has opposite walls to reveal at every rotation', () => {
  const project = demoProject();
  for (const level of project.levels) {
    const rooms = roomLayout(level);
    assert.equal(rooms[0].boundaries.length, 32);
    for (const rotation of [0, 1, 2, 3]) {
      const { selected } = roomCutaway(level, {
        avatar: { level: level.id, x: 2, z: 4 }, rotation, rooms,
      });
      assert.equal(selected.size, 16);
    }
  }
});

test('each stair style and width produces finite geometry in both directions', () => {
  for (const style of ['basic', 'masonry', 'timber', 'open', 'classic', 'iron']) {
    for (const width of [1, 2]) for (const rise of [-1, 1]) {
      const project = demoProject();
      for (const end of [project.stairs[0].a, project.stairs[0].b]) {
        Object.assign(end, { style, width, rise, z: rise === 1 ? 1 : 5 });
      }
      assert.deepEqual(validate(project), [], `${style} width ${width} rise ${rise}`);
      for (const rotation of [0, 1, 2, 3]) {
        const well = stairwell(project, project.stairs[0], rotation);
        assert.ok(well.faces.length > 0);
        assert.ok(well.faces.every(face => face.vertices.every(vertex => vertex.every(Number.isFinite))));
      }
    }
  }
});

test('old unstyled builds reopen for repair while current builds keep integrity checks', () => {
  const legacy = demoProject();
  for (const end of [legacy.stairs[0].a, legacy.stairs[0].b]) {
    delete end.style;
    end.rise = -1;
  }
  const recovered = openSpaceFile({
    format: 'lw-space-build', version: 2, requires: 'lw-studio-game-importer-v2',
    project: legacy, scene: {}, decor: {},
  });
  assert.match(validate(recovered).join(' '), /full stair flight needs floor tiles/);

  const current = buildSpace(demoProject());
  current.version = 2;
  current.requires = 'lw-studio-game-importer-v2';
  current.scene.background = ['red', 'blue'];
  assert.throws(() => openSpaceFile(current), /Build data does not match/);
});
