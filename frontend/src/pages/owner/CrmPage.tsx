import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { PageHeader } from '@/components/ui/PageHeader';
import { Icon } from '@/components/ui/Icon';
import { Skeleton } from '@/components/ui/Skeleton';
import { apiClient } from '@/services/apiClient';
import { cn } from '@/utils/cn';
import { EnrollmentModal } from '@/components/EnrollmentModal';

// Types
interface CrmCallLog {
  id: string;
  contact_name: string;
  contact_type: string;
  phone: string;
  status: string;
  duration_formatted: string;
  duration_seconds: number;
  sentiment: string;
  qualification_score: number;
  ai_summary: string;
  action_items: string[];
  transcript?: string;
  created_at: string;
}

interface CrmTicket {
  id: string;
  customer_name?: string;
  subject: string;
  category: string;
  priority: string;
  status: string;
  description: string;
  assigned_to?: string;
  created_at: string;
}

interface CrmLeadItem {
  id: string;
  name: string;
  phone: string;
  email?: string;
  source: string;
  interest: string;
  assignedTrainer: string;
  status: string;
  stage: string;
  probability: number;
  deal_value: number;
  notes?: string;
  lastFollowUp?: string;
  created_at?: string;
}

interface CrmAdItem {
  id: string;
  headline: string;
  prompt: string;
  aspect_ratio: string;
  model_used: string;
  image_url?: string;
  caption?: string;
  status: string;
  created_at: string;
}

interface CustomerRecord {
  id: string;
  full_name?: string;
  name?: string;
  email?: string;
  phone?: string;
  status?: string;
  membership?: string;
  goal?: string;
  fitness_level?: string;
  training_preference?: string;
  attendance?: number;
  joinDate?: string;
  created_at?: string;
  revenue?: string;
  branch?: string;
  gender?: string;
  age?: number | string;
  lastVisit?: string;
  expiry?: string;
  biometric_synced?: boolean;
  biometric_status?: string;
  kyc_status?: string;
  kyc_percent?: number;
}

// Top-Level CRM Categories
type CrmCategory =
  | 'Customer Management'
  | 'Marketing & Sales'
  | 'Customer Service'
  | 'Communication'
  | 'Customer Intelligence';

export function CrmPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const urlTab = searchParams.get('tab') || 'ai_call_logs';

  // State
  const [activeCategory, setActiveCategory] = useState<CrmCategory>('Communication');
  const [activeSubTab, setActiveSubTab] = useState<string>(urlTab);

  // Data States
  const [customers, setCustomers] = useState<CustomerRecord[]>([]);
  const [callLogs, setCallLogs] = useState<CrmCallLog[]>([]);
  const [tickets, setTickets] = useState<CrmTicket[]>([]);
  const [leads, setLeads] = useState<CrmLeadItem[]>([]);
  const [ads, setAds] = useState<CrmAdItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [customerFilterStatus, setCustomerFilterStatus] = useState('All');
  const [onboardingBiometricFilter, setOnboardingBiometricFilter] = useState<'All' | 'Completed' | 'Pending'>('All');
  const [filterContactType, setFilterContactType] = useState('All Contact Types');
  const [filterStatus, setFilterStatus] = useState('All Statuses');
  const [filterSentiment, setFilterSentiment] = useState('All Sentiments');
  const [ticketFilterStatus, setTicketFilterStatus] = useState('All');
  const [ticketFilterCategory, setTicketFilterCategory] = useState('All Categories');

  // Modals
  const [newCallModalOpen, setNewCallModalOpen] = useState(false);
  const [callingState, setCallingState] = useState<'idle' | 'dialing' | 'connected' | 'completed'>('idle');
  const [callForm, setCallForm] = useState({ contact_name: '', phone: '', objective: 'Membership Consultation & Trial Pass' });
  const [transcriptModalOpen, setTranscriptModalOpen] = useState(false);
  const [selectedCallLog, setSelectedCallLog] = useState<CrmCallLog | null>(null);

  const [newTicketModalOpen, setNewTicketModalOpen] = useState(false);
  const [ticketForm, setTicketForm] = useState({
    customer_name: '',
    subject: '',
    category: 'General Support',
    priority: 'Medium',
    description: '',
  });

  const [newLeadModalOpen, setNewLeadModalOpen] = useState(false);
  const [leadForm, setLeadForm] = useState({
    name: '',
    phone: '',
    email: '',
    source: 'Instagram Ad',
    interest: 'Weight Loss & Transformation',
    deal_value: 18000,
    notes: '',
  });

  // Biometric Enrollment Modal State
  const [enrollModalOpen, setEnrollModalOpen] = useState(false);
  const [selectedEnrollMember, setSelectedEnrollMember] = useState<CustomerRecord | null>(null);
  const [enrollForm, setEnrollForm] = useState({
    verificationType: 'FACE_SCAN' as 'FACE_SCAN' | 'FINGERPRINT' | 'RFID_CARD' | 'INBODY',
    device_name: 'Main Turnstile eSSL SilkBio-101',
    card_number: '',
    weight: '',
    height: '',
    notes: '',
  });
  const [enrollingState, setEnrollingState] = useState<'idle' | 'scanning' | 'success'>('idle');

  // Broadcast Campaign State (for Email, SMS, WhatsApp, Push)
  const [broadcastForm, setBroadcastForm] = useState({
    targetAudience: 'All Active Members',
    subject: 'Special FitClub AI Weekend Transformation Camp!',
    message: 'Hey {member_name}! Crush your weekly fitness targets with our complimentary weekend HIIT session. Reserve your spot on the app now!',
  });
  const [sendingBroadcast, setSendingBroadcast] = useState(false);

  // Marketing Ad Generator State
  const [adPrompt, setAdPrompt] = useState('create a fitness transformation ad for FitClub AI, high-tech neon gym aesthetic, athletic client working with biometric coach');
  const [adAspectRatio, setAdAspectRatio] = useState('1:1 (Post Square)');
  const [adModel, setAdModel] = useState<'Gemini Imagen' | 'DALL-E 3' | 'Claude'>('Gemini Imagen');
  const [generatingAd, setGeneratingAd] = useState(false);
  const [generatedAd, setGeneratedAd] = useState<CrmAdItem | null>(null);

  // Sync sub-tab to URL & category
  useEffect(() => {
    if (urlTab) {
      setActiveSubTab(urlTab);
      if (['ai_call_logs', 'email_campaigns', 'sms_campaigns', 'whatsapp_campaigns', 'push_notifications'].includes(urlTab)) {
        setActiveCategory('Communication');
      } else if (['ad_generator', 'social_dashboard', 'ad_history', 'leads', 'opportunities', 'deals', 'pipeline', 'quotations', 'sales_orders', 'discounts'].includes(urlTab)) {
        setActiveCategory('Marketing & Sales');
      } else if (['support_tickets', 'complaints', 'returns', 'feedback', 'timeline'].includes(urlTab)) {
        setActiveCategory('Customer Service');
      } else if (['customer_list', 'onboarding'].includes(urlTab)) {
        setActiveCategory('Customer Management');
      } else if (['churn_predictor', 'lead_scoring', 'sentiment_analysis', 'ltv_forecast'].includes(urlTab)) {
        setActiveCategory('Customer Intelligence');
      }
    }
  }, [urlTab]);

  const switchSubTab = (tab: string, cat?: CrmCategory) => {
    setActiveSubTab(tab);
    if (cat) setActiveCategory(cat);
    setSearchParams({ tab });
  };

  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Fetch CRM Data from Database
  const fetchData = async () => {
    setLoading(true);
    try {
      const [callsRes, ticketsRes, leadsRes, adsRes] = await Promise.all([
        apiClient.get<CrmCallLog[]>('/crm/calls').catch(() => []),
        apiClient.get<CrmTicket[]>('/crm/tickets').catch(() => []),
        apiClient.get<CrmLeadItem[]>('/crm/leads').catch(() => []),
        apiClient.get<CrmAdItem[]>('/crm/ads').catch(() => []),
      ]);

      let customersList: CustomerRecord[] = [];
      try {
        const cRes = await apiClient.get<CustomerRecord[]>('/customers');
        if (Array.isArray(cRes) && cRes.length > 0) {
          customersList = cRes;
        } else {
          const mRes = await apiClient.get<CustomerRecord[]>('/members');
          if (Array.isArray(mRes)) customersList = mRes;
        }
      } catch (_cErr) {
        try {
          const mRes = await apiClient.get<CustomerRecord[]>('/members');
          if (Array.isArray(mRes)) customersList = mRes;
        } catch (_mErr) {
          customersList = [];
        }
      }

      setCallLogs(callsRes || []);
      setTickets(ticketsRes || []);
      setLeads(leadsRes || []);
      setAds(adsRes || []);
      setCustomers(customersList || []);
      if (adsRes && adsRes.length > 0) {
        setGeneratedAd(adsRes[0]);
      }
    } catch (_err) {
      /* ignore */
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Handlers for AI Call
  const handleStartCall = async () => {
    if (!callForm.phone || !callForm.contact_name) {
      triggerToast('Please provide contact name and phone number');
      return;
    }
    setCallingState('dialing');
    setTimeout(() => setCallingState('connected'), 1200);

    try {
      await apiClient.post<any>('/crm/calls/trigger', callForm);
      setTimeout(() => {
        setCallingState('completed');
        setTimeout(() => {
          setNewCallModalOpen(false);
          setCallingState('idle');
          fetchData();
          triggerToast('🎉 AI Voice consultation call logged successfully!');
        }, 1000);
      }, 2500);
    } catch (_err) {
      setCallingState('idle');
      triggerToast('Failed to connect AI Voice Agent call');
    }
  };

  // Handlers for Support Tickets
  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ticketForm.subject || !ticketForm.description) {
      triggerToast('Subject and description are required');
      return;
    }
    try {
      await apiClient.post('/crm/tickets', ticketForm);
      setNewTicketModalOpen(false);
      setTicketForm({ customer_name: '', subject: '', category: 'General Support', priority: 'Medium', description: '' });
      fetchData();
      triggerToast('✅ Support ticket created successfully!');
    } catch (_err) {
      triggerToast('Failed to create ticket');
    }
  };

  // Handlers for Leads
  const handleCreateLead = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!leadForm.name || !leadForm.phone) {
      triggerToast('Name and phone are required');
      return;
    }
    try {
      await apiClient.post('/crm/leads', leadForm);
      setNewLeadModalOpen(false);
      setLeadForm({ name: '', phone: '', email: '', source: 'Instagram Ad', interest: 'Weight Loss & Transformation', deal_value: 18000, notes: '' });
      fetchData();
      triggerToast('✅ New lead added to CRM pipeline!');
    } catch (_err) {
      triggerToast('Failed to add lead');
    }
  };

  const handleUpdateLeadStatus = async (leadId: string, nextStatus: string) => {
    try {
      await apiClient.patch(`/crm/leads/${leadId}`, { status: nextStatus });
      setLeads((prev) => prev.map((l) => (l.id === leadId ? { ...l, status: nextStatus } : l)));
      triggerToast(`Lead moved to ${nextStatus.toUpperCase()}`);
    } catch (_err) {
      triggerToast('Failed to update status');
    }
  };

  // Handler for Syncing Customer Biometrics in Real Time
  const handleSyncBiometric = async (customerId: string, displayName: string) => {
    try {
      const updated = await apiClient.post<CustomerRecord>(`/customers/${customerId}/sync-biometric`, {});
      setCustomers((prev) => prev.map((c) => (c.id === customerId ? { ...c, ...updated } : c)));
      triggerToast(`✅ Biometric telemetry synced for ${displayName}!`);
    } catch (_err) {
      triggerToast(`Failed to sync biometric device for ${displayName}`);
    }
  };

  const handleOpenEnrollModal = (member: CustomerRecord) => {
    setSelectedEnrollMember(member);
    setEnrollForm({
      verificationType: 'FACE_SCAN',
      device_name: 'Main Turnstile eSSL SilkBio-101',
      card_number: member.phone ? `RFID_${member.phone.slice(-6)}` : '',
      weight: '',
      height: '',
      notes: '',
    });
    setEnrollingState('idle');
    setEnrollModalOpen(true);
  };

  const handleCompleteEnrollment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEnrollMember) return;
    setEnrollingState('scanning');

    try {
      const payload = {
        event_type: enrollForm.verificationType,
        device_name: enrollForm.device_name,
        card_number: enrollForm.card_number || undefined,
        weight: enrollForm.weight ? parseFloat(enrollForm.weight) : undefined,
        height: enrollForm.height ? parseFloat(enrollForm.height) : undefined,
        notes: enrollForm.notes || `Enrolled via ${enrollForm.verificationType}`,
        scan_type: enrollForm.verificationType === 'INBODY' ? 'INBODY' : 'BIOMETRIC',
      };

      const updated = await apiClient.post<CustomerRecord>(
        `/customers/${selectedEnrollMember.id}/sync-biometric`,
        payload
      );
      setCustomers((prev) => prev.map((c) => (c.id === selectedEnrollMember.id ? { ...c, ...updated } : c)));
      setEnrollingState('success');
      setTimeout(() => {
        setEnrollModalOpen(false);
        triggerToast(`🎉 Biometric access granted & synced for ${selectedEnrollMember.full_name || selectedEnrollMember.name}!`);
      }, 1000);
    } catch (_err) {
      setEnrollingState('idle');
      triggerToast('Failed to complete biometric enrollment');
    }
  };

  // Handlers for Broadcast Campaigns
  const handleSendBroadcast = (channelName: string) => {
    setSendingBroadcast(true);
    setTimeout(() => {
      setSendingBroadcast(false);
      triggerToast(`📢 ${channelName} broadcast dispatched to ${broadcastForm.targetAudience}!`);
    }, 1500);
  };

  // Handlers for Ad Generator
  const handleOptimizePrompt = () => {
    setAdPrompt(
      'Create an ultra-high converting gym membership campaign for FitClub AI. Modern athletic lighting, shredded fitness model tracking muscle mass with InBody scan, dynamic typography with 50% Early Bird Discount and VIP trial badge.'
    );
    triggerToast('✨ Prompt optimized with AI Art Director heuristics!');
  };

  const handleGenerateAd = () => {
    setGeneratingAd(true);
    setTimeout(() => {
      setGeneratingAd(false);
      const newAd: CrmAdItem = {
        id: 'ad_' + Date.now(),
        headline: 'FitClub AI • Clinical Body Recomposition Campaign',
        prompt: adPrompt,
        aspect_ratio: adAspectRatio,
        model_used: adModel,
        image_url: 'https://images.unsplash.com/photo-1517838277536-f5f99be501cd?q=80&w=1200&auto=format&fit=crop',
        caption: `⚡ STOP GUESSING YOUR WORKOUTS! FitClub AI computes your exact clinical calorie targets and workout splits.\n\n🎟️ Claim your 1-on-1 Transformation Pass now.\n\n#FitClubAI #FitnessTransformation #GymLife #FitGoals`,
        status: 'Generated & Ready to Publish',
        created_at: new Date().toISOString(),
      };
      setGeneratedAd(newAd);
      apiClient.post('/crm/ads', newAd).catch(() => null);
      triggerToast('🎨 Creative generated in ultra HD with Meta Copywriting!');
    }, 1800);
  };

  // Filtered Customers from DB
  const filteredCustomers = customers.filter((cust) => {
    const name = cust.full_name || cust.name || '';
    const email = cust.email || '';
    const phone = cust.phone || '';
    const matchesSearch =
      name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      phone.includes(searchQuery);
    const matchesStatus =
      customerFilterStatus === 'All' ||
      (cust.status || '').toUpperCase() === customerFilterStatus.toUpperCase();
    return matchesSearch && matchesStatus;
  });

  // Filtered Call Logs
  const filteredCalls = callLogs.filter((call) => {
    const matchesSearch =
      call.contact_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      call.phone.includes(searchQuery) ||
      call.ai_summary.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = filterContactType === 'All Contact Types' || call.contact_type.toUpperCase() === filterContactType.toUpperCase();
    const matchesStatus = filterStatus === 'All Statuses' || call.status.toLowerCase() === filterStatus.toLowerCase();
    const matchesSentiment = filterSentiment === 'All Sentiments' || call.sentiment.toLowerCase() === filterSentiment.toLowerCase();
    return matchesSearch && matchesType && matchesStatus && matchesSentiment;
  });

  // Filtered Tickets
  const filteredTickets = tickets.filter((t) => {
    const matchesSearch =
      t.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (t.customer_name && t.customer_name.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesStatus = ticketFilterStatus === 'All' || t.status.toLowerCase() === ticketFilterStatus.toLowerCase();
    const matchesCat = ticketFilterCategory === 'All Categories' || t.category === ticketFilterCategory;
    return matchesSearch && matchesStatus && matchesCat;
  });

  // Dynamic KPI calculations from live DB data
  const totalCalls = callLogs.length;
  const totalDurationSec = callLogs.reduce((acc, c) => acc + (c.duration_seconds || 0), 0);
  const avgSec = totalCalls > 0 ? Math.round(totalDurationSec / totalCalls) : 0;
  const avgDuration = `${Math.floor(avgSec / 60)}m ${String(avgSec % 60).padStart(2, '0')}s`;
  const positiveSentimentPct = totalCalls > 0
    ? `${Math.round((callLogs.filter((c) => (c.sentiment || '').toLowerCase() === 'positive').length / totalCalls) * 100)}%`
    : '0%';
  const avgAiScore = totalCalls > 0
    ? `${Math.round(callLogs.reduce((acc, c) => acc + (c.qualification_score || 0), 0) / totalCalls)}/100`
    : '0/100';

  const openTicketsCount = tickets.filter((t) => t.status === 'Open').length;
  const urgentTicketsCount = tickets.filter((t) => t.priority === 'High' || t.priority === 'Urgent').length;
  const inProgressTicketsCount = tickets.filter((t) => t.status === 'In Progress').length;
  const resolvedTicketsCount = tickets.filter((t) => t.status === 'Resolved' || t.status === 'Closed').length;

  const totalMembersCount = customers.length;
  const activeMembersCount = customers.filter((c) => (c.status || '').toUpperCase() === 'ACTIVE').length;

  return (
    <div className="space-y-6 animate-fade-in pb-16">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-20 right-6 z-50 bg-navy-950/95 text-white text-xs font-bold px-4 py-3 rounded-2xl shadow-2xl backdrop-blur-md border border-brand-500/40 flex items-center gap-2.5 animate-slide-in">
          <Icon name="sparkles" size={16} className="text-brand-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Page Header */}
      <PageHeader
        title="CRM & Sales Growth Suite"
        subtitle="AI-driven Lead Pipelines, Smart Outbound Voice Calling, Marketing Ad Creative Studio & Omnichannel Customer Service"
        breadcrumb={['Owner', 'CRM & Growth']}
      />

      {/* ───────────────────────────────────────────────────────────── */}
      {/* LEVEL 1: CATEGORY NAVIGATION BAR (Matches lazymonkeyai.com) */}
      {/* ───────────────────────────────────────────────────────────── */}
      <div className="border-b border-navy-200/80 pb-1">
        <div className="flex items-center gap-6 overflow-x-auto scrollbar-none">
          {[
            { id: 'Customer Management', icon: 'users', defaultTab: 'customer_list' },
            { id: 'Marketing & Sales', icon: 'trending-up', defaultTab: 'ad_generator' },
            { id: 'Customer Service', icon: 'headphones', defaultTab: 'support_tickets' },
            { id: 'Communication', icon: 'radio', defaultTab: 'ai_call_logs' },
            { id: 'Customer Intelligence', icon: 'sparkles', defaultTab: 'churn_predictor' },
          ].map((cat) => {
            const isActive = activeCategory === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => {
                  setActiveCategory(cat.id as CrmCategory);
                  switchSubTab(cat.defaultTab, cat.id as CrmCategory);
                }}
                className={`flex items-center gap-2 py-2.5 text-xs font-bold transition-all relative whitespace-nowrap ${
                  isActive ? 'text-brand-600 font-black' : 'text-navy-500 hover:text-navy-900'
                }`}
              >
                <Icon name={cat.icon} size={15} className={isActive ? 'text-brand-600' : 'text-navy-400'} />
                <span>{cat.id}</span>
                {isActive && (
                  <span className="absolute bottom-0 inset-x-0 h-0.5 bg-brand-600 rounded-full" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ───────────────────────────────────────────────────────────── */}
      {/* LEVEL 2: SUB-TABS PILL BAR (Matches lazymonkeyai.com) */}
      {/* ───────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 overflow-x-auto scrollbar-none py-1">
        {activeCategory === 'Communication' && (
          <>
            {[
              { id: 'ai_call_logs', label: 'AI Voice Calling & Logs', icon: 'headphones' },
              { id: 'email_campaigns', label: 'Email Campaigns', icon: 'mail' },
              { id: 'sms_campaigns', label: 'SMS Campaigns', icon: 'message-square' },
              { id: 'whatsapp_campaigns', label: 'WhatsApp Campaigns', icon: 'message-circle' },
              { id: 'push_notifications', label: 'Push Notifications', icon: 'bell' },
            ].map((sub) => (
              <button
                key={sub.id}
                onClick={() => switchSubTab(sub.id)}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap ${
                  activeSubTab === sub.id
                    ? 'bg-brand-600 text-white shadow-md shadow-brand-600/20'
                    : 'bg-white hover:bg-navy-50 text-navy-600 border border-navy-200/60'
                }`}
              >
                <Icon name={sub.icon} size={14} />
                <span>{sub.label}</span>
              </button>
            ))}
          </>
        )}

        {activeCategory === 'Marketing & Sales' && (
          <>
            {[
              { id: 'ad_generator', label: 'Marketing Ad Generator', icon: 'sparkles' },
              { id: 'social_dashboard', label: 'Social Media Dashboard', icon: 'bar-chart-3' },
              { id: 'ad_history', label: 'Ad Post History', icon: 'history' },
              { id: 'leads', label: 'Leads', icon: 'target' },
              { id: 'opportunities', label: 'Opportunities', icon: 'award' },
              { id: 'deals', label: 'Deals', icon: 'tag' },
              { id: 'pipeline', label: 'Sales Pipeline', icon: 'kanban-square' },
              { id: 'quotations', label: 'Quotations', icon: 'file-text' },
              { id: 'sales_orders', label: 'Sales Orders', icon: 'shopping-cart' },
              { id: 'discounts', label: 'Discounts', icon: 'percent' },
            ].map((sub) => (
              <button
                key={sub.id}
                onClick={() => switchSubTab(sub.id)}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap ${
                  activeSubTab === sub.id
                    ? 'bg-brand-600 text-white shadow-md shadow-brand-600/20'
                    : 'bg-white hover:bg-navy-50 text-navy-600 border border-navy-200/60'
                }`}
              >
                <Icon name={sub.icon} size={14} />
                <span>{sub.label}</span>
              </button>
            ))}
          </>
        )}

        {activeCategory === 'Customer Service' && (
          <>
            {[
              { id: 'support_tickets', label: 'Support Tickets', icon: 'headphones' },
              { id: 'complaints', label: 'Complaints', icon: 'alert-triangle' },
              { id: 'returns', label: 'Returns', icon: 'refresh-cw' },
              { id: 'feedback', label: 'Feedback', icon: 'star' },
              { id: 'timeline', label: 'Customer Timeline', icon: 'clock' },
            ].map((sub) => (
              <button
                key={sub.id}
                onClick={() => switchSubTab(sub.id)}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap ${
                  activeSubTab === sub.id
                    ? 'bg-brand-600 text-white shadow-md shadow-brand-600/20'
                    : 'bg-white hover:bg-navy-50 text-navy-600 border border-navy-200/60'
                }`}
              >
                <Icon name={sub.icon} size={14} />
                <span>{sub.label}</span>
              </button>
            ))}
          </>
        )}

        {activeCategory === 'Customer Management' && (
          <>
            {[
              { id: 'customer_list', label: 'All Customers & Members', icon: 'users' },
              { id: 'onboarding', label: 'Member Onboarding KYC', icon: 'user-check' },
            ].map((sub) => (
              <button
                key={sub.id}
                onClick={() => switchSubTab(sub.id)}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap ${
                  activeSubTab === sub.id
                    ? 'bg-brand-600 text-white shadow-md shadow-brand-600/20'
                    : 'bg-white hover:bg-navy-50 text-navy-600 border border-navy-200/60'
                }`}
              >
                <Icon name={sub.icon} size={14} />
                <span>{sub.label}</span>
              </button>
            ))}
          </>
        )}

        {activeCategory === 'Customer Intelligence' && (
          <>
            {[
              { id: 'churn_predictor', label: 'AI Churn Predictor', icon: 'flame' },
              { id: 'lead_scoring', label: 'Lead Scoring Matrix', icon: 'target' },
              { id: 'sentiment_analysis', label: 'Sentiment & Tone Analysis', icon: 'message-square' },
              { id: 'ltv_forecast', label: 'LTV & Revenue Forecast', icon: 'indian-rupee' },
            ].map((sub) => (
              <button
                key={sub.id}
                onClick={() => switchSubTab(sub.id)}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap ${
                  activeSubTab === sub.id
                    ? 'bg-brand-600 text-white shadow-md shadow-brand-600/20'
                    : 'bg-white hover:bg-navy-50 text-navy-600 border border-navy-200/60'
                }`}
              >
                <Icon name={sub.icon} size={14} />
                <span>{sub.label}</span>
              </button>
            ))}
          </>
        )}
      </div>

      {/* ───────────────────────────────────────────────────────────── */}
      {/* 1. VIEW: ALL CUSTOMERS & MEMBERS (Fetched from DB)            */}
      {/* ───────────────────────────────────────────────────────────── */}
      {activeSubTab === 'customer_list' && (
        <div className="space-y-6 animate-fade-in">
          {/* Header Title with KPI Count */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-black text-navy-900 tracking-tight">
                  All Customers & Members
                </h2>
                <span className="px-2.5 py-0.5 rounded-full bg-brand-50 text-brand-700 border border-brand-200 text-xs font-black">
                  {totalMembersCount} Registered
                </span>
              </div>
              <p className="text-xs text-navy-500">
                Live member database with subscription status, goals, and 1-click AI consultation actions.
              </p>
            </div>

            <div className="flex items-center gap-2.5">
              <button
                onClick={fetchData}
                className="px-3.5 py-2 rounded-xl bg-white hover:bg-navy-50 border border-navy-200 text-navy-700 text-xs font-bold shadow-sm flex items-center gap-1.5 transition"
              >
                <Icon name="refresh-cw" size={14} /> Refresh List
              </button>
            </div>
          </div>

          {/* 3 Metric Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="card p-5 bg-white border border-navy-100 rounded-2xl shadow-sm flex items-start justify-between">
              <div className="space-y-1">
                <span className="text-[11px] font-bold text-navy-400 uppercase tracking-wider block">TOTAL MEMBERS</span>
                <span className="text-2xl font-black text-navy-900">{totalMembersCount}</span>
                <span className="text-[11px] font-bold text-brand-600 block">Database Records</span>
              </div>
              <div className="w-10 h-10 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center">
                <Icon name="users" size={18} />
              </div>
            </div>

            <div className="card p-5 bg-white border border-navy-100 rounded-2xl shadow-sm flex items-start justify-between">
              <div className="space-y-1">
                <span className="text-[11px] font-bold text-navy-400 uppercase tracking-wider block">ACTIVE MEMBERS</span>
                <span className="text-2xl font-black text-emerald-600">{activeMembersCount}</span>
                <span className="text-[11px] font-bold text-emerald-600 block">Current Subscriptions</span>
              </div>
              <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <Icon name="user-check" size={18} />
              </div>
            </div>

            <div className="card p-5 bg-white border border-navy-100 rounded-2xl shadow-sm flex items-start justify-between">
              <div className="space-y-1">
                <span className="text-[11px] font-bold text-navy-400 uppercase tracking-wider block">CONVERSION PIPELINE</span>
                <span className="text-2xl font-black text-purple-600">{leads.length}</span>
                <span className="text-[11px] font-bold text-purple-600 block">Prospective Leads</span>
              </div>
              <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
                <Icon name="target" size={18} />
              </div>
            </div>
          </div>

          {/* Filter & Search Bar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="relative w-full sm:w-80">
              <Icon name="search" size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-navy-400" />
              <input
                type="text"
                placeholder="Search by name, email, phone..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-3 py-2 rounded-xl bg-white border border-navy-200 text-xs font-semibold text-navy-900 focus:outline-none focus:ring-2 focus:ring-brand-500 shadow-sm"
              />
            </div>

            <div className="flex items-center gap-2 self-end sm:self-auto">
              {['All', 'Active', 'Inactive'].map((st) => (
                <button
                  key={st}
                  onClick={() => setCustomerFilterStatus(st)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                    customerFilterStatus === st
                      ? 'bg-brand-600 text-white shadow-sm'
                      : 'bg-white hover:bg-navy-50 text-navy-600 border border-navy-200'
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>
          </div>

          {/* Customer Data Table from Live DB */}
          {filteredCustomers.length === 0 ? (
            <div className="card p-12 bg-white border border-navy-100 rounded-3xl text-center space-y-3">
              <div className="w-12 h-12 mx-auto rounded-2xl bg-navy-50 text-navy-400 flex items-center justify-center">
                <Icon name="users" size={24} />
              </div>
              <h4 className="text-sm font-bold text-navy-900">No Customers Found</h4>
              <p className="text-xs text-navy-400">Try adjusting your search criteria or register a new customer.</p>
            </div>
          ) : (
            <div className="card overflow-hidden bg-white border border-navy-100 rounded-2xl shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-navy-100 bg-navy-50/50 text-[11px] font-bold text-navy-400 uppercase tracking-wider">
                      <th className="py-3.5 px-4">MEMBER / CONTACT</th>
                      <th className="py-3.5 px-4">STATUS & PLAN</th>
                      <th className="py-3.5 px-4">FITNESS GOAL</th>
                      <th className="py-3.5 px-4">TRAINING PREFERENCE</th>
                      <th className="py-3.5 px-4 text-right">QUICK ACTIONS</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-navy-100 text-xs">
                    {filteredCustomers.map((cust) => {
                      const displayName = cust.full_name || cust.name || 'Member';
                      const isActive = (cust.status || '').toUpperCase() === 'ACTIVE';
                      return (
                        <tr key={cust.id} className="hover:bg-navy-50/40 transition">
                          <td className="py-4 px-4">
                            <div className="flex items-center gap-3">
                              <div className="w-9 h-9 rounded-full bg-brand-50 text-brand-700 font-black flex items-center justify-center text-xs">
                                {displayName.charAt(0).toUpperCase()}
                              </div>
                              <div>
                                <span className="font-bold text-navy-900 block">{displayName}</span>
                                <span className="text-[11px] text-navy-400 block">{cust.phone || cust.email || 'No contact'}</span>
                              </div>
                            </div>
                          </td>

                          <td className="py-4 px-4">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase inline-block ${
                                isActive ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-navy-100 text-navy-600'
                              }`}
                            >
                              {cust.status || 'Registered'}
                            </span>
                            <span className="text-[11px] text-navy-500 font-semibold block mt-1">
                              {cust.membership || 'Standard Pass'}
                            </span>
                          </td>

                          <td className="py-4 px-4 text-navy-700 font-medium">
                            {cust.goal || 'General Fitness'}
                          </td>

                          <td className="py-4 px-4 text-navy-600">
                            <span className="px-2 py-0.5 rounded-md bg-navy-50 text-navy-700 text-[11px] font-semibold border border-navy-200/60">
                              {cust.training_preference || 'Standard Workout'}
                            </span>
                          </td>

                          <td className="py-4 px-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => {
                                  setCallForm({
                                    contact_name: displayName,
                                    phone: cust.phone || '',
                                    objective: 'Member Progress & Workout Consultation',
                                  });
                                  setNewCallModalOpen(true);
                                }}
                                className="px-2.5 py-1 rounded-xl bg-purple-50 hover:bg-purple-100 text-purple-700 text-[11px] font-bold flex items-center gap-1 transition"
                              >
                                <Icon name="phone" size={12} /> AI Call
                              </button>
                              <button
                                onClick={() => {
                                  setTicketForm({
                                    ...ticketForm,
                                    customer_name: displayName,
                                    subject: `Member Service Request - ${displayName}`,
                                  });
                                  setNewTicketModalOpen(true);
                                }}
                                className="px-2.5 py-1 rounded-xl bg-navy-100 hover:bg-navy-200 text-navy-700 text-[11px] font-bold transition"
                              >
                                Ticket
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* 2. VIEW: MEMBER ONBOARDING KYC & BIOMETRIC SYNC               */}
      {/* ───────────────────────────────────────────────────────────── */}
      {activeSubTab === 'onboarding' && (() => {
        const biometricCompletedCount = customers.filter((c) => c.biometric_synced).length;
        const biometricPendingCount = customers.filter((c) => !c.biometric_synced).length;
        const verifiedKycCount = customers.filter((c) => (c.kyc_percent || 0) >= 80 || c.kyc_status === 'Verified & Ready').length;

        const filteredOnboardingCustomers = customers.filter((c) => {
          const name = c.full_name || c.name || '';
          const phone = c.phone || '';
          const matchesSearch = name.toLowerCase().includes(searchQuery.toLowerCase()) || phone.includes(searchQuery);
          if (!matchesSearch) return false;
          if (onboardingBiometricFilter === 'Completed') return c.biometric_synced;
          if (onboardingBiometricFilter === 'Pending') return !c.biometric_synced;
          return true;
        });

        return (
          <div className="space-y-6 animate-fade-in">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-black text-navy-900 tracking-tight">Member Onboarding & Biometric Sync</h2>
                <p className="text-xs text-navy-500">Track KYC completeness and hardware biometric scanner linkage status in real time.</p>
              </div>

              <div className="flex items-center gap-2.5">
                <button
                  onClick={fetchData}
                  className="px-3.5 py-2 rounded-xl bg-white hover:bg-navy-50 border border-navy-200 text-navy-700 text-xs font-bold shadow-sm flex items-center gap-1.5 transition"
                >
                  <Icon name="refresh-cw" size={14} /> Refresh Status
                </button>
              </div>
            </div>

            {/* 4 KPI Metric Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="card p-5 bg-white border border-navy-100 rounded-2xl shadow-sm flex items-start justify-between">
                <div className="space-y-1">
                  <span className="text-[11px] font-bold text-navy-400 uppercase tracking-wider block">TOTAL MEMBERS</span>
                  <span className="text-2xl font-black text-navy-900">{customers.length}</span>
                  <span className="text-[11px] text-navy-400 font-semibold block">Registered in DB</span>
                </div>
                <div className="w-10 h-10 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center">
                  <Icon name="users" size={18} />
                </div>
              </div>

              <div className="card p-5 bg-white border border-navy-100 rounded-2xl shadow-sm flex items-start justify-between">
                <div className="space-y-1">
                  <span className="text-[11px] font-bold text-navy-400 uppercase tracking-wider block">BIOMETRICS SYNCED</span>
                  <span className="text-2xl font-black text-emerald-600">{biometricCompletedCount}</span>
                  <span className="text-[11px] font-bold text-emerald-600 block">Device Linked & Active</span>
                </div>
                <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <Icon name="fingerprint" size={18} />
                </div>
              </div>

              <div className="card p-5 bg-white border border-navy-100 rounded-2xl shadow-sm flex items-start justify-between">
                <div className="space-y-1">
                  <span className="text-[11px] font-bold text-navy-400 uppercase tracking-wider block">BIOMETRICS PENDING</span>
                  <span className="text-2xl font-black text-amber-600">{biometricPendingCount}</span>
                  <span className="text-[11px] font-bold text-amber-600 block">Action Required</span>
                </div>
                <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                  <Icon name="circle-alert" size={18} />
                </div>
              </div>

              <div className="card p-5 bg-white border border-navy-100 rounded-2xl shadow-sm flex items-start justify-between">
                <div className="space-y-1">
                  <span className="text-[11px] font-bold text-navy-400 uppercase tracking-wider block">VERIFIED KYC RATIO</span>
                  <span className="text-2xl font-black text-purple-600">
                    {customers.length > 0 ? `${Math.round((verifiedKycCount / customers.length) * 100)}%` : '100%'}
                  </span>
                  <span className="text-[11px] font-bold text-purple-600 block">Complete Profiles</span>
                </div>
                <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
                  <Icon name="user-check" size={18} />
                </div>
              </div>
            </div>

            {/* Filter & Search Bar */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="relative w-full sm:w-80">
                <Icon name="search" size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-navy-400" />
                <input
                  type="text"
                  placeholder="Search member by name or phone..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-3 py-2 rounded-xl bg-white border border-navy-200 text-xs font-semibold text-navy-900 focus:outline-none focus:ring-2 focus:ring-brand-500 shadow-sm"
                />
              </div>

              <div className="flex items-center gap-2 self-end sm:self-auto">
                {[
                  { id: 'All', label: `All Members (${customers.length})` },
                  { id: 'Completed', label: `Biometrics Synced (${biometricCompletedCount})` },
                  { id: 'Pending', label: `Pending Link (${biometricPendingCount})` },
                ].map((st) => (
                  <button
                    key={st.id}
                    onClick={() => setOnboardingBiometricFilter(st.id as any)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                      onboardingBiometricFilter === st.id
                        ? 'bg-brand-600 text-white shadow-sm'
                        : 'bg-white hover:bg-navy-50 text-navy-600 border border-navy-200'
                    }`}
                  >
                    {st.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Onboarding Table */}
            {filteredOnboardingCustomers.length === 0 ? (
              <div className="card p-12 bg-white border border-navy-100 rounded-3xl text-center space-y-3">
                <div className="w-12 h-12 mx-auto rounded-2xl bg-navy-50 text-navy-400 flex items-center justify-center">
                  <Icon name="users" size={24} />
                </div>
                <h4 className="text-sm font-bold text-navy-900">No Members Found</h4>
                <p className="text-xs text-navy-400">No records match the current filter selection.</p>
              </div>
            ) : (
              <div className="card overflow-hidden bg-white border border-navy-100 rounded-2xl shadow-sm">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-navy-100 bg-navy-50/50 text-[11px] font-bold text-navy-400 uppercase tracking-wider">
                      <th className="py-3.5 px-4">MEMBER</th>
                      <th className="py-3.5 px-4">KYC PROFILE</th>
                      <th className="py-3.5 px-4">BIOMETRIC SYNC</th>
                      <th className="py-3.5 px-4">TRAINING GOAL</th>
                      <th className="py-3.5 px-4 text-right">ACTION</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-navy-100 text-xs">
                    {filteredOnboardingCustomers.map((c) => {
                      const displayName = c.full_name || c.name || 'Member';
                      const isVerified = (c.kyc_percent || 0) >= 80 || c.kyc_status === 'Verified & Ready';
                      return (
                        <tr key={c.id} className="hover:bg-navy-50/40 transition">
                          <td className="py-3.5 px-4 font-bold text-navy-900">
                            <div className="flex items-center gap-2.5">
                              <div className="w-8 h-8 rounded-full bg-brand-50 text-brand-700 font-bold flex items-center justify-center text-xs">
                                {displayName.charAt(0).toUpperCase()}
                              </div>
                              <div>
                                <span className="block">{displayName}</span>
                                <span className="text-[11px] text-navy-400 font-normal">{c.phone || c.email}</span>
                              </div>
                            </div>
                          </td>
                          <td className="py-3.5 px-4">
                            <span
                              className={`px-2.5 py-0.5 rounded-full font-bold text-[10px] inline-block ${
                                isVerified
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  : 'bg-amber-50 text-amber-700 border border-amber-200'
                              }`}
                            >
                              {c.kyc_status || (isVerified ? 'Verified & Ready' : 'Profile Incomplete')}
                            </span>
                          </td>
                          <td className="py-3.5 px-4">
                            {c.biometric_synced || (c.biometric_status || '').toLowerCase() === 'completed' ? (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-black bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-sm">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                <Icon name="check" size={12} className="text-emerald-600" />
                                <span>Completed</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-black bg-amber-50 text-amber-800 border border-amber-200 shadow-sm">
                                <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                                <Icon name="clock" size={12} className="text-amber-600" />
                                <span>Pending</span>
                              </span>
                            )}
                          </td>
                          <td className="py-3.5 px-4 text-navy-700 font-medium">{c.goal || 'General Fitness'}</td>
                          <td className="py-3.5 px-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              {!c.biometric_synced ? (
                                <button
                                  onClick={() => handleOpenEnrollModal(c)}
                                  className="px-2.5 py-1 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-[11px] font-bold shadow-sm transition flex items-center gap-1"
                                >
                                  <Icon name="fingerprint" size={12} /> + Enroll Access
                                </button>
                              ) : (
                                <button
                                  onClick={() => handleOpenEnrollModal(c)}
                                  className="px-2 py-1 rounded-xl bg-navy-100 hover:bg-navy-200 text-navy-700 text-[11px] font-bold transition flex items-center gap-1"
                                >
                                  <Icon name="refresh-cw" size={11} /> Re-sync
                                </button>
                              )}
                              <button
                                onClick={() => {
                                  setCallForm({
                                    contact_name: displayName,
                                    phone: c.phone || '',
                                    objective: 'Biometric Onboarding & InBody Scan Reminder',
                                  });
                                  setNewCallModalOpen(true);
                                }}
                                className="px-2.5 py-1 rounded-xl bg-purple-50 hover:bg-purple-100 text-purple-700 text-[11px] font-bold flex items-center gap-1 transition"
                              >
                                <Icon name="phone" size={11} /> AI Call
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        );
      })()}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* 3. VIEW: CUSTOMER GROUPS & SEGMENTS                           */}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* 4. VIEW: OMNICHANNEL BROADCAST CAMPAIGNS (Email, SMS, WA, Push)*/}
      {/* ───────────────────────────────────────────────────────────── */}
      {['email_campaigns', 'sms_campaigns', 'whatsapp_campaigns', 'push_notifications'].includes(activeSubTab) && (
        <div className="space-y-6 animate-fade-in">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-black text-navy-900 tracking-tight capitalize">
                {activeSubTab.replace(/_/g, ' ')}
              </h2>
              <p className="text-xs text-navy-500">
                Dispatch personalized marketing broadcasts and automated workout notifications directly to members.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left: Compose Form */}
            <div className="lg:col-span-7 card p-6 bg-white border border-navy-100 rounded-3xl shadow-sm space-y-4">
              <h3 className="text-sm font-bold text-navy-900 flex items-center gap-2">
                <Icon name="send" size={16} className="text-brand-600" />
                Compose Broadcast Message
              </h3>

              <div className="space-y-1">
                <label className="text-xs font-bold text-navy-700 block">Target Audience Segment</label>
                <select
                  value={broadcastForm.targetAudience}
                  onChange={(e) => setBroadcastForm({ ...broadcastForm, targetAudience: e.target.value })}
                  className="w-full p-2.5 rounded-xl bg-navy-50 border border-navy-200 text-xs font-bold text-navy-900"
                >
                  <option value="All Active Members">All Active Members ({activeMembersCount})</option>
                  <option value="All Registered Members">All Registered Members ({totalMembersCount})</option>
                  <option value="Prospective Leads & Inquiries">Prospective Leads ({leads.length})</option>
                  <option value="Personal Training Clients">Personal Training Clients</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-navy-700 block">Campaign Title / Subject</label>
                <input
                  type="text"
                  value={broadcastForm.subject}
                  onChange={(e) => setBroadcastForm({ ...broadcastForm, subject: e.target.value })}
                  className="w-full p-2.5 rounded-xl bg-navy-50 border border-navy-200 text-xs font-bold text-navy-900"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-navy-700 block">Message Body</label>
                <textarea
                  rows={4}
                  value={broadcastForm.message}
                  onChange={(e) => setBroadcastForm({ ...broadcastForm, message: e.target.value })}
                  className="w-full p-3 rounded-2xl bg-navy-50 border border-navy-200 text-xs font-semibold text-navy-900"
                />
                <span className="text-[10px] text-navy-400 font-semibold block">
                  Supports dynamic placeholders: {'{member_name}'}, {'{gym_name}'}, {'{plan_name}'}
                </span>
              </div>

              <button
                onClick={() => handleSendBroadcast(activeSubTab.replace(/_/g, ' ').toUpperCase())}
                disabled={sendingBroadcast}
                className="w-full py-3.5 rounded-2xl bg-brand-600 hover:bg-brand-700 text-white font-bold text-xs shadow-md shadow-brand-500/25 flex items-center justify-center gap-2 transition disabled:opacity-50"
              >
                <Icon name={sendingBroadcast ? 'refresh-cw' : 'send'} size={15} className={sendingBroadcast ? 'animate-spin' : ''} />
                <span>{sendingBroadcast ? 'Dispatching Broadcast...' : `Dispatch ${activeSubTab.replace(/_/g, ' ')}`}</span>
              </button>
            </div>

            {/* Right: Preview Phone Card */}
            <div className="lg:col-span-5 card p-6 bg-white border border-navy-100 rounded-3xl shadow-sm space-y-4">
              <span className="text-xs font-bold text-navy-700 block">Live Mobile Preview</span>
              <div className="p-4 rounded-2xl bg-navy-950 text-white space-y-2.5 border border-navy-800">
                <div className="flex items-center gap-2 text-[11px] text-brand-400 font-bold">
                  <Icon name="bell" size={14} /> FITCLUB AI NOTIFICATION
                </div>
                <h5 className="text-xs font-bold text-white">{broadcastForm.subject}</h5>
                <p className="text-xs text-navy-200 whitespace-pre-line leading-relaxed">
                  {broadcastForm.message.replace('{member_name}', 'Yashwanth')}
                </p>
                <span className="text-[10px] text-navy-500 block pt-1">Delivered via cloud gateway</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* 5. VIEW: COMMUNICATION & AI VOICE LOGS (Screenshot 4)        */}
      {/* ───────────────────────────────────────────────────────────── */}
      {activeSubTab === 'ai_call_logs' && (
        <div className="space-y-6 animate-fade-in">
          {/* Header Title with Badge and Actions */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-brand-600 text-white flex items-center justify-center shadow-lg shadow-brand-600/25">
                <Icon name="headphones" size={20} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-black text-navy-900 tracking-tight">
                    Communication & AI Voice Logs
                  </h2>
                  <span className="px-2 py-0.5 rounded-full bg-brand-50 text-brand-700 border border-brand-200 text-[11px] font-extrabold">
                    {callLogs.length} Total Calls
                  </span>
                </div>
                <p className="text-xs text-navy-500">
                  Full communication analytics, voice transcripts, qualification scores & CSV export.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2.5">
              <button
                onClick={() => triggerToast('📊 Exported voice call transcripts to CSV!')}
                className="px-3.5 py-2 rounded-xl bg-white hover:bg-navy-50 border border-navy-200 text-navy-700 text-xs font-bold shadow-sm flex items-center gap-1.5 transition"
              >
                <Icon name="download" size={14} /> Export CSV
              </button>

              <button
                onClick={fetchData}
                className="p-2 rounded-xl bg-white hover:bg-navy-50 border border-navy-200 text-navy-700 shadow-sm transition"
                title="Refresh logs"
              >
                <Icon name="refresh-cw" size={14} />
              </button>

              <button
                onClick={() => setNewCallModalOpen(true)}
                className="px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold shadow-md shadow-brand-600/25 flex items-center gap-1.5 transition hover:scale-[1.02] active:scale-95"
              >
                <Icon name="phone" size={14} />
                <span>Start AI Call</span>
              </button>
            </div>
          </div>

          {/* 4 KPI Metric Cards (Screenshot 4) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="card p-5 bg-white border border-navy-100 rounded-2xl shadow-sm flex items-start justify-between">
              <div className="space-y-1">
                <span className="text-[11px] font-bold text-navy-400 uppercase tracking-wider block">TOTAL CALLS LOGGED</span>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-black text-navy-900">{totalCalls}</span>
                  <span className="text-[11px] font-bold text-emerald-600 flex items-center gap-0.5">↗ Live DB Data</span>
                </div>
              </div>
              <div className="w-10 h-10 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center">
                <Icon name="phone" size={18} />
              </div>
            </div>

            <div className="card p-5 bg-white border border-navy-100 rounded-2xl shadow-sm flex items-start justify-between">
              <div className="space-y-1">
                <span className="text-[11px] font-bold text-navy-400 uppercase tracking-wider block">AVG DURATION</span>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-black text-navy-900">{avgDuration}</span>
                  <span className="text-[11px] text-navy-400 font-semibold">Per Consultation</span>
                </div>
              </div>
              <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <Icon name="clock" size={18} />
              </div>
            </div>

            <div className="card p-5 bg-white border border-navy-100 rounded-2xl shadow-sm flex items-start justify-between">
              <div className="space-y-1">
                <span className="text-[11px] font-bold text-navy-400 uppercase tracking-wider block">POSITIVE SENTIMENT</span>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-black text-navy-900">{positiveSentimentPct}</span>
                  <span className="text-[11px] font-bold text-purple-600">Interest Rate</span>
                </div>
              </div>
              <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
                <Icon name="flame" size={18} />
              </div>
            </div>

            <div className="card p-5 bg-white border border-navy-100 rounded-2xl shadow-sm flex items-start justify-between">
              <div className="space-y-1">
                <span className="text-[11px] font-bold text-navy-400 uppercase tracking-wider block">AVG AI SCORE</span>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-black text-navy-900">{avgAiScore}</span>
                  <span className="text-[11px] font-bold text-emerald-600">Qualification Score</span>
                </div>
              </div>
              <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                <Icon name="award" size={18} />
              </div>
            </div>
          </div>

          {/* Filter & Search Bar */}
          <div className="card p-3 bg-white border border-navy-100 rounded-2xl shadow-sm grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            <div className="lg:col-span-2 relative">
              <Icon name="search" size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-navy-400" />
              <input
                type="text"
                placeholder="Search contact, company, summary..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-3 py-2 rounded-xl bg-navy-50/70 border border-navy-200/70 text-xs font-semibold text-navy-900 focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>

            <select
              value={filterContactType}
              onChange={(e) => setFilterContactType(e.target.value)}
              className="px-3 py-2 rounded-xl bg-navy-50/70 border border-navy-200/70 text-xs font-semibold text-navy-800"
            >
              <option value="All Contact Types">✨ All Contact Types</option>
              <option value="LEAD">Leads</option>
              <option value="CUSTOMER">Customers</option>
              <option value="TRIAL">Trial Members</option>
            </select>

            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-3 py-2 rounded-xl bg-navy-50/70 border border-navy-200/70 text-xs font-semibold text-navy-800"
            >
              <option value="All Statuses">⚡ All Statuses</option>
              <option value="Completed">Completed</option>
              <option value="In Progress">In Progress</option>
              <option value="No Answer">No Answer</option>
            </select>

            <select
              value={filterSentiment}
              onChange={(e) => setFilterSentiment(e.target.value)}
              className="px-3 py-2 rounded-xl bg-navy-50/70 border border-navy-200/70 text-xs font-semibold text-navy-800"
            >
              <option value="All Sentiments">✨ All Sentiments</option>
              <option value="Positive">Positive</option>
              <option value="Neutral">Neutral</option>
              <option value="Hesitant">Hesitant</option>
            </select>
          </div>

          {/* Calls Data Table */}
          <div className="card overflow-hidden bg-white border border-navy-100 rounded-2xl shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-navy-100 bg-navy-50/50 text-[11px] font-bold text-navy-400 uppercase tracking-wider">
                    <th className="py-3.5 px-4">CONTACT / TARGET</th>
                    <th className="py-3.5 px-4">STATUS & TIME</th>
                    <th className="py-3.5 px-4">DURATION</th>
                    <th className="py-3.5 px-4">SENTIMENT & SCORE</th>
                    <th className="py-3.5 px-4">AI SUMMARY & KEY TAKEAWAYS</th>
                    <th className="py-3.5 px-4 text-right">ACTIONS</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-navy-100 text-xs">
                  {filteredCalls.map((call) => (
                    <tr key={call.id} className="hover:bg-navy-50/40 transition">
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-purple-100 text-purple-700 font-black flex items-center justify-center text-xs">
                            {call.contact_name.charAt(0)}
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-navy-900">{call.contact_name}</span>
                              <span className="text-[10px] px-1.5 py-0.2 rounded bg-purple-50 text-purple-700 font-bold border border-purple-200">
                                {call.contact_type}
                              </span>
                            </div>
                            <span className="text-[11px] text-navy-400 flex items-center gap-1 mt-0.5">
                              <Icon name="phone" size={11} /> {call.phone}
                            </span>
                          </div>
                        </div>
                      </td>

                      <td className="py-4 px-4">
                        <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold text-[10px] inline-flex items-center gap-1">
                          <Icon name="check" size={10} /> {call.status}
                        </span>
                        <span className="text-[11px] text-navy-400 block mt-1">
                          {call.created_at}
                        </span>
                      </td>

                      <td className="py-4 px-4 font-bold text-navy-800">
                        {call.duration_formatted}
                      </td>

                      <td className="py-4 px-4">
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                            {call.sentiment}
                          </span>
                          <span className="px-2 py-0.5 rounded-full bg-navy-100 text-navy-800 font-bold text-[10px]">
                            {call.qualification_score}/100
                          </span>
                        </div>
                      </td>

                      <td className="py-4 px-4 max-w-md">
                        <p className="text-[11px] text-navy-700 leading-snug">
                          {call.ai_summary}
                        </p>
                        {call.action_items && call.action_items.length > 0 && (
                          <div className="mt-1 space-y-0.5">
                            {call.action_items.map((item, idx) => (
                              <span key={idx} className="text-[10px] text-brand-600 font-bold block">
                                ✓ {item}
                              </span>
                            ))}
                          </div>
                        )}
                      </td>

                      <td className="py-4 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => {
                              setSelectedCallLog(call);
                              setTranscriptModalOpen(true);
                            }}
                            className="px-2.5 py-1 rounded-xl bg-navy-100 hover:bg-navy-200 text-navy-700 text-[11px] font-bold transition"
                          >
                            Transcript
                          </button>
                          <button
                            onClick={() => {
                              setCallForm({
                                contact_name: call.contact_name,
                                phone: call.phone,
                                objective: 'Follow-up Membership Consultation',
                              });
                              setNewCallModalOpen(true);
                            }}
                            className="p-1.5 rounded-xl bg-brand-50 hover:bg-brand-100 text-brand-700 transition"
                            title="Re-dial AI Call"
                          >
                            <Icon name="refresh-cw" size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* 6. VIEW: MARKETING AD GENERATOR (Screenshot 1)                */}
      {/* ───────────────────────────────────────────────────────────── */}
      {activeSubTab === 'ad_generator' && (
        <div className="space-y-6 animate-fade-in">
          {/* Top Title & Pipeline Badges */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-black text-navy-900 tracking-tight">AI Ad Pipeline</h2>
              <p className="text-xs text-navy-500">Generate → Approve → Publish → Promote. Full Meta workflow.</p>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-3 py-1 rounded-full bg-cyan-50 text-cyan-800 border border-cyan-200 text-xs font-bold flex items-center gap-1.5">
                <Icon name="facebook" size={13} /> FB: FitClub AI Page
              </span>
              <span className="px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-bold flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500" /> Non-expiring
              </span>
              <div className="flex bg-navy-100 p-0.5 rounded-full text-[11px] font-bold">
                {['Gemini Imagen', 'DALL-E 3', 'Claude'].map((m) => (
                  <button
                    key={m}
                    onClick={() => setAdModel(m as any)}
                    className={`px-3 py-1 rounded-full transition ${
                      adModel === m ? 'bg-brand-600 text-white shadow-sm' : 'text-navy-600 hover:text-navy-900'
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left Column: Form Setup */}
            <div className="lg:col-span-6 space-y-5">
              <div className="card p-6 bg-white border border-navy-100 rounded-3xl shadow-sm space-y-4">
                <div className="flex items-center justify-between border-b border-navy-100 pb-3">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-brand-600 text-white font-black text-xs flex items-center justify-center">1</span>
                    <h3 className="text-sm font-bold text-navy-900">Design Creative</h3>
                  </div>
                  <span className="text-[10px] font-extrabold px-2 py-0.5 rounded bg-navy-100 text-navy-700">AI Art Director</span>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-navy-700 block">Design Prompt</label>
                  <textarea
                    rows={4}
                    value={adPrompt}
                    onChange={(e) => setAdPrompt(e.target.value)}
                    placeholder="e.g., create a gym workout promotion with personal trainer, neon lighting, modern gym aesthetic..."
                    className="w-full p-3 rounded-2xl bg-navy-50/70 border border-navy-200 text-xs font-semibold text-navy-900 focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <span className="text-[10px] font-bold text-navy-400 uppercase tracking-wider block">Quick Ideas:</span>
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      { label: '🔥 Summer Shred Promo', prompt: 'Fitness transformation summer promo with athletic coach, gold lighting, high energy' },
                      { label: '💪 New Year Gym Pass', prompt: '50% off gym annual membership pass with InBody biometric scan included' },
                      { label: '⚡ Personal Training Trial', prompt: '1-on-1 personal training consultation trial pass, clinical equipment, luxury studio' },
                    ].map((idea) => (
                      <button
                        key={idea.label}
                        onClick={() => setAdPrompt(idea.prompt)}
                        className="px-2.5 py-1 rounded-xl bg-navy-50 hover:bg-navy-100 text-navy-700 text-[11px] font-bold border border-navy-200/80 transition"
                      >
                        {idea.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-1.5 pt-2">
                  <label className="text-xs font-bold text-navy-700 block">Aspect Ratio</label>
                  <select
                    value={adAspectRatio}
                    onChange={(e) => setAdAspectRatio(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-navy-50 border border-navy-200 text-xs font-bold text-navy-900"
                  >
                    <option value="1:1 (Post Square)">1:1 (Post Square)</option>
                    <option value="9:16 (Story / Reel)">9:16 (Story / Reel)</option>
                    <option value="16:9 (Landscape Banner)">16:9 (Landscape Banner)</option>
                  </select>
                </div>

                <button
                  onClick={handleOptimizePrompt}
                  className="w-full py-2.5 rounded-2xl bg-brand-50 hover:bg-brand-100 text-brand-700 text-xs font-bold flex items-center justify-center gap-2 transition"
                >
                  <Icon name="sparkles" size={15} />
                  <span>Optimize Prompt with AI</span>
                </button>
              </div>

              <div className="card p-6 bg-white border border-navy-100 rounded-3xl shadow-sm space-y-4">
                <button
                  onClick={handleGenerateAd}
                  disabled={generatingAd}
                  className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-700 hover:to-indigo-700 text-white font-black text-sm shadow-xl shadow-brand-500/25 flex items-center justify-center gap-2 transition hover:scale-[1.01] active:scale-95 disabled:opacity-50"
                >
                  <Icon name={generatingAd ? 'refresh-cw' : 'sparkles'} size={18} className={generatingAd ? 'animate-spin' : ''} />
                  <span>{generatingAd ? 'Generating Ultra HD Creative...' : 'Generate Marketing Ad Creative'}</span>
                </button>
              </div>
            </div>

            {/* Right Column: Creative Preview Canvas */}
            <div className="lg:col-span-6">
              <div className="card p-6 bg-white border border-navy-100 rounded-3xl shadow-sm space-y-5">
                <div className="flex items-center justify-between border-b border-navy-100 pb-3">
                  <h3 className="text-sm font-bold text-navy-900 flex items-center gap-2">
                    <Icon name="image" size={16} className="text-brand-600" />
                    Creative Preview Canvas
                  </h3>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                    Live Preview
                  </span>
                </div>

                {generatedAd ? (
                  <div className="space-y-4 animate-scale-in">
                    <div className="relative rounded-2xl overflow-hidden aspect-square bg-navy-950 border border-navy-200 shadow-md group">
                      <img
                        src={generatedAd.image_url}
                        alt="AI Ad Creative"
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/30" />
                      
                      <div className="absolute top-3 left-3 px-3 py-1 rounded-full bg-brand-600/90 text-white text-xs font-black backdrop-blur-md">
                        FITCLUB AI • SPONSORED PROMO
                      </div>

                      <div className="absolute bottom-3 inset-x-3 text-white space-y-1">
                        <h4 className="text-base font-black leading-tight drop-shadow">
                          {generatedAd.headline}
                        </h4>
                        <span className="text-[11px] text-amber-300 font-bold block">
                          50% OFF Annual Pass • Free Biometric Consultation
                        </span>
                      </div>
                    </div>

                    <div className="p-4 rounded-2xl bg-navy-50/70 border border-navy-100 space-y-2">
                      <span className="text-[10px] font-bold text-navy-400 uppercase tracking-wider block">
                        Generated Meta / Instagram Ad Copy:
                      </span>
                      <p className="text-xs text-navy-800 whitespace-pre-line leading-relaxed">
                        {generatedAd.caption}
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-3 pt-2">
                      <button
                        onClick={() => triggerToast('🚀 Published campaign to Meta Ads Manager!')}
                        className="py-3 px-4 rounded-2xl bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold shadow-md shadow-brand-500/20 flex items-center justify-center gap-2 transition"
                      >
                        <Icon name="send" size={15} /> Publish to Meta Ads
                      </button>

                      <button
                        onClick={() => triggerToast('💾 Saved creative to Media Library')}
                        className="py-3 px-4 rounded-2xl bg-navy-100 hover:bg-navy-200 text-navy-800 text-xs font-bold flex items-center justify-center gap-2 transition"
                      >
                        <Icon name="save" size={15} /> Save to Library
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="py-20 text-center space-y-3">
                    <div className="w-16 h-16 mx-auto rounded-3xl bg-navy-50 border border-navy-200/60 flex items-center justify-center text-navy-400">
                      <Icon name="image" size={32} />
                    </div>
                    <div className="space-y-1">
                      <h4 className="text-sm font-bold text-navy-900">Creative Preview Canvas</h4>
                      <p className="text-xs text-navy-400 max-w-xs mx-auto">
                        Generate a creative on the left. Your image, caption, and the full Meta pipeline — all in one place.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* 7. VIEW: SUPPORT TICKETS & CUSTOMER SERVICE (Screenshot 2 & 3) */}
      {/* ───────────────────────────────────────────────────────────── */}
      {activeSubTab === 'support_tickets' && (
        <div className="space-y-6 animate-fade-in">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-black text-navy-900 tracking-tight">Support Tickets</h2>
              <p className="text-xs text-navy-500">Manage, triage, and resolve customer support cases and technical inquiries.</p>
            </div>

            <div className="flex items-center gap-2.5">
              <button
                onClick={fetchData}
                className="p-2 rounded-xl bg-white hover:bg-navy-50 border border-navy-200 text-navy-700 shadow-sm transition"
                title="Refresh tickets"
              >
                <Icon name="refresh-cw" size={14} />
              </button>

              <button
                onClick={() => setNewTicketModalOpen(true)}
                className="px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold shadow-md shadow-brand-600/25 flex items-center gap-1.5 transition hover:scale-[1.02] active:scale-95"
              >
                <Icon name="plus" size={14} />
                <span>+ New Ticket</span>
              </button>
            </div>
          </div>

          {/* 4 Stat Metric Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="card p-5 bg-white border border-navy-100 rounded-2xl shadow-sm flex items-start justify-between">
              <div className="space-y-1">
                <span className="text-xs font-bold text-navy-600 block">Open Tickets</span>
                <span className="text-2xl font-black text-navy-900">{openTicketsCount}</span>
                <span className="text-[11px] text-brand-600 font-semibold block">Awaiting resolution</span>
              </div>
              <div className="w-8 h-8 rounded-full bg-brand-50 text-brand-600 flex items-center justify-center">
                <Icon name="info" size={16} />
              </div>
            </div>

            <div className="card p-5 bg-white border border-navy-100 rounded-2xl shadow-sm flex items-start justify-between">
              <div className="space-y-1">
                <span className="text-xs font-bold text-navy-600 block">High & Urgent</span>
                <span className="text-2xl font-black text-red-600">{urgentTicketsCount}</span>
                <span className="text-[11px] text-red-600 font-semibold block">Immediate triage needed</span>
              </div>
              <div className="w-8 h-8 rounded-full bg-red-50 text-red-600 flex items-center justify-center">
                <Icon name="flag" size={16} />
              </div>
            </div>

            <div className="card p-5 bg-white border border-navy-100 rounded-2xl shadow-sm flex items-start justify-between">
              <div className="space-y-1">
                <span className="text-xs font-bold text-navy-600 block">In Progress</span>
                <span className="text-2xl font-black text-navy-900">{inProgressTicketsCount}</span>
                <span className="text-[11px] text-amber-600 font-semibold block">Actively being worked</span>
              </div>
              <div className="w-8 h-8 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center">
                <Icon name="clock" size={16} />
              </div>
            </div>

            <div className="card p-5 bg-white border border-navy-100 rounded-2xl shadow-sm flex items-start justify-between">
              <div className="space-y-1">
                <span className="text-xs font-bold text-navy-600 block">Resolved</span>
                <span className="text-2xl font-black text-emerald-600">{resolvedTicketsCount}</span>
                <span className="text-[11px] text-emerald-600 font-semibold block">Successfully closed</span>
              </div>
              <div className="w-8 h-8 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <Icon name="check-circle" size={16} />
              </div>
            </div>
          </div>

          {/* Filter & Search Bar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="relative w-full sm:w-80">
              <Icon name="search" size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-navy-400" />
              <input
                type="text"
                placeholder="Search by subject, customer, ticket ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-3 py-2 rounded-xl bg-white border border-navy-200 text-xs font-semibold text-navy-900 focus:outline-none focus:ring-2 focus:ring-brand-500 shadow-sm"
              />
            </div>

            <div className="flex items-center gap-2 self-end sm:self-auto flex-wrap">
              {['All', 'Open', 'In Progress', 'Resolved', 'Closed'].map((st) => (
                <button
                  key={st}
                  onClick={() => setTicketFilterStatus(st)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                    ticketFilterStatus === st
                      ? 'bg-brand-600 text-white shadow-sm'
                      : 'bg-white hover:bg-navy-50 text-navy-600 border border-navy-200'
                  }`}
                >
                  {st}
                </button>
              ))}

              <select
                value={ticketFilterCategory}
                onChange={(e) => setTicketFilterCategory(e.target.value)}
                className="px-3 py-1.5 rounded-xl bg-white border border-navy-200 text-xs font-semibold text-navy-700 shadow-sm"
              >
                <option value="All Categories">All Categories</option>
                <option value="General Support">General Support</option>
                <option value="Billing & Payment">Billing & Payment</option>
                <option value="Trainer / Service">Trainer / Service</option>
                <option value="Equipment / Facility">Equipment / Facility</option>
              </select>
            </div>
          </div>

          {filteredTickets.length === 0 ? (
            <div className="card p-16 bg-white border border-navy-100 rounded-3xl shadow-sm text-center space-y-4">
              <div className="w-16 h-16 mx-auto rounded-3xl bg-navy-50 flex items-center justify-center text-navy-400">
                <Icon name="message-square" size={32} />
              </div>
              <div className="space-y-1">
                <h4 className="text-base font-bold text-navy-900">No Support Tickets Found</h4>
                <p className="text-xs text-navy-400">No support tickets have been created yet. Click '+ New Ticket' to create one.</p>
              </div>
              <button
                onClick={() => setNewTicketModalOpen(true)}
                className="px-6 py-2.5 rounded-2xl bg-brand-600 hover:bg-brand-700 text-white font-bold text-xs shadow-md transition"
              >
                + New Ticket
              </button>
            </div>
          ) : (
            <div className="card overflow-hidden bg-white border border-navy-100 rounded-2xl shadow-sm">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-navy-100 bg-navy-50/50 text-[11px] font-bold text-navy-400 uppercase tracking-wider">
                    <th className="py-3 px-4">TICKET ID / SUBJECT</th>
                    <th className="py-3 px-4">CUSTOMER</th>
                    <th className="py-3 px-4">CATEGORY</th>
                    <th className="py-3 px-4">PRIORITY</th>
                    <th className="py-3 px-4">STATUS</th>
                    <th className="py-3 px-4">CREATED</th>
                    <th className="py-3 px-4 text-right">ACTION</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-navy-100 text-xs">
                  {filteredTickets.map((t) => (
                    <tr key={t.id} className="hover:bg-navy-50/40 transition">
                      <td className="py-3.5 px-4 font-bold text-navy-900">
                        <span className="text-[10px] text-navy-400 font-mono block">#{t.id}</span>
                        {t.subject}
                      </td>
                      <td className="py-3.5 px-4 text-navy-700 font-semibold">{t.customer_name}</td>
                      <td className="py-3.5 px-4 text-navy-600">{t.category}</td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                            t.priority === 'Urgent' || t.priority === 'High'
                              ? 'bg-red-50 text-red-700 border border-red-200'
                              : 'bg-navy-50 text-navy-700'
                          }`}
                        >
                          {t.priority}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            t.status === 'Resolved'
                              ? 'bg-emerald-50 text-emerald-700'
                              : t.status === 'In Progress'
                              ? 'bg-amber-50 text-amber-700'
                              : 'bg-blue-50 text-blue-700'
                          }`}
                        >
                          {t.status}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-navy-400 text-[11px]">{t.created_at}</td>
                      <td className="py-3.5 px-4 text-right">
                        <button
                          onClick={async () => {
                            await apiClient.patch(`/crm/tickets/${t.id}/status`, { status: t.status === 'Resolved' ? 'Open' : 'Resolved' });
                            fetchData();
                            triggerToast('Ticket status updated!');
                          }}
                          className="px-2.5 py-1 rounded-xl bg-navy-100 hover:bg-navy-200 text-navy-700 font-bold text-[11px] transition"
                        >
                          {t.status === 'Resolved' ? 'Reopen' : 'Resolve'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* 8. VIEW: LEADS & SALES PIPELINE (Kanban & List)               */}
      {/* ───────────────────────────────────────────────────────────── */}
      {activeSubTab === 'leads' && (
        <div className="space-y-6 animate-fade-in">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-black text-navy-900 tracking-tight">Leads & Prospects</h2>
              <p className="text-xs text-navy-500">Track and convert incoming gym inquiries into active members</p>
            </div>
            <button
              onClick={() => setNewLeadModalOpen(true)}
              className="btn-primary py-2 px-4 text-xs font-bold flex items-center gap-1.5"
            >
              <Icon name="plus" size={14} /> + New Lead
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {leads.map((l) => (
              <div key={l.id} className="card p-5 bg-white border border-navy-100 rounded-2xl shadow-sm space-y-3 hover:shadow-md transition">
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="text-sm font-bold text-navy-900">{l.name}</h4>
                    <span className="text-xs text-navy-400 font-semibold">{l.phone}</span>
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full bg-brand-50 text-brand-700 text-[10px] font-bold uppercase">
                    {l.status}
                  </span>
                </div>

                <div className="space-y-1 text-xs">
                  <div className="flex justify-between text-navy-500">
                    <span>Source:</span>
                    <span className="font-bold text-navy-800">{l.source}</span>
                  </div>
                  <div className="flex justify-between text-navy-500">
                    <span>Interest:</span>
                    <span className="font-bold text-navy-800">{l.interest}</span>
                  </div>
                  <div className="flex justify-between text-navy-500">
                    <span>Probability:</span>
                    <span className="font-bold text-emerald-600">{l.probability}%</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-2 border-t border-navy-50">
                  <button
                    onClick={() => {
                      setCallForm({ contact_name: l.name, phone: l.phone, objective: 'Membership Consultation' });
                      setNewCallModalOpen(true);
                    }}
                    className="flex-1 py-1.5 rounded-xl bg-purple-50 hover:bg-purple-100 text-purple-700 text-xs font-bold flex items-center justify-center gap-1 transition"
                  >
                    <Icon name="phone" size={12} /> AI Call
                  </button>
                  <button
                    onClick={() => handleUpdateLeadStatus(l.id, l.status === 'enrollment' ? 'active' : 'enrollment')}
                    className="flex-1 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-bold flex items-center justify-center gap-1 transition"
                  >
                    <Icon name="check" size={12} /> Convert
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* 9. VIEW: SALES PIPELINE (Kanban Funnel)                       */}
      {/* ───────────────────────────────────────────────────────────── */}
      {activeSubTab === 'pipeline' && (
        <div className="space-y-6 animate-fade-in">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-black text-navy-900 tracking-tight">Sales Funnel & Pipeline</h2>
              <p className="text-xs text-navy-500">Stage-by-stage gym membership deal flow & revenue projections</p>
            </div>
            <button
              onClick={() => setNewLeadModalOpen(true)}
              className="btn-primary py-2 px-4 text-xs font-bold flex items-center gap-1.5"
            >
              <Icon name="plus" size={14} /> + New Deal
            </button>
          </div>

          <div className="flex gap-4 overflow-x-auto pb-6">
            {[
              { key: 'lead', label: 'Prospects', color: 'bg-navy-500' },
              { key: 'trial', label: 'Trial Scheduled', color: 'bg-cyan-500' },
              { key: 'follow_up', label: 'Follow Up', color: 'bg-amber-500' },
              { key: 'negotiation', label: 'Negotiation', color: 'bg-purple-500' },
              { key: 'enrollment', label: 'Closing & KYC', color: 'bg-brand-500' },
              { key: 'active', label: 'Active Members', color: 'bg-emerald-600' },
            ].map((col) => {
              const colLeads = leads.filter((l) => l.status === col.key);
              return (
                <div key={col.key} className="min-w-[260px] flex-1 card p-3.5 bg-navy-50/50 border border-navy-100 rounded-2xl space-y-3">
                  <div className="flex items-center justify-between border-b border-navy-200/60 pb-2 px-1">
                    <div className="flex items-center gap-2">
                      <span className={`w-2.5 h-2.5 rounded-full ${col.color}`} />
                      <span className="text-xs font-black text-navy-900">{col.label}</span>
                    </div>
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-white text-navy-700 shadow-xs">
                      {colLeads.length}
                    </span>
                  </div>

                  <div className="space-y-2.5 min-h-[300px]">
                    {colLeads.map((l) => (
                      <div key={l.id} className="card p-3.5 bg-white border border-navy-100 rounded-xl shadow-sm space-y-2 hover:border-brand-500/50 transition">
                        <div className="flex items-start justify-between">
                          <h5 className="text-xs font-bold text-navy-900">{l.name}</h5>
                          <span className="text-[10px] font-extrabold text-emerald-600">
                            ₹{l.deal_value?.toLocaleString()}
                          </span>
                        </div>
                        <p className="text-[11px] text-navy-500 leading-snug">{l.interest}</p>
                        <div className="flex items-center justify-between text-[10px] text-navy-400 pt-1 border-t border-navy-50">
                          <span>{l.phone}</span>
                          <span className="font-bold text-brand-600">{l.probability}% win</span>
                        </div>
                      </div>
                    ))}
                    {colLeads.length === 0 && (
                      <div className="text-center py-12 text-xs text-navy-300">No deals in this stage</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* 10. VIEW: OPPORTUNITIES, DEALS, QUOTATIONS, DISCOUNTS         */}
      {/* ───────────────────────────────────────────────────────────── */}
      {['opportunities', 'deals', 'quotations', 'sales_orders', 'discounts', 'complaints', 'returns', 'feedback', 'timeline', 'churn_predictor', 'lead_scoring', 'sentiment_analysis', 'ltv_forecast', 'social_dashboard', 'ad_history'].includes(activeSubTab) && (
        <div className="space-y-6 animate-fade-in">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-black text-navy-900 tracking-tight capitalize">
                {activeSubTab.replace(/_/g, ' ')}
              </h2>
              <p className="text-xs text-navy-500">
                Manage {activeSubTab.replace(/_/g, ' ')} analytics and operational records in real time.
              </p>
            </div>
            <button
              onClick={fetchData}
              className="px-3.5 py-2 rounded-xl bg-white hover:bg-navy-50 border border-navy-200 text-navy-700 text-xs font-bold shadow-sm flex items-center gap-1.5 transition"
            >
              <Icon name="refresh-cw" size={14} /> Refresh
            </button>
          </div>

          {/* Dynamic Table / Cards depending on sub-tab */}
          {activeSubTab === 'discounts' ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {[
                { code: 'EARLYBIRD50', desc: '50% off first month gym pass for early registrations', discount: '50% OFF', status: 'ACTIVE' },
                { code: 'ANNUALVIP30', desc: 'Flat 30% savings on 12-month transformation membership', discount: '30% OFF', status: 'ACTIVE' },
                { code: 'PTTRIAL100', desc: '100% complimentary 1-on-1 personal training trial session', discount: 'FREE PASS', status: 'ACTIVE' },
              ].map((c) => (
                <div key={c.code} className="card p-5 bg-white border border-navy-100 rounded-2xl shadow-sm space-y-3">
                  <div className="flex items-start justify-between">
                    <span className="px-3 py-1 rounded-xl bg-brand-50 text-brand-700 text-xs font-black font-mono border border-brand-200">
                      {c.code}
                    </span>
                    <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-bold">
                      {c.status}
                    </span>
                  </div>
                  <div className="text-base font-black text-navy-900">{c.discount}</div>
                  <p className="text-xs text-navy-500 leading-snug">{c.desc}</p>
                </div>
              ))}
            </div>
          ) : activeSubTab === 'churn_predictor' ? (
            <div className="card p-6 bg-white border border-navy-100 rounded-2xl shadow-sm space-y-4">
              <h3 className="text-sm font-bold text-navy-900">Member Retention & Churn Risk Matrix</h3>
              <div className="space-y-2">
                {customers.map((c) => {
                  const isLowRisk = (c.status || '').toUpperCase() === 'ACTIVE';
                  return (
                    <div key={c.id} className="p-3.5 rounded-xl bg-navy-50/70 border border-navy-100 flex items-center justify-between">
                      <div>
                        <span className="font-bold text-navy-900 text-xs block">{c.full_name || c.name}</span>
                        <span className="text-[11px] text-navy-400">Plan: {c.membership || 'Standard'} • Attendance: {c.attendance || 0} visits</span>
                      </div>
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase ${isLowRisk ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}`}>
                        {isLowRisk ? 'Low Churn Risk' : 'High Churn Risk (Inactive)'}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="card overflow-hidden bg-white border border-navy-100 rounded-2xl shadow-sm">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-navy-100 bg-navy-50/50 text-[11px] font-bold text-navy-400 uppercase tracking-wider">
                    <th className="py-3 px-4">RECORD / TARGET</th>
                    <th className="py-3 px-4">STAGE & STATUS</th>
                    <th className="py-3 px-4">VALUATION / SCORE</th>
                    <th className="py-3 px-4 text-right">ACTION</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-navy-100 text-xs">
                  {leads.map((l) => (
                    <tr key={l.id} className="hover:bg-navy-50/40 transition">
                      <td className="py-3.5 px-4 font-bold text-navy-900">
                        {l.name}
                        <span className="text-[11px] text-navy-400 font-normal block">{l.interest}</span>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="px-2 py-0.5 rounded-full bg-navy-100 text-navy-800 text-[10px] font-bold uppercase">
                          {l.stage || l.status}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 font-black text-emerald-600">
                        ₹{l.deal_value?.toLocaleString()}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <button
                          onClick={() => {
                            setCallForm({ contact_name: l.name, phone: l.phone, objective: 'Outreach Followup' });
                            setNewCallModalOpen(true);
                          }}
                          className="px-2.5 py-1 rounded-xl bg-purple-50 hover:bg-purple-100 text-purple-700 text-[11px] font-bold transition"
                        >
                          AI Call
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* MODAL: START AI VOICE CALL (Screenshot 4)                    */}
      {/* ───────────────────────────────────────────────────────────── */}
      {newCallModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white rounded-3xl p-6 shadow-2xl space-y-5 animate-scale-in">
            <div className="flex items-center justify-between border-b border-navy-100 pb-3">
              <h3 className="text-base font-bold text-navy-900 flex items-center gap-2">
                <Icon name="phone" size={18} className="text-brand-600" />
                Start AI Voice Outreach Call
              </h3>
              <button onClick={() => setNewCallModalOpen(false)} className="text-navy-400 hover:text-navy-900">
                <Icon name="x" size={18} />
              </button>
            </div>

            {callingState === 'idle' ? (
              <div className="space-y-4">
                {/* Dynamic Contact Picker from Leads and Customers */}
                {(leads.length > 0 || customers.length > 0) && (
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-navy-700 block">
                      Select Contact (Lead or Registered Member)
                    </label>
                    <select
                      onChange={(e) => {
                        const selectedLead = leads.find((l) => l.id === e.target.value);
                        if (selectedLead) {
                          setCallForm({
                            contact_name: selectedLead.name,
                            phone: selectedLead.phone,
                            objective: selectedLead.interest ? `${selectedLead.interest} Consultation` : 'Membership Consultation & Trial Pass',
                          });
                          return;
                        }
                        const selectedCust = customers.find((c) => c.id === e.target.value);
                        if (selectedCust) {
                          setCallForm({
                            contact_name: selectedCust.full_name || selectedCust.name || 'Member',
                            phone: selectedCust.phone || '',
                            objective: 'Member Progress & Workout Consultation',
                          });
                        }
                      }}
                      defaultValue=""
                      className="w-full p-2.5 rounded-xl bg-brand-50/50 border border-brand-200 text-xs font-semibold text-navy-900"
                    >
                      <option value="">-- Choose contact to auto-fill --</option>
                      {leads.map((l) => (
                        <option key={l.id} value={l.id}>
                          [LEAD] {l.name} ({l.phone}) • {l.stage || l.status}
                        </option>
                      ))}
                      {customers.map((c) => (
                        <option key={c.id} value={c.id}>
                          [MEMBER] {c.full_name || c.name} ({c.phone || 'No phone'})
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="space-y-1">
                  <label className="text-xs font-bold text-navy-700 block">Contact / Member Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="Enter contact full name..."
                    value={callForm.contact_name}
                    onChange={(e) => setCallForm({ ...callForm, contact_name: e.target.value })}
                    className="w-full p-2.5 rounded-xl bg-navy-50 border border-navy-200 text-xs font-bold text-navy-900 focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-navy-700 block">Phone Number *</label>
                  <input
                    type="tel"
                    required
                    placeholder="Enter 10-digit mobile number..."
                    value={callForm.phone}
                    onChange={(e) => setCallForm({ ...callForm, phone: e.target.value })}
                    className="w-full p-2.5 rounded-xl bg-navy-50 border border-navy-200 text-xs font-bold text-navy-900 font-mono focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-navy-700 block">Call Consultation Objective</label>
                  <input
                    type="text"
                    placeholder="e.g. 6-Month Personal Training Consultation & Trial Pass"
                    value={callForm.objective}
                    onChange={(e) => setCallForm({ ...callForm, objective: e.target.value })}
                    className="w-full p-2.5 rounded-xl bg-navy-50 border border-navy-200 text-xs font-bold text-navy-900"
                  />
                </div>

                <button
                  onClick={handleStartCall}
                  className="w-full py-3 rounded-2xl bg-brand-600 hover:bg-brand-700 text-white font-bold text-xs shadow-md transition"
                >
                  Dial & Connect AI Voice Agent
                </button>
              </div>
            ) : (
              /* Calling In-Progress View */
              <div className="py-8 text-center space-y-4">
                <div className="w-20 h-20 mx-auto rounded-full bg-brand-500/20 text-brand-600 flex items-center justify-center animate-pulse">
                  <Icon name="phone" size={36} />
                </div>
                <div>
                  <h4 className="text-base font-black text-navy-900">{callForm.contact_name}</h4>
                  <span className="text-xs text-navy-400 font-mono">{callForm.phone}</span>
                </div>
                <div className="flex items-center justify-center gap-1 text-xs font-bold text-brand-600">
                  <span className="w-2 h-2 rounded-full bg-brand-600 animate-ping" />
                  {callingState === 'dialing' && 'Connecting to carrier network...'}
                  {callingState === 'connected' && 'AI Voice Agent Conversing in Real Time...'}
                  {callingState === 'completed' && 'Call Completed! Generating AI Transcript...'}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* MODAL: TRANSCRIPT VIEWER (Screenshot 4)                       */}
      {/* ───────────────────────────────────────────────────────────── */}
      {transcriptModalOpen && selectedCallLog && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-xl bg-white rounded-3xl p-6 shadow-2xl space-y-5 animate-scale-in">
            <div className="flex items-center justify-between border-b border-navy-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-navy-900 flex items-center gap-2">
                  <Icon name="headphones" size={18} className="text-brand-600" />
                  Voice Call Transcript — {selectedCallLog.contact_name}
                </h3>
                <span className="text-[11px] text-navy-400 font-semibold">{selectedCallLog.created_at} • {selectedCallLog.duration_formatted}</span>
              </div>
              <button onClick={() => setTranscriptModalOpen(false)} className="text-navy-400 hover:text-navy-900">
                <Icon name="x" size={18} />
              </button>
            </div>

            {/* Score & Sentiment Badges */}
            <div className="flex items-center gap-3 p-3 rounded-2xl bg-navy-50 border border-navy-100">
              <span className="text-xs font-bold text-navy-700">Qualification Score:</span>
              <span className="px-2.5 py-0.5 rounded-full bg-brand-600 text-white text-xs font-black">
                {selectedCallLog.qualification_score}/100
              </span>
              <span className="text-xs font-bold text-navy-700 ml-auto">Sentiment:</span>
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold">
                {selectedCallLog.sentiment}
              </span>
            </div>

            {/* Transcript Text Box */}
            <div className="p-4 rounded-2xl bg-navy-900 text-navy-100 text-xs font-mono whitespace-pre-line leading-relaxed max-h-64 overflow-y-auto">
              {selectedCallLog.transcript || selectedCallLog.ai_summary}
            </div>

            {/* Action Items */}
            {selectedCallLog.action_items && selectedCallLog.action_items.length > 0 && (
              <div className="space-y-1.5">
                <span className="text-xs font-bold text-navy-900 block">AI Detected Action Items:</span>
                {selectedCallLog.action_items.map((it, idx) => (
                  <div key={idx} className="p-2 rounded-xl bg-emerald-50 text-emerald-800 text-xs font-semibold flex items-center gap-2 border border-emerald-200">
                    <Icon name="check-circle" size={14} className="text-emerald-600 shrink-0" />
                    <span>{it}</span>
                  </div>
                ))}
              </div>
            )}

            <button
              onClick={() => setTranscriptModalOpen(false)}
              className="w-full py-2.5 rounded-2xl bg-navy-100 hover:bg-navy-200 text-navy-800 text-xs font-bold transition"
            >
              Close Transcript
            </button>
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* MODAL: CREATE SUPPORT TICKET (Screenshot 2)                   */}
      {/* ───────────────────────────────────────────────────────────── */}
      {newTicketModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-white rounded-3xl p-6 shadow-2xl space-y-5 animate-scale-in">
            <div className="flex items-center justify-between border-b border-navy-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center">
                  <Icon name="message-square" size={16} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-navy-900">Create Support Ticket</h3>
                  <p className="text-[11px] text-navy-400">Log a new customer case or service inquiry</p>
                </div>
              </div>
              <button onClick={() => setNewTicketModalOpen(false)} className="text-navy-400 hover:text-navy-900">
                <Icon name="x" size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateTicket} className="space-y-4 text-xs">
              <div className="space-y-1">
                <label className="font-bold text-navy-700 block">Customer / Account (Optional)</label>
                {customers.length > 0 || leads.length > 0 ? (
                  <select
                    value={ticketForm.customer_name}
                    onChange={(e) => setTicketForm({ ...ticketForm, customer_name: e.target.value })}
                    className="w-full p-2.5 rounded-xl bg-navy-50 border border-navy-200 text-xs font-semibold text-navy-900"
                  >
                    <option value="">-- General Inquiry / Unassigned Customer --</option>
                    {customers.map((c) => (
                      <option key={c.id} value={c.full_name || c.name}>
                        {c.full_name || c.name} ({c.phone || c.email || 'Member'})
                      </option>
                    ))}
                    {leads.map((l) => (
                      <option key={l.id} value={l.name}>
                        [LEAD] {l.name} ({l.phone})
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    placeholder="Enter customer name or ID..."
                    value={ticketForm.customer_name}
                    onChange={(e) => setTicketForm({ ...ticketForm, customer_name: e.target.value })}
                    className="w-full p-2.5 rounded-xl bg-navy-50 border border-navy-200 text-xs font-semibold text-navy-900"
                  />
                )}
              </div>

              <div className="space-y-1">
                <label className="font-bold text-navy-700 block">Subject / Issue Title *</label>
                <input
                  type="text"
                  required
                  placeholder="Enter ticket subject or inquiry title..."
                  value={ticketForm.subject}
                  onChange={(e) => setTicketForm({ ...ticketForm, subject: e.target.value })}
                  className="w-full p-2.5 rounded-xl bg-navy-50 border border-navy-200 text-xs font-semibold text-navy-900"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-navy-700 block">Category</label>
                  <select
                    value={ticketForm.category}
                    onChange={(e) => setTicketForm({ ...ticketForm, category: e.target.value })}
                    className="w-full p-2.5 rounded-xl bg-navy-50 border border-navy-200 text-xs font-semibold text-navy-900"
                  >
                    <option value="General Support">General Support</option>
                    <option value="Billing & Payment">Billing & Payment</option>
                    <option value="Trainer / Service">Trainer / Service</option>
                    <option value="Equipment / Facility">Equipment / Facility</option>
                    <option value="Membership Freeze">Membership Freeze</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-navy-700 block">Priority</label>
                  <select
                    value={ticketForm.priority}
                    onChange={(e) => setTicketForm({ ...ticketForm, priority: e.target.value })}
                    className="w-full p-2.5 rounded-xl bg-navy-50 border border-navy-200 text-xs font-semibold text-navy-900"
                  >
                    <option value="Low">Low</option>
                    <option value="Medium">Medium</option>
                    <option value="High">High</option>
                    <option value="Urgent">Urgent</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-navy-700 block">Description & Customer Notes *</label>
                <textarea
                  rows={4}
                  required
                  placeholder="Describe the issue, customer message, or troubleshooting steps..."
                  value={ticketForm.description}
                  onChange={(e) => setTicketForm({ ...ticketForm, description: e.target.value })}
                  className="w-full p-3 rounded-2xl bg-navy-50 border border-navy-200 text-xs font-semibold text-navy-900"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setNewTicketModalOpen(false)}
                  className="px-4 py-2.5 rounded-2xl bg-navy-100 hover:bg-navy-200 text-navy-700 font-bold transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-2xl bg-brand-600 hover:bg-brand-700 text-white font-bold shadow-md transition"
                >
                  + Create Ticket
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* MODAL: ADD NEW LEAD                                           */}
      {/* ───────────────────────────────────────────────────────────── */}
      {newLeadModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white rounded-3xl p-6 shadow-2xl space-y-4 animate-scale-in">
            <div className="flex items-center justify-between border-b border-navy-100 pb-3">
              <h3 className="text-base font-bold text-navy-900">Add Prospective Lead</h3>
              <button onClick={() => setNewLeadModalOpen(false)} className="text-navy-400 hover:text-navy-900">
                <Icon name="x" size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateLead} className="space-y-3.5 text-xs">
              <div className="space-y-1">
                <label className="font-bold text-navy-700">Full Name *</label>
                <input
                  type="text"
                  required
                  placeholder="Enter prospect full name..."
                  value={leadForm.name}
                  onChange={(e) => setLeadForm({ ...leadForm, name: e.target.value })}
                  className="w-full p-2.5 rounded-xl bg-navy-50 border border-navy-200 text-xs font-bold text-navy-900"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="font-bold text-navy-700">Phone Number *</label>
                  <input
                    type="tel"
                    required
                    placeholder="Enter mobile number..."
                    value={leadForm.phone}
                    onChange={(e) => setLeadForm({ ...leadForm, phone: e.target.value })}
                    className="w-full p-2.5 rounded-xl bg-navy-50 border border-navy-200 text-xs font-bold text-navy-900 font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-bold text-navy-700">Estimated Deal Value (₹)</label>
                  <input
                    type="number"
                    value={leadForm.deal_value}
                    onChange={(e) => setLeadForm({ ...leadForm, deal_value: parseFloat(e.target.value) || 0 })}
                    className="w-full p-2.5 rounded-xl bg-navy-50 border border-navy-200 text-xs font-bold text-navy-900"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-navy-700">Lead Acquisition Source</label>
                <select
                  value={leadForm.source}
                  onChange={(e) => setLeadForm({ ...leadForm, source: e.target.value })}
                  className="w-full p-2.5 rounded-xl bg-navy-50 border border-navy-200 text-xs font-bold text-navy-900"
                >
                  <option value="Instagram Ad">Instagram Ad</option>
                  <option value="Google Search">Google Search</option>
                  <option value="WhatsApp Campaign">WhatsApp Campaign</option>
                  <option value="Walk-in">Walk-in</option>
                  <option value="Referral">Member Referral</option>
                  <option value="Website Direct">Website Direct</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-navy-700">Fitness Interest / Goal</label>
                <input
                  type="text"
                  placeholder="e.g. Weight Loss, Muscle Hypertrophy, Diet Planning..."
                  value={leadForm.interest}
                  onChange={(e) => setLeadForm({ ...leadForm, interest: e.target.value })}
                  className="w-full p-2.5 rounded-xl bg-navy-50 border border-navy-200 text-xs font-semibold text-navy-900"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setNewLeadModalOpen(false)}
                  className="px-4 py-2.5 rounded-2xl bg-navy-100 hover:bg-navy-200 text-navy-700 font-bold transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-2xl bg-brand-600 hover:bg-brand-700 text-white font-bold shadow-md transition"
                >
                  Save Lead
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* ───────────────────────────────────────────────────────────── */}
      {/* OFFICIAL CUSTOMER ENROLLMENT MODAL (STEP 3: BIOMETRICS)       */}
      {/* ───────────────────────────────────────────────────────────── */}
      {enrollModalOpen && selectedEnrollMember && (
        <EnrollmentModal
          open={enrollModalOpen}
          personType="member"
          initialStep={3}
          initialMember={{
            id: selectedEnrollMember.id,
            name: selectedEnrollMember.full_name || selectedEnrollMember.name,
            email: selectedEnrollMember.email,
            phone: selectedEnrollMember.phone,
            goal: selectedEnrollMember.goal,
            branch: selectedEnrollMember.branch,
          }}
          onClose={() => setEnrollModalOpen(false)}
          onSuccess={() => {
            setEnrollModalOpen(false);
            fetchData();
            triggerToast(`🎉 Biometric hardware enrolled & synced for ${selectedEnrollMember.full_name || selectedEnrollMember.name}!`);
          }}
        />
      )}
    </div>
  );
}
