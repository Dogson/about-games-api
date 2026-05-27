export function createProgressBar(current: number, total: number): string {
  const ratio = Math.min(Math.max(current / total, 0), 1);
  const filled = Math.round(ratio * 20);
  const empty = 20 - filled;

  const bar = '█'.repeat(filled) + '░'.repeat(empty);

  const percent = Math.round(ratio * 100);

  return `[${bar}] ${percent}%`;
}
