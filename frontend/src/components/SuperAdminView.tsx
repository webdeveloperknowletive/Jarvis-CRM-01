import React, { useState, useEffect } from "react";
import { api } from "../services/api";
import { 
  Building2, 
  Plus, 
  ShieldCheck, 
  Check, 
  ActivitySquare, 
  X, 
  Search, 
  Filter, 
  PhoneCall, 
  Mail, 
  MessageCircle, 
  Eye, 
  Layers, 
  Globe, 
  UserCheck 
} from "lucide-react";

interface SuperAdminViewProps {
  viewMode?: "organizations" | "audit";
}

export const SuperAdminView: React.FC<SuperAdminViewProps> = ({ viewMode = "organizations" }) => {
  const [organizations, setOrganizations] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [loading, setLoading] = useState(true);

  // Search & Filter state
  const [orgSearch, setOrgSearch] = useState("");
  const [auditSearch, setAuditSearch] = useState("");
  const [auditActionFilter, setAuditActionFilter] = useState("ALL");
  const [auditTenantFilter, setAuditTenantFilter] = useState("ALL");

  // Provisioning Form state
  const [name, setName] = useState("");
  const [adminName, setAdminName] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("Password@2026");
  const [planCode, setPlanCode] = useState("GROWTH");
  const [creating, setCreating] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    loadPlatformData();
  }, []);

  const loadPlatformData = async () => {
    setLoading(true);
    try {
      const [orgs, logs] = await Promise.all([
        api.getOrganizations(),
        api.getAuditLogs(),
      ]);
      setOrganizations(orgs);
      setAuditLogs(logs);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateOrg = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    try {
      await api.createOrganization({
        name,
        admin_name: adminName,
        admin_email: adminEmail,
        admin_password: adminPassword,
        plan_code: planCode,
      });
      setMsg(`Organization "${name}" successfully provisioned with default sales pipeline!`);
      setShowCreateModal(false);
      setName("");
      setAdminName("");
      setAdminEmail("");
      loadPlatformData();
      setTimeout(() => setMsg(null), 4000);
    } catch (err: any) {
      alert(err.message || "Failed to create organization");
    } finally {
      setCreating(false);
    }
  };

  // Filtered organizations
  const filteredOrgs = organizations.filter((org) => {
    if (!orgSearch) return true;
    const s = orgSearch.toLowerCase();
    return (
      org.name.toLowerCase().includes(s) ||
      (org.domain && org.domain.toLowerCase().includes(s)) ||
      org.id.toLowerCase().includes(s)
    );
  });

  // Filtered audit events
  const filteredLogs = auditLogs.filter((log) => {
    const matchesAction = auditActionFilter === "ALL" || log.action === auditActionFilter;
    const matchesTenant = auditTenantFilter === "ALL" || log.organization_id === auditTenantFilter;
    const matchesSearch = !auditSearch || (
      log.action.toLowerCase().includes(auditSearch.toLowerCase()) ||
      (log.entity_type && log.entity_type.toLowerCase().includes(auditSearch.toLowerCase())) ||
      (log.actor_user_id && log.actor_user_id.toLowerCase().includes(auditSearch.toLowerCase())) ||
      (log.ip_address && log.ip_address.includes(auditSearch))
    );
    return matchesAction && matchesTenant && matchesSearch;
  });

  const getActionBadge = (action: string) => {
    if (action.includes("CALL")) {
      return (
        <span className="badge" style={{ background: "#ecfdf5", color: "#065f46", border: "1px solid #a7f3d0", display: "inline-flex", alignItems: "center", gap: "4px" }}>
          <PhoneCall style={{ width: "11px", height: "11px" }} />
          {action}
        </span>
      );
    }
    if (action.includes("EMAIL") || action.includes("MAIL")) {
      return (
        <span className="badge" style={{ background: "#fee2e2", color: "#991b1b", border: "1px solid #fecaca", display: "inline-flex", alignItems: "center", gap: "4px" }}>
          <Mail style={{ width: "11px", height: "11px" }} />
          {action}
        </span>
      );
    }
    if (action.includes("WHATSAPP")) {
      return (
        <span className="badge" style={{ background: "#d1fae5", color: "#047857", border: "1px solid #6ee7b7", display: "inline-flex", alignItems: "center", gap: "4px" }}>
          <MessageCircle style={{ width: "11px", height: "11px" }} />
          {action}
        </span>
      );
    }
    if (action.includes("STAGE")) {
      return (
        <span className="badge" style={{ background: "#e0e7ff", color: "#3730a3", border: "1px solid #c7d2fe", display: "inline-flex", alignItems: "center", gap: "4px" }}>
          <Layers style={{ width: "11px", height: "11px" }} />
          {action}
        </span>
      );
    }
    if (action.includes("VIEW")) {
      return (
        <span className="badge" style={{ background: "#f1f5f9", color: "#334155", border: "1px solid #cbd5e1", display: "inline-flex", alignItems: "center", gap: "4px" }}>
          <Eye style={{ width: "11px", height: "11px" }} />
          {action}
        </span>
      );
    }
    return (
      <span className="badge badge-medium">
        {action}
      </span>
    );
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      {/* ========================================================================= */}
      {/* MODULE 1: ORGANIZATIONS VIEW                                              */}
      {/* ========================================================================= */}
      {viewMode === "organizations" && (
        <>
          {/* Header */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "12px" }}>
            <div>
              <h2 style={{ fontSize: "1.375rem", fontWeight: 800, color: "var(--text-primary)", letterSpacing: "-0.02em", display: "flex", alignItems: "center", gap: "8px" }}>
                <Building2 style={{ width: "22px", height: "22px", color: "var(--primary)" }} />
                Platform Control & Tenant Registry
              </h2>
              <p style={{ fontSize: "0.8125rem", color: "var(--text-secondary)", marginTop: "2px" }}>
                Super Admin multi-tenant workspace provisioning and platform oversight
              </p>
            </div>

            <button onClick={() => setShowCreateModal(true)} className="btn-primary">
              <Plus style={{ width: "16px", height: "16px" }} />
              Provision New Tenant
            </button>
          </div>

          {msg && (
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
              <span>{msg}</span>
            </div>
          )}

          {/* KPI Stats */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "16px" }}>
            <div className="stat-card stat-card-accent-indigo">
              <span style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--text-secondary)" }}>Total Tenant Organizations</span>
              <p style={{ fontSize: "1.75rem", fontWeight: 800, color: "var(--text-primary)", fontFamily: "monospace", marginTop: "4px" }}>
                {organizations.length}
              </p>
            </div>

            <div className="stat-card stat-card-accent-emerald">
              <span style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--text-secondary)" }}>Platform Security Level</span>
              <p style={{ fontSize: "1.75rem", fontWeight: 800, color: "var(--emerald-dark)", fontFamily: "monospace", marginTop: "4px" }}>
                ISOLATED
              </p>
            </div>

            <div className="stat-card stat-card-accent-amber">
              <span style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--text-secondary)" }}>Active Workspaces</span>
              <p style={{ fontSize: "1.75rem", fontWeight: 800, color: "var(--amber-dark)", fontFamily: "monospace", marginTop: "4px" }}>
                {organizations.filter(o => o.status !== "DEACTIVATED").length} Workspaces
              </p>
            </div>
          </div>

          {/* Tenants Table */}
          <div className="table-container">
            <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border-subtle)", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "12px" }}>
              <div>
                <h3 style={{ fontSize: "0.875rem", fontWeight: 800, color: "var(--text-primary)" }}>
                  Provisioned Organizations ({filteredOrgs.length})
                </h3>
                <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                  Cross-tenant data partitions with cryptographically verified boundaries
                </span>
              </div>

              <div style={{ position: "relative", width: "280px" }}>
                <Search style={{ width: "15px", height: "15px", color: "var(--text-muted)", position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)" }} />
                <input
                  type="text"
                  value={orgSearch}
                  onChange={(e) => setOrgSearch(e.target.value)}
                  placeholder="Search tenants by name or ID..."
                  className="input-text"
                  style={{ paddingLeft: "32px", fontSize: "0.75rem" }}
                />
              </div>
            </div>

            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ paddingLeft: "20px" }}>Organization</th>
                  <th>Tenant ID</th>
                  <th>Subscription Tier</th>
                  <th>Status</th>
                  <th>Created Date</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={5} style={{ textAlign: "center", padding: "36px 0", color: "var(--text-muted)" }}>
                      Loading platform organizations...
                    </td>
                  </tr>
                ) : filteredOrgs.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ textAlign: "center", padding: "36px 0", color: "var(--text-muted)" }}>
                      No matching organizations found.
                    </td>
                  </tr>
                ) : (
                  filteredOrgs.map((org) => (
                    <tr key={org.id}>
                      <td style={{ paddingLeft: "20px" }}>
                        <p style={{ fontWeight: 700, color: "var(--text-primary)" }}>{org.name}</p>
                        <p style={{ fontSize: "0.6875rem", color: "var(--text-muted)" }}>Domain: {org.domain || "apex.com"}</p>
                      </td>
                      <td style={{ fontFamily: "monospace", fontSize: "0.75rem", color: "var(--text-secondary)" }}>
                        {org.id}
                      </td>
                      <td>
                        <span className="badge badge-medium">
                          GROWTH TIER
                        </span>
                      </td>
                      <td>
                        <span className="badge badge-open">
                          {org.status || "ACTIVE"}
                        </span>
                      </td>
                      <td style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                        {new Date(org.created_at).toLocaleDateString()}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* ========================================================================= */}
      {/* MODULE 2: PLATFORM AUDIT TRAIL VIEW                                       */}
      {/* ========================================================================= */}
      {viewMode === "audit" && (
        <>
          {/* Header */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "12px" }}>
            <div>
              <h2 style={{ fontSize: "1.375rem", fontWeight: 800, color: "var(--text-primary)", letterSpacing: "-0.02em", display: "flex", alignItems: "center", gap: "8px" }}>
                <ActivitySquare style={{ width: "22px", height: "22px", color: "var(--primary)" }} />
                Platform Audit Trail & Security Events
              </h2>
              <p style={{ fontSize: "0.8125rem", color: "var(--text-secondary)", marginTop: "2px" }}>
                Immutable event stream auditing user actions, contact access, communication dispatches, and logins
              </p>
            </div>

            <button onClick={loadPlatformData} className="btn-secondary" style={{ fontSize: "0.8125rem" }}>
              Refresh Event Stream
            </button>
          </div>

          {/* KPI Stats */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "16px" }}>
            <div className="stat-card stat-card-accent-indigo">
              <span style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--text-secondary)" }}>Total Audit Events Captured</span>
              <p style={{ fontSize: "1.75rem", fontWeight: 800, color: "var(--text-primary)", fontFamily: "monospace", marginTop: "4px" }}>
                {auditLogs.length}
              </p>
            </div>

            <div className="stat-card stat-card-accent-emerald">
              <span style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--text-secondary)" }}>Communication Triggers (Calls/Mail/WA)</span>
              <p style={{ fontSize: "1.75rem", fontWeight: 800, color: "var(--emerald-dark)", fontFamily: "monospace", marginTop: "4px" }}>
                {auditLogs.filter(l => l.action.includes("TRIGGERED")).length} Events
              </p>
            </div>

            <div className="stat-card stat-card-accent-amber">
              <span style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--text-secondary)" }}>Contact Profile Views</span>
              <p style={{ fontSize: "1.75rem", fontWeight: 800, color: "var(--amber-dark)", fontFamily: "monospace", marginTop: "4px" }}>
                {auditLogs.filter(l => l.action.includes("VIEW")).length} Views
              </p>
            </div>
          </div>

          {/* Audit Trail Filter Bar */}
          <div className="card" style={{ padding: "16px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "12px" }}>
            <div style={{ position: "relative", flex: 1, minWidth: "260px" }}>
              <Search style={{ width: "15px", height: "15px", color: "var(--text-muted)", position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)" }} />
              <input
                type="text"
                value={auditSearch}
                onChange={(e) => setAuditSearch(e.target.value)}
                placeholder="Search audit trail by actor, IP, or entity ID..."
                className="input-text"
                style={{ paddingLeft: "32px", fontSize: "0.8125rem" }}
              />
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <select
                value={auditActionFilter}
                onChange={(e) => setAuditActionFilter(e.target.value)}
                className="select-dropdown"
                style={{ fontSize: "0.8125rem" }}
              >
                <option value="ALL">All Action Types</option>
                <option value="CALL_TRIGGERED">Call Triggered</option>
                <option value="EMAIL_TRIGGERED">Email Triggered</option>
                <option value="WHATSAPP_TRIGGERED">WhatsApp Triggered</option>
                <option value="CONTACT_VIEW">Contact Viewed</option>
                <option value="STAGE_CHANGED">Stage Changed</option>
                <option value="LOGIN_SUCCESS">Login Success</option>
                <option value="ORGANIZATION_CREATED">Org Provisioned</option>
              </select>

              <select
                value={auditTenantFilter}
                onChange={(e) => setAuditTenantFilter(e.target.value)}
                className="select-dropdown"
                style={{ fontSize: "0.8125rem" }}
              >
                <option value="ALL">All Organizations</option>
                {organizations.map((o) => (
                  <option key={o.id} value={o.id}>{o.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Detailed Platform Audit Events Table */}
          <div className="table-container">
            <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border-subtle)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <h3 style={{ fontSize: "0.875rem", fontWeight: 800, color: "var(--text-primary)" }}>
                Audited Platform Security Events ({filteredLogs.length})
              </h3>
              <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", fontWeight: 600 }}>
                Real-time chronological feed
              </span>
            </div>

            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ paddingLeft: "20px" }}>Timestamp</th>
                  <th>Action</th>
                  <th>Target Entity</th>
                  <th>Actor User</th>
                  <th>Tenant ID</th>
                  <th>IP Address</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: "center", padding: "36px 0", color: "var(--text-muted)" }}>
                      Loading platform audit stream...
                    </td>
                  </tr>
                ) : filteredLogs.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: "center", padding: "36px 0", color: "var(--text-muted)" }}>
                      No audit events match the active filters.
                    </td>
                  </tr>
                ) : (
                  filteredLogs.map((log) => (
                    <tr key={log.id}>
                      <td style={{ paddingLeft: "20px", fontSize: "0.75rem", color: "var(--text-secondary)", whiteSpace: "nowrap" }}>
                        <p style={{ fontWeight: 600, color: "var(--text-primary)" }}>{new Date(log.created_at).toLocaleDateString()}</p>
                        <p style={{ fontFamily: "monospace", fontSize: "0.6875rem", color: "var(--text-muted)" }}>{new Date(log.created_at).toLocaleTimeString()}</p>
                      </td>
                      <td>
                        {getActionBadge(log.action)}
                      </td>
                      <td style={{ fontSize: "0.75rem" }}>
                        <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>{log.entity_type || "PLATFORM"}</span>
                        {log.entity_id && (
                          <span style={{ fontFamily: "monospace", fontSize: "0.6875rem", color: "var(--text-muted)", display: "block" }}>
                            {log.entity_id.substring(0, 12)}...
                          </span>
                        )}
                      </td>
                      <td style={{ fontFamily: "monospace", fontSize: "0.75rem", color: "var(--text-secondary)" }}>
                        {log.actor_user_id ? log.actor_user_id.substring(0, 10) : "SYSTEM"}
                      </td>
                      <td>
                        {log.organization_id ? (
                          <span className="badge" style={{ background: "#f8fafc", border: "1px solid #e2e8f0", color: "var(--text-secondary)", fontFamily: "monospace", fontSize: "0.6875rem" }}>
                            {log.organization_id.substring(0, 8)}
                          </span>
                        ) : (
                          <span className="badge" style={{ background: "var(--primary-light)", border: "1px solid var(--primary-border)", color: "var(--primary)", fontSize: "0.6875rem" }}>
                            PLATFORM
                          </span>
                        )}
                      </td>
                      <td style={{ fontFamily: "monospace", fontSize: "0.75rem", color: "var(--text-muted)" }}>
                        {log.ip_address || "127.0.0.1"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Provision Tenant Modal Dialog */}
      {showCreateModal && (
        <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="modal-dialog" onClick={(e) => e.stopPropagation()} style={{ padding: "24px", maxWidth: "520px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingBottom: "14px", borderBottom: "1px solid var(--border-subtle)", marginBottom: "18px" }}>
              <h3 style={{ fontSize: "1.125rem", fontWeight: 800, color: "var(--text-primary)", display: "flex", alignItems: "center", gap: "8px" }}>
                <Building2 style={{ width: "20px", height: "20px", color: "var(--primary)" }} />
                Provision New Tenant Workspace
              </h3>
              <button
                onClick={() => setShowCreateModal(false)}
                style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)" }}
              >
                <X style={{ width: "20px", height: "20px" }} />
              </button>
            </div>

            <form onSubmit={handleCreateOrg} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              <div>
                <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 700, color: "var(--text-primary)", marginBottom: "4px" }}>
                  Organization Name *
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Apex Industrial Solutions"
                  className="input-text"
                  required
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 700, color: "var(--text-primary)", marginBottom: "4px" }}>
                  Initial CRM Admin Full Name *
                </label>
                <input
                  type="text"
                  value={adminName}
                  onChange={(e) => setAdminName(e.target.value)}
                  placeholder="e.g. Apex Administrator"
                  className="input-text"
                  required
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 700, color: "var(--text-primary)", marginBottom: "4px" }}>
                  Admin Email Address (Login Username) *
                </label>
                <input
                  type="email"
                  value={adminEmail}
                  onChange={(e) => setAdminEmail(e.target.value)}
                  placeholder="e.g. admin@apex.com"
                  className="input-text"
                  required
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 700, color: "var(--text-primary)", marginBottom: "4px" }}>
                  Temporary Initial Password *
                </label>
                <input
                  type="text"
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  className="input-text"
                  required
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 700, color: "var(--text-primary)", marginBottom: "4px" }}>
                  Initial Subscription Plan
                </label>
                <select
                  value={planCode}
                  onChange={(e) => setPlanCode(e.target.value)}
                  className="select-dropdown"
                >
                  <option value="STARTER">Starter Plan (5 Seats, 1 Pipeline)</option>
                  <option value="GROWTH">Growth Plan (20 Seats, Unlimited Pipelines)</option>
                  <option value="ENTERPRISE">Enterprise Plan (Unlimited Seats & Radar)</option>
                </select>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "14px", paddingTop: "14px", borderTop: "1px solid var(--border-subtle)" }}>
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="btn-secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="btn-primary"
                >
                  {creating ? "Provisioning..." : "Provision Tenant"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
