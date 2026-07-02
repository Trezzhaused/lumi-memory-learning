import json
import os
import sys


def generate_guide(output_path):
    try:
        from reportlab.lib.pagesizes import letter
        from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle
        from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
        from reportlab.lib import colors
    except Exception:
        os.makedirs(os.path.dirname(output_path), exist_ok=True)
        with open(output_path, "w", encoding="utf-8") as handle:
            handle.write("Sovereign AI Master Guide\n")
            handle.write("ReportLab is not installed; this fallback document was generated as plain text.\n")
        return {"status": "success", "message": "Fallback guide written as plain text."}

    doc = SimpleDocTemplate(output_path, pagesize=letter, leftMargin=54, rightMargin=54, topMargin=54, bottomMargin=54)
    styles = getSampleStyleSheet()
    story = []
    title_style = ParagraphStyle("MainTitle", parent=styles["Normal"], fontName="Helvetica-Bold", fontSize=24, leading=28, spaceAfter=15)
    body_style = ParagraphStyle("BodyText", parent=styles["Normal"], fontName="Helvetica", fontSize=10, leading=14, spaceAfter=8)
    story.append(Paragraph("SOVEREIGN AI WORKSPACE OPERATIONAL MANUAL", title_style))
    story.append(Paragraph("Local-first ingestion, categorization, and archival workflow for Lumi.", body_style))
    story.append(Spacer(1, 12))
    data = [["Component", "Implementation"], ["Ingestion", "POST /api/lumi/ingestion/process"], ["Categorization", "Heuristic local classification into Financials / Manuscripts / System_Logs / General_Reference"], ["Storage", "Local artifact store and memory persistence"], ["Guide", "POST /api/lumi/ingestion/guide"]]
    table = Table(data, colWidths=[140, 320])
    table.setStyle(TableStyle([("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#E2E8F0")), ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#CBD5E1")), ("PADDING", (0, 0), (-1, -1), 6)]))
    story.append(table)
    doc.build(story)
    return {"status": "success", "message": f"Guide written to {output_path}"}


if __name__ == "__main__":
    output_path = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.getcwd(), "Sovereign_AI_Master_Guide.pdf")
    print(json.dumps(generate_guide(output_path)))
