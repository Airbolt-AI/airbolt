# PR Review Instructions

First, read and internalize the core review philosophy:
@../prompts/pr-review-core.md

Then follow these CLI-specific steps:

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

## Posting Your Review

After completing your review (following the format from the core philosophy), post it directly to the GitHub PR:

```bash
# For comments (most common)
gh pr comment [PR-NUMBER] --body "YOUR REVIEW"

# For approval (if you have permission)
gh pr review [PR-NUMBER] --approve --body "YOUR REVIEW"

# For requesting changes
gh pr review [PR-NUMBER] --request-changes --body "YOUR REVIEW"
```
