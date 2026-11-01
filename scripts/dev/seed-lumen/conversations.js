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
      { from: 'han', text: '@AI theo sổ tay thì phép năm chưa dùng hết có mất không?', ago: 60 * D, mention: ['ai'] },
      ai('Theo **Sổ tay nhân viên Lumen 2026** (mục 3 – Nghỉ phép):\n\n- Mỗi nhân viên có **12 ngày phép năm**, tính theo tỷ lệ từ ngày vào làm.\n- Phép chưa dùng **được chuyển sang quý 1 năm sau, tối đa 5 ngày**.\n\nNguồn: So-tay-nhan-vien-Lumen-2026.md', 60 * D, { tool: 'search_knowledge_base', input: 'phép năm chưa dùng', result: '2 đoạn từ So-tay-nhan-vien-Lumen-2026.md' }),
      { from: 'huy', text: 'FleetPro chính thức chạy pilot 50 xe Sao Đỏ từ hôm nay. Tuần đầu tiên anh em on-call theo lịch trên kênh phòng.', ago: 55 * D, react: { '🚚': ['tri', 'hai', 'khoi', 'khang'], '👏': ['minh', 'lananh'] } },
      { from: 'minh', text: 'RetailOS pilot tại Minh Châu Gò Vấp đã lên từ sáng nay. Ca đầu tiên bán 212 đơn, không sự cố 🙌', ago: 41 * D, react: { '🔥': ['khang', 'dung', 'tuan', 'lananh', 'huy', 'phuoc', 'vinh'] } },
      { from: 'khang', text: 'Kết quả Q3: doanh thu 1,52 tỷ, vượt kế hoạch 9%. Thưởng dự án sẽ chi cùng lương tháng 10. Cảm ơn tất cả mọi người! 👏', ago: 4 * D, react: { '🔥': ['minh', 'huy', 'lananh', 'giang', 'tuan', 'dung', 'tri'], '👏': ['oanh', 'ha', 'uyen', 'nhung', 'trang'] } },
      { from: 'khang', type: 'image', file: 'revenueChart', ago: 4 * D - 1 },
      { from: 'oanh', text: 'Team building cuối năm: Vũng Tàu 6–7/12. Điền form đăng ký phòng trước thứ 6 tuần này nhé 🏖️', ago: 26 * H, react: { '😍': ['duyen', 'uyen', 'hang', 'linh'] } },
      { from: 'dung', text: 'Thứ 3 28/10 là ngày go-live Minh Châu. Phòng RetailOS được ưu tiên, các phòng khác hạn chế đặt họp với team RetailOS trong ngày đó.', ago: 3 * H, pin: true },
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
      { from: 'phuoc', text: 'Hóa đơn 58mm đã căn lại lề, in thử ở Gò Vấp ok.', ago: 18 * H },
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
      { from: 'khang', text: 'Họp BGĐ tháng 10 sáng thứ 5, gọi video nhé.', ago: 4 * D },
      { from: 'system', type: 'system', text: 'system.call.ended:video:3480', ago: 3 * D + 5 * H },
      { from: 'ai', type: 'meeting_summary', ago: 3 * D + 5 * H - 1, text: meeting({
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
      { from: 'han', text: 'Trưa nay ăn gì mọi người?', ago: 3 * H },
      { from: 'tung', text: 'Cơm tấm Phúc Lộc Thọ!', ago: 3 * H - 2, react: { '😋': ['duyen', 'nam'] } },
      { from: 'tri', text: 'Bún bò đi, hôm qua cơm tấm rồi 😂', ago: 3 * H - 4 },
      { from: 'uyen', text: 'Mình đặt trà sữa, ai lấy thì reply nha 🧋', ago: 2 * H },
      { from: 'linh', text: '1 trà sữa ít đường!', ago: 2 * H - 1 },
      { from: 'hang', text: '+1 ít đá', ago: 2 * H - 2 },
    ],
  },

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
      { from: 'khang', text: 'Nhắc mình 8:30 sáng thứ 3 qua Minh Châu Gò Vấp cùng Tuấn.', ago: 3 * D },
      ai('Đã tạo nhắc nhở: **Qua Minh Châu Gò Vấp cùng Tuấn** — 8:30 sáng thứ 3 (28/10). Mình sẽ báo bạn đúng giờ. ⏰', 3 * D, { tool: 'create_reminder', input: 'Qua Minh Châu Gò Vấp cùng Tuấn @ thứ 3 8:30', result: 'reminder created' }),
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

// Reminders (inMins from now; negative = past).
const REMINDERS = [
  { user: 'khang', conv: 'dm-khang-ai', text: 'Qua Minh Châu Gò Vấp cùng Tuấn', inMins: D + 10 * H },
  { user: 'khang', conv: 'dm-khang-ai', text: 'Gửi lịch gặp quỹ cho Giang', inMins: 5 * H },
  { user: 'khang', conv: 'dm-khang-ai', text: 'Duyệt ngân sách tuyển dụng Q4', inMins: -2 * D, done: true },
  { user: 'minh', conv: 'dm-minh-ai', text: 'Mở phòng họp demo go-live', inMins: D + 3 * H },
  { user: 'minh', conv: 'dm-minh-ai', text: 'Kiểm tra POS đợt 2 (6 siêu thị)', inMins: 20 * H },
  { user: 'tri', conv: 'dm-tri-ai', text: 'Build app tài xế v0.9 cho review thứ 4', inMins: 2 * D + 2 * H },
  { user: 'huy', conv: 'fleet', text: 'Gửi anh Tài báo cáo tuần pilot', inMins: 8 * H },
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
