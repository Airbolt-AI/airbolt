---
description: Create a new Linear ticket interactively based on requirements
---

Focus on creating a well-structured ticket that provides all necessary context for implementation.

## 1. Gather Initial Context

First, understand what type of work needs to be done. Ask the user:

**What type of ticket would you like to create?**

1. 🚀 **Feature** - New functionality or enhancement
2. 🐛 **Bug** - Something broken that needs fixing
3. 🔧 **Task** - Technical work, refactoring, or maintenance
4. 🔍 **Investigation** - Research or exploration needed

Wait for their response before proceeding.

## 2. Collect Ticket Information

Based on the ticket type, gather:

### For Features:

- **Title**: Clear, user-focused description (e.g., "Add dark mode support to dashboard")
- **Problem & Motivation**: Why is this needed? What value does it provide?
- **Success Criteria**: What specific things must be accomplished? (format as checkboxes)
- **Scope**: What's included and what's explicitly not included?
- **Technical Approach**: High-level implementation strategy

### For Bugs:

- **Title**: What's broken (e.g., "Fix login error when email contains special characters")
- **Problem Description**: What's the issue and how does it impact users?
- **Steps to Reproduce**: Detailed steps to recreate the issue
- **Expected vs Actual**: What should happen vs what does happen
- **Technical Context**: Error messages, logs, affected code areas

### For Tasks:

- **Title**: What needs to be done (e.g., "Refactor authentication module for better testability")
- **Overview**: Why this work is needed
- **Success Criteria**: Specific deliverables (format as checkboxes)
- **Technical Details**: Implementation approach, affected systems
- **Testing Strategy**: How to validate the work

### For Investigations:

- **Title**: What needs to be researched (e.g., "Investigate performance bottlenecks in API endpoints")
- **Questions to Answer**: What specific things need to be discovered?
- **Success Criteria**: What constitutes a complete investigation?
- **Deliverables**: Documentation, recommendations, or POCs expected

## 3. Priority Assessment

Determine priority based on:

- **User Impact**: How many users affected? How severely?
- **Business Impact**: Revenue, reputation, or strategic importance
- **Technical Urgency**: Security issues, blocking other work, technical debt accumulation
- **Effort**: Quick win vs major undertaking

Map to Linear priorities:

- 🔴 **Urgent** (1): Critical bugs, security issues, major blockers
- 🟠 **High** (2): Important features, significant bugs, time-sensitive work
- 🟡 **Normal** (3): Standard features and improvements
- 🟢 **Low** (4): Nice-to-haves, minor improvements

## 4. Check for Duplicates

Before creating, search for similar tickets:

```typescript
// Search existing issues
const searchQuery = /* key words from title */;
const existingIssues = await mcp__Linear__list_issues({
  query: searchQuery,
  teamId: "a659a3b9-b8f1-4d8d-9147-96d2d7b801b0",
  includeArchived: false,
  limit: 10
});
```

If similar tickets exist, ask if this is truly a new issue or should be linked/commented on existing one.

## 5. Create the Ticket

Use consistent structure for all tickets:

```typescript
const ticket = await mcp__Linear__create_issue({
  teamId: "a659a3b9-b8f1-4d8d-9147-96d2d7b801b0",
  projectId: "6aea0ab0-aa79-463b-86d0-d4f3b1ad9a39", // Airbolt MVP - ALWAYS use this
  title: /* constructed title */,
  description: /* formatted description using template */,
  priority: /* 1-4 based on assessment */,
  labelIds: /* based on ticket type */,
  stateId: /* typically "Backlog" state */
});
```

## 6. Templates by Type

### Feature Template:

```markdown
## Problem & Motivation

[Why this feature is needed and what value it provides]

## Success Criteria

- [ ] [User-facing requirement 1]
- [ ] [User-facing requirement 2]
- [ ] [Technical requirement]
- [ ] Tests added with >85% mutation score (if applicable)
- [ ] Documentation updated

## Scope

**In Scope:**

- [What will be built]

**Out of Scope:**

- [What won't be included]

## Technical Approach

[High-level implementation strategy]

## Dependencies

[Any blockers or prerequisites]

## Testing Strategy

[How we'll validate this works correctly]
```

### Bug Template:

```markdown
## Problem Description

[What's broken and how it impacts users]

## Steps to Reproduce

1. [Step 1]
2. [Step 2]
3. [Expected vs Actual behavior]

## Environment

- Browser/Client: [details]
- API Version: [details]
- User Role: [if relevant]

## Success Criteria

- [ ] Bug is fixed and validated
- [ ] Root cause is addressed
- [ ] Tests added to prevent regression
- [ ] No new issues introduced

## Technical Context

[Relevant code locations, error messages, logs]

## Priority Justification

[User impact, frequency, workarounds available]
```

### Task Template:

```markdown
## Overview

[What needs to be done and why]

## Success Criteria

- [ ] [Specific deliverable 1]
- [ ] [Specific deliverable 2]
- [ ] Code follows project standards
- [ ] Tests maintain >85% mutation score
- [ ] Documentation updated

## Technical Details

[Implementation approach, affected systems]

## Testing Strategy

[How we'll validate the work]

## Risks & Mitigations

[Potential issues and how to handle them]
```

### Investigation Template:

```markdown
## Research Goals

[What we're trying to learn or decide]

## Key Questions

1. [Specific question 1]
2. [Specific question 2]
3. [Specific question 3]

## Success Criteria

- [ ] All questions answered with data/evidence
- [ ] Recommendations documented
- [ ] Next steps identified
- [ ] Findings shared with team

## Methodology

[How we'll conduct the research]

## Deliverables

- [ ] Research document
- [ ] Recommendations
- [ ] POC code (if applicable)
- [ ] Decision matrix (if applicable)
```

## 7. Post-Creation Actions

After successful creation:

1. **Show ticket URL**: "✅ Created ticket: [MAR-XXX: Title](url)"
2. **Suggest next steps**:
   - "Ready to start work? Use `/start-ticket MAR-XXX`"
   - "Need to analyze further? Use `/analyze-ticket MAR-XXX`"
   - "Want to add more context? I can help add comments"
3. **Confirm project assignment**: "Ticket created in Airbolt MVP project"

## 8. Error Handling

Handle common issues gracefully:

- **Missing information**: Re-prompt for required fields
- **API errors**: Clear message with retry suggestion
- **Duplicate ticket**: Show similar tickets and confirm creation
- **Invalid priority**: Explain options and ask again

Remember: The goal is to create tickets that are immediately actionable, with all context needed for successful implementation.
