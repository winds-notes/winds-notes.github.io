const test = require('node:test');
const assert = require('node:assert/strict');
require('../native-file.js');
const {WindsFile} = globalThis;

function notebook() {
  return {
    id: 'existing-notebook', title: 'Physics', cover: 'blue',
    pages: [{id: 'existing-page', template: 'grid', orientation: 'landscape', items: [
      {id: 'existing-stroke', type: 'stroke', tool: 'artist', grade: '6B',
        color: '#123456', size: 8, points: [[12, 30, .4], [40, 70, .9]]},
      {id: 'existing-shape', type: 'shape', kind: 'circle', x: 10, y: 20, w: 80, h: 80,
        color: '#654321', size: 3, fillColor: '#abcdef', fillOpacity: .5, strokeStyle: 'dotted'}
    ]}]
  };
}

function ids(book) {
  return [book.id, ...book.pages.flatMap(p => [p.id, ...p.items.map(item => item.id)])];
}

test('WiNDS and Folio backups import independent copies without changing originals', () => {
  for (const format of ['winds-notes-backup', 'folio-notes-backup']) {
    const original = notebook();
    const before = structuredClone(original);
    const text = JSON.stringify({format, version: 1, notebooks: [original, original]});
    const first = WindsFile.parse(text);
    const second = WindsFile.parse(text);
    assert.equal(first.single, false);
    assert.equal(first.notebooks.length, 2);
    const allIds = [...ids(original), ...first.notebooks.flatMap(ids), ...second.notebooks.flatMap(ids)];
    assert.equal(new Set(allIds).size, allIds.length);
    assert.deepEqual(original, before);
    const imported = first.notebooks[0];
    assert.equal(imported.title, original.title);
    assert.equal(imported.pages[0].orientation, 'landscape');
    assert.equal(imported.pages[0].items[0].grade, '6B');
    assert.deepEqual(imported.pages[0].items[0].points, original.pages[0].items[0].points);
    assert.equal(imported.pages[0].items[1].fillColor, '#abcdef');
    assert.equal(imported.pages[0].items[1].fillOpacity, .5);
    assert.equal(imported.pages[0].items[1].strokeStyle, 'dotted');
  }
});

test('a damaged object rejects the entire multi-notebook backup', () => {
  for (const damaged of [
    {type: 'stroke', tool: 'pen', points: [[null, 5]]},
    {type: 'image', src: 'https://example.com/image.png'},
    {type: 'unknown'}
  ]) {
    const valid = notebook();
    const invalid = notebook();
    invalid.pages[0].items.push(damaged);
    const text = JSON.stringify({format: 'winds-notes-backup', notebooks: [valid, invalid]});
    assert.throws(() => WindsFile.parse(text), /Damaged pen stroke|Invalid embedded image|Unsupported or damaged page object/);
    assert.equal(valid.pages[0].items.length, 2);
  }
});

test('legacy backup objects receive compatible optional defaults', () => {
  const original = notebook();
  delete original.pages[0].orientation;
  const [stroke, shape] = original.pages[0].items;
  delete stroke.grade;
  delete shape.fillColor;
  delete shape.fillOpacity;
  delete shape.strokeStyle;
  const imported = WindsFile.parse(JSON.stringify({format: 'folio-notes-backup', notebooks: [original]})).notebooks[0];
  assert.equal(imported.pages[0].orientation, 'portrait');
  assert.equal(imported.pages[0].items[0].grade, 'HB');
  assert.equal(imported.pages[0].items[1].fillColor, null);
  assert.equal(imported.pages[0].items[1].strokeStyle, 'solid');
});
