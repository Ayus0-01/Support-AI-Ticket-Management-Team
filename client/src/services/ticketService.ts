import api from "../api";

export type CreateTicketBody = {
  subject: string;
  category: string;
  description: string;
  department: string;
  site: string;
  asset_tag: string;
  preferred_contact: string;
  affected_system?: string;
  affected_scope?: string;
  work_blocked?: string;
  urgent_feeling?: string;
  workaround_available?: boolean;
  channel?: string;
};

export type PriorityValue =
  | string
  | {
      value?: string | null;
      reason?: string | null;
    }
  | null;

export type TicketSLA = {
  priority: string;
  first_response_due?: string;
  resolution_due?: string;
};

export type Ticket = {
  ticket_id: string;
  requester?: {
    username: string;
    email: string;
  };
  subject: string;
  category: string | null;
  description: string;
  department?: string;
  site?: string;
  asset_tag?: string;
  preferred_contact?: string;
  affected_system?: string;
  status: string;
  priority: string | null;
  priority_reason?: string | null;
  severity: string | null;
  subcategory: string | null;
  confidence?: number | null;
  path?: string | null;
  sla: TicketSLA | null;
  assignee: string | null;
  queue?: string | null;
  classification?: Record<string, any> | null;
  resolution?: { summary?: string; resolved_at?: string } | null;
  affected_scope?: string;
  work_blocked?: string;
  urgent_feeling?: string;
  workaround_available?: boolean;
  channel?: string;
  created_at: string;
  updated_at: string;
};

const normalizePriority = (priority: PriorityValue): { value: string | null; reason: string | null } => {
  if (priority && typeof priority === "object") {
    return {
      value: priority.value ?? null,
      reason: priority.reason ?? null,
    };
  }

  return {
    value: typeof priority === "string" ? priority : null,
    reason: null,
  };
};

const normalizeTicket = (rawTicket: any): Ticket => {
  const normalizedPriority = normalizePriority(rawTicket?.priority);
  const rawSla = rawTicket?.sla;

  const normalizedSla: TicketSLA | null = rawSla
    ? {
        priority:
          typeof rawSla.priority === "object"
            ? rawSla.priority?.value ?? ""
            : rawSla.priority ?? "",
        first_response_due: rawSla.first_response_due,
        resolution_due: rawSla.resolution_due,
      }
    : null;

  return {
    ...rawTicket,
    priority: normalizedPriority.value,
    priority_reason: normalizedPriority.reason,
    sla: normalizedSla,
  };
};

const normalizeTickets = (tickets: any[]): Ticket[] =>
  tickets.map(normalizeTicket);

export const createTicket = async (body: CreateTicketBody) => {
  const response = await api.post("/api/tickets/", body);

  if (response.data?.ticket) {
    return {
      ...response.data,
      ticket: normalizeTicket(response.data.ticket),
    };
  }

  return response.data;
};

export const getMyTickets = async (): Promise<Ticket[]> => {
  const response = await api.get("/api/tickets/my/");
  const tickets =
    response.data?.tickets ??
    response.data?.ticket ??
    response.data;

  if (!Array.isArray(tickets)) {
    throw new Error(
      "My tickets response did not contain a ticket array."
    );
  }

  return normalizeTickets(tickets);
};

export const getTicketDetails = async (ticketId: string): Promise<Ticket> => {
  const response = await api.get(`/api/tickets/${ticketId}/`);

  if (!response.data?.ticket) {
    throw new Error("Ticket detail response did not contain a ticket.");
  }

  return normalizeTicket(response.data.ticket);
};

export const getAgentQueue = async (): Promise<Ticket[]> => {
  try {
    const response = await api.get("/api/tickets/queue/");
    const tickets =
      response.data?.tickets ??
      response.data?.ticket ??
      response.data;

    if (!Array.isArray(tickets)) {
      throw new Error(
        "Agent queue response did not contain a ticket array."
      );
    }

    return normalizeTickets(tickets);
  } catch (error: any) {
    const backendMessage =
      error?.response?.data?.detail ||
      error?.response?.data?.message ||
      error?.response?.data?.error;

    throw new Error(
      backendMessage ||
      error?.message ||
      "Could not load the agent queue."
    );
  }
};

export const getTicketCategories = async (): Promise<string[]> => {
  const response = await api.get("/api/tickets/taxonomy/");
  const categories = response.data?.categories;

  if (!Array.isArray(categories) || !categories.every((category) => typeof category === "string")) {
    throw new Error("Ticket taxonomy response did not contain a category list.");
  }

  return categories;
};

export type ClassificationOverrideBody = {
  category?: string;
  severity?: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
};

export type StatusTransitionBody = {
  status: "Open" | "In Progress" | "Resolved";
  resolution_summary?: string;
};

export type TicketCommentBody = {
  comment: string;
  visibility: "PUBLIC" | "INTERNAL";
};

export type TimelineEvent = {
  event_type: "STATUS_CHANGE" | "COMMENT" | string;
  ticket_id: string;
  from_status?: string | null;
  to_status?: string | null;
  changed_by?: string | null;
  author_user_id?: string | null;
  comment?: string;
  visibility?: "PUBLIC" | "INTERNAL" | string;
  created_at: string;
};

export type DuplicateCandidate = {
  ticket_id: string;
  subject?: string;
  status?: string;
  created_at?: string;
  embedding_score?: number;
  token_overlap_score?: number;
  score?: number;
};

export type ClassificationPreview = {
  category?: {
    category?: string;
    value?: string;
    confidence: number;
    route?: string;
  };
  subcategory?: {
    subcategory?: string;
    value?: string;
    confidence: number;
    route?: string;
  };
};

export const checkDuplicateTickets = async (
  subject: string,
  description: string
): Promise<DuplicateCandidate[]> => {
  const response = await api.post("/api/tickets/check-duplicates/", {
    subject,
    description,
  });
  return response.data?.duplicates || [];
};

export const previewClassification = async (
  subject: string,
  description: string
): Promise<ClassificationPreview | null> => {
  const response = await api.post("/api/tickets/preview-classify/", {
    subject,
    description,
  });
  return response.data || null;
};


export const overrideClassification = async (
  ticketId: string,
  body: ClassificationOverrideBody
) => {
  const response = await api.patch(
    `/api/tickets/classifications/${ticketId}/`,
    body
  );
  return response.data;
};

export const transitionTicketStatus = async (
  ticketId: string,
  body: StatusTransitionBody
) => {
  const response = await api.patch(
    `/api/tickets/${ticketId}/status/`,
    body
  );
  return response.data;
};

export const addTicketComment = async (
  ticketId: string,
  body: TicketCommentBody
) => {
  const response = await api.post(
    `/api/tickets/${ticketId}/comments/`,
    body
  );
  return response.data;
};

export const getTicketTimeline = async (
  ticketId: string
): Promise<TimelineEvent[]> => {
  const response = await api.get(
    `/api/tickets/${ticketId}/timeline/`
  );
  return Array.isArray(response.data?.timeline)
    ? response.data.timeline
    : [];
};
