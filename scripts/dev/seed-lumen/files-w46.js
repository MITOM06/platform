// Files of the week-46 chapter (11/11 evening → Fri 13/11 demo day, see STORY-W46.md).
// Same entry shape as files-nov.js: { name, mime, buf, kb?, image?, text }.
// DEV-ONLY seed data.

const { docx, xlsx, plainText, sheetsText } = require('./office');

const DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const docEntry = (name, src, title, kb = true) => ({ name, mime: DOCX, buf: docx(src, { title }), kb, text: plainText(src) });
const sheetEntry = (name, sheets) => ({ name, mime: XLSX, buf: xlsx(sheets), kb: false, text: sheetsText(sheets) });
const mdEntry = (name, src) => ({ name, mime: 'text/markdown', buf: Buffer.from(src, 'utf8'), kb: true, text: src });

// ---------------------------------------------------------------- documents

const AI_GUIDE = `# Hướng dẫn nhanh: trợ lý AI nội bộ Lumi

Người soạn: Huỳnh Kim Ngân (AI Engineer) · Ngày: 11/11/2026 · Áp dụng cho toàn bộ nhân viên Lumen

## Lumi làm được gì
- Trả lời câu hỏi dựa trên tài liệu nội bộ: Sổ tay nhân viên, OKR Q4, phụ lục hợp đồng, postmortem, báo giá…
- Tóm tắt cuộc họp khi chủ trì bật **Ghi chú AI**: biên bản, quyết định, việc cần làm kèm người phụ trách.
- Đọc file được thả vào chat phòng họp (PDF, Word, văn bản) và đưa nội dung vào biên bản.
- Tạo nhắc nhở: "Nhắc mình 15:00 mai gọi anh Tài".
- Tóm tắt nhanh một nhóm chat dài: gõ **@AI tóm tắt** trong nhóm.

## Cách dùng
1. Chat riêng với **Lumi** trong danh sách hội thoại, hoặc gõ **@AI** trong bất kỳ nhóm nào.
2. Muốn Lumi đọc tài liệu: vào thông tin hội thoại → **Kho kiến thức** → tải file lên.
3. Trong phòng họp: chủ trì bật **Ghi chú AI** trước khi bắt đầu. Kết thúc họp, biên bản tự gửi vào nhóm "Họp: <tên cuộc họp>".

## Quy tắc bảo mật
- Lumi chỉ trả lời từ tài liệu bạn **có quyền xem**. Tài liệu của phòng khác không hiện ra cho bạn.
- Không dán mật khẩu, số tài khoản cá nhân, thông tin lương của người khác vào chat với Lumi.
- Phỏng vấn tuyển dụng và họp 1-1 nhạy cảm: **tắt Ghi chú AI**.
- Câu trả lời của AI có thể sai: luôn kiểm tra số liệu trước khi gửi khách hàng.

## Hỏi đáp
| Câu hỏi | Trả lời |
|---|---|
| Lumi có đọc được file Excel không? | Chưa. Hiện đọc PDF, Word và văn bản. Excel: dán bảng vào chat hoặc xuất CSV. |
| Biên bản AI có sửa được không? | Có. Ghi chú chung của cuộc họp ai cũng sửa được nếu chủ trì cho phép. |
| Ai xem được biên bản? | Những người được mời và có mặt trong cuộc họp. |
| Gặp lỗi báo ai? | Nhắn Ngân (AI) hoặc Bảo (DevOps) trong #tech-sync. |

`;

const DD_CHECKLIST = `# Danh sách tài liệu due diligence — Saigon Seed Partners

Gửi: Lumen Software · Từ: chị Vy (Partner, Saigon Seed Partners) · Nhận: 12/11/2026 · Hạn nộp đợt 1: **20/11/2026**

## Mục tiêu
Saigon Seed Partners tiến hành thẩm định trước khi phát hành term sheet (dự kiến **trước 30/11/2026**) cho vòng seed **8 tỷ đồng**, định giá pre-money **40 tỷ**.

## A. Pháp lý
- Giấy chứng nhận đăng ký doanh nghiệp, điều lệ, sổ cổ đông.
- Hợp đồng với khách hàng: Minh Châu (RetailOS), Sao Đỏ (FleetPro) kèm phụ lục **PL-02**.
- Thỏa thuận sở hữu trí tuệ giữa công ty và nhà sáng lập, nhân viên kỹ thuật.

## B. Tài chính
- Báo cáo kinh doanh 6 tháng (05–10/2026): doanh thu lũy kế **2,61 tỷ**, chi phí TB **310 triệu/tháng**, runway **9 tháng**.
- Sổ phải thu: hóa đơn đợt 3 Minh Châu **1,2 tỷ** (đã thu 09/11).
- Dự phóng 2027 theo 3 kịch bản.

## C. Sản phẩm & kỹ thuật
- Kiến trúc hệ thống, kế hoạch scale cho FleetPro **180 xe** và khách thứ ba.
- Báo cáo sự cố 6 tháng (gồm P1 ngày 29/10, xử lý trong 22 phút).
- Số liệu go-live Minh Châu tuần đầu: 41.380 đơn, uptime 99,93%.

## D. Khách hàng & thị trường
- Danh sách pipeline: Phú Thịnh, Bách Hóa Đồng Nai, Logistics An Phát.
- Liên hệ tham chiếu: anh Phát (Minh Châu), anh Tài (Sao Đỏ).

## E. Nhân sự
- Sơ đồ tổ chức (31 người, 2 phòng sản phẩm), kế hoạch tuyển Q4–Q1.
- Chính sách ESOP dự kiến.

## Phụ trách phía Lumen
| Hạng mục | Người phụ trách | Hạn |
|---|---|---|
| A. Pháp lý | Nguyễn Hoàng Dũng | 18/11 |
| B. Tài chính | Nguyễn Thị Hương Giang | 18/11 |
| C. Kỹ thuật | Hoàng Anh Tuấn | 19/11 |
| D. Khách hàng | Cao Thị Lan Anh | 19/11 |
| E. Nhân sự | Phùng Thị Kim Oanh | 19/11 |
| Tổng hợp & gửi | Trần Phúc Khang | 20/11 |
`;

const SCALE_PLAN = `# Kế hoạch scale hạ tầng 2027 — RetailOS & FleetPro

Người soạn: Hoàng Anh Tuấn (CTO) · Ngày: 12/11/2026 · Phiên bản: 1.0 (họp rà soát 12/11)

## Bối cảnh
- FleetPro tăng từ **50 lên 180 xe** (lắp đặt 01/12, 08/12, 15/12). Mỗi thiết bị T1 gửi 1 bản tin mỗi 5 giây → **36 bản tin/giây** khi đủ 180 xe (hiện 10 bản tin/giây).
- RetailOS: Minh Châu 12 siêu thị; nếu ký Phú Thịnh (18 cửa hàng, pilot 3 cửa hàng từ 01/2027) tải ghi đơn tăng khoảng **40%**.
- Sự cố P1 29/10 cho thấy Redis dùng chung là điểm yếu.

## Quyết định kiến trúc
| # | Hạng mục | Hiện tại | Đề xuất | Hạn |
|---|---|---|---|---|
| 1 | Redis | 1 instance dùng chung | Tách 2 cluster: RetailOS và FleetPro, policy allkeys-lru, cảnh báo 80% | 25/11 |
| 2 | MQTT broker | 1 node | 2 node, cân bằng tải, giữ phiên khi một node chết | 28/11 |
| 3 | Lưu dữ liệu GPS | MongoDB collection thường | Time-series collection, giữ 13 tháng | 05/12 |
| 4 | Load test | Chưa có cho FleetPro | Giả lập 540 xe (3 lần mục tiêu) trước đợt lắp 1 | 27/11 |
| 5 | On-call | Bảo + Sơn | Lịch trực tuần, cảnh báo về kênh on-call | 20/11 |

## Chi phí hạ tầng
- Hiện tại: **18 triệu/tháng**.
- Sau scale: **27 triệu/tháng** (tăng 9 triệu), đã nằm trong ngân sách Q4 đã duyệt.

## Rủi ro
- Lắp đặt đợt 1 (40 xe) trùng tuần team building 28–29/11: Sơn trực từ xa.
- Phụ thuộc firmware T1 1.5 ổn định khi OTA hàng loạt.

## Phân công
- Bảo: tách Redis, lịch on-call.
- Sơn: MQTT 2 node, cảnh báo FleetPro.
- Hải: time-series GPS, script load test.
- Vinh: rà truy vấn RetailOS cho tải Phú Thịnh.
`;

const MINHCHAU_EXPANSION = `# Đề xuất mở rộng RetailOS cho 4 siêu thị mới — Minh Châu 2027

Người soạn: Nguyễn Văn Đạt (Account Executive) · Duyệt: Cao Thị Lan Anh · Ngày: 12/11/2026 · Gửi: anh Phát (Giám đốc vận hành Minh Châu)

## Bối cảnh
Minh Châu đã chạy RetailOS toàn chuỗi 12 siêu thị từ 28/10/2026. Tuần đầu: 41.380 đơn, uptime 99,93%. Minh Châu dự kiến mở thêm 4 siêu thị trong năm 2027.

## Phạm vi
| Siêu thị mới | Dự kiến khai trương | Số quầy POS |
|---|---|---|
| Minh Châu Biên Hòa | 03/2027 | 6 |
| Minh Châu Long An | 05/2027 | 4 |
| Minh Châu Thủ Đức 2 | 07/2027 | 6 |
| Minh Châu Củ Chi | 10/2027 | 4 |

## Chi phí (chưa VAT)
- Triển khai: **85 triệu/siêu thị** (cài đặt, cấu hình, đào tạo thu ngân 2 buổi) → 340 triệu cho 4 siêu thị.
- Phí thuê bao: theo đơn giá hợp đồng hiện hành, tính từ tháng khai trương.
- Ưu đãi khách hàng hiện hữu: giảm **10%** phí triển khai nếu ký trước 31/12/2026.

## Lợi ích
- Cùng một hệ thống tồn kho và khuyến mãi cho 16 siêu thị.
- Báo cáo ca xuất Excel (phát hành 19/11/2026) dùng ngay cho siêu thị mới.

## Bước tiếp theo
1. Gửi đề xuất cho anh Phát trước 16/11.
2. Họp với anh Phát và chị Thảo trong tuần 23/11.
`;

const DRIVER_TRAINING = `# Kế hoạch đào tạo tài xế — FleetPro × Sao Đỏ, đợt lắp 1

Người soạn: Phan Thị Thu Trang (BA) · Ngày: 13/11/2026 · Khách hàng: Vận tải Sao Đỏ (anh Tài — Giám đốc Vận tải)

## Phạm vi
- Đợt lắp 1: **40 xe**, lắp từ **01/12/2026**. Có **52 tài xế** (12 xe chạy 2 tài).
- App tài xế **v1.0** phát hành 16/11/2026; firmware T1 1.5 cập nhật OTA.

## Lịch đào tạo
| Buổi | Ngày | Giờ | Địa điểm | Số tài xế | Phụ trách |
|---|---|---|---|---|---|
| 1 | 26/11 | 08:00–10:00 | Bãi xe Sao Đỏ Bình Chánh | 26 | Trang, Trí |
| 2 | 27/11 | 08:00–10:00 | Bãi xe Sao Đỏ Bình Chánh | 26 | Trang, Nam |
| Bù | 30/11 | 14:00–15:00 | Gọi video | Vắng buổi 1–2 | Trí |

## Nội dung (120 phút)
1. Cài app, đăng nhập bằng số điện thoại (15 phút).
2. Nhận chuyến, xác nhận giao hàng bằng ảnh (30 phút).
3. Chấm công tự động, khi mất mạng thì app lưu tạm và gửi lại (20 phút).
4. Cảnh báo lệch tuyến: ý nghĩa và cách phản hồi điều phối (20 phút).
5. Thực hành trên xe thật (35 phút).

## Tài liệu
- Video hướng dẫn 4 phút (Uyên quay 20/11).
- Thẻ hướng dẫn in A6 dán trong cabin.

## Tiêu chí hoàn thành
- 100% tài xế đăng nhập được trước 01/12.
- Tỉ lệ xác nhận giao hàng bằng ảnh tuần đầu ≥ 90% (pilot đạt 96%).
`;

const SPRINT14 = `# Báo cáo giữa Sprint 14 — RetailOS

Người soạn: Nguyễn Kim Minh · Ngày: 13/11/2026 · Sprint 14: 10/11 → 20/11

## Tiến độ
- Cam kết: **43 điểm** (sprint 13 đạt 41). Đã xong: **24 điểm** (56%) sau 4/9 ngày làm việc.

| Hạng mục | Phụ trách | Trạng thái |
|---|---|---|
| Báo cáo ca xuất Excel | Tùng, Vinh | Bản đầu đã demo cho chị Thảo 12/11; thêm cột chênh lệch tiền mặt; phát hành **19/11** |
| Khuyến mãi theo giờ | Hân, Phước | 80%; còn kiểm thử trên POS |
| Bố cục POS 10 inch | Duyên, Phước | Đã chốt tại workshop 11/11; đang làm |
| Test hồi quy in 58mm | Thịnh | Xong, chạy trên 3 máy in thật |
| Dashboard Redis | Bảo | Xong; cảnh báo 80% về kênh on-call |
| Danh sách yêu cầu Phú Thịnh | Nhung | Xong, gửi Đạt 12/11 |

## Rủi ro
- Tách Redis theo kế hoạch scale (hạn 25/11) có thể chiếm 2 ngày của Bảo.
- Chị Thảo xin xuất nhiều siêu thị trong một file: đưa vào sprint 15 nếu không kịp.

## Chỉ số vận hành Minh Châu (tuần 04–10/11)
- 39.870 đơn, uptime 99,98%, 0 sự cố P1.
`;

// ---------------------------------------------------------------- spreadsheets

function shiftReport() {
  const shifts = [
    ['Ca sáng (06:00–14:00)', 'Nguyễn Thị Lệ', 352, 21_400_000, 22_900_000, 14_800_000, 41_000],
    ['Ca chiều (14:00–22:00)', 'Trần Văn Phúc', 441, 27_900_000, 30_600_000, 19_100_000, -12_000],
    ['Ca đêm (22:00–06:00)', 'Lê Thị Mai', 58, 4_200_000, 2_600_000, 1_300_000, 0],
  ];
  const total = shifts.reduce((s, r) => [s[0] + r[2], s[1] + r[3], s[2] + r[4], s[3] + r[5], s[4] + r[6]], [0, 0, 0, 0, 0]);
  return [
    { name: 'Báo cáo ca 11-11', widths: [24, 18, 10, 16, 16, 16, 16, 16], rows: [
      ['Siêu thị: Minh Châu Gò Vấp · Ngày: 11/11/2026 · Bản mẫu v0.1 (xuất từ RetailOS)'],
      ['Ca', 'Thu ngân trưởng', 'Số đơn', 'Tiền mặt (đ)', 'VietQR (đ)', 'Thẻ (đ)', 'Tổng (đ)', 'Chênh lệch két (đ)'],
      ...shifts.map((r) => [r[0], r[1], r[2], r[3], r[4], r[5], r[3] + r[4] + r[5], r[6]]),
      ['TỔNG', '', total[0], total[1], total[2], total[3], total[1] + total[2] + total[3], total[4]],
    ] },
    { name: 'Theo quầy', widths: [10, 10, 14, 10], rows: [
      ['Quầy', 'Số đơn', 'Doanh thu (đ)', 'Đổi trả'],
      ['POS-01', 152, 25_900_000, 2], ['POS-02', 149, 25_400_000, 1], ['POS-03', 146, 24_900_000, 0],
      ['POS-04', 141, 24_000_000, 3], ['POS-05', 138, 23_500_000, 1], ['POS-06', 125, 21_100_000, 0],
    ] },
    { name: 'Góp ý chị Thảo', widths: [6, 70, 14], rows: [
      ['#', 'Góp ý (demo 12/11)', 'Trạng thái'],
      [1, 'Thêm cột chênh lệch két tiền mặt theo ca', 'Đã làm'],
      [2, 'Xuất nhiều siêu thị trong một file, mỗi siêu thị một sheet', 'Sprint 15'],
      [3, 'Tên file theo mẫu BaoCaoCa_<SieuThi>_<Ngay>.xlsx', 'Đã làm'],
    ] },
  ];
}

function teamBuildingBudget() {
  const rows = [
    ['Xe 45 chỗ khứ hồi TP.HCM – Phan Thiết', 1, 9_000_000],
    ['Khách sạn 14 phòng × 1 đêm (28/11)', 14, 1_250_000],
    ['Ăn uống 27 người (3 bữa)', 27, 650_000],
    ['Gala dinner tối 28/11', 1, 12_000_000],
    ['Hoạt động team building trên biển', 1, 8_000_000],
    ['Bảo hiểm du lịch', 27, 40_000],
    ['Dự phòng', 1, 2_870_000],
  ].map(([item, qty, price]) => [item, qty, price, qty * price]);
  const total = rows.reduce((s, r) => s + r[3], 0);
  return [
    { name: 'Dự toán', widths: [44, 10, 16, 18], rows: [
      ['Hạng mục', 'Số lượng', 'Đơn giá (đ)', 'Thành tiền (đ)'], ...rows, ['TỔNG', '', '', total],
    ] },
    { name: 'Đăng ký', widths: [26, 14, 30], rows: [
      ['Chỉ số (13/11/2026)', 'Giá trị', 'Ghi chú'],
      ['Nhân sự hiện tại', 30, 'Không tính người đã nghỉ việc'],
      ['Đã đăng ký đi', 27, 'Hạn đăng ký 13/11'],
      ['Không đi', 3, 'Thương, Sơn (trực lắp đặt), Linh (việc gia đình)'],
      ['Tạm ứng cọc khách sạn', 30_000_000, 'Giang chi 12/11'],
    ] },
  ];
}

function buildW46Files() {
  return {
    ai_guide: mdEntry('Huong-dan-tro-ly-AI-Lumi.md', AI_GUIDE),
    dd_checklist: docEntry('Danh-sach-tai-lieu-DD-Saigon-Seed-Partners.docx', DD_CHECKLIST, 'Due diligence Saigon Seed Partners'),
    scale_plan: docEntry('Ke-hoach-scale-ha-tang-2027.docx', SCALE_PLAN, 'Kế hoạch scale hạ tầng 2027'),
    minhchau_expansion: docEntry('De-xuat-mo-rong-4-sieu-thi-Minh-Chau-2027.docx', MINHCHAU_EXPANSION, 'Đề xuất mở rộng Minh Châu 2027'),
    driver_training: docEntry('Ke-hoach-dao-tao-tai-xe-Sao-Do-dot-1.docx', DRIVER_TRAINING, 'Đào tạo tài xế Sao Đỏ đợt 1'),
    sprint14_report: mdEntry('Bao-cao-giua-Sprint-14-RetailOS.md', SPRINT14),
    shift_report: sheetEntry('BaoCaoCa_MinhChauGoVap_11-11-2026.xlsx', shiftReport()),
    tb_budget: sheetEntry('Du-toan-team-building-Phan-Thiet.xlsx', teamBuildingBudget()),
  };
}

module.exports = { buildW46Files };
