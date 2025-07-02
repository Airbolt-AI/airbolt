# Fern SDK Generation

This directory contains the Fern configuration for generating TypeScript SDK and documentation from our OpenAPI specification.

## Overview

Fern automatically generates type-safe client SDKs and documentation from our Fastify API's OpenAPI specification. This ensures that API consumers always have up-to-date, type-safe client libraries.

## Configuration

### Files

- `fern.config.json` - Main Fern configuration with organization settings
- `generators.yml` - SDK generation configuration and output settings
- `definition/api.yml` - API definition that imports our OpenAPI specification

### SDK Output

- **Location**: `packages/sdk/`
- **Package Name**: `@airbolt/sdk`
- **Client Name**: `AiFastifyTemplateAPI`

## Usage

### Generate SDK Locally

```bash
# Generate OpenAPI spec and SDK
pnpm sdk:generate

# Or step by step:
pnpm openapi:generate  # Generate OpenAPI from Fastify app
fern generate --local   # Generate SDK from OpenAPI spec
```

### Validate Configuration

```bash
# Check Fern configuration is valid
pnpm fern:check

# Validate without generation
pnpm fern:validate
```

## Generated SDK Structure

The generated SDK will include:

- **Type-safe client**: Fully typed TypeScript client with autocomplete
- **Request/Response types**: All API types exported for reuse
- **Error handling**: Structured error types for robust error handling
- **Documentation**: Generated documentation with examples

## Integration

### In Applications

```typescript
import { AiFastifyTemplateAPI } from '@airbolt/sdk';

const client = new AiFastifyTemplateAPI({
  environment: 'http://localhost:3000', // or production URL
});

// Type-safe API calls
const response = await client.getRootMessage();
console.log(response.message); // "Hello World!"

const example = await client.getExampleMessage();
console.log(example); // "this is an example"
```

### In Build Pipeline

The SDK generation is integrated into the TurboRepo pipeline:

1. **OpenAPI Generation**: `turbo openapi:generate` builds the API and extracts OpenAPI spec
2. **SDK Generation**: `fern generate --local` creates the TypeScript SDK
3. **Type Checking**: Generated SDK is type-checked as part of the workspace

## Requirements

- **Docker**: Required for local Fern generation
- **OpenAPI Spec**: Generated from Fastify app with complete schemas
- **Build Dependencies**: App must be built before OpenAPI generation

## Continuous Integration

Future enhancements will include:

- **GitHub Actions**: Automatic SDK generation on main branch
- **NPM Publishing**: Auto-publish SDK packages on version changes
- **Documentation Hosting**: Generated docs published to GitHub Pages
- **Version Management**: Semantic versioning for SDK releases

## Development Workflow

1. **Update API**: Add new routes with proper OpenAPI schemas
2. **Generate Spec**: Run `pnpm openapi:generate` to update OpenAPI
3. **Validate Config**: Run `pnpm fern:check` to ensure configuration is valid
4. **Generate SDK**: Run `fern generate --local` to create updated SDK
5. **Test Integration**: Verify generated SDK works with sample applications

## OpenAPI Schema Best Practices

For optimal SDK generation, ensure all routes include:

- **Complete schemas**: Request and response types fully defined
- **Proper tags**: Group related endpoints for organization
- **Examples**: Sample data for better documentation
- **Error responses**: All possible error cases documented
- **Descriptions**: Clear summaries and descriptions for endpoints

## Troubleshooting

### Docker Issues

If SDK generation fails with Docker errors:

```bash
# Check Docker is running
docker info

# Start Docker Desktop (macOS)
open -a Docker

# Verify Docker connectivity
docker run hello-world
```

### Configuration Issues

If Fern check fails:

```bash
# Validate OpenAPI spec is generated
ls -la apps/backend-api/openapi.json

# Check Fern configuration syntax
pnpm fern:check

# Verify import path in definition/api.yml
cat fern/definition/api.yml
```

### Generation Issues

If SDK generation produces unexpected results:

1. **Check OpenAPI completeness**: Ensure all routes have schemas
2. **Validate types**: Run TypeScript check on generated SDK
3. **Test examples**: Verify generated client works with sample data
4. **Review logs**: Check Fern generation logs for warnings

## Future Enhancements

- **Multi-language support**: Generate SDKs for Python, Go, Java
- **Authentication**: Add JWT/Bearer token support to generated clients
- **Pagination**: Handle paginated responses in generated clients
- **Webhooks**: Support webhook types in generated SDKs
- **Mock servers**: Generate mock servers for testing
