Ultrathink about the CHANGED LINES in this PR. Focus your review ONLY on what has actually changed, not the existing code around it. However, deeply consider how these specific changes might break other parts of the codebase.

## Review Approach

1. **Identify Changed Lines**: Use `git diff` to see exactly what was added/modified/removed
2. **Ultrathink Impact**: For each change, ask "What depends on this? What could break?"
3. **Search for Dependencies**: Use grep/search to verify impacts ONLY for the changed code
4. **Ignore Unchanged Code**: Don't comment on style/issues in existing code - focus on the delta

## 0. Gather Context (You're a Fresh Agent!)

Since you're starting fresh, gather comprehensive context:

1. **Get PR Information**:

   ```bash
   gh pr view --json title,body,state,files,commits,url
   ```

2. **Read the Linear Ticket**:
   - Extract ticket ID from PR title/body
   - Use Linear MCP tools to read full ticket details
   - Check comments for additional context

3. **Examine ONLY the Changes**:

   ```bash
   git fetch origin
   git diff origin/main...HEAD
   ```

   - Focus on added/modified/removed lines
   - Note which functions/classes/interfaces were changed
   - Identify what files import the changed code

## Changed-Lines Review Process

For each changed file:

1. **What Changed**: Identify the specific lines and their purpose
2. **Breaking Change Analysis**:
   - Search for usages of modified functions/classes
   - Check if changed interfaces affect other files
   - Verify removed exports aren't used elsewhere
3. **Impact Assessment**: Only for changed code

## Review Output Format

**Keep it dynamic - only include sections where you have specific feedback:**

```
## Code Review - Changed Lines Focus

**Summary**: [What do the CHANGES accomplish? 2-3 sentences max]

**Changed Files Analysis**:
- `path/to/file.ts`: Lines X-Y - [what changed and potential impact]

[Then ONLY add these sections if you found issues in the changed lines:]

**Breaking Changes Detected**:
- Line X in `file.ts`: Modified function `foo()` is imported by 3 other files that expect...

**Security Considerations**:
- Line Y in `auth.ts`: New user input at line Y needs validation...

**Performance Impact**:
- Line Z in `api.ts`: New database query in loop could cause N+1...

**Suggestions**:
- Line A in `utils.ts`: Consider using existing helper function...
```

## What NOT to Review

- Style issues in unchanged code
- Existing technical debt
- Refactoring opportunities in unchanged areas
- Documentation for unchanged functions
- Test coverage for unchanged code

## Posting Your Review

After completing your review, post it directly to the GitHub PR:

```bash
# For comments (most common)
gh pr comment [PR-NUMBER] --body "YOUR REVIEW"

# For approval (if you have permission)
gh pr review [PR-NUMBER] --approve --body "YOUR REVIEW"

# For requesting changes
gh pr review [PR-NUMBER] --request-changes --body "YOUR REVIEW"
```

Remember: Focus ONLY on changed lines, but ultrathink deeply about their impact on the rest of the codebase.
