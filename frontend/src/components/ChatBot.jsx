import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import {
    Bot,
    Sparkles,
    Send,
    X,
    RotateCcw,
    CheckCircle2,
    Clock,
    Pill,
    AlertCircle,
    ChevronDown,
    Boxes,
    Maximize2,
    Minimize2,
    MessageSquare,
    Flame,
    ArrowRight,
    Check,
} from "lucide-react";
import { API_BASE_URL } from "../api";

const API = API_BASE_URL;

// Simple, lightweight markdown-to-JSX renderer for formatted bot answers
function FormattedMessage({ content }) {
    if (!content) return null;

    const lines = content.split("\n");
    return (
        <div className="space-y-1.5 text-xs sm:text-sm leading-relaxed">
            {lines.map((line, idx) => {
                const trimmed = line.trim();
                if (!trimmed) {
                    return <div key={idx} className="h-1" />;
                }

                // Bullet point
                if (trimmed.startsWith("•") || trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
                    const cleanText = trimmed.replace(/^[•\-\*]\s*/, "");
                    return (
                        <div key={idx} className="flex items-start gap-2 pl-1">
                            <span className="text-indigo-500 font-bold mt-1 text-[10px]">•</span>
                            <span>{renderFormattedSpans(cleanText)}</span>
                        </div>
                    );
                }

                return <p key={idx}>{renderFormattedSpans(trimmed)}</p>;
            })}
        </div>
    );
}

// Helper to render bold **text**, *italics*, and backtick `code`
function renderFormattedSpans(text) {
    const parts = [];
    let remaining = text;
    let keyIdx = 0;

    // Pattern matching bold **...**, code `...`, italics *...*
    const regex = /(\*\*(.*?)\*\*|`([^`]+)`|\*([^*]+)\*)/g;
    let match;
    let lastIndex = 0;

    while ((match = regex.exec(text)) !== null) {
        // Push preceding plain text
        if (match.index > lastIndex) {
            parts.push(
                <span key={keyIdx++}>{text.substring(lastIndex, match.index)}</span>
            );
        }

        if (match[2] !== undefined) {
            // Bold
            parts.push(
                <strong key={keyIdx++} className="font-semibold text-slate-900 dark:text-slate-100">
                    {match[2]}
                </strong>
            );
        } else if (match[3] !== undefined) {
            // Code / tag
            parts.push(
                <code
                    key={keyIdx++}
                    className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 font-mono text-[11px] text-indigo-600 dark:text-indigo-400 font-semibold"
                >
                    {match[3]}
                </code>
            );
        } else if (match[4] !== undefined) {
            // Italics
            parts.push(
                <em key={keyIdx++} className="italic text-slate-600 dark:text-slate-300">
                    {match[4]}
                </em>
            );
        }

        lastIndex = regex.lastIndex;
    }

    if (lastIndex < text.length) {
        parts.push(<span key={keyIdx++}>{text.substring(lastIndex)}</span>);
    }

    return parts;
}

export default function ChatBot({ currentUser, onActionExecuted, patientId }) {
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState(() => [
        {
            role: "assistant",
            content: currentUser
                ? `Hello **${currentUser?.full_name || "there"}**! 👋 I'm **MediBot**, your clinical medication assistant.\n\nI have full visibility of your active prescriptions, allergies, schedule, and adherence streaks.\n\nHow can I help you manage your routine today?`
                : `Hello! 👋 I'm **MediBot**, your clinical AI medication assistant.\n\nYou can ask me general questions about medications, food interactions, and adherence, or **Sign In / Demo Login** to track your personal prescriptions.\n\nHow can I help you today?`,
            action: null,
            suggested_prompts: currentUser
                ? [
                      "What medicines do I have left today?",
                      "Are there any food interactions with my medications?",
                      "Check for allergy conflicts with my prescriptions",
                      "How is my adherence streak this week?",
                  ]
                : [
                      "What are common food interactions with Metformin?",
                      "How should I take blood pressure medications?",
                      "What is the best way to maintain medication adherence?",
                      "Explain side effects of common antibiotics",
                  ],
        },
    ]);
    const [input, setInput] = useState("");
    const [loading, setLoading] = useState(false);
    const [executingActionId, setExecutingActionId] = useState(null);
    const [actionFeedback, setActionFeedback] = useState({});

    const messagesEndRef = useRef(null);
    const inputRef = useRef(null);

    // Update greeting if user logs in/out
    useEffect(() => {
        setMessages((prev) => {
            if (prev.length <= 1) {
                return [
                    {
                        role: "assistant",
                        content: currentUser
                            ? `Hello **${currentUser?.full_name || "there"}**! 👋 I'm **MediBot**, your clinical medication assistant.\n\nI have full visibility of your active prescriptions, allergies, schedule, and adherence streaks.\n\nHow can I help you manage your routine today?`
                            : `Hello! 👋 I'm **MediBot**, your clinical AI medication assistant.\n\nYou can ask me general questions about medications, food interactions, and adherence, or **Sign In / Demo Login** to track your personal prescriptions.\n\nHow can I help you today?`,
                        action: null,
                        suggested_prompts: currentUser
                            ? [
                                  "What medicines do I have left today?",
                                  "Are there any food interactions with my medications?",
                                  "Check for allergy conflicts with my prescriptions",
                                  "How is my adherence streak this week?",
                              ]
                            : [
                                  "What are common food interactions with Metformin?",
                                  "How should I take blood pressure medications?",
                                  "What is the best way to maintain medication adherence?",
                                  "Explain side effects of common antibiotics",
                              ],
                    },
                ];
            }
            return prev;
        });
    }, [currentUser]);

    // Auto-scroll to bottom
    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        if (isOpen) {
            scrollToBottom();
            setTimeout(() => inputRef.current?.focus(), 150);
        }
    }, [isOpen, messages]);

    const handleSend = async (textToSend) => {
        const query = (textToSend || input).trim();
        if (!query || loading) return;

        const newMessages = [...messages, { role: "user", content: query }];
        setMessages(newMessages);
        setInput("");
        setLoading(true);

        try {
            const payload = {
                messages: newMessages.map((m) => ({
                    role: m.role === "assistant" ? "assistant" : "user",
                    content: m.content,
                })),
                patient_id: patientId || null,
            };

            const res = await axios.post(`${API}/chat`, payload);
            const data = res.data;

            setMessages((prev) => [
                ...prev,
                {
                    role: "assistant",
                    content: data.reply,
                    action: data.action || null,
                    suggested_prompts: data.suggested_prompts || [],
                    powered_by: data.powered_by,
                },
            ]);
        } catch (err) {
            console.error("MediBot Chat Error", err);
            setMessages((prev) => [
                ...prev,
                {
                    role: "assistant",
                    content:
                        "⚠️ I apologize, but I encountered an issue connecting to the clinical assistant service. Please check your network connection and try again.",
                    action: null,
                },
            ]);
        } finally {
            setLoading(false);
        }
    };

    const handleExecuteAction = async (action, msgIndex) => {
        if (!action) return;
        setExecutingActionId(msgIndex);

        try {
            const queryParam = patientId ? `?patient_id=${patientId}` : "";
            const res = await axios.post(`${API}/chat/execute-action${queryParam}`, action);

            setActionFeedback((prev) => ({
                ...prev,
                [msgIndex]: res.data?.message || "Action successfully completed!",
            }));

            // Notify parent dashboard to re-fetch medicines, streak, and logs
            if (onActionExecuted) {
                onActionExecuted(action);
            }
        } catch (err) {
            console.error("Action execution failed", err);
            setActionFeedback((prev) => ({
                ...prev,
                [msgIndex]: err.response?.data?.detail || "Failed to execute action.",
            }));
        } finally {
            setExecutingActionId(null);
        }
    };

    const handleResetChat = () => {
        setMessages([
            {
                role: "assistant",
                content: `Chat history cleared! 👋 How can I help you with your medication routine, **${currentUser?.full_name || "Patient"}**?`,
                action: null,
                suggested_prompts: [
                    "What medicines do I have left today?",
                    "Are there any food interactions with my medications?",
                    "Check for allergy conflicts with my prescriptions",
                    "How is my adherence streak this week?",
                ],
            },
        ]);
        setActionFeedback({});
    };

    return (
        <>
            {/* Floating Trigger Button */}
            {!isOpen && (
                <button
                    type="button"
                    onClick={() => setIsOpen(true)}
                    className="fixed bottom-6 right-6 z-40 group flex items-center gap-2.5 px-4 py-3 bg-gradient-to-r from-teal-600 via-indigo-600 to-indigo-700 hover:from-teal-700 hover:to-indigo-800 text-white rounded-2xl shadow-xl shadow-indigo-500/25 hover:shadow-2xl hover:scale-105 active:scale-95 transition-all duration-200"
                    title="Open MediBot AI Health Assistant"
                >
                    <div className="relative">
                        <Bot className="w-5 h-5" />
                        <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-emerald-400 rounded-full border-2 border-white dark:border-slate-900 animate-pulse" />
                    </div>
                    <div className="text-left hidden sm:block">
                        <span className="block text-xs font-bold leading-tight flex items-center gap-1">
                            <span>Ask MediBot</span>
                            <Sparkles className="w-3 h-3 text-amber-300" />
                        </span>
                        <span className="block text-[10px] text-teal-100 font-medium">
                            Clinical AI Assistant
                        </span>
                    </div>
                </button>
            )}

            {/* Chat Drawer / Modal Window */}
            {isOpen && (
                <div className="fixed bottom-4 sm:bottom-6 right-4 sm:right-6 z-50 w-[calc(100vw-2rem)] sm:w-[430px] h-[600px] max-h-[85vh] bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
                    {/* Header */}
                    <div className="px-5 py-3.5 bg-gradient-to-r from-teal-600 via-indigo-600 to-indigo-700 text-white flex items-center justify-between shrink-0 shadow-xs">
                        <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl bg-white/20 backdrop-blur-md flex items-center justify-center text-white font-bold shrink-0">
                                <Bot className="w-5 h-5" />
                            </div>
                            <div>
                                <div className="flex items-center gap-1.5">
                                    <h3 className="text-sm font-extrabold tracking-tight">
                                        MediBot AI
                                    </h3>
                                    <span className="text-[10px] uppercase font-bold px-1.5 py-0.2 rounded-full bg-white/20 text-white border border-white/25">
                                        Gemini
                                    </span>
                                </div>
                                <p className="text-[11px] text-teal-100 flex items-center gap-1">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse inline-block" />
                                    <span>Context-aware medication assistant</span>
                                </p>
                            </div>
                        </div>

                        <div className="flex items-center gap-1 text-white/80">
                            <button
                                type="button"
                                onClick={handleResetChat}
                                className="p-1.5 hover:text-white hover:bg-white/10 rounded-lg transition"
                                title="Reset conversation"
                            >
                                <RotateCcw className="w-4 h-4" />
                            </button>
                            <button
                                type="button"
                                onClick={() => setIsOpen(false)}
                                className="p-1.5 hover:text-white hover:bg-white/10 rounded-lg transition"
                                title="Close chat"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                    </div>

                    {/* Chat Messages Body */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/50 dark:bg-slate-950/40 text-slate-800 dark:text-slate-100">
                        {messages.map((msg, index) => {
                            const isUser = msg.role === "user";
                            const feedback = actionFeedback[index];

                            return (
                                <div
                                    key={index}
                                    className={`flex items-start gap-2.5 ${
                                        isUser ? "flex-row-reverse" : "flex-row"
                                    }`}
                                >
                                    {/* Avatar */}
                                    <div
                                        className={`w-7 h-7 rounded-xl flex items-center justify-center shrink-0 text-xs font-bold ${
                                            isUser
                                                ? "bg-indigo-600 text-white shadow-xs"
                                                : "bg-teal-500/10 dark:bg-teal-500/20 text-teal-600 dark:text-teal-400 border border-teal-200 dark:border-teal-800"
                                        }`}
                                    >
                                        {isUser ? (
                                            currentUser?.full_name ? (
                                                currentUser.full_name[0].toUpperCase()
                                            ) : (
                                                "U"
                                            )
                                        ) : (
                                            <Bot className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                                        )}
                                    </div>

                                    {/* Message Bubble */}
                                    <div
                                        className={`max-w-[82%] rounded-2xl p-3.5 shadow-2xs space-y-2 ${
                                            isUser
                                                ? "bg-gradient-to-r from-indigo-600 to-indigo-700 text-white rounded-tr-none text-xs sm:text-sm font-medium"
                                                : "bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-tl-none text-slate-800 dark:text-slate-200"
                                        }`}
                                    >
                                        <FormattedMessage content={msg.content} />

                                        {/* Structured Action Proposal Card */}
                                        {msg.action && (
                                            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-2">
                                                <div className="bg-indigo-50/70 dark:bg-indigo-950/50 border border-indigo-200/80 dark:border-indigo-800/80 rounded-xl p-2.5 text-xs">
                                                    <div className="flex items-center gap-1.5 font-bold text-indigo-900 dark:text-indigo-200 mb-1">
                                                        <Sparkles className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                                                        <span>Suggested Health Action:</span>
                                                    </div>
                                                    <p className="text-slate-600 dark:text-slate-300">
                                                        {msg.action.description ||
                                                            `Log ${msg.action.medicine_name} as ${msg.action.status}`}
                                                    </p>
                                                </div>

                                                {feedback ? (
                                                    <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 p-2 rounded-xl border border-emerald-200 dark:border-emerald-800">
                                                        <CheckCircle2 className="w-3.5 h-3.5" />
                                                        <span>{feedback}</span>
                                                    </div>
                                                ) : (
                                                    <button
                                                        type="button"
                                                        disabled={executingActionId === index}
                                                        onClick={() =>
                                                            handleExecuteAction(msg.action, index)
                                                        }
                                                        className="w-full flex items-center justify-center gap-1.5 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition shadow-xs disabled:opacity-50"
                                                    >
                                                        <Check className="w-3.5 h-3.5" />
                                                        <span>
                                                            {executingActionId === index
                                                                ? "Updating Schedule..."
                                                                : "Confirm & Update Schedule"}
                                                        </span>
                                                    </button>
                                                )}
                                            </div>
                                        )}

                                        {/* Suggested Prompt Chips */}
                                        {!isUser &&
                                            msg.suggested_prompts &&
                                            msg.suggested_prompts.length > 0 &&
                                            index === messages.length - 1 && (
                                                <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-1.5">
                                                    <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                                                        Quick suggestions:
                                                    </span>
                                                    <div className="flex flex-col gap-1">
                                                        {msg.suggested_prompts.map((prompt, pIdx) => (
                                                            <button
                                                                key={pIdx}
                                                                type="button"
                                                                onClick={() => handleSend(prompt)}
                                                                className="text-left text-[11px] px-2.5 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-800/80 hover:bg-indigo-50 dark:hover:bg-indigo-950/60 text-slate-700 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 border border-slate-200/70 dark:border-slate-700 transition flex items-center justify-between group"
                                                            >
                                                                <span>{prompt}</span>
                                                                <ArrowRight className="w-3 h-3 text-slate-400 group-hover:text-indigo-600 shrink-0 ml-1" />
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                    </div>
                                </div>
                            );
                        })}

                        {/* Loading / Thinking Indicator */}
                        {loading && (
                            <div className="flex items-start gap-2.5">
                                <div className="w-7 h-7 rounded-xl bg-teal-500/10 dark:bg-teal-500/20 text-teal-600 dark:text-teal-400 border border-teal-200 dark:border-teal-800 flex items-center justify-center shrink-0">
                                    <Bot className="w-4 h-4" />
                                </div>
                                <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl rounded-tl-none p-3 shadow-2xs flex items-center gap-1.5 text-xs text-slate-500">
                                    <Sparkles className="w-3.5 h-3.5 text-indigo-500 animate-spin" />
                                    <span>Reviewing your medical context...</span>
                                    <span className="inline-flex gap-1 ml-1">
                                        <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce [animation-delay:-0.3s]" />
                                        <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce [animation-delay:-0.15s]" />
                                        <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce" />
                                    </span>
                                </div>
                            </div>
                        )}

                        <div ref={messagesEndRef} />
                    </div>

                    {/* Footer / Input Bar */}
                    <div className="p-3 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 space-y-2 shrink-0">
                        <form
                            onSubmit={(e) => {
                                e.preventDefault();
                                handleSend();
                            }}
                            className="flex items-center gap-2"
                        >
                            <input
                                ref={inputRef}
                                type="text"
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                placeholder="Ask about medicines, food instructions, allergies..."
                                className="flex-1 px-3.5 py-2 text-xs sm:text-sm bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition"
                            />
                            <button
                                type="submit"
                                disabled={!input.trim() || loading}
                                className="p-2.5 bg-gradient-to-r from-teal-600 to-indigo-600 hover:from-teal-700 hover:to-indigo-700 text-white rounded-xl shadow-xs disabled:opacity-40 transition flex items-center justify-center shrink-0"
                                title="Send message"
                            >
                                <Send className="w-4 h-4" />
                            </button>
                        </form>

                        <p className="text-[10px] text-center text-slate-400 dark:text-slate-500 leading-tight">
                            MediBot provides clinical guidance, not professional diagnosis. In emergencies, contact local emergency services immediately.
                        </p>
                    </div>
                </div>
            )}
        </>
    );
}
