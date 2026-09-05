import api from "../api";

export type ResolutionStatus = "DRAFT" | "SENT" | "EDITED_SENT" | "REJECTED" | string;

export type ResolutionStep = {
  order: number;
  instruction: string;
  sources: string[];
  requires_approval: boolean;
};

export type ResolutionCitation = {
  article_id: string | null;
  article_title: string | null;
  section: string;
  chunk_index: number | null;
  snippet: string;
  step_order: number | null;
  source: string | null;
};

export type ResolutionResponse = {
  id: string;
  ticket_id: string;
  status: ResolutionStatus;
  sufficient_context: boolean;
  summary: string;
  steps: ResolutionStep[];
  sources: string[];
  citations: ResolutionCitation[];
  escalation_recommended: boolean;
  escalation_reason: string | null;
  confidence: number | null;
  confidence_parts: Record<string, number>;
  steps_dropped: number;
  reject_reason: string | null;
};

export type ResolutionFeedbackBody = {
  was_helpful: boolean;
  comment?: string;
  resolved_ticket?: boolean;
};

const normalizeStep = (raw: unknown): ResolutionStep => {
  const step = (raw ?? {}) as Record<string, unknown>;

  return {
    order: Number(step.order) || 0,
    instruction: typeof step.instruction === "string" ? step.instruction : "",
    sources: Array.isArray(step.sources)
      ? step.sources.filter((source): source is string => typeof source === "string")
      : [],
    requires_approval: Boolean(step.requires_approval),
  };
};

const normalizeCitation = (raw: unknown): ResolutionCitation => {
  const citation = (raw ?? {}) as Record<string, unknown>;

  return {
    article_id: typeof citation.article_id === "string" ? citation.article_id : null,
    article_title: typeof citation.article_title === "string" ? citation.article_title : null,
    section: typeof citation.section === "string" ? citation.section : "",
    chunk_index: typeof citation.chunk_index === "number" ? citation.chunk_index : null,
    snippet: typeof citation.snippet === "string" ? citation.snippet : "",
    step_order: typeof citation.step_order === "number" ? citation.step_order : null,
    source: typeof citation.source === "string" ? citation.source : null,
  };
};

const normalizeResponse = (raw: unknown): ResolutionResponse => {
  const response = (raw ?? {}) as Record<string, unknown>;

  return {
    id: typeof response.id === "string" ? response.id : "",
    ticket_id: typeof response.ticket_id === "string" ? response.ticket_id : "",
    status: typeof response.status === "string" ? response.status : "DRAFT",
    sufficient_context: Boolean(response.sufficient_context),
    summary: typeof response.summary === "string" ? response.summary : "",
    steps: Array.isArray(response.steps) ? response.steps.map(normalizeStep) : [],
    sources: Array.isArray(response.sources)
      ? response.sources.filter((source): source is string => typeof source === "string")
      : [],
    citations: Array.isArray(response.citations)
      ? response.citations.map(normalizeCitation)
      : [],
    escalation_recommended: Boolean(response.escalation_recommended),
    escalation_reason:
      typeof response.escalation_reason === "string" ? response.escalation_reason : null,
    confidence: typeof response.confidence === "number" ? response.confidence : null,
    confidence_parts:
      response.confidence_parts && typeof response.confidence_parts === "object"
        ? (response.confidence_parts as Record<string, number>)
        : {},
    steps_dropped: typeof response.steps_dropped === "number" ? response.steps_dropped : 0,
    reject_reason: typeof response.reject_reason === "string" ? response.reject_reason : null,
  };
};

export const getTicketResponses = async (
  ticketId: string,
): Promise<ResolutionResponse[]> => {
  const response = await api.get(`/api/tickets/${ticketId}/responses/`);
  const responses = response.data?.responses;

  if (!Array.isArray(responses)) {
    throw new Error("Ticket responses response did not contain a response array.");
  }

  return responses.map(normalizeResponse);
};

export const getResolutionResponse = async (
  responseId: string,
): Promise<ResolutionResponse> => {
  const response = await api.get(`/api/tickets/responses/${responseId}/`);
  return normalizeResponse(response.data);
};

export const generateResolution = async (
  ticketId: string,
): Promise<ResolutionResponse> => {
  const response = await api.post(`/api/tickets/${ticketId}/generate-resolution/`);
  const responseId = response.data?.response?.id;

  if (typeof responseId !== "string" || !responseId) {
    throw new Error("Resolution generation did not return a response ID.");
  }

  return getResolutionResponse(responseId);
};

export const acceptResolution = async (
  responseId: string,
): Promise<ResolutionResponse> => {
  await api.post(`/api/tickets/responses/${responseId}/accept/`);
  return getResolutionResponse(responseId);
};

export const editAndSendResolution = async (
  responseId: string,
  summary: string,
  steps: ResolutionStep[],
): Promise<ResolutionResponse> => {
  await api.post(`/api/tickets/responses/${responseId}/edit-send/`, {
    summary,
    steps,
  });
  return getResolutionResponse(responseId);
};

export const rejectResolution = async (
  responseId: string,
  reason: string,
): Promise<ResolutionResponse> => {
  await api.post(`/api/tickets/responses/${responseId}/reject/`, { reason });
  return getResolutionResponse(responseId);
};

export const submitResolutionFeedback = async (
  responseId: string,
  body: ResolutionFeedbackBody,
): Promise<void> => {
  await api.post(`/api/tickets/responses/${responseId}/feedback/`, body);
};

export const sendManualResolution = async (
  ticketId: string,
  summary: string,
): Promise<ResolutionResponse> => {
  const response = await api.post(`/api/tickets/${ticketId}/manual-resolution/`, {
    summary,
  });
  const responseId = response.data?.response_id || response.data?.response?.id;

  if (typeof responseId !== "string" || !responseId) {
    throw new Error("Manual resolution did not return a response ID.");
  }

  return getResolutionResponse(responseId);
};

