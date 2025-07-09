Ultrathink about what makes an exceptional code review—one that elevates both the code and the developer. Consider technical excellence, business impact, maintainability, and team growth.

Read the Linear ticket, comments, and PR information thoroughly.

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

Provide that level of thoughtful, constructive review — balancing praise for good decisions with actionable suggestions for improvements. Focus on teaching, not just critiquing.
