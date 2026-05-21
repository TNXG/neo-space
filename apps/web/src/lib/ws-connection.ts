// lib/ws-connection.ts

interface WSConnectionConfig {
  primaryUrl: string; // 快速但可能被拦截的地址
  fallbackUrl: string; // 备用地址
  onMessage: (data: any) => void;
  onStatusChange?: (status: ConnectionStatus) => void;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
}

export type ConnectionStatus
  = | "connecting_primary"
    | "connecting_fallback"
    | "connected_primary"
    | "connected_fallback"
    | "disconnected"
    | "blocked_detected"
    | "error";

interface FailureRecord {
  url: string;
  timestamp: number;
  duration: number; // 从尝试连接到失败经过的时间
  code?: number;
  reason?: string;
}

const ADGUARD_BLOCK_THRESHOLD_MS = 500; // 500ms 内失败大概率是被拦截
const BLOCK_MEMORY_KEY = "ws_blocked_urls";
const BLOCK_MEMORY_TTL = 5 * 60 * 1000; // 记住拦截状态 5 分钟

export class SmartWebSocket {
  private config: WSConnectionConfig;
  private ws: WebSocket | null = null;
  private currentUrl: string = "";
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectAttempts = 0;
  private isDestroyed = false;
  private failureHistory: FailureRecord[] = [];
  private status: ConnectionStatus = "disconnected";

  constructor(config: WSConnectionConfig) {
    this.config = {
      reconnectInterval: 3000,
      maxReconnectAttempts: 10,
      ...config,
    };
  }

  // ============ 公共 API ============

  connect() {
    this.isDestroyed = false;
    this.reconnectAttempts = 0;

    // 检查是否之前已经记住了 primary被拦截
    if (this.isUrlRememberedAsBlocked(this.config.primaryUrl)) {
      console.log("[WS] Primary URL was previously blocked, going straight to fallback");
      this.setStatus("blocked_detected");
      this.connectTo(this.config.fallbackUrl);
    } else {
      this.connectTo(this.config.primaryUrl);
    }
  }

  send(data: string | ArrayBuffer | Blob) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(data);
      return true;
    }
    console.warn("[WS] Cannot send, connection not open");
    return false;
  }

  disconnect() {
    this.isDestroyed = true;
    this.clearReconnectTimer();
    if (this.ws) {
      this.ws.onclose = null; // 防止触发重连
      this.ws.close(1000, "Client disconnect");
      this.ws = null;
    }
    this.setStatus("disconnected");
  }

  getStatus(): ConnectionStatus {
    return this.status;
  }

  getCurrentUrl(): string {
    return this.currentUrl;
  }

  // 手动清除拦截记忆（比如用户关闭了 AdGuard）
  clearBlockMemory() {
    try {
      sessionStorage.removeItem(BLOCK_MEMORY_KEY);
    } catch {}
    this.failureHistory = [];
  }

  // ============ 内部逻辑 ============

  private connectTo(url: string) {
    if (this.isDestroyed)
      return;

    this.cleanup();
    this.currentUrl = url;

    const isPrimary = url === this.config.primaryUrl;
    this.setStatus(isPrimary ? "connecting_primary" : "connecting_fallback");

    console.log(`[WS] Connecting to ${isPrimary ? "PRIMARY" : "FALLBACK"}: ${url}`);

    const startTime = Date.now();

    try {
      this.ws = new WebSocket(url);
    } catch (err) {
      // 构造函数直接抛异常 → 100% 被拦截
      console.error("[WS] WebSocket constructor threw:", err);
      this.handleBlockDetected(url, Date.now() - startTime);
      return;
    }

    // --- onopen ---
    this.ws.onopen = () => {
      const connectDuration = Date.now() - startTime;
      console.log(`[WS] Connected to ${url} in ${connectDuration}ms`);

      this.reconnectAttempts = 0;
      this.setStatus(isPrimary ? "connected_primary" : "connected_fallback");

      // 连接成功，如果是 primary，清除拦截记忆
      if (isPrimary) {
        this.removeBlockMemory(url);
      }
    };

    // --- onmessage ---
    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        this.config.onMessage(data);
      } catch {
        this.config.onMessage(event.data);
      }
    };

    // --- onerror ---
    this.ws.onerror = (event) => {
      const duration = Date.now() - startTime;
      console.error(`[WS] Error on ${url} after ${duration}ms`, event);

      // 记录失败
      this.failureHistory.push({
        url,
        timestamp: Date.now(),
        duration,
      });
    };

    // --- onclose ---
    this.ws.onclose = (event) => {
      const duration = Date.now() - startTime;

      console.log(`[WS] Closed: code=${event.code}, reason="${event.reason}", duration=${duration}ms`);

      const analysis = this.analyzeFailure(url, duration, event.code, event.reason);

      if (analysis === "blocked" && isPrimary) {
        this.handleBlockDetected(url, duration);
      } else if (analysis === "normal_close") {
        // 正常关闭，不重连
        this.setStatus("disconnected");
      } else {
        // 网络错误，按正常重连逻辑
        this.scheduleReconnect();
      }
    };

    // --- 连接超时保护 ---
    setTimeout(() => {
      if (this.ws?.readyState === WebSocket.CONNECTING) {
        console.warn(`[WS] Connection timeout for ${url}`);
        this.ws.close();
      }
    }, 10000);
  }

  /**
   * 分析失败原因
   * 返回: 'blocked' | 'network_error' | 'normal_close'
   */
  private analyzeFailure(
    url: string,
    duration: number,
    code?: number,
    _reason?: string,
  ): "blocked" | "network_error" | "normal_close" {
    // 正常关闭
    if (code === 1000 || code === 1001) {
      return "normal_close";
    }

    // ===== AdGuard 拦截特征检测 =====

    // 特征1: 极快失败 (< 500ms) + 异常关闭码 (1006)
    // AdGuard 拦截通常在 0-100ms 内就失败了
    if (duration < ADGUARD_BLOCK_THRESHOLD_MS && (code === 1006 || code === undefined)) {
      console.log(`[WS] Suspiciously fast failure (${duration}ms) - likely blocked`);

      // 特征2: 从未成功打开过（onopen 没触发就 close 了）
      // ws.readyState 此时已经是 CLOSED
      // 我们通过 status 判断：如果还在 connecting 就失败了
      if (this.status === "connecting_primary" || this.status === "connecting_fallback") {
        return "blocked";
      }
    }

    // 特征3: 连续快速失败 → 大概率被拦截
    const recentFailures = this.failureHistory.filter(
      f => f.url === url && f.timestamp > Date.now() - 30000 // 最近30秒
        && f.duration < ADGUARD_BLOCK_THRESHOLD_MS,
    );

    if (recentFailures.length >= 2) {
      console.log(`[WS] ${recentFailures.length} rapid failures in 30s - likely blocked`);
      return "blocked";
    }

    return "network_error";
  }

  /**
   * 检测到拦截后的处理
   */
  private handleBlockDetected(url: string, duration: number) {
    console.warn(`[WS] 🛡️ Ad-blocker detected! URL ${url} blocked (failed in ${duration}ms)`);

    this.setStatus("blocked_detected");
    this.rememberBlockedUrl(url);

    // 如果被拦截的是 primary，立即切换到 fallback
    if (url === this.config.primaryUrl) {
      console.log("[WS] Switching to fallback URL...");
      this.reconnectAttempts = 0; // 重置重试计数
      setTimeout(() => {
        this.connectTo(this.config.fallbackUrl);
      }, 100);
    } else {
      // fallback 也失败了，那就正常重连逻辑
      this.scheduleReconnect();
    }
  }

  /**
   * 重连调度
   */
  private scheduleReconnect() {
    if (this.isDestroyed)
      return;

    const maxAttempts = this.config.maxReconnectAttempts!;
    if (this.reconnectAttempts >= maxAttempts) {
      console.error(`[WS] Max reconnect attempts (${maxAttempts}) reached`);

      // 如果在 fallback 上也耗尽重试，尝试切回 primary
      if (this.currentUrl === this.config.fallbackUrl) {
        console.log("[WS] Fallback exhausted, retrying primary...");
        this.removeBlockMemory(this.config.primaryUrl);
        this.reconnectAttempts = 0;
        this.connectTo(this.config.primaryUrl);
        return;
      }

      this.setStatus("error");
      return;
    }

    // 指数退避: 3s, 6s, 12s, 24s... 最大60s
    const delay = Math.min(
      this.config.reconnectInterval! * (2 ** this.reconnectAttempts),
      60000,
    );

    console.log(`[WS] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts + 1}/${maxAttempts})`);

    this.reconnectTimer = setTimeout(() => {
      this.reconnectAttempts++;
      this.connectTo(this.currentUrl);
    }, delay);
  }

  // ============ 拦截记忆 (SessionStorage) ============

  private rememberBlockedUrl(url: string) {
    try {
      const blocked = this.getBlockMemory();
      blocked[url] = Date.now();
      sessionStorage.setItem(BLOCK_MEMORY_KEY, JSON.stringify(blocked));
    } catch {}
  }

  private removeBlockMemory(url: string) {
    try {
      const blocked = this.getBlockMemory();
      delete blocked[url];
      sessionStorage.setItem(BLOCK_MEMORY_KEY, JSON.stringify(blocked));
    } catch {}
  }

  private isUrlRememberedAsBlocked(url: string): boolean {
    const blocked = this.getBlockMemory();
    const timestamp = blocked[url];
    if (!timestamp)
      return false;

    // 超过 TTL 就忘记（用户可能关了 AdGuard）
    if (Date.now() - timestamp > BLOCK_MEMORY_TTL) {
      this.removeBlockMemory(url);
      return false;
    }
    return true;
  }

  private getBlockMemory(): Record<string, number> {
    try {
      return JSON.parse(sessionStorage.getItem(BLOCK_MEMORY_KEY) || "{}");
    } catch {
      return {};
    }
  }

  // ============ 工具方法 ============

  private cleanup() {
    this.clearReconnectTimer();
    if (this.ws) {
      this.ws.onopen = null;
      this.ws.onmessage = null;
      this.ws.onerror = null;
      this.ws.onclose = null;
      if (this.ws.readyState === WebSocket.OPEN
        || this.ws.readyState === WebSocket.CONNECTING) {
        this.ws.close();
      }
      this.ws = null;
    }
  }

  private clearReconnectTimer() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  private setStatus(status: ConnectionStatus) {
    this.status = status;
    this.config.onStatusChange?.(status);
  }
}
