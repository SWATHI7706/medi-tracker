import React, { useState } from "react";
import {
    CheckCircle2,
    XCircle,
    Edit3,
    Trash2,
    Pill,
    Clock,
    Sparkles,
    Search,
    Filter,
    Tag,
    Boxes,
    AlertTriangle,
    Plus,
} from "lucide-react";

export default function MedicineList({
    medicines = [],
    logs = {},
    onStatusChange,
    onEdit,
    onDelete,
    onRefill,
}) {
    const [searchTerm, setSearchTerm] = useState("");
    const [statusFilter, setStatusFilter] = useState("all");
    const [refillPopoverId, setRefillPopoverId] = useState(null);

    if (!medicines.length) {
        return (
            <div className="text-center py-16 px-6 bg-white dark:bg-slate-900/90 border border-dashed border-slate-300 dark:border-slate-800 rounded-2xl shadow-sm space-y-3">
                <div className="w-14 h-14 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 rounded-2xl flex items-center justify-center mx-auto shadow-inner">
                    <Pill className="w-7 h-7" />
                </div>
                <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">
                    No Prescriptions Added Yet
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
                    Start tracking your health routine by adding your first medication schedule above.
                </p>
            </div>
        );
    }

    // Determine status for each medicine
    const getMedStatus = (med) => {
        const times = med.times || [];
        if (!times.length) return "pending";
        const statuses = times.map((t) => logs[`${med.id}_${t}`]);
        if (statuses.every((s) => s === "taken")) return "taken";
        if (statuses.some((s) => s === "missed")) return "missed";
        return "pending";
    };

    // Filter medicines by search term and status
    const filteredMedicines = medicines.filter((med) => {
        const matchesSearch = med.name.toLowerCase().includes(searchTerm.toLowerCase());
        const medStatus = getMedStatus(med);
        const matchesStatus =
            statusFilter === "all" ? true : medStatus === statusFilter;
        return matchesSearch && matchesStatus;
    });

    const counts = {
        all: medicines.length,
        pending: medicines.filter((m) => getMedStatus(m) === "pending").length,
        taken: medicines.filter((m) => getMedStatus(m) === "taken").length,
        missed: medicines.filter((m) => getMedStatus(m) === "missed").length,
    };

    const getCategoryBadge = (category) => {
        const cat = category || "After Food";
        let colorClass = "bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300 border-teal-200/70 dark:border-teal-800/70";
        if (cat === "Before Food") {
            colorClass = "bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-200/70 dark:border-amber-800/70";
        } else if (cat === "With Water") {
            colorClass = "bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border-blue-200/70 dark:border-blue-800/70";
        } else if (cat === "Anytime") {
            colorClass = "bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700";
        }

        return (
            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-md border flex items-center gap-1 ${colorClass}`}>
                <Tag className="w-2.5 h-2.5" />
                {cat}
            </span>
        );
    };

    return (
        <div className="space-y-4">
            {/* Search & Quick Filter Chips */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white dark:bg-slate-900/90 p-3 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
                {/* Search Bar */}
                <div className="relative flex-1">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                        type="text"
                        placeholder="Search medicines by name..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-9 pr-3.5 py-1.5 text-xs bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                    />
                    {searchTerm && (
                        <button
                            type="button"
                            onClick={() => setSearchTerm("")}
                            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xs absolute right-3 top-1/2 -translate-y-1/2"
                        >
                            Clear
                        </button>
                    )}
                </div>

                {/* Status Filter Chips */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
                    {[
                        { key: "all", label: "All" },
                        { key: "pending", label: "Pending" },
                        { key: "taken", label: "Taken" },
                        { key: "missed", label: "Missed" },
                    ].map((f) => {
                        const active = statusFilter === f.key;
                        return (
                            <button
                                key={f.key}
                                type="button"
                                onClick={() => setStatusFilter(f.key)}
                                className={`text-xs px-3 py-1.5 rounded-xl font-semibold border transition-all whitespace-nowrap flex items-center gap-1.5 ${
                                    active
                                        ? "bg-indigo-600 text-white border-indigo-600 shadow-xs"
                                        : "bg-slate-50 dark:bg-slate-800/70 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
                                }`}
                            >
                                <span>{f.label}</span>
                                <span
                                    className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                                        active
                                            ? "bg-indigo-500 text-white"
                                            : "bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300"
                                    }`}
                                >
                                    {counts[f.key]}
                                </span>
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Filtered Medicine List */}
            {filteredMedicines.length === 0 ? (
                <div className="text-center py-10 px-4 bg-white dark:bg-slate-900/90 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl text-slate-400 dark:text-slate-500 text-xs space-y-1">
                    <p className="font-semibold text-slate-600 dark:text-slate-300">
                        No medicines match your search or filter.
                    </p>
                    <p>Try searching for a different name or clearing filters.</p>
                </div>
            ) : (
                <div className="grid gap-4">
                    {filteredMedicines.map((med) => {
                        const times = med.times || [];
                        const medStatus = getMedStatus(med);
                        const totalStock = med.total_stock ?? 30;
                        const refillThreshold = med.refill_threshold ?? 5;
                        const doseUnit = med.dose_unit || "pills";
                        const isLowStock = totalStock <= refillThreshold;
                        const isOutOfStock = totalStock === 0;

                        let borderAccent = "border-l-slate-300 dark:border-l-slate-600";
                        let statusChip = (
                            <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2.5 py-0.5 rounded-full">
                                Pending
                            </span>
                        );

                        if (medStatus === "taken") {
                            borderAccent = "border-l-emerald-500";
                            statusChip = (
                                <span className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200/80 dark:border-emerald-800 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                                    <Sparkles className="w-3 h-3 text-emerald-500" /> Complete
                                </span>
                            );
                        } else if (medStatus === "missed") {
                            borderAccent = "border-l-rose-500";
                            statusChip = (
                                <span className="text-[11px] font-semibold text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/60 border border-rose-200/80 dark:border-rose-800 px-2.5 py-0.5 rounded-full">
                                    Missed Dose
                                </span>
                            );
                        }

                        return (
                            <div
                                key={med.id}
                                className={`group bg-white dark:bg-slate-900/90 rounded-2xl p-5 border border-slate-200/80 dark:border-slate-800 border-l-4 ${borderAccent} shadow-xs hover:shadow-md transition-all duration-200 flex flex-col md:flex-row justify-between md:items-center gap-4`}
                            >
                                {/* Medicine Info */}
                                <div className="flex items-center gap-3.5">
                                    <div className="w-11 h-11 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold shrink-0 border border-indigo-100 dark:border-indigo-900 shadow-xs">
                                        <Pill className="w-5 h-5" />
                                    </div>
                                    <div className="space-y-1.5">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <h3 className="font-bold text-base text-slate-900 dark:text-slate-100 tracking-tight">
                                                {med.name}
                                            </h3>
                                            <span className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold px-2 py-0.5 rounded-md">
                                                {med.dosage}
                                            </span>
                                            {getCategoryBadge(med.category)}
                                            {isLowStock && (
                                                <span className="text-[10px] font-bold text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/70 border border-rose-200 dark:border-rose-800 px-2 py-0.5 rounded-full flex items-center gap-1 animate-pulse">
                                                    <AlertTriangle className="w-3 h-3 text-rose-500" />
                                                    {isOutOfStock ? "Out of Stock - Refill!" : `Low Stock (≤ ${refillThreshold})`}
                                                </span>
                                            )}
                                        </div>

                                        {/* Status & Remaining Stock Bar */}
                                        <div className="flex items-center gap-3 flex-wrap text-xs pt-0.5">
                                            <div>{statusChip}</div>
                                            <div className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border text-xs font-semibold ${
                                                isLowStock 
                                                    ? "bg-rose-50 dark:bg-rose-950/60 border-rose-200/80 dark:border-rose-900 text-rose-700 dark:text-rose-300"
                                                    : "bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300"
                                            }`}>
                                                <Boxes className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                                                <span>{totalStock}/30 {doseUnit} remaining</span>
                                                <div className="w-12 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden ml-1">
                                                    <div
                                                        className={`h-full rounded-full transition-all duration-300 ${
                                                            isOutOfStock ? "bg-rose-500 w-0" : isLowStock ? "bg-amber-500" : "bg-emerald-500"
                                                        }`}
                                                        style={{ width: `${Math.min(100, Math.max(6, (totalStock / 30) * 100))}%` }}
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Interactive Dose Slots */}
                                <div className="flex flex-wrap items-center gap-2.5">
                                    {times.map((time) => {
                                        const status = logs[`${med.id}_${time}`];
                                        const isTaken = status === "taken";
                                        const isMissed = status === "missed";

                                        let slotStyles =
                                            "bg-slate-50 dark:bg-slate-800/70 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-600";
                                        if (isTaken) {
                                            slotStyles =
                                                "bg-emerald-50/90 dark:bg-emerald-950/60 border-emerald-300 dark:border-emerald-700 text-emerald-900 dark:text-emerald-200 ring-1 ring-emerald-400/30 shadow-xs";
                                        } else if (isMissed) {
                                            slotStyles =
                                                "bg-rose-50/90 dark:bg-rose-950/60 border-rose-300 dark:border-rose-700 text-rose-900 dark:text-rose-200 ring-1 ring-rose-400/30 shadow-xs";
                                        }

                                        return (
                                            <div
                                                key={time}
                                                className={`flex items-center gap-2 border px-3 py-1.5 rounded-xl text-xs transition-all ${slotStyles}`}
                                            >
                                                <div className="flex items-center gap-1 font-mono font-bold">
                                                    <Clock className="w-3 h-3 text-slate-400 dark:text-slate-500" />
                                                    <span>{time}</span>
                                                </div>

                                                <div className="flex items-center gap-1 border-l border-slate-200 dark:border-slate-700 pl-1.5 ml-0.5">
                                                    <button
                                                        type="button"
                                                        title="Mark as Taken"
                                                        onClick={() => onStatusChange(med.id, time, "taken")}
                                                        className={`p-1 rounded-lg transition-all ${
                                                            isTaken
                                                                ? "bg-emerald-600 text-white shadow-xs scale-105"
                                                                : "text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/50"
                                                        }`}
                                                    >
                                                        <CheckCircle2 className="w-4 h-4" />
                                                    </button>
                                                    <button
                                                        type="button"
                                                        title="Mark as Missed"
                                                        onClick={() => onStatusChange(med.id, time, "missed")}
                                                        className={`p-1 rounded-lg transition-all ${
                                                            isMissed
                                                                ? "bg-rose-600 text-white shadow-xs scale-105"
                                                                : "text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50"
                                                        }`}
                                                    >
                                                        <XCircle className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>

                                {/* Actions & Quick Refill */}
                                <div className="flex items-center gap-2 self-end md:self-auto">
                                    {/* Quick Refill Button & Popover */}
                                    <div className="relative">
                                        <button
                                            type="button"
                                            onClick={() => setRefillPopoverId(refillPopoverId === med.id ? null : med.id)}
                                            className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all flex items-center gap-1.5 shadow-xs ${
                                                isLowStock
                                                    ? "bg-rose-600 hover:bg-rose-700 text-white border-rose-600 shadow-rose-500/20 shadow-sm animate-bounce-subtle"
                                                    : "bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900 border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300"
                                            }`}
                                            title="Refill stock"
                                        >
                                            <Plus className="w-3.5 h-3.5" />
                                            <span>Refill</span>
                                        </button>

                                        {refillPopoverId === med.id && (
                                            <div className="absolute right-0 bottom-full mb-2 z-30 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-xl rounded-2xl p-3 w-48 space-y-2 animate-in zoom-in-95 duration-150">
                                                <div className="flex items-center justify-between text-xs font-bold text-slate-800 dark:text-slate-100 border-b border-slate-100 dark:border-slate-700 pb-1.5">
                                                    <span>Refill {med.name}</span>
                                                    <button
                                                        type="button"
                                                        onClick={() => setRefillPopoverId(null)}
                                                        className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xs"
                                                    >
                                                        ✕
                                                    </button>
                                                </div>
                                                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                                                    Add quantity ({doseUnit}):
                                                </p>
                                                <div className="grid grid-cols-3 gap-1.5">
                                                    {[15, 30, 60].map((amt) => (
                                                        <button
                                                            key={amt}
                                                            type="button"
                                                            onClick={() => {
                                                                onRefill && onRefill(med.id, amt);
                                                                setRefillPopoverId(null);
                                                            }}
                                                            className="px-2 py-1.5 bg-indigo-50 dark:bg-slate-700 hover:bg-indigo-600 hover:text-white dark:hover:bg-indigo-600 text-indigo-700 dark:text-indigo-200 rounded-lg text-xs font-bold border border-indigo-100 dark:border-slate-600 transition-colors"
                                                        >
                                                            +{amt}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    <div className="flex items-center gap-0.5 opacity-70 group-hover:opacity-100 transition-opacity">
                                        <button
                                            type="button"
                                            onClick={() => onEdit(med)}
                                            className="p-2 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/60 rounded-xl transition-colors"
                                            title="Edit Prescription"
                                        >
                                            <Edit3 className="w-4 h-4" />
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => onDelete(med.id)}
                                            className="p-2 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/60 rounded-xl transition-colors"
                                            title="Delete Prescription"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}