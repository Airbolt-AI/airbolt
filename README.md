# Airbolt

**The secure backend for calling LLMs from your apps.**

> **tl;dr** We're focusing on our [cloud platform](https://www.airbolt.ai) to build faster and deliver more value. The self-hosted version taught us that "no backend" still meant managing servers – defeating the whole point. We'll open source components as we figure out how to do it without slowing down.

## Use Airbolt Cloud

Get started in 30 seconds at [airbolt.ai](https://www.airbolt.ai)

```bash
npm install @airbolt/sdk
```

```javascript
import { Airbolt } from '@airbolt/sdk';

const airbolt = new Airbolt({
  apiKey: 'your-api-key' // Get from dashboard.airbolt.ai
});

const response = await airbolt.chat([
  { role: 'user', content: 'Hello!' }
]);
```

That's it. No servers to deploy, no JWT secrets to manage, no rate limiting to configure.

## Why We're Consolidating

**The original hypothesis was wrong.** We thought making self-hosting "easy" would be enough. But even with one-click deploys, you still had to:
- Manage server uptime and cold starts
- Rotate JWT secrets
- Update dependencies
- Handle security patches
- Debug deployment issues

This wasn't "backend-free" – it was just someone else's backend that you had to run.

**Everyone uses the cloud version anyway.** Of the developers using Airbolt, 98% chose the hosted platform. The 2% self-hosting were mostly just testing.

**Maintaining two versions slowed everything down.** Every feature had to work in both environments. Every bug had to be fixed twice. Every security update meant two releases.

We were spending more time on deployment docs than product features.

## What's Next

**Short term:** Pour everything into making the cloud platform incredible. Ship faster, iterate based on real usage, focus on what developers actually need.

**Medium term:** Open source the pieces that make sense:
- Client SDKs and libraries
- Example applications
- Development tools and utilities
- UI components

**Long term:** Figure out how to build in public without the overhead. Maybe that's plugins, maybe it's a different architecture, maybe it's something we haven't thought of yet.

## For Self-Hosters

The last self-hosted release (`v1.0.0-final`) remains available in the git history and [releases](https://github.com/Airbolt-AI/airbolt/releases/tag/v1.0.0-final). It works, but we're not maintaining it.

If you need self-hosted AI infrastructure, we recommend:
- [LiteLLM](https://github.com/BerriAI/litellm) for proxy functionality
- [Langfuse](https://github.com/langfuse/langfuse) for observability
- [Helicone](https://github.com/Helicone/helicone) for analytics

These projects are better funded and have teams dedicated to the self-hosted use case.

## Stay Connected

- **Platform:** [airbolt.ai](https://www.airbolt.ai)
- **Docs:** [airbolt.ai/docs](https://www.airbolt.ai/docs)
- **Updates:** [github.com/Airbolt-AI/airbolt/discussions](https://github.com/Airbolt-AI/airbolt/discussions)

We're still committed to open source – just in a way that doesn't slow us down. The best code is the code that ships.

---

*Thanks to everyone who starred, tried, and provided feedback on the self-hosted version. Your input shaped what Airbolt has become.*