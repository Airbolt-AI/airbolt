#!/bin/bash
# SDK Generation Script - Smart Caching Version
set -euo pipefail

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
CACHE_DIR=".sdk-cache"
CACHE_FILE="$CACHE_DIR/generation-cache.json"
BACKUP_DIR="$CACHE_DIR/backup"
SDK_DIR="packages/sdk/generated"

# Ensure cache directory exists
mkdir -p "$CACHE_DIR"
mkdir -p "$BACKUP_DIR"

# Function to calculate hash of inputs
calculate_input_hash() {
    local openapi_hash=""
    local fern_hash=""
    
    # Calculate OpenAPI hash
    if [[ -f "apps/backend-api/openapi.json" ]]; then
        openapi_hash=$(shasum -a 256 "apps/backend-api/openapi.json" | cut -d' ' -f1)
    fi
    
    # Calculate Fern config hash
    if [[ -d "fern" ]]; then
        fern_hash=$(find fern -type f \( -name "*.yml" -o -name "*.yaml" -o -name "*.json" \) -exec shasum -a 256 {} \; | sort | shasum -a 256 | cut -d' ' -f1)
    fi
    
    # Combine hashes
    echo "${openapi_hash}-${fern_hash}"
}

# Function to check if generation is needed
is_generation_needed() {
    local current_hash="$1"
    
    # Check if cache file exists
    if [[ ! -f "$CACHE_FILE" ]]; then
        return 0  # Generation needed
    fi
    
    # Check if generated directory exists
    if [[ ! -d "$SDK_DIR" ]]; then
        return 0  # Generation needed
    fi
    
    # Check if cache matches
    local cached_hash=$(cat "$CACHE_FILE" 2>/dev/null || echo "")
    if [[ "$current_hash" != "$cached_hash" ]]; then
        return 0  # Generation needed
    fi
    
    return 1  # No generation needed
}

# Function to backup successful generation
backup_generation() {
    if [[ -d "$SDK_DIR" ]]; then
        echo -e "${BLUE}📦 Backing up generated SDK...${NC}"
        rm -rf "$BACKUP_DIR"
        cp -r "$SDK_DIR" "$BACKUP_DIR"
        echo -e "${GREEN}✅ Backup created${NC}"
    fi
}

# Function to restore from backup
restore_from_backup() {
    if [[ -d "$BACKUP_DIR" ]]; then
        echo -e "${YELLOW}🔄 Restoring from backup...${NC}"
        rm -rf "$SDK_DIR"
        cp -r "$BACKUP_DIR" "$SDK_DIR"
        echo -e "${GREEN}✅ Restored from backup${NC}"
        return 0
    else
        echo -e "${RED}❌ No backup available${NC}"
        return 1
    fi
}

# Function to generate SDK with error handling
generate_sdk() {
    local current_hash="$1"
    local skip_build="$2"
    
    echo -e "${BLUE}🚀 Generating SDK...${NC}"
    
    # Check if Docker is running
    if ! docker info &> /dev/null; then
        echo -e "${RED}❌ Docker is not running${NC}"
        echo "Please start Docker Desktop and try again"
        return 1
    fi
    
    # Generate OpenAPI spec if needed
    if [[ ! -f "apps/backend-api/openapi.json" ]] || [[ "${1:-}" == "--force" ]]; then
        echo -e "${BLUE}📄 Generating OpenAPI specification...${NC}"
        if ! pnpm openapi:generate; then
            echo -e "${RED}❌ OpenAPI generation failed${NC}"
            return 1
        fi
    fi
    
    # Validate Fern configuration
    echo -e "${BLUE}✓ Validating Fern configuration...${NC}"
    if ! pnpm exec fern check; then
        echo -e "${RED}❌ Fern configuration validation failed${NC}"
        return 1
    fi
    
    # Generate SDK
    echo -e "${BLUE}🚀 Generating browser SDK...${NC}"
    if ! pnpm exec fern generate --local; then
        echo -e "${RED}❌ SDK generation failed${NC}"
        return 1
    fi
    
    # Validate generation output
    if [[ ! -d "$SDK_DIR" ]] || [[ ! -f "$SDK_DIR/index.ts" ]]; then
        echo -e "${RED}❌ SDK generation incomplete - missing expected files${NC}"
        return 1
    fi
    
    # Build SDK package (skip if requested)
    if [[ "$skip_build" != "true" ]]; then
        echo -e "${BLUE}📦 Building SDK package...${NC}"
        if ! (cd packages/sdk && pnpm build); then
            echo -e "${RED}❌ SDK build failed${NC}"
            return 1
        fi
    else
        echo -e "${BLUE}⏭️ Skipping SDK package build...${NC}"
    fi
    
    # Update cache
    echo "$current_hash" > "$CACHE_FILE"
    
    # Backup successful generation
    backup_generation
    
    echo -e "${GREEN}✅ SDK generation complete!${NC}"
    return 0
}

# Main execution
main() {
    local force_generate=false
    local skip_cache=false
    local skip_build=false
    
    # Parse arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            --force)
                force_generate=true
                shift
                ;;
            --skip-cache)
                skip_cache=true
                shift
                ;;
            --skip-build)
                skip_build=true
                shift
                ;;
            --help)
                echo "Usage: $0 [--force] [--skip-cache] [--skip-build] [--help]"
                echo "  --force      Force regeneration even if cache is valid"
                echo "  --skip-cache Skip cache validation (always generate)"
                echo "  --skip-build Skip SDK package build step"
                echo "  --help       Show this help message"
                exit 0
                ;;
            *)
                echo "Unknown option: $1"
                echo "Use --help for usage information"
                exit 1
                ;;
        esac
    done
    
    # Calculate current input hash
    local current_hash=$(calculate_input_hash)
    
    # Check if generation is needed
    if [[ "$force_generate" == true ]] || [[ "$skip_cache" == true ]]; then
        echo -e "${YELLOW}🔄 Forcing regeneration...${NC}"
    elif ! is_generation_needed "$current_hash"; then
        echo -e "${GREEN}✅ SDK is up to date (cache hit)${NC}"
        echo "Generated SDK: $SDK_DIR"
        echo "Cache hash: $current_hash"
        return 0
    else
        echo -e "${YELLOW}🔄 SDK regeneration needed${NC}"
        echo "Cache hash: $current_hash"
    fi
    
    # Attempt generation
    if generate_sdk "$current_hash" "$skip_build"; then
        echo -e "${GREEN}✅ SDK generation successful!${NC}"
        echo "Generated SDK: $SDK_DIR"
        echo "Cache hash: $current_hash"
    else
        echo -e "${RED}❌ SDK generation failed${NC}"
        
        # Try to restore from backup
        if restore_from_backup; then
            echo -e "${YELLOW}⚠️  Using backup SDK - build may succeed but SDK may be outdated${NC}"
            return 0
        else
            echo -e "${RED}❌ No backup available - build will fail${NC}"
            return 1
        fi
    fi
}

# Execute main function
main "$@"