export class KissopenError extends Error {
    readonly canTryAgain: boolean;

    constructor(message: string, canTryAgain: boolean) {
        super(message);
        this.canTryAgain = canTryAgain;
        this.name = 'RetryableError';
        Object.setPrototypeOf(this, KissopenError.prototype);
    }
}