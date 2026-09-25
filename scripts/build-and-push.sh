#!/usr/bin/env bash
# ==============================================================================
# Script Build & Push Docker Image lên Private Registry (registry.mrdnd.dev)
# ==============================================================================

set -euo pipefail

# Màu hiển thị
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Thư mục gốc project
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

# Cấu hình mặc định
REGISTRY="${REGISTRY:-registry.mrdnd.dev}"
IMAGE_NAME="${IMAGE_NAME:-ncc-app-english}"
PLATFORM="${PLATFORM:-linux/amd64}"
TAG="${TAG:-latest}"
SKIP_PUSH=false
NO_CACHE=false

# In trợ giúp
print_usage() {
    echo -e "${BLUE}Cách sử dụng:${NC}"
    echo "  $0 [TAG] [OPTIONS]"
    echo ""
    echo -e "${BLUE}Ví dụ:${NC}"
    echo "  $0                                   # Build & push với tag 'latest' cho linux/amd64"
    echo "  $0 v1.0.0                            # Build & push với tag 'v1.0.0' và 'latest'"
    echo "  $0 latest --no-cache                 # Build không dùng cache"
    echo "  $0 latest --skip-push                # Chỉ build cục bộ, không push"
    echo "  $0 latest --platform=linux/arm64     # Build cho platform khác"
    echo ""
    echo -e "${BLUE}Tùy chọn:${NC}"
    echo "  -t, --tag <tag>             Đặt tag cho image (mặc định: latest)"
    echo "  -p, --platform <platform>   Đặt platform (mặc định: linux/amd64)"
    echo "  -r, --registry <registry>   Đặt registry (mặc định: registry.mrdnd.dev)"
    echo "      --no-cache              Không dùng cache khi build"
    echo "      --skip-push             Chỉ build, không push lên registry"
    echo "  -h, --help                  Xem hướng dẫn này"
    exit 0
}

# Phân tích tham số dòng lệnh
while [[ $# -gt 0 ]]; do
    case "$1" in
        -h|--help)
            print_usage
            ;;
        -t|--tag)
            TAG="$2"
            shift 2
            ;;
        --tag=*)
            TAG="${1#*=}"
            shift
            ;;
        -p|--platform)
            PLATFORM="$2"
            shift 2
            ;;
        --platform=*)
            PLATFORM="${1#*=}"
            shift
            ;;
        -r|--registry)
            REGISTRY="$2"
            shift 2
            ;;
        --registry=*)
            REGISTRY="${1#*=}"
            shift
            ;;
        --no-cache)
            NO_CACHE=true
            shift
            ;;
        --skip-push)
            SKIP_PUSH=true
            shift
            ;;
        -*)
            echo -e "${RED}❌ Tham số không hợp lệ: $1${NC}"
            print_usage
            ;;
        *)
            # Nếu truyền tham số vị trí đầu tiên thì coi là TAG
            TAG="$1"
            shift
            ;;
    esac
done

FULL_IMAGE="${REGISTRY}/${IMAGE_NAME}:${TAG}"
LATEST_IMAGE="${REGISTRY}/${IMAGE_NAME}:latest"

echo -e "==========================================================="
echo -e "${BLUE}🚀 DOCKER BUILD & PUSH: ${NC}${FULL_IMAGE}"
echo -e "==========================================================="
echo -e "📦 Registry  : ${YELLOW}${REGISTRY}${NC}"
echo -e "🏷️  Tag       : ${YELLOW}${TAG}${NC}"
echo -e "🖥️  Platform  : ${YELLOW}${PLATFORM}${NC}"
echo -e "📂 Workdir   : ${ROOT_DIR}"
echo ""

# Kiểm tra docker CLI
if ! command -v docker &> /dev/null; then
    echo -e "${RED}❌ Lỗi: Không tìm thấy lệnh 'docker'. Vui lòng cài đặt Docker trước.${NC}"
    exit 1
fi

cd "${ROOT_DIR}"

# 1. Build Docker Image
echo -e "${BLUE}🔨 [1/2] Đang build Docker image...${NC}"
BUILD_ARGS=(
    build
    --platform "${PLATFORM}"
    -t "${FULL_IMAGE}"
)

# Nếu tag khác 'latest', gắn thêm tag 'latest'
if [[ "${TAG}" != "latest" ]]; then
    BUILD_ARGS+=(-t "${LATEST_IMAGE}")
fi

if [[ "${NO_CACHE}" == "true" ]]; then
    BUILD_ARGS+=(--no-cache)
fi

BUILD_ARGS+=(-f Dockerfile .)

docker "${BUILD_ARGS[@]}"

echo -e "${GREEN}✅ Build thành công:${NC} ${FULL_IMAGE}"
docker images "${REGISTRY}/${IMAGE_NAME}" --format "table {{.Repository}}:{{.Tag}}\t{{.Size}}\t{{.CreatedAt}}" | head -n 3
echo ""

# 2. Push Docker Image
if [[ "${SKIP_PUSH}" == "true" ]]; then
    echo -e "${YELLOW}⏭️  Bỏ qua bước push (--skip-push).${NC}"
else
    echo -e "${BLUE}📤 [2/2] Đang push image lên ${REGISTRY}...${NC}"
    
    # Kiểm tra login nếu cần
    if ! docker push "${FULL_IMAGE}"; then
        echo -e "${RED}❌ Push thất bại! Bạn có thể cần đăng nhập registry trước:${NC}"
        echo -e "   ${YELLOW}docker login ${REGISTRY}${NC}"
        exit 1
    fi

    # Nếu có tag khác latest, push cả latest
    if [[ "${TAG}" != "latest" ]]; then
        echo -e "${BLUE}📤 Đang push tag 'latest'...${NC}"
        docker push "${LATEST_IMAGE}"
    fi

    echo ""
    echo -e "==========================================================="
    echo -e "${GREEN}🎉 ĐÃ HOÀN TẤT BUILD & PUSH!${NC}"
    echo -e "==========================================================="
    echo -e "Để triển khai phiên bản mới trên VPS Linux:"
    echo -e "  ${YELLOW}ssh user@your-vps${NC}"
    echo -e "  ${YELLOW}cd /path/to/ncc-app-english${NC}"
    echo -e "  ${YELLOW}docker compose pull && docker compose up -d${NC}"
    echo -e "==========================================================="
fi
