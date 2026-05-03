'use client';

import { useEffect, useState } from 'react';

interface LoggedMessage {
  id: string;
  to: string;
  body: string;
  templateName: string | null;
  externalMessageId: string | null;
  timestamp: string;
}

/**
 * DEMO-05 — Polls /api/demo/whatsapp-log every 5s and shows the most
 * recent outbound WhatsApp messages so the demo persona can see the
 * full inbound → triage → confirmation loop without leaving the demo
 * page.
 */
export function WhatsAppMessageLog() {
  const [messages, setMessages] = useState<LoggedMessage[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch('/api/demo/whatsapp-log');
        if (!res.ok) {
          if (!cancelled) setError(`Log unavailable (HTTP ${res.status})`);
          return;
        }
        const data = (await res.json()) as { messages: LoggedMessage[] };
        if (!cancelled) {
          setMessages(data.messages);
          setError(null);
        }
      } catch {
        if (!cancelled) setError('Network error fetching message log');
      }
    };
    load();
    const interval = setInterval(load, 5000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Sent WhatsApp messages</h3>
        <span className="text-xs text-muted">refreshes every 5s</span>
      </div>

      {error && (
        <div role="alert" className="rounded-md border border-amber-300 bg-amber-50 p-2 text-xs text-amber-900">
          {error}
        </div>
      )}

      {messages.length === 0 && !error ? (
        <p className="rounded-md border border-dashed border-border p-3 text-xs text-muted">
          No WhatsApp messages sent yet. Trigger a confirmation or reminder to see one here.
        </p>
      ) : (
        <ul className="space-y-2">
          {messages.map((msg) => (
            <li
              key={msg.id}
              className="rounded-md border border-border bg-surface p-3 text-sm"
            >
              <div className="flex items-baseline justify-between gap-3">
                <span className="font-mono text-xs">{msg.to}</span>
                <span className="text-xs text-muted">
                  {new Date(msg.timestamp).toLocaleTimeString()}
                </span>
              </div>
              {msg.templateName && (
                <div className="mt-1 inline-block rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-emerald-700 ring-1 ring-inset ring-emerald-200">
                  template · {msg.templateName}
                </div>
              )}
              <p className="mt-2 whitespace-pre-wrap text-xs text-foreground">{msg.body}</p>
              {msg.externalMessageId && (
                <p className="mt-1 font-mono text-[10px] text-muted">
                  {msg.externalMessageId}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
