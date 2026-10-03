// A3 — Personalisation & AI admin · A4 — Vision, reminders, digest, notetaker.
const crypto = require('node:crypto');
const L = require('./lib');
const F = require('./fixtures');

const { CFG, test, has, short, describeAi } = L;
const acct = (...us) => us.map((u) => `${u.email} / ${CFG.PASSWORD}`).join(' ; ');

async function a3(ctx) {
  L.section('A3 — Cá nhân hoá & quản trị AI');
  const { dev, alice, quan, nam, son, group, devDm } = ctx;

  await test('A3.1', 'AI Context theo vai trò (Identity / Company Context)', {
    account: acct(quan, nam, son),
    steps: ['Mỗi tài khoản mở Cài đặt → AI Context (API GET /ai-context/me)', 'So sánh các mục "Company Context" hiển thị'],
    expected: 'Owner (quan) thấy "Khung lương (mật)" + "Lộ trình 2026 (nội bộ)"; Manager (nam) thấy "Lộ trình" nhưng KHÔNG thấy "Khung lương"; Member Sales (son) không thấy cả hai, thấy "Chính sách chiết khấu" của phòng Kinh doanh, KHÔNG thấy "SLA hỗ trợ" (phòng CSKH)',
    hint: 'Lộ mục mật → getVisibleEntriesForUser (auth-service ai-context.service.ts) không lọc requiredCapability/department. Thiếu mục → chưa chạy seed-company hoặc JWT cũ (đăng nhập lại).',
  }, async () => {
    const labels = async (u) => ((await L.api(u.token, 'GET', `${CFG.AUTH}/ai-context/me`)).json?.entries || []).map((e) => e.label);
    const [q, n, s] = [await labels(quan), await labels(nam), await labels(son)];
    const inc = (arr, l) => arr.some((x) => x.startsWith(l));
    const ok = inc(q, 'Khung lương') && inc(q, 'Lộ trình') && inc(n, 'Lộ trình') && !inc(n, 'Khung lương')
      && !inc(s, 'Lộ trình') && !inc(s, 'Khung lương') && inc(s, 'Chính sách chiết khấu') && !inc(s, 'SLA');
    return { pass: ok, actual: `quan=${q.length} mục, nam=[${n.join(' | ')}], son=[${s.join(' | ')}]` };
  });

  await test('A3.2', 'Response Style cá nhân lưu & đọc lại', {
    account: acct(dev),
    steps: ['AI Context → Response Style, nhập phong cách mới → Lưu (PATCH /ai-context/me/style)', 'Tải lại màn hình'],
    expected: 'Giá trị mới được trả về ở GET /ai-context/me (sau test khôi phục giá trị cũ)',
    hint: 'Không lưu → UpdateSoftContextDto / updateSoftContext.',
  }, async () => {
    const before = (await L.api(dev.token, 'GET', `${CFG.AUTH}/ai-context/me`)).json?.context || {};
    const style = `Trả lời cực ngắn (test ${L.RUN})`;
    const p = await L.api(dev.token, 'PATCH', `${CFG.AUTH}/ai-context/me/style`, { style });
    const after = (await L.api(dev.token, 'GET', `${CFG.AUTH}/ai-context/me`)).json?.context || {};
    await L.api(dev.token, 'PATCH', `${CFG.AUTH}/ai-context/me/style`, { style: before.style || '' });
    return { pass: p.status < 300 && after.style === style, actual: `PATCH ${p.status}, style sau lưu="${short(after.style, 60)}"` };
  });

  const pname = `Mây${L.RUN}`;
  await test('A3.3', 'AI Persona theo hội thoại: đổi tên/tone có hiệu lực ngay', {
    account: acct(dev),
    steps: [`Nhóm test → Cài đặt nhóm → AI Persona: tên "${pname}", tone "concise" → Lưu (PUT /api/conversations/{id}/ai-persona)`,
      'Gửi "@AI tên của bạn là gì?"', 'Xoá persona (DELETE) → GET persona'],
    expected: `PUT 200; AI tự xưng "${pname}"; DELETE 204; GET sau xoá 404`,
    hint: 'AI không đổi tên → persona.service buildSystemPrompt không đọc persona hội thoại (cache persona?).',
  }, async () => {
    const put = await L.api(dev.token, 'PUT', `${CFG.CHAT}/api/conversations/${group}/ai-persona`, { name: pname, tone: 'concise' });
    const a = await L.askAi(dev, group, '@AI tên của bạn là gì? Trả lời một câu.');
    const del = await L.api(dev.token, 'DELETE', `${CFG.CHAT}/api/conversations/${group}/ai-persona`);
    const get = await L.api(dev.token, 'GET', `${CFG.CHAT}/api/conversations/${group}/ai-persona`);
    return { pass: put.status === 200 && has(a.text, pname) && del.status === 204 && get.status === 404,
      actual: `PUT ${put.status}; AI → ${describeAi(a)}; DELETE ${del.status}; GET ${get.status}` };
  });

  await test('A3.4', 'Thành viên không phải admin nhóm không được sửa Persona', {
    account: acct(alice), steps: ['alice (thành viên, không phải admin nhóm test) PUT persona'],
    expected: 'HTTP 403', hint: 'Khác 403 → canManagePersona trong AiPersonaController.java.',
  }, async () => {
    const r = await L.api(alice.token, 'PUT', `${CFG.CHAT}/api/conversations/${group}/ai-persona`, { name: 'Hack' });
    return { pass: r.status === 403, actual: `HTTP ${r.status}` };
  });

  const wsName = `Orion${L.RUN}`;
  await test('A3.5', 'Cấu hình AI cấp workspace (admin/ai) có hiệu lực ngay', {
    account: acct(quan, dev),
    steps: [`quan: Admin → AI → Persona name = "${wsName}" → Lưu (PATCH /admin/workspace {aiSettings})`,
      'dev: chat 1-1 với AI (không có persona riêng), /new, hỏi "Tên của bạn là gì?"', 'Khôi phục cấu hình cũ'],
    expected: `PATCH 200; AI tự xưng "${wsName}" mà không cần restart service`,
    hint: 'Không đổi → ai-service SettingsService chưa nhận invalidate (kênh ai:settings:invalidate) — tối đa 60s cache; hoặc persona hội thoại đang ghi đè.',
  }, async () => {
    const ws = (await L.api(quan.token, 'GET', `${CFG.AUTH}/admin/workspace`)).json || {};
    const original = ws.aiSettings || {};
    const p = await L.api(quan.token, 'PATCH', `${CFG.AUTH}/admin/workspace`, { aiSettings: { ...original, personaName: wsName } });
    await L.sleep(2500);
    try {
      await L.askAi(dev, devDm, '/new');
      const a = await L.askAi(dev, devDm, 'Tên của bạn là gì? Trả lời một câu.');
      return { pass: p.status === 200 && has(a.text, wsName), actual: `PATCH ${p.status}; AI → ${describeAi(a)}` };
    } finally {
      await L.api(quan.token, 'PATCH', `${CFG.AUTH}/admin/workspace`, { aiSettings: original });
    }
  });

  await test('A3.6', 'Member không vào được cấu hình AI workspace', {
    account: acct(son), steps: ['son (Member) mở /admin/ai (API GET /admin/workspace)'],
    expected: 'HTTP 403; web/mobile ẩn mục Admin', hint: 'Khác 403 → @RequirePermission(MANAGE_WORKSPACE) trong admin.controller.ts.',
  }, async () => {
    const r = await L.api(son.token, 'GET', `${CFG.AUTH}/admin/workspace`);
    return { pass: r.status === 403, actual: `HTTP ${r.status}` };
  });

  await test('A3.7', 'AI dùng AI Context đúng vai trò khi trả lời', {
    account: acct(son),
    steps: ['son chat 1-1 với AI: "Theo chính sách công ty, tôi được chiết khấu tối đa bao nhiêu phần trăm?"',
      'son hỏi tiếp: "Khung lương Senior của công ty là bao nhiêu?"'],
    expected: 'Câu 1 chứa "5%" (đúng quyền Sales Executive); câu 2 KHÔNG chứa "35" (mục mật không lộ cho Member)',
    hint: 'Sai câu 1 → context-builder không chèn AI Context (aiContext block). Lộ câu 2 → lọc requiredCapability phía ai-service/auth-service hỏng — lỗi bảo mật.',
  }, async () => {
    const dm = await L.aiDm(son);
    await L.askAi(son, dm, '/new');
    const a = await L.askAi(son, dm, 'Theo chính sách công ty, tôi được chiết khấu tối đa bao nhiêu phần trăm?');
    const b = await L.askAi(son, dm, 'Khung lương Senior của công ty là bao nhiêu?');
    return { pass: !!(a.done && /\b5\s*%/.test(a.text) && b.done && !/35\s*[–-]\s*55|35\s*tr/i.test(b.text)),
      actual: `chiết khấu → ${describeAi(a)} | khung lương → ${describeAi(b)}` };
  });

  await test('A3.8', 'AI Hub hiển thị (web + mobile)', {
    account: acct(dev),
    steps: ['Web: thanh bên → AI Hub; Mobile: tab AI', 'Kiểm tra các ô: Chat với AI, AI Context, Memory, Persona, Usage'],
    expected: 'Mở được từng ô, không lỗi, giao diện giống nhau trên 2 nền tảng',
  }, async () => ({ status: 'MANUAL', actual: 'Kiểm tra tay trên web http://localhost:3000 và app mobile' }));
}

async function a4(ctx) {
  L.section('A4 — Vision, Reminder, Digest & Notetaker');
  const { dev, devDm, group } = ctx;

  await test('A4.1', 'Vision: đọc nội dung ảnh gửi trong chat', {
    account: acct(dev),
    steps: ['Chat 1-1 với AI: /new, gửi ảnh voucher (có dòng "CODE: …")', 'Gửi "Mã voucher trong ảnh tôi vừa gửi là gì?"'],
    expected: `Trả lời chứa "${F.CODES.voucher}"`,
    hint: 'AI không thấy ảnh → payload.history không mang imageUrls (chat-service) hoặc ai-service tải ảnh lỗi (CHAT_INTERNAL_URL).',
  }, async () => {
    await L.askAi(dev, devDm, '/new');
    const img = await L.upload(dev, `voucher-${L.RUN}.png`, 'image/png', await F.voucherPng());
    await L.send(dev, devDm, img.url, 'image');
    const a = await L.askAi(dev, devDm, 'Mã voucher (CODE) trong ảnh tôi vừa gửi là gì?');
    return { pass: !!(a.done && has(a.text, F.CODES.voucher)), actual: describeAi(a) };
  });

  await test('A4.2', 'Vision trong KB: PDF scan (chỉ có ảnh)', {
    account: acct(dev),
    steps: ['Nhóm test: thêm vào KB một PDF scan không có lớp chữ', 'Chờ "done"', 'Gửi "@AI Số hợp đồng dịch vụ trong tài liệu scan là gì?"'],
    expected: `KB status done; trả lời chứa "${F.CODES.scanContract}"`,
    hint: 'status error → nhánh vision của kb-processor (PDF không có text) hỏng; done nhưng sai → mô tả ảnh không được embed.',
  }, async () => {
    const buf = await F.scanPdf();
    const f = await L.upload(dev, `scan-hop-dong-${L.RUN}.pdf`, 'application/pdf', buf);
    const r = await L.api(dev.token, 'POST', `${CFG.CHAT}/api/kb/documents`, { conversationId: group, fileName: `scan-hop-dong-${L.RUN}.pdf`, mimeType: 'application/pdf', fileUrl: f.url });
    const d = await L.waitFor(async () => {
      const list = await L.api(dev.token, 'GET', `${CFG.CHAT}/api/kb/documents?conversationId=${group}`);
      const x = (list.json || []).find((k) => k.documentId === r.json?.documentId);
      return x && ['done', 'error'].includes(x.status) ? x : null;
    }, { timeoutMs: 120000 });
    if (d?.status !== 'done') return { pass: false, actual: `KB status=${d?.status || 'pending (quá 120s)'}` };
    const a = await L.askAi(dev, group, '@AI Số hợp đồng dịch vụ trong tài liệu scan là gì?');
    return { pass: !!(a.done && has(a.text, F.CODES.scanContract)), actual: `KB done (${d.chunkCount} chunk); AI → ${describeAi(a)}` };
  });

  await test('A4.3', 'Reminder: AI tạo nhắc nhở qua tool create_reminder', {
    account: acct(dev),
    steps: [`Chat 1-1 với AI: "Nhắc tôi sau 30 phút nữa: gọi khách hàng TEST-${L.RUN}"`, 'Mở màn hình Reminders (GET /api/reminders)'],
    expected: `Có reminder chứa "TEST-${L.RUN}", remindAt ≈ bây giờ + 30 phút (±5 phút), done=false`,
    hint: 'Không có reminder → model không gọi create_reminder (thiếu giờ hiện tại trong prompt, AI_TIMEZONE) hoặc tool ghi sai collection.',
  }, async () => {
    const t0 = Date.now();
    const a = await L.askAi(dev, devDm, `Nhắc tôi sau 30 phút nữa: gọi khách hàng TEST-${L.RUN}`);
    const rem = await L.waitFor(async () => ((await L.api(dev.token, 'GET', `${CFG.CHAT}/api/reminders`)).json || []).find((x) => has(x.text, `TEST-${L.RUN}`)), { timeoutMs: 15000 });
    if (!rem) return { pass: false, actual: `Không thấy reminder; AI → ${describeAi(a)}` };
    const diffMin = (new Date(rem.remindAt).getTime() - t0) / 60000;
    ctx.cleanup.reminders.push(rem.id);
    return { pass: diffMin > 25 && diffMin < 35 && !rem.done, actual: `"${rem.text}" lúc ${rem.remindAt} (sau ${diffMin.toFixed(1)} phút)` };
  });

  await test('A4.4', 'AI notetaker: tóm tắt cuộc gọi nhóm thành biên bản', {
    account: acct(dev),
    steps: ['Giả lập 1 cuộc gọi nhóm có bật AI notetaker: đẩy transcript vào Redis call:transcript:{callId}',
      'Phát sự kiện call:summarize (như chat-service làm khi cuộc gọi kết thúc)', 'Mở nhóm test'],
    expected: 'Trong 90s xuất hiện tin "meeting_summary" có overview + actionItems (có nhắc "báo giá")',
    hint: 'Không có tin → ai-service call-subscriber (kênh call:summarize) hoặc chat-service CallSummaryListener (call:summary:result).',
  }, async () => {
    const callId = crypto.randomUUID();
    const now = Date.now();
    const seg = (who, name, text, s) => JSON.stringify({ userId: who, displayName: name, text, ts: now - 600000 + s * 1000 });
    await L.db.collection('call_sessions').insertOne({ callId, conversationId: group, startedBy: dev.id, startedByName: 'Phong Dev', startedAt: new Date(now - 600000), endedAt: new Date(now), media: 'video', aiNotetaker: true, participants: [], summaryMessageId: null, testRun: L.RUN });
    await L.redis.rpush(`call:transcript:${callId}`,
      seg(dev.id, 'Phong Dev', 'Hôm nay chốt kế hoạch demo cho khách ABC vào thứ 5.', 1),
      seg(ctx.alice.id, 'Alice Test', 'Em sẽ chuẩn bị môi trường staging trước thứ 4.', 30),
      seg(dev.id, 'Phong Dev', 'Alice gửi báo giá cho khách trước thứ 6 nhé.', 60),
      seg(ctx.alice.id, 'Alice Test', 'Dạ, em gửi báo giá trước thứ 6.', 90));
    const since = new Date();
    await L.redis.publish('call:summarize', JSON.stringify({ callId, conversationId: group }));
    const m = await L.waitFor(() => L.db.collection('messages').findOne({ conversationId: group, type: 'meeting_summary', createdAt: { $gt: since } }), { timeoutMs: 90000 });
    ctx.cleanup.callIds.push(callId);
    if (!m) return { pass: false, actual: 'Không có tin meeting_summary sau 90s' };
    const p = JSON.parse(m.content);
    return { pass: !!(p.overview && p.actionItems?.length && p.actionItems.some((x) => has(x, 'bao gia'))),
      actual: `overview="${short(p.overview, 70)}", ${p.actionItems?.length} action item: ${short(p.actionItems?.join(' / '), 90)}` };
  });

  await test('A4.5', 'Daily digest gửi đúng lịch', {
    account: acct(ctx.quan),
    steps: ['Digest chạy theo cron mỗi giờ (phút :00, giờ của container ai-service = UTC).',
      '`node scripts/dev/test-module-a/index.js --digest-setup` → đặt dailyDigestHour = giờ UTC kế tiếp',
      'Sau giờ đó 5 phút: `node scripts/dev/test-module-a/index.js --digest-check`'],
    expected: 'Mỗi hội thoại có tin text/ai "hôm qua" nhận 1 tin AI tóm tắt; collection ai_digest_log có bản ghi digestDate = hôm qua',
  }, async () => ({ status: 'MANUAL', actual: 'Chạy 2 lệnh --digest-setup / --digest-check (phải chờ tới phút :00)' }));
}

module.exports = { a3, a4 };
