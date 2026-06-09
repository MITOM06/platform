'use client'

import { useQuery } from '@tanstack/react-query'
import { chatService } from '@/lib/api/chat'

export function LinkPreviewCard({ url }: { url: string }) {
  const { data } = useQuery({
    queryKey: ['link-preview', url],
    queryFn: () => chatService.fetchLinkPreview(url),
    staleTime: 1000 * 60 * 60, // 1h — link metadata rarely changes
    retry: false,
  })

  const hasContent = !!(data?.title || data?.image)
  if (!data || !hasContent) return null

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="mt-1.5 block max-w-[260px] overflow-hidden rounded-xl border border-border/40 bg-black/10 transition-colors hover:bg-black/20"
    >
      {data.image && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={data.image}
          alt=""
          className="h-[130px] w-full object-cover"
          onError={(e) => {
            e.currentTarget.style.display = 'none'
          }}
        />
      )}
      <div className="p-2.5">
        {data.siteName && (
          <p className="mb-0.5 text-[10px] font-semibold uppercase text-pon-cyan/80">
            {data.siteName}
          </p>
        )}
        {data.title && (
          <p className="line-clamp-2 text-[13px] font-bold">{data.title}</p>
        )}
        {data.description && (
          <p className="mt-0.5 line-clamp-2 text-[11.5px] text-muted-foreground">
            {data.description}
          </p>
        )}
      </div>
    </a>
  )
}
