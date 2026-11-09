// Chapter week 46 (11/11 evening → Fri 13/11 demo day) for Lumen Software: messages appended
// to EXISTING conversations, same DSL as chapter-nov.js. Facts follow STORY-W46.md.
// Lines later than the moment the seed runs are dropped (index.js withChapter).
// DEV-ONLY seed data.

const t = (at, from, text, o = {}) => ({ at, from, text, ...o });
const f = (at, from, file, o = {}) => ({ at, from, type: 'file', file, ...o });
const a = (at, text, trace) => ({ at, from: 'ai', type: 'ai', text, ...(trace ? { trace } : {}) });
const tr = (input, result) => ({ tool: 'search_knowledge_base', input, result });
const rem = (input, result = 'reminder created') => ({ tool: 'create_reminder', input, result });

const CHAPTER_W46 = {
  ann: [
    t('2026-11-11T15:40', 'ngan', 'Hướng dẫn nhanh dùng trợ lý AI Lumi, mọi người lưu lại nhé. Góp ý gửi mình trong #tech-sync 🙌', { react: { '🙏': ['khang', 'dung', 'oanh', 'han'], '👍': ['minh', 'huy', 'lananh'] } }),
    f('2026-11-11T15:41', 'ngan', 'ai_guide', { pin: true }),
    t('2026-11-12T08:40', 'khang', 'Ngày đầu Lumi: 24 người đã dùng, 163 câu hỏi. Hỏi nhiều nhất là nghỉ phép, OKR Q4 và lịch team building. Cảm ơn Ngân và Tuấn 👏', { react: { '🔥': ['ngan', 'tuan', 'dung', 'minh', 'huy'], '👏': ['oanh', 'ha', 'uyen', 'han'] } }),
    t('2026-11-12T17:45', 'oanh', 'Chào mừng anh Lương Quốc Việt đã nhận lời về FleetPro (Backend Go), ngày làm đầu tiên 01/12 🎉', { react: { '🎉': ['huy', 'hai', 'tri', 'dung', 'khang', 'trang', 'khoi'] } }),
    t('2026-11-13T07:45', 'dung', 'Chào buổi sáng. Hôm nay: 10:30 BGĐ gặp Mekong Angel Network, 14:30 họp toàn công ty tổng kết tuần 46 (cả công ty vào nhé). Hạn đăng ký team building là hôm nay.', { pin: true, react: { '👍': ['minh', 'huy', 'lananh', 'oanh', 'ha'] } }),
    t('2026-11-13T12:05', 'hang', 'Chốt danh sách team building: 27/30 người đi Phan Thiết. Xe đón tại văn phòng 06:00 ngày 28/11 🚌', { react: { '🏖️': ['han', 'duyen', 'tung', 'uyen', 'nam', 'tri'], '👍': ['oanh', 'dung'] } }),
  ],

  retail: [
    t('2026-11-11T17:40', 'duyen', 'Workshop 10 inch chốt bố cục B: nút đổi trả lên thanh dưới cùng. Mai mình bắt đầu làm.', { react: { '👍': ['minh', 'phuoc', 'han'] } }),
    t('2026-11-12T09:10', 'tung', 'Bản đầu báo cáo ca Excel chạy trên số liệu thật Gò Vấp 11/11, 15:30 demo chị Thảo.'),
    f('2026-11-12T09:11', 'tung', 'shift_report'),
    t('2026-11-12T16:20', 'minh', 'Demo Excel cho chị Thảo ổn, 3 góp ý đã ghi trong file. Phát hành 19/11 cho cả 12 siêu thị 🎯', { react: { '🎉': ['tung', 'vinh', 'nhung', 'khang'] } }),
    t('2026-11-12T18:05', 'bao', 'Tuần 04–10/11 Minh Châu: 39.870 đơn, uptime 99,98%, không có P1 👌', { react: { '🔥': ['minh', 'vinh', 'tuan', 'khang'] } }),
    t('2026-11-13T08:20', 'minh', 'Stand-up 08:30, 11:30 rà giữa sprint (anh Khang dự). Chiều 14:30 họp toàn công ty.'),
    t('2026-11-13T12:10', 'phuoc', 'Đạt gửi model máy quét Phú Thịnh rồi: Honeywell 1450g. Thứ Ba mình báo kết quả tích hợp.', { mention: ['dat'] }),
  ],

  fleet: [
    t('2026-11-11T17:30', 'huy', 'Báo cáo pilot chiều nay anh Tài rất hài lòng, đặc biệt là 96% chuyến xác nhận bằng ảnh. Cảm ơn Trang, Trí, Hải, Ngọc 👏', { react: { '🙏': ['trang', 'tri', 'hai', 'ngoc'] } }),
    t('2026-11-12T10:40', 'tri', 'App tài xế RC2 đã sửa lỗi chấm công khi mất mạng, Nam test giúp nhé.', { mention: ['nam'] }),
    t('2026-11-12T15:05', 'khoi', 'Đã đặt 136 thiết bị T1 (130 xe + 6 dự phòng), nhà cung cấp giao 24/11.', { react: { '👍': ['huy', 'trang'] } }),
    t('2026-11-13T13:20', 'trang', 'Kế hoạch đào tạo tài xế đợt 1, 13:30 mình chốt.'),
    f('2026-11-13T13:21', 'trang', 'driver_training', { pin: true }),
  ],

  bod: [
    t('2026-11-11T18:30', 'khang', 'Demo SSP chiều nay: chị Vy muốn làm due diligence, term sheet dự kiến trước 30/11 🙏', { react: { '🔥': ['dung', 'tuan'] } }),
    t('2026-11-12T09:30', 'khang', 'Chị Vy vừa gửi danh sách tài liệu DD, hạn nộp đợt 1 là 20/11. Chiều thứ Sáu 15:45 mình phân công.'),
    f('2026-11-12T09:31', 'khang', 'dd_checklist', { pin: true }),
    t('2026-11-12T09:40', 'dung', 'Phần pháp lý em nhận. Thỏa thuận sở hữu trí tuệ còn thiếu vài bạn kỹ thuật.'),
    t('2026-11-12T11:05', 'khang', 'Đã chốt gặp Mekong Angel Network online 10:30 thứ Sáu, anh Quân (Managing Partner). Tuấn vào cùng anh nhé.', { mention: ['tuan'] }),
    t('2026-11-12T17:20', 'tuan', 'Kế hoạch scale hạ tầng 2027 em gửi anh, dùng luôn cho phần kỹ thuật của DD.'),
    f('2026-11-12T17:21', 'tuan', 'scale_plan'),
    t('2026-11-13T11:24', 'khang', 'Mekong tích cực: có thể đồng đầu tư 2–3 tỷ nếu SSP dẫn vòng. Họ xin thêm số liệu giữ chân khách hàng.', { react: { '🎉': ['dung', 'tuan'] } }),
  ],

  sales: [
    t('2026-11-12T10:15', 'dat', 'Đề xuất mở rộng 4 siêu thị Minh Châu 2027 bản nháp, chị Lan Anh duyệt giúp em trước khi gửi anh Phát.', { mention: ['lananh'] }),
    f('2026-11-12T10:16', 'dat', 'minhchau_expansion'),
    t('2026-11-12T11:00', 'lananh', 'Ok em, sửa phần ưu đãi: giảm 10% phí triển khai nếu ký trước 31/12. Gửi anh Phát trước 16/11.'),
    t('2026-11-12T16:40', 'dat', 'Nhung gửi danh sách yêu cầu Phú Thịnh rồi, điểm lớn là tích hợp máy quét Honeywell họ đang dùng.'),
    t('2026-11-13T09:20', 'thuong', 'Bách Hóa Đồng Nai hẹn demo RetailOS ngày 24/11, em đặt lịch trong PON rồi nhé chị.', { mention: ['lananh'], react: { '🔥': ['lananh', 'khang'] } }),
  ],

  hr: [
    t('2026-11-12T11:20', 'oanh', 'Phỏng vấn Tô Bảo Châu sáng nay: Duyên 4,5, Minh 4. Em đề xuất offer, bắt đầu 07/12. Anh Dũng duyệt giúp em.', { mention: ['dung'] }),
    t('2026-11-12T11:45', 'dung', 'Anh duyệt. Gửi offer trong hôm nay nhé.', { react: { '👍': ['oanh'] } }),
    t('2026-11-12T17:30', 'oanh', 'Anh Việt đã nhận offer, ngày làm đầu 01/12. Hằng chuẩn bị máy và tài khoản PON giúp chị.', { mention: ['hang'] }),
    t('2026-11-13T09:25', 'hang', 'Dự toán team building bản cuối, 09:30 họp chốt.'),
    f('2026-11-13T09:26', 'hang', 'tb_budget'),
  ],

  'x-hr-fleet': [
    t('2026-11-12T09:15', 'huy', 'Anh Dũng đã duyệt offer anh Việt. Oanh gửi trong sáng nay nhé.', { mention: ['oanh'] }),
    t('2026-11-12T17:35', 'oanh', 'Anh Việt nhận offer rồi, đi làm 01/12 🎉 Ứng viên thứ hai em hẹn vòng 2 ngày 18/11.', { react: { '🎉': ['huy', 'hai', 'tuan'] } }),
    t('2026-11-12T17:50', 'hai', 'Tuần đầu anh Việt mình kèm phần MQTT và time-series GPS nhé.'),
  ],

  'x-tech-sync': [
    t('2026-11-11T18:00', 'tuan', 'Họp rà kiến trúc scale dời sang 14:00 mai 12/11 vì hôm nay kín lịch.'),
    t('2026-11-12T13:50', 'tuan', '14:00 họp scale, mọi người xem trước bảng quyết định nhé.'),
    t('2026-11-12T15:10', 'bao', 'Chốt: Redis tách 2 cluster trước 25/11, MQTT 2 node trước 28/11, load test 540 xe trước 27/11.', { pin: true, react: { '👍': ['son', 'hai', 'vinh', 'tuan'] } }),
    t('2026-11-13T10:10', 'son', 'MQTT node 2 đã chạy trên staging, failover thử 3 lần đều giữ được phiên.', { react: { '🔥': ['tuan', 'bao', 'hai'] } }),
  ],

  mkt: [
    t('2026-11-12T10:00', 'ha', 'Webinar 20/11 đã có 186 đăng ký 🎉 Mục tiêu 250, tuần sau mình đẩy thêm bài LinkedIn.', { react: { '🔥': ['uyen', 'lananh', 'khang'] } }),
    t('2026-11-12T16:30', 'uyen', 'Bài blog "Lumen ra mắt trợ lý AI nội bộ" xong bản nháp, chị Hà và anh Khang xem giúp em.', { mention: ['ha', 'khang'] }),
  ],

  fin: [
    t('2026-11-12T14:15', 'giang', 'Đã tạm ứng 30 triệu cọc khách sạn team building. Dự toán tổng 68 triệu.', { react: { '👍': ['dung'] } }),
    t('2026-11-13T11:40', 'giang', 'Em làm số liệu giữ chân khách hàng cho Mekong và dự phóng 2027 cho SSP, xong trước 18/11.', { mention: ['khang'] }),
  ],

  lunch: [
    t('2026-11-12T11:30', 'tri', 'Trưa nay cơm tấm đầu hẻm nhé, ai đi? 🍚'),
    t('2026-11-12T11:32', 'han', 'Đi! Cho mình thêm trứng 😆', { react: { '😂': ['duyen', 'tri'] } }),
    t('2026-11-13T11:45', 'duyen', 'Thứ Sáu ăn lẩu Thái không mọi người? Ăn sớm để 14:30 họp toàn công ty.', { react: { '👍': ['han', 'tung', 'uyen', 'linh', 'nam'] } }),
  ],

  'dm-khang-minh': [
    t('2026-11-11T18:15', 'khang', 'Câu hỏi của quỹ em ghi rất tốt, anh gửi chị Vy rồi. Cảm ơn em.', { react: { '🙏': ['minh'] } }),
    t('2026-11-13T09:05', 'minh', 'Anh ơi, báo cáo giữa Sprint 14 em gửi anh. 11:30 em trình bày chi tiết.'),
    f('2026-11-13T09:06', 'minh', 'sprint14_report'),
    t('2026-11-13T09:20', 'khang', 'Anh đọc rồi, 24/43 điểm là đúng nhịp. Chiều 16:45 mình 1-1 nhé.'),
  ],

  'dm-khang-dung': [
    t('2026-11-12T08:10', 'dung', 'Anh, offer Tô Bảo Châu em sẽ duyệt nếu Minh và Duyên đồng ý sau phỏng vấn sáng nay.'),
    t('2026-11-13T07:50', 'dung', 'Anh nhớ 10:30 Mekong, 14:30 họp toàn công ty, 15:45 BGĐ phân công DD.', { react: { '👍': ['khang'] } }),
  ],

  'dm-lananh-dat': [
    t('2026-11-12T18:10', 'lananh', 'Đề xuất Minh Châu sửa ổn rồi, thứ Hai em gửi anh Phát nhé.', { react: { '👍': ['dat'] } }),
  ],

  'dm-huy-tri': [
    t('2026-11-13T08:40', 'huy', 'Trí, buổi đào tạo tài xế em chuẩn bị phần app, 20 phút demo trên điện thoại tài xế.'),
    t('2026-11-13T08:42', 'tri', 'Dạ anh, em mượn 2 máy Samsung J7 để demo giống máy tài xế.'),
  ],

  'dm-khang-ai': [
    t('2026-11-12T08:20', 'khang', 'Hôm qua chị Vy hỏi những gì trong buổi demo SSP? Tóm tắt giúp mình.'),
    a('2026-11-12T08:20', 'Theo biên bản **Demo sản phẩm — Saigon Seed Partners (11/11)**, chị Vy quan tâm:\n\n- **Uptime và sự cố:** uptime 99,93% tuần đầu, sự cố P1 29/10 xử lý trong 22 phút\n- **Doanh thu FleetPro** sau PL-02 (≈ 947 triệu năm đầu)\n- **Runway 9 tháng** và kế hoạch dùng vốn 8 tỷ\n\nBước tiếp theo: SSP làm due diligence, term sheet dự kiến trước 30/11.', tr('câu hỏi chị Vy demo SSP', 'biên bản Demo sản phẩm — Saigon Seed Partners')),
    t('2026-11-12T08:30', 'khang', 'Nhắc mình 10:15 thứ Sáu mở phòng họp Mekong và 15:30 chuẩn bị họp BGĐ phân công DD.'),
    a('2026-11-12T08:30', 'Đã tạo 2 nhắc nhở cho thứ Sáu (13/11):\n\n- **10:15** Mở phòng họp gặp Mekong Angel Network\n- **15:30** Chuẩn bị họp BGĐ phân công due diligence ⏰', rem('2 nhắc nhở ngày 13/11', '2 reminders created')),
    t('2026-11-13T07:40', 'khang', 'Hôm nay có lịch gì quan trọng?'),
    a('2026-11-13T07:40', 'Lịch hôm nay (13/11) của bạn:\n\n- 10:30 **Gặp Mekong Angel Network** (anh Quân, online) — bạn là host\n- 11:30 Rà soát giữa Sprint 14 — RetailOS\n- 14:30 **Họp toàn công ty — Tổng kết tuần 46** — bạn là host\n- 15:45 BGĐ — due diligence & term sheet\n- 16:45 1-1 với Minh\n\nBạn có 2 nhắc nhở hôm nay. Hạn nộp tài liệu DD cho SSP là 20/11.', { tool: 'list_calendar', input: 'ngày 13/11', result: '5 cuộc họp' }),
    t('2026-11-13T07:50', 'khang', 'Nếu anh Quân hỏi Lumen dùng vốn seed vào đâu thì trả lời thế nào?'),
    a('2026-11-13T07:50', 'Theo **Lumen Seed Memo v3**, vốn seed 8 tỷ dùng cho:\n\n1. **Sản phẩm & kỹ thuật:** mở rộng đội FleetPro và hạ tầng cho 180 xe trở lên\n2. **Bán hàng:** ký khách thứ ba (Phú Thịnh, Bách Hóa Đồng Nai, Logistics An Phát)\n3. **Kéo dài runway** từ 9 tháng lên khoảng 24 tháng\n\nGợi ý: nhấn mạnh hai khách trả tiền và go-live Minh Châu đã chạy thật.', tr('sử dụng vốn seed', '2 đoạn từ Lumen-Seed-Memo-v3.docx')),
  ],

  'dm-minh-ai': [
    t('2026-11-12T15:00', 'minh', 'Chị Thảo hay hỏi gì về báo cáo ca? Cho mình 3 câu để chuẩn bị.'),
    a('2026-11-12T15:00', 'Dựa trên biên bản **Đánh giá tuần đầu go-live** và các trao đổi với Minh Châu, chị Thảo có thể hỏi:\n\n1. Có **đối soát tiền mặt theo ca** được không (chênh lệch két)?\n2. Xuất báo cáo có **ảnh hưởng tốc độ POS** không?\n3. Có xuất **nhiều siêu thị trong một file** không?\n\nGợi ý: câu 2 trả lời bằng việc báo cáo chạy trên bản sao đọc.', tr('báo cáo ca chị Thảo', 'biên bản Đánh giá tuần đầu go-live — Minh Châu')),
    t('2026-11-13T11:22', 'minh', 'Tóm tắt Sprint 14 trong 3 dòng để mình mở đầu buổi rà soát.'),
    a('2026-11-13T11:22', '**Sprint 14 giữa kỳ (13/11):**\n\n1. Đã xong **24/43 điểm (56%)** sau 4/9 ngày, đúng nhịp.\n2. Báo cáo ca Excel phát hành **19/11**; khuyến mãi theo giờ **80%**.\n3. Rủi ro: tách Redis chiếm ~2 ngày của Bảo; tích hợp máy quét Phú Thịnh cần chốt sớm.', tr('Sprint 14 tiến độ', '1 đoạn từ Bao-cao-giua-Sprint-14-RetailOS.md')),
  ],

  'dm-tri-ai': [
    t('2026-11-13T08:50', 'tri', 'Buổi đào tạo tài xế có bao nhiêu người, ngày nào?'),
    a('2026-11-13T08:50', 'Theo **Kế hoạch đào tạo tài xế đợt 1** (bản nháp của Trang): **52 tài xế** cho 40 xe đợt lắp 01/12, chia 2 buổi **26/11 và 27/11** (08:00–10:00) tại bãi xe Sao Đỏ Bình Chánh, buổi bù gọi video 30/11. Phần app của bạn khoảng 30 phút (nhận chuyến, xác nhận giao hàng bằng ảnh).', tr('đào tạo tài xế đợt 1', '1 đoạn từ #fleetpro')),
  ],
};

const REMINDERS_W46 = [
  { user: 'khang', conv: 'dm-khang-ai', text: 'Mở phòng họp gặp Mekong Angel Network', at: '2026-11-13T10:15' },
  { user: 'khang', conv: 'dm-khang-ai', text: 'Chuẩn bị họp BGĐ phân công due diligence', at: '2026-11-13T15:30' },
  { user: 'khang', conv: 'dm-khang-ai', text: 'Gọi chị Vy về ESOP', at: '2026-11-16T09:30' },
  { user: 'khang', conv: 'dm-khang-ai', text: 'Gửi tài liệu due diligence đợt 1 cho chị Vy', at: '2026-11-20T10:00' },
  { user: 'giang', conv: 'fin', text: 'Gửi Mekong số liệu giữ chân khách hàng', at: '2026-11-18T09:00' },
  { user: 'dat', conv: 'sales', text: 'Gửi đề xuất mở rộng 4 siêu thị cho anh Phát', at: '2026-11-16T09:00' },
  { user: 'trang', conv: 'fleet', text: 'Gửi kế hoạch đào tạo tài xế cho anh Tài', at: '2026-11-13T16:00' },
  { user: 'hang', conv: 'hr', text: 'Chốt xe đi Phan Thiết', at: '2026-11-20T09:00' },
  { user: 'tri', conv: 'dm-tri-ai', text: 'Phát hành app tài xế v1.0', at: '2026-11-16T08:00' },
];

module.exports = { CHAPTER_W46, REMINDERS_W46 };
