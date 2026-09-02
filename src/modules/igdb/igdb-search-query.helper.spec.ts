import { parseIgdbSearchQuery } from './igdb-search-query.helper';

describe('parseIgdbSearchQuery', () => {
  it('detects an explicit id search', () => {
    expect(parseIgdbSearchQuery('id:123')).toEqual({ mode: 'id', id: 123 });
  });

  it('detects an id search with spaces and uppercase', () => {
    expect(parseIgdbSearchQuery('ID: 456')).toEqual({ mode: 'id', id: 456 });
  });

  it('id takes precedence over year-ish content', () => {
    expect(parseIgdbSearchQuery('id:99 Uncharted 4')).toEqual({
      mode: 'id',
      id: 99,
    });
  });

  it('parses a plain name search', () => {
    expect(parseIgdbSearchQuery('Uncharted 4')).toEqual({
      mode: 'name',
      name: 'Uncharted 4',
      year: null,
    });
  });

  it('extracts a year from parentheses', () => {
    expect(parseIgdbSearchQuery('Uncharted 4 (2015)')).toEqual({
      mode: 'name',
      name: 'Uncharted 4',
      year: 2015,
    });
  });

  it('strips surrounding quotes from the name', () => {
    expect(parseIgdbSearchQuery('"The Last of Us"')).toEqual({
      mode: 'name',
      name: 'The Last of Us',
      year: null,
    });
  });

  it('trims remaining whitespace after removing the year', () => {
    expect(parseIgdbSearchQuery('  God of War  (2018)  ')).toEqual({
      mode: 'name',
      name: 'God of War',
      year: 2018,
    });
  });
});
