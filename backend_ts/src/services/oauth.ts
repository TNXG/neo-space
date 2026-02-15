/**
 * OAuth 服务
 *
 * 提供统一的 OAuth 服务入口，管理多个 OAuth 提供商
 */

interface OAuthUserInfo {
  provider: "github" | "qq";
  providerId: string;
  nickname: string;
  avatar: string;
  email?: string;
  accessToken?: string;
}

/**
 * GitHub OAuth 提供商
 */
class GitHubOAuthProvider {
  constructor(
    private clientId: string,
    private clientSecret: string,
  ) {}

  /**
   * 交换授权码获取 access_token
   */
  private async exchangeCode(code: string): Promise<string> {
    const tokenUrl = "https://github.com/login/oauth/access_token";

    const params = new URLSearchParams({
      client_id: this.clientId,
      client_secret: this.clientSecret,
      code,
    });

    const response = await fetch(tokenUrl, {
      method: "POST",
      headers: {
        "Accept": "application/json",
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": "Mozilla/5.0 (compatible; MaigoStarlightChecker/1.0)",
      },
      body: params,
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`GitHub token 请求失败 (${response.status}): ${text}`);
    }

    const data = await response.json();
    return data.access_token;
  }

  /**
   * 获取 GitHub 用户信息
   */
  private async getUser(accessToken: string): Promise<any> {
    const userUrl = "https://api.github.com/user";

    const response = await fetch(userUrl, {
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "User-Agent": "Mozilla/5.0 (compatible; MaigoStarlightChecker/1.0)",
      },
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`GitHub 用户信息请求失败 (${response.status}): ${text}`);
    }

    return response.json();
  }

  /**
   * 使用授权码换取用户信息
   */
  async exchangeCodeForUser(code: string): Promise<OAuthUserInfo> {
    // 1. 交换授权码获取 access_token
    const accessToken = await this.exchangeCode(code);

    // 2. 获取用户信息
    const user = await this.getUser(accessToken);

    // 3. 转换为统一的用户信息格式
    return {
      provider: "github",
      providerId: user.id.toString(),
      nickname: user.login,
      avatar: user.avatar_url,
      email: user.email || undefined,
      accessToken,
    };
  }
}

/**
 * QQ OAuth 提供商
 */
class QQOAuthProvider {
  constructor(private redirectUri: string) {}

  /**
   * 生成 QQ OAuth 授权 URL
   */
  getAuthorizeUrl(): string {
    return `https://api-space.tnxg.top/oauth/qq/authorize?redirect=true&return_url=${encodeURIComponent(this.redirectUri)}`;
  }

  /**
   * 使用授权码获取 QQ 用户信息
   */
  private async getUserInfoWithCode(code: string): Promise<any> {
    const userUrl = `https://api-space.tnxg.top/user/get?code=${code}`;

    const response = await fetch(userUrl);

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`QQ 用户信息请求失败 (${response.status}): ${text}`);
    }

    const apiResponse = await response.json();

    if (apiResponse.status !== "success") {
      const msg = apiResponse.message || "获取用户信息失败";
      throw new Error(msg);
    }

    if (!apiResponse.data) {
      throw new Error("响应中缺少用户数据");
    }

    return apiResponse.data;
  }

  /**
   * 使用授权码换取用户信息
   */
  async exchangeCodeForUser(code: string): Promise<OAuthUserInfo> {
    const userData = await this.getUserInfoWithCode(code);

    return {
      provider: "qq",
      providerId: userData.qq_openid,
      nickname: userData.nickname,
      avatar: userData.avatar,
      email: undefined, // QQ 不提供邮箱
      accessToken: undefined, // QQ 使用 code 而非 access_token
    };
  }
}

/**
 * OAuth 统一服务
 */
export class OAuthService {
  private github?: GitHubOAuthProvider;
  private qq?: QQOAuthProvider;

  constructor(
    githubClientId?: string,
    githubClientSecret?: string,
    qqRedirectUri?: string,
  ) {
    if (githubClientId && githubClientSecret) {
      this.github = new GitHubOAuthProvider(githubClientId, githubClientSecret);
    }

    if (qqRedirectUri) {
      this.qq = new QQOAuthProvider(qqRedirectUri);
    }
  }

  /**
   * 使用授权码交换用户信息（GitHub）
   */
  async exchangeGitHubCode(code: string): Promise<OAuthUserInfo> {
    if (!this.github) {
      throw new Error("GitHub OAuth 未配置");
    }
    return this.github.exchangeCodeForUser(code);
  }

  /**
   * 使用授权码交换用户信息（QQ）
   */
  async exchangeQQCode(code: string): Promise<OAuthUserInfo> {
    if (!this.qq) {
      throw new Error("QQ OAuth 未配置");
    }
    return this.qq.exchangeCodeForUser(code);
  }

  /**
   * 获取 QQ 授权 URL
   */
  getQQAuthorizeUrl(): string {
    if (!this.qq) {
      throw new Error("QQ OAuth 未配置");
    }
    return this.qq.getAuthorizeUrl();
  }
}

export type { OAuthUserInfo };
