import React from 'react';
import { ArrowUpRight, Bell, CheckCheck, Inbox, Loader2 } from 'lucide-react';
import { LiveNotification } from '../types';

interface LiveNotificationsViewProps {
  notifications: LiveNotification[];
  isSyncingGmail: boolean;
  onSyncGmailNow: () => void;
  onMarkAllRead: () => void;
  onSelectNotificationLead: (leadId: string) => void;
}

export const LiveNotificationsView: React.FC<LiveNotificationsViewProps> = ({
  notifications,
  isSyncingGmail,
  onSyncGmailNow,
  onMarkAllRead,
  onSelectNotificationLead,
}) => {
  const unreadCount = notifications.filter((n) => n.unread).length;

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
        <div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">
            SSE Live Event Stream · Gmail Reply Sync · Open-Pixel & Payment Alerts
          </p>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
            Real-Time Incoming Lead Notifications
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={onMarkAllRead}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-lg transition-colors whitespace-nowrap"
          >
            <CheckCheck className="w-3.5 h-3.5" />
            Mark All Read ({unreadCount})
          </button>

          <button
            type="button"
            onClick={onSyncGmailNow}
            disabled={isSyncingGmail}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 dark:bg-blue-600 dark:hover:bg-blue-500 disabled:opacity-60 rounded-lg transition-colors whitespace-nowrap"
          >
            {isSyncingGmail ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Inbox className="w-3.5 h-3.5" />
            )}
            Sync Gmail Inbox & Replies Now
          </button>
        </div>
      </div>

      {/* Inbound Lead Webhook Endpoint Info Box */}
      <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
        <div className="space-y-0.5">
          <span className="font-semibold text-slate-900 dark:text-white block">
            Live Webhook & Tracking Endpoints Active
          </span>
          <span className="text-slate-500 dark:text-slate-400">
            Inbound Lead Webhook: <code className="font-mono text-slate-800 dark:text-slate-200">POST /api/webhooks/inbound-lead</code> · Open Tracking Pixel: <code className="font-mono text-slate-800 dark:text-slate-200">GET /api/track/open/:leadId</code>
          </span>
        </div>
        <span className="font-mono text-emerald-700 dark:text-emerald-400 font-medium shrink-0">
          SSE Stream Connected
        </span>
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl divide-y divide-slate-100 dark:divide-slate-800">
        {notifications.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <Bell className="w-6 h-6 text-slate-400 mx-auto" />
            <p className="text-sm font-medium text-slate-800 dark:text-slate-200">No incoming lead events recorded yet</p>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
              Real-time notifications appear here automatically whenever you discover ICP leads, receive a Gmail reply, get an email open-pixel hit, or settle an invoice.
            </p>
          </div>
        ) : (
          notifications.map((notif) => (
            <div
              key={notif.id}
              onClick={() => notif.leadId && onSelectNotificationLead(notif.leadId)}
              className={`p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-colors cursor-pointer ${
                notif.unread
                  ? 'bg-blue-50/30 dark:bg-blue-950/20 hover:bg-blue-50/60 dark:hover:bg-blue-950/40'
                  : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
              }`}
            >
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                  <span
                    className={`font-semibold ${
                      notif.eventType === 'New ICP Lead'
                        ? 'text-blue-700 dark:text-blue-400'
                        : notif.eventType === 'Sales Question'
                        ? 'text-amber-700 dark:text-amber-400'
                        : notif.eventType === 'Invoice Paid'
                        ? 'text-emerald-700 dark:text-emerald-400'
                        : 'text-slate-800 dark:text-slate-200'
                    }`}
                  >
                    {notif.eventType}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span className="font-medium text-slate-900 dark:text-white">{notif.leadName}</span>
                  <span aria-hidden="true">·</span>
                  <span>
                    {notif.role} at {notif.company}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono tabular-nums">{notif.timestamp}</span>
                  {notif.unread && (
                    <>
                      <span aria-hidden="true">·</span>
                      <span className="font-semibold text-blue-700 dark:text-blue-400">Unread</span>
                    </>
                  )}
                </div>
                <p className="text-sm text-slate-800 dark:text-slate-200">{notif.summary}</p>
              </div>

              {notif.leadId && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectNotificationLead(notif.leadId);
                  }}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-slate-900 dark:text-slate-200 hover:text-blue-700 dark:hover:text-blue-400 whitespace-nowrap self-start sm:self-center shrink-0"
                >
                  Open Lead Workbench
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};
