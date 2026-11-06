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

/** File card from plain props: icon by extension, name, size, download link (never the URL as text). */
export function FileCard({ url, name, size, isOwn }: { url: string; name: string; size: number; isOwn: boolean }) {
  const Icon = iconFor(name)
  const sizeStr = formatBytes(size)
  const onColor = isOwn ? 'text-primary-foreground' : 'text-foreground'

  return (
    <a
      href={downloadMediaUrl(url)}
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

export function FileContent({ content, isOwn }: { content: string; isOwn: boolean }) {
  const meta = parseFileMeta(content)
  return <FileCard url={meta.url ?? absoluteMediaUrl(content)} name={meta.name} size={meta.size} isOwn={isOwn} />
}
