# Claude Code Configuration

This directory contains Claude Code specific configuration and hooks that provide real-time feedback during AI coding sessions.

## Automatic Hooks Integration

When using Claude Code, you get additional real-time feedback through hooks configured in `settings.json`:

### 🔄 What Happens Automatically

1. **After Every Edit**:
   - Runs validation (with 10s timeout)
   - Auto-formats TypeScript/JavaScript files with Prettier
   - Alerts when utils require mutation testing
   - Reminds about test quality for test files

2. **Before File Modifications**:
   - Blocks direct env/secrets modifications
   - Prevents writes to system directories
   - Detects and blocks path traversal attempts
   - Protects against symlink bypasses

3. **During Your Session**:
   - Logs all bash commands for audit trail
   - Records notifications with timestamps
   - Provides session summary on completion
   - Suggests next steps based on git status

### 🚫 Security Blocks

Claude Code will prevent you from:

- Modifying `.env` files directly (use Zod schemas in `env.ts` instead)
- Writing to `node_modules/`, `dist/`, `.git/`
- Creating files with path traversal (`../`)
- Modifying symbolic links

### 💡 Working with Hooks

- **Hooks are non-blocking**: Validation has a 10s timeout
- **Smart skipping**: Generated/vendor files are ignored
- **Immediate feedback**: Errors shown inline as you work
- **Learn from patterns**: Hooks teach best practices

## Configuration Files

### settings.json

Main configuration file with hook definitions. This file is committed to the repository and shared across the team.

### settings.local.json

Local overrides for individual developer preferences. This file is gitignored and won't be committed.

## Custom Commands

The `commands/` directory contains custom command definitions that extend Claude Code's capabilities. Each command is a separate JSON file that defines:

- Command name and description
- Required parameters
- Execution steps
- Expected outputs

## Troubleshooting

### Hooks Not Running

1. Check that `settings.json` is valid JSON
2. Verify hook paths are correct
3. Check timeout settings (default 10s)

### False Positives

Some hooks may trigger on legitimate operations. You can:

1. Temporarily disable in `settings.local.json`
2. Adjust patterns to be more specific
3. Add exclusions for specific file types

### Performance Issues

If hooks are slowing down your workflow:

1. Reduce validation scope
2. Increase timeout values
3. Use `settings.local.json` to disable expensive checks

## Best Practices

1. **Don't disable security hooks** - They prevent accidental security issues
2. **Pay attention to warnings** - They often catch real issues early
3. **Use local settings sparingly** - Team consistency is valuable
4. **Report issues** - If hooks are too restrictive, discuss with the team
