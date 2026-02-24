export class AppError extends Error {
    public code: string;
    public isOperational: boolean;
    public details?: any;

    constructor(message: string, code = 'INTERNAL_ERROR', isOperational = true, details?: any) {
        super(message);
        this.name = 'AppError';
        this.code = code;
        this.isOperational = isOperational;
        this.details = details;

        // Mantiene la traza de pila (stack trace)
        Object.setPrototypeOf(this, AppError.prototype);
    }
}
