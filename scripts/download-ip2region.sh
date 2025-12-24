#!/bin/bash

# IP2Region 数据库下载脚本

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 数据库文件 URL
IPV4_URL="https://github.com/lionsoul2014/ip2region/raw/master/data/ip2region_v4.xdb"
IPV6_URL="https://github.com/lionsoul2014/ip2region/raw/master/data/ip2region_v6.xdb"

# 目标目录
DATA_DIR="$(dirname "$0")/../backend/data"

echo -e "${GREEN}IP2Region 数据库下载工具${NC}"
echo "================================"
echo ""

# 创建数据目录
mkdir -p "$DATA_DIR"
cd "$DATA_DIR"

# 检查是否已存在
if [ -f "ip2region_v4.xdb" ] && [ -f "ip2region_v6.xdb" ]; then
    echo -e "${YELLOW}数据库文件已存在${NC}"
    read -p "是否重新下载？(y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "取消下载"
        exit 0
    fi
fi

# 下载 IPv4 数据库
echo -e "${GREEN}正在下载 IPv4 数据库...${NC}"
if command -v curl &> /dev/null; then
    curl -L -o ip2region_v4.xdb "$IPV4_URL"
elif command -v wget &> /dev/null; then
    wget -O ip2region_v4.xdb "$IPV4_URL"
else
    echo -e "${RED}错误: 未找到 curl 或 wget 命令${NC}"
    exit 1
fi

# 下载 IPv6 数据库
echo -e "${GREEN}正在下载 IPv6 数据库...${NC}"
if command -v curl &> /dev/null; then
    curl -L -o ip2region_v6.xdb "$IPV6_URL"
elif command -v wget &> /dev/null; then
    wget -O ip2region_v6.xdb "$IPV6_URL"
else
    echo -e "${RED}错误: 未找到 curl 或 wget 命令${NC}"
    exit 1
fi

echo ""
echo -e "${GREEN}✓ 下载完成！${NC}"
echo ""
echo "文件位置:"
echo "  - $(pwd)/ip2region_v4.xdb"
echo "  - $(pwd)/ip2region_v6.xdb"
echo ""
echo "现在可以重启后端服务以启用 IP 地理位置查询功能。"
