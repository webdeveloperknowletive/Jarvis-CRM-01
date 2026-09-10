import React, { useState, useEffect } from "react";
import { api, User, Lead, PipelineStage } from "./services/api";
import { Navbar } from "./components/Navbar";
import { LoginScreen } from "./components/LoginScreen";
import { KanbanBoard } from "./components/KanbanBoard";
import { LeadsTable } from "./components/LeadsTable";
import { LeadDetailModal } from "./components/LeadDetailModal";
import { ImportModal } from "./components/ImportModal";
import { TelecallerDesk } from "./components/TelecallerDesk";
import { GlobalRegistryView } from "./components/GlobalRegistryView";
import { RadarView } from "./components/RadarView";
import { SuperAdminView } from "./components/SuperAdminView";
import { PeopleIntelligenceView } from "./components/PeopleIntelligenceView";
import { GlobalIntelligenceView } from "./components/GlobalIntelligenceView";
import { NewLeadModal } from "./components/NewLeadModal";
import { UploadCloud, FileSpreadsheet, Plus, Check } from "lucide-react";

export const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loadingUser, setLoadingUser] = useState(true);
  const [activeTab, setActiveTab] = useState<string>("pipeline");

  // CRM Data
  const [stages, setStages] = useState<PipelineStage[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showNewLeadModal, setShowNewLeadModal] = useState(false);

  useEffect(() => {
    checkCurrentUser();
  }, []);

  const checkCurrentUser = async () => {
    const token = api.getToken();
    if (!token) {
      setLoadingUser(false);
      return;
    }
    try {
      const user = await api.getMe();
      setCurrentUser(user);
      localStorage.setItem("jarvis_user", JSON.stringify(user));
      if (user.is_super_admin) {
        setActiveTab("organizations");
      } else if (user.is_data_entry || user.platform_role === "DATA_ENTRY") {
        setActiveTab("global_intelligence");
      } else if (user.tenant_role === "TELECALLER") {
        setActiveTab("telecaller");
      } else {
        setActiveTab("radar");
      }
    } catch (e) {
      api.clearToken();
    } finally {
      setLoadingUser(false);
    }
  };

  useEffect(() => {
    if (currentUser && !currentUser.is_super_admin && !(currentUser.is_data_entry || currentUser.platform_role === "DATA_ENTRY")) {
      loadCRMData();
    }
  }, [currentUser]);

  const loadCRMData = async () => {
    try {
      const [pipe, leadList] = await Promise.all([
        api.getPipeline(),
        api.getLeads(),
      ]);
      setStages(pipe.stages || []);
      setLeads(leadList || []);
    } catch (e) {
      console.error("Error loading CRM data:", e);
    }
  };

  const handleMoveStage = async (leadId: string, stageId: string) => {
    try {
      await api.updateLeadStage(leadId, stageId, "Quick stage movement from board");
      loadCRMData();
    } catch (err: any) {
      alert(err.message || "Failed to update stage");
    }
  };

  const handleLogout = () => {
    api.clearToken();
    localStorage.removeItem("jarvis_user");
    setCurrentUser(null);
  };

  if (loadingUser) {
    return (
      <div style={{
        minHeight: "100vh",
        background: "var(--bg-canvas)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: "0.8125rem",
        color: "var(--primary)",
        fontFamily: "monospace",
        fontWeight: 600
      }}>
        Initializing JARVIS CRM Engine...
      </div>
    );
  }

  if (!currentUser) {
    return (
      <LoginScreen
        onSuccess={(u) => {
          setCurrentUser(u);
          localStorage.setItem("jarvis_user", JSON.stringify(u));
          if (u.is_super_admin) {
            setActiveTab("organizations");
          } else if (u.is_data_entry || u.platform_role === "DATA_ENTRY") {
            setActiveTab("global_intelligence");
          } else if (u.tenant_role === "TELECALLER") {
            setActiveTab("telecaller");
          } else {
            setActiveTab("radar");
          }
        }}
      />
    );
  }

  return (
    <div className="app-wrapper">
      <Navbar
        user={currentUser}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onLogout={handleLogout}
        onNewLeadClick={() => setShowNewLeadModal(true)}
      />

      <main className="main-content">
        {/* Telecaller Desk */}
        {activeTab === "telecaller" && <TelecallerDesk />}

        {/* Executive Radar */}
        {activeTab === "radar" && (
          <RadarView onSelectLead={(l) => setSelectedLead(l)} />
        )}

        {/* Pipeline Kanban */}
        {activeTab === "pipeline" && (
          <KanbanBoard
            stages={stages}
            leads={leads}
            onSelectLead={(l) => setSelectedLead(l)}
            onMoveStage={handleMoveStage}
            onNewLeadClick={() => setShowNewLeadModal(true)}
            onRefreshPipeline={loadCRMData}
          />
        )}

        {/* Leads & Contacts Directory */}
        {activeTab === "leads" && (
          <LeadsTable
            leads={leads}
            stages={stages}
            onSelectLead={(l) => setSelectedLead(l)}
            onMoveStage={handleMoveStage}
            onNewLeadClick={() => setShowNewLeadModal(true)}
          />
        )}

        {/* Import Leads Landing */}
        {activeTab === "import" && (
          <div className="card" style={{ padding: "48px 32px", textAlign: "center", maxWidth: "560px", margin: "48px auto" }}>
            <div style={{
              width: "64px",
              height: "64px",
              borderRadius: "16px",
              background: "var(--primary-light)",
              border: "1px solid var(--primary-border)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 20px auto",
              color: "var(--primary)",
              boxShadow: "0 8px 16px rgba(79, 70, 229, 0.12)"
            }}>
              <UploadCloud style={{ width: "32px", height: "32px" }} />
            </div>
            <div>
              <h3 style={{ fontSize: "1.25rem", fontWeight: 800, color: "var(--text-primary)", letterSpacing: "-0.02em" }}>
                Bulk Lead & Contact Ingestion
              </h3>
              <p style={{ fontSize: "0.8125rem", color: "var(--text-secondary)", marginTop: "6px", maxWidth: "380px", marginInline: "auto" }}>
                Ingest 1,000 to 100,000 leads with smart column auto-detection, E.164 phone normalization, and guaranteed pipeline immutability.
              </p>
            </div>

            <div style={{ marginTop: "24px" }}>
              <button
                onClick={() => setShowImportModal(true)}
                className="btn-primary"
                style={{ padding: "10px 24px" }}
              >
                <FileSpreadsheet style={{ width: "16px", height: "16px" }} />
                Launch Ingestion Wizard
              </button>
            </div>
          </div>
        )}

        {/* Global Intelligence Graph (Unified Company & People) */}
        {activeTab === "global_intelligence" && (
          <GlobalIntelligenceView isOrgAdmin={false} currentUser={currentUser} />
        )}

        {/* Global Registry in ORG Admin / Company Intelligence in Super Admin & Data Entry */}
        {activeTab === "global" && (
          (currentUser.is_super_admin || currentUser.is_data_entry || currentUser.platform_role === "DATA_ENTRY") ? (
            <GlobalRegistryView currentUser={currentUser} />
          ) : (
            <GlobalIntelligenceView isOrgAdmin={true} currentUser={currentUser} />
          )
        )}

        {/* Global People Intelligence (Super Admin & Data Entry) */}
        {activeTab === "people" && <PeopleIntelligenceView currentUser={currentUser} />}

        {/* Super Admin Control */}
        {activeTab === "organizations" && <SuperAdminView viewMode="organizations" />}
        {activeTab === "audit" && <SuperAdminView viewMode="audit" />}
      </main>

      {/* Modals */}
      {selectedLead && (
        <LeadDetailModal
          lead={selectedLead}
          stages={stages}
          onClose={() => setSelectedLead(null)}
          onRefresh={loadCRMData}
        />
      )}

      {showImportModal && (
        <ImportModal
          jobType={currentUser.is_data_entry || currentUser.platform_role === "DATA_ENTRY" ? "GLOBAL_COMPANIES" : undefined}
          onClose={() => setShowImportModal(false)}
          onSuccess={() => {
            if (currentUser.is_data_entry || currentUser.platform_role === "DATA_ENTRY") {
              setActiveTab("global_intelligence");
            } else {
              loadCRMData();
              setActiveTab("pipeline");
            }
          }}
        />
      )}

      {showNewLeadModal && (
        <NewLeadModal
          stages={stages}
          onClose={() => setShowNewLeadModal(false)}
          onSuccess={loadCRMData}
        />
      )}
    </div>
  );
};

export default App;
