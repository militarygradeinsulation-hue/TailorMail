import { apiFetch } from '../services/apiFetch';
import React, { useState, useRef } from 'react';
import {
  AlertCircle,
  Award,
  BookOpen,
  CheckCircle2,
  Clock,
  ExternalLink,
  Globe,
  Inbox,
  Loader2,
  Mail,
  MapPin,
  MessageSquare,
  Plus,
  RefreshCw,
  Search,
  Send,
  Sliders,
  Sparkles,
  Target,
  Upload,
  UserCheck,
  X,
} from 'lucide-react';
import {
  BusinessContext,
  CadenceMode,
  EmailTemplate,
  FollowUpStep,
  Lead,
  PersonaProfile,
} from '../types';
import { LeadLocationsMap } from './LeadLocationsMap';
import { IcpStrategyModal } from './IcpStrategyModal';

interface IcpOutboundViewProps {
  leads: Lead[];
  selectedLeadId: string;
  onSelectLead: (id: string) => void;
  onUpdateLead: (lead: Lead) => void;
  onSyncState: (state: any) => void;
  activePersona: PersonaProfile | null;
  businessContext: BusinessContext;
  selectedTemplate: EmailTemplate | null;
  onConvertLeadToInvoice: (lead: Lead) => void;
  accessToken: string | null;
  userEmail: string | null;
  onRequestGoogleLogin: () => Promise<void>;
  onApplyBusinessContext?: (ctx: BusinessContext) => void;
}

interface PendingEmailConfirmation {
  leadId: string;
  recipientName: string;
  to: string;
  subject: string;
  body: string;
  threadId?: string;
  isFollowUp?: boolean;
  stepId?: string;
  actionTitle: string;
}

export const IcpOutboundView: React.FC<IcpOutboundViewProps> = ({
  leads,
  selectedLeadId,
  onSelectLead,
  onUpdateLead,
  onSyncState,
  activePersona,
  businessContext,
  selectedTemplate,
  onConvertLeadToInvoice,
  accessToken,
  userEmail,
  onRequestGoogleLogin,
  onApplyBusinessContext,
}) => {
  const selectedLead = leads.find((l) => l.id === selectedLeadId) || leads[0] || null;

  const [discoveryMode, setDiscoveryMode] = useState<
    'web_scan' | 'maps_scan' | 'intelligence_match'
  >('web_scan');
  const [showTerritoryMap, setShowTerritoryMap] = useState<boolean>(true);
  const [showStrategyModal, setShowStrategyModal] = useState<boolean>(false);
  const [icpQuery, setIcpQuery] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('All');

  // Manual Lead Creation Drawer
  const [showAddLeadForm, setShowAddLeadForm] = useState(false);
  const [manualName, setManualName] = useState('');
  const [manualRole, setManualRole] = useState('');
  const [manualCompany, setManualCompany] = useState('');
  const [manualEmail, setManualEmail] = useState('');
  const [manualSignal, setManualSignal] = useState('');
  const [manualDealValue, setManualDealValue] = useState(12000);

  const [isTailoring, setIsTailoring] = useState(false);
  const [isAnsweringQuestion, setIsAnsweringQuestion] = useState(false);
  const [isSyncingGmail, setIsSyncingGmail] = useState(false);
  const [isSendingGmail, setIsSendingGmail] = useState(false);
  const [sendFeedback, setSendFeedback] = useState<string | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);

  // CSV Lead Upload
  const csvLeadInputRef = useRef<HTMLInputElement>(null);
  const [isImportingCsv, setIsImportingCsv] = useState(false);
  const [csvFeedback, setCsvFeedback] = useState<string | null>(null);

  const handleCsvLeadUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsImportingCsv(true);
    setScanError(null);
    try {
      const reader = new FileReader();
      reader.onload = async (event) => {
        const textContent = String(event.target?.result || '');
        if (!textContent.trim()) {
          setScanError('Uploaded CSV file appears to be empty.');
          setIsImportingCsv(false);
          return;
        }

        try {
          const res = await apiFetch('/api/leads/import-csv', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              csvContent: textContent,
              filename: file.name,
            }),
          });
          const data = await res.json();
          if (!res.ok) {
            throw new Error(data.error || 'Failed to import CSV leads.');
          }
          if (data.state) {
            onSyncState(data.state);
          }
          setCsvFeedback(`Imported ${data.count} leads from ${file.name}`);
          setTimeout(() => setCsvFeedback(null), 5000);
        } catch (postErr: any) {
          setScanError(postErr?.message || 'Error processing CSV rows.');
        } finally {
          setIsImportingCsv(false);
        }
      };
      reader.readAsText(file);
    } catch (err: any) {
      setScanError(err?.message || 'Failed to read CSV file.');
      setIsImportingCsv(false);
    } finally {
      if (e.target) e.target.value = '';
    }
  };

  // Mandatory Confirmation Dialog State before mutating/sending via Gmail API
  const [pendingConfirm, setPendingConfirm] = useState<PendingEmailConfirmation | null>(null);

  const handleQuickBeachheadSearch = async (
    queryText: string,
    modeToUse: 'web_scan' | 'maps_scan' | 'intelligence_match'
  ) => {
    setIcpQuery(queryText);
    setDiscoveryMode(modeToUse);
    setIsScanning(true);
    setScanError(null);
    try {
      const response = await apiFetch('/api/icp/discover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: queryText,
          mode: modeToUse,
          businessContext,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'ICP beachhead scan failed');
      }
      if (data.state) {
        onSyncState(data.state);
        if (data.leads?.[0]?.id) {
          onSelectLead(data.leads[0].id);
        }
      }
    } catch (err: any) {
      setScanError(err?.message || 'Error running beachhead scan.');
    } finally {
      setIsScanning(false);
    }
  };

  const handleRunDiscovery = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!icpQuery.trim()) {
      setScanError('Enter an ICP description, target industry, or regional hub to scan.');
      return;
    }
    setIsScanning(true);
    setScanError(null);

    try {
      const response = await apiFetch('/api/icp/discover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: icpQuery,
          mode: discoveryMode,
          businessContext,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'ICP scan failed');
      }

      if (data.state) {
        onSyncState(data.state);
        if (data.leads?.[0]?.id) {
          onSelectLead(data.leads[0].id);
        }
      } else {
        setScanError('No leads found for that query. Try broadening your search criteria.');
      }
    } catch (err: any) {
      setScanError(err?.message || 'Error scanning web for ICP leads.');
    } finally {
      setIsScanning(false);
    }
  };

  const handleAddManualLead = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualName.trim() || !manualEmail.trim()) return;
    try {
      const res = await apiFetch('/api/webhooks/inbound-lead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: manualName.trim(),
          role: manualRole.trim() || 'Executive',
          company: manualCompany.trim() || manualEmail.split('@')[1] || 'Account',
          email: manualEmail.trim(),
          location: 'Direct Entry',
          message: manualSignal.trim(),
          dealValue: Number(manualDealValue) || 10000,
        }),
      });
      const data = await res.json();
      if (res.ok && data.state) {
        onSyncState(data.state);
        if (data.lead?.id) onSelectLead(data.lead.id);
        setShowAddLeadForm(false);
        setManualName('');
        setManualRole('');
        setManualCompany('');
        setManualEmail('');
        setManualSignal('');
      }
    } catch (err: any) {
      setScanError(err?.message || 'Failed to add lead.');
    }
  };

  const handleSyncGmailReplies = async (importUnreadAsLeads = false) => {
    if (!accessToken) {
      await onRequestGoogleLogin();
      return;
    }
    setIsSyncingGmail(true);
    setSendError(null);
    try {
      const res = await apiFetch('/api/gmail/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ importUnreadAsLeads }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to sync Gmail.');
      }
      if (data.state) {
        onSyncState(data.state);
      }
      setSendFeedback(
        `Gmail synced: ${data.newRepliesFound || 0} new prospect replies, ${
          data.newLeadsImported || 0
        } inbox leads imported.`
      );
      setTimeout(() => setSendFeedback(null), 4000);
    } catch (err: any) {
      setSendError(err?.message || 'Error syncing Gmail.');
    } finally {
      setIsSyncingGmail(false);
    }
  };

  const handleTailorToLead = async () => {
    if (!selectedLead) return;
    setIsTailoring(true);
    setSendError(null);
    try {
      const response = await apiFetch('/api/email/tailor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lead: selectedLead,
          persona: activePersona,
          businessContext,
          cadenceMode: selectedLead.cadenceMode,
          timedIntervalDays: selectedLead.timedIntervalDays,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to tailor email');
      }

      const updatedSteps: FollowUpStep[] =
        selectedLead.cadenceMode === 'one_touch'
          ? []
          : (data.followUpSteps || []).map((st: any, idx: number) => {
              const offset = Number(st.dayOffset) || (idx + 1) * selectedLead.timedIntervalDays;
              return {
                id: `step-${Date.now()}-${idx}`,
                dayOffset: offset,
                subject: st.subject || `Re: ${data.tailoredSubject}`,
                body: st.body || '',
                status: 'scheduled' as const,
                scheduledAt: new Date(Date.now() + offset * 86400000).toISOString(),
                scheduledTimeLabel: st.scheduledTimeLabel || `Scheduled · Day +${offset}`,
              };
            });

      onUpdateLead({
        ...selectedLead,
        status: selectedLead.status === 'Discovered' ? 'Tailored' : selectedLead.status,
        tailoredSubject: data.tailoredSubject || selectedLead.tailoredSubject,
        tailoredBody: data.tailoredBody || selectedLead.tailoredBody,
        followUpSteps: updatedSteps,
      });
      setSendFeedback(`Custom-tailored email & cadence generated for ${selectedLead.fullName}.`);
      setTimeout(() => setSendFeedback(null), 3500);
    } catch (err: any) {
      setSendError(err?.message || 'Could not tailor email.');
    } finally {
      setIsTailoring(false);
    }
  };

  const handleToggleCadenceMode = (mode: CadenceMode) => {
    if (!selectedLead) return;
    const firstName = selectedLead.fullName.split(' ')[0];
    const signOff = activePersona?.linguisticSignature?.signOff || 'Best regards';
    const defaultFollowUps: FollowUpStep[] =
      mode === 'timed_sequence' && selectedLead.followUpSteps.length === 0
        ? [
            {
              id: `step-${Date.now()}-1`,
              dayOffset: selectedLead.timedIntervalDays,
              subject: `Re: ${selectedLead.tailoredSubject}`,
              body: `${firstName} — following up on my note above regarding ${selectedLead.company}. Happy to send over a brief overview if helpful.\n\n${signOff}`,
              status: 'scheduled',
              scheduledAt: new Date(
                Date.now() + selectedLead.timedIntervalDays * 86400000
              ).toISOString(),
              scheduledTimeLabel: `Scheduled · Day +${selectedLead.timedIntervalDays}`,
            },
          ]
        : mode === 'one_touch'
        ? []
        : selectedLead.followUpSteps;

    onUpdateLead({
      ...selectedLead,
      cadenceMode: mode,
      followUpSteps: defaultFollowUps,
    });
  };

  // Opens the mandatory confirmation modal before sending an email via Gmail API
  const initiateGmailSend = async (params: PendingEmailConfirmation) => {
    setSendError(null);
    if (!accessToken) {
      await onRequestGoogleLogin();
      return;
    }
    setPendingConfirm(params);
  };

  const executeConfirmedGmailSend = async () => {
    if (!pendingConfirm || !accessToken) return;
    setIsSendingGmail(true);
    setSendError(null);
    try {
      const res = await apiFetch('/api/gmail/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          leadId: pendingConfirm.leadId,
          to: pendingConfirm.to,
          subject: pendingConfirm.subject,
          body: pendingConfirm.body,
          threadId: pendingConfirm.threadId,
          senderName: activePersona?.name || userEmail || 'Sender',
          isFollowUp: pendingConfirm.isFollowUp,
          stepId: pendingConfirm.stepId,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to send email via Gmail.');
      }

      if (data.state) {
        onSyncState(data.state);
      }

      setSendFeedback(
        `Sent via Gmail to ${pendingConfirm.to} (Message ID: ${data.gmailMessageId}).`
      );
      setPendingConfirm(null);
      setTimeout(() => setSendFeedback(null), 5000);
    } catch (err: any) {
      setSendError(err?.message || 'Error sending email through Gmail.');
    } finally {
      setIsSendingGmail(false);
    }
  };

  const handleDraftAutonomousSalesAnswer = async () => {
    if (!selectedLead) return;
    const lastProspectMsg = [...selectedLead.thread]
      .reverse()
      .find((m) => m.sender === 'prospect');
    const questionToAnswer =
      lastProspectMsg?.body ||
      selectedLead.buyingSignal ||
      'Please share product details and pricing.';

    setIsAnsweringQuestion(true);
    setSendError(null);
    try {
      const response = await apiFetch('/api/email/handle-question', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lead: selectedLead,
          prospectQuestion: questionToAnswer,
          persona: activePersona,
          businessContext,
          cadenceMode: selectedLead.cadenceMode,
          timedIntervalDays: selectedLead.timedIntervalDays,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to draft sales answer');
      }

      // Open confirmation modal so the user can review and confirm sending via Gmail
      await initiateGmailSend({
        leadId: selectedLead.id,
        recipientName: selectedLead.fullName,
        to: selectedLead.email,
        subject: data.replySubject || `Re: ${selectedLead.tailoredSubject}`,
        body: data.replyBody,
        threadId: selectedLead.gmailThreadId,
        isFollowUp: true,
        actionTitle: 'Confirm & Send Sales Q&A Reply via Gmail',
      });
    } catch (err: any) {
      setSendError(err?.message || 'Error drafting sales Q&A response.');
    } finally {
      setIsAnsweringQuestion(false);
    }
  };

  const filteredLeads = leads.filter((l) =>
    statusFilter === 'All' ? true : l.status === statusFilter
  );

  return (
    <div className="space-y-6">
      {/* Mandatory User Confirmation Modal for Gmail Send Operations */}
      {pendingConfirm && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-gmail-title"
          className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4"
        >
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl max-w-lg w-full p-6 space-y-4 shadow-lg">
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <h2 id="confirm-gmail-title" className="text-base font-bold text-slate-900 dark:text-white">
                  {pendingConfirm.actionTitle}
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  This will send a live email from your connected Gmail account ({userEmail || 'Authenticated User'}).
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPendingConfirm(null)}
                className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2.5 text-xs">
              <div className="flex items-center justify-between py-1.5 px-3 bg-slate-50 dark:bg-slate-800/60 rounded border border-slate-200 dark:border-slate-700">
                <span className="text-slate-500 dark:text-slate-400">Recipient:</span>
                <span className="font-mono font-semibold text-slate-900 dark:text-slate-100">
                  {pendingConfirm.recipientName} &lt;{pendingConfirm.to}&gt;
                </span>
              </div>
              <div className="py-1.5 px-3 bg-slate-50 dark:bg-slate-800/60 rounded border border-slate-200 dark:border-slate-700">
                <span className="text-slate-500 dark:text-slate-400 block mb-0.5">Subject:</span>
                <span className="font-mono font-medium text-slate-900 dark:text-slate-100">
                  {pendingConfirm.subject}
                </span>
              </div>
              <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded border border-slate-200 dark:border-slate-700 max-h-56 overflow-y-auto whitespace-pre-line text-slate-800 dark:text-slate-200 leading-relaxed">
                {pendingConfirm.body}
              </div>
            </div>

            {sendError && (
              <p className="text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded px-3 py-2">
                {sendError}
              </p>
            )}

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setPendingConfirm(null)}
                disabled={isSendingGmail}
                className="px-4 py-2 text-xs font-medium text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={executeConfirmedGmailSend}
                disabled={isSendingGmail}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-60 rounded-lg transition-colors"
              >
                {isSendingGmail ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Sending via Gmail...
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" />
                    Confirm & Send Email
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Top Discovery Bar: Web ICP Scanner, Regional Maps Grounding, Intelligence Matcher & Gmail Inbox Sync */}
      <section className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl space-y-4 transition-colors shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Live Web Grounding · Google Maps Grounding · Product-to-Buyer Matching · Cloud SQL Postgres
            </p>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              ICP Discovery & Outbound Workbench
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Strategy Playbook Modal Trigger */}
            <button
              type="button"
              onClick={() => setShowStrategyModal(true)}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/80 border border-blue-200 dark:border-blue-800 hover:bg-blue-100 dark:hover:bg-blue-900/60 rounded-lg transition-colors whitespace-nowrap shadow-xs"
            >
              <BookOpen className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
              ICP Playbook &amp; Strategy
            </button>

            {/* Discovery Mode Switch */}
            <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
              <button
                type="button"
                onClick={() => setDiscoveryMode('web_scan')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                  discoveryMode === 'web_scan'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Globe className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                Live Web Scan
              </button>

              <button
                type="button"
                onClick={() => setDiscoveryMode('maps_scan')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                  discoveryMode === 'maps_scan'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <MapPin className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                Google Maps Scan
              </button>

              <button
                type="button"
                onClick={() => setDiscoveryMode('intelligence_match')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                  discoveryMode === 'intelligence_match'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Sliders className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
                Product Match
              </button>
            </div>

            <button
              type="button"
              onClick={() => setShowTerritoryMap(!showTerritoryMap)}
              className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium border rounded-lg transition-colors whitespace-nowrap ${
                showTerritoryMap
                  ? 'bg-blue-50 dark:bg-blue-950/60 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300'
                  : 'bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800'
              }`}
            >
              <MapPin className="w-3.5 h-3.5" />
              {showTerritoryMap ? 'Hide Map' : 'Show Map'}
            </button>

            <button
              type="button"
              onClick={() => setShowAddLeadForm(!showAddLeadForm)}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg transition-colors whitespace-nowrap"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Lead
            </button>

            <button
              type="button"
              disabled={isImportingCsv}
              onClick={() => csvLeadInputRef.current?.click()}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-60 rounded-lg transition-colors whitespace-nowrap"
            >
              {isImportingCsv ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Importing...
                </>
              ) : (
                <>
                  <Upload className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                  Import CSV
                </>
              )}
            </button>
            <input
              ref={csvLeadInputRef}
              type="file"
              accept=".csv,.txt"
              onChange={handleCsvLeadUpload}
              className="hidden"
            />

            <button
              type="button"
              onClick={() => handleSyncGmailReplies(true)}
              disabled={isSyncingGmail}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg transition-colors whitespace-nowrap"
            >
              {isSyncingGmail ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Inbox className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
              )}
              Sync Gmail
            </button>
          </div>
        </div>

        {csvFeedback && (
          <div className="p-2.5 text-xs font-medium text-emerald-800 dark:text-emerald-200 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 rounded-lg flex items-center justify-between">
            <span>✓ {csvFeedback}</span>
            <button
              type="button"
              onClick={() => setCsvFeedback(null)}
              className="text-emerald-600 hover:text-emerald-900 dark:hover:text-emerald-100"
            >
              ✕
            </button>
          </div>
        )}

        <form onSubmit={handleRunDiscovery} className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={icpQuery}
              onChange={(e) => setIcpQuery(e.target.value)}
              placeholder={
                discoveryMode === 'maps_scan'
                  ? 'Enter target facility, territory, or regional hub to scan via Google Maps (e.g. Precision fabricators or machine shops in Fort Wayne, IN)...'
                  : discoveryMode === 'web_scan'
                  ? 'Enter target ICP to scan on the live web (e.g., Contract CNC machining & precision parts manufacturers in Indiana)...'
                  : 'Enter vertical or operational pain point to match against your diagnostic offer...'
              }
              className="w-full pl-10 pr-4 py-2.5 text-sm bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-slate-900 dark:focus:border-slate-400"
            />
          </div>
          <button
            type="submit"
            disabled={isScanning}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 text-xs font-semibold text-white bg-slate-900 dark:bg-blue-600 hover:bg-slate-800 dark:hover:bg-blue-700 disabled:opacity-60 rounded-lg transition-colors whitespace-nowrap shrink-0 shadow-xs"
          >
            {isScanning ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                {discoveryMode === 'maps_scan'
                  ? 'Grounding on Google Maps...'
                  : discoveryMode === 'web_scan'
                  ? 'Scanning Live Web...'
                  : 'Matching Product ICP...'}
              </>
            ) : (
              <>
                <Search className="w-3.5 h-3.5" />
                {discoveryMode === 'maps_scan'
                  ? 'Run Google Maps Scan'
                  : discoveryMode === 'web_scan'
                  ? 'Scan Web for ICP Leads'
                  : 'Run Intelligence Match'}
              </>
            )}
          </button>
        </form>

        {/* Strategic ICP Quick Launchers from GTM Framework */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
          <span className="font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1 shrink-0 text-[11px]">
            <Target className="w-3 h-3 text-blue-600 dark:text-blue-400" />
            Priority Beachheads:
          </span>
          <button
            type="button"
            onClick={() =>
              handleQuickBeachheadSearch(
                'Precision CNC machining and industrial contract fabrication companies in Indiana and Midwest ($10M-$40M revenue, 40-175 employees)',
                'web_scan'
              )
            }
            className="px-2.5 py-1 text-[11px] font-medium rounded-md bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200 border border-amber-200 dark:border-amber-800 hover:bg-amber-100 dark:hover:bg-amber-900/60 transition-colors"
          >
            A1: Precision Mfg (Midwest Beachhead)
          </button>
          <button
            type="button"
            onClick={() =>
              handleQuickBeachheadSearch(
                'Engineering systems integrators and specialty technical services firms in US with multi-stage delivery ($10M-$50M revenue)',
                'web_scan'
              )
            }
            className="px-2.5 py-1 text-[11px] font-medium rounded-md bg-blue-50 dark:bg-blue-950/40 text-blue-900 dark:text-blue-200 border border-blue-200 dark:border-blue-800 hover:bg-blue-100 dark:hover:bg-blue-900/60 transition-colors"
          >
            A2: Engineering &amp; IT Services
          </button>
          <button
            type="button"
            onClick={() =>
              handleQuickBeachheadSearch(
                'Commercial HVAC, mechanical trades, and industrial distributors in Chicago, Indianapolis, Columbus',
                'maps_scan'
              )
            }
            className="px-2.5 py-1 text-[11px] font-medium rounded-md bg-emerald-50 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-200 border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 transition-colors"
          >
            A3: Field Trades &amp; Distributors
          </button>
          <button
            type="button"
            onClick={() =>
              handleQuickBeachheadSearch(
                'Fractional COO, executive advisors, and boutique leadership consultancies preparing for executive meetings',
                'intelligence_match'
              )
            }
            className="px-2.5 py-1 text-[11px] font-medium rounded-md bg-purple-50 dark:bg-purple-950/40 text-purple-900 dark:text-purple-200 border border-purple-200 dark:border-purple-800 hover:bg-purple-100 dark:hover:bg-purple-900/60 transition-colors"
          >
            Mindprint: Fractional Advisers
          </button>
        </div>

        {/* Manual Lead Entry Drawer */}
        {showAddLeadForm && (
          <form
            onSubmit={handleAddManualLead}
            className="p-4 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-lg space-y-3"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-900 dark:text-white">
                Add Real Recipient / Lead
              </span>
              <button
                type="button"
                onClick={() => setShowAddLeadForm(false)}
                className="text-xs text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
              >
                Close
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <input
                type="text"
                required
                placeholder="Full Name *"
                value={manualName}
                onChange={(e) => setManualName(e.target.value)}
                className="px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-md text-slate-900 dark:text-slate-100"
              />
              <input
                type="email"
                required
                placeholder="Recipient Email Address *"
                value={manualEmail}
                onChange={(e) => setManualEmail(e.target.value)}
                className="px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-md text-slate-900 dark:text-slate-100 font-mono"
              />
              <input
                type="text"
                placeholder="Role / Title (e.g., VP Operations)"
                value={manualRole}
                onChange={(e) => setManualRole(e.target.value)}
                className="px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-md text-slate-900 dark:text-slate-100"
              />
              <input
                type="text"
                placeholder="Company Name"
                value={manualCompany}
                onChange={(e) => setManualCompany(e.target.value)}
                className="px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-md text-slate-900 dark:text-slate-100"
              />
              <input
                type="text"
                placeholder="Location (e.g., Austin, TX)"
                value={manualSignal}
                onChange={(e) => setManualSignal(e.target.value)}
                className="px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-md text-slate-900 dark:text-slate-100"
              />
              <input
                type="number"
                placeholder="Est. Deal Value ($)"
                value={manualDealValue}
                onChange={(e) => setManualDealValue(Number(e.target.value))}
                className="px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-md text-slate-900 dark:text-slate-100 font-mono"
              />
            </div>
            <div className="flex justify-end">
              <button
                type="submit"
                className="px-4 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-md shadow-xs"
              >
                Save Lead to Queue
              </button>
            </div>
          </form>
        )}

        {scanError && (
          <p className="text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900/50 rounded-lg px-3 py-2">
            {scanError}
          </p>
        )}
      </section>

      {/* Interactive Google Maps Territory View */}
      {showTerritoryMap && leads.length > 0 && (
        <LeadLocationsMap
          leads={leads}
          selectedLeadId={selectedLead?.id || ''}
          onSelectLead={onSelectLead}
          onDraftOutbound={handleTailorToLead}
        />
      )}

      {leads.length === 0 ? (
        <div className="p-12 bg-white border border-slate-200 rounded-xl text-center space-y-4">
          <Globe className="w-8 h-8 text-slate-400 mx-auto" />
          <div className="space-y-1 max-w-md mx-auto">
            <h2 className="text-base font-semibold text-slate-900">
              Your ICP Lead Queue is Empty
            </h2>
            <p className="text-xs text-slate-500 leading-relaxed">
              Use the search bar above to scan the live web for real companies matching your ICP, click &ldquo;Add Lead&rdquo; to enter a recipient email directly, or click &ldquo;Sync Gmail Replies &amp; Unread&rdquo; to import unread emails from your inbox.
            </p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Roster Column */}
          <div className="lg:col-span-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                  Matched ICP Queue
                </h2>
                <span className="text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400">
                  {filteredLeads.length} leads
                </span>
              </div>

              <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg overflow-x-auto">
                {['All', 'Question Received', 'Active Sequence', 'Discovered', 'Converted'].map(
                  (st) => (
                    <button
                      key={st}
                      type="button"
                      onClick={() => setStatusFilter(st)}
                      className={`px-2.5 py-1 text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 ${
                        statusFilter === st
                          ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      {st === 'Question Received' ? 'Questions' : st}
                    </button>
                  )
                )}
              </div>
            </div>

            <div className="divide-y divide-slate-100 dark:divide-slate-800/80 max-h-[680px] overflow-y-auto">
              {filteredLeads.map((lead) => {
                const isSelected = lead.id === selectedLead?.id;
                return (
                  <button
                    key={lead.id}
                    type="button"
                    onClick={() => onSelectLead(lead.id)}
                    className={`w-full text-left p-4 transition-colors flex items-start gap-3.5 ${
                      isSelected
                        ? 'bg-slate-900 dark:bg-blue-950/80 text-white'
                        : 'hover:bg-slate-50 dark:hover:bg-slate-800/50 text-slate-900 dark:text-slate-100'
                    }`}
                  >
                    <div className="w-9 h-9 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 flex items-center justify-center font-semibold text-xs shrink-0">
                      <span>
                        {lead.fullName
                          .split(' ')
                          .map((n) => n[0])
                          .join('')
                          .slice(0, 2)
                          .toUpperCase()}
                      </span>
                    </div>

                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <p
                          className={`text-sm font-semibold truncate ${
                            isSelected ? 'text-white' : 'text-slate-900 dark:text-white'
                          }`}
                        >
                          {lead.fullName}
                        </p>
                        <span
                          className={`text-[11px] font-mono tabular-nums shrink-0 px-2 py-0.5 rounded font-bold ${
                            isSelected
                              ? 'bg-blue-800 text-blue-100'
                              : lead.matchScore >= 80
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300'
                              : 'bg-blue-100 text-blue-800 dark:bg-blue-950/80 dark:text-blue-300'
                          }`}
                        >
                          {lead.matchScore}/100 {lead.matchScore >= 80 ? 'Priority' : 'Qualified'}
                        </span>
                      </div>

                      <p
                        className={`text-xs truncate ${
                          isSelected ? 'text-slate-300' : 'text-slate-600 dark:text-slate-400'
                        }`}
                      >
                        {lead.role} · {lead.company}
                      </p>

                      <div
                        className={`flex items-center gap-1.5 text-xs ${
                          isSelected ? 'text-slate-400' : 'text-slate-500 dark:text-slate-400'
                        }`}
                      >
                        <span>{lead.status}</span>
                        <span aria-hidden="true">·</span>
                        <span>
                          {lead.cadenceMode === 'one_touch'
                            ? '1-Touch Only'
                            : `Timed (${lead.timedIntervalDays}d)`}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono tabular-nums">
                          {lead.metrics.opens} opens
                        </span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Right Detail & Composer Column */}
          {selectedLead && (
            <div className="lg:col-span-8 space-y-6">
              {/* Lead Intelligence Header */}
              <div className="p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-4">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                      <span className="font-medium text-blue-700 dark:text-blue-400">{selectedLead.matchType}</span>
                      <span aria-hidden="true">·</span>
                      <input
                        type="email"
                        value={selectedLead.email}
                        onChange={(e) =>
                          onUpdateLead({ ...selectedLead, email: e.target.value })
                        }
                        title="Edit recipient email address"
                        className="font-mono text-slate-800 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded border border-transparent focus:border-slate-400 focus:bg-white dark:focus:bg-slate-900 focus:outline-none"
                      />
                      <span aria-hidden="true">·</span>
                      <span>{selectedLead.location}</span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono tabular-nums font-semibold text-slate-900 dark:text-white">
                        Est. Value ${selectedLead.metrics.dealValue.toLocaleString()}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                        {selectedLead.fullName} — {selectedLead.role} at {selectedLead.company}
                      </h2>
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded font-mono text-xs font-bold bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                        <Award className="w-3.5 h-3.5" />
                        {selectedLead.matchScore}/100 ICP Score
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => onConvertLeadToInvoice(selectedLead)}
                      className="px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors whitespace-nowrap"
                    >
                      Create Invoice
                    </button>
                    <button
                      type="button"
                      onClick={handleTailorToLead}
                      disabled={isTailoring}
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-60 rounded-lg transition-colors whitespace-nowrap"
                    >
                      {isTailoring ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          Tailoring...
                        </>
                      ) : (
                        <>
                          <RefreshCw className="w-3.5 h-3.5" />
                          Tailor Email &amp; Sequence
                        </>
                      )}
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                  <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-lg space-y-1">
                    <span className="font-semibold text-slate-900 dark:text-white block flex items-center gap-1.5">
                      <Target className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                      Active Operational Trigger &amp; Buying Signal
                    </span>
                    <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
                      {selectedLead.buyingSignal}
                    </p>
                  </div>
                  <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-lg space-y-1">
                    <span className="font-semibold text-slate-900 dark:text-white block flex items-center gap-1.5">
                      <Sliders className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                      Product-to-ICP Fit &amp; Handoff Diagnosis
                    </span>
                    <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
                      {selectedLead.icpFitRationale}
                    </p>
                  </div>
                </div>

                {/* 100-Point Account Qualification & Action Breakdown */}
                <div className="p-3.5 bg-blue-50/60 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900/50 rounded-lg space-y-2 text-xs">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Award className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                      <span className="font-semibold text-blue-950 dark:text-blue-200">
                        Strategic Account Qualification (100-Point Model):
                      </span>
                      <span className="font-mono font-bold text-blue-800 dark:text-blue-300">
                        {selectedLead.matchScore >= 80 ? '80–100 Priority Account' : '65–79 Discovery Account'}
                      </span>
                    </div>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400">
                      Recommended Offer: <strong>{selectedLead.metrics.dealValue >= 6500 ? 'Golden Diagnostic ($6,500)' : 'Intel Briefing ($99)'}</strong>
                    </span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] text-slate-600 dark:text-slate-300 pt-1 border-t border-blue-100/80 dark:border-blue-900/40">
                    <div>
                      <span className="text-slate-400 block">Process Complexity</span>
                      <strong className="text-slate-900 dark:text-white font-mono">25 / 25 pts</strong>
                    </div>
                    <div>
                      <span className="text-slate-400 block">Active Trigger</span>
                      <strong className="text-slate-900 dark:text-white font-mono">20 / 20 pts</strong>
                    </div>
                    <div>
                      <span className="text-slate-400 block">Economic Buyer</span>
                      <strong className="text-slate-900 dark:text-white font-mono">20 / 20 pts</strong>
                    </div>
                    <div>
                      <span className="text-slate-400 block">Route Action</span>
                      <strong className="text-emerald-700 dark:text-emerald-400 font-mono">Custom Diagnostic</strong>
                    </div>
                  </div>
                </div>

                {selectedLead.groundingSources &&
                  selectedLead.groundingSources.length > 0 && (
                    <div className="flex flex-wrap items-center gap-3 pt-1 text-xs text-slate-500 dark:text-slate-400">
                      <span className="font-medium text-slate-700 dark:text-slate-300">Verified Web Citations:</span>
                      {selectedLead.groundingSources.map((src, i) => (
                        <a
                          key={i}
                          href={src.uri}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-blue-700 dark:text-blue-400 hover:underline truncate max-w-[260px]"
                        >
                          <span>{src.title}</span>
                          <ExternalLink className="w-3 h-3 shrink-0" />
                        </a>
                      ))}
                    </div>
                  )}
              </div>

              {/* Follow-Up Cadence Toggle Bar (One-Touch vs Timed Multi-Touch) */}
              <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                      Follow-Up & Sales Q&A Mode Toggle
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Keep it a single one-time email or schedule timed follow-ups
                    </p>
                  </div>

                  <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg self-start">
                    <button
                      type="button"
                      onClick={() => handleToggleCadenceMode('one_touch')}
                      className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                        selectedLead.cadenceMode === 'one_touch'
                          ? 'bg-slate-900 dark:bg-slate-700 text-white shadow-xs'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      Keep It One (Single Email)
                    </button>
                    <button
                      type="button"
                      onClick={() => handleToggleCadenceMode('timed_sequence')}
                      className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                        selectedLead.cadenceMode === 'timed_sequence'
                          ? 'bg-slate-900 dark:bg-slate-700 text-white shadow-xs'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      Timed Follow-Up Cadence
                    </button>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-4 pt-3 border-t border-slate-100 dark:border-slate-800 text-xs">
                  <div className="flex items-center gap-3">
                    <span className="text-slate-600 dark:text-slate-400 font-medium">
                      Active Voice:{' '}
                      <strong className="text-slate-900 dark:text-white">
                        {activePersona?.name || 'Default Voice'}
                      </strong>
                    </span>
                    {selectedTemplate && (
                      <>
                        <span aria-hidden="true" className="text-slate-300 dark:text-slate-600">
                          ·
                        </span>
                        <span className="text-blue-700 dark:text-blue-400">
                          Template: {selectedTemplate.title}
                        </span>
                      </>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-4">
                    {selectedLead.cadenceMode === 'timed_sequence' && (
                      <div className="flex items-center gap-2">
                        <Clock className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                        <label className="text-slate-600 dark:text-slate-400">Wait Interval:</label>
                        <select
                          value={selectedLead.timedIntervalDays}
                          onChange={(e) =>
                            onUpdateLead({
                              ...selectedLead,
                              timedIntervalDays: Number(e.target.value),
                            })
                          }
                          className="px-2 py-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded font-mono tabular-nums text-slate-900 dark:text-slate-100"
                        >
                          <option value={2}>Every 2 days</option>
                          <option value={3}>Every 3 days</option>
                          <option value={5}>Every 5 days</option>
                          <option value={7}>Every 7 days</option>
                        </select>
                      </div>
                    )}

                    <label className="inline-flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={selectedLead.autoHandleQuestions}
                        onChange={(e) =>
                          onUpdateLead({
                            ...selectedLead,
                            autoHandleQuestions: e.target.checked,
                          })
                        }
                        className="rounded border-slate-300 text-slate-900 focus:ring-slate-900"
                      />
                      <span className="text-slate-700 dark:text-slate-300 font-medium">
                        Auto-Draft Sales Q&A Replies
                      </span>
                    </label>
                  </div>
                </div>
              </div>

              {/* Custom-Tailored Outbound Email Composer */}
              <div className="p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                    <Mail className="w-4 h-4 text-slate-600 dark:text-slate-400" />
                    Custom-Tailored Outbound Message
                  </h3>
                  <span className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                    To: {selectedLead.fullName} &lt;{selectedLead.email}&gt;
                  </span>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                      Subject Line
                    </label>
                    <input
                      type="text"
                      value={selectedLead.tailoredSubject}
                      onChange={(e) =>
                        onUpdateLead({
                          ...selectedLead,
                          tailoredSubject: e.target.value,
                        })
                      }
                      className="w-full px-3.5 py-2 text-sm font-mono bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-lg focus:outline-none focus:border-slate-900 dark:focus:border-slate-400"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                      Tailored Email Body (Open-tracking pixel embedded automatically on send)
                    </label>
                    <textarea
                      rows={8}
                      value={selectedLead.tailoredBody}
                      onChange={(e) =>
                        onUpdateLead({
                          ...selectedLead,
                          tailoredBody: e.target.value,
                        })
                      }
                      className="w-full p-3.5 text-sm leading-relaxed bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-lg focus:outline-none focus:border-slate-900 dark:focus:border-slate-400"
                    />
                  </div>
                </div>

                {/* Timed Follow-up Queue Preview */}
                {selectedLead.cadenceMode === 'timed_sequence' &&
                  selectedLead.followUpSteps.length > 0 && (
                    <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-2.5">
                      <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                        Timed Follow-Up Steps ({selectedLead.followUpSteps.length})
                      </p>
                      <div className="space-y-2">
                        {selectedLead.followUpSteps.map((step, idx) => (
                          <div
                            key={step.id || idx}
                            className="p-3 bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700 rounded-lg text-xs space-y-2"
                          >
                            <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 font-mono tabular-nums">
                              <span className="font-semibold text-slate-800 dark:text-slate-200">
                                Follow-Up #{idx + 1} · Day +{step.dayOffset}
                              </span>
                              <div className="flex items-center gap-3">
                                <span>{step.scheduledTimeLabel}</span>
                                {step.status !== 'sent' && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      initiateGmailSend({
                                        leadId: selectedLead.id,
                                        recipientName: selectedLead.fullName,
                                        to: selectedLead.email,
                                        subject: step.subject,
                                        body: step.body,
                                        threadId: selectedLead.gmailThreadId,
                                        isFollowUp: true,
                                        stepId: step.id,
                                        actionTitle: `Confirm & Send Follow-Up #${idx + 1} via Gmail`,
                                      })
                                    }
                                    className="text-blue-700 dark:text-blue-400 hover:underline font-sans font-semibold"
                                  >
                                    Send Follow-Up Now
                                  </button>
                                )}
                              </div>
                            </div>
                            <p className="text-slate-700 dark:text-slate-300 whitespace-pre-line">{step.body}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                {sendFeedback && (
                  <div className="flex items-center gap-2 text-xs text-emerald-800 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 px-3.5 py-2.5 rounded-lg">
                    <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                    <span>{sendFeedback}</span>
                  </div>
                )}

                {sendError && (
                  <div className="flex items-center gap-2 text-xs text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 px-3.5 py-2.5 rounded-lg">
                    <AlertCircle className="w-4 h-4 shrink-0 text-red-600 dark:text-red-400" />
                    <span>{sendError}</span>
                  </div>
                )}

                <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    {selectedLead.cadenceMode === 'one_touch'
                      ? 'Mode: Single Email Only · No follow-up sequence scheduled.'
                      : `Mode: Timed Sequence · ${selectedLead.followUpSteps.length} follow-up step(s) queued.`}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      initiateGmailSend({
                        leadId: selectedLead.id,
                        recipientName: selectedLead.fullName,
                        to: selectedLead.email,
                        subject: selectedLead.tailoredSubject,
                        body: selectedLead.tailoredBody,
                        threadId: selectedLead.gmailThreadId,
                        actionTitle: 'Confirm & Send Outbound Email via Gmail',
                      })
                    }
                    className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 dark:bg-blue-600 dark:hover:bg-blue-500 rounded-lg transition-colors whitespace-nowrap"
                  >
                    <Send className="w-3.5 h-3.5" />
                    {accessToken
                      ? 'Send Email via Gmail'
                      : 'Connect Gmail & Send Email'}
                  </button>
                </div>
              </div>

              {/* Live Gmail Thread & Sales Question Handler */}
              <div className="p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                      <MessageSquare className="w-4 h-4 text-slate-600 dark:text-slate-400" />
                      Gmail Thread & Sales Q&A Handler
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Syncs replies from {selectedLead.email} and drafts answers in your personal voice
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleSyncGmailReplies(false)}
                      disabled={isSyncingGmail}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors whitespace-nowrap"
                    >
                      {isSyncingGmail ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <RefreshCw className="w-3.5 h-3.5" />
                      )}
                      Check Gmail for Replies
                    </button>

                    <button
                      type="button"
                      onClick={handleDraftAutonomousSalesAnswer}
                      disabled={isAnsweringQuestion}
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-60 rounded-lg transition-colors whitespace-nowrap"
                    >
                      {isAnsweringQuestion ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          Drafting Reply...
                        </>
                      ) : (
                        <>
                          <UserCheck className="w-3.5 h-3.5" />
                          Draft & Send Sales Q&A Reply
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {selectedLead.thread.length === 0 ? (
                  <div className="py-8 text-center space-y-2">
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      No Gmail messages exchanged with {selectedLead.email} yet.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {selectedLead.thread.map((msg) => (
                      <div
                        key={msg.id}
                        className={`p-4 rounded-lg border text-xs space-y-1.5 ${
                          msg.sender === 'prospect'
                            ? 'bg-amber-50/50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900/60'
                            : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200/80 dark:border-slate-700'
                        }`}
                      >
                        <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
                          <span className="font-semibold text-slate-900 dark:text-white">
                            {msg.senderName}{' '}
                            <span className="font-normal text-slate-500 dark:text-slate-400">
                              ·{' '}
                              {msg.sender === 'prospect'
                                ? 'Incoming Gmail Reply'
                                : 'Sent via Gmail'}
                            </span>
                          </span>
                          <span className="font-mono tabular-nums">{msg.timestamp}</span>
                        </div>
                        {msg.subject && (
                          <p className="font-mono text-slate-600 dark:text-slate-400">
                            Subject: {msg.subject}
                          </p>
                        )}
                        <p className="text-slate-700 dark:text-slate-300 whitespace-pre-line leading-relaxed">
                          {msg.body}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ICP Strategy & Playbook Modal */}
      {showStrategyModal && (
        <IcpStrategyModal
          isOpen={showStrategyModal}
          onClose={() => setShowStrategyModal(false)}
          businessContext={businessContext}
          onApplyPreset={(preset) => {
            if (onApplyBusinessContext) {
              onApplyBusinessContext(preset);
            }
          }}
          onQuickSearch={(query, mode) => {
            handleQuickBeachheadSearch(query, mode);
          }}
        />
      )}
    </div>
  );
};
