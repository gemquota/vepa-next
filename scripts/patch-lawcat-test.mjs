// Update lawCategories tests for the 9-category layout (WRAP retired → BUOYANCY + TOROIDAL EDGES param).
import { readFileSync, writeFileSync } from 'node:fs';

const f = new URL('../tests/unit/lawCategories.test.js', import.meta.url);
let s = readFileSync(f, 'utf8');
let miss = 0;
const sub = (a, b) => {
  if (!s.includes(a)) { console.error('MISS:', a.slice(0, 70)); miss++; return; }
  s = s.replace(a, b);
};

sub(
`  it('has 8 categories; all 128 laws mapped except WRAP (boundary condition)', () => {
    const names = Object.keys(LAW_CATEGORIES);
    expect(names).toHaveLength(8);
    expect(LAW_CATEGORIES.physics.laws).toHaveLength(15); // WRAP is a solver boundary condition
    for (const [catName, cat] of Object.entries(LAW_CATEGORIES)) {
      if (catName === 'physics') continue;
      expect(cat.laws.length, \`category \${catName}\`).toBe(16);
    }
    expect(LAW_CATEGORIES.electromagnetism.laws.length).toBe(16);
    expect(LAW_CATEGORIES.information.laws.length).toBe(16);
    expect(LAW_CATEGORIES.quantum.laws.length).toBe(16);
    expect(LAW_COUNT).toBe(128);
    const mapped = Object.values(LAW_CATEGORIES).reduce((n, c) => n + c.laws.length, 0);
    expect(mapped).toBe(127);
    for (let i = 0; i < LAW_COUNT; i++) {
      if (i === LAW_INDEXES.WRAP) continue;
      expect(LAW_TO_CATEGORY[i], \`law \${i}\`).toBeDefined();
      expect(LAW_COLOR_BY_INDEX[i], \`law \${i}\`).toBeDefined();
    }
    expect(LAW_TO_CATEGORY[LAW_INDEXES.WRAP]).toBeUndefined();
    expect(LAW_COLOR_BY_INDEX[LAW_INDEXES.WRAP]).toBeUndefined();
    expect(LAW_COUNT).toBe(Math.max(...Object.values(LAW_INDEXES)) + 1);
  });`,
`  it('has 9 categories; all 128 laws mapped (WRAP retired → BUOYANCY + TOROIDAL param)', () => {
    const names = Object.keys(LAW_CATEGORIES);
    expect(names).toHaveLength(9);
    expect(names).toContain('mechanics'); // slate-grey off-rainbow category
    expect(LAW_CATEGORIES.physics.laws).toHaveLength(11);   // WRAP out, BUOYANCY in
    expect(LAW_CATEGORIES.mechanics.laws).toHaveLength(5);  // TIDE/ELASTICITY/TURBULENCE/CENTRIPETAL/ROTATION
    for (const [catName, cat] of Object.entries(LAW_CATEGORIES)) {
      if (catName === 'physics' || catName === 'mechanics') continue;
      expect(cat.laws.length, \`category \${catName}\`).toBe(16);
    }
    expect(LAW_COUNT).toBe(128);
    const mapped = Object.values(LAW_CATEGORIES).reduce((n, c) => n + c.laws.length, 0);
    expect(mapped).toBe(128); // every bit documented, including old WRAP bit 3 (now BUOYANCY)
    for (let i = 0; i < LAW_COUNT; i++) {
      expect(LAW_TO_CATEGORY[i], \`law \${i}\`).toBeDefined();
      expect(LAW_COLOR_BY_INDEX[i], \`law \${i}\`).toBeDefined();
    }
    expect('WRAP' in LAW_INDEXES).toBe(false);
    expect(LAW_TO_CATEGORY[LAW_INDEXES.BUOYANCY]).toBe('physics');
    expect(LAW_TO_CATEGORY[LAW_INDEXES.ROTATION]).toBe('mechanics');
    expect(LAW_COLOR_BY_INDEX[LAW_INDEXES.TIDE]).toBe('SLATE');
    expect(LAW_COUNT).toBe(Math.max(...Object.values(LAW_INDEXES)) + 1);
  });`);

sub(
`    // WRAP lives outside the category maps but is still a documented law.
    const wrapName = NAME_BY_IDX[LAW_INDEXES.WRAP];
    expect(LAW_HELP_DB[wrapName], wrapName).toBeDefined();
    expect(LAW_HELP_DB[wrapName].hint).toBeTruthy();
    expect(LAW_HELP_DB[wrapName].explanation).toBeTruthy();
    expect(LAW_HELP_DB[wrapName].system).toBeTruthy();`,
`    // WRAP is gone; its help entry was replaced by BUOYANCY.
    expect(LAW_HELP_DB.WRAP).toBeUndefined();
    expect(LAW_HELP_DB.BUOYANCY.hint).toBeTruthy();
    expect(LAW_HELP_DB.BUOYANCY.explanation).toBeTruthy();
    expect(LAW_HELP_DB.BUOYANCY.system).toBeTruthy();`);

if (miss) process.exit(1);
writeFileSync(f, s);
console.log('lawCategories test OK');
