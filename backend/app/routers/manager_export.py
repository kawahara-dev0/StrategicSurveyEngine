"""Export helpers for Manager dashboard: Excel (openpyxl) and PDF (reportlab)."""
from io import BytesIO

from openpyxl import Workbook
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer


def _pii_str(disclosed_pii: dict | None) -> str:
    if not disclosed_pii:
        return ""
    return ", ".join(f"{k}: {v}" for k, v in disclosed_pii.items())


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


def _pii_columns(opinions: list) -> list[str]:
    """Collect PII keys from all opinions, prefer order Dept, Name, Email then rest."""
    preferred = ("Dept", "Name", "Email", "Dept.", "Name.", "Email.")
    seen = set()
    for o in opinions:
        if o.disclosed_pii:
            for k in o.disclosed_pii:
                seen.add(k)
    ordered = [k for k in preferred if k in seen]
    ordered += [k for k in sorted(seen) if k not in preferred]
    return ordered


def build_xlsx(opinions: list, supporters_by_opinion: dict, survey_name: str = "") -> BytesIO:
    """Build Excel workbook with opinions. PII in separate columns (one cell per field)."""
    wb = Workbook()
    ws = wb.active
    ws.title = "Opinions"
    if survey_name:
        ws.append([f"Survey: {survey_name}"])
        ws.append([])
    pii_cols = _pii_columns(opinions)
    headers = [
        "ID", "Title", "Content", "Administrator Comments & Notes", "Priority Score (0-14)", "Rating (1-5★)",
        "Imp", "Urg", "Impact", "Supporters (pts)", "Supporters (count)",
    ] + list(pii_cols)
    ws.append(headers)
    for o in opinions:
        supporters = supporters_by_opinion.get(o.id, 0)
        row = [
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
        pii = o.disclosed_pii or {}
        for k in pii_cols:
            row.append(pii.get(k, ""))
        ws.append(row)
    buf = BytesIO()
    wb.save(buf)
    buf.seek(0)
    return buf


def build_pdf(opinions: list, supporters_by_opinion: dict, survey_name: str = "") -> BytesIO:
    """Build PDF report with opinions."""
    buf = BytesIO()
    doc = SimpleDocTemplate(
        buf,
        pagesize=A4,
        rightMargin=20 * mm,
        leftMargin=20 * mm,
        topMargin=20 * mm,
        bottomMargin=20 * mm,
    )
    styles = getSampleStyleSheet()
    story = []
    story.append(Paragraph("Survey Opinions Report", styles["Title"]))
    if survey_name:
        story.append(Paragraph(f"<b>Survey: {survey_name.replace('&', '&amp;').replace('<', '&lt;')}</b>", styles["Normal"]))
    story.append(Spacer(1, 12))
    for o in opinions:
        supporters = supporters_by_opinion.get(o.id, 0)
        pii = _pii_str(o.disclosed_pii)
        rating = _score_to_star_display(o.priority_score)
        imp = _component_label(getattr(o, "importance", 0))
        urg = _component_label(getattr(o, "urgency", 0))
        impact = _component_label(getattr(o, "expected_impact", 0))
        supp_pts = _component_label(getattr(o, "supporter_points", 0))
        story.append(Paragraph(
            f"<b>#{o.id}</b> Score: {o.priority_score} ({rating}) | Supporters: {supporters}",
            styles["Heading2"],
        ))
        title_text = (o.title or "").replace("&", "&amp;").replace("<", "&lt;")
        story.append(Paragraph(f"<b>{title_text}</b>", styles["Normal"]))
        story.append(Paragraph((o.content or "").replace("\n", "<br/>"), styles["Normal"]))
        admin_notes = getattr(o, "admin_notes", None)
        if admin_notes and admin_notes.strip():
            story.append(Spacer(1, 6))
            story.append(Paragraph(f"<i>Administrator Comments &amp; Notes:</i><br/>{(admin_notes or '').strip().replace(chr(10), '<br/>')}", styles["Normal"]))
            story.append(Spacer(1, 6))
        if pii:
            story.append(Paragraph(f"<i>PII: {pii}</i>", styles["Normal"]))
        story.append(Paragraph(
            f"Imp: {imp} | Urg: {urg} | Impact: {impact} | Supporters (pts): {supp_pts}",
            styles["Normal"],
        ))
        story.append(Spacer(1, 8))
    doc.build(story)
    buf.seek(0)
    return buf
