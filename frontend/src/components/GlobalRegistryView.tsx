import React, { useState, useEffect } from "react";
import { api, GlobalCompany } from "../services/api";
import { ImportModal } from "./ImportModal";
import { Globe2, Search, Download, Check, MapPin, UploadCloud } from "lucide-react";

export const GlobalRegistryView: React.FC = () => {
  const [companies, setCompanies] = useState<GlobalCompany[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [cityFilter, setCityFilter] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [pulling, setPulling] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    loadGlobalCompanies();
  }, []);

  const loadGlobalCompanies = async () => {
    setLoading(true);
    try {
      const data = await api.getGlobalCompanies(searchTerm, cityFilter);
      setCompanies(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectToggle = (id: string) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter((item) => item !== id));
    } else {
      setSelectedIds([...selectedIds, id]);
    }
  };

  const handleSelectAll = () => {
    if (selectedIds.length === companies.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(companies.map((c) => c.id));
    }
  };

  const handlePullToCRM = async () => {
    if (selectedIds.length === 0) return;
    setPulling(true);
    try {
      const res = await api.pullGlobalCompanies(selectedIds);
      setSuccessMsg(
        `Successfully pulled ${res.pulled_companies} companies and created ${res.created_leads} active CRM leads! Remaining pull credits: ${res.remaining_quota}`
      );
      setSelectedIds([]);
      setTimeout(() => setSuccessMsg(null), 5000);
    } catch (err: any) {
      alert(err.message || "Failed to pull records");
    } finally {
      setPulling(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "12px" }}>
        <div>
          <h2 style={{ fontSize: "1.375rem", fontWeight: 800, color: "var(--text-primary)", letterSpacing: "-0.02em", display: "flex", alignItems: "center", gap: "8px" }}>
            <Globe2 style={{ width: "22px", height: "22px", color: "var(--cyan)" }} />
            Global Intelligence Registry
          </h2>
          <p style={{ fontSize: "0.8125rem", color: "var(--text-secondary)", marginTop: "2px" }}>
            Pre-curated enterprise database with verified directors and CIN registry data
          </p>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
          <button
            onClick={() => setShowImportModal(true)}
            className="btn-secondary"
            style={{ fontSize: "0.8125rem" }}
            title="Import enterprise companies and contacts into Global Database"
          >
            <UploadCloud style={{ width: "16px", height: "16px", color: "var(--primary)" }} />
            Import to Global Database
          </button>

          {selectedIds.length > 0 && (
            <button
              onClick={handlePullToCRM}
              disabled={pulling}
              className="btn-primary"
              style={{ background: "linear-gradient(135deg, #0891b2, #0e7490)", borderColor: "#155e75" }}
            >
              <Download style={{ width: "16px", height: "16px" }} />
              {pulling ? "Pulling Records..." : `Pull ${selectedIds.length} Selected to CRM`}
            </button>
          )}
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

      {/* Search & Filter Bar */}
      <div className="card" style={{ padding: "16px", display: "flex", flexWrap: "wrap", alignItems: "center", gap: "12px" }}>
        <div style={{ position: "relative", flex: 1, minWidth: "260px" }}>
          <Search style={{ width: "16px", height: "16px", color: "var(--text-muted)", position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)" }} />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && loadGlobalCompanies()}
            placeholder="Search by company name, CIN, or industry..."
            className="input-text"
            style={{ paddingLeft: "36px" }}
          />
        </div>

        <input
          type="text"
          value={cityFilter}
          onChange={(e) => setCityFilter(e.target.value)}
          placeholder="Filter by city (e.g. Pune, Mumbai)"
          className="input-text"
          style={{ width: "200px" }}
        />

        <button onClick={loadGlobalCompanies} className="btn-secondary">
          Filter
        </button>
      </div>

      {/* Registry Table / List */}
      <div className="card" style={{ overflow: "hidden" }}>
        <div style={{
          padding: "12px 20px",
          borderBottom: "1px solid var(--border-subtle)",
          background: "var(--bg-surface-subtle)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          fontSize: "0.75rem",
          color: "var(--text-secondary)",
          fontWeight: 600
        }}>
          <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={companies.length > 0 && selectedIds.length === companies.length}
              onChange={handleSelectAll}
            />
            <span>Select All Visible ({companies.length})</span>
          </label>
          <span style={{ fontFamily: "monospace", fontWeight: 700 }}>{selectedIds.length} selected for import</span>
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          {loading ? (
            <p style={{ textAlign: "center", padding: "48px 0", fontSize: "0.8125rem", color: "var(--text-muted)" }}>
              Searching global business registry...
            </p>
          ) : companies.length === 0 ? (
            <p style={{ textAlign: "center", padding: "48px 0", fontSize: "0.8125rem", color: "var(--text-muted)" }}>
              No matching global enterprise companies found.
            </p>
          ) : (
            companies.map((comp) => {
              const isSelected = selectedIds.includes(comp.id);
              return (
                <div
                  key={comp.id}
                  onClick={() => handleSelectToggle(comp.id)}
                  style={{
                    padding: "16px 20px",
                    borderBottom: "1px solid var(--border-subtle)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    background: isSelected ? "var(--cyan-light)" : "var(--bg-surface)",
                    cursor: "pointer",
                    transition: "all 0.15s ease"
                  }}
                  onMouseOver={(e) => {
                    if (!isSelected) e.currentTarget.style.background = "var(--bg-surface-hover)";
                  }}
                  onMouseOut={(e) => {
                    if (!isSelected) e.currentTarget.style.background = "var(--bg-surface)";
                  }}
                >
                  <div style={{ display: "flex", alignItems: "flex-start", gap: "12px" }}>
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => {}}
                      style={{ marginTop: "4px" }}
                    />
                    <div>
                      <h4 style={{ fontSize: "0.875rem", fontWeight: 800, color: "var(--text-primary)", display: "flex", alignItems: "center", gap: "8px" }}>
                        {comp.legal_name}
                        <span className="badge badge-neutral" style={{ fontSize: "0.625rem" }}>
                          {comp.company_type || "Private Ltd"}
                        </span>
                      </h4>
                      <p style={{ fontSize: "0.75rem", color: "var(--text-secondary)", fontFamily: "monospace", marginTop: "2px" }}>
                        CIN: {comp.registry_id} • {comp.industry || "General Enterprise"}
                      </p>
                      <div style={{ display: "flex", alignItems: "center", gap: "12px", fontSize: "0.6875rem", color: "var(--text-muted)", marginTop: "4px" }}>
                        {comp.city && (
                          <span style={{ display: "flex", alignItems: "center", gap: "4px", color: "var(--cyan-dark)", fontWeight: 600 }}>
                            <MapPin style={{ width: "12px", height: "12px" }} />
                            {comp.city}
                          </span>
                        )}
                        <span style={{ color: "var(--primary)", fontWeight: 600 }}>
                          {comp.contacts_count} Verified Key People / Directors
                        </span>
                      </div>
                    </div>
                  </div>

                  <div style={{ textAlign: "right" }}>
                    <span className="badge badge-open" style={{ fontSize: "0.6875rem" }}>
                      VERIFIED DIRECTORS
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {showImportModal && (
        <ImportModal
          jobType="GLOBAL_COMPANIES"
          onClose={() => setShowImportModal(false)}
          onSuccess={() => {
            loadGlobalCompanies();
            setSuccessMsg("Global database import completed successfully!");
            setTimeout(() => setSuccessMsg(null), 4000);
          }}
        />
      )}
    </div>
  );
};
