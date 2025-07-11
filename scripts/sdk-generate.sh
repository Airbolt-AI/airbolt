#!/bin/bash
# SDK Generation Script - Minimal version with Docker
set -euo pipefail

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if Docker is running
if ! docker info &> /dev/null; then
    echo -e "${RED}❌ Docker is not running${NC}"
    echo "Please start Docker Desktop and try again"
    exit 1
fi

# Generate OpenAPI spec if needed
if [[ ! -f "apps/backend-api/openapi.json" ]] || [[ "$1" == "--force" ]]; then
    echo "📄 Generating OpenAPI specification..."
    pnpm openapi:generate
fi

# Validate Fern configuration
echo "✓ Validating Fern configuration..."
fern check

# Generate SDK
echo "🚀 Generating browser SDK..."
fern generate --local

# Build SDK package
echo "📦 Building SDK package..."
cd packages/sdk && pnpm build && cd -

echo -e "${GREEN}✅ SDK generation complete!${NC}"
echo ""
echo "Generated SDK: packages/sdk/generated/"