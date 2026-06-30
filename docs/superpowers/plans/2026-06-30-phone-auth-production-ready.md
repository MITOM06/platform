# Phone Auth — Production Ready

Hai việc: ẩn reCAPTCHA badge đúng cách + chuẩn bị cho real SMS.

---

## Phần A — Ẩn reCAPTCHA Badge (Code)

Google ToS cho phép ẩn badge `.grecaptcha-badge` nếu có disclosure text trên trang.

### Task A1 — Ẩn badge trong global CSS

File: `platform/apps/web/app/globals.css`

Thêm vào cuối file:

```css
/* Hide reCAPTCHA badge — allowed per Google ToS when disclosure text is shown */
.grecaptcha-badge {
  visibility: hidden !important;
}
```

### Task A2 — Thêm disclosure text vào PhoneField modal

File: `platform/apps/web/components/profile/PhoneField.tsx`

Trong `DialogContent`, ngay trước closing `</DialogContent>` tag, thêm:

```tsx
<p className="text-[10px] text-muted-foreground/60 text-center mt-2 leading-tight">
  Protected by reCAPTCHA —{' '}
  <a
    href="https://policies.google.com/privacy"
    target="_blank"
    rel="noreferrer"
    className="underline"
  >
    Privacy
  </a>{' '}
  &{' '}
  <a
    href="https://policies.google.com/terms"
    target="_blank"
    rel="noreferrer"
    className="underline"
  >
    Terms
  </a>
</p>
```

---

## Phần B — Real SMS (Manual — User tự làm)

Claude Code không thể làm bước này. User phải vào Firebase Console tự upgrade:

1. Vào [Firebase Console → Project Overview → Spark plan → Upgrade](https://console.firebase.google.com/project/pon-c30fd/usage/details)
2. Chọn **Blaze (Pay as you go)**
3. Add credit card (không bị charge nếu trong 10 SMS/day free tier)
4. Confirm upgrade

Sau khi upgrade Blaze xong, real SMS sẽ hoạt động ngay — không cần thay đổi code.

---

## Notes

- reCAPTCHA invisible vẫn chạy ngầm (bảo vệ khỏi abuse), chỉ ẩn cái badge UI.
- Disclosure text bắt buộc theo [Google reCAPTCHA ToS](https://developers.google.com/recaptcha/docs/faq#id-like-to-hide-the-recaptcha-badge.-what-is-allowed).
- Blaze plan: base cost $0/month, 10 SMS/day free, sau đó ~$0.01/SMS.
- Test number `+84817738889` / `123456` vẫn còn trong Firebase Console — dùng được cho CI/automated test, không cần xoá.
