// Backend-side i18n for OTP emails.
// Email content is rendered on the server, so client-side i18n (Flutter ARB /
// next-intl) does NOT apply here — see .claude/rules/i18n.md "Backend" section.
// This module is the single source of truth for localized OTP email strings.

export const SUPPORTED_LOCALES = [
  'en',
  'vi',
  'zh',
  'ja',
  'ko',
  'es',
  'fr',
] as const;

export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

export const DEFAULT_LOCALE: SupportedLocale = 'en';

export interface OtpEmailStrings {
  /** Email subject line. */
  subject: string;
  /** Main heading inside the email body. */
  heading: string;
  /** Greeting line (e.g. "Hello,"). */
  greeting: string;
  /** Instruction line that precedes the OTP code. */
  instruction: string;
  /** Small note about expiry / ignoring the email. */
  expiryNote: string;
}

const STRINGS: Record<SupportedLocale, OtpEmailStrings> = {
  en: {
    subject: 'Your verification code - PON',
    heading: 'Verify your PON account',
    greeting: 'Hello,',
    instruction:
      'You requested a verification code. Please use the OTP below to continue:',
    expiryNote:
      'This code is valid for 5 minutes. If you did not request this, please ignore this email.',
  },
  vi: {
    subject: 'Mã xác thực OTP - Ứng dụng PON',
    heading: 'Xác thực tài khoản PON',
    greeting: 'Chào bạn,',
    instruction:
      'Bạn đã yêu cầu mã xác thực. Vui lòng sử dụng mã OTP dưới đây để tiếp tục:',
    expiryNote:
      'Mã này có hiệu lực trong vòng 5 phút. Nếu bạn không thực hiện yêu cầu này, vui lòng bỏ qua email này.',
  },
  zh: {
    subject: '您的验证码 - PON',
    heading: '验证您的 PON 账户',
    greeting: '您好，',
    instruction: '您请求了一个验证码。请使用下面的 OTP 继续操作：',
    expiryNote: '此验证码有效期为 5 分钟。如果这不是您本人的操作，请忽略此邮件。',
  },
  ja: {
    subject: '認証コード - PON',
    heading: 'PON アカウントの認証',
    greeting: 'こんにちは、',
    instruction: '認証コードがリクエストされました。下記の OTP を使用して続行してください：',
    expiryNote:
      'このコードの有効期限は 5 分間です。お心当たりがない場合は、このメールを無視してください。',
  },
  ko: {
    subject: '인증 코드 - PON',
    heading: 'PON 계정 인증',
    greeting: '안녕하세요,',
    instruction: '인증 코드를 요청하셨습니다. 아래 OTP를 사용하여 계속 진행하세요:',
    expiryNote:
      '이 코드는 5분 동안 유효합니다. 요청하지 않으셨다면 이 이메일을 무시하셔도 됩니다.',
  },
  es: {
    subject: 'Tu código de verificación - PON',
    heading: 'Verifica tu cuenta de PON',
    greeting: 'Hola,',
    instruction:
      'Has solicitado un código de verificación. Usa el OTP de abajo para continuar:',
    expiryNote:
      'Este código es válido durante 5 minutos. Si no realizaste esta solicitud, ignora este correo.',
  },
  fr: {
    subject: 'Votre code de vérification - PON',
    heading: 'Vérifiez votre compte PON',
    greeting: 'Bonjour,',
    instruction:
      'Vous avez demandé un code de vérification. Veuillez utiliser le code OTP ci-dessous pour continuer :',
    expiryNote:
      "Ce code est valable pendant 5 minutes. Si vous n'êtes pas à l'origine de cette demande, veuillez ignorer cet e-mail.",
  },
};

function isSupportedLocale(value: string): value is SupportedLocale {
  return (SUPPORTED_LOCALES as readonly string[]).includes(value);
}

/**
 * Parse an `Accept-Language` header (or raw locale string) and normalize it to
 * one of the 7 supported locales. Falls back to `en`.
 *
 * Handles common forms:
 *   "vi-VN,vi;q=0.9,en;q=0.8" -> "vi"
 *   "zh-Hans-CN"              -> "zh"
 *   "fr"                      -> "fr"
 *   undefined / unknown       -> "en"
 */
export function normalizeLocale(raw?: string | null): SupportedLocale {
  if (!raw) return DEFAULT_LOCALE;

  // Take the first language tag from a comma-separated Accept-Language list,
  // strip any q-weight, then keep only the primary subtag (before "-").
  const firstTag = raw.split(',')[0]?.split(';')[0]?.trim() ?? '';
  const primary = firstTag.split('-')[0]?.toLowerCase() ?? '';

  return isSupportedLocale(primary) ? primary : DEFAULT_LOCALE;
}

/**
 * Return the localized OTP email strings for the given locale.
 * Accepts an already-normalized locale or any raw value (normalized here too,
 * so callers can pass through safely).
 */
export function getOtpEmailStrings(locale?: string | null): OtpEmailStrings {
  const normalized =
    locale && isSupportedLocale(locale) ? locale : normalizeLocale(locale);
  return STRINGS[normalized];
}
