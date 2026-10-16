import React, { useState, useEffect, useMemo, useCallback } from "react";
import axios from "axios";
import {
    UserCircle,
    Activity,
    AlertTriangle,
    Plus,
    Trash2,
    Edit3,
    Save,
    X,
    Calendar,
    Clock,
    Stethoscope,
    ShieldAlert,
    CheckCircle2,
    Droplet,
    Ruler,
    Scale,
    Phone,
    Shield,
    User,
    Sparkles,
    RefreshCw,
    Tag,
    ChevronDown,
    HeartPulse,
    Users,
} from "lucide-react";
import { API_BASE_URL } from "../api";

const API = API_BASE_URL;

const PRESET_CONDITIONS = [
    "Hypertension",
    "Type 2 Diabetes",
    "Asthma",
    "Hypothyroidism",
    "High Cholesterol",
    "Arthritis",
    "Migraine",
    "GERD",
    "Allergic Rhinitis",
    "Chronic Kidney Disease",
];

const PRESET_ALLERGIES = [
    "Penicillin",
    "Sulfa Drugs",
    "Aspirin / NSAIDs",
    "Peanuts",
    "Shellfish",
    "Latex",
    "Iodine Contrast",
    "Tree Nuts",
    "Eggs",
    "Milk / Lactose",
];

const PRESET_SPECIALTIES = [
    "General Physician",
    "Cardiology",
    "Endocrinology",
    "Pulmonology",
    "Dermatology",
    "Neurology",
    "Gastroenterology",
    "Orthopedics",
    "Nephrology",
];

const PRESET_NOTE_TAGS = [
    "Diet",
    "Exercise",
    "Medication",
    "Lab Test",
    "BP Check",
    "Blood Sugar",
    "Follow-up",
    "Lifestyle",
];

export default function PatientProfile({ currentUser, onProfileUpdated }) {
    const [profile, setProfile] = useState(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState(null);
    const [successMessage, setSuccessMessage] = useState("");

    // Caregiver Delegation: Linked patients
    const [familyData, setFamilyData] = useState({ caregivers: [], patients: [] });
    const [selectedPatientId, setSelectedPatientId] = useState(null);

    // Section 1: Demographics & Vitals Edit State
    const [isEditingInfo, setIsEditingInfo] = useState(false);
    const [infoForm, setInfoForm] = useState({
        full_name: "",
        age: "",
        gender: "",
        blood_group: "",
        emergency_contact: "",
        height_cm: "",
        weight_kg: "",
    });

    // Section 2: Chronic Conditions Form State
    const [showAddCondition, setShowAddCondition] = useState(false);
    const [conditionForm, setConditionForm] = useState({
        condition_name: "",
        diagnosed_date: new Date().toISOString().split("T")[0],
        severity: "Moderate",
        status: "active",
    });

    // Section 3: Allergies State
    const [newAllergyInput, setNewAllergyInput] = useState("");

    // Section 4: Doctor Notes Form State
    const [showAddNote, setShowAddNote] = useState(false);
    const [noteForm, setNoteForm] = useState({
        doctor_name: "",
        specialty: "General Physician",
        visit_date: new Date().toISOString().split("T")[0],
        advice_text: "",
        tags: ["Medication"],
    });
    const [customTagInput, setCustomTagInput] = useState("");

    // Fetch Family Links to see if this user is a caregiver for any patients
    useEffect(() => {
        const fetchFamily = async () => {
            try {
                const res = await axios.get(`${API}/family/members`);
                if (res.data) {
                    setFamilyData(res.data);
                }
            } catch (err) {
                // Ignore family members failure if not configured
            }
        };
        fetchFamily();
    }, []);

    // Load Patient Profile
    const fetchProfile = useCallback(async (targetPatientId = null) => {
        setLoading(true);
        setError(null);
        try {
            const url = targetPatientId
                ? `${API}/profile?patient_id=${targetPatientId}`
                : `${API}/profile`;
            const res = await axios.get(url);
            const data = res.data;
            setProfile(data);

            const pInfo = data.personal_info || {};
            setInfoForm({
                full_name: pInfo.full_name || currentUser?.full_name || "",
                age: pInfo.age !== null && pInfo.age !== undefined ? pInfo.age : "",
                gender: pInfo.gender || "",
                blood_group: pInfo.blood_group || "",
                emergency_contact: pInfo.emergency_contact || "",
                height_cm: pInfo.height_cm !== null && pInfo.height_cm !== undefined ? pInfo.height_cm : "",
                weight_kg: pInfo.weight_kg !== null && pInfo.weight_kg !== undefined ? pInfo.weight_kg : "",
            });
        } catch (err) {
            console.error("Failed to load patient profile", err);
            setError(err.response?.data?.detail || "Failed to load patient health profile.");
        } finally {
            setLoading(false);
        }
    }, [currentUser]);

    useEffect(() => {
        fetchProfile(selectedPatientId);
    }, [fetchProfile, selectedPatientId]);

    const canEdit = profile?.can_edit !== false;
    const isCaregiver = profile?.is_caregiver === true;

    // Auto-dismiss success notification
    useEffect(() => {
        if (successMessage) {
            const timer = setTimeout(() => setSuccessMessage(""), 3500);
            return () => clearTimeout(timer);
        }
    }, [successMessage]);

    // Derived BMI Metric Calculation
    const bmiData = useMemo(() => {
        const h = parseFloat(profile?.personal_info?.height_cm);
        const w = parseFloat(profile?.personal_info?.weight_kg);
        if (!h || !w || h <= 0 || w <= 0) return null;

        const hMeters = h / 100;
        const bmi = +(w / (hMeters * hMeters)).toFixed(1);

        let category = "Normal";
        let colorClass = "text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 border-emerald-200 dark:border-emerald-800";
        if (bmi < 18.5) {
            category = "Underweight";
            colorClass = "text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/60 border-amber-200 dark:border-amber-800";
        } else if (bmi >= 25 && bmi < 30) {
            category = "Overweight";
            colorClass = "text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/60 border-amber-200 dark:border-amber-800";
        } else if (bmi >= 30) {
            category = "Obese";
            colorClass = "text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/60 border-rose-200 dark:border-rose-800";
        }

        return { bmi, category, colorClass };
    }, [profile?.personal_info?.height_cm, profile?.personal_info?.weight_kg]);

    // --- 1. SAVE DEMOGRAPHICS & VITALS ---
    const handleSaveInfo = async (e) => {
        e?.preventDefault();
        if (!canEdit) return;

        setSaving(true);
        const prevProfile = { ...profile };

        const updatedPersonalInfo = {
            full_name: infoForm.full_name.trim(),
            age: infoForm.age === "" ? null : parseInt(infoForm.age, 10),
            gender: infoForm.gender,
            blood_group: infoForm.blood_group,
            emergency_contact: infoForm.emergency_contact.trim(),
            height_cm: infoForm.height_cm === "" ? null : parseFloat(infoForm.height_cm),
            weight_kg: infoForm.weight_kg === "" ? null : parseFloat(infoForm.weight_kg),
        };

        // Optimistic UI update
        setProfile((prev) => ({
            ...prev,
            personal_info: updatedPersonalInfo,
            updated_at: new Date().toISOString(),
        }));
        setIsEditingInfo(false);

        try {
            const queryParam = selectedPatientId ? `?patient_id=${selectedPatientId}` : "";
            const res = await axios.put(`${API}/profile${queryParam}`, {
                personal_info: updatedPersonalInfo,
                allergies: profile.allergies,
            });
            setProfile(res.data);
            setSuccessMessage("Health profile vitals updated successfully!");
            if (onProfileUpdated) onProfileUpdated(res.data);
        } catch (err) {
            console.error("Failed to update profile", err);
            setProfile(prevProfile);
            setError(err.response?.data?.detail || "Failed to update profile metrics.");
        } finally {
            setSaving(false);
        }
    };

    // --- 2. ADD & REMOVE CHRONIC CONDITIONS ---
    const handleAddCondition = async (e) => {
        e?.preventDefault();
        if (!canEdit || !conditionForm.condition_name.trim()) return;

        const tempId = `temp_${Date.now()}`;
        const newCondition = {
            id: tempId,
            condition_name: conditionForm.condition_name.trim(),
            diagnosed_date: conditionForm.diagnosed_date || new Date().toISOString().split("T")[0],
            severity: conditionForm.severity,
            status: conditionForm.status,
        };

        // Optimistic UI update
        setProfile((prev) => ({
            ...prev,
            health_conditions: [...(prev.health_conditions || []), newCondition],
            updated_at: new Date().toISOString(),
        }));
        setConditionForm({
            condition_name: "",
            diagnosed_date: new Date().toISOString().split("T")[0],
            severity: "Moderate",
            status: "active",
        });
        setShowAddCondition(false);

        try {
            const queryParam = selectedPatientId ? `?patient_id=${selectedPatientId}` : "";
            const res = await axios.post(`${API}/profile/conditions${queryParam}`, {
                condition_name: newCondition.condition_name,
                diagnosed_date: newCondition.diagnosed_date,
                severity: newCondition.severity,
                status: newCondition.status,
            });
            // Replace temp id with real id
            setProfile((prev) => ({
                ...prev,
                health_conditions: prev.health_conditions.map((c) =>
                    c.id === tempId ? res.data : c
                ),
            }));
            setSuccessMessage(`Condition "${newCondition.condition_name}" added.`);
        } catch (err) {
            console.error("Failed to add condition", err);
            // Revert
            setProfile((prev) => ({
                ...prev,
                health_conditions: prev.health_conditions.filter((c) => c.id !== tempId),
            }));
            setError(err.response?.data?.detail || "Failed to add condition.");
        }
    };

    const handleDeleteCondition = async (condId, condName) => {
        if (!canEdit) return;
        if (!window.confirm(`Remove "${condName}" from conditions?`)) return;

        const backupConditions = profile.health_conditions;
        setProfile((prev) => ({
            ...prev,
            health_conditions: prev.health_conditions.filter((c) => c.id !== condId),
            updated_at: new Date().toISOString(),
        }));

        try {
            const queryParam = selectedPatientId ? `?patient_id=${selectedPatientId}` : "";
            await axios.delete(`${API}/profile/conditions/${condId}${queryParam}`);
            setSuccessMessage(`Condition "${condName}" removed.`);
        } catch (err) {
            console.error("Failed to delete condition", err);
            setProfile((prev) => ({ ...prev, health_conditions: backupConditions }));
            setError(err.response?.data?.detail || "Failed to remove condition.");
        }
    };

    // --- 3. ALLERGIES MANAGER ---
    const handleAddAllergy = async (allergyName) => {
        if (!canEdit) return;
        const clean = allergyName.trim();
        if (!clean) return;

        const currentAllergies = profile.allergies || [];
        if (currentAllergies.some((a) => a.toLowerCase() === clean.toLowerCase())) {
            setNewAllergyInput("");
            return;
        }

        const nextAllergies = [...currentAllergies, clean];
        const backupAllergies = currentAllergies;

        // Optimistic UI update
        setProfile((prev) => ({
            ...prev,
            allergies: nextAllergies,
            updated_at: new Date().toISOString(),
        }));
        setNewAllergyInput("");

        try {
            const queryParam = selectedPatientId ? `?patient_id=${selectedPatientId}` : "";
            await axios.put(`${API}/profile${queryParam}`, {
                personal_info: profile.personal_info,
                allergies: nextAllergies,
            });
            setSuccessMessage(`Allergy "${clean}" logged to health profile.`);
        } catch (err) {
            console.error("Failed to update allergies", err);
            setProfile((prev) => ({ ...prev, allergies: backupAllergies }));
            setError(err.response?.data?.detail || "Failed to update allergies.");
        }
    };

    const handleRemoveAllergy = async (allergyName) => {
        if (!canEdit) return;
        const backupAllergies = profile.allergies;
        const nextAllergies = (profile.allergies || []).filter((a) => a !== allergyName);

        // Optimistic UI update
        setProfile((prev) => ({
            ...prev,
            allergies: nextAllergies,
            updated_at: new Date().toISOString(),
        }));

        try {
            const queryParam = selectedPatientId ? `?patient_id=${selectedPatientId}` : "";
            await axios.put(`${API}/profile${queryParam}`, {
                personal_info: profile.personal_info,
                allergies: nextAllergies,
            });
            setSuccessMessage(`Allergy "${allergyName}" removed.`);
        } catch (err) {
            console.error("Failed to remove allergy", err);
            setProfile((prev) => ({ ...prev, allergies: backupAllergies }));
            setError(err.response?.data?.detail || "Failed to remove allergy.");
        }
    };

    // --- 4. DOCTOR NOTES & CLINICAL ADVICE ---
    const handleAddNote = async (e) => {
        e?.preventDefault();
        if (!canEdit || !noteForm.doctor_name.trim() || !noteForm.advice_text.trim()) return;

        const tempId = `temp_${Date.now()}`;
        const newNote = {
            id: tempId,
            doctor_name: noteForm.doctor_name.trim(),
            specialty: noteForm.specialty || "General Physician",
            visit_date: noteForm.visit_date || new Date().toISOString().split("T")[0],
            advice_text: noteForm.advice_text.trim(),
            tags: noteForm.tags || [],
            created_at: new Date().toISOString(),
        };

        // Optimistic UI update (insert at top)
        setProfile((prev) => ({
            ...prev,
            doctor_notes: [newNote, ...(prev.doctor_notes || [])],
            updated_at: new Date().toISOString(),
        }));
        setNoteForm({
            doctor_name: "",
            specialty: "General Physician",
            visit_date: new Date().toISOString().split("T")[0],
            advice_text: "",
            tags: ["Medication"],
        });
        setShowAddNote(false);

        try {
            const queryParam = selectedPatientId ? `?patient_id=${selectedPatientId}` : "";
            const res = await axios.post(`${API}/profile/doctor-notes${queryParam}`, {
                doctor_name: newNote.doctor_name,
                specialty: newNote.specialty,
                visit_date: newNote.visit_date,
                advice_text: newNote.advice_text,
                tags: newNote.tags,
            });
            // Update temp id with real server id
            setProfile((prev) => ({
                ...prev,
                doctor_notes: prev.doctor_notes.map((n) => (n.id === tempId ? res.data : n)),
            }));
            setSuccessMessage(`Doctor note from ${newNote.doctor_name} added.`);
        } catch (err) {
            console.error("Failed to add doctor note", err);
            // Revert
            setProfile((prev) => ({
                ...prev,
                doctor_notes: prev.doctor_notes.filter((n) => n.id !== tempId),
            }));
            setError(err.response?.data?.detail || "Failed to save doctor consultation advice.");
        }
    };

    const handleDeleteNote = async (noteId, doctorName) => {
        if (!canEdit) return;
        if (!window.confirm(`Delete clinical note from ${doctorName}?`)) return;

        const backupNotes = profile.doctor_notes;
        setProfile((prev) => ({
            ...prev,
            doctor_notes: prev.doctor_notes.filter((n) => n.id !== noteId),
            updated_at: new Date().toISOString(),
        }));

        try {
            const queryParam = selectedPatientId ? `?patient_id=${selectedPatientId}` : "";
            await axios.delete(`${API}/profile/doctor-notes/${noteId}${queryParam}`);
            setSuccessMessage(`Note from ${doctorName} deleted.`);
        } catch (err) {
            console.error("Failed to delete note", err);
            setProfile((prev) => ({ ...prev, doctor_notes: backupNotes }));
            setError(err.response?.data?.detail || "Failed to delete clinical advice.");
        }
    };

    const toggleNoteTag = (tag) => {
        setNoteForm((prev) => {
            const exists = prev.tags.includes(tag);
            return {
                ...prev,
                tags: exists ? prev.tags.filter((t) => t !== tag) : [...prev.tags, tag],
            };
        });
    };

    const addCustomTag = () => {
        const clean = customTagInput.trim();
        if (!clean) return;
        if (!noteForm.tags.includes(clean)) {
            setNoteForm((prev) => ({ ...prev, tags: [...prev.tags, clean] }));
        }
        setCustomTagInput("");
    };

    if (loading && !profile) {
        return (
            <div className="flex flex-col items-center justify-center py-24 space-y-4">
                <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 flex items-center justify-center animate-spin text-indigo-600 dark:text-indigo-400">
                    <RefreshCw className="w-6 h-6" />
                </div>
                <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
                    Loading Clinical Health Profile...
                </p>
            </div>
        );
    }

    const personal = profile?.personal_info || {};
    const conditions = profile?.health_conditions || [];
    const allergies = profile?.allergies || [];
    const notes = profile?.doctor_notes || [];

    return (
        <div className="space-y-6">
            {/* Feedback Alerts */}
            {successMessage && (
                <div className="bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 px-4 py-3 rounded-2xl flex items-center justify-between text-xs sm:text-sm font-medium shadow-xs animate-in fade-in slide-in-from-top-2">
                    <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                        <span>{successMessage}</span>
                    </div>
                    <button
                        type="button"
                        onClick={() => setSuccessMessage("")}
                        className="text-emerald-600 hover:text-emerald-800 dark:text-emerald-400 dark:hover:text-emerald-200"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>
            )}

            {error && (
                <div className="bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200 px-4 py-3 rounded-2xl flex items-center justify-between text-xs sm:text-sm font-medium shadow-xs">
                    <div className="flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
                        <span>{error}</span>
                    </div>
                    <button
                        type="button"
                        onClick={() => setError(null)}
                        className="text-rose-600 hover:text-rose-800 dark:text-rose-400 dark:hover:text-rose-200"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>
            )}

            {/* Caregiver Delegation Patient Switcher Bar (if user is linked to family patients) */}
            {familyData.patients && familyData.patients.length > 0 && (
                <div className="bg-white dark:bg-slate-900/90 p-4 rounded-2xl border border-indigo-100 dark:border-slate-800 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                            <Users className="w-4 h-4" />
                        </div>
                        <div>
                            <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                                Caregiver Delegation Portal
                            </span>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400">
                                Switch between your profile and authorized family member profiles
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 w-full sm:w-auto">
                        <select
                            value={selectedPatientId || ""}
                            onChange={(e) => setSelectedPatientId(e.target.value || null)}
                            className="w-full sm:w-auto bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-800 dark:text-slate-200 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500/20"
                        >
                            <option value="">My Personal Health Profile</option>
                            {familyData.patients.map((p) => (
                                <option key={p.patient_id} value={p.patient_id}>
                                    {p.full_name || p.email} ({p.relationship || "Patient"})
                                </option>
                            ))}
                        </select>
                    </div>
                </div>
            )}

            {/* Read-Only Notice for Caregivers with View-Only Access */}
            {!canEdit && (
                <div className="bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200 px-4 py-2.5 rounded-2xl flex items-center gap-2.5 text-xs font-medium">
                    <Shield className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                    <span>
                        You have <strong>View-Only Caregiver Access</strong> for this patient profile. Editing and additions are disabled.
                    </span>
                </div>
            )}

            {/* Hub Header Card */}
            <div className="relative overflow-hidden bg-white dark:bg-slate-900/90 rounded-3xl p-6 sm:p-7 border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-4">
                <div className="absolute top-0 right-0 -mr-12 -mt-12 w-48 h-48 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none" />
                <div className="absolute bottom-0 left-0 -ml-12 -mb-12 w-48 h-48 bg-teal-400/10 rounded-full blur-2xl pointer-events-none" />

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
                    <div className="flex items-center gap-4">
                        <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-teal-500 to-indigo-600 text-white flex items-center justify-center text-xl font-black shadow-lg shadow-indigo-500/20 shrink-0">
                            {personal.full_name ? personal.full_name[0].toUpperCase() : <UserCircle className="w-8 h-8" />}
                        </div>
                        <div>
                            <div className="flex items-center gap-2 flex-wrap">
                                <h1 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 dark:text-slate-100">
                                    {personal.full_name || currentUser?.full_name || "Patient Profile"}
                                </h1>
                                {isCaregiver && (
                                    <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-200/70 dark:border-purple-800">
                                        Delegated Patient View
                                    </span>
                                )}
                                {personal.blood_group && (
                                    <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200/70 dark:border-rose-800 inline-flex items-center gap-1">
                                        <Droplet className="w-3 h-3 fill-rose-500 text-rose-500" />
                                        {personal.blood_group}
                                    </span>
                                )}
                            </div>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                Centralized clinical records, vitals, chronic condition tracking, and physician consultation notes.
                            </p>
                        </div>
                    </div>

                    {/* Quick Stats Badges */}
                    <div className="flex items-center gap-2 flex-wrap text-xs">
                        <div className="px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700 flex items-center gap-1.5">
                            <Activity className="w-3.5 h-3.5 text-indigo-500" />
                            <span className="font-semibold text-slate-700 dark:text-slate-200">
                                {conditions.length} Conditions
                            </span>
                        </div>
                        <div className="px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700 flex items-center gap-1.5">
                            <ShieldAlert className="w-3.5 h-3.5 text-rose-500" />
                            <span className="font-semibold text-slate-700 dark:text-slate-200">
                                {allergies.length} Allergies
                            </span>
                        </div>
                        <div className="px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700 flex items-center gap-1.5">
                            <Stethoscope className="w-3.5 h-3.5 text-teal-500" />
                            <span className="font-semibold text-slate-700 dark:text-slate-200">
                                {notes.length} Consultations
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            {/* ======================================================== */}
            {/* SECTION 1: DEMOGRAPHICS & VITALS CARD                    */}
            {/* ======================================================== */}
            <section className="bg-white dark:bg-slate-900/90 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs overflow-hidden">
                <div className="p-5 sm:p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between flex-wrap gap-3">
                    <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold">
                            <HeartPulse className="w-4 h-4" />
                        </div>
                        <div>
                            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                                Demographics & Vitals
                            </h2>
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                                Core physiological measurements and emergency contact
                            </p>
                        </div>
                    </div>

                    {canEdit && (
                        <div>
                            {!isEditingInfo ? (
                                <button
                                    type="button"
                                    onClick={() => setIsEditingInfo(true)}
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 transition shadow-2xs"
                                >
                                    <Edit3 className="w-3.5 h-3.5 text-indigo-500" />
                                    <span>Edit Vitals</span>
                                </button>
                            ) : (
                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setIsEditingInfo(false);
                                            // Revert form to active profile
                                            const pInfo = profile.personal_info || {};
                                            setInfoForm({
                                                full_name: pInfo.full_name || currentUser?.full_name || "",
                                                age: pInfo.age ?? "",
                                                gender: pInfo.gender || "",
                                                blood_group: pInfo.blood_group || "",
                                                emergency_contact: pInfo.emergency_contact || "",
                                                height_cm: pInfo.height_cm ?? "",
                                                weight_kg: pInfo.weight_kg ?? "",
                                            });
                                        }}
                                        className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="button"
                                        onClick={handleSaveInfo}
                                        disabled={saving}
                                        className="flex items-center gap-1.5 px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition shadow-xs disabled:opacity-50"
                                    >
                                        <Save className="w-3.5 h-3.5" />
                                        <span>{saving ? "Saving..." : "Save Vitals"}</span>
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                <div className="p-5 sm:p-6">
                    {isEditingInfo ? (
                        /* Edit Form */
                        <form onSubmit={handleSaveInfo} className="space-y-4">
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                                {/* Full Name */}
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                                        Full Name
                                    </label>
                                    <input
                                        type="text"
                                        value={infoForm.full_name}
                                        onChange={(e) => setInfoForm({ ...infoForm, full_name: e.target.value })}
                                        placeholder="Full Name"
                                        className="w-full border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:bg-white dark:focus:bg-slate-800 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 p-2.5 rounded-xl text-xs sm:text-sm text-slate-900 dark:text-slate-100 outline-none transition"
                                    />
                                </div>

                                {/* Age */}
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                                        Age (years)
                                    </label>
                                    <input
                                        type="number"
                                        min="0"
                                        max="130"
                                        value={infoForm.age}
                                        onChange={(e) => setInfoForm({ ...infoForm, age: e.target.value })}
                                        placeholder="e.g. 42"
                                        className="w-full border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:bg-white dark:focus:bg-slate-800 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 p-2.5 rounded-xl text-xs sm:text-sm text-slate-900 dark:text-slate-100 outline-none transition"
                                    />
                                </div>

                                {/* Gender */}
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                                        Gender
                                    </label>
                                    <select
                                        value={infoForm.gender}
                                        onChange={(e) => setInfoForm({ ...infoForm, gender: e.target.value })}
                                        className="w-full border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:bg-white dark:focus:bg-slate-800 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 p-2.5 rounded-xl text-xs sm:text-sm text-slate-900 dark:text-slate-100 outline-none transition"
                                    >
                                        <option value="">Select Gender</option>
                                        <option value="Male">Male</option>
                                        <option value="Female">Female</option>
                                        <option value="Non-Binary">Non-Binary</option>
                                        <option value="Prefer not to say">Prefer not to say</option>
                                    </select>
                                </div>

                                {/* Blood Group */}
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                                        Blood Group
                                    </label>
                                    <select
                                        value={infoForm.blood_group}
                                        onChange={(e) => setInfoForm({ ...infoForm, blood_group: e.target.value })}
                                        className="w-full border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:bg-white dark:focus:bg-slate-800 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 p-2.5 rounded-xl text-xs sm:text-sm text-slate-900 dark:text-slate-100 outline-none transition"
                                    >
                                        <option value="">Select Blood Group</option>
                                        {["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-", "Unknown"].map((bg) => (
                                            <option key={bg} value={bg}>{bg}</option>
                                        ))}
                                    </select>
                                </div>

                                {/* Height (cm) */}
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                                        Height (cm)
                                    </label>
                                    <input
                                        type="number"
                                        step="0.5"
                                        min="30"
                                        max="260"
                                        value={infoForm.height_cm}
                                        onChange={(e) => setInfoForm({ ...infoForm, height_cm: e.target.value })}
                                        placeholder="e.g. 175"
                                        className="w-full border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:bg-white dark:focus:bg-slate-800 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 p-2.5 rounded-xl text-xs sm:text-sm text-slate-900 dark:text-slate-100 outline-none transition"
                                    />
                                </div>

                                {/* Weight (kg) */}
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                                        Weight (kg)
                                    </label>
                                    <input
                                        type="number"
                                        step="0.1"
                                        min="1"
                                        max="400"
                                        value={infoForm.weight_kg}
                                        onChange={(e) => setInfoForm({ ...infoForm, weight_kg: e.target.value })}
                                        placeholder="e.g. 70"
                                        className="w-full border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:bg-white dark:focus:bg-slate-800 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 p-2.5 rounded-xl text-xs sm:text-sm text-slate-900 dark:text-slate-100 outline-none transition"
                                    />
                                </div>

                                {/* Emergency Contact */}
                                <div className="space-y-1 sm:col-span-2">
                                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                                        Emergency Contact Number
                                    </label>
                                    <input
                                        type="text"
                                        value={infoForm.emergency_contact}
                                        onChange={(e) => setInfoForm({ ...infoForm, emergency_contact: e.target.value })}
                                        placeholder="e.g. +1 (555) 234-5678"
                                        className="w-full border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:bg-white dark:focus:bg-slate-800 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 p-2.5 rounded-xl text-xs sm:text-sm text-slate-900 dark:text-slate-100 outline-none transition"
                                    />
                                </div>
                            </div>

                            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                                <button
                                    type="button"
                                    onClick={() => setIsEditingInfo(false)}
                                    className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={saving}
                                    className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition shadow-xs disabled:opacity-50 flex items-center gap-1.5"
                                >
                                    <Save className="w-3.5 h-3.5" />
                                    <span>{saving ? "Saving..." : "Save Vitals"}</span>
                                </button>
                            </div>
                        </form>
                    ) : (
                        /* Vitals Display Grid */
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 sm:gap-4">
                            {/* Age */}
                            <div className="bg-slate-50/70 dark:bg-slate-800/50 p-3.5 rounded-xl border border-slate-200/60 dark:border-slate-800 space-y-1">
                                <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400 text-xs font-medium">
                                    <Calendar className="w-3.5 h-3.5 text-indigo-500" />
                                    <span>Age</span>
                                </div>
                                <div className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100">
                                    {personal.age ? `${personal.age} yrs` : <span className="text-xs text-slate-400 font-normal">Not specified</span>}
                                </div>
                            </div>

                            {/* Gender */}
                            <div className="bg-slate-50/70 dark:bg-slate-800/50 p-3.5 rounded-xl border border-slate-200/60 dark:border-slate-800 space-y-1">
                                <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400 text-xs font-medium">
                                    <User className="w-3.5 h-3.5 text-teal-500" />
                                    <span>Gender</span>
                                </div>
                                <div className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100">
                                    {personal.gender || <span className="text-xs text-slate-400 font-normal">Not specified</span>}
                                </div>
                            </div>

                            {/* Blood Group */}
                            <div className="bg-slate-50/70 dark:bg-slate-800/50 p-3.5 rounded-xl border border-slate-200/60 dark:border-slate-800 space-y-1">
                                <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400 text-xs font-medium">
                                    <Droplet className="w-3.5 h-3.5 text-rose-500" />
                                    <span>Blood Group</span>
                                </div>
                                <div className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100">
                                    {personal.blood_group ? (
                                        <span className="text-rose-600 dark:text-rose-400 font-black">{personal.blood_group}</span>
                                    ) : (
                                        <span className="text-xs text-slate-400 font-normal">Not specified</span>
                                    )}
                                </div>
                            </div>

                            {/* Height */}
                            <div className="bg-slate-50/70 dark:bg-slate-800/50 p-3.5 rounded-xl border border-slate-200/60 dark:border-slate-800 space-y-1">
                                <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400 text-xs font-medium">
                                    <Ruler className="w-3.5 h-3.5 text-amber-500" />
                                    <span>Height</span>
                                </div>
                                <div className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100">
                                    {personal.height_cm ? `${personal.height_cm} cm` : <span className="text-xs text-slate-400 font-normal">Not specified</span>}
                                </div>
                            </div>

                            {/* Weight */}
                            <div className="bg-slate-50/70 dark:bg-slate-800/50 p-3.5 rounded-xl border border-slate-200/60 dark:border-slate-800 space-y-1">
                                <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400 text-xs font-medium">
                                    <Scale className="w-3.5 h-3.5 text-sky-500" />
                                    <span>Weight</span>
                                </div>
                                <div className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100">
                                    {personal.weight_kg ? `${personal.weight_kg} kg` : <span className="text-xs text-slate-400 font-normal">Not specified</span>}
                                </div>
                            </div>

                            {/* Derived BMI Badge */}
                            <div className="bg-slate-50/70 dark:bg-slate-800/50 p-3.5 rounded-xl border border-slate-200/60 dark:border-slate-800 space-y-1">
                                <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400 text-xs font-medium">
                                    <Activity className="w-3.5 h-3.5 text-emerald-500" />
                                    <span>BMI Index</span>
                                </div>
                                <div className="flex items-center gap-1.5 flex-wrap">
                                    {bmiData ? (
                                        <>
                                            <span className="text-base sm:text-lg font-black text-slate-900 dark:text-slate-100">
                                                {bmiData.bmi}
                                            </span>
                                            <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full border ${bmiData.colorClass}`}>
                                                {bmiData.category}
                                            </span>
                                        </>
                                    ) : (
                                        <span className="text-xs text-slate-400 font-normal">Add H/W</span>
                                    )}
                                </div>
                            </div>

                            {/* Emergency Contact */}
                            <div className="col-span-2 sm:col-span-3 md:col-span-4 lg:col-span-6 bg-slate-50/70 dark:bg-slate-800/50 p-3.5 rounded-xl border border-slate-200/60 dark:border-slate-800 flex items-center justify-between flex-wrap gap-2">
                                <div className="flex items-center gap-2">
                                    <div className="w-7 h-7 rounded-lg bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
                                        <Phone className="w-3.5 h-3.5" />
                                    </div>
                                    <div>
                                        <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                                            Emergency Contact
                                        </span>
                                        <span className="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-200 font-mono">
                                            {personal.emergency_contact || "No emergency contact specified"}
                                        </span>
                                    </div>
                                </div>
                                {personal.emergency_contact && (
                                    <a
                                        href={`tel:${personal.emergency_contact}`}
                                        className="px-3 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold transition shadow-2xs inline-flex items-center gap-1"
                                    >
                                        <Phone className="w-3 h-3" /> Call Contact
                                    </a>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </section>

            {/* ======================================================== */}
            {/* SECTION 2: CHRONIC & ACTIVE CONDITIONS MANAGER           */}
            {/* ======================================================== */}
            <section className="bg-white dark:bg-slate-900/90 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs overflow-hidden">
                <div className="p-5 sm:p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between flex-wrap gap-3">
                    <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl bg-teal-50 dark:bg-teal-950/60 text-teal-600 dark:text-teal-400 flex items-center justify-center font-bold">
                            <Activity className="w-4 h-4" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                                    Chronic & Active Conditions Manager
                                </h2>
                                <span className="text-xs font-extrabold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                                    {conditions.length}
                                </span>
                            </div>
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                                Track diagnosed medical conditions, severity levels, and management statuses
                            </p>
                        </div>
                    </div>

                    {canEdit && (
                        <button
                            type="button"
                            onClick={() => setShowAddCondition(!showAddCondition)}
                            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-gradient-to-r from-teal-600 to-indigo-600 hover:from-teal-700 hover:to-indigo-700 text-white rounded-xl text-xs font-bold transition shadow-xs"
                        >
                            <Plus className="w-3.5 h-3.5" />
                            <span>{showAddCondition ? "Close Form" : "Add Condition"}</span>
                        </button>
                    )}
                </div>

                <div className="p-5 sm:p-6 space-y-4">
                    {/* Add Condition Collapsible Form */}
                    {showAddCondition && canEdit && (
                        <div className="p-4 sm:p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-3.5">
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                                    <Sparkles className="w-3.5 h-3.5 text-teal-500" /> New Diagnosed Condition
                                </span>
                                <span className="text-[11px] text-slate-400">Quick presets available below</span>
                            </div>

                            <form onSubmit={handleAddCondition} className="space-y-3">
                                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                                    {/* Condition Name */}
                                    <input
                                        required
                                        type="text"
                                        value={conditionForm.condition_name}
                                        onChange={(e) => setConditionForm({ ...conditionForm, condition_name: e.target.value })}
                                        placeholder="Condition Name (e.g. Type 2 Diabetes)"
                                        className="border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-2.5 rounded-xl text-xs sm:text-sm text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-teal-500/20"
                                    />

                                    {/* Diagnosed Date */}
                                    <input
                                        type="date"
                                        value={conditionForm.diagnosed_date}
                                        onChange={(e) => setConditionForm({ ...conditionForm, diagnosed_date: e.target.value })}
                                        className="border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-2.5 rounded-xl text-xs sm:text-sm text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-teal-500/20"
                                    />

                                    {/* Severity */}
                                    <select
                                        value={conditionForm.severity}
                                        onChange={(e) => setConditionForm({ ...conditionForm, severity: e.target.value })}
                                        className="border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-2.5 rounded-xl text-xs sm:text-sm text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-teal-500/20"
                                    >
                                        <option value="Mild">Mild</option>
                                        <option value="Moderate">Moderate</option>
                                        <option value="Chronic">Chronic</option>
                                        <option value="Severe">Severe</option>
                                    </select>

                                    {/* Status */}
                                    <select
                                        value={conditionForm.status}
                                        onChange={(e) => setConditionForm({ ...conditionForm, status: e.target.value })}
                                        className="border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-2.5 rounded-xl text-xs sm:text-sm text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-teal-500/20"
                                    >
                                        <option value="active">Active Monitoring</option>
                                        <option value="managed">Clinically Managed</option>
                                    </select>
                                </div>

                                {/* Quick-Add Chips */}
                                <div className="space-y-1.5 pt-1">
                                    <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                                        Quick Add Common Diagnoses:
                                    </span>
                                    <div className="flex flex-wrap gap-1.5">
                                        {PRESET_CONDITIONS.map((cond) => (
                                            <button
                                                key={cond}
                                                type="button"
                                                onClick={() => setConditionForm({ ...conditionForm, condition_name: cond })}
                                                className={`px-2.5 py-1 rounded-lg border text-xs font-medium transition ${
                                                    conditionForm.condition_name === cond
                                                        ? "bg-teal-50 dark:bg-teal-950/60 border-teal-300 dark:border-teal-700 text-teal-700 dark:text-teal-300 font-bold"
                                                        : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-750"
                                                }`}
                                            >
                                                +{cond}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div className="flex justify-end gap-2 pt-2 border-t border-slate-200/60 dark:border-slate-700">
                                    <button
                                        type="button"
                                        onClick={() => setShowAddCondition(false)}
                                        className="px-3.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-white dark:hover:bg-slate-800"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        className="px-4 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold transition shadow-xs flex items-center gap-1.5"
                                    >
                                        <Plus className="w-3.5 h-3.5" /> Save Condition
                                    </button>
                                </div>
                            </form>
                        </div>
                    )}

                    {/* Conditions List */}
                    {conditions.length === 0 ? (
                        <div className="text-center py-8 px-4 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl">
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                                No active or chronic medical conditions registered.
                            </p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                            {conditions.map((cond) => {
                                const isSevere = cond.severity === "Severe" || cond.severity === "Chronic";
                                const isManaged = cond.status === "managed";

                                return (
                                    <div
                                        key={cond.id}
                                        className="p-4 rounded-2xl bg-white dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80 shadow-2xs hover:shadow-xs transition space-y-2.5 relative group"
                                    >
                                        <div className="flex items-start justify-between gap-2">
                                            <div>
                                                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                                                    {cond.condition_name}
                                                </h3>
                                                {cond.diagnosed_date && (
                                                    <span className="text-[11px] text-slate-400 dark:text-slate-500 flex items-center gap-1 mt-0.5">
                                                        <Calendar className="w-3 h-3" /> Diagnosed: {cond.diagnosed_date}
                                                    </span>
                                                )}
                                            </div>

                                            {canEdit && (
                                                <button
                                                    type="button"
                                                    onClick={() => handleDeleteCondition(cond.id, cond.condition_name)}
                                                    className="opacity-60 group-hover:opacity-100 p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/60 transition"
                                                    title="Remove Condition"
                                                >
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                </button>
                                            )}
                                        </div>

                                        <div className="flex items-center gap-2 flex-wrap pt-1">
                                            {/* Severity Badge */}
                                            <span
                                                className={`text-[10px] uppercase tracking-wider font-extrabold px-2.5 py-0.5 rounded-full border ${
                                                    isSevere
                                                        ? "bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800"
                                                        : cond.severity === "Moderate"
                                                        ? "bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800"
                                                        : "bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300 border-teal-200 dark:border-teal-800"
                                                }`}
                                            >
                                                {cond.severity || "Moderate"}
                                            </span>

                                            {/* Status Badge */}
                                            <span
                                                className={`text-[10px] font-bold px-2 py-0.5 rounded-full border inline-flex items-center gap-1 ${
                                                    isManaged
                                                        ? "bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800"
                                                        : "bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800"
                                                }`}
                                            >
                                                <span
                                                    className={`w-1.5 h-1.5 rounded-full ${
                                                        isManaged ? "bg-emerald-500" : "bg-indigo-500 animate-pulse"
                                                    }`}
                                                />
                                                {isManaged ? "Managed" : "Active"}
                                            </span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </section>

            {/* ======================================================== */}
            {/* SECTION 3: ALLERGIES BANNER                              */}
            {/* ======================================================== */}
            <section className="bg-gradient-to-r from-rose-50/70 via-amber-50/50 to-rose-50/70 dark:from-rose-950/40 dark:via-amber-950/30 dark:to-rose-950/40 rounded-2xl border border-rose-200/80 dark:border-rose-800/80 p-5 sm:p-6 shadow-xs space-y-4">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-xl bg-rose-600 text-white flex items-center justify-center font-bold shadow-md shadow-rose-500/20 shrink-0">
                            <ShieldAlert className="w-5 h-5" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h2 className="text-base font-black text-rose-950 dark:text-rose-100 tracking-tight">
                                    Substance & Medication Allergies
                                </h2>
                                <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-rose-200/60 dark:bg-rose-900/60 text-rose-900 dark:text-rose-200 border border-rose-300 dark:border-rose-800">
                                    High Priority Safety
                                </span>
                            </div>
                            <p className="text-xs text-rose-700/80 dark:text-rose-300/80">
                                Immediate warning chips for adverse drug reactions and critical food allergies
                            </p>
                        </div>
                    </div>
                </div>

                {/* Display Allergy Chips */}
                <div className="flex flex-wrap items-center gap-2">
                    {allergies.length === 0 ? (
                        <div className="bg-white/80 dark:bg-slate-900/80 px-4 py-2 rounded-xl text-xs font-semibold text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-900">
                            No known drug or substance allergies recorded.
                        </div>
                    ) : (
                        allergies.map((allergy) => (
                            <div
                                key={allergy}
                                className="inline-flex items-center gap-2 bg-rose-100 dark:bg-rose-900/60 text-rose-900 dark:text-rose-100 border border-rose-300 dark:border-rose-700 px-3.5 py-1.5 rounded-xl text-xs font-bold shadow-xs animate-in zoom-in-95"
                            >
                                <AlertTriangle className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400 shrink-0" />
                                <span>{allergy}</span>
                                {canEdit && (
                                    <button
                                        type="button"
                                        onClick={() => handleRemoveAllergy(allergy)}
                                        className="text-rose-500 hover:text-rose-800 dark:text-rose-300 dark:hover:text-rose-100 p-0.5 rounded-full hover:bg-rose-200 dark:hover:bg-rose-800 transition"
                                        title={`Remove ${allergy}`}
                                    >
                                        <X className="w-3 h-3" />
                                    </button>
                                )}
                            </div>
                        ))
                    )}
                </div>

                {/* Add Custom & Preset Allergies (when editable) */}
                {canEdit && (
                    <div className="pt-3 border-t border-rose-200/60 dark:border-rose-900/60 space-y-3">
                        <div className="flex flex-col sm:flex-row gap-2 max-w-md">
                            <input
                                type="text"
                                value={newAllergyInput}
                                onChange={(e) => setNewAllergyInput(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                        e.preventDefault();
                                        handleAddAllergy(newAllergyInput);
                                    }
                                }}
                                placeholder="Add drug or food allergy (e.g. Penicillin)..."
                                className="flex-1 border border-rose-200 dark:border-rose-800 bg-white/90 dark:bg-slate-900/90 focus:ring-2 focus:ring-rose-500/20 px-3 py-1.5 rounded-xl text-xs sm:text-sm text-slate-900 dark:text-slate-100 placeholder:text-rose-300 dark:placeholder:text-rose-700 outline-none"
                            />
                            <button
                                type="button"
                                onClick={() => handleAddAllergy(newAllergyInput)}
                                className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-xs transition flex items-center justify-center gap-1"
                            >
                                <Plus className="w-3.5 h-3.5" />
                                <span>Add Allergy</span>
                            </button>
                        </div>

                        {/* Presets */}
                        <div className="flex flex-wrap items-center gap-1.5">
                            <span className="text-[11px] font-bold text-rose-800/70 dark:text-rose-300/70">
                                Common Allergen Presets:
                            </span>
                            {PRESET_ALLERGIES.map((preset) => {
                                const isAdded = allergies.includes(preset);
                                return (
                                    <button
                                        key={preset}
                                        type="button"
                                        disabled={isAdded}
                                        onClick={() => handleAddAllergy(preset)}
                                        className={`px-2.5 py-0.5 rounded-lg text-xs font-medium transition ${
                                            isAdded
                                                ? "bg-rose-200/50 dark:bg-rose-900/40 text-rose-400 dark:text-rose-500 border border-transparent cursor-not-allowed line-through"
                                                : "bg-white/80 dark:bg-slate-900/80 hover:bg-rose-100 dark:hover:bg-rose-900/60 text-rose-800 dark:text-rose-200 border border-rose-200 dark:border-rose-800"
                                        }`}
                                    >
                                        +{preset}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                )}
            </section>

            {/* ======================================================== */}
            {/* SECTION 4: DOCTOR VISITS & PRESCRIBED ADVICE LOG         */}
            {/* ======================================================== */}
            <section className="bg-white dark:bg-slate-900/90 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs overflow-hidden">
                <div className="p-5 sm:p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between flex-wrap gap-3">
                    <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold">
                            <Stethoscope className="w-4 h-4" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                                    Doctor Consultations & Prescribed Advice Log
                                </h2>
                                <span className="text-xs font-extrabold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                                    {notes.length}
                                </span>
                            </div>
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                                Clinical advice, lifestyle guidelines, and instructions received during physician visits
                            </p>
                        </div>
                    </div>

                    {canEdit && (
                        <button
                            type="button"
                            onClick={() => setShowAddNote(!showAddNote)}
                            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white rounded-xl text-xs font-bold transition shadow-xs"
                        >
                            <Plus className="w-3.5 h-3.5" />
                            <span>{showAddNote ? "Close Form" : "Add Consultation Advice"}</span>
                        </button>
                    )}
                </div>

                <div className="p-5 sm:p-6 space-y-5">
                    {/* Add Doctor Note Collapsible Form */}
                    {showAddNote && canEdit && (
                        <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-4">
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                                    <Stethoscope className="w-3.5 h-3.5 text-indigo-500" /> Record Doctor Advice
                                </span>
                                <span className="text-[11px] text-slate-400">Clinical notes are archived securely</span>
                            </div>

                            <form onSubmit={handleAddNote} className="space-y-3.5">
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                    {/* Doctor Name */}
                                    <div className="space-y-1">
                                        <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                                            Doctor's Name
                                        </label>
                                        <input
                                            required
                                            type="text"
                                            value={noteForm.doctor_name}
                                            onChange={(e) => setNoteForm({ ...noteForm, doctor_name: e.target.value })}
                                            placeholder="e.g. Dr. Sarah Jenkins"
                                            className="w-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-2.5 rounded-xl text-xs sm:text-sm text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-indigo-500/20"
                                        />
                                    </div>

                                    {/* Specialty */}
                                    <div className="space-y-1">
                                        <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                                            Clinic / Specialty
                                        </label>
                                        <select
                                            value={noteForm.specialty}
                                            onChange={(e) => setNoteForm({ ...noteForm, specialty: e.target.value })}
                                            className="w-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-2.5 rounded-xl text-xs sm:text-sm text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-indigo-500/20"
                                        >
                                            {PRESET_SPECIALTIES.map((spec) => (
                                                <option key={spec} value={spec}>{spec}</option>
                                            ))}
                                        </select>
                                    </div>

                                    {/* Visit Date */}
                                    <div className="space-y-1">
                                        <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                                            Visit Date
                                        </label>
                                        <input
                                            type="date"
                                            value={noteForm.visit_date}
                                            onChange={(e) => setNoteForm({ ...noteForm, visit_date: e.target.value })}
                                            className="w-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-2.5 rounded-xl text-xs sm:text-sm text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-indigo-500/20"
                                        />
                                    </div>
                                </div>

                                {/* Clinical Advice Text */}
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                                        Doctor's Direct Advice & Instructions
                                    </label>
                                    <textarea
                                        required
                                        rows={3}
                                        value={noteForm.advice_text}
                                        onChange={(e) => setNoteForm({ ...noteForm, advice_text: e.target.value })}
                                        placeholder="Specific instructions, lifestyle alterations, follow-up tests, dosage updates..."
                                        className="w-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-2.5 rounded-xl text-xs sm:text-sm text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-indigo-500/20 resize-y"
                                    />
                                </div>

                                {/* Advice Tags */}
                                <div className="space-y-1.5">
                                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                                        Topics & Category Tags:
                                    </span>
                                    <div className="flex flex-wrap items-center gap-1.5">
                                        {PRESET_NOTE_TAGS.map((tag) => {
                                            const isSelected = noteForm.tags.includes(tag);
                                            return (
                                                <button
                                                    key={tag}
                                                    type="button"
                                                    onClick={() => toggleNoteTag(tag)}
                                                    className={`px-2.5 py-1 rounded-lg text-xs font-medium transition ${
                                                        isSelected
                                                            ? "bg-indigo-600 text-white font-bold"
                                                            : "bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-100"
                                                    }`}
                                                >
                                                    {tag}
                                                </button>
                                            );
                                        })}
                                    </div>

                                    {/* Custom Tag Input */}
                                    <div className="flex items-center gap-1.5 pt-1">
                                        <input
                                            type="text"
                                            value={customTagInput}
                                            onChange={(e) => setCustomTagInput(e.target.value)}
                                            onKeyDown={(e) => {
                                                if (e.key === "Enter") {
                                                    e.preventDefault();
                                                    addCustomTag();
                                                }
                                            }}
                                            placeholder="Add custom tag..."
                                            className="border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1 rounded-lg text-xs text-slate-800 dark:text-slate-200 outline-none"
                                        />
                                        <button
                                            type="button"
                                            onClick={addCustomTag}
                                            className="px-2.5 py-1 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-lg text-xs font-bold"
                                        >
                                            +Tag
                                        </button>
                                    </div>
                                </div>

                                <div className="flex justify-end gap-2 pt-2 border-t border-slate-200/60 dark:border-slate-700">
                                    <button
                                        type="button"
                                        onClick={() => setShowAddNote(false)}
                                        className="px-3.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-white dark:hover:bg-slate-800"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition shadow-xs flex items-center gap-1.5"
                                    >
                                        <Save className="w-3.5 h-3.5" /> Save Consultation Note
                                    </button>
                                </div>
                            </form>
                        </div>
                    )}

                    {/* Prescribed Advice Feed */}
                    {notes.length === 0 ? (
                        <div className="text-center py-10 px-4 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl space-y-2">
                            <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mx-auto">
                                <Stethoscope className="w-5 h-5" />
                            </div>
                            <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">
                                No Physician Advice Logged Yet
                            </h4>
                            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
                                Archive clinical recommendations, consultation summaries, and diet instructions from your doctors.
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {notes.map((note) => (
                                <div
                                    key={note.id}
                                    className="p-5 rounded-2xl bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-700/80 shadow-2xs hover:shadow-xs transition space-y-3 relative group"
                                >
                                    {/* Note Header */}
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-teal-500 to-indigo-600 text-white flex items-center justify-center shrink-0 font-bold shadow-xs">
                                                <Stethoscope className="w-5 h-5" />
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <h3 className="text-sm font-extrabold text-slate-900 dark:text-slate-100">
                                                        {note.doctor_name}
                                                    </h3>
                                                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200/70 dark:border-indigo-800">
                                                        {note.specialty || "General Physician"}
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-2 text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">
                                                    <Calendar className="w-3 h-3" />
                                                    <span>Visit Date: {note.visit_date}</span>
                                                </div>
                                            </div>
                                        </div>

                                        {canEdit && (
                                            <button
                                                type="button"
                                                onClick={() => handleDeleteNote(note.id, note.doctor_name)}
                                                className="opacity-60 group-hover:opacity-100 self-end sm:self-center p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/60 transition"
                                                title="Delete Clinical Advice"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        )}
                                    </div>

                                    {/* Prescription Card Style Advice Body */}
                                    <div className="bg-white dark:bg-slate-900/90 p-4 rounded-xl border border-slate-200/80 dark:border-slate-800 text-xs sm:text-sm text-slate-800 dark:text-slate-200 leading-relaxed font-sans shadow-2xs">
                                        <p className="whitespace-pre-line">{note.advice_text}</p>
                                    </div>

                                    {/* Tags */}
                                    {note.tags && note.tags.length > 0 && (
                                        <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                                            {note.tags.map((tag) => (
                                                <span
                                                    key={tag}
                                                    className="inline-flex items-center gap-1 text-[10px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 px-2.5 py-0.5 rounded-md"
                                                >
                                                    <Tag className="w-2.5 h-2.5" />
                                                    {tag}
                                                </span>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </section>
        </div>
    );
}
