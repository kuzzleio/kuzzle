/**
 * Available error class
 */
export type ErrorClassNames = 'BadRequestError' | 'ExternalServiceError' | 'ForbiddenError' | 'GatewayTimeoutError' | 'InternalError' | 'KuzzleError' | 'MultipleErrorsError' | 'NotFoundError' | 'PartialError' | 'PluginImplementationError' | 'ServiceUnavailableError' | 'SizeLimitError' | 'UnauthorizedError' | 'PreconditionError' | 'TooManyRequestsError';

/**
 * Represents a standardized error definition
 */
export type ErrorDefinition = {
  description: string;
  code: number;
  message: string;
  class: ErrorClassNames
};
