/** Thrown when a GameAction does not fit the current phase or player. The
 *  caller (server) is expected to catch this and reject the action without
 *  applying or broadcasting any state change. */
export class IllegalActionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'IllegalActionError';
  }
}
