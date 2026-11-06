# TailorMail production foundation

## Implemented in this branch
- Private workspace API routes require Google OAuth bearer token verification and an authorized team email.
- Owner-only team authorization; Viewer accounts cannot write and protected actions require stored permissions.
- All React workspace API requests use the authenticated `apiFetch` helper.
- Anonymous server-sent state broadcasts are replaced by authenticated periodic state refresh.
- Invoice payment route returns HTTP 501 instead of fabricating a successful settlement.
- Browser checkout and billing screens no longer claim to charge cards or accept payments.
- Server rejects state updates that create an unverified Paid invoice.
- CSV import requires an email address instead of generating fabricated contact addresses.
- CSV-sourced leads default to no automatic question handling.

## Not production-ready yet
1. Configure a real Stripe Checkout integration and verify signed webhooks before allowing an invoice to become Paid. Do not trust client-supplied status or amount.
2. Replace the monolithic shared workspace snapshot with tenant-scoped normalized database records, transactional writes, and access controls.
3. Implement a durable job queue for timed outreach. Stop sequences on replies, unsubscribes, bounce signals, or manual suppression. Require deliberate campaign launch, daily caps, and approval policy.
4. Add actual email verification and sourced contact evidence; prohibit model-generated addresses from being treated as verified.
5. Protect inbound webhooks with signatures and rate limits, add validation and structured logging.
6. Move any production/customer data out of the repository. Existing committed content persists in Git history even after deletion. Consider rotating impacted secrets and removing sensitive history through the documented GitHub process.
7. Add end-to-end tests, deployment secrets, production monitoring, and a production-ready build/start command.
8. Move Google OAuth and session handling to a persistent secure server session if unattended jobs are desired; never retain provider access tokens in plain text.
9. Review open tracking consent, deliverability, CAN-SPAM compliance, and metrics reliability.

## Verification
Code was changed through the GitHub connector. Automated build and runtime verification were unavailable in the execution environment. Before merging, run `npm install`, `npm run lint`, and `npm run build`, then test authenticated and unauthorized requests and all billing safeguards.

## Deployment safety
Do not deploy this branch to an existing live workspace without a backup, a verified operator allowlist, and a review of stored data. No actual emails or charges were triggered while preparing this branch.
