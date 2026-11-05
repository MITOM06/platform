// Background chatter so the company does not look empty: short work threads on
// weekdays (08:30–18:00, UTC+7) between a channel's members, plus the AI daily
// digest the workspace has enabled. Scripted messages (conversations.js) carry
// the story; filler only fills the gaps and never lands within 90 minutes of a
// scripted message or after the newest one, so threads and unread counts stay
// intact. Deterministic: same seed → same chatter.
//
// A thread = lines [{ who, t }] — who: 'lead' | 'any' | 'other' (≠ previous
// speaker) | 'asker' (first speaker of the thread). `topic` feeds the digest.
// Slots in `t`: {ticket} {pr} {store} {plate} {n} {n2} {time} {name} {feature}
// {bug} {env} {doc} {customer} {dish} {place}.

const { rng, STORY_NOW } = require('./lib');
const org = require('./org');

const MIN = 60000;
const ICT = 7 * 60; // minutes ahead of UTC

const STORES = ['Gò Vấp', 'Bình Thạnh', 'Thủ Đức', 'Quận 7', 'Tân Bình', 'Dĩ An', 'Thuận An', 'Quận 12', 'Phú Nhuận', 'Bình Tân', 'Quận 3', 'Thủ Dầu Một'];
const PLATES = ['51C-128.47', '51D-302.15', '61C-077.82', '51C-449.03', '65C-118.60', '51D-271.94', '62C-035.17'];
const SLOTS = {
  feature: ['đồng bộ tồn kho', 'thanh toán VietQR', 'in hóa đơn', 'màn hình quảng cáo', 'báo cáo theo ca', 'đổi trả hàng', 'khuyến mãi theo giờ', 'phân quyền thu ngân', 'kiểm kê bằng ảnh', 'đăng nhập bằng mã PIN'],
  fleetFeature: ['cảnh báo lệch tuyến', 'chấm công tài xế', 'báo cáo nhiên liệu', 'xác nhận giao hàng bằng ảnh', 'bản đồ nhiệt điểm giao', 'gán chuyến tự động', 'lịch sử lộ trình', 'cảnh báo dừng đỗ quá lâu'],
  bug: ['NullPointer khi đóng ca', 'timeout gọi API giá', 'lệch múi giờ báo cáo', 'trùng đơn khi mất mạng', 'font tiếng Việt trên máy in', 'cache tồn kho không xoá', 'crash khi xoay màn hình', 'memory leak ở websocket'],
  env: ['staging', 'UAT'], // + the pilot once it runs — see envFor()
  doc: ['đặc tả v1.3', 'API POS v2', 'runbook go-live', 'checklist UAT', 'sổ tay nhân viên', 'biên bản kickoff'],
  dish: ['cơm tấm', 'bún bò', 'phở', 'bánh mì chảo', 'cơm gà', 'bún thịt nướng', 'mì Quảng', 'hủ tiếu Nam Vang', 'cơm văn phòng', 'lẩu nấm'],
  place: ['quán cô Ba', 'chỗ cũ đầu hẻm', 'quán mới bên Lê Thánh Tôn', 'căng tin toà nhà', 'quán chay Hoa Đăng'],
  customer: ['Bách Hóa Đồng Nai', 'Vận tải Hòa Bình', 'Tạp hóa Xanh', 'Minh Châu', 'Sao Đỏ', 'chuỗi Phú Thịnh', 'Logistics An Phát'],
};

const T = (topic, ...lines) => ({ topic, lines: lines.map(([who, t]) => ({ who, t })) });
// Only once the thing it talks about exists (pilots: RetailOS Gò Vấp 15/09, FleetPro Sao Đỏ 01/09).
const after = (date, tpl) => ({ ...tpl, after: Date.parse(`${date}T00:00:00+07:00`) });
const RETAIL_PILOT = '2026-09-15';
const FLEET_PILOT = '2026-09-01';

const BANKS = {
  retail: [
    T('stand-up', ['any', 'Stand-up: hôm qua mình xong {ticket} ({feature}), hôm nay làm tiếp {ticket2}. Không bị block.'], ['lead', '👍']),
    T('review PR', ['any', 'Ai rảnh review giúp PR !{pr} ({feature}) với, khoảng {n} file.'], ['other', 'Để mình xem, 15 phút nữa nhé.'], ['other', 'Approve rồi, có 2 comment nhỏ về đặt tên.']),
    T('lỗi trên môi trường', ['any', 'Trên {env} đang bị {bug}, mình mở {ticket} rồi.'], ['lead', 'Ưu tiên P2, ai đang rảnh nhận giúp?'], ['other', 'Mình nhận, chiều nay có fix.']),
    T('deploy staging', ['any', 'Mình deploy staging bản {ver} lúc {time}, mọi người test lại {feature} giúp.'], ['other', 'Test ok trên POS mẫu 2 rồi.']),
    T('hỏi đặc tả', ['any', '{feature} xử lý theo {doc} mục {n2} đúng không mọi người?'], ['lead', 'Đúng, nhưng bản pilot bỏ qua phần đối soát cuối ngày.']),
    after(RETAIL_PILOT, T('triển khai cửa hàng', ['any', 'Siêu thị Minh Châu Gò Vấp báo máy POS số {n2} chậm khi in hóa đơn.'], ['other', 'Bản cũ chưa cập nhật, mình đẩy OTA tối nay.'], ['asker', 'Cảm ơn nhé 🙏'])),
    T('họp nhanh', ['lead', 'Chiều nay {time} họp 15 phút chốt scope {feature} cho sprint sau nhé.'], ['any', 'Ok anh.']),
    T('code freeze', ['lead', 'Nhắc: trưa thứ 4 freeze code, PR nào chưa merge thì để sprint sau.']),
    T('QA', ['any', 'QA xong {ticket}: pass {n}/{n3} case, còn {n4} case liên quan {feature}.'], ['other', 'Mình xem mấy case đó ngay.']),
    T('hiệu năng', ['any', 'Query báo cáo tồn kho theo ca mất {n}s ở {env}, mình thêm index thử.'], ['other', 'Nhớ chạy EXPLAIN trước khi thêm nhé.'], ['asker', 'Giảm còn 0,{n2}s rồi 🚀']),
    T('thiết kế', ['any', 'Mình up mockup mới cho {feature} trên Figma, mọi người góp ý giúp.'], ['other', 'Nút xác nhận nên to hơn, thu ngân bấm bằng ngón cái.'], ['asker', 'Ok mình sửa.']),
    T('on-call', ['any', 'Tối qua on-call yên tĩnh, chỉ có 1 cảnh báo disk ở {env}, đã dọn log.']),
    T('kiến thức', ['any', 'Chia sẻ: bài viết về idempotency key cho API thanh toán, khá hợp với vụ đơn trùng.'], ['other', 'Hay, cảm ơn nhé.']),
    T('dữ liệu khách', ['any', 'Minh Châu gửi thêm {n}0 SKU mới, ai import vào {env} giúp mình?'], ['other', 'Mình làm, file CSV đúng format không?'], ['asker', 'Đúng format v2 rồi.']),
    T('release note', ['lead', 'Release tối qua: {feature}, fix {bug}. Không có rollback.']),
    T('hỏi đáp', ['any', '{name} ơi, endpoint đổi trả đã hỗ trợ trả một phần chưa?'], ['other', 'Có rồi, truyền thêm quantity cho từng dòng.']),
  ],
  fleet: [
    T('stand-up', ['any', 'Stand-up: xong {ticket} ({feature}), hôm nay làm {ticket2}.'], ['lead', 'Ok.']),
    after(FLEET_PILOT, T('xe mất tín hiệu', ['any', 'Xe {plate} mất tín hiệu GPS từ {time}, mình kiểm tra thiết bị T1.'], ['other', 'Có thể do hầm gửi xe, chờ 30 phút xem gửi bù không.'], ['asker', 'Đã gửi bù đủ bản tin, ổn rồi.'])),
    after(FLEET_PILOT, T('lệch tuyến', ['any', 'Cảnh báo lệch tuyến xe {plate} lúc {time}, tài xế đi đường tránh do kẹt xe.'], ['lead', 'Ghi chú vào báo cáo tuần cho anh Tài.'])),
    T('review PR', ['any', 'PR !{pr} ({feature}) cần 1 review, ai xem giúp?'], ['other', 'Mình xem.'], ['other', 'Approve, merge đi.']),
    after(FLEET_PILOT, T('app tài xế', ['any', 'Tài xế báo app chậm khi mở danh sách chuyến trên máy Android cũ.'], ['other', 'Mình thêm phân trang, bản sau có.'])),
    T('MQTT', ['any', 'Broker MQTT ở {env} nhận {n}k bản tin/giờ, CPU {n2}0%.'], ['other', 'Ổn, ngưỡng cảnh báo mình đặt 80%.']),
    after(FLEET_PILOT, T('dữ liệu', ['any', 'Báo cáo nhiên liệu tuần này: trung bình {n2},{n} lít/100km, xe {plate} cao bất thường.'], ['lead', 'Gửi Trang đưa vào báo cáo cho Sao Đỏ.'])),
    T('firmware', ['any', 'Firmware T1 1.4.{n2} chạy test 24h trên {n} mẫu, 0 reboot.'], ['other', '🔥']),
    after(FLEET_PILOT, T('triển khai', ['lead', 'Tuần này lắp thêm {n} thiết bị cho đội xe Sao Đỏ, lịch gửi trong file chung.'], ['any', 'Em nhận đi cùng kỹ thuật bên họ.'])),
    T('lỗi', ['any', '{env} đang bị {bug}, mình mở {ticket}.'], ['other', 'Mình xem log trước.'], ['other', 'Fix trong {pr2}, đã deploy.']),
    T('tối ưu lộ trình', ['any', 'Thuật toán gán chuyến mới giảm {n2}% quãng đường chạy rỗng trên dữ liệu tháng trước.'], ['lead', 'Tốt, demo ở review tuần sau nhé.']),
    T('on-call', ['any', 'Bàn giao on-call: tuần qua có {n2} cảnh báo, đều tự hồi phục.']),
    T('hỏi đáp', ['any', '{name} ơi, API lịch sử lộ trình có giới hạn khoảng thời gian không?'], ['other', 'Tối đa 7 ngày mỗi lần gọi.']),
    after(FLEET_PILOT, T('khách hàng', ['lead', 'Anh Tài khen tính năng {feature}, muốn thêm xuất Excel.'], ['any', 'Em ghi vào backlog {ticket}.'])),
  ],
  sales: [
    T('lead mới', ['any', 'Lead mới: {customer} hỏi demo {product}, quy mô {n} điểm.'], ['lead', 'Đặt lịch demo tuần này, gửi trước bảng giá Starter.']),
    T('báo giá', ['any', 'Báo giá cho {customer} gửi rồi, chiết khấu {n2}%.'], ['lead', 'Ok, trong quyền hạn.']),
    T('pipeline', ['lead', 'Cập nhật pipeline trước 17:00 thứ 6 nhé mọi người.'], ['any', 'Dạ.']),
    T('gặp khách', ['any', 'Chiều nay đi gặp {customer} lúc {time}, ai cần gửi tài liệu gì không?'], ['other', 'Mang theo case study Minh Châu bản in nhé.']),
    T('hợp đồng', ['any', 'Hợp đồng {customer} đang chờ pháp lý bên họ duyệt, dự kiến ký tuần sau.'], ['lead', '👍']),
    T('feedback', ['any', '{customer} phản hồi giao diện báo cáo khó đọc trên điện thoại.'], ['lead', 'Ghi lại, mình chuyển cho phòng sản phẩm.']),
    T('chăm sóc', ['any', 'Đã gọi chăm sóc {customer}, họ hài lòng, hỏi thêm module {feature}.']),
  ],
  mkt: [
    T('nội dung', ['any', 'Bài blog "{feature} giúp siêu thị tiết kiệm thời gian" xong bản nháp, nhờ chị xem.'], ['lead', 'Tiêu đề ngắn lại, còn lại ok.']),
    T('lịch đăng', ['lead', 'Lịch đăng tuần này: thứ 3 case study, thứ 5 video demo, thứ 7 bài tuyển dụng.'], ['any', 'Em lên ảnh trước thứ 2.']),
    T('số liệu', ['any', 'Fanpage tuần qua: {n}k lượt tiếp cận, {n2}0 lượt nhắn tin hỏi giá.'], ['lead', 'Tốt, chuyển lead cho Kinh doanh nhé.']),
    T('sự kiện', ['lead', 'Đăng ký gian hàng Vietnam Retail Expo tháng 12 rồi, cần {n2} người trực.'], ['any', 'Em đăng ký.']),
    T('thiết kế', ['any', 'Banner mới cho landing page FleetPro, mọi người góp ý giúp.'], ['other', 'Màu chữ trên nền ảnh hơi khó đọc.'], ['asker', 'Ok em tăng độ tương phản.']),
    T('SEO', ['any', 'Từ khóa "phần mềm quản lý siêu thị" lên trang 1 Google rồi 🎉'], ['lead', '👏']),
  ],
  hr: [
    T('tuyển dụng', ['any', 'Có {n} hồ sơ mới cho vị trí Backend Go, mình lọc xong gửi phòng FleetPro.'], ['lead', 'Ok.']),
    T('nghỉ phép', ['any', 'Đơn nghỉ phép tuần này: {n2} đơn, đều đã được trưởng phòng duyệt.']),
    T('hành chính', ['any', 'Văn phòng phẩm tháng này đã đặt, thứ 4 giao.'], ['lead', 'Nhớ lấy hóa đơn VAT gửi chị Giang.']),
    T('onboarding', ['lead', 'Thứ 2 có bạn mới vào, nhờ chuẩn bị laptop và lời mời PON.'], ['any', 'Dạ em chuẩn bị rồi.']),
    T('chính sách', ['any', 'Có bạn hỏi chính sách WFH khi con ốm, mình trả lời theo sổ tay mục 2 nhé.'], ['lead', 'Đúng, trưởng phòng có quyền duyệt thêm 1 ngày.']),
  ],
  fin: [
    T('chứng từ', ['lead', 'Nhắc các phòng gửi hóa đơn đầu vào trước ngày 28.'], ['any', 'Đã nhắc trong nhóm trưởng phòng rồi chị.']),
    T('thanh toán', ['any', 'Đã thanh toán hóa đơn server tháng này, {n}{n2} triệu.'], ['lead', 'Ok, nhập vào sổ.']),
    T('lương', ['lead', 'Bảng lương tháng này chốt xong, trình anh Dũng duyệt.']),
    T('công nợ', ['any', 'Công nợ {customer} còn {n}{n2}0 triệu, quá hạn {n2} ngày.'], ['lead', 'Báo Kinh doanh nhắc khách.']),
    T('thuế', ['lead', 'Tờ khai thuế GTGT quý đã nộp, lưu biên nhận trên Drive.']),
  ],
  bod: [
    T('số liệu tuần', ['any', 'Số liệu tuần: doanh thu {n}{n2}0 triệu, tiền mặt đủ {n2}+ tháng vận hành.'], ['other', 'Ổn.']),
    T('tuyển dụng', ['any', 'Vị trí designer có 2 ứng viên vòng cuối, tuần sau chốt.'], ['other', 'Ok.']),
    T('khách hàng', ['any', '{customer} muốn gặp ban giám đốc trước khi ký, ai đi được thứ 5?'], ['other', 'Mình đi.']),
    T('rủi ro', ['any', 'Rủi ro tuần này: phụ thuộc 1 người cho thiết bị T1, cần người backup.'], ['other', 'Đưa vào kế hoạch tuyển Q1.']),
  ],
  ann: [
    T('thông báo', ['any', 'Thứ 6 này {time} có buổi chia sẻ nội bộ chủ đề "{feature}", mọi người tham gia nhé.']),
    T('chúc mừng', ['any', 'Chúc mừng sinh nhật {name} 🎂🎉'], ['other', 'Happy birthday 🎉'], ['other', '🎂']),
    T('văn phòng', ['any', 'Toà nhà bảo trì thang máy sáng thứ 7, ai lên văn phòng đi thang bộ nhé.']),
    T('chào mừng', ['any', 'Chào mừng {name} gia nhập Lumen 👋'], ['other', 'Welcome 👋'], ['other', 'Chào bạn mới!']),
    T('nhắc nhở', ['any', 'Nhắc: cập nhật hồ sơ cá nhân và ảnh đại diện trên PON giúp HR nhé.']),
  ],
  lunch: [
    T('ăn trưa', ['any', 'Trưa nay ăn gì mọi người?'], ['other', '{dish} {place} đi'], ['other', 'Ok chốt, 11:45 xuống sảnh.']),
    T('ăn trưa', ['any', 'Ai đặt cơm văn phòng không, mình gom đơn 11:00.'], ['other', 'Cho mình 1 phần gà.'], ['other', 'Mình 1 phần chay.']),
    T('trà sữa', ['any', 'Chiều nay ai uống trà sữa không, giảm 30% 🧋'], ['other', 'Mình 1 ly ít đường.'], ['other', '+1']),
    T('cuối tuần', ['any', 'Cuối tuần có ai đi cà phê sách không?'], ['other', 'Chủ nhật được.']),
    T('ăn trưa', ['any', 'Hôm nay mình mang cơm, mọi người đi vui nhé 😄']),
  ],
  tech: [
    T('CI', ['any', 'Runner CI hôm qua xếp hàng {n} phút giờ cao điểm.'], ['other', 'Mình tăng concurrency lên 4.']),
    T('bảo mật', ['any', 'Dependabot báo {n2} lỗ hổng mức trung bình ở cả 2 repo, mình gom PR cập nhật.'], ['other', '👍']),
    T('hạ tầng', ['any', 'Cert TLS staging hết hạn sau {n2} ngày, đã bật tự gia hạn.']),
    T('thư viện chung', ['any', 'lumen-logging 0.{n2}.0 ra rồi, thêm trace id tự động.'], ['other', 'FleetPro nâng cấp tuần này.']),
  ],
};

// conversation key → { bank, perDay (threads per weekday), from (days before story now) }
const PLAN = {
  retail: { bank: 'retail', perDay: 2.4, product: 'RetailOS', ticketPrefix: 'RETAIL', digest: true },
  fleet: { bank: 'fleet', perDay: 2.1, product: 'FleetPro', ticketPrefix: 'FLEET', digest: true },
  sales: { bank: 'sales', perDay: 0.9, product: 'RetailOS' },
  mkt: { bank: 'mkt', perDay: 0.8, product: 'RetailOS' },
  hr: { bank: 'hr', perDay: 0.6 },
  fin: { bank: 'fin', perDay: 0.5 },
  bod: { bank: 'bod', perDay: 0.5 },
  ann: { bank: 'ann', perDay: 0.35 },
  lunch: { bank: 'lunch', perDay: 1.4, lunch: true },
  'x-tech-sync': { bank: 'tech', perDay: 0.5 },
};

const firstName = Object.fromEntries(org.PEOPLE.map((p) => [p.key, p.name.split(' ').pop()]));

function localParts(ts) {
  const d = new Date(ts + ICT * MIN);
  return { dow: d.getUTCDay(), minuteOfDay: d.getUTCHours() * 60 + d.getUTCMinutes(), dayStart: ts - (d.getUTCHours() * 60 + d.getUTCMinutes()) * MIN - d.getUTCSeconds() * 1000 - d.getUTCMilliseconds() };
}
const ddmm = (ts) => { const d = new Date(ts + ICT * MIN); return `${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')}`; };
const hhmm = (min) => `${Math.floor(min / 60)}:${String(min % 60).padStart(2, '0')}`;

function envFor(bank, day) {
  const env = [...SLOTS.env];
  if (bank === 'retail' && day >= Date.parse(`${RETAIL_PILOT}T00:00:00+07:00`)) env.push('pilot Gò Vấp');
  if (bank === 'fleet' && day >= Date.parse(`${FLEET_PILOT}T00:00:00+07:00`)) env.push('pilot Sao Đỏ');
  return env;
}

function fill(text, ctx, r) {
  const ticket = () => `${ctx.ticketPrefix || 'LUMEN'}-${r.int(120, 980)}`;
  return text
    .replace(/\{ticket2?\}/g, ticket)
    .replace(/\{pr2?\}/g, () => String(r.int(300, 1400)))
    .replace(/\{store\}/g, () => r.pick(STORES))
    .replace(/\{plate\}/g, () => r.pick(PLATES))
    .replace(/\{n\}/g, () => String(r.int(2, 9)))
    .replace(/\{n2\}/g, () => String(r.int(1, 6)))
    .replace(/\{n3\}/g, () => String(r.int(40, 60)))
    .replace(/\{n4\}/g, () => String(r.int(1, 3)))
    .replace(/\{ver\}/g, () => `2.${r.int(3, 9)}.${r.int(0, 12)}`)
    .replace(/\{time\}/g, () => hhmm(r.pick([570, 600, 630, 840, 870, 900, 930, 960])))
    .replace(/\{name\}/g, () => firstName[r.pick(ctx.people)] || 'mọi người')
    .replace(/\{feature\}/g, () => r.pick(ctx.bank === 'fleet' ? SLOTS.fleetFeature : SLOTS.feature))
    .replace(/\{product\}/g, () => ctx.product || 'RetailOS')
    .replace(/\{env\}/g, () => r.pick(ctx.env || SLOTS.env))
    .replace(/\{(bug|doc|dish|place|customer)\}/g, (_, k) => r.pick(SLOTS[k]));
}

// Resolve every scripted message's `ago` exactly as messages.js would, so filler
// can keep clear of them.
function scriptedAgos(c) {
  let ago = c.start;
  return c.messages.map((m, i) => (ago = m.ago ?? ago - (2 + (i % 4))));
}

function generate(c, members, lead) {
  const plan = PLAN[c.key];
  if (!plan) return { messages: [], digests: [] };
  const people = members.filter((k) => firstName[k]);
  if (people.length < 2) return { messages: [], digests: [] };
  const r = rng(`lumen-filler-${c.key}`);
  const bank = BANKS[plan.bank];
  const ctx = { ...plan, people };
  const agos = scriptedAgos(c);
  const newest = Math.min(...agos); // smallest ago = newest scripted message
  const busy = (ago) => agos.some((a) => Math.abs(a - ago) < 90);
  const fromTs = STORY_NOW - c.start * MIN + 60 * MIN;
  const toTs = STORY_NOW - (newest + 120) * MIN;

  const out = [];
  const perDay = {};
  let label = 0;
  for (let day = localParts(fromTs).dayStart; day < toTs; day += 1440 * MIN) {
    const { dow } = localParts(day + 12 * 60 * MIN);
    if (dow === 0 || dow === 6) continue;
    const threads = Math.floor(plan.perDay) + (r.chance(plan.perDay % 1) ? 1 : 0);
    for (let t = 0; t < threads; t++) {
      const usable = bank.filter((b) => !b.after || day >= b.after);
      const tpl = r.pick(usable);
      ctx.env = envFor(plan.bank, day);
      const startMin = plan.lunch && tpl.topic !== 'trà sữa' ? r.int(600, 700) : r.int(510, 1050);
      let ts = day + startMin * MIN;
      const asker = (lead && tpl.lines[0].who === 'lead' && people.includes(lead)) ? lead : r.pick(people);
      let prev = null;
      const lines = [];
      for (const [i, line] of tpl.lines.entries()) {
        let who;
        if (i === 0) who = asker;
        else if (line.who === 'asker') who = asker;
        else if (line.who === 'lead' && lead && people.includes(lead) && lead !== prev) who = lead;
        else { const others = people.filter((p) => p !== prev); who = r.pick(others); }
        const ago = Math.round((STORY_NOW - ts) / MIN);
        if (ts >= toTs || ts < fromTs || busy(ago)) break;
        lines.push({ from: who, text: fill(line.t, ctx, r), ago });
        prev = who;
        ts += r.int(1, 14) * MIN;
      }
      if (!lines.length) continue;
      // Reply-to on some answers, reactions on some openers.
      if (lines.length > 1 && r.chance(0.3)) { const id = `f${c.key}${label++}`; lines[0].id = id; lines[1].reply = id; }
      if (r.chance(0.25)) {
        const emoji = r.pick(['👍', '🙏', '🔥', '😂', '❤️']);
        const who = people.filter((p) => p !== lines[0].from).slice(0, r.int(1, 4));
        lines[0].react = { [emoji]: who };
      }
      out.push(...lines);
      const key = new Date(day + 12 * 60 * MIN).toISOString().slice(0, 10);
      (perDay[key] ||= []).push({ topic: tpl.topic, who: lines[0].from });
    }
  }

  // AI daily digest (08:00 next weekday) for the last 6 active days.
  const digests = [];
  if (plan.digest) {
    const days = Object.keys(perDay).sort().slice(-6);
    for (const dayKey of days) {
      const dayTs = Date.parse(`${dayKey}T00:00:00Z`) - ICT * MIN;
      let next = dayTs + 1440 * MIN;
      while ([0, 6].includes(localParts(next + 12 * 60 * MIN).dow)) next += 1440 * MIN;
      const at = next + 8 * 60 * MIN;
      const ago = Math.round((STORY_NOW - at) / MIN);
      if (ago <= newest || busy(ago)) continue;
      const items = perDay[dayKey];
      const topics = [...new Set(items.map((i) => i.topic))].slice(0, 4);
      const voices = [...new Set(items.map((i) => firstName[i.who]))].slice(0, 4).join(', ');
      const text = `📋 **Tóm tắt hôm qua (${ddmm(dayTs + 12 * 60 * MIN)})**\n\n` +
        `- ${items.length} chủ đề được trao đổi: ${topics.join(', ')}.\n` +
        `- Người tham gia chính: ${voices}.\n` +
        `- Không có việc nào bị chặn cần trưởng phòng xử lý.`;
      digests.push({ ago, text, digestDate: dayKey });
    }
  }
  return { messages: out, digests };
}

// Merge filler + digests into a conversation's scripted messages (oldest first).
function withFiller(c, members, lead) {
  const { messages, digests } = generate(c, members, lead);
  if (!messages.length && !digests.length) return { conv: c, digestDates: [] };
  const agos = scriptedAgos(c);
  const scripted = c.messages.map((m, i) => ({ ...m, ago: agos[i] }));
  const ai = digests.map((d) => ({ from: 'ai', type: 'ai', text: d.text, ago: d.ago }));
  // Stable: scripted messages keep their relative order; filler slots in by time.
  const merged = [...scripted.map((m, i) => ({ m, k: 0, i })), ...[...messages, ...ai].map((m, i) => ({ m, k: 1, i }))]
    .sort((a, b) => (b.m.ago - a.m.ago) || (a.k - b.k) || (a.i - b.i))
    .map((x) => x.m);
  return { conv: { ...c, messages: merged }, digestDates: digests.map((d) => d.digestDate) };
}

module.exports = { withFiller, BANKS, PLAN };
