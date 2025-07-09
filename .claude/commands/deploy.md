---
description: Monitor deployment and verify changes after PR merge
---

Ultrathink about deployment verification. The code is merged, but the job isn't done until it's successfully running in production and the feedback loop is closed.

## 1. Check PR Merge Status

Verify the PR has been merged:

```bash
gh pr view --json state,mergedAt,mergeCommit
```

If not merged, check for:

- Required approvals pending
- CI checks failing
- Merge conflicts
- Branch protection rules

## 2. Monitor Deployment Pipeline

Track deployment progress:

- Check GitHub Actions or deployment pipeline status
- Monitor for any deployment failures
- Verify all deployment stages complete successfully
- Note deployment timestamps for tracking

## 3. Environment Verification

Validate changes in each environment:

**Staging (if applicable):**

- Confirm deployment completed
- Run smoke tests on key functionality
- Check application logs for errors
- Verify feature works as expected

**Production:**

- Confirm deployment completed
- Monitor error rates and performance metrics
- Verify feature availability
- Check for any immediate user reports

## 4. Documentation & Communication

Update project documentation:

- [ ] Add release notes to CHANGELOG.md
- [ ] Update deployment runbook if process changed
- [ ] Document any configuration changes made
- [ ] Note any manual steps required post-deployment
- [ ] Update API documentation if endpoints changed

## 5. Linear Ticket Closure

Update the Linear ticket:

- Move ticket status to "Done"
- Add deployment summary as comment:
  - Deployment timestamp
  - Environments deployed to
  - Any issues encountered
  - Verification steps completed
- Link to production URL if applicable

## 6. Post-Deployment Monitoring

Set up ongoing monitoring:

- Note any metrics to watch
- Set up alerts if needed
- Plan for follow-up verification
- Document rollback procedure if issues arise

## 7. Lessons Learned

Capture insights for future improvements:

- What went smoothly?
- What could be automated further?
- Any close calls or issues to prevent?
- Process improvements to suggest?

Close the loop by ensuring the feature is not just deployed, but successfully serving users and meeting its intended purpose.
