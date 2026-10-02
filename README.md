# Macro Wire

Trang tin vĩ mô cập nhật thời gian thực (prototype), dạng terminal giống các macro news feed.

## Chạy thử

Yêu cầu Node.js 18 trở lên, không cần cài thư viện.

```bash
DEMO=1 node server/index.js      # dữ liệu giả, test giao diện
node server/index.js             # lấy tin thật từ RSS trong server/sources.js
FINNHUB_KEY=xxx node server/index.js   # thêm giá thị trường thật cho dải ticker
```

Mở http://localhost:8080

## Kiến trúc

```
Nguồn tin (RSS, API)  ->  server/index.js  --SSE /api/stream-->  public/index.html
                          - poll mỗi POLL_SECONDS
                          - khử trùng lặp (hash nguồn + link)
                          - phân loại: khu vực / tài sản / mức độ (server/classify.js)
```

| Endpoint | Mô tả |
|---|---|
| `GET /api/news?since=<ms>&limit=` | Danh sách tin, mới nhất trước |
| `GET /api/stream` | Server-Sent Events: `news`, `quotes`, `status` |
| `GET /api/status` | Trạng thái từng nguồn |

## Biến môi trường

| Biến | Mặc định | Ý nghĩa |
|---|---|---|
| `PORT` | 8080 | Cổng HTTP |
| `POLL_SECONDS` | 60 | Chu kỳ quét RSS |
| `QUOTE_SECONDS` | 15 | Chu kỳ lấy giá |
| `FINNHUB_KEY` | trống | API key Finnhub cho ticker |
| `SYMBOLS` | SPY,QQQ,TLT,GLD,USO,UUP | Mã hiển thị trên ticker |
| `DEMO` | 0 | `1` = sinh dữ liệu giả |

## Cần đấu nối gì để chạy thật

Xem phần trả lời trong phiên làm việc, tóm tắt:

1. Nguồn tin: RSS miễn phí (có sẵn) → nâng cấp lên API tin trả phí nếu cần độ trễ tính bằng giây.
2. Giá thị trường: Finnhub / Twelve Data / Polygon (key qua biến môi trường).
3. Lịch kinh tế: chưa có, cần một nhà cung cấp lịch (Trading Economics, FMP...).
4. Lưu trữ: hiện lưu trong RAM, mất khi khởi động lại → Postgres/Redis.
5. Hosting: cần server chạy liên tục (VPS, Render, Fly.io, Railway). Netlify/Vercel thuần serverless không giữ được kết nối SSE lâu.
