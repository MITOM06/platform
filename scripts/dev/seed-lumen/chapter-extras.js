// Extras sprinkled over the 27/10 → 13/11 chapter: call history (ended + missed pills;
// every ended pill also becomes a call_sessions row in index.js seedExtras), stickers and
// voice notes (prebuilt/voice_*.m4a, macOS `say -v Linh`; see files-w46.js).
// Same DSL as chapter-nov.js; lines later than the seed run are dropped. DEV-ONLY seed data.

const t = (at, from, text, o = {}) => ({ at, from, text, ...o });
const call = (at, media, secs) => ({ at, from: 'system', type: 'system', text: `system.call.ended:${media}:${secs}` });
const missed = (at, media) => ({ at, from: 'system', type: 'system', text: `system.call.missed:${media}` });
const st = (at, from, emoji) => ({ at, from, type: 'sticker', text: emoji });
const voice = (at, from, file) => ({ at, from, type: 'voice', file });

const CHAPTER_EXTRAS = {
  'dm-khang-minh': [
    call('2026-11-04T19:55', 'video', 845),
    t('2026-11-04T19:56', 'minh', 'Cảm ơn anh, em chỉnh slide go-live theo góp ý của anh tối nay.'),
    st('2026-11-04T19:57', 'khang', '👍'),
    call('2026-11-12T20:25', 'audio', 420),
    missed('2026-11-13T07:30', 'audio'),
    t('2026-11-13T07:32', 'minh', 'Em đang chạy xe, 10 phút nữa em gọi lại anh nhé.'),
    call('2026-11-13T07:47', 'audio', 260),
  ],
  'dm-khang-dung': [
    call('2026-10-29T07:24', 'audio', 310),
    call('2026-11-06T18:40', 'audio', 540),
    call('2026-11-12T21:05', 'video', 960),
    st('2026-11-12T21:22', 'dung', '🙏'),
  ],
  'dm-huy-tri': [
    call('2026-11-02T10:10', 'audio', 180),
    call('2026-11-10T16:20', 'video', 1320),
    missed('2026-11-12T12:15', 'video'),
    t('2026-11-12T12:40', 'tri', 'Em đi ăn trưa nên lỡ cuộc gọi, có gì anh nhắn em nhé.'),
    t('2026-11-12T12:41', 'huy', 'Không gấp, chiều mình nói.'),
    st('2026-11-12T12:42', 'tri', '😊'),
  ],
  'dm-lananh-dat': [
    call('2026-11-05T16:05', 'audio', 600),
    call('2026-11-09T17:10', 'audio', 240),
    voice('2026-11-12T08:20', 'lananh', 'voice_lananh'),
    t('2026-11-12T08:24', 'dat', 'Dạ em sửa liền ạ.'),
    call('2026-11-12T13:35', 'audio', 380),
  ],
  'dm-oanh-dung': [
    call('2026-11-10T13:20', 'audio', 300),
    call('2026-11-12T11:30', 'audio', 150),
  ],
  'dm-minh-tri': [
    call('2026-11-11T19:10', 'audio', 200),
  ],
  retail: [
    t('2026-10-29T07:12', 'bao', 'Đồng bộ tồn kho Thủ Đức đang chậm, mình mở gọi nhanh, Vinh vào giúp.', { mention: ['vinh'] }),
    call('2026-10-29T07:33', 'video', 1080),
    st('2026-10-29T07:35', 'minh', '💯'),
    call('2026-11-12T10:30', 'audio', 600),
    st('2026-11-12T16:21', 'tung', '🎉'),
  ],
  fleet: [
    voice('2026-11-12T07:55', 'trang', 'voice_trang'),
    st('2026-11-12T08:02', 'huy', '👍'),
    call('2026-11-09T15:45', 'video', 1500),
  ],
  'x-tech-sync': [
    call('2026-11-11T18:20', 'video', 900),
  ],
  minhchau: [
    t('2026-10-28T05:50', 'minh', 'Mọi người vào cuộc gọi trực go-live, mình giữ cuộc gọi tới khi đơn đầu tiên lên.'),
    call('2026-10-28T06:40', 'video', 2400),
    st('2026-10-28T06:41', 'lananh', '🎉'),
    voice('2026-11-12T16:45', 'nhung', 'voice_nhung'),
  ],
  bod: [
    call('2026-11-11T19:00', 'video', 1260),
  ],
  sales: [
    call('2026-11-13T08:52', 'audio', 420),
    st('2026-11-13T09:21', 'lananh', '🔥'),
  ],
  hr: [
    voice('2026-11-12T17:25', 'oanh', 'voice_oanh'),
    st('2026-11-12T17:27', 'hang', '🤗'),
  ],
  fin: [
    voice('2026-11-12T14:20', 'giang', 'voice_giang'),
    st('2026-11-12T14:30', 'dung', '👍'),
  ],
  lunch: [
    st('2026-11-12T11:33', 'tung', '😂'),
    voice('2026-11-13T11:50', 'han', 'voice_han'),
    st('2026-11-13T11:52', 'uyen', '🥰'),
  ],
  ann: [
    st('2026-11-04T11:35', 'trang', '🔥'),
    st('2026-11-12T17:47', 'hai', '🎉'),
  ],
};

module.exports = { CHAPTER_EXTRAS };
