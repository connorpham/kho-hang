#!/usr/bin/env python3
"""Bằng chứng không được CŨ HƠN mã nó mô tả.

VÌ SAO TỆP NÀY TỒN TẠI — KI-006, WMS-3 ngày 21/08/2026.

Tôi sửa mã sản phẩm, rồi viết một báo cáo TRÍCH tệp bằng chứng đã commit từ
vòng trước, như thể nó mô tả mã đang chạy. Nó không: tệp ghi "24 lượt đồng
thời" khi mặc định đã đổi thành trần, "tỉ lệ gạt 69,2%" khi van đã đổi sang xếp
hàng và cho 0,0%, "chỉ cảnh báo" khi mã đã đổi thành "CHẶN". Reviewer bắt bằng
đúng một lệnh:

    git log -1 --format=%H -- <tệp bằng chứng>

rồi so với commit gần nhất của mã. Đó là một câu `if`, nên nó thuộc về một cổng
chứ không thuộc về trí nhớ của tôi — nhất là khi trí nhớ đó vừa sai năm lần
trong một ngày.

LUẬT: với mỗi thư mục `evd/<KEY>/`, không tệp bằng chứng nào được có commit gần
nhất CŨ HƠN commit gần nhất của các đường dẫn mã sản phẩm (`code_paths` trong
`vteam.config.yaml`). Nếu có, hoặc là chạy lại bằng chứng, hoặc là nói rõ trong
báo cáo rằng tệp đó mô tả một bản cũ.

CHƯA NỐI VÀO `gates.yaml`: `.vteam/profiles/` nằm trong `review.high_stakes_paths`,
nên thêm một bước cổng là một thay đổi cần vòng review 3 người của riêng nó.
Chạy tay:  python3 .vteam/scripts/evd_tuoi_check.py [--evd evd/WMS-3]
"""
from __future__ import annotations
import argparse
import subprocess
import sys
from pathlib import Path

GOC = Path(__file__).resolve().parents[2]

# Đuôi tệp KHÔNG phải bằng chứng đo đạc: tài liệu người viết, đọc-hiểu chứ không
# sinh ra từ một lần chạy. Chúng được phép cũ hơn mã.
BO_QUA_DUOI = {'.md'}

# Một ticket ĐÃ ĐÓNG có thể cố ý ĐÓNG BĂNG bằng chứng của nó — WMS-1 là ca thật:
# quyết định A6 giữ `do-p95.json` không sửa một byte để chuỗi kiểm chứng độc lập
# của reviewer còn giá trị. Đặt tệp `.dong-bang` trong `evd/<KEY>/` kèm lý do thì
# thư mục đó được bỏ qua. Phải là một tệp trong repo, không phải một danh sách
# trong script này: lý do đóng băng thuộc về ticket, không thuộc về cổng.
TEP_DONG_BANG = '.dong-bang'


def chay(*lenh: str) -> str:
    return subprocess.run(lenh, cwd=GOC, capture_output=True, text=True,
                          check=False).stdout.strip()


def ngay_commit(duong_dan: str) -> int | None:
    """Dấu thời gian committer của commit gần nhất chạm đường dẫn này."""
    ra = chay('git', 'log', '-1', '--format=%ct', '--', duong_dan)
    return int(ra) if ra else None


def doc_code_paths() -> list[str]:
    """Đọc `code_paths` từ cấu hình. Không có PyYAML thì tự bóc — cấu hình này
    dùng đúng một dòng `code_paths: [a, b]`, nên không cần bộ phân tích đầy đủ."""
    cau_hinh = (GOC / 'vteam.config.yaml').read_text(encoding='utf-8')
    for dong in cau_hinh.splitlines():
        dong = dong.strip()
        if dong.startswith('code_paths:') and '[' in dong:
            trong = dong[dong.index('[') + 1:dong.rindex(']')]
            return [p.strip() for p in trong.split(',') if p.strip()]
    return ['src/']


def main() -> int:
    bp = argparse.ArgumentParser()
    bp.add_argument('--evd', help='chỉ kiểm một thư mục, ví dụ evd/WMS-3')
    tuy_chon = bp.parse_args()

    code_paths = doc_code_paths()
    moc_ma = max((ngay_commit(p) or 0) for p in code_paths)
    if not moc_ma:
        print('⚠️  evd_tuoi_check: không đọc được lịch sử mã — bỏ qua')
        return 0

    thu_muc = [GOC / tuy_chon.evd] if tuy_chon.evd else sorted((GOC / 'evd').glob('*'))
    hong: list[tuple[str, int]] = []
    da_kiem = 0

    bo_qua: list[str] = []
    for tm in thu_muc:
        if not tm.is_dir():
            continue
        if (tm / TEP_DONG_BANG).exists():
            ly_do = (tm / TEP_DONG_BANG).read_text(encoding='utf-8').strip().splitlines()
            bo_qua.append(f'{tm.name}: {ly_do[0] if ly_do else "(không ghi lý do)"}')
            continue
        for tep in sorted(tm.rglob('*')):
            if not tep.is_file() or tep.suffix.lower() in BO_QUA_DUOI:
                continue
            tuong_doi = tep.relative_to(GOC).as_posix()
            moc = ngay_commit(tuong_doi)
            if moc is None:      # chưa commit — không phán xét
                continue
            da_kiem += 1
            if moc < moc_ma:
                hong.append((tuong_doi, moc_ma - moc))

    if hong:
        print(f'❌ evd_tuoi_check: {len(hong)} tệp bằng chứng CŨ HƠN mã chúng mô tả.')
        print('   Mã sản phẩm đã đổi sau khi các tệp này được sinh ra, nên mọi con')
        print('   số trích từ chúng có thể đang mô tả một bản không còn tồn tại.')
        for tep, lech in sorted(hong, key=lambda x: -x[1]):
            print(f'     {tep}  — cũ hơn {lech // 3600} giờ')
        print('   Sửa: chạy lại bộ sinh bằng chứng (npm run evidence), HOẶC ghi rõ')
        print('   trong báo cáo rằng tệp này mô tả một bản cũ và vì sao chấp nhận được.')
        return 1

    for b in bo_qua:
        print(f'⏸️  evd_tuoi_check: bỏ qua {b}')
    print(f'✅ evd_tuoi_check: {da_kiem} tệp bằng chứng đều mới bằng hoặc mới hơn mã')
    return 0


if __name__ == '__main__':
    sys.exit(main())
