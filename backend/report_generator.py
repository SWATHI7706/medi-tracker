import io
from datetime import datetime
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.platypus import (
    SimpleDocTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
    HRFlowable,
)
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch

# Color Palette
C_PRIMARY = colors.HexColor("#1E1B4B")      # Deep Indigo / Navy
C_SECONDARY = colors.HexColor("#4338CA")    # Indigo Accent
C_TEXT_MAIN = colors.HexColor("#0F172A")    # Slate 900
C_TEXT_MUTED = colors.HexColor("#475569")   # Slate 600
C_BG_LIGHT = colors.HexColor("#F8FAFC")     # Slate 50
C_BG_ALT = colors.HexColor("#F1F5F9")       # Slate 100
C_BORDER = colors.HexColor("#CBD5E1")       # Slate 300
C_ALERT_BG = colors.HexColor("#FFF1F2")     # Rose 50
C_ALERT_BORDER = colors.HexColor("#FDA4AF") # Rose 300
C_ALERT_TEXT = colors.HexColor("#9F1239")   # Rose 800
C_SUCCESS = colors.HexColor("#059669")      # Emerald 600

def generate_doctor_summary_pdf(
    patient_data: dict,
    medicines: list,
    adherence_data: dict,
    doctor_notes: list,
) -> bytes:
    """
    Generates a crisp, professional 1-page PDF visit summary for physicians.
    Designed with a strict height budget to guarantee fit on exactly one letter page.
    """
    buffer = io.BytesIO()

    # 612 x 792 pt letter size with 24pt margins => 564 pt usable width, 744 pt usable height
    doc = SimpleDocTemplate(
        buffer,
        pagesize=letter,
        leftMargin=24,
        rightMargin=24,
        topMargin=20,
        bottomMargin=20,
    )

    styles = getSampleStyleSheet()

    # Custom typography styles
    style_title = ParagraphStyle(
        "DocTitle",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=15,
        leading=17,
        textColor=C_PRIMARY,
    )
    style_subtitle = ParagraphStyle(
        "DocSub",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=8,
        leading=10,
        textColor=C_TEXT_MUTED,
    )
    style_sec_heading = ParagraphStyle(
        "SecHead",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=9,
        leading=11,
        textColor=C_PRIMARY,
        spaceAfter=2,
    )
    style_cell = ParagraphStyle(
        "TableCell",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=7.5,
        leading=9.5,
        textColor=C_TEXT_MAIN,
    )
    style_cell_bold = ParagraphStyle(
        "TableCellBold",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=7.5,
        leading=9.5,
        textColor=C_TEXT_MAIN,
    )
    style_cell_header = ParagraphStyle(
        "TableHead",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=7.5,
        leading=9.5,
        textColor=colors.white,
    )
    style_alert_text = ParagraphStyle(
        "AlertText",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=8,
        leading=10,
        textColor=C_ALERT_TEXT,
    )
    style_footer = ParagraphStyle(
        "FooterText",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=6.5,
        leading=8,
        textColor=C_TEXT_MUTED,
        alignment=1, # Center
    )

    elements = []

    # 1. HEADER SECTION
    now_str = datetime.utcnow().strftime("%b %d, %Y - %H:%M UTC")
    header_table_data = [
        [
            Paragraph("<b>MEDI TRACKER</b> | CLINICAL HEALTH HUB", style_title),
            Paragraph(f"<b>VISIT SUMMARY REPORT</b><br/><font color='#64748B'>Generated: {now_str}</font>", style_subtitle),
        ]
    ]
    header_table = Table(header_table_data, colWidths=[364, 200])
    header_table.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("ALIGN", (1, 0), (1, 0), "RIGHT"),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
        ("TOPPADDING", (0, 0), (-1, -1), 0),
    ]))
    elements.append(header_table)
    elements.append(HRFlowable(width="100%", thickness=1.5, color=C_SECONDARY, spaceBefore=3, spaceAfter=5))

    # Extract Patient Vitals
    p_info = patient_data.get("personal_info", {})
    patient_name = p_info.get("full_name") or patient_data.get("full_name") or "Patient"
    age = p_info.get("age")
    age_str = f"{age} yrs" if age else "N/A"
    gender = p_info.get("gender") or "N/A"
    blood_group = p_info.get("blood_group") or "N/A"
    height = p_info.get("height_cm")
    weight = p_info.get("weight_kg")
    height_str = f"{height} cm" if height else "N/A"
    weight_str = f"{weight} kg" if weight else "N/A"
    emergency_contact = p_info.get("emergency_contact") or "None on record"

    # Calculate BMI
    bmi_str = "N/A"
    bmi_cat = ""
    if height and weight and height > 0 and weight > 0:
        h_m = height / 100.0
        val = round(weight / (h_m * h_m), 1)
        if val < 18.5:
            bmi_cat = " (Underweight)"
        elif val < 25:
            bmi_cat = " (Normal)"
        elif val < 30:
            bmi_cat = " (Overweight)"
        else:
            bmi_cat = " (Obese)"
        bmi_str = f"{val}{bmi_cat}"

    # 2. PATIENT DEMOGRAPHICS & VITALS GRID
    vitals_data = [
        [
            Paragraph("<b>Patient Name:</b>", style_cell),
            Paragraph(patient_name, style_cell_bold),
            Paragraph("<b>Blood Group:</b>", style_cell),
            Paragraph(f"<font color='#DC2626'><b>{blood_group}</b></font>", style_cell),
            Paragraph("<b>Height / Weight:</b>", style_cell),
            Paragraph(f"{height_str} / {weight_str}", style_cell),
        ],
        [
            Paragraph("<b>Age / Gender:</b>", style_cell),
            Paragraph(f"{age_str} / {gender}", style_cell),
            Paragraph("<b>BMI Index:</b>", style_cell),
            Paragraph(f"<b>{bmi_str}</b>", style_cell),
            Paragraph("<b>Emergency Contact:</b>", style_cell),
            Paragraph(emergency_contact, style_cell),
        ],
    ]
    vitals_table = Table(vitals_data, colWidths=[70, 120, 65, 80, 85, 144])
    vitals_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), C_BG_LIGHT),
        ("BOX", (0, 0), (-1, -1), 0.5, C_BORDER),
        ("INNERGRID", (0, 0), (-1, -1), 0.3, colors.HexColor("#E2E8F0")),
        ("TOPPADDING", (0, 0), (-1, -1), 3),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
        ("LEFTPADDING", (0, 0), (-1, -1), 4),
        ("RIGHTPADDING", (0, 0), (-1, -1), 4),
    ]))
    elements.append(vitals_table)
    elements.append(Spacer(1, 4))

    # 3. CRITICAL ALLERGIES & SUBSTANCES BANNER
    allergies = patient_data.get("allergies", [])
    if allergies:
        allergies_str = ", ".join(allergies)
        alert_content = f"CRITICAL ALLERGIES / ADVERSE REACTIONS: {allergies_str}"
    else:
        alert_content = "ALLERGIES: No Known Drug Allergies (NKDA) recorded on profile."

    allergies_table = Table([[Paragraph(alert_content, style_alert_text)]], colWidths=[564])
    allergies_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), C_ALERT_BG),
        ("BOX", (0, 0), (-1, -1), 1, C_ALERT_BORDER),
        ("TOPPADDING", (0, 0), (-1, -1), 3),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
    ]))
    elements.append(allergies_table)
    elements.append(Spacer(1, 5))

    # 4. CHRONIC & ACTIVE MEDICAL CONDITIONS
    elements.append(Paragraph("<b>Diagnosed Chronic & Active Health Conditions</b>", style_sec_heading))
    conditions = patient_data.get("health_conditions", [])
    cond_rows = [
        [
            Paragraph("Condition Name", style_cell_header),
            Paragraph("Diagnosed Date", style_cell_header),
            Paragraph("Severity Level", style_cell_header),
            Paragraph("Current Status", style_cell_header),
        ]
    ]
    if conditions:
        for c in conditions[:4]: # Limit to top 4 for 1-page fit
            sev = c.get("severity", "Moderate")
            stat = c.get("status", "active").capitalize()
            cond_rows.append([
                Paragraph(f"<b>{c.get('condition_name', 'Condition')}</b>", style_cell),
                Paragraph(c.get("diagnosed_date") or "N/A", style_cell),
                Paragraph(sev, style_cell),
                Paragraph(stat, style_cell),
            ])
    else:
        cond_rows.append([
            Paragraph("<i>No chronic or active medical conditions recorded.</i>", style_cell),
            Paragraph("-", style_cell),
            Paragraph("-", style_cell),
            Paragraph("-", style_cell),
        ])

    cond_table = Table(cond_rows, colWidths=[204, 110, 120, 130])
    cond_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), C_PRIMARY),
        ("BOX", (0, 0), (-1, -1), 0.5, C_BORDER),
        ("INNERGRID", (0, 0), (-1, -1), 0.3, colors.HexColor("#E2E8F0")),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, C_BG_LIGHT]),
        ("TOPPADDING", (0, 0), (-1, -1), 2.5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 2.5),
        ("LEFTPADDING", (0, 0), (-1, -1), 4),
        ("RIGHTPADDING", (0, 0), (-1, -1), 4),
    ]))
    elements.append(cond_table)
    elements.append(Spacer(1, 5))

    # 5. ACTIVE MEDICATION SCHEDULE & INVENTORY TABLE
    elements.append(Paragraph("<b>Current Active Prescriptions & Dosage Regimen</b>", style_sec_heading))
    med_rows = [
        [
            Paragraph("Medication Name", style_cell_header),
            Paragraph("Dosage", style_cell_header),
            Paragraph("Schedule Times", style_cell_header),
            Paragraph("Instructions", style_cell_header),
            Paragraph("Stock Supply", style_cell_header),
        ]
    ]
    if medicines:
        for m in medicines[:6]: # Limit to top 6
            times_str = ", ".join(m.get("times", [])) or "Daily"
            stock = m.get("total_stock", 30)
            threshold = m.get("refill_threshold", 5)
            unit = m.get("dose_unit", "pills")
            stock_str = f"{stock} {unit}" + (" (LOW)" if stock <= threshold else "")

            med_rows.append([
                Paragraph(f"<b>{m.get('name', 'Medicine')}</b>", style_cell),
                Paragraph(m.get("dosage", ""), style_cell),
                Paragraph(times_str, style_cell),
                Paragraph(m.get("category", "After Food"), style_cell),
                Paragraph(stock_str, style_cell),
            ])
    else:
        med_rows.append([
            Paragraph("<i>No active prescriptions logged.</i>", style_cell),
            Paragraph("-", style_cell),
            Paragraph("-", style_cell),
            Paragraph("-", style_cell),
            Paragraph("-", style_cell),
        ])

    med_table = Table(med_rows, colWidths=[150, 80, 134, 110, 90])
    med_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), C_SECONDARY),
        ("BOX", (0, 0), (-1, -1), 0.5, C_BORDER),
        ("INNERGRID", (0, 0), (-1, -1), 0.3, colors.HexColor("#E2E8F0")),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, C_BG_LIGHT]),
        ("TOPPADDING", (0, 0), (-1, -1), 2.5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 2.5),
        ("LEFTPADDING", (0, 0), (-1, -1), 4),
        ("RIGHTPADDING", (0, 0), (-1, -1), 4),
    ]))
    elements.append(med_table)
    elements.append(Spacer(1, 5))

    # 6. ADHERENCE & ROUTINE VITALITY
    elements.append(Paragraph("<b>30-Day Medication Adherence & Routine Consistency</b>", style_sec_heading))
    adh_pct = adherence_data.get("adherence_pct", 100)
    streak_days = adherence_data.get("streak_days", 0)
    taken_cnt = adherence_data.get("taken_doses", 0)
    missed_cnt = adherence_data.get("missed_doses", 0)

    adh_data = [
        [
            Paragraph(f"<b>30-Day Adherence:</b> <font color='#059669'>{adh_pct}%</font>", style_cell),
            Paragraph(f"<b>Current Streak:</b> {streak_days} Days", style_cell),
            Paragraph(f"<b>Doses Taken:</b> {taken_cnt}", style_cell),
            Paragraph(f"<b>Doses Missed:</b> {missed_cnt}", style_cell),
        ]
    ]
    adh_table = Table(adh_data, colWidths=[140, 140, 140, 144])
    adh_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#ECFDF5")),
        ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#6EE7B7")),
        ("TOPPADDING", (0, 0), (-1, -1), 3),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
    ]))
    elements.append(adh_table)
    elements.append(Spacer(1, 5))

    # 7. RECENT DOCTOR CONSULTATION ADVICE
    elements.append(Paragraph("<b>Recent Physician Consultation Advice & Instructions</b>", style_sec_heading))
    notes = doctor_notes or patient_data.get("doctor_notes", [])
    note_rows = [
        [
            Paragraph("Physician / Clinic", style_cell_header),
            Paragraph("Date", style_cell_header),
            Paragraph("Clinical Advice & Lifestyle Instructions", style_cell_header),
        ]
    ]
    if notes:
        for n in notes[:2]: # Show recent 2
            doc_info = f"<b>{n.get('doctor_name', 'Doctor')}</b><br/>{n.get('specialty', 'General Physician')}"
            advice_short = n.get("advice_text", "")
            if len(advice_short) > 160:
                advice_short = advice_short[:157] + "..."
            note_rows.append([
                Paragraph(doc_info, style_cell),
                Paragraph(n.get("visit_date", "N/A"), style_cell),
                Paragraph(advice_short, style_cell),
            ])
    else:
        note_rows.append([
            Paragraph("<i>No recent physician consultation notes logged.</i>", style_cell),
            Paragraph("-", style_cell),
            Paragraph("-", style_cell),
        ])

    notes_table = Table(note_rows, colWidths=[140, 70, 354])
    notes_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), C_PRIMARY),
        ("BOX", (0, 0), (-1, -1), 0.5, C_BORDER),
        ("INNERGRID", (0, 0), (-1, -1), 0.3, colors.HexColor("#E2E8F0")),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, C_BG_LIGHT]),
        ("TOPPADDING", (0, 0), (-1, -1), 2.5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 2.5),
        ("LEFTPADDING", (0, 0), (-1, -1), 4),
        ("RIGHTPADDING", (0, 0), (-1, -1), 4),
    ]))
    elements.append(notes_table)
    elements.append(Spacer(1, 6))

    # 8. FOOTER / DISCLAIMER
    elements.append(HRFlowable(width="100%", thickness=0.5, color=C_BORDER, spaceBefore=2, spaceAfter=2))
    elements.append(Paragraph(
        "CONFIDENTIAL MEDICAL SUMMARY • This document summarizes patient-reported adherence, digital intake tracking, and diagnosed conditions. "
        "Intended to assist consulting healthcare providers. Medi Tracker Health Tech Platform.",
        style_footer,
    ))

    # Build PDF
    doc.build(elements)
    pdf_bytes = buffer.getvalue()
    buffer.close()
    return pdf_bytes
