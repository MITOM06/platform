# Test Gate — chạy test + cổng coverage trước khi báo xong

> Áp dụng cho MỌI thay đổi code trong repo này (mọi phiên Claude, mọi agent). Merge vào `main` = Mac mini tự
> deploy production sau ~15 phút, và image chỉ được build khi CI xanh — nên test phải xanh **trước** khi mở PR.

## Luật

1. **Sửa code ⇒ chạy test của phần đã sửa, có coverage, trước khi nói "xong":**
   ```bash
   bash scripts/test-all.sh <phần…>      # vd: bash scripts/test-all.sh auth web
   bash scripts/test-all.sh              # mọi phần (trước khi mở PR lớn)
   ```
   Phần ↔ thư mục: `auth` = apps/server/auth-service · `ai` = apps/server/ai-service ·
   `connector` = apps/server/connector-service · `chat` = apps/server/chat-service (Spring, cần Docker) ·
   `web` = apps/web · `flutter` = apps/client.
2. **Test lỗi hoặc coverage tụt dưới ngưỡng ⇒ CHƯA xong.** Không báo cáo thành công, không mở PR. Sửa code hoặc
   viết thêm test. Không được tắt test, `skip` test đang đỏ, hay hạ ngưỡng để cho qua.
3. **Code mới / sửa logic ⇒ có test đi kèm** cho hành vi đó: ca đúng, ca sai (input rỗng, không đủ quyền, API
   lỗi), ca biên. Ưu tiên logic (service, guard, hàm thuần trong `lib/`, `domain/`) hơn giao diện.
4. **Test phải kiểm kết quả thật:** assert giá trị cụ thể (`toEqual`, `toHaveBeenCalledWith`,
   `rejects.toThrow(X)`, `expect(...)` của Flutter). Cấm test chỉ gọi hàm mà không assert, cấm snapshot cho logic.
   Kiểm nhanh test có thật: tạm sửa sai code → test phải FAIL → hoàn tác.
5. **Ratchet:** ngưỡng ở `scripts/ci/coverage-thresholds.txt`. Khi cổng in "coverage đã tăng, nâng ngưỡng: x=NN" (NN = % làm tròn xuống − 1 điểm biên)
   ⇒ sửa ngưỡng lên trong cùng PR. **Chỉ được nâng, không hạ.** Mục tiêu dài hạn: backend 90 · web 70 · flutter 60.
6. Test phát hiện bug thật mà không thuộc phạm vi task: không lén sửa — ghi `it.skip`/`skip:` kèm comment
   `BUG: …` và báo lại cho Khang.

## Cách cổng hoạt động

- `scripts/ci/coverage-gate.sh <phần>` đọc % **dòng** từ báo cáo (jest/vitest `coverage/coverage-summary.json`,
  JaCoCo `target/site/jacoco/jacoco.csv`, Flutter `coverage/lcov.info` — bỏ file sinh `*.g.dart`,
  `*.freezed.dart`, `l10n/`) và so với ngưỡng. Dưới ngưỡng → exit 1.
- CI (`.github/workflows/ci.yml`) chạy cùng cổng sau bước Test của mỗi job → PR làm tụt coverage sẽ đỏ.
- `scripts/test-all.sh` chạy y như CI ở máy local, gồm cả `tsc --noEmit` của web và `flutter analyze` (CI đỏ nếu
  file test có lỗi kiểu / cảnh báo analyzer, kể cả mức info).

## Bẫy môi trường đã biết

- **Node ≥ 22 trên máy local** (CI dùng Node 20):
  - jsdom báo `localStorage.clear` undefined → `test-all.sh` tự thêm `NODE_OPTIONS=--no-experimental-webstorage`.
  - `jest.spyOn(global, 'fetch')` báo "Property `fetch` does not exist" → gán `global.fetch = jest.fn()` và trả
    lại bản thật ở `afterEach`.
  - Fake timer "modern" + `useRealTimers()` làm mất `setTimeout` cho các test sau → dùng
    `jest.useFakeTimers({ legacyFakeTimers: true })` + `jest.advanceTimersByTime`.
- **Flutter:** phải `dart run build_runner build --delete-conflicting-outputs` trước `flutter test`
  (thiếu `*.g.dart` sẽ lỗi biên dịch hàng loạt). `test-all.sh` đã làm.
- **chat-service:** Testcontainers cần Docker đang chạy.

## Báo cáo khi xong task

Ghi rõ: phần đã chạy, số test pass, coverage từng phần trước → sau, ngưỡng có nâng không.
