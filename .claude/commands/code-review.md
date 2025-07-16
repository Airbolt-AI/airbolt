Ultrathink about what makes an exceptional code review—one that elevates both the code and the developer. Consider technical excellence, business impact, maintainability, and team growth.

**Review Philosophy**: Champion simplicity over cleverness. The best suggestions reduce code while increasing clarity. Today's elegant abstraction is tomorrow's technical debt.

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

3. **Understand the Changes**:

   ```bash
   git fetch origin
   git diff origin/main...HEAD --stat
   ```

   - Review list of changed files
   - Identify patterns: new features vs modifications

4. **Examine Code Changes**:
   - Use `git diff` to see actual changes
   - Read modified files to understand context
   - Check related files that might be affected

5. **Review Codebase Context**:
   - Look at existing patterns in similar files
   - Check architecture docs if available
   - Understand the project's quality standards

## Quality Gates Verification

Review these explicit quality checks:

- **Mutation Testing**: Verify score meets ≥85% threshold for business logic
- **Security**: Check for vulnerabilities, exposed secrets, unsafe patterns
- **Performance**: Assess impact on response times, memory usage
- **Architecture**: Validate clean dependencies, proper layering
- **Test Quality**: Ensure tests fail when logic breaks (not just coverage theater)
- **Documentation**: Verify all docs are updated and accurate

## Code Review Focus Areas

Then Ultrathink about the specific context of the open PR:

1. **Implementation Quality**
   - Does it use minimal code for maximum value?
   - Are patterns consistent with existing codebase?
   - Is error handling comprehensive?
   - Are edge cases properly handled?

2. **Maintainability**
   - Will future developers understand this easily?
   - Are complex sections well-documented?
   - Is the code DRY without being overly abstract?

3. **Business Impact**
   - Does it fully address the ticket requirements?
   - Are there any unintended side effects?
   - Is the user experience optimal?

4. **Documentation Review**
   - Are code comments helpful and current?
   - Is API documentation complete?
   - Are README/setup guides updated?
   - Do examples work as shown?

5. **What a Senior Architect Would Notice**
   - Subtle performance implications
   - Security vulnerabilities
   - Architectural debt being introduced
   - Opportunities for broader improvements
   - Missing abstractions or over-engineering

## Review Output Format

Provide that level of thoughtful, constructive review:

1. **Summary**: Brief overview of what the PR accomplishes
2. **Positive Observations**: What's done well (be specific)
3. **Required Changes**: Must-fix issues blocking merge
4. **Suggestions**: Optional improvements for consideration
5. **Questions**: Clarifications needed for understanding

Format your review to be:

- **Constructive**: Focus on teaching, not just critiquing
- **Specific**: Reference exact files and line numbers
- **Actionable**: Provide clear guidance on fixes
- **Balanced**: Acknowledge good decisions alongside improvements

## Posting Your Review

**IMPORTANT**: After completing your review, always post it directly to the GitHub PR using one of these methods:

1. **For Approval**: `gh pr review [PR-NUMBER] --approve --body "YOUR REVIEW"`
2. **For Comments**: `gh pr comment [PR-NUMBER] --body "YOUR REVIEW"`
3. **For Request Changes**: `gh pr review [PR-NUMBER] --request-changes --body "YOUR REVIEW"`

Note: If reviewing your own PR, use `gh pr comment` instead of review commands.

Remember: A great review elevates both the code and the developer, and should always be posted to the actual PR for visibility and discussion.
