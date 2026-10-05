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
      "Next step: create your PON password — you'll be asked right after signing in. You can then sign in with Google or with your email and password.",
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
      'Bước tiếp theo: tạo mật khẩu PON — bạn sẽ được yêu cầu ngay sau khi đăng nhập. Sau đó bạn có thể đăng nhập bằng Google hoặc bằng email và mật khẩu.',
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
      '下一步：创建您的 PON 密码——登录后系统会立即提示您。之后，您既可以使用 Google 登录，也可以使用邮箱和密码登录。',
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
      '次のステップ：PON のパスワードを作成してください。サインイン直後に作成を求められます。その後は Google でも、メールアドレスとパスワードでもサインインできます。',
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
      '다음 단계: PON 비밀번호를 만드세요. 로그인 직후 바로 안내됩니다. 이후에는 Google 또는 이메일과 비밀번호로 로그인할 수 있습니다.',
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
      'Siguiente paso: crea tu contraseña de PON; te la pediremos justo después de iniciar sesión. Después podrás iniciar sesión con Google o con tu correo y contraseña.',
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
      'Prochaine étape : créez votre mot de passe PON — il vous sera demandé juste après la connexion. Vous pourrez ensuite vous connecter avec Google ou avec votre adresse e-mail et votre mot de passe.',
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
