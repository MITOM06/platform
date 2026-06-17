'use client'

import { ArrowLeft } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'

export function BackButton({ label }: { label: string }) {
  const router = useRouter()
  return (
    <Button
      variant="ghost"
      className="pl-0 hover:bg-transparent"
      onClick={() => router.back()}
    >
      <ArrowLeft className="mr-2 h-4 w-4" />
      {label}
    </Button>
  )
}
