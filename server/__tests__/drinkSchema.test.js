// Every server-side list of categories/fields/keys is derived from shared/drink-schema.json,
// the one definition the client reads too.
const schema = require('../../shared/drink-schema.json');

describe('server constants come from shared/drink-schema.json', () => {
  it('routes use the schema categories', () => {
    const router = require('../routes/drinks');
    expect(router.CATEGORIES).toBe(schema.categories);
  });

  it('public producer/name keys match the schema', () => {
    const { NAME_FIELDS } = require('../publicFields');
    for (const c of schema.categories) {
      expect(NAME_FIELDS[c]).toEqual([schema.producerKey[c], schema.nameKey[c]]);
    }
  });

  it('every category has producer/name keys among its fields, and bulk fields are real fields', () => {
    for (const c of schema.categories) {
      expect(schema.fields[c]).toEqual(expect.arrayContaining([schema.producerKey[c], schema.nameKey[c]]));
      expect(schema.fields[c]).toEqual(expect.arrayContaining(schema.bulkEditable[c]));
    }
  });
});
