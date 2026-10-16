import React, { useState, useEffect } from "react";
import axios from "axios";
import {
    Sparkles,
    Droplets,
    Clock,
    Shield,
    Utensils,
    Moon,
    Activity,
    AlertCircle,
    RefreshCw,
    HeartPulse,
    ChevronRight,
} from "lucide-react";
import { API_BASE_URL } from "../api";

export default function HealthTips() {
    const [tips, setTips] = useState([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [animating, setAnimating] = useState(false);

    useEffect(() => {
        axios
            .get(`${API_BASE_URL}/health-tips`)
            .then((res) => {
                if (Array.isArray(res.data) && res.data.length > 0) {
                    setTips(res.data);
                }
            })
            .catch((err) => console.error("Failed to load health tips", err));
    }, []);

    // Auto-rotate every 15 seconds
    useEffect(() => {
        if (!tips.length) return;
        const timer = setInterval(() => {
            handleNextTip();
        }, 15000);
        return () => clearInterval(timer);
    }, [tips.length, currentIndex]);

    const handleNextTip = () => {
        if (!tips.length) return;
        setAnimating(true);
        setTimeout(() => {
            setCurrentIndex((prev) => (prev + 1) % tips.length);
            setAnimating(false);
        }, 150);
    };

    if (!tips.length) return null;

    const currentTip = tips[currentIndex];

    const getCategoryDetails = (cat) => {
        switch (cat) {
            case "Hydration":
                return {
                    badge: "bg-cyan-50 dark:bg-cyan-950/60 text-cyan-700 dark:text-cyan-300 border-cyan-200 dark:border-cyan-800",
                    icon: <Droplets className="w-3.5 h-3.5 text-cyan-500" />,
                };
            case "Adherence":
                return {
                    badge: "bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300 border-teal-200 dark:border-teal-800",
                    icon: <Clock className="w-3.5 h-3.5 text-teal-500" />,
                };
            case "Storage":
                return {
                    badge: "bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800",
                    icon: <Shield className="w-3.5 h-3.5 text-indigo-500" />,
                };
            case "Nutrition":
                return {
                    badge: "bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800",
                    icon: <Utensils className="w-3.5 h-3.5 text-amber-500" />,
                };
            case "Sleep":
                return {
                    badge: "bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800",
                    icon: <Moon className="w-3.5 h-3.5 text-purple-500" />,
                };
            case "Gut Health":
                return {
                    badge: "bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800",
                    icon: <Activity className="w-3.5 h-3.5 text-emerald-500" />,
                };
            default:
                return {
                    badge: "bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800",
                    icon: <AlertCircle className="w-3.5 h-3.5 text-rose-500" />,
                };
        }
    };

    const catDetails = getCategoryDetails(currentTip?.category);

    return (
        <div className="relative overflow-hidden bg-gradient-to-r from-teal-50/70 via-indigo-50/50 to-white dark:from-slate-900/90 dark:via-indigo-950/30 dark:to-slate-900/90 rounded-2xl p-4 sm:p-5 border border-teal-100 dark:border-slate-800 shadow-xs transition-all">
            {/* Ambient Background Accent */}
            <div className="absolute top-0 right-0 -mr-8 -mt-8 w-36 h-36 bg-teal-400/10 dark:bg-teal-500/5 rounded-full blur-2xl pointer-events-none" />

            <div className="relative flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                {/* Left side: Icon & Tip content */}
                <div className="flex items-start gap-3.5 max-w-3xl">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-teal-600 to-indigo-600 text-white flex items-center justify-center font-bold shrink-0 shadow-xs mt-0.5">
                        <HeartPulse className="w-5 h-5 animate-pulse" />
                    </div>

                    <div
                        className={`space-y-1 transition-opacity duration-150 ${
                            animating ? "opacity-0 translate-y-1" : "opacity-100 translate-y-0"
                        }`}
                    >
                        <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-bold uppercase tracking-wider text-teal-700 dark:text-teal-400 flex items-center gap-1">
                                <Sparkles className="w-3 h-3" /> Daily Health & Medication Tip
                            </span>
                            <span
                                className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full border flex items-center gap-1 ${catDetails.badge}`}
                            >
                                {catDetails.icon}
                                {currentTip.category}
                            </span>
                        </div>

                        <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                            {currentTip.title}
                        </h4>
                        <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                            {currentTip.tip}
                        </p>
                    </div>
                </div>

                {/* Right side: Actions & progress pagination */}
                <div className="flex items-center gap-2 self-end md:self-center shrink-0">
                    <div className="flex items-center gap-1 mr-1">
                        {tips.map((_, i) => (
                            <button
                                key={i}
                                type="button"
                                onClick={() => setCurrentIndex(i)}
                                className={`h-1.5 rounded-full transition-all ${
                                    i === currentIndex
                                        ? "w-4 bg-teal-600 dark:bg-teal-400"
                                        : "w-1.5 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300"
                                }`}
                                title={`Tip ${i + 1}`}
                            />
                        ))}
                    </div>

                    <button
                        type="button"
                        onClick={handleNextTip}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/80 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-semibold shadow-2xs transition-all active:scale-95"
                        title="Show Next Tip"
                    >
                        <RefreshCw className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
                        <span>Next Tip</span>
                        <ChevronRight className="w-3 h-3 text-slate-400" />
                    </button>
                </div>
            </div>
        </div>
    );
}
