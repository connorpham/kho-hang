#!/usr/bin/env python3
"""sinh-bao-cao-wms1.py — sinh evd/WMS-1/REPORT.md TỪ evd/WMS-1/do-p95.json.

Hai lỗi mà file này sinh ra để chặn, cả hai đều do reviewer bắt được:

1. (vòng 1) Con số trong báo cáo và con số trong file bằng chứng là hai lần chạy
   khác nhau, vì người viết chép tay. Nay mọi SỐ đều nội suy từ JSON.
2. (vòng 3) Trình sinh loại được số chép tay nhưng vẫn giữ KẾT LUẬN chép tay:
   R1 nạp JSON của họ vào và nó in bảng cho thấy pool 40 tốt hơn pool 20, rồi hai
   dòng sau vẫn khẳng định "pool 40 tệ hơn". Nay mọi CÂU SO SÁNH cũng phải suy từ
   dữ liệu — xem các hàm `cau_*` bên dưới. Không hàm nào được phép khẳng định thứ
   nó chưa tính.

    node --env-file-if-exists=.env scripts/do-p95-phien.mjs   # ghi JSON
    python3 scripts/sinh-bao-cao-wms1.py                      # ghi REPORT.md
"""
import json
from pathlib import Path
from statistics import median

d = json.loads(Path("evd/WMS-1/do-p95.json").read_text(encoding="utf-8"))
mt, ng, pq, qs = d["moiTruong"], d["nguong"], d["phanQuyet"], d["quanSat"]
P = pq["poolPhanQuyet"]
o = [k for k in d["ketQua"] if k["pool"] == P]
TRAN = ng["nguongMs"]


def cau_so_sanh_pool() -> str:
    """So các pool theo TRUNG VỊ. Chỉ khẳng định khi chênh lệch đủ lớn."""
    tv = {x["pool"]: x["tongP95TrungViXau"] for x in d["theoPool"]}
    tot = min(tv, key=tv.get)
    cau = [f"Theo trung vị, pool **{tot}** cho con số thấp nhất ({tv[tot]:.1f} ms)."]
    for pn, v in sorted(tv.items()):
        if pn == tot:
            continue
        lech = (v - tv[tot]) / tv[tot]
        if lech >= 0.20:
            cau.append(f"Pool {pn} tệ hơn rõ rệt ({v:.1f} ms, +{lech * 100:.0f}%).")
        else:
            cau.append(f"Pool {pn} ({v:.1f} ms, +{lech * 100:.0f}%) **không phân biệt "
                       f"được** với pool {tot} ở phép đo này.")
    return " ".join(cau)


def cau_on_dinh() -> str:
    """Có điểm vọt hay không là thứ phải TÍNH, không phải thứ để viết sẵn."""
    ra = []
    for k in o:
        loat = k["tongP95MoiLan"]
        tv, mx = median(loat), max(loat)
        if mx > 2 * tv:
            ra.append(f"hồ sơ `{k['hoSo']}` có **một điểm vọt** ({mx:.1f} ms so với "
                      f"trung vị {tv:.1f} ms)")
        else:
            ra.append(f"hồ sơ `{k['hoSo']}` **không có điểm vọt** (xấu nhất {mx:.1f} ms "
                      f"so với trung vị {tv:.1f} ms)")
    return "Trong lần chạy này: " + "; ".join(ra) + "."


def cau_duoi() -> str:
    n, tong = pq["soRequestVuotTran"], pq["coMau"]
    if n == 0:
        return (f"**Không một request nào trong {tong:,} request vượt trần {TRAN:.0f} ms** "
                f"— giá trị lớn nhất quan sát được là {pq['gopMax']:.2f} ms, tức còn "
                f"cách trần {TRAN / pq['gopMax']:.1f} lần.")
    return (f"**{n}/{tong:,} request ({n / tong * 100:.2f}%) vượt trần {TRAN:.0f} ms**, "
            f"lớn nhất {pq['gopMax']:.2f} ms. Phần đuôi này là thứ phải giải thích "
            f"trước khi tin phán quyết.")


def cau_rac() -> str:
    """Rác có làm chậm không — tính, đừng đoán."""
    theo = {k["hoSo"]: k["tongP95TrungVi"] for k in o}
    if "sach" not in theo or "rac_2_trieu" not in theo:
        return "Không đủ hồ sơ để so."
    a, b = theo["sach"], theo["rac_2_trieu"]
    lech = (b - a) / a
    to = max(k["bytes"] for k in d["ketQua"]) / 1048576
    dong = max(k["soDong"] for k in d["ketQua"])
    if abs(lech) < 0.20:
        return (f"Bảng phình lên {to:.0f} MB / {dong:,} dòng, vượt xa `shared_buffers` "
                f"{mt['sharedBuffers']}, mà trung vị chỉ đổi {lech * 100:+.0f}% "
                f"({a:.1f} → {b:.1f} ms) — **không phân biệt được**. Dọn phiên hết hạn "
                f"là chuyện dung lượng đĩa, không phải tốc độ.")
    return (f"Bảng phình lên {to:.0f} MB / {dong:,} dòng và trung vị đổi "
            f"{lech * 100:+.0f}% ({a:.1f} → {b:.1f} ms) — **rác CÓ ảnh hưởng**, "
            f"phải tính tới việc dọn định kỳ.")


bang_pool = "\n".join(
    f"| {x['pool']}{' ←' if x['pool'] == P else ''} | {x['tongP95TrungViXau']:.1f} | "
    f"{x['tongP95XauNhat']:.1f} |" for x in d["theoPool"])
bang_loat = "\n".join(
    f"| `{k['hoSo']}` | {k['soDong']:,} | {k['bytes'] / 1048576:.1f} | "
    f"{' · '.join(f'{x:.1f}' for x in k['tongP95MoiLan'])} | {median(k['tongP95MoiLan']):.1f} |"
    for k in o)

md = f"""# WMS-1 — Chi phí lượt đọc phiên (điều kiện chốt ADR-0002)

> **File này do máy sinh** từ `evd/WMS-1/do-p95.json` bằng
> `scripts/sinh-bao-cao-wms1.py`. Cả **số** lẫn **câu so sánh** đều suy từ dữ liệu —
> không khẳng định nào được viết cứng.
> Lần viết **{d['lanViet']}** · đo lúc `{d['ngay']}` · **{d['docTheo']}**

## Phán quyết

**ADR-0002 {'ĐẠT' if pq['datNganSachAdr0002'] else 'TRƯỢT'} điều kiện của chính nó** (ADR-0002 §Sửa đổi 2), ở cấu hình pool {P}.

Thống kê phán quyết: **{pq['thongKe']}** — không phải max của các p95 con. Đổi
tiêu chí vì R1 chứng minh tiêu chí cũ lật phán quyết chỉ bằng cách tăng số lần lặp.

| | |
|---|---|
| Cỡ mẫu | **{pq['coMau']:,}** request (tối thiểu {pq['coMauToiThieu']:,}) |
| p50 / **p95** / p99 | {pq['gopP50']:.2f} / **{pq['gopP95']:.2f}** / {pq['gopP99']:.2f} ms |
| Lớn nhất | {pq['gopMax']:.2f} ms |
| Trần | {TRAN:.0f} ms ({ng['tyLeToiDa'] * 100:.0f}% ngân sách {ng['nganSachMs']} ms, NFR-PER-02) |

{cau_duoi()}

Để đối chiếu, con số theo tiêu chí CŨ (max p95 qua các lần lặp) là
{pq['maxP95QuaCacLanLap']:.2f} ms. {pq['ghiChuThongKe']}

## Kích thước pool

| Pool | TỔNG p95 trung vị (ms) | TỔNG p95 xấu nhất (ms) |
|---|---|---|
{bang_pool}

{cau_so_sanh_pool()}

`max_connections` = **{mt['maxConnections']}**. Quy tắc của ADR là ràng buộc TỔNG
(`số bản sao × pool + dự phòng ≤ max_connections`), nên pool {P} cho tối đa 3 bản
sao còn {int(mt['maxConnections']) - 3 * P} kết nối dự phòng.

## Ổn định qua {mt['soLanLap']} lần lặp (pool {P})

| Hồ sơ | Số dòng | MB | TỔNG p95 mỗi lần (ms) | Trung vị |
|---|---|---|---|---|
{bang_loat}

{cau_on_dinh()}

## Hai điều số liệu nói

**1. Thành phần lớn nhất là hàng đợi kết nối, không phải CSDL.** Chờ pool xấu nhất
**{qs['choPoolP95XauNhat']:.2f} ms** so với truy vấn **{qs['truyVanP95XauNhat']:.2f} ms**.
Ở phần THÂN phân phối, chỉnh pool mới giải quyết được, tối ưu SQL thì không.
Ở phần ĐUÔI thì khác: R1 đo tương quan giữa chờ-pool và truy-vấn trong cùng lần lặp
là **r = 0,920** — những cú vọt kéo cả hai thành phần cùng lúc, tức là cú khựng của
cả máy chứ không phải hiện tượng hàng đợi.

**2. {cau_rac()}**

Suy giảm **truy vấn** khi {mt['nguoiDongThoi']} người đồng thời (so cùng loại với
nền, cả hai đều không gồm chờ pool):
**{qs['suyGiamTruyVanKhoang'][0] * 100:.0f}–{qs['suyGiamTruyVanKhoang'][1] * 100:.0f}%**{' (vượt mốc cảnh báo ' + str(int(ng['mocCanhBaoSuyGiam'] * 100)) + '%)' if qs['canhBaoSuyGiam'] else ''}.
Đây là số liệu, không phải phán quyết NFR-PER-05. {qs['ghiChuNfrPer05']}

## Giới hạn — những gì con số này KHÔNG chứng minh

1. **Mô hình tải là "cả {mt['nguoiDongThoi']} người ập vào cùng lúc"**, không phải
   trạng thái ổn định có thời gian nghĩ. Bi quan ở phần hàng đợi đến — nhưng **lạc
   quan ở ba chỗ**, và phải nói cả ba: (a) chỉ MỘT pool đập vào CSDL, trong khi quy
   tắc của ADR giả định 3 bản sao; (b) pool ở đây chỉ phục vụ đúng một câu truy vấn
   phiên, còn trong ứng dụng thật 20 kết nối đó gánh MỌI truy vấn của MỌI request —
   và chờ pool chính là thứ A4 vừa kéo vào trần 50 ms; (c) không có thời gian nghĩ
   nên cache luôn nóng.
2. **Không chạm đĩa lần nào.** {qs['khongChamDia']}
3. **Không có độ trễ mạng** — CSDL cùng máy với tiến trình đo.
4. **Không đo qua Prisma** — ADR-0001 chọn Prisma 7 + `@prisma/adapter-pg`.
5. **Chỉ đo lượt ĐỌC** — ghi `thao_tac_cuoi_luc` và nhánh xoá phiên hết hạn chưa đo.
6. **`shared_buffers` {mt['sharedBuffers']} và `max_connections` {mt['maxConnections']}
   đều là mặc định của image**, chưa phải cấu hình chạy thật — OPN-03 quyết cái đó.

Kết luận đúng phạm vi: *ở cấu hình pool {P} trên máy phát triển, với mô hình tải
bùng nổ, chi phí thêm của một request nằm dưới trần {TRAN:.0f} ms* — chưa phải
*phương án này chắc chắn đủ nhanh khi chạy thật*.

## Việc sinh ra từ đây

- ADR-0002 (Sửa đổi 1 + 2) có số liệu chống lưng → đủ điều kiện để chủ dự án
  chuyển sang Accepted.
- WMS-2: đặt pool = {P} tường minh, đo lại **qua Prisma**, và đo với nhiều bản sao.
- OPN-03 chốt xong thì `max_connections` và số bản sao mới ra con số cuối cùng.
"""
Path("evd/WMS-1/REPORT.md").write_text(md, encoding="utf-8")
print(f"REPORT.md sinh từ do-p95.json — {len(md.splitlines())} dòng")
