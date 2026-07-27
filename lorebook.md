# Hướng Dẫn Sử Dụng & Viết Lorebook trên NIM Proxy

Tính năng **Lorebook Trigger** cho phép bạn nhúng kiến thức thế giới, thông tin nhân vật, bản đồ hoặc dữ liệu bổ trợ trực tiếp vào context dưới dạng thẻ HTML. Proxy sẽ tự động làm sạch các thẻ HTML này trước khi gửi request tới LLM, và chỉ chèn những nội dung `<prompt>` được kích hoạt vào đúng vị trí chỉ định.

---

## 1. Cấu Trúc Tổng Quát

```html
<lorebook>
  <"Tên_Bộ_Lorebook">
    <"Tên_Mục_Lore">
      <depth_scan>1</depth_scan>
      <insertion>context</insertion>
      <keywords>từ khoá 1, từ khoá 2, ...</keywords>
      <prompt>
Nội dung thông tin lore cần chèn vào LLM...
      </prompt>
    </"Tên_Mục_Lore">
  </"Tên_Bộ_Lorebook">
</lorebook>
```

---

## 2. Chi Tiết Các Thẻ & Tham Số

| Thẻ | Loại | Mặc định | Mô tả & Tùy chọn |
| :--- | :--- | :--- | :--- |
| `<lorebook>` | Bắt buộc | - | Thẻ bao ngoài cùng chứa toàn bộ dữ liệu lorebook. |
| `<"Tên_Bộ_Lorebook">` | Bắt buộc | - | Thẻ phân loại nhóm lorebook (ví dụ: `<"World_Atlas">`, `<"Characters">`). Có thể bỏ dấu `"` nếu muốn. |
| `<"Tên_Mục_Lore">` | Bắt buộc | - | Thẻ tên của mục lore cụ thể (ví dụ: `<"Stagaia_Map">`, `<"Aurelius_Bio">`). |
| `<depth_scan>` | Tùy chọn | `1` | **Độ sâu quét tin nhắn**: Số lượng cặp tin nhắn (`user request msg` + `last assistant msg`) tính từ cuối cuộc hội thoại trở về trước được dùng để dò tìm `keywords`. |
| `<insertion>` | Tùy chọn | `context` | **Nơi chèn prompt** khi được kích hoạt:<br>• `context`: Chèn vào ngay sau System Prompt (đầu context).<br>• `user_msg`: Chèn vào cuối tin nhắn User request hiện tại. |
| `<keywords>` | Bắt buộc | - | Danh sách từ khoá kích hoạt lore, phân cách bởi dấu phẩy `,`. Dò tìm không phân biệt chữ hoa/thường (case-insensitive). |
| `<prompt>` | Bắt buộc | - | Đoạn text / prompt kiến thức sẽ được truyền tới LLM khi kích hoạt. |

---

## 3. Các Ví Dụ Thực Tế

### Ví Dụ 1: Lorebook Địa Danh & Bản Đồ (Chèn vào `context`)
Chèn thông tin bản đồ vào vị trí `context` (ngay sau System Prompt) khi phát hiện người dùng hoặc AI nhắc tới bản đồ Stagaia trong 2 cặp tin nhắn gần nhất:

```html
<lorebook>
  <"World_Atlas">
    <"Stagaia_Map">
      <depth_scan>2</depth_scan>
      <insertion>context</insertion>
      <keywords>map, stagaia map, bản đồ stagaia, khu vực solis</keywords>
      <prompt>
[Lorebook Entry: Bản Đồ Stagaia]
- Địa hình: Vùng bờ biển Solis Aeterna phía Đông Holy Empire.
- Điểm chiến lược: YuriHQ nằm ở Phân khu 4 Vòng Thương Mại.
- Tháp canh: 12 tháp canh ven biển do Hoàng Gia Solaria trực tiếp tuần tra.
      </prompt>
    </"Stagaia_Map">
  </"World_Atlas">
</lorebook>
```

---

### Ví Dụ 2: Lorebook Thông Tin Nhân Vật (Chèn vào `user_msg`)
Chèn hồ sơ nhân vật Hoàng Đế Aurelius vào cuối tin nhắn User hiện tại khi phát hiện từ khoá trong 1 cặp tin nhắn gần nhất:

```html
<lorebook>
  <"Character_Database">
    <"Emperor_Aurelius">
      <depth_scan>1</depth_scan>
      <insertion>user_msg</insertion>
      <keywords>aurelius, hoàng đế, emperor</keywords>
      <prompt>
[Nhắc nhở Lore: Hoàng Đế Aurelius]
Lưu ý thái độ của Aurelius: Quyết đoán, nghiêm khắc với chi tiêu quân sự nhưng coi trọng báo cáo từ YuriHQ. Nói chuyện ngắn gọn, uy nghiêm.
      </prompt>
    </"Emperor_Aurelius">
  </"Character_Database">
</lorebook>
```

---

### Ví Dụ 3: Đa Bộ Lorebook & Đa Mục Lore Trong Cùng Một Thẻ
Bạn có thể ghép nhiều bộ lorebook và nhiều mục lore trong cùng một thẻ `<lorebook>`:

```html
<lorebook>
  <!-- Bộ Lore 1: Thế giới & Lịch sử -->
  <"World_History">
    <"Year_HE_3000">
      <depth_scan>1</depth_scan>
      <insertion>context</insertion>
      <keywords>h.e. 3000, năm 3000, lịch sử solaria</keywords>
      <prompt>
[Bối cảnh: Năm H.E. 3000 là thời kỳ hòa bình mỏng manh giữa Holy Empire và các quốc gia láng giềng.]
      </prompt>
    </"Year_HE_3000">
  </"World_History">

  <!-- Bộ Lore 2: Các Tổ Chức -->
  <"Organizations">
    <"YuriHQ">
      <depth_scan>1</depth_scan>
      <insertion>user_msg</insertion>
      <keywords>yurihq, yuri, phi đội yuri</keywords>
      <prompt>
[Thông tin YuriHQ: Đơn vị hàng không dân dụng độc lập, từ chối quân sự hóa máy bay.]
      </prompt>
    </"YuriHQ">
  </"Organizations">
</lorebook>
```

---

## 4. Cơ Chế Hoạt Động Trên Server

1. **Quét & Làm sạch Thẻ (Tag Stripping)**: Trước khi gửi request sang NVIDIA NIM / LLM Provider, server sẽ quét tất cả các thông điệp và xoá sạch hoàn toàn các thẻ `<lorebook>...</lorebook>`. LLM provider sẽ không nhìn thấy thẻ HTML thô.
2. **Dò từ khoá (Keyword Scanning)**: Server lấy `depth_scan` cặp tin nhắn gần nhất (gồm tin nhắn `user` và `assistant`) để dò tìm bất kỳ từ khoá nào có trong `<keywords>`.
3. **Chèn Prompt (Prompt Insertion)**:
   - Nếu `insertion` là `context`: Prompt được nối thêm vào thông điệp System Prompt (hoặc tạo một System Prompt mới ở đầu danh sách messages).
   - Nếu `insertion` là `user_msg`: Prompt được nối vào cuối tin nhắn request của người dùng (User Message).
