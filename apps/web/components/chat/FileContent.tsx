'use client'
/* eslint-disable react-hooks/static-components */

import {
  FileText, FileSpreadsheet, FileArchive, Presentation, File as FileIcon, Download,
} from 'lucide-react'
import { absoluteMediaUrl, downloadMediaUrl, formatBytes, parseFileMeta } from '@/lib/media'
import { cn } from '@/lib/utils'

function iconFor(name: string) {
  const ext = name.toLowerCase().split('.').pop() ?? ''
  switch (ext) {
    case 'pdf':
      return FileText
    case 'doc':
    case 'docx':
      return FileText
    case 'xls':
    case 'xlsx':
    case 'csv':
      return FileSpreadsheet
    case 'ppt':
    case 'pptx':
      return Presentation
    case 'zip':
    case 'rar':
    case '7z':
      return FileArchive
    default:
      return FileIcon
  }
}

export function FileContent({ content, isOwn }: { content: string; isOwn: boolean }) {
  const { name, size } = parseFileMeta(content)
  const Icon = iconFor(name)
  const sizeStr = formatBytes(size)
  const onColor = isOwn ? 'text-primary-foreground' : 'text-foreground'

  return (
    <a
      href={downloadMediaUrl(parseFileMeta(content).url ?? absoluteMediaUrl(content))}
      target="_blank"
      rel="noopener noreferrer"
      className="flex max-w-[240px] items-center gap-2.5"
    >
      <div className={cn('rounded-lg bg-black/20 p-2.5', onColor)}>
        <Icon className="size-6" />
      </div>
      <div className="min-w-0 flex-1">
        <p className={cn('truncate text-sm font-semibold', onColor)}>{name}</p>
        {sizeStr && (
          <p className={cn('text-[11px] opacity-70', onColor)}>{sizeStr}</p>
        )}
      </div>
      <Download className={cn('size-5 shrink-0', onColor)} />
    </a>
  )
}
