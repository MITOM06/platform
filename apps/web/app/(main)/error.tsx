'use client'

import { useEffect } from 'react'
import { Button } from '@/components/ui/button'

export default function MainError({ error, reset }: { error: Error; reset: () => void }) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className="flex h-full flex-col items-center justify-center gap-4">
      <h2 className="text-lg font-semibold">Đã xảy ra lỗi</h2>
      <p className="text-sm text-muted-foreground">{error.message ?? 'Lỗi không xác định'}</p>
      <Button onClick={reset}>Thử lại</Button>
    </div>
  )
}
