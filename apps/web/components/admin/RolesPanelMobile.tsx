'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { Role, PermissionMatrix, Capability } from '@/lib/api/admin-types'

interface RolesPanelMobileProps {
  roles: Role[]
  capabilities: readonly Capability[]
  edited: Record<string, PermissionMatrix>
  toggle: (roleId: string, cap: Capability) => void
  isDirty: (role: Role) => boolean
  saveRole: (role: Role) => void
  /** Humanizer for a capability key → display label. */
  capLabel: (cap: Capability) => string
  isPending?: boolean
}

const OWNER = 'Owner'

export function RolesPanelMobile({
  roles,
  capabilities,
  edited,
  toggle,
  isDirty,
  saveRole,
  capLabel,
  isPending,
}: RolesPanelMobileProps) {
  const [selectedId, setSelectedId] = useState(roles[0]?._id ?? '')
  const role = roles.find((r) => r._id === selectedId) ?? roles[0]
  if (!role) return null

  const readOnly = role.name === OWNER

  const valueFor = (cap: Capability): boolean => {
    if (readOnly) return true
    const editedMatrix = edited[role._id]
    if (editedMatrix !== undefined && cap in editedMatrix) {
      return editedMatrix[cap] ?? false
    }
    return role.permissions[cap] ?? false
  }

  return (
    <div className="md:hidden flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <Select value={role._id} onValueChange={setSelectedId}>
          <SelectTrigger className="flex-1">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {roles.map((r) => (
              <SelectItem key={r._id} value={r._id}>
                {r.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {!readOnly && (
          <Button
            size="sm"
            disabled={!isDirty(role) || isPending}
            onClick={() => saveRole(role)}
          >
            Save
          </Button>
        )}
      </div>

      <ul className="flex flex-col divide-y rounded-lg border">
        {capabilities.map((cap) => (
          <li key={cap} className="flex items-center justify-between gap-3 p-3">
            <span className="text-sm">{capLabel(cap)}</span>
            <Switch
              checked={valueFor(cap)}
              disabled={readOnly}
              onCheckedChange={() => toggle(role._id, cap)}
            />
          </li>
        ))}
      </ul>
    </div>
  )
}
