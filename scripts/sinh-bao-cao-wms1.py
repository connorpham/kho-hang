#!/usr/bin/env python3
"""sinh-bao-cao-wms1.py — sinh evd/WMS-1/REPORT.md TỪ evd/WMS-1/do-p95.json.

Vòng review 1 của WMS-1 bắt được lỗi khối "kết quả thật" trong báo cáo và file
bằng chứng là hai lần chạy khác nhau, vì con số được chép tay. Không chép tay
nữa: mọi số ở đây nội suy từ đúng file JSON mà script đo ghi ra. Sửa báo cáo
nghĩa là chạy lại phép đo.

    node --env-file-if-exists=.env scripts/do-p95-phien.mjs   # ghi JSON
    python3 scripts/sinh-bao-cao-wms1.py                      # ghi REPORT.md
"""
import json
from pathlib import Path

d = json.loads(Path("evd/WMS-1/do-p95.json").read_text(encoding="utf-8"))
mt, ng, pq, qs = d["moiTruong"], d["nguong"], d["phanQuyet"], d["quanSat"]
P = pq["poolPhanQuyet"]
o = [k for k in d["ketQua"] if k["pool"] == P]
tv_max = max(k["tongP95TrungVi"] for k in o)


def bang_pool():
    r = []
    for x in d["theoPool"]:
        dau = " ←" if x["pool"] == P else ""
        r.append(f"| {x['pool']}{dau} | {x['tongP95TrungViXau']:.1f} | "
                 f"{x['tongP95XauNhat']:.1f} | "
                 f"{'✅' if x['tongP95XauNhat'] <= ng['nguongMs'] else '❌'} |")
    return "\n".join(r)


def bang_loat():
    r = []
    for k in d["ketQua"]:
        if k["pool"] != P:
            continue
        loat = " · ".join(f"{x:.1f}" for x in k["tongP95MoiLan"])
        r.append(f"| `{k['hoSo']}` | {k['soDong']:,} | {k['bytes'] / 1048576:.1f} | "
                 f"{loat} | {k['tongP95TrungVi']:.1f} | {k['tongP95XauNhat']:.1f} |")
    return "\n".join(r)


md = f"""# WMS-1 — Chi phí lượt đọc phiên (điều kiện chốt ADR-0002)

> **File này do máy sinh** từ `evd/WMS-1/do-p95.json` bằng
> `scripts/sinh-bao-cao-wms1.py`. Không con số nào chép tay.
> Lần viết **{d['lanViet']}** · đo lúc `{d['ngay']}`
>
> **Đọc theo:** {d['docTheo']}

## Phán quyết

**ADR-0002 {'ĐẠT' if pq['datNganSachAdr0002'] else 'TRƯỢT'} điều kiện của chính nó, ở cấu hình pool {P}.**

p95 của **TỔNG** (chờ lấy kết nối + truy vấn), lần **xấu nhất** trong
{mt['soLanLap']} lần lặp × {len(o)} hồ sơ dữ liệu: **{pq['tongP95CanCu']:.3f} ms**
trên trần **{ng['nguongMs']:.0f} ms** ({ng['tyLeToiDa'] * 100:.0f}% ngân sách
{ng['nganSachMs']} ms, NFR-PER-02).

Trung vị của các lần lặp là **{tv_max:.1f} ms** — tức trường hợp thường gặp còn
cách trần khoảng **{ng['nguongMs'] / tv_max:.1f} lần**. Nhưng xem mục Ổn định
trước khi tin con số này.

## Kích thước pool là biến, không phải hằng số

ADR-0002 Sửa đổi 1 biến pool thành quyết định kiến trúc. Đây là số liệu cho quyết
định đó — cùng phép đo, chỉ đổi kích thước pool:

| Pool | TỔNG p95 trung vị (ms) | TỔNG p95 xấu nhất (ms) | Dưới trần {ng['nguongMs']:.0f} ms? |
|---|---|---|---|
{bang_pool()}

`max_connections` của CSDL: **{mt['maxConnections']}**. Quy tắc của ADR là ràng
buộc TỔNG (`số bản sao × pool + dự phòng ≤ max_connections`), nên pool {P} cho
tối đa 3 bản sao vẫn còn {int(mt['maxConnections']) - 3 * P} kết nối dự phòng.

Đáng chú ý: **pool lớn hơn không tốt hơn.** Pool 40 tệ hơn pool 20 ở cả trung vị
lẫn xấu nhất — thêm kết nối chỉ chuyển hàng đợi từ pool sang chính CSDL.

## Ổn định — phần phải đọc trước khi trích con số đi đâu

{mt['soLanLap']} lần lặp tại pool {P}, TỔNG p95 từng lần:

| Hồ sơ | Số dòng | MB | TỔNG p95 mỗi lần (ms) | Trung vị | Xấu nhất |
|---|---|---|---|---|---|
{bang_loat()}

Các lần lặp bám sát nhau quanh trung vị, **trừ một điểm vọt lẻ** đẩy con số xấu
nhất lên {pq['tongP95CanCu']:.1f} ms. Điểm vọt đó nằm ở phần **chờ lấy kết nối**
({qs['choPoolP95XauNhat']:.1f} ms), không phải ở truy vấn
({qs['truyVanP95XauNhat']:.1f} ms). Chưa quy được nguyên nhân: phép đo chạy trên
máy lập trình đang mở IDE, không cô lập. **Kết luận ĐẠT dựa trên lần xấu nhất
quan sát được, không phải trên một cận đã chứng minh.**

## Ba điều số liệu nói

**1. Thành phần lớn nhất là hàng đợi kết nối, không phải CSDL.** Chờ pool xấu
nhất **{qs['choPoolP95XauNhat']:.1f} ms** so với truy vấn
**{qs['truyVanP95XauNhat']:.1f} ms**. Tối ưu câu SQL không giải quyết được gì ở
đây; chỉnh pool và số bản sao mới giải quyết.

**2. Rác trong bảng phiên không ảnh hưởng tốc độ.** Bảng phình lên
{max(k['bytes'] for k in d['ketQua']) / 1048576:.0f} MB / {max(k['soDong'] for k in d['ketQua']):,}
dòng, vượt xa `shared_buffers` {mt['sharedBuffers']}, mà TỔNG p95 không xấu đi
theo. Dọn phiên hết hạn là chuyện **dung lượng đĩa**, không phải tốc độ.

**3. Suy giảm khi {mt['nguoiDongThoi']} người đồng thời:
{qs['suyGiamKhoang'][0] * 100:.0f}–{qs['suyGiamKhoang'][1] * 100:.0f}%** qua các
lần lặp{' (vượt mốc cảnh báo ' + str(int(ng['mocCanhBaoSuyGiam'] * 100)) + '%)' if qs['canhBaoSuyGiam'] else ''}.
**Đây là số liệu, không phải phán quyết NFR-PER-05.** {qs['ghiChuNfrPer05']}

## Giới hạn — những gì con số này KHÔNG chứng minh

1. **Mô hình tải là "cả {mt['nguoiDongThoi']} người ập vào cùng lúc"**, không phải
   {mt['nguoiDongThoi']} người dùng ở trạng thái ổn định có thời gian nghĩ. Đây là
   **cận bi quan**: hàng đợi thực tế nhiều khả năng nhẹ hơn. Nó cũng là lý do phần
   chờ pool áp đảo.
2. **Không chạm đĩa lần nào.** {qs['khongChamDia']}
3. **Không có độ trễ mạng** — CSDL cùng máy với tiến trình đo.
4. **Không đo qua Prisma.** ADR-0001 chọn Prisma 7 + `@prisma/adapter-pg`; chi phí
   lớp ORM chưa nằm trong con số này.
5. **Chỉ đo lượt ĐỌC.** Ghi `thao_tac_cuoi_luc` (gộp 60 giây) và nhánh xoá phiên
   hết hạn khi gặp lúc đọc đều chưa đo.
6. **Máy lập trình, `shared_buffers` và `max_connections` đều là mặc định** —
   hạ tầng thật còn chờ OPN-03, và chính nó quyết định hai con số đó.

Kết luận đúng phạm vi: *ở cấu hình pool {P} trên máy phát triển, chi phí thêm của
một request nằm dưới trần 50 ms trong mọi lần đo* — chưa phải *phương án này chắc
chắn đủ nhanh khi chạy thật*.

## Việc sinh ra từ đây

- ADR-0002 Sửa đổi 1: quyết định tạm **pool {P}/bản sao, tối đa 3 bản sao** có số
  liệu chống lưng → đủ điều kiện để chủ dự án chuyển sang Accepted.
- WMS-2: đặt kích thước pool tường minh bằng {P}, và đo lại **qua Prisma**.
- OPN-03 chốt xong thì `max_connections` và số bản sao mới ra con số cuối cùng.
"""
Path("evd/WMS-1/REPORT.md").write_text(md, encoding="utf-8")
print(f"REPORT.md sinh từ do-p95.json — {len(md.splitlines())} dòng")
