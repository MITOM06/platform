# Notifications System + Password & Security Page

**Goal:**
1. In-app notification center (friend request alerts, friend accepted, system, password-setup reminder
   for Google-only users) with bell icon in header.
2. Dedicated `/settings/security` page matching the UI reference: "No password set yet" banner
   when the user has no password, "Change password" form when they do; 2FA placeholder.

**Architecture decisions:**
- Notifications live in **auth-service** (NestJS) — all triggers (friend events) happen there.
- Real-time delivery for v1: **TanStack Query polling** (`refetchInterval: 30_000`). No STOMP
  needed for notification badge; STOMP can be added later.
- `hasPassword` is computed server-side: `!!user.password` (password field is `select:false`
  in the User schema so this requires an extra internal query).
- The existing `POST /api/users/me/change-password` endpoint already handles BOTH set-first-password
  (no current-password required when `user.password` is null) AND change-password (current-password
  required when `user.password` exists). DO NOT change that endpoint's logic.
- `ChangePasswordDialog` component in web **stays but is no longer opened from settings** —
  the new `/settings/security` page replaces it as the primary entry point.
- Web + Flutter ship in the **same commit** (sync.md rule).

---

## Task 1 — auth-service: add `hasPassword` to `GET /api/users/me`

**File:** `apps/server/auth-service/src/modules/users/users.service.ts`

Add a new method after `findById`:

```ts
/** Returns true if the user has set a local password (as opposed to being OAuth-only). */
async getHasPassword(userId: string): Promise<boolean> {
  try {
    const doc = await this.userModel
      .findById(userId)
      .select('+password')
      .exec()
    return !!(doc as any)?.password
  } catch {
    return false
  }
}
```

**File:** `apps/server/auth-service/src/modules/users/users.controller.ts`

Replace the `getMe` handler:

```ts
@Get('me')
@ApiOperation({ summary: 'Get the authenticated user profile' })
async getMe(@Req() req: any) {
  const [user, hasPassword] = await Promise.all([
    this.usersService.findById(req.user.sub),
    this.usersService.getHasPassword(req.user.sub),
  ])
  if (!user) return null
  // user is a Mongoose Document — spread via toObject() so we can add hasPassword
  return { ...(user as any).toObject(), hasPassword }
}
```

**Verify:** `GET /api/users/me` response now includes `"hasPassword": true|false`.

---

## Task 2 — auth-service: Notification module

Create the following files inside a new folder
`apps/server/auth-service/src/modules/notifications/`:

### 2a — `notification.schema.ts`

```ts
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { Document } from 'mongoose'

export type NotificationDocument = Notification & Document

export type NotificationType =
  | 'FRIEND_REQUEST'
  | 'FRIEND_ACCEPTED'
  | 'SYSTEM'
  | 'PASSWORD_SETUP'

@Schema({ timestamps: true })
export class Notification {
  @Prop({ required: true, index: true })
  recipientId: string

  @Prop({ required: true })
  type: NotificationType

  @Prop({ required: true })
  title: string

  @Prop({ default: '' })
  body: string

  /** The user who triggered this notification (e.g. the person who sent the friend request). */
  @Prop()
  actorId?: string

  @Prop()
  actorName?: string

  @Prop()
  actorAvatarUrl?: string

  /** Optional entity linked to the notification (e.g. friendship id). */
  @Prop()
  relatedEntityId?: string

  /** Set when the user reads this notification. Null = unread. */
  @Prop({ default: null, type: Date })
  readAt: Date | null
}

export const NotificationSchema = SchemaFactory.createForClass(Notification)
// Compound index: list unread first, ordered by newest.
NotificationSchema.index({ recipientId: 1, createdAt: -1 })
```

### 2b — `notifications.service.ts`

```ts
import { Injectable } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { Model } from 'mongoose'
import {
  Notification,
  NotificationDocument,
  NotificationType,
} from './notification.schema'

export interface CreateNotificationPayload {
  recipientId: string
  type: NotificationType
  title: string
  body?: string
  actorId?: string
  actorName?: string
  actorAvatarUrl?: string
  relatedEntityId?: string
}

@Injectable()
export class NotificationsService {
  constructor(
    @InjectModel(Notification.name)
    private notificationModel: Model<NotificationDocument>,
  ) {}

  async create(payload: CreateNotificationPayload): Promise<NotificationDocument> {
    return this.notificationModel.create(payload)
  }

  async listForUser(
    recipientId: string,
    limit = 50,
  ): Promise<NotificationDocument[]> {
    return this.notificationModel
      .find({ recipientId })
      .sort({ createdAt: -1 })
      .limit(limit)
      .exec()
  }

  async countUnread(recipientId: string): Promise<number> {
    return this.notificationModel.countDocuments({
      recipientId,
      readAt: null,
    })
  }

  async markRead(id: string, recipientId: string): Promise<void> {
    await this.notificationModel
      .findOneAndUpdate(
        { _id: id, recipientId },
        { $set: { readAt: new Date() } },
      )
      .exec()
  }

  async markAllRead(recipientId: string): Promise<void> {
    await this.notificationModel
      .updateMany({ recipientId, readAt: null }, { $set: { readAt: new Date() } })
      .exec()
  }
}
```

### 2c — `notifications.controller.ts`

```ts
import {
  Controller,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
  Query,
} from '@nestjs/common'
import { AuthGuard } from '@nestjs/passport'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import { NotificationsService } from './notifications.service'

@ApiTags('notifications')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('api/notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  @ApiOperation({ summary: 'List the caller\'s most recent 50 notifications' })
  list(@Req() req: any) {
    return this.notificationsService.listForUser(req.user.sub)
  }

  @Get('unread-count')
  @ApiOperation({ summary: 'Count of unread notifications' })
  async unreadCount(@Req() req: any) {
    const count = await this.notificationsService.countUnread(req.user.sub)
    return { count }
  }

  @Post(':id/read')
  @ApiOperation({ summary: 'Mark a single notification as read' })
  markRead(@Req() req: any, @Param('id') id: string) {
    return this.notificationsService.markRead(id, req.user.sub)
  }

  @Post('read-all')
  @ApiOperation({ summary: 'Mark all unread notifications as read' })
  markAllRead(@Req() req: any) {
    return this.notificationsService.markAllRead(req.user.sub)
  }
}
```

### 2d — `notifications.module.ts`

```ts
import { Module } from '@nestjs/common'
import { MongooseModule } from '@nestjs/mongoose'
import { Notification, NotificationSchema } from './notification.schema'
import { NotificationsService } from './notifications.service'
import { NotificationsController } from './notifications.controller'

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Notification.name, schema: NotificationSchema },
    ]),
  ],
  controllers: [NotificationsController],
  providers: [NotificationsService],
  exports: [NotificationsService],  // exported so FriendsModule can inject it
})
export class NotificationsModule {}
```

### 2e — Register in `app.module.ts`

Import and add `NotificationsModule` to the `imports` array in `app.module.ts`.

**Verify:** `GET /api/notifications` returns `[]`; `GET /api/notifications/unread-count` returns `{ count: 0 }`.

---

## Task 3 — auth-service: trigger notifications from FriendsService

**File:** `apps/server/auth-service/src/modules/friends/friends.service.ts`

1. Import and inject `NotificationsService` (see below).
2. After a successful `sendRequest()`, create a FRIEND_REQUEST notification for the **recipient**.
3. After a successful `acceptRequest()`, create a FRIEND_ACCEPTED notification for the **requester**.

### Step 1 — update `friends.module.ts`

```ts
import { NotificationsModule } from '../notifications/notifications.module'

@Module({
  imports: [
    MongooseModule.forFeature([...]),
    NotificationsModule,   // ← add this
  ],
  ...
})
export class FriendsModule {}
```

### Step 2 — inject NotificationsService in FriendsService

```ts
constructor(
  @InjectModel(Friendship.name) private friendshipModel: ...,
  @InjectModel(User.name) private userModel: ...,
  @Inject(REDIS_CLIENT) private readonly redis: Redis,
  private readonly notificationsService: NotificationsService,  // ← add
) {}
```

### Step 3 — modify `sendRequest()`

After `this.friendshipModel.create(...)`, add:

```ts
// Notify the recipient about the incoming friend request.
// Fetch the requester's profile for display.
const requesterDoc = await this.userModel
  .findById(requesterId)
  .select('displayName avatarUrl')
  .exec()

if (requesterDoc) {
  await this.notificationsService.create({
    recipientId,
    type: 'FRIEND_REQUEST',
    title: `${requesterDoc.displayName} sent you a friend request`,
    body: '',
    actorId: requesterId,
    actorName: requesterDoc.displayName,
    actorAvatarUrl: (requesterDoc as any).avatarUrl ?? '',
    relatedEntityId: requesterId,
  })
}
```

### Step 4 — modify `acceptRequest()`

After `doc.save()`, add:

```ts
// Notify the original requester that their request was accepted.
const accepterDoc = await this.userModel
  .findById(currentUserId)
  .select('displayName avatarUrl')
  .exec()

if (accepterDoc) {
  await this.notificationsService.create({
    recipientId: requesterId,
    type: 'FRIEND_ACCEPTED',
    title: `${accepterDoc.displayName} accepted your friend request`,
    body: '',
    actorId: currentUserId,
    actorName: accepterDoc.displayName,
    actorAvatarUrl: (accepterDoc as any).avatarUrl ?? '',
    relatedEntityId: currentUserId,
  })
}
```

**Verify:** Send a friend request → `GET /api/notifications` for the recipient returns 1 item of type FRIEND_REQUEST.

---

## Task 4 — Web: add `hasPassword` to AuthUser type

**File:** `apps/web/lib/store/auth.store.ts`

Add `hasPassword?: boolean` to `AuthUser`:

```ts
export interface AuthUser {
  id: string
  email: string
  displayName: string
  avatarUrl?: string
  bio?: string
  coverPhoto?: string
  hasPassword?: boolean  // ← add
}
```

**File:** `apps/web/lib/api/auth.ts`

Add `hasPassword?: boolean` to `UserProfile`:

```ts
export interface UserProfile extends AuthUser {
  // existing fields...
  hasPassword?: boolean  // ← add
}
```

Wherever the app calls `GET /api/users/me` and sets the auth store, ensure `hasPassword` is
forwarded. Search for `setAuth` calls and include `hasPassword` in the user object passed to it.

---

## Task 5 — Web: new `/settings/security` page

Create **`apps/web/app/(main)/settings/security/page.tsx`**:

```tsx
'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { ArrowLeft, Lock, LockOpen, KeyRound, Eye, EyeOff,
         ShieldCheck, AlertTriangle, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { useAuthStore } from '@/lib/store/auth.store'
import { authService } from '@/lib/api/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PasswordStrengthMeter } from '@/components/auth/PasswordStrengthMeter'
import { cn } from '@/lib/utils'

export default function SecurityPage() {
  const t = useTranslations('settings.security')
  const tReg = useTranslations('auth.register')
  const tCommon = useTranslations('common')
  const user = useAuthStore((s) => s.user)
  const setAuth = useAuthStore((s) => s.setAuth)
  const accessToken = useAuthStore((s) => s.accessToken)

  const hasPassword = user?.hasPassword ?? false

  const [currentPw, setCurrentPw] = useState('')
  const [newPw, setNewPw] = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [showCurrent, setShowCurrent] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const validatePassword = (pw: string): string | null => {
    if (pw.length < 8) return tReg('passwordMin')
    if (!/[A-Z]/.test(pw)) return tReg('reqUppercase')
    if (!/[a-z]/.test(pw)) return tReg('reqLowercase')
    if (!/[0-9]/.test(pw)) return tReg('reqDigit')
    if (!/[!@#$%^&*]/.test(pw)) return tReg('reqSpecial')
    return null
  }

  const handleSubmit = async () => {
    const pwError = validatePassword(newPw)
    if (pwError) { setError(pwError); return }
    if (newPw !== confirmPw) { setError(t('mismatch')); return }

    setSaving(true)
    setError(null)
    try {
      await authService.changePassword(hasPassword ? currentPw : undefined, newPw)
      toast.success(hasPassword ? t('changeSuccess') : t('setSuccess'))
      // Refresh user to update hasPassword flag in the auth store.
      const updated = await authService.getMe()
      if (updated && accessToken) setAuth({ ...user!, ...updated }, accessToken)
      setCurrentPw(''); setNewPw(''); setConfirmPw('')
    } catch (e: unknown) {
      let msg = t('genericError')
      if (e && typeof e === 'object' && 'response' in e) {
        const resp = (e as any).response
        const serverMsg = resp?.data?.message
        if (serverMsg?.includes('Incorrect current password')) msg = t('incorrectCurrent')
        else if (serverMsg?.includes('Current password is required')) msg = t('currentRequired')
        else if (serverMsg) msg = serverMsg
      }
      setError(msg)
    } finally {
      setSaving(false)
    }
  }

  if (!user) return null

  return (
    <div className="flex flex-col h-full">
      <header className="h-14 border-b px-4 flex items-center gap-3 shrink-0 bg-background/95 backdrop-blur-md">
        <Link href="/settings" className="text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="size-5" />
        </Link>
        <span className="font-semibold text-base">{t('title')}</span>
      </header>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-6 py-8 space-y-8">

          {/* ── No password banner ── */}
          {!hasPassword && (
            <div className="flex gap-3 items-start rounded-xl border border-amber-500/30
                            bg-amber-500/10 px-4 py-3.5">
              <AlertTriangle className="size-5 text-amber-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-amber-600 dark:text-amber-400">
                  {t('noPasswordTitle')}
                </p>
                <p className="text-xs text-amber-600/80 dark:text-amber-400/80 mt-0.5">
                  {t('noPasswordSubtitle')}
                </p>
              </div>
            </div>
          )}

          {/* ── Password section ── */}
          <section className="space-y-5">
            <div className="flex items-center gap-3">
              <div className="size-9 rounded-full bg-primary/10 flex items-center justify-center">
                <KeyRound className="size-4 text-primary" />
              </div>
              <div>
                <h2 className="font-semibold text-base">
                  {hasPassword ? t('changePasswordTitle') : t('setPasswordTitle')}
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {hasPassword ? t('changePasswordSubtitle') : t('setPasswordSubtitle')}
                </p>
              </div>
            </div>

            <div className="rounded-xl border bg-card p-5 space-y-4">
              {error && (
                <div className="rounded-lg bg-destructive/10 border border-destructive/20
                                px-3 py-2.5 text-sm text-destructive">
                  {error}
                </div>
              )}

              {/* Current password — only when user already has one */}
              {hasPassword && (
                <div className="space-y-2">
                  <Label htmlFor="sec-current">{t('currentLabel')}</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                    <Input
                      id="sec-current"
                      type={showCurrent ? 'text' : 'password'}
                      value={currentPw}
                      onChange={(e) => setCurrentPw(e.target.value)}
                      placeholder={t('currentPlaceholder')}
                      className="pl-9 pr-10"
                      disabled={saving}
                      autoComplete="current-password"
                    />
                    <button type="button" tabIndex={-1}
                      onClick={() => setShowCurrent(!showCurrent)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                      {showCurrent ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </button>
                  </div>
                </div>
              )}

              {/* New password */}
              <div className="space-y-2">
                <Label htmlFor="sec-new">
                  {hasPassword ? t('newLabel') : t('passwordLabel')}
                </Label>
                <div className="relative">
                  <LockOpen className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                  <Input
                    id="sec-new"
                    type={showNew ? 'text' : 'password'}
                    value={newPw}
                    onChange={(e) => setNewPw(e.target.value)}
                    placeholder={t('newPlaceholder')}
                    className="pl-9 pr-10"
                    disabled={saving}
                    autoComplete="new-password"
                  />
                  <button type="button" tabIndex={-1}
                    onClick={() => setShowNew(!showNew)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                    {showNew ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
                <PasswordStrengthMeter
                  password={newPw}
                  labels={{
                    weak: tReg('pwStrengthWeak'), medium: tReg('pwStrengthMedium'),
                    strong: tReg('pwStrengthStrong'), veryStrong: tReg('pwStrengthVeryStrong'),
                    reqLength: tReg('reqLength'), reqUppercase: tReg('reqUppercase'),
                    reqLowercase: tReg('reqLowercase'), reqDigit: tReg('reqDigit'),
                    reqSpecial: tReg('reqSpecial'),
                  }}
                />
              </div>

              {/* Confirm password */}
              <div className="space-y-2">
                <Label htmlFor="sec-confirm">{t('confirmLabel')}</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                  <Input
                    id="sec-confirm"
                    type={showConfirm ? 'text' : 'password'}
                    value={confirmPw}
                    onChange={(e) => setConfirmPw(e.target.value)}
                    placeholder={t('confirmPlaceholder')}
                    className="pl-9 pr-10"
                    disabled={saving}
                    autoComplete="new-password"
                    onKeyDown={(e) => { if (e.key === 'Enter') handleSubmit() }}
                  />
                  <button type="button" tabIndex={-1}
                    onClick={() => setShowConfirm(!showConfirm)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                    {showConfirm ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between pt-1">
                <p className="text-xs text-muted-foreground">
                  {t('staySignedIn')}
                </p>
                <div className="flex gap-2">
                  <Button variant="ghost" onClick={() => {
                    setCurrentPw(''); setNewPw(''); setConfirmPw(''); setError(null)
                  }} disabled={saving}>{tCommon('cancel')}</Button>
                  <Button onClick={handleSubmit} disabled={saving}>
                    {saving && <Loader2 className="size-4 animate-spin mr-2" />}
                    {hasPassword ? t('changeButton') : t('setButton')}
                  </Button>
                </div>
              </div>
            </div>
          </section>

          {/* ── Two-factor authentication (placeholder) ── */}
          <section className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="size-9 rounded-full bg-muted flex items-center justify-center">
                <ShieldCheck className="size-4 text-muted-foreground" />
              </div>
              <div>
                <h2 className="font-semibold text-base text-muted-foreground">{t('twoFaTitle')}</h2>
                <p className="text-xs text-muted-foreground mt-0.5">{t('twoFaSubtitle')}</p>
              </div>
            </div>
            <div className="rounded-xl border border-dashed bg-muted/30 px-5 py-4 flex items-center gap-3">
              <ShieldCheck className="size-5 text-muted-foreground shrink-0" />
              <p className="text-sm text-muted-foreground">{t('twoFaComingSoon')}</p>
            </div>
          </section>

        </div>
      </div>
    </div>
  )
}
```

Also add `getMe` to `authService` in `apps/web/lib/api/auth.ts` if it doesn't already exist:
```ts
getMe: () => authApi.get<UserProfile>('/api/users/me').then((r) => r.data),
```

---

## Task 6 — Web: update settings page

**File:** `apps/web/app/(main)/settings/page.tsx`

Change the "changePassword" `SettingsCard` to navigate to the new security page instead of
opening the dialog. Also show a warning dot on the card if the user has no password:

Replace:
```tsx
<SettingsCard
  icon={<Lock className="size-5 text-pon-pink" />}
  iconBg="rgba(255,133,179,0.12)"
  title={t('changePassword')}
  onClick={() => setChangePasswordOpen(true)}
/>
```

With:
```tsx
<SettingsCard
  icon={<Lock className={cn('size-5', !user.hasPassword ? 'text-amber-500' : 'text-pon-pink')} />}
  iconBg={!user.hasPassword ? 'rgba(245,158,11,0.12)' : 'rgba(255,133,179,0.12)'}
  title={t('security')}
  subtitle={!user.hasPassword ? t('securityNoPassword') : t('securitySubtitle')}
  onClick={() => router.push('/settings/security')}
/>
```

Remove the `changePasswordOpen` state, `setChangePasswordOpen` toggle, and the
`<ChangePasswordDialog>` component from this file — they are replaced by the security page.

Keep the `ChangePasswordDialog` component file itself (don't delete it) — it may still be used
elsewhere or can be removed in a future cleanup.

---

## Task 7 — Web: notification API client + `useNotifications` hook

### 7a — `apps/web/lib/api/notifications.ts` (new file)

```ts
import { authApi } from './axios'

export interface AppNotification {
  _id: string
  id: string
  recipientId: string
  type: 'FRIEND_REQUEST' | 'FRIEND_ACCEPTED' | 'SYSTEM' | 'PASSWORD_SETUP'
  title: string
  body: string
  actorId?: string
  actorName?: string
  actorAvatarUrl?: string
  relatedEntityId?: string
  readAt: string | null
  createdAt: string
}

export const notificationsApi = {
  list: () =>
    authApi.get<AppNotification[]>('/api/notifications').then((r) => r.data),

  unreadCount: () =>
    authApi
      .get<{ count: number }>('/api/notifications/unread-count')
      .then((r) => r.data.count),

  markRead: (id: string) =>
    authApi.post(`/api/notifications/${id}/read`),

  markAllRead: () =>
    authApi.post('/api/notifications/read-all'),
}
```

### 7b — `apps/web/lib/hooks/use-notifications.ts` (new file)

```ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { notificationsApi } from '@/lib/api/notifications'

export function useNotifications() {
  return useQuery({
    queryKey: ['notifications'],
    queryFn: notificationsApi.list,
    // Poll every 30s — STOMP-based push can be added later.
    refetchInterval: 30_000,
    // Refetch when the window regains focus (user switches back to the tab).
    refetchOnWindowFocus: true,
    staleTime: 20_000,
  })
}

export function useNotificationActions() {
  const queryClient = useQueryClient()

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ['notifications'] })

  const markRead = useMutation({
    mutationFn: notificationsApi.markRead,
    onSuccess: invalidate,
  })

  const markAllRead = useMutation({
    mutationFn: notificationsApi.markAllRead,
    onSuccess: invalidate,
  })

  return { markRead, markAllRead }
}
```

---

## Task 8 — Web: NotificationBell component + integrate into header

### 8a — Create `apps/web/components/layout/NotificationBell.tsx`

```tsx
'use client'

import { useState } from 'react'
import { Bell, Check, UserPlus, Users, ShieldAlert, Info } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { formatDistanceToNow } from 'date-fns'
import { Button } from '@/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { absoluteMediaUrl } from '@/lib/media'
import { cn } from '@/lib/utils'
import { useNotifications, useNotificationActions } from '@/lib/hooks/use-notifications'
import { useFriendActions } from '@/lib/hooks/use-friends'
import type { AppNotification } from '@/lib/api/notifications'

function NotifIcon({ type }: { type: AppNotification['type'] }) {
  switch (type) {
    case 'FRIEND_REQUEST':  return <UserPlus className="size-4 text-pon-cyan" />
    case 'FRIEND_ACCEPTED': return <Users className="size-4 text-green-500" />
    case 'PASSWORD_SETUP':  return <ShieldAlert className="size-4 text-amber-500" />
    default:                return <Info className="size-4 text-muted-foreground" />
  }
}

export function NotificationBell() {
  const t = useTranslations('notifications')
  const [open, setOpen] = useState(false)
  const { data: notifications = [] } = useNotifications()
  const { markRead, markAllRead } = useNotificationActions()
  const { acceptRequest, removeFriend } = useFriendActions()

  const unreadCount = notifications.filter((n) => !n.readAt).length

  const handleOpen = (next: boolean) => {
    setOpen(next)
    // When opening: mark all read after a short delay (UX: user sees the badge
    // briefly then it disappears, indicating they've seen the notifications).
    if (next && unreadCount > 0) {
      setTimeout(() => markAllRead.mutate(), 1500)
    }
  }

  return (
    <Popover open={open} onOpenChange={handleOpen}>
      <PopoverTrigger asChild>
        <button className="relative size-9 flex items-center justify-center rounded-full
                           hover:bg-muted/60 transition-colors">
          <Bell className="size-5 text-muted-foreground" />
          {unreadCount > 0 && (
            <span className="absolute top-1 right-1 size-4 rounded-full bg-red-500 text-white
                             text-[10px] font-bold flex items-center justify-center leading-none">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <span className="font-semibold text-sm">{t('title')}</span>
          {unreadCount > 0 && (
            <button
              onClick={() => markAllRead.mutate()}
              className="text-xs text-pon-cyan hover:text-pon-cyan/80 transition-colors"
            >
              {t('markAllRead')}
            </button>
          )}
        </div>

        {/* List */}
        <div className="max-h-96 overflow-y-auto divide-y divide-border/50">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 gap-2
                            text-muted-foreground">
              <Bell className="size-8 opacity-20" />
              <p className="text-sm">{t('empty')}</p>
            </div>
          ) : (
            notifications.map((n) => (
              <div
                key={n._id}
                className={cn(
                  'flex gap-3 px-4 py-3 hover:bg-muted/40 transition-colors',
                  !n.readAt && 'bg-pon-cyan/5',
                )}
                onClick={() => { if (!n.readAt) markRead.mutate(n._id) }}
              >
                {/* Actor avatar or icon */}
                <div className="relative shrink-0">
                  {n.actorAvatarUrl ? (
                    <Avatar className="size-10">
                      <AvatarImage src={absoluteMediaUrl(n.actorAvatarUrl)} />
                      <AvatarFallback>{(n.actorName?.[0] ?? '?').toUpperCase()}</AvatarFallback>
                    </Avatar>
                  ) : (
                    <div className="size-10 rounded-full bg-muted flex items-center justify-center">
                      <NotifIcon type={n.type} />
                    </div>
                  )}
                  {n.actorAvatarUrl && (
                    <div className="absolute -bottom-0.5 -right-0.5 size-5 rounded-full bg-card
                                    border border-border flex items-center justify-center">
                      <NotifIcon type={n.type} />
                    </div>
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm leading-snug line-clamp-2">{n.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}
                  </p>

                  {/* Friend request actions */}
                  {n.type === 'FRIEND_REQUEST' && n.relatedEntityId && (
                    <div className="flex gap-2 mt-2">
                      <Button
                        size="sm"
                        className="h-7 px-3 text-xs bg-pon-cyan hover:bg-pon-cyan/90 text-black"
                        onClick={(e) => {
                          e.stopPropagation()
                          acceptRequest.mutate(n.relatedEntityId!)
                          markRead.mutate(n._id)
                        }}
                        disabled={acceptRequest.isPending}
                      >
                        {t('accept')}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 px-3 text-xs"
                        onClick={(e) => {
                          e.stopPropagation()
                          removeFriend.mutate(n.relatedEntityId!)
                          markRead.mutate(n._id)
                        }}
                        disabled={removeFriend.isPending}
                      >
                        {t('decline')}
                      </Button>
                    </div>
                  )}
                </div>

                {/* Unread dot */}
                {!n.readAt && (
                  <div className="size-2 rounded-full bg-pon-cyan shrink-0 mt-1.5" />
                )}
              </div>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
```

### 8b — Add `NotificationBell` to the main chat header

Find the component that renders the top header bar inside `app/(main)/conversations/[id]/page.tsx`
or the shared layout file (check for where the existing avatar/menu buttons live in the header).
Add `<NotificationBell />` next to the existing header icons, immediately to the left of the
user avatar/profile icon.

---

## Task 9 — Web: i18n keys

### `apps/web/messages/en.json` — add to the top-level namespace:

```json
"notifications": {
  "title": "Notifications",
  "empty": "No notifications yet",
  "markAllRead": "Mark all as read",
  "accept": "Accept",
  "decline": "Decline"
},
"settings": {
  "security": "Password & Security",
  "securityNoPassword": "No password set",
  "securitySubtitle": "Change your password",
  "security": {
    "title": "Password & Security",
    "noPasswordTitle": "No password set yet",
    "noPasswordSubtitle": "Set a password to secure your account and enable email-based recovery.",
    "changePasswordTitle": "Change password",
    "changePasswordSubtitle": "Update your current password.",
    "setPasswordTitle": "Set up your password",
    "setPasswordSubtitle": "Add a password to your account for an extra layer of security.",
    "currentLabel": "Current password",
    "currentPlaceholder": "Enter your current password",
    "newLabel": "New password",
    "passwordLabel": "Password",
    "newPlaceholder": "Choose a strong password",
    "confirmLabel": "Confirm password",
    "confirmPlaceholder": "Re-enter your password",
    "staySignedIn": "You'll stay signed in on this device.",
    "changeButton": "Change password",
    "setButton": "Set password",
    "changeSuccess": "Password changed successfully",
    "setSuccess": "Password set successfully",
    "mismatch": "Passwords don't match",
    "incorrectCurrent": "Current password is incorrect",
    "currentRequired": "Please enter your current password",
    "genericError": "Failed to update password",
    "twoFaTitle": "Two-factor authentication",
    "twoFaSubtitle": "Add an extra layer of security to your account.",
    "twoFaComingSoon": "Two-factor authentication is coming soon."
  }
}
```

Note: the `"settings"` namespace already exists — add the new keys **inside** it:
- `"security"` card title → `t('security')`
- `"securityNoPassword"` subtitle → `t('securityNoPassword')`
- `"securitySubtitle"` subtitle → `t('securitySubtitle')`

Add the same keys with Vietnamese translations to `apps/web/messages/vi.json`.

---

## Task 10 — Flutter: `hasPassword` in user model

**File:** `apps/client/lib/features/auth/data/auth_repository.dart` (or wherever the user
model/provider is defined — search for `displayName` to find it).

Add `hasPassword` to the user model class:
```dart
final bool hasPassword;
```
Deserialize it from the `/api/users/me` JSON:
```dart
hasPassword: json['hasPassword'] as bool? ?? false,
```

---

## Task 11 — Flutter: Security settings screen

Create `apps/client/lib/features/settings/ui/security_settings_screen.dart`:

- Match the web layout: amber warning card when `!hasPassword`, then the password form, then 2FA placeholder.
- If `!hasPassword`: show only two fields (new password + confirm). If `hasPassword`: show three fields (current + new + confirm).
- Call the existing `PATCH /api/users/me/change-password` endpoint via the existing repository.
- On success: re-fetch the user profile so `hasPassword` updates in the provider.
- 2FA section: a `ListTile` with a lock icon and "Coming soon" badge — disabled/greyed out.

Wire this screen to the settings screen: replace the existing "Change Password" `ListTile` with a
"Password & Security" `ListTile` that navigates to `SecuritySettingsScreen`. Show a small amber
`!` indicator on the tile when `!hasPassword` (use a `Badge` widget or a `Stack` with a
`Container`).

---

## Task 12 — Flutter: Notification bell + panel

### 12a — Notification model

Create `apps/client/lib/features/notifications/data/notification_model.dart`:
```dart
class AppNotification {
  final String id;
  final String type;   // FRIEND_REQUEST | FRIEND_ACCEPTED | SYSTEM | PASSWORD_SETUP
  final String title;
  final String body;
  final String? actorId;
  final String? actorName;
  final String? actorAvatarUrl;
  final String? relatedEntityId;
  final DateTime? readAt;
  final DateTime createdAt;

  bool get isUnread => readAt == null;

  // fromJson constructor...
}
```

### 12b — Notification repository

Create `apps/client/lib/features/notifications/data/notification_repository.dart`:
- `listNotifications()` → `GET /api/notifications`
- `markRead(id)` → `POST /api/notifications/{id}/read`
- `markAllRead()` → `POST /api/notifications/read-all`

### 12c — Notification provider

Create a Riverpod provider `notificationsProvider` that auto-fetches on first read and
exposes `AsyncValue<List<AppNotification>>`. Include a `refresh()` method.

### 12d — NotificationBell widget

Create `apps/client/lib/features/notifications/ui/notification_bell.dart`:
- An `IconButton` with `Icons.notifications_outlined`
- Badge overlay showing unread count (use `Badge` widget from Flutter 3.13+ or a `Stack`)
- On tap: open a `showModalBottomSheet` or navigate to a `NotificationsScreen`
- The sheet/screen lists notifications the same way as web: avatar + title + time + Accept/Decline
  buttons for FRIEND_REQUEST items

### 12e — Wire into app bar

Add `NotificationBell()` to the `actions` list of the `AppBar` in the conversations list screen
(the main screen — search for `AppBar` in the file that renders the conversation list).

---

## Task 13 — Flutter: ARB i18n keys

Add to all 7 ARB files (`app_en.arb`, `app_vi.arb`, etc.):

`app_en.arb`:
```json
"notificationsTitle": "Notifications",
"notificationsEmpty": "No notifications yet",
"notificationsMarkAllRead": "Mark all as read",
"notificationAccept": "Accept",
"notificationDecline": "Decline",
"securityTitle": "Password & Security",
"securityNoPasswordTitle": "No password set yet",
"securityNoPasswordSubtitle": "Set a password to secure your account and enable email-based recovery.",
"securityChangePasswordTitle": "Change password",
"securitySetPasswordTitle": "Set up your password",
"securityCurrentLabel": "Current password",
"securityNewLabel": "New password",
"securityConfirmLabel": "Confirm password",
"securitySetButton": "Set password",
"securityChangeButton": "Change password",
"securityPasswordMismatch": "Passwords don't match",
"securityChangeSuccess": "Password changed successfully",
"securitySetSuccess": "Password set successfully",
"securityTwoFaTitle": "Two-factor authentication",
"securityTwoFaComingSoon": "Two-factor authentication is coming soon."
```

Add equivalent Vietnamese translations to `app_vi.arb` and best-effort translations to the
remaining 5 language files.

---

## Manual verification checklist

1. **hasPassword — Google user:**
   Log in via Google (no local password). `GET /api/users/me` returns `"hasPassword": false`.
   Web settings page → "Password & Security" card shows amber subtitle "No password set".
   Security page shows amber warning banner. Form has 2 fields only (new + confirm). Submit → success.
   Re-open security page → banner gone, form now shows 3 fields (current + new + confirm).

2. **hasPassword — traditional user:**
   Log in via email+password. Security page shows change-password form with 3 fields.
   Wrong current password → error. Correct → success.

3. **Notifications — friend request:**
   User A sends friend request to User B.
   User B opens notification bell → sees "A sent you a friend request".
   Badge shows count 1.
   Accept button → friend request accepted → badge disappears.

4. **Notifications — friend accepted:**
   User A receives notification "B accepted your friend request" after B accepts.

5. **Notifications — mark all read:**
   Open bell → wait 1.5s → badge disappears. Re-open → all items shown without unread dot.

6. **Flutter — parity:**
   All above scenarios work identically in the Flutter app.

7. **Build check:**
   `pnpm build` (web) passes. `flutter analyze` passes.
