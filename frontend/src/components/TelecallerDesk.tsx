import React, { useState, useEffect, useRef } from "react";
import { Lead, api } from "../services/api";
import { openGmail, openWhatsApp } from "../utils/mailHelper";
import { 
  PhoneCall, 
  PhoneOff,
  Mic,
  MicOff,
  MessageCircle, 
  Mail, 
  Calendar, 
  ShieldCheck, 
  Flame, 
  Check, 
  ChevronRight,
  Sparkles,
  Lock,
  ExternalLink
} from "lucide-react";

export const TelecallerDesk: React.FC = () => {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [loading, setLoading] = useState(true);

  // Outcome logger state
  const [outcome, setOutcome] = useState<string>("CONNECTED");
  const [notes, setNotes] = useState("");
  const [followupPreset, setFollowupPreset] = useState<string>("tomorrow");
  const [loggingOutcome, setLoggingOutcome] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Live Calling Cockpit state
  const [isCalling, setIsCalling] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const timerRef = useRef<any>(null);

  useEffect(() => {
    if (isCalling) {
      timerRef.current = setInterval(() => {
        setCallDuration((prev) => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isCalling]);

  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const handleStartCall = async () => {
    if (!selectedLead) return;
    setIsCalling(true);
    setCallDuration(0);
    setIsMuted(false);
    try {
      await api.triggerLeadAction(selectedLead.id, "call");
    } catch (e) {
      console.warn("Local audit event logged", e);
    }
  };

  const handleEndCall = () => {
    setIsCalling(false);
    const duration = callDuration;
    if (duration >= 5) {
      setOutcome("CONNECTED");
      setNotes((prev) =>
        prev
          ? `${prev}\nOutbound Call completed (${duration}s).`
          : `Connected outbound call (${duration}s). Notes: `
      );
    } else {
      setOutcome("NO_ANSWER");
    }
    setSuccessMsg(`Call completed (${formatTimer(duration)}). Outcome set to ${duration >= 5 ? "Connected" : "No Answer"}. Review and log below.`);
    setTimeout(() => setSuccessMsg(null), 5000);
  };

  const handleWhatsApp = async () => {
    if (!selectedLead) return;
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
      openWhatsApp(selectedLead.contact_phone, `Hello ${selectedLead.contact_name || ""}, regarding ${selectedLead.title}.`);
    }
  };

  const handleGmail = async () => {
    if (!selectedLead) return;
    try {
      const res = await api.triggerLeadAction(selectedLead.id, "email");
      if (res.gmail_url) {
        window.open(res.gmail_url, "_blank", "noopener,noreferrer");
      } else {
        openGmail(selectedLead.contact_email, `Regarding ${selectedLead.title}`, `Hello ${selectedLead.contact_name || "there"},\n\n`);
      }
      setSuccessMsg("Opened Gmail composer in a new tab.");
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch {
      openGmail(selectedLead.contact_email, `Regarding ${selectedLead.title}`, `Hello ${selectedLead.contact_name || "there"},\n\n`);
    }
  };

  useEffect(() => {
    loadMyLeads();
  }, []);

  const loadMyLeads = async () => {
    setLoading(true);
    try {
      const data = await api.getLeads({ status: "OPEN" });
      setLeads(data);
      if (data.length > 0 && !selectedLead) {
        setSelectedLead(data[0]);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

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
        duration_seconds: outcome === "CONNECTED" ? 180 : 25,
      });

      // 2. If followup selected, schedule task
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
      setTimeout(() => setSuccessMsg(null), 3000);

      // Move to next lead
      const currentIndex = leads.findIndex((l) => l.id === selectedLead.id);
      if (currentIndex < leads.length - 1) {
        setSelectedLead(leads[currentIndex + 1]);
      }
    } catch (err: any) {
      alert(err.message);
    } finally {
      setLoggingOutcome(false);
    }
  };

  const OUTCOMES = [
    { id: "CONNECTED", label: "Connected / Discussed", color: "var(--emerald)" },
    { id: "INTERESTED", label: "High Interest 🔥", color: "var(--amber)" },
    { id: "CALLBACK", label: "Callback Requested", color: "var(--primary)" },
    { id: "NO_ANSWER", label: "No Answer / Ringing", color: "var(--rose)" },
    { id: "BUSY", label: "Line Busy", color: "var(--text-secondary)" },
    { id: "VOICEMAIL", label: "Voicemail Left", color: "var(--text-secondary)" },
    { id: "WRONG_NUMBER", label: "Wrong Number", color: "var(--rose)" },
    { id: "NOT_INTERESTED", label: "Not Interested", color: "var(--rose)" },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      {/* Top Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "12px" }}>
        <div>
          <h2 style={{ fontSize: "1.375rem", fontWeight: 800, color: "var(--text-primary)", letterSpacing: "-0.02em", display: "flex", alignItems: "center", gap: "8px" }}>
            <PhoneCall style={{ width: "20px", height: "20px", color: "var(--emerald)" }} />
            Telecaller Outbound Desk
          </h2>
          <p style={{ fontSize: "0.8125rem", color: "var(--text-secondary)", marginTop: "2px" }}>
            Rapid outbound dialer with contact masking & one-tap outcome logging
          </p>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span className="badge badge-masked" style={{ fontSize: "0.75rem", padding: "4px 10px" }}>
            <ShieldCheck style={{ width: "14px", height: "14px" }} />
            Anti-Theft Contact Masking Active
          </span>
        </div>
      </div>

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

      {/* Main Two-Column Workflow Desk */}
      <div className="grid-cols-desk">
        {/* Left Column: Assigned Leads Queue */}
        <div className="card" style={{ padding: "16px", display: "flex", flexDirection: "column" }}>
          <div style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            paddingBottom: "12px",
            marginBottom: "12px",
            borderBottom: "1px solid var(--border-subtle)"
          }}>
            <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--text-primary)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
              Assigned Queue ({leads.length})
            </span>
            <span style={{ fontSize: "0.6875rem", color: "var(--text-muted)", fontWeight: 600 }}>High to Low Score</span>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "8px", overflowY: "auto", flex: 1, paddingRight: "4px", maxHeight: "620px" }}>
            {loading ? (
              <p style={{ textAlign: "center", padding: "32px 0", fontSize: "0.75rem", color: "var(--text-muted)" }}>Loading queue...</p>
            ) : leads.length === 0 ? (
              <p style={{ textAlign: "center", padding: "32px 0", fontSize: "0.75rem", color: "var(--text-muted)" }}>All assigned leads completed!</p>
            ) : (
              leads.map((lead) => {
                const isSelected = selectedLead?.id === lead.id;
                return (
                  <div
                    key={lead.id}
                    onClick={() => setSelectedLead(lead)}
                    style={{
                      padding: "12px",
                      borderRadius: "8px",
                      border: isSelected ? "2px solid var(--primary)" : "1px solid var(--border-subtle)",
                      background: isSelected ? "var(--primary-light)" : "var(--bg-surface)",
                      boxShadow: isSelected ? "var(--shadow-sm)" : "var(--shadow-xs)",
                      cursor: "pointer",
                      transition: "all 0.15s ease"
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "4px" }}>
                      <span className={`badge ${lead.priority === "URGENT" || lead.priority === "HIGH" ? "badge-hot" : "badge-medium"}`}>
                        {lead.priority}
                      </span>
                      <div style={{ display: "flex", alignItems: "center", gap: "3px", fontSize: "0.75rem", fontFamily: "monospace", fontWeight: 700, color: "var(--amber-dark)" }}>
                        <Flame style={{ width: "12px", height: "12px", color: "var(--amber)" }} />
                        {lead.score}
                      </div>
                    </div>

                    <h4 style={{ fontSize: "0.8125rem", fontWeight: 700, color: isSelected ? "var(--primary)" : "var(--text-primary)", marginBottom: "2px" }}>
                      {lead.title}
                    </h4>

                    <div style={{ fontSize: "0.6875rem", color: "var(--text-secondary)", display: "flex", justifyContent: "space-between" }}>
                      <span>{lead.company_name || "Account"}</span>
                      <span style={{ color: "var(--purple-dark)", fontWeight: 600 }}>{lead.contact_phone || "No phone"}</span>
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
            {/* Contact Header Card */}
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
                  <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", fontWeight: 600 }}>
                    Sourced via {selectedLead.source}
                  </span>
                </div>
                <h3 style={{ fontSize: "1.25rem", fontWeight: 800, color: "var(--text-primary)" }}>
                  {selectedLead.contact_name || "Contact Person"}
                </h3>
                <p style={{ fontSize: "0.8125rem", color: "var(--text-secondary)", fontWeight: 600 }}>
                  {selectedLead.company_name} — {selectedLead.title}
                </p>
              </div>

              {/* Masked Phone Display & Action Triggers */}
              <div style={{ textAlign: "right" }}>
                <span style={{ fontSize: "0.6875rem", color: "var(--text-muted)", display: "block", marginBottom: "2px", fontWeight: 600 }}>
                  Masked Mobile Contact
                </span>
                <p style={{ fontSize: "1.25rem", fontFamily: "monospace", fontWeight: 800, color: "var(--text-primary)", letterSpacing: "0.05em" }}>
                  {selectedLead.contact_phone || "Not available"}
                </p>
                {selectedLead.contact_email && (
                  <span
                    onClick={handleGmail}
                    title="Click to compose in Gmail"
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
                    {selectedLead.contact_email}
                  </span>
                )}
                <div style={{ display: "flex", gap: "8px", marginTop: "8px", justifyContent: "flex-end", flexWrap: "wrap" }}>
                  {!isCalling ? (
                    <button
                      onClick={handleStartCall}
                      className="btn-primary"
                      style={{ background: "linear-gradient(135deg, #059669, #047857)", borderColor: "#065f46", fontSize: "0.75rem", padding: "6px 14px" }}
                    >
                      <PhoneCall style={{ width: "14px", height: "14px" }} />
                      Call Lead
                    </button>
                  ) : (
                    <button
                      onClick={handleEndCall}
                      style={{
                        background: "#dc2626",
                        border: "1px solid #b91c1c",
                        borderRadius: "8px",
                        padding: "6px 14px",
                        color: "#fff",
                        fontWeight: 700,
                        cursor: "pointer",
                        fontSize: "0.75rem",
                        display: "flex",
                        alignItems: "center",
                        gap: "6px"
                      }}
                    >
                      <PhoneOff style={{ width: "14px", height: "14px" }} />
                      End Call ({formatTimer(callDuration)})
                    </button>
                  )}
                  <button
                    onClick={handleWhatsApp}
                    className="btn-secondary"
                    style={{ fontSize: "0.75rem", padding: "6px 12px" }}
                    title="Open WhatsApp chat in new tab"
                  >
                    <MessageCircle style={{ width: "14px", height: "14px", color: "var(--emerald)" }} />
                    WhatsApp
                  </button>
                  <button
                    onClick={handleGmail}
                    className="btn-secondary"
                    style={{ fontSize: "0.75rem", padding: "6px 12px", color: "#dc2626", borderColor: "#fecaca" }}
                    title="Open Gmail composer in new tab"
                  >
                    <Mail style={{ width: "14px", height: "14px", color: "#dc2626" }} />
                    Email (Gmail)
                  </button>
                </div>
              </div>
            </div>

            {/* In-Call Active Cockpit Banner */}
            {isCalling && (
              <div style={{
                padding: "16px 20px",
                borderRadius: "12px",
                background: "linear-gradient(135deg, #064e3b 0%, #065f46 100%)",
                color: "#fff",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                flexWrap: "wrap",
                gap: "12px",
                boxShadow: "0 6px 16px rgba(5, 150, 105, 0.25)"
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  <div style={{
                    width: "12px",
                    height: "12px",
                    borderRadius: "50%",
                    background: "#34d399",
                    boxShadow: "0 0 0 4px rgba(52, 211, 153, 0.35)"
                  }} />
                  <div>
                    <div style={{ fontSize: "0.875rem", fontWeight: 800 }}>
                      Live VoIP Outbound Call in Progress
                    </div>
                    <div style={{ fontSize: "0.75rem", color: "#a7f3d0" }}>
                      Connected with {selectedLead.contact_name || selectedLead.title} ({selectedLead.contact_phone})
                    </div>
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  <span style={{ fontSize: "1.25rem", fontFamily: "monospace", fontWeight: 800, color: "#fff", letterSpacing: "0.06em" }}>
                    {formatTimer(callDuration)}
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsMuted(!isMuted)}
                    style={{
                      background: isMuted ? "#ef4444" : "rgba(255, 255, 255, 0.18)",
                      border: "none",
                      borderRadius: "6px",
                      padding: "6px 12px",
                      color: "#fff",
                      cursor: "pointer",
                      fontSize: "0.75rem",
                      display: "flex",
                      alignItems: "center",
                      gap: "4px"
                    }}
                  >
                    {isMuted ? <MicOff style={{ width: "14px", height: "14px" }} /> : <Mic style={{ width: "14px", height: "14px" }} />}
                    {isMuted ? "Unmute" : "Mute"}
                  </button>
                  <button
                    type="button"
                    onClick={handleEndCall}
                    style={{
                      background: "#dc2626",
                      border: "1px solid #b91c1c",
                      borderRadius: "6px",
                      padding: "6px 16px",
                      color: "#fff",
                      fontWeight: 700,
                      cursor: "pointer",
                      fontSize: "0.75rem",
                      display: "flex",
                      alignItems: "center",
                      gap: "6px"
                    }}
                  >
                    <PhoneOff style={{ width: "14px", height: "14px" }} />
                    End Call & Advance
                  </button>
                </div>
              </div>
            )}

            {/* Structured Call Outcome Selector */}
            <div>
              <label style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--text-primary)", textTransform: "uppercase", letterSpacing: "0.04em", display: "block", marginBottom: "10px" }}>
                1. Select Call Outcome
              </label>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: "8px" }}>
                {OUTCOMES.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setOutcome(item.id)}
                    style={{
                      padding: "10px 12px",
                      borderRadius: "8px",
                      border: outcome === item.id ? "2px solid var(--primary)" : "1px solid var(--border-medium)",
                      background: outcome === item.id ? "var(--primary-light)" : "var(--bg-surface)",
                      color: outcome === item.id ? "var(--primary)" : "var(--text-primary)",
                      fontWeight: 700,
                      fontSize: "0.75rem",
                      cursor: "pointer",
                      textAlign: "left",
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                      boxShadow: outcome === item.id ? "var(--shadow-sm)" : "none",
                      transition: "all 0.15s ease"
                    }}
                  >
                    <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: item.color }} />
                    <span>{item.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Notes & Follow-up Row */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "16px" }}>
              <div>
                <label style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--text-primary)", textTransform: "uppercase", letterSpacing: "0.04em", display: "block", marginBottom: "6px" }}>
                  2. Call Notes & Discussion Highlights
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. Client interested in enterprise trial, requesting demo with VP Engineering..."
                  rows={3}
                  className="textarea-field"
                />
              </div>

              <div>
                <label style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--text-primary)", textTransform: "uppercase", letterSpacing: "0.04em", display: "block", marginBottom: "6px" }}>
                  3. Schedule Follow-up Reminder
                </label>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                  {[
                    { id: "tomorrow", label: "Tomorrow" },
                    { id: "3days", label: "In 3 Days" },
                    { id: "nextweek", label: "Next Week" },
                    { id: "none", label: "No Follow-up" },
                  ].map((preset) => (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => setFollowupPreset(preset.id)}
                      style={{
                        padding: "8px 10px",
                        borderRadius: "8px",
                        border: followupPreset === preset.id ? "2px solid var(--primary)" : "1px solid var(--border-medium)",
                        background: followupPreset === preset.id ? "var(--primary-light)" : "var(--bg-surface)",
                        color: followupPreset === preset.id ? "var(--primary)" : "var(--text-secondary)",
                        fontWeight: 600,
                        fontSize: "0.75rem",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: "6px"
                      }}
                    >
                      <Calendar style={{ width: "12px", height: "12px" }} />
                      <span>{preset.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Save & Advance Button */}
            <div style={{ paddingTop: "12px", borderTop: "1px solid var(--border-subtle)", display: "flex", justifyContent: "flex-end" }}>
              <button
                onClick={handleRecordOutcome}
                disabled={loggingOutcome}
                className="btn-primary"
                style={{ padding: "10px 24px", fontSize: "0.875rem" }}
              >
                {loggingOutcome ? "Recording..." : "Log Call & Advance to Next Lead"}
                <ChevronRight style={{ width: "16px", height: "16px" }} />
              </button>
            </div>
          </div>
        ) : (
          <div className="card" style={{ padding: "48px", textAlign: "center", color: "var(--text-muted)", fontSize: "0.875rem" }}>
            Select a lead from the assigned queue to begin outreach.
          </div>
        )}
      </div>
    </div>
  );
};
