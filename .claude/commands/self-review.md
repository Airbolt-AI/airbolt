---
description: Perform comprehensive self-review and create PR if all checks pass
---

Ultrathink about what a thorough self-review entails. You are your own first reviewer—catch issues before they waste others' time. Be critical, thorough, and honest about the quality of your work.

**Review Mindset**: Would you want to maintain this code at 3am during an incident? Ruthlessly remove anything that doesn't directly serve the user or developer.

## 1. Run Full Quality Pipeline

Execute comprehensive validation:

```bash
pnpm ai:compliance
```

This includes:

- Linting and formatting
- TypeScript type checking
- All unit and integration tests
- Mutation testing (must meet 85% threshold for business logic)
- Build verification
- Security scanning

## 2. Verify Requirements

Cross-check implementation against Linear ticket:

- All acceptance criteria met?
- No scope creep beyond ticket requirements?
- Edge cases handled as specified?
- Performance requirements satisfied?

## 3. Documentation Verification

Ensure all documentation is updated:

- [ ] Code comments explain complex logic
- [ ] API documentation reflects any endpoint changes
- [ ] README updated for setup/config changes
- [ ] Architecture docs updated for pattern changes
- [ ] Changelog prepared for notable changes
- [ ] No outdated documentation left behind

## 4. Git & Branch Status

Check repository state:

```bash
git status
git diff origin/main --stat
```

Verify:

- All changes committed with meaningful messages
- No unintended files included
- Branch is up-to-date with main
- No merge conflicts

## 5. Final Quality Checklist

- [ ] Tests actually validate business logic (not just coverage)
- [ ] No console.logs or debug code left behind
- [ ] Error handling is comprehensive
- [ ] Security best practices followed
- [ ] Performance impact acceptable
- [ ] Code follows established patterns

## 6. PR Creation Decision

**IF all checks pass:**

- Create comprehensive PR description including:
  - Summary of changes
  - Testing approach and results
  - Breaking changes (if any)
  - Documentation updates made
  - Deployment considerations
  - Screenshots/examples if applicable
- Use gh CLI to create PR with proper formatting
- Link to Linear ticket
- Add appropriate labels

**IF any checks fail:**

- List all issues found
- Fix issues systematically
- Re-run /self-review after fixes
- Do NOT create PR until all checks pass

The goal is zero back-and-forth during peer review. Take pride in submitting PRs that are ready to merge.
