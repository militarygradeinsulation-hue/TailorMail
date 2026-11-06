import React, { useState } from 'react';
import {
  Check,
  Copy,
  ExternalLink,
  Plus,
  Shield,
  ShieldCheck,
  UserCheck,
  Users,
  X,
} from 'lucide-react';
import { TeamMember } from '../types';

interface TeamOperatorsModalProps {
  isOpen: boolean;
  onClose: () => void;
  teamMembers: TeamMember[];
  currentUserEmail: string | null;
  onInviteMember: (member: {
    email: string;
    name: string;
    role: 'Owner' | 'Architect' | 'Operator' | 'Viewer';
    permissions: string[];
  }) => Promise<void>;
}

export const TeamOperatorsModal: React.FC<TeamOperatorsModalProps> = ({
  isOpen,
  onClose,
  teamMembers,
  currentUserEmail,
  onInviteMember,
}) => {
  const [copiedLink, setCopiedLink] = useState(false);
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteName, setInviteName] = useState('');
  const [inviteRole, setInviteRole] = useState<'Owner' | 'Architect' | 'Operator' | 'Viewer'>(
    'Operator'
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const appShareUrl =
    typeof window !== 'undefined'
      ? window.location.origin
      : 'https://ais-pre-o5z4qd2dcdfzbp2gspnf7u-3035476552.us-west2.run.app';

  const handleCopyLink = () => {
    navigator.clipboard.writeText(appShareUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleSubmitInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim()) return;
    setIsSubmitting(true);
    try {
      await onInviteMember({
        email: inviteEmail.trim(),
        name: inviteName.trim() || inviteEmail.split('@')[0],
        role: inviteRole,
        permissions: ['outbound_dispatch', 'icp_discovery', 'sales_qa', 'billing'],
      });
      setInviteEmail('');
      setInviteName('');
      setShowInviteForm(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="team-operators-title"
      className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4 backdrop-blur-xs"
    >
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-2xl w-full p-6 space-y-5 shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 rounded-lg">
                <Users className="w-4 h-4" />
              </div>
              <h2
                id="team-operators-title"
                className="text-base font-bold text-slate-900 dark:text-white"
              >
                Connected Operators & Team Access
              </h2>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Manage authorized Google accounts and operator access to this Cadence autonomous system.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 p-1 rounded-lg"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* System Connections Banner */}
        <div className="p-3.5 bg-blue-50/60 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/50 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="space-y-0.5">
            <span className="font-semibold text-blue-900 dark:text-blue-200 flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
              System Permissions & Resources Enabled
            </span>
            <p className="text-blue-700 dark:text-blue-300 text-[11px] leading-relaxed">
              Cloud SQL PostgreSQL · Gmail Send & Readonly OAuth · Google Maps Grounding · Gemini Outbound Tailoring
            </p>
          </div>
          <button
            type="button"
            onClick={handleCopyLink}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-blue-700 dark:text-blue-300 bg-white dark:bg-slate-800 border border-blue-300 dark:border-blue-700 hover:bg-blue-50 dark:hover:bg-slate-700 rounded-lg shrink-0 transition-colors shadow-xs"
          >
            {copiedLink ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                Copied App Link
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                Copy Access Link
              </>
            )}
          </button>
        </div>

        {/* Current Active Connection Status */}
        {currentUserEmail && (
          <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 text-xs">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-slate-600 dark:text-slate-300">You are currently signed in as:</span>
              <span className="font-mono font-semibold text-slate-900 dark:text-white">
                {currentUserEmail}
              </span>
            </div>
            <span className="px-2 py-0.5 text-[10px] font-semibold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 rounded">
              Active Connection
            </span>
          </div>
        )}

        {/* Team Members List */}
        <div className="overflow-y-auto space-y-2.5 flex-1 pr-1">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 pb-1">
            <span className="font-semibold text-slate-800 dark:text-slate-200">
              Authorized System Operators ({teamMembers.length})
            </span>
            <button
              type="button"
              onClick={() => setShowInviteForm(!showInviteForm)}
              className="inline-flex items-center gap-1 text-blue-600 dark:text-blue-400 hover:underline font-semibold"
            >
              <Plus className="w-3.5 h-3.5" />
              {showInviteForm ? 'Cancel' : 'Add Operator'}
            </button>
          </div>

          {/* Quick Invite Form */}
          {showInviteForm && (
            <form
              onSubmit={handleSubmitInvite}
              className="p-3.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl space-y-3 text-xs"
            >
              <p className="font-semibold text-slate-900 dark:text-white">
                Grant Connection to New Operator
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <input
                  type="email"
                  required
                  placeholder="Operator Email (e.g., user@gmail.com)"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  className="px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none"
                />
                <input
                  type="text"
                  placeholder="Operator Name (optional)"
                  value={inviteName}
                  onChange={(e) => setInviteName(e.target.value)}
                  className="px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none"
                />
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value as any)}
                  className="px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none"
                >
                  <option value="Operator">Role: Operator</option>
                  <option value="Architect">Role: Architect</option>
                  <option value="Owner">Role: Owner</option>
                  <option value="Viewer">Role: Viewer</option>
                </select>
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowInviteForm(false)}
                  className="px-3 py-1 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-3.5 py-1 text-white bg-blue-600 hover:bg-blue-700 font-semibold rounded-lg"
                >
                  {isSubmitting ? 'Saving...' : 'Grant Connection'}
                </button>
              </div>
            </form>
          )}

          {/* Members Roster */}
          <div className="divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden bg-white dark:bg-slate-900">
            {teamMembers.map((member) => {
              const isCurrent = currentUserEmail?.toLowerCase() === member.email.toLowerCase();
              return (
                <div
                  key={member.id}
                  className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center font-bold text-xs text-slate-700 dark:text-slate-200">
                        {member.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-xs font-semibold text-slate-900 dark:text-white">
                            {member.name}
                          </p>
                          {isCurrent && (
                            <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                              You
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                          {member.email}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-start sm:self-center">
                    <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                      {member.role}
                    </span>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400">
                      <UserCheck className="w-3 h-3" />
                      {member.status}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer instructions */}
        <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[11px] text-slate-500 dark:text-slate-400">
          <p className="leading-relaxed">
            Authorized operators can access the app URL, sign in with their Google account, and dispatch/manage campaigns.
          </p>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors whitespace-nowrap self-end sm:self-center"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
