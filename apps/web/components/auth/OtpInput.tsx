'use client'

import { useRef } from 'react'
import { Input } from '@/components/ui/input'

interface Props {
  /** Controlled value as an array of single-character strings, length === `length`. */
  value: string[]
  onChange: (value: string[]) => void
  length?: number
  disabled?: boolean
}

/**
 * Reusable 6-box OTP input. Mirrors the Flutter `Otp6BoxInput` widget:
 * digit-only, auto-focus next box on entry, backspace moves to the previous
 * box, and pasting a full code fills every box. Shared by verify-otp and
 * forgot-password so the OTP entry stays in sync across screens.
 */
export function OtpInput({ value, onChange, length = 6, disabled = false }: Props) {
  const inputRefs = useRef<(HTMLInputElement | null)[]>([])

  const handleChange = (index: number, raw: string) => {
    if (!/^\d*$/.test(raw)) return
    const next = [...value]
    next[index] = raw.slice(-1)
    onChange(next)
    if (raw && index < length - 1) {
      inputRefs.current[index + 1]?.focus()
    }
  }

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !value[index] && index > 0) {
      inputRefs.current[index - 1]?.focus()
    }
  }

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault()
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, length)
    if (!pasted) return
    const next = [...value]
    for (let i = 0; i < length; i++) next[i] = pasted[i] ?? next[i] ?? ''
    onChange(next)
    inputRefs.current[Math.min(pasted.length, length - 1)]?.focus()
  }

  return (
    <div className="flex justify-center gap-2" onPaste={handlePaste}>
      {Array.from({ length }).map((_, i) => (
        <Input
          key={i}
          ref={(el) => {
            inputRefs.current[i] = el
          }}
          type="text"
          inputMode="numeric"
          autoComplete={i === 0 ? 'one-time-code' : 'off'}
          maxLength={1}
          disabled={disabled}
          value={value[i] ?? ''}
          onChange={(e) => handleChange(i, e.target.value)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          className="w-12 h-14 text-center text-xl font-bold rounded-2xl"
        />
      ))}
    </div>
  )
}
