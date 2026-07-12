import { findDuplicate } from '../utils/filterHelpers';

const wines = [
  { id: '1', producer: 'Chateau Margaux', seriesAndName: 'Grand Vin' },
  { id: '2', producer: 'Domaine Leflaive', seriesAndName: 'Puligny-Montrachet' },
];

test('finds an exact match on producer + name', () => {
  expect(findDuplicate(wines, 'wine', 'Chateau Margaux', 'Grand Vin')).toEqual(wines[0]);
});

test('matches case-insensitively', () => {
  expect(findDuplicate(wines, 'wine', 'CHATEAU MARGAUX', 'grand vin')).toEqual(wines[0]);
});

test('matches with surrounding whitespace trimmed', () => {
  expect(findDuplicate(wines, 'wine', '  Chateau Margaux ', ' Grand Vin  ')).toEqual(wines[0]);
});

test('excludes the given id (editing itself is not a duplicate)', () => {
  expect(findDuplicate(wines, 'wine', 'Chateau Margaux', 'Grand Vin', '1')).toBeNull();
});

test('still flags a collision with a different entry when editing', () => {
  expect(findDuplicate(wines, 'wine', 'Chateau Margaux', 'Grand Vin', '2')).toEqual(wines[0]);
});

test('returns null when producer is empty', () => {
  expect(findDuplicate(wines, 'wine', '', 'Grand Vin')).toBeNull();
});

test('returns null when name is empty', () => {
  expect(findDuplicate(wines, 'wine', 'Chateau Margaux', '')).toBeNull();
});

test('returns null when there is no match', () => {
  expect(findDuplicate(wines, 'wine', 'Chateau Margaux', 'Second Wine')).toBeNull();
});

test('uses the category-specific field mapping (beer: brewery + name)', () => {
  const beers = [{ id: '1', brewery: 'Stone', name: 'IPA' }];
  expect(findDuplicate(beers, 'beer', 'Stone', 'IPA')).toEqual(beers[0]);
  expect(findDuplicate(beers, 'beer', 'Stone', 'Other Beer')).toBeNull();
});
