# Claude Code Slash Commands

This directory contains custom slash commands that guide AI agents through a complete Software Development Life Cycle (SDLC) workflow.

## Command Workflow Order

The commands are designed to be used in a specific sequence for optimal development flow:

### 1. Discovery & Planning Phase

- **`/get-next-ticket`** - Find the most appropriate ticket to work on
- **`/analyze-ticket [ticket-id]`** - Deep analysis before starting implementation
  - Ensures fresh main branch
  - Validates ticket is still relevant
  - Plans implementation approach
  - Identifies risks and dependencies

### 2. Implementation Phase

- **`/start-ticket [ticket-id]`** - Begin implementation
  - Creates feature branch
  - Moves ticket to "In Progress"
  - Implements solution with tests
  - Updates documentation as needed

### 3. Review Phase

- **`/self-review`** - Validate work before creating PR
  - Runs full quality pipeline
  - Verifies all requirements met
  - Creates PR only if all checks pass
- **`/code-review`** - Review PRs (as a fresh agent)
  - Gathers full context
  - Applies senior architect standards
  - Provides constructive feedback

### 4. Post-Review (Coming Soon)

- **`/respond-to-pr`** - Address PR feedback systematically (planned)
- **`/create-ticket`** - Create new tickets for discovered work (planned)

## Supporting Commands

These commands can be used at any time:

- **`/get-in-progress-ticket`** - Check what's currently being worked on
- **`/compact-before-review`** - Clean up conversation before code review

## Key Principles

1. **Quality Gates** - Each command enforces quality standards
2. **Documentation** - Keep docs minimal but current
3. **Zero Manual Testing** - Automate everything possible
4. **Mutation Testing** - Ensure tests catch real logic errors (85% threshold)

## Example Workflow

```bash
# Start your day
/get-next-ticket

# Found ticket MAR-123, analyze it
/analyze-ticket MAR-123

# Everything looks good, start implementation
/start-ticket MAR-123

# After implementation, self-review
/self-review

# PR created! Now switch context for review
/code-review

# If you need to check current work
/get-in-progress-ticket
```

## Command Details

Each `.md` file in this directory is a complete command specification with:

- Description and parameters
- Step-by-step instructions
- Quality checkpoints
- Integration with other commands

The commands use:

- Linear MCP tools for ticket management
- GitHub CLI for PR operations
- Project quality tools (pnpm scripts)
- Git workflows

## Future Enhancements

Planned commands to complete the workflow:

- `/respond-to-pr` - Handle PR feedback and make requested changes
- `/create-ticket` - Create new Linear tickets when discovering work
- Dedicated bot accounts for clearer automation attribution
