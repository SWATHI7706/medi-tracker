import React, { useState } from "react";
import axios from "axios";
import {
    Pill,
    X,
    Lock,
    Mail,
    User,
    ArrowRight,
    Sparkles,
    Shield,
    AlertCircle,
    CheckCircle2,
} from "lucide-react";
import { API_BASE_URL } from "../api";

const API = API_BASE_URL;

export default function AuthModal({ isOpen, onClose, onAuthSuccess, initialMode = "login" }) {
    const [isLogin, setIsLogin] = useState(initialMode === "login");
    const [fullName, setFullName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    if (!isOpen) return null;

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError("");
        setLoading(true);

        try {
            let res;
            if (isLogin) {
                res = await axios.post(`${API}/auth/login`, {
                    email: email.trim(),
                    password: password,
                });
            } else {
                res = await axios.post(`${API}/auth/register`, {
                    full_name: fullName.trim(),
                    email: email.trim(),
                    password: password,
                });
            }

            const { access_token, user } = res.data;
            localStorage.setItem("authToken", access_token);
            if (onAuthSuccess) {
                onAuthSuccess(access_token, user);
            }
            if (onClose) {
                onClose();
            }
        } catch (err) {
            console.error("Auth error", err);
            let msg = isLogin
                ? "Failed to sign in. Please check your email and password."
                : "Failed to create account. Please ensure all details are provided.";
            if (err.response?.data?.detail) {
                const detail = err.response.data.detail;
                if (typeof detail === "string") {
                    msg = detail;
                } else if (Array.isArray(detail)) {
                    msg = detail.map((d) => d.msg || JSON.stringify(d)).join(", ");
                } else if (typeof detail === "object") {
                    msg = JSON.stringify(detail);
                }
            } else if (err.message) {
                msg = `Connection error: ${err.message}`;
            }
            setError(msg);
        } finally {
            setLoading(false);
        }
    };

    const handleDemoLogin = async () => {
        setError("");
        setLoading(true);
        try {
            const res = await axios.post(`${API}/auth/login`, {
                email: "demo@meditracker.com",
                password: "Password123!",
            });
            const { access_token, user } = res.data;
            localStorage.setItem("authToken", access_token);
            if (onAuthSuccess) {
                onAuthSuccess(access_token, user);
            }
            if (onClose) {
                onClose();
            }
        } catch (err) {
            console.error("Demo login error", err);
            let msg = "Could not sign in with demo account.";
            if (err.response?.data?.detail) {
                const detail = err.response.data.detail;
                msg = typeof detail === "string" ? detail : (Array.isArray(detail) ? detail.map((d) => d.msg || "").join(", ") : JSON.stringify(detail));
            } else if (err.message) {
                msg = `Connection error: ${err.message}`;
            }
            setError(msg);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-md bg-slate-900/40 animate-in fade-in duration-200">
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 max-w-md w-full border border-slate-200/80 dark:border-slate-800 shadow-2xl space-y-5 animate-in zoom-in-95 duration-200 relative">
                {/* Close Button */}
                {onClose && (
                    <button
                        type="button"
                        onClick={onClose}
                        className="absolute top-5 right-5 p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
                        title="Close"
                    >
                        <X className="w-5 h-5" />
                    </button>
                )}

                {/* Brand Header */}
                <div className="text-center space-y-1.5 pt-1">
                    <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-gradient-to-tr from-teal-500 to-indigo-600 text-white shadow-md shadow-indigo-500/20 mb-1">
                        <Pill className="w-6 h-6" />
                    </div>
                    <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
                        {isLogin ? "Welcome Back to Medi Tracker" : "Create Your Medi Tracker Account"}
                    </h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xs mx-auto">
                        {isLogin
                            ? "Sign in to access your personal prescriptions, streaks, and adherence logs."
                            : "Join to track your medication routine with isolated, clinical-grade security."}
                    </p>
                </div>

                {/* Mode Switcher Tabs */}
                <div className="grid grid-cols-2 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
                    <button
                        type="button"
                        onClick={() => {
                            setIsLogin(true);
                            setError("");
                        }}
                        className={`py-2 text-xs font-bold rounded-lg transition-all ${
                            isLogin
                                ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs"
                                : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
                        }`}
                    >
                        Sign In
                    </button>
                    <button
                        type="button"
                        onClick={() => {
                            setIsLogin(false);
                            setError("");
                        }}
                        className={`py-2 text-xs font-bold rounded-lg transition-all ${
                            !isLogin
                                ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs"
                                : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
                        }`}
                    >
                        Create Account
                    </button>
                </div>

                {/* Error Banner */}
                {error && (
                    <div className="p-3 bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900 rounded-xl text-xs text-rose-700 dark:text-rose-300 flex items-start gap-2">
                        <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-500" />
                        <span>{error}</span>
                    </div>
                )}

                {/* Form */}
                <form onSubmit={handleSubmit} className="space-y-3.5">
                    {!isLogin && (
                        <div className="space-y-1">
                            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                                <User className="w-3.5 h-3.5 text-indigo-500" />
                                Full Name
                            </label>
                            <input
                                type="text"
                                required
                                placeholder="e.g. Dr. Alex Taylor"
                                value={fullName}
                                onChange={(e) => setFullName(e.target.value)}
                                className="w-full border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/80 rounded-xl px-3.5 py-2 text-xs sm:text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                            />
                        </div>
                    )}

                    <div className="space-y-1">
                        <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                            <Mail className="w-3.5 h-3.5 text-teal-500" />
                            Email Address
                        </label>
                        <input
                            type="email"
                            required
                            placeholder="name@example.com"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="w-full border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/80 rounded-xl px-3.5 py-2 text-xs sm:text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                        />
                    </div>

                    <div className="space-y-1">
                        <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                            <Lock className="w-3.5 h-3.5 text-amber-500" />
                            Password
                        </label>
                        <input
                            type="password"
                            required
                            minLength={6}
                            placeholder="••••••••"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/80 rounded-xl px-3.5 py-2 text-xs sm:text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full py-2.5 bg-gradient-to-r from-teal-600 to-indigo-600 hover:from-teal-700 hover:to-indigo-700 text-white rounded-xl text-xs sm:text-sm font-bold shadow-md shadow-indigo-500/20 hover:shadow-lg transition-all flex items-center justify-center gap-2 mt-2 disabled:opacity-60"
                    >
                        <span>{loading ? "Authenticating..." : isLogin ? "Sign In to Tracker" : "Create My Account"}</span>
                        <ArrowRight className="w-4 h-4" />
                    </button>
                </form>

                {/* Instant Demo Option */}
                <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-2">
                    <button
                        type="button"
                        onClick={handleDemoLogin}
                        disabled={loading}
                        className="w-full py-2 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-semibold border border-slate-200 dark:border-slate-700 transition-colors flex items-center justify-center gap-2"
                    >
                        <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                        <span>Instant Demo (Dr. Alex Taylor)</span>
                    </button>
                </div>

                {/* Security Highlights */}
                <div className="grid grid-cols-3 gap-2 text-center pt-1">
                    <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 mx-auto mb-0.5" />
                        <span className="text-[10px] font-semibold text-slate-600 dark:text-slate-400">Isolated Data</span>
                    </div>
                    <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700">
                        <Shield className="w-3.5 h-3.5 text-indigo-500 mx-auto mb-0.5" />
                        <span className="text-[10px] font-semibold text-slate-600 dark:text-slate-400">JWT Encrypted</span>
                    </div>
                    <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700">
                        <Sparkles className="w-3.5 h-3.5 text-teal-500 mx-auto mb-0.5" />
                        <span className="text-[10px] font-semibold text-slate-600 dark:text-slate-400">Smart Refills</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
