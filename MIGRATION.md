# Migration Guide

## Migrating to Multi-Provider Support

Airbolt now supports multiple AI providers (OpenAI, Anthropic, and more) instead of just OpenAI. Here's what you need to know:

### For Existing OpenAI Users

**No changes required!** OpenAI remains the default provider. Your existing setup will continue to work exactly as before.

### To Use a Different Provider

1. **Update your environment variables**:

```bash
# For Anthropic
AI_PROVIDER=anthropic
ANTHROPIC_API_KEY=sk-ant-your-key-here

# For OpenAI (default)
AI_PROVIDER=openai  # Optional, this is the default
OPENAI_API_KEY=sk-your-key-here
```

2. **Update your deployment** (if using Render):
   - Add `AI_PROVIDER` environment variable
   - Add the corresponding API key (e.g., `ANTHROPIC_API_KEY`)

### API Changes

**No API changes!** The `/api/chat` endpoint works exactly the same. The provider selection happens on the backend based on your environment configuration.

### SDK Changes

**No SDK changes!** Both `@airbolt/sdk` and `@airbolt/react-sdk` work exactly as before. The provider selection is transparent to the frontend.

### Available Providers

- **OpenAI** (default): GPT-4, GPT-3.5-turbo, and other OpenAI models
- **Anthropic**: Claude 3.5 Sonnet, Claude 3 Opus, and other Anthropic models

### Custom Models

To use a specific model:

```bash
AI_MODEL=gpt-4  # For OpenAI
AI_MODEL=claude-3-opus-20240229  # For Anthropic
```

### Breaking Changes

**None!** This update is fully backward compatible. Existing deployments will continue using OpenAI by default.
