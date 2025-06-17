export interface YouTubeVideoItem {
  title: string;
  description: string;
  videoId: string;
  publishedAt: string;
  thumbnailUrl: string;
}

interface YouTubePlaylistItemSnippet {
  title: string;
  description: string;
  publishedAt: string;
  resourceId: {
    videoId: string;
  };
  thumbnails?: {
    high?: {
      url: string;
    };
  };
}

interface YouTubePlaylistItem {
  snippet: YouTubePlaylistItemSnippet;
}

export interface YouTubePlaylistItemsListResponse {
  items: YouTubePlaylistItem[];
  nextPageToken?: string;
}
