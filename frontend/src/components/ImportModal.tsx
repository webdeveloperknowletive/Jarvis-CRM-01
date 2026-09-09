import React, { useState } from "react";
import { api, ImportJob } from "../services/api";
import { UploadCloud, CheckCircle2, AlertTriangle, FileText, ArrowRight, X } from "lucide-react";

interface ImportModalProps {
  jobType?: "TENANT_LEADS" | "GLOBAL_COMPANIES";
  onClose: () => void;
  onSuccess: () => void;
}

export const ImportModal: React.FC<ImportModalProps> = ({ jobType = "TENANT_LEADS", onClose, onSuccess }) => {
  const [step, setStep] = useState<"upload" | "mapping" | "processing" | "complete">("upload");
  const [, setSelectedFile] = useState<File | null>(null);
  const [previewData, setPreviewData] = useState<any>(null);
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({});
  const [activeJob, setActiveJob] = useState<ImportJob | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const SYSTEM_FIELDS = [
    { value: "ignore", label: "— Ignore Column —" },
    { value: "company_name", label: "Company / Account Name" },
    { value: "contact_name", label: "Contact Person Name" },
    { value: "contact_email", label: "Contact Email" },
    { value: "contact_phone", label: "Contact Phone / Mobile" },
    { value: "title", label: "Opportunity Title" },
    { value: "city", label: "City" },
    { value: "state", label: "State" },
    { value: "cin", label: "CIN / Registration No." },
    { value: "designation", label: "Designation / Role" },
    { value: "value", label: "Estimated Value" },
    { value: "industry", label: "Industry" },
  ];

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedFile(file);
      setLoading(true);
      setError(null);
      try {
        const preview = await api.uploadImportFile(file);
        setPreviewData(preview);
        setColumnMapping(preview.suggested_mappings || {});
        setStep("mapping");
      } catch (err: any) {
        setError(err.message || "Failed to upload file");
      } finally {
        setLoading(false);
      }
    }
  };

  const handleStartImport = async () => {
    if (!previewData) return;
    setLoading(true);
    setError(null);
    try {
      const job = await api.executeImport({
        file_path: previewData.file_path,
        file_name: previewData.file_name,
        file_type: previewData.file_type,
        job_type: jobType,
        column_mapping: columnMapping,
      });
      setActiveJob(job);
      setStep("processing");
      pollJobStatus(job.id);
    } catch (err: any) {
      setError(err.message || "Failed to launch import execution");
    } finally {
      setLoading(false);
    }
  };

  const pollJobStatus = (jobId: string) => {
    const interval = setInterval(async () => {
      try {
        const job = await api.getImportJob(jobId);
        setActiveJob(job);
        if (job.status === "COMPLETED" || job.status === "PARTIAL" || job.status === "FAILED") {
          clearInterval(interval);
          setStep("complete");
          onSuccess();
        }
      } catch (e) {
        clearInterval(interval);
      }
    }, 1000);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-dialog" onClick={(e) => e.stopPropagation()} style={{ maxWidth: "680px", padding: "24px" }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingBottom: "14px", borderBottom: "1px solid var(--border-subtle)", marginBottom: "18px" }}>
          <div>
            <h3 style={{ fontSize: "1.125rem", fontWeight: 800, color: "var(--text-primary)", display: "flex", alignItems: "center", gap: "8px" }}>
              <UploadCloud style={{ width: "20px", height: "20px", color: "var(--primary)" }} />
              {jobType === "GLOBAL_COMPANIES" ? "Global Database Ingestion Wizard" : "Lead Ingestion Wizard"}
            </h3>
            <p style={{ fontSize: "0.75rem", color: "var(--text-secondary)", marginTop: "2px" }}>
              {jobType === "GLOBAL_COMPANIES"
                ? "Super Admin enterprise company and director batch ingestion"
                : "Asynchronous bulk processor with pipeline immutability"}
            </p>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)" }}>
            <X style={{ width: "20px", height: "20px" }} />
          </button>
        </div>

        {error && (
          <div style={{
            marginBottom: "16px",
            padding: "10px 14px",
            borderRadius: "8px",
            background: "var(--rose-light)",
            border: "1px solid var(--rose-border)",
            color: "var(--rose-dark)",
            fontSize: "0.8125rem",
            display: "flex",
            alignItems: "center",
            gap: "8px"
          }}>
            <AlertTriangle style={{ width: "16px", height: "16px", flexShrink: 0 }} />
            <span>{error}</span>
          </div>
        )}

        {/* Step 1: Upload File */}
        {step === "upload" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "16px", textAlign: "center", padding: "24px 0" }}>
            <div style={{
              border: "2px dashed var(--border-medium)",
              borderRadius: "12px",
              padding: "36px 20px",
              background: "var(--bg-surface-subtle)",
              cursor: "pointer",
              transition: "border-color 0.15s ease"
            }}>
              <UploadCloud style={{ width: "40px", height: "40px", color: "var(--primary)", margin: "0 auto 12px auto" }} />
              <p style={{ fontSize: "0.875rem", fontWeight: 700, color: "var(--text-primary)" }}>
                Click to select CSV, XLS, or XLSX lead file
              </p>
              <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "4px" }}>
                Supports up to 100,000 rows with automated duplicate detection
              </p>
              <input
                type="file"
                accept=".csv,.xlsx,.xls"
                onChange={handleFileChange}
                style={{ display: "none" }}
                id="file-upload-input"
              />
              <label htmlFor="file-upload-input" className="btn-primary" style={{ marginTop: "16px", display: "inline-flex", cursor: "pointer" }}>
                Select File from Disk
              </label>
            </div>
            {loading && <p style={{ fontSize: "0.75rem", color: "var(--primary)", fontWeight: 600 }}>Analyzing headers and encoding...</p>}
          </div>
        )}

        {/* Step 2: Column Mapping */}
        {step === "mapping" && previewData && (() => {
          const headersList = previewData.headers || previewData.detected_headers || [];
          const sampleRowsList = previewData.preview_rows || previewData.sample_rows || [];
          const totalRows = previewData.total_rows_estimate || previewData.total_detected_rows || 0;

          return (
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div>
                  <p style={{ fontSize: "0.8125rem", fontWeight: 700, color: "var(--text-primary)" }}>
                    Map Ingestion Columns
                  </p>
                  <p style={{ fontSize: "0.6875rem", color: "var(--text-muted)" }}>
                    Detected {totalRows} rows in {previewData.file_name}
                  </p>
                </div>
                <span className="badge badge-medium">Auto-Mapped</span>
              </div>

              <div style={{ maxHeight: "320px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "8px", paddingRight: "4px" }}>
                {headersList.map((hdr: string) => (
                  <div
                    key={hdr}
                    style={{
                      padding: "8px 12px",
                      borderRadius: "8px",
                      background: "var(--bg-surface-subtle)",
                      border: "1px solid var(--border-subtle)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: "12px"
                    }}
                  >
                    <div style={{ flex: 1 }}>
                      <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--text-primary)", fontFamily: "monospace" }}>
                        {hdr}
                      </span>
                      {sampleRowsList[0] && (
                        <span style={{ fontSize: "0.6875rem", color: "var(--text-muted)", display: "block" }}>
                          Ex: {String(sampleRowsList[0][hdr] || "—").substring(0, 32)}
                        </span>
                      )}
                    </div>

                    <select
                      value={columnMapping[hdr] || "ignore"}
                      onChange={(e) => setColumnMapping({ ...columnMapping, [hdr]: e.target.value })}
                      className="select-dropdown"
                      style={{ width: "200px", fontSize: "0.75rem" }}
                    >
                      {SYSTEM_FIELDS.map((f) => (
                        <option key={f.value} value={f.value}>
                          {f.label}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>

              <div style={{ paddingTop: "12px", borderTop: "1px solid var(--border-subtle)", display: "flex", justifyContent: "flex-end", gap: "10px" }}>
                <button onClick={() => setStep("upload")} className="btn-secondary">
                  Back
                </button>
                <button onClick={handleStartImport} disabled={loading} className="btn-primary">
                  {loading ? "Starting..." : "Start Lead Ingestion"}
                  <ArrowRight style={{ width: "14px", height: "14px" }} />
                </button>
              </div>
            </div>
          );
        })()}

        {/* Step 3: Ingestion Processing */}
        {step === "processing" && (
          <div style={{ textAlign: "center", padding: "36px 0", display: "flex", flexDirection: "column", gap: "16px" }}>
            <div className="radar-pulse-dot" style={{ width: "16px", height: "16px", margin: "0 auto" }} />
            <div>
              <h4 style={{ fontSize: "1.125rem", fontWeight: 800, color: "var(--text-primary)" }}>
                Ingesting Leads Asynchronously
              </h4>
              <p style={{ fontSize: "0.8125rem", color: "var(--text-secondary)", marginTop: "4px" }}>
                Normalizing phone numbers, isolating invalid rows, and maintaining pipeline immutability...
              </p>
            </div>

            {activeJob && (
              <div style={{ maxWidth: "340px", margin: "0 auto", width: "100%" }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.75rem", marginBottom: "4px", fontFamily: "monospace" }}>
                  <span>{activeJob.processed_rows} / {activeJob.total_rows} rows</span>
                  <span>{activeJob.total_rows > 0 ? ((activeJob.processed_rows / activeJob.total_rows) * 100).toFixed(0) : 0}%</span>
                </div>
                <div style={{ height: "8px", borderRadius: "999px", background: "var(--bg-surface-subtle)", overflow: "hidden", border: "1px solid var(--border-subtle)" }}>
                  <div style={{
                    height: "100%",
                    width: `${activeJob.total_rows > 0 ? (activeJob.processed_rows / activeJob.total_rows) * 100 : 0}%`,
                    background: "var(--primary)",
                    transition: "width 0.2s ease"
                  }} />
                </div>
              </div>
            )}
          </div>
        )}

        {/* Step 4: Complete */}
        {step === "complete" && activeJob && (
          <div style={{ textAlign: "center", padding: "24px 0", display: "flex", flexDirection: "column", gap: "16px" }}>
            <div style={{
              width: "52px",
              height: "52px",
              borderRadius: "50%",
              background: "var(--emerald-light)",
              border: "1px solid var(--emerald-border)",
              color: "var(--emerald)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto"
            }}>
              <CheckCircle2 style={{ width: "28px", height: "28px" }} />
            </div>

            <div>
              <h4 style={{ fontSize: "1.25rem", fontWeight: 800, color: "var(--text-primary)" }}>
                Ingestion Completed Successfully
              </h4>
              <p style={{ fontSize: "0.8125rem", color: "var(--text-secondary)", marginTop: "4px" }}>
                All leads normalized and added without pipeline alteration
              </p>
            </div>

            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: "12px",
              background: "var(--bg-surface-subtle)",
              padding: "16px",
              borderRadius: "10px",
              border: "1px solid var(--border-subtle)"
            }}>
              <div>
                <span style={{ fontSize: "0.6875rem", color: "var(--text-muted)", display: "block" }}>Created Leads</span>
                <p style={{ fontSize: "1.25rem", fontWeight: 800, color: "var(--emerald-dark)", fontFamily: "monospace", marginTop: "2px" }}>
                  {activeJob.successful_rows}
                </p>
              </div>
              <div>
                <span style={{ fontSize: "0.6875rem", color: "var(--text-muted)", display: "block" }}>Duplicates Skipped</span>
                <p style={{ fontSize: "1.25rem", fontWeight: 800, color: "var(--amber-dark)", fontFamily: "monospace", marginTop: "2px" }}>
                  {activeJob.duplicate_rows}
                </p>
              </div>
              <div>
                <span style={{ fontSize: "0.6875rem", color: "var(--text-muted)", display: "block" }}>Row Errors</span>
                <p style={{ fontSize: "1.25rem", fontWeight: 800, color: "var(--rose-dark)", fontFamily: "monospace", marginTop: "2px" }}>
                  {activeJob.error_rows}
                </p>
              </div>
            </div>

            <div style={{ marginTop: "12px" }}>
              <button onClick={onClose} className="btn-primary" style={{ padding: "10px 24px" }}>
                View Ingested Leads in Pipeline
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
