#[rocket::launch]
async fn rocket() -> _ {
    neo_space_backend::build_rocket_with_routes().await
}
