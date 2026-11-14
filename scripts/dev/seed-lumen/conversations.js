// Conversation scripts for Lumen Software — six months of work chat.
//
// Message DSL (index.js turns these into `messages` documents):
//   from     person key | 'ai' | 'system'
//   text     content (system: a `system.*` code)
//   ago      minutes before "now"; omitted = previous ago - 2..5
//   type     text (default) | ai | system | file | image | meeting_summary
//   file     key into files.js (type file/image)
//   id/reply labels for replies · react {emoji:[keys]} · mention [keys]
//   pin/edited/recalled · trace (ai tool call)
// Conversation: kb [file keys] = documents registered in this chat's knowledge
// base without a message (kbBy = who added them).

const H = 60;
const D = 24 * H;
const meeting = (o) => JSON.stringify(o);
const ai = (text, ago, trace) => ({ from: 'ai', type: 'ai', text, ago, ...(trace ? { trace } : {}) });

const CONVERSATIONS = [
  // ------------------------------------------------------------ company-wide
  {
    key: 'ann', type: 'group', name: '📢 Thông báo chung Lumen', members: 'ALL', publicChannel: true,
    admins: ['khang', 'dung', 'oanh'], createdBy: 'khang', start: 194 * D, unread: 2,
    messages: [
      { from: 'system', type: 'system', text: 'system.group.created', ago: 194 * D },
      { from: 'khang', text: 'Chào cả nhà, Lumen chính thức bắt đầu từ hôm nay 14/04! Kênh này dùng cho thông báo chính thức. Hai dự án đầu tiên: RetailOS cho Minh Châu và FleetPro cho Sao Đỏ. Cùng làm thật, nói thẳng, giao đúng hạn nhé 💪', ago: 194 * D - 10, react: { '🎉': ['dung', 'tuan', 'minh', 'huy', 'lananh', 'oanh', 'ha'], '❤️': ['nhung', 'trang', 'duyen'] } },
      { from: 'oanh', text: 'HR gửi mọi người Sổ tay nhân viên 2026. Đọc kỹ phần nghỉ phép, WFH và bảo mật. File đã nạp vào trợ lý AI, cứ hỏi @AI khi cần.', ago: 180 * D },
      { from: 'oanh', type: 'file', file: 'handbook', ago: 180 * D - 1, id: 'handbook', pin: true },
      { from: 'khang', text: 'Tin vui: đã ký hợp đồng RetailOS với chuỗi siêu thị Minh Châu, 12 siêu thị, 3 năm. Cảm ơn team Kinh doanh và phòng RetailOS! 🥂', ago: 118 * D, react: { '🔥': ['minh', 'lananh', 'dat', 'tuan', 'vinh', 'han'], '👏': ['dung', 'huy', 'oanh', 'giang'] } },
      { from: 'dung', text: 'Nhắc lại chính sách WFH: tối đa 2 ngày/tuần, đăng ký trên kênh phòng ban trước 17:00 hôm trước. Core hours 10:00–16:00 bắt buộc online.', ago: 95 * D, pin: true, react: { '👍': ['vinh', 'tung', 'hai', 'tri', 'nam'] } },
      { from: 'dung', text: 'Sơ đồ tổ chức và danh mục dự án bản cập nhật tháng 10: 7 phòng ban, ai phụ trách gì, dự án nào đang chạy. Đã nạp KB, người mới cứ hỏi @AI “phòng X có ai / dự án Y ai làm”.', ago: 30 * D },
      { from: 'dung', type: 'file', file: 'orgChart', ago: 30 * D - 1, pin: true },
      { from: 'han', text: '@AI theo sổ tay thì phép năm chưa dùng hết có mất không?', ago: 60 * D, mention: ['ai'] },
      ai('Theo **Sổ tay nhân viên Lumen 2026** (mục 3 – Nghỉ phép):\n\n- Mỗi nhân viên có **12 ngày phép năm**, tính theo tỷ lệ từ ngày vào làm.\n- Phép chưa dùng **được chuyển sang quý 1 năm sau, tối đa 5 ngày**.\n\nNguồn: So-tay-nhan-vien-Lumen-2026.md', 60 * D, { tool: 'search_knowledge_base', input: 'phép năm chưa dùng', result: '2 đoạn từ So-tay-nhan-vien-Lumen-2026.md' }),
      { from: 'huy', text: 'FleetPro chính thức chạy pilot 50 xe Sao Đỏ từ hôm nay. Tuần đầu tiên anh em on-call theo lịch trên kênh phòng.', ago: 55 * D, react: { '🚚': ['tri', 'hai', 'khoi', 'khang'], '👏': ['minh', 'lananh'] } },
      { from: 'minh', text: 'RetailOS pilot tại Minh Châu Gò Vấp đã lên từ sáng nay. Ca đầu tiên bán 212 đơn, không sự cố 🙌', ago: 41 * D, react: { '🔥': ['khang', 'dung', 'tuan', 'lananh', 'huy', 'phuoc', 'vinh'] } },
      { from: 'khang', text: 'Kết quả Q3: doanh thu 1,52 tỷ, vượt kế hoạch 9%. Thưởng dự án sẽ chi cùng lương tháng 10. Cảm ơn tất cả mọi người! 👏', ago: 4 * D, react: { '🔥': ['minh', 'huy', 'lananh', 'giang', 'tuan', 'dung', 'tri'], '👏': ['oanh', 'ha', 'uyen', 'nhung', 'trang'] } },
      { from: 'khang', type: 'image', file: 'revenueChart', ago: 4 * D - 1 },
      { from: 'oanh', text: 'Team building cuối năm: Vũng Tàu 5–6/12. Điền form đăng ký phòng trước thứ 6 tuần này nhé 🏖️', ago: 26 * H, react: { '😍': ['duyen', 'uyen', 'hang', 'linh'] } },
      { from: 'dung', text: 'Thứ 4 28/10 là ngày go-live Minh Châu. Phòng RetailOS được ưu tiên, các phòng khác hạn chế đặt họp với team RetailOS trong ngày đó.', ago: 3 * H, pin: true },
    ],
  },

  // -------------------------------------------------------------- RetailOS
  {
    key: 'retail', type: 'group', name: '#retailos', dept: 'retail',
    members: ['minh', 'nhung', 'vinh', 'tung', 'han', 'phuoc', 'duyen', 'thinh', 'bao', 'ngan', 'tuan', 'khang'],
    admins: ['minh', 'tuan'], createdBy: 'minh', start: 190 * D, unread: 3,
    persona: { name: 'Lumi Retail', tone: 'technical', prefix: 'Bạn là trợ lý kỹ thuật của phòng RetailOS tại Lumen Software. Trả lời ngắn, có code mẫu khi cần, dựa trên đặc tả RetailOS và API POS trong knowledge base.' },
    messages: [
      { from: 'system', type: 'system', text: 'system.group.created', ago: 190 * D },
      { from: 'minh', text: 'Đặc tả hệ thống v1.3 đã chốt với Minh Châu. Mình upload ở đây và nạp vào KB của nhóm, ai cần tra cứu cứ hỏi @AI.', ago: 150 * D },
      { from: 'minh', type: 'file', file: 'retailSpec', ago: 150 * D - 1, pin: true },
      { from: 'vinh', text: 'API POS v2 mình viết xong, Phước và Hân xem rồi góp ý nhé.', ago: 120 * D },
      { from: 'vinh', type: 'file', file: 'retailApi', ago: 120 * D - 1, id: 'api', pin: true },
      { from: 'phuoc', text: 'Anh Vinh ơi, đơn offline mình gửi lại khi có mạng thì chống trùng kiểu gì?', ago: 118 * D, reply: 'api', id: 'q-offline' },
      { from: 'vinh', text: 'Gửi kèm header X-Offline-Id, server bỏ qua nếu đã có. Mình ghi ở mục Đơn hàng rồi.', ago: 118 * D - 8, reply: 'q-offline' },
      { from: 'duyen', text: 'Màn hình POS bản v2 đây, mình đổi bảng màu theo nhận diện Minh Châu. Mọi người xem trước khi Phước code nhé.', ago: 80 * D },
      { from: 'duyen', type: 'image', file: 'posScreen', ago: 80 * D - 1, react: { '😍': ['minh', 'han', 'nhung'], '👍': ['phuoc', 'khang'] } },
      { from: 'thinh', text: '@AI POS trả về mã lỗi POS_022 nghĩa là gì?', ago: 45 * D, mention: ['ai'] },
      ai('Theo **RetailOS — API POS v2** (mục Mã lỗi): **POS_022 = mã QR đã hết hạn**. QR VietQR chỉ có hiệu lực **300 giây**, POS cần tạo QR mới rồi thanh toán lại.\n\nNguồn: RetailOS-API-POS-v2.md', 45 * D, { tool: 'search_knowledge_base', input: 'POS_022', result: '1 đoạn từ RetailOS-API-POS-v2.md' }),
      { from: 'bao', text: 'CI Android đã bật cache Gradle, build từ 12 phút xuống 4 phút.', ago: 14 * D, react: { '🚀': ['phuoc', 'minh', 'thinh'] } },
      { from: 'phuoc', text: 'PR RETAIL-342 (idempotency đơn offline) đã merge, Thịnh test lại giúp mình case rút mạng lúc thanh toán.', ago: 13 * D, id: 'pr342' },
      { from: 'thinh', text: 'Test 20 lần không còn trùng đơn. Đóng ticket nhé 👍', ago: 12 * D, reply: 'pr342' },
      { from: 'nhung', text: 'UAT toàn chuỗi 20/10: pass 118/120 case. 2 case P2 còn lại mình gửi trong Jira.', ago: 6 * D, react: { '👏': ['khang', 'tuan', 'minh'] } },
      { from: 'system', type: 'system', text: 'system.call.ended:video:3720', ago: 6 * D + 2 * H },
      { from: 'minh', text: 'Kế hoạch go-live 28/10: cài POS đợt 1 (6 siêu thị) ngày 26, đợt 2 ngày 27. Mình và Bảo trực tại Gò Vấp. Hotline P1 gọi mình.', ago: 2 * D, pin: true },
      { from: 'vinh', text: 'Báo cáo tồn kho theo ca đã tối ưu, từ 6 giây xuống 1,2 giây. Deploy staging rồi.', ago: 20 * H },
      { from: 'phuoc', text: 'Hóa đơn 58mm đã căn lại lề, in thử ở Gò Vấp ok.', ago: 6 * H },
      { from: 'khang', text: 'Tốt lắm team. Ngày mai demo go-live với Minh Châu lúc 14:00, Minh chuẩn bị kịch bản 15 phút nhé.', ago: 4 * H, react: { '👍': ['minh', 'nhung'] } },
    ],
  },

  // -------------------------------------------------------------- FleetPro
  {
    key: 'fleet', type: 'group', name: '#fleetpro', dept: 'fleet',
    members: ['huy', 'tri', 'hai', 'trang', 'khoi', 'linh', 'nam', 'ngoc', 'son', 'tuan', 'khang'],
    admins: ['huy', 'tuan'], createdBy: 'huy', start: 170 * D, unread: 2,
    persona: { name: 'Lumi Fleet', tone: 'technical', prefix: 'Bạn là trợ lý kỹ thuật của phòng FleetPro tại Lumen Software. Trả lời ngắn, chính xác theo đặc tả FleetPro và giao thức thiết bị Lumen-T1 trong knowledge base.' },
    messages: [
      { from: 'system', type: 'system', text: 'system.group.created', ago: 170 * D },
      { from: 'huy', text: 'Biên bản kickoff với Sao Đỏ hôm nay, mọi người đọc phần việc của mình.', ago: 167 * D },
      { from: 'huy', type: 'file', file: 'kickoff', ago: 167 * D - 1, pin: true },
      { from: 'trang', text: 'Đặc tả v1.1 đã cập nhật theo yêu cầu cảnh báo lệch tuyến của anh Tài.', ago: 140 * D },
      { from: 'trang', type: 'file', file: 'fleetSpec', ago: 140 * D - 1, pin: true },
      { from: 'khoi', text: 'Mẫu thử T1 rev C số 7: test 72 giờ 0 reboot, mất sóng 2 giờ gửi bù đủ 720 bản tin ✅', ago: 100 * D },
      { from: 'khoi', type: 'image', file: 'gpsBoard', ago: 100 * D - 1, react: { '🔥': ['huy', 'hai', 'tuan', 'tri'] } },
      { from: 'khoi', text: 'Giao thức thiết bị bản chính thức, nạp KB luôn.', ago: 99 * D },
      { from: 'khoi', type: 'file', file: 'gpsProto', ago: 99 * D - 1, pin: true },
      { from: 'tri', text: 'App tài xế alpha: nhận chuyến + chấm công xong, chạy được trên Samsung J7 Android 9. Bản build gửi anh Huy test.', ago: 86 * D, react: { '👏': ['huy', 'trang', 'khang'] } },
      { from: 'hai', text: 'Sự cố sáng nay: 6 xe mất tín hiệu 40 phút do broker MQTT đầy connection. Đã tăng limit, Sơn thêm alert.', ago: 50 * D, id: 'incident' },
      { from: 'son', text: 'Alert connection > 80% đã lên Grafana.', ago: 50 * D - 30, reply: 'incident' },
      { from: 'nam', text: '@AI thiết bị mất sóng thì lưu đệm được bao lâu?', ago: 30 * D, mention: ['ai'] },
      ai('Theo **Giao thức thiết bị Lumen-T1** (mục Chu kỳ): khi mất sóng thiết bị **lưu đệm tối đa 2 giờ (720 bản tin)** và gửi bù theo thứ tự cũ → mới khi có mạng. Lưu ý firmware 1.4.1 từng gửi bù sai thứ tự khi đệm đầy, đã sửa ở **1.4.2**.\n\nNguồn: FleetPro-Giao-thuc-thiet-bi-Lumen-T1.md', 30 * D, { tool: 'search_knowledge_base', input: 'mất sóng lưu đệm', result: '2 đoạn từ FleetPro-Giao-thuc-thiet-bi-Lumen-T1.md' }),
      { from: 'ngoc', text: 'Thuật toán tối ưu lộ trình bản 2 giảm quãng đường trung bình 11% trên dữ liệu 3 tuần pilot.', ago: 10 * D, react: { '🚀': ['huy', 'tuan', 'khang', 'hai'] } },
      { from: 'linh', text: 'Dashboard điều phối hôm nay, 47/50 xe online.', ago: 9 * H },
      { from: 'linh', type: 'image', file: 'fleetDash', ago: 9 * H - 1 },
      { from: 'huy', text: 'Thứ 4 review firmware 1.5 và app tài xế v0.9 để chốt phạm vi mở rộng 180 xe. Trí chuẩn bị demo phần xác nhận giao hàng bằng ảnh nhé.', ago: 5 * H, mention: ['tri'] },
      { from: 'tri', text: 'Dạ anh, em có bản build sẵn rồi.', ago: 5 * H - 4 },
    ],
  },

  // -------------------------------------------------------------- BGĐ
  {
    key: 'bod', type: 'group', name: 'Ban Giám đốc', dept: 'bod',
    members: ['khang', 'dung', 'tuan'], admins: ['khang'], createdBy: 'khang', start: 192 * D,
    messages: [
      { from: 'khang', text: 'Báo cáo doanh thu Q3 từ Giang, mình nạp vào KB nhóm để hỏi nhanh khi cần.', ago: 5 * D },
      { from: 'khang', type: 'file', file: 'revenueCsv', ago: 5 * D - 1, pin: true },
      { from: 'khang', text: 'Họp BGĐ tháng 10 sáng mai (thứ 6) 9:00, gọi video nhé.', ago: 4 * D },
      { from: 'system', type: 'system', text: 'system.call.ended:video:3480', ago: 3 * D + 8 * H + 30 - 58 },
      { from: 'ai', type: 'meeting_summary', ago: 3 * D + 8 * H + 30 - 59, text: meeting({
        attendees: ['Trần Phúc Khang', 'Nguyễn Hoàng Dũng', 'Hoàng Anh Tuấn', 'Nguyễn Thị Hương Giang'], durationSec: 3480,
        overview: 'Họp BGĐ tháng 10: chốt kết quả Q3 (1,52 tỷ, +9%), kế hoạch go-live Minh Châu 28/10, ngân sách tuyển dụng Q4 và chuẩn bị gọi vốn seed.',
        keyPoints: ['Doanh thu Q3 1,52 tỷ, vượt kế hoạch 9%', 'UAT Minh Châu pass 118/120, còn 2 lỗi P2 đã có fix', 'Tuyển 2 backend FleetPro + 1 designer trong Q4', 'Gặp 2 quỹ đầu tư trong tháng 11'],
        actionItems: ['Oanh: mở JD 3 vị trí trong tuần', 'Giang: số liệu 6 tháng trước 5/11', 'Dũng: rà lại chính sách WFH theo phản hồi FleetPro', 'Khang: lịch gặp quỹ'],
      }) },
      { from: 'dung', text: 'JD 3 vị trí Oanh đã đăng, có 14 hồ sơ sau 2 ngày.', ago: D },
      { from: 'tuan', text: 'Mai đi Gò Vấp cùng Minh buổi chiều, anh em cần gì nhắn mình.', ago: 6 * H },
    ],
  },

  // -------------------------------------------------------------- Kinh doanh
  {
    key: 'sales', type: 'group', name: '#kinh-doanh', dept: 'sales',
    members: ['lananh', 'dat', 'thuong', 'khang', 'dung'], admins: ['lananh'], createdBy: 'lananh', start: 185 * D, unread: 1,
    messages: [
      { from: 'lananh', text: 'Bảng giá 2026 bản chốt, dùng thống nhất khi báo giá. Đã nạp KB.', ago: 160 * D },
      { from: 'lananh', type: 'file', file: 'pricing', ago: 160 * D - 1, pin: true },
      { from: 'dat', text: 'Minh Châu đã ký! Hợp đồng bản scan ở đây.', ago: 118 * D - 30, react: { '🎉': ['lananh', 'thuong', 'khang'] } },
      { from: 'dat', type: 'file', file: 'contract', ago: 118 * D - 31, pin: true },
      { from: 'thuong', text: '@AI phí triển khai RetailOS mỗi cửa hàng là bao nhiêu?', ago: 20 * D, mention: ['ai'] },
      ai('Theo **Bảng giá Lumen Software 2026** (mục Phí triển khai): RetailOS **25.000.000đ/cửa hàng**, gồm khảo sát, cài đặt và đào tạo 2 buổi.\n\nNguồn: Bang-gia-Lumen-2026.md', 20 * D, { tool: 'search_knowledge_base', input: 'phí triển khai RetailOS', result: '1 đoạn từ Bang-gia-Lumen-2026.md' }),
      { from: 'thuong', text: 'Tạp hóa Xanh (2 cửa hàng) đã lên gói Starter từ tháng 9, hợp đồng nhỏ nhưng là khách thứ 3 🙂', ago: 15 * D },
      { from: 'lananh', text: 'Pipeline Q4: chuỗi Bách Hóa Đồng Nai (8 cửa hàng, giới thiệu từ anh Phát Minh Châu) và Vận tải Hòa Bình (60 xe). Đạt theo Đồng Nai, Thương theo Hòa Bình.', ago: 2 * D, pin: true },
      { from: 'dat', text: 'Đồng Nai hẹn gặp thứ 5 tuần sau, họ muốn xem demo dashboard chuỗi.', ago: 7 * H },
    ],
  },

  // -------------------------------------------------------------- Nhân sự
  {
    key: 'hr', type: 'group', name: '#nhan-su', dept: 'hr',
    members: ['oanh', 'hang', 'dung'], admins: ['oanh'], createdBy: 'oanh', start: 185 * D,
    messages: [
      { from: 'oanh', text: 'Quy trình onboarding bản cập nhật, Hằng dùng cho các bạn mới tháng 11.', ago: 30 * D },
      { from: 'oanh', type: 'file', file: 'onboarding', ago: 30 * D - 1, pin: true },
      { from: 'hang', text: 'Em đã gửi lời mời PON cho 2 ứng viên nhận offer (backend FleetPro, designer RetailOS).', ago: 2 * D },
      { from: 'dung', text: 'Ok. Nhớ nhắc các bạn bật 2FA ngay lần đăng nhập đầu.', ago: 2 * D - 15 },
    ],
  },

  // -------------------------------------------------------------- cross-dept
  // -------------------------------------------------------------- Marketing
  {
    key: 'mkt', type: 'group', name: '#marketing', dept: 'mkt',
    members: ['ha', 'uyen', 'hau', 'tmember', 'khang', 'lananh'], admins: ['ha'], createdBy: 'ha', start: 175 * D, unread: 1,
    messages: [
      { from: 'system', type: 'system', text: 'system.group.created', ago: 175 * D },
      { from: 'ha', text: 'Kênh của phòng Marketing. Lịch nội dung, số liệu kênh và tài liệu thương hiệu để ở đây. Kế hoạch Q4 mình nạp vào KB, hỏi @AI khi cần.', ago: 175 * D - 2, pin: true },
      { from: 'ha', type: 'file', file: 'mktPlan', ago: 33 * D, pin: true },
      { from: 'uyen', text: 'Bài case study RetailOS × Minh Châu bản nháp 2 xong rồi chị, chờ anh Phát duyệt trích dẫn.', ago: 9 * D, id: 'cs' },
      { from: 'ha', text: 'Ok em. Có duyệt thì đăng ngay sau go-live, đừng đăng trước 28/10.', ago: 9 * D - 6, reply: 'cs' },
      { from: 'hau', text: 'Chạy thử quảng cáo LinkedIn nhắm chủ chuỗi bán lẻ: 3 ngày, CPC 9.800đ, 6 lead điền form.', ago: 4 * D, react: { '🔥': ['ha', 'lananh'] } },
      { from: 'lananh', text: '6 lead đó Kinh doanh nhận nhé, Đạt gọi trong tuần.', ago: 4 * D - 20 },
      { from: 'ha', text: '@AI ngân sách quảng cáo Q4 còn bao nhiêu sau đợt LinkedIn?', ago: 3 * D, mention: ['ai'] },
      ai('Theo **Ke-hoach-Marketing-Q4-2026.md**: ngân sách quảng cáo Q4 là **60 triệu**, đã chi **18 triệu** (Facebook 12 triệu, LinkedIn 6 triệu) → **còn 42 triệu**. Kế hoạch giữ 25 triệu cho Vietnam Retail Expo tháng 12.\n\nNguồn: Ke-hoach-Marketing-Q4-2026.md', 3 * D, { tool: 'search_knowledge_base', input: 'ngân sách quảng cáo Q4 còn lại', result: '1 đoạn từ Ke-hoach-Marketing-Q4-2026.md' }),
      { from: 'uyen', text: 'Ảnh chụp tại Gò Vấp hôm go-live em xin phép chụp quầy thu ngân, đã hỏi chị Thảo bên Minh Châu.', ago: 5 * H },
    ],
  },

  // -------------------------------------------------------------- Kế toán
  {
    key: 'fin', type: 'group', name: '#ke-toan', dept: 'fin',
    members: ['giang', 'phongne', 'dung', 'khang'], admins: ['giang'], createdBy: 'giang', start: 180 * D,
    messages: [
      { from: 'system', type: 'system', text: 'system.group.created', ago: 180 * D },
      { from: 'giang', text: 'Kênh Kế toán: chứng từ, thanh toán, lương và thuế. Quy chế chi tiêu mình nạp KB, các phòng hỏi @AI trước khi hỏi mình nhé.', ago: 180 * D - 3, pin: true },
      { from: 'giang', type: 'file', file: 'finPolicy', ago: 120 * D, pin: true },
      { from: 'dung', text: 'Chi phí thiết bị T1 cho đợt mở rộng 180 xe ghi vào giá vốn dự án FleetPro hay tài sản công ty?', ago: 12 * D, id: 'capex' },
      { from: 'giang', text: 'Thiết bị lắp cho khách, khách trả tiền theo hợp đồng → giá vốn dự án FleetPro. Thiết bị mẫu ở lab mới ghi tài sản.', ago: 12 * D - 25, reply: 'capex' },
      { from: 'phongne', text: 'Đối chiếu công nợ Q3 xong: Minh Châu đã thanh toán đủ đợt 2, Sao Đỏ còn 95 triệu chưa đến hạn.', ago: 6 * D },
      { from: 'giang', text: 'Chốt chi phí tháng 10 ngày 25 đã xong, lương trả ngày 5/11 như thường lệ.', ago: 23 * H, react: { '👍': ['dung', 'khang'] } },
    ],
  },

  {
    key: 'minhchau', type: 'group', name: 'Dự án Minh Châu — go-live',
    members: ['minh', 'nhung', 'bao', 'phuoc', 'lananh', 'dat', 'khang', 'tuan'], admins: ['minh', 'lananh'], createdBy: 'minh', start: 10 * D, unread: 2,
    messages: [
      { from: 'minh', text: 'Nhóm phối hợp go-live. Kinh doanh lo liên hệ với từng siêu thị, kỹ thuật lo cài đặt.', ago: 10 * D },
      { from: 'lananh', text: 'Danh sách đầu mối 12 siêu thị mình gửi Nhung qua mail rồi.', ago: 9 * D },
      { from: 'nhung', text: 'Tài liệu vận hành bản in cho chị Thảo đã xong, 40 trang, in 15 bộ.', ago: 2 * D },
      { from: 'bao', text: 'Đợt 1 cài xong 6 siêu thị: Gò Vấp, Tân Bình, Bình Thạnh, Thủ Đức, Dĩ An, Thuận An. POS đều online.', ago: 8 * H, react: { '👏': ['minh', 'khang', 'lananh', 'dat'] } },
      { from: 'minh', text: 'Mai 14:00 demo go-live, link phòng họp mình gửi trong lịch. Chị Thảo và anh Phát tham dự.', ago: 3 * H },
    ],
  },

  // -------------------------------------------------------------- social
  {
    key: 'lunch', type: 'group', name: 'Hội ăn trưa 🍜',
    members: ['han', 'duyen', 'tung', 'tri', 'linh', 'uyen', 'hang', 'nam', 'minh'], admins: ['han'], createdBy: 'han', start: 100 * D, mutedFor: ['minh'], unread: 3,
    messages: [
      { from: 'han', text: 'Trưa nay ăn gì mọi người?', ago: 6 * H + 15 },
      { from: 'tung', text: 'Cơm tấm Phúc Lộc Thọ!', ago: 6 * H + 13, react: { '😋': ['duyen', 'nam'] } },
      { from: 'tri', text: 'Bún bò đi, hôm qua cơm tấm rồi 😂', ago: 6 * H + 11 },
      { from: 'uyen', text: 'Mình đặt trà sữa, ai lấy thì reply nha 🧋', ago: 2 * H },
      { from: 'linh', text: '1 trà sữa ít đường!', ago: 2 * H - 1 },
      { from: 'hang', text: '+1 ít đá', ago: 2 * H - 2 },
    ],
  },

  // ------------------------------------------------ cross-department groups
  {
    key: 'x-sales-retail', type: 'group', name: 'Gia hạn & mở rộng Minh Châu', members: ['lananh', 'dat', 'bien', 'minh', 'nhung', 'khang', 'giang'],
    admins: ['lananh', 'minh'], createdBy: 'lananh', start: 21 * D, unread: 2,
    messages: [
      { from: 'system', type: 'system', text: 'system.group.created', ago: 21 * D },
      { from: 'lananh', text: 'Mở nhóm này để Kinh doanh và RetailOS làm chung phần gia hạn Minh Châu. Anh Phát muốn ký thêm 3 siêu thị mới ở Bình Dương ngay sau go-live, cần phòng RetailOS ước lượng công sức trước thứ 6.', ago: 21 * D - 5 },
      { from: 'minh', text: 'Nhận. 3 siêu thị mới dùng chung cấu hình với đợt 1, mình tính mỗi điểm 2 ngày cài POS + 1 ngày đào tạo. Tổng khoảng 9 ngày công, Nhung làm bảng chi tiết nhé.', ago: 21 * D - 60, id: 'uoc' },
      { from: 'nhung', text: 'Bảng ước lượng đây: cài đặt 6 ngày, đào tạo 3 ngày, dự phòng 2 ngày. Phần tích hợp cân điện tử ở Bình Dương là hãng khác, cần thêm 3 ngày dev của anh Vinh.', ago: 20 * D, reply: 'uoc', react: { '👍': ['lananh', 'minh'] } },
      { from: 'dat', text: 'Bên Minh Châu hỏi giá triển khai mỗi điểm có giữ như hợp đồng cũ không. Em định báo giữ nguyên nhưng tính thêm phần cân điện tử.', ago: 19 * D, id: 'gia' },
      { from: 'lananh', text: '@AI theo chính sách chiết khấu thì Account Executive được giảm tối đa bao nhiêu phần trăm?', ago: 19 * D - 30, mention: ['ai'] },
      ai('Theo **Chính sách chiết khấu** của phòng Kinh doanh: Sales Executive tối đa **5%**, Account Executive tối đa **10%**, Trưởng phòng Kinh doanh **15%**. Trên 15% cần CEO duyệt; hợp đồng trên 500 triệu phải có luật sư review.', 19 * D - 29),
      { from: 'lananh', text: 'Vậy Đạt giữ giá, tối đa giảm 10% cho phần cài đặt nếu họ ký đủ 3 điểm. Phần cân điện tử tính riêng theo ngày công của RetailOS.', ago: 19 * D - 20, reply: 'gia' },
      { from: 'bien', text: 'Em đã gửi anh Phát bản chào giá sơ bộ qua email, hẹn họp 5/11 tại văn phòng Minh Châu. Anh Minh đi cùng em để trả lời phần kỹ thuật nhé.', ago: 12 * D, react: { '👍': ['minh', 'lananh'] } },
      { from: 'giang', text: 'Kế toán nhắc: hợp đồng gia hạn nếu trên 500 triệu thì gửi mình bản nháp trước 3 ngày để chuẩn bị hóa đơn và điều khoản thanh toán.', ago: 10 * D },
      { from: 'khang', text: 'Ưu tiên chốt được 3 điểm Bình Dương trong tháng 11. Lan Anh tổng hợp rủi ro (nhân sự RetailOS đang bận go-live) để mình trình bày ở giao ban tuần.', ago: 5 * D, pin: true, react: { '👍': ['lananh', 'minh', 'dat'] } },
      { from: 'lananh', text: 'Cập nhật: Minh Châu đồng ý về nguyên tắc 3 điểm Bình Dương, chờ bản hợp đồng. Mình đưa vào pipeline Q4.', ago: 30 * H },
    ],
  },
  {
    key: 'x-mkt-fleet', type: 'group', name: 'Case study FleetPro × Sao Đỏ', members: ['ha', 'uyen', 'hau', 'huy', 'trang', 'tri', 'lananh'],
    admins: ['ha', 'huy'], createdBy: 'ha', start: 18 * D, unread: 1,
    messages: [
      { from: 'system', type: 'system', text: 'system.group.created', ago: 18 * D },
      { from: 'ha', text: 'Marketing muốn làm case study FleetPro với Sao Đỏ để chạy chiến dịch Q4. Phòng FleetPro cho mình vài con số thật của đợt pilot được không?', ago: 18 * D - 10 },
      { from: 'huy', text: 'Được, nhưng số liệu khách hàng phải được anh Tài bên Sao Đỏ duyệt trước khi đăng. Trang gom giúp anh: số xe pilot, tỉ lệ bản tin đúng hạn, số cảnh báo lệch tuyến.', ago: 18 * D - 40 },
      { from: 'trang', text: 'Pilot 50 xe từ 1/9. Bản tin GPS đúng hạn 99,2%, cảnh báo lệch tuyến trung bình 14 lần/ngày, thời gian điều phối giảm từ 25 phút xuống 9 phút mỗi chuyến.', ago: 17 * D, id: 'so', react: { '🔥': ['ha', 'uyen', 'hau'] } },
      { from: 'uyen', text: 'Số "25 phút xuống 9 phút" rất mạnh, mình lấy làm tiêu đề. Bản nháp bài viết mình gửi trong 2 ngày.', ago: 17 * D - 15, reply: 'so' },
      { from: 'hau', text: 'Mình chạy thử quảng cáo LinkedIn nhắm vào doanh nghiệp vận tải miền Nam, ngân sách 15 triệu cho 2 tuần. Cần 1 ảnh dashboard thật.', ago: 15 * D },
      { from: 'tri', text: 'Ảnh app tài xế và dashboard mình chụp từ bản demo, không có tên tài xế thật. Gửi Hậu qua chat riêng nhé.', ago: 15 * D - 20, react: { '👍': ['hau'] } },
      { from: 'huy', text: '@AI SLA dữ liệu GPS của FleetPro cam kết với khách là bao nhiêu?', ago: 14 * D, mention: ['ai'] },
      ai('Theo **Stack & SLA FleetPro**: thiết bị gửi **1 bản tin/10 giây/xe** qua MQTT; dữ liệu lên dashboard **trong vòng 30 giây**, độ sẵn sàng **99,5%/tháng**. Khi mất sóng thiết bị Lumen-T1 lưu đệm tối đa 2 giờ rồi gửi bù.', 14 * D - 1),
      { from: 'ha', text: 'Bài viết nháp đã xong, anh Huy và Trang review phần kỹ thuật trước khi mình gửi anh Tài duyệt.', ago: 9 * D },
      { from: 'lananh', text: 'Kinh doanh xin kèm form liên hệ cuối bài để lấy lead. Mình sẽ nhận và lọc trước.', ago: 8 * D },
      { from: 'huy', text: 'Anh Tài đã duyệt số liệu, chỉ yêu cầu bỏ tên tuyến cụ thể. Marketing đăng được rồi.', ago: 3 * D, pin: true, react: { '🎉': ['ha', 'uyen', 'hau', 'trang'] } },
    ],
  },
  {
    key: 'x-fin-leads', type: 'group', name: 'Chốt chi phí Q3 & ngân sách Q4', members: ['giang', 'dung', 'minh', 'huy', 'lananh', 'ha', 'oanh', 'phongne'],
    admins: ['giang', 'dung'], createdBy: 'giang', start: 40 * D, unread: 1,
    messages: [
      { from: 'system', type: 'system', text: 'system.group.created', ago: 40 * D },
      { from: 'giang', text: 'Chào các trưởng phòng, nhóm này dùng để chốt chi phí hằng quý. Q3 chốt ngày 25/10: hóa đơn đầu vào gửi mình trước 28/10, ai thiếu thì chi phí dồn sang Q4.', ago: 40 * D - 5, pin: true },
      { from: 'minh', text: 'RetailOS: chi phí cloud Minh Châu tháng 9 là 18,4 triệu, thiết bị POS đợt 1 là 96 triệu. Hóa đơn mình đã gửi email kế toán.', ago: 32 * D },
      { from: 'huy', text: 'FleetPro: 50 thiết bị Lumen-T1 là 127 triệu, SIM 4G 3 tháng 9 triệu. Hóa đơn SIM còn thiếu 1 tờ, mình đòi nhà mạng.', ago: 31 * D },
      { from: 'ha', text: 'Marketing: sự kiện Vietnam Retail Tech 12 triệu, quảng cáo 8 triệu. Đủ hóa đơn.', ago: 30 * D },
      { from: 'oanh', text: 'Nhân sự: phí tuyển dụng 6 triệu, team building tạm ứng 40 triệu sẽ quyết toán tháng 12.', ago: 29 * D },
      { from: 'dung', text: '@AI theo lịch chốt sổ thì hóa đơn đầu vào phải gửi kế toán trước ngày mấy?', ago: 26 * D, mention: ['ai'] },
      ai('Theo **Lịch chốt sổ** của Kế toán: chốt chi phí **ngày 25 hằng tháng**, hóa đơn đầu vào gửi kế toán **trước ngày 28**, trả lương ngày 5. Báo cáo thuế quý nộp trước ngày 30 tháng đầu quý sau.', 26 * D - 1),
      { from: 'giang', text: 'Tổng chi phí Q3 đã khớp 316,4 triệu. Biên lợi nhuận gộp Q3 đạt 48%, cao hơn mục tiêu. Số chi tiết mình gửi Ban Giám đốc.', ago: 8 * D, react: { '👏': ['dung', 'minh', 'huy', 'lananh'] } },
      { from: 'phongne', text: 'Kiểm soát nội bộ đã đối chiếu 3 hóa đơn lớn nhất (POS, thiết bị T1, cloud) với hợp đồng, khớp. Đề nghị quý sau các phòng đính kèm hợp đồng ngay khi gửi hóa đơn.', ago: 6 * D },
      { from: 'dung', text: 'Ngân sách Q4: mỗi phòng gửi đề xuất trước 10/11 theo mẫu của Giang. Ưu tiên tuyển dụng FleetPro và mở rộng Minh Châu.', ago: 2 * D, pin: true },
    ],
  },
  {
    key: 'x-hr-fleet', type: 'group', name: 'Tuyển Backend Go — FleetPro', members: ['oanh', 'hang', 'canglong', 'huy', 'hai', 'dung', 'tuan'],
    admins: ['oanh', 'huy'], createdBy: 'oanh', start: 25 * D, unread: 2,
    messages: [
      { from: 'system', type: 'system', text: 'system.group.created', ago: 25 * D },
      { from: 'huy', text: 'FleetPro cần thêm 1 Backend Go (ingest MQTT, TimescaleDB) trước cuối năm. Yêu cầu 2 năm Go, biết MQTT là lợi thế. Hải viết JD giúp anh.', ago: 25 * D - 10 },
      { from: 'hai', text: 'JD đây: Go 1.22+, MQTT/NATS, PostgreSQL hoặc TimescaleDB, có Docker. Mức lương theo khung Middle. Mình đã gửi HR bản Word.', ago: 24 * D, react: { '👍': ['oanh', 'huy'] } },
      { from: 'oanh', text: 'Đã đăng tin trên 2 kênh tuyển dụng từ hôm nay. Hằng theo dõi hồ sơ, mỗi thứ 2 gửi phòng FleetPro danh sách ứng viên mới.', ago: 23 * D },
      { from: 'hang', text: 'Tuần đầu có 11 hồ sơ, lọc còn 4 ứng viên đạt yêu cầu. Lịch phỏng vấn vòng kỹ thuật: thứ 4 và thứ 5 tuần sau, mỗi người 45 phút với anh Huy và anh Hải.', ago: 16 * D, id: 'hoso' },
      { from: 'canglong', text: 'Hành chính đã đặt phòng họp nhỏ cho 4 buổi phỏng vấn và chuẩn bị laptop test code.', ago: 16 * D - 30, reply: 'hoso' },
      { from: 'hang', text: '@AI quy trình onboarding nhân viên mới tuần đầu gồm những gì?', ago: 12 * D, mention: ['ai'] },
      ai('Theo **Quy trình onboarding** của Nhân sự:\n- **Ngày 1:** nhận laptop, tài khoản PON qua lời mời, buddy giới thiệu team.\n- **Tuần 1:** đọc Sổ tay nhân viên, hoàn thành khóa bảo mật nội bộ.\n- **Tháng 1:** 1-1 với trưởng phòng hằng tuần, đánh giá thử việc vào ngày 55.', 12 * D - 1),
      { from: 'huy', text: 'Phỏng vấn xong: chọn ứng viên Lê Minh Đức, 3 năm Go, từng làm hệ thống telematics. Đề xuất mức Middle, thử việc 2 tháng.', ago: 8 * D, react: { '👏': ['oanh', 'hai', 'dung'] } },
      { from: 'dung', text: 'Duyệt. Oanh gửi offer trong tuần, ngày vào làm 17/11. Tuấn chuẩn bị tài khoản GitLab và quyền truy cập repo FleetPro.', ago: 7 * D, pin: true },
      { from: 'tuan', text: 'Đã tạo sẵn nhóm quyền fleet-backend trên GitLab, ngày đầu chỉ cần gắn tài khoản.', ago: 6 * D },
      { from: 'oanh', text: 'Ứng viên đã nhận offer. Hằng gửi lời mời PON cho email công ty của Đức vào ngày 17/11, phòng FleetPro, vai trò Member.', ago: 2 * D, react: { '🎉': ['huy', 'hai', 'hang'] } },
    ],
  },
  {
    key: 'x-tech-sync', type: 'group', name: 'Tech sync RetailOS ↔ FleetPro', members: ['tuan', 'minh', 'huy', 'vinh', 'hai', 'bao', 'son', 'minhgm', 'trigm'],
    admins: ['tuan'], createdBy: 'tuan', start: 60 * D, unread: 3,
    messages: [
      { from: 'system', type: 'system', text: 'system.group.created', ago: 60 * D },
      { from: 'tuan', text: 'Nhóm kỹ thuật chung 2 dự án: hạ tầng, CI, on-call. Họp 30 phút mỗi thứ 3. Vấn đề nóng tuần này: 2 dự án đang dùng chung 1 runner CI nên build xếp hàng.', ago: 60 * D - 5, pin: true },
      { from: 'bao', text: 'RetailOS build Android 4 phút, nhưng khi FleetPro build Go cùng lúc thì chờ thêm 10 phút. Đề xuất thêm 1 runner riêng cho FleetPro.', ago: 59 * D },
      { from: 'son', text: 'Mình dựng runner thứ 2 trên máy chủ cũ, gắn tag fleet. Xong trong tuần.', ago: 58 * D, react: { '👍': ['bao', 'tuan', 'huy'] } },
      { from: 'hai', text: 'Đã tách runner, build FleetPro không còn chờ. Cảm ơn Sơn.', ago: 50 * D },
      { from: 'vinh', text: 'Thư viện log chung (lumen-logging) v1.2 mình vừa phát hành, cả 2 dự án nên nâng để log có trace id thống nhất.', ago: 40 * D, id: 'log' },
      { from: 'hai', text: 'FleetPro nâng rồi, Go module lấy từ GitLab nội bộ ok.', ago: 39 * D, reply: 'log' },
      { from: 'minh', text: '@AI RetailOS triển khai bằng gì và dùng database nào?', ago: 30 * D, mention: ['ai'] },
      ai('Theo **Stack & quy ước RetailOS**: backend **Java 21 Spring Boot** (POS, tồn kho) và **Node.js** (màn hình quảng cáo), web React, POS Android (Kotlin), **PostgreSQL + Redis**, triển khai **Kubernetes** trên hạ tầng Minh Châu.', 30 * D - 1),
      { from: 'minhgm', text: 'Phần tích hợp cân điện tử cho Minh Châu Bình Dương mình đã có SDK của hãng, tuần sau demo nội bộ.', ago: 20 * D },
      { from: 'trigm', text: 'QA mobile: app tài xế bản 0.9 còn lỗi mất kết nối khi chuyển mạng 4G sang Wi-Fi, mình đã log FLEET-218.', ago: 15 * D },
      { from: 'huy', text: 'On-call tuần go-live Minh Châu: RetailOS trực chính, FleetPro hỗ trợ hạ tầng. Lịch trực mình dán ở ghi chú nhóm.', ago: 3 * D, pin: true },
      { from: 'tuan', text: 'Nhắc: thứ 3 tuần sau họp sync bàn chuẩn hóa pipeline CI 2 dự án về 1 template.', ago: 20 * H },
    ],
  },

  // ------------------------------------------------------------ direct
  // ------------------------------------------------------------------- DMs
  {
    key: 'dm-minh-tri', type: 'direct', members: ['minh', 'tri'], start: 60 * D, unread: 1,
    messages: [
      { from: 'minh', text: 'Trí ơi, bên FleetPro xác nhận giao hàng bằng ảnh làm trên Flutter thế nào, cho anh xin cách nén ảnh trước khi upload?', ago: 20 * D },
      { from: 'tri', text: 'Em dùng flutter_image_compress, quality 70, resize về 1280. Ảnh 4MB còn khoảng 300KB anh.', ago: 20 * D - 15, react: { '🙏': ['minh'] } },
      { from: 'minh', text: 'Cảm ơn em, RetailOS cũng cần chụp ảnh kiểm kê.', ago: 20 * D - 20 },
      { from: 'system', type: 'system', text: 'system.call.ended:video:612', ago: 6 * D },
      { from: 'tri', text: 'Anh Minh, chiều mai 14:00 em có demo go-live của anh không? Anh Huy bảo em qua xem học hỏi.', ago: 2 * H },
      { from: 'minh', text: 'Có, em vào link trong lịch nhé. Lát rảnh anh gọi em nói trước phần kịch bản.', ago: 2 * H - 5 },
    ],
  },
  {
    key: 'dm-khang-minh', type: 'direct', members: ['khang', 'minh'], start: 150 * D,
    messages: [
      { from: 'khang', text: 'Minh ơi, UAT pass 118/120 rồi thì 2 case còn lại có chặn go-live không?', ago: 5 * D },
      { from: 'minh', text: 'Không anh, cả 2 là P2 (in hóa đơn 58mm lệch lề, báo cáo tồn chậm). Fix xong trước 26/10.', ago: 5 * D - 12 },
      { from: 'khang', text: 'Ok. Ngày 28 anh với Tuấn qua Gò Vấp buổi sáng.', ago: 5 * D - 14, react: { '👍': ['minh'] } },
      { from: 'minh', text: 'Anh ơi, Minh Châu hỏi mở rộng thêm màn hình quảng cáo ở 4 siêu thị mới năm sau, em báo Lan Anh làm báo giá nhé?', ago: 22 * H },
      { from: 'khang', text: 'Đúng rồi, để Lan Anh. Em tập trung go-live.', ago: 22 * H - 3 },
    ],
  },
  {
    key: 'dm-khang-dung', type: 'direct', members: ['khang', 'dung'], start: 190 * D,
    messages: [
      { from: 'dung', text: 'Anh, phòng FleetPro xin WFH 3 ngày/tuần trong 2 tuần on-call pilot. Em thấy hợp lý, anh duyệt không?', ago: 50 * D },
      { from: 'khang', text: 'Duyệt trong 2 tuần đó thôi, sau quay lại 2 ngày.', ago: 50 * D - 20 },
      { from: 'dung', text: 'Ngân sách tuyển Q4 em chốt: 3 HC, tổng 118 triệu/tháng.', ago: 2 * D },
      { from: 'khang', text: 'Ok, triển khai. Nhớ thêm vào audit cho Giang theo dõi.', ago: 2 * D - 9 },
    ],
  },
  {
    key: 'dm-huy-tri', type: 'direct', members: ['huy', 'tri'], start: 160 * D,
    messages: [
      { from: 'huy', text: 'Trí, anh Tài báo app tài xế bản 0.8 bị văng khi mở camera trên Samsung J7. Em xem gấp nhé.', ago: 12 * D, id: 'crash' },
      { from: 'tri', text: 'Em thấy rồi anh, thiếu quyền CAMERA runtime trên Android 9. Fix trong 0.8.1, 1 tiếng nữa có build.', ago: 12 * D - 25, reply: 'crash' },
      { from: 'huy', text: 'Tốt. Thứ 4 review 0.9 em chuẩn bị demo xác nhận giao hàng bằng ảnh.', ago: 5 * H + 2 },
    ],
  },
  {
    key: 'dm-lananh-dat', type: 'direct', members: ['lananh', 'dat'], start: 100 * D,
    messages: [
      { from: 'dat', text: 'Chị, Bách Hóa Đồng Nai đòi chiết khấu 12% gói Chain.', ago: D },
      { from: 'lananh', text: '12% chị duyệt được (chị tối đa 15%). Trên 15% mới phải xin anh Khang.', ago: D - 10 },
    ],
  },
  {
    key: 'dm-oanh-dung', type: 'direct', members: ['oanh', 'dung'], start: 180 * D,
    messages: [
      { from: 'oanh', text: 'Anh Dũng, 2 bạn mới nhận offer, em gửi lời mời PON hôm nay. Vị trí designer bạn ấy hỏi WFH được mấy ngày.', ago: 2 * D + H },
      { from: 'dung', text: 'Theo chính sách: 2 ngày/tuần sau thử việc. Thử việc thì làm tại văn phòng.', ago: 2 * D + H - 7 },
    ],
  },
  // Message request from someone not yet a friend → "Requests" tab for Khang.
  {
    key: 'dm-uyen-request', type: 'direct', members: ['uyen', 'khang'], createdBy: 'uyen', status: 'pending', start: 6 * H,
    messages: [
      { from: 'uyen', text: 'Chào anh Khang, em Uyên bên Marketing. Em muốn phỏng vấn anh 15 phút cho bài blog "6 tháng đầu của Lumen", anh rảnh lúc nào ạ?', ago: 6 * H },
    ],
  },
  // AI DMs (the assistant knows these people)
  {
    key: 'dm-khang-ai', type: 'direct', members: ['khang', 'ai'], start: 120 * D, kb: ['revenueCsv', 'pricing', 'handbook', 'contract'], kbBy: 'khang',
    messages: [
      { from: 'khang', text: 'Nhắc mình 8:30 sáng thứ 4 qua Minh Châu Gò Vấp cùng Tuấn.', ago: 3 * D },
      ai('Đã tạo nhắc nhở: **Qua Minh Châu Gò Vấp cùng Tuấn** — 8:30 sáng thứ 4 (28/10). Mình sẽ báo bạn đúng giờ. ⏰', 3 * D, { tool: 'create_reminder', input: 'Qua Minh Châu Gò Vấp cùng Tuấn @ thứ 4 8:30', result: 'reminder created' }),
      { from: 'khang', text: 'Tóm tắt giúp mình doanh thu Q3 theo khách hàng.', ago: 2 * D },
      ai('Theo **Bao-cao-doanh-thu-Q3-2026.csv**:\n\n- **Minh Châu (RetailOS):** 1.210 triệu — phí triển khai 2 đợt + pilot Gò Vấp.\n- **Sao Đỏ (FleetPro):** 285 triệu — thiết bị T1 cho 50 xe + pilot tháng 9.\n- **Tạp hóa Xanh (Starter):** 27 triệu — 2 cửa hàng.\n\n**Tổng Q3: 1.522 triệu**, trong đó RetailOS chiếm 79%.', 2 * D, { tool: 'search_knowledge_base', input: 'doanh thu Q3 theo khách hàng', result: '7 dòng từ Bao-cao-doanh-thu-Q3-2026.csv' }),
    ],
  },
  {
    key: 'dm-minh-ai', type: 'direct', members: ['minh', 'ai'], start: 100 * D, kb: ['retailSpec', 'retailApi', 'contract'], kbBy: 'minh',
    messages: [
      { from: 'minh', text: 'POS offline tối đa bao lâu theo đặc tả?', ago: 16 * D },
      ai('Theo **RetailOS — Đặc tả hệ thống v1.3** (mục 1 – Phạm vi): POS Android hoạt động **offline tối đa 8 giờ**; đơn tạo offline đồng bộ lại khi có mạng với header `X-Offline-Id` để chống trùng (API POS v2).\n\nNguồn: RetailOS-Dac-ta-he-thong-v1.3.md, RetailOS-API-POS-v2.md', 16 * D, { tool: 'search_knowledge_base', input: 'POS offline tối đa', result: '2 đoạn từ 2 tài liệu' }),
      { from: 'minh', text: 'Nhắc mình 13:30 mai mở phòng họp demo go-live.', ago: 3 * H },
      ai('Đã tạo nhắc nhở: **Mở phòng họp demo go-live** — 13:30 ngày mai. ⏰', 3 * H, { tool: 'create_reminder', input: 'Mở phòng họp demo go-live @ mai 13:30', result: 'reminder created' }),
    ],
  },
  {
    key: 'dm-tri-ai', type: 'direct', members: ['tri', 'ai'], start: 80 * D, kb: ['gpsProto', 'fleetSpec'], kbBy: 'tri',
    messages: [
      { from: 'tri', text: 'Mình đang làm app tài xế FleetPro bằng Flutter, test trên Samsung J7 Android 9. Nhớ giúp mình nhé.', ago: 40 * D },
      ai('Đã ghi nhớ: bạn làm **app tài xế FleetPro bằng Flutter**, thiết bị test chính là **Samsung J7 (Android 9)**. Lần sau hỏi về quyền, camera hay hiệu năng mình sẽ ưu tiên theo cấu hình này.', 40 * D),
      { from: 'tri', text: 'Thiết bị T1 gửi bản tin bao lâu một lần khi xe tắt máy?', ago: 8 * D },
      ai('Theo **Giao thức thiết bị Lumen-T1** (mục Chu kỳ): xe **tắt máy: 5 phút/bản tin**; xe nổ máy: 10 giây/bản tin.\n\nNguồn: FleetPro-Giao-thuc-thiet-bi-Lumen-T1.md', 8 * D, { tool: 'search_knowledge_base', input: 'chu kỳ bản tin xe tắt máy', result: '1 đoạn từ FleetPro-Giao-thuc-thiet-bi-Lumen-T1.md' }),
    ],
  },
];

// Friendships (accepted unless noted).
const FRIENDSHIPS = [
  ['khang', 'dung'], ['khang', 'tuan'], ['khang', 'minh'], ['khang', 'huy'], ['khang', 'lananh'], ['khang', 'oanh'],
  ['minh', 'tri'], ['minh', 'nhung'], ['minh', 'vinh'], ['minh', 'phuoc'], ['minh', 'bao'], ['minh', 'tuan'],
  ['huy', 'tri'], ['huy', 'hai'], ['huy', 'khoi'], ['tri', 'hai'], ['tri', 'linh'], ['tri', 'nam'],
  ['dung', 'oanh'], ['dung', 'giang'], ['lananh', 'dat'], ['lananh', 'thuong'], ['ha', 'uyen'], ['oanh', 'hang'],
  ['uyen', 'khang', 'pending'], ['thuong', 'minh', 'pending'],
];

// Reminders (inMins from the story's now; negative = past). Story reminders the
// real clock has already passed are stored as done. `real: true` = relative to
// the REAL clock, so there are always a few open reminders.
const REMINDERS = [
  { user: 'khang', conv: 'dm-khang-ai', text: 'Duyệt bảng lương tháng', inMins: 20 * H, real: true },
  { user: 'minh', conv: 'dm-minh-ai', text: 'Gửi báo cáo tuần RetailOS cho anh Khang', inMins: D + 2 * H, real: true },
  { user: 'tri', conv: 'dm-tri-ai', text: 'Đẩy bản app tài xế mới lên kênh phân phối nội bộ', inMins: 2 * D, real: true },
  { user: 'khang', conv: 'dm-khang-ai', text: 'Qua Minh Châu Gò Vấp cùng Tuấn', inMins: 39 * H },
  { user: 'khang', conv: 'dm-khang-ai', text: 'Gửi lịch gặp quỹ cho Giang', inMins: 16 * H },
  { user: 'khang', conv: 'dm-khang-ai', text: 'Duyệt ngân sách tuyển dụng Q4', inMins: -2 * D, done: true },
  { user: 'minh', conv: 'dm-minh-ai', text: 'Mở phòng họp demo go-live', inMins: 20 * H },
  { user: 'minh', conv: 'dm-minh-ai', text: 'Kiểm tra POS đợt 2 (6 siêu thị)', inMins: 20 * H },
  { user: 'tri', conv: 'dm-tri-ai', text: 'Build app tài xế v0.9 cho review thứ 4', inMins: 41 * H + 30 },
  { user: 'huy', conv: 'fleet', text: 'Gửi anh Tài báo cáo tuần pilot', inMins: 16 * H },
];

// Per-conversation AI memory summaries (ai_memories, shown on the memory screen).
const MEMORIES = [
  { user: 'khang', conv: 'dm-khang-ai', messageCount: 26,
    summary: 'Khang là CEO Lumen Software, đang theo sát go-live RetailOS tại Minh Châu (28/10) và chuẩn bị gọi vốn seed trong tháng 11. Thích câu trả lời ngắn, có số liệu.',
    keyFacts: ['CEO & Founder Lumen Software', 'Theo sát go-live Minh Châu 28/10/2026', 'Gặp 2 quỹ đầu tư tháng 11', 'Ưu tiên số liệu, kết luận trước'] },
  { user: 'minh', conv: 'dm-minh-ai', messageCount: 18,
    summary: 'Minh là Trưởng phòng RetailOS, phụ trách dự án Minh Châu; đang điều phối cài POS 12 siêu thị và demo go-live.',
    keyFacts: ['Trưởng phòng RetailOS', 'Đầu mối kỹ thuật với Minh Châu (chị Thảo IT)', 'Hotline P1 ngày go-live', 'Trả lời chi tiết kỹ thuật, kèm next step'] },
  { user: 'tri', conv: 'dm-tri-ai', messageCount: 11,
    summary: 'Trí làm app tài xế FleetPro bằng Flutter, thiết bị test Samsung J7 Android 9; đang chuẩn bị bản 0.9 với xác nhận giao hàng bằng ảnh.',
    keyFacts: ['Mobile Engineer phòng FleetPro', 'Làm app tài xế bằng Flutter', 'Thiết bị test: Samsung J7, Android 9', 'Dùng flutter_image_compress quality 70'] },
];

// Semantic facts embedded into Qdrant `ai_memory` (what the assistant recalls across chats).
const MEMORY_FACTS = {
  khang: ['Khang là CEO và founder của Lumen Software', 'Khang muốn câu trả lời ngắn gọn, số liệu và kết luận trước', 'Khang sẽ đến Minh Châu Gò Vấp sáng 28/10 cùng Tuấn (CTO) cho ngày go-live', 'Khang chuẩn bị gặp 2 quỹ đầu tư trong tháng 11 để gọi vốn seed'],
  minh: ['Minh là Trưởng phòng RetailOS, đầu mối kỹ thuật của dự án Minh Châu', 'Minh phụ trách hotline P1 trong ngày go-live 28/10', 'Minh làm việc trực tiếp với chị Trần Thu Thảo (IT Minh Châu)'],
  tri: ['Trí làm app tài xế FleetPro bằng Flutter', 'Thiết bị test chính của Trí là Samsung J7 chạy Android 9', 'Trí dùng flutter_image_compress với quality 70 và resize 1280 để nén ảnh'],
  dung: ['Dũng là COO, phụ trách vận hành và nhân sự', 'Dũng đã duyệt WFH 3 ngày/tuần cho FleetPro trong 2 tuần on-call pilot'],
};

module.exports = { CONVERSATIONS, FRIENDSHIPS, REMINDERS, MEMORIES, MEMORY_FACTS };
