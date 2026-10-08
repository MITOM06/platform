import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { VideoTile } from '@/components/call/VideoTile'

describe('VideoTile', () => {
  it('keeps the call tile unchanged when only the call props are set', () => {
    const { container } = render(<VideoTile stream={null} name="lan" video={false} muted={false} label="Lan (you)" />)
    const root = container.firstElementChild as HTMLElement
    expect(root.className).toBe(
      'relative aspect-video w-full overflow-hidden rounded-lg border border-white/10 bg-neutral-900',
    )
    expect(container.querySelector('video')?.className).toBe('h-full w-full object-cover opacity-0')
    expect(screen.getByText('L')).toBeTruthy()
    expect(screen.getByText('Lan (you)')).toBeTruthy()
    expect(root.children).toHaveLength(3) // video, avatar, label — no badge slot
  })

  it('adds badges, contain-fit and extra classes for meetings', () => {
    const { container } = render(
      <VideoTile stream={null} name="Minh" video muted fit="contain" className="h-full aspect-auto" badges={<span>badge</span>} />,
    )
    const root = container.firstElementChild as HTMLElement
    expect(root.className).toContain('aspect-auto')
    expect(root.className).not.toContain('aspect-video')
    expect(container.querySelector('video')?.className).toContain('object-contain')
    expect(screen.getByText('badge')).toBeTruthy()
  })
})
