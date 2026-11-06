import React, { useState } from 'react';
import {
  APIProvider,
  Map,
  AdvancedMarker,
  Pin,
  InfoWindow,
} from '@vis.gl/react-google-maps';
import {
  Building2,
  ExternalLink,
  MapPin,
  Send,
  Sparkles,
  User,
} from 'lucide-react';
import { Lead } from '../types';

interface LeadLocationsMapProps {
  leads: Lead[];
  selectedLeadId: string;
  onSelectLead: (leadId: string) => void;
  onDraftOutbound?: (lead: Lead) => void;
}

export const LeadLocationsMap: React.FC<LeadLocationsMapProps> = ({
  leads,
  selectedLeadId,
  onSelectLead,
  onDraftOutbound,
}) => {
  const [activeMarkerLead, setActiveMarkerLead] = useState<Lead | null>(null);
  const [mapType, setMapType] = useState<'roadmap' | 'satellite' | 'hybrid'>('roadmap');

  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';

  // Filter leads with valid coordinates
  const geocodedLeads = leads.filter(
    (l) => typeof l.latitude === 'number' && typeof l.longitude === 'number'
  );

  const selectedLead = leads.find((l) => l.id === selectedLeadId);

  // Compute map center (either active lead or US center)
  const mapCenter =
    selectedLead && typeof selectedLead.latitude === 'number' && typeof selectedLead.longitude === 'number'
      ? { lat: selectedLead.latitude, lng: selectedLead.longitude }
      : geocodedLeads[0] && typeof geocodedLeads[0].latitude === 'number' && typeof geocodedLeads[0].longitude === 'number'
      ? { lat: geocodedLeads[0].latitude, lng: geocodedLeads[0].longitude }
      : { lat: 39.8283, lng: -98.5795 };

  if (!apiKey) {
    return (
      <div className="h-72 w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 flex flex-col items-center justify-center p-6 text-center">
        <MapPin className="w-8 h-8 text-slate-400 dark:text-slate-500 mb-2" />
        <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">
          Google Maps Territory View
        </h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-md">
          Google Maps API Key is being initialized. Territory markers will appear automatically once credentials load.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-sm flex flex-col">
      {/* Territory Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-b border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/90 text-xs">
        <div className="flex items-center gap-2">
          <MapPin className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
          <span className="font-semibold text-slate-900 dark:text-slate-100">
            Account Territory Map
          </span>
          <span className="text-slate-500 dark:text-slate-400">
            ({geocodedLeads.length} geocoded prospect{geocodedLeads.length !== 1 ? 's' : ''})
          </span>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[11px] text-slate-500 dark:text-slate-400 hidden sm:inline">
            Status:
          </span>
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-medium bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            Converted
          </span>
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-medium bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
            Inbound/Question
          </span>
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-medium bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-400">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
            Discovered
          </span>
        </div>
      </div>

      {/* Google Map Container with explicit CSS height */}
      <div className="h-[360px] md:h-[400px] w-full relative">
        <APIProvider apiKey={apiKey} libraries={['marker']}>
          <Map
            mapId="DEMO_MAP_ID"
            defaultCenter={mapCenter}
            defaultZoom={geocodedLeads.length > 0 ? 4 : 3}
            mapTypeId={mapType}
            gestureHandling="greedy"
            disableDefaultUI={false}
            internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
            style={{ width: '100%', height: '100%' }}
          >
            {geocodedLeads.map((lead) => {
              const isSelected = lead.id === selectedLeadId;
              const isConverted = lead.status === 'Converted';
              const isQuestion = lead.status === 'Question Received';

              const pinBg = isConverted
                ? '#10b981'
                : isQuestion
                ? '#f59e0b'
                : isSelected
                ? '#2563eb'
                : '#3b82f6';

              return (
                <AdvancedMarker
                  key={lead.id}
                  position={{ lat: lead.latitude!, lng: lead.longitude! }}
                  title={`${lead.company} (${lead.fullName})`}
                  onClick={() => {
                    onSelectLead(lead.id);
                    setActiveMarkerLead(lead);
                  }}
                >
                  <Pin
                    background={pinBg}
                    borderColor="#ffffff"
                    glyphColor="#ffffff"
                    scale={isSelected ? 1.25 : 1.0}
                  />
                </AdvancedMarker>
              );
            })}

            {activeMarkerLead &&
              typeof activeMarkerLead.latitude === 'number' &&
              typeof activeMarkerLead.longitude === 'number' && (
                <InfoWindow
                  position={{
                    lat: activeMarkerLead.latitude,
                    lng: activeMarkerLead.longitude,
                  }}
                  onCloseClick={() => setActiveMarkerLead(null)}
                  maxWidth={320}
                >
                  <div className="p-1 space-y-2 text-slate-900 font-sans">
                    <div className="flex items-start justify-between gap-2 border-b border-slate-100 pb-1.5">
                      <div>
                        <div className="flex items-center gap-1.5">
                          <Building2 className="w-3.5 h-3.5 text-blue-600" />
                          <h4 className="font-bold text-xs text-slate-900">
                            {activeMarkerLead.company}
                          </h4>
                        </div>
                        <p className="text-[11px] text-slate-500">
                          {activeMarkerLead.location}
                        </p>
                      </div>
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-blue-50 text-blue-700">
                        {activeMarkerLead.matchScore}% Match
                      </span>
                    </div>

                    <div className="text-[11px] space-y-1">
                      <div className="flex items-center gap-1.5 text-slate-700">
                        <User className="w-3 h-3 text-slate-400" />
                        <span className="font-medium">{activeMarkerLead.fullName}</span>
                        <span className="text-slate-500">· {activeMarkerLead.role}</span>
                      </div>
                      <p className="text-slate-600 line-clamp-2 italic text-[10px]">
                        "{activeMarkerLead.buyingSignal}"
                      </p>
                      <div className="flex items-center justify-between text-[11px] pt-1">
                        <span className="font-semibold text-slate-900">
                          Est. Value: ${activeMarkerLead.metrics?.dealValue?.toLocaleString() || '10,000'}
                        </span>
                        <span className="text-slate-500 text-[10px]">
                          {activeMarkerLead.status}
                        </span>
                      </div>
                    </div>

                    <div className="pt-1.5 flex items-center gap-1.5 border-t border-slate-100">
                      <button
                        type="button"
                        onClick={() => {
                          onSelectLead(activeMarkerLead.id);
                          if (onDraftOutbound) {
                            onDraftOutbound(activeMarkerLead);
                          }
                          setActiveMarkerLead(null);
                        }}
                        className="flex-1 py-1 px-2 text-[10px] font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded transition-colors text-center"
                      >
                        Select & Draft Outbound
                      </button>
                    </div>
                  </div>
                </InfoWindow>
              )}
          </Map>
        </APIProvider>
      </div>

      {/* Territory footer summary */}
      <div className="px-4 py-2 bg-slate-50 dark:bg-slate-900/60 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
        <span className="truncate">
          Click any pin on the territory map to inspect the company, location, and verified buying signal.
        </span>
        <button
          type="button"
          onClick={() => setMapType(mapType === 'roadmap' ? 'hybrid' : 'roadmap')}
          className="text-blue-600 dark:text-blue-400 hover:underline shrink-0 ml-2"
        >
          Switch to {mapType === 'roadmap' ? 'Satellite' : 'Roadmap'}
        </button>
      </div>
    </div>
  );
};
