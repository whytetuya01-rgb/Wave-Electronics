// Carries an HTTP status and optional structured detail (e.g. which
// component was short) so the route handler can return a precise response
// without string-matching error messages. Lives in its own module (rather
// than inside one of the job controllers) so jobCrudController,
// jobApprovalController, jobIssueController and jobClosingController can all
// import it without creating a circular dependency between themselves.
export class JobApprovalError extends Error {
  status: number;
  details?: Record<string, unknown>;
  constructor(message: string, status = 400, details?: Record<string, unknown>) {
    super(message);
    this.name = 'JobApprovalError';
    this.status = status;
    this.details = details;
  }
}
