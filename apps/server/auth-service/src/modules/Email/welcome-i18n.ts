// Backend-side i18n for the welcome email sent after an invitation is accepted.
// Email content is rendered on the server, so client-side i18n does NOT apply
// here — see .claude/rules/i18n.md "Backend" section. Locale parsing is shared
// with the OTP / invite emails (otp-i18n.ts).

import { normalizeLocale, SupportedLocale } from './otp-i18n';

/** How the invitation was accepted — selects the "next step" line. */
export type WelcomeVariant = 'google' | 'password';

export interface WelcomeEmailVars {
  name: string;
  workspace: string;
  role: string;
}

/** Fully interpolated strings handed to templates/welcome.ejs. */
export interface WelcomeEmailStrings {
  subject: string;
  heading: string;
  greeting: string;
  body: string;
  nextStep: string;
  cta: string;
  orCopy: string;
  footerNote: string;
  copyright: string;
  sentBy: string;
}

type RawStrings = Omit<WelcomeEmailStrings, 'nextStep'> & {
  nextStepGoogle: string;
  nextStepPassword: string;
};

/** Raw templates; `{name}`, `{workspace}`, `{role}` are replaced in TS. */
const STRINGS: Record<SupportedLocale, RawStrings> = {
  en: {
    subject: 'Your PON account is active',
    heading: 'Welcome to {workspace}',
    greeting: 'Hello {name},',
    body: 'Your PON account is active. You are now a member of {workspace} with the role {role}.',
    nextStepGoogle:
      'Sign in with Google any time. To also sign in with your email, set a PON password in Settings → Password & Security.',
    nextStepPassword: 'Sign in with your email and the password you just set.',
    cta: 'Open PON',
    orCopy: 'Or copy and paste this link into your browser:',
    footerNote:
      'You are receiving this email because you accepted an invitation to {workspace} on PON.',
    copyright: '© 2025 PON. All rights reserved.',
    sentBy: 'Sent by PON Support',
  },
  vi: {
    subject: 'Tài khoản PON của bạn đã được kích hoạt',
    heading: 'Chào mừng bạn đến với {workspace}',
    greeting: 'Chào {name},',
    body: 'Tài khoản PON của bạn đã được kích hoạt. Bạn hiện là thành viên của {workspace} với vai trò {role}.',
    nextStepGoogle:
      'Bạn có thể đăng nhập bằng Google bất cứ lúc nào. Muốn đăng nhập bằng email, hãy đặt mật khẩu PON trong Cài đặt → Mật khẩu & Bảo mật.',
    nextStepPassword: 'Đăng nhập bằng email và mật khẩu bạn vừa tạo.',
    cta: 'Mở PON',
    orCopy: 'Hoặc sao chép và dán liên kết này vào trình duyệt:',
    footerNote:
      'Bạn nhận được email này vì đã chấp nhận lời mời tham gia {workspace} trên PON.',
    copyright: '© 2025 PON. Bảo lưu mọi quyền.',
    sentBy: 'Gửi bởi bộ phận hỗ trợ PON',
  },
  zh: {
    subject: '您的 PON 账户已激活',
    heading: '欢迎加入 {workspace}',
    greeting: '{name}，您好：',
    body: '您的 PON 账户已激活。您现在是 {workspace} 的成员，角色为 {role}。',
    nextStepGoogle:
      '您可以随时使用 Google 登录。如需同时使用邮箱登录，请在“设置 → 密码与安全”中设置 PON 密码。',
    nextStepPassword: '请使用您的邮箱和刚刚设置的密码登录。',
    cta: '打开 PON',
    orCopy: '或将此链接复制并粘贴到浏览器中：',
    footerNote: '您收到此邮件是因为您接受了加入 PON 上 {workspace} 的邀请。',
    copyright: '© 2025 PON. 保留所有权利。',
    sentBy: '由 PON 支持团队发送',
  },
  ja: {
    subject: 'PON アカウントが有効になりました',
    heading: '{workspace} へようこそ',
    greeting: '{name} さん、こんにちは。',
    body: 'PON アカウントが有効になりました。あなたは {workspace} のメンバー（ロール: {role}）になりました。',
    nextStepGoogle:
      'いつでも Google でサインインできます。メールアドレスでもサインインしたい場合は、「設定 → パスワードとセキュリティ」で PON のパスワードを設定してください。',
    nextStepPassword:
      'メールアドレスと、先ほど設定したパスワードでサインインしてください。',
    cta: 'PON を開く',
    orCopy: 'または、次のリンクをコピーしてブラウザに貼り付けてください：',
    footerNote:
      'このメールは、PON の {workspace} への招待を承認されたためお送りしています。',
    copyright: '© 2025 PON. 全著作権所有。',
    sentBy: 'PON サポートより送信',
  },
  ko: {
    subject: 'PON 계정이 활성화되었습니다',
    heading: '{workspace}에 오신 것을 환영합니다',
    greeting: '{name}님, 안녕하세요.',
    body: 'PON 계정이 활성화되었습니다. 이제 {role} 역할로 {workspace}의 멤버가 되었습니다.',
    nextStepGoogle:
      '언제든지 Google로 로그인할 수 있습니다. 이메일로도 로그인하려면 설정 → 비밀번호 및 보안에서 PON 비밀번호를 설정하세요.',
    nextStepPassword: '이메일과 방금 설정한 비밀번호로 로그인하세요.',
    cta: 'PON 열기',
    orCopy: '또는 아래 링크를 복사하여 브라우저에 붙여 넣으세요:',
    footerNote:
      'PON의 {workspace} 초대를 수락하셨기 때문에 이 이메일을 받으셨습니다.',
    copyright: '© 2025 PON. 모든 권리 보유.',
    sentBy: 'PON 지원팀에서 발송',
  },
  es: {
    subject: 'Tu cuenta de PON está activa',
    heading: 'Te damos la bienvenida a {workspace}',
    greeting: 'Hola, {name}:',
    body: 'Tu cuenta de PON está activa. Ahora eres miembro de {workspace} con el rol {role}.',
    nextStepGoogle:
      'Puedes iniciar sesión con Google en cualquier momento. Para iniciar sesión también con tu correo, crea una contraseña de PON en Ajustes → Contraseña y seguridad.',
    nextStepPassword:
      'Inicia sesión con tu correo y la contraseña que acabas de crear.',
    cta: 'Abrir PON',
    orCopy: 'O copia y pega este enlace en tu navegador:',
    footerNote:
      'Recibes este correo porque aceptaste una invitación a {workspace} en PON.',
    copyright: '© 2025 PON. Todos los derechos reservados.',
    sentBy: 'Enviado por el soporte de PON',
  },
  fr: {
    subject: 'Votre compte PON est actif',
    heading: 'Bienvenue dans {workspace}',
    greeting: 'Bonjour {name},',
    body: 'Votre compte PON est actif. Vous êtes désormais membre de {workspace} avec le rôle {role}.',
    nextStepGoogle:
      'Vous pouvez vous connecter avec Google à tout moment. Pour vous connecter aussi avec votre adresse e-mail, définissez un mot de passe PON dans Paramètres → Mot de passe et sécurité.',
    nextStepPassword:
      'Connectez-vous avec votre adresse e-mail et le mot de passe que vous venez de définir.',
    cta: 'Ouvrir PON',
    orCopy: 'Ou copiez-collez ce lien dans votre navigateur :',
    footerNote:
      'Vous recevez cet e-mail car vous avez accepté une invitation à rejoindre {workspace} sur PON.',
    copyright: '© 2025 PON. Tous droits réservés.',
    sentBy: 'Envoyé par le support PON',
  },
};

/** Single pass: values (user-provided names) are never re-scanned for tokens. */
function interpolate(template: string, vars: WelcomeEmailVars): string {
  return template.replace(/\{(name|workspace|role)\}/g, (_m, key: string) =>
    String(vars[key as keyof WelcomeEmailVars] ?? ''),
  );
}

/** Localized, interpolated welcome email strings (unknown locale → en). */
export function getWelcomeEmailStrings(
  locale: string | null | undefined,
  vars: WelcomeEmailVars,
  variant: WelcomeVariant,
): WelcomeEmailStrings {
  const { nextStepGoogle, nextStepPassword, ...rest } =
    STRINGS[normalizeLocale(locale)];
  const raw: WelcomeEmailStrings = {
    ...rest,
    nextStep: variant === 'google' ? nextStepGoogle : nextStepPassword,
  };
  const out = {} as WelcomeEmailStrings;
  for (const key of Object.keys(raw) as (keyof WelcomeEmailStrings)[]) {
    out[key] = interpolate(raw[key], vars);
  }
  return out;
}
