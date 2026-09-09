import React, { useState } from "react";
import { Lead, PipelineStage, api } from "../services/api";
import { openGmail } from "../utils/mailHelper";
import { Search, Phone, Mail, Flame, ExternalLink, Plus } from "lucide-react";

interface LeadsTableProps {
  leads: Lead[];
  stages: PipelineStage[];
  onSelectLead: (lead: Lead) => void;
  onMoveStage: (leadId: string, stageId: string) => void;
  onNewLeadClick?: () => void;
}

export const LeadsTable: React.FC<LeadsTableProps> = ({
  leads,
  stages,
  onSelectLead,
  onMoveStage,
  onNewLeadClick,
}) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedStage, setSelectedStage] = useState<string>("ALL");
  const [selectedStatus, setSelectedStatus] = useState<string>("ALL");

  const filteredLeads = leads.filter((l) => {
    const matchesSearch =
      !searchTerm ||
      l.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (l.company_name && l.company_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (l.contact_name && l.contact_name.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesStage = selectedStage === "ALL" || l.pipeline_stage_id === selectedStage;
    const matchesStatus = selectedStatus === "ALL" || l.status === selectedStatus;

    return matchesSearch && matchesStage && matchesStatus;
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      {/* Search & Filters */}
      <div className="card" style={{ padding: "16px", display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: "12px" }}>
        <div style={{ position: "relative", flex: 1, minWidth: "260px" }}>
          <Search style={{ width: "16px", height: "16px", color: "var(--text-muted)", position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)" }} />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search leads by title, company, contact person..."
            className="input-text"
            style={{ paddingLeft: "36px", fontSize: "0.8125rem" }}
          />
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          {/* Stage Filter */}
          <select
            value={selectedStage}
            onChange={(e) => setSelectedStage(e.target.value)}
            className="select-dropdown"
            style={{ width: "auto", fontSize: "0.8125rem" }}
          >
            <option value="ALL">All Pipeline Stages</option>
            {stages.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>

          {/* Status Filter */}
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="select-dropdown"
            style={{ width: "auto", fontSize: "0.8125rem" }}
          >
            <option value="ALL">All Statuses</option>
            <option value="OPEN">Open</option>
            <option value="WON">Won</option>
            <option value="LOST">Lost</option>
          </select>

          {onNewLeadClick && (
            <button
              onClick={onNewLeadClick}
              className="btn-primary"
              style={{ fontSize: "0.8125rem", whiteSpace: "nowrap" }}
            >
              <Plus style={{ width: "15px", height: "15px" }} />
              Add Lead
            </button>
          )}
        </div>
      </div>

      {/* Table Container */}
      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th style={{ paddingLeft: "20px" }}>Lead & Opportunity</th>
              <th>Contact Details</th>
              <th>Pipeline Stage</th>
              <th>Radar Score</th>
              <th>Estimated Value</th>
              <th style={{ textAlign: "right", paddingRight: "20px" }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredLeads.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ textAlign: "center", padding: "48px 0", color: "var(--text-muted)", fontStyle: "italic" }}>
                  No matching leads found
                </td>
              </tr>
            ) : (
              filteredLeads.map((lead) => (
                <tr
                  key={lead.id}
                  onClick={() => onSelectLead(lead)}
                  style={{ cursor: "pointer" }}
                >
                  <td style={{ paddingLeft: "20px" }}>
                    <p style={{ fontWeight: 700, color: "var(--text-primary)", fontSize: "0.8125rem" }}>
                      {lead.title}
                    </p>
                    <p style={{ color: "var(--text-secondary)", fontSize: "0.75rem", marginTop: "2px" }}>
                      {lead.company_name || "Independent Account"}
                    </p>
                  </td>

                  <td>
                    <p style={{ fontWeight: 600, color: "var(--text-primary)", fontSize: "0.75rem" }}>
                      {lead.contact_name || "Unassigned"}
                    </p>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px", marginTop: "3px", fontSize: "0.6875rem", color: "var(--text-secondary)" }}>
                      {lead.contact_phone && (
                        <span style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
                          <Phone style={{ width: "12px", height: "12px", color: "var(--emerald)" }} />
                          {lead.contact_phone}
                          {lead.is_phone_masked && (
                            <span className="badge badge-masked" style={{ fontSize: "0.5625rem", padding: "1px 4px" }}>
                              Masked
                            </span>
                          )}
                        </span>
                      )}
                      {lead.contact_email && (
                        <button
                          type="button"
                          onClick={async (e) => {
                            e.stopPropagation();
                            try {
                              const res = await api.triggerLeadAction(lead.id, "email");
                              if (res.gmail_url) {
                                window.open(res.gmail_url, "_blank", "noopener,noreferrer");
                              } else {
                                openGmail(lead.contact_email, `Regarding ${lead.title}`);
                              }
                            } catch {
                              openGmail(lead.contact_email, `Regarding ${lead.title}`);
                            }
                          }}
                          title="Open Gmail Composer"
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "4px",
                            background: "var(--bg-surface-subtle)",
                            border: "1px solid var(--border-subtle)",
                            borderRadius: "4px",
                            padding: "2px 6px",
                            fontSize: "0.6875rem",
                            color: "#dc2626",
                            cursor: "pointer",
                            transition: "all 0.15s ease",
                            textAlign: "left"
                          }}
                        >
                          <Mail style={{ width: "11px", height: "11px", color: "#dc2626" }} />
                          <span style={{ textDecoration: "underline", textDecorationStyle: "dotted" }}>{lead.contact_email}</span>
                        </button>
                      )}
                    </div>
                  </td>

                  <td>
                    <span
                      className="badge"
                      style={{
                        backgroundColor: `${lead.stage?.color || "#4f46e5"}15`,
                        color: lead.stage?.color || "var(--primary)",
                        border: `1px solid ${lead.stage?.color || "#4f46e5"}35`,
                      }}
                    >
                      {lead.stage?.name || "Stage"}
                    </span>
                  </td>

                  <td>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px", fontFamily: "monospace", fontWeight: 700, color: "var(--amber-dark)" }}>
                      <Flame style={{ width: "14px", height: "14px", color: "var(--amber)" }} />
                      <span>{lead.score}</span>
                      <span style={{ fontSize: "0.6875rem", color: "var(--text-muted)" }}>/ 100</span>
                    </div>
                  </td>

                  <td style={{ fontFamily: "monospace", fontWeight: 600, color: "var(--text-primary)" }}>
                    ₹{Number(lead.value || 0).toLocaleString("en-IN")}
                  </td>

                  <td style={{ textAlign: "right", paddingRight: "20px" }}>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectLead(lead);
                      }}
                      className="btn-secondary"
                      style={{ fontSize: "0.75rem", padding: "4px 10px" }}
                    >
                      <ExternalLink style={{ width: "13px", height: "13px" }} />
                      View 360°
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
