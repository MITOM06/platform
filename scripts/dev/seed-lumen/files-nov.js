// Files of the November chapter (STORY-NOV.md): real .docx / .xlsx / .csv / .md
// documents and two PNGs. Every number here is the one the story bible fixes,
// so chat, meeting summaries and documents agree.
//
// Each entry: { name, mime, buf, kb?, image?, text } — `text` is what a reader
// would extract (used for the meeting "material" records the AI note-taker saw).

const path = require('node:path');
const fs = require('node:fs');
const { mod, rng } = require('./lib');
const { docx, xlsx, plainText, sheetsText } = require('./office');
const sharp = mod('sharp');

const DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const PREBUILT = path.join(__dirname, 'prebuilt');
const F = 'font-family="Geist, Inter, Helvetica, Arial, sans-serif"';

// ---------------------------------------------------------------- data

const STORES = [
  ['Minh Châu Gò Vấp', 5920, 171000], ['Minh Châu Bình Thạnh', 4310, 168000], ['Minh Châu Thủ Đức', 4080, 162000],
  ['Minh Châu Quận 7', 3950, 189000], ['Minh Châu Tân Bình', 3720, 166000], ['Minh Châu Dĩ An', 2860, 148000],
  ['Minh Châu Thuận An', 2940, 151000], ['Minh Châu Quận 12', 3010, 157000], ['Minh Châu Phú Nhuận', 3150, 176000],
  ['Minh Châu Bình Tân', 2780, 154000], ['Minh Châu Quận 3', 2240, 183000], ['Minh Châu Thủ Dầu Một', 2420, 152000],
];
const TOTAL_ORDERS = 41380;
const TOTAL_REVENUE = 6_840_000_000;

function storeRows() {
  const rows = STORES.map(([name, orders, basket]) => [name, orders, Math.round((orders * basket) / 1e6) * 1e6]);
  const diff = TOTAL_REVENUE - rows.reduce((s, r) => s + r[2], 0);
  rows[0][2] += diff; // keep the bible's 6,84 tỷ exact
  const uptime = { 'Minh Châu Thủ Đức': 99.62, 'Minh Châu Dĩ An': 99.88 };
  const qr = [41, 39, 37, 44, 40, 31, 30, 33, 42, 32, 45, 29];
  return rows.map((r, i) => [r[0], r[1], r[2], Math.round(r[2] / r[1]), uptime[r[0]] ?? 99.97, qr[i], r[0].endsWith('Thủ Đức') ? 1 : 0, ['Minh Châu Bình Thạnh', 'Minh Châu Dĩ An'].includes(r[0]) ? 1 : 0]);
}

const DAYS = [['28/10 (T4)', 6420], ['29/10 (T5)', 5910], ['30/10 (T6)', 5730], ['31/10 (T7)', 6380], ['01/11 (CN)', 6150], ['02/11 (T2)', 5520], ['03/11 (T3)', 5270]];

const MONTHS = [
  ['T5/2026', 120, 240, 'Sao Đỏ đặt cọc pilot'], ['T6/2026', 298, 270, 'Minh Châu đợt 1 (ký HĐ)'], ['T7/2026', 516, 300, 'Minh Châu đợt 2 + Sao Đỏ thiết bị'],
  ['T8/2026', 364, 320, ''], ['T9/2026', 642, 345, 'Sao Đỏ phí pilot + Minh Châu UAT'], ['T10/2026', 670, 385, 'Minh Châu go-live (đợt 3 xuất 02/11)'],
];

const PLATE_PREFIX = ['51C', '51D', '61C', '62C', '65C', '50H'];
const ROUTES = ['TP.HCM – Cần Thơ', 'TP.HCM – Long An', 'TP.HCM – Tiền Giang', 'TP.HCM – Bình Dương', 'TP.HCM – Vĩnh Long'];

function plates(seed, n) {
  const r = rng(seed);
  const out = new Set();
  while (out.size < n) out.add(`${r.pick(PLATE_PREFIX)}-${String(r.int(10, 999)).padStart(3, '0')}.${String(r.int(10, 99))}`);
  return [...out];
}

// --------------------------------------------------------------- docs

const POSTMORTEM = `# Postmortem — Sự cố P1 đồng bộ tồn kho, 29/10/2026

**Người viết:** Lý Gia Bảo (DevOps) · **Review:** Lê Quang Vinh, Hoàng Anh Tuấn · **Trạng thái:** Đã đóng

## Tóm tắt
Từ 07:10 đến 07:32 ngày 29/10/2026 (22 phút), POS tại siêu thị Minh Châu Thủ Đức hiển thị tồn kho chậm 3–5 phút so với kho trung tâm. Thu ngân vẫn bán hàng bình thường, **không mất đơn nào**, nhưng 14 đơn bán vượt tồn trên hệ thống (hàng thực tế vẫn còn trên kệ). Mức độ: P1 (ảnh hưởng một siêu thị trong giờ mở cửa).

## Dòng thời gian
| Giờ | Sự kiện |
|---|---|
| 07:10 | Cảnh báo "inventory-sync lag > 60s" bắn vào #retailos |
| 07:12 | Bảo nhận on-call, xác nhận chỉ Thủ Đức bị ảnh hưởng |
| 07:18 | Phát hiện Redis cache cụm 2 đầy bộ nhớ (maxmemory 2GB), eviction policy đang là noeviction |
| 07:24 | Vinh tạm tăng maxmemory lên 4GB, đổi policy sang allkeys-lru |
| 07:32 | Độ trễ đồng bộ về dưới 2 giây, đóng sự cố |
| 09:00 | Báo chị Thảo (IT Minh Châu) và anh Phát |

## Nguyên nhân gốc
Cấu hình Redis cho môi trường production được sao chép từ staging, nơi policy noeviction được dùng để phát hiện rò rỉ bộ nhớ. Lượng SKU tăng gấp 3 sau khi bật toàn chuỗi (từ 4.100 lên 12.600 SKU), cache đầy sau 20 giờ chạy. Không có cảnh báo dung lượng bộ nhớ Redis.

## Hành động
| Việc | Người phụ trách | Hạn |
|---|---|---|
| Đổi eviction policy allkeys-lru cho mọi cụm production | Lý Gia Bảo | 30/10 (xong) |
| Cảnh báo bộ nhớ Redis khi vượt 80% | Lý Gia Bảo | 04/11 |
| Đối soát lại 14 đơn bán vượt tồn với kho Thủ Đức | Lê Quang Vinh | 30/10 (xong) |
| Thêm kiểm tra cấu hình production vào checklist go-live | Ngô Đức Thịnh | 06/11 |

## Bài học
- Cấu hình staging không được dùng nguyên cho production; mọi khác biệt phải ghi trong runbook.
- Đo dung lượng theo số SKU thật của khách trước khi bật toàn chuỗi.
`;

const FLEET_PROPOSAL = `# Đề xuất mở rộng FleetPro cho Vận tải Sao Đỏ — 180 xe

**Lập bởi:** Đặng Quốc Huy, Phan Thị Thu Trang · **Ngày:** 03/11/2026 · **Gửi:** Anh Tài — Giám đốc Vận tải Sao Đỏ

## 1. Kết quả pilot 50 xe (01/09 – 31/10/2026)
| Chỉ số | Trước pilot | Sau pilot |
|---|---|---|
| Tỷ lệ giao đúng giờ | 81% | 94% |
| Nhiên liệu tiêu thụ | 100% (gốc) | giảm 11% |
| Chấm công tài xế | Ghi tay, đối chiếu cuối tháng | Tự động theo chuyến |
| Thời gian lập báo cáo tuần | 1,5 ngày | 15 phút |

Tuyến pilot: TP.HCM – Cần Thơ. Thiết bị Lumen-T1 chạy ổn định, không có thiết bị nào phải thay trong 2 tháng.

## 2. Phạm vi mở rộng
- Lắp thêm **130 thiết bị Lumen-T1** (firmware 1.5, cập nhật OTA) → tổng **180 xe**.
- Mở thêm 4 tuyến: Long An, Tiền Giang, Bình Dương, Vĩnh Long.
- App tài xế **v1.0** (phát hành 16/11): xác nhận giao hàng bằng ảnh, chấm công, báo sự cố.
- Dashboard điều phối: gán chuyến tự động, cảnh báo lệch tuyến, dừng đỗ quá lâu.

## 3. Lịch triển khai
| Đợt | Ngày lắp | Số xe | Tuyến |
|---|---|---|---|
| 1 | 01/12/2026 | 40 | Long An, Tiền Giang |
| 2 | 08/12/2026 | 45 | Bình Dương |
| 3 | 15/12/2026 | 45 | Vĩnh Long, bổ sung Cần Thơ |

Mục tiêu: toàn bộ 180 xe chạy ổn định trước **20/12/2026**.

## 4. Chi phí (chưa VAT)
| Hạng mục | Đơn giá | Số lượng | Thành tiền |
|---|---|---|---|
| Thiết bị Lumen-T1 | 2.900.000đ | 130 | 377.000.000đ |
| Lắp đặt & đào tạo tài xế | trọn gói | 1 | 95.000.000đ |
| Phí SaaS FleetPro | 220.000đ/xe/tháng | 180 xe × 12 tháng | 475.200.000đ |
| **Tổng năm đầu** | | | **947.200.000đ** |

## 5. Rủi ro & cách xử lý
- Thiếu linh kiện module 4G Cat-1 cuối năm → đã đặt trước 150 module (Võ Minh Khôi).
- Tài xế mới chưa quen app → đào tạo tại bãi xe, video hướng dẫn 3 phút.
`;

const SEED_MEMO = `# Lumen Software — Investment Memo (Seed) v3

**Người soạn:** Trần Phúc Khang (CEO) · Nguyễn Thị Hương Giang (Kế toán trưởng) · **Ngày:** 04/11/2026 · **Bảo mật — chỉ gửi nhà đầu tư**

## Vấn đề
Chuỗi bán lẻ và doanh nghiệp vận tải vừa và nhỏ ở Việt Nam vận hành bằng phần mềm rời rạc và Excel. Phần mềm nước ngoài quá đắt, phần mềm nội địa không tích hợp thanh toán VietQR, thiết bị GPS và báo cáo theo thời gian thực.

## Sản phẩm
- **RetailOS** — POS, tồn kho, khuyến mãi, màn hình quảng cáo cho chuỗi cửa hàng.
- **FleetPro** — thiết bị GPS Lumen-T1 tự thiết kế, app tài xế, điều phối và báo cáo nhiên liệu.

## Tăng trưởng 6 tháng (05–10/2026)
| Chỉ số | Giá trị |
|---|---|
| Doanh thu lũy kế | 2,61 tỷ đồng |
| Khách hàng trả tiền | 2 (Minh Châu — 12 siêu thị; Vận tải Sao Đỏ — 50 → 180 xe) |
| Go-live Minh Châu tuần đầu | 41.380 đơn, 6,84 tỷ doanh thu qua POS, uptime 99,93% |
| Chi phí vận hành trung bình | 310 triệu/tháng |
| Runway hiện tại | 9 tháng |
| Pipeline | Phú Thịnh (18 cửa hàng), Bách Hóa Đồng Nai, Logistics An Phát |

## Đề nghị đầu tư
- Huy động **8 tỷ đồng**, định giá pre-money **40 tỷ đồng**.
- Sử dụng vốn: 55% đội ngũ sản phẩm (tuyển 6 người), 25% bán hàng & marketing, 20% thiết bị và hạ tầng.
- Mục tiêu 18 tháng: 10 khách hàng trả tiền, doanh thu định kỳ 1,2 tỷ/tháng, hòa vốn.

## Đội ngũ
Trần Phúc Khang (CEO), Hoàng Anh Tuấn (CTO), Nguyễn Hoàng Dũng (COO), 31 nhân sự, 7 phòng ban.
`;

const QUOTE_PHUTHINH = `# Báo giá RetailOS — Chuỗi cửa hàng tiện lợi Phú Thịnh

**Số:** BG-LM-2026-014 · **Ngày:** 09/11/2026 · **Hiệu lực:** 30 ngày
**Kính gửi:** Anh Lộc — CEO Chuỗi Phú Thịnh (18 cửa hàng, Đồng Nai)
**Người lập:** Nguyễn Văn Đạt (Account Executive) · **Duyệt:** Cao Thị Lan Anh

## Phạm vi
- POS RetailOS v2 cho 18 cửa hàng (36 quầy), thanh toán VietQR, thẻ, tiền mặt.
- Tồn kho trung tâm, đồng bộ theo thời gian thực, kiểm kê bằng ảnh.
- Khuyến mãi theo giờ, báo cáo theo ca (xuất Excel), dashboard cho ban điều hành.
- Tích hợp phần mềm kế toán MISA.

## Chi phí (chưa VAT)
| Hạng mục | Đơn giá | Ghi chú |
|---|---|---|
| Phí triển khai trọn gói | 1.350.000.000đ | cài đặt, chuyển đổi dữ liệu, đào tạo, 2 tuần hỗ trợ tại chỗ |
| Phí thuê bao | 9.500.000đ/cửa hàng/tháng | gồm cập nhật, hỗ trợ 7:00–22:00, SLA 99,9% |

## Lộ trình
- Pilot 3 cửa hàng từ tháng 01/2027, mở rộng 15 cửa hàng còn lại sau 6 tuần.
- Thanh toán triển khai: 40% khi ký, 40% khi go-live pilot, 20% khi nghiệm thu toàn chuỗi.

## Tham chiếu
Đã go-live toàn chuỗi Minh Châu (12 siêu thị) ngày 28/10/2026: 41.380 đơn tuần đầu, uptime 99,93%.
`;

const APPENDIX_PL02 = `# Phụ lục PL-02 — Hợp đồng FleetPro số LM-SD-2026-002

**Bên A:** Công ty TNHH Vận tải Sao Đỏ — Đại diện: Ông Tài, Giám đốc
**Bên B:** Công ty TNHH Lumen Software — Đại diện: Ông Trần Phúc Khang, Giám đốc
**Ngày lập dự thảo:** 09/11/2026 · **Trạng thái:** Dự thảo lần 2 (chờ rà soát 11/11)

## Điều 1. Nội dung bổ sung
Bên B cung cấp và lắp đặt thêm 130 thiết bị Lumen-T1 cho Bên A, nâng tổng số xe sử dụng FleetPro lên 180 xe, theo lịch 3 đợt: 01/12/2026 (40 xe), 08/12/2026 (45 xe), 15/12/2026 (45 xe).

## Điều 2. Giá trị phụ lục (chưa VAT)
| Hạng mục | Thành tiền |
|---|---|
| 130 thiết bị × 2.900.000đ | 377.000.000đ |
| Lắp đặt & đào tạo | 95.000.000đ |
| Phí SaaS 180 xe × 220.000đ × 12 tháng | 475.200.000đ |
| **Tổng** | **947.200.000đ** |

## Điều 3. Thanh toán
- Thiết bị và lắp đặt: 50% khi ký phụ lục, 50% sau khi hoàn tất đợt 3.
- Phí SaaS: thanh toán theo quý, đầu mỗi quý.

## Điều 4. Cam kết chất lượng
- Thiết bị bảo hành 24 tháng, đổi mới trong 48 giờ nếu lỗi phần cứng.
- Dashboard và app tài xế sẵn sàng 99,5% mỗi tháng; nếu không đạt, giảm 10% phí SaaS tháng đó.

## Điều 5. Điểm còn mở (rà soát 11/11)
- Bên A đề nghị kéo dài bảo hành lên 36 tháng.
- Điều khoản dữ liệu: Bên A muốn tự lưu bản sao lịch sử lộ trình hằng tháng.
`;

const OKR_Q4 = `# OKR Quý 4/2026 — Lumen Software

**Công bố tại Town hall 10/11/2026** · Người phụ trách chung: Trần Phúc Khang

## O1. Giữ Minh Châu là khách hàng "fan" của Lumen
- KR1: NPS của Minh Châu ≥ 60 (khảo sát 15/12) — Nguyễn Kim Minh
- KR2: Uptime POS ≥ 99,9% mỗi tuần — Lý Gia Bảo
- KR3: Báo cáo ca xuất Excel và khuyến mãi theo giờ lên production trước 30/11 — Phạm Thị Hồng Nhung

## O2. FleetPro 180 xe chạy ổn định
- KR1: Lắp đủ 130 thiết bị theo 3 đợt, xong trước 15/12 — Đặng Quốc Huy
- KR2: Tỷ lệ giao đúng giờ trên toàn đội xe ≥ 92% trước 20/12 — Phan Thị Thu Trang
- KR3: App tài xế v1.0 phát hành 16/11, crash-free ≥ 99,5% — Phạm Minh Trí

## O3. Có khách hàng trả tiền thứ 3
- KR1: Ký hợp đồng với Phú Thịnh hoặc Bách Hóa Đồng Nai trước 31/12 — Cao Thị Lan Anh
- KR2: Webinar 20/11 có ≥ 150 người đăng ký, ≥ 20 lead — Mai Thanh Hà
- KR3: Hoàn tất vòng seed 8 tỷ — Trần Phúc Khang, Nguyễn Thị Hương Giang

## Con người
- Tuyển xong 2 Backend Go (FleetPro) và 1 UI/UX Designer — Phùng Thị Kim Oanh
- Thưởng go-live Minh Châu cho Minh, Bảo, Phước, Nhung, Vinh — chi cùng lương tháng 11
`;

const TEAMBUILDING = `# Team building Lumen 2026 — Phan Thiết, 28–29/11

**Phụ trách:** Đặng Thu Hằng (HR & Admin) · Phùng Thị Kim Oanh · **Ngân sách dự kiến:** 68 triệu đồng

## Thứ 7, 28/11
| Giờ | Hoạt động |
|---|---|
| 06:00 | Tập trung tại văn phòng Quận 1, xe 45 chỗ khởi hành |
| 10:30 | Nhận phòng resort Hoàng Ngọc, Mũi Né |
| 12:00 | Ăn trưa hải sản |
| 14:30 | Game đồng đội trên bãi biển — chia 4 đội theo màu |
| 18:30 | Gala dinner "Lumen — 200 ngày", trao thưởng go-live Minh Châu |

## Chủ nhật, 29/11
| Giờ | Hoạt động |
|---|---|
| 05:00 | Ngắm bình minh đồi cát đỏ (tự nguyện) |
| 08:00 | Ăn sáng, tự do tắm biển |
| 11:30 | Trả phòng, ăn trưa |
| 13:30 | Khởi hành về TP.HCM, dự kiến tới 18:00 |

## Lưu ý
- Đăng ký trước 18/11 trên kênh 📢 Thông báo chung (react ✅). Người thân đi kèm tự túc 1,2 triệu/người.
- Mang theo CCCD, đồ bơi, áo đồng phục Lumen (phát ngày 25/11).
`;

const CV_VIET = `# LƯƠNG QUỐC VIỆT — Senior Backend Engineer (Go)

TP. Thủ Đức · 5 năm kinh nghiệm · Ứng tuyển: Backend Go — FleetPro (Lumen Software)

## Kinh nghiệm
### Logistics An Phát — Backend Engineer (2023 – nay)
- Xây hệ thống theo dõi 600 xe tải bằng Go + Kafka + TimescaleDB, xử lý 4.000 bản tin GPS/giây.
- Giảm độ trễ dashboard điều phối từ 8 giây xuống 900ms bằng cách tách read model.
- Phụ trách on-call, viết runbook xử lý sự cố mất tín hiệu thiết bị.

### Công ty Phần mềm Sông Hàn — Backend Developer (2021 – 2023)
- REST API cho app giao hàng (Go, PostgreSQL, Redis), 120.000 người dùng.
- Viết bộ test tích hợp bằng testcontainers, độ phủ 78%.

## Kỹ năng
Go, gRPC, Kafka, MQTT, PostgreSQL/TimescaleDB, Redis, Docker, Kubernetes cơ bản, Prometheus/Grafana.

## Học vấn
Kỹ sư Công nghệ thông tin — Đại học Bách khoa TP.HCM (2016–2021).
`;

const INTERVIEW_KIT = `# Bộ câu hỏi phỏng vấn Backend Go — FleetPro (v2, 05/11/2026)

Người soạn: Đặng Quốc Huy, Nguyễn Thanh Hải · Thời lượng: 45 phút · Chấm theo thang 1–4

## Vòng 1 — kỹ thuật (Hải + Huy)
1. Thiết kế endpoint nhận bản tin GPS từ 10.000 thiết bị, mỗi thiết bị 1 bản tin/5 giây. Lưu ở đâu, xử lý trùng/lệch thứ tự ra sao?
2. goroutine leak: dấu hiệu, cách tìm, ví dụ thực tế đã gặp.
3. Khi nào dùng channel, khi nào dùng mutex?
4. Thiết bị mất sóng 2 giờ rồi gửi bù 1.440 bản tin — hệ thống của bạn phản ứng thế nào?

## Vòng 2 — hệ thống & văn hoá (Huy, Hải, Tuấn, Oanh)
1. Kể về một sự cố production bạn trực tiếp xử lý: dòng thời gian, nguyên nhân, bài học.
2. Thiết kế cảnh báo lệch tuyến gần thời gian thực cho 180 xe.
3. Bạn review code của người khác như thế nào? Khi bất đồng thì làm gì?
4. Câu hỏi của ứng viên.

## Tiêu chí
| Tiêu chí | Trọng số |
|---|---|
| Kiến thức Go & concurrency | 30% |
| Thiết kế hệ thống IoT / dữ liệu chuỗi thời gian | 30% |
| Vận hành & xử lý sự cố | 20% |
| Giao tiếp, làm việc nhóm | 20% |

Ngưỡng nhận: tổng điểm ≥ 3,0 và không tiêu chí nào dưới 2.
`;

const WEBINAR_PLAN = `# Kế hoạch webinar "Chuyển đổi số chuỗi bán lẻ vừa và nhỏ" — 20/11/2026

**Chủ trì:** Mai Thanh Hà · **Nội dung:** Lê Phương Uyên · **Diễn giả:** Nguyễn Kim Minh (Lumen), chị Thảo (IT Minh Châu, khách mời)

## Mục tiêu
- ≥ 150 người đăng ký, ≥ 80 người tham dự trực tiếp, ≥ 20 lead đủ điều kiện cho phòng Kinh doanh.

## Chương trình (19:30–21:00)
| Giờ | Nội dung | Người trình bày |
|---|---|---|
| 19:30 | Khai mạc, giới thiệu Lumen | Mai Thanh Hà |
| 19:40 | 3 nút thắt vận hành của chuỗi 10–50 cửa hàng | Nguyễn Kim Minh |
| 20:05 | Câu chuyện go-live 12 siêu thị trong 1 đêm | chị Thảo — Minh Châu |
| 20:30 | Demo RetailOS: POS, tồn kho, báo cáo ca | Nguyễn Kim Minh |
| 20:45 | Hỏi đáp, ưu đãi đăng ký demo riêng | Cao Thị Lan Anh |

## Kênh truyền thông
- Fanpage + LinkedIn: 3 bài (11/11, 16/11, 19/11). Case study FleetPro × Sao Đỏ đã đăng 06/11 dùng làm bằng chứng.
- Email tới 1.200 liên hệ chủ chuỗi bán lẻ (danh sách hội chợ Vietnam Retail Expo).
- Ngân sách quảng cáo: 12 triệu đồng.
`;

// --------------------------------------------------------------- images

async function svgToPng(svg) {
  return sharp(Buffer.from(svg)).png().toBuffer();
}

async function tractionPng() {
  const bars = MONTHS.map(([m, rev]) => [m.replace('/2026', ''), rev]);
  const max = 700;
  const rects = bars.map(([label, v], i) => {
    const h = Math.round((v / max) * 300);
    const x = 110 + i * 115;
    return `<rect x="${x}" y="${420 - h}" width="76" height="${h}" rx="6" fill="#7A2E3A"/>
      <text x="${x + 38}" y="${408 - h}" text-anchor="middle" font-size="20" font-weight="600" fill="#2B2A28" ${F}>${v}</text>
      <text x="${x + 38}" y="452" text-anchor="middle" font-size="19" fill="#6E6A64" ${F}>${label}</text>`;
  }).join('');
  return svgToPng(`<svg xmlns="http://www.w3.org/2000/svg" width="860" height="520">
    <rect width="860" height="520" fill="#F5F2ED"/>
    <text x="40" y="54" font-size="27" font-weight="700" fill="#2B2A28" ${F}>Lumen Software — doanh thu 6 tháng (triệu đồng)</text>
    <text x="40" y="86" font-size="18" fill="#6E6A64" ${F}>Lũy kế 2,61 tỷ · chi phí TB 310 triệu/tháng · runway 9 tháng</text>
    <line x1="90" y1="420" x2="820" y2="420" stroke="#CFC8BE" stroke-width="2"/>${rects}
    <text x="820" y="500" text-anchor="end" font-size="15" fill="#8C8578" ${F}>Nguồn: Kế toán Lumen, 04/11/2026</text></svg>`);
}

async function goliveImagePng() {
  const shelves = [0, 1, 2, 3].map((i) => `<rect x="${40 + i * 60}" y="120" width="48" height="300" rx="4" fill="${['#C9B79C', '#B9A27F', '#D4C4A8', '#BFA888'][i]}"/>`).join('');
  const items = Array.from({ length: 24 }, (_, i) => `<rect x="${46 + (i % 4) * 60}" y="${132 + Math.floor(i / 4) * 48}" width="36" height="34" rx="3" fill="${['#7A2E3A', '#4F6D5E', '#3E5C76', '#E0A458'][i % 4]}" opacity="0.85"/>`).join('');
  return svgToPng(`<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="640">
    <defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#EDE8E1"/><stop offset="1" stop-color="#D9D1C5"/></linearGradient></defs>
    <rect width="1024" height="640" fill="url(#g)"/>
    <rect x="0" y="0" width="1024" height="92" fill="#7A2E3A"/>
    <text x="512" y="60" text-anchor="middle" font-size="28" font-weight="700" fill="#F5F2ED" ${F}>Minh Châu Gò Vấp — RetailOS chính thức hoạt động 28/10</text>
    ${shelves}${items}
    <rect x="330" y="300" width="640" height="210" rx="10" fill="#8C6B4F"/>
    <rect x="330" y="300" width="640" height="24" rx="6" fill="#6E5440"/>
    <rect x="560" y="150" width="270" height="170" rx="10" fill="#2B2A28"/>
    <rect x="572" y="162" width="246" height="136" rx="4" fill="#F5F2ED"/>
    <rect x="572" y="162" width="246" height="24" fill="#7A2E3A"/>
    <text x="582" y="179" font-size="13" font-weight="700" fill="#F5F2ED" ${F}>RetailOS POS · Quầy 03</text>
    <text x="582" y="208" font-size="12" fill="#2B2A28" ${F}>Sữa tươi 1L × 3</text><text x="808" y="208" text-anchor="end" font-size="12" fill="#2B2A28" ${F}>105.000</text>
    <text x="582" y="228" font-size="12" fill="#2B2A28" ${F}>Cà chua Đà Lạt 1kg × 2</text><text x="808" y="228" text-anchor="end" font-size="12" fill="#2B2A28" ${F}>58.000</text>
    <text x="582" y="282" font-size="15" font-weight="700" fill="#7A2E3A" ${F}>Tổng 163.000đ · VietQR</text>
    <rect x="680" y="320" width="30" height="40" fill="#2B2A28"/>
    <rect x="380" y="250" width="120" height="110" rx="8" fill="#FFFFFF" stroke="#CFC8BE"/>
    <text x="440" y="295" text-anchor="middle" font-size="16" font-weight="700" fill="#2B2A28" ${F}>Quét VietQR</text>
    ${Array.from({ length: 64 }, (_, i) => ((i * 37) % 7 < 3 ? `<rect x="${410 + (i % 8) * 7.5}" y="${304 + Math.floor(i / 8) * 5.5}" width="7.5" height="5.5" fill="#2B2A28"/>` : '')).join('')}
    <text x="512" y="590" text-anchor="middle" font-size="22" fill="#2B2A28" ${F}>Đơn đầu tiên lúc 06:04 · 12/12 siêu thị online</text></svg>`);
}

function prebuilt(name, render) {
  const f = path.join(PREBUILT, `${name}.png`);
  return fs.existsSync(f) ? Promise.resolve(fs.readFileSync(f)) : render();
}

// --------------------------------------------------------------- build

function docEntry(name, src, title) {
  return { name, mime: DOCX, buf: docx(src, { title }), kb: true, text: plainText(src) };
}

function sheetEntry(name, sheets) {
  return { name, mime: XLSX, buf: xlsx(sheets), kb: false, text: sheetsText(sheets) };
}

async function buildNovFiles() {
  const stores = storeRows();
  const weekly = [
    { name: 'Theo siêu thị', widths: [26, 10, 16, 14, 11, 12, 8, 8], rows: [
      ['Siêu thị', 'Số đơn', 'Doanh thu (đ)', 'Giá trị TB/đơn', 'Uptime %', 'VietQR %', 'Sự cố P1', 'Lỗi P2'],
      ...stores,
      ['TỔNG', TOTAL_ORDERS, TOTAL_REVENUE, Math.round(TOTAL_REVENUE / TOTAL_ORDERS), 99.93, 38, 1, 3],
    ] },
    { name: 'Theo ngày', widths: [14, 10], rows: [['Ngày', 'Số đơn'], ...DAYS, ['Tổng', TOTAL_ORDERS]] },
    { name: 'Sự cố', widths: [8, 12, 22, 60, 18, 14], rows: [
      ['Mức', 'Ngày', 'Siêu thị', 'Mô tả', 'Phụ trách', 'Trạng thái'],
      ['P1', '29/10', 'Minh Châu Thủ Đức', 'Đồng bộ tồn kho chậm 07:10–07:32 (Redis đầy bộ nhớ, policy noeviction)', 'Lý Gia Bảo', 'Đã xử lý'],
      ['P2', '28/10', 'Minh Châu Bình Thạnh', 'In hóa đơn khổ 58mm lệch lề trái', 'Bùi Hữu Phước', 'Đã fix 30/10'],
      ['P2', '30/10', 'Minh Châu Dĩ An', 'Báo cáo theo ca tải chậm (6–8 giây)', 'Lê Quang Vinh', 'Đang xử lý'],
      ['P2', '31/10', 'Toàn chuỗi', 'Nút đổi trả bị ẩn trên POS màn hình 10 inch', 'Trần Mỹ Duyên', 'Sprint 14'],
    ] },
  ];

  const rollout = (() => {
    const ps = plates('fleet-rollout-130', 130);
    const rows = [['STT', 'Biển số', 'Loại xe', 'Tuyến', 'Đợt', 'Ngày lắp', 'Kỹ thuật viên', 'Trạng thái']];
    const r = rng('rollout');
    ps.forEach((p, i) => {
      const wave = i < 40 ? 1 : i < 85 ? 2 : 3;
      const route = wave === 1 ? r.pick(ROUTES.slice(1, 3)) : wave === 2 ? ROUTES[3] : r.pick([ROUTES[4], ROUTES[0]]);
      rows.push([i + 1, p, r.pick(['Tải 1,9 tấn', 'Tải 3,5 tấn', 'Tải 8 tấn', 'Container 20ft']), route, wave,
        ['01/12/2026', '08/12/2026', '15/12/2026'][wave - 1], r.pick(['Võ Minh Khôi', 'Đinh Công Sơn', 'Đội lắp đặt Tâm Phát']), 'Chưa lắp']);
    });
    return [
      { name: 'Danh sách 130 xe', widths: [6, 12, 16, 22, 6, 12, 22, 10], rows },
      { name: 'Tổng hợp', widths: [8, 12, 10, 30], rows: [['Đợt', 'Ngày', 'Số xe', 'Tuyến'], [1, '01/12/2026', 40, 'Long An, Tiền Giang'], [2, '08/12/2026', 45, 'Bình Dương'], [3, '15/12/2026', 45, 'Vĩnh Long, Cần Thơ'], ['Tổng', '', 130, 'Cùng 50 xe pilot = 180 xe']] },
    ];
  })();

  const metrics = [
    { name: 'Theo tháng', widths: [12, 18, 18, 18, 36], rows: [
      ['Tháng', 'Doanh thu (triệu)', 'Chi phí (triệu)', 'Lãi/lỗ (triệu)', 'Ghi chú'],
      ...MONTHS.map(([m, rev, cost, note]) => [m, rev, cost, rev - cost, note]),
      ['Tổng 6 tháng', 2610, 1860, 750, 'Chi phí TB 310 triệu/tháng'],
    ] },
    { name: 'Tiền & runway', widths: [36, 18], rows: [
      ['Chỉ số (31/10/2026)', 'Giá trị'], ['Tiền mặt cuối kỳ (triệu)', 2790], ['Chi phí TB/tháng (triệu)', 310], ['Runway (tháng)', 9],
      ['Phải thu Minh Châu đợt 3 (triệu)', 1200], ['Khách hàng trả tiền', 2], ['Pipeline', 3],
    ] },
  ];

  const pilotCsv = (() => {
    const r = rng('pilot-week45');
    const lines = ['bien_so,tuyen,so_chuyen,km,dung_gio_pct,nhien_lieu_l_100km,canh_bao_lech_tuyen'];
    for (const p of plates('pilot-50', 50)) {
      lines.push([p, 'TP.HCM – Cần Thơ', r.int(9, 14), r.int(1650, 2450), r.int(88, 99), (r.int(205, 248) / 10).toFixed(1), r.chance(0.18) ? r.int(1, 2) : 0].join(','));
    }
    lines.push('TONG/TB,,,,94,22.6,');
    return `${lines.join('\n')}\n`;
  })();

  const txt = (s) => Buffer.from(s, 'utf8');
  return {
    golive_report: sheetEntry('Bao-cao-van-hanh-tuan-1-Minh-Chau.xlsx', weekly),
    postmortem: docEntry('Postmortem-P1-dong-bo-ton-kho-29-10.docx', POSTMORTEM, 'Postmortem P1 29/10'),
    fleet_proposal: docEntry('De-xuat-mo-rong-FleetPro-180-xe.docx', FLEET_PROPOSAL, 'Đề xuất mở rộng FleetPro 180 xe'),
    fleet_rollout: sheetEntry('Ke-hoach-lap-dat-130-xe-FleetPro.xlsx', rollout),
    metrics_6m: sheetEntry('So-lieu-kinh-doanh-6-thang-Lumen.xlsx', metrics),
    seed_memo: docEntry('Lumen-Seed-Memo-v3.docx', SEED_MEMO, 'Lumen Seed Memo v3'),
    traction_png: { name: 'lumen-traction-6-thang.png', mime: 'image/png', buf: await prebuilt('tractionPng', tractionPng), image: true, text: 'Biểu đồ doanh thu 6 tháng: T5 120, T6 298, T7 516, T8 364, T9 642, T10 670 (triệu đồng).' },
    quote_phuthinh: docEntry('Bao-gia-RetailOS-Phu-Thinh.docx', QUOTE_PHUTHINH, 'Báo giá RetailOS Phú Thịnh'),
    appendix_pl02: docEntry('Phu-luc-PL02-Hop-dong-Sao-Do.docx', APPENDIX_PL02, 'Phụ lục PL-02 Sao Đỏ'),
    okr_q4: docEntry('OKR-Q4-2026-Lumen.docx', OKR_Q4, 'OKR Q4 2026'),
    teambuilding: docEntry('Lich-trinh-team-building-Phan-Thiet-28-29-11.docx', TEAMBUILDING, 'Team building Phan Thiết'),
    interview_kit: { name: 'Bo-cau-hoi-phong-van-Backend-Go-v2.md', mime: 'text/markdown', buf: txt(INTERVIEW_KIT), kb: true, text: INTERVIEW_KIT },
    cv_viet: { ...docEntry('CV-Luong-Quoc-Viet-Backend-Go.docx', CV_VIET, 'CV Lương Quốc Việt'), kb: false },
    webinar_plan: { name: 'Ke-hoach-webinar-20-11.md', mime: 'text/markdown', buf: txt(WEBINAR_PLAN), kb: true, text: WEBINAR_PLAN },
    pilot_week45: { name: 'Bao-cao-pilot-Sao-Do-tuan-45.csv', mime: 'text/csv', buf: txt(pilotCsv), kb: true, text: pilotCsv },
    golive_photo: { name: 'golive-minh-chau-go-vap.png', mime: 'image/png', buf: await prebuilt('golivePhoto', goliveImagePng), image: true, text: 'Ảnh quầy thu ngân Minh Châu Gò Vấp ngày go-live 28/10, POS RetailOS và mã VietQR.' },
  };
}

async function renderNovPngs() {
  return { tractionPng: await tractionPng(), golivePhoto: await goliveImagePng() };
}

module.exports = { buildNovFiles, renderNovPngs, NOV_FILE_KEYS: ['golive_report', 'postmortem', 'fleet_proposal', 'fleet_rollout', 'metrics_6m', 'seed_memo', 'traction_png', 'quote_phuthinh', 'appendix_pl02', 'okr_q4', 'teambuilding', 'interview_kit', 'cv_viet', 'webinar_plan', 'pilot_week45', 'golive_photo'] };
