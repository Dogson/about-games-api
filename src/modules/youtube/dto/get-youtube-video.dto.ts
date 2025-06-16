export interface YouTubeVideoItem {
  title: string;
  description: string;
  videoId: string;
  publishedAt: string;
}

interface YouTubePlaylistItemSnippet {
  title: string;
  description: string;
  publishedAt: string;
  resourceId: {
    videoId: string;
  };
}

interface YouTubePlaylistItem {
  snippet: YouTubePlaylistItemSnippet;
}

export interface YouTubePlaylistItemsListResponse {
  items: YouTubePlaylistItem[];
  nextPageToken?: string;
}
