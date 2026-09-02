export type IGDBGame = {
  id: number;
  name: string;
  first_release_date?: number; // Unix timestamp for the earliest release date
  alternative_names?: {
    id: number;
    name: string;
  }[];
  release_dates?: {
    id?: number;
    date?: number; // Unix timestamp for release date, absent on TBD/partial dates
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
