import type { NotificationErrorCode } from "./notifications.types";

export class NotificationError extends Error {
  constructor(
    public readonly code: NotificationErrorCode,
    message: string,
  ) {
    super(message);
  }
}
