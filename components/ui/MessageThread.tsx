'use client';

import { useTranslations } from 'next-intl';
import clsx from 'clsx';

interface Message {
  id: string;
  direction: string;
  channel: string;
  messageText: string;
  sentOrReceivedAt: string;
}

interface MessageThreadProps {
  messages: Message[];
}

export function MessageThread({ messages }: MessageThreadProps) {
  const t = useTranslations('messages');

  if (messages.length === 0) {
    return (
      <div className="rounded-md border border-border p-4 text-center text-sm text-muted">
        {t('empty')}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {messages.map((msg) => {
        const isInbound = msg.direction === 'INBOUND';
        const isWhatsApp = msg.channel === 'WHATSAPP';
        const time = new Date(msg.sentOrReceivedAt);

        return (
          <div
            key={msg.id}
            className={clsx('flex', isInbound ? 'justify-start' : 'justify-end')}
          >
            <div
              className={clsx(
                'max-w-[80%] rounded-lg px-4 py-2 text-sm',
                isInbound && isWhatsApp && 'bg-green-50 border border-green-200 text-green-900',
                isInbound && !isWhatsApp && 'bg-blue-50 border border-blue-200 text-blue-900',
                !isInbound && isWhatsApp && 'bg-green-100 border border-green-300 text-green-900',
                !isInbound && !isWhatsApp && 'bg-blue-100 border border-blue-300 text-blue-900'
              )}
            >
              <div className="mb-1 flex items-center gap-2 text-xs font-medium opacity-70">
                <span>{isInbound ? t('inbound') : t('outbound')}</span>
                <span className="text-[10px]">•</span>
                <span>{isWhatsApp ? t('whatsapp') : t('email')}</span>
              </div>
              <p className="whitespace-pre-wrap">{msg.messageText}</p>
              <p className="mt-1 text-right text-[10px] opacity-50">
                {time.toLocaleString()}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
