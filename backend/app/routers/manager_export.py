"""Export helpers for Manager dashboard: Excel (openpyxl) and PDF (reportlab)."""

from collections.abc import Sequence
from io import BytesIO

from openpyxl import Workbook
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer

from app.models.tenant import PublishedOpinion, Upvote


def _pii_str(disclosed_pii: dict | None) -> str:
    if not disclosed_pii:
        return ""
    # Prefer Name, Email, Department order
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
    """Collect PII keys from all opinions, prefer order Name, Email, Department then rest."""
    preferred = ("Name", "Email", "Department")
    seen = set()
    for o in opinions:
        if o.disclosed_pii:
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
        pii = o.disclosed_pii or {}
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
                "", "", "", "", "",  # Imp through Supporters
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
    """Build PDF report with opinions. Includes Upvotes/Additional comments (├└) and PII."""
    buf = BytesIO()
    doc = SimpleDocTemplate(
        buf,
        pagesize=A4,
        rightMargin=20 * mm,
        leftMargin=20 * mm,
        topMargin=20 * mm,
        bottomMargin=20 * mm,
        title=document_title or None,
    )
    styles = getSampleStyleSheet()
    story = []
    story.append(Paragraph("Survey Opinions Report", styles["Title"]))
    if survey_name:
        story.append(
            Paragraph(
                f"<b>Survey: {survey_name.replace('&', '&amp;').replace('<', '&lt;')}</b>",
                styles["Normal"],
            )
        )
    story.append(Spacer(1, 12))
    for o in opinions:
        supporters = supporters_by_opinion.get(o.id, 0)
        upvotes = upvotes_by_opinion.get(o.id, [])
        pii = _pii_str(o.disclosed_pii)
        rating = _score_to_star_display(o.priority_score)
        imp = _component_label(getattr(o, "importance", 0))
        urg = _component_label(getattr(o, "urgency", 0))
        impact = _component_label(getattr(o, "expected_impact", 0))
        supp_pts = _component_label(getattr(o, "supporter_points", 0))
        story.append(
            Paragraph(
                f"<b>#{o.id}</b> Score: {o.priority_score} ({rating}) | Supporters: {supporters}",
                styles["Heading2"],
            )
        )
        title_text = (o.title or "").replace("&", "&amp;").replace("<", "&lt;")
        story.append(Paragraph(f"<b>{title_text}</b>", styles["Normal"]))
        story.append(Paragraph((o.content or "").replace("\n", "<br/>"), styles["Normal"]))
        admin_notes = getattr(o, "admin_notes", None)
        if admin_notes and admin_notes.strip():
            story.append(Spacer(1, 6))
            story.append(
                Paragraph(
                    f"<i>Administrator Comments &amp; Notes:</i><br/>{(admin_notes or '').strip().replace(chr(10), '<br/>')}",
                    styles["Normal"],
                )
            )
            story.append(Spacer(1, 6))
        if pii:
            story.append(Paragraph(f"<i>PII: {pii}</i>", styles["Normal"]))
        story.append(
            Paragraph(
                f"Imp: {imp} | Urg: {urg} | Impact: {impact} | Supporters (pts): {supp_pts}",
                styles["Normal"],
            )
        )
        if upvotes:
            comments_lines = []
            for u in upvotes:
                comment = (u.published_comment or "").strip()
                if not comment:
                    continue
                line = f"- {comment}"
                if u.is_disclosure_agreed and u.disclosed_pii:
                    pii = u.disclosed_pii
                    parts = []
                    for k in ("Name", "Email", "Department"):
                        if v := pii.get(k):
                            label = "Dept." if k == "Department" else k
                            parts.append(f"{label}: {v}")
                    if parts:
                        line += f" [{', '.join(parts)}]"
                comments_lines.append(line)
            if comments_lines:
                story.append(Spacer(1, 6))
                story.append(
                    Paragraph(
                        "<i>Additional comments:</i><br/>"
                        + "<br/>".join(c.replace("&", "&amp;").replace("<", "&lt;") for c in comments_lines),
                        styles["Normal"],
                    )
                )
        story.append(Spacer(1, 8))
    doc.build(story)
    buf.seek(0)
    return buf
