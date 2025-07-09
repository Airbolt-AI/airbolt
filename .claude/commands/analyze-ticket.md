---
description: Deeply analyze a Linear ticket before implementation — pass a ticket ID or leave blank to let Claude infer it
---

<!--
If $ARGUMENTS is blank, infer the ticket ID from context.
If it can't be inferred, ask the user to supply one and stop.
-->

Ultrathink about the comprehensive discovery needed before implementation. What context, risks, and unknowns must be uncovered to ensure a successful implementation that passes review on the first attempt?

Analyze **$ARGUMENTS** deeply:

## 1. Requirements Analysis

- Parse the ticket description and acceptance criteria
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
- Identify documentation that will need updates:
  - Code comments and inline docs
  - API documentation
  - README or setup guides
  - Architecture documentation
  - User-facing documentation

## 6. Testing Strategy

- Define unit test scenarios covering all business logic
- Plan integration tests for API changes
- Consider mutation testing targets (85% threshold)
- Identify any manual testing needs
- Plan for edge cases and error scenarios

## 7. Implementation Plan

- Break down into logical implementation steps
- Identify the optimal order of changes
- Plan checkpoints for validation
- Estimate time for each phase
- Define rollback strategy if needed

Present a concise summary with:

- Key insights discovered
- Critical risks to watch
- Recommended implementation approach
- Documentation updates needed
- Testing strategy highlights
- Go/No-Go recommendation with reasoning
