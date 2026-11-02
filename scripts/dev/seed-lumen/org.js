// Fake company "Lumen Software" for the PON demo — org chart, people, AI context.
// Pure data: index.js writes it to Mongo. DEV-ONLY (never on main).
//
// Every person has a short `key` that conversations.js / meetings.js refer to.
// The four PON team members log in as the people marked `team`; everyone else
// exists only as data.

const DOMAIN = 'lumensoft.vn';
const FOUNDED = new Date('2026-04-14T02:00:00Z');

const WORKSPACE = {
  name: 'Lumen Software',
  primaryColor: '#7A2E3A',
  connectorAllowList: ['notion', 'gmail', 'calendar'],
  aiSettings: {
    personaName: 'Lumi',
    defaultTone: 'professional',
    dailyDigestEnabled: true,
    dailyDigestHour: 8,
    monthlyTokenLimit: 8000000,
  },
};

// key → department. `lead` is a person key.
const DEPARTMENTS = [
  { key: 'bod', name: 'Ban Giám đốc', lead: 'khang', description: 'Điều hành, chiến lược, tài chính và phê duyệt hợp đồng.' },
  { key: 'retail', name: 'Phòng RetailOS', lead: 'minh', description: 'Dự án RetailOS — nền tảng quản lý chuỗi cửa hàng (POS, tồn kho, màn hình quảng cáo) cho chuỗi siêu thị Minh Châu.' },
  { key: 'fleet', name: 'Phòng FleetPro', lead: 'huy', description: 'Dự án FleetPro — theo dõi xe GPS, điều phối giao hàng và app tài xế cho Vận tải Sao Đỏ.' },
  { key: 'sales', name: 'Kinh doanh', lead: 'lananh', description: 'Bán hàng B2B, quản lý khách hàng và báo giá.' },
  { key: 'mkt', name: 'Marketing', lead: 'ha', description: 'Thương hiệu, nội dung, sự kiện.' },
  { key: 'hr', name: 'Nhân sự', lead: 'oanh', description: 'Tuyển dụng, onboarding, chính sách và hành chính.' },
  { key: 'fin', name: 'Kế toán', lead: 'giang', description: 'Kế toán, thuế, lương và báo cáo tài chính.' },
];

// role = preset role name. `team` = a PON team member logs in as this person.
const PEOPLE = [
  // Ban Giám đốc
  { key: 'khang', email: `khang.tran@${DOMAIN}`, name: 'Trần Phúc Khang', role: 'Owner', depts: ['bod'], title: 'CEO & Founder', gender: 'male', phone: '+84901100001', team: 'Khang' },
  { key: 'dung', email: `dung.nguyen@${DOMAIN}`, name: 'Nguyễn Hoàng Dũng', role: 'Admin', depts: ['bod', 'hr'], title: 'COO — Giám đốc vận hành', gender: 'male', phone: '+84901100002', team: 'Dũng' },
  { key: 'tuan', email: `tuan.hoang@${DOMAIN}`, name: 'Hoàng Anh Tuấn', role: 'Admin', depts: ['bod'], title: 'CTO', gender: 'male' },
  // Phòng RetailOS (10)
  { key: 'minh', email: `minh.nguyen@${DOMAIN}`, name: 'Nguyễn Kim Minh', role: 'Member', depts: ['retail'], title: 'Trưởng phòng RetailOS', gender: 'male', phone: '+84901100004', team: 'Minh' },
  { key: 'nhung', email: `nhung.pham@${DOMAIN}`, name: 'Phạm Thị Hồng Nhung', role: 'Member', depts: ['retail'], title: 'Business Analyst', gender: 'female' },
  { key: 'vinh', email: `vinh.le@${DOMAIN}`, name: 'Lê Quang Vinh', role: 'Member', depts: ['retail'], title: 'Senior Backend Engineer (Java)', gender: 'male' },
  { key: 'tung', email: `tung.do@${DOMAIN}`, name: 'Đỗ Thanh Tùng', role: 'Member', depts: ['retail'], title: 'Backend Engineer (Node.js)', gender: 'male' },
  { key: 'han', email: `han.vu@${DOMAIN}`, name: 'Vũ Ngọc Hân', role: 'Member', depts: ['retail'], title: 'Frontend Engineer (React)', gender: 'female' },
  { key: 'phuoc', email: `phuoc.bui@${DOMAIN}`, name: 'Bùi Hữu Phước', role: 'Member', depts: ['retail'], title: 'Android Engineer (POS)', gender: 'male' },
  { key: 'duyen', email: `duyen.tran@${DOMAIN}`, name: 'Trần Mỹ Duyên', role: 'Member', depts: ['retail'], title: 'UI/UX Designer', gender: 'female' },
  { key: 'thinh', email: `thinh.ngo@${DOMAIN}`, name: 'Ngô Đức Thịnh', role: 'Member', depts: ['retail'], title: 'QA Engineer', gender: 'male' },
  { key: 'bao', email: `bao.ly@${DOMAIN}`, name: 'Lý Gia Bảo', role: 'Member', depts: ['retail'], title: 'DevOps Engineer', gender: 'male' },
  { key: 'ngan', email: `ngan.huynh@${DOMAIN}`, name: 'Huỳnh Kim Ngân', role: 'Member', depts: ['retail'], title: 'AI Engineer (nhận diện sản phẩm)', gender: 'female' },
  // Phòng FleetPro (9)
  { key: 'huy', email: `huy.dang@${DOMAIN}`, name: 'Đặng Quốc Huy', role: 'Member', depts: ['fleet'], title: 'Trưởng phòng FleetPro', gender: 'male', phone: '+84901100015' },
  { key: 'tri', email: `tri.pham@${DOMAIN}`, name: 'Phạm Minh Trí', role: 'Member', depts: ['fleet'], title: 'Mobile Engineer (Flutter — app tài xế)', gender: 'male', phone: '+84901100014', team: 'Trí' },
  { key: 'hai', email: `hai.nguyen@${DOMAIN}`, name: 'Nguyễn Thanh Hải', role: 'Member', depts: ['fleet'], title: 'Backend Engineer (Go / IoT)', gender: 'male' },
  { key: 'trang', email: `trang.phan@${DOMAIN}`, name: 'Phan Thị Thu Trang', role: 'Member', depts: ['fleet'], title: 'Business Analyst', gender: 'female' },
  { key: 'khoi', email: `khoi.vo@${DOMAIN}`, name: 'Võ Minh Khôi', role: 'Member', depts: ['fleet'], title: 'Embedded Engineer (thiết bị GPS)', gender: 'male' },
  { key: 'linh', email: `linh.truong@${DOMAIN}`, name: 'Trương Ngọc Linh', role: 'Member', depts: ['fleet'], title: 'Frontend Engineer (Next.js)', gender: 'female' },
  { key: 'nam', email: `nam.ho@${DOMAIN}`, name: 'Hồ Văn Nam', role: 'Member', depts: ['fleet'], title: 'QA Engineer', gender: 'male' },
  { key: 'ngoc', email: `ngoc.lam@${DOMAIN}`, name: 'Lâm Thị Bích Ngọc', role: 'Member', depts: ['fleet'], title: 'Data Engineer (tối ưu lộ trình)', gender: 'female' },
  { key: 'son', email: `son.dinh@${DOMAIN}`, name: 'Đinh Công Sơn', role: 'Member', depts: ['fleet'], title: 'DevOps Engineer', gender: 'male' },
  // Kinh doanh (3)
  { key: 'lananh', email: `lananh.cao@${DOMAIN}`, name: 'Cao Thị Lan Anh', role: 'Member', depts: ['sales'], title: 'Trưởng phòng Kinh doanh', gender: 'female', phone: '+84901100023' },
  { key: 'dat', email: `dat.nguyen@${DOMAIN}`, name: 'Nguyễn Văn Đạt', role: 'Member', depts: ['sales'], title: 'Account Executive', gender: 'male' },
  { key: 'thuong', email: `thuong.trinh@${DOMAIN}`, name: 'Trịnh Hoài Thương', role: 'Member', depts: ['sales'], title: 'Sales Executive', gender: 'female' },
  // Marketing (2)
  { key: 'ha', email: `ha.mai@${DOMAIN}`, name: 'Mai Thanh Hà', role: 'Member', depts: ['mkt'], title: 'Marketing Lead', gender: 'female' },
  { key: 'uyen', email: `uyen.le@${DOMAIN}`, name: 'Lê Phương Uyên', role: 'Member', depts: ['mkt'], title: 'Content Specialist', gender: 'female' },
  // Nhân sự (2)
  { key: 'oanh', email: `oanh.phung@${DOMAIN}`, name: 'Phùng Thị Kim Oanh', role: 'Admin', depts: ['hr'], title: 'HR Manager', gender: 'female' },
  { key: 'hang', email: `hang.dang@${DOMAIN}`, name: 'Đặng Thu Hằng', role: 'Member', depts: ['hr'], title: 'HR & Admin Assistant', gender: 'female' },
  // Kế toán (1)
  { key: 'giang', email: `giang.nguyen@${DOMAIN}`, name: 'Nguyễn Thị Hương Giang', role: 'Member', depts: ['fin'], title: 'Kế toán trưởng', gender: 'female' },
];

// Accounts that already existed on prod before Lumen (team members' Gmail / SSO
// logins and the old test accounts). Matched by email, never created; the seed
// gives each one a department, role and title so no member is anonymous.
// `rename` = replace the display name (only for throwaway test accounts).
const EXISTING_ACCOUNTS = [
  { key: 'khanggm', email: 'tranphuckhangvllvl@gmail.com', role: 'Admin', depts: ['bod'], title: 'Cố vấn chiến lược (đăng nhập Google của Khang)', gender: 'male' },
  { key: 'minhgm', email: 'nguyenkiminh1999@gmail.com', role: 'Member', depts: ['retail'], title: 'Integration Engineer (đăng nhập Google của Minh)', gender: 'male' },
  { key: 'trigm', email: 'caoduc.tri2k6@gmail.com', role: 'Member', depts: ['fleet'], title: 'Mobile QA Engineer (đăng nhập Google của Trí)', gender: 'male' },
  { key: 'bien', email: 'bienphan1306@gmail.com', role: 'Member', depts: ['sales'], title: 'Business Development Executive', gender: 'male' },
  { key: 'hau', email: 'chunhau.py@gmail.com', role: 'Member', depts: ['mkt'], title: 'Growth Marketer', gender: 'male' },
  { key: 'canglong', email: 'giadinhcanglonghoi@gmail.com', role: 'Member', depts: ['hr'], title: 'Hành chính tổng hợp', gender: 'female' },
  { key: 'phongne', email: 'phong.th@newera.inc', role: 'Member', depts: ['fin'], title: 'Kiểm soát nội bộ (tài khoản đối tác)', gender: 'male' },
  { key: 'tuananh', email: 'bytuam2@gmail.com', rename: 'Nguyễn Tuấn Anh', role: 'Member', depts: ['retail'], title: 'Thực tập sinh Frontend', gender: 'male' },
  { key: 'probe', email: 'probe-19402@example.com', rename: 'Lê Văn Thử', role: 'Member', depts: ['fleet'], title: 'Thực tập sinh QA', gender: 'male' },
  { key: 'towner', email: 'owner@example.com', rename: 'Phạm Quốc Bảo', role: 'Admin', depts: ['bod'], title: 'Thành viên HĐQT (tài khoản dự phòng)', gender: 'male' },
  { key: 'tadmin', email: 'admin@example.com', rename: 'Ngô Thị Thanh Vân', role: 'Admin', depts: ['hr'], title: 'Trợ lý Giám đốc vận hành (dự phòng)', gender: 'female' },
  { key: 'tmanager', email: 'manager@example.com', rename: 'Đỗ Minh Quân', role: 'Member', depts: ['sales'], title: 'Trưởng nhóm bán hàng (dự phòng)', gender: 'male' },
  { key: 'tmember', email: 'member@example.com', rename: 'Trần Thị Mai Phương', role: 'Member', depts: ['mkt'], title: 'Nhân viên nội dung (dự phòng)', gender: 'female' },
];

// Invite-only onboarding: what the admin screen shows.
const INVITATIONS = [
  { email: `backend.fleet@${DOMAIN}`, role: 'Member', depts: ['fleet'], invitedBy: 'oanh', status: 'pending', daysAgo: 2 },
  { email: `designer.retail@${DOMAIN}`, role: 'Member', depts: ['retail'], invitedBy: 'minh', status: 'pending', daysAgo: 4 },
  { email: `intern.sales@${DOMAIN}`, role: 'Member', depts: ['sales'], invitedBy: 'lananh', status: 'revoked', daysAgo: 20 },
];

// Role-aware AI context. cap = capability needed to see it; null = everyone.
const AI_CONTEXT = [
  { scope: 'company', label: 'Giới thiệu công ty', cap: null,
    text: 'Lumen Software thành lập tháng 4/2026 tại Quận 1, TP.HCM, 30 nhân sự. Công ty xây phần mềm vận hành cho bán lẻ và vận tải: RetailOS (quản lý chuỗi cửa hàng: POS, tồn kho, màn hình quảng cáo) và FleetPro (theo dõi xe GPS, điều phối giao hàng, app tài xế). Khách hàng đầu tiên: chuỗi siêu thị Minh Châu (RetailOS) và Vận tải Sao Đỏ (FleetPro). Sứ mệnh: "Phần mềm vận hành vừa túi cho doanh nghiệp Việt".' },
  { scope: 'company', label: 'Giờ làm việc & nghỉ phép', cap: null,
    text: 'Giờ làm 8:30–17:30 thứ 2–6, nghỉ trưa 12:00–13:00. WFH tối đa 2 ngày/tuần, đăng ký trên kênh phòng ban trước 17:00 hôm trước. Core hours 10:00–16:00. 12 ngày phép năm; xin nghỉ qua form HR trước 3 ngày làm việc, trưởng phòng duyệt.' },
  { scope: 'company', label: 'Công cụ nội bộ', cap: null,
    text: 'Chat, họp và trợ lý AI: PON. Quản lý task: Jira (dự án RETAIL, FLEET). Tài liệu: Notion "Lumen Wiki". Lịch: Google Calendar. Code: GitLab tự host. Tài liệu khách hàng lưu trên Drive công ty, không lưu máy cá nhân.' },
  { scope: 'company', label: 'Lộ trình 6 tháng tới (nội bộ)', cap: 'VIEW_INTERNAL_CONTEXT',
    text: 'Q4/2026: go-live RetailOS tại 12 siêu thị Minh Châu (28/10), FleetPro hoàn tất pilot 50 xe Sao Đỏ. Q1/2027: ký thêm 2 chuỗi bán lẻ, tuyển 6 kỹ sư, mở văn phòng Hà Nội. Mục tiêu doanh thu 2027: 24 tỷ VNĐ.' },
  { scope: 'company', label: 'Khung lương (mật)', cap: 'VIEW_CONFIDENTIAL_CONTEXT',
    text: 'Khung lương 2026 — Junior: 12–18 triệu, Middle: 20–32 triệu, Senior: 35–55 triệu, Lead: 55–75 triệu. Thưởng tháng 13 + thưởng dự án khi go-live đúng hạn (tối đa 20% lương). Tuyệt đối không chia sẻ cho nhân viên không có quyền.' },
  { scope: 'department', dept: 'retail', label: 'Stack & quy ước RetailOS', cap: null,
    text: 'RetailOS: backend Java 21 Spring Boot (dịch vụ POS, tồn kho) + Node.js (màn hình quảng cáo), web React, POS Android (Kotlin), PostgreSQL + Redis, triển khai Kubernetes trên hạ tầng Minh Châu. Nhánh feature cắt từ main, PR cần 1 review, release tối thứ 4, freeze code trưa thứ 4. Sprint 2 tuần, review thứ 6.' },
  { scope: 'department', dept: 'retail', label: 'Khách hàng Minh Châu', cap: null,
    text: 'Chuỗi siêu thị Minh Châu: 12 siêu thị tại TP.HCM và Bình Dương, ~480 SKU thực phẩm tươi. Đầu mối: anh Lê Văn Phát (Giám đốc vận hành), chị Trần Thu Thảo (IT). Pilot tại siêu thị Minh Châu Gò Vấp từ 15/9. Go-live toàn chuỗi 28/10/2026.' },
  { scope: 'department', dept: 'fleet', label: 'Stack & SLA FleetPro', cap: null,
    text: 'FleetPro: backend Go (ingest GPS qua MQTT, 1 bản tin/10 giây/xe), Next.js dashboard điều phối, app tài xế Flutter, TimescaleDB + Redis, thiết bị GPS Lumen-T1 (ESP32 + SIM 4G). SLA: dữ liệu vị trí trễ không quá 30 giây, dashboard uptime 99,5%. On-call xoay vòng theo tuần.' },
  { scope: 'department', dept: 'fleet', label: 'Khách hàng Sao Đỏ', cap: null,
    text: 'Vận tải Sao Đỏ: 180 xe tải giao hàng khu vực miền Nam, pilot 50 xe từ 1/9/2026. Đầu mối: anh Nguyễn Hữu Tài (Trưởng phòng điều phối). Yêu cầu quan trọng: cảnh báo lệch tuyến, chấm công tài xế qua app, báo cáo nhiên liệu.' },
  { scope: 'department', dept: 'sales', label: 'Chính sách chiết khấu', cap: null,
    text: 'Sales Executive được chiết khấu tối đa 5%, Account Executive 10%, Trưởng phòng Kinh doanh 15%. Trên 15% cần CEO duyệt. Hợp đồng trên 500 triệu phải có luật sư tư vấn review.' },
  { scope: 'department', dept: 'sales', label: 'Giá vốn & biên lợi nhuận (mật)', cap: 'VIEW_CONFIDENTIAL_CONTEXT',
    text: 'Giá vốn triển khai trung bình 42% giá bán; biên lợi nhuận gộp mục tiêu 50%. Hợp đồng Minh Châu: 1,8 tỷ/3 năm, biên 47%. Không tiết lộ cho khách hàng.' },
  { scope: 'department', dept: 'hr', label: 'Quy trình onboarding', cap: null,
    text: 'Ngày 1: nhận laptop, tài khoản PON qua lời mời, buddy giới thiệu team. Tuần 1: đọc Sổ tay nhân viên, hoàn thành khóa bảo mật nội bộ. Tháng 1: 1-1 với trưởng phòng hằng tuần, đánh giá thử việc ngày 55.' },
  { scope: 'department', dept: 'fin', label: 'Lịch chốt sổ', cap: null,
    text: 'Chốt chi phí ngày 25 hằng tháng, trả lương ngày 5. Hóa đơn đầu vào gửi kế toán trước ngày 28. Báo cáo thuế quý nộp trước ngày 30 tháng đầu quý sau.' },
];

// Personal AI context (jobTitle comes from PEOPLE title).
const USER_CONTEXT = {
  khang: { projects: ['Go-live RetailOS Minh Châu', 'Gọi vốn seed round'], style: 'Tóm tắt dạng gạch đầu dòng, nêu rủi ro trước, kết luận rõ.', preferences: 'Tiếng Việt, thuật ngữ kỹ thuật giữ tiếng Anh. Ưu tiên số liệu.' },
  dung: { projects: ['Vận hành & nhân sự', 'Chính sách WFH', 'Tuyển dụng Q4'], style: 'Trang trọng, rõ ràng, dẫn đúng điều khoản.', preferences: 'Dẫn chiếu Sổ tay nhân viên khi trả lời về chính sách.' },
  minh: { projects: ['RetailOS', 'Go-live Minh Châu 28/10'], style: 'Chi tiết kỹ thuật, có code mẫu khi cần, so sánh trade-off.', preferences: 'Tiếng Việt. Luôn kèm bước tiếp theo.' },
  tri: { projects: ['FleetPro — app tài xế (Flutter)'], style: 'Ngắn gọn, đi thẳng vấn đề, có snippet Dart khi cần.', preferences: 'Tiếng Việt, thuật ngữ Flutter giữ nguyên.' },
  huy: { projects: ['FleetPro', 'Pilot Sao Đỏ 50 xe'], style: 'Kỹ thuật, ưu tiên độ tin cậy và SLA.', preferences: 'Tiếng Việt.' },
  lananh: { projects: ['Pipeline Q4', 'Gia hạn Minh Châu'], style: 'Thân thiện, có thể gửi thẳng cho khách.', preferences: 'Luôn kèm next step và deadline.' },
};

module.exports = { DOMAIN, FOUNDED, WORKSPACE, DEPARTMENTS, PEOPLE, EXISTING_ACCOUNTS, INVITATIONS, AI_CONTEXT, USER_CONTEXT };
