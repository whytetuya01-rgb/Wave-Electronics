// This file is a re-export barrel. The job controller logic was split into
// jobCrudController.ts, jobApprovalController.ts, jobIssueController.ts and
// jobClosingController.ts during the stabilization refactor (jobController.ts
// had grown to ~1,100 lines). This barrel is kept so every existing import
// of './jobController.js' (jobRoutes.ts, test-api.ts, the safety scripts)
// continues to resolve exactly as before, with no call-site changes required.
export * from './jobCrudController.js';
export * from './jobApprovalController.js';
export * from './jobIssueController.js';
export * from './jobClosingController.js';
