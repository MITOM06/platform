import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

/**
 * Structural guard: every form in the sign-in, onboarding and security screens posts.
 *
 * A click on "Sign in" before React hydrates submits the form natively. Without `method`
 * that is a GET, and react-hook-form's `name` attributes put the email and password in the
 * URL — browser history, server and proxy logs. The same goes for OTP, 2FA and backup codes.
 */

const WEB_ROOT = path.join(__dirname, '../../..')
const DIRS = ['app/(auth)', 'app/(onboarding)', 'components/auth', 'components/settings']

function sourceFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) return entry.name === '__tests__' ? [] : sourceFiles(full)
    return entry.name.endsWith('.tsx') ? [full] : []
  })
}

describe('sensitive forms', () => {
  const forms = DIRS.flatMap((dir) => sourceFiles(path.join(WEB_ROOT, dir))).flatMap((file) =>
    (fs.readFileSync(file, 'utf8').match(/<form\b[^>]*>/g) ?? []).map((tag) => ({
      file: path.relative(WEB_ROOT, file),
      tag,
    })),
  )

  it('finds the sign-in form (the scan is looking in the right place)', () => {
    expect(forms.some((f) => f.file.endsWith(path.join('login', 'page.tsx')))).toBe(true)
  })

  it('never submit as GET, even before hydration', () => {
    const notPost = forms.filter((f) => !/\bmethod="post"/.test(f.tag)).map((f) => f.file)
    expect(notPost).toEqual([])
  })
})
