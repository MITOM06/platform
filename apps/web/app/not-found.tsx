import Link from 'next/link'
import { Button } from '@/components/ui/button'

export default function NotFound() {
  return (
    <div className="flex h-screen flex-col items-center justify-center gap-4">
      <h1 className="text-4xl font-bold">404</h1>
      <p className="text-muted-foreground">Trang không tồn tại</p>
      <Button asChild>
        <Link href="/conversations">Quay về trang chủ</Link>
      </Button>
    </div>
  )
}
