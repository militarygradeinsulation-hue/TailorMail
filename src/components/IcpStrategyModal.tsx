import React, { useState } from 'react';
import {
  AlertTriangle,
  Award,
  BookOpen,
  Briefcase,
  CheckCircle2,
  DollarSign,
  Layers,
  MapPin,
  Scale,
  ShieldCheck,
  Sparkles,
  Target,
  X,
  Zap,
} from 'lucide-react';
import { BusinessContext } from '../types';

interface IcpStrategyModalProps {
  isOpen: boolean;
  onClose: () => void;
  businessContext: BusinessContext;
  onApplyPreset: (preset: BusinessContext) => void;
  onQuickSearch: (query: string, mode: 'web_scan' | 'maps_scan' | 'intelligence_match') => void;
}

export const AETHERIS_BUSINESS_PRESET: BusinessContext = {
  companyName: 'Aetheris Technology',
  productName: 'Decision-Friction Diagnostic / Golden Report',
  valueProposition:
    'We diagnose where cost, cash, and momentum disappear across disconnected operational handoffs before companies spend money on unnecessary software. We deliver an evidence-backed exception map and an owner-approved decision queue.',
  targetIndustries:
    'US privately held businesses ($5M–$75M revenue, 25–300 employees): A1 Precision & Contract Manufacturing (CNC, fabrication, precision parts), A2 Multi-Stage Engineering & IT Services, A3 Field & Specialty Trades.',
  idealBuyerRoles:
    'Founder, CEO, President, COO (economic buyers); CFO & Controller (sponsors); VP Operations & Plant GM (operational champions).',
  keyDifferentiators:
    'Not generic slide-deck consulting or AI hype. We map observable handoffs (quote-to-order, estimate-to-cash, revenue-to-delivery) with concrete timestamps, exception counts, and verified root-cause hypotheses.',
  pricingSummary:
    'Executive Friction Preview (Free invitation); Golden Diagnostic ($4,500–$12,500 test range; standard $6,500); Implementation Sprint ($8,000–$25,000); Ongoing Operating Intelligence Retainer ($1,500–$5,000/mo).',
};

export const MINDPRINT_BUSINESS_PRESET: BusinessContext = {
  companyName: 'Mindprint Software by Aetheris',
  productName: 'Mindprint Intelligence (Quick, Full & Intel Editions)',
  valueProposition:
    'Evidence-linked professional intelligence for executives, advisers, and principals preparing for consequential meetings, negotiations, and collaboration decisions. We structure publicly observable professional material into grounded hypotheses, boundaries, and questions to ask.',
  targetIndustries:
    'US Founders, Owners, Fractional COOs/CROs, Executive Advisers, Deal Principals, and Boutique Consultancies (10–150 knowledge workers).',
  idealBuyerRoles:
    'Founder, CEO, Fractional Executive, Managing Partner, Practice Principal, Deal Lead.',
  keyDifferentiators:
    'Ethically bounded evidence exploration. Cites public professional material, distinguishes confirmed evidence from working hypotheses, identifies unknowns, and never fabricates mind-reading, personality profiling, or clinical inferences.',
  pricingSummary:
    'Free Quick Preview; $49 Full Intelligence (cited professional report & questions); $99 Intel Edition (deep source-backed decision appendix); Advisor Packs & Team Pilot ($1,500–$4,900).',
};

export const IcpStrategyModal: React.FC<IcpStrategyModalProps> = ({
  isOpen,
  onClose,
  businessContext,
  onApplyPreset,
  onQuickSearch,
}) => {
  const [activeTab, setActiveTab] = useState<
    'segments' | 'scoring' | 'offers' | 'ethics' | 'presets'
  >('segments');

  if (!isOpen) return null;

  const isAetheris = businessContext.companyName.toLowerCase().includes('aetheris');
  const isMindprint = businessContext.companyName.toLowerCase().includes('mindprint');

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="icp-strategy-title"
      className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5"
    >
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="p-5 sm:p-6 border-b border-slate-200 dark:border-slate-800 flex items-start justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 dark:bg-blue-950/80 text-blue-800 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                <Target className="w-3 h-3" />
                Strategic Planning Edition · Nov 2026
              </span>
              <span className="text-xs text-slate-500 dark:text-slate-400">
                Aetheris Technology / Mindprint
              </span>
            </div>
            <h2 id="icp-strategy-title" className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">
              ICP & Go-to-Market Strategy Playbook
            </h2>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              Complete buyer committee, operational trigger taxonomy, 100-point account qualification, and ethical safeguards.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Navigation Tabs */}
        <div className="px-5 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50 flex items-center gap-2 overflow-x-auto">
          {[
            { id: 'segments', label: 'Priority Beachheads', icon: Layers },
            { id: 'scoring', label: '100-Point Scoring Model', icon: Award },
            { id: 'offers', label: 'Offer Ladders & Pricing', icon: DollarSign },
            { id: 'ethics', label: 'Ethical Safeguards', icon: ShieldCheck },
            { id: 'presets', label: 'Switch Active Context', icon: Sparkles },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as any)}
                className={`inline-flex items-center gap-1.5 py-3 px-3 text-xs font-semibold border-b-2 transition-colors whitespace-nowrap ${
                  isActive
                    ? 'border-blue-600 text-blue-700 dark:text-blue-400'
                    : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Modal Body */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-6 flex-1 text-xs">
          {/* TAB 1: PRIORITY BEACHHEADS */}
          {activeTab === 'segments' && (
            <div className="space-y-6">
              <div className="p-4 bg-blue-50/70 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900 rounded-xl space-y-1.5">
                <span className="font-bold text-blue-900 dark:text-blue-200 flex items-center gap-1.5">
                  <Zap className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  Primary GTM Thesis
                </span>
                <p className="text-blue-800 dark:text-blue-300 leading-relaxed">
                  <strong>Aetheris</strong> sells diagnostics & decision clarity to privately held, operationally complex businesses ($5M–$75M revenue, 25–300 employees) whose growth outpaced their systems. <strong>Mindprint</strong> sells evidence-linked professional intelligence to executives & advisers making consequential collaboration decisions. They reinforce one another, but use separate buyer definitions.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* A1 Precision Mfg */}
                <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/60 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300">
                      Rank A1 · Prime Beachhead
                    </span>
                    <span className="text-slate-500 font-mono">Midwest Wedge</span>
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                      Contract & Precision Manufacturing
                    </h4>
                    <p className="text-slate-500 dark:text-slate-400 mt-0.5">
                      CNC, custom fabrication, precision parts, industrial suppliers ($10M–$40M rev, 40–175 headcount).
                    </p>
                  </div>
                  <div className="space-y-1 text-slate-600 dark:text-slate-300">
                    <p><strong>Pain:</strong> RFQ delays, quote-to-order gaps, scheduling overrides, ERP/CRM misalignment.</p>
                    <p><strong>Opening Wedge:</strong> Quote-to-cash & handoff evidence review.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      onQuickSearch(
                        'Precision CNC machining and industrial contract fabrication companies in Indiana and Midwest ($10M-$40M revenue, 40-175 employees)',
                        'web_scan'
                      );
                      onClose();
                    }}
                    className="w-full inline-flex items-center justify-center gap-1.5 py-2 px-3 bg-slate-900 dark:bg-blue-600 hover:bg-slate-800 dark:hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    Scan Web for A1 Precision Mfg Leads
                  </button>
                </div>

                {/* A2 Multi-Stage Services */}
                <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/60 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-blue-100 dark:bg-blue-950/80 text-blue-800 dark:text-blue-300">
                      Rank A2 · Secondary Wave
                    </span>
                    <span className="text-slate-500 font-mono">US-Wide</span>
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                      Multi-Stage Engineering & IT Services
                    </h4>
                    <p className="text-slate-500 dark:text-slate-400 mt-0.5">
                      Systems integrators, industrial engineering, IT specialty firms with multi-stage delivery.
                    </p>
                  </div>
                  <div className="space-y-1 text-slate-600 dark:text-slate-300">
                    <p><strong>Pain:</strong> Sales promise vs delivery scope, utilization gaps, renewals, account ownership.</p>
                    <p><strong>Opening Wedge:</strong> Revenue-to-delivery friction diagnostic.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      onQuickSearch(
                        'Engineering systems integrators and specialty technical services firms in US with multi-stage delivery ($10M-$50M revenue)',
                        'web_scan'
                      );
                      onClose();
                    }}
                    className="w-full inline-flex items-center justify-center gap-1.5 py-2 px-3 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-900 dark:text-white font-semibold rounded-lg transition-colors"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    Scan for A2 Engineering Services
                  </button>
                </div>

                {/* A3 Field & Specialty Trades */}
                <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/60 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300">
                      Rank A3 · Field Operations
                    </span>
                    <span className="text-slate-500 font-mono">Maps Grounded</span>
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                      Field & Specialty Trades / Distributors
                    </h4>
                    <p className="text-slate-500 dark:text-slate-400 mt-0.5">
                      Commercial mechanical/HVAC, commercial trades, distribution centers with inventory.
                    </p>
                  </div>
                  <div className="space-y-1 text-slate-600 dark:text-slate-300">
                    <p><strong>Pain:</strong> Dispatch, inventory, job costing, estimate-to-invoice, rework loops.</p>
                    <p><strong>Opening Wedge:</strong> Estimate-to-cash & work-order handoff map.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      onQuickSearch(
                        'Commercial HVAC, mechanical trades, and industrial distributors in Chicago, Indianapolis, Columbus',
                        'maps_scan'
                      );
                      onClose();
                    }}
                    className="w-full inline-flex items-center justify-center gap-1.5 py-2 px-3 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-900 dark:text-white font-semibold rounded-lg transition-colors"
                  >
                    <MapPin className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                    Google Maps Scan for Field Trades
                  </button>
                </div>

                {/* Mindprint: Fractional Advisers */}
                <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/60 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-purple-100 dark:bg-purple-950/80 text-purple-800 dark:text-purple-300">
                      Mindprint · High LTV Repeat Buyer
                    </span>
                    <span className="text-slate-500 font-mono">Executive Intelligence</span>
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                      Fractional Executives & Advisory Boutiques
                    </h4>
                    <p className="text-slate-500 dark:text-slate-400 mt-0.5">
                      Fractional COOs/CROs, executive coaches, managing partners (10–150 knowledge workers).
                    </p>
                  </div>
                  <div className="space-y-1 text-slate-600 dark:text-slate-300">
                    <p><strong>Pain:</strong> Hours manually researching executive stakeholders before high-stakes meetings.</p>
                    <p><strong>Opening Wedge:</strong> Pre-meeting evidence briefing & decision questions ($49/$99).</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      onQuickSearch(
                        'Fractional COO, executive advisors, and boutique leadership consultancies preparing for executive meetings',
                        'intelligence_match'
                      );
                      onClose();
                    }}
                    className="w-full inline-flex items-center justify-center gap-1.5 py-2 px-3 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-lg transition-colors"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    Match Mindprint Advisory Prospects
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: 100-POINT SCORING MODEL */}
          {activeTab === 'scoring' && (
            <div className="space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700">
                <div>
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                    100-Point Account Qualification Rubric
                  </h4>
                  <p className="text-slate-500 dark:text-slate-400 mt-0.5">
                    Field-validated routing rules from Section 5.2 of the strategic GTM framework.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-1 rounded font-mono font-bold text-xs bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300">
                    80–100: Priority Account
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                <div className="p-3.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-900 dark:text-white">Process Complexity</span>
                    <span className="font-mono font-bold text-blue-600 dark:text-blue-400">25 pts</span>
                  </div>
                  <p className="text-slate-500 dark:text-slate-400">
                    3+ functional handoffs, dual systems (e.g. ERP + CRM + spreadsheets), multiple production cells or branches.
                  </p>
                </div>

                <div className="p-3.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-900 dark:text-white">Active Trigger</span>
                    <span className="font-mono font-bold text-blue-600 dark:text-blue-400">20 pts</span>
                  </div>
                  <p className="text-slate-500 dark:text-slate-400">
                    Recent ERP/CRM migration, CEO/COO leadership transition, site expansion, or hiring OpEx/RevOps leads.
                  </p>
                </div>

                <div className="p-3.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-900 dark:text-white">Buyer Access</span>
                    <span className="font-mono font-bold text-blue-600 dark:text-blue-400">20 pts</span>
                  </div>
                  <p className="text-slate-500 dark:text-slate-400">
                    Direct communication with Founder, CEO, COO, or sponsored referral from CFO/Controller.
                  </p>
                </div>

                <div className="p-3.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-900 dark:text-white">Potential Materiality</span>
                    <span className="font-mono font-bold text-blue-600 dark:text-blue-400">15 pts</span>
                  </div>
                  <p className="text-slate-500 dark:text-slate-400">
                    Revenue, backlog, throughput, or margin leak is plausibly meaningful ($100k+ operational exposure).
                  </p>
                </div>

                <div className="p-3.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-900 dark:text-white">Data / Evidence</span>
                    <span className="font-mono font-bold text-blue-600 dark:text-blue-400">10 pts</span>
                  </div>
                  <p className="text-slate-500 dark:text-slate-400">
                    Willingness to share anonymized milestone timestamps, order exception logs, or read-only walk-throughs.
                  </p>
                </div>

                <div className="p-3.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-900 dark:text-white">Urgency & Readiness</span>
                    <span className="font-mono font-bold text-blue-600 dark:text-blue-400">10 pts</span>
                  </div>
                  <p className="text-slate-500 dark:text-slate-400">
                    Active executive sponsor with an immediate 30-to-90 day decision or operational milestone.
                  </p>
                </div>
              </div>

              {/* Routing Matrix */}
              <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                <div className="bg-slate-100 dark:bg-slate-800 p-3 font-semibold text-slate-900 dark:text-white">
                  Qualification Action Routing
                </div>
                <div className="divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-900">
                  <div className="p-3 flex items-start gap-3">
                    <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400 w-20 shrink-0">80–100 pts</span>
                    <div>
                      <strong className="text-slate-900 dark:text-white">Priority Account & Custom Diagnostic:</strong> Immediate tailored outbound referencing specific trigger. Offer Golden Report ($6,500).
                    </div>
                  </div>
                  <div className="p-3 flex items-start gap-3">
                    <span className="font-mono font-bold text-blue-600 dark:text-blue-400 w-20 shrink-0">65–79 pts</span>
                    <div>
                      <strong className="text-slate-900 dark:text-white">Discovery & Evidence Request:</strong> Send Executive Friction Preview. Propose brief 15-minute handoff walk-through.
                    </div>
                  </div>
                  <div className="p-3 flex items-start gap-3">
                    <span className="font-mono font-bold text-amber-600 dark:text-amber-400 w-20 shrink-0">45–64 pts</span>
                    <div>
                      <strong className="text-slate-900 dark:text-white">Educational Nurture:</strong> Keep in timed sequence with benchmark reports and anonymized case studies.
                    </div>
                  </div>
                  <div className="p-3 flex items-start gap-3">
                    <span className="font-mono font-bold text-red-600 dark:text-red-400 w-20 shrink-0">&lt; 45 pts</span>
                    <div>
                      <strong className="text-slate-900 dark:text-white">Disqualify:</strong> Insufficient complexity, no active trigger, or commodity lead buyer.
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: OFFER LADDERS & PRICING */}
          {activeTab === 'offers' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {/* Aetheris Ladder */}
                <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 space-y-3">
                  <div className="flex items-center gap-2">
                    <Briefcase className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                    <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                      Aetheris Technology — Diagnostics Ladder
                    </h4>
                  </div>
                  <div className="space-y-2.5">
                    <div className="p-2.5 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700">
                      <div className="flex justify-between font-semibold">
                        <span>1. Executive Friction Preview</span>
                        <span className="font-mono text-emerald-600 dark:text-emerald-400">Free / Invitation</span>
                      </div>
                      <p className="text-slate-500 text-[11px] mt-0.5">
                        Public evidence plus 1 discovery walk-through; limited hypotheses on quote-to-order handoff.
                      </p>
                    </div>

                    <div className="p-2.5 bg-white dark:bg-slate-900 rounded-lg border border-blue-200 dark:border-blue-800">
                      <div className="flex justify-between font-semibold">
                        <span className="text-blue-700 dark:text-blue-300">2. Golden Diagnostic (Core Offer)</span>
                        <span className="font-mono text-blue-700 dark:text-blue-300">$4,500 – $12,500 (Std $6,500)</span>
                      </div>
                      <p className="text-slate-500 text-[11px] mt-0.5">
                        2–4 weeks; process mapping, evidence ledger, root-cause hypotheses, priority owner assignments.
                      </p>
                    </div>

                    <div className="p-2.5 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700">
                      <div className="flex justify-between font-semibold">
                        <span>3. Focused Implementation Sprint</span>
                        <span className="font-mono text-slate-700 dark:text-slate-300">$8,000 – $25,000</span>
                      </div>
                      <p className="text-slate-500 text-[11px] mt-0.5">
                        4–8 weeks; fixing one prioritized workflow, integration, or control bottleneck.
                      </p>
                    </div>

                    <div className="p-2.5 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700">
                      <div className="flex justify-between font-semibold">
                        <span>4. Operating Intelligence Retainer</span>
                        <span className="font-mono text-slate-700 dark:text-slate-300">$1,500 – $5,000 / mo</span>
                      </div>
                      <p className="text-slate-500 text-[11px] mt-0.5">
                        Monthly review of agreed handoff indicators, exception reduction, and decision cadence.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Mindprint Ladder */}
                <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 space-y-3">
                  <div className="flex items-center gap-2">
                    <Target className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                    <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                      Mindprint Software — Decision Intelligence
                    </h4>
                  </div>
                  <div className="space-y-2.5">
                    <div className="p-2.5 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700">
                      <div className="flex justify-between font-semibold">
                        <span>1. Free Quick Preview</span>
                        <span className="font-mono text-emerald-600 dark:text-emerald-400">Free Preview</span>
                      </div>
                      <p className="text-slate-500 text-[11px] mt-0.5">
                        Source coverage, preview of observable public statements, and critical unknowns.
                      </p>
                    </div>

                    <div className="p-2.5 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700">
                      <div className="flex justify-between font-semibold">
                        <span>2. Full Intelligence Report</span>
                        <span className="font-mono text-purple-700 dark:text-purple-300">$49 one-time</span>
                      </div>
                      <p className="text-slate-500 text-[11px] mt-0.5">
                        Cited professional report, communication tendencies, and pre-meeting question lists.
                      </p>
                    </div>

                    <div className="p-2.5 bg-white dark:bg-slate-900 rounded-lg border border-purple-200 dark:border-purple-800">
                      <div className="flex justify-between font-semibold">
                        <span className="text-purple-700 dark:text-purple-300">3. Intel Edition (Top Individual)</span>
                        <span className="font-mono text-purple-700 dark:text-purple-300">$99 one-time</span>
                      </div>
                      <p className="text-slate-500 text-[11px] mt-0.5">
                        Full intelligence plus deep source-backed decision appendix, verified timestamps, and cross-comparisons.
                      </p>
                    </div>

                    <div className="p-2.5 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700">
                      <div className="flex justify-between font-semibold">
                        <span>4. Adviser Pack & Team Pilot</span>
                        <span className="font-mono text-slate-700 dark:text-slate-300">$1,500 – $4,900</span>
                      </div>
                      <p className="text-slate-500 text-[11px] mt-0.5">
                        Repeat-use credits for fractional advisers or consent-based decision alignment workshop for 5-15 leaders.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: ETHICAL SAFEGUARDS */}
          {activeTab === 'ethics' && (
            <div className="space-y-4">
              <div className="p-4 bg-emerald-50/70 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl space-y-1">
                <span className="font-bold text-emerald-900 dark:text-emerald-200 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  Ethics are Commercial, Not Merely Legal
                </span>
                <p className="text-emerald-800 dark:text-emerald-300 leading-relaxed">
                  The best B2B buyers will ask whether an analysis is trustworthy, reproducible, and safe to show their leadership team. Admitting uncertainty, citing sources, and avoiding overclaiming makes Aetheris and Mindprint easier to buy repeatedly.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl border border-red-200 dark:border-red-900/60 bg-red-50/40 dark:bg-red-950/20 space-y-2">
                  <span className="font-bold text-red-900 dark:text-red-300 flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400" />
                    Strict Non-Targets & Prohibited Uses
                  </span>
                  <ul className="list-disc list-inside space-y-1 text-slate-700 dark:text-slate-300">
                    <li>Never claim &ldquo;mind reading&rdquo; or pretend to know private thoughts.</li>
                    <li>No mental health, medical, disability, or religious inferences.</li>
                    <li>No covert employee ranking or candidate hiring evaluation.</li>
                    <li>No unsupervised employment decisions or termination scoring.</li>
                    <li>Do not invent quantified dollar losses without verifiable inputs.</li>
                  </ul>
                </div>

                <div className="p-4 rounded-xl border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/40 dark:bg-emerald-950/20 space-y-2">
                  <span className="font-bold text-emerald-900 dark:text-emerald-300 flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    Evidence Standard & Core Safeguards
                  </span>
                  <ul className="list-disc list-inside space-y-1 text-slate-700 dark:text-slate-300">
                    <li>Cite explicit source links, timestamps, and quotes for every finding.</li>
                    <li>Clearly separate confirmed facts from working hypotheses.</li>
                    <li>State explicit unknowns and provide questions to test them directly.</li>
                    <li>Require written consent for any internal team collaboration workshop.</li>
                    <li>Bound diagnostic exposure to one agreed journey (inquiry to order).</li>
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: SWITCH ACTIVE CONTEXT */}
          {activeTab === 'presets' && (
            <div className="space-y-4">
              <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
                Seamlessly toggle your workspace between the <strong>Aetheris Technology</strong> operational diagnostics motion and the <strong>Mindprint Software</strong> executive intelligence motion with one click.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Aetheris Technology Option */}
                <div
                  className={`p-4 rounded-xl border transition-all space-y-3 ${
                    isAetheris
                      ? 'border-blue-600 bg-blue-50/50 dark:bg-blue-950/40 ring-2 ring-blue-500/20'
                      : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/40'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm text-slate-900 dark:text-white">
                      Aetheris Technology
                    </span>
                    {isAetheris && (
                      <span className="px-2 py-0.5 text-[10px] font-bold bg-blue-600 text-white rounded">
                        Active Context
                      </span>
                    )}
                  </div>
                  <p className="text-slate-600 dark:text-slate-400">
                    Decision-Friction Diagnostic & Golden Report. Target: Privately held US businesses ($5M–$75M rev) with quote-to-order margin leakage.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      onApplyPreset(AETHERIS_BUSINESS_PRESET);
                      onClose();
                    }}
                    className="w-full py-2 px-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors"
                  >
                    Load Aetheris Diagnostics Preset
                  </button>
                </div>

                {/* Mindprint Option */}
                <div
                  className={`p-4 rounded-xl border transition-all space-y-3 ${
                    isMindprint
                      ? 'border-purple-600 bg-purple-50/50 dark:bg-purple-950/40 ring-2 ring-purple-500/20'
                      : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/40'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm text-slate-900 dark:text-white">
                      Mindprint by Aetheris
                    </span>
                    {isMindprint && (
                      <span className="px-2 py-0.5 text-[10px] font-bold bg-purple-600 text-white rounded">
                        Active Context
                      </span>
                    )}
                  </div>
                  <p className="text-slate-600 dark:text-slate-400">
                    Evidence-Linked Professional Intelligence. Target: Founders, fractional COOs/CROs, and boutique consultancies preparing for key decisions.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      onApplyPreset(MINDPRINT_BUSINESS_PRESET);
                      onClose();
                    }}
                    className="w-full py-2 px-3 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-lg transition-colors"
                  >
                    Load Mindprint Intelligence Preset
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-slate-50 dark:bg-slate-950/60 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <span className="text-xs text-slate-500 dark:text-slate-400">
            Aetheris Technology / Mindprint · GTM Strategy Standard
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 rounded-lg transition-colors"
          >
            Close Playbook
          </button>
        </div>
      </div>
    </div>
  );
};
