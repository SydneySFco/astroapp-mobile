export type QuarantineAdminErrorCode =
  | 'unauthorized'
  | 'bad_request'
  | 'not_found'
  | 'stale'
  | 'idempotent_duplicate'
  | 'internal_error';

export type QuarantineAdminErrorPayload = {
  error: {
    code: QuarantineAdminErrorCode;
    message: string;
    details?: Record<string, unknown>;
  };
};

export class QuarantineAdminApiError extends Error {
  public readonly code: QuarantineAdminErrorCode;
  public readonly status: number;
  public readonly details?: Record<string, unknown>;

  public constructor(input: {
    code: QuarantineAdminErrorCode;
    status: number;
    message: string;
    details?: Record<string, unknown>;
  }) {
    super(input.message);
    this.name = 'QuarantineAdminApiError';
    this.code = input.code;
    this.status = input.status;
    this.details = input.details;
  }
}

export const toQuarantineAdminErrorPayload = (
  error: QuarantineAdminApiError,
): QuarantineAdminErrorPayload => ({
  error: {
    code: error.code,
    message: error.message,
    details: error.details,
  },
});
