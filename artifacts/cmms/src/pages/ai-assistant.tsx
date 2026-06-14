import { useState, useRef, useEffect, useCallback } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import {
  Bot, Send, Trash2, Plus, ChevronDown, ChevronRight,
  FileText, FolderOpen, Search, Database, Code2, Pencil,
  CheckCircle2, AlertCircle, Loader2, Sparkles, Terminal,
  Copy, Check, RefreshCw,
} from "lucide-react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

// ── Types ────────────────────────────────────────────────────────────────────

type ToolEvent =
  | { type: "tool_start"; id: string; name: string; args: Record<string, any> }
  | { type: "tool_end";   id: string; name: string; preview: string };

interface Message {
  id: string;
  role: "user" | "assistant" | "error";
  content: string;
  toolEvents?: ToolEvent[];
  pending?: boolean;
}

// ── Tool icon & label ────────────────────────────────────────────────────────

function toolMeta(name: string): { icon: React.ReactNode; label: string; color: string } {
  switch (name) {
    case "read_file":           return { icon: <FileText className="w-3.5 h-3.5" />,  label: "Reading file",      color: "text-blue-400 border-blue-500/30 bg-blue-500/10" };
    case "write_file":          return { icon: <Pencil className="w-3.5 h-3.5" />,    label: "Writing file",      color: "text-amber-400 border-amber-500/30 bg-amber-500/10" };
    case "list_directory":      return { icon: <FolderOpen className="w-3.5 h-3.5" />,label: "Listing directory", color: "text-violet-400 border-violet-500/30 bg-violet-500/10" };
    case "search_code":         return { icon: <Search className="w-3.5 h-3.5" />,    label: "Searching code",    color: "text-emerald-400 border-emerald-500/30 bg-emerald-500/10" };
    case "search_code_content": return { icon: <Search className="w-3.5 h-3.5" />,    label: "Searching content", color: "text-emerald-400 border-emerald-500/30 bg-emerald-500/10" };
    case "execute_sql":         return { icon: <Database className="w-3.5 h-3.5" />,  label: "Running SQL",       color: "text-cyan-400 border-cyan-500/30 bg-cyan-500/10" };
    case "get_database_schema": return { icon: <Database className="w-3.5 h-3.5" />,  label: "Reading DB schema", color: "text-cyan-400 border-cyan-500/30 bg-cyan-500/10" };
    default:                    return { icon: <Terminal className="w-3.5 h-3.5" />,   label: name,                color: "text-muted-foreground border-white/10 bg-white/5" };
  }
}

// ── Simple code-block renderer ───────────────────────────────────────────────

function renderContent(text: string) {
  const parts = text.split(/(```[\s\S]*?```|`[^`]+`)/g);
  return parts.map((part, i) => {
    if (part.startsWith("```") && part.endsWith("```")) {
      const inner = part.slice(3, -3);
      const newline = inner.indexOf("\n");
      const lang = newline > -1 ? inner.slice(0, newline).trim() : "";
      const code = newline > -1 ? inner.slice(newline + 1) : inner;
      return (
        <div key={i} className="my-2 rounded-lg overflow-hidden border border-white/10">
          {lang && (
            <div className="px-3 py-1 bg-white/5 border-b border-white/10 text-[10px] text-muted-foreground font-mono uppercase tracking-wider">{lang}</div>
          )}
          <pre className="p-3 overflow-x-auto text-xs font-mono text-emerald-300 bg-black/30 whitespace-pre-wrap leading-relaxed">{code}</pre>
        </div>
      );
    }
    if (part.startsWith("`") && part.endsWith("`")) {
      return <code key={i} className="px-1.5 py-0.5 rounded bg-white/10 text-emerald-300 font-mono text-xs">{part.slice(1, -1)}</code>;
    }
    return (
      <span key={i}>
        {part.split("\n").map((line, li, arr) => (
          <span key={li}>
            {line}
            {li < arr.length - 1 && <br />}
          </span>
        ))}
      </span>
    );
  });
}

// ── ToolCall component ───────────────────────────────────────────────────────

function ToolCallBlock({ events }: { events: ToolEvent[] }) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const starts = events.filter(e => e.type === "tool_start") as Extract<ToolEvent, { type: "tool_start" }>[];
  const ends   = events.filter(e => e.type === "tool_end")   as Extract<ToolEvent, { type: "tool_end" }>[];

  if (!starts.length) return null;

  return (
    <div className="space-y-1 mb-3">
      {starts.map(s => {
        const end = ends.find(e => e.id === s.id);
        const meta = toolMeta(s.name);
        const isOpen = expanded[s.id];
        const argLabel = s.args.path ?? s.args.query ?? s.args.pattern ?? "";
        return (
          <div key={s.id} className={`rounded-lg border text-xs overflow-hidden ${meta.color}`}>
            <button
              className="w-full flex items-center gap-2 px-3 py-2 text-left"
              onClick={() => setExpanded(ex => ({ ...ex, [s.id]: !ex[s.id] }))}
            >
              {meta.icon}
              <span className="font-semibold">{meta.label}</span>
              {argLabel && <span className="font-mono text-[11px] opacity-70 truncate flex-1">{argLabel}</span>}
              {!end && <Loader2 className="w-3 h-3 animate-spin ml-auto flex-shrink-0" />}
              {end  && <CheckCircle2 className="w-3 h-3 ml-auto flex-shrink-0 opacity-70" />}
              {isOpen ? <ChevronDown className="w-3 h-3 flex-shrink-0" /> : <ChevronRight className="w-3 h-3 flex-shrink-0" />}
            </button>
            {isOpen && (
              <div className="border-t border-current border-opacity-20 p-2.5 bg-black/20">
                {Object.keys(s.args).length > 0 && (
                  <div className="mb-2">
                    <p className="text-[10px] font-bold opacity-60 uppercase mb-1">Input</p>
                    <pre className="text-[11px] font-mono opacity-80 whitespace-pre-wrap overflow-x-auto">{JSON.stringify(s.args, null, 2)}</pre>
                  </div>
                )}
                {end && (
                  <div>
                    <p className="text-[10px] font-bold opacity-60 uppercase mb-1">Output</p>
                    <pre className="text-[11px] font-mono opacity-80 whitespace-pre-wrap overflow-x-auto">{end.preview}</pre>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Copy button ──────────────────────────────────────────────────────────────

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button onClick={copy} className="p-1.5 rounded-lg hover:bg-white/10 text-muted-foreground hover:text-white transition-colors">
      {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
    </button>
  );
}

// ── Main Page ────────────────────────────────────────────────────────────────

export default function AiAssistant() {
  const { isAdmin } = useAuth();
  const [, setLocation] = useLocation();

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput]       = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const bottomRef  = useRef<HTMLDivElement>(null);
  const inputRef   = useRef<HTMLTextAreaElement>(null);
  const abortRef   = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!isAdmin) setLocation("/dashboard");
  }, [isAdmin, setLocation]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const newId = () => Math.random().toString(36).slice(2);

  const newChat = () => {
    if (isStreaming) abortRef.current?.abort();
    setMessages([]);
    setInput("");
    inputRef.current?.focus();
  };

  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text || isStreaming) return;
    setInput("");

    const userMsg: Message = { id: newId(), role: "user", content: text };
    const pendingMsg: Message = { id: newId(), role: "assistant", content: "", toolEvents: [], pending: true };

    setMessages(prev => [...prev, userMsg, pendingMsg]);
    setIsStreaming(true);

    const apiMessages = [...messages, userMsg].map(m => ({ role: m.role === "error" ? "user" : m.role, content: m.content }));

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const response = await fetch(`${BASE}/api/ai-assistant/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ messages: apiMessages }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const err = await response.text();
        setMessages(prev => [...prev.slice(0, -1), { id: newId(), role: "error", content: `Error ${response.status}: ${err}` }]);
        return;
      }

      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      const pendingId = pendingMsg.id;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          let ev: any;
          try { ev = JSON.parse(line.slice(6)); } catch { continue; }

          setMessages(prev => prev.map(m => {
            if (m.id !== pendingId) return m;
            if (ev.type === "tool_start" || ev.type === "tool_end") {
              return { ...m, toolEvents: [...(m.toolEvents ?? []), ev] };
            }
            if (ev.type === "message") {
              return { ...m, content: ev.content, pending: false };
            }
            if (ev.type === "error") {
              return { ...m, role: "error" as const, content: ev.message, pending: false };
            }
            if (ev.type === "done") {
              return { ...m, pending: false };
            }
            return m;
          }));
        }
      }
    } catch (e: any) {
      if (e.name === "AbortError") return;
      setMessages(prev => [...prev.slice(0, -1), { id: newId(), role: "error", content: e.message }]);
    } finally {
      setIsStreaming(false);
    }
  }, [input, isStreaming, messages]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  if (!isAdmin) return null;

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="flex-shrink-0 flex items-center gap-3 px-5 py-4 border-b border-white/8 bg-black/20">
        <div className="w-9 h-9 rounded-xl bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center">
          <Bot className="w-5 h-5 text-cyan-400" />
        </div>
        <div className="flex-1">
          <h1 className="text-sm font-bold text-white">AI Code Assistant</h1>
          <p className="text-xs text-muted-foreground">Reads files, edits code, queries the database — admin only</p>
        </div>
        <div className="flex items-center gap-2">
          <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs ${isStreaming ? "bg-cyan-500/10 border-cyan-500/30 text-cyan-400" : "bg-white/5 border-white/10 text-muted-foreground"}`}>
            <div className={`w-1.5 h-1.5 rounded-full ${isStreaming ? "bg-cyan-400 animate-pulse" : "bg-white/20"}`} />
            {isStreaming ? "Working…" : "Ready"}
          </div>
          <button onClick={newChat} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-xs text-muted-foreground hover:text-white hover:bg-white/10 transition-colors">
            <Plus className="w-3.5 h-3.5" />
            New Chat
          </button>
          {messages.length > 0 && (
            <button onClick={newChat} className="p-1.5 rounded-xl bg-white/5 border border-white/10 text-muted-foreground hover:text-red-400 hover:border-red-500/30 transition-colors">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-6 px-6 text-center">
            <div className="w-20 h-20 rounded-3xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center">
              <Bot className="w-10 h-10 text-cyan-400/60" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white mb-2">AI Code Assistant</h2>
              <p className="text-sm text-muted-foreground max-w-sm">
                I can read and edit the codebase, query the database, and make modifications — just like the original developer. Ask me anything.
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-w-lg w-full">
              {[
                "Add a new column to the machines table",
                "Show me all open downtime records",
                "Add a button to the Dashboard page",
                "Fix the last runtime error in diagnostics",
                "List all backend route files",
                "What tables does the database have?",
              ].map(suggestion => (
                <button
                  key={suggestion}
                  onClick={() => { setInput(suggestion); inputRef.current?.focus(); }}
                  className="px-3 py-2.5 rounded-xl border border-white/8 bg-white/3 hover:bg-white/8 hover:border-white/15 text-xs text-muted-foreground hover:text-white transition-all text-left"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
            {messages.map(msg => (
              <div key={msg.id} className={`flex gap-3 ${msg.role === "user" ? "flex-row-reverse" : "flex-row"}`}>
                {/* Avatar */}
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 border ${
                  msg.role === "user"      ? "bg-blue-500/20 border-blue-500/30"  :
                  msg.role === "error"     ? "bg-red-500/20 border-red-500/30"    :
                                             "bg-cyan-500/20 border-cyan-500/30"
                }`}>
                  {msg.role === "user"  ? <span className="text-xs font-bold text-blue-300">U</span>  :
                   msg.role === "error" ? <AlertCircle className="w-4 h-4 text-red-400" />            :
                                          <Bot className="w-4 h-4 text-cyan-400" />}
                </div>

                {/* Bubble */}
                <div className={`flex-1 min-w-0 max-w-[85%] ${msg.role === "user" ? "items-end" : "items-start"} flex flex-col`}>
                  {/* Tool events (assistant only) */}
                  {msg.role === "assistant" && msg.toolEvents && msg.toolEvents.length > 0 && (
                    <ToolCallBlock events={msg.toolEvents} />
                  )}

                  {/* Message content */}
                  {(msg.content || msg.pending) && (
                    <div className={`relative group rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                      msg.role === "user"  ? "bg-blue-500/15 border border-blue-500/20 text-white rounded-tr-sm"           :
                      msg.role === "error" ? "bg-red-500/10 border border-red-500/20 text-red-300 rounded-tl-sm"           :
                                             "bg-white/5 border border-white/10 text-white/90 rounded-tl-sm"
                    }`}>
                      {msg.pending && !msg.content ? (
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span className="text-xs">Thinking…</span>
                        </div>
                      ) : (
                        <div className="prose-sm">{renderContent(msg.content)}</div>
                      )}

                      {/* Copy button (assistant only) */}
                      {msg.role === "assistant" && msg.content && !msg.pending && (
                        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <CopyButton text={msg.content} />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      {/* Input area */}
      <div className="flex-shrink-0 border-t border-white/8 bg-black/10 px-4 py-3">
        <div className="max-w-4xl mx-auto flex items-end gap-3">
          <div className="flex-1 relative">
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask me to read, edit, or create anything in the codebase… (Enter to send, Shift+Enter for newline)"
              rows={1}
              className="w-full resize-none rounded-2xl bg-white/5 border border-white/10 focus:border-cyan-500/50 focus:outline-none px-4 py-3 text-sm text-white placeholder-muted-foreground transition-colors"
              style={{ minHeight: "48px", maxHeight: "200px", overflowY: input.split("\n").length > 4 ? "auto" : "hidden" }}
              onInput={e => {
                const t = e.target as HTMLTextAreaElement;
                t.style.height = "auto";
                t.style.height = Math.min(t.scrollHeight, 200) + "px";
              }}
              disabled={isStreaming}
            />
          </div>
          <button
            onClick={isStreaming ? () => abortRef.current?.abort() : sendMessage}
            disabled={!isStreaming && !input.trim()}
            className={`flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center transition-all border ${
              isStreaming
                ? "bg-red-500/20 border-red-500/30 text-red-400 hover:bg-red-500/30"
                : input.trim()
                ? "bg-cyan-500/20 border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/30"
                : "bg-white/5 border-white/10 text-muted-foreground opacity-50 cursor-not-allowed"
            }`}
          >
            {isStreaming ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </button>
        </div>
        <p className="max-w-4xl mx-auto mt-1.5 text-[10px] text-muted-foreground/50 px-1">
          AI can read and edit source files. Changes to the frontend apply instantly. Backend changes require a server restart.
        </p>
      </div>
    </div>
  );
}
