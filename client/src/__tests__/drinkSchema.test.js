// Client lists of categories/fields/keys are derived from, or pinned to, shared/drink-schema.json.
import schema from '../../../shared/drink-schema.json';
import { CATEGORIES, PRODUCER_FIELD, NAME_FIELD, REGION_SEP } from '../utils/filterHelpers';
import { FIELDS } from '../utils/drinkFields';

describe('client constants come from shared/drink-schema.json', () => {
  it('categories, producer/name keys and the region separator', () => {
    expect(CATEGORIES).toEqual(schema.categories);
    expect(PRODUCER_FIELD).toEqual({ ...schema.producerKey, all: '_producer' });
    expect(NAME_FIELD).toEqual(schema.nameKey);
    expect(REGION_SEP).toBe(schema.regionSeparator);
  });

  it('the Admin form has exactly the schema fields, in order', () => {
    for (const c of schema.categories) {
      expect(FIELDS[c].map(f => f.key)).toEqual(schema.fields[c]);
    }
  });
});
