export class AppError extends Error {
  public statusCode: number;
  public code?: string;
  public isOperational: boolean;

  constructor(message: string, statusCode: number = 500, validationErrors?: any[], code?: string) {
    super(message);
    
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = true;
    
    // Attach validation errors if provided
    if (validationErrors) {
      (this as any).validationErrors = validationErrors;
    }

    Error.captureStackTrace(this, this.constructor);
  }
}

export default AppError;