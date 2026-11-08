use super::{format_bytes, render_progress_bar};

#[test]
fn renders_bounded_download_progress_bar() {
    assert_eq!(render_progress_bar(0), "[--------------------]");
    assert_eq!(render_progress_bar(50), "[##########----------]");
    assert_eq!(render_progress_bar(120), "[####################]");
}

#[test]
fn formats_downloaded_bytes_compactly() {
    assert_eq!(format_bytes(512), "512 B");
    assert_eq!(format_bytes(1536), "1.5 KiB");
    assert_eq!(format_bytes(2 * 1024 * 1024), "2.0 MiB");
}
