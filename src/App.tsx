import { apiFetch } from './services/apiFetch';
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import {
  BarChart3,
  Bell,
  CheckCircle2,
  CreditCard,
  FileText,
  LogOut,
  Moon,
  Send,
  Sun,
  Users,
  X,
} from 'lucide-react';
import { User } from 'firebase/auth';
import {
  BusinessContext,
  EmailTemplate,
  InvoiceRecord,
  Lead,
  LiveNotification,
  PersonaProfile,
  TeamMember,
  WorkspaceState,
} from './types';
import { initAuth, googleSignIn, logout } from './services/googleAuth';
import { PersonaTemplatesView } from './components/PersonaTemplatesView';
import { IcpOutboundView } from './components/IcpOutboundView';
import { PerformanceDashboardView } from './components/PerformanceDashboardView';
import { BillingGatewaysView } from './components/BillingGatewaysView';
import { LiveNotificationsView } from './components/LiveNotificationsView';
import { TeamOperatorsModal } from './components/TeamOperatorsModal';

type ActiveTab = 'persona' | 'outbound' | 'performance' | 'billing' | 'notifications';

const EMPTY_BUSINESS_CONTEXT: BusinessContext = {
  companyName: '',
  productName: '',
  valueProposition: '',
  targetIndustries: '',
  idealBuyerRoles: '',
  keyDifferentiators: '',
  pricingSummary: '',
};

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('outbound');
  const [isLoadingState, setIsLoadingState] = useState<boolean>(true);

  // Dual-Theme Dark Mode State
  const [isDark, setIsDark] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('cadence_theme');
      if (saved) return saved === 'dark';
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return false;
  });

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('cadence_theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('cadence_theme', 'light');
    }
  }, [isDark]);

  // Google Workspace OAuth State
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [needsAuth, setNeedsAuth] = useState<boolean>(true);
  const [isLoggingIn, setIsLoggingIn] = useState<boolean>(false);

  // Persistent Workspace State (loaded from /api/state)
  const [personas, setPersonas] = useState<PersonaProfile[]>([]);
  const [activePersonaId, setActivePersonaId] = useState<string>('');
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<EmailTemplate | null>(null);
  const [businessContext, setBusinessContext] = useState<BusinessContext>(
    EMPTY_BUSINESS_CONTEXT
  );
  const [leads, setLeads] = useState<Lead[]>([]);
  const [selectedLeadId, setSelectedLeadId] = useState<string>('');
  const [invoices, setInvoices] = useState<InvoiceRecord[]>([]);
  const [notifications, setNotifications] = useState<LiveNotification[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [showTeamModal, setShowTeamModal] = useState<boolean>(false);
  const [activeToast, setActiveToast] = useState<LiveNotification | null>(null);
  const [isSyncingGmail, setIsSyncingGmail] = useState<boolean>(false);

  // Direct Checkout URL Modal Handler (?checkout_invoice=...)
  const [checkoutInvoiceId, setCheckoutInvoiceId] = useState<string | null>(null);

  const applyServerState = (state: WorkspaceState) => {
    setBusinessContext(state.businessContext || EMPTY_BUSINESS_CONTEXT);
    setPersonas(state.personas || []);
    setActivePersonaId(state.activePersonaId || state.personas?.[0]?.id || '');
    setTemplates(state.templates || []);
    setLeads(state.leads || []);
    if (!selectedLeadId && state.leads?.[0]?.id) {
      setSelectedLeadId(state.leads[0].id);
    }
    setInvoices(state.invoices || []);
    setNotifications(state.notifications || []);
    if (state.teamMembers) {
      setTeamMembers(state.teamMembers);
    }
  };

  const handleInviteTeamMember = async (member: {
    email: string;
    name: string;
    role: 'Owner' | 'Architect' | 'Operator' | 'Viewer';
    permissions: string[];
  }) => {
    try {
      const res = await apiFetch('/api/team/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(member),
      });
      const data = await res.json();
      if (res.ok && data.teamMembers) {
        setTeamMembers(data.teamMembers);
      }
    } catch (err) {
      console.error('Failed to invite team member:', err);
    }
  };

  const persistWorkspaceState = async (next: Partial<WorkspaceState>) => {
    try {
      const res = await apiFetch('/api/state', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(next),
      });
      if (res.ok) {
        const saved = await res.json();
        applyServerState(saved);
      }
    } catch (e) {
      console.error('Failed to persist state:', e);
    }
  };

  // 1. Initialize Firebase Auth + Load Persistent Server State + Connect SSE Stream
  useEffect(() => {
    const unsubscribeAuth = initAuth(
      (authedUser, token) => {
        setUser(authedUser);
        setAccessToken(token);
        setNeedsAuth(false);
      },
      () => {
        setNeedsAuth(true);
      }
    );

    return () => {
      unsubscribeAuth();
      evtSource.close();
    };
  }, []);

  // Authenticated workspace refresh; never subscribe to private state anonymously.
  useEffect(() => {
    if (!accessToken) {
      setIsLoadingState(false);
      return;
    }
    let active = true;
    const refresh = async () => {
      try {
        const response = await apiFetch('/api/state');
        if (!response.ok) throw new Error(`Workspace access denied (${response.status})`);
        const state: WorkspaceState = await response.json();
        if (active) {
          applyServerState(state);
          const checkout = new URLSearchParams(window.location.search).get('checkout_invoice');
          if (checkout) setCheckoutInvoiceId(checkout);
        }
      } catch (error) {
        console.error('Workspace loading failed:', error);
      } finally {
        if (active) setIsLoadingState(false);
      }
    };
    void refresh();
    const interval = window.setInterval(refresh, 15000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [accessToken]);

  // Periodic background Gmail reply sync when authenticated
  useEffect(() => {
    if (!accessToken) return;
    const interval = setInterval(() => {
      apiFetch('/api/gmail/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ importUnreadAsLeads: false }),
      })
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          if (data?.state && (data.newRepliesFound > 0 || data.newLeadsImported > 0)) {
            applyServerState(data.state);
          }
        })
        .catch(() => {});
    }, 30000);
    return () => clearInterval(interval);
  }, [accessToken]);

  const handleGoogleLogin = async () => {
    setIsLoggingIn(true);
    try {
      const result = await googleSignIn();
      if (result) {
        setUser(result.user);
        setAccessToken(result.accessToken);
        setNeedsAuth(false);
      }
    } catch (err) {
      console.error('Google Sign-In failed:', err);
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    setUser(null);
    setAccessToken(null);
    setNeedsAuth(true);
  };

  const handleSyncGmailNow = async () => {
    if (!accessToken) {
      await handleGoogleLogin();
      return;
    }
    setIsSyncingGmail(true);
    try {
      const res = await apiFetch('/api/gmail/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ importUnreadAsLeads: true }),
      });
      const data = await res.json();
      if (res.ok && data.state) {
        applyServerState(data.state);
      }
    } finally {
      setIsSyncingGmail(false);
    }
  };

  const activePersona =
    personas.find((p) => p.id === activePersonaId) || personas[0] || null;

  const handleUpdateBusinessContext = (ctx: BusinessContext) => {
    setBusinessContext(ctx);
    persistWorkspaceState({ businessContext: ctx });
  };

  const handleUpdateTemplate = (updated: EmailTemplate) => {
    const next = templates.map((t) => (t.id === updated.id ? updated : t));
    setTemplates(next);
    persistWorkspaceState({ templates: next });
  };

  const handleDeleteTemplate = (id: string) => {
    const next = templates.filter((t) => t.id !== id);
    setTemplates(next);
    persistWorkspaceState({ templates: next });
  };

  const handleAddBlankTemplate = (tpl: EmailTemplate) => {
    const next = [tpl, ...templates];
    setTemplates(next);
    persistWorkspaceState({ templates: next });
  };

  const handleApplyTemplateToLead = (tpl: EmailTemplate) => {
    setSelectedTemplate(tpl);
    const currentLead = leads.find((l) => l.id === selectedLeadId) || leads[0];
    if (currentLead) {
      const firstName = currentLead.fullName.split(' ')[0];
      const interpolatedSubject = tpl.subjectLine
        .replace(/\{\{firstName\}\}/g, firstName)
        .replace(/\{\{company\}\}/g, currentLead.company)
        .replace(/\{\{buyingSignal\}\}/g, currentLead.buyingSignal);
      const interpolatedBody = tpl.body
        .replace(/\{\{firstName\}\}/g, firstName)
        .replace(/\{\{company\}\}/g, currentLead.company)
        .replace(/\{\{buyingSignal\}\}/g, currentLead.buyingSignal);

      const nextLeads = leads.map((l) =>
        l.id === currentLead.id
          ? {
              ...l,
              activeTemplateId: tpl.id,
              tailoredSubject: interpolatedSubject,
              tailoredBody: interpolatedBody,
            }
          : l
      );
      setLeads(nextLeads);
      persistWorkspaceState({ leads: nextLeads });
    }
    setActiveTab('outbound');
  };

  const handleUpdateLead = (updated: Lead) => {
    const next = leads.map((l) => (l.id === updated.id ? updated : l));
    setLeads(next);
    persistWorkspaceState({ leads: next });
  };

  const handleConvertLeadToInvoice = (lead: Lead) => {
    const today = new Date();
    const due = new Date(Date.now() + 14 * 86400000);
    const newInv: InvoiceRecord = {
      id: `inv-${Date.now()}`,
      invoiceNumber: `INV-${Math.floor(1000 + Math.random() * 9000)}`,
      leadId: lead.id,
      clientName: lead.fullName,
      company: lead.company,
      email: lead.email,
      planOrService: `${businessContext.productName || 'Solution'} Deployment`,
      amount: lead.metrics.dealValue || 5000,
      billingCycle: 'One-Time',
      gateway: 'Stripe Express',
      status: 'Pending Auto-Charge',
      issuedDate: today.toLocaleDateString(),
      dueDate: due.toLocaleDateString(),
      autoRemind: true,
    };
    const nextInvoices = [newInv, ...invoices];
    const nextLeads = leads.map((l) =>
      l.id === lead.id ? { ...l, status: 'Converted' as const } : l
    );
    setInvoices(nextInvoices);
    setLeads(nextLeads);
    persistWorkspaceState({ invoices: nextInvoices, leads: nextLeads });
    setActiveTab('billing');
  };

  const unreadCount = notifications.filter((n) => n.unread).length;
  const checkoutInvoice = invoices.find((i) => i.id === checkoutInvoiceId) || null;

  return (
    <div className="min-h-screen flex flex-col bg-[#FAFAFA] dark:bg-slate-950 text-slate-900 dark:text-slate-100 pb-16 md:pb-0 transition-colors">
      {/* Direct Invoice Checkout Modal when opened via Checkout Link */}
      {checkoutInvoice && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4 backdrop-blur-xs"
        >
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl max-w-md w-full p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400">{checkoutInvoice.gateway}</p>
                <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  Invoice {checkoutInvoice.invoiceNumber}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setCheckoutInvoiceId(null)}
                className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-2 text-xs">
              <p className="text-slate-600 dark:text-slate-300">
                Billed to: <strong className="text-slate-900 dark:text-white">{checkoutInvoice.clientName}</strong> ({checkoutInvoice.company})
              </p>
              <p className="text-slate-600 dark:text-slate-300">
                Scope: <strong className="text-slate-900 dark:text-white">{checkoutInvoice.planOrService}</strong>
              </p>
              <p className="text-2xl font-bold font-mono tabular-nums text-slate-900 dark:text-white pt-2">
                ${checkoutInvoice.amount.toLocaleString()}.00
              </p>
            </div>
            {checkoutInvoice.status === 'Paid' ? (
              <div className="flex items-center gap-2 text-xs text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 p-3 rounded-lg border border-emerald-200 dark:border-emerald-800/40">
                <CheckCircle2 className="w-4 h-4" />
                <span>Settled ({checkoutInvoice.transactionRef})</span>
              </div>
            ) : (
              <button
                type="button"
                onClick={async () => {
                  window.alert('Online payment is unavailable until a verified payment processor is connected. Contact Aetheris for secure payment instructions.');
                }}
                className="w-full py-2.5 px-4 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm"
              >
                Payment processing unavailable
              </button>
            )}
          </div>
        </div>
      )}

      {/* Team Operators & Connection Management Modal */}
      <TeamOperatorsModal
        isOpen={showTeamModal}
        onClose={() => setShowTeamModal(false)}
        teamMembers={teamMembers}
        currentUserEmail={user?.email || null}
        onInviteMember={handleInviteTeamMember}
      />

      {/* Strict 3-Zone Top Navigation Bar Contract */}
      <header className="sticky top-0 z-30 flex items-center justify-between gap-8 px-4 sm:px-8 py-3.5 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 transition-colors">
        {/* Zone 1: Single text element wordmark */}
        <a
          href="#top"
          onClick={(e) => {
            e.preventDefault();
            setActiveTab('outbound');
          }}
          className="text-lg font-bold tracking-tight text-slate-900 dark:text-white whitespace-nowrap shrink-0 font-display"
        >
          Cadence
        </a>

        {/* Zone 2: 5 concise single-line text navigation links */}
        <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600 dark:text-slate-400">
          <button
            type="button"
            onClick={() => setActiveTab('persona')}
            className={`py-1 transition-colors whitespace-nowrap shrink-0 border-b-2 ${
              activeTab === 'persona'
                ? 'border-slate-900 dark:border-white text-slate-900 dark:text-white font-semibold'
                : 'border-transparent hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Persona & Templates
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('outbound')}
            className={`py-1 transition-colors whitespace-nowrap shrink-0 border-b-2 ${
              activeTab === 'outbound'
                ? 'border-slate-900 dark:border-white text-slate-900 dark:text-white font-semibold'
                : 'border-transparent hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            ICP & Outbound
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('performance')}
            className={`py-1 transition-colors whitespace-nowrap shrink-0 border-b-2 ${
              activeTab === 'performance'
                ? 'border-slate-900 dark:border-white text-slate-900 dark:text-white font-semibold'
                : 'border-transparent hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Performance
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('billing')}
            className={`py-1 transition-colors whitespace-nowrap shrink-0 border-b-2 ${
              activeTab === 'billing'
                ? 'border-slate-900 dark:border-white text-slate-900 dark:text-white font-semibold'
                : 'border-transparent hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Billing & Gateways
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('notifications')}
            className={`py-1 transition-colors whitespace-nowrap shrink-0 border-b-2 ${
              activeTab === 'notifications'
                ? 'border-slate-900 dark:border-white text-slate-900 dark:text-white font-semibold'
                : 'border-transparent hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Live Feed ({unreadCount})
          </button>
        </nav>

        {/* Zone 3: Team Access + Dark Mode Toggle + Official Sign in with Google button OR Connected Account Action */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Connected Team & Operators Access Button */}
          <button
            type="button"
            onClick={() => setShowTeamModal(true)}
            title="Connected Operators & Team Access"
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors shrink-0"
          >
            <Users className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
            <span className="hidden sm:inline">Team Access</span>
            <span className="px-1.5 py-0.2 bg-blue-100 dark:bg-blue-900/60 text-blue-800 dark:text-blue-300 rounded-full font-mono text-[10px] font-bold">
              {teamMembers.length || 2}
            </span>
          </button>

          {/* Dual Theme Dark Mode Toggle Button */}
          <button
            type="button"
            onClick={() => setIsDark(!isDark)}
            aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
            title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
            className="p-2 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            {isDark ? (
              <Sun className="w-4 h-4 text-amber-400" />
            ) : (
              <Moon className="w-4 h-4 text-slate-600" />
            )}
          </button>

          {needsAuth || !accessToken ? (
            <button
              type="button"
              onClick={handleGoogleLogin}
              disabled={isLoggingIn}
              className="gsi-material-button"
            >
              <div className="gsi-material-button-state"></div>
              <div className="gsi-material-button-content-wrapper">
                <div className="gsi-material-button-icon">
                  <svg
                    version="1.1"
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 48 48"
                    style={{ display: 'block' }}
                  >
                    <path
                      fill="#EA4335"
                      d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
                    ></path>
                    <path
                      fill="#4285F4"
                      d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
                    ></path>
                    <path
                      fill="#FBBC05"
                      d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
                    ></path>
                    <path
                      fill="#34A853"
                      d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
                    ></path>
                    <path fill="none" d="M0 0h48v48H0z"></path>
                  </svg>
                </div>
                <span className="gsi-material-button-contents">
                  {isLoggingIn ? 'Connecting...' : 'Sign in with Google'}
                </span>
              </div>
            </button>
          ) : (
            <button
              type="button"
              onClick={handleLogout}
              title={`Connected as ${user?.email || 'Gmail User'} — Click to sign out`}
              className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors whitespace-nowrap shrink-0"
            >
              <span className="truncate max-w-[160px]">{user?.email || 'Gmail Connected'}</span>
              <LogOut className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
            </button>
          )}
        </div>
      </header>

      {/* Real-Time Incoming Lead Notification Toast Banner */}
      {activeToast && (
        <div className="bg-slate-900 text-white px-4 sm:px-8 py-2.5 border-b border-slate-800">
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2 truncate">
              <Bell className="w-3.5 h-3.5 text-blue-400 shrink-0" />
              <span className="font-semibold text-blue-300 shrink-0">
                Real-Time Alert · {activeToast.eventType}:
              </span>
              <span className="font-medium text-white shrink-0">
                {activeToast.leadName} ({activeToast.company})
              </span>
              <span className="text-slate-300 truncate">— {activeToast.summary}</span>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              {activeToast.leadId && (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedLeadId(activeToast.leadId);
                    const nextNotifs = notifications.map((n) =>
                      n.id === activeToast.id ? { ...n, unread: false } : n
                    );
                    setNotifications(nextNotifs);
                    persistWorkspaceState({ notifications: nextNotifs });
                    setActiveTab('outbound');
                    setActiveToast(null);
                  }}
                  className="text-blue-300 hover:text-white font-semibold underline whitespace-nowrap"
                >
                  Open Lead Thread
                </button>
              )}
              <button
                type="button"
                onClick={() => setActiveToast(null)}
                aria-label="Dismiss notification"
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Content Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-8 py-6 sm:py-8">
        {isLoadingState ? (
          <div className="py-20 text-center text-xs text-slate-500">
            Loading workspace state...
          </div>
        ) : (
          <>
            {activeTab === 'persona' && (
              <PersonaTemplatesView
                personas={personas}
                activePersonaId={activePersonaId}
                onSelectPersona={(id) => {
                  setActivePersonaId(id);
                  persistWorkspaceState({ activePersonaId: id });
                }}
                onSynthesizedState={applyServerState}
                templates={templates}
                onUpdateTemplate={handleUpdateTemplate}
                onDeleteTemplate={handleDeleteTemplate}
                onAddBlankTemplate={handleAddBlankTemplate}
                onApplyTemplateToLead={handleApplyTemplateToLead}
                businessContext={businessContext}
                onUpdateBusinessContext={handleUpdateBusinessContext}
              />
            )}

            {activeTab === 'outbound' && (
              <IcpOutboundView
                leads={leads}
                selectedLeadId={selectedLeadId}
                onSelectLead={setSelectedLeadId}
                onUpdateLead={handleUpdateLead}
                onSyncState={applyServerState}
                activePersona={activePersona}
                businessContext={businessContext}
                selectedTemplate={selectedTemplate}
                onConvertLeadToInvoice={handleConvertLeadToInvoice}
                accessToken={accessToken}
                userEmail={user?.email || null}
                onRequestGoogleLogin={handleGoogleLogin}
                onApplyBusinessContext={handleUpdateBusinessContext}
              />
            )}

            {activeTab === 'performance' && (
              <PerformanceDashboardView
                leads={leads}
                templates={templates}
                invoices={invoices}
                onInspectLead={(id) => {
                  setSelectedLeadId(id);
                  setActiveTab('outbound');
                }}
              />
            )}

            {activeTab === 'billing' && (
              <BillingGatewaysView
                invoices={invoices}
                leads={leads}
                onCreateInvoice={(inv) => {
                  const next = [inv, ...invoices];
                  setInvoices(next);
                  persistWorkspaceState({ invoices: next });
                }}
                onSyncState={applyServerState}
                accessToken={accessToken}
                userEmail={user?.email || null}
                onRequestGoogleLogin={handleGoogleLogin}
              />
            )}

            {activeTab === 'notifications' && (
              <LiveNotificationsView
                notifications={notifications}
                isSyncingGmail={isSyncingGmail}
                onSyncGmailNow={handleSyncGmailNow}
                onMarkAllRead={() => {
                  const next = notifications.map((n) => ({ ...n, unread: false }));
                  setNotifications(next);
                  persistWorkspaceState({ notifications: next });
                }}
                onSelectNotificationLead={(leadId) => {
                  setSelectedLeadId(leadId);
                  const next = notifications.map((n) =>
                    n.leadId === leadId ? { ...n, unread: false } : n
                  );
                  setNotifications(next);
                  persistWorkspaceState({ notifications: next });
                  setActiveTab('outbound');
                }}
              />
            )}
          </>
        )}
      </main>

      {/* Mobile Bottom Navigation Bar */}
      <nav
        aria-label="Mobile Navigation"
        className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 grid grid-cols-5 h-14 transition-colors"
      >
        <button
          type="button"
          onClick={() => setActiveTab('persona')}
          className={`flex flex-col items-center justify-center gap-0.5 text-[11px] font-medium ${
            activeTab === 'persona'
              ? 'text-slate-900 dark:text-white font-semibold'
              : 'text-slate-500 dark:text-slate-400'
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>Persona</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('outbound')}
          className={`flex flex-col items-center justify-center gap-0.5 text-[11px] font-medium ${
            activeTab === 'outbound'
              ? 'text-slate-900 dark:text-white font-semibold'
              : 'text-slate-500 dark:text-slate-400'
          }`}
        >
          <Send className="w-4 h-4" />
          <span>Outbound</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('performance')}
          className={`flex flex-col items-center justify-center gap-0.5 text-[11px] font-medium ${
            activeTab === 'performance'
              ? 'text-slate-900 dark:text-white font-semibold'
              : 'text-slate-500 dark:text-slate-400'
          }`}
        >
          <BarChart3 className="w-4 h-4" />
          <span>Metrics</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('billing')}
          className={`flex flex-col items-center justify-center gap-0.5 text-[11px] font-medium ${
            activeTab === 'billing'
              ? 'text-slate-900 dark:text-white font-semibold'
              : 'text-slate-500 dark:text-slate-400'
          }`}
        >
          <CreditCard className="w-4 h-4" />
          <span>Billing</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('notifications')}
          className={`flex flex-col items-center justify-center gap-0.5 text-[11px] font-medium ${
            activeTab === 'notifications'
              ? 'text-slate-900 dark:text-white font-semibold'
              : 'text-slate-500 dark:text-slate-400'
          }`}
        >
          <Bell className="w-4 h-4" />
          <span>Alerts ({unreadCount})</span>
        </button>
      </nav>
    </div>
  );
}
