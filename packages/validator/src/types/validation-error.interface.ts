import { ErrorObject } from 'ajv';

export interface ValidationError extends ErrorObject {
  validationType: 'path' | 'query' | 'body' | 'response';
}

export interface ValidationErrorResponse {
  message: string;
  errors: ValidationError[];
}
