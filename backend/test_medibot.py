import asyncio
import os
import sys

# Ensure current dir is in sys.path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from ai_service import heuristic_chat_fallback, parse_action_from_text

def test_heuristic_and_actions():
    print("--- Testing MediBot Heuristic & Action Parser ---")

    mock_ctx = {
        "full_name": "Sarah Connor",
        "age": 35,
        "gender": "Female",
        "blood_group": "A+",
        "bmi": "22.1 (Normal)",
        "allergies": ["Penicillin", "Sulfa Drugs"],
        "conditions": [{"condition_name": "Asthma", "diagnosed_date": "2023-01-01", "severity": "Mild"}],
        "medicines": [
            {
                "_id": "64b0f1a23c4d5e6f7a8b9c0d",
                "name": "Metformin",
                "dosage": "500mg",
                "category": "After Food",
                "times": ["08:00", "20:00"],
                "total_stock": 25,
                "refill_threshold": 5,
                "dose_unit": "pills",
            },
            {
                "_id": "64b0f1a23c4d5e6f7a8b9c0e",
                "name": "Albuterol Inhaler",
                "dosage": "90mcg",
                "category": "With Water",
                "times": ["09:00"],
                "total_stock": 4,
                "refill_threshold": 5,
                "dose_unit": "puffs",
            }
        ],
        "schedule": [
            {
                "medicine_id": "64b0f1a23c4d5e6f7a8b9c0d",
                "medicine_name": "Metformin",
                "dosage": "500mg",
                "category": "After Food",
                "time": "08:00",
                "status": "pending",
                "stock": 25,
                "unit": "pills"
            },
            {
                "medicine_id": "64b0f1a23c4d5e6f7a8b9c0e",
                "medicine_name": "Albuterol Inhaler",
                "dosage": "90mcg",
                "category": "With Water",
                "time": "09:00",
                "status": "taken",
                "stock": 4,
                "unit": "puffs"
            }
        ],
        "low_stock_meds": ["Albuterol Inhaler (4 puffs left, threshold: 5)"],
        "doctor_notes": [],
        "adherence_rate": 88,
        "today_str": "2026-11-18"
    }

    # 1. Test schedule query
    res_sched = heuristic_chat_fallback("What medicines do I have left today?", mock_ctx)
    assert "Pending Doses" in res_sched["reply"]
    assert "Metformin" in res_sched["reply"]
    print("✓ Schedule query passed")

    # 2. Test allergy query
    res_allergy = heuristic_chat_fallback("What are my recorded allergies?", mock_ctx)
    assert "Penicillin" in res_allergy["reply"]
    assert "Sulfa Drugs" in res_allergy["reply"]
    print("✓ Allergy query passed")

    # 3. Test dose logging intent
    res_log = heuristic_chat_fallback("I just took my Metformin dose", mock_ctx)
    assert res_log["action"] is not None
    assert res_log["action"]["type"] == "log_dose"
    assert res_log["action"]["medicine_name"] == "Metformin"
    assert res_log["action"]["time"] == "08:00"
    print("✓ Heuristic action detection passed")

    # 4. Test action parser from LLM tag
    model_output = (
        "I have confirmed your dose intake! Stay well!\n"
        "[ACTION:{\"type\":\"log_dose\",\"medicine_name\":\"Metformin\",\"time\":\"08:00\",\"status\":\"taken\"}]"
    )
    clean_text, parsed_action = parse_action_from_text(model_output, mock_ctx)
    assert "[ACTION" not in clean_text
    assert parsed_action["type"] == "log_dose"
    assert parsed_action["medicine_name"] == "Metformin"
    assert parsed_action["medicine_id"] == "64b0f1a23c4d5e6f7a8b9c0d"
    print("✓ LLM action tag parser passed")

    # 5. Test refill action parser
    refill_output = (
        "I'll help you refill your inhaler.\n"
        "[ACTION:{\"type\":\"refill\",\"medicine_name\":\"Albuterol Inhaler\",\"amount\":30}]"
    )
    clean_text, parsed_refill = parse_action_from_text(refill_output, mock_ctx)
    assert parsed_refill["type"] == "refill"
    assert parsed_refill["amount"] == 30
    assert parsed_refill["medicine_id"] == "64b0f1a23c4d5e6f7a8b9c0e"
    print("✓ LLM refill action tag parser passed")

    print("\nALL MEDIBOT AI UNIT TESTS PASSED SUCCESSFULLY! 🚀")

if __name__ == "__main__":
    test_heuristic_and_actions()
