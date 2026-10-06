/**
 * Thrown by a send handler after it already showed a localized error toast, so
 * the composer keeps the draft (text / staged attachments) without a second toast.
 * Before, the page swallowed every send failure: the composer believed the send
 * succeeded and wiped what the user typed / attached.
 */
export class ReportedSendError extends Error {
  constructor() {
    super('SEND_FAILED_REPORTED')
    this.name = 'ReportedSendError'
  }
}

export function isReportedSendError(err: unknown): err is ReportedSendError {
  return err instanceof ReportedSendError
}
