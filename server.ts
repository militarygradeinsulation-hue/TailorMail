import dotenv from 'dotenv';
import express from 'express';
import type { Response } from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, Type } from '@google/genai';
import mammoth from 'mammoth';
import { PDFParse } from 'pdf-parse';
import { db } from './src/db/index.ts';
import {
  businessProfiles,
  personas as personasTable,
  templates as templatesTable,
  leads as leadsTable,
  invoices as invoicesTable,
  notifications as notificationsTable,
  teamMembers as teamMembersTable,
} from './src/db/schema.ts';
import { eq, desc } from 'drizzle-orm';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json({ limit: '30mb' }));

// All workspace APIs are private. Gmail's OAuth token is checked with Google,
// then bound to an explicitly authorized operator in this workspace.
const operatorTokenCache = new Map<string, { email: string; expires: number }>();
app.use('/api', async (req, res, next) => {
  if (req.path.startsWith('/track/open/')) return next();
  const authorization = req.headers.authorization || '';
  if (!authorization.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Sign in with an authorized Google account.' });
    return;
  }
  const token = authorization.slice(7);
  try {
    let identity = operatorTokenCache.get(token);
    if (!identity || identity.expires <= Date.now()) {
      const reply = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!reply.ok) {
        res.status(401).json({ error: 'Google session has expired. Sign in again.' });
        return;
      }
      const details: any = await reply.json();
      if (!details.email_verified || typeof details.email !== 'string') {
        res.status(403).json({ error: 'A verified Google email is required.' });
        return;
      }
      identity = { email: details.email.toLowerCase(), expires: Date.now() + 60_000 };
      operatorTokenCache.set(token, identity);
      if (operatorTokenCache.size > 100) {
        for (const [key, value] of operatorTokenCache) {
          if (value.expires <= Date.now()) operatorTokenCache.delete(key);
        }
      }
    }
    const store = await loadStoreAsync();
    const operator = store.teamMembers.find((member: any) =>
      String(member.email).toLowerCase() === identity!.email &&
      member.status !== 'Pending Invitation'
    );
    if (!operator) {
      res.status(403).json({ error: 'Your Google account is not an authorized TailorMail operator.' });
      return;
    }
    (req as any).operatorEmail = identity.email;
    (req as any).operator = operator;
    next();
  } catch (error) {
    console.error('Operator authentication failed:', error);
    res.status(503).json({ error: 'Unable to verify operator session.' });
  }
});


// Persistent JSON file store fallback + Cloud SQL dual synchronization
const DATA_DIR = path.resolve(__dirname, 'data');
const STORE_PATH = path.join(DATA_DIR, 'workspace_store.json');

interface StoreShape {
  businessContext: {
    companyName: string;
    productName: string;
    valueProposition: string;
    targetIndustries: string;
    idealBuyerRoles: string;
    keyDifferentiators: string;
    pricingSummary: string;
  };
  personas: any[];
  activePersonaId: string;
  templates: any[];
  leads: any[];
  invoices: any[];
  notifications: any[];
  teamMembers: any[];
}

const DEFAULT_EMPTY_STORE: StoreShape = {
  businessContext: {
    companyName: '',
    productName: '',
    valueProposition: '',
    targetIndustries: '',
    idealBuyerRoles: '',
    keyDifferentiators: '',
    pricingSummary: '',
  },
  personas: [],
  activePersonaId: '',
  templates: [],
  leads: [],
  invoices: [],
  notifications: [],
  teamMembers: [
    {
      id: 'tm-owner',
      email: 'militarygradeinsulation@gmail.com',
      name: 'Military Grade Insulation (Owner)',
      role: 'Owner',
      status: 'Connected',
      addedAt: '2026-11-06',
      permissions: ['outbound_dispatch', 'icp_discovery', 'sales_qa', 'billing', 'admin'],
    },
    {
      id: 'tm-architect',
      email: 'aisystemsarchitect@gmail.com',
      name: 'AI Systems Architect',
      role: 'Architect',
      status: 'Authorized',
      addedAt: '2026-11-06',
      permissions: ['outbound_dispatch', 'icp_discovery', 'sales_qa', 'billing'],
    },
  ],
};

function loadStore(): StoreShape {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (!fs.existsSync(STORE_PATH)) {
      fs.writeFileSync(STORE_PATH, JSON.stringify(DEFAULT_EMPTY_STORE, null, 2), 'utf-8');
      return structuredClone(DEFAULT_EMPTY_STORE);
    }
    const raw = fs.readFileSync(STORE_PATH, 'utf-8');
    return { ...structuredClone(DEFAULT_EMPTY_STORE), ...JSON.parse(raw) };
  } catch (e) {
    console.error('Failed to load workspace store:', e);
    return structuredClone(DEFAULT_EMPTY_STORE);
  }
}

function saveStore(store: StoreShape) {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(STORE_PATH, JSON.stringify(store, null, 2), 'utf-8');
  } catch (e) {
    console.error('Failed to save workspace store:', e);
  }
}

// Coordinate resolver for locations to ensure all prospects have map coordinates
function getCityCoordinates(loc: string): { latitude: number; longitude: number } {
  const normalized = (loc || '').toLowerCase();
  if (normalized.includes('francisco') || normalized.includes('san fran') || normalized.includes('silicon')) {
    return { latitude: 37.7749, longitude: -122.4194 };
  }
  if (normalized.includes('new york') || normalized.includes('nyc') || normalized.includes('manhattan')) {
    return { latitude: 40.7128, longitude: -74.0060 };
  }
  if (normalized.includes('austin')) {
    return { latitude: 30.2672, longitude: -97.7431 };
  }
  if (normalized.includes('seattle')) {
    return { latitude: 47.6062, longitude: -122.3321 };
  }
  if (normalized.includes('boston') || normalized.includes('cambridge')) {
    return { latitude: 42.3601, longitude: -71.0589 };
  }
  if (normalized.includes('chicago')) {
    return { latitude: 41.8781, longitude: -87.6298 };
  }
  if (normalized.includes('denver') || normalized.includes('boulder')) {
    return { latitude: 39.7392, longitude: -104.9903 };
  }
  if (normalized.includes('los angeles') || normalized.includes('la')) {
    return { latitude: 34.0522, longitude: -118.2437 };
  }
  if (normalized.includes('atlanta')) {
    return { latitude: 33.7490, longitude: -84.3880 };
  }
  if (normalized.includes('miami')) {
    return { latitude: 25.7617, longitude: -80.1918 };
  }
  if (normalized.includes('london')) {
    return { latitude: 51.5074, longitude: -0.1278 };
  }
  if (normalized.includes('toronto')) {
    return { latitude: 43.6532, longitude: -79.3832 };
  }
  // Deterministic hash-based spread around North American commercial hubs
  let hash = 0;
  for (let i = 0; i < normalized.length; i++) {
    hash = (hash << 5) - hash + normalized.charCodeAt(i);
    hash |= 0;
  }
  const latOffset = ((Math.abs(hash) % 1000) / 1000 - 0.5) * 12;
  const lngOffset = ((Math.abs(hash >> 3) % 1000) / 1000 - 0.5) * 30;
  return {
    latitude: Number((38.0 + latOffset).toFixed(4)),
    longitude: Number((-95.0 + lngOffset).toFixed(4)),
  };
}

// Robust CSV parser supporting quotes, commas, and line breaks
function parseCsv(content: string): { headers: string[]; rows: Record<string, string>[] } {
  const lines = content.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return { headers: [], rows: [] };

  const parseLine = (line: string): string[] => {
    const result: string[] = [];
    let cur = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"') {
        if (inQuotes && line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (c === ',' && !inQuotes) {
        result.push(cur.trim());
        cur = '';
      } else {
        cur += c;
      }
    }
    result.push(cur.trim());
    return result;
  };

  const rawHeaders = parseLine(lines[0]);
  const headers = rawHeaders.map((h) => h.replace(/^["']|["']$/g, '').trim());
  const rows: Record<string, string>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseLine(lines[i]);
    if (values.every((v) => v === '')) continue;
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => {
      row[h] = values[idx] !== undefined ? values[idx].replace(/^["']|["']$/g, '').trim() : '';
    });
    rows.push(row);
  }

  return { headers, rows };
}

async function loadStoreAsync(): Promise<StoreShape> {
  const fileStore = loadStore();
  if (!process.env.SQL_HOST || !process.env.SQL_USER) {
    return fileStore;
  }

  try {
    const [bizProfiles, dbPersonas, dbTemplates, dbLeads, dbInvoices, dbNotifs, dbTeamMembers] = await Promise.all([
      db.select().from(businessProfiles).limit(1),
      db.select().from(personasTable),
      db.select().from(templatesTable),
      db.select().from(leadsTable),
      db.select().from(invoicesTable),
      db.select().from(notificationsTable).orderBy(desc(notificationsTable.createdAt)).limit(50),
      db.select().from(teamMembersTable),
    ]);

    const hasDbData =
      bizProfiles.length > 0 ||
      dbPersonas.length > 0 ||
      dbTemplates.length > 0 ||
      dbLeads.length > 0 ||
      dbInvoices.length > 0 ||
      dbNotifs.length > 0 ||
      dbTeamMembers.length > 0;

    if (!hasDbData) {
      if (
        fileStore.personas.length > 0 ||
        fileStore.leads.length > 0 ||
        fileStore.invoices.length > 0 ||
        fileStore.businessContext.companyName
      ) {
        await saveStoreAsync(fileStore);
      }
      return fileStore;
    }

    const businessContext = bizProfiles[0]
      ? {
          companyName: bizProfiles[0].companyName || '',
          productName: bizProfiles[0].productName || '',
          valueProposition: bizProfiles[0].valueProposition || '',
          targetIndustries: bizProfiles[0].targetIndustries || '',
          idealBuyerRoles: bizProfiles[0].idealBuyerRoles || '',
          keyDifferentiators: bizProfiles[0].keyDifferentiators || '',
          pricingSummary: bizProfiles[0].pricingSummary || '',
        }
      : fileStore.businessContext;

    const personas = dbPersonas.map((p) => ({
      id: p.id,
      name: p.name,
      archetype: p.archetype,
      sourceFileName: p.sourceFileName,
      rawSample: p.rawSample,
      linguisticSignature: {
        cadence: p.cadence,
        openingStyle: p.openingStyle,
        signOff: p.signOff,
        vocabularyTraits: p.vocabularyTraits || [],
      },
      updatedAt: p.updatedAt,
    }));

    // Prioritize Joseph Toney as the primary persona
    personas.sort((a, b) =>
      a.id === 'persona-joseph-toney' ? -1 : b.id === 'persona-joseph-toney' ? 1 : 0
    );

    const templates = dbTemplates.map((t) => ({
      id: t.id,
      title: t.title,
      category: t.category,
      subjectLine: t.subjectLine,
      body: t.body,
      personaId: t.personaId,
      sentCount: t.sentCount,
      openCount: t.openCount,
      replyCount: t.replyCount,
    }));

    const leads = dbLeads.map((l) => ({
      id: l.id,
      fullName: l.fullName,
      role: l.role,
      company: l.company,
      companyDomain: l.companyDomain,
      email: l.email,
      location: l.location,
      latitude: l.latitude ?? undefined,
      longitude: l.longitude ?? undefined,
      avatarUrl: l.avatarUrl ?? undefined,
      matchScore: l.matchScore,
      matchType: l.matchType,
      buyingSignal: l.buyingSignal,
      icpFitRationale: l.icpFitRationale,
      painPoints: l.painPoints || [],
      groundingSources: l.groundingSources || [],
      status: l.status,
      cadenceMode: l.cadenceMode,
      timedIntervalDays: l.timedIntervalDays,
      autoHandleQuestions: l.autoHandleQuestions,
      tailoredSubject: l.tailoredSubject,
      tailoredBody: l.tailoredBody,
      activeTemplateId: l.activeTemplateId ?? undefined,
      gmailThreadId: l.gmailThreadId ?? undefined,
      followUpSteps: l.followUpSteps || [],
      thread: l.thread || [],
      createdAt: l.createdAt ? l.createdAt.toISOString() : new Date().toISOString(),
      metrics: {
        sentCount: l.sentCount,
        opens: l.opens,
        clicks: l.clicks,
        replies: l.replies,
        lastOpenedAt: l.lastOpenedAt ?? undefined,
        dealValue: l.dealValue,
      },
    }));

    const invoices = dbInvoices.map((i) => ({
      id: i.id,
      invoiceNumber: i.invoiceNumber,
      leadId: i.leadId,
      clientName: i.clientName,
      company: i.company,
      email: i.email,
      planOrService: i.planOrService,
      amount: i.amount,
      billingCycle: i.billingCycle,
      gateway: i.gateway,
      status: i.status,
      issuedDate: i.issuedDate,
      dueDate: i.dueDate,
      paidAt: i.paidAt ?? undefined,
      transactionRef: i.transactionRef ?? undefined,
      autoRemind: i.autoRemind,
    }));

    const notifications = dbNotifs.map((n) => ({
      id: n.id,
      leadId: n.leadId,
      leadName: n.leadName,
      company: n.company,
      role: n.role,
      eventType: n.eventType,
      summary: n.summary,
      timestamp: n.timestamp,
      unread: n.unread,
    }));

    const teamMembers =
      dbTeamMembers.length > 0
        ? dbTeamMembers.map((m) => ({
            id: m.id,
            email: m.email,
            name: m.name,
            role: m.role,
            status: m.status,
            addedAt: m.addedAt,
            lastActive: m.lastActive ?? undefined,
            permissions: (m.permissions as string[]) || [
              'outbound_dispatch',
              'icp_discovery',
              'sales_qa',
              'billing',
            ],
          }))
        : fileStore.teamMembers || DEFAULT_EMPTY_STORE.teamMembers;

    const resolvedActivePersonaId =
      fileStore.activePersonaId && fileStore.activePersonaId !== 'persona-aetheris-owner' && personas.some((p) => p.id === fileStore.activePersonaId)
        ? fileStore.activePersonaId
        : personas.find((p) => p.id === 'persona-joseph-toney')?.id || personas[0]?.id || '';

    const result: StoreShape = {
      businessContext,
      personas,
      activePersonaId: resolvedActivePersonaId,
      templates,
      leads,
      invoices,
      notifications,
      teamMembers,
    };

    saveStore(result);
    return result;
  } catch (err) {
    console.error('Error reading from Cloud SQL PostgreSQL:', err);
    return fileStore;
  }
}

async function saveStoreAsync(store: StoreShape) {
  saveStore(store);
  if (!process.env.SQL_HOST || !process.env.SQL_USER) {
    return;
  }

  try {
    // 1. Business Context
    const existingProfiles = await db.select().from(businessProfiles).limit(1);
    if (existingProfiles.length > 0) {
      await db
        .update(businessProfiles)
        .set({
          companyName: store.businessContext.companyName,
          productName: store.businessContext.productName,
          valueProposition: store.businessContext.valueProposition,
          targetIndustries: store.businessContext.targetIndustries,
          idealBuyerRoles: store.businessContext.idealBuyerRoles,
          keyDifferentiators: store.businessContext.keyDifferentiators,
          pricingSummary: store.businessContext.pricingSummary,
          updatedAt: new Date(),
        })
        .where(eq(businessProfiles.id, existingProfiles[0].id));
    } else {
      await db.insert(businessProfiles).values({
        companyName: store.businessContext.companyName,
        productName: store.businessContext.productName,
        valueProposition: store.businessContext.valueProposition,
        targetIndustries: store.businessContext.targetIndustries,
        idealBuyerRoles: store.businessContext.idealBuyerRoles,
        keyDifferentiators: store.businessContext.keyDifferentiators,
        pricingSummary: store.businessContext.pricingSummary,
      });
    }

    // 2. Personas
    for (const p of store.personas) {
      const exists = await db
        .select({ id: personasTable.id })
        .from(personasTable)
        .where(eq(personasTable.id, p.id))
        .limit(1);
      const payload = {
        name: p.name,
        archetype: p.archetype,
        sourceFileName: p.sourceFileName,
        rawSample: p.rawSample,
        cadence: p.linguisticSignature?.cadence || '',
        openingStyle: p.linguisticSignature?.openingStyle || '',
        signOff: p.linguisticSignature?.signOff || '',
        vocabularyTraits: p.linguisticSignature?.vocabularyTraits || [],
        updatedAt: p.updatedAt || '',
      };
      if (exists.length > 0) {
        await db.update(personasTable).set(payload).where(eq(personasTable.id, p.id));
      } else {
        await db.insert(personasTable).values({ id: p.id, ...payload });
      }
    }

    // 3. Templates
    for (const t of store.templates) {
      const exists = await db
        .select({ id: templatesTable.id })
        .from(templatesTable)
        .where(eq(templatesTable.id, t.id))
        .limit(1);
      const payload = {
        title: t.title,
        category: t.category,
        subjectLine: t.subjectLine,
        body: t.body,
        personaId: t.personaId,
        sentCount: t.sentCount || 0,
        openCount: t.openCount || 0,
        replyCount: t.replyCount || 0,
      };
      if (exists.length > 0) {
        await db.update(templatesTable).set(payload).where(eq(templatesTable.id, t.id));
      } else {
        await db.insert(templatesTable).values({ id: t.id, ...payload });
      }
    }

    // 4. Leads
    for (const l of store.leads) {
      const exists = await db
        .select({ id: leadsTable.id })
        .from(leadsTable)
        .where(eq(leadsTable.id, l.id))
        .limit(1);
      const leadPayload = {
        fullName: l.fullName,
        role: l.role,
        company: l.company,
        companyDomain: l.companyDomain,
        email: l.email,
        location: l.location,
        latitude: typeof l.latitude === 'number' ? l.latitude : null,
        longitude: typeof l.longitude === 'number' ? l.longitude : null,
        avatarUrl: l.avatarUrl || null,
        matchScore: l.matchScore || 90,
        matchType: l.matchType || 'Web Scan',
        buyingSignal: l.buyingSignal || '',
        icpFitRationale: l.icpFitRationale || '',
        painPoints: l.painPoints || [],
        groundingSources: l.groundingSources || [],
        status: l.status || 'Discovered',
        cadenceMode: l.cadenceMode || 'timed_sequence',
        timedIntervalDays: l.timedIntervalDays || 3,
        autoHandleQuestions: Boolean(l.autoHandleQuestions),
        tailoredSubject: l.tailoredSubject || '',
        tailoredBody: l.tailoredBody || '',
        activeTemplateId: l.activeTemplateId || null,
        gmailThreadId: l.gmailThreadId || null,
        followUpSteps: l.followUpSteps || [],
        thread: l.thread || [],
        sentCount: l.metrics?.sentCount || 0,
        opens: l.metrics?.opens || 0,
        clicks: l.metrics?.clicks || 0,
        replies: l.metrics?.replies || 0,
        lastOpenedAt: l.metrics?.lastOpenedAt || null,
        dealValue: l.metrics?.dealValue || 10000,
      };

      if (exists.length > 0) {
        await db.update(leadsTable).set(leadPayload).where(eq(leadsTable.id, l.id));
      } else {
        await db.insert(leadsTable).values({ id: l.id, ...leadPayload });
      }
    }

    // 5. Invoices
    for (const inv of store.invoices) {
      const exists = await db
        .select({ id: invoicesTable.id })
        .from(invoicesTable)
        .where(eq(invoicesTable.id, inv.id))
        .limit(1);
      const invPayload = {
        invoiceNumber: inv.invoiceNumber,
        leadId: inv.leadId || '',
        clientName: inv.clientName,
        company: inv.company,
        email: inv.email,
        planOrService: inv.planOrService,
        amount: inv.amount,
        billingCycle: inv.billingCycle,
        gateway: inv.gateway,
        status: inv.status,
        issuedDate: inv.issuedDate,
        dueDate: inv.dueDate,
        paidAt: inv.paidAt || null,
        transactionRef: inv.transactionRef || null,
        autoRemind: Boolean(inv.autoRemind),
      };
      if (exists.length > 0) {
        await db.update(invoicesTable).set(invPayload).where(eq(invoicesTable.id, inv.id));
      } else {
        await db.insert(invoicesTable).values({ id: inv.id, ...invPayload });
      }
    }

    // 6. Notifications
    for (const n of store.notifications) {
      const exists = await db
        .select({ id: notificationsTable.id })
        .from(notificationsTable)
        .where(eq(notificationsTable.id, n.id))
        .limit(1);
      const notifPayload = {
        leadId: n.leadId || '',
        leadName: n.leadName || '',
        company: n.company || '',
        role: n.role || '',
        eventType: n.eventType || 'New ICP Lead',
        summary: n.summary || '',
        timestamp: n.timestamp || '',
        unread: Boolean(n.unread),
      };
      if (exists.length > 0) {
        await db.update(notificationsTable).set(notifPayload).where(eq(notificationsTable.id, n.id));
      } else {
        await db.insert(notificationsTable).values({ id: n.id, ...notifPayload });
      }
    }

    // 7. Team Members & Connected Operators
    if (store.teamMembers && store.teamMembers.length > 0) {
      for (const m of store.teamMembers) {
        const exists = await db
          .select({ id: teamMembersTable.id })
          .from(teamMembersTable)
          .where(eq(teamMembersTable.email, m.email))
          .limit(1);
        const mPayload = {
          name: m.name,
          role: m.role || 'Operator',
          status: m.status || 'Authorized',
          addedAt: m.addedAt || '2026-11-06',
          lastActive: m.lastActive || null,
          permissions: m.permissions || ['outbound_dispatch', 'icp_discovery', 'sales_qa', 'billing'],
        };
        if (exists.length > 0) {
          await db.update(teamMembersTable).set(mPayload).where(eq(teamMembersTable.email, m.email));
        } else {
          await db.insert(teamMembersTable).values({
            id: m.id || `tm-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
            email: m.email,
            ...mPayload,
          });
        }
      }
    }
  } catch (err) {
    console.error('Error writing to Cloud SQL PostgreSQL:', err);
  }
}

// Live SSE Clients for real-time incoming lead / open / payment notifications
const sseClients = new Set<Response>();

function broadcastEvent(type: string, payload: any) {
  const data = JSON.stringify({ type, payload });
  for (const client of sseClients) {
    try {
      client.write(`data: ${data}\n\n`);
    } catch {
      sseClients.delete(client);
    }
  }
}

app.get('/api/events', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  sseClients.add(res);
  res.write(`data: ${JSON.stringify({ type: 'connected' })}\n\n`);

  req.on('close', () => {
    sseClients.delete(res);
  });
});

// Get & Save Persistent Workspace State
app.get('/api/state', async (_req, res) => {
  const store = await loadStoreAsync();
  res.json(store);
});

app.put('/api/state', async (req, res) => {
  if (req.body.teamMembers !== undefined) {
    return res.status(403).json({ error: 'Team permissions can only be managed through the owner-only team endpoint.' });
  }
  const current = await loadStoreAsync();
  const updated: StoreShape = {
    businessContext: req.body.businessContext ?? current.businessContext,
    personas: req.body.personas ?? current.personas,
    activePersonaId: req.body.activePersonaId ?? current.activePersonaId,
    templates: req.body.templates ?? current.templates,
    leads: req.body.leads ?? current.leads,
    invoices: req.body.invoices ?? current.invoices,
    notifications: req.body.notifications ?? current.notifications,
    teamMembers: current.teamMembers,
  };
  await saveStoreAsync(updated);
  res.json(updated);
});

// Team Access & Connected Operator Endpoints
app.get('/api/team', async (_req, res) => {
  const store = await loadStoreAsync();
  res.json({ teamMembers: store.teamMembers || [] });
});

app.post('/api/team/invite', async (req, res) => {
  if ((req as any).operator.role !== 'Owner') {
    return res.status(403).json({ error: 'Only the workspace owner can authorize operators.' });
  }
  try {
    const { email, name, role, permissions } = req.body;
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }
    const cleanEmail = email.trim().toLowerCase();
    const store = await loadStoreAsync();
    const existingIdx = (store.teamMembers || []).findIndex(
      (m: any) => m.email.toLowerCase() === cleanEmail
    );
    const memberRecord = {
      id: existingIdx >= 0 ? store.teamMembers[existingIdx].id : `tm-${Date.now()}`,
      email: cleanEmail,
      name: name?.trim() || cleanEmail.split('@')[0],
      role: role || 'Operator',
      status: 'Authorized',
      addedAt: new Date().toISOString().split('T')[0],
      permissions: permissions || ['outbound_dispatch', 'icp_discovery', 'sales_qa', 'billing'],
    };
    if (existingIdx >= 0) {
      store.teamMembers[existingIdx] = memberRecord;
    } else {
      store.teamMembers.push(memberRecord);
    }
    await saveStoreAsync(store);
    broadcastEvent('notification', {
      state: store,
      notification: {
        id: `notif-team-${Date.now()}`,
        leadId: '',
        leadName: memberRecord.name,
        company: 'Operator Access',
        role: memberRecord.role,
        eventType: 'New ICP Lead',
        summary: `Operator access granted to ${memberRecord.email} (${memberRecord.role}). Connection active.`,
        timestamp: 'Just now',
        unread: true,
      },
    });
    res.json({ success: true, member: memberRecord, teamMembers: store.teamMembers });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to update team member' });
  }
});

function getGenAIClient() {
  return new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

// 1. Analyze uploaded personal type/voice and generate custom communication templates
app.post('/api/persona/extract-templates', async (req, res) => {
  try {
    const { personaName, archetype, rawSample, sourceFileName, businessContext } = req.body;
    const ai = getGenAIClient();

    const prompt = `Analyze the following personal communication sample and persona profile, then extract its linguistic signature and generate 5 custom email templates tailored to the user's business.

Persona Name: ${personaName || 'Primary Sender'}
Personal Archetype: ${archetype || 'Custom Uploaded Personal Type'}
Uploaded Personal Writing Sample / Type Definition:
"""
${rawSample}
"""

Business Context:
Company: ${businessContext?.companyName || 'Our Company'}
Product: ${businessContext?.productName || 'Our Solution'}
Value Proposition: ${businessContext?.valueProposition || 'High-impact B2B solution'}
Target Industries: ${businessContext?.targetIndustries || 'B2B Enterprise'}
Pricing/Offer: ${businessContext?.pricingSummary || 'Custom engagement'}

Generate:
1. Linguistic signature (cadence, openingStyle, signOff, and 3-4 concise vocabularyTraits).
2. Exactly 5 distinct, ready-to-use outgoing email templates matching this exact personal voice across these categories:
   - "Cold Outbound"
   - "Executive Intro"
   - "Sales Q&A Response"
   - "Timed Follow-Up"
   - "Invoice & Closing"
Use placeholders like {{firstName}}, {{company}}, and {{buyingSignal}} where appropriate.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            linguisticSignature: {
              type: Type.OBJECT,
              properties: {
                cadence: { type: Type.STRING },
                openingStyle: { type: Type.STRING },
                signOff: { type: Type.STRING },
                vocabularyTraits: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                },
              },
              required: ['cadence', 'openingStyle', 'signOff', 'vocabularyTraits'],
            },
            templates: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING },
                  category: { type: Type.STRING },
                  subjectLine: { type: Type.STRING },
                  body: { type: Type.STRING },
                },
                required: ['title', 'category', 'subjectLine', 'body'],
              },
            },
          },
          required: ['linguisticSignature', 'templates'],
        },
      },
    });

    const parsed = JSON.parse((response.text ?? '{}').trim());

    const store = await loadStoreAsync();
    if (businessContext) {
      store.businessContext = businessContext;
    }

    const newPersonaId = `persona-${Date.now()}`;
    const createdPersona = {
      id: newPersonaId,
      name: (personaName || '').trim() || 'Uploaded Voice Profile',
      archetype: (archetype || '').trim() || 'Custom Personal Type',
      sourceFileName: sourceFileName || 'voice_sample.txt',
      rawSample,
      linguisticSignature: parsed.linguisticSignature || {
        cadence: 'Direct declarative sentences',
        openingStyle: 'Contextual hook',
        signOff: 'Best regards',
        vocabularyTraits: ['Clear value framing', 'Actionable CTA'],
      },
      updatedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    const generatedTemplates = (parsed.templates || []).map((tpl: any, idx: number) => ({
      id: `tpl-${Date.now()}-${idx}`,
      title: tpl.title || `Custom ${tpl.category} Template`,
      category: tpl.category || 'Cold Outbound',
      subjectLine: tpl.subjectLine || '{{company}} / inquiry',
      body: tpl.body || '',
      personaId: newPersonaId,
      sentCount: 0,
      openCount: 0,
      replyCount: 0,
    }));

    store.personas = [createdPersona, ...store.personas];
    store.activePersonaId = newPersonaId;
    store.templates = [...generatedTemplates, ...store.templates];
    await saveStoreAsync(store);

    res.json({
      persona: createdPersona,
      templates: generatedTemplates,
      state: store,
    });
  } catch (error: any) {
    console.error('Error extracting persona templates:', error);
    res.status(500).json({
      error: error?.message || 'Failed to synthesize templates from persona.',
    });
  }
});

// Universal Document Parser: PDF (.pdf), Word (.docx, .doc), CSV (.csv), Markdown, Text, JSON
app.post('/api/upload/parse-document', async (req, res) => {
  try {
    const { filename, base64, mimeType } = req.body;
    if (!base64) {
      return res.status(400).json({ error: 'Missing document payload' });
    }

    const cleanName = filename || 'uploaded_document';
    const ext = cleanName.toLowerCase().split('.').pop() || '';
    const buffer = Buffer.from(base64, 'base64');
    let extractedText = '';
    let fileType = ext;
    let leads: any[] = [];
    let parsedRows: any[] = [];

    if (ext === 'pdf' || mimeType?.includes('pdf')) {
      fileType = 'pdf';
      try {
        const parser = new PDFParse({ data: buffer });
        await (parser as any).load();
        const result = await parser.getText();
        await parser.destroy();
        extractedText = (result?.text || '').trim();
      } catch (pdfErr: any) {
        console.error('PDF parsing error:', pdfErr);
        return res.status(500).json({
          error: 'Failed to extract text from PDF: ' + (pdfErr?.message || 'Invalid PDF'),
        });
      }
    } else if (ext === 'docx' || ext === 'doc' || mimeType?.includes('word')) {
      fileType = 'docx';
      try {
        const { value } = await mammoth.extractRawText({ buffer });
        extractedText = (value || '').trim();
      } catch (docErr: any) {
        console.error('Word docx parsing error:', docErr);
        return res.status(500).json({
          error:
            'Failed to extract text from Word document: ' + (docErr?.message || 'Invalid Word file'),
        });
      }
    } else if (ext === 'csv' || mimeType?.includes('csv')) {
      fileType = 'csv';
      const rawCsv = buffer.toString('utf-8');
      const { headers, rows } = parseCsv(rawCsv);
      parsedRows = rows;

      // Extract structured leads if headers match contact/prospect fields
      leads = rows.map((row, idx) => {
        const findField = (keys: string[]) => {
          for (const k of keys) {
            const found = Object.keys(row).find(
              (header) => header.toLowerCase().replace(/[^a-z0-9]/g, '') === k.toLowerCase()
            );
            if (found && row[found]) return row[found];
          }
          return '';
        };

        const fullName =
          findField(['fullname', 'name', 'contact', 'leadname', 'prospect', 'person']) ||
          `Lead ${idx + 1}`;
        const email =
          findField(['email', 'emailaddress', 'workemail', 'mail']) ||
          `contact@company${idx + 1}.com`;
        const company =
          findField(['company', 'companyname', 'organization', 'account', 'business']) ||
          'Target Account';
        const role = findField(['role', 'title', 'jobtitle', 'position']) || 'Executive';
        const location =
          findField(['location', 'city', 'state', 'headquarters', 'geo']) || 'United States';
        const signal =
          findField(['buyingsignal', 'signal', 'notes', 'trigger', 'context']) ||
          'Imported via CSV prospect dataset';
        const dealVal =
          Number(findField(['dealvalue', 'value', 'amount', 'revenue', 'deal'])) || 12500;

        return {
          fullName,
          email,
          company,
          role,
          location,
          buyingSignal: signal,
          dealValue: dealVal,
        };
      });

      // Human-readable summary for persona sample and LLM prompt calibration
      extractedText =
        `CSV Dataset: ${cleanName} (${rows.length} records)\nHeaders: ${headers.join(
          ', '
        )}\n\n` +
        rows
          .slice(0, 150)
          .map(
            (r, i) =>
              `${i + 1}. ` +
              Object.entries(r)
                .map(([k, v]) => `${k}: ${v}`)
                .join(' | ')
          )
          .join('\n');
    } else {
      // Default: text, md, json, eml
      fileType = ext || 'text';
      extractedText = buffer.toString('utf-8');
    }

    res.json({
      success: true,
      filename: cleanName,
      fileType,
      charCount: extractedText.length,
      extractedText,
      leads: leads.length > 0 ? leads : undefined,
      rowCount: parsedRows.length > 0 ? parsedRows.length : undefined,
    });
  } catch (error: any) {
    console.error('Document upload parsing error:', error);
    res.status(500).json({ error: error?.message || 'Failed to parse uploaded document.' });
  }
});

// Bulk Lead Import from CSV / Document
app.post('/api/leads/import-csv', async (req, res) => {
  try {
    let rawLeads = req.body.leads;
    const { filename, csvContent } = req.body;

    if ((!Array.isArray(rawLeads) || rawLeads.length === 0) && csvContent) {
      const { headers, rows } = parseCsv(csvContent);
      if (rows.length > 0) {
        const header = headers.map((h: string) => h.toLowerCase().trim());
        const findCol = (terms: string[]) =>
          header.findIndex((h: string) => terms.some((t: string) => h.includes(t)));

        const nameIdx = findCol(['name', 'contact', 'lead', 'full name', 'person']);
        const roleIdx = findCol(['role', 'title', 'position', 'job']);
        const companyIdx = findCol(['company', 'organization', 'account', 'business', 'firm']);
        const emailIdx = findCol(['email', 'mail', 'e-mail']);
        const locationIdx = findCol(['location', 'city', 'state', 'address', 'region']);
        const signalIdx = findCol(['signal', 'trigger', 'note', 'pain', 'friction', 'context']);
        const dealIdx = findCol(['deal', 'value', 'revenue', 'amount', 'size']);

        rawLeads = rows
          .map((row: Record<string, string>) => {
            const getVal = (idx: number, fallback = '') =>
              idx !== -1 && headers[idx] && row[headers[idx]] ? row[headers[idx]] : fallback;

            return {
              fullName: getVal(nameIdx, 'Executive Contact'),
              role: getVal(roleIdx, 'Decision Maker'),
              company: getVal(companyIdx, 'Target Account'),
              email: getVal(emailIdx, ''),
              location: getVal(locationIdx, 'United States'),
              buyingSignal: getVal(
                signalIdx,
                'Imported via CSV prospect dataset for operational handoff analysis.'
              ),
              dealValue:
                dealIdx !== -1 && headers[dealIdx] && row[headers[dealIdx]]
                  ? Number(row[headers[dealIdx]].replace(/[^0-9.]/g, '')) || 12000
                  : 12000,
            };
          })
          .filter((l: any) => /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(l.email || ''));
      }
    }

    if (!Array.isArray(rawLeads) || rawLeads.length === 0) {
      return res.status(400).json({ error: 'No valid lead records found in CSV.' });
    }

    const store = await loadStoreAsync();
    const importedLeads: any[] = rawLeads.map((item: any, idx: number) => {
      const coords = getCityCoordinates(item.location || 'United States');
      const companyClean = (item.company || 'Enterprise Account').trim();
      const domain =
        (item.email?.includes('@') ? item.email.split('@')[1] : '') ||
        `${companyClean.toLowerCase().replace(/[^a-z0-9]/g, '')}.com`;
      const firstName = (item.fullName || 'Leader').split(' ')[0];

      return {
        id: `lead-csv-${Date.now()}-${idx}-${Math.floor(Math.random() * 1000)}`,
        fullName: item.fullName || 'Executive Contact',
        role: item.role || 'Executive Decision Maker',
        company: companyClean,
        companyDomain: domain,
        email: item.email,
        location: item.location || 'United States',
        latitude: item.latitude || coords.latitude,
        longitude: item.longitude || coords.longitude,
        avatarUrl: `https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80`,
        matchScore: Number(item.matchScore) || 90,
        matchType: 'Inbound Lead' as const,
        buyingSignal:
          item.buyingSignal ||
          'Imported via CSV prospect dataset for operational handoff analysis.',
        icpFitRationale:
          item.icpFitRationale ||
          'Matches target criteria for operational friction & quote-to-order analysis.',
        painPoints: item.painPoints || ['Handoff visibility', 'Quote-to-cash cycle time'],
        groundingSources: [],
        status: 'Discovered' as const,
        cadenceMode: 'timed_sequence' as const,
        timedIntervalDays: 3,
        autoHandleQuestions: false,
        tailoredSubject: `${companyClean}'s quote-to-order handoff & operational exceptions`,
        tailoredBody: `Hi ${firstName},\n\nA business is a reflection of the decisions, relationships, and systems operating inside it. In operations where quoting, scheduling, and billing live across separate tools, handoff exceptions can accumulate quickly.\n\nAt Aetheris Technology, we examine where friction occurs between departments before proposing software.\n\nWould you be open to a 15-minute review of your current quote-to-cash workflow?\n\nRespectfully,\nJoseph Toney\nFounder & CEO, Aetheris Technology\nArchitect of Mindprint\nhttps://aetheris.technology`,
        followUpSteps: [
          {
            id: `step-${Date.now()}-${idx}-1`,
            dayOffset: 3,
            subject: `Re: ${companyClean}'s quote-to-order handoff`,
            body: `${firstName} — following up on my previous note. Glad to share our 1-page benchmark on operational handoffs if helpful.\n\nRespectfully,\nJoseph Toney\nFounder & CEO, Aetheris Technology`,
            status: 'scheduled' as const,
            scheduledAt: new Date(Date.now() + 3 * 86400000).toISOString(),
            scheduledTimeLabel: 'Scheduled · Day +3',
          },
        ],
        thread: [],
        createdAt: new Date().toISOString(),
        metrics: {
          sentCount: 0,
          opens: 0,
          clicks: 0,
          replies: 0,
          dealValue: Number(item.dealValue) || 12500,
        },
      };
    });

    store.leads = [...importedLeads, ...store.leads];

    const notif = {
      id: `notif-${Date.now()}`,
      leadId: importedLeads[0].id,
      leadName: importedLeads[0].fullName,
      company: importedLeads[0].company,
      role: importedLeads[0].role,
      eventType: 'New ICP Lead' as const,
      summary: `Imported ${importedLeads.length} leads from ${filename || 'CSV dataset'}`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      unread: true,
    };
    store.notifications = [notif, ...store.notifications];

    await saveStoreAsync(store);
    broadcastEvent('notification', { notification: notif, state: store });

    res.json({
      success: true,
      importedCount: importedLeads.length,
      leads: importedLeads,
      state: store,
    });
  } catch (err: any) {
    console.error('Error importing CSV leads:', err);
    res.status(500).json({ error: err?.message || 'Failed to import CSV leads.' });
  }
});

// 2. Scan the web for ICPs, perform Regional Maps Grounding, or Intelligence Matching
app.post('/api/icp/discover', async (req, res) => {
  try {
    const { query, mode, businessContext, centerLocation } = req.body;
    const ai = getGenAIClient();

    let searchPrompt = '';
    let config: any = {};

    if (mode === 'maps_scan') {
      // Maps Grounding per gemini_api guidelines (no responseSchema or responseMimeType)
      searchPrompt = `Identify 3 real B2B companies, regional commercial hubs, or client headquarters matching this geographic search query: "${query}".
Our Business: ${businessContext?.companyName || 'B2B Solutions'} (${businessContext?.productName || 'Core Product'})
Value Proposition: ${businessContext?.valueProposition || 'Operational efficiency'}
Target Buyer Roles: ${businessContext?.idealBuyerRoles || 'Executive Decision Makers'}

Return a valid JSON array of 3 prospect objects. Each object must have:
- "fullName": string (executive name or contact)
- "role": string (title)
- "company": string (real company name)
- "companyDomain": string (e.g. company.com)
- "email": string
- "location": string (City, State or Country)
- "latitude": number (real decimal latitude)
- "longitude": number (real decimal longitude)
- "matchScore": number (85-99)
- "buyingSignal": string (specific physical location advantage or regional initiative)
- "icpFitRationale": string (fit description)
- "painPoints": array of 2 short strings
- "dealValue": number (estimated USD)

Output ONLY the raw JSON array.`;

      config = {
        tools: [{ googleMaps: {} }],
      };
      if (centerLocation && typeof centerLocation.lat === 'number' && typeof centerLocation.lng === 'number') {
        config.toolConfig = {
          retrievalConfig: {
            latLng: {
              latitude: centerLocation.lat,
              longitude: centerLocation.lng,
            },
          },
        };
      }
    } else if (mode === 'web_scan') {
      // Web Search Grounding
      searchPrompt = `Search the live web to identify 3 real B2B companies and relevant decision-maker roles matching this Ideal Customer Profile (ICP) search: "${query}".
Our Business: ${businessContext?.companyName || 'Aetheris Technology'} (${businessContext?.productName || 'Decision-Friction Diagnostic / Golden Report'})
Value Proposition: ${businessContext?.valueProposition || 'Diagnosing where cost, cash, and momentum disappear across operational handoffs'}
Target Roles: ${businessContext?.idealBuyerRoles || 'Founder, CEO, President, COO, CFO'}

Strategic Evaluation Standard:
- Target: US privately held businesses ($5M–$75M revenue, 25–300 employees, Midwest/Indiana beachhead or nationwide).
- Priority Segments: A1 Precision & Contract Manufacturing (CNC, fabrication, industrial suppliers), A2 Multi-Stage Engineering & IT Services, A3 Field & Specialty Trades, or Mindprint Executive Advisers.
- Triggers: ERP/CRM migration, CEO/COO transitions, multi-site expansion, OpEx/RevOps hiring, quote-to-order delays.
- Compute "matchScore" using the 100-Point Account Qualification Model:
  * Process complexity (up to 25 pts)
  * Active business trigger (up to 20 pts)
  * Economic buyer access (up to 20 pts)
  * Potential materiality (up to 15 pts)
  * Data/evidence availability (up to 10 pts)
  * Urgency & execution readiness (up to 10 pts)
  (Result between 75 and 98).

Return your findings as a valid JSON array of 3 prospect objects. Each object must have:
- "fullName": string (decision-maker name or contact)
- "role": string (exact title)
- "company": string (real company name found on the web)
- "companyDomain": string (real domain)
- "email": string (work email address at that domain)
- "location": string (City, State/Country)
- "latitude": number (approximate latitude for the headquarters city)
- "longitude": number (approximate longitude for the headquarters city)
- "matchScore": number (calculated 100-point score, between 75 and 98)
- "buyingSignal": string (specific recent company trigger: ERP rollout, expansion, hiring, or quote-to-order friction)
- "icpFitRationale": string (exact handoff diagnosis, e.g. Quote-to-Order gap in multi-cell CNC operations)
- "painPoints": array of 2 short strings
- "dealValue": number (estimated USD, e.g. 6500 for Golden Diagnostic or 12000 for sprint)

Return ONLY a raw JSON array (no markdown fences).`;

      config = {
        tools: [{ googleSearch: {} }],
      };
    } else {
      // Structured Intelligence Match
      searchPrompt = `Perform B2B intelligence matching based on our business and product to identify 3 high-converting prospect profiles that match our solution.
Search Criteria / Vertical Focus: "${query}"
Our Business: ${businessContext?.companyName || 'Our Company'}
Product: ${businessContext?.productName || 'Our Product'}
Value Proposition: ${businessContext?.valueProposition || ''}
Key Differentiators: ${businessContext?.keyDifferentiators || ''}
Target Buyer Roles: ${businessContext?.idealBuyerRoles || 'VP / Director'}

Return a valid JSON array of 3 prospect objects with:
- "fullName": string
- "role": string
- "company": string
- "companyDomain": string
- "email": string
- "location": string
- "latitude": number
- "longitude": number
- "matchScore": number (between 85 and 99)
- "buyingSignal": string
- "icpFitRationale": string
- "painPoints": array of 2 short strings
- "dealValue": number

Return ONLY a raw JSON array.`;

      config = {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              fullName: { type: Type.STRING },
              role: { type: Type.STRING },
              company: { type: Type.STRING },
              companyDomain: { type: Type.STRING },
              email: { type: Type.STRING },
              location: { type: Type.STRING },
              latitude: { type: Type.NUMBER },
              longitude: { type: Type.NUMBER },
              matchScore: { type: Type.NUMBER },
              buyingSignal: { type: Type.STRING },
              icpFitRationale: { type: Type.STRING },
              painPoints: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
              dealValue: { type: Type.NUMBER },
            },
            required: [
              'fullName',
              'role',
              'company',
              'companyDomain',
              'email',
              'location',
              'matchScore',
              'buyingSignal',
              'icpFitRationale',
              'painPoints',
              'dealValue',
            ],
          },
        },
      };
    }

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: searchPrompt,
      config,
    });

    const rawText = (response.text ?? '[]').trim();
    const cleanedJson = rawText
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/\s*```$/, '')
      .trim();

    let rawLeads: any[] = [];
    try {
      const startIdx = cleanedJson.indexOf('[');
      const endIdx = cleanedJson.lastIndexOf(']');
      if (startIdx !== -1 && endIdx !== -1) {
        rawLeads = JSON.parse(cleanedJson.slice(startIdx, endIdx + 1));
      } else {
        rawLeads = JSON.parse(cleanedJson);
      }
    } catch {
      rawLeads = [];
    }

    const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
    const groundingSources = chunks
      .map((c: any) => {
        if (c?.maps?.uri) {
          return {
            title: c.maps.title || c.maps.uri,
            uri: c.maps.uri,
          };
        }
        if (c?.web?.uri) {
          return {
            title: c.web.title || c.web.uri,
            uri: c.web.uri,
          };
        }
        return null;
      })
      .filter((w: any) => w && w.uri)
      .slice(0, 5);

    const store = await loadStoreAsync();
    if (businessContext) {
      store.businessContext = businessContext;
    }
    const activePersona =
      store.personas.find((p) => p.id === store.activePersonaId) || store.personas[0];
    const signOff = activePersona?.linguisticSignature?.signOff || 'Best regards';

    const createdLeads = rawLeads.map((item: any, idx: number) => {
      const firstName = (item.fullName || 'there').split(' ')[0];
      const defaultSubject = `${item.company || 'Team'} / ${
        store.businessContext.productName || 'Strategic Inquiry'
      }`;
      const defaultBody = `${firstName} — noticed ${
        item.buyingSignal || 'your recent operational initiatives'
      } at ${item.company}.\n\n${
        store.businessContext.valueProposition ||
        'We help teams streamline operations with measurable ROI.'
      }\n\nWould a brief 10-minute conversation this week make sense?\n\n${signOff}`;

      const coords =
        typeof item.latitude === 'number' && !isNaN(item.latitude) && typeof item.longitude === 'number' && !isNaN(item.longitude)
          ? { latitude: item.latitude, longitude: item.longitude }
          : getCityCoordinates(item.location || item.company);

      const matchTypeLabel =
        mode === 'maps_scan'
          ? 'Regional Maps Scan'
          : mode === 'web_scan'
          ? 'Web Scan'
          : 'Intelligence Match';

      return {
        id: `lead-${Date.now()}-${idx}`,
        fullName: item.fullName,
        role: item.role,
        company: item.company,
        companyDomain: item.companyDomain,
        email: item.email,
        location: item.location,
        latitude: coords.latitude,
        longitude: coords.longitude,
        matchScore: Number(item.matchScore) || 90,
        matchType: matchTypeLabel,
        buyingSignal: item.buyingSignal,
        icpFitRationale: item.icpFitRationale,
        painPoints: Array.isArray(item.painPoints) ? item.painPoints : [],
        groundingSources,
        status: 'Discovered',
        cadenceMode: 'timed_sequence',
        timedIntervalDays: 3,
        autoHandleQuestions: true,
        tailoredSubject: defaultSubject,
        tailoredBody: defaultBody,
        followUpSteps: [
          {
            id: `step-${Date.now()}-${idx}-1`,
            dayOffset: 3,
            subject: `Re: ${defaultSubject}`,
            body: `${firstName} — following up on my note regarding ${item.company}. Let me know if we can share our overview sheet.\n\n${signOff}`,
            status: 'scheduled',
            scheduledAt: new Date(Date.now() + 3 * 86400000).toISOString(),
            scheduledTimeLabel: 'Scheduled · Day +3',
          },
        ],
        thread: [],
        createdAt: new Date().toISOString(),
        metrics: {
          sentCount: 0,
          opens: 0,
          clicks: 0,
          replies: 0,
          dealValue: Number(item.dealValue) || 10000,
        },
      };
    });

    if (createdLeads.length > 0) {
      store.leads = [...createdLeads, ...store.leads];
      const notif = {
        id: `notif-${Date.now()}`,
        leadId: createdLeads[0].id,
        leadName: createdLeads[0].fullName,
        company: createdLeads[0].company,
        role: createdLeads[0].role,
        eventType: 'New ICP Lead',
        summary: `Discovered ${createdLeads.length} ICP leads via ${
          mode === 'maps_scan'
            ? 'Google Maps Regional Scan'
            : mode === 'web_scan'
            ? 'Live Web Scan'
            : 'Intelligence Match'
        }: ${createdLeads[0].buyingSignal}`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        unread: true,
      };
      store.notifications = [notif, ...store.notifications];
      await saveStoreAsync(store);
      broadcastEvent('notification', { notification: notif, state: store });
    }

    res.json({ leads: createdLeads, groundingSources, state: store });
  } catch (error: any) {
    console.error('Error discovering ICP leads:', error);
    res.status(500).json({
      error: error?.message || 'Failed to scan for ICP leads.',
    });
  }
});

// 3. Custom-tailor an outbound email + single or timed follow-up sequence
app.post('/api/email/tailor', async (req, res) => {
  try {
    const { lead, persona, businessContext, cadenceMode, timedIntervalDays } = req.body;
    const ai = getGenAIClient();

    const prompt = `Custom-tailor an outbound email and follow-up plan for this specific prospect using the sender's uploaded personal voice profile.

Prospect:
- Name: ${lead.fullName}
- Title: ${lead.role} at ${lead.company} (${lead.companyDomain})
- Buying Signal: ${lead.buyingSignal}
- ICP Fit Rationale: ${lead.icpFitRationale}
- Key Pain Points: ${(lead.painPoints || []).join(', ')}

Sender Persona ("${persona?.name || 'Sender'}" - ${persona?.archetype || 'Direct'}):
- Cadence & Tone: ${persona?.linguisticSignature?.cadence || 'Clear and direct'}
- Opening Style: ${persona?.linguisticSignature?.openingStyle || 'Contextual'}
- Sign-off: ${persona?.linguisticSignature?.signOff || 'Best regards'}
- Voice Sample Reference: "${(persona?.rawSample || '').slice(0, 600)}"

Our Business & Product:
- Company: ${businessContext?.companyName || ''}
- Product: ${businessContext?.productName || ''}
- Value Proposition: ${businessContext?.valueProposition || ''}
- Differentiators: ${businessContext?.keyDifferentiators || ''}
- Pricing: ${businessContext?.pricingSummary || ''}

Follow-Up Mode Selected: ${
      cadenceMode === 'one_touch'
        ? 'ONE-TOUCH ONLY (Single high-conviction email with zero automated follow-up steps)'
        : `TIMED MULTI-TOUCH CADENCE (Every ${timedIntervalDays || 3} days: generate 3 timed follow-up steps at Day +${timedIntervalDays || 3}, Day +${(timedIntervalDays || 3) * 2}, and Day +${(timedIntervalDays || 3) * 3})`
    }

Return JSON with:
- "tailoredSubject": string
- "tailoredBody": string
- "followUpSteps": array of objects with { dayOffset: number, subject: string, body: string, scheduledTimeLabel: string }`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            tailoredSubject: { type: Type.STRING },
            tailoredBody: { type: Type.STRING },
            followUpSteps: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  dayOffset: { type: Type.NUMBER },
                  subject: { type: Type.STRING },
                  body: { type: Type.STRING },
                  scheduledTimeLabel: { type: Type.STRING },
                },
                required: ['dayOffset', 'subject', 'body', 'scheduledTimeLabel'],
              },
            },
          },
          required: ['tailoredSubject', 'tailoredBody', 'followUpSteps'],
        },
      },
    });

    const parsed = JSON.parse((response.text ?? '{}').trim());
    res.json(parsed);
  } catch (error: any) {
    console.error('Error tailoring email:', error);
    res.status(500).json({
      error: error?.message || 'Failed to custom-tailor email.',
    });
  }
});

// 4. Autonomous Sales Question & Follow-up Handler
app.post('/api/email/handle-question', async (req, res) => {
  try {
    const { lead, prospectQuestion, persona, businessContext, cadenceMode, timedIntervalDays } =
      req.body;
    const ai = getGenAIClient();

    const prompt = `A prospect replied to our outbound email with a sales question or objection. Write an accurate, high-trust response in our exact personal voice that answers their question, advances the sale, and respects our follow-up toggle setting.

Prospect: ${lead.fullName}, ${lead.role} at ${lead.company}
Prospect's Incoming Question:
"""
${prospectQuestion}
"""

Our Business & Product Facts:
- Company: ${businessContext?.companyName || ''}
- Product: ${businessContext?.productName || ''}
- Value Proposition: ${businessContext?.valueProposition || ''}
- Key Differentiators: ${businessContext?.keyDifferentiators || ''}
- Pricing & Billing: ${businessContext?.pricingSummary || ''}

Sender Persona ("${persona?.name || 'Sender'}" - ${persona?.archetype || 'Direct'}):
- Linguistic Cadence: ${persona?.linguisticSignature?.cadence || 'Direct and helpful'}
- Sign-off: ${persona?.linguisticSignature?.signOff || 'Best regards'}

Follow-Up Mode Toggle: ${
      cadenceMode === 'one_touch'
        ? 'Single-Touch Mode (Answer completely in one self-contained reply; do not schedule automated drip nudges)'
        : `Timed Follow-Up Mode (Answer their question and note a Day +${timedIntervalDays || 3} check-in follow-up if needed)`
    }

Return JSON with:
- "replySubject": string
- "replyBody": string
- "nextFollowUpNote": string`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            replySubject: { type: Type.STRING },
            replyBody: { type: Type.STRING },
            nextFollowUpNote: { type: Type.STRING },
          },
          required: ['replySubject', 'replyBody', 'nextFollowUpNote'],
        },
      },
    });

    const parsed = JSON.parse((response.text ?? '{}').trim());
    res.json(parsed);
  } catch (error: any) {
    console.error('Error handling sales question:', error);
    res.status(500).json({
      error: error?.message || 'Failed to generate autonomous sales response.',
    });
  }
});

// 5. Real Gmail Send Endpoint (RFC 2822 MIME + Real Open Tracking Pixel)
function toBase64Url(str: string): string {
  return Buffer.from(str, 'utf-8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

app.post('/api/gmail/send', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Missing Gmail OAuth access token. Please sign in with Google.' });
    }

    const { leadId, to, subject, body, threadId, senderName, isFollowUp, stepId } = req.body;
    if (!to || !subject || !body) {
      return res.status(400).json({ error: 'Recipient email (to), subject, and body are required.' });
    }

    const appBaseUrl =
      process.env.APP_URL && process.env.APP_URL !== 'MY_APP_URL'
        ? process.env.APP_URL.replace(/\/$/, '')
        : `${req.protocol}://${req.get('host')}`;

    const trackingPixelUrl = `${appBaseUrl}/api/track/open/${encodeURIComponent(leadId || 'general')}?t=${Date.now()}`;
    const htmlBody = `<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 14px; line-height: 1.6; color: #0f172a; white-space: pre-wrap;">${body
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')}</div><img src="${trackingPixelUrl}" width="1" height="1" alt="" style="display:none;" />`;

    const boundary = `cadence_boundary_${Date.now()}`;
    const mimeLines = [
      `To: ${to}`,
      `Subject: =?utf-8?B?${Buffer.from(subject, 'utf-8').toString('base64')}?=`,
      'MIME-Version: 1.0',
      `Content-Type: multipart/alternative; boundary="${boundary}"`,
      '',
      `--${boundary}`,
      'Content-Type: text/plain; charset="UTF-8"',
      'Content-Transfer-Encoding: 7bit',
      '',
      body,
      '',
      `--${boundary}`,
      'Content-Type: text/html; charset="UTF-8"',
      'Content-Transfer-Encoding: 7bit',
      '',
      htmlBody,
      '',
      `--${boundary}--`,
    ];

    const rawMime = toBase64Url(mimeLines.join('\r\n'));
    const gmailPayload: Record<string, any> = { raw: rawMime };
    if (threadId) {
      gmailPayload.threadId = threadId;
    }

    const gmailRes = await fetch(
      'https://gmail.googleapis.com/gmail/v1/users/me/messages/send',
      {
        method: 'POST',
        headers: {
          Authorization: authHeader,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(gmailPayload),
      }
    );

    const gmailData: any = await gmailRes.json();
    if (!gmailRes.ok) {
      const errMsg =
        gmailData?.error?.message || 'Gmail API rejected the send request.';
      return res.status(gmailRes.status).json({ error: errMsg });
    }

    // Update persistent store with the sent message and real Gmail IDs
    const store = await loadStoreAsync();
    const leadIdx = store.leads.findIndex((l) => l.id === leadId);
    const nowTime = new Date().toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });

    if (leadIdx !== -1) {
      const lead = store.leads[leadIdx];
      const newThreadMsg = {
        id: `msg-${Date.now()}`,
        gmailMessageId: gmailData.id,
        gmailThreadId: gmailData.threadId,
        sender: isFollowUp ? 'autonomous_agent' : 'outbound',
        senderName: senderName || 'Outbound Sender',
        timestamp: `Sent via Gmail · ${nowTime}`,
        subject,
        body,
        isAutomatedFollowUp: Boolean(isFollowUp),
      };

      lead.gmailThreadId = gmailData.threadId || lead.gmailThreadId;
      lead.status = lead.status === 'Converted' ? 'Converted' : 'Active Sequence';
      lead.thread = [...(lead.thread || []), newThreadMsg];
      lead.metrics = {
        ...lead.metrics,
        sentCount: (lead.metrics?.sentCount || 0) + 1,
      };

      if (stepId && Array.isArray(lead.followUpSteps)) {
        lead.followUpSteps = lead.followUpSteps.map((st: any) =>
          st.id === stepId
            ? {
                ...st,
                status: 'sent',
                sentAt: nowTime,
                scheduledTimeLabel: `Sent via Gmail · ${nowTime}`,
              }
            : st
        );
      }

      if (lead.activeTemplateId) {
        store.templates = store.templates.map((t) =>
          t.id === lead.activeTemplateId
            ? { ...t, sentCount: (t.sentCount || 0) + 1 }
            : t
        );
      }

      store.leads[leadIdx] = lead;
      await saveStoreAsync(store);
    }

    res.json({
      gmailMessageId: gmailData.id,
      gmailThreadId: gmailData.threadId,
      state: store,
    });
  } catch (error: any) {
    console.error('Error sending Gmail message:', error);
    res.status(500).json({ error: error?.message || 'Failed to send email via Gmail.' });
  }
});

// 6. Real Gmail Inbox & Thread Reply Sync
function extractPlainTextFromGmailPayload(payload: any): string {
  if (!payload) return '';
  if (payload.mimeType === 'text/plain' && payload.body?.data) {
    return Buffer.from(payload.body.data, 'base64').toString('utf-8');
  }
  if (Array.isArray(payload.parts)) {
    for (const part of payload.parts) {
      const text = extractPlainTextFromGmailPayload(part);
      if (text) return text;
    }
  }
  return '';
}

function getHeader(headers: any[], name: string): string {
  if (!Array.isArray(headers)) return '';
  const found = headers.find(
    (h) => String(h.name || '').toLowerCase() === name.toLowerCase()
  );
  return found?.value || '';
}

app.post('/api/gmail/sync', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Missing Gmail OAuth token.' });
    }

    const { importUnreadAsLeads } = req.body || {};
    const store = await loadStoreAsync();
    let newRepliesFound = 0;
    let newLeadsImported = 0;

    // A. Check existing leads for new replies in their Gmail thread or from their email address
    for (let i = 0; i < store.leads.length; i++) {
      const lead = store.leads[i];
      if (!lead.email) continue;

      const query = lead.gmailThreadId
        ? `from:${lead.email}`
        : `from:${lead.email} in:inbox`;
      const listRes = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(query)}&maxResults=5`,
        { headers: { Authorization: authHeader } }
      );
      if (!listRes.ok) continue;
      const listData: any = await listRes.json();
      const messages = Array.isArray(listData.messages) ? listData.messages : [];

      for (const msgSummary of messages) {
        const alreadyRecorded = (lead.thread || []).some(
          (m: any) => m.gmailMessageId === msgSummary.id
        );
        if (alreadyRecorded) continue;

        const detailRes = await fetch(
          `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msgSummary.id}?format=full`,
          { headers: { Authorization: authHeader } }
        );
        if (!detailRes.ok) continue;
        const detail: any = await detailRes.json();

        const subject =
          getHeader(detail.payload?.headers, 'Subject') ||
          `Re: ${lead.tailoredSubject}`;
        const bodyText =
          extractPlainTextFromGmailPayload(detail.payload).trim() ||
          detail.snippet ||
          '';

        if (!bodyText) continue;

        const nowLabel = new Date().toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
        });

        lead.thread = [
          ...(lead.thread || []),
          {
            id: `msg-gmail-${msgSummary.id}`,
            gmailMessageId: msgSummary.id,
            gmailThreadId: detail.threadId,
            sender: 'prospect',
            senderName: lead.fullName,
            senderEmail: lead.email,
            timestamp: `Gmail Reply · ${nowLabel}`,
            subject,
            body: bodyText.slice(0, 2000),
          },
        ];
        lead.gmailThreadId = detail.threadId || lead.gmailThreadId;
        lead.status =
          lead.status === 'Converted' ? 'Converted' : 'Question Received';
        lead.metrics = {
          ...lead.metrics,
          opens: Math.max(1, (lead.metrics?.opens || 0) + 1),
          replies: (lead.metrics?.replies || 0) + 1,
          lastOpenedAt: nowLabel,
        };

        if (lead.activeTemplateId) {
          store.templates = store.templates.map((t) =>
            t.id === lead.activeTemplateId
              ? { ...t, replyCount: (t.replyCount || 0) + 1, openCount: Math.max(1, (t.openCount || 0)) }
              : t
          );
        }

        const notif = {
          id: `notif-reply-${msgSummary.id}`,
          leadId: lead.id,
          leadName: lead.fullName,
          company: lead.company,
          role: lead.role,
          eventType: 'Sales Question',
          summary: `Gmail reply received: "${bodyText.slice(0, 110)}"`,
          timestamp: nowLabel,
          unread: true,
        };
        store.notifications = [notif, ...store.notifications];
        broadcastEvent('notification', { notification: notif, state: store });
        newRepliesFound++;
      }
    }

    // B. Optional: Import latest unread inbox emails as new inbound leads
    if (importUnreadAsLeads) {
      const unreadRes = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(
          'is:unread in:inbox -category:promotions -category:social'
        )}&maxResults=3`,
        { headers: { Authorization: authHeader } }
      );
      if (unreadRes.ok) {
        const unreadData: any = await unreadRes.json();
        const unreadMsgs = Array.isArray(unreadData.messages)
          ? unreadData.messages
          : [];

        for (const item of unreadMsgs) {
          const existsInThreads = store.leads.some((l) =>
            (l.thread || []).some((m: any) => m.gmailMessageId === item.id)
          );
          if (existsInThreads) continue;

          const detailRes = await fetch(
            `https://gmail.googleapis.com/gmail/v1/users/me/messages/${item.id}?format=full`,
            { headers: { Authorization: authHeader } }
          );
          if (!detailRes.ok) continue;
          const detail: any = await detailRes.json();

          const fromHeader = getHeader(detail.payload?.headers, 'From');
          const subject =
            getHeader(detail.payload?.headers, 'Subject') || 'Inbound Inquiry';
          const snippet =
            extractPlainTextFromGmailPayload(detail.payload).trim() ||
            detail.snippet ||
            '';

          // Parse "Name <email@domain.com>"
          const emailMatch = fromHeader.match(/<([^>]+)>/);
          const senderEmail = (
            emailMatch ? emailMatch[1] : fromHeader
          ).trim();
          const senderName = fromHeader
            .replace(/<[^>]+>/, '')
            .replace(/"/g, '')
            .trim() || senderEmail.split('@')[0];
          const domain = senderEmail.split('@')[1] || 'inbound.org';
          const companyName =
            domain.split('.')[0].charAt(0).toUpperCase() +
            domain.split('.')[0].slice(1);

          const nowLabel = new Date().toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          });

          const newLeadId = `lead-gmail-${item.id}`;
          const newLead = {
            id: newLeadId,
            fullName: senderName,
            role: 'Inbound Contact',
            company: companyName,
            companyDomain: domain,
            email: senderEmail,
            location: 'Gmail Inbox',
            matchScore: 91,
            matchType: 'Inbound Lead',
            buyingSignal: `Inbound Gmail message: "${subject}"`,
            icpFitRationale: 'Direct inbound email captured from connected Gmail inbox.',
            painPoints: ['Direct inquiry response'],
            status: 'Question Received',
            cadenceMode: 'one_touch',
            timedIntervalDays: 3,
            autoHandleQuestions: true,
            tailoredSubject: subject.startsWith('Re:') ? subject : `Re: ${subject}`,
            tailoredBody: `Hi ${senderName.split(' ')[0]},\n\nThank you for reaching out regarding "${subject}". `,
            gmailThreadId: detail.threadId,
            followUpSteps: [],
            thread: [
              {
                id: `msg-${item.id}`,
                gmailMessageId: item.id,
                gmailThreadId: detail.threadId,
                sender: 'prospect',
                senderName,
                senderEmail,
                timestamp: `Gmail Inbox · ${nowLabel}`,
                subject,
                body: snippet.slice(0, 2000),
              },
            ],
            createdAt: new Date().toISOString(),
            metrics: {
              sentCount: 0,
              opens: 1,
              clicks: 0,
              replies: 1,
              lastOpenedAt: nowLabel,
              dealValue: 10000,
            },
          };

          store.leads = [newLead, ...store.leads];
          const notif = {
            id: `notif-inbox-${item.id}`,
            leadId: newLeadId,
            leadName: senderName,
            company: companyName,
            role: 'Inbound Contact',
            eventType: 'New ICP Lead',
            summary: `Imported unread Gmail inquiry: "${subject}"`,
            timestamp: nowLabel,
            unread: true,
          };
          store.notifications = [notif, ...store.notifications];
          broadcastEvent('notification', { notification: notif, state: store });
          newLeadsImported++;
        }
      }
    }

    await saveStoreAsync(store);
    res.json({
      newRepliesFound,
      newLeadsImported,
      state: store,
    });
  } catch (error: any) {
    console.error('Error syncing Gmail:', error);
    res.status(500).json({ error: error?.message || 'Failed to sync Gmail inbox.' });
  }
});

// 7. Real 1x1 Open-Tracking Pixel Endpoint
const TRANSPARENT_GIF_BUFFER = Buffer.from(
  'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
  'base64'
);

app.get('/api/track/open/:leadId', async (req, res) => {
  const { leadId } = req.params;
  const store = await loadStoreAsync();
  const idx = store.leads.findIndex((l) => l.id === leadId);
  if (idx !== -1) {
    const lead = store.leads[idx];
    const nowLabel = new Date().toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });
    lead.metrics = {
      ...lead.metrics,
      opens: (lead.metrics?.opens || 0) + 1,
      lastOpenedAt: nowLabel,
    };
    if (lead.activeTemplateId) {
      store.templates = store.templates.map((t) =>
        t.id === lead.activeTemplateId
          ? { ...t, openCount: (t.openCount || 0) + 1 }
          : t
      );
    }
    const notif = {
      id: `notif-open-${Date.now()}`,
      leadId: lead.id,
      leadName: lead.fullName,
      company: lead.company,
      role: lead.role,
      eventType: 'Email Opened',
      summary: `${lead.fullName} opened "${lead.tailoredSubject}" (Open #${lead.metrics.opens})`,
      timestamp: nowLabel,
      unread: true,
    };
    store.notifications = [notif, ...store.notifications];
    store.leads[idx] = lead;
    await saveStoreAsync(store);
    broadcastEvent('notification', { notification: notif, state: store });
  }

  res.setHeader('Content-Type', 'image/gif');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.end(TRANSPARENT_GIF_BUFFER);
});

// 8. Real Webhook Endpoint for Incoming Leads
app.post('/api/webhooks/inbound-lead', async (req, res) => {
  const { fullName, role, company, email, location, message, dealValue } = req.body || {};
  if (!fullName || !email) {
    return res.status(400).json({ error: 'fullName and email are required.' });
  }

  const store = await loadStoreAsync();
  const domain = String(email).split('@')[1] || 'company.com';
  const nowLabel = new Date().toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });
  const activePersona =
    store.personas.find((p) => p.id === store.activePersonaId) || store.personas[0];
  const signOff = activePersona?.linguisticSignature?.signOff || 'Best regards';

  const newLeadId = `lead-wh-${Date.now()}`;
  const leadLocation = location || 'San Francisco, CA';
  const coords = getCityCoordinates(leadLocation);

  const newLead = {
    id: newLeadId,
    fullName,
    role: role || 'Decision Maker',
    company: company || domain.split('.')[0],
    companyDomain: domain,
    email,
    location: leadLocation,
    latitude: coords.latitude,
    longitude: coords.longitude,
    matchScore: 94,
    matchType: 'Inbound Lead',
    buyingSignal: message || 'Submitted inbound product inquiry',
    icpFitRationale: 'Direct inbound lead captured via webhook.',
    painPoints: ['Immediate evaluation'],
    status: message ? 'Question Received' : 'Discovered',
    cadenceMode: 'timed_sequence',
    timedIntervalDays: 3,
    autoHandleQuestions: true,
    tailoredSubject: `${company || 'Team'} × ${store.businessContext.companyName || 'Our Team'}`,
    tailoredBody: `Hi ${String(fullName).split(' ')[0]} — thanks for reaching out.\n\n${
      store.businessContext.valueProposition || ''
    }\n\n${signOff}`,
    followUpSteps: [],
    thread: message
      ? [
          {
            id: `msg-wh-${Date.now()}`,
            sender: 'prospect',
            senderName: fullName,
            senderEmail: email,
            timestamp: `Webhook · ${nowLabel}`,
            subject: 'Inbound Product Inquiry',
            body: message,
          },
        ]
      : [],
    createdAt: new Date().toISOString(),
    metrics: {
      sentCount: 0,
      opens: 0,
      clicks: 0,
      replies: message ? 1 : 0,
      dealValue: Number(dealValue) || 12000,
    },
  };

  const notif = {
    id: `notif-wh-${Date.now()}`,
    leadId: newLeadId,
    leadName: fullName,
    company: newLead.company,
    role: newLead.role,
    eventType: 'New ICP Lead',
    summary: message
      ? `Inbound lead inquiry: "${message}"`
      : `New inbound lead captured (${email})`,
    timestamp: nowLabel,
    unread: true,
  };

  store.leads = [newLead, ...store.leads];
  store.notifications = [notif, ...store.notifications];
  await saveStoreAsync(store);
  broadcastEvent('notification', { notification: notif, state: store });

  res.json({ lead: newLead, state: store });
});

// 9. Real Invoice Checkout Settlement Endpoint
// Never mark an invoice paid based on an unverified browser request.
// A real payment processor checkout and signed webhook must be configured first.
app.post('/api/invoices/:id/pay', (_req, res) => {
  res.status(501).json({
    error: 'Payment processing is not configured. This action cannot settle an invoice.',
  });
});

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
