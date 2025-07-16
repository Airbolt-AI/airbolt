---
description: Deeply analyze a Linear ticket before implementation — pass a ticket ID or leave blank to let Claude infer it
---

<!--
If $ARGUMENTS is blank, infer the ticket ID from context.
If it can't be inferred, ask the user to supply one and stop.
-->

Ultrathink about the comprehensive discovery needed before implementation. What context, risks, and unknowns must be uncovered to ensure a successful implementation that passes review on the first attempt?

**Core Principle**: The best code is no code. Before writing anything, ensure you're solving the right problem in the simplest way possible. Over-analysis beats over-engineering.

## 0. Prepare Fresh Environment

Ensure you're starting from a clean, up-to-date state:

```bash
git checkout main
git pull origin main
```

Analyze **$ARGUMENTS** deeply:

## 1. Requirements Analysis

- Parse the ticket description and acceptance criteria
- **Compare ticket requirements against current codebase state**
- **Is the ticket outdated? Have requirements changed since creation?**
- **Do any requirements need modification based on current implementation?**
- Identify explicit and implicit requirements
- Clarify any ambiguities or missing information
- Define success metrics and validation criteria

## 2. Technical Discovery

- Review existing code and architecture patterns
- Identify files and components that need modification
- Check for similar implementations to follow as patterns
- Assess technical complexity and estimated effort

## 3. Risk Assessment

- What could go wrong during implementation?
- Are there backward compatibility concerns?
- Performance implications to consider?
- Security considerations?
- What edge cases need handling?

## 4. Dependencies & Blockers

- Check for dependencies on other tickets or systems
- Verify all necessary access and permissions
- Identify any potential blockers
- Confirm prerequisite work is completed

## 5. Documentation Review

- Review existing documentation for context
- **Keep documentation minimal, clear, and focused on value**
- Identify documentation that will need updates:
  - Code comments (only for complex logic)
  - API documentation (only if endpoints change)
  - README (only if setup/usage changes)
  - Architecture docs (only if patterns change)
- Remember: The best documentation is code that doesn't need explanation

## 6. Testing Strategy

- Define unit test scenarios covering all business logic
- Plan integration tests for API changes
- **Aim for zero manual testing through comprehensive automation**
- **Mutation testing (85% threshold)**: Ensures tests detect meaningful logic errors, not just achieve coverage
  - Required for business logic in `utils/` directories
  - Not needed for: routes, plugins, config, simple getters/setters
  - Ask: "If I break this logic, will my tests fail?"
- Plan for edge cases and error scenarios
- If manual testing seems necessary, ask: "How can we automate this?"

## 7. Testing Strategy

When planning implementation, identify test strategy early:

- **Property tests** for complex logic (retry, concurrency, data transformations)
- **Integration tests** for complete workflows (auth flows, API contracts)
- **Unit tests** for pure functions only (calculations, validations)
- **Mutation tests** for critical decisions (auth checks, rate limits)

Focus on behavior over implementation - avoid coverage theatre.

## 8. Implementation Plan

- Break down into logical implementation steps
- Identify the optimal order of changes
- Plan checkpoints for validation
- Estimate time for each phase
- Define rollback strategy if needed

Present a concise summary with:

- Key insights discovered
- Critical risks to watch
- **Ticket updates needed (if any)**
- Recommended implementation approach
- Documentation updates needed
- Testing strategy highlights
- Go/No-Go recommendation with reasoning

If the ticket needs updates based on current codebase state, suggest specific changes to the Linear ticket before proceeding with implementation.
