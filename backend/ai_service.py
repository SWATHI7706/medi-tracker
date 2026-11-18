import os
import re
import json
import logging
from datetime import datetime, date, timedelta
from typing import List, Dict, Any, Optional
import requests
from bson import ObjectId
from dotenv import load_dotenv

logger = logging.getLogger("medi_tracker.ai")

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
load_dotenv(os.path.join(BASE_DIR, ".env"))
load_dotenv(os.path.join(BASE_DIR, "..", ".env"))

def get_gemini_api_key() -> str:
    key = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY") or ""
    if not key:
        load_dotenv(os.path.join(BASE_DIR, ".env"))
        load_dotenv(os.path.join(BASE_DIR, "..", ".env"))
        key = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY") or ""
    return key.strip()

async def assemble_patient_context(db, user_id: str) -> Dict[str, Any]:
    """
    Gathers all patient records (profile, vitals, allergies, conditions,
    prescriptions, today's intake logs, and doctor notes) to provide rich clinical context.
    """
    today_str = date.today().isoformat()

    if not user_id or user_id == "guest":
        return {
            "full_name": "Guest Visitor",
            "age": None,
            "gender": "Unspecified",
            "blood_group": "Unspecified",
            "bmi": "Unknown",
            "allergies": [],
            "conditions": [],
            "medicines": [],
            "schedule": [],
            "low_stock_meds": [],
            "doctor_notes": [],
            "adherence_rate": 0,
            "today_str": today_str
        }

    # 1. Profile & Vitals
    profile_doc = await db.patient_profiles.find_one({"owner_id": user_id})
    user_doc = await db.users.find_one({"_id": ObjectId(user_id)}) if ObjectId.is_valid(user_id) else None

    personal_info = (profile_doc.get("personal_info") if profile_doc else {}) or {}
    full_name = personal_info.get("full_name") or (user_doc.get("full_name") if user_doc else "Patient")
    age = personal_info.get("age")
    gender = personal_info.get("gender") or "Unspecified"
    blood_group = personal_info.get("blood_group") or "Unspecified"
    height_cm = personal_info.get("height_cm")
    weight_kg = personal_info.get("weight_kg")
    
    bmi_str = "Unknown"
    if height_cm and weight_kg and height_cm > 0 and weight_kg > 0:
        h_m = height_cm / 100.0
        bmi_val = round(weight_kg / (h_m * h_m), 1)
        category = "Normal"
        if bmi_val < 18.5:
            category = "Underweight"
        elif bmi_val >= 25 and bmi_val < 30:
            category = "Overweight"
        elif bmi_val >= 30:
            category = "Obese"
        bmi_str = f"{bmi_val} ({category})"

    allergies = (profile_doc.get("allergies") if profile_doc else []) or []
    conditions = (profile_doc.get("health_conditions") if profile_doc else []) or []
    doctor_notes = (profile_doc.get("doctor_notes") if profile_doc else []) or []

    # 2. Medicines
    med_cursor = db.medicines.find({"owner_id": user_id})
    medicines = [m async for m in med_cursor]

    # 3. Today's Logs
    logs_cursor = db.intake_logs.find({"owner_id": user_id, "date": today_str})
    today_logs = [l async for l in logs_cursor]
    log_map = {f"{l.get('medicine_id')}_{l.get('time', '').strip()}": l.get("status") for l in today_logs}

    # 4. Schedule Breakdown
    schedule_breakdown = []
    low_stock_meds = []
    for med in medicines:
        m_id = str(med.get("_id", med.get("id", "")))
        m_name = med.get("name", "Unnamed")
        dosage = med.get("dosage", "")
        category = med.get("category", "After Food")
        stock = med.get("total_stock", 30)
        threshold = med.get("refill_threshold", 5)
        unit = med.get("dose_unit", "pills")
        times = med.get("times", [])

        if stock <= threshold:
            low_stock_meds.append(f"{m_name} ({stock} {unit} left, threshold: {threshold})")

        for t in times:
            clean_time = t.strip()
            status = log_map.get(f"{m_id}_{clean_time}", "pending")
            schedule_breakdown.append({
                "medicine_id": m_id,
                "medicine_name": m_name,
                "dosage": dosage,
                "category": category,
                "time": clean_time,
                "status": status,
                "stock": stock,
                "unit": unit
            })

    # Sort schedule by time
    schedule_breakdown.sort(key=lambda x: x["time"])

    # 5. Adherence stats
    summary_pipeline = [
        {"$match": {"owner_id": user_id}},
        {"$group": {"_id": "$status", "count": {"$sum": 1}}},
    ]
    counts = {doc["_id"]: doc["count"] async for doc in db.intake_logs.aggregate(summary_pipeline)}
    taken_cnt = counts.get("taken", 0)
    missed_cnt = counts.get("missed", 0)
    total_decided = taken_cnt + missed_cnt
    adherence_rate = round((taken_cnt / total_decided) * 100) if total_decided > 0 else 0

    return {
        "full_name": full_name,
        "age": age,
        "gender": gender,
        "blood_group": blood_group,
        "bmi": bmi_str,
        "allergies": allergies,
        "conditions": conditions,
        "medicines": medicines,
        "schedule": schedule_breakdown,
        "low_stock_meds": low_stock_meds,
        "doctor_notes": doctor_notes,
        "adherence_rate": adherence_rate,
        "today_str": today_str
    }

def construct_system_prompt(ctx: Dict[str, Any]) -> str:
    """
    Builds a comprehensive system instruction with real-time patient context.
    """
    meds_desc = []
    for m in ctx["medicines"]:
        meds_desc.append(
            f"- {m.get('name')} ({m.get('dosage')}): scheduled at {', '.join(m.get('times', []))}; "
            f"instructions: {m.get('category', 'After Food')}; stock remaining: {m.get('total_stock', 30)} {m.get('dose_unit', 'pills')}"
        )
    meds_text = "\n".join(meds_desc) if meds_desc else "No active prescriptions."

    sched_desc = []
    for s in ctx["schedule"]:
        status_icon = "✅ TAKEN" if s["status"] == "taken" else ("❌ MISSED" if s["status"] == "missed" else "⏳ PENDING")
        sched_desc.append(f"- {s['time']}: {s['medicine_name']} ({s['dosage']}) [{s['category']}] -> Status: {status_icon}")
    sched_text = "\n".join(sched_desc) if sched_desc else "No scheduled doses for today."

    conds_desc = [f"- {c.get('condition_name')} (Diagnosed: {c.get('diagnosed_date', 'N/A')}, Severity: {c.get('severity', 'Moderate')})" for c in ctx["conditions"]]
    conds_text = "\n".join(conds_desc) if conds_desc else "No chronic conditions logged."

    allergies_text = ", ".join(ctx["allergies"]) if ctx["allergies"] else "No known drug/food allergies logged."

    notes_desc = [f"- Dr. {n.get('doctor_name')} ({n.get('specialty')} on {n.get('visit_date')}): \"{n.get('advice_text')}\"" for n in ctx["doctor_notes"][:3]]
    notes_text = "\n".join(notes_desc) if notes_desc else "No recent physician notes."

    return f"""You are MediBot, an empathetic, intelligent, and highly capable clinical medication adherence assistant for the Medi Tracker health platform.

You are assisting patient {ctx['full_name']}. Today's date is {ctx['today_str']}.

PATIENT CLINICAL PROFILE:
- Patient Name: {ctx['full_name']}
- Age: {ctx['age'] or 'Not specified'} | Gender: {ctx['gender']} | Blood Group: {ctx['blood_group']}
- BMI: {ctx['bmi']}
- Critical Allergies: {allergies_text}
- Chronic Health Conditions:
{conds_text}

ACTIVE PRESCRIPTION REGIMENS:
{meds_text}

TODAY'S SCHEDULE & INTAKE STATUS:
{sched_text}

RECENT PHYSICIAN CONSULTATION ADVICE:
{notes_text}

OVERALL ADHERENCE SCORE: {ctx['adherence_rate']}%

LOW STOCK WARNINGS:
{', '.join(ctx['low_stock_meds']) if ctx['low_stock_meds'] else 'All medications currently have sufficient stock.'}

BEHAVIORAL AND CLINICAL GUIDELINES:
1. PRECISION CONTEXT AWARENESS: Answer questions based strictly on the patient's actual prescriptions, allergies, conditions, and today's schedule above.
2. ALLERGY & CONTRAINDICATION SAFETY: If the user asks about taking a new drug or supplement (e.g. Aspirin, Ibuprofen, St. John's Wort, decongestants), immediately check against their recorded allergies ({allergies_text}) and their existing medications for interactions. Highlight severe risks clearly.
3. INTAKE INSTRUCTIONS: Clearly communicate food requirements (Before Food, After Food, With Water) and the scheduled time for each medicine.
4. ACTION PROPOSALS: If the user asks to mark a dose as taken (e.g., "I just took my 08:00 Metformin", "log my blood pressure pill"), or refill a medicine, include an action tag at the very end of your response in this exact format:
   [ACTION:{{"type":"log_dose","medicine_name":"<exact_medicine_name>","time":"<HH:MM>","status":"taken"}}]
   or for refills:
   [ACTION:{{"type":"refill","medicine_name":"<exact_medicine_name>","amount":30}}]
   (Only include the action tag if the user explicitly indicated they took a dose or want to refill).
5. EMERGENCY TRIAGE: If the user describes emergency symptoms (e.g. sudden severe crushing chest pain, difficulty breathing, facial swelling, severe bleeding), urge them to immediately call emergency services (911 or local emergency number).
6. TONE: Warm, professional, supportive, and concise. Use clear formatting (markdown bullets and bolding). End with an encouraging note.
"""

def heuristic_chat_fallback(query: str, ctx: Dict[str, Any]) -> Dict[str, Any]:
    """
    Intelligent heuristic fallback engine that answers patient queries
    when GEMINI_API_KEY is not configured or during offline mode.
    """
    q = query.lower()
    full_name = ctx["full_name"]
    schedule = ctx["schedule"]
    medicines = ctx["medicines"]
    allergies = ctx["allergies"]
    action = None

    # Check for direct dose logging request (e.g. "i took my ...", "mark ... as taken")
    if "took" in q or "mark" in q and ("taken" in q or "done" in q):
        for s in schedule:
            if s["medicine_name"].lower() in q or (len(schedule) == 1):
                action = {
                    "type": "log_dose",
                    "medicine_id": s["medicine_id"],
                    "medicine_name": s["medicine_name"],
                    "time": s["time"],
                    "status": "taken",
                    "description": f"Log {s['medicine_name']} ({s['time']}) as Taken"
                }
                reply = (
                    f"Great job staying on top of your health, **{full_name}**! 🎉\n\n"
                    f"I've prepared an action to record your **{s['medicine_name']}** ({s['dosage']}) scheduled for **{s['time']}** as **Taken**.\n\n"
                    f"Click the confirmation button below to update your schedule and inventory."
                )
                return {"reply": reply, "action": action, "powered_by": "clinical-heuristic"}

    # Schedule / Doses remaining inquiry
    if any(k in q for k in ["schedule", "today", "left", "remaining", "pending", "next dose", "what do i take"]):
        pending = [s for s in schedule if s["status"] == "pending"]
        taken = [s for s in schedule if s["status"] == "taken"]
        missed = [s for s in schedule if s["status"] == "missed"]

        lines = [f"Here is your daily medication status for today, **{full_name}**:"]
        if pending:
            lines.append(f"\n⏳ **Pending Doses ({len(pending)} left):**")
            for p in pending:
                lines.append(f"- **{p['time']}** — {p['medicine_name']} ({p['dosage']}) • *{p['category']}*")
        else:
            lines.append("\n🎉 **All scheduled doses for today have been completed or reviewed!**")

        if taken:
            lines.append(f"\n✅ **Taken ({len(taken)}):**")
            for t in taken:
                lines.append(f"- **{t['time']}** — {t['medicine_name']} ({t['dosage']})")

        if missed:
            lines.append(f"\n❌ **Missed ({len(missed)}):**")
            for m in missed:
                lines.append(f"- **{m['time']}** — {m['medicine_name']} ({m['dosage']})")

        reply = "\n".join(lines)
        return {"reply": reply, "action": None, "powered_by": "clinical-heuristic"}

    # Allergy / Contraindication inquiry
    if any(k in q for k in ["allergy", "allergies", "allergic", "reaction"]):
        if allergies:
            lines = [f"⚠️ **Recorded Critical Allergies for {full_name}:**"]
            for a in allergies:
                lines.append(f"- **{a}**")
            lines.append("\n*Always notify your doctor and pharmacist of these allergies before starting any new medication or over-the-counter supplement.*")
            reply = "\n".join(lines)
        else:
            reply = f"You currently do not have any drug or food allergies logged in your profile, **{full_name}**. If you have known allergies, you can log them in the **My Health Profile** tab."
        return {"reply": reply, "action": None, "powered_by": "clinical-heuristic"}

    # Interaction inquiry (e.g. "interaction", "can i take", "aspirin", "ibuprofen")
    if any(k in q for k in ["interaction", "interactions", "can i take", "safe to take", "conflict"]):
        active_names = [m.get("name") for m in medicines]
        reply = (
            f"🔍 **Clinical Interaction Review for {full_name}:**\n\n"
            f"Your active prescriptions: **{', '.join(active_names) if active_names else 'None'}**.\n"
            f"Your recorded allergies: **{', '.join(allergies) if allergies else 'None recorded'}**.\n\n"
            f"**Important Safety Principles:**\n"
            f"• Avoid combining NSAIDs (like Ibuprofen, Naproxen, or Aspirin) without physician approval if you take blood pressure medications or blood thinners.\n"
            f"• Take oral medications with a full glass of water, and adhere to your **Before Food** or **After Food** schedule to maximize absorption.\n"
            f"• Please consult your prescribing doctor or pharmacist before introducing any new prescription, OTC drug, or herbal supplement."
        )
        return {"reply": reply, "action": None, "powered_by": "clinical-heuristic"}

    # Streak & adherence inquiry
    if any(k in q for k in ["streak", "adherence", "progress", "score", "rate"]):
        rate = ctx["adherence_rate"]
        reply = (
            f"📊 **Adherence Velocity for {full_name}:**\n\n"
            f"• **Overall Adherence Rate:** **{rate}%**\n"
            f"• Keep taking your scheduled doses consistently to maintain a high streak and support your long-term health outcomes!\n\n"
            f"You can review your detailed 7-day adherence charts in the **Analytics Dashboard** on the home screen."
        )
        return {"reply": reply, "action": None, "powered_by": "clinical-heuristic"}

    # Stock & Refill inquiry
    if any(k in q for k in ["stock", "refill", "supply", "low", "pills left"]):
        low_stock = ctx["low_stock_meds"]
        if low_stock:
            lines = [f"⚠️ **Low Stock Alert for {full_name}:**"]
            for ls in low_stock:
                lines.append(f"- {ls}")
            lines.append("\nYou can quickly refill your supply by clicking **+Refill** on your medication cards on the Dashboard.")
            reply = "\n".join(lines)
        else:
            lines = [f"📦 **Inventory Healthy for {full_name}:**\nAll your medications currently have plenty of stock:"]
            for m in medicines:
                lines.append(f"- **{m.get('name')}**: {m.get('total_stock', 30)} {m.get('dose_unit', 'pills')} remaining")
            reply = "\n".join(lines)
        return {"reply": reply, "action": None, "powered_by": "clinical-heuristic"}

    # Default friendly greeting / guidance
    active_count = len(medicines)
    reply = (
        f"Hello **{full_name}**! 👋 I am **MediBot**, your clinical medication assistant.\n\n"
        f"I have direct access to your **{active_count} active prescription{'s' if active_count != 1 else ''}**, "
        f"today's schedule, and health profile.\n\n"
        f"**Here are a few things you can ask me:**\n"
        f"• *\"What medicines do I have left today?\"*\n"
        f"• *\"Are there any food interactions with my medications?\"*\n"
        f"• *\"Check for allergy conflicts with my prescriptions\"*\n"
        f"• *\"Log that I took my morning medicine\"*\n"
        f"• *\"How is my adherence streak this week?\"*\n\n"
        f"*(💡 Note: You are currently running in intelligent clinical assistant mode. Add your `GEMINI_API_KEY` in `backend/.env` to unlock open-ended conversational intelligence with Google Gemini!)*"
    )
    return {"reply": reply, "action": None, "powered_by": "clinical-heuristic"}

def parse_action_from_text(text: str, ctx: Dict[str, Any]) -> tuple[str, Optional[Dict[str, Any]]]:
    """
    Extracts [ACTION:{...}] tags from model output and returns clean text and structured action.
    """
    pattern = r"\[ACTION:\s*(\{.*?\})\s*\]"
    match = re.search(pattern, text)
    if not match:
        return text.strip(), None

    action_json_str = match.group(1)
    clean_text = re.sub(pattern, "", text).strip()

    try:
        raw_action = json.loads(action_json_str)
        action_type = raw_action.get("type")
        med_name = raw_action.get("medicine_name", "")

        # Find matching medicine in patient profile
        target_med = None
        for m in ctx["medicines"]:
            if m.get("name", "").lower() == med_name.lower():
                target_med = m
                break

        if not target_med and ctx["medicines"]:
            # Fuzzy match
            for m in ctx["medicines"]:
                if med_name.lower() in m.get("name", "").lower() or m.get("name", "").lower() in med_name.lower():
                    target_med = m
                    break

        med_id = str(target_med.get("_id", target_med.get("id", ""))) if target_med else None

        if action_type == "log_dose":
            return clean_text, {
                "type": "log_dose",
                "medicine_id": med_id,
                "medicine_name": target_med.get("name", med_name) if target_med else med_name,
                "time": raw_action.get("time", "08:00"),
                "status": raw_action.get("status", "taken"),
                "description": f"Log {target_med.get('name', med_name) if target_med else med_name} as {raw_action.get('status', 'taken').capitalize()}"
            }
        elif action_type == "refill":
            return clean_text, {
                "type": "refill",
                "medicine_id": med_id,
                "medicine_name": target_med.get("name", med_name) if target_med else med_name,
                "amount": raw_action.get("amount", 30),
                "description": f"Refill {target_med.get('name', med_name) if target_med else med_name} (+{raw_action.get('amount', 30)})"
            }
    except Exception as e:
        logger.warning(f"Failed to parse action JSON '{action_json_str}': {e}")

    return clean_text, None

async def generate_chat_response(
    db,
    user_id: str,
    messages: List[Dict[str, str]],
    patient_id: Optional[str] = None
) -> Dict[str, Any]:
    """
    Main entry point for generating chat responses with Google Gemini API,
    with automatic fallback to clinical heuristic mode.
    """
    target_user_id = patient_id or user_id
    ctx = await assemble_patient_context(db, target_user_id)
    api_key = get_gemini_api_key()

    latest_user_message = ""
    for m in reversed(messages):
        if m.get("role") == "user":
            latest_user_message = m.get("content", "").strip()
            break

    # Suggested Prompts for user convenience
    suggested_prompts = [
        "What medicines do I have left today?",
        "Are there any food interactions with my medications?",
        "Check for allergy conflicts with my prescriptions",
        "How is my adherence streak this week?",
    ]

    # If no Gemini API key is provided, use the high-quality clinical heuristic responder
    if not api_key:
        fallback = heuristic_chat_fallback(latest_user_message, ctx)
        return {
            "reply": fallback["reply"],
            "action": fallback.get("action"),
            "suggested_prompts": suggested_prompts,
            "powered_by": fallback.get("powered_by", "clinical-heuristic")
        }

    # Format Gemini contents array
    system_instruction = construct_system_prompt(ctx)
    gemini_contents = []

    for msg in messages:
        role = "user" if msg.get("role") == "user" else "model"
        text = msg.get("content", "")
        if text.strip():
            gemini_contents.append({
                "role": role,
                "parts": [{"text": text}]
            })

    # Prepare Gemini REST call
    # We attempt gemini-2.5-flash first, then fallback to gemini-1.5-flash
    models_to_try = ["gemini-2.5-flash", "gemini-1.5-flash"]
    last_error = None

    for model_name in models_to_try:
        endpoint = f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:generateContent?key={api_key}"
        req_body = {
            "system_instruction": {
                "parts": [{"text": system_instruction}]
            },
            "contents": gemini_contents,
            "generationConfig": {
                "temperature": 0.3,
                "maxOutputTokens": 1000,
            }
        }

        try:
            resp = requests.post(endpoint, json=req_body, timeout=15)
            if resp.status_code == 200:
                data = resp.json()
                candidates = data.get("candidates", [])
                if candidates:
                    parts = candidates[0].get("content", {}).get("parts", [])
                    reply_text = "".join(p.get("text", "") for p in parts)
                    clean_reply, action = parse_action_from_text(reply_text, ctx)
                    return {
                        "reply": clean_reply,
                        "action": action,
                        "suggested_prompts": suggested_prompts,
                        "powered_by": model_name
                    }
            else:
                last_error = f"Gemini API returned status {resp.status_code}: {resp.text}"
                logger.warning(f"Error calling {model_name}: {last_error}")
        except Exception as e:
            last_error = str(e)
            logger.warning(f"Exception calling {model_name}: {last_error}")

    # If Gemini call failed (e.g. invalid key or network issue), use heuristic fallback
    logger.error(f"Gemini API calls failed ({last_error}). Falling back to heuristic responder.")
    fallback = heuristic_chat_fallback(latest_user_message, ctx)
    fallback_reply = fallback["reply"] + f"\n\n*(Note: Live Gemini API request encountered an issue ({last_error}). Using clinical offline mode.)*"
    return {
        "reply": fallback_reply,
        "action": fallback.get("action"),
        "suggested_prompts": suggested_prompts,
        "powered_by": "clinical-heuristic"
    }
