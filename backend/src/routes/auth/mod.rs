mod avatar;
mod bind;
mod oauth;
mod user;

// 重新导出所有路由处理函数
pub use avatar::update_avatar;
pub use bind::{bind_anonymous_identity, get_bindable_identities, skip_bind};
pub use oauth::{oauth_callback, oauth_redirect};
pub use user::{get_accounts, get_current_user};

/// 注册所有认证路由
pub fn routes() -> Vec<rocket::Route> {
    routes![
        oauth_redirect,
        oauth_callback,
        get_current_user,
        get_accounts,
        bind_anonymous_identity,
        skip_bind,
        update_avatar,
        get_bindable_identities,
    ]
}
