#!/bin/bash

# SDK Generation Script with Docker Validation
# This script ensures Docker is available and generates the SDK with proper error handling

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

log_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

log_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

log_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Check if Docker is available and running
check_docker() {
    log_info "Checking Docker availability..."

    if ! command -v docker &> /dev/null; then
        log_error "Docker is not installed or not in PATH"
        log_info "Please install Docker from: https://docs.docker.com/get-docker/"
        return 1
    fi

    if ! docker info &> /dev/null; then
        log_error "Docker is not running"
        log_info "Please start Docker Desktop or Docker daemon"
        log_info "On macOS: open -a Docker"
        log_info "On Linux: sudo systemctl start docker"
        return 1
    fi

    log_success "Docker is available and running"
    return 0
}

# Check if OpenAPI spec exists
check_openapi_spec() {
    local openapi_file="apps/backend-api/openapi.json"

    if [[ ! -f "$openapi_file" ]]; then
        log_warning "OpenAPI specification not found at $openapi_file"
        log_info "Generating OpenAPI specification first..."

        if ! pnpm openapi:generate; then
            log_error "Failed to generate OpenAPI specification"
            return 1
        fi

        log_success "OpenAPI specification generated"
    else
        log_info "OpenAPI specification found at $openapi_file"
    fi

    return 0
}

# Validate Fern configuration
validate_fern_config() {
    log_info "Validating Fern configuration..."

    if ! pnpm fern:check; then
        log_error "Fern configuration validation failed"
        log_info "Please check your Fern configuration files:"
        log_info "  - fern/fern.config.json"
        log_info "  - fern/generators.yml"
        log_info "  - fern/definition/api.yml"
        return 1
    fi

    log_success "Fern configuration is valid"
    return 0
}

# Generate SDK
generate_sdk() {
    log_info "Generating SDK with Fern..."

    # Create SDK directory if it doesn't exist
    mkdir -p packages/sdk

    # Run Fern generation with local Docker
    if fern generate --local; then
        log_success "SDK generated successfully"
        return 0
    else
        log_error "SDK generation failed"
        log_info "Common solutions:"
        log_info "  1. Ensure Docker has enough memory allocated (4GB+ recommended)"
        log_info "  2. Check that Docker can pull images from registry"
        log_info "  3. Verify OpenAPI specification is valid"
        log_info "  4. Check Fern configuration files"
        return 1
    fi
}

# Validate generated SDK
validate_sdk() {
    log_info "Validating generated SDK..."

    local sdk_dir="packages/sdk"

    # Check if SDK directory exists and has content
    if [[ ! -d "$sdk_dir" ]]; then
        log_error "SDK directory not found at $sdk_dir"
        return 1
    fi

    # Check for essential files
    local essential_files=("package.json")
    for file in "${essential_files[@]}"; do
        if [[ ! -f "$sdk_dir/$file" ]]; then
            log_warning "Expected file not found: $sdk_dir/$file"
        fi
    done

    # Check for TypeScript files
    if find "$sdk_dir" -name "*.ts" -o -name "*.js" | head -1 | read; then
        log_success "SDK contains generated code files"
    else
        log_warning "No TypeScript/JavaScript files found in generated SDK"
    fi

    # Try to install SDK dependencies if package.json exists
    if [[ -f "$sdk_dir/package.json" ]]; then
        log_info "Installing SDK dependencies..."
        cd "$sdk_dir"

        if pnpm install --frozen-lockfile 2>/dev/null || pnpm install; then
            log_success "SDK dependencies installed"
        else
            log_warning "Failed to install SDK dependencies (this may be normal for generated SDKs)"
        fi

        cd - > /dev/null
    fi

    log_success "SDK validation completed"
    return 0
}

# Display SDK info
display_sdk_info() {
    log_info "SDK Generation Summary:"
    echo ""
    echo "📁 Generated SDK location: packages/sdk/"
    echo "📄 OpenAPI specification: apps/backend-api/openapi.json"
    echo ""
    echo "🚀 Usage:"
    echo "  import { AirboltAPI } from '@airbolt/sdk';"
    echo ""
    echo "📖 Documentation:"
    echo "  - SDK README: packages/sdk/README.md"
    echo "  - API Docs: http://localhost:3000/docs (when server is running)"
    echo ""
}

# Cleanup function
cleanup() {
    log_info "Cleaning up temporary files..."
    # Add any cleanup logic here if needed
}

# Main execution
main() {
    log_info "Starting SDK generation process..."
    echo ""

    # Set up cleanup trap
    trap cleanup EXIT

    # Run all checks and generation steps
    if check_docker && \
       check_openapi_spec && \
       validate_fern_config && \
       generate_sdk && \
       validate_sdk; then

        echo ""
        log_success "SDK generation completed successfully! 🎉"
        echo ""
        display_sdk_info
        exit 0
    else
        echo ""
        log_error "SDK generation failed. Please check the errors above."
        echo ""
        log_info "For help, see:"
        log_info "  - Fern documentation: https://docs.buildwithfern.com/"
        log_info "  - Project README: packages/sdk/README.md"
        log_info "  - Troubleshooting: fern/README.md"
        exit 1
    fi
}

# Handle script arguments
case "${1:-}" in
    "--help"|"-h")
        echo "SDK Generation Script"
        echo ""
        echo "Usage: $0 [options]"
        echo ""
        echo "Options:"
        echo "  --help, -h     Show this help message"
        echo "  --check, -c    Only check prerequisites without generating"
        echo ""
        echo "This script:"
        echo "  1. Checks Docker availability"
        echo "  2. Generates OpenAPI specification if needed"
        echo "  3. Validates Fern configuration"
        echo "  4. Generates TypeScript SDK using Fern"
        echo "  5. Validates generated SDK"
        echo ""
        exit 0
        ;;
    "--check"|"-c")
        log_info "Checking prerequisites only..."
        if check_docker && \
           check_openapi_spec && \
           validate_fern_config; then
            log_success "All prerequisites are met!"
            exit 0
        else
            log_error "Prerequisites check failed"
            exit 1
        fi
        ;;
    "")
        main
        ;;
    *)
        log_error "Unknown option: $1"
        echo "Use --help for usage information"
        exit 1
        ;;
esac
