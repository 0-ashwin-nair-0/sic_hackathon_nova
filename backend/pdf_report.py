from io import BytesIO
from datetime import datetime

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import cm
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.graphics.shapes import Drawing, String
from reportlab.graphics.charts.barcharts import VerticalBarChart


def _safe_float(value, default=0.0):
    try:
        return float(value)
    except Exception:
        return float(default)


def _safe_int(value, default=0):
    try:
        return int(round(float(value)))
    except Exception:
        return int(default)


def _fmt_num(value):
    number = _safe_float(value)
    if abs(number) >= 1000:
        return f"{number:,.0f}"
    if abs(number) >= 100:
        return f"{number:,.1f}"
    return f"{number:.2f}"


def _fmt_pct(value):
    return f"{_safe_float(value):.1f}%"


def _water_context(report_data):
    metrics = report_data.get("metrics", {})
    risk_rows = report_data.get("risk_zones", [])
    leak_alerts = report_data.get("leak_alerts", [])

    total_zones = max(
        len(risk_rows),
        len(report_data.get("charts", {}).get("tank_levels", {}).get("labels", [])),
        1,
    )
    critical = _safe_int(metrics.get("critical_zones", 0))
    warning = _safe_int(metrics.get("warning_zones", 0))
    shortage_risk = critical + warning
    leak_zones = max(_safe_int(metrics.get("leak_alerts_count", 0)), len(leak_alerts))
    saved_liters = max(_safe_float(metrics.get("total_reallocated", 0.0)) * 1000.0, 0.0)

    efficiency_gain = min(35.0, max(5.0, _safe_float(metrics.get("distribution_efficiency", 0.0)) * 0.20))
    sustainability_score = max(45.0, min(96.0, 90.0 - (shortage_risk * 3.0) - (leak_zones * 1.5) + (efficiency_gain * 0.8)))

    chart_values = [
        max(0.0, _safe_float(metrics.get("avg_tank_level", 0.0))),
        max(0.0, _safe_float(metrics.get("distribution_efficiency", 0.0))),
        max(0.0, shortage_risk),
        max(0.0, leak_zones),
    ]
    chart_labels = ["Avg Tank %", "Delivery %", "Risk Zones", "Leak Alerts"]

    return {
        "module_label": "Water Management",
        "total_zones": total_zones,
        "water_risk_zones": shortage_risk,
        "water_saved_liters": saved_liters,
        "leak_zones": leak_zones,
        "electricity_warning_zones": 0,
        "blackout_before": 0.0,
        "blackout_after": 0.0,
        "load_reduction": 0.0,
        "waste_high_zones": 0,
        "energy_generated_kwh": 0.0,
        "co2_reduction": 0.0,
        "landfill_reduction": 0.0,
        "efficiency_improvement": efficiency_gain,
        "sustainability_score": sustainability_score,
        "chart_values": chart_values,
        "chart_labels": chart_labels,
    }


def _electricity_context(report_data):
    metrics = report_data.get("metrics", {})
    workflow = report_data.get("workflow", {})
    final_result = workflow.get("final_result", {})

    zones = report_data.get("zones", [])
    total_zones = max(len(zones), 1)
    warning_zones = _safe_int(metrics.get("critical_zones_count", 0))

    total_need = _safe_float(final_result.get("total_need_kwh", 0.0))
    transferred = _safe_float(final_result.get("resources_utilized", {}).get("reallocated_kwh", 0.0))
    reduced = _safe_float(final_result.get("resources_utilized", {}).get("non_essential_reduced_kwh", 0.0))
    backup = _safe_float(final_result.get("resources_utilized", {}).get("solar_backup_kwh", 0.0)) + _safe_float(
        final_result.get("resources_utilized", {}).get("battery_backup_kwh", 0.0)
    )
    final_shortfall = _safe_float(final_result.get("final_shortfall_kwh", 0.0))

    blackout_before = min(100.0, (_safe_float(warning_zones) / max(total_zones, 1)) * 100.0)
    blackout_after = min(100.0, (final_shortfall / max(total_need, 1.0)) * 100.0)
    load_reduction = min(100.0, ((transferred + reduced) / max(total_need, 1.0)) * 100.0)

    efficiency_gain = min(40.0, max(8.0, load_reduction * 0.55 + (blackout_before - blackout_after) * 0.35))
    sustainability_score = max(45.0, min(97.0, 88.0 - (warning_zones * 2.2) - (blackout_after * 0.2) + (efficiency_gain * 0.9)))

    chart_values = [
        max(0.0, _safe_float(metrics.get("average_usage_percent", 0.0))),
        max(0.0, warning_zones),
        max(0.0, load_reduction),
        max(0.0, blackout_before - blackout_after),
    ]
    chart_labels = ["Usage %", "Risk Zones", "Load Reduced %", "Risk Drop %"]

    return {
        "module_label": "Electricity Management",
        "total_zones": total_zones,
        "water_risk_zones": 0,
        "water_saved_liters": 0.0,
        "leak_zones": 0,
        "electricity_warning_zones": warning_zones,
        "blackout_before": blackout_before,
        "blackout_after": blackout_after,
        "load_reduction": load_reduction,
        "waste_high_zones": 0,
        "energy_generated_kwh": 0.0,
        "co2_reduction": 0.0,
        "landfill_reduction": 0.0,
        "efficiency_improvement": efficiency_gain,
        "sustainability_score": sustainability_score,
        "chart_values": chart_values,
        "chart_labels": chart_labels,
    }


def _waste_context(report_data):
    metrics = report_data.get("metrics", {})
    high_table = report_data.get("high_priority_table", [])

    total_zones = max(len(high_table), _safe_int(metrics.get("high_priority_zones", 0)), 1)
    waste_high = _safe_int(metrics.get("high_priority_zones", len(high_table)))

    total_waste_kg = 0.0
    for row in high_table:
        total_waste_kg += _safe_float(row.get("avg_daily_waste_kg", 0.0))

    energy_generated = total_waste_kg * 0.65
    co2_reduction = max(_safe_float(metrics.get("carbon_saved_kg", 0.0)), total_waste_kg * 1.5)
    landfill_reduction = min(95.0, max(8.0, _safe_float(metrics.get("distance_reduction_pct", 0.0)) * 0.8))

    efficiency_gain = min(38.0, max(7.0, _safe_float(metrics.get("distance_reduction_pct", 0.0)) * 0.7))
    sustainability_score = max(45.0, min(96.0, 87.0 - (waste_high * 2.0) + (efficiency_gain * 0.9)))

    chart_values = [
        max(0.0, waste_high),
        max(0.0, _safe_float(metrics.get("distance_reduction_pct", 0.0))),
        max(0.0, co2_reduction / 100.0),
        max(0.0, energy_generated / 100.0),
    ]
    chart_labels = ["High Zones", "Route Save %", "CO2 Saved x100", "Energy x100"]

    return {
        "module_label": "Waste Management",
        "total_zones": total_zones,
        "water_risk_zones": 0,
        "water_saved_liters": 0.0,
        "leak_zones": 0,
        "electricity_warning_zones": 0,
        "blackout_before": 0.0,
        "blackout_after": 0.0,
        "load_reduction": 0.0,
        "waste_high_zones": waste_high,
        "energy_generated_kwh": energy_generated,
        "co2_reduction": co2_reduction,
        "landfill_reduction": landfill_reduction,
        "efficiency_improvement": efficiency_gain,
        "sustainability_score": sustainability_score,
        "chart_values": chart_values,
        "chart_labels": chart_labels,
    }


def _risk_level(score):
    if score >= 78:
        return "Low"
    if score >= 58:
        return "Moderate"
    return "High"


def _executive_summary_text(ctx):
    return (
        "This Smart City Command Center report presents a clear picture of current city service performance with a special focus on "
        f"{ctx['module_label']}. The uploaded data shows where service pressure is increasing, where immediate action is required, and "
        "where the city has already improved through better planning and distribution. The findings indicate that targeted operational "
        "steps can reduce daily public risk, improve reliability of essential services, and support cleaner, more efficient city operations. "
        "The report also confirms that outcomes improve when decisions are made early, zone by zone, using a consistent response plan. "
        "Overall, city performance is stable with clear opportunities to raise resilience through fast repairs, better scheduling, and "
        "strong coordination between field teams and control center leadership."
    )


def _key_findings_water(ctx):
    if ctx["module_label"] != "Water Management":
        return [
            "This upload did not include water records. Upload the water dataset to generate water-specific risk and saving insights.",
            "For a full city executive brief, combine water, electricity, and waste uploads in the same reporting cycle.",
        ]
    return [
        f"A total of {ctx['total_zones']} zones were reviewed, and {ctx['water_risk_zones']} zones show shortage risk that needs close monitoring.",
        f"Current redistribution actions indicate an estimated { _fmt_num(ctx['water_saved_liters']) } liters can be retained through balanced supply.",
        f"Leak risk signals are present in {ctx['leak_zones']} zones, suggesting preventive inspections should be prioritized before service disruption occurs.",
        "Redistribution has improved service continuity in under-supplied zones and can be expanded to maintain fair delivery across neighborhoods.",
    ]


def _key_findings_electricity(ctx):
    if ctx["module_label"] != "Electricity Management":
        return [
            "This upload did not include electricity records. Upload the electricity dataset to generate load risk and blackout reduction insights.",
            "For a full city executive brief, combine water, electricity, and waste uploads in the same reporting cycle.",
        ]
    return [
        f"{ctx['electricity_warning_zones']} zones are nearing overload and should remain under watch during high-demand periods.",
        f"Blackout risk is reduced from { _fmt_pct(ctx['blackout_before']) } to { _fmt_pct(ctx['blackout_after']) } after balancing and controlled reduction steps.",
        f"Total managed load reduction is { _fmt_pct(ctx['load_reduction']) }, which helps protect public-facing essential services.",
        "Priority service continuity remains stable when balancing decisions are taken early and backup support is activated only when necessary.",
    ]


def _key_findings_waste(ctx):
    if ctx["module_label"] != "Waste Management":
        return [
            "This upload did not include waste records. Upload the waste dataset to generate overflow risk and recovery impact insights.",
            "For a full city executive brief, combine water, electricity, and waste uploads in the same reporting cycle.",
        ]
    return [
        f"{ctx['waste_high_zones']} zones show high fill pressure and should be prioritized in the next collection cycle.",
        f"Resource recovery potential is approximately { _fmt_num(ctx['energy_generated_kwh']) } kWh, supporting local clean-energy goals.",
        f"Estimated environmental gain includes { _fmt_num(ctx['co2_reduction']) } kg CO2 reduction with landfill reduction of { _fmt_pct(ctx['landfill_reduction']) }.",
        "Collection planning based on urgency and route efficiency can improve response speed while lowering fuel and operational pressure.",
    ]


def _priority_recommendations(module_label):
    if module_label == "Water Management":
        return [
            "Strengthen pipeline renewal and pressure-control upgrades in high-risk zones to prevent repeat shortages.",
            "Use automated zone alerts for low tank levels and leak signals to trigger faster field response.",
            "Launch citizen awareness drives on responsible daily water use in high-consumption neighborhoods.",
            "Adopt preventive maintenance cycles for pumps, valves, and old lines before peak-demand months.",
            "Plan future upgrades for smart metering and ward-level water balancing dashboards.",
        ]
    if module_label == "Electricity Management":
        return [
            "Upgrade local feeder and transformer capacity in repeated high-demand zones.",
            "Use automated demand balancing controls during predictable peak hours.",
            "Run citizen campaigns for voluntary non-essential load reduction during stress windows.",
            "Schedule preventive maintenance for critical lines and backup assets before summer peaks.",
            "Expand future readiness with distributed backup and public-building solar integration.",
        ]
    return [
        "Improve collection infrastructure and route staging points in persistent overflow zones.",
        "Use smart bin alerts and schedule automation to prevent overflow buildup.",
        "Promote citizen segregation participation through ward-level outreach and incentives.",
        "Set preventive maintenance plans for collection fleets and transfer stations.",
        "Scale future upgrades for recovery facilities that convert more waste into useful energy.",
    ]


def _future_readiness(ctx):
    return (
        "The city shows improving readiness for near-term growth, provided current operational discipline is maintained. "
        "For population growth, the existing process can scale if zone-level monitoring remains active and response teams are expanded in high-pressure areas. "
        "For climate stress, faster adaptation is possible through seasonal planning, resilient infrastructure, and stronger backup protocols. "
        "For rising energy and service demand, long-term stability depends on regular upgrades, preventive maintenance, and coordinated governance between utility teams, "
        "city operations, and citizen communication channels."
    )


def _final_conclusion(ctx):
    return (
        "This report confirms that data-informed city operations can deliver practical, citizen-visible improvements in service reliability, sustainability, "
        "and risk reduction. The Urban Intelligence Grid should be treated as a decision-support system that helps leadership act earlier, prioritize better, "
        "and deploy resources where impact is highest. With consistent use, this framework can support smarter governance, stronger public trust, and measurable "
        "progress toward a cleaner and more resilient city."
    )


def _build_chart(values, labels, title):
    drawing = Drawing(16 * cm, 8 * cm)
    drawing.add(String(0.6 * cm, 7.2 * cm, title, fontSize=10, fillColor=colors.HexColor("#1E3A8A")))

    chart = VerticalBarChart()
    chart.x = 0.8 * cm
    chart.y = 0.9 * cm
    chart.width = 14.6 * cm
    chart.height = 5.7 * cm
    chart.data = [[max(0.0, _safe_float(v)) for v in values]]
    chart.categoryAxis.categoryNames = [str(label) for label in labels]
    chart.categoryAxis.labels.fontSize = 8
    chart.categoryAxis.labels.boxAnchor = "ne"
    chart.categoryAxis.labels.angle = 22
    chart.valueAxis.valueMin = 0
    chart.valueAxis.labels.fontSize = 8
    chart.bars[0].fillColor = colors.HexColor("#0EA5E9")
    chart.bars[0].strokeColor = colors.HexColor("#1D4ED8")
    chart.barWidth = 0.7 * cm
    chart.groupSpacing = 0.5 * cm

    drawing.add(chart)
    return drawing


def _module_context(module_name, report_data):
    module = str(module_name or "").strip().lower()
    if module == "water":
        return _water_context(report_data)
    if module == "electricity":
        return _electricity_context(report_data)
    if module == "waste":
        return _waste_context(report_data)
    raise ValueError("Unsupported module for PDF generation")


def generate_module_pdf(module_name, report_data):
    ctx = _module_context(module_name, report_data)
    selected_date = report_data.get("selected_date", datetime.now().strftime("%Y-%m-%d %H:%M"))

    sustainability_score = _safe_float(ctx["sustainability_score"])
    risk_level = _risk_level(sustainability_score)
    efficiency_improvement = _safe_float(ctx["efficiency_improvement"])

    buffer = BytesIO()
    document = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        rightMargin=1.4 * cm,
        leftMargin=1.4 * cm,
        topMargin=1.3 * cm,
        bottomMargin=1.3 * cm,
        title=f"Smart City Executive Report - {ctx['module_label']}"
    )

    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        "ExecTitle",
        parent=styles["Title"],
        fontSize=20,
        leading=24,
        textColor=colors.HexColor("#0F172A"),
        spaceAfter=8,
    )
    subtitle_style = ParagraphStyle(
        "ExecSubtitle",
        parent=styles["BodyText"],
        fontSize=10,
        leading=13,
        textColor=colors.HexColor("#334155"),
    )
    section_style = ParagraphStyle(
        "SectionTitle",
        parent=styles["Heading2"],
        fontSize=13,
        leading=16,
        textColor=colors.HexColor("#0F766E"),
        spaceBefore=8,
        spaceAfter=6,
    )
    body_style = ParagraphStyle(
        "ExecBody",
        parent=styles["BodyText"],
        fontSize=10.2,
        leading=15,
        textColor=colors.HexColor("#1E293B"),
    )
    bullet_style = ParagraphStyle(
        "ExecBullet",
        parent=body_style,
        leftIndent=12,
        bulletIndent=0,
        spaceBefore=2,
        spaceAfter=2,
    )

    story = []
    story.append(Paragraph("Smart City Command Center Executive Report", title_style))
    story.append(Paragraph(f"Sector focus: {ctx['module_label']}", subtitle_style))
    story.append(Paragraph(f"Data snapshot: {selected_date}", subtitle_style))
    story.append(Paragraph(f"Generated on: {datetime.now().strftime('%d %b %Y, %I:%M %p')}", subtitle_style))
    story.append(Spacer(1, 0.28 * cm))

    story.append(Paragraph("1) Executive Summary", section_style))
    story.append(Paragraph(_executive_summary_text(ctx), body_style))

    story.append(Paragraph("2) Key Findings by Sector", section_style))

    story.append(Paragraph("Water Management", styles["Heading3"]))
    for item in _key_findings_water(ctx):
        story.append(Paragraph(item, bullet_style, bulletText="•"))

    story.append(Paragraph("Electricity Management", styles["Heading3"]))
    for item in _key_findings_electricity(ctx):
        story.append(Paragraph(item, bullet_style, bulletText="•"))

    story.append(Paragraph("Waste Management", styles["Heading3"]))
    for item in _key_findings_waste(ctx):
        story.append(Paragraph(item, bullet_style, bulletText="•"))

    story.append(Paragraph("3) Overall City Health Score", section_style))
    health_table = Table(
        [
            ["Metric", "Current Value"],
            ["Sustainability Score (0-100)", f"{_fmt_num(sustainability_score)}"],
            ["Risk Level", risk_level],
            ["Efficiency Improvement", _fmt_pct(efficiency_improvement)],
        ],
        colWidths=[10.8 * cm, 5.8 * cm],
    )
    health_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#DBEAFE")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.HexColor("#1E3A8A")),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTNAME", (0, 1), (0, -1), "Helvetica-Bold"),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#CBD5E1")),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#F8FAFC")]),
        ("ALIGN", (1, 1), (1, -1), "RIGHT"),
        ("LEFTPADDING", (0, 0), (-1, -1), 7),
        ("RIGHTPADDING", (0, 0), (-1, -1), 7),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
    ]))
    story.append(health_table)

    story.append(Spacer(1, 0.25 * cm))
    story.append(_build_chart(ctx["chart_values"], ctx["chart_labels"], "Sector Performance Snapshot"))

    story.append(Paragraph("4) Priority Recommendations", section_style))
    for recommendation in _priority_recommendations(ctx["module_label"]):
        story.append(Paragraph(recommendation, bullet_style, bulletText="•"))

    story.append(Paragraph("5) Future Readiness Assessment", section_style))
    story.append(Paragraph(_future_readiness(ctx), body_style))

    story.append(Paragraph("6) Final Conclusion", section_style))
    story.append(Paragraph(_final_conclusion(ctx), body_style))

    document.build(story)
    buffer.seek(0)
    return buffer
