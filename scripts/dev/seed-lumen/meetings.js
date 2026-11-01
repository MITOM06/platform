// Meetings (Phòng họp) for Lumen: ended ones with attendance, shared notes and
// in-meeting chat; scheduled ones in the demo week.
//
//   start      minutes before "now" (negative = in the future)
//   duration   minutes (ended meetings)
//   attended   person keys who joined (ended meetings); host joins first
//   notes      shared notes (markdown) — ended meetings
//   chat       [{from, text, atMin}] in-meeting chat, atMin = minutes after start

const H = 60;
const D = 24 * H;

const MEETINGS = [
  {
    key: 'kickoff-fleet', title: 'Kickoff dự án FleetPro', description: 'Khởi động dự án với Vận tải Sao Đỏ: phạm vi pilot, thiết bị, mốc thời gian.',
    host: 'huy', cohosts: ['tuan'], invitees: ['khang', 'tuan', 'hai', 'khoi', 'trang', 'tri', 'ngoc', 'son'], dept: 'fleet',
    start: 167 * D, duration: 75, attended: ['huy', 'khang', 'tuan', 'hai', 'khoi', 'trang', 'tri', 'ngoc'],
    notes: '# Kickoff FleetPro — 12/05/2026\n\n**Chốt:** pilot 50 xe từ 01/09, tuyến TP.HCM–Cần Thơ. App tài xế phải chạy Android 9.\n\n**Việc:**\n- Khôi: 10 mẫu T1 trước 15/06\n- Hải: ingest MQTT + TimescaleDB trước 30/06\n- Trí: app tài xế alpha trước 31/07\n- Trang: yêu cầu chi tiết + danh sách 50 xe trước 25/05',
    chat: [{ from: 'trang', text: 'Em gửi link form danh sách xe cho anh Tài rồi ạ.', atMin: 40 }, { from: 'khoi', text: 'Module 4G Cat-1 giá tốt hơn Cat-4 nhiều, em chọn Cat-1 nhé.', atMin: 52 }, { from: 'huy', text: 'Ok, chốt Cat-1.', atMin: 53 }],
  },
  {
    key: 'retro-retail-11', title: 'Retro Sprint 11 — RetailOS', description: 'Nhìn lại sprint 11: pilot Gò Vấp, lỗi POS offline.',
    host: 'minh', cohosts: [], invitees: ['nhung', 'vinh', 'tung', 'han', 'phuoc', 'duyen', 'thinh', 'bao', 'ngan'], dept: 'retail',
    start: 15 * D + 2 * H, duration: 50, attended: ['minh', 'nhung', 'vinh', 'tung', 'han', 'phuoc', 'thinh', 'bao'],
    notes: '# Retro Sprint 11\n\n**Tốt:** pilot Gò Vấp chạy ổn 3 tuần, thanh toán VietQR trung bình 1,4 giây.\n\n**Chưa tốt:** POS offline tạo đơn trùng khi mất mạng lúc đang thanh toán (POS_031 chưa chặn hết). Build Android chậm 12 phút.\n\n**Hành động:** Phước sửa idempotency theo X-Offline-Id (RETAIL-342); Bảo bật cache Gradle trên CI.',
    chat: [{ from: 'thinh', text: 'Case trùng đơn em tái hiện được 3/10 lần khi rút mạng đúng lúc bấm thanh toán.', atMin: 12 }, { from: 'phuoc', text: 'Đã rõ, lỗi ở retry phía client, mai em có PR.', atMin: 14 }],
  },
  {
    key: 'bgd-thang-10', title: 'Họp Ban Giám đốc tháng 10', description: 'Kết quả Q3, ngân sách Q4, chuẩn bị go-live Minh Châu.',
    host: 'khang', cohosts: ['dung'], invitees: ['dung', 'tuan', 'giang'], dept: 'bod',
    start: 3 * D + 6 * H, duration: 58, attended: ['khang', 'dung', 'tuan', 'giang'],
    notes: '# BGĐ tháng 10 — 23/10/2026\n\n- Doanh thu Q3: 1,52 tỷ, vượt kế hoạch 9%.\n- Go-live Minh Châu 28/10: Minh báo UAT xong 20/10, còn 2 lỗi P2 đã có fix.\n- Ngân sách Q4: tuyển 2 backend FleetPro + 1 designer (Oanh mở JD tuần này).\n- Gọi vốn seed: Khang gặp 2 quỹ trong tháng 11; Giang chuẩn bị số liệu 6 tháng.\n- Dũng rà soát lại chính sách WFH sau phản hồi phòng FleetPro.',
    chat: [{ from: 'giang', text: 'Số liệu 6 tháng em gửi anh Khang trước 5/11 ạ.', atMin: 31 }],
  },
  {
    key: 'sprint-review-12', title: 'Sprint review 12 — RetailOS', description: 'Demo UAT toàn chuỗi, kế hoạch go-live.',
    host: 'minh', cohosts: ['nhung'], invitees: ['khang', 'tuan', 'nhung', 'vinh', 'tung', 'han', 'phuoc', 'duyen', 'thinh', 'bao', 'ngan', 'lananh'], dept: 'retail',
    start: 6 * D + 3 * H, duration: 62, attended: ['minh', 'khang', 'nhung', 'vinh', 'tung', 'han', 'phuoc', 'thinh', 'bao', 'ngan', 'lananh'],
    notes: '# Sprint review 12 — 20/10/2026\n\n**Demo:** UAT 12 siêu thị pass 118/120 case. 2 case P2: in hóa đơn khổ 58mm lệch lề (Phước), báo cáo tồn kho theo ca chậm 6 giây (Vinh).\n\n**Go-live 28/10:** cài POS theo đợt 6+6 siêu thị trong 2 ngày 26–27/10. Minh + Bảo trực tại Minh Châu Gò Vấp ngày 28/10. Hotline P1: Minh.\n\n**Khách:** chị Thảo (IT Minh Châu) yêu cầu tài liệu vận hành bản in trước 27/10 — Nhung phụ trách.',
    chat: [{ from: 'lananh', text: 'Anh Phát bên Minh Châu rất hài lòng phần dashboard, sẽ giới thiệu thêm 1 chuỗi ở Đồng Nai.', atMin: 44 }, { from: 'khang', text: 'Tuyệt. Lan Anh lên lịch gặp họ tuần sau nhé.', atMin: 45 }],
  },
  // --- upcoming
  {
    key: 'golive-minhchau', title: 'Demo go-live RetailOS — Minh Châu', description: 'Trình diễn hệ thống trước khi bật toàn chuỗi; đầu mối Minh Châu tham dự qua link.',
    host: 'minh', cohosts: ['khang'], invitees: ['khang', 'tuan', 'nhung', 'vinh', 'phuoc', 'bao', 'lananh', 'dat'], dept: 'retail',
    start: -(D + 5 * H), duration: 60,
  },
  {
    key: 'giao-ban', title: 'Giao ban tuần — trưởng phòng', description: 'Cập nhật tiến độ RetailOS, FleetPro, pipeline kinh doanh.',
    host: 'khang', cohosts: ['dung'], invitees: ['dung', 'tuan', 'minh', 'huy', 'lananh', 'ha', 'oanh', 'giang'], dept: 'bod',
    start: -(2 * D + 3 * H), duration: 45,
  },
  {
    key: 'fleet-fw', title: 'Review firmware T1 1.5 + app tài xế v0.9', description: 'Chốt phạm vi bản mở rộng 180 xe.',
    host: 'huy', cohosts: [], invitees: ['tuan', 'tri', 'hai', 'khoi', 'trang', 'nam', 'son'], dept: 'fleet',
    start: -(3 * D + 8 * H), duration: 60,
  },
];

module.exports = { MEETINGS };
