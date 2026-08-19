#!/usr/bin/env python3
"""shard_spec.py — cắt bản nguồn SRS/SRD thành shard theo màn hình/chủ đề.

VÌ SAO SCRIPT NÀY LÀM VIỆC MÀ CON NGƯỜI LẼ RA LÀM TAY
Quyết định Q3+Q4 (docs/pm/decisions.md) giữ repo public nên cả `docs/specs/`
bị gitignore, và `specs.sources` phải để rỗng — tức **gate `verbatim` không
canh gì cả**. Khi cái gate đó chết, thứ duy nhất còn giữ cho shard trung thực
với nguồn là: shard do MÁY cắt, tất định, và kiểm lại được. Cắt tay thì trôi
một dòng là sai âm thầm — đúng lỗi mà verbatim_gate.py sinh ra để bắt.

    python3 scripts/shard_spec.py            # sinh/ cập nhật shard + INDEX.md
    python3 scripts/shard_spec.py --check    # 0 = mọi shard khớp nguồn, 1 = trôi

HỢP ĐỒNG VỚI BA
  - Phần TRÊN `## BA NOTES` là máy sinh, nguyên văn từ nguồn — ĐỪNG SỬA TAY.
  - Phần DƯỚI `## BA NOTES` là của BA (diễn giải, câu hỏi, ánh xạ ticket).
    Chạy lại script KHÔNG xoá phần này — nó được đọc lên và ghi lại nguyên vẹn.
  - Sửa yêu cầu thì sửa .docx gốc → chạy lại docx_to_md.py → chạy lại script này.
"""
from __future__ import annotations

import hashlib
import re
import sys
import unicodedata
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "docs/specs/sources"
OUT = ROOT / "docs/specs"
NOTES = "## BA NOTES"
# Neo đầu dòng: chuỗi "## BA NOTES" từng xuất hiện trong header và bị bắt nhầm,
# khiến shard bị nhân đôi. Heading thật luôn đứng đầu dòng.
NOTES_RE = re.compile(r"^## BA NOTES\s*$", re.M)

# (file nguồn, regex tiêu đề, tên shard hoặc None = lấy từ tiêu đề, mô tả cho INDEX)
PLAN: list[tuple[str, str, str | None, str]] = [
    ("SRS.md", r"^# 1\. ",            "tong-quan",            "SRS §1–3: mục đích, phạm vi, bản đồ 20 màn hình, quy ước giao diện"),
    ("SRS.md", r"^# 2\. ",            "tong-quan",            ""),
    ("SRS.md", r"^# 3\. ",            "tong-quan",            ""),
    ("SRS.md", r"^## 4\.\d+\. SC-",   None,                   "SRS §4: yêu cầu chức năng chi tiết của một màn hình"),
    ("SRS.md", r"^# 5\. ",            "mo-hinh-du-lieu",      "SRS §5: danh sách thực thể, chi tiết thực thể lõi, toàn vẹn dữ liệu"),
    ("SRS.md", r"^# 6\. ",            "tich-hop-ngoai",       "SRS §6: giao diện phần cứng, ERP, sàn TMĐT"),
    ("SRS.md", r"^# 7\. ",            "phi-chuc-nang",        "SRS §7: hiệu năng, tin cậy, bảo mật, bảo trì, tuân thủ (NFR)"),
    ("SRS.md", r"^# 8\. ",            "phan-quyen",           "SRS §8: ma trận phân quyền theo vai trò"),
    ("SRS.md", r"^# 9\. ",            "truy-vet-yeu-cau",     "SRS §9: ma trận truy vết yêu cầu"),
    ("SRS.md", r"^# Phụ lục A\. ",    "vong-doi-chung-tu",    "SRS phụ lục A: vòng đời trạng thái chứng từ"),
    ("SRS.md", r"^# Phụ lục B\. ",    "danh-muc-ly-do",       "SRS phụ lục B: danh mục lý do nghiệp vụ"),
    ("SRS.md", r"^# Phụ lục C\. ",    "van-de-can-lam-ro",    "SRS phụ lục C: TBD-01…07 — điểm cần chủ đầu tư làm rõ"),
    ("SRD.md", r"^# 1\. ",            "srd-thuat-ngu",        "SRD §1: mục đích, thuật ngữ và từ viết tắt"),
    ("SRD.md", r"^# 2\. ",            "srd-boi-canh",         "SRD §2: tổ chức, hiện trạng AS-IS, mục tiêu kinh doanh"),
    ("SRD.md", r"^# 3\. ",            "srd-cac-ben-lien-quan","SRD §3: các bên liên quan và RACI theo giai đoạn"),
    ("SRD.md", r"^# 4\. ",            "srd-pham-vi",          "SRD §4: ranh giới hệ thống, phân hệ và màn hình"),
    ("SRD.md", r"^# 5\. ",            "srd-quy-trinh-to-be",  "SRD §5: quy trình nghiệp vụ TO-BE (BP-01…06)"),
    ("SRD.md", r"^# 6\. ",            "srd-yeu-cau-nghiep-vu","SRD §6: yêu cầu nghiệp vụ theo nhóm"),
    ("SRD.md", r"^# 7\. ",            "srd-quy-tac-nghiep-vu","SRD §7: BRULE — quy tắc nghiệp vụ (lô/HSD, serial, tồn kho, phân bổ)"),
    ("SRD.md", r"^# 8\. ",            "srd-rang-buoc",        "SRD §8: ràng buộc, giả định, phụ thuộc"),
    ("SRD.md", r"^# 9\. ",            "srd-rui-ro",           "SRD §9: phân tích rủi ro"),
    ("SRD.md", r"^# 10\. ",           "srd-tieu-chi-chap-nhan","SRD §10: tiêu chí chấp nhận, lộ trình, OPN-01…06"),
]


def slugify(s: str) -> str:
    s = s.replace("đ", "d").replace("Đ", "D")
    s = "".join(c for c in unicodedata.normalize("NFD", s)
                if unicodedata.category(c) != "Mn")
    s = re.sub(r"[^A-Za-z0-9]+", "-", s).strip("-").lower()
    return re.sub(r"-{2,}", "-", s)


def sections(text: str, pattern: str) -> list[tuple[str, int, int]]:
    """Mọi khối bắt đầu bằng heading khớp pattern, tới heading cùng cấp hoặc cao hơn."""
    lines = text.split("\n")
    pat = re.compile(pattern)
    level = pattern.count("#", 0, pattern.index(" ")) if " " in pattern else 1
    stop = re.compile(r"^#{1," + str(max(level, 1)) + r"} ")
    out, i = [], 0
    while i < len(lines):
        if pat.match(lines[i]):
            j = i + 1
            while j < len(lines) and not stop.match(lines[j]):
                j += 1
            out.append((lines[i], i, j))       # [i, j) — nửa mở
            i = j
        else:
            i += 1
    return out


def shard_name(heading: str, fixed: str | None) -> str:
    if fixed:
        return fixed
    m = re.match(r"^## \d+\.\d+\. (SC-\d+)\s*[—-]\s*(.+)$", heading)
    if m:
        return f"{m.group(1).lower()}-{slugify(m.group(2))}"
    return slugify(re.sub(r"^#+\s*", "", heading))


def collect() -> dict[str, dict]:
    """Gom kế hoạch thành {tên shard: {body, srcs, scope}} — nhiều mục có thể gộp."""
    shards: dict[str, dict] = {}
    for fname, pattern, fixed, scope in PLAN:
        path = SRC / fname
        if not path.exists():
            sys.exit(f"shard_spec: thiếu bản nguồn {path.relative_to(ROOT)} — "
                     f"chạy scripts/docx_to_md.py trước (xem README §Tầng spec cục bộ)")
        text = path.read_text(encoding="utf-8")
        lines = text.split("\n")
        for heading, i, j in sections(text, pattern):
            name = shard_name(heading, fixed)
            body = "\n".join(lines[i:j]).rstrip("\n")
            s = shards.setdefault(name, {"body": [], "srcs": [], "scope": ""})
            s["body"].append(body)
            s["srcs"].append(f"{fname} dòng {i + 1}–{j}")
            if scope and not s["scope"]:
                s["scope"] = scope
            if not s["scope"]:
                s["scope"] = re.sub(r"^#+\s*", "", heading)
    return shards


def header(name: str, srcs: list[str]) -> str:
    digests = {f: hashlib.sha256((SRC / f).read_bytes()).hexdigest()[:16]
               for f in {s.split(" dòng ")[0] for s in srcs}}
    src_lines = "\n".join(f"       - {s}" for s in srcs)
    dig_lines = "\n".join(f"       - {f}: sha256:{d}…" for f, d in sorted(digests.items()))
    return (f"<!-- SHARD SINH TỰ ĐỘNG bởi scripts/shard_spec.py — ĐỪNG SỬA TAY phần thân.\n"
            f"     Chỉ mục BA NOTES ở cuối file là của BA; sinh lại KHÔNG xoá nó.\n"
            f"     Trích nguyên văn từ:\n{src_lines}\n"
            f"     Bản nguồn lúc sinh:\n{dig_lines}\n"
            f"     Kiểm khớp: python3 scripts/shard_spec.py --check\n"
            f"     File này bị .gitignore (Q3+Q4): mật, chỉ ở máy bạn. -->\n")


def existing_notes(path: Path) -> str:
    if not path.exists():
        return f"\n{NOTES}\n\n_(chưa có ghi chú BA)_\n"
    t = path.read_text(encoding="utf-8")
    m = NOTES_RE.search(t)
    return ("\n" + t[m.start():]) if m else f"\n{NOTES}\n\n_(chưa có ghi chú BA)_\n"


def render(name: str, s: dict) -> str:
    return header(name, s["srcs"]) + "\n" + "\n\n".join(s["body"]) + "\n" + existing_notes(OUT / f"{name}.md")


def verbatim_block(text: str) -> str:
    """Phần thân giữa header và BA NOTES — thứ phải khớp nguồn từng byte."""
    body = text.split("-->", 1)[1] if "-->" in text else text
    m = NOTES_RE.search(body)
    return (body[:m.start()] if m else body).strip("\n")


def cmd_check() -> int:
    shards = collect()
    bad, missing = [], []
    for name, s in shards.items():
        p = OUT / f"{name}.md"
        if not p.exists():
            missing.append(name)
            continue
        want = "\n\n".join(s["body"]).strip("\n")
        got = verbatim_block(p.read_text(encoding="utf-8"))
        if want != got:
            n = next((i for i, (a, b) in enumerate(zip(want.split("\n"), got.split("\n")), 1) if a != b), 0)
            bad.append(f"{p.relative_to(ROOT)}: lệch nguồn từ dòng thân {n or '?'}")
    for m in missing:
        print(f"❌ thiếu shard: {m}.md")
    for b in bad:
        print(f"❌ {b}")
    if bad or missing:
        print(f"\nshard_spec --check: ĐỎ — {len(bad)} shard trôi, {len(missing)} shard thiếu. "
              f"Chạy `python3 scripts/shard_spec.py` để sinh lại.")
        return 1
    print(f"✅ shard_spec --check: {len(shards)} shard khớp nguồn từng byte")
    return 0


def cmd_build() -> int:
    shards = collect()
    OUT.mkdir(parents=True, exist_ok=True)
    rows = []
    for name in sorted(shards):
        s = shards[name]
        (OUT / f"{name}.md").write_text(render(name, s), encoding="utf-8")
        m = re.match(r"^(sc-\d+)-", name)
        feature = m.group(1).upper() if m else name.replace("-", " ")
        rows.append(f"| {feature} | [{name}.md]({name}.md) | {s['scope']} |")
    index = (
        "# Spec shards — index\n\n"
        "Shard là trích VERBATIM của bản nguồn, do `scripts/shard_spec.py` cắt.\n"
        "Diễn giải chỉ được nằm trong mục `## BA NOTES` của từng shard. Delta yêu\n"
        "cầu đã quyết nằm ở `changes.md`, không bao giờ sửa thẳng vào shard.\n\n"
        "> ⚠ Cả thư mục này bị .gitignore (quyết định Q3+Q4) — nó KHÔNG có trong\n"
        "> bản clone và KHÔNG có trong `git worktree`. Dựng lại: README §Tầng spec\n"
        "> cục bộ. Gate `verbatim` không canh tầng này; thứ thay thế nó là\n"
        "> `python3 scripts/shard_spec.py --check`.\n\n"
        "| Feature | File | Scope |\n|---|---|---|\n" + "\n".join(rows) + "\n"
    )
    (OUT / "INDEX.md").write_text(index, encoding="utf-8")
    print(f"✅ {len(shards)} shard + INDEX.md -> {OUT.relative_to(ROOT)}/")
    return 0


if __name__ == "__main__":
    raise SystemExit(cmd_check() if "--check" in sys.argv else cmd_build())
