import React, { useState, useEffect, useMemo } from "react";
import { 
  Lead, 
  PipelineStage, 
  TelecallerTargetToday, 
  NextActionItem, 
  DailyQueueItem, 
  api 
} from "../services/api";
import { openGmail, openWhatsApp } from "../utils/mailHelper";
import { format10DigitPhone } from "../utils/phoneHelper";
import { LeadDetailModal } from "./LeadDetailModal";
import { 
  PhoneCall, 
  MessageCircle, 
  Mail, 
  ShieldCheck, 
  Flame, 
  Check, 
  ChevronRight,
  Lock,
  RefreshCw,
  Search,
  ExternalLink,
  Clock,
  Calendar,
  CreditCard,
  AlertCircle,
  Play,
  Coffee,
  CheckCircle2,
  Sparkles,
  ArrowRight,
  X
} from "lucide-react";

export const TelecallerDesk: React.FC = () => {
  const maskPhone = (phone: string | undefined) => {
    if (!phone) return "No phone";
    const p = phone.replace(/\D/g, "");
    if (p.length >= 10) {
      return `+91 ${p.substring(p.length - 10, p.length - 8)}****${p.substring(p.length - 4)}`;
    }
    return "Masked";
  };

  const maskEmail = (email: string | undefined) => {
    if (!email) return "No email";
    const [name, domain] = email.split('@');
    if (!domain) return "Masked";
    return `${name.substring(0, 2)}***@${domain}`;
  };

  // Helper to detect Indian Landlines deterministically per DoT / TRAI
  const isLandlineNumber = (phone: string | undefined | null): boolean => {
    if (!phone) return false;
    const digits = phone.replace(/\D/g, "");
    const clean10 = digits.length >= 10 ? digits.slice(-10) : digits;
    return /^[1-5]\d{7,9}$/.test(clean10);
  };

  const [leads, setLeads] = useState<Lead[]>([]);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  
  // Segmented filters (Problems 6 & 20)
  const [activeSegment, setActiveSegment] = useState<string>("ALL"); // ALL, B2B, B2C
  const [activeStageFilter, setActiveStageFilter] = useState<string>("ALL"); // ALL, NEW, CONTACTED, INTERESTED, HOT, WARM, COLD

  const [copiedEmail, setCopiedEmail] = useState<string | null>(null);
  
  // Post-Call Outcome & Soft-Block Enforcement (Problem 5)
  const [isInCall, setIsInCall] = useState(false);
  const [outcome, setOutcome] = useState<string>("CONNECTED");
  const [notes, setNotes] = useState("");
  const [followupPreset, setFollowupPreset] = useState<string>("tomorrow");
  const [loggingOutcome, setLoggingOutcome] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [softBlockAttemptedLead, setSoftBlockAttemptedLead] = useState<Lead | null>(null);

  // Targets & Real-time Progress (Problem 2)
  const [targets, setTargets] = useState<TelecallerTargetToday | null>(null);

  // Next Best Action (Problems 16 & 17)
  const [nextActions, setNextActions] = useState<NextActionItem[]>([]);
  const [showNextActions, setShowNextActions] = useState(true);

  // Daily Queue (Problem 18)
  const [dailyQueue, setDailyQueue] = useState<DailyQueueItem[]>([]);

  // Pre-call context & details
  const [preCallContext, setPreCallContext] = useState<any>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [stages, setStages] = useState<PipelineStage[]>([]);

  // Shift & Attendance Tracking (Problem 11)
  const [shiftStatus, setShiftStatus] = useState<"ACTIVE" | "ON_BREAK" | "OFFLINE">("OFFLINE");
  const [shiftTimer, setShiftTimer] = useState<string>("00:00:00");
  const [shiftStartTimestamp, setShiftStartTimestamp] = useState<Date | null>(null);

  useEffect(() => {
    let interval: ReturnType<typeof setTimeout>;
    if (shiftStatus === "ACTIVE" && shiftStartTimestamp) {
      interval = setInterval(() => {
        const now = new Date();
        const diffInSeconds = Math.floor((now.getTime() - shiftStartTimestamp.getTime()) / 1000);
        const hours = Math.floor(diffInSeconds / 3600);
        const minutes = Math.floor((diffInSeconds % 3600) / 60);
        const seconds = diffInSeconds % 60;
        setShiftTimer(`${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [shiftStatus, shiftStartTimestamp]);

  // Dynamic Payment Link Modal (Problem 19)
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState<number>(5000);
  const [generatedPaymentLink, setGeneratedPaymentLink] = useState<string | null>(null);
  const [generatingPayment, setGeneratingPayment] = useState(false);

  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    loadShiftStatus();
    loadMyLeads();
    loadTargets();
    loadNextActions();
    loadDailyQueue();
    loadStages();
  };

  const loadShiftStatus = async () => {
    try {
      const res = await api.getShiftStatus();
      if (res.is_active) {
        setShiftStatus(res.is_on_break ? "ON_BREAK" : "ACTIVE");
        if (res.shift_started_at) {
          setShiftStartTimestamp(new Date(res.shift_started_at));
        }
      } else {
        setShiftStatus("OFFLINE");
      }
    } catch (e) {
      console.error("Failed to load shift status:", e);
    }
  };

  const loadStages = async () => {
    try {
      const data = await api.getPipeline();
      setStages(data?.stages || []);
    } catch (e) {
      console.error("Error loading stages:", e);
    }
  };

  const loadTargets = async () => {
    try {
      const data = await api.getTelecallerTargetsToday();
      setTargets(data);
    } catch (e) {
      console.error("Error loading daily targets:", e);
    }
  };

  const loadNextActions = async () => {
    try {
      const data = await api.getTelecallerNextActions();
      setNextActions(data || []);
    } catch (e) {
      console.error("Error loading next best actions:", e);
    }
  };

  const loadDailyQueue = async () => {
    try {
      const data = await api.getTelecallerDailyQueue();
      setDailyQueue(data || []);
    } catch (e) {
      console.error("Error loading daily queue:", e);
    }
  };

  useEffect(() => {
    if (selectedLead) {
      loadPreCallContext(selectedLead.id);
    }
  }, [selectedLead]);

  const loadPreCallContext = async (id: string) => {
    try {
      const data = await api.getPreCallContext(id);
      setPreCallContext(data);
    } catch (e) {
      console.error("Failed to load pre-call context:", e);
    }
  };

  const loadMyLeads = async () => {
    setLoading(true);
    try {
      const data = await api.getLeads();
      setLeads(data || []);
      if (data && data.length > 0 && !selectedLead) {
        setSelectedLead(data[0]);
      }
    } catch (e) {
      console.error("Error loading leads in telecaller desk:", e);
    } finally {
      setLoading(false);
    }
  };

  // Filtered leads based on search query, B2B/B2C segment, and stage/type filter
  const filteredLeads = useMemo(() => {
    return leads.filter((lead) => {
      // 1. Segment filter (Problem 20)
      if (activeSegment !== "ALL") {
        if (lead.segment && lead.segment.toUpperCase() !== activeSegment) return false;
      }

      // 2. Stage/Type filter (Problem 6)
      if (activeStageFilter !== "ALL") {
        if (activeStageFilter === "HOT") {
          if (lead.priority !== "URGENT" && lead.priority !== "HIGH") return false;
        } else if (activeStageFilter === "WARM") {
          if (lead.priority !== "MEDIUM") return false;
        } else if (activeStageFilter === "COLD") {
          if (lead.priority !== "LOW") return false;
        } else if (activeStageFilter === "NEW") {
          if (lead.status !== "NEW" && (!lead.stage || !lead.stage.name.toLowerCase().includes("new"))) return false;
        } else if (activeStageFilter === "CONTACTED") {
          if (!lead.stage || !lead.stage.name.toLowerCase().includes("contacted")) return false;
        } else if (activeStageFilter === "INTERESTED") {
          if (!lead.stage || !lead.stage.name.toLowerCase().includes("interested")) return false;
        }
      }

      // 3. Text search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchTitle = lead.title?.toLowerCase().includes(q);
        const matchCompany = lead.company_name?.toLowerCase().includes(q);
        const matchContact = lead.contact_name?.toLowerCase().includes(q);
        const matchPhone = lead.contact_phone?.includes(q);
        if (!matchTitle && !matchCompany && !matchContact && !matchPhone) return false;
      }
      return true;
    });
  }, [leads, activeSegment, activeStageFilter, searchQuery]);

  // Lead selection with UX soft-block enforcement (Problem 5)
  const handleSelectLead = (lead: Lead) => {
    if (isInCall && selectedLead && selectedLead.id !== lead.id) {
      setSoftBlockAttemptedLead(lead);
      return;
    }
    setSelectedLead(lead);
    setSoftBlockAttemptedLead(null);
  };

  // Start Next Call (Problem 18 - Sequential Worklist Stepper)
  const handleStartNextCall = async () => {
    try {
      const res = await api.getTelecallerQueueNext(selectedLead?.id);
      if (res && res.lead) {
        setSelectedLead(res.lead);
        setSuccessMsg(`Advanced to next prioritized worklist lead: ${res.lead.contact_name || res.lead.title}`);
        setTimeout(() => setSuccessMsg(null), 3000);
      } else {
        // Fallback to next in filtered list
        const currentIndex = filteredLeads.findIndex((l) => l.id === selectedLead?.id);
        if (currentIndex < filteredLeads.length - 1) {
          setSelectedLead(filteredLeads[currentIndex + 1]);
        } else {
          setSuccessMsg("You have completed all leads in the current execution queue!");
          setTimeout(() => setSuccessMsg(null), 3000);
        }
      }
    } catch (e) {
      console.error("Queue next error:", e);
    }
  };

  // Dial Call (Problem 3 & 5)
  const handleCall = async () => {
    if (!selectedLead) return;
    setIsInCall(true);
    setSuccessMsg("Call initiated! Post-call outcome drawer is active.");
    setTimeout(() => setSuccessMsg(null), 4000);

    if (!notes) {
      setNotes(`Outbound Call placed to ${selectedLead.contact_name || selectedLead.title}. Notes: `);
    }

    try {
      const res = await api.dialLead(selectedLead.id);
      if (res.tel_url) {
        window.location.href = res.tel_url;
      }
    } catch (e) {
      console.warn("Call trigger audit error", e);
    }
  };

  // WhatsApp (Problem 13 & 15)
  const handleWhatsApp = async () => {
    if (!selectedLead) return;
    if (isLandlineNumber(selectedLead.contact_phone)) {
      alert("WhatsApp is not supported on Indian Landline numbers. Please use Voice Call.");
      return;
    }

    try {
      const res = await api.triggerLeadAction(selectedLead.id, "whatsapp");
      if (res.whatsapp_url) {
        window.open(res.whatsapp_url, "_blank", "noopener,noreferrer");
      } else {
        openWhatsApp(selectedLead.contact_phone, `Hello ${selectedLead.contact_name || ""}, regarding ${selectedLead.title}.`);
      }
      setSuccessMsg("Opened WhatsApp Web in a new tab.");
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch {
      openWhatsApp(format10DigitPhone(selectedLead.contact_phone), `Hello ${selectedLead.contact_name || ""}, regarding ${selectedLead.title}.`);
    }
  };

  const handleCopyEmail = (email: string) => {
    if (!email) return;
    navigator.clipboard.writeText(email);
    setCopiedEmail(email);
    setTimeout(() => setCopiedEmail(null), 2000);
  };

  // Outcome Logging (Problem 5 & 16/17 Policy Engine)
  const handleRecordOutcome = async () => {
    if (!selectedLead) return;
    setLoggingOutcome(true);
    try {
      // 1. Log Call Activity
      await api.logActivity({
        lead_id: selectedLead.id,
        activity_type: "CALL",
        subject: `Telecaller Call: ${outcome}`,
        description: notes || `Outcome marked as ${outcome}`,
        status: outcome,
        duration_seconds: outcome === "CONNECTED" ? 120 : 15,
      });

      // 2. Automated Followup Task
      if (followupPreset !== "none") {
        const dueDate = new Date();
        if (followupPreset === "tomorrow") dueDate.setDate(dueDate.getDate() + 1);
        if (followupPreset === "3days") dueDate.setDate(dueDate.getDate() + 3);
        if (followupPreset === "nextweek") dueDate.setDate(dueDate.getDate() + 7);

        await api.createTask({
          lead_id: selectedLead.id,
          task_type: "FOLLOW_UP",
          title: `Follow-up with ${selectedLead.contact_name || selectedLead.title}`,
          priority: outcome === "INTERESTED" ? "HIGH" : "MEDIUM",
          due_at: dueDate.toISOString(),
        });
      }

      setSuccessMsg(`Call outcome "${outcome}" recorded successfully!`);
      setNotes("");
      setIsInCall(false);
      setTimeout(() => setSuccessMsg(null), 3000);

      // Move to next lead in filtered queue
      const currentIndex = filteredLeads.findIndex((l) => l.id === selectedLead.id);
      if (currentIndex < filteredLeads.length - 1) {
        setSelectedLead(filteredLeads[currentIndex + 1]);
      }
      
      // Refresh Targets & Next Actions
      loadTargets();
      loadNextActions();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setLoggingOutcome(false);
    }
  };

  // Escape hatch for soft block (Problem 5)
  const handleSkipOutcome = async () => {
    if (!selectedLead) return;
    try {
      await api.logActivity({
        lead_id: selectedLead.id,
        activity_type: "SYSTEM",
        subject: "Call Outcome Skipped",
        description: "Agent used escape hatch to advance without logging formal disposition.",
        status: "SKIPPED"
      });
    } catch (e) {}

    setIsInCall(false);
    if (softBlockAttemptedLead) {
      setSelectedLead(softBlockAttemptedLead);
      setSoftBlockAttemptedLead(null);
    }
  };

  // Dynamic Payment Link Generator (Problem 19)
  const handleGeneratePayment = async () => {
    if (!selectedLead) return;
    setGeneratingPayment(true);
    try {
      const res = await api.generatePaymentLink({
        lead_id: selectedLead.id,
        amount: paymentAmount,
        currency: "INR"
      });
      setGeneratedPaymentLink(res.payment_link);
      setSuccessMsg("Dynamic Payment Link successfully generated!");
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setGeneratingPayment(false);
    }
  };

  const OUTCOMES = [
    { id: "CONNECTED", label: "Connected / Discussed", color: "var(--emerald)" },
    { id: "INTERESTED", label: "High Interest 🔥", color: "var(--amber)" },
    { id: "CALLBACK", label: "Callback Requested", color: "var(--primary)" },
    { id: "NO_ANSWER", label: "No Answer / Ringing", color: "var(--rose)" },
    { id: "BUSY", label: "Line Busy", color: "var(--text-secondary)" },
    { id: "WRONG_NUMBER", label: "Wrong Number", color: "var(--rose)" },
    { id: "NOT_INTERESTED", label: "Not Interested", color: "var(--rose)" },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      {/* Top Header & Shift Attendance Bar (Problem 11) */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "12px" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <h2 style={{ fontSize: "1.375rem", fontWeight: 800, color: "var(--text-primary)", letterSpacing: "-0.02em", display: "flex", alignItems: "center", gap: "8px" }}>
              <PhoneCall style={{ width: "20px", height: "20px", color: "var(--emerald)" }} />
              Telecaller Operations Desk
            </h2>
            <span style={{
              fontSize: "0.6875rem",
              fontWeight: 700,
              padding: "2px 8px",
              borderRadius: "999px",
              backgroundColor: "var(--emerald-light)",
              color: "var(--emerald-dark)",
              border: "1px solid var(--emerald-border)"
            }}>
              Live Session Active
            </span>
          </div>
          <p style={{ fontSize: "0.8125rem", color: "var(--text-secondary)", marginTop: "2px" }}>
            Target enforcement, Next-Best-Action prioritization, Landline/Mobile segregation & 2-tap outcome logging
          </p>
        </div>

        {/* Shift Tracking Buttons (Problem 11) */}
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          {shiftStatus === "OFFLINE" ? (
            <button 
              onClick={async () => { await api.startShift(); loadShiftStatus(); }}
              className="btn-primary"
              style={{ fontSize: "0.75rem", padding: "6px 12px" }}
            >
              Start Shift
            </button>
          ) : (
            <div style={{ display: "flex", alignItems: "center", background: "var(--bg-surface)", border: "1px solid var(--border-subtle)", borderRadius: "8px", padding: "3px 6px", gap: "4px" }}>
              <span style={{ fontSize: "0.6875rem", fontWeight: 700, color: "var(--text-secondary)", marginRight: "4px" }}>
                {shiftTimer}
              </span>
              <span style={{
                fontSize: "0.6875rem",
                fontWeight: 700,
                padding: "2px 6px",
                borderRadius: "4px",
                background: shiftStatus === "ACTIVE" ? "#dcfce7" : "#fef3c7",
                color: shiftStatus === "ACTIVE" ? "#166534" : "#b45309"
              }}>
                {shiftStatus}
              </span>
              {shiftStatus === "ACTIVE" ? (
                <button 
                  onClick={async () => { await api.startBreak(); loadShiftStatus(); }}
                  style={{ border: "none", background: "transparent", cursor: "pointer", fontSize: "0.6875rem", color: "var(--text-secondary)", display: "flex", alignItems: "center", gap: "2px", padding: "2px 4px" }}
                >
                  <Coffee style={{ width: "12px", height: "12px" }} /> Break
                </button>
              ) : (
                <button 
                  onClick={async () => { await api.endBreak(); loadShiftStatus(); }}
                  style={{ border: "none", background: "transparent", cursor: "pointer", fontSize: "0.6875rem", color: "var(--primary)", display: "flex", alignItems: "center", gap: "2px", padding: "2px 4px" }}
                >
                  <Play style={{ width: "12px", height: "12px" }} /> Resume
                </button>
              )}
              <button 
                onClick={async () => { await api.endShift(); loadShiftStatus(); }}
                style={{ border: "none", background: "transparent", cursor: "pointer", fontSize: "0.6875rem", color: "#ef4444", display: "flex", alignItems: "center", gap: "2px", padding: "2px 4px", marginLeft: "4px" }}
              >
                End
              </button>
            </div>
          )}

          <button
            onClick={loadInitialData}
            title="Refresh queue and targets"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              fontSize: "0.75rem",
              fontWeight: 600,
              padding: "6px 12px",
              borderRadius: "8px",
              border: "1px solid var(--border-subtle)",
              background: "var(--bg-surface)",
              color: "var(--text-primary)",
              cursor: "pointer"
            }}
          >
            <RefreshCw style={{ width: "13px", height: "13px", color: "var(--primary)" }} />
            Sync
          </button>
          <span className="badge badge-masked" style={{ fontSize: "0.75rem", padding: "5px 10px" }}>
            <ShieldCheck style={{ width: "14px", height: "14px" }} />
            Data Masking Active
          </span>
        </div>
      </div>

      {/* Target Engine Header: 4 Real-Time Quota Progress Rings (Problem 2) */}
      {targets && (
        !targets.is_configured ? (
          <div style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "24px",
            background: "var(--bg-surface)",
            borderRadius: "12px",
            border: "1px solid var(--border-subtle)",
            boxShadow: "var(--shadow-sm)",
            color: "var(--text-secondary)",
            fontSize: "0.875rem",
            fontWeight: 600
          }}>
            <AlertCircle style={{ width: "16px", height: "16px", marginRight: "8px", color: "var(--amber-dark)" }} />
            NO TARGET CONFIGURED
          </div>
        ) : (
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: "14px",
            padding: "16px",
            background: "var(--bg-surface)",
            borderRadius: "12px",
            border: "1px solid var(--border-subtle)",
            boxShadow: "var(--shadow-sm)"
          }}>
            {/* Calls Quota */}
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <div style={{ width: "42px", height: "42px", borderRadius: "10px", background: "var(--primary-light)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <PhoneCall style={{ width: "20px", height: "20px", color: "var(--primary)" }} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                  <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)", fontWeight: 600 }}>Daily Calls</span>
                  <span style={{ fontSize: "0.6875rem", fontWeight: 700, color: "var(--primary)" }}>{targets.calls_progress_pct}%</span>
                </div>
                <p style={{ fontSize: "1.125rem", fontWeight: 800, color: "var(--text-primary)", lineHeight: 1.2 }}>
                  {targets.actual_calls} <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", fontWeight: 500 }}>/ {targets.target_calls}</span>
                </p>
                <div style={{ width: "100%", height: "4px", background: "var(--border-subtle)", borderRadius: "2px", marginTop: "4px", overflow: "hidden" }}>
                  <div style={{ width: `${targets.calls_progress_pct}%`, height: "100%", background: "var(--primary)", borderRadius: "2px" }}></div>
                </div>
              </div>
            </div>

            {/* Connects Quota */}
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <div style={{ width: "42px", height: "42px", borderRadius: "10px", background: "#fef3c7", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Flame style={{ width: "20px", height: "20px", color: "#d97706" }} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                  <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)", fontWeight: 600 }}>Connected Calls</span>
                  <span style={{ fontSize: "0.6875rem", fontWeight: 700, color: "#d97706" }}>{targets.connects_progress_pct}%</span>
                </div>
                <p style={{ fontSize: "1.125rem", fontWeight: 800, color: "var(--text-primary)", lineHeight: 1.2 }}>
                  {targets.actual_connects} <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", fontWeight: 500 }}>/ {targets.target_connects}</span>
                </p>
                <div style={{ width: "100%", height: "4px", background: "var(--border-subtle)", borderRadius: "2px", marginTop: "4px", overflow: "hidden" }}>
                  <div style={{ width: `${targets.connects_progress_pct}%`, height: "100%", background: "#f59e0b", borderRadius: "2px" }}></div>
                </div>
              </div>
            </div>

            {/* Talk Time Quota */}
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <div style={{ width: "42px", height: "42px", borderRadius: "10px", background: "#dbeafe", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Clock style={{ width: "20px", height: "20px", color: "#2563eb" }} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                  <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)", fontWeight: 600 }}>Talk Time</span>
                  <span style={{ fontSize: "0.6875rem", fontWeight: 700, color: "#2563eb" }}>{targets.talk_time_progress_pct}%</span>
                </div>
                <p style={{ fontSize: "1.125rem", fontWeight: 800, color: "var(--text-primary)", lineHeight: 1.2 }}>
                  {targets.actual_talk_time_minutes}m <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", fontWeight: 500 }}>/ {targets.target_talk_time_minutes}m</span>
                </p>
                <div style={{ width: "100%", height: "4px", background: "var(--border-subtle)", borderRadius: "2px", marginTop: "4px", overflow: "hidden" }}>
                  <div style={{ width: `${targets.talk_time_progress_pct}%`, height: "100%", background: "#3b82f6", borderRadius: "2px" }}></div>
                </div>
              </div>
            </div>

            {/* Conversions / Won Deals Quota */}
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <div style={{ width: "42px", height: "42px", borderRadius: "10px", background: "#dcfce7", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <CheckCircle2 style={{ width: "20px", height: "20px", color: "#16a34a" }} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                  <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)", fontWeight: 600 }}>Conversions</span>
                  <span style={{ fontSize: "0.6875rem", fontWeight: 700, color: "#16a34a" }}>{targets.conversions_progress_pct}%</span>
                </div>
                <p style={{ fontSize: "1.125rem", fontWeight: 800, color: "var(--text-primary)", lineHeight: 1.2 }}>
                  {targets.actual_conversions} <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", fontWeight: 500 }}>/ {targets.target_conversions}</span>
                </p>
                <div style={{ width: "100%", height: "4px", background: "var(--border-subtle)", borderRadius: "2px", marginTop: "4px", overflow: "hidden" }}>
                  <div style={{ width: `${targets.conversions_progress_pct}%`, height: "100%", background: "#10b981", borderRadius: "2px" }}></div>
                </div>
              </div>
            </div>
          </div>
        )
      )}

      {/* Next-Best-Action Smart Queue Accordion (Problems 16 & 17) */}
      {nextActions.length > 0 && (
        <div style={{
          background: "linear-gradient(135deg, rgba(99, 102, 241, 0.04), rgba(168, 85, 247, 0.04))",
          borderRadius: "12px",
          border: "1px solid rgba(99, 102, 241, 0.2)",
          padding: "14px 18px",
          display: "flex",
          flexDirection: "column",
          gap: "10px"
        }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <Sparkles style={{ width: "16px", height: "16px", color: "var(--primary)" }} />
              <span style={{ fontSize: "0.8125rem", fontWeight: 700, color: "var(--text-primary)" }}>
                Next-Best-Action Worklist ({nextActions.length} Scheduled)
              </span>
            </div>
            <button
              onClick={() => setShowNextActions(!showNextActions)}
              style={{ border: "none", background: "transparent", color: "var(--primary)", fontSize: "0.75rem", cursor: "pointer", fontWeight: 600 }}
            >
              {showNextActions ? "Collapse" : "Expand"}
            </button>
          </div>

          {showNextActions && (
            <div style={{ display: "flex", gap: "10px", overflowX: "auto", paddingBottom: "4px" }}>
              {nextActions.slice(0, 5).map((act, i) => (
                <div
                  key={i}
                  onClick={() => {
                    const match = leads.find((l) => l.id === act.lead_id);
                    if (match) handleSelectLead(match);
                  }}
                  style={{
                    minWidth: "230px",
                    background: "var(--bg-surface)",
                    padding: "10px 14px",
                    borderRadius: "8px",
                    border: "1px solid var(--border-subtle)",
                    cursor: "pointer",
                    boxShadow: "var(--shadow-xs)"
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                    <span style={{
                      fontSize: "0.6875rem",
                      fontWeight: 800,
                      padding: "2px 6px",
                      borderRadius: "4px",
                      background: act.scheduled_time === "NOW" ? "#fee2e2" : "var(--primary-light)",
                      color: act.scheduled_time === "NOW" ? "#b91c1c" : "var(--primary)"
                    }}>
                      {act.scheduled_time}
                    </span>
                    <span style={{ fontSize: "0.6875rem", fontWeight: 700, color: "var(--text-secondary)" }}>
                      {act.action_type}
                    </span>
                  </div>
                  <p style={{ fontSize: "0.8125rem", fontWeight: 700, color: "var(--text-primary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {act.company_name} — {act.contact_name}
                  </p>
                  <p style={{ fontSize: "0.6875rem", color: "var(--text-muted)", marginTop: "2px" }}>
                    {act.action_reason}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Success Notification Banner */}
      {successMsg && (
        <div style={{
          padding: "12px 16px",
          borderRadius: "10px",
          background: "var(--emerald-light)",
          border: "1px solid var(--emerald-border)",
          color: "var(--emerald-dark)",
          fontSize: "0.8125rem",
          fontWeight: 600,
          display: "flex",
          alignItems: "center",
          gap: "8px"
        }}>
          <Check style={{ width: "16px", height: "16px" }} />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Soft-block warning modal if telecaller navigates without logging outcome */}
      {softBlockAttemptedLead && (
        <div style={{
          padding: "14px 18px",
          borderRadius: "10px",
          background: "#fff1f2",
          border: "1px solid #fecdd3",
          color: "#9f1239",
          fontSize: "0.8125rem",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: "10px"
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <AlertCircle style={{ width: "18px", height: "18px", color: "#e11d48" }} />
            <span>
              <strong>Action required:</strong> Please record the call outcome for <strong>{selectedLead?.contact_name || selectedLead?.title}</strong> before switching leads.
            </span>
          </div>
          <div style={{ display: "flex", gap: "8px" }}>
            <button
              onClick={handleSkipOutcome}
              style={{
                fontSize: "0.75rem",
                padding: "4px 10px",
                borderRadius: "6px",
                border: "1px solid #fda4af",
                background: "#ffffff",
                color: "#be123c",
                fontWeight: 600,
                cursor: "pointer"
              }}
            >
              Skip Outcome & Switch
            </button>
            <button
              onClick={() => setSoftBlockAttemptedLead(null)}
              style={{
                fontSize: "0.75rem",
                padding: "4px 10px",
                borderRadius: "6px",
                border: "none",
                background: "#e11d48",
                color: "#ffffff",
                fontWeight: 600,
                cursor: "pointer"
              }}
            >
              Record Now
            </button>
          </div>
        </div>
      )}

      {/* Main Two-Column Layout */}
      <div className="grid-cols-desk">
        {/* Left Column: Prioritized Leads Queue */}
        <div className="card" style={{ padding: "16px", display: "flex", flexDirection: "column", gap: "12px" }}>
          {/* Queue Header & Sequential Advance Button (Problem 18) */}
          <div style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            paddingBottom: "10px",
            borderBottom: "1px solid var(--border-subtle)",
            flexWrap: "wrap",
            gap: "8px"
          }}>
            <div>
              <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--text-primary)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                Worklist Queue ({filteredLeads.length})
              </span>
              <div style={{ display: "flex", gap: "8px", marginTop: "4px" }}>
                <span style={{ fontSize: "0.6875rem", color: "var(--emerald)", fontWeight: 600, background: "var(--emerald-light)", padding: "2px 6px", borderRadius: "4px" }}>
                  {dailyQueue.filter(q => q.source === 'NEW_LEAD').length} Fresh Leads
                </span>
                <span style={{ fontSize: "0.6875rem", color: "var(--amber)", fontWeight: 600, background: "#fef3c7", padding: "2px 6px", borderRadius: "4px" }}>
                  {dailyQueue.filter(q => q.source === 'FOLLOWUP').length} Follow-ups
                </span>
              </div>
            </div>

            <button
              onClick={handleStartNextCall}
              className="btn-primary"
              style={{ fontSize: "0.6875rem", padding: "5px 10px", display: "flex", alignItems: "center", gap: "4px" }}
              title="Step to next prioritized lead sequentially"
            >
              <ArrowRight style={{ width: "12px", height: "12px" }} />
              Start Next Call
            </button>
          </div>

          {/* Search Box */}
          <div style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            padding: "6px 10px",
            background: "var(--bg-surface-subtle)",
            border: "1px solid var(--border-subtle)",
            borderRadius: "8px"
          }}>
            <Search style={{ width: "14px", height: "14px", color: "var(--text-muted)" }} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by title, company, or contact..."
              style={{
                width: "100%",
                border: "none",
                background: "transparent",
                fontSize: "0.75rem",
                color: "var(--text-primary)",
                outline: "none"
              }}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                style={{ border: "none", background: "transparent", fontSize: "0.6875rem", color: "var(--text-muted)", cursor: "pointer" }}
              >
                Clear
              </button>
            )}
          </div>

          {/* Segmented Filter Chips: [B2B] [B2C] [NEW] [CONTACTED] [INTERESTED] [HOT] [WARM] [COLD] (Problems 6 & 20) */}
          <div style={{ display: "flex", gap: "4px", flexWrap: "wrap" }}>
            {/* Segment Chips */}
            {["ALL", "B2B", "B2C"].map((seg) => (
              <button
                key={seg}
                onClick={() => setActiveSegment(seg)}
                style={{
                  fontSize: "0.6875rem",
                  fontWeight: 700,
                  padding: "3px 8px",
                  borderRadius: "999px",
                  border: activeSegment === seg ? "1px solid var(--primary)" : "1px solid var(--border-subtle)",
                  background: activeSegment === seg ? "var(--primary-light)" : "var(--bg-surface-subtle)",
                  color: activeSegment === seg ? "var(--primary)" : "var(--text-secondary)",
                  cursor: "pointer"
                }}
              >
                {seg}
              </button>
            ))}

            <span style={{ color: "var(--border-subtle)", alignSelf: "center" }}>|</span>

            {/* Stage/Type Chips */}
            {[
              { key: "ALL", label: "All Stages" },
              { key: "HOT", label: "Hot 🔥" },
              { key: "NEW", label: "New" },
              { key: "CONTACTED", label: "Contacted" },
              { key: "INTERESTED", label: "Interested" },
            ].map((chip) => (
              <button
                key={chip.key}
                onClick={() => setActiveStageFilter(chip.key)}
                style={{
                  fontSize: "0.6875rem",
                  fontWeight: 600,
                  padding: "3px 8px",
                  borderRadius: "999px",
                  border: activeStageFilter === chip.key ? "1px solid var(--primary)" : "1px solid var(--border-subtle)",
                  background: activeStageFilter === chip.key ? "var(--primary-light)" : "var(--bg-surface-subtle)",
                  color: activeStageFilter === chip.key ? "var(--primary)" : "var(--text-secondary)",
                  cursor: "pointer"
                }}
              >
                {chip.label}
              </button>
            ))}
          </div>

          {/* Leads List */}
          <div style={{ display: "flex", flexDirection: "column", gap: "8px", overflowY: "auto", flex: 1, paddingRight: "4px", maxHeight: "560px" }}>
            {loading ? (
              <p style={{ textAlign: "center", padding: "32px 0", fontSize: "0.75rem", color: "var(--text-muted)" }}>Loading worklist...</p>
            ) : filteredLeads.length === 0 ? (
              <p style={{ textAlign: "center", padding: "32px 0", fontSize: "0.75rem", color: "var(--text-muted)" }}>No leads match current filter criteria.</p>
            ) : (
              filteredLeads.map((lead) => {
                const isSelected = selectedLead?.id === lead.id;
                const isLandline = isLandlineNumber(lead.contact_phone);
                const queueMatch = dailyQueue.find((q) => q.lead_id === lead.id);

                return (
                  <div
                    key={lead.id}
                    onClick={() => handleSelectLead(lead)}
                    style={{
                      padding: "12px",
                      borderRadius: "10px",
                      border: isSelected ? "2px solid var(--primary)" : "1px solid var(--border-subtle)",
                      background: isSelected ? "var(--primary-light)" : "var(--bg-surface)",
                      cursor: "pointer",
                      transition: "all 0.15s ease",
                      display: "flex",
                      flexDirection: "column",
                      gap: "6px"
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      {queueMatch && queueMatch.source === "FOLLOWUP" && (
                        <span style={{ fontSize: "0.625rem", fontWeight: 800, background: "#fef3c7", color: "#d97706", padding: "2px 4px", borderRadius: "4px" }}>FOLLOW-UP</span>
                      )}
                      {queueMatch && queueMatch.source === "NEW_LEAD" && (
                        <span style={{ fontSize: "0.625rem", fontWeight: 800, background: "var(--emerald-light)", color: "var(--emerald)", padding: "2px 4px", borderRadius: "4px" }}>FRESH</span>
                      )}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <span style={{ fontSize: "0.875rem", fontWeight: 700, color: "var(--text-primary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {lead.contact_name || lead.title}
                      </span>
                      <div style={{ display: "flex", gap: "4px" }}>
                        {lead.segment && (
                          <span style={{ fontSize: "0.625rem", fontWeight: 800, padding: "1px 5px", borderRadius: "4px", background: "#f3f4f6", color: "#374151" }}>
                            {lead.segment}
                          </span>
                        )}
                        <span style={{
                          fontSize: "0.625rem",
                          fontWeight: 700,
                          padding: "1px 5px",
                          borderRadius: "4px",
                          background: lead.priority === "URGENT" || lead.priority === "HIGH" ? "#fee2e2" : "#f3f4f6",
                          color: lead.priority === "URGENT" || lead.priority === "HIGH" ? "#b91c1c" : "#4b5563"
                        }}>
                          {lead.priority}
                        </span>
                      </div>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: "0.75rem", color: "var(--text-secondary)" }}>
                      <span>{lead.company_name || "Direct Customer"}</span>
                      <span style={{ fontFamily: "monospace", fontWeight: 600 }}>
                        {maskPhone(lead.contact_phone ?? undefined)}
                      </span>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "2px" }}>
                      <span style={{ fontSize: "0.6875rem", color: "var(--text-muted)" }}>
                        Stage: {lead.stage?.name || "New Lead"}
                      </span>
                      {isLandline && (
                        <span style={{ fontSize: "0.625rem", color: "#6b7280", background: "#e5e7eb", padding: "1px 4px", borderRadius: "3px" }}>
                          Landline
                        </span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column: Active Lead Outbound Workspace */}
        {selectedLead ? (
          <div className="card" style={{ padding: "24px", display: "flex", flexDirection: "column", gap: "20px" }}>
            {/* Contact Header Card & Action Triggers (Problem 3, 13, 15) */}
            <div style={{
              padding: "18px",
              borderRadius: "10px",
              background: "var(--bg-surface-subtle)",
              border: "1px solid var(--border-subtle)",
              display: "flex",
              alignItems: "flex-start",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: "16px"
            }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                  <span className="badge badge-masked">
                    <Lock style={{ width: "11px", height: "11px" }} />
                    Anti-Theft Active
                  </span>
                  {selectedLead.segment && (
                    <span style={{ fontSize: "0.6875rem", fontWeight: 800, padding: "2px 6px", borderRadius: "4px", background: "var(--primary-light)", color: "var(--primary)" }}>
                      {selectedLead.segment} Opportunity
                    </span>
                  )}
                  <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", fontWeight: 600 }}>
                    Sourced: {selectedLead.source}
                  </span>
                </div>
                <h3 style={{ fontSize: "1.25rem", fontWeight: 800, color: "var(--text-primary)" }}>
                  {selectedLead.contact_name || "Contact Person"}
                </h3>
                <p style={{ fontSize: "0.8125rem", color: "var(--text-secondary)", fontWeight: 600 }}>
                  {selectedLead.company_name} — {selectedLead.title}
                </p>
              </div>

              {/* Masked Phone Display & Triggers */}
              <div style={{ textAlign: "right" }}>
                <span style={{ fontSize: "0.6875rem", color: "var(--text-muted)", display: "block", marginBottom: "2px", fontWeight: 600 }}>
                  Masked Contact Number
                </span>
                <p style={{ fontSize: "1.25rem", fontFamily: "monospace", fontWeight: 800, color: "var(--text-primary)", letterSpacing: "0.05em" }}>
                  {maskPhone(selectedLead.contact_phone ?? undefined)}
                </p>
                {selectedLead.contact_email && (
                  <span
                    onClick={() => handleCopyEmail(selectedLead.contact_email!)}
                    title="Copy email to clipboard"
                    style={{
                      fontSize: "0.75rem",
                      color: "var(--primary)",
                      cursor: "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "4px",
                      marginTop: "2px",
                      textDecoration: "underline",
                      textDecorationStyle: "dotted"
                    }}
                  >
                    <Mail style={{ width: "12px", height: "12px" }} />
                    {maskEmail(selectedLead.contact_email)}
                  </span>
                )}

                {/* Direct Action Buttons: Call, WhatsApp (Disabled for Landlines), Gmail, Payment */}
                <div style={{ display: "flex", gap: "8px", marginTop: "12px", justifyContent: "flex-end", flexWrap: "wrap" }}>
                  {/* Call button */}
                  <button
                    onClick={handleCall}
                    className="btn-primary"
                    style={{
                      background: "linear-gradient(135deg, #059669, #047857)",
                      borderColor: "#065f46",
                      fontSize: "0.75rem",
                      padding: "7px 16px",
                      display: "flex",
                      alignItems: "center",
                      gap: "6px"
                    }}
                    title="Initiates call and opens device dialer"
                  >
                    <PhoneCall style={{ width: "14px", height: "14px" }} />
                    Call Lead
                  </button>

                  {/* WhatsApp button - Disabled for Landlines (Problem 15) */}
                  {isLandlineNumber(selectedLead.contact_phone) ? (
                    <button
                      disabled
                      title="Disabled: Landline phone numbers cannot receive WhatsApp messages."
                      style={{
                        fontSize: "0.75rem",
                        padding: "7px 12px",
                        borderRadius: "8px",
                        border: "1px solid var(--border-subtle)",
                        background: "#f3f4f6",
                        color: "#9ca3af",
                        cursor: "not-allowed",
                        display: "flex",
                        alignItems: "center",
                        gap: "6px"
                      }}
                    >
                      <MessageCircle style={{ width: "14px", height: "14px" }} />
                      WhatsApp (Landline)
                    </button>
                  ) : (
                    <button
                      onClick={handleWhatsApp}
                      className="btn-secondary"
                      style={{ fontSize: "0.75rem", padding: "7px 14px", display: "flex", alignItems: "center", gap: "6px" }}
                      title="Open WhatsApp chat"
                    >
                      <MessageCircle style={{ width: "14px", height: "14px", color: "var(--emerald)" }} />
                      WhatsApp
                    </button>
                  )}

                  {/* Payment Link Trigger Modal (Problem 19) */}
                  <button
                    onClick={() => setShowPaymentModal(true)}
                    className="btn-secondary"
                    style={{ fontSize: "0.75rem", padding: "7px 14px", display: "flex", alignItems: "center", gap: "6px", color: "#6366f1", borderColor: "rgba(99, 102, 241, 0.3)" }}
                    title="Generate Dynamic Payment Link (Won/Deal conversion)"
                  >
                    <CreditCard style={{ width: "14px", height: "14px" }} />
                    Payment Link
                  </button>

                  <button
                    onClick={() => setShowDetailModal(true)}
                    className="btn-secondary"
                    style={{ fontSize: "0.75rem", padding: "7px 14px", display: "flex", alignItems: "center", gap: "6px" }}
                    title="Open Lead 360° Profile"
                  >
                    <ExternalLink style={{ width: "14px", height: "14px", color: "var(--primary)" }} />
                    Profile
                  </button>
                </div>
              </div>
            </div>

            {/* Static Call Brief Sidebar (Problem 12) */}
            <div style={{
              padding: "16px",
              borderRadius: "10px",
              background: "var(--primary-light)",
              border: "1px solid var(--primary)",
              display: "flex",
              flexDirection: "column",
              gap: "10px"
            }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <Sparkles style={{ width: "16px", height: "16px", color: "var(--primary)" }} />
                  <h4 style={{ fontSize: "0.875rem", fontWeight: 800, color: "var(--primary-dark)" }}>
                    CALL BRIEF & PRE-CALL CONTEXT
                  </h4>
                </div>
                <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--primary)" }}>
                  Score: {selectedLead.score} | Stage: {selectedLead.stage?.name || selectedLead.status}
                </span>
              </div>

              {/* Pre-Call History Stats */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "8px", fontSize: "0.75rem", color: "var(--text-secondary)" }}>
                <div>
                  <strong>Previous Calls:</strong> {preCallContext?.timeline?.filter((a: any) => a.activity_type === "CALL").length || 0} attempts
                </div>
                <div>
                  <strong>Last Activity:</strong> {preCallContext?.timeline?.[0]?.subject || "No prior calls recorded"}
                </div>
                <div>
                  <strong>Deal Value:</strong> INR {selectedLead.value?.toLocaleString() || "0"}
                </div>
                {selectedLead.product_service_name && (
                  <div>
                    <strong>Product/Service:</strong> {selectedLead.product_service_name}
                  </div>
                )}
              </div>

              {/* AI Recommendation Talking Points */}
              {preCallContext?.ai_next_action && (
                <div style={{ padding: "8px 12px", background: "rgba(255, 255, 255, 0.7)", borderRadius: "6px", fontSize: "0.8125rem", color: "var(--text-primary)" }}>
                  <strong>AI Recommendation:</strong> {preCallContext.ai_next_action.recommended_action || "Introduce product capabilities and qualify annual budget."}
                </div>
              )}
            </div>

            {/* Docked 2-Tap Post-Call Outcome Sheet (Problem 5) */}
            <div style={{
              padding: "18px",
              borderRadius: "10px",
              background: isInCall ? "rgba(16, 185, 129, 0.04)" : "var(--bg-surface)",
              border: isInCall ? "2px solid var(--emerald)" : "1px solid var(--border-subtle)",
              display: "flex",
              flexDirection: "column",
              gap: "16px",
              transition: "all 0.2s ease"
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <h4 style={{ fontSize: "0.875rem", fontWeight: 800, color: "var(--text-primary)", display: "flex", alignItems: "center", gap: "6px" }}>
                  <span>1. Select Call Outcome (2-Tap Logging)</span>
                  {isInCall && (
                    <span style={{ fontSize: "0.6875rem", background: "var(--emerald-light)", color: "var(--emerald-dark)", padding: "2px 6px", borderRadius: "4px" }}>
                      Active Call in Progress
                    </span>
                  )}
                </h4>
                {isInCall && (
                  <button
                    onClick={handleSkipOutcome}
                    style={{ border: "none", background: "transparent", color: "var(--text-muted)", fontSize: "0.6875rem", cursor: "pointer", textDecoration: "underline" }}
                  >
                    Skip Outcome
                  </button>
                )}
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: "8px" }}>
                {OUTCOMES.map((o) => {
                  const isSelected = outcome === o.id;
                  return (
                    <button
                      key={o.id}
                      type="button"
                      onClick={() => setOutcome(o.id)}
                      style={{
                        padding: "10px 12px",
                        borderRadius: "8px",
                        border: isSelected ? "2px solid var(--primary)" : "1px solid var(--border-subtle)",
                        background: isSelected ? "var(--primary-light)" : "var(--bg-surface)",
                        color: isSelected ? "var(--primary)" : "var(--text-primary)",
                        fontWeight: isSelected ? 700 : 500,
                        fontSize: "0.75rem",
                        textAlign: "left",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        transition: "all 0.15s ease"
                      }}
                    >
                      <span>{o.label}</span>
                      {isSelected && <Check style={{ width: "14px", height: "14px", color: "var(--primary)" }} />}
                    </button>
                  );
                })}
              </div>

              {/* Call Notes */}
              <div>
                <h4 style={{ fontSize: "0.875rem", fontWeight: 700, color: "var(--text-primary)", marginBottom: "4px" }}>
                  2. Discussion Notes
                </h4>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Record summary of discussion, interest level, budget, or objections..."
                  rows={2}
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    borderRadius: "8px",
                    border: "1px solid var(--border-medium)",
                    background: "var(--bg-surface)",
                    color: "var(--text-primary)",
                    fontSize: "0.8125rem",
                    resize: "vertical",
                    outline: "none"
                  }}
                />
              </div>

              {/* Follow-up Policy Preset (Problems 16 & 17) */}
              <div>
                <h4 style={{ fontSize: "0.875rem", fontWeight: 700, color: "var(--text-primary)", marginBottom: "4px" }}>
                  3. Automated Follow-up Policy
                </h4>
                <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                  {[
                    { id: "tomorrow", label: "Tomorrow" },
                    { id: "3days", label: "In 3 Days" },
                    { id: "nextweek", label: "Next Week" },
                    { id: "none", label: "No Follow-up" },
                  ].map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setFollowupPreset(p.id)}
                      style={{
                        padding: "6px 12px",
                        borderRadius: "6px",
                        border: followupPreset === p.id ? "1px solid var(--primary)" : "1px solid var(--border-subtle)",
                        background: followupPreset === p.id ? "var(--primary-light)" : "var(--bg-surface-subtle)",
                        color: followupPreset === p.id ? "var(--primary)" : "var(--text-secondary)",
                        fontWeight: followupPreset === p.id ? 700 : 500,
                        fontSize: "0.75rem",
                        cursor: "pointer"
                      }}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Save Button */}
              <button
                type="button"
                disabled={loggingOutcome}
                onClick={handleRecordOutcome}
                className="btn-primary"
                style={{
                  padding: "10px 20px",
                  fontSize: "0.875rem",
                  fontWeight: 700,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "8px"
                }}
              >
                <CheckCircle2 style={{ width: "16px", height: "16px" }} />
                {loggingOutcome ? "Saving Outcome..." : "Confirm & Save Outcome"}
              </button>
            </div>
          </div>
        ) : (
          <div className="card" style={{ padding: "48px", textAlign: "center", color: "var(--text-muted)" }}>
            <PhoneCall style={{ width: "32px", height: "32px", margin: "0 auto 12px", opacity: 0.4 }} />
            <p>Select a lead from the worklist queue to begin outbound calling session.</p>
          </div>
        )}
      </div>

      {/* Dynamic Payment Link Modal (Problem 19) */}
      {showPaymentModal && selectedLead && (
        <div style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: "rgba(0,0,0,0.5)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 1000,
          padding: "16px"
        }}>
          <div style={{
            background: "var(--bg-surface)",
            borderRadius: "14px",
            padding: "24px",
            width: "100%",
            maxWidth: "480px",
            boxShadow: "var(--shadow-lg)",
            display: "flex",
            flexDirection: "column",
            gap: "16px"
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <CreditCard style={{ width: "20px", height: "20px", color: "var(--primary)" }} />
                <h3 style={{ fontSize: "1.125rem", fontWeight: 800, color: "var(--text-primary)" }}>
                  Dynamic Payment Link Generator
                </h3>
              </div>
              <button
                onClick={() => { setShowPaymentModal(false); setGeneratedPaymentLink(null); }}
                style={{ border: "none", background: "transparent", cursor: "pointer", color: "var(--text-muted)" }}
              >
                <X style={{ width: "18px", height: "18px" }} />
              </button>
            </div>

            <p style={{ fontSize: "0.8125rem", color: "var(--text-secondary)" }}>
              Generate an instant checkout payment link for <strong>{selectedLead.contact_name || selectedLead.title}</strong> ({selectedLead.company_name || "Direct"}).
            </p>

            <div>
              <label style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--text-primary)", display: "block", marginBottom: "4px" }}>
                Deal Amount (INR)
              </label>
              <input
                type="number"
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(Number(e.target.value))}
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  borderRadius: "8px",
                  border: "1px solid var(--border-medium)",
                  background: "var(--bg-surface)",
                  color: "var(--text-primary)",
                  fontSize: "0.875rem",
                  fontWeight: 700
                }}
              />
            </div>

            {generatedPaymentLink ? (
              <div style={{
                padding: "14px",
                background: "var(--emerald-light)",
                borderRadius: "8px",
                border: "1px solid var(--emerald-border)",
                display: "flex",
                flexDirection: "column",
                gap: "8px"
              }}>
                <span style={{ fontSize: "0.6875rem", fontWeight: 700, color: "var(--emerald-dark)" }}>
                  Payment Link Generated:
                </span>
                <input
                  readOnly
                  value={generatedPaymentLink}
                  style={{ width: "100%", fontSize: "0.75rem", padding: "6px 8px", borderRadius: "4px", border: "1px solid var(--emerald-border)" }}
                />
                <div style={{ display: "flex", gap: "8px", marginTop: "4px" }}>
                  <button
                    onClick={() => { navigator.clipboard.writeText(generatedPaymentLink); alert("Link copied!"); }}
                    className="btn-secondary"
                    style={{ fontSize: "0.75rem", padding: "6px 12px", flex: 1 }}
                  >
                    Copy Link
                  </button>
                  <button
                    onClick={() => openWhatsApp(selectedLead.contact_phone, `Here is your payment link: ${generatedPaymentLink}`)}
                    className="btn-primary"
                    style={{ fontSize: "0.75rem", padding: "6px 12px", flex: 1, background: "var(--emerald)" }}
                  >
                    Send via WhatsApp
                  </button>
                </div>
              </div>
            ) : (
              <button
                disabled={generatingPayment}
                onClick={handleGeneratePayment}
                className="btn-primary"
                style={{ padding: "10px", fontSize: "0.875rem", fontWeight: 700 }}
              >
                {generatingPayment ? "Creating Link..." : `Generate Payment Link (INR ${paymentAmount.toLocaleString()})`}
              </button>
            )}
          </div>
        </div>
      )}

      {/* 360° Profile Modal */}
      {showDetailModal && selectedLead && (
        <LeadDetailModal
          lead={selectedLead}
          stages={stages}
          onClose={() => setShowDetailModal(false)}
          onRefresh={loadMyLeads}
        />
      )}
    </div>
  );
};
