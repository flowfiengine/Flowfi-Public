# Public publication policy

**Audience:** anyone following FlowFi. **Default:** share only independently authored, reviewed, non-sensitive product information.

## Appropriate to publish

- Approved product descriptions and publicly announced features.
- High-level, non-binding roadmap items.
- Sanitized screenshots of already-public product experiences, with a separate visual review.
- General milestones and community calls for feedback.
- Original public documentation written specifically for this repository.

## Never publish

- Private repository content, commit history, diffs, pull-request links, internal tickets, or unpublished code.
- Credentials, environment variables or values, tokens, signing material, recovery phrases, or sensitive keys.
- Provider account details, usage meters, commercial terms, budgets, internal financial records, or billing evidence.
- Database schemas, migrations, raw logs, internal endpoints, network diagrams, deployment details, or operational procedures.
- Security findings, defensive configurations, rate limits, incident details, or unannounced vulnerabilities.
- Non-public customer, wallet, employee, partner, or user information.
- Images containing private browser tabs, dashboards, addresses, identifiers, notifications, or metadata.

## Review before every publication

1. Write a fresh public summary; **never mirror, cherry-pick, fork, or automatically sync** the private repository.
2. Verify the claim is accurate, approved for public disclosure, and does not present a planned feature as launched.
3. Review all text, file names, links, images, image metadata, and commit messages for accidental disclosures.
4. Remove details that could expose proprietary methods, operations, spending controls, access paths, or personal information.
5. Publish only after the content passes review. If uncertain, keep it private.

A `.gitignore` is not a security review. A public Git commit may remain accessible even after a file is deleted. When in doubt, do not publish.
