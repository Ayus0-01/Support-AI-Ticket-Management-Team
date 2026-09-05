import api from "../api";

export type M3WorkflowDiagnosis = {
  problem_understanding?: string;
  affected_system?: string;
  likely_causes?: string[];
  missing_information?: string[];
};

export type M3WorkflowEvidence = {
  article_id: string;
  chunk_index: number;
  article_title: string;
  content: string;
};

export type M3WorkflowResolution = {
  summary?: string;
  troubleshooting_steps?: string[];
  missing_information?: string[];
  limitations?: string[];
};

export type M3WorkflowValidation = {
  is_valid?: boolean;
  reasons?: string[];
  blocking_limitations?: string[];
  confidence_score?: number;
};

export type M3WorkflowEscalation = {
  escalation_required?: boolean;
  reason?: string;
  recommended_action?: string;
  jira_result?: {
    status?: string;
    jira_issue_key?: string;
    jira_issue_url?: string;
    reason?: string;
  };
  email_result?: {
    status?: string;
    sent?: boolean;
    recipient?: string;
    reason?: string;
  };
};

export type M3WorkflowData = {
  workflow_id: string;
  ticket_id: string;
  workflow_status: "IN_PROGRESS" | "COMPLETED" | "ESCALATED" | string;
  current_agent?: string;
  final_confidence?: number;
  diagnosis?: M3WorkflowDiagnosis | null;
  retrieved_evidence?: M3WorkflowEvidence[];
  resolution?: M3WorkflowResolution | null;
  validation?: M3WorkflowValidation | null;
  escalation?: M3WorkflowEscalation | null;
  started_at?: string;
  completed_at?: string | null;
};

export type M3ActivityLog = {
  log_id: string;
  workflow_id?: string;
  ticket_id: string;
  agent_name?: string;
  stage?: string;
  action: string;
  status: string;
  details: string;
  actor: string;
  metadata?: Record<string, unknown>;
  timestamp: string;
};

export const executeM3Workflow = async (ticketId: string): Promise<M3WorkflowData> => {
  const response = await api.post(`/api/agents/tickets/${ticketId}/execute/`);
  return response.data?.workflow;
};

export const getM3WorkflowStatus = async (
  ticketId: string
): Promise<{ workflow: M3WorkflowData; executions: Record<string, unknown>[] } | null> => {
  try {
    const response = await api.get(`/api/agents/tickets/${ticketId}/workflow/`);
    return response.data;
  } catch (error: unknown) {
    const err = error as { response?: { status?: number } };
    if (err?.response?.status === 404) {
      return null;
    }
    throw error;
  }
};

export const getM3ActivityLogs = async (ticketId: string): Promise<M3ActivityLog[]> => {
  const response = await api.get(`/api/agents/tickets/${ticketId}/activity-logs/`);
  return response.data?.activity_logs || [];
};
