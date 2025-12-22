#!/bin/bash

# 代码目录转 Markdown 脚本
# 用法: ./code-to-markdown.sh <目录路径> [输出文件名]
# 示例: ./code-to-markdown.sh backend/src/routes/auth auth-routes.md

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 检查参数
if [ $# -lt 1 ]; then
  echo -e "${RED}错误: 缺少必需参数${NC}"
  echo "用法: $0 <目录路径> [输出文件名]"
  echo "示例: $0 backend/src/routes/auth auth-routes.md"
  exit 1
fi

INPUT_DIR="$1"
OUTPUT_FILE="${2:-output.md}"

# 检查目录是否存在
if [ ! -d "$INPUT_DIR" ]; then
  echo -e "${RED}错误: 目录 '$INPUT_DIR' 不存在${NC}"
  exit 1
fi

# 获取绝对路径
INPUT_DIR=$(cd "$INPUT_DIR" && pwd)
DIR_NAME=$(basename "$INPUT_DIR")

echo -e "${GREEN}开始处理目录: $INPUT_DIR${NC}"
echo -e "${YELLOW}输出文件: $OUTPUT_FILE${NC}"

# 生成文件树的函数
generate_tree() {
  local dir="$1"
  local prefix="$2"
  local is_last="$3"
  
  local items=($(ls -A "$dir" 2>/dev/null | sort))
  local count=${#items[@]}
  
  for i in "${!items[@]}"; do
    local item="${items[$i]}"
    local path="$dir/$item"
    local is_last_item=false
    
    if [ $((i + 1)) -eq $count ]; then
      is_last_item=true
    fi
    
    if [ -d "$path" ]; then
      if $is_last_item; then
        echo "${prefix}└── $item/"
        generate_tree "$path" "${prefix}    " true
      else
        echo "${prefix}├── $item/"
        generate_tree "$path" "${prefix}│   " false
      fi
    else
      if $is_last_item; then
        echo "${prefix}└── $item"
      else
        echo "${prefix}├── $item"
      fi
    fi
  done
}

# 获取文件扩展名对应的语言标识
get_language() {
  local file="$1"
  local ext="${file##*.}"
  
  case "$ext" in
    rs) echo "rust" ;;
    js) echo "javascript" ;;
    ts) echo "typescript" ;;
    tsx) echo "tsx" ;;
    jsx) echo "jsx" ;;
    py) echo "python" ;;
    go) echo "go" ;;
    java) echo "java" ;;
    c) echo "c" ;;
    cpp|cc|cxx) echo "cpp" ;;
    h|hpp) echo "cpp" ;;
    sh) echo "bash" ;;
    json) echo "json" ;;
    yaml|yml) echo "yaml" ;;
    toml) echo "toml" ;;
    md) echo "markdown" ;;
    html) echo "html" ;;
    css) echo "css" ;;
    sql) echo "sql" ;;
    *) echo "text" ;;
  esac
}

# 递归处理文件的函数
process_files() {
  local dir="$1"
  local relative_path="$2"
  
  # 获取所有文件和目录，排序
  local items=($(ls -A "$dir" 2>/dev/null | sort))
  
  for item in "${items[@]}"; do
    local path="$dir/$item"
    local rel_path="$relative_path/$item"
    
    if [ -d "$path" ]; then
      # 递归处理子目录
      process_files "$path" "$rel_path"
    elif [ -f "$path" ]; then
      # 处理文件
      local lang=$(get_language "$item")
      
      echo "" >> "$OUTPUT_FILE"
      echo "## \`$rel_path\`" >> "$OUTPUT_FILE"
      echo "" >> "$OUTPUT_FILE"
      echo "\`\`\`$lang" >> "$OUTPUT_FILE"
      cat "$path" >> "$OUTPUT_FILE"
      echo "" >> "$OUTPUT_FILE"
      echo "\`\`\`" >> "$OUTPUT_FILE"
      echo "" >> "$OUTPUT_FILE"
      
      echo -e "${GREEN}✓${NC} 已处理: $rel_path"
    fi
  done
}

# 开始生成 Markdown
echo "# $DIR_NAME 代码文档" > "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"
echo "生成时间: $(date '+%Y-%m-%d %H:%M:%S')" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"
echo "源目录: \`$INPUT_DIR\`" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"

# 生成文件树
echo "## 📁 文件树结构" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"
echo "\`\`\`" >> "$OUTPUT_FILE"
echo "$DIR_NAME/" >> "$OUTPUT_FILE"
generate_tree "$INPUT_DIR" "" false >> "$OUTPUT_FILE"
echo "\`\`\`" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"

# 生成文件内容
echo "## 📄 文件内容" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"

# 处理所有文件
process_files "$INPUT_DIR" "$DIR_NAME"

echo ""
echo -e "${GREEN}✅ 完成！${NC}"
echo -e "输出文件: ${YELLOW}$OUTPUT_FILE${NC}"
echo -e "文件大小: $(du -h "$OUTPUT_FILE" | cut -f1)"
