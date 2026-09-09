import React, { useState } from "react";
import { User } from "../services/api";
import { 
  Building2, 
  Users, 
  PhoneCall, 
  Sparkles, 
  LogOut, 
  Kanban, 
  Globe2, 
  UploadCloud, 
  ActivitySquare,
  Lock,
  Menu,
  X,
  ShieldCheck,
  Plus
} from "lucide-react";

interface NavbarProps {
  user: User;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onLogout: () => void;
  onNewLeadClick?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ user, activeTab, setActiveTab, onLogout, onNewLeadClick }) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const isSuperAdmin = user.is_super_admin;
  const isTelecaller = user.tenant_role === "TELECALLER";

  const handleTabClick = (tab: string) => {
    setActiveTab(tab);
    setMobileMenuOpen(false);
  };

  return (
    <header className="nav-header">
      <div className="nav-container">
        {/* Brand & Workspace */}
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div style={{
            width: "38px",
            height: "38px",
            borderRadius: "10px",
            background: "linear-gradient(135deg, #4f46e5 0%, #06b6d4 100%)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 4px 10px rgba(79, 70, 229, 0.25)",
            color: "#ffffff",
            fontWeight: 800,
            fontSize: "1.125rem",
            flexShrink: 0
          }}>
            J
          </div>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <span style={{ fontWeight: 800, fontSize: "1.05rem", color: "var(--text-primary)", letterSpacing: "-0.02em" }}>
                JARVIS
              </span>
              <span style={{
                fontSize: "0.625rem",
                fontWeight: 700,
                padding: "2px 6px",
                borderRadius: "4px",
                background: "var(--primary-light)",
                color: "var(--primary)",
                border: "1px solid var(--primary-border)",
                letterSpacing: "0.04em"
              }}>
                RADAR CRM
              </span>
            </div>
            <p style={{ fontSize: "0.75rem", color: "var(--text-secondary)", fontWeight: 500 }}>
              {user.organization ? user.organization.name : "Platform Management"}
            </p>
          </div>
        </div>

        {/* Desktop Navigation Tabs */}
        <nav className="nav-tabs-wrapper" style={{ display: "flex" }}>
          {/* Telecaller Focused Tab */}
          {isTelecaller && (
            <button
              onClick={() => handleTabClick("telecaller")}
              className={`nav-tab-btn ${activeTab === "telecaller" ? "active" : ""}`}
            >
              <PhoneCall style={{ width: "15px", height: "15px" }} />
              Calling Desk
            </button>
          )}

          {/* Core CRM Tabs */}
          {!isTelecaller && !isSuperAdmin && (
            <>
              <button
                onClick={() => handleTabClick("radar")}
                className={`nav-tab-btn ${activeTab === "radar" ? "active" : ""}`}
              >
                <Sparkles style={{ width: "15px", height: "15px", color: "var(--amber)" }} />
                Radar Insights
              </button>

              <button
                onClick={() => handleTabClick("pipeline")}
                className={`nav-tab-btn ${activeTab === "pipeline" ? "active" : ""}`}
              >
                <Kanban style={{ width: "15px", height: "15px" }} />
                Pipeline
              </button>

              <button
                onClick={() => handleTabClick("leads")}
                className={`nav-tab-btn ${activeTab === "leads" ? "active" : ""}`}
              >
                <Users style={{ width: "15px", height: "15px" }} />
                Leads & Contacts
              </button>

              <button
                onClick={() => handleTabClick("import")}
                className={`nav-tab-btn ${activeTab === "import" ? "active" : ""}`}
              >
                <UploadCloud style={{ width: "15px", height: "15px" }} />
                Import Leads
              </button>

              <button
                onClick={() => handleTabClick("global")}
                className={`nav-tab-btn ${activeTab === "global" ? "active" : ""}`}
              >
                <Globe2 style={{ width: "15px", height: "15px", color: "var(--cyan)" }} />
                Global Registry
              </button>
            </>
          )}

          {/* Super Admin Tabs */}
          {isSuperAdmin && (
            <>
              <button
                onClick={() => handleTabClick("organizations")}
                className={`nav-tab-btn ${activeTab === "organizations" ? "active" : ""}`}
              >
                <Building2 style={{ width: "15px", height: "15px" }} />
                Organizations
              </button>

              <button
                onClick={() => handleTabClick("global")}
                className={`nav-tab-btn ${activeTab === "global" ? "active" : ""}`}
              >
                <Globe2 style={{ width: "15px", height: "15px", color: "var(--cyan)" }} />
                Global Intelligence
              </button>

              <button
                onClick={() => handleTabClick("audit")}
                className={`nav-tab-btn ${activeTab === "audit" ? "active" : ""}`}
              >
                <ActivitySquare style={{ width: "15px", height: "15px" }} />
                Platform Audit
              </button>
            </>
          )}
        </nav>

        {/* User Profile & Actions */}
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          {!isSuperAdmin && !isTelecaller && onNewLeadClick && (
            <button
              onClick={onNewLeadClick}
              className="btn-primary"
              style={{ fontSize: "0.75rem", padding: "6px 12px", display: "inline-flex", alignItems: "center", gap: "5px" }}
            >
              <Plus style={{ width: "13px", height: "13px" }} />
              Add Lead
            </button>
          )}

          <div style={{ textAlign: "right" }} className="user-profile-meta">
            <p style={{ fontSize: "0.8125rem", fontWeight: 700, color: "var(--text-primary)" }}>
              {user.full_name}
            </p>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: "4px" }}>
              {isTelecaller ? (
                <span className="badge badge-masked" style={{ fontSize: "0.625rem" }}>
                  <Lock style={{ width: "10px", height: "10px" }} />
                  TELECALLER (MASKED)
                </span>
              ) : isSuperAdmin ? (
                <span className="badge badge-hot" style={{ fontSize: "0.625rem" }}>
                  <ShieldCheck style={{ width: "10px", height: "10px" }} />
                  SUPER ADMIN
                </span>
              ) : (
                <span className="badge badge-medium" style={{ fontSize: "0.625rem" }}>
                  {user.effective_role}
                </span>
              )}
            </div>
          </div>

          <button
            onClick={onLogout}
            title="Sign out"
            style={{
              padding: "8px",
              borderRadius: "8px",
              border: "1px solid var(--border-subtle)",
              background: "var(--bg-surface)",
              color: "var(--text-secondary)",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transition: "all 0.15s ease"
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.color = "var(--rose)";
              e.currentTarget.style.borderColor = "var(--rose-border)";
              e.currentTarget.style.background = "var(--rose-light)";
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.color = "var(--text-secondary)";
              e.currentTarget.style.borderColor = "var(--border-subtle)";
              e.currentTarget.style.background = "var(--bg-surface)";
            }}
          >
            <LogOut style={{ width: "16px", height: "16px" }} />
          </button>

          {/* Mobile Hamburger Toggle */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="mobile-hamburger-btn"
            style={{
              padding: "8px",
              borderRadius: "8px",
              border: "1px solid var(--border-subtle)",
              background: "var(--bg-surface)",
              color: "var(--text-primary)",
              cursor: "pointer",
              display: "none"
            }}
          >
            {mobileMenuOpen ? <X style={{ width: "18px", height: "18px" }} /> : <Menu style={{ width: "18px", height: "18px" }} />}
          </button>
        </div>
      </div>

      {/* Responsive Mobile Dropdown Menu */}
      {mobileMenuOpen && (
        <div style={{
          marginTop: "12px",
          paddingTop: "12px",
          borderTop: "1px solid var(--border-subtle)",
          display: "flex",
          flexDirection: "column",
          gap: "6px"
        }}>
          {isTelecaller && (
            <button
              onClick={() => handleTabClick("telecaller")}
              className={`nav-tab-btn ${activeTab === "telecaller" ? "active" : ""}`}
              style={{ justifyContent: "flex-start", padding: "10px 14px", width: "100%" }}
            >
              <PhoneCall style={{ width: "16px", height: "16px" }} />
              Calling Desk
            </button>
          )}

          {!isTelecaller && !isSuperAdmin && (
            <>
              <button
                onClick={() => handleTabClick("radar")}
                className={`nav-tab-btn ${activeTab === "radar" ? "active" : ""}`}
                style={{ justifyContent: "flex-start", padding: "10px 14px", width: "100%" }}
              >
                <Sparkles style={{ width: "16px", height: "16px", color: "var(--amber)" }} />
                Radar Insights
              </button>

              <button
                onClick={() => handleTabClick("pipeline")}
                className={`nav-tab-btn ${activeTab === "pipeline" ? "active" : ""}`}
                style={{ justifyContent: "flex-start", padding: "10px 14px", width: "100%" }}
              >
                <Kanban style={{ width: "16px", height: "16px" }} />
                Pipeline
              </button>

              <button
                onClick={() => handleTabClick("leads")}
                className={`nav-tab-btn ${activeTab === "leads" ? "active" : ""}`}
                style={{ justifyContent: "flex-start", padding: "10px 14px", width: "100%" }}
              >
                <Users style={{ width: "16px", height: "16px" }} />
                Leads & Contacts
              </button>

              <button
                onClick={() => handleTabClick("import")}
                className={`nav-tab-btn ${activeTab === "import" ? "active" : ""}`}
                style={{ justifyContent: "flex-start", padding: "10px 14px", width: "100%" }}
              >
                <UploadCloud style={{ width: "16px", height: "16px" }} />
                Import Leads
              </button>

              <button
                onClick={() => handleTabClick("global")}
                className={`nav-tab-btn ${activeTab === "global" ? "active" : ""}`}
                style={{ justifyContent: "flex-start", padding: "10px 14px", width: "100%" }}
              >
                <Globe2 style={{ width: "16px", height: "16px", color: "var(--cyan)" }} />
                Global Registry
              </button>
            </>
          )}

          {isSuperAdmin && (
            <>
              <button
                onClick={() => handleTabClick("organizations")}
                className={`nav-tab-btn ${activeTab === "organizations" ? "active" : ""}`}
                style={{ justifyContent: "flex-start", padding: "10px 14px", width: "100%" }}
              >
                <Building2 style={{ width: "16px", height: "16px" }} />
                Organizations
              </button>

              <button
                onClick={() => handleTabClick("global")}
                className={`nav-tab-btn ${activeTab === "global" ? "active" : ""}`}
                style={{ justifyContent: "flex-start", padding: "10px 14px", width: "100%" }}
              >
                <Globe2 style={{ width: "16px", height: "16px", color: "var(--cyan)" }} />
                Global Intelligence
              </button>

              <button
                onClick={() => handleTabClick("audit")}
                className={`nav-tab-btn ${activeTab === "audit" ? "active" : ""}`}
                style={{ justifyContent: "flex-start", padding: "10px 14px", width: "100%" }}
              >
                <ActivitySquare style={{ width: "16px", height: "16px" }} />
                Platform Audit
              </button>
            </>
          )}
        </div>
      )}
    </header>
  );
};
