// Backend-side i18n for invitation emails (invite-only onboarding).
// Email content is rendered on the server, so client-side i18n does NOT apply
// here — see .claude/rules/i18n.md "Backend" section. Locale parsing is shared
// with the OTP email (otp-i18n.ts).

import { normalizeLocale, SupportedLocale } from './otp-i18n';

export interface InviteEmailVars {
  inviter: string;
  workspace: string;
  role: string;
}

/** Fully interpolated strings handed to templates/invite.ejs. */
export interface InviteEmailStrings {
  subject: string;
  heading: string;
  greeting: string;
  body: string;
  cta: string;
  orCopy: string;
  expiryNote: string;
  ignoreNote: string;
  copyright: string;
  sentBy: string;
}

/** Raw templates; `{inviter}`, `{workspace}`, `{role}` are replaced in TS. */
const STRINGS: Record<SupportedLocale, InviteEmailStrings> = {
  en: {
    subject: '{inviter} invited you to {workspace} on PON',
    heading: 'You have been invited to {workspace}',
    greeting: 'Hello,',
    body: '{inviter} invited you to join {workspace} on PON as {role}.',
    cta: 'Accept invitation',
    orCopy: 'Or copy and paste this link into your browser:',
    expiryNote: 'This invitation expires in 7 days.',
    ignoreNote:
      'If you were not expecting this invitation, you can safely ignore this email.',
    copyright: '© 2025 PON. All rights reserved.',
    sentBy: 'Sent by PON Support',
  },
  vi: {
    subject: '{inviter} đã mời bạn tham gia {workspace} trên PON',
    heading: 'Bạn được mời tham gia {workspace}',
    greeting: 'Chào bạn,',
    body: '{inviter} đã mời bạn tham gia {workspace} trên PON với vai trò {role}.',
    cta: 'Chấp nhận lời mời',
    orCopy: 'Hoặc sao chép và dán liên kết này vào trình duyệt:',
    expiryNote: 'Lời mời này sẽ hết hạn sau 7 ngày.',
    ignoreNote:
      'Nếu bạn không mong đợi lời mời này, bạn có thể bỏ qua email này.',
    copyright: '© 2025 PON. Bảo lưu mọi quyền.',
    sentBy: 'Gửi bởi bộ phận hỗ trợ PON',
  },
  zh: {
    subject: '{inviter} 邀请您加入 PON 上的 {workspace}',
    heading: '您受邀加入 {workspace}',
    greeting: '您好，',
    body: '{inviter} 邀请您以 {role} 身份加入 PON 上的 {workspace}。',
    cta: '接受邀请',
    orCopy: '或将此链接复制并粘贴到浏览器中：',
    expiryNote: '此邀请将在 7 天后失效。',
    ignoreNote: '如果您没有预期收到此邀请，可以忽略此邮件。',
    copyright: '© 2025 PON. 保留所有权利。',
    sentBy: '由 PON 支持团队发送',
  },
  ja: {
    subject: '{inviter} さんから PON の {workspace} への招待が届きました',
    heading: '{workspace} に招待されました',
    greeting: 'こんにちは、',
    body: '{inviter} さんが、PON の {workspace} に {role} として参加するようあなたを招待しました。',
    cta: '招待を承認する',
    orCopy: 'または、次のリンクをコピーしてブラウザに貼り付けてください：',
    expiryNote: 'この招待の有効期限は 7 日間です。',
    ignoreNote:
      'この招待にお心当たりがない場合は、このメールを無視してください。',
    copyright: '© 2025 PON. 全著作権所有。',
    sentBy: 'PON サポートより送信',
  },
  ko: {
    subject: '{inviter}님이 PON의 {workspace}에 초대했습니다',
    heading: '{workspace}에 초대되었습니다',
    greeting: '안녕하세요,',
    body: '{inviter}님이 PON의 {workspace}에 {role}(으)로 참여하도록 초대했습니다.',
    cta: '초대 수락',
    orCopy: '또는 아래 링크를 복사하여 브라우저에 붙여 넣으세요:',
    expiryNote: '이 초대는 7일 후 만료됩니다.',
    ignoreNote: '이 초대를 예상하지 못하셨다면 이 이메일을 무시하셔도 됩니다.',
    copyright: '© 2025 PON. 모든 권리 보유.',
    sentBy: 'PON 지원팀에서 발송',
  },
  es: {
    subject: '{inviter} te invitó a {workspace} en PON',
    heading: 'Te han invitado a {workspace}',
    greeting: 'Hola,',
    body: '{inviter} te invitó a unirte a {workspace} en PON como {role}.',
    cta: 'Aceptar invitación',
    orCopy: 'O copia y pega este enlace en tu navegador:',
    expiryNote: 'Esta invitación caduca en 7 días.',
    ignoreNote:
      'Si no esperabas esta invitación, puedes ignorar este correo sin problema.',
    copyright: '© 2025 PON. Todos los derechos reservados.',
    sentBy: 'Enviado por el soporte de PON',
  },
  fr: {
    subject: '{inviter} vous a invité à rejoindre {workspace} sur PON',
    heading: 'Vous êtes invité à rejoindre {workspace}',
    greeting: 'Bonjour,',
    body: '{inviter} vous a invité à rejoindre {workspace} sur PON en tant que {role}.',
    cta: "Accepter l'invitation",
    orCopy: 'Ou copiez-collez ce lien dans votre navigateur :',
    expiryNote: 'Cette invitation expire dans 7 jours.',
    ignoreNote:
      "Si vous n'attendiez pas cette invitation, vous pouvez ignorer cet e-mail.",
    copyright: '© 2025 PON. Tous droits réservés.',
    sentBy: 'Envoyé par le support PON',
  },
};

function interpolate(template: string, vars: InviteEmailVars): string {
  return template.replace(/\{(inviter|workspace|role)\}/g, (_m, key: string) =>
    String(vars[key as keyof InviteEmailVars] ?? ''),
  );
}

/** Localized, interpolated invitation email strings (unknown locale → en). */
export function getInviteEmailStrings(
  locale: string | null | undefined,
  vars: InviteEmailVars,
): InviteEmailStrings {
  const raw = STRINGS[normalizeLocale(locale)];
  const out = {} as InviteEmailStrings;
  for (const key of Object.keys(raw) as (keyof InviteEmailStrings)[]) {
    out[key] = interpolate(raw[key], vars);
  }
  return out;
}
