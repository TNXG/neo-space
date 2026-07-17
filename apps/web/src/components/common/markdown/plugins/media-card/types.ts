export type MediaSource = "bangumi" | "tmdb";

export interface MediaCardData {
  url: string;
  source: MediaSource;
  sourceLabel: string;
  title: string;
  originalTitle?: string;
  description?: string;
  posterUrl?: string;
  backdropUrl?: string;
  releaseDate?: string;
  mediaType?: string;
  rating?: number;
  genres: string[];
}
