#!/bin/bash

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 项目根目录
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT"

# PID 文件
FRONTEND_PID_FILE="$PROJECT_ROOT/.dev-frontend.pid"
BACKEND_PID_FILE="$PROJECT_ROOT/.dev-backend.pid"


# 启动前清理端口占用
kill_ports() {
    echo -e "${YELLOW}检查并清理端口占用 (3000, 8000)...${NC}"
    PIDS=$(lsof -ti:3000,8000)
    if [ -n "$PIDS" ]; then
        echo -e "${BLUE}发现占用端口的进程，正在终止: $PIDS${NC}"
        kill -9 $PIDS 2>/dev/null
    else
        echo -e "${GREEN}端口空闲，无需处理${NC}"
    fi
}

# 清理函数
cleanup() {
    echo -e "\n${YELLOW}正在停止开发服务...${NC}"
    
    # 停止前端服务
    if [ -f "$FRONTEND_PID_FILE" ]; then
        FRONTEND_PID=$(cat "$FRONTEND_PID_FILE")
        if kill -0 "$FRONTEND_PID" 2>/dev/null; then
            echo -e "${BLUE}停止前端服务 (PID: $FRONTEND_PID)${NC}"
            kill -TERM "$FRONTEND_PID" 2>/dev/null
            wait "$FRONTEND_PID" 2>/dev/null
        fi
        rm -f "$FRONTEND_PID_FILE"
    fi
    
    # 停止后端服务
    if [ -f "$BACKEND_PID_FILE" ]; then
        BACKEND_PID=$(cat "$BACKEND_PID_FILE")
        if kill -0 "$BACKEND_PID" 2>/dev/null; then
            echo -e "${BLUE}停止后端服务 (PID: $BACKEND_PID)${NC}"
            kill -TERM "$BACKEND_PID" 2>/dev/null
            wait "$BACKEND_PID" 2>/dev/null
        fi
        rm -f "$BACKEND_PID_FILE"
    fi
    
    echo -e "${GREEN}开发服务已停止${NC}"
    exit 0
}

# 设置信号处理
trap cleanup SIGINT SIGTERM

# 检查命令是否存在
check_command() {
    if ! command -v "$1" &> /dev/null; then
        echo -e "${RED}错误: $1 未安装${NC}"
        return 1
    fi
    return 0
}

# 安装依赖函数
install_deps() {
    echo -e "${BLUE}开始安装依赖...${NC}"
    
    # 检查 pnpm
    if ! check_command pnpm; then
        echo -e "${YELLOW}尝试安装 pnpm...${NC}"
        npm install -g pnpm
        if ! check_command pnpm; then
            echo -e "${RED}pnpm 安装失败${NC}"
            exit 1
        fi
    fi
    
    # 安装前端依赖
    echo -e "${BLUE}安装前端依赖...${NC}"
    pnpm install
    
    # 检查并安装后端依赖
    if [ -d "backend" ]; then
        echo -e "${BLUE}安装后端依赖...${NC}"
        if ! check_command cargo; then
            echo -e "${YELLOW}Rust/Cargo 未安装，跳过后端依赖安装${NC}"
        else
            cd backend
            cargo build
            cd ..
        fi
    fi
    
    echo -e "${GREEN}依赖安装完成${NC}"
}

# 启动服务函数
start_services() {
    echo -e "${BLUE}启动开发服务...${NC}"

    kill_ports
    
    # 检查 pnpm
    if ! check_command pnpm; then
        echo -e "${RED}pnpm 未安装，请先运行: $0 install${NC}"
        exit 1
    fi
    
    # 启动后端服务（如果存在）
    if [ -d "backend" ] && check_command cargo; then
        echo -e "${BLUE}启动后端服务...${NC}"
        cd backend
        cargo watch -x run &
        BACKEND_PID=$!
        echo "$BACKEND_PID" > "$BACKEND_PID_FILE"
        echo -e "${GREEN}后端服务已启动 (PID: $BACKEND_PID)${NC}"
        cd ..
        
        # 等待后端启动
        sleep 3
    fi
    
    # 启动前端服务
    echo -e "${BLUE}启动前端服务...${NC}"
    pnpm run dev -H :: & # maybe use --experimental-https
    FRONTEND_PID=$!
    echo "$FRONTEND_PID" > "$FRONTEND_PID_FILE"
    echo -e "${GREEN}前端服务已启动 (PID: $FRONTEND_PID)${NC}"
    
    echo -e "${GREEN}开发服务启动完成！${NC}"
    echo -e "${YELLOW}按 Ctrl+C 停止所有服务${NC}"
    
    # 等待进程
    wait
}

# 显示帮助信息
show_help() {
    echo -e "${BLUE}用法: $0 [命令]${NC}"
    echo ""
    echo -e "${YELLOW}可用命令:${NC}"
    echo -e "  ${GREEN}install${NC}  - 安装项目依赖"
    echo -e "  ${GREEN}start${NC}    - 启动开发服务"
    echo -e "  ${GREEN}help${NC}     - 显示此帮助信息"
    echo ""
    echo -e "${YELLOW}示例:${NC}"
    echo -e "  $0 install   # 安装依赖"
    echo -e "  $0 start     # 启动服务"
    echo -e "  $0           # 默认启动服务"
}

# 主逻辑
case "${1:-start}" in
    "install")
        install_deps
        ;;
    "start")
        start_services
        ;;
    "help"|"-h"|"--help")
        show_help
        ;;
    *)
        echo -e "${RED}未知命令: $1${NC}"
        show_help
        exit 1
        ;;
esac