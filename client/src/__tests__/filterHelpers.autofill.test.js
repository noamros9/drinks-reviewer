import { autofillOrigin } from '../utils/filterHelpers';

const KEYS = ['country', 'region'];
const empty = { country: '', region: '' };

const drinks = [
  { producer: 'Torres', country: 'Spain',  region: 'Penedès' },
  { producer: 'Torres', country: 'Chile',  region: 'Curicó' },
  { producer: 'Torres', country: 'Spain',  region: 'Priorat' },
  { producer: 'Solo',   country: 'Italy' },
];

test('fills empty fields with the most common value for that producer', () => {
  const { patch, auto } = autofillOrigin(drinks, 'producer', 'Torres', KEYS, empty);
  expect(patch).toEqual({ country: 'Spain', region: 'Penedès' });
  expect(auto).toEqual(patch);
});

test('a tie keeps the first value encountered', () => {
  const tied = [
    { producer: 'Torres', country: 'Chile' },
    { producer: 'Torres', country: 'Spain' },
  ];
  expect(autofillOrigin(tied, 'producer', 'Torres', ['country'], empty).patch).toEqual({ country: 'Chile' });
});

test('matches the producer case- and whitespace-insensitively', () => {
  expect(autofillOrigin(drinks, 'producer', '  toRRes ', ['country'], empty).patch).toEqual({ country: 'Spain' });
});

test('an empty producer changes nothing and keeps the previous bookkeeping', () => {
  const prev = { country: 'Spain' };
  expect(autofillOrigin(drinks, 'producer', '   ', KEYS, empty, prev)).toEqual({ patch: {}, auto: prev });
});

test('an unknown producer changes nothing', () => {
  expect(autofillOrigin(drinks, 'producer', 'Nobody', KEYS, empty).patch).toEqual({});
});

test('leaves a hand-typed value alone', () => {
  const form = { country: 'Portugal', region: '' };
  const { patch, auto } = autofillOrigin(drinks, 'producer', 'Torres', KEYS, form);
  expect(patch).toEqual({ region: 'Penedès' });
  expect(auto.country).toBeUndefined();
});

test('replaces a value we autofilled ourselves', () => {
  const form = { country: 'Italy', region: '' };
  const prev = { country: 'Italy' };
  const { patch, auto } = autofillOrigin(drinks, 'producer', 'Torres', KEYS, form, prev);
  expect(patch.country).toBe('Spain');
  expect(auto.country).toBe('Spain');
});

test('skips keys the producer has no value for', () => {
  expect(autofillOrigin(drinks, 'producer', 'Solo', KEYS, empty).patch).toEqual({ country: 'Italy' });
});

test('only touches the requested keys', () => {
  expect(autofillOrigin(drinks, 'producer', 'Torres', ['country'], empty).patch).toEqual({ country: 'Spain' });
});

test('emits no patch when the field already holds the winning value', () => {
  const form = { country: 'Spain', region: '' };
  const prev = { country: 'Spain' };
  expect(autofillOrigin(drinks, 'producer', 'Torres', ['country'], form, prev).patch).toEqual({});
});

test('reads the producer from the category-specific key', () => {
  const beers = [{ brewery: 'Duvel', country: 'Belgium' }];
  expect(autofillOrigin(beers, 'brewery', 'Duvel', ['country'], empty).patch).toEqual({ country: 'Belgium' });
});

test('tolerates a missing producer value on either side', () => {
  expect(autofillOrigin(drinks, 'producer', undefined, KEYS, empty)).toEqual({ patch: {}, auto: {} });
  const sparse = [{ country: 'Nowhere' }, { producer: 'Torres', country: 'Spain' }];
  expect(autofillOrigin(sparse, 'producer', 'Torres', ['country'], empty).patch).toEqual({ country: 'Spain' });
});
