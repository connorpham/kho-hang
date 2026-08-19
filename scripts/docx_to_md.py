#!/usr/bin/env python3
"""docx_to_md.py — chuyển SRS/SRD (.docx) sang markdown nguồn cho BA.

VÌ SAO SCRIPT NÀY TỒN TẠI TRONG REPO
Quyết định Q3 (docs/pm/decisions.md, 2026-08-19) giữ repo public, nên bản
markdown nguồn của SRS/SRD nằm trong .gitignore và CHỈ tồn tại trên máy từng
người. Bản nguồn không commit được thì phải TÁI TẠO ĐƯỢC — script này là lời
hứa đó: cùng một .docx cho ra cùng một markdown, byte-for-byte.

    python3 scripts/docx_to_md.py docs/SRS_StockFlow_WMS_v1.0.docx \
        docs/specs/sources/SRS.md

CHUYỂN ĐỔI ĐỊNH DẠNG — KHAI BÁO THẲNG, ĐỪNG NHẦM LÀ ĐỊNH DẠNG GỐC
.docx không có markdown, nên MỌI ký tự markdown ở đầu ra đều là lựa chọn của
script, không phải của tài liệu gốc. Chỉ có 4 lựa chọn, áp dụng đồng nhất:
  1. Heading1/2/3 -> `#` / `##` / `###`.
  2. Bảng -> bảng markdown; hàng đầu là header. `|` trong nội dung -> `\|`.
  3. Ô đầu của một hàng bảng khớp mã yêu cầu (BR-01, FR-INV-02, …) -> bọc `**`.
     Đây là hình dạng `^\| \*\*<MÃ>\*\* \|` mà verbatim_gate.py dò tìm. Chữ của
     yêu cầu KHÔNG đổi một ký tự nào — chỉ có dấu ngăn ô là của markdown.
  4. Đoạn thuộc danh sách -> `- `.
Văn bản trong ô và trong đoạn là nguyên văn: script không sửa chính tả, không
chuẩn hoá khoảng trắng ngoài việc gộp các run của Word lại và bỏ khoảng trắng
thừa hai đầu.

GIỚI HẠN ĐÃ BIẾT (script nói ra, không giấu)
  - Ô gộp dọc (vMerge) được lặp lại nội dung ô trên, không phải để trống.
  - Ảnh, biểu đồ, hộp văn bản (drawing/textbox) KHÔNG được trích — chỗ nào có
    thì đầu ra ghi `> ⚠ [hình/biểu đồ ở đây — xem bản .docx gốc]`.
  - Chú thích chân trang (footnotes) không được nối vào chỗ tham chiếu.
Ba giới hạn này nghĩa là bản markdown là oracle cho CHỮ, không phải cho HÌNH.
"""
from __future__ import annotations

import hashlib
import re
import sys
import zipfile
from pathlib import Path
from xml.etree import ElementTree as ET

W = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}"
# Mã yêu cầu: cùng một hình dạng verbatim_gate.py dùng (BR-01, FR-INV-02, SYS-01…)
CODE = re.compile(r"^([A-Z][A-Z0-9]*(?:-[A-Z]{2,4})?-\d+)$")
HEADING = {"Heading1": "#", "Heading2": "##", "Heading3": "###",
           "Heading4": "####", "Heading5": "#####"}


def run_text(node: ET.Element) -> str:
    """Chữ của một node, gộp mọi w:t con theo đúng thứ tự tài liệu."""
    out = []
    for el in node.iter():
        tag = el.tag
        if tag == W + "t":
            out.append(el.text or "")
        elif tag == W + "tab":
            out.append(" ")
        elif tag in (W + "br", W + "cr"):
            out.append(" ")
        elif tag == W + "drawing":
            out.append("⟦HÌNH⟧")
    return "".join(out)


def para_md(p: ET.Element) -> str | None:
    ppr = p.find(W + "pPr")
    style, is_list = None, False
    if ppr is not None:
        st = ppr.find(W + "pStyle")
        if st is not None:
            style = st.get(W + "val")
        is_list = ppr.find(W + "numPr") is not None
    text = run_text(p).strip()
    if "⟦HÌNH⟧" in text:
        text = text.replace("⟦HÌNH⟧", "").strip()
        marker = "> ⚠ [hình/biểu đồ ở đây — xem bản .docx gốc]"
        return f"{marker}\n\n{text}" if text else marker
    if not text:
        return None
    if style in HEADING:
        return f"{HEADING[style]} {text}"
    if is_list or style == "ListParagraph":
        return f"- {text}"
    return text


def cell_text(tc: ET.Element) -> str:
    parts = [run_text(p).strip() for p in tc.findall(W + "p")]
    parts = [x for x in parts if x]
    # `|` trong nội dung phải escape, nếu không nó cắt bảng markdown thành cột giả
    return " ".join(parts).replace("|", r"\|").replace("⟦HÌNH⟧", "[hình]")


def table_md(tbl: ET.Element) -> str:
    grid: list[list[str]] = []
    carry: dict[int, str] = {}          # vMerge: nội dung ô gốc theo chỉ số cột
    for tr in tbl.findall(W + "tr"):
        row: list[str] = []
        for i, tc in enumerate(tr.findall(W + "tc")):
            tcpr = tc.find(W + "tcPr")
            vmerge = tcpr.find(W + "vMerge") if tcpr is not None else None
            txt = cell_text(tc)
            if vmerge is not None and vmerge.get(W + "val") != "restart" and not txt:
                txt = carry.get(i, "")   # ô gộp dọc: lặp lại nội dung ô gốc
            else:
                carry[i] = txt
            span = 1
            if tcpr is not None:
                gs = tcpr.find(W + "gridSpan")
                if gs is not None:
                    span = int(gs.get(W + "val", "1"))
            row.append(txt)
            row.extend([""] * (span - 1))   # ô gộp ngang: giữ đúng số cột
        if row:
            grid.append(row)
    if not grid:
        return ""
    width = max(len(r) for r in grid)
    grid = [r + [""] * (width - len(r)) for r in grid]
    for r in grid[1:]:
        if r and CODE.match(r[0]):
            r[0] = f"**{r[0]}**"          # hình dạng verbatim_gate dò tìm
    head, *body = grid
    lines = ["| " + " | ".join(head) + " |",
             "|" + "|".join(["---"] * width) + "|"]
    lines += ["| " + " | ".join(r) + " |" for r in body]
    return "\n".join(lines)


def convert(src: Path) -> str:
    z = zipfile.ZipFile(src)
    root = ET.fromstring(z.read("word/document.xml"))
    body = root.find(W + "body")
    if body is None:
        raise SystemExit(f"docx_to_md: {src} không có w:body — file hỏng?")
    blocks: list[str] = []
    for child in body:
        if child.tag == W + "p":
            md = para_md(child)
            if md:
                blocks.append(md)
        elif child.tag == W + "tbl":
            md = table_md(child)
            if md:
                blocks.append(md)
    digest = hashlib.sha256(src.read_bytes()).hexdigest()
    header = (
        f"<!-- SINH TỰ ĐỘNG bởi scripts/docx_to_md.py — ĐỪNG SỬA TAY.\n"
        f"     Nguồn : {src.as_posix()}\n"
        f"     sha256: {digest}\n"
        f"     Tái tạo: python3 scripts/docx_to_md.py {src.as_posix()} <đích>\n"
        f"     Ký tự markdown ở đây là của script, không phải của bản gốc —\n"
        f"     xem phần CHUYỂN ĐỔI ĐỊNH DẠNG trong docstring của script.\n"
        f"     File này bị .gitignore (quyết định Q3): mật, chỉ ở máy bạn. -->\n"
    )
    return header + "\n" + "\n\n".join(blocks) + "\n"


def main() -> int:
    if len(sys.argv) != 3:
        print(__doc__)
        return 2
    src, dst = Path(sys.argv[1]), Path(sys.argv[2])
    if not src.exists():
        raise SystemExit(f"docx_to_md: không thấy nguồn {src}")
    dst.parent.mkdir(parents=True, exist_ok=True)
    text = convert(src)
    dst.write_text(text, encoding="utf-8")
    codes = len(re.findall(r"^\| \*\*[A-Z]", text, re.M))
    print(f"{src.name} -> {dst}  ({len(text.splitlines())} dòng, "
          f"{text.count(chr(10) + '|')} dòng bảng, {codes} hàng mã yêu cầu)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
