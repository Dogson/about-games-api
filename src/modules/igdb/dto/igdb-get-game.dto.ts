export type IGDBGame = {
  id: number;
  name: string;
  alternative_names?: {
    id: number;
    name: string;
  }[];
  release_dates?: {
    date: number; // Unix timestamp for release date
    // optionally: region, platform, etc.
  }[];
  involved_companies?: {
    company: {
      id: number;
      name: string;
      // optionally other company fields
    };
    // optionally other involved_companies fields
  }[];
  cover?: {
    url: string;
    // optionally: width, height, etc.
  };
  screenshots?: {
    url: string;
  }[];
  total_rating_count?: number; // optional, not all games have a rating
};
