/**
 * Field-level validation for the Settings → Security password form (mirror of the
 * mobile `security_settings_screen.dart` validators). Every problem is reported
 * under the input it belongs to, as a message key of `settings.security`.
 */

export type PasswordChangeField = 'current' | 'next' | 'confirm'

export type FieldError = { key: string; values?: Record<string, number> }

export type PasswordChangeFieldErrors = Partial<Record<PasswordChangeField, FieldError>>

/** Display order, so the first invalid input can take focus. */
export const PASSWORD_CHANGE_FIELDS: readonly PasswordChangeField[] = ['current', 'next', 'confirm']

/** Same policy as sign-up, invitations and set-password: ≥8 + upper, lower, digit, special. */
export const MIN_PASSWORD_LENGTH = 8

function newPasswordError(pw: string): FieldError | undefined {
  if (pw === '') return { key: 'newRequired' }
  if (pw.length < MIN_PASSWORD_LENGTH) return { key: 'tooShort', values: { min: MIN_PASSWORD_LENGTH } }
  if (!/[A-Z]/.test(pw)) return { key: 'needUppercase' }
  if (!/[a-z]/.test(pw)) return { key: 'needLowercase' }
  if (!/[0-9]/.test(pw)) return { key: 'needDigit' }
  if (!/[!@#$%^&*]/.test(pw)) return { key: 'needSpecial' }
  return undefined
}

/**
 * Problems per field; empty when the form can be sent. `needsCurrent` is false for
 * a first password (Google-only account), which has no current-password input.
 * The confirmation is only judged once a new password was typed.
 */
export function validatePasswordChange(
  form: { current: string; next: string; confirm: string },
  needsCurrent: boolean,
): PasswordChangeFieldErrors {
  const errors: PasswordChangeFieldErrors = {}
  if (needsCurrent && form.current === '') errors.current = { key: 'currentRequired' }
  const next = newPasswordError(form.next)
  if (next) errors.next = next
  if (form.next !== '' && form.confirm !== form.next) errors.confirm = { key: 'mismatch' }
  return errors
}

/**
 * The input a server answer (a `passwordChangeErrorKey` key) belongs to, or `null`
 * for form-wide problems (network, SSO, unknown) shown above the form.
 */
export function passwordChangeErrorField(key: string): PasswordChangeField | null {
  if (key === 'incorrectCurrent' || key === 'currentRequired') return 'current'
  if (key === 'tooShort') return 'next'
  return null
}
