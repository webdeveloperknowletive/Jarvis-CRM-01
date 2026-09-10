const API_BASE = "http://localhost:8000/api/v1";

export interface User {
  id: string;
  email: string;
  full_name: string;
  platform_role?: string | null;
  tenant_role?: string | null;
  effective_role: string;
  is_super_admin: boolean;
  organization_id?: string | null;
  organization?: {
    id: string;
    name: string;
    slug: string;
    timezone: string;
    currency: string;
  } | null;
}

export interface PipelineStage {
  id: string;
  pipeline_id: string;
  name: string;
  code: string;
  order_index: number;
  color?: string;
  win_probability?: number;
  is_won: boolean;
  is_lost: boolean;
}

export interface Lead {
  id: string;
  organization_id: string;
  company_id?: string | null;
  contact_id?: string | null;
  pipeline_stage_id: string;
  owner_id?: string | null;
  owner_name?: string | null;
  title: string;
  company_name?: string | null;
  contact_name?: string | null;
  contact_email?: string | null;
  contact_phone?: string | null;
  source: string;
  status: string;
  priority: string;
  score: number;
  value?: number;
  currency: string;
  description?: string | null;
  notes?: string | null;
  is_phone_masked: boolean;
  is_email_masked: boolean;
  stage?: PipelineStage | null;
  created_at: string;
  updated_at: string;
}

export interface Task {
  id: string;
  lead_id?: string | null;
  task_type: string;
  title: string;
  description?: string | null;
  priority: string;
  status: string;
  due_at?: string | null;
  assigned_to_name?: string | null;
  reschedule_count: number;
}

export interface Activity {
  id: string;
  lead_id?: string | null;
  user_name?: string | null;
  activity_type: string;
  subject?: string | null;
  description?: string | null;
  direction?: string | null;
  status: string;
  duration_seconds?: number;
  metadata_json?: Record<string, any>;
  occurred_at: string;
}

export interface ImportJob {
  id: string;
  file_name: string;
  file_type: string;
  total_rows: number;
  processed_rows: number;
  successful_rows: number;
  duplicate_rows: number;
  error_rows: number;
  status: string;
  error_summary?: Record<string, any>;
  started_at?: string | null;
  completed_at?: string | null;
  created_at: string;
}

export interface RadarOpportunity {
  lead_id: string;
  title: string;
  company_name?: string | null;
  score: number;
  reason: string;
  recommended_action: string;
  urgency: string;
}

export interface RadarOverview {
  high_value_opportunities: RadarOpportunity[];
  overdue_followups_count: number;
  stale_leads_count: number;
  total_active_pipeline_value: number;
  radar_activity_today: number;
  data_access_anomalies: any[];
}

export interface GlobalCompany {
  id: string;
  registry_id: string;
  legal_name: string;
  display_name?: string | null;
  company_type?: string | null;
  industry?: string | null;
  cin?: string | null;
  registration_number?: string | null;
  gst_number?: string | null;
  address?: string | null;
  postal_code?: string | null;
  website?: string | null;
  email?: string | null;
  phone?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string;
  status?: string;
  pull_status?: string;
  pulled_by_org_id?: string | null;
  pulled_by_org_name?: string | null;
  pulled_at?: string | null;
  contacts_count: number;
  first_seen_at?: string;
  last_updated_at?: string;
}

export interface GlobalCompanyCreatePayload {
  legal_name: string;
  id?: string;
  cin?: string;
  registration_number?: string;
  gst_number?: string;
  address?: string;
  city?: string;
  postal_code?: string;
  state?: string;
  website?: string;
  email?: string;
  phone?: string;
  country?: string;
  industry?: string;
  company_type?: string;
}

export interface AssociatedCompany {
  company_name: string;
  designation?: string;
}

export interface GlobalPerson {
  id: string;
  full_name: string;
  email?: string | null;
  phone?: string | null;
  designation?: string | null;
  company_name?: string | null;
  associated_companies?: AssociatedCompany[];
  industry?: string | null;
  seniority?: string | null;
  department?: string | null;
  linkedin_url?: string | null;
  city?: string | null;
  state?: string | null;
  country: string;
  estimated_value: number;
  status: string;
  pull_status?: string;
  pulled_by_org_id?: string | null;
  pulled_by_org_name?: string | null;
  pulled_at?: string | null;
  source: string;
  notes?: string | null;
  first_seen_at: string;
  last_updated_at: string;
}

export interface LinkedPerson {
  id: string;
  full_name: string;
  email?: string | null;
  phone?: string | null;
  designation?: string | null;
  company_name?: string | null;
  seniority?: string | null;
  department?: string | null;
  city?: string | null;
  state?: string | null;
  linkedin_url?: string | null;
  status: string;
  pull_status?: string;
  pulled_by_org_id?: string | null;
  pulled_by_org_name?: string | null;
  pulled_at?: string | null;
  is_primary: boolean;
  estimated_value: number;
}

export interface CompanyWithPeople extends GlobalCompany {
  associated_people: LinkedPerson[];
  people_count: number;
}

export interface GlobalIntelligenceResponse {
  total_companies: number;
  total_people: number;
  linked_people_count: number;
  unlinked_people_count: number;
  companies_with_people_count: number;
  direct_reach_percentage: number;
  total_market_turnover?: number;
  companies: CompanyWithPeople[];
  unlinked_people: LinkedPerson[];
}

export const api = {
  getToken: () => localStorage.getItem("jarvis_token"),
  setToken: (token: string) => localStorage.setItem("jarvis_token", token),
  clearToken: () => localStorage.removeItem("jarvis_token"),

  headers: () => {
    const token = localStorage.getItem("jarvis_token");
    const h: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (token) {
      h["Authorization"] = `Bearer ${token}`;
    }
    return h;
  },

  async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${API_BASE}${endpoint}`;
    const res = await fetch(url, {
      ...options,
      headers: {
        ...this.headers(),
        ...(options.headers || {}),
      },
    });

    if (!res.ok) {
      let errorMsg = "Request failed";
      try {
        const errJson = await res.json();
        if (typeof errJson.detail === "string") {
          errorMsg = errJson.detail;
        } else if (Array.isArray(errJson.detail)) {
          errorMsg = errJson.detail
            .map((d: any) => (d.msg ? `${d.loc ? d.loc.slice(-1) + ': ' : ''}${d.msg}` : JSON.stringify(d)))
            .join("; ");
        } else if (errJson.message) {
          errorMsg = errJson.message;
        } else if (errJson.detail && typeof errJson.detail === "object") {
          errorMsg = JSON.stringify(errJson.detail);
        }
      } catch (e) {
        errorMsg = res.statusText || errorMsg;
      }
      throw new Error(errorMsg);
    }
    return res.json();
  },

  // Auth
  login: (email: string, password: string) =>
    api.request<{ access_token: string; user: User }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),

  getMe: () => api.request<User>("/auth/me"),

  // Organizations (Super Admin)
  getOrganizations: () => api.request<any[]>("/organizations/"),
  createOrganization: (data: any) =>
    api.request<any>("/organizations/", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  // Pipelines & Stages
  getPipeline: () => api.request<any>("/pipelines/"),
  createStage: (data: {
    name: string;
    code: string;
    order_index: number;
    color?: string;
    win_probability?: number;
    is_won?: boolean;
    is_lost?: boolean;
  }) =>
    api.request<PipelineStage>("/pipelines/stages", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updateStage: (
    id: string,
    data: {
      name?: string;
      code?: string;
      order_index?: number;
      color?: string;
      win_probability?: number;
      is_won?: boolean;
      is_lost?: boolean;
    }
  ) =>
    api.request<PipelineStage>(`/pipelines/stages/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  // Leads
  getLeads: (params: Record<string, string> = {}) => {
    const query = new URLSearchParams(params).toString();
    return api.request<Lead[]>(`/leads/${query ? "?" + query : ""}`);
  },
  getLeadDetail: (id: string) => api.request<Lead>(`/leads/${id}`),
  createLead: (data: any) =>
    api.request<Lead>("/leads/", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updateLeadStage: (id: string, stage_id: string, reason?: string) =>
    api.request<Lead>(`/leads/${id}/stage`, {
      method: "POST",
      body: JSON.stringify({ stage_id, reason }),
    }),
  assignLead: (id: string, owner_id: string) =>
    api.request<Lead>(`/leads/${id}/assign`, {
      method: "POST",
      body: JSON.stringify({ owner_id }),
    }),
  getLeadTimeline: (id: string) => api.request<Activity[]>(`/leads/${id}/timeline`),
  getLeadStageHistory: (id: string) => api.request<any[]>(`/leads/${id}/stage-history`),
  triggerLeadAction: (id: string, action_type: string) =>
    api.request<{
      status: string;
      action_type: string;
      lead_id: string;
      gmail_url?: string;
      whatsapp_url?: string;
      tel_url?: string;
      recipient_email?: string;
      recipient_phone?: string;
      message?: string;
    }>(`/leads/${id}/action/${action_type}`, {
      method: "POST",
    }),

  // Activities
  logActivity: (data: any) =>
    api.request<Activity>("/activities/", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  getActivities: () => api.request<Activity[]>("/activities/"),

  // Tasks
  getTasks: (params: Record<string, string> = {}) => {
    const query = new URLSearchParams(params).toString();
    return api.request<Task[]>(`/tasks/${query ? "?" + query : ""}`);
  },
  createTask: (data: any) =>
    api.request<Task>("/tasks/", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  completeTask: (id: string) =>
    api.request<Task>(`/tasks/${id}/complete`, { method: "POST" }),
  rescheduleTask: (id: string, new_due_at: string, reason?: string) =>
    api.request<Task>(`/tasks/${id}/reschedule`, {
      method: "POST",
      body: JSON.stringify({ new_due_at, reason }),
    }),

  // Companies & Contacts
  getCompanies: () => api.request<any[]>("/companies/"),
  getContacts: () => api.request<any[]>("/contacts/"),

  // Imports
  uploadImportFile: async (file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    const token = localStorage.getItem("jarvis_token");
    const res = await fetch(`${API_BASE}/imports/upload`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: formData,
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || "Upload failed");
    }
    return res.json();
  },
  executeImport: (data: any) =>
    api.request<ImportJob>("/imports/execute", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  getImportJobs: () => api.request<ImportJob[]>("/imports/jobs"),
  getImportJob: (id: string) => api.request<ImportJob>(`/imports/jobs/${id}`),
  getImportErrors: (id: string) => api.request<any[]>(`/imports/jobs/${id}/errors`),

  // Global Registry (Company Intelligence)
  getGlobalCompanies: (search?: string, city?: string) => {
    const params = new URLSearchParams();
    if (search) params.append("search", search);
    if (city) params.append("city", city);
    return api.request<GlobalCompany[]>(`/global/companies?${params.toString()}`);
  },
  pullGlobalCompanies: (global_company_ids: string[], target_organization_id?: string) =>
    api.request<any>("/global/pull", {
      method: "POST",
      body: JSON.stringify({ global_company_ids, target_organization_id }),
    }),
  createGlobalCompany: (data: GlobalCompanyCreatePayload) =>
    api.request<GlobalCompany>("/global/companies", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  // Global People Intelligence
  getGlobalPeople: (params: { search?: string; department?: string; seniority?: string; city?: string } = {}) => {
    const query = new URLSearchParams();
    if (params.search) query.append("search", params.search);
    if (params.department && params.department !== "ALL") query.append("department", params.department);
    if (params.seniority && params.seniority !== "ALL") query.append("seniority", params.seniority);
    if (params.city) query.append("city", params.city);
    const qs = query.toString();
    return api.request<GlobalPerson[]>(`/global/people/${qs ? "?" + qs : ""}`);
  },
  createGlobalPerson: (data: Partial<GlobalPerson>) =>
    api.request<GlobalPerson>("/global/people/", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  pullGlobalPeople: (data: {
    global_people_ids: string[];
    target_organization_id?: string;
    target_stage_id?: string;
    target_owner_id?: string;
  }) =>
    api.request<any>("/global/people/pull", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  // Global Intelligence Graph & Unified View
  getGlobalIntelligence: (params: {
    search?: string;
    filter_type?: string;
    city?: string;
    industry?: string;
    skip?: number;
    limit?: number;
  } = {}) => {
    const query = new URLSearchParams();
    if (params.search) query.append("search", params.search);
    if (params.filter_type && params.filter_type !== "ALL") query.append("filter_type", params.filter_type);
    if (params.city) query.append("city", params.city);
    if (params.industry) query.append("industry", params.industry);
    if (params.skip !== undefined) query.append("skip", params.skip.toString());
    if (params.limit !== undefined) query.append("limit", params.limit.toString());
    const qs = query.toString();
    return api.request<GlobalIntelligenceResponse>(`/global/intelligence${qs ? "?" + qs : ""}`);
  },

  // Radar & Audit
  getRadarOverview: () => api.request<RadarOverview>("/radar/overview"),
  getAuditLogs: () => api.request<any[]>("/radar/audit-logs"),

  // AI Copilot
  scoreLeadAI: (id: string) => api.request<any>(`/ai/leads/${id}/score`, { method: "POST" }),
  summarizeLeadAI: (id: string) => api.request<any>(`/ai/leads/${id}/summary`),
  recommendNextActionAI: (id: string) => api.request<any>(`/ai/leads/${id}/recommendation`),

  // Users
  getUsers: () => api.request<any[]>("/users/"),
  createUser: (data: any) =>
    api.request<any>("/users/", {
      method: "POST",
      body: JSON.stringify(data),
    }),
};
