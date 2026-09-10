import React, { useState, useEffect, useMemo } from "react";
import { Lead, api } from "../services/api";
import { openGmail, openWhatsApp } from "../utils/mailHelper";
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
  Search
} from "lucide-react";

export const TelecallerDesk: React.FC = () => {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterPriority, setFilterPriority] = useState("ALL");

  // Outcome logger state
  const [outcome, setOutcome] = useState<string>("CONNECTED");
  const [notes, setNotes] = useState("");
  const [followupPreset, setFollowupPreset] = useState<string>("tomorrow");
  const [loggingOutcome, setLoggingOutcome] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    loadMyLeads();
  }, []);

  // Fetch all leads from the organization (synced with ORG Admin dashboard)
  const loadMyLeads = async () => {
    setLoading(true);
    try {
      const data = await api.getLeads();
      setLeads(data || []);
      if (data && data.length > 0) {
        setSelectedLead((prev) => (prev ? data.find((l) => l.id === prev.id) || data[0] : data[0]));
      }
    } catch (e) {
      console.error("Error loading leads in telecaller desk:", e);
    } finally {
      setLoading(false);
    }
  };

  // Filtered leads based on search query and priority chip
  const filteredLeads = useMemo(() => {
    return leads.filter((lead) => {
      // Priority filter
      if (filterPriority !== "ALL") {
        if (filterPriority === "HOT") {
          if (lead.priority !== "URGENT" && lead.priority !== "HIGH") return false;
        } else if (lead.priority !== filterPriority) {
          return false;
        }
      }
      // Text search
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
  }, [leads, filterPriority, searchQuery]);

  // Single Call button that straightaway opens the native OS/Mobile "Pick an App" / Phone dialer
  const handleCall = async () => {
    if (!selectedLead) return;
    setSuccessMsg("Opening Phone App / 'Pick an App' prompt on your device...");
    setTimeout(() => setSuccessMsg(null), 4000);

    // Pre-fill notes for the telecaller to log discussion after the call
    if (!notes) {
      setNotes(`Outbound Call placed to ${selectedLead.contact_name || selectedLead.title}. Notes: `);
    }

    try {
      const res = await api.triggerLeadAction(selectedLead.id, "call");
      if (res.tel_url) {
        // Triggers the device's native "Pick an App" / Phone dialer
        window.location.href = res.tel_url;
      }
    } catch (e) {
      console.warn("Call trigger audit error", e);
    }
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

      // Move to next lead in filtered queue
      const currentIndex = filteredLeads.findIndex((l) => l.id === selectedLead.id);
      if (currentIndex < filteredLeads.length - 1) {
        setSelectedLead(filteredLeads[currentIndex + 1]);
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
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <h2 style={{ fontSize: "1.375rem", fontWeight: 800, color: "var(--text-primary)", letterSpacing: "-0.02em", display: "flex", alignItems: "center", gap: "8px" }}>
              <PhoneCall style={{ width: "20px", height: "20px", color: "var(--emerald)" }} />
              Telecaller Outbound Desk
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
              Synced with ORG Admin
            </span>
          </div>
          <p style={{ fontSize: "0.8125rem", color: "var(--text-secondary)", marginTop: "2px" }}>
            Direct device dialing (Pick an App), contact masking, and one-tap discussion outcome logging
          </p>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <button
            onClick={loadMyLeads}
            title="Refresh queue from ORG Admin"
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
            Sync Leads
          </button>
          <span className="badge badge-masked" style={{ fontSize: "0.75rem", padding: "5px 10px" }}>
            <ShieldCheck style={{ width: "14px", height: "14px" }} />
            Anti-Theft Active
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
        {/* Left Column: Leads to Contact (Fetched from ORG Admin) */}
        <div className="card" style={{ padding: "16px", display: "flex", flexDirection: "column", gap: "12px" }}>
          {/* Queue Header & Counter */}
          <div style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            paddingBottom: "10px",
            borderBottom: "1px solid var(--border-subtle)"
          }}>
            <div>
              <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--text-primary)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                Leads to Contact ({filteredLeads.length})
              </span>
              <span style={{ fontSize: "0.6875rem", color: "var(--text-muted)", display: "block" }}>
                Total in Organization: {leads.length} leads
              </span>
            </div>
            <span style={{ fontSize: "0.6875rem", color: "var(--emerald-dark)", fontWeight: 700, background: "var(--emerald-light)", padding: "2px 6px", borderRadius: "4px" }}>
              Live Connected
            </span>
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

          {/* Filter Chips */}
          <div style={{ display: "flex", gap: "4px", flexWrap: "wrap" }}>
            {[
              { key: "ALL", label: `All (${leads.length})` },
              { key: "HOT", label: `Hot (${leads.filter((l) => l.priority === "URGENT" || l.priority === "HIGH").length})` },
              { key: "MEDIUM", label: `Medium (${leads.filter((l) => l.priority === "MEDIUM").length})` }
            ].map((chip) => (
              <button
                key={chip.key}
                onClick={() => setFilterPriority(chip.key)}
                style={{
                  fontSize: "0.6875rem",
                  fontWeight: 600,
                  padding: "3px 8px",
                  borderRadius: "999px",
                  border: filterPriority === chip.key ? "1px solid var(--primary)" : "1px solid var(--border-subtle)",
                  background: filterPriority === chip.key ? "var(--primary-light)" : "var(--bg-surface-subtle)",
                  color: filterPriority === chip.key ? "var(--primary)" : "var(--text-secondary)",
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
              <p style={{ textAlign: "center", padding: "32px 0", fontSize: "0.75rem", color: "var(--text-muted)" }}>Loading leads from organization...</p>
            ) : filteredLeads.length === 0 ? (
              <div style={{ textAlign: "center", padding: "32px 12px", fontSize: "0.75rem", color: "var(--text-muted)" }}>
                <p style={{ fontWeight: 600 }}>No matching leads found</p>
                <p style={{ fontSize: "0.6875rem", marginTop: "4px" }}>Leads from ORG Admin will appear here.</p>
              </div>
            ) : (
              filteredLeads.map((lead) => {
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

                    <h4 style={{ fontSize: "0.8125rem", fontWeight: 700, color: isSelected ? "var(--primary)" : "var(--text-primary)", marginBottom: "2px", lineHeight: "1.3" }}>
                      {lead.title}
                    </h4>

                    <div style={{ fontSize: "0.6875rem", color: "var(--text-secondary)", display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "4px" }}>
                      <span style={{ fontWeight: 600 }}>{lead.company_name || "Account"}</span>
                      <span style={{ color: "var(--purple-dark)", fontWeight: 600, fontFamily: "monospace" }}>
                        {lead.contact_phone || "No phone"}
                      </span>
                    </div>

                    {lead.stage && (
                      <div style={{ marginTop: "6px", display: "flex", justifyContent: "flex-start" }}>
                        <span style={{
                          fontSize: "0.625rem",
                          fontWeight: 700,
                          padding: "1px 6px",
                          borderRadius: "4px",
                          background: "var(--bg-surface-subtle)",
                          color: "var(--text-secondary)",
                          border: "1px solid var(--border-subtle)"
                        }}>
                          Stage: {lead.stage.name}
                        </span>
                      </div>
                    )}
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

                {/* Direct Action Buttons: Call (Opens Pick an App), WhatsApp, Gmail */}
                <div style={{ display: "flex", gap: "8px", marginTop: "12px", justifyContent: "flex-end", flexWrap: "wrap" }}>
                  {/* Single Call button that straightaway opens the native OS / Mobile Pick an App prompt */}
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
                    title="Prompts device's 'Pick an App' / phone dialer"
                  >
                    <PhoneCall style={{ width: "14px", height: "14px" }} />
                    Call Lead
                  </button>

                  <button
                    onClick={handleWhatsApp}
                    className="btn-secondary"
                    style={{ fontSize: "0.75rem", padding: "7px 14px", display: "flex", alignItems: "center", gap: "6px" }}
                    title="Open WhatsApp chat in new tab"
                  >
                    <MessageCircle style={{ width: "14px", height: "14px", color: "var(--emerald)" }} />
                    WhatsApp
                  </button>

                  <button
                    onClick={handleGmail}
                    className="btn-secondary"
                    style={{ fontSize: "0.75rem", padding: "7px 14px", color: "#dc2626", borderColor: "#fecaca", display: "flex", alignItems: "center", gap: "6px" }}
                    title="Open Gmail composer in new tab"
                  >
                    <Mail style={{ width: "14px", height: "14px", color: "#dc2626" }} />
                    Email (Gmail)
                  </button>
                </div>
              </div>
            </div>

            {/* Outcome & Rapid Discussion Logger */}
            <div style={{
              padding: "18px",
              borderRadius: "10px",
              background: "var(--bg-surface)",
              border: "1px solid var(--border-subtle)",
              display: "flex",
              flexDirection: "column",
              gap: "16px"
            }}>
              <div>
                <h4 style={{ fontSize: "0.875rem", fontWeight: 700, color: "var(--text-primary)", marginBottom: "4px" }}>
                  1. Select Call Outcome
                </h4>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: "8px", marginTop: "8px" }}>
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
                  rows={3}
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

              {/* Auto Follow-up Preset */}
              <div>
                <h4 style={{ fontSize: "0.875rem", fontWeight: 700, color: "var(--text-primary)", marginBottom: "4px" }}>
                  3. Automated Follow-up Task
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
                        fontWeight: 600,
                        fontSize: "0.75rem",
                        cursor: "pointer"
                      }}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Action Submit */}
              <div style={{ display: "flex", justifyContent: "flex-end", borderTop: "1px solid var(--border-subtle)", paddingTop: "14px" }}>
                <button
                  onClick={handleRecordOutcome}
                  disabled={loggingOutcome}
                  className="btn-primary"
                  style={{ fontSize: "0.8125rem", padding: "8px 20px" }}
                >
                  {loggingOutcome ? "Recording..." : "Save Outcome & Next Lead"}
                  <ChevronRight style={{ width: "16px", height: "16px" }} />
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="card" style={{ padding: "48px", textAlign: "center", color: "var(--text-muted)" }}>
            Select a lead from the organization queue to begin outbound calling.
          </div>
        )}
      </div>
    </div>
  );
};
