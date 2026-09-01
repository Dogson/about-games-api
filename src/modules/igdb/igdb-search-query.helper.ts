export type IgdbSearchQuery =
  | { mode: 'id'; id: number }
  | { mode: 'name'; name: string; year: number | null };

export type IgdbSearchOptions = {
  year?: number;
  limit?: number;
};

/**
 * Parse a raw `/games/igdbSearch` query string into an IGDB search request.
 *
 * Supported syntax:
 * - `id:123` -> search by IGDB game id (takes precedence over everything else)
 * - `Uncharted 4 (2015)` -> restrict results to games released that year
 */
export function parseIgdbSearchQuery(search: string): IgdbSearchQuery {
  const idMatch = search.match(/id:\s*(\d+)/i);
  if (idMatch) {
    return { mode: 'id', id: Number(idMatch[1]) };
  }

  const yearMatch = search.match(/\((\d{4})\)/);
  const year = yearMatch ? Number(yearMatch[1]) : null;

  const name = search
    .replace(/\(\d{4}\)/g, '')
    .trim()
    .replace(/^"|"$/g, '');

  return { mode: 'name', name, year };
}
