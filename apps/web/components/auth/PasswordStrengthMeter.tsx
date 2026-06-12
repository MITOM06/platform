'use client'

interface Props {
  password: string
  labels: {
    weak: string
    medium: string
    strong: string
    veryStrong: string
    reqLength: string
    reqUppercase: string
    reqLowercase: string
    reqDigit: string
    reqSpecial: string
  }
}

function computeScore(password: string): number {
  let score = 0
  if (password.length >= 8) score++
  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score++
  if (/[0-9]/.test(password)) score++
  if (/[!@#$%^&*]/.test(password)) score++
  return score
}

const BAR_COLORS = ['bg-red-500', 'bg-orange-500', 'bg-yellow-500', 'bg-green-500', 'bg-green-500']

export function PasswordStrengthMeter({ password, labels }: Props) {
  if (!password) return null
  const score = computeScore(password)
  const color = BAR_COLORS[score] ?? BAR_COLORS[0]
  const strengthLabel =
    score <= 1 ? labels.weak
    : score === 2 ? labels.medium
    : score === 3 ? labels.strong
    : labels.veryStrong

  const checks = [
    { test: password.length >= 8, label: labels.reqLength },
    { test: /[A-Z]/.test(password), label: labels.reqUppercase },
    { test: /[a-z]/.test(password), label: labels.reqLowercase },
    { test: /[0-9]/.test(password), label: labels.reqDigit },
    { test: /[!@#$%^&*]/.test(password), label: labels.reqSpecial },
  ]

  return (
    <div className="space-y-2 mt-1">
      <div className="flex gap-1">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className={`h-1.5 flex-1 rounded-full transition-colors ${i < score ? color : 'bg-muted'}`}
          />
        ))}
      </div>
      <p className="text-xs text-muted-foreground">{strengthLabel}</p>
      <ul className="space-y-0.5 text-xs">
        {checks.map(({ test, label }, i) => (
          <li
            key={i}
            className={`flex items-center gap-1 ${test ? 'text-green-500' : 'text-muted-foreground'}`}
          >
            <span>{test ? '✓' : '✗'}</span>
            <span>{label}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
