// Input validation utilities for edge functions
// ข้อ 7: Insufficient input validation

export interface ValidationError {
  field: string;
  message: string;
}

export class ValidationException extends Error {
  constructor(public errors: ValidationError[]) {
    super('Validation failed');
    this.name = 'ValidationException';
  }
}

// Email validation
export function validateEmail(email: string): ValidationError | null {
  if (!email || typeof email !== 'string') {
    return { field: 'email', message: 'Email is required' };
  }
  
  const trimmed = email.trim();
  if (trimmed.length === 0) {
    return { field: 'email', message: 'Email cannot be empty' };
  }
  
  if (trimmed.length > 255) {
    return { field: 'email', message: 'Email must be less than 255 characters' };
  }
  
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(trimmed)) {
    return { field: 'email', message: 'Invalid email format' };
  }
  
  return null;
}

// Full name validation
export function validateFullName(fullName: string): ValidationError | null {
  if (!fullName || typeof fullName !== 'string') {
    return { field: 'full_name', message: 'Full name is required' };
  }
  
  const trimmed = fullName.trim();
  if (trimmed.length === 0) {
    return { field: 'full_name', message: 'Full name cannot be empty' };
  }
  
  if (trimmed.length < 2) {
    return { field: 'full_name', message: 'Full name must be at least 2 characters' };
  }
  
  if (trimmed.length > 100) {
    return { field: 'full_name', message: 'Full name must be less than 100 characters' };
  }
  
  return null;
}

// Password validation
export function validatePassword(password: string): ValidationError | null {
  if (!password || typeof password !== 'string') {
    return { field: 'password', message: 'Password is required' };
  }
  
  if (password.length < 12) {
    return { field: 'password', message: 'Password must be at least 12 characters' };
  }
  
  if (password.length > 128) {
    return { field: 'password', message: 'Password must be less than 128 characters' };
  }
  
  return null;
}

// Public ID validation (format: PREFIX-XXXXXX)
export function validatePublicId(publicId: string): ValidationError | null {
  if (!publicId || typeof publicId !== 'string') {
    return { field: 'public_id', message: 'Public ID is required' };
  }
  
  if (publicId.length > 20) {
    return { field: 'public_id', message: 'Public ID must be less than 20 characters' };
  }
  
  const publicIdRegex = /^[A-Z]{3}-\d{6}$/;
  if (!publicIdRegex.test(publicId)) {
    return { field: 'public_id', message: 'Invalid public ID format (expected: XXX-000000)' };
  }
  
  return null;
}

// Reference validation (alphanumeric, dash, underscore only)
export function validateReference(reference: string): ValidationError | null {
  if (!reference || typeof reference !== 'string') {
    return { field: 'reference', message: 'Reference is required' };
  }
  
  const trimmed = reference.trim();
  if (trimmed.length === 0) {
    return { field: 'reference', message: 'Reference cannot be empty' };
  }
  
  if (trimmed.length > 255) {
    return { field: 'reference', message: 'Reference must be less than 255 characters' };
  }
  
  const referenceRegex = /^[a-zA-Z0-9-_]+$/;
  if (!referenceRegex.test(trimmed)) {
    return { field: 'reference', message: 'Reference must contain only letters, numbers, dash, and underscore' };
  }
  
  return null;
}

// Amount validation (positive integer, not exceeding max)
export function validateAmount(amount: number, max: number = 999999999999): ValidationError | null {
  if (typeof amount !== 'number') {
    return { field: 'amount', message: 'Amount must be a number' };
  }
  
  if (!Number.isInteger(amount)) {
    return { field: 'amount', message: 'Amount must be an integer' };
  }
  
  if (amount <= 0) {
    return { field: 'amount', message: 'Amount must be positive' };
  }
  
  if (amount > max) {
    return { field: 'amount', message: `Amount cannot exceed ${max}` };
  }
  
  return null;
}

// Generic string validation
export function validateString(
  fieldName: string,
  value: string,
  options: {
    required?: boolean;
    minLength?: number;
    maxLength?: number;
    pattern?: RegExp;
    patternMessage?: string;
  } = {}
): ValidationError | null {
  const { required = true, minLength = 0, maxLength = 1000, pattern, patternMessage } = options;
  
  if (!value || typeof value !== 'string') {
    if (required) {
      return { field: fieldName, message: `${fieldName} is required` };
    }
    return null;
  }
  
  const trimmed = value.trim();
  
  if (required && trimmed.length === 0) {
    return { field: fieldName, message: `${fieldName} cannot be empty` };
  }
  
  if (trimmed.length < minLength) {
    return { field: fieldName, message: `${fieldName} must be at least ${minLength} characters` };
  }
  
  if (trimmed.length > maxLength) {
    return { field: fieldName, message: `${fieldName} must be less than ${maxLength} characters` };
  }
  
  if (pattern && !pattern.test(trimmed)) {
    return { field: fieldName, message: patternMessage || `Invalid ${fieldName} format` };
  }
  
  return null;
}

// Validate multiple fields and throw if any fail
export function validateFields(validators: Array<() => ValidationError | null>): void {
  const errors: ValidationError[] = [];
  
  for (const validator of validators) {
    const error = validator();
    if (error) {
      errors.push(error);
    }
  }
  
  if (errors.length > 0) {
    throw new ValidationException(errors);
  }
}

// Sanitize error message for client response
export function sanitizeErrorMessage(error: Error): string {
  const message = error.message.toLowerCase();
  
  // Map technical errors to user-friendly messages
  const errorMap: Record<string, string> = {
    'duplicate key': 'Resource already exists',
    'foreign key': 'Invalid reference',
    'violates check': 'Invalid input',
    'permission denied': 'Access denied',
    'violates row-level security': 'Access denied',
    'null value': 'Required field is missing',
  };
  
  for (const [pattern, userMessage] of Object.entries(errorMap)) {
    if (message.includes(pattern)) {
      return userMessage;
    }
  }
  
  // Default generic message
  return 'An error occurred. Please contact support.';
}
