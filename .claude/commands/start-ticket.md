---
description: Start and implement a Linear ticket — pass a ticket ID or leave blank to let Claude infer it
---

<!--
If $ARGUMENTS is blank, infer the ticket ID.
If it can't be inferred, ask the user to supply one and stop.
-->

<!--
Note: Run /analyze-ticket first for complex tickets requiring discovery
-->

Focus on exceptional implementation that demonstrates software craftsmanship and passes review on the first attempt.

**Implementation Philosophy**: After thorough analysis, implement the simplest solution that fully solves the problem. Every line of code is a liability—only add complexity when it delivers proportional user value.

## 1. Start Implementation

Move **$ARGUMENTS** to 'In Progress' and create feature branch:

```bash
git checkout -b <branch-name-from-linear>
```

## 2. Implementation Approach

Write code that:

- Uses minimal code for maximum user value
- Follows established patterns in the codebase
- Handles errors comprehensively
- Considers edge cases from the start
- Maintains clean, readable structure

## 3. Documentation During Development

Update documentation as you code:

- **Code comments**: Explain WHY, not WHAT, for complex logic
- **API docs**: Update for any endpoint changes
- **README**: Modify if setup/configuration changes
- **Architecture docs**: Update if introducing new patterns

## 4. Quality Checkpoints

Run validation at key milestones:

- After initial implementation: `pnpm ai:quick`
- After adding tests: `pnpm ai:check`
- Before moving to review: `pnpm ai:compliance`
- **Testing Strategy**: Follow @TESTING.md principles with the pyramid approach
  - Property tests for complex logic (retry, concurrency, edge cases)
  - Integration tests for complete workflows (auth, API contracts)
  - Unit tests for pure functions only (calculations, validations)
  - Mutation tests for critical decisions (auth checks, rate limits)
  - Quality over coverage - tests should catch real production failures

## 5. Testing Requirements

Write tests that actually validate business logic:

- Unit tests for all business logic
- Integration tests for API endpoints
- Edge cases and error scenarios
- Tests must fail when logic is broken
- Aim for mutation testing score ≥85%

## 6. Commit Guidelines

Make atomic commits with clear messages:

```bash
git add <files>
git commit -m "feat(scope): descriptive message"
```

## 7. Completion Criteria

Before considering implementation complete:

- [ ] All acceptance criteria met
- [ ] Tests passing and meaningful
- [ ] Documentation updated
- [ ] Quality checks passing
- [ ] Code follows team standards
- [ ] No console.logs or debug code

Don't create the PR yet—use `/self-review` when ready.
Don't move to 'Done'—that's handled after peer review.
