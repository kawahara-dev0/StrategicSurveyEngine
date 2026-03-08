"""Export helpers for Manager dashboard: Excel (openpyxl) and PDF (reportlab)."""

from collections.abc import Sequence
from io import BytesIO

from openpyxl import Workbook
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

from app.models.tenant import PublishedOpinion, Upvote


def _esc(s: str) -> str:
    """Escape for XML/HTML in Paragraph."""
    if s is None:
        return ""
    return str(s).replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def _br(s: str) -> str:
    """Replace newlines with <br/> for Paragraph."""
    return (s or "").replace("\n", "<br/>")


def _esc_br(s: str) -> str:
    """Escape and replace newlines - use for user-supplied content in Paragraphs."""
    return _br(_esc(s or ""))


def _pii_str(disclosed_pii: dict | None) -> str:
    if not disclosed_pii:
        return ""
    parts = []
    for label in ("Name", "Email", "Department"):
        if v := disclosed_pii.get(label):
            parts.append(f"{label}: {v}")
    for k, v in disclosed_pii.items():
        if k not in ("Name", "Email", "Department") and v:
            parts.append(f"{k}: {v}")
    return ", ".join(parts)


def _score_to_rating(priority_score: int) -> int:
    """Convert priority score (0-14) to rating 1-5 (same as UI stars)."""
    if priority_score >= 12:
        return 5
    if priority_score >= 9:
        return 4
    if priority_score >= 6:
        return 3
    if priority_score >= 3:
        return 2
    return 1


def _score_to_star_display(priority_score: int) -> str:
    """Display as 1★-5★ for export readability."""
    return f"{_score_to_rating(priority_score)}★"


def _component_label(value: int) -> str:
    """0-2 to High, Medium, Low."""
    return {0: "Low", 1: "Medium", 2: "High"}.get(value, "—")


def _upvote_pii_cells(upvote: Upvote) -> tuple[str, str, str]:
    """Get Name:~, Email:~, Dept.:~ cells for an upvote when PII disclosed."""
    if not upvote.is_disclosure_agreed or not upvote.disclosed_pii:
        return "", "", ""
    pii = upvote.disclosed_pii
    return (
        f"Name: {pii.get('Name') or ''}" if pii.get("Name") else "",
        f"Email: {pii.get('Email') or ''}" if pii.get("Email") else "",
        f"Dept.: {pii.get('Department') or ''}" if pii.get("Department") else "",
    )


def _pii_columns(opinions: Sequence[PublishedOpinion]) -> list[str]:
    """Collect PII keys from opinions where is_disclosure_agreed."""
    preferred = ("Name", "Email", "Department")
    seen = set()
    for o in opinions:
        if getattr(o, "is_disclosure_agreed", False) and o.disclosed_pii:
            for k in o.disclosed_pii:
                seen.add(k)
    ordered = [k for k in preferred if k in seen]
    ordered += [k for k in sorted(seen) if k not in preferred]
    return ordered


def build_xlsx(
    opinions: Sequence[PublishedOpinion],
    supporters_by_opinion: dict[int, int],
    upvotes_by_opinion: dict[int, list[Upvote]],
    survey_name: str = "",
    document_title: str = "",
) -> BytesIO:
    """Build Excel workbook with opinions. Includes Upvotes/Additional comments (├└) and PII columns."""
    wb = Workbook()
    if document_title:
        wb.properties.title = document_title
    ws = wb.active
    ws.title = "Opinions"
    if survey_name:
        ws.append([f"Survey: {survey_name}"])
        ws.append([])
    pii_cols = _pii_columns(opinions)
    headers = [
        "ID",
        "Title",
        "Content",
        "Administrator Comments & Notes",
        "Priority Score (0-14)",
        "Rating (1-5★)",
        "Imp",
        "Urg",
        "Impact",
        "Supporters (pts)",
        "Supporters (count)",
    ] + list(pii_cols)
    ws.append(headers)
    for o in opinions:
        supporters = supporters_by_opinion.get(o.id, 0)
        upvotes = upvotes_by_opinion.get(o.id, [])
        pii = (o.disclosed_pii or {}) if getattr(o, "is_disclosure_agreed", False) else {}
        opinion_row = [
            o.id,
            o.title,
            o.content or "",
            (getattr(o, "admin_notes", None) or ""),
            o.priority_score,
            _score_to_star_display(o.priority_score),
            _component_label(getattr(o, "importance", 0)),
            _component_label(getattr(o, "urgency", 0)),
            _component_label(getattr(o, "expected_impact", 0)),
            _component_label(getattr(o, "supporter_points", 0)),
            supporters,
        ]
        for k in pii_cols:
            opinion_row.append(pii.get(k, ""))
        ws.append(opinion_row)
        for u in upvotes:
            comment = (u.published_comment or "").strip()
            if not comment:
                continue
            nc, ne, nd = _upvote_pii_cells(u)
            comment_row = [
                "",  # ID empty for sub-row
                "Additional comments",
                comment,
                nc,  # D列: Name:~
                ne,  # E列: Email:~
                nd,  # F列: Dept.:~
                "",
                "",
                "",
                "",
                "",  # Imp through Supporters
            ]
            for _ in pii_cols:
                comment_row.append("")
            ws.append(comment_row)
    buf = BytesIO()
    wb.save(buf)
    buf.seek(0)
    return buf


def build_pdf(
    opinions: Sequence[PublishedOpinion],
    supporters_by_opinion: dict[int, int],
    upvotes_by_opinion: dict[int, list[Upvote]],
    survey_name: str = "",
    document_title: str = "",
) -> BytesIO:
    """Build PDF report with opinions. Structured layout with clear separation for readability."""
    buf = BytesIO()
    doc = SimpleDocTemplate(
        buf,
        pagesize=A4,
        rightMargin=18 * mm,
        leftMargin=18 * mm,
        topMargin=18 * mm,
        bottomMargin=18 * mm,
        title=document_title or None,
    )
    styles = getSampleStyleSheet()
    body_small = ParagraphStyle(
        name="BodySmall",
        parent=styles["Normal"],
        fontSize=9,
        leading=11,
        spaceAfter=4,
    )
    col_width = A4[0] - 2 * 18 * mm
    story = []
    story.append(Paragraph("Survey Opinions Report", styles["Title"]))
    if survey_name:
        story.append(
            Paragraph(f"<b>Survey: {_esc(survey_name)}</b>", styles["Normal"])
        )
    story.append(Spacer(1, 14))
    for o in opinions:
        supporters = supporters_by_opinion.get(o.id, 0)
        upvotes = upvotes_by_opinion.get(o.id, [])
        pii = _pii_str(o.disclosed_pii if getattr(o, "is_disclosure_agreed", False) else None)
        rating = _score_to_star_display(o.priority_score)
        imp = _component_label(getattr(o, "importance", 0))
        urg = _component_label(getattr(o, "urgency", 0))
        impact = _component_label(getattr(o, "expected_impact", 0))
        supp_pts = _component_label(getattr(o, "supporter_points", 0))
        admin_notes = getattr(o, "admin_notes", None)
        has_admin = bool(admin_notes and admin_notes.strip())
        # Build table rows: [Label, Content]
        rows = []
        rows.append([
            Paragraph(
                f"<b>#{o.id}</b> Score: {o.priority_score} ({rating}) · Supporters: {supporters}",
                styles["Heading2"],
            )
        ])
        title_esc = _esc(o.title or "")
        rows.append([
            Paragraph(f"<b>{title_esc}</b>", body_small),
        ])
        rows.append([
            Paragraph(_esc_br(o.content or ""), body_small),
        ])
        if has_admin:
            admin_esc = _esc_br((admin_notes or "").strip())
            rows.append([
                Paragraph(
                    f'<font size="8" color="#555555">Administrator Comments</font><br/>{admin_esc}',
                    body_small,
                )
            ])
        if pii:
            pii_esc = _esc_br(pii)
            rows.append([
                Paragraph(f'<font size="8" color="#555555">PII</font><br/>{pii_esc}', body_small),
            ])
        rows.append([
            Paragraph(
                f'<font size="8" color="#555555">Imp</font> {imp} · '
                f'<font size="8" color="#555555">Urg</font> {urg} · '
                f'<font size="8" color="#555555">Impact</font> {impact} · '
                f'<font size="8" color="#555555">Supporters (pts)</font> {supp_pts}',
                body_small,
            )
        ])
        if upvotes:
            comments_parts = []
            for u in upvotes:
                comment = (u.published_comment or "").strip()
                if not comment:
                    continue
                line = f"• {_esc_br(comment)}"
                if u.is_disclosure_agreed and u.disclosed_pii:
                    upvote_pii = u.disclosed_pii
                    parts = []
                    for k in ("Name", "Email", "Department"):
                        if v := upvote_pii.get(k):
                            label = "Dept." if k == "Department" else k
                            parts.append(f"{label}: {_esc(str(v))}")
                    if parts:
                        line += f" <i>[{', '.join(parts)}]</i>"
                comments_parts.append(line)
            if comments_parts:
                rows.append([
                    Paragraph(
                        '<font size="8" color="#555555">Additional comments</font><br/>'
                        + "<br/>".join(comments_parts),
                        body_small,
                    )
                ])
        tbl = Table(rows, colWidths=[col_width])
        tbl.setStyle(
            TableStyle([
                ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#cccccc")),
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#f0f0f0")),
                ("TOPPADDING", (0, 0), (-1, -1), 8),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
                ("LEFTPADDING", (0, 0), (-1, -1), 12),
                ("RIGHTPADDING", (0, 0), (-1, -1), 12),
            ])
        )
        story.append(tbl)
        story.append(Spacer(1, 14))
    doc.build(story)
    buf.seek(0)
    return buf
