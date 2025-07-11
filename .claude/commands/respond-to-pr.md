---
description: Systematically address PR review feedback with human approval before making changes
---

Focus on methodically addressing PR feedback while maintaining developer control over implementation decisions.

## 0. Gather PR Context

Since you're starting fresh, gather comprehensive PR information:

```bash
# Get current branch and ensure we're on the PR branch
git branch --show-current

# Fetch latest changes
git fetch origin

# Get PR number from current branch or ask user
gh pr status --json number,title,headRefName
```

If PR number isn't clear, ask the user: "Which PR number should I respond to?"

## 1. Fetch All PR Feedback

Gather all types of GitHub feedback:

```bash
# Get PR metadata
gh pr view [PR-NUMBER] --json title,body,state,url,author

# Fetch review comments (inline code comments)
gh api repos/{owner}/{repo}/pulls/[PR-NUMBER]/comments --paginate

# Fetch issue comments (general discussion)
gh api repos/{owner}/{repo}/issues/[PR-NUMBER]/comments --paginate

# Fetch PR reviews (review summaries with approval status)
gh api repos/{owner}/{repo}/pulls/[PR-NUMBER]/reviews --paginate
```

## 2. Categorize and Present Feedback

Analyze each piece of feedback and categorize:

1. **🔴 Required Changes** - Must be addressed before merge
   - Explicitly requested by reviewers
   - Blocking issues (bugs, security, performance)
   - Missing requirements from ticket

2. **🟡 Suggestions** - Improvements to consider
   - Code style preferences
   - Alternative approaches
   - Optimization opportunities

3. **🟢 Questions** - Need clarification or explanation
   - Why certain decisions were made
   - How something works
   - Future considerations

4. **🔵 Acknowledgments** - Positive feedback or future work
   - Compliments on implementation
   - Ideas for future tickets
   - General observations

Present a clear summary to the user:

```
## PR Feedback Summary for #[PR-NUMBER]

### 🔴 Required Changes (3)

1. **Missing error handling in auth service**
   - Reviewer: @john-doe
   - File: `src/services/auth.ts:42`
   - Comment: "This could throw but isn't wrapped in try-catch"

2. **Security: API key exposed in logs**
   - Reviewer: @security-team
   - File: `src/utils/logger.ts:15`
   - Comment: "Remove sensitive data from log output"

3. **Broken test after changes**
   - Reviewer: @ci-bot
   - File: `test/auth.test.ts`
   - Comment: "Test 'should validate token' is failing"

### 🟡 Suggestions (2)

4. **Consider using const instead of let**
   - Reviewer: @jane-smith
   - File: `src/utils/helpers.ts:8`
   - Comment: "This variable never gets reassigned"

5. **Extract magic number to constant**
   - Reviewer: @tech-lead
   - File: `src/config/limits.ts:22`
   - Comment: "MAX_RETRIES = 3 would be clearer"

### 🟢 Questions (1)

6. **Why was Redis chosen for session storage?**
   - Reviewer: @architect
   - Comment: "Curious about the decision vs using PostgreSQL"

### 🔵 Acknowledgments (1)

7. **Great test coverage!**
   - Reviewer: @qa-lead
   - Comment: "Love the comprehensive edge case testing"
```

## 3. Get Human Approval

**CRITICAL: Ask for explicit approval before making any changes**

```
Which feedback items should I address? Please specify:
- Numbers (e.g., "1,2,5")
- "required" for all required changes
- "all" for everything
- "none" to skip implementation

Your choice:
```

Wait for human response. Parse their input and confirm:

```
✅ Will implement:
  - #1: Missing error handling in auth service
  - #2: Security: API key exposed in logs

❓ Will respond to:
  - #6: Why was Redis chosen for session storage?

⏭️  Will skip:
  - #3: Broken test (you mentioned this is already fixed)
  - #4: Consider using const instead of let
  - #5: Extract magic number to constant
  - #7: Great test coverage (acknowledgment only)

Proceed with posting acknowledgments on GitHub? (y/n):
```

## 4. Post GitHub Acknowledgments

Only after human confirmation, post responses using the emoji system:

For each approved item:

```bash
# Add emoji reaction to indicate intent
gh api -X POST repos/{owner}/{repo}/pulls/comments/[COMMENT-ID]/reactions \
  --field content='+1'  # or 'confused' for questions
```

Post a summary comment:

```bash
gh pr comment [PR-NUMBER] --body "$(cat <<'EOF'
## Addressing PR Feedback 🔄

Thank you all for the thorough review! Based on the feedback, here's what I'll be addressing:

### Will Implement:
- ✅ **Missing error handling in auth service** - Adding try-catch blocks
- ✅ **Security: API key exposed in logs** - Removing sensitive data from logs

### Responses:
- ❓ **Redis vs PostgreSQL**: We chose Redis for session storage due to its performance characteristics and built-in TTL support. PostgreSQL would require additional cleanup jobs.

### Acknowledged (Not implementing in this PR):
- 💡 **const vs let**: Good suggestion, but keeping current style for consistency
- 💡 **Magic number**: Will address in a future refactoring PR
- ✅ **Broken test**: Already fixed in latest commit

I'll now proceed with implementing the required changes.
EOF
)"
```

## 5. Implement Approved Changes

For each approved change:

1. **Make the code change**
   - Navigate to the specified file
   - Implement the requested fix
   - Follow existing code patterns

2. **Run immediate validation**

   ```bash
   pnpm ai:quick
   ```

3. **Update relevant tests** if needed

4. **Commit with descriptive message**
   ```bash
   git add [changed-files]
   git commit -m "fix: [description] (addresses PR feedback)"
   ```

Example implementation flow:

```
🔧 Implementing #1: Missing error handling in auth service

[Show the code change]

✅ Change implemented. Running validation...
✅ Validation passed. Committing...
✅ Committed: fix: add error handling to auth service (addresses PR feedback)

Moving to next approved change...
```

## 6. Final Verification

After all approved changes are implemented:

1. **Run full quality pipeline**

   ```bash
   pnpm ai:check
   ```

2. **Push changes**

   ```bash
   git push
   ```

3. **Post completion comment**
   ```bash
   gh pr comment [PR-NUMBER] --body "$(cat <<'EOF'
   ```

## ✅ PR Feedback Addressed

All approved changes have been implemented:

- ✅ Added error handling to auth service (commit: abc123)
- ✅ Removed sensitive data from logs (commit: def456)
- ✅ All quality checks passing

The PR is ready for re-review. Thanks again for the valuable feedback!
EOF
)"

```

## 7. Update PR Status

If all required changes are addressed:
- Add comment indicating readiness for re-review
- Tag original reviewers if necessary

If some feedback led to new discoveries:
- Note any follow-up tickets that should be created
- Use `/create-ticket` for significant future work

## Important Notes

- **Never implement changes without human approval**
- **Always validate after each change**
- **Keep commits atomic and descriptive**
- **Be respectful and thankful in responses**
- **Track which feedback has been addressed**
- **Don't close or merge the PR** - that's for reviewers

The goal is systematic, controlled response to feedback that maintains code quality while respecting reviewer input and developer autonomy.
```
