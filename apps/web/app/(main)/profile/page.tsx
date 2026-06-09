'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { ArrowLeft, Loader2 } from 'lucide-react'
import Link from 'next/link'
import { useAuthStore } from '@/lib/store/auth.store'
import { authService } from '@/lib/api/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'

const schema = z.object({
  displayName: z.string().min(1, 'Tên không được để trống').max(50, 'Tên quá dài'),
  avatarUrl: z.string().url('URL không hợp lệ').or(z.literal('')).optional(),
})

type FormValues = z.infer<typeof schema>

export default function ProfilePage() {
  const router = useRouter()
  const user = useAuthStore((s) => s.user)
  const setAuth = useAuthStore((s) => s.setAuth)
  const accessToken = useAuthStore((s) => s.accessToken)
  const [saving, setSaving] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors, isDirty },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      displayName: user?.displayName ?? '',
      avatarUrl: '',
    },
  })

  const onSubmit = async (values: FormValues) => {
    if (!user || !accessToken) return
    setSaving(true)
    try {
      const updated = await authService.updateProfile({
        displayName: values.displayName,
        ...(values.avatarUrl ? { avatarUrl: values.avatarUrl } : {}),
      })
      setAuth(
        { id: user.id, email: user.email, displayName: updated.displayName ?? values.displayName },
        accessToken,
      )
      toast.success('Đã cập nhật hồ sơ')
      router.push('/conversations')
    } catch {
      toast.error('Không thể cập nhật hồ sơ')
    } finally {
      setSaving(false)
    }
  }

  if (!user) return null

  const initials = user.displayName
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase()

  return (
    <div className="flex flex-col h-full">
      <header className="h-14 border-b px-4 flex items-center gap-3 shrink-0 bg-background">
        <Link
          href="/conversations"
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="size-5" />
        </Link>
        <span className="font-medium">Hồ sơ cá nhân</span>
      </header>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-md mx-auto">
          <div className="flex justify-center mb-6">
            <Avatar className="size-20">
              <AvatarFallback className="text-xl font-semibold">{initials}</AvatarFallback>
            </Avatar>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Thông tin cá nhân</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" value={user.email} disabled className="text-muted-foreground" />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="displayName">Tên hiển thị</Label>
                  <Input
                    id="displayName"
                    {...register('displayName')}
                    placeholder="Nhập tên hiển thị..."
                  />
                  {errors.displayName && (
                    <p className="text-xs text-destructive">{errors.displayName.message}</p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="avatarUrl">URL ảnh đại diện</Label>
                  <Input
                    id="avatarUrl"
                    {...register('avatarUrl')}
                    placeholder="https://..."
                  />
                  {errors.avatarUrl && (
                    <p className="text-xs text-destructive">{errors.avatarUrl.message}</p>
                  )}
                </div>

                <Button
                  type="submit"
                  className="w-full"
                  disabled={saving || !isDirty}
                >
                  {saving && <Loader2 className="size-4 mr-2 animate-spin" />}
                  Lưu thay đổi
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
