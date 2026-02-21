import { useState, useRef, useEffect, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { type MatchItem } from "@/lib/mockUploadApis";
import { Send, Activity, User, Loader2, FileText, Stethoscope } from "lucide-react";
import { cn } from "@/lib/utils";

interface ChatMessage {
    role: "user" | "assistant";
    content: string;
}

interface TwinChatPanelProps {
    isOpen: boolean;
    onClose: () => void;
    match: MatchItem | null;
}

export function TwinChatPanel({ isOpen, onClose, match }: TwinChatPanelProps) {
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [input, setInput] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const endOfMessagesRef = useRef<HTMLDivElement>(null);

    // Resizing logic
    const [width, setWidth] = useState(400);
    const isDragging = useRef(false);

    const onMouseDown = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        isDragging.current = true;
        document.body.style.cursor = "ew-resize";
        document.body.style.userSelect = "none";

        const onMouseMove = (ev: MouseEvent) => {
            if (!isDragging.current) return;
            // Calculate new width based on mouse X position
            // Since it's anchored to the right, width = window.innerWidth - ev.clientX - right_margin(24px)
            const newWidth = window.innerWidth - ev.clientX - 24;
            // Constrain width
            setWidth(Math.max(320, Math.min(800, newWidth)));
        };

        const onMouseUp = () => {
            isDragging.current = false;
            document.body.style.cursor = "";
            document.body.style.userSelect = "";
            window.removeEventListener("mousemove", onMouseMove);
            window.removeEventListener("mouseup", onMouseUp);
        };

        window.addEventListener("mousemove", onMouseMove);
        window.addEventListener("mouseup", onMouseUp);
    }, []);

    // Initialize welcoming message
    useEffect(() => {
        if (isOpen && messages.length === 0 && match) {
            setMessages([
                {
                    role: "assistant",
                    content: `Hi! I have loaded the context of the historical case from ${match.facility} (${match.outcome} outcome). Feel free to ask me questions about their treatment protocol, presenting symptoms, or specific findings comparison.`
                }
            ]);
        }
    }, [isOpen, match, messages.length]);

    // Scroll to bottom
    useEffect(() => {
        endOfMessagesRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    if (!match) return null;

    const handleSend = async () => {
        if (!input.trim() || isLoading) return;

        const userMsg = input.trim();
        setInput("");
        setMessages(prev => [...prev, { role: "user", content: userMsg }]);
        setIsLoading(true);

        try {
            const formData = new FormData();
            formData.append("query", userMsg);
            formData.append("case_text", match.case_text || match.summary || match.diagnosis);

            const response = await fetch("http://localhost:8000/chat_twin", {
                method: "POST",
                body: formData,
            });

            if (!response.ok) {
                throw new Error("Chat request failed");
            }

            const data = await response.json();
            setMessages(prev => [...prev, { role: "assistant", content: data.reply }]);
        } catch (err) {
            console.error(err);
            setMessages(prev => [...prev, { role: "assistant", content: "I'm sorry, I couldn't connect to the twin case reasoning engine right now." }]);
        } finally {
            setIsLoading(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    return (
        <>
            {/* Backdrop */}
            <div
                className={cn(
                    "fixed inset-0 z-50 bg-slate-900/20 backdrop-blur-sm transition-opacity duration-300",
                    isOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
                )}
                onClick={onClose}
            />

            {/* Slide-over panel */}
            <div
                className={cn(
                    "fixed bottom-24 right-6 z-50 h-[80vh] min-h-[500px] max-h-[900px] bg-white border border-zinc-200 shadow-2xl rounded-2xl overflow-hidden transition-all duration-300 ease-[cubic-bezier(0.23,1,0.32,1)] flex flex-col origin-bottom-right",
                    isOpen ? "opacity-100 scale-100 translate-y-0" : "opacity-0 scale-95 translate-y-4 pointer-events-none"
                )}
                style={{ width: `${width}px`, transition: isDragging.current ? "none" : undefined }}
            >
                {/* Drag Handle (Left Edge) */}
                <div
                    onMouseDown={onMouseDown}
                    className="absolute left-0 top-0 bottom-0 w-2 cursor-ew-resize hover:bg-zinc-200/50 active:bg-zinc-200/80 transition-colors z-50 flex items-center justify-center group"
                >
                    <div className="h-10 w-1 bg-zinc-300 rounded-full opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
                {/* Header */}
                <div className="flex-shrink-0 px-6 py-4 border-b bg-white border-zinc-100 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-zinc-100 border border-zinc-200">
                            <Activity className="h-5 w-5 text-zinc-800" />
                        </div>
                        <div>
                            <h2 className="text-base font-bold text-zinc-900 leading-tight">
                                Clinical Copilot: Case Context
                            </h2>
                            <p className="text-xs text-zinc-500 flex items-center gap-1 mt-0.5">
                                <FileText className="h-3 w-3" /> Grounded in {match.pmc_id || "Historical Evidence"}
                            </p>
                        </div>
                    </div>
                </div>

                {/* Chat Messages */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-zinc-50/50">
                    {messages.map((msg, i) => (
                        <div key={i} className={cn("flex gap-4 max-w-[85%]", msg.role === "user" ? "ml-auto flex-row-reverse" : "mr-auto")}>
                            <div className={cn(
                                "flex h-8 w-8 shrink-0 items-center justify-center rounded-full mt-1 border",
                                msg.role === "user" ? "bg-white border-zinc-200" : "bg-zinc-100 border-zinc-200"
                            )}>
                                {msg.role === "user" ? <User className="h-4 w-4 text-zinc-600" /> : <Activity className="h-4 w-4 text-zinc-800" />}
                            </div>
                            <div className={cn(
                                "px-4 py-3 rounded-2xl text-[14px] leading-relaxed",
                                msg.role === "user" ? "bg-zinc-800 text-white shadow-sm" : "bg-white text-zinc-900 border border-zinc-200 shadow-sm"
                            )}>
                                {msg.content}
                            </div>
                        </div>
                    ))}
                    {isLoading && (
                        <div className="flex gap-4 max-w-[85%] mr-auto">
                            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full mt-1 bg-zinc-100 border border-zinc-200">
                                <Activity className="h-4 w-4 text-zinc-800" />
                            </div>
                            <div className="px-5 py-4 rounded-2xl bg-white border border-zinc-200 shadow-sm flex items-center gap-2 text-zinc-500 text-sm">
                                <Loader2 className="h-4 w-4 animate-spin text-zinc-800" /> Computing...
                            </div>
                        </div>
                    )}
                    <div ref={endOfMessagesRef} />
                </div>

                {/* Input Area */}
                <div className="p-4 bg-white border-t border-zinc-100">
                    <div className="relative flex items-end gap-2 bg-zinc-50 border border-zinc-200 rounded-2xl p-2 focus-within:ring-2 focus-within:ring-zinc-500/10 focus-within:border-zinc-400 transition-all shadow-sm">
                        <textarea
                            value={input}
                            onChange={e => setInput(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder="Ask about context, outcomes..."
                            className="w-full max-h-32 min-h-[44px] bg-transparent border-none focus:ring-0 resize-none px-3 py-2.5 text-[14px] text-zinc-900 placeholder:text-zinc-400 focus:outline-none"
                            rows={1}
                        />
                        <button
                            onClick={handleSend}
                            disabled={!input.trim() || isLoading}
                            className="flex shrink-0 items-center justify-center h-10 w-10 bg-zinc-900 text-white rounded-xl hover:bg-zinc-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed mb-0.5 mr-0.5 shadow-sm shadow-zinc-900/20"
                        >
                            <Send className="h-4 w-4 ml-0.5" />
                        </button>
                    </div>
                </div>
            </div>
        </>
    );
}
