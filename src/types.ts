export type CadenceMode = 'one_touch' | 'timed_sequence';

export interface PersonaProfile {
  id: string;
  name: string;
  archetype: string;
  sourceFileName: string;
  rawSample: string;
  linguisticSignature: {
    cadence: string;
    openingStyle: string;
    signOff: string;
    vocabularyTraits: string[];
  };
  updatedAt: string;
}

export interface EmailTemplate {
  id: string;
  title: string;
  category:
    | 'Cold Outbound'
    | 'Executive Intro'
    | 'Sales Q&A Response'
    | 'Timed Follow-Up'
    | 'Invoice & Closing';
  subjectLine: string;
  body: string;
  personaId: string;
  sentCount: number;
  openCount: number;
  replyCount: number;
}

export interface GroundingSource {
  title: string;
  uri: string;
}

export interface FollowUpStep {
  id: string;
  dayOffset: number;
  subject: string;
  body: string;
  status: 'scheduled' | 'sent' | 'paused';
  scheduledAt: string;
  scheduledTimeLabel: string;
  sentAt?: string;
}

export interface ThreadMessage {
  id: string;
  gmailMessageId?: string;
  gmailThreadId?: string;
  sender: 'outbound' | 'prospect' | 'autonomous_agent';
  senderName: string;
  senderEmail?: string;
  timestamp: string;
  subject?: string;
  body: string;
  isAutomatedFollowUp?: boolean;
}

export interface Lead {
  id: string;
  fullName: string;
  role: string;
  company: string;
  companyDomain: string;
  email: string;
  location: string;
  latitude?: number;
  longitude?: number;
  avatarUrl?: string;
  matchScore: number;
  matchType: 'Web Scan' | 'Intelligence Match' | 'Inbound Lead';
  buyingSignal: string;
  icpFitRationale: string;
  painPoints: string[];
  groundingSources?: GroundingSource[];
  status:
    | 'Discovered'
    | 'Tailored'
    | 'Active Sequence'
    | 'Question Received'
    | 'Converted';
  cadenceMode: CadenceMode;
  timedIntervalDays: number;
  autoHandleQuestions: boolean;
  tailoredSubject: string;
  tailoredBody: string;
  activeTemplateId?: string;
  gmailThreadId?: string;
  followUpSteps: FollowUpStep[];
  thread: ThreadMessage[];
  createdAt: string;
  metrics: {
    sentCount: number;
    opens: number;
    clicks: number;
    replies: number;
    lastOpenedAt?: string;
    dealValue: number;
  };
}

export interface LiveNotification {
  id: string;
  leadId: string;
  leadName: string;
  company: string;
  role: string;
  eventType: 'New ICP Lead' | 'Sales Question' | 'Email Opened' | 'Invoice Paid';
  summary: string;
  timestamp: string;
  unread: boolean;
}

export interface InvoiceRecord {
  id: string;
  invoiceNumber: string;
  leadId: string;
  clientName: string;
  company: string;
  email: string;
  planOrService: string;
  amount: number;
  billingCycle: 'One-Time' | 'Monthly Auto-Bill' | 'Annual Contract';
  gateway: 'Stripe Express' | 'ACH Direct Debit' | 'Wire Transfer';
  status: 'Paid' | 'Pending Auto-Charge' | 'Sent' | 'Overdue';
  issuedDate: string;
  dueDate: string;
  paidAt?: string;
  transactionRef?: string;
  autoRemind: boolean;
}

export interface BusinessContext {
  companyName: string;
  productName: string;
  valueProposition: string;
  targetIndustries: string;
  idealBuyerRoles: string;
  keyDifferentiators: string;
  pricingSummary: string;
}

export interface TeamMember {
  id: string;
  email: string;
  name: string;
  role: 'Owner' | 'Architect' | 'Operator' | 'Viewer';
  status: 'Connected' | 'Pending Invitation' | 'Authorized';
  addedAt: string;
  lastActive?: string;
  permissions: string[];
}

export interface WorkspaceState {
  businessContext: BusinessContext;
  personas: PersonaProfile[];
  activePersonaId: string;
  templates: EmailTemplate[];
  leads: Lead[];
  invoices: InvoiceRecord[];
  notifications: LiveNotification[];
  teamMembers?: TeamMember[];
}
