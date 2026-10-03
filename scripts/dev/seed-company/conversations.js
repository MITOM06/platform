// Conversation scripts for the NovaTech company.
//
// Message DSL (index.js turns these into real `messages` documents):
//   from     person key | 'ai' (the @AI bot) | 'system'
//   text     content (for system: a `system.*` code)
//   ago      minutes before "now"; when omitted = previous ago - 2..5
//   type     text (default) | ai | system | file | image | meeting_summary
//   file     key into files.js (type file/image)
//   id       label other messages can reply to
//   reply    label of the message this one replies to
//   react    { emoji: [personKey, ...] }
//   mention  [personKey, ...]
//   pin      true → added to conversation.pinnedMessages
//   edited   true → editedAt set
//   recalled true → recalled for everyone
//   trace    AI trace (tool calls) for `ai` messages
//
// Conversation fields: unread = how many trailing messages stay unread for
// everyone except their sender (drives unread badges).

const H = 60;
const D = 24 * H;

const meeting = (o) => JSON.stringify(o);

const CONVERSATIONS = [
  // ------------------------------------------------------------ company-wide
  {
    key: 'ann', type: 'group', name: '📢 Thông báo chung NovaTech', members: 'ALL', publicChannel: true,
    admins: ['quan', 'ha', 'nhung'], createdBy: 'quan', start: 30 * D, unread: 2,
    messages: [
      { from: 'system', type: 'system', text: 'system.group.created', ago: 30 * D },
      { from: 'quan', text: 'Chào mừng cả nhà đến với kênh thông báo chung của NovaTech trên PON! Từ hôm nay mọi thông báo chính thức sẽ đăng ở đây.', ago: 30 * D - 5, react: { '🎉': ['ha', 'nam', 'vy', 'phuc', 'nhung'], '❤️': ['lan', 'thao'] } },
      { from: 'nhung', text: 'HR gửi mọi người Sổ tay nhân viên 2026. Các bạn đọc kỹ phần nghỉ phép và WFH nhé. File này cũng đã được nạp vào trợ lý AI, cứ hỏi @AI là được.', ago: 21 * D },
      { from: 'nhung', type: 'file', file: 'handbook', ago: 21 * D - 1, id: 'handbook', pin: true },
      { from: 'ha', text: 'Nhắc lại chính sách WFH: tối đa 2 ngày/tuần, đăng ký trên kênh phòng ban trước 17:00 hôm trước. Core hours 10:00–16:00 bắt buộc online.', ago: 14 * D, pin: true, react: { '👍': ['anh', 'bao', 'linh', 'tram', 'minh'] } },
      { from: 'linh', text: '@AI theo sổ tay thì phép năm chưa dùng có được chuyển sang năm sau không?', ago: 14 * D - 30, mention: ['ai'] },
      { from: 'ai', type: 'ai', text: 'Theo **Sổ tay nhân viên NovaTech 2026** (mục 2 – Nghỉ phép):\n\n- Mỗi nhân viên có **12 ngày phép năm**, cứ 3 năm thâm niên được cộng thêm 1 ngày.\n- Phép chưa dùng **được chuyển sang quý 1 năm sau, tối đa 5 ngày**.\n\nNguồn: So-tay-nhan-vien-NovaTech-2026.md', ago: 14 * D - 30, trace: { tool: 'search_knowledge_base', input: 'phép năm chuyển sang năm sau', result: '3 đoạn từ So-tay-nhan-vien-NovaTech-2026.md' } },
      { from: 'quan', text: 'Kết quả kinh doanh Q3: doanh thu 4,5 tỷ, vượt 12% kế hoạch. Cảm ơn tất cả mọi người! 👏', ago: 3 * D, react: { '🔥': ['nam', 'phuc', 'thao', 'long', 'viet', 'dev'], '👏': ['ha', 'vy', 'tram'] } },
      { from: 'quan', type: 'image', file: 'revenueChart', ago: 3 * D - 1 },
      { from: 'nhung', text: 'Team building Q4 sẽ tổ chức ở Hồ Tràm ngày 24–25/10. Mọi người điền form đăng ký phòng trước thứ 6 tuần này nhé 🏖️', ago: 2 * H, react: { '😍': ['lan', 'kiet', 'mai'] } },
      { from: 'system', type: 'system', text: 'system.members.added', ago: 90 },
      { from: 'ha', text: 'Chào mừng các bạn mới gia nhập tháng 10! Mọi người nhớ giới thiệu bản thân ở kênh phòng ban nhé.', ago: 85 },
    ],
  },

  // -------------------------------------------------------------- departments
  {
    key: 'eng', type: 'group', name: '#ky-thuat', dept: 'eng',
    members: ['nam', 'anh', 'lan', 'bao', 'huy', 'linh', 'dev', 'alice', 'bob'],
    admins: ['nam', 'dev'], createdBy: 'nam', start: 28 * D, unread: 3,
    persona: { name: 'Nova Dev', tone: 'technical', prefix: 'Bạn là trợ lý kỹ thuật của phòng Kỹ thuật NovaTech. Trả lời ngắn, có code mẫu khi cần, ưu tiên quy chuẩn nội bộ.' },
    messages: [
      { from: 'system', type: 'system', text: 'system.group.created', ago: 28 * D },
      { from: 'nam', text: 'Mình upload quy chuẩn code + quy trình release ở đây, đã nạp vào KB của nhóm.', ago: 20 * D },
      { from: 'nam', type: 'file', file: 'engStandards', ago: 20 * D - 1, pin: true },
      { from: 'huy', text: 'On-call tuần này: Huy. Tuần sau: Anh. Có sự cố P1 cứ gọi thẳng số mình.', ago: 4 * D, id: 'oncall', pin: true },
      { from: 'anh', text: 'PR #212 (refactor KB processor) cần review gấp, mai freeze code rồi 🙏', ago: 2 * D, id: 'pr212' },
      { from: 'dev', text: 'Để mình review, 30p nữa xong.', ago: 2 * D - 3, reply: 'pr212' },
      { from: 'lan', text: 'Web build đang fail ở bước lint vì rule react-compiler, ai gặp chưa?', ago: 2 * D - 60, id: 'lint' },
      { from: 'bao', text: 'Gặp rồi, xoá cái useMemo thừa trong MessageViewport là pass.', ago: 2 * D - 55, reply: 'lint', react: { '🙌': ['lan'] } },
      { from: 'linh', text: 'Regression test sprint 42 xong: 146/148 pass, 2 case flaky ở e2e call. Mình đã quarantine.', ago: D + 3 * H, edited: true },
      { from: 'linh', type: 'image', file: 'whiteboard', ago: D + 3 * H - 2 },
      { from: 'alice', text: 'Ơ nhầm kênh 😅', ago: D + 2 * H, recalled: true },
      { from: 'bob', text: '@AI freeze code mấy giờ thứ 5 và release lúc nào vậy?', ago: D + H, mention: ['ai'] },
      { from: 'ai', type: 'ai', text: 'Theo **Quy chuẩn code và release** (mã ENG-REL-07):\n\n- **Freeze code:** 12:00 thứ 5\n- **Release:** 20:00 thứ 5\n- Rollback nếu error rate > 2% trong 30 phút đầu.\n\nNgười trực release tuần này xem tin nhắn đã ghim trong kênh.', ago: D + H - 1, trace: { tool: 'search_knowledge_base', input: 'freeze code release thứ 5', result: '2 đoạn từ Quy-chuan-code-va-release.md' } },
      { from: 'nam', text: 'Sprint 43 bắt đầu thứ 2. Focus: Meeting Room LiveKit M0 + fix 3 bug P1 bên CSKH báo.', ago: 5 * H },
      { from: 'huy', text: 'Staging vừa redeploy xong, mọi người test lại luồng upload KB giúp mình.', ago: 50 },
      { from: 'anh', text: 'Upload PDF ok rồi, chunk + embed chạy trong ~4s.', ago: 35, react: { '🚀': ['huy', 'nam'] } },
      { from: 'lan', text: '@Phong Dev chiều nay pair với mình phần SSO login trên web được không?', ago: 12, mention: ['dev'] },
    ],
  },
  {
    key: 'prd', type: 'group', name: '#san-pham-thiet-ke', dept: 'prd',
    members: ['vy', 'kiet', 'nam', 'dev'], admins: ['vy'], createdBy: 'vy', start: 25 * D, unread: 1,
    messages: [
      { from: 'vy', text: 'Roadmap Q4 đã chốt: ưu tiên #1 là Meeting Room (LiveKit), #2 là connector Jira.', ago: 10 * D, pin: true },
      { from: 'kiet', text: 'Wireframe v3 màn Meeting Room: lobby + active speaker. Mọi người góp ý giúp.', ago: 2 * D },
      { from: 'kiet', type: 'image', file: 'wireframe', ago: 2 * D - 1, id: 'wf' },
      { from: 'nam', text: 'Nút share screen nên tách khỏi thanh control chính, iOS phase 1 chưa hỗ trợ.', ago: 2 * D - 40, reply: 'wf' },
      { from: 'dev', text: 'Đồng ý. Thêm trạng thái "đang kết nối lại" khi mạng chập chờn nữa.', ago: 2 * D - 35, reply: 'wf', react: { '👍': ['kiet', 'vy'] } },
      { from: 'vy', text: 'Kiệt update v4 trước thứ 4 nhé, mình demo cho anh Quân thứ 5.', ago: 3 * H },
    ],
  },
  {
    key: 'sales', type: 'group', name: '#kinh-doanh', dept: 'sales',
    members: ['phuc', 'tram', 'son', 'quan'], admins: ['phuc'], createdBy: 'phuc', start: 26 * D, unread: 2,
    messages: [
      { from: 'phuc', text: 'Bảng giá H2/2026 chính thức, áp dụng từ 01/07. Đã nạp KB, hỏi @AI khi cần báo giá nhanh.', ago: 18 * D },
      { from: 'phuc', type: 'file', file: 'pricing', ago: 18 * D - 1, pin: true },
      { from: 'tram', text: 'Khách Minh Phát (120 user) hỏi gói Business có giảm khi trả theo năm không ạ?', ago: 4 * D, id: 'q' },
      { from: 'son', text: '@AI gói Business 120 user trả theo năm thì tổng chi phí năm đầu bao nhiêu?', ago: 4 * D - 5, mention: ['ai'] },
      { from: 'ai', type: 'ai', text: 'Tính theo **Bảng giá dịch vụ PON 2026** (PRICE-2026-H2):\n\n- Thuê bao: 120 user × 240.000đ × 12 tháng = **345.600.000đ**\n- Giảm 10% khi trả theo năm: −34.560.000đ → **311.040.000đ**\n- Phí triển khai gói Business (một lần): **25.000.000đ**\n\n**Tổng năm đầu: 336.040.000đ** (chưa VAT).', ago: 4 * D - 5, trace: { tool: 'search_knowledge_base', input: 'giá gói Business trả theo năm', result: '2 đoạn từ Bang-gia-dich-vu-PON-2026.md' } },
      { from: 'phuc', text: 'Chuẩn. Trâm gửi báo giá, chiết khấu thêm tối đa 10% theo quyền AE nhé.', ago: 4 * D - 20, reply: 'q' },
      { from: 'tram', text: 'Hợp đồng ABC Corp đã ký! 1,25 tỷ / 3 năm 🎉', ago: 6 * D, react: { '🎉': ['phuc', 'son', 'quan'], '🔥': ['phuc'] } },
      { from: 'quan', text: 'Tuyệt vời team! Pipeline Q4 cập nhật lên CRM trước thứ 6 nhé.', ago: 5 * H },
      { from: 'son', text: 'Em vừa demo cho Thiên Long, họ muốn trial 14 ngày.', ago: 40 },
    ],
  },
  {
    key: 'mkt', type: 'group', name: '#marketing', dept: 'mkt',
    members: ['thao', 'minh', 'vy'], admins: ['thao'], createdBy: 'thao', start: 20 * D,
    messages: [
      { from: 'thao', text: 'Kế hoạch marketing Q4, mọi người xem ngân sách từng hạng mục nhé.', ago: 9 * D },
      { from: 'thao', type: 'file', file: 'mktPlanCsv', ago: 9 * D - 1, pin: true },
      { from: 'minh', text: 'Banner webinar bản final đây chị.', ago: 3 * D },
      { from: 'minh', type: 'image', file: 'banner', ago: 3 * D - 1, id: 'banner', react: { '😍': ['thao', 'vy'] } },
      { from: 'vy', text: 'Thêm logo PON góc phải cho nhận diện thương hiệu nha.', ago: 3 * D - 30, reply: 'banner' },
      { from: 'thao', text: 'Webinar đã có 214 đăng ký, còn 86 nữa là đạt KPI 💪', ago: 4 * H },
    ],
  },
  {
    key: 'hr', type: 'group', name: '#nhan-su', dept: 'hr',
    members: ['nhung', 'ngoc', 'ha'], admins: ['nhung'], createdBy: 'nhung', start: 22 * D,
    messages: [
      { from: 'nhung', type: 'file', file: 'onboarding', ago: 12 * D, pin: true },
      { from: 'ngoc', text: 'Pipeline tuyển dụng: Backend 3 ứng viên vòng 2, Designer 1 offer đang chờ phản hồi.', ago: 2 * D },
      { from: 'ha', text: 'Offer designer chốt trong tuần này nhé, team Product đang thiếu người.', ago: 2 * D - 15 },
      { from: 'ngoc', text: 'Em đã gửi lời mời PON cho bạn backend mới, onboard thứ 2 tuần sau.', ago: 6 * H },
    ],
  },
  {
    key: 'fin', type: 'group', name: '#tai-chinh-ke-toan', dept: 'fin',
    members: ['long', 'thu', 'quan', 'ha'], admins: ['long'], createdBy: 'long', start: 24 * D,
    messages: [
      { from: 'thu', text: 'Báo cáo doanh thu Q3 em gửi anh chị.', ago: 4 * D },
      { from: 'thu', type: 'file', file: 'revenueCsv', ago: 4 * D - 1 },
      { from: 'long', text: 'Lợi nhuận gộp Q3 đạt 2,36 tỷ, biên 52%. Hơi thấp hơn mục tiêu 55% do chi phí triển khai ABC.', ago: 4 * D - 60 },
      { from: 'quan', text: '@AI tháng nào trong Q3 có biên lợi nhuận gộp cao nhất?', ago: 4 * D - 90, mention: ['ai'] },
      { from: 'ai', type: 'ai', text: 'Theo **Bao-cao-doanh-thu-Q3-2026.csv**:\n\n| Tháng | Doanh thu | Lợi nhuận gộp | Biên |\n|---|---|---|---|\n| 07 | 1.420 | 730 | 51,4% |\n| 08 | 1.310 | 655 | 50,0% |\n| 09 | 1.785 | 973 | **54,5%** |\n\n→ **Tháng 9** có biên lợi nhuận gộp cao nhất (54,5%).', ago: 4 * D - 90, trace: { tool: 'search_knowledge_base', input: 'biên lợi nhuận gộp theo tháng Q3', result: '1 đoạn từ Bao-cao-doanh-thu-Q3-2026.csv' } },
      { from: 'long', text: 'Nhắc: hóa đơn đầu vào tháng 10 gửi trước ngày 28, lương trả ngày 5/11.', ago: 3 * H, pin: true },
    ],
  },
  {
    key: 'cs', type: 'group', name: '#cskh', dept: 'cs',
    members: ['viet', 'mai', 'bob'], admins: ['viet'], createdBy: 'viet', start: 20 * D, unread: 1,
    messages: [
      { from: 'mai', text: 'Ticket #4821 (Minh Phát): user không nhận được thông báo khi có tin nhắn mới trên iOS.', ago: D, id: 't' },
      { from: 'bob', text: 'Đã chuyển cho team mobile, nghi do FCM token cũ. ETA fix thứ 5.', ago: D - 30, reply: 't' },
      { from: 'viet', text: 'Ticket này mở 2 ngày rồi, mai mà chưa có fix thì escalate theo SLA nhé.', ago: D - 45 },
      { from: 'viet', text: 'CSAT tháng 9: 4,6/5 — cao nhất từ đầu năm 👏', ago: 2 * H, react: { '👏': ['mai', 'bob'] } },
    ],
  },
  {
    key: 'bod', type: 'group', name: 'Ban Giám đốc', dept: 'bod',
    members: ['quan', 'ha', 'nam', 'dev'], admins: ['quan'], createdBy: 'quan', start: 29 * D,
    messages: [
      { from: 'quan', text: 'Họp chiến lược Q4 lúc 9:00 sáng mai, gọi video nhé.', ago: 3 * D },
      { from: 'system', type: 'system', text: 'system.call.ended:video:2730', ago: 2 * D - 10 * H },
      { from: 'ai', type: 'meeting_summary', ago: 2 * D - 10 * H - 1, text: meeting({
        attendees: ['Nguyễn Minh Quân', 'Trần Thu Hà', 'Lê Hoàng Nam', 'Phong Dev'], durationSec: 2730,
        overview: 'Họp chiến lược Q4: thống nhất ưu tiên ra mắt PON 2.0 với Meeting Room, mở rộng đội Kỹ thuật và mục tiêu 5 khách hàng enterprise mới.',
        keyPoints: ['Doanh thu Q3 vượt kế hoạch 12%', 'Meeting Room LiveKit là ưu tiên số 1 Q4', 'Tuyển thêm 2 backend + 1 designer', 'Chuẩn bị hồ sơ gọi vốn Series A cho Q1/2027'],
        actionItems: ['Nam: kế hoạch M0 LiveKit trước 10/10', 'Hà: chốt ngân sách tuyển dụng Q4', 'Quân: gặp 2 quỹ đầu tư trong tháng 10'],
      }) },
      { from: 'ha', text: 'Ngân sách tuyển dụng Q4 em đã chốt: 3 HC, tổng 145tr/tháng.', ago: D },
      { from: 'nam', text: 'Kế hoạch M0 LiveKit em gửi trong hôm nay.', ago: 6 * H },
    ],
  },

  // --------------------------------------------------------- cross-dept / social
  {
    key: 'erp', type: 'group', name: 'Dự án ERP – ABC Corp',
    members: ['vy', 'nam', 'anh', 'lan', 'phuc', 'tram', 'dev'], admins: ['vy', 'phuc'], createdBy: 'vy', start: 6 * D, unread: 2,
    messages: [
      { from: 'system', type: 'system', text: 'system.group.created', ago: 6 * D },
      { from: 'tram', text: 'Tài liệu yêu cầu ABC gửi qua, mình nạp vào KB của nhóm luôn.', ago: 6 * D - 10 },
      { from: 'tram', type: 'file', file: 'erpPdf', ago: 6 * D - 11, pin: true },
      { from: 'vy', text: 'Milestone M1 là 20/10: hạ tầng + SSO Azure AD. Nam ước lượng giúp effort SSO nhé.', ago: 5 * D },
      { from: 'nam', text: 'SSO OIDC mình có sẵn, chủ yếu là mapping group → phòng ban. ~3 ngày.', ago: 5 * D - 20 },
      { from: 'phuc', text: '@AI nếu trễ M3 thì phạt bao nhiêu?', ago: 2 * D, mention: ['ai'] },
      { from: 'ai', type: 'ai', text: 'Theo **ABC Corp – ERP Integration Requirements v1.2** (mục 4 – Acceptance):\n\n- Phạt **0,5% giá trị hợp đồng mỗi tuần** trễ sau M3 (go-live 10/12/2026).\n- Giá trị hợp đồng 1.250.000.000đ → **6.250.000đ/tuần**.', ago: 2 * D, trace: { tool: 'search_knowledge_base', input: 'penalty delay M3', result: '1 đoạn từ ABC-Corp-ERP-Requirements-v1.2.pdf' } },
      { from: 'anh', text: 'Connector SAP mình dựng bản đọc tồn kho rồi, đang chờ ABC cấp tài khoản test.', ago: 8 * H },
      { from: 'dev', text: 'Mình review connector chiều nay.', ago: 7 * H },
      { from: 'lan', text: 'UI màn tra cứu tồn kho xong 80%.', ago: 25 },
    ],
  },
  {
    key: 'lunch', type: 'group', name: 'Hội ăn trưa 🍜',
    members: ['lan', 'bao', 'kiet', 'minh', 'mai', 'dev', 'linh', 'tram'], admins: ['lan'], createdBy: 'lan', start: 15 * D,
    mutedFor: ['dev'], unread: 4,
    messages: [
      { from: 'lan', text: 'Trưa nay ăn gì cả nhà?', ago: 3 * H },
      { from: 'bao', text: 'Bún bò Huế đầu hẻm!', ago: 3 * H - 2, react: { '😋': ['kiet', 'linh'] } },
      { from: 'kiet', text: 'Cơm tấm đi, hôm qua ăn bún rồi 😂', ago: 3 * H - 4 },
      { from: 'mai', text: 'Mình đặt trà sữa, ai lấy thì reply nha 🧋', ago: 2 * H },
      { from: 'minh', text: '1 trà sữa ít đường!', ago: 2 * H - 1 },
      { from: 'tram', text: '+1 ít đá', ago: 2 * H - 2 },
    ],
  },

  // ------------------------------------------------------------------- DMs
  {
    key: 'dm-nam', type: 'direct', members: ['dev', 'nam'], start: 20 * D, unread: 1,
    messages: [
      { from: 'nam', text: 'Em xem giúp anh kế hoạch M0 LiveKit, nhất là phần TURN.', ago: 2 * D },
      { from: 'dev', text: 'Ok anh, owner đã chốt 1-1 cũng qua LiveKit nên bỏ được coturn.', ago: 2 * D - 10 },
      { from: 'system', type: 'system', text: 'system.call.ended:voice:845', ago: D + 5 * H },
      { from: 'system', type: 'system', text: 'system.call.missed:video', ago: 4 * H },
      { from: 'nam', text: 'Gọi không được, rảnh thì gọi lại anh nhé.', ago: 4 * H - 1 },
    ],
  },
  {
    key: 'dm-vy', type: 'direct', members: ['dev', 'vy'], start: 10 * D,
    messages: [
      { from: 'vy', text: 'Phong ơi, tính năng nhắc lịch (reminder) hiện có hỗ trợ lặp lại hằng tuần chưa?', ago: D + 2 * H },
      { from: 'dev', text: 'Chưa chị, mới hỗ trợ nhắc 1 lần. Em note vào backlog sprint 44 nhé.', ago: D + H, react: { '🙏': ['vy'] } },
    ],
  },
  {
    key: 'dm-nhung', type: 'direct', members: ['dev', 'nhung'], start: 12 * D,
    messages: [
      { from: 'dev', text: 'Chị Nhung ơi, em xin nghỉ phép 2 ngày 16–17/10 nhé.', ago: 3 * D },
      { from: 'nhung', text: 'Ok em, nhớ điền form HR và báo anh Nam duyệt nha.', ago: 3 * D - 30 },
      { from: 'nhung', type: 'file', file: 'handbook', ago: 3 * D - 31 },
    ],
  },
  {
    key: 'dm-linh', type: 'direct', members: ['dev', 'linh'], start: 5 * D, autoDeleteSeconds: 7 * 24 * 3600,
    messages: [
      { from: 'linh', text: 'Tài khoản test staging: qa.staging / mật khẩu mình gửi riêng qua tin tự huỷ này nha.', ago: 2 * H },
      { from: 'dev', text: 'Nhận rồi, cảm ơn Linh.', ago: 2 * H - 3 },
    ],
  },
  {
    key: 'dm-huy', type: 'direct', members: ['dev', 'huy'], start: 40 * D, archivedFor: ['dev'],
    messages: [
      { from: 'huy', text: 'Server cũ đã tắt, chuyển hẳn sang Mac mini rồi nhé.', ago: 25 * D },
      { from: 'dev', text: 'Ok, cảm ơn Huy!', ago: 25 * D - 5 },
    ],
  },
  {
    // Message request from someone who isn't a friend yet → "Requests" tab.
    key: 'dm-son-request', type: 'direct', members: ['son', 'dev'], createdBy: 'son', status: 'pending', start: 5 * H,
    messages: [
      { from: 'son', text: 'Chào anh Phong, em là Sơn bên Kinh doanh. Khách Thiên Long hỏi về self-host on-premise, anh hỗ trợ em buổi demo kỹ thuật được không ạ?', ago: 5 * H },
    ],
  },
  {
    key: 'dm-ai', type: 'direct', members: ['dev', 'ai'], start: 7 * D,
    messages: [
      { from: 'dev', text: 'Nhắc mình 9h sáng thứ 2 review kế hoạch M0 LiveKit.', ago: 3 * D },
      { from: 'ai', type: 'ai', text: 'Đã tạo nhắc nhở: **Review kế hoạch M0 LiveKit** — 9:00 sáng thứ 2. Mình sẽ báo bạn đúng giờ. ⏰', ago: 3 * D, trace: { tool: 'create_reminder', input: 'Review kế hoạch M0 LiveKit @ thứ 2 9:00', result: 'reminder created' } },
      { from: 'dev', text: 'Tóm tắt giúp mình chính sách WFH công ty.', ago: D },
      { from: 'ai', type: 'ai', text: 'Chính sách WFH của NovaTech:\n\n- Tối đa **2 ngày/tuần**.\n- Đăng ký trên kênh phòng ban **trước 17:00** ngày hôm trước.\n- **Core hours 10:00–16:00** bắt buộc online.', ago: D, trace: { tool: 'search_knowledge_base', input: 'chính sách WFH', result: '1 đoạn từ So-tay-nhan-vien-NovaTech-2026.md' } },
    ],
  },
  // DMs between other people — log in as them to test.
  {
    key: 'dm-phuc-tram', type: 'direct', members: ['phuc', 'tram'], start: 8 * D,
    messages: [
      { from: 'phuc', text: 'Deal Minh Phát chốt được 12% chiết khấu không em?', ago: D },
      { from: 'tram', text: 'Khách đòi 15% anh ạ, vượt quyền AE.', ago: D - 10 },
      { from: 'phuc', text: '15% thì anh duyệt được, trên nữa phải xin anh Quân.', ago: D - 15 },
    ],
  },
  {
    key: 'dm-quan-ha', type: 'direct', members: ['quan', 'ha'], start: 9 * D,
    messages: [
      { from: 'quan', text: 'Hà chuẩn bị giúp anh deck Series A nhé, bản nháp trước 20/10.', ago: 2 * D },
      { from: 'ha', text: 'Dạ, em làm cùng anh Long phần số liệu tài chính.', ago: 2 * D - 20 },
    ],
  },
  {
    key: 'dm-alice-bob', type: 'direct', members: ['alice', 'bob'], start: 6 * D,
    messages: [
      { from: 'alice', text: 'Bob ơi ticket #4821 có log FCM chưa?', ago: 20 * H },
      { from: 'bob', text: 'Có rồi, token hết hạn từ tháng 8. Mình gửi log qua email.', ago: 19 * H },
    ],
  },
];

// Friendships (accepted unless noted). `dev` is friends with the people it
// DMs; `kiet → dev` stays pending so the friend-request UI has something.
const FRIENDSHIPS = [
  ['dev', 'nam'], ['dev', 'vy'], ['dev', 'nhung'], ['dev', 'linh'], ['dev', 'huy'], ['dev', 'anh'],
  ['dev', 'lan'], ['dev', 'bao'], ['phuc', 'tram'], ['phuc', 'son'], ['quan', 'ha'], ['quan', 'nam'],
  ['thao', 'minh'], ['nhung', 'ngoc'], ['long', 'thu'], ['viet', 'mai'], ['alice', 'bob'],
  ['kiet', 'dev', 'pending'], ['minh', 'dev', 'pending'],
];

// Reminders (remindAt in minutes from now; negative = past).
const REMINDERS = [
  { user: 'dev', conv: 'dm-ai', text: 'Review kế hoạch M0 LiveKit', inMins: 2 * D },
  { user: 'dev', conv: 'dm-ai', text: 'Pair với Lan phần SSO login web', inMins: 3 * H },
  { user: 'dev', conv: 'dm-ai', text: 'Điền form nghỉ phép 16–17/10', inMins: D, },
  { user: 'dev', conv: 'dm-ai', text: 'Gửi review PR #212', inMins: -D, done: true },
  { user: 'phuc', conv: 'sales', text: 'Gửi báo giá Minh Phát', inMins: 5 * H },
  { user: 'nhung', conv: 'hr', text: 'Chốt offer designer', inMins: D + 2 * H },
];

// Per-user long-term AI memory (shown on the AI Context / memory screen).
const MEMORIES = [
  {
    user: 'dev', conv: 'dm-ai', messageCount: 24,
    summary: 'Phong là Tech Lead tại NovaTech, đang phụ trách Meeting Room LiveKit và review connector SAP cho dự án ABC Corp. Đã xin nghỉ phép 16–17/10.',
    keyFacts: ['Là Tech Lead phòng Kỹ thuật', 'Phụ trách Meeting Room LiveKit (M0)', 'Review connector SAP dự án ABC Corp', 'Nghỉ phép 16–17/10/2026', 'Thích câu trả lời ngắn, có code mẫu'],
  },
  {
    user: 'phuc', conv: 'sales', messageCount: 12,
    summary: 'Phúc là Sales Manager, đang theo deal Minh Phát (120 user, gói Business) và Thiên Long (trial 14 ngày).',
    keyFacts: ['Sales Manager, được duyệt chiết khấu tối đa 15%', 'Deal Minh Phát: 120 user gói Business', 'Thiên Long đang trial 14 ngày'],
  },
];

module.exports = { CONVERSATIONS, FRIENDSHIPS, REMINDERS, MEMORIES };
