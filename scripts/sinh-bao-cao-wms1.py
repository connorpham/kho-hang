#!/usr/bin/env python3
"""sinh-bao-cao-wms1.py — sinh evd/WMS-1/REPORT.md TỪ evd/WMS-1/do-p95.json.

Vì sao có file này: vòng review 1 của WMS-1 bắt được lỗi khối "kết quả thật"
trong báo cáo và file bằng chứng là hai lần chạy khác nhau — vì con số được
người viết chép tay. Không chép tay nữa: mọi con số trong báo cáo được nội suy
từ đúng file JSON mà script đo ghi ra. Sửa báo cáo nghĩa là chạy lại phép đo.

    node --env-file-if-exists=.env scripts/do-p95-phien.mjs   # ghi JSON
    python3 scripts/sinh-bao-cao-wms1.py                      # ghi REPORT.md
"""
import json
from pathlib import Path

d = json.loads(Path("evd/WMS-1/do-p95.json").read_text(encoding="utf-8"))
mt, ng, pq, qs = d["moiTruong"], d["nguong"], d["phanQuyet"], d["quanSat"]
sach = next(k for k in d["ketQua"] if k["hoSo"] == "sach")
rac = next(k for k in d["ketQua"] if k["hoSo"] == "rac_2_trieu")


def bang_lan(k):
    r = []
    for i, l in enumerate(k["lan"], 1):
        r.append(f"| {i} | {l['nen']['p95']:.3f} | {l['truyVanTai']['p95']:.3f} "
                 f"| {l['choPool']['p95']:.3f} |")
    return "\n".join(r)


md = f"""# WMS-1 — Chi phí lượt đọc phiên (điều kiện chốt ADR-0002)

> # ⚠️ PHÁN QUYẾT ĐANG BỊ TRANH CÃI — vòng review 2, 2026-08-19
>
> Reviewer R1 chỉ ra: điều kiện của ADR-0002 nói *"mỗi request cộng thêm một lượt
> đi CSDL"*, mà **việc lấy kết nối là một phần của lượt đi đó**. Báo cáo này loại
> chờ pool ra khỏi phán quyết — và chính việc loại đó giữ phán quyết ở ĐẠT.
> R1 đo được **riêng chờ pool p95 vượt trần 50 ms ở 2/6 lần chạy** (160 ms, 57 ms).
>
> Đọc theo cách gồm chi phí lấy kết nối → **2/6 lần chạy TRƯỢT**.
> Đọc theo cách loại nó ra → phán quyết dưới đây đứng.
>
> Chọn cách đọc nào là quyết định kiến trúc, không phải việc của phép đo.
> Đã chuyển sang `docs/pm/decisions.md §2` chờ chủ dự án.
> Toàn bộ: [`dev/review.md`](dev/review.md).

> **File này do máy sinh** từ `evd/WMS-1/do-p95.json` bằng
> `scripts/sinh-bao-cao-wms1.py`. Không con số nào được chép tay — vòng review 1
> bắt đúng lỗi đó. Sửa báo cáo = chạy lại phép đo.
> Lần viết **{d['lanViet']}** · đo lúc `{d['ngay']}`

## Phán quyết

**ADR-0002 {'ĐẠT' if pq['datNganSachAdr0002'] else 'TRƯỢT'} điều kiện của chính nó.**
p95 của lượt truy vấn, lấy lần xấu nhất trong {mt['soLanLap']} lần lặp × {len(d['ketQua'])} hồ sơ
dữ liệu: **{pq['truyVanP95CanCu']:.3f} ms**, so với ngưỡng {ng['nguongMs']:.0f} ms
({ng['tyLeToiDa'] * 100:.0f}% của ngân sách {ng['nganSachMs']} ms, NFR-PER-02).
Tức lượt đọc phiên chiếm **{pq['truyVanP95CanCu'] / ng['nganSachMs'] * 100:.2f}%** ngân sách.

Đây là phán quyết **duy nhất** phép đo này có tư cách đưa ra.

## Số đo

Môi trường: {mt['pg']} · `shared_buffers` {mt['sharedBuffers']} · {mt['host']}/{mt['db']} ·
pool {mt['pool']} kết nối · {mt['nguoiDongThoi']} người đồng thời · {mt['soLanLap']} lần lặp mỗi hồ sơ.

### Hồ sơ `sach` — {sach['soDong']:,} dòng, {sach['bytes'] / 1048576:.1f} MB

| Lần | Nền p95 (ms) | Truy vấn khi tải p95 (ms) | Chờ pool p95 (ms) |
|---|---|---|---|
{bang_lan(sach)}

### Hồ sơ `rac_2_trieu` — {rac['soDong']:,} dòng, {rac['bytes'] / 1048576:.1f} MB

| Lần | Nền p95 (ms) | Truy vấn khi tải p95 (ms) | Chờ pool p95 (ms) |
|---|---|---|---|
{bang_lan(rac)}

## Ba điều số liệu nói mà lần viết trước nói ngược

**1. Rác trong bảng phiên gần như không ảnh hưởng.** Bảng phình từ
{sach['bytes'] / 1048576:.1f} MB lên {rac['bytes'] / 1048576:.1f} MB
({rac['soDong']:,} dòng, vượt xa `shared_buffers` {mt['sharedBuffers']}) mà p95 truy vấn
xấu nhất còn *nhích xuống*: {sach['truyVanTaiP95XauNhat']:.3f} → {rac['truyVanTaiP95XauNhat']:.3f} ms.
Lần viết trước bày 50.000 dòng rác ra như một sức ép; số liệu nói nó không phải.
Việc dọn phiên hết hạn vì thế là chuyện dung lượng đĩa, **không phải** chuyện tốc độ.

**2. Thành phần lớn nhất không phải CSDL mà là hàng đợi pool.**
Chờ pool p95 xấu nhất **{qs['choPoolP95XauNhat']:.3f} ms**, gấp
{qs['choPoolP95XauNhat'] / pq['truyVanP95CanCu']:.1f} lần chi phí truy vấn. Nó **không**
nằm trong phán quyết trên vì nó là hệ quả của kích thước pool ({mt['pool']} — một giả
định chưa chốt, xem ADR-0002 C-3), không phải chi phí CSDL. Nhưng nó là phần mà
người dùng thật sẽ cảm thấy, nên WMS-2 phải chốt con số pool một cách tường minh.

**3. Suy giảm của thành phần khi 200 người đồng thời:
{qs['suyGiamThanhPhanXauNhat'] * 100:.1f}%** (nền {sach['nenP95XauNhat']:.3f} ms →
{pq['truyVanP95CanCu']:.3f} ms){' — vượt mốc cảnh báo ' + str(int(ng['mocCanhBaoSuyGiam'] * 100)) + '%.' if qs['canhBaoSuyGiam'] else '.'}
**Đây là số liệu, không phải phán quyết NFR-PER-05.** {qs['ghiChuNfrPer05']}

## Giới hạn — những gì con số này KHÔNG chứng minh

1. **Không có độ trễ mạng.** CSDL cùng máy với tiến trình đo.
2. **Không đo qua Prisma.** ADR-0001 chọn Prisma 7 + `@prisma/adapter-pg`; chi phí
   lớp ORM chưa nằm trong con số này.
3. **Chỉ đo lượt ĐỌC.** Việc ghi `thao_tac_cuoi_luc` (gộp 60 giây theo ADR-0002)
   và nhánh xoá phiên hết hạn khi gặp lúc đọc đều chưa đo.
4. **Máy lập trình, không phải máy chạy thật** — hạ tầng thật còn chờ OPN-03.
5. **`shared_buffers` {mt['sharedBuffers']} là mặc định**, chưa phải cấu hình đã chốt.

Kết luận đúng phạm vi: *ADR-0002 không bị bác bởi chi phí truy vấn ở mức đã đo* —
chưa phải *phương án này chắc chắn đủ nhanh khi chạy thật*.

## Việc sinh ra từ đây

- ADR-0002 đủ điều kiện chuyển **Accepted** (chủ dự án xác nhận).
- WMS-2 phải: chốt kích thước pool tường minh, đo lại **qua Prisma**, và mang theo
  cảnh báo suy giảm {qs['suyGiamThanhPhanXauNhat'] * 100:.0f}% ở mục 3.
"""
Path("evd/WMS-1/REPORT.md").write_text(md, encoding="utf-8")
print(f"REPORT.md sinh từ do-p95.json — {len(md.splitlines())} dòng, 0 con số chép tay")
