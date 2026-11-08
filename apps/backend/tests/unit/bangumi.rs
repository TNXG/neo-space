use super::{BangumiLibrarySection, library_path};

/// 作品状态筛选必须映射到官方 type 参数，分页参数由请求函数追加。
#[test]
fn builds_media_library_path_with_upstream_status() {
    let path = library_path("test user", BangumiLibrarySection::Anime, Some(3)).ok();
    assert_eq!(
        path.as_deref(),
        Some("/users/test%20user/collections?subject_type=2&type=3")
    );
}

/// 非法收藏状态应在访问上游前被拒绝。
#[test]
fn rejects_invalid_collection_status() {
    assert!(library_path("test", BangumiLibrarySection::Book, Some(6)).is_err());
}
