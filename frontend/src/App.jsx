import React, { useState, useEffect, useMemo, useCallback } from "react";
import axios from "axios";
import confetti from "canvas-confetti";
import {
    Pill,
    Plus,
    Flame,
    Sparkles,
    CheckCircle2,
    XCircle,
    Clock,
    Calendar,
    RefreshCw,
    Activity,
    AlertCircle,
    History,
    Boxes,
    Tag,
    LogOut,
    LogIn,
    User,
    UserCircle,
    Shield,
    ArrowRight,
    TrendingUp,
    Sun,
    Moon,
} from "lucide-react";
import MedicineList from "./components/MedicineList";
import AnalyticsDashboard from "./components/AnalyticsDashboard";
import EditModal from "./components/EditModal";
import HistoryModal from "./components/HistoryModal";
import HealthTips from "./components/HealthTips";
import AuthModal from "./components/AuthModal";
import PatientProfile from "./components/PatientProfile";
import { API_BASE_URL } from "./api";

const API = API_BASE_URL;

// Lightweight browser Web Audio API chime
const playDoseChime = () => {
    try {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (!AudioContextClass) return;
        const ctx = new AudioContextClass();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
        osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.15); // A5
        gain.gain.setValueAtTime(0.15, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.25);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.25);
    } catch (e) {
        console.warn("Audio chime failed to play", e);
    }
};

export default function App() {
    const [theme, setTheme] = useState(() => {
        return localStorage.getItem("theme") || "light";
    });

    const [user, setUser] = useState(null);
    const [authLoading, setAuthLoading] = useState(true);
    const [authModalOpen, setAuthModalOpen] = useState(false);
    const [authModalMode, setAuthModalMode] = useState("login");
    const [activeTab, setActiveTab] = useState("tracker");

    const [medicines, setMedicines] = useState([]);
    const [logs, setLogs] = useState({});
    const [editingMed, setEditingMed] = useState(null);
    const [showHistory, setShowHistory] = useState(false);
    const [refreshTrigger, setRefreshTrigger] = useState(0);
    const [refreshing, setRefreshing] = useState(false);
    const [streak, setStreak] = useState(0);
    const [currentTime, setCurrentTime] = useState(new Date());

    const [form, setForm] = useState({
        name: "",
        dosage: "",
        times: "",
        category: "After Food",
    });

    // Theme synchronization
    useEffect(() => {
        if (theme === "dark") {
            document.documentElement.classList.add("dark");
        } else {
            document.documentElement.classList.remove("dark");
        }
        localStorage.setItem("theme", theme);
    }, [theme]);

    const toggleTheme = () => {
        setTheme((prev) => (prev === "dark" ? "light" : "dark"));
    };

    // Dynamic live ticking clock & date
    useEffect(() => {
        const timer = setInterval(() => {
            setCurrentTime(new Date());
        }, 1000);
        return () => clearInterval(timer);
    }, []);

    // Strict scoped fetch for medicines, today's logs, and streak
    const fetchData = useCallback(async () => {
        const token = localStorage.getItem("authToken");
        if (!token) {
            setMedicines([]);
            setLogs({});
            setStreak(0);
            return;
        }

        try {
            const [medsRes, logsRes] = await Promise.all([
                axios.get(`${API}/medicines`),
                axios.get(`${API}/logs/today`),
            ]);

            setMedicines(medsRes.data || []);

            const logMap = {};
            if (Array.isArray(logsRes.data)) {
                logsRes.data.forEach((l) => {
                    const cleanTime = (l.time || "").trim();
                    logMap[`${l.medicine_id}_${cleanTime}`] = l.status;
                });
            }
            setLogs(logMap);

            try {
                const streakRes = await axios.get(`${API}/analytics/streak`);
                setStreak(streakRes.data?.streak || 0);
            } catch {
                // Fallback gracefully if streak endpoint is pending
            }
        } catch (err) {
            console.error("Failed to load tracker data", err);
            if (err.response?.status === 401) {
                localStorage.removeItem("authToken");
                setUser(null);
            }
        }
    }, []);

    // Check existing auth session on mount
    useEffect(() => {
        const initAuth = async () => {
            const token = localStorage.getItem("authToken");
            if (!token) {
                setAuthLoading(false);
                return;
            }

            try {
                const res = await axios.get(`${API}/auth/me`);
                setUser(res.data);
                await fetchData();
            } catch (err) {
                console.warn("Session expired or invalid", err);
                localStorage.removeItem("authToken");
                setUser(null);
            } finally {
                setAuthLoading(false);
            }
        };

        initAuth();
    }, [fetchData]);

    const handleAuthSuccess = async (token, loggedInUser) => {
        if (token) {
            localStorage.setItem("authToken", token);
        }
        setUser(loggedInUser);
        setAuthModalOpen(false);
        await fetchData();
        setRefreshTrigger((prev) => prev + 1);
    };

    const handleSignOut = () => {
        localStorage.removeItem("authToken");
        setUser(null);
        setActiveTab("tracker");
        setMedicines([]);
        setLogs({});
        setStreak(0);
        setRefreshTrigger((prev) => prev + 1);
    };

    const triggerAllRefresh = async () => {
        setRefreshing(true);
        await fetchData();
        setRefreshTrigger((prev) => prev + 1);
        setTimeout(() => setRefreshing(false), 400);
    };

    // Calculate real-time KPIs
    const kpis = useMemo(() => {
        let totalScheduled = 0;
        let takenCount = 0;
        let missedCount = 0;

        medicines.forEach((med) => {
            const times = med.times || [];
            totalScheduled += times.length;
            times.forEach((t) => {
                const status = logs[`${med.id}_${t}`];
                if (status === "taken") takenCount++;
                else if (status === "missed") missedCount++;
            });
        });

        const progressPct =
            totalScheduled > 0 ? Math.round((takenCount / totalScheduled) * 100) : 0;
        const pendingCount = Math.max(0, totalScheduled - takenCount - missedCount);
        const lowStockCount = medicines.filter(
            (m) => (m.total_stock ?? 30) <= (m.refill_threshold ?? 5)
        ).length;

        return {
            totalScheduled,
            takenCount,
            missedCount,
            pendingCount,
            progressPct,
            activeCount: medicines.length,
            lowStockCount,
        };
    }, [medicines, logs]);

    // Optimistic status update with zero UI latency, audio chime, and confetti on taken
    const handleStatus = async (medicineId, time, status) => {
        const cleanTime = time.trim();
        const key = `${medicineId}_${cleanTime}`;
        const previousStatus = logs[key];
        const nextStatus = previousStatus === status ? "pending" : status;

        // Trigger audio feedback and confetti when marking dose as taken
        if (nextStatus === "taken") {
            playDoseChime();
            try {
                confetti({
                    particleCount: 50,
                    spread: 60,
                    origin: { y: 0.7 },
                    colors: ["#10B981", "#14B8A6", "#6366F1", "#3B82F6"],
                });
            } catch (e) {
                console.warn("Confetti error", e);
            }
        }

        // Optimistically update logs immediately
        setLogs((prev) => {
            const next = { ...prev };
            if (nextStatus === "pending") {
                delete next[key];
            } else {
                next[key] = nextStatus;
            }
            return next;
        });

        // Optimistically update stock count if transitioning to/from taken
        setMedicines((prevMeds) =>
            prevMeds.map((med) => {
                if (med.id === medicineId) {
                    let stockDelta = 0;
                    if (previousStatus !== "taken" && nextStatus === "taken") {
                        stockDelta = -1;
                    } else if (previousStatus === "taken" && nextStatus !== "taken") {
                        stockDelta = 1;
                    }
                    const currStock = med.total_stock ?? 30;
                    return {
                        ...med,
                        total_stock: Math.max(0, currStock + stockDelta),
                    };
                }
                return med;
            })
        );

        // Instantly notify analytics
        setRefreshTrigger((prev) => prev + 1);

        try {
            const today = new Date().toISOString().split("T")[0];
            await axios.post(`${API}/logs`, {
                medicine_id: medicineId,
                date: today,
                time: cleanTime,
                status: nextStatus,
            });

            // Update streak in background
            try {
                const streakRes = await axios.get(`${API}/analytics/streak`);
                setStreak(streakRes.data?.streak || 0);
            } catch {}
        } catch (err) {
            console.error("Status update failed on server", err);
            // Revert state on failure
            fetchData();
        }
    };

    // Optimistic Add Medicine
    const handleAdd = async (e) => {
        e.preventDefault();
        const timeSlots = form.times
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean);

        if (!form.name.trim() || !form.dosage.trim()) return;

        if (timeSlots.length === 0) {
            alert("Please provide at least one scheduled time (e.g. 08:00)");
            return;
        }

        const tempId = "temp_" + Date.now();
        const newMed = {
            id: tempId,
            name: form.name.trim(),
            dosage: form.dosage.trim(),
            category: form.category || "After Food",
            times: timeSlots,
            total_stock: 30,
            refill_threshold: 5,
            dose_unit: "pills",
        };

        // Optimistically add to UI
        setMedicines((prev) => [...prev, newMed]);
        setForm({ name: "", dosage: "", times: "", category: "After Food" });

        try {
            const res = await axios.post(`${API}/medicines`, {
                name: newMed.name,
                dosage: newMed.dosage,
                category: newMed.category,
                times: newMed.times,
                total_stock: newMed.total_stock,
                refill_threshold: newMed.refill_threshold,
                dose_unit: newMed.dose_unit,
            });

            setMedicines((prev) =>
                prev.map((item) => (item.id === tempId ? res.data : item))
            );
            setRefreshTrigger((prev) => prev + 1);
        } catch (err) {
            console.error("Failed to add medicine", err);
            setMedicines((prev) => prev.filter((item) => item.id !== tempId));
            alert("Failed to add prescription. Please check backend connection.");
        }
    };

    // Optimistic Delete Medicine
    const handleDelete = async (id) => {
        if (!window.confirm("Are you sure you want to delete this prescription?")) return;
        const backup = medicines;
        setMedicines((prev) => prev.filter((med) => med.id !== id));

        try {
            await axios.delete(`${API}/medicines/${id}`);
            setRefreshTrigger((prev) => prev + 1);
        } catch (err) {
            console.error("Failed to delete medicine", err);
            setMedicines(backup);
            alert("Failed to delete prescription from server.");
        }
    };

    // Quick Refill Stock
    const handleRefill = async (id, amount) => {
        setMedicines((prev) =>
            prev.map((m) =>
                m.id === id ? { ...m, total_stock: (m.total_stock || 0) + amount } : m
            )
        );

        try {
            const res = await axios.post(`${API}/medicines/${id}/refill`, {
                refill_amount: amount,
            });
            setMedicines((prev) => prev.map((m) => (m.id === id ? res.data : m)));
            setRefreshTrigger((prev) => prev + 1);
        } catch (err) {
            console.error("Refill error", err);
            fetchData();
        }
    };

    const formattedDate = currentTime.toLocaleDateString(undefined, {
        weekday: "short",
        month: "short",
        day: "numeric",
        year: "numeric",
    });

    const formattedTime = currentTime.toLocaleTimeString(undefined, {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
    });

    return (
        <div className="min-h-screen bg-slate-50/70 dark:bg-slate-950 text-slate-800 dark:text-slate-100 antialiased selection:bg-indigo-500 selection:text-white pb-16 transition-colors duration-200">
            {/* Sticky Navigation / Header */}
            <header className="sticky top-0 z-40 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800 shadow-xs transition-colors duration-200">
                <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3.5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                    {/* Brand & Subtitle */}
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-teal-500 to-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-500/20 shrink-0">
                            <Pill className="w-5 h-5" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
                                    Medi Tracker
                                </h1>
                                <span className="text-[10px] uppercase font-extrabold px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200/70 dark:border-indigo-800">
                                    Health Tech
                                </span>
                            </div>
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                                Precision medication adherence & smart inventory
                            </p>
                        </div>
                    </div>

                    {/* Navigation Tabs (when authenticated) */}
                    {user && (
                        <nav className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-800/80 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 self-center sm:self-auto">
                            <button
                                type="button"
                                onClick={() => setActiveTab("tracker")}
                                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs transition-all ${
                                    activeTab === "tracker"
                                        ? "bg-white dark:bg-slate-700 text-indigo-700 dark:text-indigo-300 font-bold shadow-xs"
                                        : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 font-medium"
                                }`}
                            >
                                <Pill className="w-3.5 h-3.5 text-indigo-500" />
                                <span>Dashboard</span>
                            </button>

                            <button
                                type="button"
                                onClick={() => setActiveTab("profile")}
                                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs transition-all ${
                                    activeTab === "profile"
                                        ? "bg-white dark:bg-slate-700 text-indigo-700 dark:text-indigo-300 font-bold shadow-xs"
                                        : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 font-medium"
                                }`}
                            >
                                <UserCircle className="w-4 h-4 text-teal-500" />
                                <span>My Health Profile</span>
                            </button>
                        </nav>
                    )}

                    {/* Dynamic Live Time, Streak Counter, User Profile, Theme Toggle, & Action buttons */}
                    <div className="flex items-center gap-2.5 flex-wrap self-stretch sm:self-auto justify-between sm:justify-end">
                        {/* Live Clock & Calendar */}
                        <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700 rounded-xl text-xs text-slate-600 dark:text-slate-300 font-medium">
                            <Calendar className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                            <span>{formattedDate}</span>
                            <span className="text-slate-300 dark:text-slate-600">•</span>
                            <Clock className="w-3.5 h-3.5 text-teal-500 shrink-0" />
                            <span className="font-mono font-semibold text-slate-700 dark:text-slate-200">
                                {formattedTime}
                            </span>
                        </div>

                        {/* Theme Toggle Button */}
                        <button
                            type="button"
                            onClick={toggleTheme}
                            className="p-2 rounded-xl border border-slate-200/80 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-750 text-slate-600 dark:text-slate-300 shadow-xs transition-colors"
                            title={`Switch to ${theme === "dark" ? "Light" : "Dark"} Mode`}
                        >
                            {theme === "dark" ? (
                                <Sun className="w-4 h-4 text-amber-400" />
                            ) : (
                                <Moon className="w-4 h-4 text-slate-600" />
                            )}
                        </button>

                        {user ? (
                            <>
                                {/* Streak Badge with Animated Flame */}
                                <div className="flex items-center gap-1.5 bg-amber-50 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 border border-amber-200/80 dark:border-amber-800/60 px-3.5 py-1.5 rounded-xl text-xs font-bold shadow-xs">
                                    <Flame className="w-4 h-4 fill-amber-500 text-amber-500 animate-pulse-flame shrink-0" />
                                    <span>
                                        {streak > 0 ? `${streak} Day Streak` : "Daily Tracker Active"}
                                    </span>
                                </div>

                                {/* History Modal Trigger */}
                                <button
                                    type="button"
                                    onClick={() => setShowHistory(true)}
                                    className="flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-750 border border-slate-200/80 dark:border-slate-750 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 shadow-xs transition-colors"
                                    title="Medication History Log"
                                >
                                    <History className="w-3.5 h-3.5 text-indigo-500" />
                                    <span className="hidden sm:inline">History</span>
                                </button>

                                {/* Logged-in User Profile Badge */}
                                <button
                                    type="button"
                                    onClick={() => setActiveTab("profile")}
                                    className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs transition-colors cursor-pointer ${
                                        activeTab === "profile"
                                            ? "bg-indigo-600 text-white font-bold"
                                            : "bg-indigo-50/80 dark:bg-indigo-950/60 border border-indigo-200/70 dark:border-indigo-800/70 hover:bg-indigo-100 dark:hover:bg-indigo-900/60"
                                    }`}
                                    title="View My Health Profile"
                                >
                                    <div className={`w-5 h-5 rounded-full flex items-center justify-center font-bold text-[10px] ${
                                        activeTab === "profile" ? "bg-white text-indigo-700" : "bg-indigo-600 text-white"
                                    }`}>
                                        {user.full_name ? user.full_name[0].toUpperCase() : "U"}
                                    </div>
                                    <span className={`font-semibold max-w-[120px] truncate hidden md:inline ${
                                        activeTab === "profile" ? "text-white" : "text-indigo-900 dark:text-indigo-200"
                                    }`}>
                                        {user.full_name || user.email}
                                    </span>
                                </button>

                                {/* Sign Out Button */}
                                <button
                                    type="button"
                                    onClick={handleSignOut}
                                    className="flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-slate-800 hover:bg-rose-50 dark:hover:bg-rose-950/60 border border-slate-200/80 dark:border-slate-750 hover:border-rose-200 dark:hover:border-rose-800 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-rose-600 dark:hover:text-rose-400 shadow-xs transition-colors"
                                    title="Sign Out"
                                >
                                    <LogOut className="w-3.5 h-3.5" />
                                    <span className="hidden sm:inline">Sign Out</span>
                                </button>

                                {/* Refresh button */}
                                <button
                                    type="button"
                                    onClick={triggerAllRefresh}
                                    className="p-2 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-750 border border-slate-200/80 dark:border-slate-750 rounded-xl text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 shadow-xs transition-all"
                                    title="Refresh Data"
                                >
                                    <RefreshCw
                                        className={`w-3.5 h-3.5 ${
                                            refreshing ? "animate-spin text-indigo-600" : ""
                                        }`}
                                    />
                                </button>
                            </>
                        ) : (
                            <>
                                {/* Auth Buttons for Unauthenticated State */}
                                <button
                                    type="button"
                                    onClick={() => {
                                        setAuthModalMode("login");
                                        setAuthModalOpen(true);
                                    }}
                                    className="flex items-center gap-1.5 px-3.5 py-1.5 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-750 border border-slate-200/80 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 shadow-xs transition-colors"
                                >
                                    <LogIn className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                                    <span>Sign In</span>
                                </button>

                                <button
                                    type="button"
                                    onClick={() => {
                                        setAuthModalMode("register");
                                        setAuthModalOpen(true);
                                    }}
                                    className="flex items-center gap-1.5 px-3.5 py-1.5 bg-gradient-to-r from-teal-600 to-indigo-600 hover:from-teal-700 hover:to-indigo-700 text-white rounded-xl text-xs font-bold shadow-xs hover:shadow transition-all"
                                >
                                    <Sparkles className="w-3.5 h-3.5" />
                                    <span>Create Account</span>
                                </button>
                            </>
                        )}
                    </div>
                </div>
            </header>

            <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-6">
                {!user ? (
                    /* Aesthetic Health-Tech Welcome / Landing View for Unauthenticated Users */
                    <section className="space-y-8 py-6">
                        {/* Hero Card */}
                        <div className="relative overflow-hidden bg-white dark:bg-slate-900/90 rounded-3xl p-8 sm:p-12 border border-slate-200/80 dark:border-slate-800 shadow-md text-center space-y-6">
                            <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 bg-teal-400/10 dark:bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />
                            <div className="absolute bottom-0 left-0 -ml-16 -mb-16 w-64 h-64 bg-indigo-500/10 dark:bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

                            <div className="inline-flex items-center justify-center w-16 h-16 rounded-3xl bg-gradient-to-tr from-teal-500 to-indigo-600 text-white shadow-xl shadow-indigo-500/25 mb-2">
                                <Pill className="w-8 h-8" />
                            </div>

                            <div className="space-y-3 max-w-2xl mx-auto">
                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200/60 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 text-xs font-bold uppercase tracking-wider">
                                    <Sparkles className="w-3.5 h-3.5" /> Clinical Adherence Intelligence
                                </span>
                                <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100 leading-tight">
                                    Precision Medication Adherence & Tracking
                                </h2>
                                <p className="text-slate-600 dark:text-slate-300 text-sm sm:text-base leading-relaxed">
                                    Never miss a critical dose again. Medi Tracker pairs live schedule reminders,
                                    automated pill inventory tracking, and daily adherence streak analytics with
                                    clinical-grade isolated data security.
                                </p>
                            </div>

                            {/* CTAs */}
                            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setAuthModalMode("login");
                                        setAuthModalOpen(true);
                                    }}
                                    className="w-full sm:w-auto px-6 py-3 bg-gradient-to-r from-teal-600 to-indigo-600 hover:from-teal-700 hover:to-indigo-700 text-white font-bold rounded-2xl shadow-md shadow-indigo-500/20 hover:shadow-lg transition-all flex items-center justify-center gap-2 text-sm"
                                >
                                    <span>Sign In to Dashboard</span>
                                    <ArrowRight className="w-4 h-4" />
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setAuthModalMode("register");
                                        setAuthModalOpen(true);
                                    }}
                                    className="w-full sm:w-auto px-6 py-3 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-750 text-slate-800 dark:text-slate-200 font-bold rounded-2xl border border-slate-200/80 dark:border-slate-700 transition-colors flex items-center justify-center gap-2 text-sm"
                                >
                                    <span>Create Free Account</span>
                                </button>
                            </div>
                        </div>

                        {/* Feature Pillar Cards */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                            <div className="bg-white dark:bg-slate-900/90 p-6 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-3">
                                <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-800 flex items-center justify-center font-bold">
                                    <CheckCircle2 className="w-5 h-5" />
                                </div>
                                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                                    Intuitive Intake Logging
                                </h3>
                                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                                    One-click color pills for Taken, Missed, and Pending doses with dynamic daily streak counters that motivate healthy habits.
                                </p>
                            </div>

                            <div className="bg-white dark:bg-slate-900/90 p-6 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-3">
                                <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-850 flex items-center justify-center font-bold">
                                    <Boxes className="w-5 h-5" />
                                </div>
                                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                                    Smart Pill Inventory
                                </h3>
                                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                                    Automated stock countdown with low-supply warnings and instant one-click refills to guarantee your supply never runs dry.
                                </p>
                            </div>

                            <div className="bg-white dark:bg-slate-900/90 p-6 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-3">
                                <div className="w-10 h-10 rounded-xl bg-teal-50 dark:bg-teal-950/60 text-teal-600 dark:text-teal-400 border border-teal-100 dark:border-teal-850 flex items-center justify-center font-bold">
                                    <TrendingUp className="w-5 h-5" />
                                </div>
                                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                                    Adherence Analytics
                                </h3>
                                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                                    Cutout doughnut charts and 7-day trend visualizations providing clinical clarity into your overall medication adherence velocity.
                                </p>
                            </div>
                        </div>
                    </section>
                ) : activeTab === "profile" ? (
                    /* Dedicated Patient Profile & Clinical Health Hub View */
                    <PatientProfile
                        currentUser={user}
                        onProfileUpdated={(updated) => {
                            if (updated?.personal_info?.full_name) {
                                setUser((prev) => ({
                                    ...prev,
                                    full_name: updated.personal_info.full_name,
                                }));
                            }
                        }}
                    />
                ) : (
                    /* Authenticated Full-Stack Dashboard */
                    <>
                        {/* Hero Ribbon: Quick KPI Tiles */}
                        <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            {/* KPI 1: Today's Progress % */}
                            <div className="bg-white dark:bg-slate-900/90 p-4 sm:p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs flex items-center justify-between gap-4">
                                <div className="space-y-1">
                                    <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                                        Today's Progress
                                    </span>
                                    <div className="flex items-baseline gap-2">
                                        <span className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight">
                                            {kpis.progressPct}%
                                        </span>
                                        <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                                            adherence
                                        </span>
                                    </div>
                                    <div className="w-36 h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden mt-2">
                                        <div
                                            className="h-full bg-gradient-to-r from-teal-500 to-indigo-600 rounded-full transition-all duration-500"
                                            style={{ width: `${Math.min(100, kpis.progressPct)}%` }}
                                        />
                                    </div>
                                </div>

                                <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-900 flex items-center justify-center shrink-0">
                                    <Activity className="w-6 h-6" />
                                </div>
                            </div>

                            {/* KPI 2: Total Doses Taken vs Missed */}
                            <div className="bg-white dark:bg-slate-900/90 p-4 sm:p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs flex items-center justify-between gap-4">
                                <div className="space-y-1.5">
                                    <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                                        Doses Taken vs Missed
                                    </span>
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <span className="inline-flex items-center gap-1 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200/80 dark:border-emerald-800 px-2.5 py-1 rounded-lg text-xs font-bold">
                                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                                            {kpis.takenCount} Taken
                                        </span>
                                        <span className="inline-flex items-center gap-1 bg-rose-50 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300 border border-rose-200/80 dark:border-rose-800 px-2.5 py-1 rounded-lg text-xs font-bold">
                                            <XCircle className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
                                            {kpis.missedCount} Missed
                                        </span>
                                    </div>
                                    <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium pt-0.5">
                                        {kpis.pendingCount} of {kpis.totalScheduled} doses pending today
                                    </p>
                                </div>

                                <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-800 flex items-center justify-center shrink-0">
                                    <CheckCircle2 className="w-6 h-6" />
                                </div>
                            </div>

                            {/* KPI 3: Active Prescriptions & Inventory */}
                            <div className="bg-white dark:bg-slate-900/90 p-4 sm:p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs flex items-center justify-between gap-4">
                                <div className="space-y-1">
                                    <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                                        Active Prescriptions
                                    </span>
                                    <div className="flex items-baseline gap-2">
                                        <span className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight">
                                            {kpis.activeCount}
                                        </span>
                                        <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                                            medications
                                        </span>
                                    </div>
                                    <div className="pt-1">
                                        {kpis.lowStockCount > 0 ? (
                                            <span className="text-[11px] font-bold text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900 px-2 py-0.5 rounded-full inline-flex items-center gap-1 animate-pulse">
                                                <AlertCircle className="w-3 h-3 text-rose-500" />
                                                {kpis.lowStockCount} need refill soon
                                            </span>
                                        ) : (
                                            <span className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                                                <Boxes className="w-3 h-3 text-emerald-500" />
                                                Inventory healthy
                                            </span>
                                        )}
                                    </div>
                                </div>

                                <div className="w-12 h-12 rounded-2xl bg-teal-50 dark:bg-teal-950/60 text-teal-600 dark:text-teal-400 border border-teal-100 dark:border-teal-900 flex items-center justify-center shrink-0">
                                    <Boxes className="w-6 h-6" />
                                </div>
                            </div>
                        </section>

                        {/* Daily Healthcare & Habit Tips Ribbon */}
                        <HealthTips />

                        {/* Add New Prescription Form */}
                        <section className="bg-white dark:bg-slate-900/90 p-5 sm:p-6 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-4">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <div className="w-7 h-7 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold">
                                        <Sparkles className="w-4 h-4" />
                                    </div>
                                    <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                                        Add New Prescription
                                    </h2>
                                </div>
                                <span className="text-xs text-slate-400 dark:text-slate-500 font-medium">
                                    Set dose timings & instructions
                                </span>
                            </div>

                            <form onSubmit={handleAdd} className="space-y-3">
                                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                                    {/* Medicine Name */}
                                    <input
                                        required
                                        className="border border-slate-200 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-800/80 focus:bg-white dark:focus:bg-slate-800 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 p-2.5 rounded-xl text-xs sm:text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 outline-none transition"
                                        placeholder="Medicine Name (e.g. Metformin)"
                                        value={form.name}
                                        onChange={(e) => setForm({ ...form, name: e.target.value })}
                                    />

                                    {/* Dosage */}
                                    <input
                                        required
                                        className="border border-slate-200 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-800/80 focus:bg-white dark:focus:bg-slate-800 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 p-2.5 rounded-xl text-xs sm:text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 outline-none transition"
                                        placeholder="Dosage (e.g. 500mg)"
                                        value={form.dosage}
                                        onChange={(e) => setForm({ ...form, dosage: e.target.value })}
                                    />

                                    {/* Times */}
                                    <input
                                        required
                                        className="border border-slate-200 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-800/80 focus:bg-white dark:focus:bg-slate-800 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 p-2.5 rounded-xl text-xs sm:text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 font-mono outline-none transition"
                                        placeholder="Times (e.g. 08:00, 20:00)"
                                        value={form.times}
                                        onChange={(e) => setForm({ ...form, times: e.target.value })}
                                    />

                                    {/* Add Button */}
                                    <button
                                        type="submit"
                                        className="bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white font-semibold rounded-xl flex items-center justify-center gap-1.5 py-2.5 px-4 text-xs sm:text-sm shadow-xs hover:shadow transition"
                                    >
                                        <Plus className="w-4 h-4" />
                                        <span>Add Prescription</span>
                                    </button>
                                </div>

                                {/* Quick Presets for Instructions & Timing */}
                                <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-100 dark:border-slate-800 text-xs">
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                        <span className="text-slate-400 dark:text-slate-500 flex items-center gap-1">
                                            <Tag className="w-3 h-3" /> Instruction:
                                        </span>
                                        {["After Food", "Before Food", "With Water", "Anytime"].map(
                                            (cat) => (
                                                <button
                                                    key={cat}
                                                    type="button"
                                                    onClick={() => setForm({ ...form, category: cat })}
                                                    className={`px-2.5 py-0.5 rounded-lg border transition-all ${
                                                        form.category === cat
                                                            ? "bg-indigo-50 dark:bg-indigo-950/60 border-indigo-300 dark:border-indigo-700 text-indigo-700 dark:text-indigo-300 font-bold"
                                                            : "border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800"
                                                    }`}
                                                >
                                                    {cat}
                                                </button>
                                            )
                                        )}
                                    </div>

                                    <div className="flex items-center gap-1.5 flex-wrap">
                                        <span className="text-slate-400 dark:text-slate-500 flex items-center gap-1">
                                            <Clock className="w-3 h-3" /> Quick Slot:
                                        </span>
                                        {[
                                            { label: "+Morning (08:00)", time: "08:00" },
                                            { label: "+Noon (13:00)", time: "13:00" },
                                            { label: "+Night (20:00)", time: "20:00" },
                                        ].map((slot) => (
                                            <button
                                                key={slot.time}
                                                type="button"
                                                onClick={() => {
                                                    const existing = form.times
                                                        ? form.times
                                                              .split(",")
                                                              .map((s) => s.trim())
                                                              .filter(Boolean)
                                                        : [];
                                                    if (!existing.includes(slot.time)) {
                                                        const nextTimes = [...existing, slot.time].join(
                                                            ", "
                                                        );
                                                        setForm({ ...form, times: nextTimes });
                                                    }
                                                }}
                                                className="px-2 py-0.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-800 dark:hover:text-slate-200 transition"
                                            >
                                                {slot.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </form>
                        </section>

                        {/* Today's Schedule & Medicine Cards */}
                        <section className="space-y-3">
                            <div className="flex justify-between items-center">
                                <div>
                                    <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 tracking-tight">
                                        Today's Schedule & Intake Tracking
                                    </h2>
                                    <p className="text-xs text-slate-500 dark:text-slate-400">
                                        Click time slots to mark doses as taken or missed
                                    </p>
                                </div>
                                <span className="text-xs font-semibold px-3 py-1 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 shadow-2xs">
                                    {currentTime.toLocaleDateString(undefined, {
                                        weekday: "long",
                                        month: "short",
                                        day: "numeric",
                                    })}
                                </span>
                            </div>

                            <MedicineList
                                medicines={medicines}
                                logs={logs}
                                onStatusChange={handleStatus}
                                onEdit={(med) => setEditingMed(med)}
                                onDelete={handleDelete}
                                onRefill={handleRefill}
                            />
                        </section>

                        {/* Adherence Analytics Section */}
                        <AnalyticsDashboard refreshKey={refreshTrigger} theme={theme} />
                    </>
                )}
            </main>

            {/* Authentication Modal */}
            <AuthModal
                isOpen={authModalOpen}
                initialMode={authModalMode}
                onClose={() => setAuthModalOpen(false)}
                onAuthSuccess={handleAuthSuccess}
            />

            {/* Edit Medicine Modal */}
            {editingMed && (
                <EditModal
                    medicine={editingMed}
                    onClose={() => setEditingMed(null)}
                    onSuccess={() => {
                        setEditingMed(null);
                        triggerAllRefresh();
                    }}
                />
            )}

            {/* Medication History Modal */}
            {showHistory && <HistoryModal onClose={() => setShowHistory(false)} />}
        </div>
    );
}