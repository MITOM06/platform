// Fake files for the NovaTech company: knowledge-base documents (real text the
// RAG pipeline can embed and quote), a real PDF, CSV reports and PNG images.
// Everything is generated in-process — no binary fixtures in git.

const path = require('node:path');
const ROOT = path.resolve(__dirname, '../../..');
const sharp = require(path.join(ROOT, 'node_modules/sharp'));

// ------------------------------------------------------------------- KB text

const HANDBOOK = `# Sổ tay nhân viên NovaTech Solutions 2026

## 1. Giờ làm việc
- Thứ 2 đến thứ 6: 8:30 – 17:30, nghỉ trưa 12:00 – 13:00.
- Làm việc từ xa (WFH): tối đa 2 ngày mỗi tuần, đăng ký trên kênh phòng ban trước 17:00 ngày hôm trước.
- Core hours bắt buộc online: 10:00 – 16:00.

## 2. Nghỉ phép
- 12 ngày phép năm; cứ 3 năm thâm niên được cộng thêm 1 ngày.
- Phép năm chưa dùng được chuyển sang quý 1 năm sau, tối đa 5 ngày.
- Nghỉ ốm có giấy bác sĩ không trừ phép, tối đa 30 ngày/năm.
- Nghỉ cưới 3 ngày, nghỉ khi con kết hôn 1 ngày, nghỉ tang 3 ngày.
- Mã chính sách nghỉ phép: HR-LEAVE-2026.

## 3. Phúc lợi
- Bảo hiểm sức khỏe PVI gói Vàng cho nhân viên chính thức, người thân được mua với giá ưu đãi.
- Phụ cấp ăn trưa 1.200.000đ/tháng, gửi xe miễn phí.
- Ngân sách học tập 8.000.000đ/năm cho khóa học, sách, chứng chỉ.
- Khám sức khỏe định kỳ tháng 6 hằng năm.
- Team building 2 lần/năm, company trip tháng 7.

## 4. Làm thêm giờ
- OT phải được quản lý trực tiếp duyệt trước trên PON.
- Ngày thường x1.5, cuối tuần x2, ngày lễ x3.

## 5. Bảo mật thông tin
- Không chia sẻ tài liệu khách hàng ra ngoài Drive công ty.
- Bật xác thực 2 lớp cho mọi tài khoản công ty.
- Báo ngay sự cố bảo mật cho DevOps (Huỳnh Gia Huy) qua kênh #ky-thuat.

## 6. Liên hệ
- Nhân sự: Vũ Hồng Nhung — nhung.vu@novatech.local
- Kế toán/lương: Đinh Văn Long — long.dinh@novatech.local
`;

const PRICING = `# Bảng giá dịch vụ PON 2026 (áp dụng từ 01/07/2026)

| Gói | Đối tượng | Giá/người dùng/tháng | Tối thiểu |
|-----|-----------|----------------------|-----------|
| Starter | Doanh nghiệp nhỏ < 30 người | 150.000đ | 10 user |
| Business | 30 – 300 người | 240.000đ | 30 user |
| Enterprise | > 300 người, self-host | Liên hệ (từ 180.000đ) | 300 user |

## Phí triển khai một lần
- Starter: miễn phí.
- Business: 25.000.000đ (cài đặt, cấu hình SSO, 1 buổi đào tạo).
- Enterprise self-host: từ 120.000.000đ (hạ tầng on-premise, connector tùy chỉnh, 3 buổi đào tạo).

## Add-on
- Connector tùy chỉnh (custom MCP): 15.000.000đ/connector.
- Gói AI token mở rộng: 2.000.000đ cho mỗi 10 triệu token.
- Hỗ trợ 24/7 (SLA P1 30 phút): +20% giá trị hợp đồng năm.

## Chính sách thanh toán
- Thanh toán theo năm được giảm 10%.
- Hợp đồng 3 năm được giảm thêm 5%.
- Mã bảng giá: PRICE-2026-H2.
`;

const ENG_STANDARDS = `# Quy chuẩn code và quy trình release — Phòng Kỹ thuật

## Git flow
1. Cắt nhánh feat/<tên> từ main.
2. Merge vào dev để test trên môi trường chung.
3. Mở PR feat/<tên> → main khi đã pass trên dev; cần ít nhất 1 approve.
4. Không bao giờ merge dev vào main.

## Review checklist
- Có test cho logic mới; coverage không giảm.
- Không log token, mật khẩu, PII.
- UI không hiển thị raw error, raw ID hay JSON.
- Web và mobile phải đồng bộ tính năng.

## Release
- Freeze code: 12:00 thứ 5. Release: 20:00 thứ 5.
- Rollback nếu error rate > 2% trong 30 phút đầu.
- Người trực release tuần này ghi trong kênh #ky-thuat (pin).

## On-call
- DevOps xoay vòng theo tuần, đổi ca 9:00 thứ 2.
- Sự cố P1: gọi on-call trong 15 phút, viết postmortem trong 48 giờ.
- Mã quy trình: ENG-REL-07.
`;

const ONBOARDING = `QUY TRÌNH ONBOARDING NHÂN VIÊN MỚI — NOVATECH (mã ONB-2026)

Trước ngày 1:
- HR gửi lời mời tham gia PON tới email công ty.
- DevOps chuẩn bị laptop, tài khoản Google Workspace, Jira, Notion.

Ngày 1:
- 9:00 đón tiếp tại lễ tân tầng 5, nhận thẻ nhân viên.
- 10:00 buddy giới thiệu team và văn phòng.
- 14:00 HR hướng dẫn Sổ tay nhân viên và chính sách bảo mật.

Tuần 1:
- Hoàn thành khóa "Bảo mật thông tin cơ bản" trên LMS (bắt buộc).
- Thiết lập xác thực 2 lớp.
- 1-1 với quản lý trực tiếp để thống nhất mục tiêu 30-60-90 ngày.

Tháng 1-2:
- 1-1 hằng tuần với quản lý.
- Ngày 55: đánh giá thử việc. Kết quả gửi HR trước ngày 58.

Liên hệ: Châu Bảo Ngọc (Recruiter) — ngoc.chau@novatech.local
`;

const REVENUE_CSV = `Thang,Khach hang moi,Doanh thu (trieu VND),Chi phi (trieu VND),Loi nhuan gop (trieu VND)
2026-07,3,1420,690,730
2026-08,2,1310,655,655
2026-09,4,1785,812,973
Tong Q3,9,4515,2157,2358
`;

const MKT_PLAN_CSV = `Hang muc,Kenh,Ngan sach (trieu VND),Thoi gian,Phu trach,KPI
Webinar "AI tu host cho doanh nghiep",Zoom + LinkedIn,35,15/10/2026,Mai Phuong Thao,300 dang ky
Case study ABC Corp,Website + Email,12,30/10/2026,Phan Nhat Minh,50 lead
Trien lam Vietnam ICT Expo,Offline,120,12-14/11/2026,Mai Phuong Thao,80 lead
Quang cao Google Ads,Search,60,10-12/2026,Phan Nhat Minh,CPL < 400k
`;

// ---------------------------------------------------------------------- PDF

/**
 * Minimal, valid single-font PDF (Helvetica, WinAnsi) — enough for pdf-parse to
 * extract real text. ASCII only: the standard fonts have no Vietnamese glyphs.
 */
function makePdf(title, lines) {
  const esc = (s) => s.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
  const perPage = 40;
  const pages = [];
  for (let i = 0; i < lines.length; i += perPage) pages.push(lines.slice(i, i + perPage));

  const objs = [];
  const add = (body) => { objs.push(body); return objs.length; };
  const catalogId = add(null);
  const pagesId = add(null);
  const fontId = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
  const pageIds = pages.map((pageLines, idx) => {
    const ops = ['BT', '/F1 16 Tf', '50 790 Td', `(${esc(idx === 0 ? title : `${title} (cont.)`)}) Tj`, '/F1 11 Tf', '0 -28 Td'];
    for (const l of pageLines) ops.push(`(${esc(l)}) Tj`, '0 -17 Td');
    ops.push('ET');
    const stream = ops.join('\n');
    const contentId = add(`<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`);
    return add(`<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 ${fontId} 0 R >> >> /Contents ${contentId} 0 R >>`);
  });
  objs[catalogId - 1] = `<< /Type /Catalog /Pages ${pagesId} 0 R >>`;
  objs[pagesId - 1] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pageIds.length} >>`;

  let out = '%PDF-1.4\n';
  const offsets = [];
  objs.forEach((body, i) => {
    offsets.push(Buffer.byteLength(out));
    out += `${i + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xref = Buffer.byteLength(out);
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n`;
  for (const o of offsets) out += `${String(o).padStart(10, '0')} 00000 n \n`;
  out += `trailer\n<< /Size ${objs.length + 1} /Root ${catalogId} 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(out, 'latin1');
}

const ERP_REQUIREMENTS = makePdf('ABC Corp - ERP Integration Requirements v1.2', [
  'Client: ABC Corp (manufacturing, 850 employees, Binh Duong)',
  'Contract code: NT-ABC-2026-014    Value: 1,250,000,000 VND (3 years)',
  'Project manager: Bui Khanh Vy    Tech lead: Le Hoang Nam',
  '',
  '1. Scope',
  '- Self-hosted PON Enterprise on ABC on-premise servers (2 nodes).',
  '- SSO with ABC Azure AD (OIDC), group -> department mapping.',
  '- Custom MCP connector to ABC SAP ERP: read inventory, purchase orders.',
  '- AI assistant answers stock questions, e.g. "How many units of SKU-4471 left?"',
  '',
  '2. Milestones',
  '- M1 (2026-10-20): infrastructure ready, SSO login working.',
  '- M2 (2026-11-15): SAP connector read-only, UAT with warehouse team.',
  '- M3 (2026-12-10): go-live for 850 users, training 3 sessions.',
  '',
  '3. Non-functional requirements',
  '- Response time of AI answer < 6 seconds for 95% of requests.',
  '- All data stays inside ABC network; no external storage.',
  '- Audit log retained 24 months.',
  '',
  '4. Acceptance',
  '- UAT sign-off by ABC IT director Mr. Tran Quoc Dung.',
  '- Penalty: 0.5% contract value per week of delay after M3.',
]);

// -------------------------------------------------------------------- images

const PALETTE = ['#7A2E3A', '#8C5A3C', '#4F6D5E', '#3E5C76', '#6B5B95', '#A0522D', '#5D6D7E', '#9C3D54'];

function initialsOf(name) {
  const parts = name.trim().split(/\s+/);
  const pick = parts.length > 1 ? [parts[parts.length - 2], parts[parts.length - 1]] : [parts[0]];
  return pick.map((p) => p[0]).join('').toUpperCase();
}

async function svgToPng(svg) {
  return sharp(Buffer.from(svg)).png().toBuffer();
}

async function avatarPng(name, idx) {
  const bg = PALETTE[idx % PALETTE.length];
  return svgToPng(`<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256">
    <rect width="256" height="256" fill="${bg}"/>
    <text x="128" y="128" dy="0.35em" text-anchor="middle" font-family="Helvetica, Arial, sans-serif"
      font-size="104" font-weight="600" fill="#F5F2ED">${initialsOf(name)}</text></svg>`);
}

async function revenueChartPng() {
  const bars = [1420, 1310, 1785];
  const labels = ['T7', 'T8', 'T9'];
  const rects = bars.map((v, i) => {
    const h = Math.round((v / 2000) * 300);
    const x = 140 + i * 200;
    return `<rect x="${x}" y="${400 - h}" width="120" height="${h}" rx="6" fill="#7A2E3A"/>
      <text x="${x + 60}" y="${390 - h}" text-anchor="middle" font-size="22" fill="#2B2A28" font-family="Helvetica">${v}</text>
      <text x="${x + 60}" y="435" text-anchor="middle" font-size="22" fill="#6E6A64" font-family="Helvetica">${labels[i]}</text>`;
  }).join('');
  return svgToPng(`<svg xmlns="http://www.w3.org/2000/svg" width="800" height="480">
    <rect width="800" height="480" fill="#F5F2ED"/>
    <text x="40" y="56" font-size="28" font-weight="700" fill="#2B2A28" font-family="Helvetica">Doanh thu Q3/2026 (trieu VND)</text>
    <line x1="100" y1="400" x2="760" y2="400" stroke="#CFC8BE" stroke-width="2"/>${rects}</svg>`);
}

async function bannerPng() {
  return svgToPng(`<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="628">
    <rect width="1200" height="628" fill="#2B2A28"/>
    <rect x="0" y="0" width="16" height="628" fill="#7A2E3A"/>
    <text x="90" y="250" font-size="64" font-weight="700" fill="#F5F2ED" font-family="Helvetica">AI tu host cho doanh nghiep</text>
    <text x="90" y="330" font-size="34" fill="#CFC8BE" font-family="Helvetica">Webinar 15/10/2026 - 14:00 - NovaTech x PON</text>
    <rect x="90" y="400" width="300" height="70" rx="10" fill="#7A2E3A"/>
    <text x="240" y="446" text-anchor="middle" font-size="28" fill="#F5F2ED" font-family="Helvetica">Dang ky ngay</text></svg>`);
}

async function wireframePng() {
  return svgToPng(`<svg xmlns="http://www.w3.org/2000/svg" width="900" height="560">
    <rect width="900" height="560" fill="#FFFFFF"/>
    <rect x="20" y="20" width="200" height="520" rx="8" fill="#EDE8E1"/>
    <rect x="240" y="20" width="640" height="60" rx="8" fill="#EDE8E1"/>
    <rect x="240" y="100" width="300" height="80" rx="16" fill="#F5F2ED" stroke="#CFC8BE"/>
    <rect x="560" y="200" width="320" height="80" rx="16" fill="#7A2E3A"/>
    <rect x="240" y="300" width="380" height="120" rx="16" fill="#F5F2ED" stroke="#CFC8BE"/>
    <rect x="240" y="470" width="640" height="56" rx="28" fill="#EDE8E1"/>
    <text x="40" y="60" font-size="20" fill="#6E6A64" font-family="Helvetica">Meeting Room</text>
    <text x="260" y="58" font-size="20" fill="#6E6A64" font-family="Helvetica">Wireframe v3 - Lobby + active speaker</text></svg>`);
}

async function whiteboardPng() {
  return svgToPng(`<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="620">
    <rect width="1000" height="620" fill="#FBFAF7"/>
    <text x="40" y="70" font-size="34" font-weight="700" fill="#2B2A28" font-family="Helvetica">Sprint 42 retro</text>
    <rect x="40" y="110" width="290" height="460" rx="10" fill="#E3EFE6"/>
    <rect x="355" y="110" width="290" height="460" rx="10" fill="#F6E3E3"/>
    <rect x="670" y="110" width="290" height="460" rx="10" fill="#E6E9F2"/>
    <text x="60" y="150" font-size="24" fill="#2B2A28" font-family="Helvetica">Went well</text>
    <text x="375" y="150" font-size="24" fill="#2B2A28" font-family="Helvetica">To improve</text>
    <text x="690" y="150" font-size="24" fill="#2B2A28" font-family="Helvetica">Actions</text>
    <text x="60" y="200" font-size="20" fill="#4A4743" font-family="Helvetica">- KB upload fixed</text>
    <text x="60" y="235" font-size="20" fill="#4A4743" font-family="Helvetica">- 0 P1 incidents</text>
    <text x="375" y="200" font-size="20" fill="#4A4743" font-family="Helvetica">- Flaky e2e tests</text>
    <text x="375" y="235" font-size="20" fill="#4A4743" font-family="Helvetica">- Late code review</text>
    <text x="690" y="200" font-size="20" fill="#4A4743" font-family="Helvetica">- Review SLA 24h</text>
    <text x="690" y="235" font-size="20" fill="#4A4743" font-family="Helvetica">- Quarantine flaky</text></svg>`);
}

/**
 * All files keyed by a short name conversations.js refers to. `kb: true`
 * files are also registered as knowledge-base documents of the conversation
 * they are posted in (so ai-service embeds them and RAG can quote them).
 */
async function buildFiles() {
  const txt = (s) => Buffer.from(s, 'utf8');
  return {
    handbook: { name: 'So-tay-nhan-vien-NovaTech-2026.md', mime: 'text/markdown', buf: txt(HANDBOOK), kb: true },
    pricing: { name: 'Bang-gia-dich-vu-PON-2026.md', mime: 'text/markdown', buf: txt(PRICING), kb: true },
    engStandards: { name: 'Quy-chuan-code-va-release.md', mime: 'text/markdown', buf: txt(ENG_STANDARDS), kb: true },
    onboarding: { name: 'Quy-trinh-onboarding.txt', mime: 'text/plain', buf: txt(ONBOARDING), kb: true },
    erpPdf: { name: 'ABC-Corp-ERP-Requirements-v1.2.pdf', mime: 'application/pdf', buf: ERP_REQUIREMENTS, kb: true },
    revenueCsv: { name: 'Bao-cao-doanh-thu-Q3-2026.csv', mime: 'text/csv', buf: txt(REVENUE_CSV), kb: true },
    mktPlanCsv: { name: 'Ke-hoach-marketing-Q4-2026.csv', mime: 'text/csv', buf: txt(MKT_PLAN_CSV), kb: false },
    revenueChart: { name: 'doanh-thu-q3.png', mime: 'image/png', buf: await revenueChartPng(), image: true },
    banner: { name: 'banner-webinar.png', mime: 'image/png', buf: await bannerPng(), image: true },
    wireframe: { name: 'meeting-room-wireframe-v3.png', mime: 'image/png', buf: await wireframePng(), image: true },
    whiteboard: { name: 'sprint-42-retro.png', mime: 'image/png', buf: await whiteboardPng(), image: true },
  };
}

module.exports = { buildFiles, avatarPng };
