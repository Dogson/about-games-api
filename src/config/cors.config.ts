const DEFAULT_LOCALHOST_ORIGIN = /http:\/\/localhost:\d+/;

export function parseCorsOrigins(
  value: string | undefined,
): (string | RegExp)[] {
  const origins = (value ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);

  return origins.length > 0 ? origins : [DEFAULT_LOCALHOST_ORIGIN];
}
