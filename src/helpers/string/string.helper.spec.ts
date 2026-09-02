import {
  escapeRegExp,
  normalizeString,
  removeMatchesFromString,
  removeAllWhitespaces,
  removeAllAccents,
  removePossessives,
  normalizeGameName,
} from './string.helper';

describe('string helpers', () => {
  describe('escapeRegExp', () => {
    it('escapes regex metacharacters', () => {
      expect(escapeRegExp('a.b*c?')).toBe('a\\.b\\*c\\?');
    });

    it('leaves plain strings untouched', () => {
      expect(escapeRegExp('uncharted 4')).toBe('uncharted 4');
    });
  });

  describe('normalizeString', () => {
    it('lowercases, strips non-alphanumeric and collapses spaces', () => {
      expect(normalizeString('  The Witcher® 3: Wild Hunt!  ')).toBe(
        'the witcher 3 wild hunt',
      );
    });
  });

  describe('removeMatchesFromString', () => {
    it('removes all occurrences of the regex', () => {
      expect(removeMatchesFromString('(2020) demo (2020)', /\(\d{4}\)/g)).toBe(
        ' demo ',
      );
    });
  });

  describe('removeAllWhitespaces', () => {
    it('removes every whitespace character', () => {
      expect(removeAllWhitespaces('a b\tc\nd')).toBe('abcd');
    });
  });

  describe('removeAllAccents', () => {
    it('removes combining diacritics', () => {
      expect(removeAllAccents('Pokémon Èàç')).toBe('Pokemon Eac');
    });
  });

  describe('removePossessives', () => {
    it('removes straight and smart possessive endings', () => {
      expect(removePossessives("Mario's World")).toBe('Mario World');
      expect(removePossessives('The Cat’s Meow')).toBe('The Cat Meow');
    });
  });

  describe('normalizeGameName', () => {
    it('produces a canonical game-name key', () => {
      expect(
        normalizeGameName('Tom Clancy’s Splinter Cell: Chaos Theory!'),
      ).toBe('tomclancysplintercellchaostheory');
    });

    it('handles accented and whitespace-heavy inputs', () => {
      expect(normalizeGameName('  Résident Évil  4  ')).toBe('residentevil4');
    });
  });
});
