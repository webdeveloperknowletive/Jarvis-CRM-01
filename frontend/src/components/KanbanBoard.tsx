import React, { useState, useEffect, useRef, useMemo } from "react";
import { Lead, PipelineStage, api } from "../services/api";
import { openGmail } from "../utils/mailHelper";
import {
  Plus,
  Flame,
  Phone,
  Mail,
  ArrowRight,
  GripVertical,
  ArrowDown,
  Search,
  CheckCircle2,
  Sparkles
} from "lucide-react";

interface KanbanBoardProps {
  stages: PipelineStage[];
  leads: Lead[];
  onSelectLead: (lead: Lead) => void;
  onMoveStage: (leadId: string, stageId: string) => void;
  onNewLeadClick: () => void;
}

export const KanbanBoard: React.FC<KanbanBoardProps> = ({
  stages,
  leads,
  onSelectLead,
  onMoveStage,
  onNewLeadClick,
}) => {
  const [localLeads, setLocalLeads] = useState<Lead[]>(leads);
  const [draggingLeadId, setDraggingLeadId] = useState<string | null>(null);
  const [dragOverStageId, setDragOverStageId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [priorityFilter, setPriorityFilter] = useState<string>("ALL");
  const [statusMessage, setStatusMessage] = useState<{ text: string; stageName: string } | null>(null);

  const isDraggingRef = useRef(false);
  const dragSourceStageIdRef = useRef<string | null>(null);

  // Sync optimistic local leads whenever prop leads changes
  useEffect(() => {
    setLocalLeads(leads);
  }, [leads]);

  // Format deal value into readable Indian currency (k / L / Cr)
  const formatRevenue = (value: number) => {
    if (value >= 10000000) return `₹${(value / 10000000).toFixed(2)} Cr`;
    if (value >= 100000) return `₹${(value / 100000).toFixed(1)} L`;
    if (value >= 1000) return `₹${(value / 1000).toFixed(0)}k`;
    return `₹${value.toLocaleString("en-IN")}`;
  };

  // Filtered leads based on search query and priority chip
  const filteredLeads = useMemo(() => {
    return localLeads.filter((l) => {
      // Priority filter
      if (priorityFilter !== "ALL") {
        if (priorityFilter === "HOT") {
          if (l.priority !== "URGENT" && l.priority !== "HIGH") return false;
        } else if (l.priority !== priorityFilter) {
          return false;
        }
      }
      // Search query filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesTitle = l.title?.toLowerCase().includes(q);
        const matchesCompany = l.company_name?.toLowerCase().includes(q);
        const matchesContact = l.contact_name?.toLowerCase().includes(q);
        const matchesEmail = l.contact_email?.toLowerCase().includes(q);
        if (!matchesTitle && !matchesCompany && !matchesContact && !matchesEmail) {
          return false;
        }
      }
      return true;
    });
  }, [localLeads, priorityFilter, searchQuery]);

  // Drag handlers
  const handleDragStart = (e: React.DragEvent, lead: Lead, stageId: string) => {
    isDraggingRef.current = true;
    dragSourceStageIdRef.current = stageId;
    setDraggingLeadId(lead.id);

    e.dataTransfer.setData("text/plain", lead.id);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragEnd = () => {
    setDraggingLeadId(null);
    setDragOverStageId(null);
    dragSourceStageIdRef.current = null;
    // Debounce resetting isDragging so following click event doesn't trigger onSelectLead
    setTimeout(() => {
      isDraggingRef.current = false;
    }, 120);
  };

  const handleDragOver = (e: React.DragEvent, stageId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (dragOverStageId !== stageId) {
      setDragOverStageId(stageId);
    }
  };

  const handleDrop = (e: React.DragEvent, targetStage: PipelineStage) => {
    e.preventDefault();
    const droppedLeadId = e.dataTransfer.getData("text/plain") || draggingLeadId;

    setDraggingLeadId(null);
    setDragOverStageId(null);
    dragSourceStageIdRef.current = null;

    if (!droppedLeadId) return;

    // Check if lead already in this stage
    const currentLead = localLeads.find((l) => l.id === droppedLeadId);
    if (!currentLead || currentLead.pipeline_stage_id === targetStage.id) {
      return;
    }

    // Optimistic UI state update
    setLocalLeads((prev) =>
      prev.map((l) => (l.id === droppedLeadId ? { ...l, pipeline_stage_id: targetStage.id } : l))
    );

    // Flash toast banner
    setStatusMessage({
      text: `Advanced "${currentLead.title}"`,
      stageName: targetStage.name,
    });
    setTimeout(() => {
      setStatusMessage(null);
    }, 3500);

    // Trigger backend stage transition
    onMoveStage(droppedLeadId, targetStage.id);
  };

  const handleCardClick = (lead: Lead) => {
    if (isDraggingRef.current) return;
    onSelectLead(lead);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      {/* Top Action Bar */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "12px" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <h2 style={{ fontSize: "1.375rem", fontWeight: 800, color: "var(--text-primary)", letterSpacing: "-0.02em" }}>
              Sales Pipeline
            </h2>
            <span style={{
              fontSize: "0.6875rem",
              fontWeight: 700,
              padding: "2px 8px",
              borderRadius: "999px",
              backgroundColor: "var(--primary-light)",
              color: "var(--primary)",
              border: "1px solid var(--primary-border)"
            }}>
              Drag & Drop Enabled
            </span>
          </div>
          <p style={{ fontSize: "0.8125rem", color: "var(--text-secondary)", marginTop: "2px" }}>
            Real-time lead progression across configured stages. Drag cards to advance pipelines.
          </p>
        </div>
        <button onClick={onNewLeadClick} className="btn-primary">
          <Plus style={{ width: "16px", height: "16px" }} />
          Create New Lead
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div
        className="card"
        style={{
          padding: "10px 16px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: "12px",
          background: "var(--bg-surface)",
          border: "1px solid var(--border-subtle)",
          borderRadius: "10px"
        }}
      >
        {/* Search input */}
        <div style={{ display: "flex", alignItems: "center", gap: "8px", flex: "1 1 240px", maxWidth: "420px" }}>
          <Search style={{ width: "16px", height: "16px", color: "var(--text-muted)" }} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Filter by title, company, or contact..."
            style={{
              width: "100%",
              border: "none",
              background: "transparent",
              fontSize: "0.8125rem",
              color: "var(--text-primary)",
              outline: "none"
            }}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              style={{
                background: "transparent",
                border: "none",
                fontSize: "0.75rem",
                color: "var(--text-muted)",
                cursor: "pointer",
                padding: "2px 4px"
              }}
            >
              Clear
            </button>
          )}
        </div>

        {/* Priority Filter Chips */}
        <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
          {[
            { key: "ALL", label: `All (${localLeads.length})` },
            {
              key: "HOT",
              label: `Hot / Urgent (${localLeads.filter((l) => l.priority === "URGENT" || l.priority === "HIGH").length})`,
            },
            {
              key: "MEDIUM",
              label: `Medium (${localLeads.filter((l) => l.priority === "MEDIUM").length})`,
            },
            {
              key: "LOW",
              label: `Low (${localLeads.filter((l) => l.priority === "LOW").length})`,
            },
          ].map((chip) => (
            <button
              key={chip.key}
              onClick={() => setPriorityFilter(chip.key)}
              style={{
                fontSize: "0.6875rem",
                fontWeight: 600,
                padding: "4px 10px",
                borderRadius: "999px",
                border: priorityFilter === chip.key ? "1px solid var(--primary)" : "1px solid var(--border-subtle)",
                background: priorityFilter === chip.key ? "var(--primary-light)" : "var(--bg-surface-subtle)",
                color: priorityFilter === chip.key ? "var(--primary)" : "var(--text-secondary)",
                cursor: "pointer",
                transition: "all 0.15s ease"
              }}
            >
              {chip.label}
            </button>
          ))}
        </div>

        {/* Dynamic Drag Hint / Toast */}
        {statusMessage ? (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              padding: "4px 10px",
              borderRadius: "6px",
              background: "var(--emerald-light)",
              border: "1px solid var(--emerald-border)",
              color: "var(--emerald-dark)",
              fontSize: "0.75rem",
              fontWeight: 600,
            }}
          >
            <CheckCircle2 style={{ width: "14px", height: "14px", color: "var(--emerald)" }} />
            <span>
              {statusMessage.text} &rarr; <strong>{statusMessage.stageName}</strong>
            </span>
          </div>
        ) : (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              fontSize: "0.6875rem",
              color: "var(--text-muted)",
              fontWeight: 500,
            }}
          >
            <Sparkles style={{ width: "13px", height: "13px", color: "var(--primary)" }} />
            <span>Drag cards between columns to update stage</span>
          </div>
        )}
      </div>

      {/* Kanban Board Horizontal Strip */}
      <div
        style={{
          display: "flex",
          gap: "16px",
          overflowX: "auto",
          paddingBottom: "16px",
          alignItems: "flex-start",
          minHeight: "calc(100vh - 270px)",
        }}
      >
        {stages.map((stage, idx) => {
          const stageLeads = filteredLeads.filter((l) => l.pipeline_stage_id === stage.id);
          const totalValue = stageLeads.reduce((acc, curr) => acc + Number(curr.value || 0), 0);
          const isOverTarget = dragOverStageId === stage.id;
          const isDraggingCardFromOtherStage =
            Boolean(draggingLeadId && dragSourceStageIdRef.current !== stage.id);

          return (
            <div
              key={stage.id}
              className={`kanban-column ${isOverTarget && isDraggingCardFromOtherStage ? "drag-over" : ""}`}
              onDragOver={(e) => handleDragOver(e, stage.id)}
              onDrop={(e) => handleDrop(e, stage)}
              style={{
                width: "310px",
                flexShrink: 0,
                background: "var(--bg-surface)",
                border: "1px solid var(--border-subtle)",
                borderRadius: "12px",
                padding: "14px",
                display: "flex",
                flexDirection: "column",
                maxHeight: "82vh",
                boxShadow: "var(--shadow-sm)",
              }}
            >
              {/* Column Stage Header */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  paddingBottom: "12px",
                  marginBottom: "12px",
                  borderBottom: "1px solid var(--border-subtle)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <div
                    style={{
                      width: "10px",
                      height: "10px",
                      borderRadius: "50%",
                      backgroundColor: stage.color || "var(--primary)",
                    }}
                  />
                  <h3
                    style={{
                      fontSize: "0.8125rem",
                      fontWeight: 700,
                      color: "var(--text-primary)",
                      textTransform: "uppercase",
                      letterSpacing: "0.03em",
                    }}
                  >
                    {stage.name}
                  </h3>
                  <span
                    style={{
                      fontSize: "0.6875rem",
                      fontWeight: 700,
                      padding: "2px 7px",
                      borderRadius: "999px",
                      background: "var(--bg-surface-subtle)",
                      color: "var(--text-secondary)",
                    }}
                  >
                    {stageLeads.length}
                  </span>
                </div>
                <span
                  style={{
                    fontSize: "0.75rem",
                    fontFamily: "monospace",
                    fontWeight: 700,
                    color: "var(--text-secondary)",
                  }}
                >
                  {formatRevenue(totalValue)}
                </span>
              </div>

              {/* Cards Container */}
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "10px",
                  overflowY: "auto",
                  paddingRight: "2px",
                  flex: 1,
                  minHeight: "120px",
                }}
              >
                {stageLeads.length === 0 ? (
                  <div
                    style={{
                      textAlign: "center",
                      padding: "32px 12px",
                      fontSize: "0.75rem",
                      color: "var(--text-muted)",
                      fontStyle: "italic",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      gap: "6px"
                    }}
                  >
                    {isOverTarget && isDraggingCardFromOtherStage ? (
                      <div className="kanban-drop-indicator" style={{ width: "100%" }}>
                        <ArrowDown style={{ width: "14px", height: "14px" }} />
                        <span>Drop here to move to {stage.name}</span>
                      </div>
                    ) : (
                      <span>No leads in this stage</span>
                    )}
                  </div>
                ) : (
                  <>
                    {stageLeads.map((lead) => {
                      const isBeingDragged = draggingLeadId === lead.id;

                      return (
                        <div
                          key={lead.id}
                          draggable={true}
                          onDragStart={(e) => handleDragStart(e, lead, stage.id)}
                          onDragEnd={handleDragEnd}
                          onClick={() => handleCardClick(lead)}
                          className={`kanban-card ${isBeingDragged ? "is-dragging" : ""}`}
                          title="Click to view details, or drag to change stage"
                          style={{
                            padding: "14px",
                            background: "var(--bg-surface)",
                            border: "1px solid var(--border-subtle)",
                            borderRadius: "10px",
                            boxShadow: "var(--shadow-xs)",
                            position: "relative",
                          }}
                          onMouseOver={(e) => {
                            if (!isBeingDragged) {
                              e.currentTarget.style.boxShadow = "var(--shadow-md)";
                              e.currentTarget.style.borderColor = "var(--primary-border)";
                              e.currentTarget.style.transform = "translateY(-1px)";
                            }
                          }}
                          onMouseOut={(e) => {
                            if (!isBeingDragged) {
                              e.currentTarget.style.boxShadow = "var(--shadow-xs)";
                              e.currentTarget.style.borderColor = "var(--border-subtle)";
                              e.currentTarget.style.transform = "translateY(0)";
                            }
                          }}
                        >
                          {/* Priority Badge, Radar Score, & Drag Grip */}
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "space-between",
                              marginBottom: "8px",
                            }}
                          >
                            <span
                              className={`badge ${
                                lead.priority === "URGENT" || lead.priority === "HIGH"
                                  ? "badge-hot"
                                  : "badge-medium"
                              }`}
                            >
                              {lead.priority}
                            </span>

                            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                              <div
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: "4px",
                                  fontSize: "0.75rem",
                                  fontFamily: "monospace",
                                  fontWeight: 700,
                                  color: "var(--amber-dark)",
                                }}
                              >
                                <Flame style={{ width: "13px", height: "13px", color: "var(--amber)" }} />
                                {lead.score}
                              </div>

                              <div
                                style={{
                                  color: "var(--text-muted)",
                                  display: "flex",
                                  alignItems: "center",
                                  padding: "2px",
                                  borderRadius: "4px",
                                }}
                                title="Drag card to move"
                              >
                                <GripVertical style={{ width: "14px", height: "14px" }} />
                              </div>
                            </div>
                          </div>

                          {/* Lead Title */}
                          <h4
                            style={{
                              fontSize: "0.8125rem",
                              fontWeight: 700,
                              color: "var(--text-primary)",
                              marginBottom: "4px",
                              lineHeight: "1.35",
                            }}
                          >
                            {lead.title}
                          </h4>

                          {/* Company & Contact */}
                          <div
                            style={{
                              fontSize: "0.75rem",
                              color: "var(--text-secondary)",
                              marginBottom: "10px",
                              display: "flex",
                              flexDirection: "column",
                              gap: "2px",
                            }}
                          >
                            {lead.company_name && (
                              <p style={{ fontWeight: 600, color: "var(--text-primary)" }}>
                                {lead.company_name}
                              </p>
                            )}
                            {lead.contact_name && (
                              <p style={{ color: "var(--text-secondary)" }}>{lead.contact_name}</p>
                            )}
                          </div>

                          {/* Deal Value if set */}
                          {lead.value && Number(lead.value) > 0 && (
                            <div
                              style={{
                                marginBottom: "8px",
                                fontSize: "0.75rem",
                                fontWeight: 700,
                                color: "var(--emerald)",
                                fontFamily: "monospace",
                              }}
                            >
                              Deal Value: {formatRevenue(Number(lead.value))}
                            </div>
                          )}

                          {/* Contact Indicators (Masking Aware & Gmail Trigger) */}
                          {(lead.contact_phone || lead.contact_email) && (
                            <div
                              style={{
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "space-between",
                                paddingTop: "8px",
                                borderTop: "1px solid var(--border-subtle)",
                                fontSize: "0.6875rem",
                                color: "var(--text-secondary)",
                                flexWrap: "wrap",
                                gap: "6px",
                              }}
                            >
                              {lead.contact_phone && (
                                <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                                  <Phone style={{ width: "12px", height: "12px", color: "var(--emerald)" }} />
                                  <span>{lead.contact_phone}</span>
                                  {lead.is_phone_masked && (
                                    <span
                                      className="badge badge-masked"
                                      style={{ fontSize: "0.5625rem", padding: "1px 4px" }}
                                    >
                                      Masked
                                    </span>
                                  )}
                                </div>
                              )}

                              {lead.contact_email && (
                                <button
                                  type="button"
                                  draggable={false}
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
                                  title="Open in Gmail"
                                  style={{
                                    background: "var(--bg-surface-subtle)",
                                    border: "1px solid var(--border-subtle)",
                                    borderRadius: "4px",
                                    padding: "2px 6px",
                                    color: "#dc2626",
                                    cursor: "pointer",
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: "3px",
                                    fontSize: "0.6875rem",
                                  }}
                                >
                                  <Mail style={{ width: "10px", height: "10px", color: "#dc2626" }} />
                                  <span>Gmail</span>
                                </button>
                              )}
                            </div>
                          )}

                          {/* Quick stage transition button */}
                          {idx < stages.length - 1 && (
                            <div
                              style={{
                                marginTop: "10px",
                                paddingTop: "8px",
                                borderTop: "1px solid var(--border-subtle)",
                                display: "flex",
                                justifyContent: "flex-end",
                              }}
                            >
                              <button
                                draggable={false}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onMoveStage(lead.id, stages[idx + 1].id);
                                }}
                                title={`Advance to ${stages[idx + 1].name}`}
                                style={{
                                  fontSize: "0.6875rem",
                                  fontWeight: 600,
                                  color: "var(--primary)",
                                  background: "var(--primary-light)",
                                  border: "1px solid var(--primary-border)",
                                  borderRadius: "6px",
                                  padding: "3px 8px",
                                  cursor: "pointer",
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: "4px",
                                  transition: "all 0.15s ease",
                                }}
                              >
                                <span>Move to {stages[idx + 1].name}</span>
                                <ArrowRight style={{ width: "12px", height: "12px" }} />
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}

                    {/* Active Drag Drop Target Indicator if hovering with card */}
                    {isOverTarget && isDraggingCardFromOtherStage && (
                      <div className="kanban-drop-indicator">
                        <ArrowDown style={{ width: "14px", height: "14px" }} />
                        <span>Drop here to move to {stage.name}</span>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
