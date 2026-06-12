'use client'

import { useState, useEffect } from 'react'
import { Search, UserPlus, UserMinus, Check, X, Users, UserCheck } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useFriends, useFriendRequests, useFriendActions } from '@/lib/hooks/use-friends'
import { authService } from '@/lib/api/auth'
import type { UserSearchResult } from '@/lib/api/types'
import { useDebounce } from '@/lib/hooks/use-debounce'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

export default function FriendsPage() {
  const t = useTranslations('friends')
  const { data: friends = [], isLoading: loadingFriends } = useFriends()
  const { data: requests = [], isLoading: loadingRequests } = useFriendRequests()
  const { sendRequest, acceptRequest, removeFriend } = useFriendActions()

  const [searchQuery, setSearchQuery] = useState('')
  const debouncedSearch = useDebounce(searchQuery, 500)
  const [searchResults, setSearchResults] = useState<UserSearchResult[]>([])
  const [searching, setSearching] = useState(false)

  useEffect(() => {
    if (!debouncedSearch.trim()) {
      return
    }
    const doSearch = async () => {
      setSearching(true)
      try {
        const results = await authService.searchUsers(debouncedSearch)
        setSearchResults(results)
      } catch {
        setSearchResults([])
      } finally {
        setSearching(false)
      }
    }
    doSearch()
  }, [debouncedSearch])

  const currentSearchResults = debouncedSearch.trim() ? searchResults : []

  const renderUserList = (
    users: UserSearchResult[],
    emptyMessage: string,
    actionButtons: (user: UserSearchResult) => React.ReactNode,
  ) => {
    if (users.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
          <Users className="size-12 opacity-20 mb-4" />
          <p>{emptyMessage}</p>
        </div>
      )
    }

    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {users.map((user) => (
          <div
            key={user.id || user._id}
            className="flex items-center gap-4 p-4 rounded-xl border bg-card/50 backdrop-blur-sm transition-all hover:bg-card hover:shadow-sm"
          >
            <Avatar className="size-12">
              <AvatarImage src={user.avatarUrl || undefined} />
              <AvatarFallback className="bg-primary/10 text-primary font-medium text-lg">
                {user.displayName[0]?.toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-sm truncate">{user.displayName}</h3>
              <p className="text-xs text-muted-foreground truncate">{user.email}</p>
            </div>
            <div className="flex items-center gap-2">{actionButtons(user)}</div>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col h-full bg-background/50">
      <div className="border-b px-6 py-4 bg-background/80 backdrop-blur-md sticky top-0 z-10">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Users className="text-primary size-6" /> {t('title')}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">{t('subtitle')}</p>
      </div>

      <div className="p-6 overflow-y-auto flex-1">
        <Tabs defaultValue="friends" className="w-full max-w-5xl mx-auto space-y-6">
          <TabsList className="bg-muted/50 p-1">
            <TabsTrigger value="friends" className="rounded-md">
              <UserCheck className="size-4 mr-2" />
              {t('tabFriends', { count: friends.length })}
            </TabsTrigger>
            <TabsTrigger value="requests" className="rounded-md">
              <UserPlus className="size-4 mr-2" />
              {t('tabRequests', { count: requests.length })}
            </TabsTrigger>
            <TabsTrigger value="search" className="rounded-md">
              <Search className="size-4 mr-2" />
              {t('searchPlaceholder')}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="friends" className="mt-0">
            {loadingFriends ? (
              <div className="py-12 flex justify-center text-muted-foreground">{t('searching')}</div>
            ) : (
              renderUserList(friends, t('noFriends'), (user) => (
                <Button
                  size="icon-sm"
                  variant="ghost"
                  className="text-destructive hover:text-destructive hover:bg-destructive/10"
                  onClick={() => removeFriend.mutate(user.id || user._id!)}
                  title={t('removeFriend')}
                  disabled={removeFriend.isPending}
                >
                  <UserMinus className="size-4" />
                </Button>
              ))
            )}
          </TabsContent>

          <TabsContent value="requests" className="mt-0">
            {loadingRequests ? (
              <div className="py-12 flex justify-center text-muted-foreground">{t('searching')}</div>
            ) : (
              renderUserList(requests, t('noRequests'), (user) => (
                <>
                  <Button
                    size="icon-sm"
                    className="bg-pon-cyan hover:bg-pon-cyan/90 text-black"
                    onClick={() => acceptRequest.mutate(user.id || user._id!)}
                    title={t('accept')}
                    disabled={acceptRequest.isPending}
                  >
                    <Check className="size-4" />
                  </Button>
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    onClick={() => removeFriend.mutate(user.id || user._id!)}
                    title={t('decline')}
                    disabled={removeFriend.isPending}
                  >
                    <X className="size-4" />
                  </Button>
                </>
              ))
            )}
          </TabsContent>

          <TabsContent value="search" className="mt-0 space-y-6">
            <div className="relative max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                placeholder={t('searchPlaceholder')}
                className="pl-9 bg-card/50"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            {searching ? (
              <div className="py-12 flex justify-center text-muted-foreground">{t('searching')}</div>
            ) : searchQuery.trim() && currentSearchResults.length === 0 ? (
              <div className="py-12 flex justify-center text-muted-foreground">
                {t('noSearchResults')}
              </div>
            ) : (
              renderUserList(currentSearchResults, t('searchPrompt'), (user) => (
                <Button
                  size="sm"
                  className="bg-primary/10 hover:bg-primary/20 text-primary border-0"
                  onClick={() => sendRequest.mutate(user.id || user._id!)}
                  disabled={sendRequest.isPending}
                >
                  <UserPlus className="size-4 mr-1.5" /> {t('addFriend')}
                </Button>
              ))
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
