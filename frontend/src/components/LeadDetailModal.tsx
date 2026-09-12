import React, { useState, useEffect } from "react";
import { Lead, PipelineStage, Activity, api } from "../services/api";
import { openGmail, openWhatsApp } from "../utils/mailHelper";
// import { EmailComposeModal } from "./EmailComposeModal";
import { format10DigitPhone, getCallUrl } from "../utils/phoneHelper";
import { 
  X, 
  Phone, 
  MessageCircle, 
  Mail, 
  Sparkles, 
  Clock, 
  CheckCircle, 
  History,
  Shield, 
  Send
} from "lucide-react";

interface LeadDetailModalProps {
  lead: Lead;
  stages: PipelineStage[];
  onClose: () => void;
  onRefresh: () => void;
}

export const LeadDetailModal: React.FC<LeadDetailModalProps> = ({
  lead,
  stages,
  onClose,
  onRefresh,
}) => {
  const [currentLead, setCurrentLead] = useState<Lead>(lead);
  const [timeline, setTimeline] = useState<Activity[]>([]);
  const [stageHistories, setStageHistories] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<"timeline" | "ai" | "history">("timeline");
  const [copiedEmail, setCopiedEmail] = useState<string | null>(null);
  
  const handleCopyEmail = (email: string) => {
    if (!email) return;
    navigator.clipboard.writeText(email);
    setCopiedEmail(email);
    setTimeout(() => setCopiedEmail(null), 2000);
  };
  // Activity log state
  const [activityType, setActivityType] = useState("CALL");
  const [activitySubject, setActivitySubject] = useState("");
  const [activityDesc, setActivityDesc] = useState("");
  const [callStatus, setCallStatus] = useState("CONNECTED");
  const [submittingAct, setSubmittingAct] = useState(false);

  // AI states
  const [aiLoading, setAiLoading] = useState(false);
  const [aiScoreData, setAiScoreData] = useState<any>(null);
  const [aiSummaryData, setAiSummaryData] = useState<any>(null);
  const [aiNextAction, setAiNextAction] = useState<any>(null);

  useEffect(() => {
    loadTimelineAndHistory();
  }, [lead.id]);

  const loadTimelineAndHistory = async () => {
    try {
      const [tl, sh] = await Promise.all([
        api.getLeadTimeline(lead.id),
        api.getLeadStageHistory(lead.id),
      ]);
      setTimeline(tl);
      setStageHistories(sh);
    } catch (e) {
      console.error(e);
    }
  };

  const handleStageChange = async (newStageId: string) => {
    try {
      const updated = await api.updateLeadStage(currentLead.id, newStageId, "Manual stage change in 360° modal");
      setCurrentLead(updated);
      await loadTimelineAndHistory();
      onRefresh();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleLogActivity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activitySubject) return;
    setSubmittingAct(true);
    try {
      await api.logActivity({
        lead_id: currentLead.id,
        activity_type: activityType,
        subject: activitySubject,
        description: activityDesc,
        status: callStatus,
      });
      setActivitySubject("");
      setActivityDesc("");
      await loadTimelineAndHistory();
      onRefresh();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSubmittingAct(false);
    }
  };

  const handleRunAiScore = async () => {
    setAiLoading(true);
    try {
      const res = await api.scoreLeadAI(currentLead.id);
      setAiScoreData(res);
      setCurrentLead({ ...currentLead, score: res.score });
      onRefresh();
    } catch (e: any) {
      alert(e.message);
    } finally {
      setAiLoading(false);
    }
  };

  const handleRunAiSummary = async () => {
    setAiLoading(true);
    try {
      const res = await api.summarizeLeadAI(currentLead.id);
      setAiSummaryData(res);
    } catch (e: any) {
      alert(e.message);
    } finally {
      setAiLoading(false);
    }
  };

  const handleRunAiAction = async () => {
    setAiLoading(true);
    try {
      const res = await api.recommendNextActionAI(currentLead.id);
      setAiNextAction(res);
    } catch (e: any) {
      alert(e.message);
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <div className="drawer-overlay" onClick={onClose}>
      <div className="drawer-content" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div style={{
          padding: "20px 24px",
          borderBottom: "1px solid var(--border-subtle)",
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          background: "var(--bg-surface)"
        }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
              <span className={`badge ${currentLead.priority === "HIGH" ? "badge-hot" : "badge-medium"}`}>
                {currentLead.priority}
              </span>
              <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", fontWeight: 600 }}>
                Sourced via {currentLead.source}
              </span>
            </div>
            <h2 style={{ fontSize: "1.25rem", fontWeight: 800, color: "var(--text-primary)", letterSpacing: "-0.02em" }}>
              {currentLead.title}
            </h2>
            <p style={{ fontSize: "0.8125rem", color: "var(--text-secondary)", marginTop: "2px" }}>
              {currentLead.company_name || "Account not specified"}
            </p>
          </div>

          <button
            onClick={onClose}
            style={{
              padding: "6px",
              borderRadius: "8px",
              border: "1px solid var(--border-subtle)",
              background: "transparent",
              color: "var(--text-secondary)",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center"
            }}
          >
            <X style={{ width: "20px", height: "20px" }} />
          </button>
        </div>

        {/* Quick Action & Stage Progression Bar */}
        <div style={{
          padding: "14px 24px",
          borderBottom: "1px solid var(--border-subtle)",
          background: "var(--bg-surface-subtle)",
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "12px"
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--text-secondary)" }}>
              Current Stage:
            </span>
            <select
              value={currentLead.pipeline_stage_id}
              onChange={(e) => handleStageChange(e.target.value)}
              className="select-dropdown"
              style={{ fontWeight: 700, fontSize: "0.75rem", padding: "4px 8px", width: "auto" }}
            >
              {stages.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          {/* Quick Communication Triggers */}
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <button
              onClick={() => {
                if (currentLead.contact_phone && !currentLead.is_phone_masked) {
                  window.open(getCallUrl(currentLead.contact_phone));
                }
              }}
              className="btn-secondary"
              style={{ fontSize: "0.75rem", padding: "5px 10px" }}
              title={currentLead.is_phone_masked ? "Phone is protected" : `Call (+91 ${format10DigitPhone(currentLead.contact_phone)})`}
            >
              <Phone style={{ width: "13px", height: "13px", color: "var(--emerald)" }} />
              Call
            </button>

            <button
              onClick={async () => {
                try {
                  const res = await api.triggerLeadAction(currentLead.id, "whatsapp");
                  if (res.whatsapp_url) {
                    window.open(res.whatsapp_url, "_blank", "noopener,noreferrer");
                  } else {
                    openWhatsApp(currentLead.contact_phone, `Hello ${currentLead.contact_name || ""}, regarding ${currentLead.title}.`);
                  }
                } catch {
                  openWhatsApp(currentLead.contact_phone, `Hello ${currentLead.contact_name || ""}, regarding ${currentLead.title}.`);
                }
              }}
              className="btn-secondary"
              style={{ fontSize: "0.75rem", padding: "5px 10px" }}
              title="Open WhatsApp chat in new tab"
            >
              <MessageCircle style={{ width: "13px", height: "13px", color: "var(--emerald)" }} />
              WhatsApp
            </button>

            <button
              onClick={() => {
                if (currentLead.contact_email) {
                  handleCopyEmail(currentLead.contact_email);
                }
              }}
              className="btn-secondary"
              style={{ fontSize: "0.75rem", padding: "5px 10px", color: "#dc2626", borderColor: "#fecaca" }}
              title="Copy email to clipboard"
            >
              <Mail style={{ width: "13px", height: "13px", color: "#dc2626" }} />
              {copiedEmail === currentLead.contact_email ? "Copied!" : "Copy Email"}
            </button>
          </div>
        </div>

        {/* Scrollable Drawer Body */}
        <div style={{ flex: 1, overflowY: "auto", padding: "24px", display: "flex", flexDirection: "column", gap: "20px" }}>
          {/* Primary Contact Card */}
          <div className="card" style={{ padding: "16px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px", paddingBottom: "8px", borderBottom: "1px solid var(--border-subtle)" }}>
              <h3 style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                Primary Contact Information
              </h3>
              {currentLead.is_phone_masked && (
                <span className="badge badge-masked" style={{ fontSize: "0.625rem" }}>
                  <Shield style={{ width: "11px", height: "11px" }} />
                  Anti-Theft Data Masking Active
                </span>
              )}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", fontSize: "0.8125rem" }}>
              <div>
                <span style={{ fontSize: "0.6875rem", color: "var(--text-muted)", display: "block" }}>Contact Name</span>
                <p style={{ fontWeight: 700, color: "var(--text-primary)", marginTop: "2px" }}>
                  {currentLead.contact_name || "—"}
                </p>
              </div>

              <div>
                <span style={{ fontSize: "0.6875rem", color: "var(--text-muted)", display: "block" }}>Phone Number</span>
                <p style={{ fontWeight: 700, color: "var(--text-primary)", marginTop: "2px", display: "flex", alignItems: "center", gap: "6px" }}>
                  {format10DigitPhone(currentLead.contact_phone) || "—"}
                  {currentLead.is_phone_masked && (
                    <span style={{ fontSize: "0.625rem", color: "var(--purple-dark)", fontStyle: "italic" }}>(Protected)</span>
                  )}
                </p>
              </div>

              <div>
                <span style={{ fontSize: "0.6875rem", color: "var(--text-muted)", display: "block" }}>Email Address</span>
                <div style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "2px" }}>
                  <p style={{ fontWeight: 700, color: "var(--text-primary)" }}>
                    {currentLead.contact_email || "—"}
                  </p>
                  {currentLead.contact_email && (
                    <button
                      onClick={() => handleCopyEmail(currentLead.contact_email!)}
                      title="Copy email to clipboard"
                      style={{
                        background: "var(--bg-surface-subtle)",
                        border: "1px solid var(--border-medium)",
                        borderRadius: "4px",
                        padding: "2px 6px",
                        fontSize: "0.6875rem",
                        color: "#dc2626",
                        cursor: "pointer",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "3px"
                      }}
                    >
                      <Mail style={{ width: "11px", height: "11px", color: "#dc2626" }} />
                      {copiedEmail === currentLead.contact_email ? "Copied!" : "Copy Email"}
                    </button>
                  )}
                </div>
              </div>

              <div>
                <span style={{ fontSize: "0.6875rem", color: "var(--text-muted)", display: "block" }}>Deal Value</span>
                <p style={{ fontWeight: 800, fontFamily: "monospace", color: "var(--emerald-dark)", marginTop: "2px" }}>
                  ₹{Number(currentLead.value || 0).toLocaleString("en-IN")}
                </p>
              </div>
            </div>
          </div>

          {/* Sub Navigation Tabs */}
          <div style={{ display: "flex", gap: "8px", borderBottom: "1px solid var(--border-subtle)", paddingBottom: "8px" }}>
            <button
              onClick={() => setActiveTab("timeline")}
              style={{
                background: "transparent",
                border: "none",
                borderBottom: activeTab === "timeline" ? "2px solid var(--primary)" : "2px solid transparent",
                color: activeTab === "timeline" ? "var(--primary)" : "var(--text-secondary)",
                fontWeight: 700,
                fontSize: "0.8125rem",
                padding: "6px 12px",
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: "6px"
              }}
            >
              <Clock style={{ width: "14px", height: "14px" }} />
              Activity Timeline ({timeline.length})
            </button>

            <button
              onClick={() => setActiveTab("ai")}
              style={{
                background: "transparent",
                border: "none",
                borderBottom: activeTab === "ai" ? "2px solid var(--primary)" : "2px solid transparent",
                color: activeTab === "ai" ? "var(--primary)" : "var(--text-secondary)",
                fontWeight: 700,
                fontSize: "0.8125rem",
                padding: "6px 12px",
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: "6px"
              }}
            >
              <Sparkles style={{ width: "14px", height: "14px", color: "var(--amber)" }} />
              AI Copilot & Radar
            </button>

            <button
              onClick={() => setActiveTab("history")}
              style={{
                background: "transparent",
                border: "none",
                borderBottom: activeTab === "history" ? "2px solid var(--primary)" : "2px solid transparent",
                color: activeTab === "history" ? "var(--primary)" : "var(--text-secondary)",
                fontWeight: 700,
                fontSize: "0.8125rem",
                padding: "6px 12px",
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: "6px"
              }}
            >
              <History style={{ width: "14px", height: "14px" }} />
              Stage Audit ({stageHistories.length})
            </button>
          </div>

          {/* Tab 1: Timeline & Log Activity */}
          {activeTab === "timeline" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              {/* Log Activity Box */}
              <form onSubmit={handleLogActivity} className="card" style={{ padding: "16px", display: "flex", flexDirection: "column", gap: "12px" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span style={{ fontSize: "0.8125rem", fontWeight: 700, color: "var(--text-primary)" }}>Quick Log Activity</span>
                  <div style={{ display: "flex", gap: "4px" }}>
                    {["CALL", "WHATSAPP", "EMAIL", "NOTE"].map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setActivityType(t)}
                        style={{
                          fontSize: "0.6875rem",
                          fontWeight: 700,
                          padding: "3px 8px",
                          borderRadius: "6px",
                          border: "none",
                          cursor: "pointer",
                          background: activityType === t ? "var(--primary)" : "var(--bg-surface-subtle)",
                          color: activityType === t ? "#ffffff" : "var(--text-secondary)",
                          transition: "all 0.15s ease"
                        }}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>

                <input
                  type="text"
                  value={activitySubject}
                  onChange={(e) => setActivitySubject(e.target.value)}
                  placeholder="Subject / key discussion points..."
                  className="input-text"
                  required
                />

                <textarea
                  value={activityDesc}
                  onChange={(e) => setActivityDesc(e.target.value)}
                  placeholder="Additional remarks or client feedback..."
                  rows={2}
                  className="textarea-field"
                />

                <div style={{ display: "flex", justifyContent: "flex-end" }}>
                  <button type="submit" disabled={submittingAct} className="btn-primary" style={{ padding: "6px 14px" }}>
                    <Send style={{ width: "13px", height: "13px" }} />
                    {submittingAct ? "Saving..." : "Log Interaction"}
                  </button>
                </div>
              </form>

              {/* Chronological Timeline List */}
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {timeline.map((act) => (
                  <div
                    key={act.id}
                    style={{
                      padding: "12px 16px",
                      borderRadius: "8px",
                      background: "var(--bg-surface)",
                      border: "1px solid var(--border-subtle)",
                      borderLeft: "3px solid var(--primary)",
                      boxShadow: "var(--shadow-xs)",
                      fontSize: "0.8125rem"
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "4px" }}>
                      <span style={{ fontWeight: 700, color: "var(--text-primary)", display: "flex", alignItems: "center", gap: "6px" }}>
                        {act.activity_type === "CALL" && <Phone style={{ width: "13px", height: "13px", color: "var(--emerald)" }} />}
                        {act.activity_type === "WHATSAPP" && <MessageCircle style={{ width: "13px", height: "13px", color: "var(--emerald)" }} />}
                        {act.activity_type === "EMAIL" && <Mail style={{ width: "13px", height: "13px", color: "var(--primary)" }} />}
                        {act.subject || act.activity_type}
                      </span>
                      <span style={{ fontSize: "0.6875rem", color: "var(--text-muted)" }}>
                        {new Date(act.occurred_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                    {act.description && <p style={{ color: "var(--text-secondary)", marginTop: "4px", fontSize: "0.75rem" }}>{act.description}</p>}
                    <p style={{ fontSize: "0.6875rem", color: "var(--text-muted)", marginTop: "4px" }}>Logged by {act.user_name || "System"}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Tab 2: AI Copilot */}
          {activeTab === "ai" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "8px" }}>
                <button
                  onClick={handleRunAiScore}
                  disabled={aiLoading}
                  className="btn-secondary"
                  style={{ fontSize: "0.75rem", padding: "8px 6px" }}
                >
                  <Sparkles style={{ width: "14px", height: "14px", color: "var(--amber)" }} />
                  Evaluate Score
                </button>
                <button
                  onClick={handleRunAiSummary}
                  disabled={aiLoading}
                  className="btn-secondary"
                  style={{ fontSize: "0.75rem", padding: "8px 6px" }}
                >
                  <Sparkles style={{ width: "14px", height: "14px", color: "var(--primary)" }} />
                  Account Brief
                </button>
                <button
                  onClick={handleRunAiAction}
                  disabled={aiLoading}
                  className="btn-secondary"
                  style={{ fontSize: "0.75rem", padding: "8px 6px" }}
                >
                  <Sparkles style={{ width: "14px", height: "14px", color: "var(--cyan)" }} />
                  Next Best Action
                </button>
              </div>

              {aiLoading && (
                <div style={{ textAlign: "center", padding: "24px 0", fontSize: "0.8125rem", color: "var(--primary)", fontWeight: 600 }}>
                  JARVIS AI analyzing account signals and engagement patterns...
                </div>
              )}

              {aiScoreData && (
                <div className="card" style={{ padding: "16px", display: "flex", flexDirection: "column", gap: "8px", borderLeft: "4px solid var(--amber)" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span style={{ fontSize: "0.8125rem", fontWeight: 700, color: "var(--amber-dark)" }}>Score Assessment</span>
                    <span className="badge badge-hot">{aiScoreData.qualification_tier} TIER</span>
                  </div>
                  <div style={{ fontSize: "1.75rem", fontWeight: 800, color: "var(--text-primary)", fontFamily: "monospace" }}>
                    {aiScoreData.score} <span style={{ fontSize: "1rem", color: "var(--text-muted)" }}>/ 100</span>
                  </div>
                  <p style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>
                    Estimated Conversion Probability: <strong>{(aiScoreData.conversion_probability * 100).toFixed(0)}%</strong>
                  </p>
                  <div style={{ display: "flex", flexDirection: "column", gap: "4px", paddingTop: "8px" }}>
                    {aiScoreData.key_signals.map((sig: string, idx: number) => (
                      <div key={idx} style={{ fontSize: "0.75rem", color: "var(--text-secondary)", display: "flex", alignItems: "center", gap: "6px" }}>
                        <CheckCircle style={{ width: "13px", height: "13px", color: "var(--emerald)", flexShrink: 0 }} />
                        <span>{sig}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {aiSummaryData && (
                <div className="card" style={{ padding: "16px", display: "flex", flexDirection: "column", gap: "8px", borderLeft: "4px solid var(--primary)" }}>
                  <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--primary)", textTransform: "uppercase" }}>
                    Executive Account Brief
                  </span>
                  <h4 style={{ fontSize: "0.9375rem", fontWeight: 800, color: "var(--text-primary)" }}>{aiSummaryData.headline}</h4>
                  <p style={{ fontSize: "0.8125rem", color: "var(--text-secondary)", lineHeight: "1.5" }}>{aiSummaryData.business_context}</p>
                  <div style={{ paddingTop: "8px", borderTop: "1px solid var(--border-subtle)" }}>
                    <span style={{ fontSize: "0.6875rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase" }}>Recommended Next Step:</span>
                    <p style={{ fontSize: "0.8125rem", fontWeight: 600, color: "var(--primary)", marginTop: "2px" }}>{aiSummaryData.suggested_next_step}</p>
                  </div>
                </div>
              )}

              {aiNextAction && (
                <div className="card" style={{ padding: "16px", display: "flex", flexDirection: "column", gap: "8px", borderLeft: "4px solid var(--cyan)" }}>
                  <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--cyan-dark)", textTransform: "uppercase" }}>
                    Autonomous Next Best Action
                  </span>
                  <p style={{ fontSize: "0.875rem", fontWeight: 700, color: "var(--text-primary)" }}>{aiNextAction.recommended_action}</p>
                  <p style={{ fontSize: "0.8125rem", color: "var(--text-secondary)" }}>{aiNextAction.reason}</p>
                  {aiNextAction.suggested_message && (
                    <div style={{ padding: "10px", borderRadius: "6px", background: "var(--bg-surface-subtle)", border: "1px solid var(--border-subtle)", fontSize: "0.75rem", color: "var(--text-primary)", fontFamily: "monospace" }}>
                      "{aiNextAction.suggested_message}"
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Tab 3: Stage Audit History */}
          {activeTab === "history" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {stageHistories.map((hist) => (
                <div
                  key={hist.id}
                  style={{
                    padding: "12px",
                    borderRadius: "8px",
                    background: "var(--bg-surface)",
                    border: "1px solid var(--border-subtle)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    fontSize: "0.8125rem"
                  }}
                >
                  <div>
                    <p style={{ fontWeight: 700, color: "var(--text-primary)" }}>
                      {hist.from_stage_name ? `${hist.from_stage_name} → ${hist.to_stage_name}` : `Created in ${hist.to_stage_name}`}
                    </p>
                    <p style={{ fontSize: "0.75rem", color: "var(--text-secondary)", marginTop: "2px" }}>{hist.reason || "Stage transition"}</p>
                    <p style={{ fontSize: "0.6875rem", color: "var(--text-muted)", marginTop: "2px" }}>By {hist.changed_by_name || "System"}</p>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <span style={{ fontSize: "0.75rem", fontFamily: "monospace", color: "var(--text-muted)" }}>
                      {new Date(hist.created_at).toLocaleDateString()}
                    </span>
                    {hist.duration_seconds > 0 && (
                      <p style={{ fontSize: "0.6875rem", color: "var(--primary)", fontWeight: 600 }}>
                        Stayed {Math.round(hist.duration_seconds / 60)} min
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
