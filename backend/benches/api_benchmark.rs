//! API 基准测试
//!
//! 使用 Criterion 进行精确的性能基准测试
//! 运行: cargo bench

use criterion::{black_box, criterion_group, criterion_main, BenchmarkId, Criterion};
use rocket::local::blocking::Client;

/// 创建测试客户端（只创建一次）
fn create_test_client() -> Client {
    let runtime = tokio::runtime::Runtime::new().expect("Failed to create runtime");
    let rocket = runtime.block_on(neo_space_backend::build_rocket_with_routes());
    Client::tracked(rocket).expect("valid rocket instance")
}

/// 基准测试：列出文章
fn bench_list_posts(c: &mut Criterion) {
    let client = create_test_client();

    c.bench_function("list_posts", |b| {
        b.iter(|| {
            let response = client.get("/api/posts?page=1&size=10").dispatch();
            black_box(response);
        });
    });
}

/// 基准测试：通过 slug 获取文章
fn bench_get_post_by_slug(c: &mut Criterion) {
    let client = create_test_client();

    // 先获取一个真实的 slug
    let list_response = client.get("/api/posts?page=1&size=1").dispatch();
    let body = list_response.into_string().expect("body");
    let json: serde_json::Value = serde_json::from_str(&body).expect("valid JSON");

    if let Some(first_post) = json["data"]["items"].as_array().and_then(|arr| arr.first()) {
        if let Some(slug) = first_post["slug"].as_str() {
            let slug = slug.to_string();

            c.bench_function("get_post_by_slug", |b| {
                b.iter(|| {
                    let response = client.get(format!("/api/posts/slug/{}", slug)).dispatch();
                    black_box(response);
                });
            });
        }
    }
}

/// 基准测试：获取配置（测试缓存性能）
fn bench_get_config(c: &mut Criterion) {
    let client = create_test_client();

    c.bench_function("get_config", |b| {
        b.iter(|| {
            let response = client.get("/api/config").dispatch();
            black_box(response);
        });
    });
}

/// 基准测试：列出日记
fn bench_list_notes(c: &mut Criterion) {
    let client = create_test_client();

    c.bench_function("list_notes", |b| {
        b.iter(|| {
            let response = client.get("/api/notes?page=1&size=10").dispatch();
            black_box(response);
        });
    });
}

/// 基准测试：列出分类
fn bench_list_categories(c: &mut Criterion) {
    let client = create_test_client();

    c.bench_function("list_categories", |b| {
        b.iter(|| {
            let response = client.get("/api/categories").dispatch();
            black_box(response);
        });
    });
}

/// 基准测试：不同分页大小的性能
fn bench_pagination_sizes(c: &mut Criterion) {
    let client = create_test_client();
    let mut group = c.benchmark_group("pagination_sizes");

    for size in [10, 20, 50, 100].iter() {
        group.bench_with_input(BenchmarkId::from_parameter(size), size, |b, &size| {
            b.iter(|| {
                let response = client
                    .get(format!("/api/posts?page=1&size={}", size))
                    .dispatch();
                black_box(response);
            });
        });
    }

    group.finish();
}

/// 基准测试：不同页码的性能
fn bench_pagination_pages(c: &mut Criterion) {
    let client = create_test_client();
    let mut group = c.benchmark_group("pagination_pages");

    for page in [1, 5, 10, 20].iter() {
        group.bench_with_input(BenchmarkId::from_parameter(page), page, |b, &page| {
            b.iter(|| {
                let response = client
                    .get(format!("/api/posts?page={}&size=10", page))
                    .dispatch();
                black_box(response);
            });
        });
    }

    group.finish();
}

/// 基准测试：混合端点性能
fn bench_mixed_endpoints(c: &mut Criterion) {
    let client = create_test_client();

    let endpoints = vec![
        "/api/posts?page=1&size=10",
        "/api/notes?page=1&size=10",
        "/api/categories",
        "/api/config",
        "/api/user/profile",
    ];

    let mut group = c.benchmark_group("mixed_endpoints");

    for (idx, endpoint) in endpoints.iter().enumerate() {
        group.bench_with_input(
            BenchmarkId::from_parameter(idx),
            endpoint,
            |b, &endpoint| {
                b.iter(|| {
                    let response = client.get(endpoint).dispatch();
                    black_box(response);
                });
            },
        );
    }

    group.finish();
}

criterion_group!(
    benches,
    bench_list_posts,
    bench_get_post_by_slug,
    bench_get_config,
    bench_list_notes,
    bench_list_categories,
    bench_pagination_sizes,
    bench_pagination_pages,
    bench_mixed_endpoints,
);

criterion_main!(benches);
