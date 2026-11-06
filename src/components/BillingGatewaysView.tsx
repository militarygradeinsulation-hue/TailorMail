import React, { useState } from 'react';
import {
  Check,
  CheckCircle2,
  Copy,
  CreditCard,
  DollarSign,
  Loader2,
  Mail,
  Plus,
  RefreshCw,
  ShieldCheck,
  X,
} from 'lucide-react';
import { InvoiceRecord, Lead } from '../types';

interface BillingGatewaysViewProps {
  invoices: InvoiceRecord[];
  leads: Lead[];
  onCreateInvoice: (invoice: InvoiceRecord) => void;
  onSyncState: (state: any) => void;
  accessToken: string | null;
  userEmail: string | null;
  onRequestGoogleLogin: () => Promise<void>;
}

export const BillingGatewaysView: React.FC<BillingGatewaysViewProps> = ({
  invoices,
  leads,
  onCreateInvoice,
  onSyncState,
  accessToken,
  userEmail,
  onRequestGoogleLogin,
}) => {
  const [selectedGateway, setSelectedGateway] = useState<
    'Stripe Express' | 'ACH Direct Debit' | 'Wire Transfer'
  >('Stripe Express');
  const [autoIssueOnConversion, setAutoIssueOnConversion] = useState(true);
  const [autoDunningReminders, setAutoDunningReminders] = useState(true);
  const [showNewInvoiceModal, setShowNewInvoiceModal] = useState(false);
  const [copiedInvoiceId, setCopiedInvoiceId] = useState<string | null>(null);
  const [settlingId, setSettlingId] = useState<string | null>(null);

  // New Invoice Form State
  const [selectedLeadId, setSelectedLeadId] = useState(leads[0]?.id || '');
  const [customClientName, setCustomClientName] = useState('');
  const [customClientCompany, setCustomClientCompany] = useState('');
  const [customClientEmail, setCustomClientEmail] = useState('');
  const [planOrService, setPlanOrService] = useState('Pilot Audit & Deployment');
  const [amount, setAmount] = useState(4500);
  const [billingCycle, setBillingCycle] = useState<
    'One-Time' | 'Monthly Auto-Bill' | 'Annual Contract'
  >('One-Time');

  // Confirmation Modal for emailing an invoice via Gmail
  const [invoiceToEmail, setInvoiceToEmail] = useState<InvoiceRecord | null>(null);
  const [isSendingInvoiceEmail, setIsSendingInvoiceEmail] = useState(false);
  const [emailStatusMsg, setEmailStatusMsg] = useState<string | null>(null);

  const handleCreateNewInvoice = (e: React.FormEvent) => {
    e.preventDefault();
    const targetLead = leads.find((l) => l.id === selectedLeadId);

    const clientName = targetLead?.fullName || customClientName.trim() || 'Client';
    const company = targetLead?.company || customClientCompany.trim() || 'Account';
    const email = targetLead?.email || customClientEmail.trim();
    if (!email) return;

    const today = new Date();
    const due = new Date(Date.now() + 14 * 86400000);

    const newInv: InvoiceRecord = {
      id: `inv-${Date.now()}`,
      invoiceNumber: `INV-${Math.floor(1000 + Math.random() * 9000)}`,
      leadId: targetLead?.id || '',
      clientName,
      company,
      email,
      planOrService,
      amount: Number(amount) || 1000,
      billingCycle,
      gateway: selectedGateway,
      status: billingCycle === 'Monthly Auto-Bill' ? 'Pending Auto-Charge' : 'Sent',
      issuedDate: today.toLocaleDateString(),
      dueDate: due.toLocaleDateString(),
      autoRemind: autoDunningReminders,
    };

    onCreateInvoice(newInv);
    setShowNewInvoiceModal(false);
  };

  const handleSettleInvoice = async (inv: InvoiceRecord) => {
    setSettlingId(inv.id);
    try {
      const res = await fetch(`/api/invoices/${encodeURIComponent(inv.id)}/pay`, {
        method: 'POST',
      });
      const data = await res.json();
      if (res.ok && data.state) {
        onSyncState(data.state);
      }
    } finally {
      setSettlingId(null);
    }
  };

  const getCheckoutUrl = (inv: InvoiceRecord) => {
    return `${window.location.origin}/?checkout_invoice=${encodeURIComponent(inv.id)}`;
  };

  const handleCopyPaymentLink = (inv: InvoiceRecord) => {
    navigator.clipboard.writeText(getCheckoutUrl(inv));
    setCopiedInvoiceId(inv.id);
    setTimeout(() => setCopiedInvoiceId(null), 1800);
  };

  const handleConfirmSendInvoiceEmail = async () => {
    if (!invoiceToEmail || !accessToken) return;
    setIsSendingInvoiceEmail(true);
    try {
      const checkoutUrl = getCheckoutUrl(invoiceToEmail);
      const subject = `Invoice ${invoiceToEmail.invoiceNumber} — ${invoiceToEmail.planOrService}`;
      const body = `Hi ${invoiceToEmail.clientName.split(' ')[0]},\n\nPlease find your invoice details below:\n\nInvoice Number: ${invoiceToEmail.invoiceNumber}\nScope: ${invoiceToEmail.planOrService}\nAmount Due: $${invoiceToEmail.amount.toLocaleString()}.00 (${invoiceToEmail.billingCycle})\nPayment Gateway: ${invoiceToEmail.gateway}\nDue Date: ${invoiceToEmail.dueDate}\n\nComplete Instant Settlement:\n${checkoutUrl}\n\nThank you for your business.`;

      const res = await fetch('/api/gmail/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          leadId: invoiceToEmail.leadId,
          to: invoiceToEmail.email,
          subject,
          body,
          senderName: userEmail || 'Billing Department',
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to send invoice via Gmail.');
      }
      if (data.state) {
        onSyncState(data.state);
      }
      setEmailStatusMsg(
        `Invoice ${invoiceToEmail.invoiceNumber} emailed to ${invoiceToEmail.email} via Gmail.`
      );
      setInvoiceToEmail(null);
      setTimeout(() => setEmailStatusMsg(null), 4500);
    } catch (err: any) {
      setEmailStatusMsg(err?.message || 'Error emailing invoice.');
    } finally {
      setIsSendingInvoiceEmail(false);
    }
  };

  const totalCollected = invoices
    .filter((i) => i.status === 'Paid')
    .reduce((acc, i) => acc + i.amount, 0);
  const pendingAutoCharge = invoices
    .filter((i) => i.status !== 'Paid')
    .reduce((acc, i) => acc + i.amount, 0);

  return (
    <div className="space-y-8">
      {/* Mandatory Confirmation Modal before sending Invoice Email via Gmail */}
      {invoiceToEmail && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4"
        >
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl max-w-lg w-full p-6 space-y-4 shadow-lg">
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-white">
                  Confirm & Send Invoice via Gmail
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Sends Invoice {invoiceToEmail.invoiceNumber} ($
                  {invoiceToEmail.amount.toLocaleString()}) with a live settlement link to{' '}
                  {invoiceToEmail.email}.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setInvoiceToEmail(null)}
                className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded border border-slate-200 dark:border-slate-700 text-xs space-y-1.5 font-mono text-slate-800 dark:text-slate-200">
              <p>To: {invoiceToEmail.clientName} &lt;{invoiceToEmail.email}&gt;</p>
              <p>Invoice: {invoiceToEmail.invoiceNumber} · ${invoiceToEmail.amount.toLocaleString()}.00</p>
              <p>Gateway: {invoiceToEmail.gateway} ({invoiceToEmail.billingCycle})</p>
              <p className="truncate text-blue-700 dark:text-blue-400">Checkout Link: {getCheckoutUrl(invoiceToEmail)}</p>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setInvoiceToEmail(null)}
                className="px-4 py-2 text-xs font-medium text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmSendInvoiceEmail}
                disabled={isSendingInvoiceEmail}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg"
              >
                {isSendingInvoiceEmail ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Sending via Gmail...
                  </>
                ) : (
                  <>
                    <Mail className="w-3.5 h-3.5" />
                    Confirm & Email Invoice
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
        <div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">
            Payment Gateways · Automated Subscriptions · Instant Checkout Links
          </p>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
            Automated Billing & Secure Payment Gateways
          </h1>
        </div>
        <button
          type="button"
          onClick={() => setShowNewInvoiceModal(!showNewInvoiceModal)}
          className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 dark:bg-blue-600 dark:hover:bg-blue-500 rounded-lg transition-colors whitespace-nowrap self-start"
        >
          <Plus className="w-3.5 h-3.5" />
          Issue Automated Invoice
        </button>
      </div>

      {emailStatusMsg && (
        <div className="p-3.5 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-lg text-xs text-emerald-800 dark:text-emerald-300">
          {emailStatusMsg}
        </div>
      )}

      {/* Create Invoice Drawer */}
      {showNewInvoiceModal && (
        <form
          onSubmit={handleCreateNewInvoice}
          className="p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl space-y-4"
        >
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
              Generate Automated Lead Invoice
            </h2>
            <button
              type="button"
              onClick={() => setShowNewInvoiceModal(false)}
              className="text-xs text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            >
              Close
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {leads.length > 0 ? (
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Select Prospect / Account
                </label>
                <select
                  value={selectedLeadId}
                  onChange={(e) => setSelectedLeadId(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-lg"
                >
                  <option value="">-- Custom Recipient --</option>
                  {leads.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.fullName} ({l.company})
                    </option>
                  ))}
                </select>
              </div>
            ) : null}

            {(!selectedLeadId || leads.length === 0) && (
              <>
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Client Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={customClientName}
                    onChange={(e) => setCustomClientName(e.target.value)}
                    placeholder="Full Name"
                    className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Company *
                  </label>
                  <input
                    type="text"
                    required
                    value={customClientCompany}
                    onChange={(e) => setCustomClientCompany(e.target.value)}
                    placeholder="Company Name"
                    className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Client Email *
                  </label>
                  <input
                    type="email"
                    required
                    value={customClientEmail}
                    onChange={(e) => setCustomClientEmail(e.target.value)}
                    placeholder="billing@company.com"
                    className="w-full px-3 py-2 text-sm font-mono bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-lg"
                  />
                </div>
              </>
            )}

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Service / Line Item Description
              </label>
              <input
                type="text"
                required
                value={planOrService}
                onChange={(e) => setPlanOrService(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-lg"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Amount (USD)
              </label>
              <input
                type="number"
                required
                value={amount}
                onChange={(e) => setAmount(Number(e.target.value))}
                className="w-full px-3 py-2 text-sm font-mono tabular-nums bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-lg"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Billing Cadence
              </label>
              <select
                value={billingCycle}
                onChange={(e) => setBillingCycle(e.target.value as any)}
                className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-lg"
              >
                <option value="One-Time">One-Time Fee</option>
                <option value="Monthly Auto-Bill">Monthly Auto-Bill</option>
                <option value="Annual Contract">Annual Contract</option>
              </select>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setShowNewInvoiceModal(false)}
              className="px-4 py-2 text-xs font-medium text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg"
            >
              Create Invoice
            </button>
          </div>
        </form>
      )}

      {/* Gateway Configuration + Automation Rules Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-7 p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl space-y-5">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
            <div>
              <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                Connected Payment Gateways
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Select default settlement rail embedded into outgoing closing emails
              </p>
            </div>
            <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 dark:text-emerald-400">
              <ShieldCheck className="w-4 h-4" />
              Encrypted Checkout Links
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {(
              [
                {
                  name: 'Stripe Express',
                  fee: '2.9% + 30¢ · Card & Apple Pay',
                  settlement: 'T+1 Payout',
                },
                {
                  name: 'ACH Direct Debit',
                  fee: '0.8% ($5.00 cap) · Bank Auth',
                  settlement: 'T+2 Settlement',
                },
                {
                  name: 'Wire Transfer',
                  fee: '$0.00 fee · Dedicated Routing',
                  settlement: 'Same-Day Wire',
                },
              ] as const
            ).map((gw) => {
              const active = selectedGateway === gw.name;
              return (
                <button
                  key={gw.name}
                  type="button"
                  onClick={() => setSelectedGateway(gw.name)}
                  className={`p-4 rounded-xl border text-left transition-colors space-y-2 ${
                    active
                      ? 'bg-slate-900 dark:bg-blue-950/80 text-white border-slate-900 dark:border-blue-700'
                      : 'bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <CreditCard
                      className={`w-4 h-4 ${active ? 'text-blue-300' : 'text-slate-500 dark:text-slate-400'}`}
                    />
                    <span
                      className={`text-xs font-mono ${
                        active ? 'text-emerald-300' : 'text-emerald-700 dark:text-emerald-400'
                      }`}
                    >
                      {active ? 'Default Rail' : 'Active'}
                    </span>
                  </div>
                  <p className="text-sm font-semibold">{gw.name}</p>
                  <p
                    className={`text-xs leading-relaxed ${
                      active ? 'text-slate-300' : 'text-slate-500 dark:text-slate-400'
                    }`}
                  >
                    {gw.fee} · {gw.settlement}
                  </p>
                </button>
              );
            })}
          </div>
        </div>

        <div className="lg:col-span-5 p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl space-y-4">
          <div className="border-b border-slate-100 dark:border-slate-800 pb-3 flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                Automated Billing Rules
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Real-time settlement totals across issued invoices
              </p>
            </div>
            <DollarSign className="w-4 h-4 text-slate-400" />
          </div>

          <div className="grid grid-cols-2 gap-4 py-2 border-b border-slate-100 dark:border-slate-800 font-mono tabular-nums">
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-sans">Settled Revenue</p>
              <p className="text-2xl font-bold text-slate-900 dark:text-white">
                ${totalCollected.toLocaleString()}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-sans">Open / Pending</p>
              <p className="text-2xl font-bold text-blue-700 dark:text-blue-400">
                ${pendingAutoCharge.toLocaleString()}
              </p>
            </div>
          </div>

          <div className="space-y-3 text-xs">
            <label className="flex items-start justify-between gap-3 cursor-pointer">
              <div>
                <p className="font-semibold text-slate-900 dark:text-white">
                  Embed Checkout Link in Gmail Invoice Dispatch
                </p>
                <p className="text-slate-500 dark:text-slate-400">
                  Includes a one-click settlement URL when emailing invoices via Gmail
                </p>
              </div>
              <input
                type="checkbox"
                checked={autoIssueOnConversion}
                onChange={(e) => setAutoIssueOnConversion(e.target.checked)}
                className="mt-1 rounded border-slate-300 text-slate-900"
              />
            </label>

            <label className="flex items-start justify-between gap-3 cursor-pointer">
              <div>
                <p className="font-semibold text-slate-900 dark:text-white">
                  Automated Net-14 Invoice Follow-Ups
                </p>
                <p className="text-slate-500 dark:text-slate-400">
                  Flags due invoices for follow-up in your personal voice
                </p>
              </div>
              <input
                type="checkbox"
                checked={autoDunningReminders}
                onChange={(e) => setAutoDunningReminders(e.target.checked)}
                className="mt-1 rounded border-slate-300 text-slate-900"
              />
            </label>
          </div>
        </div>
      </div>

      {/* Invoices Table */}
      <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
        <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">
              Invoices & Settlement Ledger
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Send invoices via Gmail, copy live checkout URLs, or process settlements
            </p>
          </div>
          <span className="text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400">
            {invoices.length} invoices
          </span>
        </div>

        {invoices.length === 0 ? (
          <div className="p-10 text-center text-xs text-slate-500 dark:text-slate-400">
            No invoices issued yet. Click &ldquo;Issue Automated Invoice&rdquo; above or click &ldquo;Create Invoice&rdquo; on any lead in the Outbound tab.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/80 text-xs font-semibold text-slate-600 dark:text-slate-400">
                  <th className="py-3 px-4">Invoice #</th>
                  <th className="py-3 px-4">Client & Company</th>
                  <th className="py-3 px-4">Scope / Plan</th>
                  <th className="py-3 px-4">Gateway & Cadence</th>
                  <th className="py-3 px-4 text-right">Amount</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                {invoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                    <td className="py-3.5 px-4 font-mono tabular-nums font-semibold text-slate-900 dark:text-white">
                      {inv.invoiceNumber}
                      <div className="text-slate-400 dark:text-slate-500 font-normal">Due {inv.dueDate}</div>
                    </td>
                    <td className="py-3.5 px-4">
                      <p className="font-semibold text-slate-900 dark:text-white">{inv.clientName}</p>
                      <p className="text-slate-500 dark:text-slate-400">
                        {inv.company} · {inv.email}
                      </p>
                    </td>
                    <td className="py-3.5 px-4 text-slate-700 dark:text-slate-300">{inv.planOrService}</td>
                    <td className="py-3.5 px-4 text-slate-600 dark:text-slate-400">
                      {inv.gateway} · {inv.billingCycle}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono tabular-nums font-semibold text-slate-900 dark:text-white">
                      ${inv.amount.toLocaleString()}.00
                    </td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`font-medium ${
                          inv.status === 'Paid'
                            ? 'text-emerald-700 dark:text-emerald-400'
                            : inv.status === 'Pending Auto-Charge'
                            ? 'text-blue-700 dark:text-blue-400'
                            : 'text-amber-700 dark:text-amber-400'
                        }`}
                      >
                        {inv.status}
                      </span>
                      {inv.transactionRef && (
                        <div className="font-mono text-[11px] text-slate-400 dark:text-slate-500">
                          {inv.transactionRef}
                        </div>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="inline-flex items-center gap-2">
                        <button
                          type="button"
                          onClick={async () => {
                            if (!accessToken) {
                              await onRequestGoogleLogin();
                              return;
                            }
                            setInvoiceToEmail(inv);
                          }}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded transition-colors whitespace-nowrap"
                        >
                          <Mail className="w-3 h-3" />
                          Email via Gmail
                        </button>

                        <button
                          type="button"
                          onClick={() => handleCopyPaymentLink(inv)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded transition-colors whitespace-nowrap"
                        >
                          {copiedInvoiceId === inv.id ? (
                            <>
                              <Check className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                              Copied
                            </>
                          ) : (
                            <>
                              <Copy className="w-3 h-3" />
                              Checkout URL
                            </>
                          )}
                        </button>

                        {inv.status !== 'Paid' ? (
                          <button
                            type="button"
                            onClick={() => handleSettleInvoice(inv)}
                            disabled={settlingId === inv.id}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 dark:bg-blue-600 dark:hover:bg-blue-500 disabled:opacity-60 rounded transition-colors whitespace-nowrap"
                          >
                            {settlingId === inv.id ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <RefreshCw className="w-3 h-3" />
                            )}
                            Settle Charge
                          </button>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400 font-medium px-2">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Paid
                          </span>
                        )}
                      </div>
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
