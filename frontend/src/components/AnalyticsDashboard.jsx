import React, { useEffect, useState } from "react";
import axios from "axios";
import { API_BASE_URL } from "../api";
import {
    Chart as ChartJS,
    ArcElement,
    Tooltip,
    Legend,
    PointElement,
    LineElement,
    CategoryScale,
    LinearScale,
} from "chart.js";
import { Doughnut, Line } from "react-chartjs-2";
import {
    CheckCircle2,
    XCircle,
    Activity,
    Sparkles,
    TrendingUp,
    Download,
} from "lucide-react";

ChartJS.register(
    ArcElement,
    Tooltip,
    Legend,
    PointElement,
    LineElement,
    CategoryScale,
    LinearScale
);

export default function AnalyticsDashboard({ refreshKey, onExportCSV, theme }) {
    const [data, setData] = useState(null);

    useEffect(() => {
        let isMounted = true;
        const fetchAnalytics = async () => {
            try {
                const res = await axios.get(`${API_BASE_URL}/analytics`);
                if (isMounted) setData(res.data);
            } catch (err) {
                console.error("Failed to load analytics", err);
            }
        };
        fetchAnalytics();
        return () => {
            isMounted = false;
        };
    }, [refreshKey]);

    const taken = data?.summary?.taken || 0;
    const missed = data?.summary?.missed || 0;
    const total = taken + missed;
    const adherenceRate = total > 0 ? Math.round((taken / total) * 100) : 0;

    // Insight banner determination
    let insightPill = {
        badge: "bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800",
        icon: <Activity className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />,
        text: "Log your daily doses to unlock personalized adherence insights.",
    };

    if (total > 0) {
        if (adherenceRate >= 80) {
            insightPill = {
                badge: "bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800",
                icon: <Sparkles className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />,
                text: `Great job! You're on track with ${adherenceRate}% adherence rate.`,
            };
        } else if (adherenceRate >= 50) {
            insightPill = {
                badge: "bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800",
                icon: <TrendingUp className="w-4 h-4 text-amber-600 dark:text-amber-400" />,
                text: `Moderate adherence (${adherenceRate}%). Don't forget your scheduled doses today.`,
            };
        } else {
            insightPill = {
                badge: "bg-rose-50 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300 border-rose-200 dark:border-rose-800",
                icon: <XCircle className="w-4 h-4 text-rose-600 dark:text-rose-400" />,
                text: `Adherence is currently at ${adherenceRate}%. Please review any missed medications.`,
            };
        }
    }

    const isDark =
        theme === "dark" ||
        (typeof document !== "undefined" &&
            document.documentElement.classList.contains("dark"));

    const donutData = {
        labels: ["Taken", "Missed"],
        datasets: [
            {
                data: total === 0 ? [1, 0] : [taken, missed],
                backgroundColor:
                    total === 0
                        ? [isDark ? "#334155" : "#E2E8F0", isDark ? "#334155" : "#E2E8F0"]
                        : ["#10B981", "#F43F5E"],
                borderWidth: 0,
                borderRadius: 6,
            },
        ],
    };

    const donutOptions = {
        cutout: "75%",
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { display: false },
            tooltip: { enabled: total > 0 },
        },
    };

    const trends = data?.trends || [];
    const lineChartData = {
        labels: trends.map((t) => t.date.slice(5)), // MM-DD
        datasets: [
            {
                label: "Taken",
                data: trends.map((t) => t.taken),
                borderColor: "#10B981",
                backgroundColor: "#10B981",
                tension: 0.35,
                pointRadius: 3.5,
                pointHoverRadius: 6,
            },
            {
                label: "Missed",
                data: trends.map((t) => t.missed),
                borderColor: "#EF4444",
                backgroundColor: "#EF4444",
                tension: 0.35,
                pointRadius: 3.5,
                pointHoverRadius: 6,
            },
        ],
    };

    const lineChartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                position: "top",
                labels: {
                    boxWidth: 12,
                    boxHeight: 12,
                    usePointStyle: true,
                    color: isDark ? "#94a3b8" : "#475569",
                    font: { size: 11, weight: "600" },
                },
            },
        },
        scales: {
            y: {
                beginAtZero: true,
                ticks: {
                    precision: 0,
                    stepSize: 1,
                    color: isDark ? "#94a3b8" : "#64748b",
                    font: { size: 10 },
                },
                grid: {
                    color: isDark ? "rgba(51, 65, 85, 0.4)" : "rgba(226, 232, 240, 0.6)",
                },
            },
            x: {
                ticks: {
                    color: isDark ? "#94a3b8" : "#64748b",
                    font: { size: 10 },
                },
                grid: { display: false },
            },
        },
    };

    return (
        <section className="space-y-4 pt-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                    <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 tracking-tight flex items-center gap-2">
                        <span>Adherence Analytics</span>
                    </h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                        Visual breakdown of overall routine and past 7 days velocity
                    </p>
                </div>

                <div className="flex items-center gap-2.5 flex-wrap">
                    {/* Adherence Insight Pill */}
                    <div
                        className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-semibold shadow-xs ${insightPill.badge}`}
                    >
                        {insightPill.icon}
                        <span>{insightPill.text}</span>
                    </div>

                    {/* Export CSV button if onExportCSV provided */}
                    {onExportCSV && (
                        <button
                            type="button"
                            onClick={onExportCSV}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-semibold shadow-xs transition-colors"
                            title="Download CSV report"
                        >
                            <Download className="w-3.5 h-3.5 text-indigo-500" />
                            <span>Export CSV</span>
                        </button>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                {/* Left Card: Ring Chart & KPI Tiles */}
                <div className="bg-white dark:bg-slate-900/90 rounded-2xl p-6 border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-col justify-between space-y-5">
                    <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">
                        Overall Adherence Ratio
                    </h3>

                    <div className="flex flex-col sm:flex-row items-center justify-around gap-6">
                        {/* Donut with centered rate */}
                        <div className="relative w-40 h-40 flex items-center justify-center shrink-0">
                            <Doughnut key={isDark ? "dark" : "light"} data={donutData} options={donutOptions} />
                            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                                <span className="text-2xl font-extrabold text-slate-900 dark:text-slate-100 leading-none">
                                    {adherenceRate}%
                                </span>
                                <span className="text-[10px] uppercase tracking-wider font-bold text-slate-400 dark:text-slate-500 mt-1">
                                    Rate
                                </span>
                            </div>
                        </div>

                        {/* Metric KPI Tiles */}
                        <div className="grid grid-cols-1 gap-2.5 w-full sm:w-48 text-xs">
                            <div className="bg-slate-50 dark:bg-slate-800/70 border border-slate-100 dark:border-slate-800 p-2.5 rounded-xl flex items-center justify-between">
                                <span className="text-slate-500 dark:text-slate-400 font-medium">
                                    Total Doses
                                </span>
                                <span className="font-bold text-slate-800 dark:text-slate-100 text-sm">
                                    {total}
                                </span>
                            </div>
                            <div className="bg-emerald-50/70 dark:bg-emerald-950/50 border border-emerald-100 dark:border-emerald-900/60 p-2.5 rounded-xl flex items-center justify-between">
                                <span className="text-emerald-700 dark:text-emerald-300 font-semibold flex items-center gap-1.5">
                                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />{" "}
                                    Taken
                                </span>
                                <span className="font-bold text-emerald-800 dark:text-emerald-200 text-sm">
                                    {taken}
                                </span>
                            </div>
                            <div className="bg-rose-50/70 dark:bg-rose-950/50 border border-rose-100 dark:border-rose-900/60 p-2.5 rounded-xl flex items-center justify-between">
                                <span className="text-rose-700 dark:text-rose-300 font-semibold flex items-center gap-1.5">
                                    <XCircle className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />{" "}
                                    Missed
                                </span>
                                <span className="font-bold text-rose-800 dark:text-rose-200 text-sm">
                                    {missed}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Right Card: 7-Day Adherence Trend Line Chart */}
                <div className="bg-white dark:bg-slate-900/90 rounded-2xl p-6 border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-col justify-between space-y-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">
                                7-Day Adherence Trend
                            </h3>
                            <p className="text-[11px] text-slate-400 dark:text-slate-500">
                                Daily taken vs. missed intake volume
                            </p>
                        </div>
                    </div>

                    <div className="h-44 w-full">
                        <Line key={isDark ? "dark" : "light"} data={lineChartData} options={lineChartOptions} />
                    </div>
                </div>
            </div>
        </section>
    );
}