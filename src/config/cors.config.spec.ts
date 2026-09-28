import { parseCorsOrigins } from './cors.config';

describe('parseCorsOrigins', () => {
  it('falls back to the localhost regex when the value is undefined', () => {
    const origins = parseCorsOrigins(undefined);

    expect(origins).toHaveLength(1);
    expect(origins[0]).toBeInstanceOf(RegExp);
    expect((origins[0] as RegExp).test('http://localhost:5173')).toBe(true);
  });

  it('falls back to the localhost regex when the value is empty', () => {
    expect(parseCorsOrigins('   ')).toHaveLength(1);
  });

  it('splits, trims and filters a comma-separated list', () => {
    expect(
      parseCorsOrigins(
        'https://aboutgames.gwen.cool , https://admin.gwen.cool,',
      ),
    ).toEqual(['https://aboutgames.gwen.cool', 'https://admin.gwen.cool']);
  });

  it('returns a single origin as a one-element array', () => {
    expect(parseCorsOrigins('https://aboutgames.gwen.cool')).toEqual([
      'https://aboutgames.gwen.cool',
    ]);
  });
});
