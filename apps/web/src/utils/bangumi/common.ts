import type {
  BangumiCharacterCollection,
  BangumiCharacterCollectionResponse,
  BangumiMediaCollection,
  BangumiMediaKind,
  BangumiPersonCollection,
  BangumiPersonCollectionResponse,
  BangumiProfile,
  BangumiSubjectCollectionResponse,
  BangumiUserResponse,
} from "@/types/bangumi";

/** 将后端用户响应压缩为页面需要的公开资料。 */
export function normalizeBangumiProfile(
  user: BangumiUserResponse,
): BangumiProfile {
  return {
    username: user.username,
    nickname: user.nickname,
    sign: user.sign,
    avatar: user.avatar?.large || user.avatar?.medium || user.avatar?.small,
  };
}

/** 将一个作品收藏转换为稳定站内类型，并过滤私密或异常条目。 */
export function normalizeBangumiMedia(
  item: BangumiSubjectCollectionResponse,
  kind: BangumiMediaKind,
): BangumiMediaCollection | null {
  if (item.private || !item.subject) {
    return null;
  }
  return {
    subjectId: item.subject_id,
    kind,
    status: item.type,
    title: item.subject.name_cn || item.subject.name,
    originalTitle: item.subject.name,
    summary: item.subject.short_summary,
    date: item.subject.date,
    images: item.subject.images,
    score: item.subject.score,
    rank: item.subject.rank,
    rate: item.rate,
    episodeProgress: item.ep_status,
    episodes: item.subject.eps,
    volumeProgress: item.vol_status,
    volumes: item.subject.volumes,
    comment: item.comment || undefined,
    tags: item.tags,
    updatedAt: item.updated_at,
  };
}

/** 将作品收藏页转换为页面可直接消费的条目。 */
export function normalizeBangumiMediaPage(
  items: BangumiSubjectCollectionResponse[],
  kind: BangumiMediaKind,
): BangumiMediaCollection[] {
  return items.flatMap((item) => {
    const normalized = normalizeBangumiMedia(item, kind);
    return normalized ? [normalized] : [];
  });
}

/** 将虚构角色收藏转换为页面类型。 */
export function normalizeBangumiCharacter(
  item: BangumiCharacterCollectionResponse,
): BangumiCharacterCollection {
  return {
    id: item.id,
    name: item.name,
    type: item.type,
    images: item.images,
    createdAt: item.created_at,
    crop: item.crop,
  };
}

/** 将现实人物收藏转换为页面类型。 */
export function normalizeBangumiPerson(
  item: BangumiPersonCollectionResponse,
): BangumiPersonCollection {
  return {
    id: item.id,
    name: item.name,
    type: item.type,
    careers: item.career ?? [],
    images: item.images,
    createdAt: item.created_at,
    crop: item.crop,
  };
}
