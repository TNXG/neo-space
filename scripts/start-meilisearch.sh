#!/bin/bash

# =======================================================
# Meilisearch 安装与启动两用脚本
# 特性：
# 1. 独立解析 GitHub Release，内置架构识别，免官方脚本。
# 2. 支持 GITHUB_TOKEN 绕过 API 限流，配备直链下载兜底。
# 3. 真随机 Master Key 自动生成与持久化存储。
# 4. Systemd 守护进程自启动集成，权限严格分离。
# =======================================================

set -e

# --- 变量配置 ---
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

BASE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MEILISEARCH_PORT=7700
MEILISEARCH_HOST="0.0.0.0"
MEILISEARCH_DATA_DIR="${BASE_DIR}/data/meilisearch"
ENV_FILE="${MEILISEARCH_DATA_DIR}/.env"

ACTION=${1:-run}

# --- 核心方法 ---

require_root() {
    if [ "$EUID" -ne 0 ]; then
        echo -e "${RED}错误：该操作需要 root 权限。请使用 'sudo $0 $ACTION'${NC}"
        exit 1
    fi
}

warn_root() {
    if [ "$EUID" -eq 0 ]; then
        echo -e "${YELLOW}警告：通常不需要使用 root 执行前台运行。这可能会导致生成的数据文件存在权限问题！${NC}"
    fi
}

generate_master_key() {
    tr -dc A-Za-z0-9 </dev/urandom | head -c 32
}

ensure_env() {
    mkdir -p "${MEILISEARCH_DATA_DIR}"
    
    if [ ! -f "${ENV_FILE}" ]; then
        echo -e "${BLUE}初始化配置并生成真随机 Master Key...${NC}"
        local NEW_KEY=$(generate_master_key)
        echo "MEILISEARCH_MASTER_KEY=${NEW_KEY}" > "${ENV_FILE}"
        chmod 600 "${ENV_FILE}"
        echo -e "${GREEN}已生成 Master Key 并安全保存在: ${ENV_FILE}${NC}"
    fi
    
    if [ "$EUID" -eq 0 ]; then
        local ACTUAL_USER=${SUDO_USER:-$(whoami)}
        local ACTUAL_GROUP=$(id -gn $ACTUAL_USER)
        chown -R ${ACTUAL_USER}:${ACTUAL_GROUP} "${BASE_DIR}/data"
    fi
}

# --- 路由执行 ---
case "$ACTION" in
    install)
        echo -e "${GREEN}=== Meilisearch 安装与配置模式 ===${NC}"
        require_root
        
        # 1. 下载并安装 Meilisearch
        if ! command -v meilisearch &> /dev/null; then
            echo -e "${BLUE}检测系统架构并从 GitHub 获取最新 Meilisearch...${NC}"
            
            # (1) 解析操作系统与架构
            OS_NAME="unknown"
            case "$(uname -s)" in
                Linux*) OS_NAME="linux" ;;
                Darwin*) OS_NAME="macos" ;;
                *) echo -e "${RED}不支持的操作系统: $(uname -s)${NC}"; exit 1 ;;
            esac
            
            ARCH_NAME="unknown"
            case "$(uname -m)" in
                x86_64|amd64) ARCH_NAME="amd64" ;;
                aarch64|arm64)
                    if [ "$OS_NAME" = "macos" ]; then
                        ARCH_NAME="apple-silicon"
                    else
                        ARCH_NAME="aarch64"
                    fi
                    ;;
                *) echo -e "${RED}不支持的系统架构: $(uname -m)${NC}"; exit 1 ;;
            esac
            
            ASSET_NAME="meilisearch-${OS_NAME}-${ARCH_NAME}"
            echo -e "${GREEN}-> 目标架构文件: ${ASSET_NAME}${NC}"
            
            # (2) 访问 GitHub API 获取下载链接，带认证提升限额机制
            GH_API_URL="https://api.github.com/repos/meilisearch/meilisearch/releases/latest"
            
            if [ -n "$GITHUB_TOKEN" ]; then
                echo -e "${BLUE}-> 检测到 GITHUB_TOKEN，将使用认证请求提升 API 额度 (5000次/小时)${NC}"
                API_RESPONSE=$(curl -s -H "Authorization: token $GITHUB_TOKEN" "$GH_API_URL")
            elif [ -n "$GH_TOKEN" ]; then
                echo -e "${BLUE}-> 检测到 GH_TOKEN，将使用认证请求提升 API 额度 (5000次/小时)${NC}"
                API_RESPONSE=$(curl -s -H "Authorization: token $GH_TOKEN" "$GH_API_URL")
            else
                echo -e "${YELLOW}-> 提示: 未设置 GITHUB_TOKEN，使用匿名请求 (60次/小时)。如果频繁失败，请配置环境变量。${NC}"
                API_RESPONSE=$(curl -s "$GH_API_URL")
            fi
            
            DOWNLOAD_URL=""
            if echo "$API_RESPONSE" | grep -q "API rate limit exceeded"; then
                echo -e "${YELLOW}-> 警告: GitHub API 请求频率已超限！${NC}"
                echo -e "${BLUE}-> 正在启用备用通道: 直接跳转下载最新的二进制文件...${NC}"
                DOWNLOAD_URL="https://github.com/meilisearch/meilisearch/releases/latest/download/${ASSET_NAME}"
            else
                # 解析 JSON 提取对应的 browser_download_url
                DOWNLOAD_URL=$(echo "$API_RESPONSE" | grep "browser_download_url" | grep "${ASSET_NAME}\"" | head -n 1 | cut -d '"' -f 4)
                if [ -z "$DOWNLOAD_URL" ]; then
                    echo -e "${RED}错误: 无法在 API 响应中解析出 ${ASSET_NAME} 的下载链接。${NC}"
                    echo -e "${YELLOW}-> 尝试使用备用通道兜底...${NC}"
                    DOWNLOAD_URL="https://github.com/meilisearch/meilisearch/releases/latest/download/${ASSET_NAME}"
                fi
            fi
            
            echo -e "${BLUE}-> 下载链接: ${DOWNLOAD_URL}${NC}"
            
            # (3) 下载与安全验证
            echo -e "${BLUE}-> 开始下载... (可能需要一些时间)${NC}"
            curl -L -o ./meilisearch "${DOWNLOAD_URL}"
            
            # 校验下载是否有效 (排除空文件或错误下载了 404 网页)
            if [ ! -s ./meilisearch ]; then
                echo -e "${RED}错误: 下载失败，文件为空。${NC}"
                rm -f ./meilisearch
                exit 1
            fi
            
            if head -n 1 ./meilisearch | grep -qE "<html|<!DOCTYPE|Not Found"; then
                echo -e "${RED}错误: 下载失败，链接无效或网络被拦截 (返回了网页而不是二进制)。${NC}"
                rm -f ./meilisearch
                exit 1
            fi
            
            chmod +x ./meilisearch
            mv ./meilisearch /usr/local/bin/meilisearch
            echo -e "${GREEN}Meilisearch 已成功安装到 /usr/local/bin/meilisearch${NC}"
        else
            echo -e "${GREEN}Meilisearch 已安装 ($(meilisearch --version | awk '{print $2}'))，跳过下载。${NC}"
        fi

        # 2. 生成配置和 Key
        ensure_env

        # 3. 创建 Systemd 自启动项
        if command -v systemctl &> /dev/null; then
            ACTUAL_USER=${SUDO_USER:-$(whoami)}
            SERVICE_FILE="/etc/systemd/system/meilisearch.service"
            
            echo -e "${BLUE}正在为用户 ${ACTUAL_USER} 创建 Systemd 自启动项...${NC}"
            
            cat > "$SERVICE_FILE" <<EOF
[Unit]
Description=Meilisearch Daemon
After=network.target

[Service]
Type=simple
User=${ACTUAL_USER}
WorkingDirectory=${BASE_DIR}
EnvironmentFile=${ENV_FILE}
ExecStart=/usr/local/bin/meilisearch --http-addr "${MEILISEARCH_HOST}:${MEILISEARCH_PORT}" --db-path "${MEILISEARCH_DATA_DIR}" --env development
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
EOF
            systemctl daemon-reload
            systemctl enable meilisearch.service
            systemctl restart meilisearch.service
            echo -e "${GREEN}Systemd 服务已创建并启动 (meilisearch.service)${NC}"
        else
            echo -e "${YELLOW}未检测到 systemctl，跳过自启动项创建。${NC}"
        fi
        
        echo -e "${GREEN}安装与初始化完成！${NC}"
        echo -e "以后您可以直接运行 ${YELLOW}$0 start${NC} 后台启动，或使用 ${YELLOW}$0 run${NC} 前台调试。"
        ;;
        
    start)
        echo -e "${GREEN}=== 启动 Meilisearch ===${NC}"
        if command -v systemctl &> /dev/null && [ -f "/etc/systemd/system/meilisearch.service" ]; then
            echo -e "${BLUE}通过 systemctl 启动服务...${NC}"
            sudo systemctl start meilisearch
            echo -e "${GREEN}服务已在后台运行！${NC}"
        else
            echo -e "${YELLOW}未检测到 Systemd 服务，转为前台运行...${NC}"
            exec "$0" run
        fi
        ;;
        
    stop)
        echo -e "${GREEN}=== 停止 Meilisearch ===${NC}"
        if command -v systemctl &> /dev/null && [ -f "/etc/systemd/system/meilisearch.service" ]; then
            echo -e "${BLUE}通过 systemctl 停止服务...${NC}"
            sudo systemctl stop meilisearch
            echo -e "${GREEN}后台服务已停止！${NC}"
        else
            if lsof -Pi :${MEILISEARCH_PORT} -sTCP:LISTEN -t >/dev/null 2>&1; then
                PID=$(lsof -ti:${MEILISEARCH_PORT})
                kill -9 $PID
                echo -e "${GREEN}已停止占用此端口的进程 ${PID}${NC}"
            else
                echo -e "${YELLOW}未检测到运行中的 Meilisearch 进程。${NC}"
            fi
        fi
        ;;
        
    run)
        echo -e "${GREEN}=== Meilisearch 前台运行模式 ===${NC}"
        warn_root
        
        if ! command -v meilisearch &> /dev/null; then
            echo -e "${RED}Meilisearch 未安装，请先执行: sudo $0 install${NC}"
            exit 1
        fi

        ensure_env
        source "${ENV_FILE}"
        export MEILISEARCH_MASTER_KEY

        if lsof -Pi :${MEILISEARCH_PORT} -sTCP:LISTEN -t >/dev/null 2>&1; then
            echo -e "${YELLOW}端口 ${MEILISEARCH_PORT} 已被占用${NC}"
            echo -n "是否要停止现有的进程？(y/n): "
            read -r response
            if [[ "$response" =~ ^([yY][eE][sS]|[yY])$ ]]; then
                PID=$(lsof -ti:${MEILISEARCH_PORT})
                kill -9 $PID
                echo -e "${GREEN}已停止进程 ${PID}${NC}"
                sleep 1
            else
                echo -e "${RED}启动取消${NC}"
                exit 1
            fi
        fi

        echo -e "${BLUE}端口: ${MEILISEARCH_PORT}${NC}"
        echo -e "${BLUE}主机: ${MEILISEARCH_HOST}${NC}"
        echo -e "${BLUE}配置: ${ENV_FILE}${NC}"
        echo ""

        trap 'echo -e "\n${YELLOW}Meilisearch 前台进程已停止${NC}"' EXIT

        exec meilisearch \
            --http-addr "${MEILISEARCH_HOST}:${MEILISEARCH_PORT}" \
            --db-path "${MEILISEARCH_DATA_DIR}" \
            --env development
        ;;
        
    *)
        echo -e "${RED}未知命令: $ACTION${NC}"
        echo -e "使用方法: $0 {install|start|stop|run}"
        echo -e "  install : (需 sudo) 环境检测、安装与 Systemd 注册"
        echo -e "  start   : 后台启动服务"
        echo -e "  stop    : 停止后台服务"
        echo -e "  run     : 前台运行调试"
        exit 1
        ;;
esac