# Bằng chứng — nguồn hoá SRS/SRD sang markdown (lane BA, 2026-08-19)

Việc: chuyển `docs/SRS_StockFlow_WMS_v1.0.docx` và `docs/SRD_StockFlow_WMS_v1.0.docx`
sang markdown tại `docs/specs/sources/` để BA/DEV/QA đọc được bằng máy.
Công cụ: [`scripts/docx_to_md.py`](../../scripts/docx_to_md.py) (commit cùng lúc).

**File đầu ra KHÔNG có trong repo** — `.gitignore: docs/specs/sources/`, theo
quyết định Q3(c) giữ repo public. File này chỉ chứa SỐ ĐO, không chép nội dung
yêu cầu. Ai cần bản nguồn thì tự sinh lại bằng lệnh dưới.

## 1. Lệnh chạy và kết quả thật

```
$ python3 scripts/docx_to_md.py docs/SRS_StockFlow_WMS_v1.0.docx docs/specs/sources/SRS.md
SRS_StockFlow_WMS_v1.0.docx -> docs/specs/sources/SRS.md  (1202 dòng, 733 dòng bảng, 129 hàng mã yêu cầu)

$ python3 scripts/docx_to_md.py docs/SRD_StockFlow_WMS_v1.0.docx docs/specs/sources/SRD.md
SRD_StockFlow_WMS_v1.0.docx -> docs/specs/sources/SRD.md  (598 dòng, 364 dòng bảng, 120 hàng mã yêu cầu)
```

## 2. Không mất chữ — kiểm bằng đường độc lập

Phép kiểm cắt tài liệu theo `</w:p>` bằng regex (KHÁC đường đi cây ElementTree mà
script dùng — nếu script sai cây thì phép kiểm này bắt được), giải mã thực thể
XML, rồi hỏi từng đoạn có nằm trọn trong markdown không:

```
docs/SRS_StockFlow_WMS_v1.0.docx: 2301 đoạn/ô có chữ · THIẾU: 0
docs/SRD_StockFlow_WMS_v1.0.docx: 1223 đoạn/ô có chữ · THIẾU: 0
KẾT LUẬN: không mất một đoạn chữ nào
```

**Một cảnh báo giả đã bị bác bỏ, ghi lại để người sau không mất công lần lại.**
Vòng kiểm đầu tiên báo "thiếu 41 mã" (`MFR-01`, `IMEIRFRRRRRRRSC-16`, …). Đó là
lỗi của PHÉP KIỂM, không phải của script: bản kiểm nối mọi `w:t` không dấu ngăn
nên chữ cuối ô này dính vào mã ô kia. Chứng minh: không đoạn nào của .docx chứa
chuỗi `MFR-01` (đếm = 0), trong khi `FR-01` có mặt trong markdown. Vòng kiểm thứ
hai (giải mã `&amp;`/`&quot;` + so theo đoạn) cho THIẾU = 0.

## 3. Đầu ra ổn định (tái tạo được — điều kiện sống của Q3(c))

```
$ python3 scripts/docx_to_md.py docs/SRS_...docx <tmp> && shasum -a 256 <tmp>
run1=a4dd3dd94fdb871c94b4793c26ec50127df9e9be3f436281a49113a071da8d58
run2=a4dd3dd94fdb871c94b4793c26ec50127df9e9be3f436281a49113a071da8d58
XÁC ĐỊNH: hai lần chạy ra cùng byte
```

## 4. Kiểm kê yêu cầu (đầu vào để BA shard và để thay ước lượng go-live tạm)

| Nguồn | Hàng mã yêu cầu | Phân bố họ mã |
|---|---|---|
| SRS | 129 | NFR 40 · BR 24 · FR 13 · INT 12 · ADJ 9 · DI 7 · TBD 7 · FEFO 6 · RCV 6 · SRS 5 |
| SRD | 120 | BR 24 · BRULE 18 · ST 15 · CON 10 · AC 10 · REF 8 · PB 8 · BG 8 · ASM 7 · DEP 6 · OPN 6 |

- **186 mã FR riêng biệt** trải đúng **20 màn hình SC-01 → SC-20**.
- **13 điểm mở do chính spec khai báo** (7 TBD + 6 OPN) → đã đăng ký ở
  [docs/pm/decisions.md §1.1](../../docs/pm/decisions.md).

## 5. Giới hạn — nói thẳng, không giấu

- Bản markdown là oracle cho **CHỮ**, không phải cho **HÌNH**: ảnh/biểu đồ/hộp
  văn bản không trích được, chỗ nào có thì đánh dấu `> ⚠ [hình/biểu đồ ở đây]`.
- Ô gộp dọc được lặp lại nội dung ô gốc (nên markdown nhiều ký tự hơn .docx
  khoảng 2%) — đây là lựa chọn có chủ ý để mỗi hàng bảng đứng độc lập.
- Chú thích chân trang không nối vào chỗ tham chiếu.
- **Gate `verbatim` KHÔNG canh bản này** và sẽ không bao giờ canh, chừng nào Q3(c)
  còn hiệu lực: `specs.sources` phải giữ rỗng, nếu khai báo thì CI đỏ vĩnh viễn
  (`verbatim_gate.py:37-38` gọi `sys.exit` khi source thiếu). Nghĩa là tính trung
  thực của shard so với nguồn là **lời hứa của con người**, chỉ được chống lưng
  bởi tính tái tạo được ở mục 3.
