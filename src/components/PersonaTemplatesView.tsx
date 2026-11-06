import { apiFetch } from '../services/apiFetch';
import React, { useRef, useState } from 'react';
import {
  Check,
  Copy,
  FileText,
  Loader2,
  Plus,
  RefreshCw,
  Send,
  Trash2,
  Upload,
} from 'lucide-react';
import { BusinessContext, EmailTemplate, PersonaProfile } from '../types';
import {
  AETHERIS_BUSINESS_PRESET,
  MINDPRINT_BUSINESS_PRESET,
} from './IcpStrategyModal';

interface PersonaTemplatesViewProps {
  personas: PersonaProfile[];
  activePersonaId: string;
  onSelectPersona: (id: string) => void;
  onSynthesizedState: (state: any) => void;
  templates: EmailTemplate[];
  onUpdateTemplate: (updated: EmailTemplate) => void;
  onDeleteTemplate: (id: string) => void;
  onAddBlankTemplate: (tpl: EmailTemplate) => void;
  onApplyTemplateToLead: (template: EmailTemplate) => void;
  businessContext: BusinessContext;
  onUpdateBusinessContext: (ctx: BusinessContext) => void;
}

const ARCHETYPE_PRESETS = [
  'INTJ · Direct Technical Founder (Zero Fluff, Evidence-First)',
  'ENTJ · Executive Challenger (ROI & Benchmark Driven)',
  'ENFJ · Consultative Partner (Warm, Collaborative, Strategic)',
  'ISTP · Pragmatic Field Engineer (Spec-Heavy, Concise)',
  'Custom Uploaded Personal Type',
];

export const PersonaTemplatesView: React.FC<PersonaTemplatesViewProps> = ({
  personas,
  activePersonaId,
  onSelectPersona,
  onSynthesizedState,
  templates,
  onUpdateTemplate,
  onDeleteTemplate,
  onAddBlankTemplate,
  onApplyTemplateToLead,
  businessContext,
  onUpdateBusinessContext,
}) => {
  const activePersona = personas.find((p) => p.id === activePersonaId) || personas[0] || null;

  const [personaName, setPersonaName] = useState(activePersona?.name || '');
  const [archetype, setArchetype] = useState(
    activePersona?.archetype || ARCHETYPE_PRESETS[0]
  );
  const [rawSample, setRawSample] = useState(activePersona?.rawSample || '');
  const [sourceFileName, setSourceFileName] = useState(
    activePersona?.sourceFileName || ''
  );
  const [isSynthesizing, setIsSynthesizing] = useState(false);
  const [isParsingDocument, setIsParsingDocument] = useState(false);
  const [uploadSuccessFeedback, setUploadSuccessFeedback] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handlePersonaSwitch = (id: string) => {
    onSelectPersona(id);
    const found = personas.find((p) => p.id === id);
    if (found) {
      setPersonaName(found.name);
      setArchetype(found.archetype);
      setRawSample(found.rawSample);
      setSourceFileName(found.sourceFileName);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSourceFileName(file.name);
    setErrorMessage(null);
    setUploadSuccessFeedback(null);
    if (!personaName.trim()) {
      setPersonaName(file.name.replace(/\.[^/.]+$/, '').replace(/[_-]/g, ' '));
    }

    const ext = file.name.toLowerCase().split('.').pop() || '';
    setIsParsingDocument(true);

    try {
      if (['pdf', 'docx', 'doc', 'csv'].includes(ext)) {
        // Read binary/base64 and parse on server using mammoth / PDFParse / csv parser
        const reader = new FileReader();
        reader.onload = async () => {
          try {
            const dataUrl = String(reader.result || '');
            const base64 = dataUrl.split(',')[1] || '';
            const res = await apiFetch('/api/upload/parse-document', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                filename: file.name,
                base64,
                mimeType: file.type,
              }),
            });
            const data = await res.json();
            if (!res.ok) {
              throw new Error(data.error || 'Failed to parse document');
            }
            if (data.extractedText) {
              setRawSample(data.extractedText);
              setUploadSuccessFeedback(
                `Extracted ${data.charCount.toLocaleString()} chars from ${file.name} (${data.fileType?.toUpperCase()}).`
              );
              setTimeout(() => setUploadSuccessFeedback(null), 5000);
            }
          } catch (err: any) {
            setErrorMessage(err?.message || 'Error parsing document.');
          } finally {
            setIsParsingDocument(false);
          }
        };
        reader.readAsDataURL(file);
      } else {
        // Plain text, md, json, eml
        const reader = new FileReader();
        reader.onload = (event) => {
          const content = String(event.target?.result || '');
          if (content.trim()) {
            setRawSample(content);
            setUploadSuccessFeedback(`Loaded ${file.name}`);
            setTimeout(() => setUploadSuccessFeedback(null), 4000);
          }
          setIsParsingDocument(false);
        };
        reader.readAsText(file);
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to process file.');
      setIsParsingDocument(false);
    }
  };

  const handleSynthesizeTemplates = async () => {
    if (!rawSample.trim()) {
      setErrorMessage(
        'Upload a personal writing file (.txt, .md, .eml, .json) or paste a sample of your writing style first.'
      );
      return;
    }
    setIsSynthesizing(true);
    setErrorMessage(null);
    try {
      const response = await apiFetch('/api/persona/extract-templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          personaName: personaName.trim() || 'Primary Operator Voice',
          archetype,
          rawSample,
          sourceFileName: sourceFileName || 'uploaded_sample.txt',
          businessContext,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to generate templates.');
      }

      if (data.state) {
        onSynthesizedState(data.state);
      }
      if (data.persona) {
        setPersonaName(data.persona.name);
        setArchetype(data.persona.archetype);
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Error generating custom templates.');
    } finally {
      setIsSynthesizing(false);
    }
  };

  const handleCopy = (tpl: EmailTemplate) => {
    navigator.clipboard.writeText(`Subject: ${tpl.subjectLine}\n\n${tpl.body}`);
    setCopiedId(tpl.id);
    setTimeout(() => setCopiedId(null), 1800);
  };

  const categories = [
    'All',
    'Cold Outbound',
    'Executive Intro',
    'Sales Q&A Response',
    'Timed Follow-Up',
    'Invoice & Closing',
  ];

  const filteredTemplates = templates.filter((t) =>
    selectedCategory === 'All' ? true : t.category === selectedCategory
  );

  return (
    <div className="space-y-8">
      {/* Top Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
        <div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">
            Voice Calibration · Linguistic Extraction · Custom Outbound Templates
          </p>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
            Personal Type & Template Studio
          </h1>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            disabled={isParsingDocument}
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-slate-900 dark:bg-blue-600 rounded-lg hover:bg-slate-800 dark:hover:bg-blue-500 disabled:opacity-60 transition-colors whitespace-nowrap shrink-0"
          >
            {isParsingDocument ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Parsing File...
              </>
            ) : (
              <>
                <Upload className="w-3.5 h-3.5" />
                Upload File (PDF, Word, CSV, Text)
              </>
            )}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.docx,.doc,.csv,.txt,.md,.json,.eml"
            onChange={handleFileUpload}
            className="hidden"
          />
        </div>
      </div>

      {uploadSuccessFeedback && (
        <div className="p-3 text-xs font-medium text-emerald-800 dark:text-emerald-200 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 rounded-lg flex items-center justify-between">
          <span>✓ {uploadSuccessFeedback}</span>
          <button
            type="button"
            onClick={() => setUploadSuccessFeedback(null)}
            className="text-emerald-600 hover:text-emerald-900 dark:hover:text-emerald-100"
          >
            ✕
          </button>
        </div>
      )}

      {/* Business & Product Intelligence Profile (Persisted on change) */}
      <section className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
              Strategic Business &amp; Product Profile
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Grounded in the Aetheris Technology &amp; Mindprint GTM framework for web discovery, template calibration, and sales Q&amp;A.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onUpdateBusinessContext(AETHERIS_BUSINESS_PRESET)}
              className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-blue-50 dark:bg-blue-950/70 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 hover:bg-blue-100 transition-colors"
            >
              Load Aetheris Diagnostics
            </button>
            <button
              type="button"
              onClick={() => onUpdateBusinessContext(MINDPRINT_BUSINESS_PRESET)}
              className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-purple-50 dark:bg-purple-950/70 border border-purple-200 dark:border-purple-800 text-purple-700 dark:text-purple-300 hover:bg-purple-100 transition-colors"
            >
              Load Mindprint Intelligence
            </button>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              Company Name
            </label>
            <input
              type="text"
              value={businessContext.companyName}
              onChange={(e) =>
                onUpdateBusinessContext({ ...businessContext, companyName: e.target.value })
              }
              placeholder="e.g., Military Grade Insulation"
              className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-lg focus:outline-none focus:border-slate-900 dark:focus:border-slate-400"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              Product / Solution Name
            </label>
            <input
              type="text"
              value={businessContext.productName}
              onChange={(e) =>
                onUpdateBusinessContext({ ...businessContext, productName: e.target.value })
              }
              placeholder="e.g., Thermal Cladding & Acoustic Systems"
              className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-lg focus:outline-none focus:border-slate-900 dark:focus:border-slate-400"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              Ideal Buyer Roles
            </label>
            <input
              type="text"
              value={businessContext.idealBuyerRoles}
              onChange={(e) =>
                onUpdateBusinessContext({ ...businessContext, idealBuyerRoles: e.target.value })
              }
              placeholder="e.g., VP of Facilities, Director of Operations"
              className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-lg focus:outline-none focus:border-slate-900 dark:focus:border-slate-400"
            />
          </div>
          <div className="md:col-span-2">
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              Core Value Proposition & Measurable Outcome
            </label>
            <input
              type="text"
              value={businessContext.valueProposition}
              onChange={(e) =>
                onUpdateBusinessContext({ ...businessContext, valueProposition: e.target.value })
              }
              placeholder="e.g., Reduces industrial HVAC & pipe thermal loss by 35% with zero-downtime installation"
              className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-lg focus:outline-none focus:border-slate-900 dark:focus:border-slate-400"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              Pricing & Offer Summary
            </label>
            <input
              type="text"
              value={businessContext.pricingSummary}
              onChange={(e) =>
                onUpdateBusinessContext({ ...businessContext, pricingSummary: e.target.value })
              }
              placeholder="e.g., $2,500 Pilot Audit · Custom Facility Retrofit"
              className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-lg focus:outline-none focus:border-slate-900 dark:focus:border-slate-400"
            />
          </div>
        </div>
      </section>

      {/* Main 2-Column Split: Left = Persona Upload & Calibration | Right = Custom Templates */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Personal Type Upload & Linguistic Extraction (5 cols) */}
        <div className="lg:col-span-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-5">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
            <div>
              <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                01. Personal Type & Voice Input
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Upload a writing sample or personal type description to generate custom templates
              </p>
            </div>
            <span className="text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums">
              {personas.length} saved
            </span>
          </div>

          {personas.length > 0 && (
            <div className="flex flex-wrap gap-1.5 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
              {personas.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => handlePersonaSwitch(p.id)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors truncate max-w-[210px] ${
                    p.id === activePersonaId
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {p.name}
                </button>
              ))}
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Voice Profile Name
              </label>
              <input
                type="text"
                value={personaName}
                onChange={(e) => setPersonaName(e.target.value)}
                placeholder="e.g., Joseph — Direct Founder Voice"
                className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-lg focus:outline-none focus:border-slate-900 dark:focus:border-slate-400"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Personal Type / Communication Archetype
              </label>
              <select
                value={
                  ARCHETYPE_PRESETS.includes(archetype)
                    ? archetype
                    : 'Custom Uploaded Personal Type'
                }
                onChange={(e) => setArchetype(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-lg focus:outline-none focus:border-slate-900 dark:focus:border-slate-400"
              >
                {ARCHETYPE_PRESETS.map((preset) => (
                  <option key={preset} value={preset}>
                    {preset}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                  Uploaded Writing Sample / Personal Style Notes
                </label>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex items-center gap-1 text-xs font-medium text-blue-700 dark:text-blue-400 hover:underline"
                >
                  <FileText className="w-3 h-3" />
                  {sourceFileName || 'Choose file (PDF, Word, CSV, text)'}
                </button>
              </div>
              <textarea
                rows={7}
                value={rawSample}
                onChange={(e) => setRawSample(e.target.value)}
                placeholder="Upload a file or paste 1–2 real emails you have sent, or describe your personal type (e.g., concise, analytical, zero fluff, always leads with ROI numbers and signs off with '— Joseph')..."
                className="w-full p-3 text-sm bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-lg focus:outline-none focus:border-slate-900 dark:focus:border-slate-400 font-sans leading-relaxed"
              />
            </div>

            {errorMessage && (
              <p className="text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-lg px-3 py-2">
                {errorMessage}
              </p>
            )}

            <button
              type="button"
              onClick={handleSynthesizeTemplates}
              disabled={isSynthesizing}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-60 rounded-lg transition-colors whitespace-nowrap"
            >
              {isSynthesizing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Synthesizing Custom Templates...
                </>
              ) : (
                <>
                  <RefreshCw className="w-3.5 h-3.5" />
                  Generate Custom Templates from Personal Type
                </>
              )}
            </button>
          </div>

          {activePersona && (
            <div className="pt-4 border-t border-slate-200 dark:border-slate-800 space-y-2.5">
              <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                <span className="font-semibold text-slate-800 dark:text-slate-200">Extracted Linguistic DNA</span>
                <span>{activePersona.updatedAt}</span>
              </div>
              <div className="space-y-1.5 text-xs text-slate-600 dark:text-slate-300">
                <p>
                  <span className="font-medium text-slate-900 dark:text-white">Cadence:</span>{' '}
                  {activePersona.linguisticSignature.cadence}
                </p>
                <p>
                  <span className="font-medium text-slate-900 dark:text-white">Opening Hook:</span>{' '}
                  {activePersona.linguisticSignature.openingStyle}
                </p>
                <p>
                  <span className="font-medium text-slate-900 dark:text-white">Sign-Off:</span>{' '}
                  <span className="font-mono">{activePersona.linguisticSignature.signOff}</span>
                </p>
                <p className="text-slate-500 dark:text-slate-400 pt-1">
                  {(activePersona.linguisticSignature.vocabularyTraits || []).join(' · ')}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Generated Outgoing Communication Templates (7 cols) */}
        <div className="lg:col-span-7 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                02. Custom Outgoing Communication Templates
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {activePersona
                  ? `Tailored to ${activePersona.name}`
                  : 'Generate templates from your personal type or create a custom template below'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                const newTpl: EmailTemplate = {
                  id: `tpl-${Date.now()}`,
                  title: 'Custom Outbound Template',
                  category: 'Cold Outbound',
                  subjectLine: '{{company}} / inquiry',
                  body: `Hi {{firstName}},\n\nNoticed {{buyingSignal}} at {{company}}.\n\n${
                    businessContext.valueProposition || ''
                  }\n\n${activePersona?.linguisticSignature?.signOff || 'Best regards'}`,
                  personaId: activePersona?.id || 'manual',
                  sentCount: 0,
                  openCount: 0,
                  replyCount: 0,
                };
                onAddBlankTemplate(newTpl);
                setEditingTemplateId(newTpl.id);
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors whitespace-nowrap shrink-0 self-start"
            >
              <Plus className="w-3.5 h-3.5" />
              New Blank Template
            </button>
          </div>

          <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg overflow-x-auto">
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                  selectedCategory === cat
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {filteredTemplates.length === 0 ? (
            <div className="p-10 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-center space-y-3">
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                No communication templates in this category yet
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
                Upload a writing sample or enter your personal communication style on the left and click &ldquo;Generate Custom Templates from Personal Type&rdquo;.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredTemplates.map((tpl) => {
                const isEditing = editingTemplateId === tpl.id;
                const openRate =
                  tpl.sentCount > 0
                    ? ((tpl.openCount / tpl.sentCount) * 100).toFixed(1)
                    : '0.0';
                const replyRate =
                  tpl.sentCount > 0
                    ? ((tpl.replyCount / tpl.sentCount) * 100).toFixed(1)
                    : '0.0';

                return (
                  <article
                    key={tpl.id}
                    className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl space-y-3 hover:border-slate-300 dark:hover:border-slate-700 transition-colors"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
                      <div>
                        <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mb-0.5">
                          <span className="font-medium text-blue-700 dark:text-blue-400">{tpl.category}</span>
                          <span aria-hidden="true">·</span>
                          <span className="font-mono tabular-nums">
                            {tpl.sentCount} sent
                          </span>
                          <span aria-hidden="true">·</span>
                          <span className="font-mono tabular-nums">
                            {openRate}% open ({tpl.openCount})
                          </span>
                          <span aria-hidden="true">·</span>
                          <span className="font-mono tabular-nums">
                            {replyRate}% reply ({tpl.replyCount})
                          </span>
                        </div>
                        {isEditing ? (
                          <input
                            type="text"
                            value={tpl.title}
                            onChange={(e) =>
                              onUpdateTemplate({ ...tpl, title: e.target.value })
                            }
                            className="text-sm font-semibold text-slate-900 dark:text-white bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded px-2 py-1"
                          />
                        ) : (
                          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                            {tpl.title}
                          </h3>
                        )}
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() =>
                            setEditingTemplateId(isEditing ? null : tpl.id)
                          }
                          className="px-2.5 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-md transition-colors whitespace-nowrap"
                        >
                          {isEditing ? 'Save' : 'Edit'}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleCopy(tpl)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-md transition-colors whitespace-nowrap"
                        >
                          {copiedId === tpl.id ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                              Copied
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5" />
                              Copy
                            </>
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => onDeleteTemplate(tpl.id)}
                          aria-label="Delete template"
                          className="p-1.5 text-slate-400 hover:text-red-600 dark:hover:text-red-400 rounded-md transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onApplyTemplateToLead(tpl)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 dark:bg-blue-600 dark:hover:bg-blue-500 rounded-md transition-colors whitespace-nowrap"
                        >
                          <Send className="w-3 h-3" />
                          Use in Outbound
                        </button>
                      </div>
                    </div>

                    {isEditing ? (
                      <div className="space-y-3">
                        <div>
                          <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                            Subject Line
                          </label>
                          <input
                            type="text"
                            value={tpl.subjectLine}
                            onChange={(e) =>
                              onUpdateTemplate({ ...tpl, subjectLine: e.target.value })
                            }
                            className="w-full px-3 py-1.5 text-xs font-mono bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-md"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                            Body Copy
                          </label>
                          <textarea
                            rows={6}
                            value={tpl.body}
                            onChange={(e) =>
                              onUpdateTemplate({ ...tpl, body: e.target.value })
                            }
                            className="w-full p-3 text-xs leading-relaxed bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-md"
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <p className="text-xs font-mono text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/60 px-3 py-1.5 rounded border border-slate-100 dark:border-slate-800">
                          <span className="text-slate-400 select-none">Subject: </span>
                          {tpl.subjectLine}
                        </p>
                        <p className="text-xs text-slate-700 dark:text-slate-300 whitespace-pre-line leading-relaxed px-1">
                          {tpl.body}
                        </p>
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
