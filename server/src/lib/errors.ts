/**
 * Error whose `message` is safe to surface to the API caller. The Express
 * error handler treats anything else as an internal failure and returns a
 * generic "Server error" string regardless of what the upstream said — so
 * vendor names (Apple/Firecrawl/NVIDIA/etc.) never leak into the UI.
 */
export class PublicError extends Error {
  readonly status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "PublicError";
    this.status = status;
  }
}
