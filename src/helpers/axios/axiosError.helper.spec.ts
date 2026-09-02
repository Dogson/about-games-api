import { isAxiosError } from './axiosError.helper';

describe('isAxiosError', () => {
  it('narrows an IGDB-shaped axios error', () => {
    const error = {
      response: {
        status: 429,
        data: { error: { message: 'rate limit exceeded' } },
      },
    };

    expect(isAxiosError(error)).toBe(true);
    if (isAxiosError(error)) {
      expect(error.response.data.error.message).toBe('rate limit exceeded');
      expect(error.response.status).toBe(429);
    }
  });

  it('returns false for null and primitives', () => {
    expect(isAxiosError(null)).toBe(false);
    expect(isAxiosError('boom')).toBe(false);
    expect(isAxiosError(42)).toBe(false);
    expect(isAxiosError(undefined)).toBe(false);
  });

  it('returns false when the response shape is missing', () => {
    expect(isAxiosError({ request: {} })).toBe(false);
    expect(isAxiosError({ response: null })).toBe(false);
    expect(isAxiosError({ response: { data: 'text' } })).toBe(false);
    expect(isAxiosError({ response: { data: { error: null } } })).toBe(false);
    expect(
      isAxiosError({ response: { data: { message: 'no error obj' } } }),
    ).toBe(false);
  });
});
