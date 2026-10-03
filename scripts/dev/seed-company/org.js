// Fake company "NovaTech Solutions" — org chart, people, invitations and the
// role-aware AI context. Pure data: index.js writes it to Mongo.
//
// Every person is keyed by a short `key` that conversations.js refers to. The
// three pre-existing dev accounts (seed-users.js) join the company under the
// keys `dev`, `alice`, `bob` — they are NOT recreated here, only attached to
// departments, so their passwords / roles stay what seed-users.js set.

const DOMAIN = 'novatech.local';

const WORKSPACE = {
  name: 'NovaTech Solutions',
  primaryColor: '#7A2E3A',
  connectorAllowList: ['notion', 'gmail', 'calendar'],
  aiSettings: {
    personaName: 'Nova',
    defaultTone: 'professional',
    dailyDigestEnabled: true,
    dailyDigestHour: 8,
    monthlyTokenLimit: 5000000,
  },
};

// key → department. `lead` is a person key (resolved to an ObjectId later).
const DEPARTMENTS = [
  { key: 'bod', name: 'Ban Giám đốc', lead: 'quan', description: 'Điều hành, chiến lược và phê duyệt ngân sách toàn công ty.' },
  { key: 'eng', name: 'Kỹ thuật', lead: 'nam', description: 'Phát triển nền tảng PON: backend, web, mobile, DevOps và QA.' },
  { key: 'prd', name: 'Sản phẩm & Thiết kế', lead: 'vy', description: 'Quản lý sản phẩm, nghiên cứu người dùng và thiết kế UI/UX.' },
  { key: 'sales', name: 'Kinh doanh', lead: 'phuc', description: 'Bán hàng B2B, quản lý khách hàng doanh nghiệp và báo giá.' },
  { key: 'mkt', name: 'Marketing', lead: 'thao', description: 'Thương hiệu, nội dung, sự kiện và tạo lead.' },
  { key: 'hr', name: 'Nhân sự', lead: 'nhung', description: 'Tuyển dụng, onboarding, chính sách và phúc lợi.' },
  { key: 'fin', name: 'Tài chính - Kế toán', lead: 'long', description: 'Kế toán, thuế, lương thưởng và báo cáo tài chính.' },
  { key: 'cs', name: 'Chăm sóc khách hàng', lead: 'viet', description: 'Hỗ trợ khách hàng, xử lý ticket và đo lường CSAT.' },
];

// role = preset role name (Owner/Admin/Manager/Member). title feeds the AI
// user context (jobTitle) and the profile bio.
const PEOPLE = [
  // Ban Giám đốc
  { key: 'quan', email: `quan.nguyen@${DOMAIN}`, name: 'Nguyễn Minh Quân', role: 'Owner', depts: ['bod'], title: 'CEO', gender: 'male', phone: '+84901000001' },
  { key: 'ha', email: `ha.tran@${DOMAIN}`, name: 'Trần Thu Hà', role: 'Admin', depts: ['bod', 'hr'], title: 'COO', gender: 'female' },
  // Kỹ thuật
  { key: 'nam', email: `nam.le@${DOMAIN}`, name: 'Lê Hoàng Nam', role: 'Manager', depts: ['eng', 'bod'], title: 'CTO / Engineering Lead', gender: 'male' },
  { key: 'anh', email: `anh.pham@${DOMAIN}`, name: 'Phạm Đức Anh', role: 'Member', depts: ['eng'], title: 'Senior Backend Engineer (Spring Boot)', gender: 'male' },
  { key: 'lan', email: `lan.vo@${DOMAIN}`, name: 'Võ Thị Lan', role: 'Member', depts: ['eng'], title: 'Frontend Engineer (Next.js)', gender: 'female' },
  { key: 'bao', email: `bao.dang@${DOMAIN}`, name: 'Đặng Quốc Bảo', role: 'Member', depts: ['eng'], title: 'Mobile Engineer (Flutter)', gender: 'male' },
  { key: 'huy', email: `huy.huynh@${DOMAIN}`, name: 'Huỳnh Gia Huy', role: 'Admin', depts: ['eng'], title: 'DevOps Engineer', gender: 'male' },
  { key: 'linh', email: `linh.ngo@${DOMAIN}`, name: 'Ngô Mỹ Linh', role: 'Member', depts: ['eng'], title: 'QA Engineer', gender: 'female' },
  // Sản phẩm & Thiết kế
  { key: 'vy', email: `vy.bui@${DOMAIN}`, name: 'Bùi Khánh Vy', role: 'Manager', depts: ['prd'], title: 'Head of Product', gender: 'female' },
  { key: 'kiet', email: `kiet.do@${DOMAIN}`, name: 'Đỗ Tuấn Kiệt', role: 'Member', depts: ['prd'], title: 'UI/UX Designer', gender: 'male' },
  // Kinh doanh
  { key: 'phuc', email: `phuc.truong@${DOMAIN}`, name: 'Trương Văn Phúc', role: 'Manager', depts: ['sales'], title: 'Sales Manager', gender: 'male', phone: '+84901000013' },
  { key: 'tram', email: `tram.ly@${DOMAIN}`, name: 'Lý Ngọc Trâm', role: 'Member', depts: ['sales'], title: 'Account Executive', gender: 'female' },
  { key: 'son', email: `son.ho@${DOMAIN}`, name: 'Hồ Thanh Sơn', role: 'Member', depts: ['sales'], title: 'Sales Executive', gender: 'male' },
  // Marketing
  { key: 'thao', email: `thao.mai@${DOMAIN}`, name: 'Mai Phương Thảo', role: 'Manager', depts: ['mkt'], title: 'Marketing Manager', gender: 'female' },
  { key: 'minh', email: `minh.phan@${DOMAIN}`, name: 'Phan Nhật Minh', role: 'Member', depts: ['mkt'], title: 'Content Marketing Specialist', gender: 'male' },
  // Nhân sự
  { key: 'nhung', email: `nhung.vu@${DOMAIN}`, name: 'Vũ Hồng Nhung', role: 'Admin', depts: ['hr'], title: 'HR Manager', gender: 'female' },
  { key: 'ngoc', email: `ngoc.chau@${DOMAIN}`, name: 'Châu Bảo Ngọc', role: 'Member', depts: ['hr'], title: 'Recruiter', gender: 'female' },
  // Tài chính - Kế toán
  { key: 'long', email: `long.dinh@${DOMAIN}`, name: 'Đinh Văn Long', role: 'Manager', depts: ['fin'], title: 'Kế toán trưởng', gender: 'male' },
  { key: 'thu', email: `thu.ta@${DOMAIN}`, name: 'Tạ Minh Thư', role: 'Member', depts: ['fin'], title: 'Kế toán viên', gender: 'female' },
  // Chăm sóc khách hàng
  { key: 'viet', email: `viet.lam@${DOMAIN}`, name: 'Lâm Quốc Việt', role: 'Manager', depts: ['cs'], title: 'Customer Success Lead', gender: 'male' },
  { key: 'mai', email: `mai.cao@${DOMAIN}`, name: 'Cao Thị Mai', role: 'Member', depts: ['cs'], title: 'Support Agent', gender: 'female' },
  // Account blocked by an admin — tests the "account blocked" login path.
  { key: 'teo', email: `teo.nguyen@${DOMAIN}`, name: 'Nguyễn Văn Tèo', role: 'Member', depts: ['eng'], title: 'Thực tập sinh (đã nghỉ)', gender: 'male', status: 'blocked' },
];

// Existing dev accounts (seed-users.js) → which departments they join.
const EXISTING = [
  { key: 'dev', email: 'dev@pon.local', depts: ['eng', 'bod'], title: 'Tech Lead (tài khoản dev)' },
  { key: 'alice', email: 'alice@pon.local', depts: ['eng'], title: 'Backend Engineer' },
  { key: 'bob', email: 'bob@pon.local', depts: ['eng', 'cs'], title: 'Support Engineer' },
];

// Invite-only onboarding: pending, revoked and expired invitations.
const INVITATIONS = [
  { email: `newhire.backend@${DOMAIN}`, role: 'Member', depts: ['eng'], invitedBy: 'nhung', status: 'pending', daysAgo: 1 },
  { email: `designer.new@${DOMAIN}`, role: 'Member', depts: ['prd'], invitedBy: 'vy', status: 'pending', daysAgo: 3 },
  { email: `sales.intern@${DOMAIN}`, role: 'Member', depts: ['sales'], invitedBy: 'phuc', status: 'revoked', daysAgo: 5 },
  // created 10 days ago → past the 7-day TTL, shows as expired
  { email: `old.candidate@${DOMAIN}`, role: 'Member', depts: ['mkt'], invitedBy: 'nhung', status: 'pending', daysAgo: 10 },
];

// Role-aware AI context. requiredCapability gates who the assistant may reveal
// an entry to — null = everyone in scope.
const AI_CONTEXT = [
  { scope: 'company', label: 'Giới thiệu công ty', text: 'NovaTech Solutions (thành lập 2019, trụ sở Quận 3, TP.HCM, ~120 nhân sự) cung cấp nền tảng trợ lý AI tự host PON cho doanh nghiệp. Sứ mệnh: "AI làm việc cùng con người, dữ liệu nằm trong tay doanh nghiệp".', cap: null },
  { scope: 'company', label: 'Giờ làm việc & nghỉ phép', text: 'Giờ làm 8:30–17:30 thứ 2–6, nghỉ trưa 12:00–13:00. Được WFH tối đa 2 ngày/tuần (báo trước trên kênh phòng ban). 12 ngày phép năm, +1 ngày mỗi 3 năm thâm niên. Xin nghỉ qua form HR trước 3 ngày làm việc.', cap: null },
  { scope: 'company', label: 'Công cụ nội bộ', text: 'Chat & AI: PON. Quản lý task: Jira (dự án PON, ERP). Tài liệu: Notion workspace "NovaTech Wiki". Lịch họp: Google Calendar. Mọi tài liệu khách hàng phải lưu trong Drive công ty, không lưu máy cá nhân.', cap: null },
  { scope: 'company', label: 'Lộ trình 2026 (nội bộ)', text: 'Q4/2026: ra mắt PON 2.0 với Meeting Room (LiveKit), mở rộng connector Jira + Slack, ký 5 khách hàng enterprise mới. Mục tiêu doanh thu năm 2026: 18 tỷ VNĐ.', cap: 'VIEW_INTERNAL_CONTEXT' },
  { scope: 'company', label: 'Khung lương (mật)', text: 'Khung lương 2026 — Junior: 12–18tr, Middle: 20–32tr, Senior: 35–55tr, Lead: 55–75tr. Thưởng tháng 13 + thưởng KPI quý tối đa 20% lương. Thông tin này tuyệt đối không chia sẻ cho nhân viên không có quyền.', cap: 'VIEW_CONFIDENTIAL_CONTEXT' },
  { scope: 'department', dept: 'eng', label: 'Quy chuẩn kỹ thuật', text: 'Nhánh feature cắt từ main, test trên dev, PR vào main cần 1 review. Java chạy spotless:apply trước khi commit. Release tối thứ 5, freeze code trưa thứ 5. On-call DevOps xoay vòng theo tuần.', cap: null },
  { scope: 'department', dept: 'sales', label: 'Chính sách chiết khấu', text: 'Sales Executive được chiết khấu tối đa 5%, Account Executive 10%, Sales Manager 15%. Trên 15% cần CEO duyệt. Hợp đồng > 500 triệu phải có pháp chế review.', cap: null },
  { scope: 'department', dept: 'sales', label: 'Giá vốn & biên lợi nhuận (mật)', text: 'Giá vốn triển khai trung bình 38% giá bán; biên lợi nhuận gộp mục tiêu 55%. Không tiết lộ cho khách hàng.', cap: 'VIEW_CONFIDENTIAL_CONTEXT' },
  { scope: 'department', dept: 'cs', label: 'SLA hỗ trợ', text: 'Gói Enterprise: phản hồi P1 trong 30 phút, P2 trong 4 giờ, P3 trong 1 ngày làm việc. Gói Business: P1 trong 2 giờ. Ticket mở > 3 ngày phải escalate cho CS Lead.', cap: null },
  { scope: 'department', dept: 'hr', label: 'Quy trình onboarding', text: 'Ngày 1: nhận laptop, tài khoản PON qua lời mời, buddy giới thiệu team. Tuần 1: đọc Sổ tay nhân viên, hoàn thành khóa bảo mật. Tháng 1: 1-1 với quản lý hằng tuần, đánh giá thử việc ngày 55.', cap: null },
  { scope: 'department', dept: 'fin', label: 'Lịch chốt sổ', text: 'Chốt chi phí ngày 25 hằng tháng, trả lương ngày 5. Hóa đơn đầu vào phải gửi kế toán trước ngày 28. Báo cáo thuế quý nộp trước ngày 30 tháng đầu quý sau.', cap: null },
];

// Personal AI context (jobTitle comes from PEOPLE/EXISTING title).
const USER_CONTEXT = {
  dev: { projects: ['PON Platform', 'ERP ABC Corp'], style: 'Ngắn gọn, đi thẳng vào vấn đề, có code mẫu khi cần.', preferences: 'Trả lời bằng tiếng Việt, thuật ngữ kỹ thuật giữ tiếng Anh.' },
  quan: { projects: ['Chiến lược 2027', 'Gọi vốn Series A'], style: 'Tóm tắt dạng gạch đầu dòng, nêu rủi ro trước.', preferences: 'Ưu tiên số liệu và kết luận.' },
  nam: { projects: ['PON Platform', 'Meeting Room LiveKit'], style: 'Chi tiết kỹ thuật, so sánh trade-off.', preferences: 'Tiếng Việt.' },
  phuc: { projects: ['ERP ABC Corp', 'Pipeline Q4'], style: 'Thân thiện, có thể dùng để gửi khách.', preferences: 'Luôn kèm bước tiếp theo (next step).' },
  nhung: { projects: ['Tuyển dụng Q4', 'Chính sách WFH'], style: 'Trang trọng, rõ ràng.', preferences: 'Dẫn chiếu đúng điều khoản trong Sổ tay nhân viên.' },
  viet: { projects: ['CSAT Q4'], style: 'Đồng cảm với khách hàng, có template trả lời.', preferences: 'Tiếng Việt.' },
};

module.exports = {
  DOMAIN, WORKSPACE, DEPARTMENTS, PEOPLE, EXISTING, INVITATIONS, AI_CONTEXT, USER_CONTEXT,
};
