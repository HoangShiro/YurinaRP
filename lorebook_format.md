# Bảng Quy chuẩn Key & Value (Lorebook & World State Standard Specification)

Tài liệu này quy định chuẩn hóa cấu trúc dữ liệu, tên Key trong Upstash Redis, kiểu dữ liệu, cú pháp công thức (Formulas) và định dạng lệnh thay đổi (Mutations) cho **Hệ thống Quản lý Trạng thái Thế giới (World State Engine)** của Yuri Systems trên NIM Proxy.

---

## 1. Kiến trúc Redis Namespaces (Upstash Key Map)

| Redis Key | Tên Mô-đun | Mô tả Chức năng | Kiểu Dữ liệu |
|---|---|---|---|
| `world:meta` | Meta & Timeline | Lưu ngày hiện tại, mốc thời gian, bảng quy đổi tiền tệ | JSON Object |
| `world:organizations` | Organizations | Phân cấp tập đoàn Yuri HQ, các Hiệp ước quốc gia | JSON Object |
| `world:systems` | Infrastructure | Quy mô mạng lưới hạ tầng (Station, Train, Aerial, Bank...) | JSON Object |
| `world:facilities` | Facilities & Sites | Tòa nhà, phân khu nhà máy, chi nhánh, phòng ban | JSON Object |
| `world:specifications` | Tech Specs | Thông số vật lý siêu hợp kim Yurium, quặng Levium, Holo Orbs | JSON Object |
| `world:personnel` | Personnel Roster | Ban điều hành, đội ngũ kỹ sư, nhân viên ca A/B, ERS | JSON Object |
| `world:catalog` | Item & Price Catalog | Danh mục vật phẩm với giá Copper, chi phí sản xuất & doanh số/ngày | JSON Object |
| `world:financials` | Financial Ledger | Doanh thu, chi phí, lợi nhuận ròng, công thức & ngân khố | JSON Object |
| `world:full_state` | Master Composite | Bản sao lưu tổng hợp 7 mô-đun trên | JSON Object |

---

## 2. Công thức Doanh thu YuriBank & Phí Giao dịch Quốc tế

### 2.1. Phí Giao dịch Quốc tế (International Transfer Fees)
* **Quy tắc**: Giao dịch nội địa miễn phí 0%. Giao dịch quốc tế thu 0.5% tổng khối lượng chuyển tiền.
* **Chia sẻ Lợi nhuận**: 0.25% trả cho quốc gia sở tại, **0.25% là phần thu ròng về Ngân khố YuriBank**.
* **Công thức**:
  $$\text{daily\_int\_fee\_revenue} = \text{daily\_international\_volume\_gold} \times \text{net\_fee\_ratio} \, (0.0025)$$
  *(Ví dụ: Khối lượng giao dịch 39,200,000 Gold/ngày $\rightarrow$ Phí thu ròng về YuriBank = 98,000 Gold/ngày).*

### 2.2. Tổng Doanh thu YuriBank (YuriBank Daily Gross)
Doanh thu gộp hàng ngày của YuriBank được engine tính tự động bằng tổng 3 nguồn:
$$\text{yuri\_bank.daily\_gross\_revenue} = \text{daily\_int\_fee\_revenue} + \text{card\_sales\_gross} + \text{daily\_holo\_orb\_sales}$$

---

## 3. Công thức Chia sẻ Lợi nhuận cho Host Nations (Dynamic Host Share)

Phần ăn chia cho các quốc gia sở tại đối với các hệ thống hạ tầng giao thông (**YuriTrain, YuriStation, YuriShip, YuriAerial**) là một **BIẾN ĐỘNG TỰ ĐỘNG (Dynamic Variable)**:

* **Tỷ lệ ăn chia (`host_share_ratio`)**: 50% (`0.50`) lợi nhuận ròng sau khi trừ chi phí vận hành.
* **Công thức tính tự động**:
  $$\text{host\_share} = (\text{daily\_gross\_revenue} - \text{daily\_operating\_burn}) \times \text{host\_share\_ratio}$$
  $$\text{daily\_net\_surplus} = (\text{daily\_gross\_revenue} - \text{daily\_operating\_burn}) - \text{host\_share}$$

👉 **Cơ chế biến động**: Khi lượt RP làm tăng doanh thu gộp hoặc giảm chi phí vận hành của mạng lưới giao thông (ví dụ YuriTrain đạt $88,000\text{ Gold}$ gross, chi phí $8,000\text{ Gold}$):
- `host_share` tự động nhảy lên: $(88,000 - 8,000) \times 50\% = 40,000\text{ Gold/ngày}$.
- Phần giữ lại của YuriStore tự động nhảy: $40,000\text{ Gold/ngày}$.

---

## 4. Chi tiết Quy chuẩn Key & Trường Dữ liệu (Field Standards)

### 4.1. `world:meta` (Đơn vị Tiền tệ Chuẩn hóa: Copper)
```json
{
  "world_name": "Stagaia",
  "current_day": 242,
  "last_updated_day": 242,
  "hero_era": "Post-Yuri Era (20th Hero: Yurina Shirayuki)",
  "currency_units": {
    "1_copper": 1,
    "1_silver": 100,
    "1_gold": 10000,
    "1_platinum": 1000000
  }
}
```

---

### 4.2. `world:catalog` (Quy chuẩn Vật phẩm & Tính toán Doanh số)

* **Các trường quy định cho mỗi vật phẩm**:
  1. `id` *(String)*: Mã định danh duy nhất (ví dụ: `"stone_lamp_small"`).
  2. `name` *(String)*: Tên hiển thị (ví dụ: `"Stone Lamp Small"`).
  3. `price_copper` *(Number)*: Đơn giá bán tính bằng Copper (ví dụ: 50 Silver = `5000` Copper).
  4. `unit_cost_copper` *(Number)*: Chi phí sản xuất/nguyên liệu trên 1 đơn vị tính bằng Copper (ví dụ: `1000` Copper).
  5. `daily_units_sold` *(Number)*: Số lượng bán ra trong ngày (ví dụ: `2000` cái).

* **Công thức tính toán tự động của Engine**:
  - `gross_revenue_copper = price_copper * daily_units_sold`
  - `total_cost_copper = unit_cost_copper * daily_units_sold`
  - `net_profit_copper = (price_copper - unit_cost_copper) * daily_units_sold`

---

### 4.3. `world:financials` (Công thức & Ngân khố)

```json
{
  "systems": {
    "yuri_store": { "daily_gross_revenue": 8941, "daily_operating_burn": 1300.1, "daily_net_surplus": "daily_gross_revenue - daily_operating_burn" },
    "yuri_cosmetics": { "daily_gross_revenue": 15200, "daily_operating_burn": 1800, "daily_net_surplus": "daily_gross_revenue - daily_operating_burn" },
    "yuri_station": { "daily_gross_revenue": 44292, "daily_operating_burn": 31581, "host_share_ratio": 0.50, "daily_net_surplus": "daily_gross_revenue - daily_operating_burn - host_share" },
    "yuri_train": { "daily_gross_revenue": 88000, "daily_operating_burn": 8000, "host_share_ratio": 0.50, "daily_net_surplus": "daily_gross_revenue - daily_operating_burn - host_share" },
    "wand_leasing": { "daily_gross_revenue": 3112, "daily_operating_burn": 0, "daily_net_surplus": "daily_gross_revenue - daily_operating_burn" },
    "yuri_bank": { "daily_international_volume_gold": 39200000, "net_fee_ratio": 0.0025, "daily_holo_orb_sales_gold": 3000 }
  },
  "consolidated_daily_net_surplus_gold": 300513,
  "reserves": {
    "ley_line_platinum": 308744.5,
    "guild_escrow_platinum": 260.15,
    "store_liquid_platinum": 1225.0,
    "charity_reserve_platinum": 380.0,
    "levium_reserve_kg": 320.0,
    "yurium_reserve_kg": 70.0
  },
  "time_delta_rules": [
    {
      "target": "reserves.ley_line_platinum",
      "formula": "reserves.ley_line_platinum + ((financials.consolidated_daily_net_surplus_gold / 100) * delta_days)"
    }
  ]
}
```

---

## 5. Quy chuẩn Lệnh Thay đổi Trạng thái (LLM Mutation Protocol)

```json
{
  "has_changes": true,
  "reason": "Khối lượng giao dịch quốc tế YuriBank tăng lên 50,000,000 Gold/ngày",
  "mutations": [
    {
      "action": "UPDATE_VAR",
      "path": "financials.systems.yuri_bank.daily_international_volume_gold",
      "op": "SET",
      "value": 50000000
    }
  ]
}
```
