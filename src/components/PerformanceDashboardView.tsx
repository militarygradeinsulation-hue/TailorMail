import React, { useState } from 'react';
import { ArrowUpRight, CheckCircle2, Filter, MailOpen, TrendingUp } from 'lucide-react';
import { EmailTemplate, InvoiceRecord, Lead } from '../types';

interface PerformanceDashboardViewProps {
  leads: Lead[];
  templates: EmailTemplate[];
  invoices: InvoiceRecord[];
  onInspectLead: (leadId: string) => void;
}

export const PerformanceDashboardView: React.FC<PerformanceDashboardViewProps> = ({
  leads,
  templates,
  invoices,
  onInspectLead,
}) => {
  const [cadenceFilter, setCadenceFilter] = useState<'all' | 'one_touch' | 'timed_sequence'>('all');

  const filteredLeads = leads.filter((l) =>
    cadenceFilter === 'all' ? true : l.cadenceMode === cadenceFilter
  );

  const totalSent = filteredLeads.reduce(
    (acc, l) => acc + (l.metrics.sentCount || 0),
    0
  );
  const totalOpens = filteredLeads.reduce((acc, l) => acc + (l.metrics.opens || 0), 0);
  const totalReplies = filteredLeads.reduce(
    (acc, l) => acc + (l.metrics.replies || 0),
    0
  );
  const convertedCount = filteredLeads.filter((l) => l.status === 'Converted').length;

  const openRate = totalSent > 0 ? Math.min(100, (totalOpens / totalSent) * 100) : 0;
  const replyRate = totalSent > 0 ? Math.min(100, (totalReplies / totalSent) * 100) : 0;
  const conversionRate =
    filteredLeads.length > 0 ? (convertedCount / filteredLeads.length) * 100 : 0;

  const totalPipelineValue = filteredLeads.reduce(
    (acc, l) => acc + (l.metrics.dealValue || 0),
    0
  );
  const collectedRevenue = invoices
    .filter((inv) => inv.status === 'Paid')
    .reduce((acc, inv) => acc + inv.amount, 0);

  // Real One-Touch vs Timed Sequence comparison computed strictly from actual leads
  const oneTouchLeads = leads.filter((l) => l.cadenceMode === 'one_touch');
  const oneTouchSent = oneTouchLeads.reduce((a, l) => a + (l.metrics.sentCount || 0), 0);
  const oneTouchOpens = oneTouchLeads.reduce((a, l) => a + (l.metrics.opens || 0), 0);
  const oneTouchReplies = oneTouchLeads.reduce((a, l) => a + (l.metrics.replies || 0), 0);
  const oneTouchOpenRate =
    oneTouchSent > 0 ? Math.min(100, (oneTouchOpens / oneTouchSent) * 100) : 0;
  const oneTouchReplyRate =
    oneTouchSent > 0 ? Math.min(100, (oneTouchReplies / oneTouchSent) * 100) : 0;

  const timedLeads = leads.filter((l) => l.cadenceMode === 'timed_sequence');
  const timedSent = timedLeads.reduce((a, l) => a + (l.metrics.sentCount || 0), 0);
  const timedOpens = timedLeads.reduce((a, l) => a + (l.metrics.opens || 0), 0);
  const timedConverted = timedLeads.filter((l) => l.status === 'Converted').length;
  const timedOpenRate =
    timedSent > 0 ? Math.min(100, (timedOpens / timedSent) * 100) : 0;
  const timedConvRate =
    timedLeads.length > 0 ? (timedConverted / timedLeads.length) * 100 : 0;

  return (
    <div className="space-y-8">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
        <div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">
            Live Open-Pixel Tracking · Gmail Thread Replies · Pipeline Conversion
          </p>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
            Outbound Performance & Conversion Metrics
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
            <button
              type="button"
              onClick={() => setCadenceFilter('all')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                cadenceFilter === 'all'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              All Cadences
            </button>
            <button
              type="button"
              onClick={() => setCadenceFilter('one_touch')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                cadenceFilter === 'one_touch'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              One-Touch Only
            </button>
            <button
              type="button"
              onClick={() => setCadenceFilter('timed_sequence')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                cadenceFilter === 'timed_sequence'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Timed Sequence
            </button>
          </div>
        </div>
      </div>

      {/* 4-Column KPI Strip (Computed from real workspace state) */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>Verified Open Rate</span>
            <MailOpen className="w-4 h-4 text-slate-400" />
          </div>
          <p className="text-3xl font-bold font-mono tabular-nums text-slate-900 dark:text-white">
            {openRate.toFixed(1)}%
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums">
            {totalOpens} tracked opens · {totalSent} emails sent
          </p>
        </div>

        <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>Reply & Sales Q&A Rate</span>
            <TrendingUp className="w-4 h-4 text-slate-400" />
          </div>
          <p className="text-3xl font-bold font-mono tabular-nums text-slate-900 dark:text-white">
            {replyRate.toFixed(1)}%
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums">
            {totalReplies} prospect replies synced via Gmail
          </p>
        </div>

        <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>Lead Conversion Rate</span>
            <CheckCircle2 className="w-4 h-4 text-slate-400" />
          </div>
          <p className="text-3xl font-bold font-mono tabular-nums text-slate-900 dark:text-white">
            {conversionRate.toFixed(1)}%
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums">
            {convertedCount} converted of {filteredLeads.length} total leads
          </p>
        </div>

        <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>Active Pipeline & Settled</span>
            <Filter className="w-4 h-4 text-slate-400" />
          </div>
          <p className="text-3xl font-bold font-mono tabular-nums text-slate-900 dark:text-white">
            ${totalPipelineValue.toLocaleString()}
          </p>
          <p className="text-xs text-emerald-700 dark:text-emerald-400 font-mono tabular-nums">
            ${collectedRevenue.toLocaleString()} paid invoices settled
          </p>
        </div>
      </section>

      {/* Middle 2-Column Split: Template Performance + Cadence Mode Benchmark */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Left: Template Performance Breakdown (7 cols) */}
        <div className="lg:col-span-7 p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl space-y-5">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
            <div>
              <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                Template-Level Open & Reply Performance
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Real-time telemetry across your custom persona templates
              </p>
            </div>
            <span className="text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400">
              {templates.length} active templates
            </span>
          </div>

          {templates.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-500 dark:text-slate-400">
              No custom templates generated yet. Create templates in the Persona &amp; Templates tab to track their open and reply rates.
            </div>
          ) : (
            <div className="space-y-4">
              {templates.map((tpl) => {
                const tplOpenRate =
                  tpl.sentCount > 0
                    ? Math.min(100, (tpl.openCount / tpl.sentCount) * 100)
                    : 0;
                return (
                  <div key={tpl.id} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-slate-800 dark:text-slate-200 truncate max-w-[260px]">
                        {tpl.title} · <span className="text-slate-500 dark:text-slate-400">{tpl.category}</span>
                      </span>
                      <div className="flex items-center gap-3 font-mono tabular-nums text-slate-600 dark:text-slate-300">
                        <span>{tpl.sentCount} sent</span>
                        <span>·</span>
                        <span className="text-slate-900 dark:text-white font-semibold">
                          {tplOpenRate.toFixed(1)}% opened ({tpl.openCount})
                        </span>
                        <span>·</span>
                        <span>{tpl.replyCount} replies</span>
                      </div>
                    </div>
                    <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className="bg-slate-900 dark:bg-blue-600 h-full transition-all"
                        style={{ width: `${tplOpenRate}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right: One-Touch vs Timed Follow-Up Comparison (5 cols) */}
        <div className="lg:col-span-5 p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl space-y-5 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="border-b border-slate-100 dark:border-slate-800 pb-3">
              <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                Cadence Toggle Benchmark
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Live comparison between Single-Email and Timed Multi-Touch leads
              </p>
            </div>

            <div className="space-y-4">
              <div className="p-4 bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700 rounded-lg space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-900 dark:text-white">
                    One-Touch Mode (Single Email Only)
                  </span>
                  <span className="text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400">
                    {oneTouchLeads.length} leads
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2 pt-1 font-mono tabular-nums">
                  <div>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Sent</p>
                    <p className="text-sm font-bold text-slate-900 dark:text-white">{oneTouchSent}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Open Rate</p>
                    <p className="text-sm font-bold text-slate-900 dark:text-white">
                      {oneTouchOpenRate.toFixed(1)}%
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Reply Rate</p>
                    <p className="text-sm font-bold text-emerald-700 dark:text-emerald-400">
                      {oneTouchReplyRate.toFixed(1)}%
                    </p>
                  </div>
                </div>
              </div>

              <div className="p-4 bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700 rounded-lg space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-900 dark:text-white">
                    Timed Sequence (Multi-Touch + Q&A)
                  </span>
                  <span className="text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400">
                    {timedLeads.length} leads
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2 pt-1 font-mono tabular-nums">
                  <div>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Sent</p>
                    <p className="text-sm font-bold text-slate-900 dark:text-white">{timedSent}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Open Rate</p>
                    <p className="text-sm font-bold text-slate-900 dark:text-white">
                      {timedOpenRate.toFixed(1)}%
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Conversion</p>
                    <p className="text-sm font-bold text-blue-700 dark:text-blue-400">
                      {timedConvRate.toFixed(1)}%
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <p className="text-xs text-slate-500 dark:text-slate-400 border-t border-slate-100 dark:border-slate-800 pt-3">
            Every outbound email sent through Gmail embeds a 1x1 tracking pixel (<code>/api/track/open/:leadId</code>) that increments open metrics in real time.
          </p>
        </div>
      </div>

      {/* High-Density Lead Telemetry Table */}
      <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
        <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">
              Recipient Engagement & Conversion Ledger
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Click any prospect row to open their Gmail thread and cadence controls
            </p>
          </div>
          <span className="text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400">
            Showing {filteredLeads.length} of {leads.length} accounts
          </span>
        </div>

        {filteredLeads.length === 0 ? (
          <div className="p-10 text-center text-xs text-slate-500 dark:text-slate-400">
            No leads recorded yet. Discover ICP leads or add a recipient in the ICP &amp; Outbound tab.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/80 text-xs font-semibold text-slate-600 dark:text-slate-400">
                  <th className="py-3 px-4">Recipient & Company</th>
                  <th className="py-3 px-4">Source</th>
                  <th className="py-3 px-4">Cadence Toggle</th>
                  <th className="py-3 px-4 text-right">Sent / Opens / Replies</th>
                  <th className="py-3 px-4 text-right">Deal Value</th>
                  <th className="py-3 px-4">Pipeline Stage</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                {filteredLeads.map((lead) => (
                  <tr
                    key={lead.id}
                    onClick={() => onInspectLead(lead.id)}
                    className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer"
                  >
                    <td className="py-3 px-4">
                      <p className="font-semibold text-slate-900 dark:text-white">{lead.fullName}</p>
                      <p className="text-slate-500 dark:text-slate-400">
                        {lead.role} · {lead.company} ({lead.email})
                      </p>
                    </td>
                    <td className="py-3 px-4 text-slate-600 dark:text-slate-300">
                      {lead.matchType} ·{' '}
                      <span className="font-mono tabular-nums font-medium text-slate-900 dark:text-white">
                        {lead.matchScore}%
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-600 dark:text-slate-300">
                      {lead.cadenceMode === 'one_touch'
                        ? 'One-Touch Single'
                        : `Timed (${lead.timedIntervalDays}d interval)`}
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-800 dark:text-slate-200">
                      {lead.metrics.sentCount || 0} sent · {lead.metrics.opens} opens ·{' '}
                      {lead.metrics.replies || 0} replies
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums font-semibold text-slate-900 dark:text-white">
                      ${lead.metrics.dealValue.toLocaleString()}
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`font-medium ${
                          lead.status === 'Converted'
                            ? 'text-emerald-700 dark:text-emerald-400'
                            : lead.status === 'Question Received'
                            ? 'text-amber-700 dark:text-amber-400'
                            : 'text-slate-700 dark:text-slate-300'
                        }`}
                      >
                        {lead.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onInspectLead(lead.id);
                        }}
                        className="inline-flex items-center gap-1 text-blue-700 dark:text-blue-400 hover:underline font-medium whitespace-nowrap"
                      >
                        Inspect
                        <ArrowUpRight className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
};
