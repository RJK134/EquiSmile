export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly expose: boolean = true,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}
