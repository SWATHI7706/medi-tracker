import React, { useState } from "react";
import axios from "axios";
import { X, Pill, Scale, Clock, Save, Tag, Boxes, AlertTriangle } from "lucide-react";
import { API_BASE_URL } from "../api";

export default function EditModal({ medicine, onClose, onSuccess }) {
    const [name, setName] = useState(medicine.name);
    const [dosage, setDosage] = useState(medicine.dosage);
    const [category, setCategory] = useState(medicine.category || "After Food");
    const [times, setTimes] = useState(medicine.times.join(", "));
    const [totalStock, setTotalStock] = useState(medicine.total_stock ?? 30);
    const [refillThreshold, setRefillThreshold] = useState(medicine.refill_threshold ?? 5);
    const [doseUnit, setDoseUnit] = useState(medicine.dose_unit || "pills");
    const [saving, setSaving] = useState(false);

    const dosagePresets = ["250mg", "500mg", "650mg", "1000mg"];
    const categoryPresets = ["Before Food", "After Food", "With Water", "Anytime"];
    const unitPresets = ["pills", "tablets", "capsules", "ml"];
    const stockPresets = [15, 30, 60, 90];

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
            await axios.put(`${API_BASE_URL}/medicines/${medicine.id}`, {
                name: name.trim(),
                dosage: dosage.trim(),
                category: category.trim(),
                times: times.split(",").map((t) => t.trim()).filter(Boolean),
                total_stock: Math.max(0, parseInt(totalStock) || 0),
                refill_threshold: Math.max(0, parseInt(refillThreshold) || 0),
                dose_unit: doseUnit.trim(),
            });
            onSuccess();
        } catch (err) {
            console.error("Update failed", err);
            alert("Failed to save changes. Please check connection.");
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 backdrop-blur-md bg-slate-900/40 flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
            <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 max-w-md w-full shadow-2xl border border-slate-100 dark:border-slate-800 space-y-5 animate-in zoom-in-95 duration-200">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                    <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold">
                            <Pill className="w-5 h-5" />
                        </div>
                        <div>
                            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                                Edit Prescription
                            </h3>
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                                Update medication schedule & instructions
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                        title="Close"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                            <Pill className="w-3.5 h-3.5 text-indigo-500" />
                            Medicine Name
                        </label>
                        <input
                            required
                            className="w-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/80 rounded-xl px-3.5 py-2 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                            placeholder="e.g. Metformin"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                        />
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                            <Scale className="w-3.5 h-3.5 text-teal-500" />
                            Dosage
                        </label>
                        <input
                            required
                            className="w-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/80 rounded-xl px-3.5 py-2 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                            placeholder="e.g. 500mg"
                            value={dosage}
                            onChange={(e) => setDosage(e.target.value)}
                        />
                        <div className="flex items-center gap-1.5 pt-1 flex-wrap">
                            <span className="text-[11px] text-slate-400">Quick:</span>
                            {dosagePresets.map((d) => (
                                <button
                                    key={d}
                                    type="button"
                                    onClick={() => setDosage(d)}
                                    className={`text-[11px] px-2.5 py-0.5 rounded-full border transition-all ${
                                        dosage === d
                                            ? "bg-teal-50 dark:bg-teal-950/60 border-teal-300 dark:border-teal-700 text-teal-700 dark:text-teal-300 font-semibold"
                                            : "border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800"
                                    }`}
                                >
                                    {d}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                            <Tag className="w-3.5 h-3.5 text-amber-500" />
                            Instructions / Category
                        </label>
                        <div className="flex items-center gap-1.5 pt-0.5 flex-wrap">
                            {categoryPresets.map((cat) => (
                                <button
                                    key={cat}
                                    type="button"
                                    onClick={() => setCategory(cat)}
                                    className={`text-xs px-2.5 py-1 rounded-xl border transition-all ${
                                        category === cat
                                            ? "bg-indigo-50 dark:bg-indigo-950/60 border-indigo-300 dark:border-indigo-700 text-indigo-700 dark:text-indigo-300 font-semibold shadow-xs"
                                            : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800"
                                    }`}
                                >
                                    {cat}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                            <Clock className="w-3.5 h-3.5 text-blue-500" />
                            Times (comma-separated HH:MM)
                        </label>
                        <input
                            required
                            className="w-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/80 rounded-xl px-3.5 py-2 text-sm text-slate-900 dark:text-slate-100 font-mono placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                            placeholder="e.g. 08:00, 20:00"
                            value={times}
                            onChange={(e) => setTimes(e.target.value)}
                        />
                    </div>

                    {/* Inventory & Stock Management */}
                    <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-3">
                        <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800 dark:text-slate-200">
                            <Boxes className="w-3.5 h-3.5 text-indigo-500" />
                            <span>Inventory & Refill Settings</span>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            {/* Current Stock */}
                            <div className="space-y-1">
                                <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                                    Current Stock
                                </label>
                                <input
                                    type="number"
                                    min="0"
                                    required
                                    value={totalStock}
                                    onChange={(e) => setTotalStock(e.target.value)}
                                    className="w-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/80 rounded-xl px-3 py-1.5 text-sm font-bold text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                                />
                                <div className="flex items-center gap-1 pt-1 flex-wrap">
                                    {stockPresets.map((cnt) => (
                                        <button
                                            key={cnt}
                                            type="button"
                                            onClick={() => setTotalStock(cnt)}
                                            className={`text-[10px] px-2 py-0.5 rounded-lg border transition-all ${
                                                Number(totalStock) === cnt
                                                    ? "bg-indigo-50 dark:bg-indigo-950/60 border-indigo-300 dark:border-indigo-700 text-indigo-700 dark:text-indigo-300 font-bold"
                                                    : "border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800"
                                            }`}
                                        >
                                            {cnt}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Refill Threshold */}
                            <div className="space-y-1">
                                <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 flex items-center gap-1">
                                    <AlertTriangle className="w-3 h-3 text-amber-500" />
                                    <span>Low Stock Alert at</span>
                                </label>
                                <input
                                    type="number"
                                    min="1"
                                    required
                                    value={refillThreshold}
                                    onChange={(e) => setRefillThreshold(e.target.value)}
                                    className="w-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/80 rounded-xl px-3 py-1.5 text-sm font-bold text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                                />
                                <div className="flex items-center gap-1 pt-1">
                                    {[3, 5, 10].map((th) => (
                                        <button
                                            key={th}
                                            type="button"
                                            onClick={() => setRefillThreshold(th)}
                                            className={`text-[10px] px-2 py-0.5 rounded-lg border transition-all ${
                                                Number(refillThreshold) === th
                                                    ? "bg-amber-50 dark:bg-amber-950/60 border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-300 font-bold"
                                                    : "border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800"
                                            }`}
                                        >
                                            ≤{th}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Dose Unit Chips */}
                        <div className="space-y-1 pt-1">
                            <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                                Measurement Unit
                            </label>
                            <div className="flex items-center gap-1.5 flex-wrap">
                                {unitPresets.map((u) => (
                                    <button
                                        key={u}
                                        type="button"
                                        onClick={() => setDoseUnit(u)}
                                        className={`text-xs px-2.5 py-1 rounded-xl border capitalize transition-all ${
                                            doseUnit === u
                                                ? "bg-teal-50 dark:bg-teal-950/60 border-teal-300 dark:border-teal-700 text-teal-700 dark:text-teal-300 font-bold shadow-xs"
                                                : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800"
                                        }`}
                                    >
                                        {u}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-100 dark:border-slate-800">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-semibold transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={saving}
                            className="px-4 py-2 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white rounded-xl text-xs font-semibold shadow-sm hover:shadow transition-all flex items-center gap-1.5"
                        >
                            <Save className="w-3.5 h-3.5" />
                            {saving ? "Saving..." : "Save Changes"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}