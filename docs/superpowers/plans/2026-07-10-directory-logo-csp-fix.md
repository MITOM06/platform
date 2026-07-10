# Plan: MCP Directory logos vẫn hiện chữ cái — CSP `img-src` chặn favicon CDN

> **Ngày:** 2026-07-10
> **Scope:** `apps/web/next.config.ts` — 1 dòng CSP, không đụng component nào.
> **Đây là bug thật, KHÔNG phải build cũ** (khác với lần trước — đã kiểm chứng lại bằng cách đọc
> đúng chuỗi request/response, không chỉ đọc component code).

---

## Root cause

`DirectoryCard.tsx` (`apps/web/components/integrations/DirectoryCard.tsx`) render logo bằng thẻ
`<img src={DIRECTORY_LOGO_URLS[icon]}>` trỏ thẳng tới favicon của từng vendor:

```ts
const DIRECTORY_LOGO_URLS: Record<string, string> = {
  notion: 'https://www.notion.so/front-static/favicon.ico',
  linear: 'https://linear.app/favicon.ico',
  sentry: 'https://sentry.io/favicon.ico',
  atlassian: 'https://atlassian.com/favicon.ico',
  github: 'https://github.com/favicon.ico',
  stripe: 'https://stripe.com/favicon.ico',
  huggingface: 'https://huggingface.co/favicon.ico',
  asana: 'https://asana.com/favicon.ico',
  gmail: 'https://ssl.gstatic.com/ui/v1/icons/mail/rfr/gmail.ico',
  calendar: 'https://calendar.google.com/googlecalendar/images/favicon_v2018_256.png',
  drive: 'https://ssl.gstatic.com/images/branding/product/1x/drive_2020q4_32dp.png',
}
```

Nhưng `apps/web/next.config.ts` set CSP header `img-src` chỉ cho phép:

```
img-src 'self' data: blob: ${NEXT_PUBLIC_CHAT_URL} https://lh3.googleusercontent.com https://images.unsplash.com
```

**Không có** `notion.so`, `linear.app`, `sentry.io`, `atlassian.com`, `github.com`, `stripe.com`,
`huggingface.co`, `asana.com`, `ssl.gstatic.com`, `calendar.google.com` trong allow-list. Browser
chặn TẤT CẢ request `<img>` tới các domain này (CSP violation, không phải lỗi mạng) → `onError`
trong `DirectoryLogo` trigger ngay lập tức → fallback về chữ cái đầu tên. Đây là lý do 8/8 card
trong screenshot đều hiện monogram dù code component đã đúng 100% — bug nằm ở tầng CSP, không phải
component.

**Vì sao lần trước (video/HD) là do build cũ mà lần này là bug thật:** video/HD-toggle không phụ
thuộc domain ngoài nào network-restricted — chỉ là JS logic chạy client-side, nên "chưa rebuild"
giải thích đủ. Logo thì phụ thuộc network request thật tới domain ngoài — dù rebuild bao nhiêu lần,
nếu CSP không whitelist domain đó thì trình duyệt vẫn chặn. Đã confirm bằng cách đọc thẳng
`next.config.ts`, không phải đoán.

---

## Fix

`apps/web/next.config.ts`, dòng ~86:

```ts
// Tìm:
`img-src 'self' data: blob: ${process.env.NEXT_PUBLIC_CHAT_URL ?? ''} https://lh3.googleusercontent.com https://images.unsplash.com`,

// Thay thành (thêm domain favicon của các connector trong DIRECTORY_LOGO_URLS):
`img-src 'self' data: blob: ${process.env.NEXT_PUBLIC_CHAT_URL ?? ''} https://lh3.googleusercontent.com https://images.unsplash.com https://www.notion.so https://linear.app https://sentry.io https://atlassian.com https://github.com https://stripe.com https://huggingface.co https://asana.com https://ssl.gstatic.com https://calendar.google.com`,
```

**Lưu ý cho Claude Code:**
- Chỉ sửa đúng dòng `img-src`, không động vào `script-src`/`connect-src`/`media-src` khác.
- Domain list phải khớp CHÍNH XÁC với `DIRECTORY_LOGO_URLS` trong `DirectoryCard.tsx` — nếu sau
  này thêm connector mới vào `DIRECTORY_LOGO_URLS` với domain favicon khác, phải nhớ thêm domain đó
  vào CSP luôn (2 chỗ đi cùng nhau, dễ quên — cân nhắc thêm comment nhắc ở cả 2 file trỏ qua lại).
- **Giới hạn đã biết (không phải bug, ngoài scope):** connector admin tự thêm qua "+ Add entry" với
  icon field tuỳ ý sẽ KHÔNG có logo thật (không nằm trong `DIRECTORY_LOGO_URLS` cứng) — vẫn fallback
  chữ cái, đúng như code hiện tại đã thiết kế. Nếu muốn tự động lấy logo cho MỌI connector tương lai
  (kể cả custom), cần đổi kiến trúc sang favicon-proxy theo domain của `mcpUrl` (vd
  `https://www.google.com/s2/favicons?domain=<hostname>&sz=64`, chỉ cần whitelist 1 domain CSP duy
  nhất `www.google.com` thay vì liệt kê tay). Đây là quyết định kiến trúc riêng, KHÔNG làm trong plan
  này — nếu muốn, hỏi lại để làm plan riêng.

---

## Verification

1. `pnpm build` trong `apps/web/`.
2. Deploy/chạy lại, mở `/directory` (không chỉ hard-refresh — CSP header do server set qua
   `next.config.ts`, cần build+restart mới áp dụng, cache-busting browser thôi không đủ).
3. Mở DevTools → Console: xác nhận không còn dòng
   `Refused to load the image '...' because it violates the following Content Security Policy
   directive: "img-src ..."`.
4. Cả 8 card (Asana, Atlassian, GitHub, Hugging Face, Linear, Notion, Sentry, Stripe) hiện đúng logo
   thương hiệu thay vì chữ cái.
5. Card Gmail/Calendar/Drive (nếu builtin nào dùng `<img>` qua `DirectoryCard`, khác với
   `ConnectorCard` dùng inline SVG) cũng phải hiện logo — vốn đã cùng bị chặn bởi `ssl.gstatic.com`/
   `calendar.google.com` thiếu trong whitelist.
