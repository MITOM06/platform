# Lumen Software — story bible 27/10 → 11/11/2026 (demo day = Wed 11/11/2026)

The existing seed tells the story up to Mon 26/10/2026 17:30 (STORY_NOW). This chapter
continues it so the company looks alive right up to the demo. All times are ICT (UTC+7).
Every scripted message / meeting / file in the new chapter MUST agree with these facts.

## Calendar of the chapter

| Date | What happened |
|---|---|
| Tue 27/10 | Demo go-live with Minh Châu (meeting `golive-minhchau`, already in the seed). |
| Wed 28/10 | **Go-live RetailOS toàn chuỗi Minh Châu (12 siêu thị)**, feature flag on 06:00 by Bảo. Minh + Bảo on site at Gò Vấp. |
| Thu 29/10 | **Sự cố P1** 07:10–07:32: đồng bộ tồn kho chậm tại siêu thị Thủ Đức (Redis cache đầy bộ nhớ, eviction policy sai `noeviction`). Bảo + Vinh xử lý, 22 phút. 0 đơn mất. |
| Fri 30/10 | Bảo shares `postmortem` (docx) in #retailos. |
| Mon 02/11 | Meeting **Họp BGĐ tháng 11** (14:00). Giang xuất hóa đơn đợt 3 Minh Châu (nghiệm thu go-live) 1,2 tỷ. |
| Tue 03/11 | Huy + Trang finish `fleet_proposal` (docx). |
| Wed 04/11 | Meeting **Đánh giá tuần đầu go-live** (14:00) — Minh shares `golive_report` (xlsx). Meeting **Chốt kế hoạch mở rộng FleetPro 180 xe** (10:00), anh Tài (Sao Đỏ) joins by link (not a PON user). Trang shares `fleet_rollout` (xlsx). Giang sends `metrics_6m` (xlsx) + `seed_memo` (docx) to Khang (she promised "trước 5/11"). |
| Thu 05/11 | Meeting **Gặp chuỗi Phú Thịnh (Đồng Nai)** (15:00) — Lan Anh, Đạt, Minh, Khang; khách anh Lộc (CEO Phú Thịnh) by link. Lương tháng 10 đã chi. |
| Fri 06/11 | Meeting **Retro Sprint 13 — RetailOS** (16:00). Case study FleetPro × Sao Đỏ đăng trên website (Hà, Uyên). |
| Mon 09/11 | Meeting **Giao ban tuần** (09:00). Đạt gửi `quote_phuthinh` (docx). Lan Anh + Đạt gửi `appendix_pl02` (docx) cho Sao Đỏ. Minh Châu thanh toán hóa đơn đợt 3. |
| Tue 10/11 | Meeting **Hội đồng tuyển dụng Backend Go — vòng 1** (10:00, AI notes OFF). Meeting **Town hall tháng 11** (16:00) — Khang shares `okr_q4` (docx), Oanh shares `teambuilding` (docx). Sprint planning 14 RetailOS. |
| **Wed 11/11** | **Demo day** — packed calendar, see below. |

## Key numbers (use exactly these)

- **Go-live Minh Châu, tuần đầu 28/10–03/11:** 41.380 đơn, doanh thu qua POS 6,84 tỷ, uptime 99,93%,
  thanh toán VietQR trung bình 1,3 giây (38% đơn trả bằng VietQR), 1 sự cố P1 (29/10, 22 phút), 3 lỗi P2
  (in hóa đơn 58mm lệch lề ở Bình Thạnh — đã fix 30/10; báo cáo ca chậm ở Dĩ An; nút đổi trả bị ẩn trên POS màn 10 inch).
  Siêu thị đông nhất: Gò Vấp (5.920 đơn). Anh Phát (Giám đốc vận hành Minh Châu) gửi lời khen; chị Thảo (IT Minh Châu) xin thêm báo cáo xuất Excel theo ca.
- **FleetPro:** pilot 50 xe Sao Đỏ chạy từ 01/09, tuyến TP.HCM–Cần Thơ. Pilot results: giảm 11% nhiên liệu, đúng giờ 94% (trước 81%),
  chấm công tài xế tự động. **Mở rộng thêm 130 xe → 180 xe**, lắp đặt 3 đợt: 01/12 (40 xe), 08/12 (45 xe), 15/12 (45 xe).
  Firmware T1 1.5 (OTA), app tài xế v1.0 phát hành 16/11. Phụ lục **PL-02**: 130 thiết bị × 2.900.000đ = 377 triệu;
  lắp đặt & đào tạo 95 triệu; phí SaaS 220.000đ/xe/tháng cho 180 xe (= 39,6 triệu/tháng, 475,2 triệu/năm). Tổng năm đầu ≈ 947 triệu (chưa VAT).
  Anh Tài = Giám đốc Vận tải Sao Đỏ.
- **Gọi vốn seed:** mục tiêu 8 tỷ đồng, định giá pre-money 40 tỷ. Hai quỹ: **Saigon Seed Partners** (chị Vy — Partner) và
  **Mekong Angel Network**. Gặp Saigon Seed Partners lần 2 ngày **11/11 lúc 13:30** (demo sản phẩm). Số liệu 6 tháng (05–10/2026):
  doanh thu lũy kế 2,61 tỷ, chi phí vận hành TB 310 triệu/tháng, runway 9 tháng, 2 khách hàng trả tiền (Minh Châu, Sao Đỏ), pipeline 3 khách (Phú Thịnh, Bách Hóa Đồng Nai, Logistics An Phát).
- **Phú Thịnh:** chuỗi 18 cửa hàng tiện lợi ở Đồng Nai, CEO anh Lộc. Báo giá RetailOS: triển khai 1,35 tỷ + 9.500.000đ/cửa hàng/tháng; pilot 3 cửa hàng từ 01/2027.
- **Tuyển dụng:** 2 vị trí Backend Go cho FleetPro (ngân sách Q4), 24 hồ sơ, 6 người phỏng vấn vòng 1 (10/11), 2 người vào vòng 2.
  Ứng viên vòng 2 ngày 11/11 10:30: **Lương Quốc Việt** (5 năm Go, từng làm logistics). Designer: Oanh đăng JD 28/10, ứng viên **Tô Bảo Châu** hẹn 12/11.
- **Sprint:** Sprint 13 RetailOS 26/10–06/11 (go-live sprint), velocity 41 điểm; Sprint 14 10/11–20/11 trọng tâm: báo cáo ca xuất Excel, khuyến mãi theo giờ, chuẩn bị Phú Thịnh.
  Hành động retro 13: Bảo đổi eviction policy + cảnh báo bộ nhớ Redis 80%; Thịnh viết test hồi quy in hóa đơn; Duyên làm lại bố cục POS màn 10 inch.
- **Town hall 10/11:** OKR Q4 (3 objectives: giữ Minh Châu NPS ≥ 60; FleetPro 180 xe chạy ổn định trước 20/12; ký khách thứ 3), thưởng go-live
  cho Minh, Bảo, Phước, Nhung, Vinh (mỗi người 1 tháng lương... say "thưởng go-live"); team building **Phan Thiết 28–29/11** (Hằng lo xe + khách sạn).
- **Marketing:** case study FleetPro × Sao Đỏ đăng 06/11; webinar "Chuyển đổi số chuỗi bán lẻ vừa và nhỏ" ngày **20/11** (Hà host, Minh diễn giả).
- **Kế toán:** hóa đơn đợt 3 Minh Châu 1,2 tỷ xuất 02/11, thu tiền 09/11. Lương tháng 10 chi 05/11. Quyết toán chi phí team building ước 68 triệu.

## Demo day — Wed 11/11/2026 (meetings, all hosted in PON)

| Time | Meeting | Host | Notes |
|---|---|---|---|
| 08:30–08:45 | Stand-up RetailOS | Minh | retail team |
| 09:00–09:15 | Stand-up FleetPro | Huy | fleet team |
| 09:30–10:15 | Rà soát phụ lục PL-02 Sao Đỏ | Lan Anh | Đạt, Huy, Giang, Dũng |
| 10:30–11:15 | Phỏng vấn vòng 2 — Backend Go (Lương Quốc Việt) | Huy | Hải, Oanh, Tuấn; AI notes OFF |
| 13:30–14:30 | Demo sản phẩm — Saigon Seed Partners | Khang | Tuấn, Giang; chị Vy joins by link |
| 14:30–15:30 | ★ Họp toàn công ty — Ra mắt trợ lý AI nội bộ (LIVE DEMO slot) | Khang | everyone; AI notes ON; left empty so the presenter runs it live |
| 15:30–16:15 | Báo cáo tuần pilot — Sao Đỏ | Huy | Trang, Trí, Hải, Ngọc |
| 16:00–16:30 | Workshop UX: POS màn 10 inch | Duyên | Minh, Phước, Hân, Thịnh |
| 16:30–17:00 | 1-1 Khang × Lan Anh | Khang | pipeline Q4 |

Meetings whose end is before the moment the seed runs are stored as ENDED (attendance, AI summary, transcript,
chat); the rest stay SCHEDULED. Re-run the seed on demo morning shortly before presenting.

## File keys of the chapter (owned by files-nov.js — reference by key only)

| key | file name | type | shared by / where | content |
|---|---|---|---|---|
| `golive_report` | Bao-cao-van-hanh-tuan-1-Minh-Chau.xlsx | xlsx | Minh, meeting `golive-review` + #retailos | per-store orders/revenue/uptime/incidents, week 28/10–03/11 |
| `postmortem` | Postmortem-P1-dong-bo-ton-kho-29-10.docx | docx (KB) | Bảo, meeting `golive-review` + #retailos | timeline, root cause (Redis noeviction), actions |
| `fleet_proposal` | De-xuat-mo-rong-FleetPro-180-xe.docx | docx (KB) | Huy, #fleetpro + meeting `fleet-expansion` | pilot results, scope 130 xe, timeline, price |
| `fleet_rollout` | Ke-hoach-lap-dat-130-xe-FleetPro.xlsx | xlsx | Trang, meeting `fleet-expansion` | 3 đợt, biển số, ngày, kỹ thuật viên |
| `metrics_6m` | So-lieu-kinh-doanh-6-thang-Lumen.xlsx | xlsx | Giang → Khang (dm-khang-giang? use group 'bod') + meeting `bgd-thang-11` | revenue/cost/runway by month |
| `seed_memo` | Lumen-Seed-Memo-v3.docx | docx (KB) | Khang, 'bod' + meeting `ssp-demo` | investment memo: problem, product, traction, ask 8 tỷ |
| `traction_png` | lumen-traction-6-thang.png | image | Khang, 'bod' | bar chart revenue by month |
| `quote_phuthinh` | Bao-gia-RetailOS-Phu-Thinh.docx | docx (KB) | Đạt, #kinh-doanh + meeting `phuthinh` | quotation |
| `appendix_pl02` | Phu-luc-PL02-Hop-dong-Sao-Do.docx | docx (KB) | Lan Anh, #kinh-doanh + meeting `pl02-review` | contract appendix |
| `okr_q4` | OKR-Q4-2026-Lumen.docx | docx (KB) | Khang, 📢 ann + meeting `townhall-11` | OKRs |
| `teambuilding` | Lich-trinh-team-building-Phan-Thiet-28-29-11.docx | docx (KB) | Oanh, 📢 ann + meeting `townhall-11` | itinerary |
| `interview_kit` | Bo-cau-hoi-phong-van-Backend-Go-v2.md | md (KB) | Huy, Tuyển Backend Go group | questions + rubric |
| `cv_viet` | CV-Luong-Quoc-Viet-Backend-Go.docx | docx | Oanh, Tuyển Backend Go group + meeting `interview-viet` | CV |
| `webinar_plan` | Ke-hoach-webinar-20-11.md | md (KB) | Hà, #marketing | agenda, speakers, KPIs |
| `pilot_week45` | Bao-cao-pilot-Sao-Do-tuan-45.csv | csv (KB) | Trang, #fleetpro | per-vehicle km, on-time %, fuel |
| `golive_photo` | golive-minh-chau-go-vap.png | image | Minh, 📢 ann (28/10) | photo-like render of the store POS counter |
