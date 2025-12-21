mod oauth;
mod user;
mod bind;
mod avatar;

// 重新导出所有路由处理函数
pub use oauth::{oauth_redirect, oauth_callback};
pub use user::{get_current_user, get_accounts};
pub use bind::{bind_anonymous_identity, skip_bind, get_bindable_identities};
pub use avatar::update_avatar;

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
