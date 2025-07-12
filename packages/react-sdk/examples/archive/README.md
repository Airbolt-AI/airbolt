# Archived Examples

This directory contains older, more complex examples that have been replaced with simpler versions.

## Why These Were Archived

- **Too complex** - 150-650 lines vs new examples at 20-40 lines
- **Manual JWT handling** - Showed implementation details users don't need
- **Mixed concerns** - Combined multiple concepts in single files
- **Poor DX** - Harder to understand and modify

## Archived Files

- `chatwidget-demo.html` (658 lines) - Complex widget demo with manual JWT
- `standalone-demo.html` (293 lines) - Self-contained demo
- `chatwidget-demo-esm.html` (208 lines) - ESM version of widget demo
- `simple-chat.tsx` (144 lines) - Original "simple" chat (not that simple!)
- `advanced-chat.tsx` (337 lines) - Feature-rich chat with settings
- `serve-demo.js` - HTTP server for demos
- `test-react-sdk.md` - Testing instructions

## New Examples

See the parent directory for new, simplified examples:
- `react-hooks/` - Clean useChat example (~40 lines)
- `react-widget/` - Simple ChatWidget example (~20 lines)

These new examples focus on clarity and demonstrate that the SDK handles all complexity internally.