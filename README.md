# Arena Codex — Bách khoa nhân vật MOBA

Website tĩnh (HTML + CSS + JS thuần) chạy trên GitHub Pages. Mọi dữ liệu nằm trong `data.txt` (JSON). Nhân vật trong file là **DEMO** (giả định), không phải dữ liệu chính thức; hãy thay bằng dữ liệu của bạn.

## 1. Hoạt động thế nào
`app.js` tải `data.txt` (`fetch`, luôn kiểm tra bản mới), kiểm tra từng nhân vật rồi hiển thị: Home, Characters (tìm kiếm, lọc, sắp xếp), hồ sơ nhân vật (Tổng quan / Cốt truyện / Thông tin thêm), Compare (2–3 nhân vật), Database (báo lỗi dữ liệu + tự kiểm tra), Settings (cỡ chữ, giảm chuyển động, số card, chú giải màu). Nhân vật lỗi bị loại riêng, site vẫn chạy.

## 2. Chạy local
Không mở trực tiếp `index.html` (trình duyệt chặn fetch). Chạy `python -m http.server 8000` trong thư mục rồi vào `http://localhost:8000`.

## 3. Bật GitHub Pages
Repo → Settings → Pages → *Deploy from a branch* → `main` / `/ (root)` → Save.

## 4–6. Thêm, sửa, xóa nhân vật
Mở `data.txt`. Mỗi nhân vật là một khối `{ ... }` trong mảng `characters`.
- **Thêm:** sao chép một khối, dán vào, đổi nội dung. Giữa các khối có dấu phẩy, khối cuối không có.
- **Sửa:** đổi giá trị trong khối đó.
- **Xóa:** xóa cả khối và dấu phẩy thừa.
Không cần sửa `app.js`.

## 7. Đặt ID
Chuỗi chỉ gồm chữ, số, `_`, `-`; không trùng. Khuyến nghị `001`, `002`…

## 8–9. Tên ảnh và khai báo
Để ảnh cùng thư mục với `index.html`. Tên file chỉ gồm chữ, số, `_`, `-` và đuôi png/jpg/jpeg/webp/gif/svg.
```
"images": {"avatar":"001.png","splash":"001-splash.jpg","bg":"001-bg.jpg","passive":"001-passive.png","skill1":"001-skill-1.png","skill2":"001-skill-2.png","skill3":"001-skill-3.png"}
```
Hero hồ sơ dùng `splash`, nếu không có thì dùng `bg`.

## 10–11. Chỉ số, nội tại, kỹ năng
```
"stats": {"hp":{"base":3200,"growth":210},"moveSpeed":380,"attackSpeed":{"base":0.95,"growth":1.5,"unit":"%"}}
"passive": {"name":"Tên","desc":"Mô tả","conditions":"...","cooldown":"...","notes":"..."}
"skills": [ {"id":"001-s1","hotkey":"Q","name":"Tên","desc":"...","damage":"...","range":"450","radius":"200","cooldown":"8/7/6 giây","cost":"40 năng lượng","duration":"...","effects":["..."],"scaling":"...","conditions":"...","mechanics":"...","notes":"...","video":"001-s1.mp4"}, {...}, {...} ]
```
Khóa chỉ số: `hp, mana, physicalAttack, magicAttack, armor, magicResist, moveSpeed, attackSpeed, attackRange` (khóa khác vẫn hiển thị bằng tên khóa). Cần đúng 3 kỹ năng; thiếu/thừa sẽ có cảnh báo. Mục nào không có thì được ẩn.

## 12. Cốt truyện dài
`lore` hỗ trợ: `short, full, origin, background, personality, family, relationships, majorEvents, timeline, motivation, status, quotes`. `full` là mảng; mỗi phần tử là đoạn văn (chuỗi) hoặc `{"heading":"..."}`, `{"list":["..."]}`, `{"quote":"..."}`. `timeline` là mảng `{"time","text"}`. Không giới hạn độ dài; phần dài tự thu gọn, có nút Mở rộng.

## 13. Hiệu ứng màu
Có hai cách:
1. **Viết chuỗi thường** — hệ thống tự nhận theo ngữ nghĩa: số riêng = vàng; "10% sát thương vật lý" = cam; "sát thương phép" = tím; "sát thương chuẩn" = đỏ; "hồi máu" = xanh lá; "lá chắn" = xanh ngọc; "làm choáng/làm chậm/hất tung…" = xanh dương; "giảm giáp/đánh dấu…" = hồng; ô *cooldown* = xanh xám. "công vật lý/công phép" là hệ số nên cùng màu cam/tím.
2. **Segment có kiểu** (chính xác tuyệt đối):
```
"desc":[{"type":"text","value":"Gây "},{"type":"number","value":30},{"type":"text","value":" + "},{"type":"physical_damage","value":10,"unit":"percent"},{"type":"text","value":" lên mục tiêu."}]
```
Kiểu: `text, number, physical_damage, magic_damage, true_damage, healing, shield, cc, debuff, cooldown, ad_scale, ap_scale, hp_scale, level_scale`. Trường `unit`: `percent`, `second`, `meter`. `label` ghi đè nhãn mặc định. Xem **Settings** để thấy chú giải màu.

## Thông tin thêm (`extra`)
`skins [{name,image,note}]`, `weapons`, `titles`, `relationships [{name,id,type,desc}]` (có `id` sẽ thành liên kết), `voiceLines`, `videos [{title,file}]`, `artwork [file]`, `history [{version,date,notes}]`. Mục rỗng bị ẩn. Bấm ảnh để phóng to.

## 14. Kiểm tra lỗi JSON
Mở trang **Database**: lỗi nêu rõ ID và trường; phần "Tự kiểm tra" xác nhận bộ nhận diện màu, tìm kiếm không dấu và validator. Nếu cả site báo JSON không hợp lệ, dán `data.txt` vào jsonlint.com để tìm dấu phẩy/ngoặc thiếu.

## 15. Ảnh bị thiếu
Site hiện ô chữ cái thay thế, không phá bố cục. Tên file lỗi được liệt kê ở **Database**. Kiểm tra đúng tên, đúng chữ hoa/thường và đã tải lên repo.

## Cập nhật dữ liệu
`data.txt` luôn được tải với `cache: no-cache`, nên sau khi push, tải lại trang là thấy bản mới.
