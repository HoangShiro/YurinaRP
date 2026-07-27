# Hướng Dẫn Sử Dụng Event Triggers & Server Features trên NIM Proxy

Tài liệu này hướng dẫn cách sử dụng các **Event Triggers** (Kích hoạt chèn prompt tự động) và **Server Features** (Bộ xử lý định dạng văn bản nâng cao) được tích hợp trong NIM Proxy.

---

## 📌 Nguyên Tắc Hoạt Động Chung

1. **Truyền Thẻ HTML**: Các thẻ cấu hình HTML (`<shorter>`, `<keyremind>`, `<lorebook>`, `<fixformat>`, `<autolinebreak>`) có thể được đặt ở bất kỳ đâu trong context (System Prompt, User Request, Lịch sử chat, v.v.).
2. **Làm Sạch Context (Tag Stripping)**: Trước khi gửi request sang LLM Provider (NVIDIA NIM), server sẽ **tự động quét và xoá hoàn toàn** tất cả các thẻ HTML cấu hình này khỏi context.
3. **Thực Thi Tự Động**: 
   - Với **Event Triggers**: Nếu thoả mãn điều kiện kích hoạt, đoạn `<prompt>` tương ứng sẽ được chèn vào vị trí cấu hình.
   - Với **Server Features**: Server sẽ tự động biến đổi luồng văn bản (ngay trong khi LLM đang stream SSE hoặc phản hồi non-stream).

---

## 🅰️ Phần A: Event Triggers (Kích Hoạt Chèn Prompt)

### 1. Shorter Response (`<shorter>`)

Tự động nhắc nhở LLM viết ngắn lại nếu câu trả lời gần nhất của Assistant vượt quá độ dài ký tự cho phép.

#### Cấu trúc:
```html
<shorter>
  <length>500</length>
  <prompt>
[Hệ thống]: Câu trả lời vừa rồi của bạn quá dài. Hãy trả lời ngắn gọn và súc tích hơn dưới 500 ký tự.
  </prompt>
</shorter>
```

#### Điều kiện kích hoạt:
- Server lấy tin nhắn `assistant` gần nhất trong lịch sử chat.
- Đếm tổng số ký tự **không tính khoảng trắng (`\s`) và không tính xuống dòng (`\r`, `\n`)**.
- Nếu số ký tự này **vượt quá** giá trị trong `<length>x</length>`, prompt trong `<prompt>` sẽ được tự động chèn vào **cuối tin nhắn User request hiện tại**.

---

### 2. Keyword Reminder (`<keyremind>`)

Kiểm tra xem câu trả lời gần nhất của Assistant có chứa từ khoá chỉ định hay không. Nếu **không chứa**, prompt nhắc nhở tương ứng sẽ được kích hoạt.

#### Cấu trúc:
```html
<keyremind>
  <key1>Solaria</key1>
  <prompt1>
[Nhắc nhở]: Đừng quên đề cập đến vương quốc Solaria trong câu trả lời!
  </prompt1>

  <key2>YuriHQ</key2>
  <prompt2>
[Nhắc nhở]: Hãy cập nhật trạng thái của YuriHQ ở cuối câu trả lời.
  </prompt2>
</keyremind>
```

#### Điều kiện kích hoạt:
- Server kiểm tra tin nhắn `assistant` gần nhất.
- Với mỗi cặp `<keyN>` và `<promptN>`: Nếu tin nhắn Assistant **KHÔNG** chứa từ khoá trong `<keyN>`, prompt trong `<promptN>` sẽ được chèn vào **cuối tin nhắn User request hiện tại**.
- Hỗ trợ khai báo nhiều cặp từ khoá và prompt khác nhau trong cùng một thẻ `<keyremind>`.

---

### 3. Lorebook (`<lorebook>`)

Quét từ khoá theo độ sâu lịch sử chat và tự động chèn dữ liệu kiến thức / lore vào `context` hoặc `user_msg`.
*(Chi tiết đầy đủ xem tại file [lorebook.md](file:///e:/5-PJ/NIM_proxy/lorebook.md))*

---

## 🅱️ Phần B: Server Features (Bộ Xử Lý Định Dạng LLM)

Các tính năng này được bật/tắt bằng thẻ HTML và thực thi trực tiếp trên luồng văn bản trả về của LLM (kể cả khi đang stream).

### 1. Auto Fix Format (`<fixformat>`)

Tự động phát hiện và bổ sung các cặp ngoặc hoặc ký tự định dạng bị thiếu do LLM sinh ra thiếu sót.

#### Cấu trúc:
```html
<fixformat>on</fixformat>
```
*(Giá trị hỗ trợ: `on` để bật, `off` để tắt)*

#### Tính năng:
Tự động thêm/bù thông minh các cặp ngoặc bị thiếu:
- Ngoặc kép: `"..."`
- Ngoặc đơn / nghiêng: `*...*`, `**...**`
- Code / Thought: `` `...` ``
- Ngoặc vuông & ngoặc tròn: `[...]`, `(...)`

#### Ví dụ minh hoạ:
- **Văn bản gốc từ LLM**: `*Azuriel bowed his head slightly.`
- **Sau khi Fix Format**: `*Azuriel bowed his head slightly.*`

- **Văn bản gốc từ LLM**: `[ 🕒 Day 250, Time: 9:35 PM`
- **Sau khi Fix Format**: `[ 🕒 Day 250, Time: 9:35 PM ]`

---

### 2. Auto Line Break (`<autolinebreak>`)

Tự động xuống dòng thông minh (`\n\n`) khi phát hiện các khối định dạng văn bản bị viết liền kề trên cùng một dòng.

#### Cấu trúc:
```html
<autolinebreak>on</autolinebreak>
```
*(Giá trị hỗ trợ: `on` để bật, `off` để tắt)*

#### Tính năng:
Phát hiện chuyển đổi giữa các kiểu cấu trúc văn bản vai diễn (Roleplay Format) để tự động thêm dòng trống (`\n\n`):
- Giữa khối hành động `*...*` và lời thoại `"..."`
- Giữa lời thoại `"..."` và suy nghĩ `` `...` ``
- Giữa văn bản và dòng phân cảnh `---`
- Giữa văn bản và hộp trạng thái `[...]`

#### Ví dụ minh hoạ:
- **Văn bản gốc từ LLM**: `*Azuriel bowed his head slightly.* "Understood. I will coordinate..." --- *Aurelius nodded.*`
- **Sau khi Auto Line Break**:
  ```markdown
  *Azuriel bowed his head slightly.*

  "Understood. I will coordinate..."

  ---

  *Aurelius nodded.*
  ```

---

## 📋 Bảng Tóm Tắt Tất Cả Các Thẻ (Quick Reference)

| Thẻ HTML | Loại | Nơi chèn / Tác dụng | Ví dụ mẫu |
| :--- | :--- | :--- | :--- |
| `<shorter>` | Trigger | Cuối User request msg | `<shorter><length>500</length><prompt>...</prompt></shorter>` |
| `<keyremind>` | Trigger | Cuối User request msg | `<keyremind><key1>kw</key1><prompt1>...</prompt1></keyremind>` |
| `<lorebook>` | Trigger | Đầu Context hoặc Cuối User msg | `<lorebook><"Book"><"Lore"><keywords>...</keywords><prompt>...</prompt></"Lore"></"Book"></lorebook>` |
| `<fixformat>` | Server Feature | Sửa định dạng stream | `<fixformat>on</fixformat>` |
| `<autolinebreak>` | Server Feature | Tự động xuống dòng stream | `<autolinebreak>on</autolinebreak>` |
