import React, { useState } from "react";
import axios from "axios";
import {
    Pill,
    Shield,
    Lock,
    Mail,
    User,
    ArrowRight,
    Sparkles,
    CheckCircle2,
    Sun,
    Moon,
    AlertCircle,
} from "lucide-react";
import { API_BASE_URL } from "../api";

export default function AuthView({ onAuthSuccess, theme, toggleTheme }) {
    const [isLogin, setIsLogin] = useState(true);
    const [fullName, setFullName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError("");
        setLoading(true);

        try {
            let res;
            if (isLogin) {
                res = await axios.post(`${API_BASE_URL}/auth/login`, {
                    email: email.trim(),
                    password: password,
                });
            } else {
                res = await axios.post(`${API_BASE_URL}/auth/register`, {
                    full_name: fullName.trim(),
                    email: email.trim(),
                    password: password,
                });
            }
            const { access_token, user } = res.data;
            localStorage.setItem("authToken", access_token);
            onAuthSuccess(access_token, user);
        } catch (err) {
            console.error("Auth error", err);
            let msg = isLogin
                ? "Failed to sign in. Please verify your email and password."
                : "Failed to create account. Please check your details.";
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
            const res = await axios.post(`${API_BASE_URL}/auth/login`, {
                email: "demo@meditracker.com",
                password: "Password123!",
            });
            const { access_token, user } = res.data;
            localStorage.setItem("authToken", access_token);
            onAuthSuccess(access_token, user);
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
        <div className="min-h-screen flex flex-col justify-center items-center px-4 py-12 relative overflow-hidden bg-slate-50/80 dark:bg-slate-950">
            {/* Ambient Background Gradient Glows */}
            <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-teal-400/20 dark:bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute bottom-10 left-10 w-80 h-80 bg-indigo-400/15 dark:bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

            {/* Top Bar with Theme Toggle */}
            <div className="absolute top-6 right-6 z-10">
                <button
                    type="button"
                    onClick={toggleTheme}
                    className="p-2.5 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-all shadow-xs backdrop-blur-md"
                    title={`Switch to ${theme === "dark" ? "Light" : "Dark"} Mode`}
                >
                    {theme === "dark" ? (
                        <Sun className="w-4 h-4 text-amber-400" />
                    ) : (
                        <Moon className="w-4 h-4 text-slate-600" />
                    )}
                </button>
            </div>

            {/* Main Auth Container */}
            <div className="w-full max-w-md space-y-6 z-10">
                {/* Brand Header */}
                <div className="text-center space-y-2">
                    <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-tr from-teal-600 to-indigo-600 text-white shadow-lg shadow-teal-500/25 mb-1">
                        <Pill className="w-7 h-7" />
                    </div>
                    <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100">
                        Medi Tracker
                    </h1>
                    <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xs mx-auto">
                        Precision medication adherence, real-time stock tracking, and clinical wellness insights.
                    </p>
                </div>

                {/* Card */}
                <div className="bg-white dark:bg-slate-900/90 rounded-3xl p-6 sm:p-8 border border-slate-200/80 dark:border-slate-800 shadow-xl backdrop-blur-md space-y-6">
                    {/* Mode Toggle Tabs */}
                    <div className="grid grid-cols-2 p-1 bg-slate-100 dark:bg-slate-800 rounded-2xl">
                        <button
                            type="button"
                            onClick={() => {
                                setIsLogin(true);
                                setError("");
                            }}
                            className={`py-2 text-xs font-bold rounded-xl transition-all ${
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
                            className={`py-2 text-xs font-bold rounded-xl transition-all ${
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
                        <div className="p-3 bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900/60 rounded-xl text-xs text-rose-700 dark:text-rose-300 flex items-start gap-2 animate-in fade-in">
                            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-500" />
                            <span>{error}</span>
                        </div>
                    )}

                    {/* Form */}
                    <form onSubmit={handleSubmit} className="space-y-4">
                        {!isLogin && (
                            <div className="space-y-1.5 animate-in fade-in duration-150">
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
                                    className="w-full border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/80 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                                />
                            </div>
                        )}

                        <div className="space-y-1.5">
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
                                className="w-full border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/80 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                            />
                        </div>

                        <div className="space-y-1.5">
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
                                className="w-full border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/80 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full py-2.5 bg-gradient-to-r from-teal-600 to-indigo-600 hover:from-teal-700 hover:to-indigo-700 text-white rounded-xl text-xs font-bold shadow-md shadow-indigo-500/20 hover:shadow-lg transition-all flex items-center justify-center gap-2 mt-2 disabled:opacity-60"
                        >
                            <span>{loading ? "Processing..." : isLogin ? "Sign In to Tracker" : "Create My Account"}</span>
                            <ArrowRight className="w-4 h-4" />
                        </button>
                    </form>

                    {/* Quick Demo Credentials */}
                    <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                        <button
                            type="button"
                            onClick={handleDemoLogin}
                            disabled={loading}
                            className="w-full py-2 bg-slate-50 dark:bg-slate-800/80 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-semibold border border-slate-200 dark:border-slate-700 transition-colors flex items-center justify-center gap-2"
                        >
                            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                            <span>Try Instant Demo (Dr. Alex Taylor)</span>
                        </button>
                    </div>
                </div>

                {/* Features Highlights */}
                <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="p-2.5 rounded-xl bg-white/60 dark:bg-slate-900/60 border border-slate-200/60 dark:border-slate-800/60 backdrop-blur-xs">
                        <CheckCircle2 className="w-4 h-4 text-emerald-500 mx-auto mb-1" />
                        <span className="text-[10px] font-semibold text-slate-600 dark:text-slate-400">
                            Isolated Data
                        </span>
                    </div>
                    <div className="p-2.5 rounded-xl bg-white/60 dark:bg-slate-900/60 border border-slate-200/60 dark:border-slate-800/60 backdrop-blur-xs">
                        <Shield className="w-4 h-4 text-indigo-500 mx-auto mb-1" />
                        <span className="text-[10px] font-semibold text-slate-600 dark:text-slate-400">
                            JWT Security
                        </span>
                    </div>
                    <div className="p-2.5 rounded-xl bg-white/60 dark:bg-slate-900/60 border border-slate-200/60 dark:border-slate-800/60 backdrop-blur-xs">
                        <Sparkles className="w-4 h-4 text-teal-500 mx-auto mb-1" />
                        <span className="text-[10px] font-semibold text-slate-600 dark:text-slate-400">
                            Smart Refills
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
}
