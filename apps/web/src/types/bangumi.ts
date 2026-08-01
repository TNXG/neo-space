import type { PaginatedData } from "@/types/api";

export type BangumiMediaKind = "anime" | "game" | "book";
export type BangumiLibrarySection = BangumiMediaKind | "characters" | "persons";
export type BangumiCollectionStatus = 1 | 2 | 3 | 4 | 5;
export type BangumiCharacterType = 1 | 2 | 3 | 4;
export type BangumiPersonType = 1 | 2 | 3;
export type BangumiPersonCareer =
  | "producer"
  | "mangaka"
  | "artist"
  | "seiyu"
  | "writer"
  | "illustrator"
  | "actor";

export interface BangumiImages {
  large?: string;
  medium?: string;
  common?: string;
  small?: string;
  grid?: string;
}

export interface BangumiProfile {
  username: string;
  nickname: string;
  avatar?: string;
  sign?: string;
}

export interface BangumiUserResponse {
  username: string;
  nickname: string;
  sign?: string;
  avatar?: {
    large?: string;
    medium?: string;
    small?: string;
  };
}

export interface BangumiSubjectCollectionResponse {
  subject_id: number;
  rate: number;
  type: BangumiCollectionStatus;
  comment?: string | null;
  tags: string[];
  ep_status: number;
  vol_status: number;
  updated_at: string;
  private: boolean;
  subject?: {
    name: string;
    name_cn: string;
    short_summary: string;
    date?: string;
    images?: BangumiImages;
    score: number;
    rank: number;
    eps: number;
    volumes: number;
  };
}

export interface BangumiCharacterCollectionResponse {
  id: number;
  name: string;
  type: BangumiCharacterType;
  images?: BangumiImages;
  created_at: string;
  crop?: BangumiImageCrop;
}

export interface BangumiPersonCollectionResponse {
  id: number;
  name: string;
  type: BangumiPersonType;
  career?: BangumiPersonCareer[];
  images?: BangumiImages;
  created_at: string;
  crop?: BangumiImageCrop;
}

export interface BangumiImageCrop {
  _id: string;
  sourceType: "character" | "person";
  sourceId: number;
  centerX: number;
  centerY: number;
  scale: number;
  cropLeft?: number;
  cropTop?: number;
  cropWidth?: number;
  cropHeight?: number;
  confidence: number;
  detectorVersion: string;
  imageUrlHash?: string;
  updatedAt: string;
}

export interface BangumiMediaCollection {
  subjectId: number;
  kind: BangumiMediaKind;
  status: BangumiCollectionStatus;
  title: string;
  originalTitle: string;
  summary: string;
  date?: string;
  images?: BangumiImages;
  score: number;
  rank: number;
  rate: number;
  episodeProgress: number;
  episodes: number;
  volumeProgress: number;
  volumes: number;
  comment?: string;
  tags: string[];
  updatedAt: string;
}

export interface BangumiCharacterCollection {
  id: number;
  name: string;
  type: BangumiCharacterType;
  images?: BangumiImages;
  createdAt: string;
  crop?: BangumiImageCrop;
}

export interface BangumiPersonCollection {
  id: number;
  name: string;
  type: BangumiPersonType;
  careers: BangumiPersonCareer[];
  images?: BangumiImages;
  createdAt: string;
  crop?: BangumiImageCrop;
}

export interface BangumiLibraryData {
  profile: BangumiProfile;
  initialAnimePage: PaginatedData<BangumiMediaCollection>;
}
