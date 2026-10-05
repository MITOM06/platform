import { join } from 'path';
import * as ejs from 'ejs';
import { SUPPORTED_LOCALES } from './otp-i18n';
import { getWelcomeEmailStrings } from './welcome-i18n';

const VARS = { name: 'Jane', workspace: 'Acme', role: 'Admin' };

describe('welcome email i18n', () => {
  it('en: the variant picks the next-step line', () => {
    const google = getWelcomeEmailStrings('en', VARS, 'google');
    const password = getWelcomeEmailStrings('en', VARS, 'password');
    expect(google.subject).toBe('Your PON account is active');
    expect(google.body).toContain('Acme');
    expect(google.body).toContain('Admin');
    expect(google.nextStep).toMatch(/^Next step: create your PON password/);
    expect(password.nextStep).toBe(
      'Sign in with your email and the password you just set.',
    );
    expect(google.cta).toBe('Open PON');
  });

  it.each(SUPPORTED_LOCALES)(
    '%s: every string is present and fully interpolated',
    (locale) => {
      for (const variant of ['google', 'password'] as const) {
        const t = getWelcomeEmailStrings(locale, VARS, variant);
        for (const value of Object.values(t)) {
          expect(value.trim()).not.toBe('');
          expect(value).not.toMatch(/\{(name|workspace|role)\}/);
        }
        expect(t.heading).toContain('Acme');
        expect(t.greeting).toContain('Jane');
        expect(t.body).toContain('Admin');
      }
      expect(getWelcomeEmailStrings(locale, VARS, 'google').nextStep).not.toBe(
        getWelcomeEmailStrings(locale, VARS, 'password').nextStep,
      );
    },
  );

  it('unknown locale falls back to en', () => {
    expect(getWelcomeEmailStrings('xx', VARS, 'google').subject).toBe(
      'Your PON account is active',
    );
  });

  it('user-provided values are inserted once, never re-scanned for tokens', () => {
    const t = getWelcomeEmailStrings(
      'en',
      { name: '{workspace}', workspace: 'Acme', role: 'Admin' },
      'password',
    );
    expect(t.greeting).toBe('Hello {workspace},');
  });

  it('template renders the strings and the link, HTML-escaped', async () => {
    const t = getWelcomeEmailStrings(
      'en',
      { name: '<script>x</script>', workspace: 'Acme', role: 'Admin' },
      'google',
    );
    const html = await ejs.renderFile(
      join(__dirname, 'templates/welcome.ejs'),
      {
        t,
        loginUrl: 'https://pon.acme.com/login',
        email: 'jane@acme.com',
      },
    );
    expect(html).toContain('href="https://pon.acme.com/login"');
    expect(html).toContain('Open PON');
    expect(html).toContain('Next step: create your PON password');
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });
});
