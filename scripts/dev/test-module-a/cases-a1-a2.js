// A1 — AI conversation & memory · A2 — Knowledge base & agentic tools.
const L = require('./lib');
const F = require('./fixtures');

const { CFG, test, has, short, describeAi } = L;
const acct = (u) => `${u.email} / ${CFG.PASSWORD}`;

async function a1(ctx) {
  L.section('A1 — Hội thoại & bộ nhớ AI');
  const { dev, devDm, group } = ctx;

  await test('A1.1', 'Chat 1-1 với AI: trả lời streaming', {
    account: acct(dev),
    steps: ['Web: AI Hub → "Chat với PON AI" (API: POST /api/conversations {participantId: AI bot})',
      'Gửi: "Giới thiệu ngắn gọn về bạn trong 2 câu."'],
    expected: 'Nhận ≥2 sự kiện AI_STREAM_CHUNK rồi AI_STREAM_DONE; nội dung không rỗng; chunk đầu < 15s',
    hint: 'Không có sự kiện nào → xem `docker logs ai-service` (ANTHROPIC_API_KEY sai / consumer RabbitMQ chết). Chỉ có 1 chunk → streaming bị gộp (xem agentic-loop.service.ts).',
  }, async () => {
    await L.askAi(dev, devDm, '/new');
    const a = await L.askAi(dev, devDm, 'Giới thiệu ngắn gọn về bạn trong 2 câu.');
    const ok = a.done && a.chunks >= 2 && a.text.trim() && a.firstChunkMs < 15000;
    return { pass: !!ok, actual: a.done ? `${a.chunks} chunk, chunk đầu ${(a.firstChunkMs / 1000).toFixed(1)}s, xong ${(a.totalMs / 1000).toFixed(1)}s — ${describeAi(a)}` : describeAi(a) };
  });

  await test('A1.2', '@AI trong nhóm: chỉ trả lời khi được nhắc tên', {
    account: acct(dev),
    steps: [`Nhóm test "${ctx.groupName}" (dev + alice)`, 'Gửi tin thường "Chào cả nhà" (không @AI)', 'Gửi "@AI trả lời đúng một từ: SẴN SÀNG"'],
    expected: 'Tin thường KHÔNG sinh trả lời AI; tin có @AI có trả lời chứa "SẴN SÀNG"',
    hint: 'AI trả lời cả tin thường → kiểm tra điều kiện mention trong MessageController/ChatController. Không trả lời @AI → xem log chat-service (publish ai.requests).',
  }, async () => {
    const before = await L.db.collection('messages').countDocuments({ conversationId: group, type: 'ai' });
    await L.send(dev, group, 'Chào cả nhà');
    await L.sleep(6000);
    const afterPlain = await L.db.collection('messages').countDocuments({ conversationId: group, type: 'ai' });
    const a = await L.askAi(dev, group, '@AI trả lời đúng một từ: SẴN SÀNG');
    const ok = afterPlain === before && a.done && has(a.text, 'san sang');
    return { pass: !!ok, actual: `tin thường → ${afterPlain - before} trả lời AI; tin @AI → ${describeAi(a)}` };
  });

  await test('A1.3', 'Trí nhớ ngắn hạn trong cùng hội thoại', {
    account: acct(dev),
    steps: ['Chat 1-1 với AI, gõ "/new" để bắt đầu phiên mới', `Gửi "Tôi đang xử lý đơn hàng TEMP-${L.RUN}, bạn chỉ cần trả lời OK."`, 'Gửi "Mã đơn hàng tôi vừa nhắc là gì?"'],
    expected: `Câu trả lời thứ 2 chứa "TEMP-${L.RUN}"`,
    hint: 'Không nhớ → lịch sử phiên (ai_sessions / sliding window) không được nạp: xem ai-session.service.ts và history[] trong payload chat-service gửi sang.',
  }, async () => {
    await L.askAi(dev, devDm, '/new');
    const first = await L.askAi(dev, devDm, `Tôi đang xử lý đơn hàng TEMP-${L.RUN}, bạn chỉ cần trả lời OK.`);
    const m = first.done ? await L.aiMessageAfter(dev, devDm, first.sent) : null;
    const tr = m ? (await L.api(dev.token, 'GET', `${CFG.CHAT}/api/messages/${m.id}/trace`)).json : null;
    // remember_fact = the model chose LONG-term memory; A1.4 can't then expect forgetting.
    ctx.a13LongTerm = (tr?.toolCalls || []).some((c) => c.toolName === 'remember_fact');
    const a = await L.askAi(dev, devDm, 'Mã đơn hàng tôi vừa nhắc là gì? Trả lời đúng mã.');
    return { pass: !!(a.done && has(a.text, `TEMP-${L.RUN}`)), actual: `${describeAi(a)}${ctx.a13LongTerm ? ' (AI đã tự gọi remember_fact)' : ''}` };
  });

  await test('A1.4', 'Lệnh /new xoá ngữ cảnh ngắn hạn', {
    account: acct(dev),
    steps: ['Ngay sau A1.3, gửi "/new"', 'Gửi "Mã đơn hàng tôi nhắc lúc nãy là gì?"'],
    expected: `"/new" trả về thông báo phiên mới; câu sau KHÔNG chứa "TEMP-${L.RUN}" (đã quên). Nếu ở A1.3 AI tự lưu vào trí nhớ dài hạn (remember_fact) thì SKIP`,
    hint: 'Vẫn nhớ → createNewSession không vô hiệu phiên cũ, hoặc history vẫn lấy từ messages của hội thoại.',
  }, async () => {
    const n = await L.askAi(dev, devDm, '/new');
    const a = await L.askAi(dev, devDm, 'Mã đơn hàng tôi nhắc lúc nãy là gì?');
    const actual = `/new → "${short(n.text, 60)}"; hỏi lại → ${describeAi(a)}`;
    if (ctx.a13LongTerm && has(a.text, `TEMP-${L.RUN}`)) {
      return { status: 'SKIP', actual: `${actual} — không kết luận được: ở A1.3 AI đã lưu mã vào trí nhớ DÀI hạn (remember_fact), nhớ lại là đúng thiết kế` };
    }
    return { pass: !!(n.done && a.done && !has(a.text, `TEMP-${L.RUN}`)), actual };
  });

  const plate = `51K-${L.RUN}`;
  await test('A1.5', 'Trí nhớ dài hạn: tự rút trích fact ở lượt 3, nhớ sang hội thoại khác', {
    account: acct(dev),
    steps: [`Trong nhóm test gửi 3 tin @AI, tin đầu: "@AI biển số xe máy của tôi là ${plate}, nhớ giúp tôi nhé"`,
      'Chờ tối đa 60s → GET /api/ai/memories/{nhóm test} có fact chứa biển số',
      'Sang chat 1-1 với AI (hội thoại khác), gõ /new rồi hỏi "Biển số xe máy của tôi là gì?"'],
    expected: `memory của nhóm có keyFact chứa "${plate}"; chat 1-1 trả lời đúng "${plate}"`,
    hint: 'Không có fact → fact-extractor (lượt 3) lỗi: xem log "Fact extraction failed", Voyage 429. Có fact nhưng không nhớ chéo → memory-vector.service (Qdrant ai_memory) không trả fact theo userId.',
  }, async () => {
    await L.askAi(dev, group, `@AI biển số xe máy của tôi là ${plate}, nhớ giúp tôi nhé`);
    await L.askAi(dev, group, '@AI tôi thích uống cà phê sữa đá mỗi sáng');
    await L.askAi(dev, group, '@AI cảm ơn, vậy là đủ rồi');
    const mem = await L.waitFor(async () => {
      const r = await L.api(dev.token, 'GET', `${CFG.CHAT}/api/ai/memories/${group}`);
      return (r.json?.keyFacts || []).some((f) => has(f, L.RUN)) ? r.json : null;
    }, { timeoutMs: 60000, everyMs: 4000 });
    if (!mem) return { pass: false, actual: 'Sau 60s memory của nhóm test chưa có fact nào chứa biển số' };
    await L.askAi(dev, devDm, '/new');
    const a = await L.askAi(dev, devDm, 'Biển số xe máy của tôi là gì?');
    return { pass: !!(a.done && has(a.text, plate)), actual: `fact: "${short(mem.keyFacts.find((f) => has(f, L.RUN)), 70)}"; chat 1-1 → ${describeAi(a)}` };
  });

  await test('A1.6', 'Màn hình AI Memory: xem & xoá memory của hội thoại', {
    account: acct(dev),
    steps: ['Web: Cài đặt → AI Memory (API GET /api/ai/memories)', 'Xoá memory nhóm test: DELETE /api/ai/memories/{id}', 'GET lại memory nhóm test'],
    expected: 'GET danh sách → 200 có summary/keyFacts; DELETE → 204; GET nhóm test sau khi xoá → 404',
    hint: 'Sai mã trạng thái → AiMemoryController.java; web/mobile phải hiểu 404 = "chưa có memory".',
  }, async () => {
    const list = await L.api(dev.token, 'GET', `${CFG.CHAT}/api/ai/memories`);
    const del = await L.api(dev.token, 'DELETE', `${CFG.CHAT}/api/ai/memories/${group}`);
    const after = await L.api(dev.token, 'GET', `${CFG.CHAT}/api/ai/memories/${group}`);
    const ok = list.status === 200 && [200, 204].includes(del.status) && after.status === 404;
    return { pass: ok, actual: `GET list ${list.status}, DELETE ${del.status}, GET sau xoá ${after.status}` };
  });

  await test('A1.7', 'Fallback model khi model chính lỗi', {
    account: '—',
    steps: ['Không test live được an toàn (phải làm hỏng model chính). Chạy unit test:', 'pnpm --filter ai-service test -- -t "fallback"'],
    expected: 'Các test fallback pass (model dự phòng được gọi khi model chính 5xx/overloaded)',
  }, async () => ({ status: 'MANUAL', actual: 'Chạy lệnh unit test ở trên và đối chiếu' }));
}

async function a2(ctx) {
  L.section('A2 — Knowledge Base & Agentic Tool');
  const { dev, group } = ctx;
  const kb = {};

  const uploadKb = async (key, name, mime, buf) => {
    const f = await L.upload(dev, name, mime, buf);
    await L.send(dev, group, JSON.stringify({ url: f.url, name, size: f.size }), 'file');
    const r = await L.api(dev.token, 'POST', `${CFG.CHAT}/api/kb/documents`, { conversationId: group, fileName: name, mimeType: mime, fileUrl: f.url });
    if (r.status !== 201) throw new Error(`POST /api/kb/documents → HTTP ${r.status} ${short(r.text, 100)}`);
    const doc = await L.waitFor(async () => {
      const list = await L.api(dev.token, 'GET', `${CFG.CHAT}/api/kb/documents?conversationId=${group}`);
      const d = (list.json || []).find((x) => x.documentId === r.json.documentId);
      return d && ['done', 'error'].includes(d.status) ? d : null;
    }, { timeoutMs: 90000, everyMs: 2000 });
    kb[key] = doc;
    return doc;
  };
  const kbHint = 'status=error → `docker logs ai-service | grep -i kb` (VOYAGE_API_KEY, CHAT_INTERNAL_URL, pdf-parse). Kẹt pending → ai-service không subscribe kênh Redis kb:process.';

  await test('A2.1', 'Upload TXT vào KB → chunk + embedding', {
    account: acct(dev), steps: ['Trong nhóm test bấm đính kèm → "Thêm vào Knowledge Base", chọn file TXT', 'Chờ trạng thái tài liệu'],
    expected: 'POST /api/kb/documents → 201; trạng thái chuyển "done", chunkCount ≥ 1 trong 90s', hint: kbHint,
  }, async () => {
    const d = await uploadKb('txt', `kho-van-${L.RUN}.txt`, 'text/plain', F.kbTxt());
    return { pass: d?.status === 'done' && d.chunkCount >= 1, actual: d ? `status=${d.status}, chunkCount=${d.chunkCount}` : 'không xong sau 90s' };
  });

  await test('A2.2', 'Upload PDF vào KB', {
    account: acct(dev), steps: ['Upload file PDF có lớp chữ'], expected: 'status "done", chunkCount ≥ 1', hint: kbHint,
  }, async () => {
    const d = await uploadKb('pdf', `audit-plan-${L.RUN}.pdf`, 'application/pdf', F.kbPdf());
    return { pass: d?.status === 'done' && d.chunkCount >= 1, actual: d ? `status=${d.status}, chunkCount=${d.chunkCount}` : 'không xong sau 90s' };
  });

  let answerMsg = null;
  await test('A2.3', 'AI trả lời từ KB và trích dẫn nguồn (câu hỏi sát văn bản)', {
    account: acct(dev), steps: ['Gửi "@AI Mã kho bí mật của chi nhánh Bình Dương là gì?"'],
    expected: `Trả lời chứa "${F.CODES.kbSecret}"; AI_STREAM_DONE.sources có tên file kho-van-${L.RUN}.txt`,
    hint: 'Trả lời "không có thông tin" + sources rỗng → RAG không đưa chunk vào prompt: `docker logs ai-service | grep hasKbContext` = false ⇒ điểm tương đồng < config.kb.scoreThreshold (0.5) trong context-builder.service.ts. Đúng nhưng sources rỗng → mergeSources/getFileNames.',
  }, async () => {
    const a = await L.askAi(dev, group, '@AI Mã kho bí mật của chi nhánh Bình Dương là gì?');
    answerMsg = a;
    const files = (a.done?.sources || []).map((s) => s.fileName).filter(Boolean);
    const ok = a.done && has(a.text, F.CODES.kbSecret) && files.some((f) => f.includes(L.RUN));
    return { pass: !!ok, actual: `${describeAi(a)} | sources=[${files.join(', ')}]` };
  });

  await test('A2.4', 'AI trả lời từ KB với câu hỏi diễn đạt khác (thực tế)', {
    account: acct(dev), steps: ['Gửi "@AI Kho còn bao nhiêu thùng hàng mã SKU-4471?"'],
    expected: `Trả lời chứa "${F.CODES.stock}"`,
    hint: 'Đây là lỗi đã biết: điểm tương đồng voyage-4-lite cho câu hỏi diễn đạt khác chỉ ~0.25–0.4 < scoreThreshold 0.5 nên RAG bị chặn. Sửa ngưỡng (config.kb.scoreThreshold / KB_SCORE_THRESHOLD) hoặc dùng top-k + reranker.',
  }, async () => {
    const a = await L.askAi(dev, group, '@AI Kho còn bao nhiêu thùng hàng mã SKU-4471?');
    return { pass: !!(a.done && has(a.text, String(F.CODES.stock))), actual: describeAi(a) };
  });

  await test('A2.5', 'AI đọc đúng nội dung PDF', {
    account: acct(dev), steps: ['Gửi "@AI What is the audit deadline and who is the audit owner in the warehouse audit plan?"'],
    expected: `Trả lời chứa "${F.CODES.pdfDeadline}" (hoặc 28/11) và "${F.CODES.pdfOwner}"`,
    hint: 'PDF done nhưng không trả lời được → chunk PDF hỏng (pdf-parse) hoặc lỗi ngưỡng như A2.4.',
  }, async () => {
    const a = await L.askAi(dev, group, '@AI What is the audit deadline and who is the audit owner in the warehouse audit plan?');
    const dateOk = has(a.text, F.CODES.pdfDeadline) || /28[/.-]11|11[/.-]28|28 (thang|th)?\s*11|november 28|28 november/i.test(L.norm(a.text));
    return { pass: !!(a.done && dateOk && has(a.text, 'hoa')), actual: describeAi(a) };
  });

  await test('A2.6', 'Agent Trace: đủ tool call / token / thời gian', {
    account: acct(dev), steps: ['Bấm "Xem trace" trên câu trả lời của A2.3 (API GET /api/messages/{id}/trace)'],
    expected: 'model không rỗng, inputTokens > 0, outputTokens > 0, processingMs > 0',
    hint: 'Trace null → ai-service không gửi trace trong AI_STREAM_DONE hoặc AiResponseListener không lưu.',
  }, async () => {
    if (!answerMsg?.sent) return { status: 'SKIP', actual: 'A2.3 không có câu trả lời' };
    const m = await L.aiMessageAfter(dev, group, answerMsg.sent);
    if (!m) return { pass: false, actual: 'Không tìm thấy tin AI đã lưu' };
    const t = (await L.api(dev.token, 'GET', `${CFG.CHAT}/api/messages/${m.id}/trace`)).json || {};
    const ok = t.model && t.inputTokens > 0 && t.outputTokens > 0 && t.processingMs > 0;
    return { pass: !!ok, actual: `model=${t.model}, in=${t.inputTokens}, out=${t.outputTokens}, ${t.processingMs}ms, tools=[${(t.toolCalls || []).map((c) => c.toolName).join(', ')}]` };
  });

  const toolCase = async (id, tool, conv, prompt, check, extra, hint) => test(id, `Tool ${tool}`, {
    account: acct(dev), steps: [`Gửi "${prompt}"`, 'Mở trace của câu trả lời'],
    expected: `trace.toolCalls có "${tool}"${extra ? `; ${extra}` : ''}`,
    hint: hint || `Model không gọi tool → kiểm tra tool có trong registry & mô tả tool (apps/server/ai-service/src/tools/${tool.replace(/_/g, '-')}.tool.ts).`,
  }, async () => {
    const run = async (q) => {
      const a = await L.askAi(dev, conv, q);
      const m = a.done ? await L.aiMessageAfter(dev, conv, a.sent) : null;
      const t = m ? (await L.api(dev.token, 'GET', `${CFG.CHAT}/api/messages/${m.id}/trace`)).json : null;
      return { a, calls: t?.toolCalls || [] };
    };
    let { a, calls } = await run(prompt);
    if (!a.done) return { pass: false, actual: describeAi(a) };
    let retried = '';
    // The model may legitimately answer from history without the tool; insist once
    // before calling it a failure, so a FAIL means the tool path is really broken.
    if (!calls.some((c) => c.toolName === tool)) {
      ({ a, calls } = await run(`${prompt} (Bắt buộc gọi công cụ ${tool}, không trả lời từ trí nhớ.)`));
      retried = ' [đã hỏi lại lần 2 vì lần 1 model không gọi tool]';
    }
    const tools = calls.map((c) => c.toolName);
    const result = calls.find((c) => c.toolName === tool)?.resultSummary || '';
    const ok = tools.includes(tool) && (!check || check(a.text, result));
    return { pass: ok, actual: `tools=[${tools.join(', ')}], tool trả về: "${short(result, 80)}" — ${describeAi(a)}${retried}` };
  });

  // Users' _id is an ObjectId; querying it with the string id from the JWT/message never matches.
  const idHint = (file) => `Nếu trả lời có ID thô (24 ký tự hex) hoặc "User not found": ${file} tra users bằng _id dạng string — phải đổi sang ObjectId (new Types.ObjectId(id)). Vi phạm rule no-raw-system-data-in-ui.`;
  await toolCase('A2.7', 'search_messages', ctx.engGroup, '@AI tìm trong nhóm này tin nhắn nào nhắc tới "PR #212" và ai gửi?',
    (t, r) => has(t, 'Pham Duc Anh') && !/[0-9a-f]{24}/.test(t + r), 'trả lời nêu TÊN "Phạm Đức Anh", không có ID thô', idHint('search-messages.tool.ts (dòng ~47)'));
  await toolCase('A2.8', 'summarize_conversation', ctx.engGroup, '@AI dùng công cụ tóm tắt cuộc trò chuyện của nhóm này trong 3 gạch đầu dòng');
  await toolCase('A2.9', 'get_user_info', group, '@AI dùng công cụ get_user_info xem hồ sơ của tôi rồi cho biết tên hiển thị của tôi',
    (t, r) => has(r, 'Phong Dev') && has(t, 'Phong Dev'), 'KẾT QUẢ TOOL (không phải câu trả lời) chứa "Phong Dev"', idHint('get-user-info.tool.ts (dòng ~22)'));
  await toolCase('A2.10', 'search_knowledge_base', group, '@AI dùng công cụ tìm kiếm tài liệu (knowledge base) để cho biết người phụ trách kho và số nội bộ', (t) => has(t, '2207'), 'trả lời chứa số nội bộ 2207');
  return kb;
}

module.exports = { a1, a2 };
