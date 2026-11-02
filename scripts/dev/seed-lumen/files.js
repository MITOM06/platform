// Real file bytes for the Lumen seed: markdown/txt/csv documents (knowledge
// base), a PDF contract, and PNG images rendered from SVG with sharp.

const fs = require('node:fs');
const path = require('node:path');
const { mod } = require('./lib');
const org = require('./org');
const sharp = mod('sharp');

// Prefer a PNG rendered by prebuild.js (fonts!) over rendering here.
const PREBUILT = path.join(__dirname, 'prebuilt');
function prebuilt(name, render) {
  const f = path.join(PREBUILT, `${name}.png`);
  return fs.existsSync(f) ? Promise.resolve(fs.readFileSync(f)) : render();
}

// ------------------------------------------------------------- documents

const HANDBOOK = `# Sổ tay nhân viên Lumen Software 2026

## 1. Giới thiệu
Lumen Software thành lập ngày 14/04/2026 tại Quận 1, TP.HCM. Chúng ta xây phần mềm vận hành cho
bán lẻ (RetailOS) và vận tải (FleetPro). Giá trị cốt lõi: làm thật, nói thẳng, giao đúng hạn.

## 2. Giờ làm việc
- 8:30–17:30 thứ 2 đến thứ 6, nghỉ trưa 12:00–13:00.
- Core hours 10:00–16:00 bắt buộc online.
- WFH tối đa 2 ngày/tuần, đăng ký trên kênh phòng ban trước 17:00 hôm trước.

## 3. Nghỉ phép
- 12 ngày phép năm, tính theo tỷ lệ từ ngày vào làm.
- Phép chưa dùng được chuyển sang quý 1 năm sau, tối đa 5 ngày.
- Xin nghỉ qua form HR trước 3 ngày làm việc, trưởng phòng duyệt. Nghỉ ốm báo trước 9:00 cùng ngày.

## 4. Phúc lợi
- Bảo hiểm sức khỏe Bảo Việt gói Bạc sau thử việc.
- Phụ cấp ăn trưa 900.000đ/tháng, gửi xe miễn phí tại tòa nhà.
- Ngân sách học tập 5.000.000đ/người/năm (khóa học, sách, hội thảo).
- Thưởng tháng 13 và thưởng dự án khi go-live đúng hạn.

## 5. Bảo mật
- Dữ liệu khách hàng (Minh Châu, Sao Đỏ) chỉ lưu trên hệ thống công ty.
- Bật 2FA cho mọi tài khoản. Không chia sẻ mật khẩu qua chat.
- Laptop phải bật mã hóa ổ đĩa và khóa màn hình sau 5 phút.

## 6. Liên hệ
HR: Phùng Thị Kim Oanh (oanh.phung@lumensoft.vn). Vận hành: Nguyễn Hoàng Dũng.
`;

// Org chart + project portfolio, built from org.js so it matches the member
// list and the AI context entries of the same name.
function orgChartMd() {
  const byKey = Object.fromEntries(org.PEOPLE.map((p) => [p.key, p]));
  const sections = org.DEPARTMENTS.map((d) => {
    const people = org.PEOPLE.filter((p) => p.depts.includes(d.key)).map((p) => `- ${p.name} — ${p.title}`);
    // Existing accounts: the seed knows their title but not always their name
    // (team members' Google logins) — strip the seed's own notes from the title.
    const existing = org.EXISTING_ACCOUNTS.filter((p) => p.depts.includes(d.key));
    const named = existing.filter((p) => p.rename).map((p) => `- ${p.rename} — ${p.title.replace(/\s*\(.*\)\s*$/, '')}`);
    const unnamed = existing.length - named.length;
    const extra = unnamed ? [`- cùng ${unnamed} thành viên khác đăng nhập bằng tài khoản Google`] : [];
    return `## ${d.name} — ${people.length + existing.length} người\nTrưởng phòng: ${byKey[d.lead].name}. ${d.description}\n\n${[...people, ...named, ...extra].join('\n')}\n`;
  });
  return `# Sơ đồ tổ chức & danh mục dự án Lumen Software — 10/2026

Tổng nhân sự: ${org.HEADCOUNT} người, 7 phòng ban. Mỗi người có thể thuộc nhiều phòng.

## Ban Giám đốc & trưởng phòng
${org.LEADERSHIP_TEXT}

${sections.join('\n')}
## Danh mục dự án
${org.PROJECTS_TEXT}
`;
}

const RETAIL_SPEC = `# RetailOS — Đặc tả hệ thống v1.3

Khách hàng: Chuỗi siêu thị Minh Châu (12 siêu thị, TP.HCM & Bình Dương). Trưởng dự án: Nguyễn Kim Minh.

## 1. Phạm vi
- POS Android: bán hàng, thanh toán tiền mặt / QR VietQR / thẻ, in hóa đơn, hoạt động offline tối đa 8 giờ.
- Tồn kho: nhập hàng, kiểm kê, cảnh báo hết hàng, hạn dùng thực phẩm tươi.
- Màn hình quảng cáo: lịch phát nội dung theo cửa hàng và khung giờ.
- Dashboard trung tâm: doanh thu theo cửa hàng, SKU bán chạy, tồn kho toàn chuỗi.

## 2. Kiến trúc
- Backend Java 21 Spring Boot (pos-service, inventory-service), Node.js (signage-service).
- PostgreSQL 16 + Redis 7. Message queue: RabbitMQ cho đồng bộ POS offline.
- Web React + Vite. POS Android Kotlin. Triển khai Kubernetes trên hạ tầng Minh Châu.

## 3. Yêu cầu phi chức năng
- Thanh toán tại POS phản hồi dưới 2 giây.
- Đồng bộ tồn kho giữa các siêu thị trong 60 giây.
- Dữ liệu khách hàng không rời hạ tầng Minh Châu.

## 4. Mốc
- Pilot Minh Châu Gò Vấp: 15/09/2026 (đã xong).
- UAT toàn chuỗi: 20/10/2026.
- Go-live 12 siêu thị: 28/10/2026.
- Bảo hành 12 tháng, SLA sự cố P1 phản hồi trong 30 phút.
`;

const RETAIL_API = `# RetailOS — API POS v2

Base URL: https://api.retailos.minhchau.local/v2 — xác thực bằng JWT của thiết bị POS (hạn 24 giờ).

## Đơn hàng
- POST /orders — tạo đơn. Body: storeId, items[{sku, qty, unitPrice}], payment{method: CASH|VIETQR|CARD}.
- Đơn offline gửi kèm header X-Offline-Id để chống trùng khi đồng bộ lại.
- GET /orders/{id} — chi tiết đơn, trạng thái PAID | REFUNDED | VOID.

## Tồn kho
- GET /inventory?storeId=&sku= — tồn hiện tại, cập nhật mỗi 60 giây.
- POST /inventory/adjust — kiểm kê, cần quyền STOCK_ADJUST.

## Mã lỗi
- POS_001 thiết bị chưa kích hoạt · POS_014 SKU không tồn tại · POS_022 QR hết hạn (300 giây) · POS_031 trùng X-Offline-Id.

## Giới hạn
- 120 request/phút/thiết bị. Vượt → HTTP 429, POS tự thử lại sau 5 giây.
`;

const FLEET_SPEC = `# FleetPro — Đặc tả hệ thống v1.1

Khách hàng: Vận tải Sao Đỏ (180 xe tải giao hàng miền Nam). Trưởng dự án: Đặng Quốc Huy.

## 1. Phạm vi
- Theo dõi vị trí xe theo thời gian thực từ thiết bị GPS Lumen-T1.
- Điều phối: tạo chuyến, gán tài xế, tối ưu lộ trình nhiều điểm giao.
- App tài xế (Flutter): nhận chuyến, chấm công, xác nhận giao hàng bằng ảnh, báo sự cố.
- Cảnh báo: lệch tuyến trên 500 m, dừng quá 20 phút, quá tốc độ 80 km/h.
- Báo cáo: quãng đường, nhiên liệu ước tính, hiệu suất tài xế.

## 2. Kiến trúc
- Ingest Go nhận MQTT từ thiết bị, 1 bản tin / 10 giây / xe.
- TimescaleDB lưu vị trí, Redis cho trạng thái hiện tại, Next.js dashboard điều phối.
- Tối ưu lộ trình: OR-Tools, chạy batch mỗi 5 phút.

## 3. SLA
- Vị trí trễ không quá 30 giây. Dashboard uptime 99,5%.
- Mất sóng: thiết bị lưu đệm 2 giờ và gửi bù.

## 4. Mốc
- Kickoff: 12/05/2026. Pilot 50 xe: 01/09/2026. Mở rộng 180 xe: 15/12/2026.
`;

const GPS_PROTO = `# FleetPro — Giao thức thiết bị Lumen-T1

Phần cứng: ESP32-S3, module GPS u-blox M10, SIM 4G Cat-1, pin dự phòng 2.000 mAh. Firmware hiện tại: 1.4.2.

## Kết nối
- MQTT over TLS tới mqtt.fleetpro.saodo.local:8883, client id = IMEI.
- Topic gửi: fleet/{imei}/pos — JSON {ts, lat, lng, speed, heading, ign, batt}.
- Topic nhận: fleet/{imei}/cmd — lệnh reboot, set_interval, ota.

## Chu kỳ
- Xe nổ máy: 10 giây/bản tin. Xe tắt máy: 5 phút/bản tin.
- Mất sóng: lưu đệm tối đa 2 giờ (720 bản tin), gửi bù khi có mạng theo thứ tự cũ → mới.

## Lỗi đã biết
- FW 1.3.x: khi batt dưới 10% thiết bị reboot lặp. Đã sửa ở 1.4.0.
- FW 1.4.1: bản tin bù gửi sai thứ tự khi đệm đầy. Đã sửa ở 1.4.2.
`;

const PRICING = `# Bảng giá Lumen Software 2026

## RetailOS (quản lý chuỗi cửa hàng)
| Gói | Phạm vi | Giá |
|---|---|---|
| Starter | đến 3 cửa hàng, POS + tồn kho | 4.500.000đ/cửa hàng/tháng |
| Chain | 4–20 cửa hàng, thêm màn hình quảng cáo + dashboard chuỗi | 3.800.000đ/cửa hàng/tháng |
| Enterprise | trên 20 cửa hàng, triển khai trên hạ tầng khách | Liên hệ (từ 1,5 tỷ/3 năm) |

## FleetPro (quản lý đội xe)
| Gói | Phạm vi | Giá |
|---|---|---|
| Fleet 50 | đến 50 xe, thiết bị Lumen-T1 kèm theo | 180.000đ/xe/tháng |
| Fleet 200 | 51–200 xe, tối ưu lộ trình | 150.000đ/xe/tháng |
| Enterprise | trên 200 xe, tích hợp ERP | Liên hệ |

## Phí triển khai
- RetailOS: 25.000.000đ/cửa hàng (khảo sát, cài đặt, đào tạo 2 buổi).
- FleetPro: thiết bị Lumen-T1 2.400.000đ/xe, lắp đặt 300.000đ/xe.
- Hỗ trợ P1 trong 30 phút với gói Enterprise, 2 giờ với các gói còn lại.
`;

const KICKOFF = `# Biên bản họp kickoff FleetPro — 12/05/2026

Tham dự: Trần Phúc Khang (CEO), Hoàng Anh Tuấn (CTO), Đặng Quốc Huy (PM), Nguyễn Thanh Hải, Võ Minh Khôi, Phan Thị Thu Trang, Phạm Minh Trí. Phía Sao Đỏ: anh Nguyễn Hữu Tài.

## Thống nhất
1. Pilot 50 xe từ 01/09/2026, ưu tiên tuyến TP.HCM – Cần Thơ.
2. Thiết bị Lumen-T1 do Lumen cung cấp và bảo hành 24 tháng.
3. App tài xế phải chạy được trên Android 9 (xe cũ dùng máy Samsung J series).
4. Cảnh báo lệch tuyến là yêu cầu bắt buộc trước pilot; báo cáo nhiên liệu làm sau.

## Việc cần làm
- Khôi: mẫu thử 10 thiết bị T1 trước 15/06.
- Hải: ingest MQTT + TimescaleDB trước 30/06.
- Trí: app tài xế bản alpha (nhận chuyến, chấm công) trước 31/07.
- Trang: tài liệu yêu cầu chi tiết và danh sách 50 xe pilot trước 25/05.
`;

const REVENUE_CSV = `Thang,Khach hang,San pham,Doanh thu (trieu VND),Ghi chu
2026-07,Minh Chau,RetailOS,420,Dot 1 phi trien khai 6 sieu thi
2026-07,Sao Do,FleetPro,96,Thiet bi T1 40 xe
2026-08,Minh Chau,RetailOS,310,Dot 2 phi trien khai
2026-08,Sao Do,FleetPro,54,Thiet bi + lap dat 10 xe
2026-09,Minh Chau,RetailOS,480,Pilot Go Vap + thue thang 9
2026-09,Sao Do,FleetPro,135,Pilot 50 xe thang 9
2026-09,Tap hoa Xanh,RetailOS Starter,27,2 cua hang
`;

const ONBOARDING = `QUY TRINH ONBOARDING NHAN VIEN MOI - LUMEN SOFTWARE

Ngay 1
- HR gui loi moi PON, nhan vien dat mat khau va bat 2FA.
- Nhan laptop (MacBook Air hoac ThinkPad), buddy gioi thieu team.
- Doc So tay nhan vien, ky cam ket bao mat.

Tuan 1
- Hoan thanh khoa bao mat noi bo (45 phut).
- Truong phong giao task dau tien, review cuoi tuan.

Thang 1
- 1-1 voi truong phong hang tuan.
- Danh gia thu viec ngay 55, HR gui ket qua truoc ngay 60.
`;

// ------------------------------------------------------------------- PDF

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
  objs.forEach((body, i) => { offsets.push(Buffer.byteLength(out)); out += `${i + 1} 0 obj\n${body}\nendobj\n`; });
  const xref = Buffer.byteLength(out);
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n`;
  for (const o of offsets) out += `${String(o).padStart(10, '0')} 00000 n \n`;
  out += `trailer\n<< /Size ${objs.length + 1} /Root ${catalogId} 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(out, 'latin1');
}

// PDF text is Latin-1 (Helvetica/WinAnsi): Vietnamese without diacritics.
const CONTRACT = makePdf('Hop dong RetailOS - Chuoi sieu thi Minh Chau', [
  'So hop dong: LM-MC-2026-001        Ngay ky: 30/06/2026',
  'Ben A: Cong ty TNHH Sieu thi Minh Chau (12 sieu thi, TP.HCM & Binh Duong)',
  'Ben B: Cong ty TNHH Lumen Software',
  'Gia tri: 1.800.000.000 VND / 3 nam (chua VAT)',
  'Dai dien ben A: Ong Le Van Phat - Giam doc van hanh',
  'Dai dien ben B: Ong Tran Phuc Khang - Giam doc',
  '',
  '1. Pham vi',
  '- Trien khai RetailOS goi Enterprise tren ha tang cua ben A (Kubernetes, 3 node).',
  '- POS Android cho 12 sieu thi, ton kho toan chuoi, man hinh quang cao, dashboard.',
  '- Dao tao 2 buoi/sieu thi, tai lieu van hanh tieng Viet.',
  '',
  '2. Thanh toan',
  '- Dot 1 (30%): sau ky hop dong.     - Dot 2 (30%): sau pilot Go Vap.',
  '- Dot 3 (40%): sau nghiem thu go-live 12 sieu thi.',
  '- Phi thue nam 2-3: 3.800.000 VND/sieu thi/thang, thanh toan theo quy.',
  '',
  '3. Moc thoi gian',
  '- Pilot Minh Chau Go Vap: 15/09/2026.   - UAT toan chuoi: 20/10/2026.',
  '- Go-live 12 sieu thi: 28/10/2026.',
  '',
  '4. SLA & bao hanh',
  '- Su co P1 (POS khong ban duoc hang): phan hoi 30 phut, khac phuc 4 gio.',
  '- Bao hanh 12 thang; phat 0,5% gia tri hop dong / tuan cham go-live.',
  '- Du lieu khach hang cua ben A khong roi ha tang ben A.',
  '',
  '5. Dau moi',
  '- Ben A: Tran Thu Thao (IT) - thao.tt@minhchau.vn',
  '- Ben B: Nguyen Kim Minh (Truong du an) - minh.nguyen@lumensoft.vn',
]);

// ---------------------------------------------------------------- images

const PALETTE = ['#7A2E3A', '#8C5A3C', '#4F6D5E', '#3E5C76', '#6B5B95', '#A0522D', '#5D6D7E', '#9C3D54'];
const F = 'font-family="Helvetica, Arial, sans-serif"';

function initialsOf(name) {
  const parts = name.trim().split(/\s+/);
  const pick = parts.length > 1 ? [parts[parts.length - 2], parts[parts.length - 1]] : [parts[0]];
  return pick.map((p) => p[0]).join('').toUpperCase();
}

const svgToPng = (svg) => sharp(Buffer.from(svg)).png().toBuffer();

async function avatarPng(name, idx, key) {
  const bg = PALETTE[idx % PALETTE.length];
  return prebuilt(`avatar-${key || idx}`, () => svgToPng(`<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256">
    <rect width="256" height="256" rx="128" fill="${bg}"/>
    <text x="128" y="150" text-anchor="middle" font-size="96" font-weight="700" fill="#F5F2ED" ${F}>${initialsOf(name)}</text></svg>`));
}

async function revenueChartPng() {
  const bars = [516, 364, 642];
  const labels = ['T7', 'T8', 'T9'];
  const rects = bars.map((v, i) => {
    const h = Math.round((v / 700) * 300);
    const x = 140 + i * 200;
    return `<rect x="${x}" y="${400 - h}" width="120" height="${h}" rx="6" fill="#7A2E3A"/>
      <text x="${x + 60}" y="${390 - h}" text-anchor="middle" font-size="22" fill="#2B2A28" ${F}>${v}</text>
      <text x="${x + 60}" y="435" text-anchor="middle" font-size="22" fill="#6E6A64" ${F}>${labels[i]}</text>`;
  }).join('');
  return svgToPng(`<svg xmlns="http://www.w3.org/2000/svg" width="800" height="480">
    <rect width="800" height="480" fill="#F5F2ED"/>
    <text x="40" y="56" font-size="28" font-weight="700" fill="#2B2A28" ${F}>Doanh thu Q3/2026 - Lumen (trieu VND)</text>
    <line x1="100" y1="400" x2="760" y2="400" stroke="#CFC8BE" stroke-width="2"/>${rects}</svg>`);
}

async function posScreenPng() {
  const rows = [['Ca chua Da Lat 1kg', '2', '58.000'], ['Thit heo ba roi 500g', '1', '92.000'], ['Sua tuoi Vinamilk 1L', '3', '105.000'], ['Trung ga hop 10', '1', '36.000']]
    .map(([n, q, p], i) => `<text x="40" y="${180 + i * 44}" font-size="22" fill="#2B2A28" ${F}>${n}</text>
      <text x="520" y="${180 + i * 44}" text-anchor="middle" font-size="22" fill="#6E6A64" ${F}>${q}</text>
      <text x="720" y="${180 + i * 44}" text-anchor="end" font-size="22" fill="#2B2A28" ${F}>${p}</text>`).join('');
  return svgToPng(`<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="640">
    <rect width="1024" height="640" fill="#F5F2ED"/>
    <rect x="0" y="0" width="1024" height="80" fill="#7A2E3A"/>
    <text x="30" y="52" font-size="30" font-weight="700" fill="#F5F2ED" ${F}>RetailOS POS v2.0 - Minh Chau Go Vap - Quay 03</text>
    <rect x="20" y="110" width="740" height="500" rx="12" fill="#FFFFFF" stroke="#CFC8BE"/>
    <text x="40" y="150" font-size="20" fill="#6E6A64" ${F}>San pham</text><text x="520" y="150" text-anchor="middle" font-size="20" fill="#6E6A64" ${F}>SL</text><text x="720" y="150" text-anchor="end" font-size="20" fill="#6E6A64" ${F}>Thanh tien</text>
    ${rows}
    <line x1="40" y1="520" x2="740" y2="520" stroke="#CFC8BE"/>
    <text x="40" y="570" font-size="28" font-weight="700" fill="#2B2A28" ${F}>TONG</text>
    <text x="720" y="570" text-anchor="end" font-size="28" font-weight="700" fill="#7A2E3A" ${F}>291.000 d</text>
    <rect x="790" y="110" width="214" height="150" rx="12" fill="#7A2E3A"/><text x="897" y="195" text-anchor="middle" font-size="26" fill="#F5F2ED" ${F}>VietQR</text>
    <rect x="790" y="280" width="214" height="150" rx="12" fill="#4F6D5E"/><text x="897" y="365" text-anchor="middle" font-size="26" fill="#F5F2ED" ${F}>Tien mat</text>
    <rect x="790" y="450" width="214" height="150" rx="12" fill="#3E5C76"/><text x="897" y="535" text-anchor="middle" font-size="26" fill="#F5F2ED" ${F}>The</text></svg>`);
}

async function fleetDashPng() {
  const dots = [[180, 300], [260, 250], [330, 330], [420, 280], [520, 350], [610, 300], [690, 240], [760, 330], [840, 290]]
    .map(([x, y], i) => `<circle cx="${x}" cy="${y}" r="9" fill="${i === 4 ? '#B3261E' : '#4F6D5E'}"/>`).join('');
  return svgToPng(`<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="600">
    <rect width="1024" height="600" fill="#2B2A28"/>
    <text x="30" y="50" font-size="28" font-weight="700" fill="#F5F2ED" ${F}>FleetPro - Dieu phoi Sao Do - 26/10 09:12</text>
    <rect x="20" y="80" width="660" height="500" rx="12" fill="#3A3835"/>
    <path d="M60 480 C 200 420, 300 380, 420 300 S 700 200, 860 260" stroke="#8C8578" stroke-width="3" fill="none" transform="translate(-20,0)"/>
    ${dots}
    <rect x="700" y="80" width="304" height="150" rx="12" fill="#3A3835"/>
    <text x="720" y="115" font-size="18" fill="#CFC8BE" ${F}>Xe dang chay</text><text x="720" y="175" font-size="48" font-weight="700" fill="#F5F2ED" ${F}>47 / 50</text>
    <rect x="700" y="250" width="304" height="150" rx="12" fill="#3A3835"/>
    <text x="720" y="285" font-size="18" fill="#CFC8BE" ${F}>Canh bao lech tuyen</text><text x="720" y="345" font-size="48" font-weight="700" fill="#E0A458" ${F}>1</text>
    <rect x="700" y="420" width="304" height="160" rx="12" fill="#3A3835"/>
    <text x="720" y="455" font-size="18" fill="#CFC8BE" ${F}>Chuyen hom nay</text><text x="720" y="515" font-size="48" font-weight="700" fill="#F5F2ED" ${F}>128</text>
    <text x="720" y="555" font-size="18" fill="#CFC8BE" ${F}>da giao 83 - dang giao 41 - tre 4</text></svg>`);
}

async function gpsBoardPng() {
  return svgToPng(`<svg xmlns="http://www.w3.org/2000/svg" width="900" height="560">
    <rect width="900" height="560" fill="#EDE8E1"/>
    <rect x="150" y="120" width="600" height="320" rx="18" fill="#2F5D3A"/>
    <rect x="190" y="160" width="120" height="120" rx="6" fill="#1F1F1F"/><text x="250" y="226" text-anchor="middle" font-size="18" fill="#DDD" ${F}>ESP32-S3</text>
    <rect x="340" y="160" width="100" height="70" rx="6" fill="#1F1F1F"/><text x="390" y="202" text-anchor="middle" font-size="16" fill="#DDD" ${F}>u-blox M10</text>
    <rect x="470" y="160" width="140" height="70" rx="6" fill="#1F1F1F"/><text x="540" y="202" text-anchor="middle" font-size="16" fill="#DDD" ${F}>4G Cat-1</text>
    <rect x="190" y="320" width="520" height="80" rx="6" fill="#4A4A4A"/><text x="450" y="368" text-anchor="middle" font-size="20" fill="#DDD" ${F}>Li-ion 2000 mAh</text>
    <text x="450" y="80" text-anchor="middle" font-size="30" font-weight="700" fill="#2B2A28" ${F}>Lumen-T1 rev C - mau thu so 7</text>
    <text x="450" y="500" text-anchor="middle" font-size="20" fill="#6E6A64" ${F}>FW 1.4.2 - test 72h: 0 reboot, mat song 2h gui bu du 720 ban tin</text></svg>`);
}

async function buildFiles() {
  const txt = (s) => Buffer.from(s, 'utf8');
  return {
    handbook: { name: 'So-tay-nhan-vien-Lumen-2026.md', mime: 'text/markdown', buf: txt(HANDBOOK), kb: true },
    orgChart: { name: 'So-do-to-chuc-Lumen-2026.md', mime: 'text/markdown', buf: txt(orgChartMd()), kb: true },
    retailSpec: { name: 'RetailOS-Dac-ta-he-thong-v1.3.md', mime: 'text/markdown', buf: txt(RETAIL_SPEC), kb: true },
    retailApi: { name: 'RetailOS-API-POS-v2.md', mime: 'text/markdown', buf: txt(RETAIL_API), kb: true },
    fleetSpec: { name: 'FleetPro-Dac-ta-he-thong-v1.1.md', mime: 'text/markdown', buf: txt(FLEET_SPEC), kb: true },
    gpsProto: { name: 'FleetPro-Giao-thuc-thiet-bi-Lumen-T1.md', mime: 'text/markdown', buf: txt(GPS_PROTO), kb: true },
    pricing: { name: 'Bang-gia-Lumen-2026.md', mime: 'text/markdown', buf: txt(PRICING), kb: true },
    contract: { name: 'Hop-dong-LM-MC-2026-001-RetailOS-Minh-Chau.pdf', mime: 'application/pdf', buf: CONTRACT, kb: true },
    kickoff: { name: 'Bien-ban-kickoff-FleetPro-2026-05-12.md', mime: 'text/markdown', buf: txt(KICKOFF), kb: true },
    revenueCsv: { name: 'Bao-cao-doanh-thu-Q3-2026.csv', mime: 'text/csv', buf: txt(REVENUE_CSV), kb: true },
    onboarding: { name: 'Quy-trinh-onboarding.txt', mime: 'text/plain', buf: txt(ONBOARDING), kb: true },
    revenueChart: { name: 'doanh-thu-q3-2026.png', mime: 'image/png', buf: await prebuilt('revenueChart', revenueChartPng), image: true },
    posScreen: { name: 'retailos-pos-v2-go-vap.png', mime: 'image/png', buf: await prebuilt('posScreen', posScreenPng), image: true },
    fleetDash: { name: 'fleetpro-dashboard-26-10.png', mime: 'image/png', buf: await prebuilt('fleetDash', fleetDashPng), image: true },
    gpsBoard: { name: 'lumen-t1-rev-c.png', mime: 'image/png', buf: await prebuilt('gpsBoard', gpsBoardPng), image: true },
  };
}

// Everything prebuild.js writes: avatar-<key> + the four images.
async function renderAll(people) {
  const out = {};
  for (const [i, p] of people.entries()) out[`avatar-${p.key}`] = await avatarPng(p.name, i);
  out.revenueChart = await revenueChartPng();
  out.posScreen = await posScreenPng();
  out.fleetDash = await fleetDashPng();
  out.gpsBoard = await gpsBoardPng();
  return out;
}

module.exports = { buildFiles, avatarPng, renderAll };
