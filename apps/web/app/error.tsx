'use client'

import { useEffect } from 'react'
import { Button } from '@/components/ui/button'

export default function GlobalError({ error, reset }: { error: Error; reset: () => void }) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className="flex h-screen flex-col items-center justify-center gap-4">
      <h2 className="text-xl font-semibold">Đã xảy ra lỗi</h2>
      <p className="text-sm text-muted-foreground">{error.message ?? 'Lỗi không xác định'}</p>
      <Button onClick={reset}>Thử lại</Button>
    </div>
  )
}
