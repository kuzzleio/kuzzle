/**
 * Available error class
 */
export type ErrorClassNames = 'BadRequestError' | 'ExternalServiceError' | 'ForbiddenError' | 'GatewayTimeoutError' | 'InternalError' | 'KuzzleError' | 'MultipleErrorsError' | 'NotFoundError' | 'PartialError' | 'PluginImplementationError' | 'ServiceUnavailableError' | 'SizeLimitError' | 'UnauthorizedError' | 'PreconditionError' | 'TooManyRequestsError';

/**
 * Represents a standardized error definition
 */
export type ErrorDefinition = CustomErrorDefinition & {
  code: number;
}

/**
 * Represents a custom standardized error definition
 */
export type CustomErrorDefinition = {
  /**
   * Error description for documentation purpose
   */
  description: string;

  /**
   * Error message
   */
  message: string;

  /**
   * Error class
   */
  class: ErrorClassNames;

  /**
   * Custom HTTP status.
   *
   * Only available for generic KuzzleError.
   */
  status?: number;
};