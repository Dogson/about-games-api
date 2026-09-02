import { createProgressBar } from './progressBar';

describe('createProgressBar', () => {
  it('renders a full bar at 100%', () => {
    expect(createProgressBar(10, 10)).toBe(`[${'█'.repeat(20)}] 100%`);
  });

  it('renders an empty bar at 0%', () => {
    expect(createProgressBar(0, 10)).toBe(`[${'░'.repeat(20)}] 0%`);
  });

  it('clamps values above 100%', () => {
    expect(createProgressBar(20, 10)).toBe(`[${'█'.repeat(20)}] 100%`);
  });

  it('clamps negative ratios to 0', () => {
    expect(createProgressBar(-3, 10)).toBe(`[${'░'.repeat(20)}] 0%`);
  });

  it('renders an intermediate progress', () => {
    const bar = createProgressBar(2, 10);
    expect(bar).toContain('] 20%');
    expect(bar).toHaveLength(20 + 2 + 1 + 3);
  });
});
