'use client'

import { useState, useRef, use } from 'react'
import Link from 'next/link'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  ArrowLeft,
  FileText,
  Upload,
  Loader2,
  Trash2,
  CheckCircle2,
  AlertCircle,
  FolderOpen,
} from 'lucide-react'
import { kbService, type KbDocument } from '@/lib/api/kb'
import { chatService } from '@/lib/api/chat'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'

// ── Status Chip ──────────────────────────────────────────────────────────────

function StatusChip({ doc }: { doc: KbDocument }) {
  if (doc.status === 'processing' || doc.status === 'pending') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-medium border border-amber-500/50 text-amber-500 bg-amber-500/10">
        <Loader2 className="size-3 animate-spin" />
        Đang xử lý
      </span>
    )
  }

  if (doc.status === 'done') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-medium border border-green-500/50 text-green-500 bg-green-500/10">
        <CheckCircle2 className="size-3" />
        Sẵn sàng
      </span>
    )
  }

  return (
    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-medium border border-red-500/50 text-red-500 bg-red-500/10">
      <AlertCircle className="size-3" />
      Lỗi
    </span>
  )
}

// ── Document Tile ────────────────────────────────────────────────────────────

function DocumentTile({
  doc,
  onDelete,
}: {
  doc: KbDocument
  onDelete: () => void
}) {
  return (
    <div className="group rounded-xl border bg-card p-4 transition-all hover:shadow-lg hover:border-pon-cyan/30 relative overflow-hidden flex items-center gap-4">
      {/* Subtle glow */}
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none rounded-xl bg-gradient-to-r from-pon-cyan/[0.03] to-transparent" />

      {/* Icon */}
      <div className="size-10 rounded-lg bg-pon-cyan/10 flex items-center justify-center shrink-0">
        <FileText className="size-5 text-pon-cyan" />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground truncate mb-1">
          {doc.fileName}
        </p>
        <div className="flex items-center gap-3">
          <StatusChip doc={doc} />
          {doc.status === 'done' && (
            <span className="text-[11px] text-muted-foreground">
              {doc.chunkCount} chunks
            </span>
          )}
        </div>
      </div>

      {/* Delete button */}
      <button
        onClick={onDelete}
        className="size-8 rounded-lg flex items-center justify-center shrink-0 text-muted-foreground/30 hover:text-destructive hover:bg-destructive/10 transition-colors"
        title="Xóa tài liệu"
      >
        <Trash2 className="size-4" />
      </button>
    </div>
  )
}

// ── Empty State ──────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-24 gap-4">
      <FolderOpen className="size-20 text-muted-foreground/15" />
      <div className="text-center space-y-1.5">
        <p className="text-sm text-muted-foreground/50">
          Chưa có tài liệu nào
        </p>
        <p className="text-xs text-muted-foreground/30 max-w-[280px]">
          Tải lên tài liệu (PDF, Word, TXT) để làm Knowledge Base cho AI bot trong cuộc trò chuyện này.
        </p>
      </div>
    </div>
  )
}

// ── Main Page ────────────────────────────────────────────────────────────────

export default function KbPage({ params }: { params: Promise<{ conversationId: string }> }) {
  const { conversationId } = use(params)
  const queryClient = useQueryClient()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [deleteTarget, setDeleteTarget] = useState<KbDocument | null>(null)
  const [isUploading, setIsUploading] = useState(false)

  const { data: docs, isLoading, error } = useQuery({
    queryKey: ['kb-documents', conversationId],
    queryFn: () => kbService.getDocuments(conversationId),
    refetchInterval: 5000, // Poll for status updates
  })

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      setIsUploading(true)
      try {
        // First upload file to get URL
        const uploaded = await chatService.uploadFile(file)
        
        // Then register it with KB
        return await kbService.uploadDocument({
          conversationId,
          fileUrl: uploaded.url,
          fileName: file.name,
          mimeType: file.type || 'application/octet-stream',
        })
      } finally {
        setIsUploading(false)
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kb-documents', conversationId] })
      toast.success('Đã tải lên tài liệu')
      if (fileInputRef.current) fileInputRef.current.value = ''
    },
    onError: () => toast.error('Lỗi khi tải lên tài liệu'),
  })

  const deleteMutation = useMutation({
    mutationFn: (docId: string) => kbService.deleteDocument(docId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kb-documents', conversationId] })
      toast.success('Đã xóa tài liệu')
      setDeleteTarget(null)
    },
    onError: () => toast.error('Không thể xóa tài liệu'),
  })

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    
    // Check extension
    const allowed = ['.pdf', '.docx', '.doc', '.txt']
    const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase()
    if (!allowed.includes(ext)) {
      toast.error('Chỉ hỗ trợ file PDF, Word và TXT')
      return
    }

    // Check size (e.g., max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      toast.error('File không được vượt quá 10MB')
      return
    }

    uploadMutation.mutate(file)
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <header className="h-14 border-b px-4 flex items-center gap-3 shrink-0 bg-background/95 backdrop-blur-md">
        <Link
          href={`/chat/${conversationId}`}
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="size-5" />
        </Link>
        <span className="font-semibold text-base">Knowledge Base</span>
        <span className="flex-1" />
      </header>

      <div className="flex-1 overflow-y-auto relative">
        {/* Background glows */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute -top-24 -left-24 w-72 h-72 rounded-full bg-pon-cyan/5 blur-3xl" />
        </div>

        <div className="relative max-w-2xl mx-auto px-6 py-6">
          {isLoading && (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <Loader2 className="size-8 animate-spin text-pon-cyan" />
              <p className="text-sm text-muted-foreground">Đang tải...</p>
            </div>
          )}

          {error && (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <AlertCircle className="size-10 text-destructive/50" />
              <p className="text-sm text-destructive">Không thể tải danh sách tài liệu</p>
            </div>
          )}

          {docs && docs.length === 0 && <EmptyState />}

          {docs && docs.length > 0 && (
            <div className="space-y-3">
              {docs.map((doc) => (
                <DocumentTile
                  key={doc.documentId}
                  doc={doc}
                  onDelete={() => setDeleteTarget(doc)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Upload FAB */}
      <div className="absolute bottom-6 right-6">
        <Button
          size="icon"
          className="size-14 rounded-full shadow-lg bg-pon-cyan hover:bg-pon-cyan/90 text-black"
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
        >
          {isUploading ? (
            <Loader2 className="size-6 animate-spin" />
          ) : (
            <Upload className="size-6" />
          )}
        </Button>
        <input
          type="file"
          ref={fileInputRef}
          className="hidden"
          accept=".pdf,.docx,.doc,.txt"
          onChange={handleFileChange}
        />
      </div>

      {/* Delete confirmation dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Xóa tài liệu</DialogTitle>
            <DialogDescription>
              Bạn có chắc muốn xóa &quot;{deleteTarget?.fileName}&quot; khỏi Knowledge Base? 
              AI sẽ không thể truy xuất thông tin từ tài liệu này nữa.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteTarget(null)}
              disabled={deleteMutation.isPending}
            >
              Hủy
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.documentId)}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending && <Loader2 className="size-4 mr-2 animate-spin" />}
              Xóa
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
