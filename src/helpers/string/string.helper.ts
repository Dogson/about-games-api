export function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function normalizeString(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '') // remove all non-alphanumeric chars
    .replace(/\s+/g, ' ') // collapse multiple spaces
    .trim();
}

export function removeMatchesFromString(str: string, regexp: RegExp): string {
  return str.replace(regexp, '');
}

export function removeAllWhitespaces(str: string): string {
  return str.replace(/\s+/g, '');
}

export function removeAllAccents(str: string): string {
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

export function removePossessives(input: string): string {
  return (
    input
      // handles "’s" and "'s" (smart + straight apostrophes)
      .replace(/['’]s\b/gi, '')
  );
}
