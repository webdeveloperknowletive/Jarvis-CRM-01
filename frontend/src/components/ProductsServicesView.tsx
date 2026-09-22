import React, { useState, useEffect } from "react";
import { api } from "../services/api";
import { Plus, Edit2, Trash2, Tag, Box, Info } from "lucide-react";

interface ProductService {
  id: string;
  name: string;
  code: string;
  type: "PRODUCT" | "SERVICE";
  price: number;
  currency: string;
  description: string;
  status: string;
  created_at: string;
}

export const ProductsServicesView: React.FC = () => {
  const [items, setItems] = useState<ProductService[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [showModal, setShowModal] = useState(false);
  const [step, setStep] = useState<1 | 2>(1);
  const [editingItem, setEditingItem] = useState<ProductService | null>(null);

  const [formData, setFormData] = useState({
    name: "",
    code: "",
    type: "PRODUCT" as "PRODUCT" | "SERVICE",
    price: 0,
    currency: "INR",
    description: "",
    status: "ACTIVE"
  });

  useEffect(() => {
    fetchItems();
  }, []);

  const fetchItems = async () => {
    try {
      const res = await api.getProductServices();
      setItems((res as any) || []);
    } catch (err: any) {
      setError(err.message || "Failed to load products/services.");
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (item?: ProductService) => {
    if (item) {
      setEditingItem(item);
      setFormData({
        name: item.name,
        code: item.code,
        type: item.type,
        price: item.price,
        currency: item.currency,
        description: item.description || "",
        status: item.status
      });
    } else {
      setEditingItem(null);
      setFormData({
        name: "",
        code: "",
        type: "PRODUCT",
        price: 0,
        currency: "INR",
        description: "",
        status: "ACTIVE"
      });
      setStep(1);
    }
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingItem) {
        await api.updateProductService(editingItem.id, formData);
      } else {
        await api.createProductService(formData);
      }
      setShowModal(false);
      fetchItems();
    } catch (err: any) {
      alert(err.response?.data?.detail || "Failed to save item");
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Are you sure you want to deactivate this product/service?")) return;
    try {
      await api.updateProductService(id, { is_active: false });
      fetchItems();
    } catch (err: any) {
      alert(err.message || "Failed to deactivate item.");
    }
  };

  if (loading) {
    return <div style={{ padding: "40px", textAlign: "center", color: "#94a3b8" }}>Loading...</div>;
  }

  return (
    <div style={{ padding: "32px", maxWidth: "1200px", margin: "0 auto", animation: "fadeIn 0.3s ease" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
        <div>
          <h2 style={{ fontSize: "1.5rem", fontWeight: 700, color: "#f8fafc", margin: 0, display: "flex", alignItems: "center", gap: "10px" }}>
            <Box style={{ color: "#38bdf8" }} />
            Products & Services
          </h2>
          <p style={{ color: "#94a3b8", margin: "4px 0 0 0", fontSize: "0.875rem" }}>
            Manage your organization's catalog for lead assignment and billing
          </p>
        </div>
        <button className="btn-primary" onClick={() => handleOpenModal()} style={{ padding: "8px 16px", borderRadius: "8px", fontWeight: 600 }}>
          <Plus style={{ width: "16px", height: "16px" }} /> Add Item
        </button>
      </div>

      {error && (
        <div style={{ padding: "12px 16px", background: "rgba(239, 68, 68, 0.1)", borderLeft: "4px solid #ef4444", color: "#f87171", borderRadius: "4px", marginBottom: "20px" }}>
          {error}
        </div>
      )}

      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        {items.length === 0 ? (
          <div style={{ padding: "40px", textAlign: "center", color: "#94a3b8" }}>
            <Box style={{ width: "48px", height: "48px", margin: "0 auto 16px auto", opacity: 0.5 }} />
            <p>No products or services defined.</p>
          </div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "rgba(15, 23, 42, 0.6)", borderBottom: "1px solid #334155" }}>
                <th style={{ padding: "12px 16px", textAlign: "left", fontSize: "0.75rem", textTransform: "uppercase", color: "#94a3b8", fontWeight: 600 }}>Code</th>
                <th style={{ padding: "12px 16px", textAlign: "left", fontSize: "0.75rem", textTransform: "uppercase", color: "#94a3b8", fontWeight: 600 }}>Name</th>
                <th style={{ padding: "12px 16px", textAlign: "left", fontSize: "0.75rem", textTransform: "uppercase", color: "#94a3b8", fontWeight: 600 }}>Type</th>
                <th style={{ padding: "12px 16px", textAlign: "right", fontSize: "0.75rem", textTransform: "uppercase", color: "#94a3b8", fontWeight: 600 }}>Price</th>
                <th style={{ padding: "12px 16px", textAlign: "center", fontSize: "0.75rem", textTransform: "uppercase", color: "#94a3b8", fontWeight: 600 }}>Status</th>
                <th style={{ padding: "12px 16px", textAlign: "right", fontSize: "0.75rem", textTransform: "uppercase", color: "#94a3b8", fontWeight: 600 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} style={{ borderBottom: "1px solid #1e293b", transition: "background 0.2s" }} onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.02)'} onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
                  <td style={{ padding: "16px", color: "#94a3b8", fontFamily: "monospace", fontSize: "0.875rem" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      <Tag style={{ width: "12px", height: "12px", opacity: 0.7 }} />
                      {item.code}
                    </div>
                  </td>
                  <td style={{ padding: "16px", color: "#f8fafc", fontWeight: 500 }}>{item.name}</td>
                  <td style={{ padding: "16px" }}>
                    <span style={{ 
                      padding: "4px 8px", 
                      borderRadius: "12px", 
                      fontSize: "0.75rem", 
                      fontWeight: 600,
                      background: item.type === "PRODUCT" ? "rgba(56, 189, 248, 0.1)" : "rgba(167, 139, 250, 0.1)",
                      color: item.type === "PRODUCT" ? "#38bdf8" : "#a78bfa"
                    }}>
                      {item.type}
                    </span>
                  </td>
                  <td style={{ padding: "16px", textAlign: "right", color: "#f8fafc" }}>
                    {item.price > 0 ? `${item.price.toLocaleString()} ${item.currency}` : "Free"}
                  </td>
                  <td style={{ padding: "16px", textAlign: "center" }}>
                    <span style={{
                      padding: "4px 8px",
                      borderRadius: "12px",
                      fontSize: "0.75rem",
                      fontWeight: 600,
                      background: item.status === "ACTIVE" ? "rgba(16, 185, 129, 0.1)" : "rgba(148, 163, 184, 0.1)",
                      color: item.status === "ACTIVE" ? "#10b981" : "#94a3b8"
                    }}>
                      {item.status}
                    </span>
                  </td>
                  <td style={{ padding: "16px", textAlign: "right" }}>
                    <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px" }}>
                      <button onClick={() => handleOpenModal(item)} style={{ background: "transparent", border: "none", color: "#94a3b8", cursor: "pointer", padding: "4px" }}>
                        <Edit2 style={{ width: "16px", height: "16px" }} />
                      </button>
                      <button onClick={() => handleDelete(item.id)} style={{ background: "transparent", border: "none", color: "#ef4444", cursor: "pointer", padding: "4px" }}>
                        <Trash2 style={{ width: "16px", height: "16px" }} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div style={{
          position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
          background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)",
          display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000
        }}>
          <div className="card" style={{ width: "100%", maxWidth: "540px", padding: "32px", animation: "slideUp 0.3s ease" }}>
            
            {step === 1 && !editingItem ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "24px", textAlign: "center" }}>
                <div>
                  <h3 style={{ fontSize: "1.35rem", fontWeight: 800, margin: "0", color: "var(--text-primary)" }}>
                    What would you like to add?
                  </h3>
                  <p style={{ color: "var(--text-secondary)", fontSize: "0.875rem", margin: "8px 0 0 0" }}>
                    Choose the type of item you want to add to your catalog.
                  </p>
                </div>
                <div style={{ display: "flex", gap: "16px", justifyContent: "center" }}>
                  <button 
                    type="button"
                    onClick={() => { setFormData({...formData, type: "PRODUCT"}); setStep(2); }}
                    style={{ flex: 1, padding: "24px 16px", borderRadius: "12px", border: "2px solid var(--border-subtle)", background: "var(--bg-surface)", cursor: "pointer", transition: "all 0.2s", display: "flex", flexDirection: "column", alignItems: "center" }}
                    onMouseEnter={(e) => { e.currentTarget.style.borderColor = "#38bdf8"; e.currentTarget.style.background = "rgba(56, 189, 248, 0.05)"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--border-subtle)"; e.currentTarget.style.background = "var(--bg-surface)"; }}
                  >
                    <Box style={{ width: "36px", height: "36px", color: "#38bdf8", marginBottom: "12px" }} />
                    <div style={{ fontWeight: 700, color: "var(--text-primary)", fontSize: "1.05rem" }}>Product</div>
                    <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)", marginTop: "6px" }}>Physical or digital good</div>
                  </button>
                  <button 
                    type="button"
                    onClick={() => { setFormData({...formData, type: "SERVICE"}); setStep(2); }}
                    style={{ flex: 1, padding: "24px 16px", borderRadius: "12px", border: "2px solid var(--border-subtle)", background: "var(--bg-surface)", cursor: "pointer", transition: "all 0.2s", display: "flex", flexDirection: "column", alignItems: "center" }}
                    onMouseEnter={(e) => { e.currentTarget.style.borderColor = "#a78bfa"; e.currentTarget.style.background = "rgba(167, 139, 250, 0.05)"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--border-subtle)"; e.currentTarget.style.background = "var(--bg-surface)"; }}
                  >
                    <Tag style={{ width: "36px", height: "36px", color: "#a78bfa", marginBottom: "12px" }} />
                    <div style={{ fontWeight: 700, color: "var(--text-primary)", fontSize: "1.05rem" }}>Service</div>
                    <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)", marginTop: "6px" }}>Consulting, support, etc.</div>
                  </button>
                </div>
                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary" style={{ alignSelf: "center", marginTop: "8px", background: "transparent", color: "var(--text-secondary)" }}>
                  Cancel
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
                <div style={{ display: "flex", alignItems: "center", marginBottom: "4px" }}>
                  {!editingItem && (
                    <button type="button" onClick={() => setStep(1)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-secondary)", marginRight: "16px", padding: "4px", display: "flex", alignItems: "center", fontSize: "0.875rem", fontWeight: 600 }}>
                      &larr; Back
                    </button>
                  )}
                  <h3 style={{ fontSize: "1.25rem", fontWeight: 800, margin: 0, color: "var(--text-primary)" }}>
                    {editingItem ? "Edit Item" : `Add ${formData.type === "PRODUCT" ? "Product" : "Service"}`}
                  </h3>
                </div>
                
                <div style={{ display: "flex", gap: "16px" }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: "block", fontSize: "0.875rem", fontWeight: 600, color: "var(--text-primary)", marginBottom: "4px" }}>Name <span style={{color:"#ef4444"}}>*</span></label>
                    <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)", marginBottom: "8px" }}>Public facing name of the item.</div>
                    <input required value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} className="input-text" placeholder={formData.type === "PRODUCT" ? "e.g., Enterprise CRM License" : "e.g., Annual Consulting"} />
                  </div>
                  <div style={{ width: "160px" }}>
                    <label style={{ display: "block", fontSize: "0.875rem", fontWeight: 600, color: "var(--text-primary)", marginBottom: "4px" }}>Code <span style={{color:"#ef4444"}}>*</span></label>
                    <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)", marginBottom: "8px" }}>Unique identifier (SKU).</div>
                    <input required value={formData.code} onChange={(e) => setFormData({...formData, code: e.target.value})} className="input-text" placeholder="CRM-ENT-1" />
                  </div>
                </div>

                <div style={{ display: "flex", gap: "16px" }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: "block", fontSize: "0.875rem", fontWeight: 600, color: "var(--text-primary)", marginBottom: "4px" }}>Type</label>
                    <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)", marginBottom: "8px" }}>Category of this item.</div>
                    <select value={formData.type} onChange={(e) => setFormData({...formData, type: e.target.value as "PRODUCT"|"SERVICE"})} className="input-text">
                      <option value="PRODUCT">Product</option>
                      <option value="SERVICE">Service</option>
                    </select>
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: "block", fontSize: "0.875rem", fontWeight: 600, color: "var(--text-primary)", marginBottom: "4px" }}>Status</label>
                    <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)", marginBottom: "8px" }}>Availability for assignments.</div>
                    <select value={formData.status} onChange={(e) => setFormData({...formData, status: e.target.value})} className="input-text">
                      <option value="ACTIVE">Active</option>
                      <option value="INACTIVE">Inactive</option>
                    </select>
                  </div>
                </div>

                <div style={{ display: "flex", gap: "16px" }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: "block", fontSize: "0.875rem", fontWeight: 600, color: "var(--text-primary)", marginBottom: "4px" }}>Price</label>
                    <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)", marginBottom: "8px" }}>Base price before taxes.</div>
                    <input type="number" step="0.01" required value={formData.price} onChange={(e) => setFormData({...formData, price: parseFloat(e.target.value) || 0})} className="input-text" />
                  </div>
                  <div style={{ width: "120px" }}>
                    <label style={{ display: "block", fontSize: "0.875rem", fontWeight: 600, color: "var(--text-primary)", marginBottom: "4px" }}>Currency</label>
                    <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)", marginBottom: "8px" }}>ISO Code.</div>
                    <input required value={formData.currency} onChange={(e) => setFormData({...formData, currency: e.target.value.toUpperCase()})} className="input-text" placeholder="USD" />
                  </div>
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "0.875rem", fontWeight: 600, color: "var(--text-primary)", marginBottom: "4px" }}>Description</label>
                  <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)", marginBottom: "8px" }}>Detailed explanation of what this includes.</div>
                  <textarea rows={3} value={formData.description} onChange={(e) => setFormData({...formData, description: e.target.value})} className="input-text" placeholder="Optional description..." />
                </div>

                <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px", marginTop: "8px", paddingTop: "20px", borderTop: "1px solid var(--border-subtle)" }}>
                  <button type="button" onClick={() => setShowModal(false)} className="btn-secondary" style={{ background: "transparent", color: "var(--text-secondary)" }}>
                    Cancel
                  </button>
                  <button type="submit" className="btn-primary">
                    {editingItem ? "Save Changes" : "Create Item"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ProductsServicesView;
