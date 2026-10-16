import React, { useState, useEffect } from "react";
import axios from "axios";
import { X, Calendar, CheckCircle2, XCircle, Filter, Download, Tag } from "lucide-react";
import { API_BASE_URL } from "../api";

export default function HistoryModal({ onClose }) {
    const [historyLogs, setHistoryLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedDate, setSelectedDate] = useState("all");

    useEffect(() => {
        const fetchHistory = async () => {
            try {
                const res = await axios.get(`${API_BASE_URL}/logs/history?days=30`);
                setHistoryLogs(res.data || []);
            } catch (err) {
                console.error("Failed to load intake history", err);
            } finally {
                setLoading(false);
            }
        };

        fetchHistory();
    }, []);

    const exportToCSV = () => {
        if (historyLogs.length === 0) {
            alert("No history records to export.");
            return;
        }

        const headers = ["Date", "Medicine Name", "Dosage", "Category", "Scheduled Time", "Status", "Timestamp"];
        const rows = historyLogs.map((log) => [
            `"${log.date || ""}"`,
            `"${(log.medicine_name || "").replace(/"/g, '""')}"`,
            `"${(log.dosage || "").replace(/"/g, '""')}"`,
            `"${(log.category || "After Food").replace(/"/g, '""')}"`,
            `"${log.time || ""}"`,
            `"${log.status || ""}"`,
            `"${log.timestamp || ""}"`,
        ]);

        const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.setAttribute("download", `medi_tracker_history_${new Date().toISOString().split("T")[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    // Extract unique dates in descending order for filtering
    const availableDates = Array.from(new Set(historyLogs.map((l) => l.date))).sort(
        (a, b) => b.localeCompare(a)
    );

    // Filter logs by selected date
    const filteredLogs =
        selectedDate === "all"
            ? historyLogs
            : historyLogs.filter((l) => l.date === selectedDate);

    // Group filtered logs by date
    const groupedLogs = filteredLogs.reduce((acc, log) => {
        const d = log.date;
        if (!acc[d]) acc[d] = [];
        acc[d].push(log);
        return acc;
    }, {});

    const sortedGroupKeys = Object.keys(groupedLogs).sort((a, b) => b.localeCompare(a));

    return (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
            <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-2xl w-full shadow-2xl border border-slate-100 dark:border-slate-800 overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-200">
                {/* Modal Header */}
                <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/40">
                    <div>
                        <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                            <span>📅 Medication History</span>
                        </h2>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                            Past 30 days prescription adherence logs
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={exportToCSV}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-semibold shadow-xs transition-colors"
                            title="Export CSV"
                        >
                            <Download className="w-3.5 h-3.5 text-indigo-500" />
                            <span>Export CSV</span>
                        </button>
                        <button
                            type="button"
                            onClick={onClose}
                            className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                            title="Close"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* Filter Bar */}
                <div className="px-6 py-3 border-b border-slate-100 dark:border-slate-800 bg-slate-50/30 dark:bg-slate-800/20 flex flex-wrap items-center justify-between gap-3 text-sm">
                    <div className="flex items-center gap-2">
                        <Filter className="w-4 h-4 text-slate-400" />
                        <span className="text-slate-600 dark:text-slate-300 font-medium text-xs">
                            Filter by Day:
                        </span>
                        <select
                            value={selectedDate}
                            onChange={(e) => setSelectedDate(e.target.value)}
                            className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-1 text-xs text-slate-700 dark:text-slate-200 font-medium focus:ring-2 focus:ring-indigo-500/20 focus:outline-none"
                        >
                            <option value="all">All Dates ({historyLogs.length} doses)</option>
                            {availableDates.map((dateStr) => {
                                const count = historyLogs.filter((l) => l.date === dateStr).length;
                                return (
                                    <option key={dateStr} value={dateStr}>
                                        {dateStr} ({count} {count === 1 ? "dose" : "doses"})
                                    </option>
                                );
                            })}
                        </select>
                    </div>

                    <div className="flex items-center gap-2 text-xs font-medium">
                        <span className="text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 px-2.5 py-0.5 rounded-full">
                            Taken: {filteredLogs.filter((l) => l.status === "taken").length}
                        </span>
                        <span className="text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 px-2.5 py-0.5 rounded-full">
                            Missed: {filteredLogs.filter((l) => l.status === "missed").length}
                        </span>
                    </div>
                </div>

                {/* Modal Body / Logs */}
                <div className="overflow-y-auto p-6 space-y-6 flex-1">
                    {loading ? (
                        <div className="text-center py-12 text-slate-400 text-sm">
                            Loading history records...
                        </div>
                    ) : sortedGroupKeys.length === 0 ? (
                        <div className="text-center py-12 bg-slate-50 dark:bg-slate-800/40 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl text-slate-400 dark:text-slate-500 text-sm">
                            No medication logs found for the selected period.
                        </div>
                    ) : (
                        sortedGroupKeys.map((dateKey) => (
                            <div key={dateKey} className="space-y-3">
                                <div className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-300 border-b border-slate-100 dark:border-slate-800 pb-1.5">
                                    <Calendar className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                                    <span>{dateKey}</span>
                                    <span className="text-xs font-normal text-slate-400">
                                        ({groupedLogs[dateKey].length}{" "}
                                        {groupedLogs[dateKey].length === 1 ? "dose" : "doses"})
                                    </span>
                                </div>

                                <div className="overflow-hidden border border-slate-200/80 dark:border-slate-800 rounded-2xl shadow-xs bg-white dark:bg-slate-900">
                                    <table className="w-full text-left text-sm">
                                        <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 text-xs border-b border-slate-100 dark:border-slate-800">
                                            <tr>
                                                <th className="py-2.5 px-4 font-semibold">Medicine & Dosage</th>
                                                <th className="py-2.5 px-4 font-semibold">Scheduled Time</th>
                                                <th className="py-2.5 px-4 font-semibold text-right">Status</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-800 dark:text-slate-200">
                                            {groupedLogs[dateKey].map((log) => (
                                                <tr
                                                    key={log.id}
                                                    className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors"
                                                >
                                                    <td className="py-2.5 px-4">
                                                        <div className="font-medium text-slate-900 dark:text-slate-100 flex items-center gap-2">
                                                            <span>{log.medicine_name || "Unknown Medicine"}</span>
                                                            {log.category && (
                                                                <span className="text-[10px] font-semibold text-teal-700 dark:text-teal-300 bg-teal-50 dark:bg-teal-950/60 border border-teal-200/60 dark:border-teal-800 px-1.5 py-0.2 rounded-md flex items-center gap-1">
                                                                    <Tag className="w-2.5 h-2.5" />
                                                                    {log.category}
                                                                </span>
                                                            )}
                                                        </div>
                                                        {log.dosage && (
                                                            <div className="text-xs text-slate-500 dark:text-slate-400">
                                                                {log.dosage}
                                                            </div>
                                                        )}
                                                    </td>
                                                    <td className="py-2.5 px-4 text-slate-600 dark:text-slate-400 font-mono text-xs">
                                                        {log.time}
                                                    </td>
                                                    <td className="py-2.5 px-4 text-right">
                                                        {log.status === "taken" ? (
                                                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200/80 dark:border-emerald-800">
                                                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                                                Taken
                                                            </span>
                                                        ) : (
                                                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200/80 dark:border-rose-800">
                                                                <XCircle className="w-3.5 h-3.5 text-rose-600" />
                                                                Missed
                                                            </span>
                                                        )}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        ))
                    )}
                </div>

                {/* Modal Footer */}
                <div className="px-6 py-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 flex justify-between items-center">
                    <button
                        type="button"
                        onClick={exportToCSV}
                        className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1.5"
                    >
                        <Download className="w-3.5 h-3.5" /> Download Full CSV
                    </button>
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200 rounded-xl text-xs font-semibold transition-colors"
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
}
