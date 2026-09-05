import React, { useState, useEffect } from "react";
import {
  Bot,
  Play,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  FileText,
  ShieldAlert,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Mail,
  Loader2,
  Activity,
  Layers,
  Search,
  Zap,
  ArrowRight,
  ShieldCheck,
} from "lucide-react";
import {
  executeM3Workflow,
  getM3WorkflowStatus,
  getM3ActivityLogs,
  M3WorkflowData,
  M3ActivityLog,
} from "../../services/m3Service";

interface M3WorkflowPanelProps {
  ticketId: string;
  isDark?: boolean;
}

export const M3WorkflowPanel: React.FC<M3WorkflowPanelProps> = ({
  ticketId,
  isDark = false,
}) => {
  const [workflow, setWorkflow] = useState<M3WorkflowData | null>(null);
  const [activityLogs, setActivityLogs] = useState<M3ActivityLog[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [initialLoading, setInitialLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [showLogs, setShowLogs] = useState<boolean>(false);
  const [loadingLogs, setLoadingLogs] = useState<boolean>(false);

  // Fetch existing workflow status on mount or ticketId change
  useEffect(() => {
    let isMounted = true;
    const fetchExistingStatus = async () => {
      try {
        setInitialLoading(true);
        setError(null);
        const res = await getM3WorkflowStatus(ticketId);
        if (isMounted && res) {
          setWorkflow(res.workflow);
        }
      } catch (err: unknown) {
        console.error("Failed to fetch M3 workflow status:", err);
      } finally {
        if (isMounted) {
          setInitialLoading(false);
        }
      }
    };

    fetchExistingStatus();
    return () => {
      isMounted = false;
    };
  }, [ticketId]);

  const handleRunWorkflow = async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await executeM3Workflow(ticketId);
      setWorkflow(result);
      
      if (showLogs) {
        const logs = await getM3ActivityLogs(ticketId);
        setActivityLogs(logs);
      }
    } catch (err: unknown) {
      console.error("M3 Workflow execution failed:", err);
      const errorObj = err as {
        response?: { data?: { message?: string; detail?: string } };
        message?: string;
      };
      const msg =
        errorObj?.response?.data?.message ||
        errorObj?.response?.data?.detail ||
        errorObj?.message ||
        "M3 Multi-Agent workflow execution failed.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const toggleLogs = async () => {
    if (!showLogs && activityLogs.length === 0) {
      try {
        setLoadingLogs(true);
        const logs = await getM3ActivityLogs(ticketId);
        setActivityLogs(logs);
      } catch (err) {
        console.error("Failed to load activity logs:", err);
      } finally {
        setLoadingLogs(false);
      }
    }
    setShowLogs(!showLogs);
  };

  const getStatusBadge = (status?: string) => {
    switch (status) {
      case "COMPLETED":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
            <CheckCircle2 className="h-3.5 w-3.5" /> Auto-Resolution Approved
          </span>
        );
      case "ESCALATED":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-600 dark:text-amber-400 border border-amber-500/20">
            <AlertTriangle className="h-3.5 w-3.5" /> Escalated to Support
          </span>
        );
      case "IN_PROGRESS":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-500/10 px-3 py-1 text-xs font-semibold text-blue-600 dark:text-blue-400 border border-blue-500/20">
            <Clock className="h-3.5 w-3.5 animate-spin" /> In Progress
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-500/10 px-3 py-1 text-xs font-semibold text-gray-600 dark:text-gray-400 border border-gray-500/20">
            {status || "Ready"}
          </span>
        );
    }
  };

  // Derive real stage states from workflow payload
  const diagDone = Boolean(workflow?.diagnosis);
  const retDone = Boolean(workflow?.retrieved_evidence && workflow.retrieved_evidence.length > 0);
  const resDone = Boolean(workflow?.resolution);
  const valDone = Boolean(workflow?.validation);
  const valPassed = Boolean(workflow?.validation?.is_valid);
  const isEscalated = workflow?.workflow_status === "ESCALATED";
  const isCompleted = workflow?.workflow_status === "COMPLETED";

  if (initialLoading) {
    return (
      <div
        className={`rounded-3xl border p-5 ${
          isDark ? "border-gray-800 bg-gray-950 text-white" : "border-gray-200 bg-white text-gray-900"
        }`}
      >
        <div className="flex items-center gap-3 text-sm text-gray-500">
          <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
          <span>Checking M3 workflow state...</span>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`rounded-3xl border p-5 transition-all ${
        isDark ? "border-gray-800 bg-gray-950 text-white" : "border-gray-200 bg-white text-gray-900"
      }`}
    >
      {/* Panel Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b pb-4 dark:border-gray-800">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-600/10 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400">
            <Bot className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-base">M3 Multi-Agent Engine</h3>
              {workflow && getStatusBadge(workflow.workflow_status)}
            </div>
            <p className={`text-xs ${isDark ? "text-gray-400" : "text-gray-500"}`}>
              Autonomous Multi-Agent Pipeline with Confidence & Validation Gating
            </p>
          </div>
        </div>

        <button
          onClick={handleRunWorkflow}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-2xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:opacity-50 dark:bg-blue-600 dark:hover:bg-blue-500"
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Executing Agents...</span>
            </>
          ) : (
            <>
              <Play className="h-4 w-4 fill-current" />
              <span>{workflow ? "Re-Run AI Workflow" : "Run AI Workflow"}</span>
            </>
          )}
        </button>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="mt-4 rounded-2xl bg-red-500/10 border border-red-500/20 p-4 text-xs text-red-600 dark:text-red-400">
          <p className="font-semibold">Workflow Error:</p>
          <p className="mt-1">{error}</p>
        </div>
      )}

      {/* Loading Progress State */}
      {loading && (
        <div className="mt-6 rounded-2xl border border-blue-500/20 bg-blue-500/5 p-6 text-center">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-blue-600 dark:text-blue-400" />
          <p className="mt-3 font-semibold text-sm">Executing Multi-Agent Pipeline</p>
          <p className="mt-1 text-xs text-gray-500">
            DiagnosisAgent → KnowledgeRetrievalAgent → ResolutionAgent → ValidationAgent
          </p>
        </div>
      )}

      {/* VISUAL M3 AGENT PIPELINE FLOW DIAGRAM */}
      {workflow && !loading && (
        <div className="mt-6 rounded-2xl border p-5 bg-slate-50/50 dark:bg-gray-900/50 dark:border-gray-800">
          <p className="text-xs uppercase tracking-[0.2em] font-semibold text-slate-500 mb-4">
            M3 Agent Workflow Pipeline Architecture
          </p>
          
          <div className="grid gap-3 md:grid-cols-5 items-stretch relative">
            {/* Stage 1: Diagnosis */}
            <div
              className={`rounded-2xl border p-3 flex flex-col justify-between transition-all ${
                diagDone
                  ? isDark
                    ? "border-blue-500/40 bg-blue-950/20 text-white"
                    : "border-blue-500/30 bg-blue-50 text-gray-900"
                  : isDark
                  ? "border-gray-800 bg-gray-950 text-gray-500"
                  : "border-gray-200 bg-white text-gray-400"
              }`}
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">
                    Stage 1
                  </span>
                  {diagDone ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  ) : (
                    <Clock className="h-4 w-4 text-gray-400" />
                  )}
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <Layers className="h-4 w-4 shrink-0 text-blue-500" />
                  <span className="font-semibold text-xs leading-tight">Diagnosis Agent</span>
                </div>
              </div>
              <div className="mt-3 pt-2 border-t text-[11px] dark:border-gray-800">
                <p className="font-medium truncate">
                  {diagDone ? workflow.diagnosis?.affected_system || "Diagnosed" : "Pending"}
                </p>
                <p className="text-[10px] text-gray-400">
                  {diagDone ? "Technical context set" : "Awaiting run"}
                </p>
              </div>
            </div>

            {/* Flow Arrow 1-2 */}
            <div className="hidden md:flex items-center justify-center -mx-2 text-gray-300 dark:text-gray-700 pointer-events-none absolute left-[19.5%] top-1/2 -translate-y-1/2 z-10">
              <ArrowRight className="h-4 w-4 text-blue-500/60" />
            </div>

            {/* Stage 2: Knowledge Retrieval */}
            <div
              className={`rounded-2xl border p-3 flex flex-col justify-between transition-all ${
                retDone
                  ? isDark
                    ? "border-emerald-500/40 bg-emerald-950/20 text-white"
                    : "border-emerald-500/30 bg-emerald-50 text-gray-900"
                  : isDark
                  ? "border-gray-800 bg-gray-950 text-gray-500"
                  : "border-gray-200 bg-white text-gray-400"
              }`}
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                    Stage 2
                  </span>
                  {retDone ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  ) : (
                    <Clock className="h-4 w-4 text-gray-400" />
                  )}
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <Search className="h-4 w-4 shrink-0 text-emerald-500" />
                  <span className="font-semibold text-xs leading-tight">Retrieval Agent</span>
                </div>
              </div>
              <div className="mt-3 pt-2 border-t text-[11px] dark:border-gray-800">
                <p className="font-medium truncate">
                  {retDone ? `${workflow.retrieved_evidence?.length} Articles` : "Pending"}
                </p>
                <p className="text-[10px] text-gray-400">
                  {retDone ? "RAG evidence fetched" : "Awaiting run"}
                </p>
              </div>
            </div>

            {/* Stage 3: Resolution */}
            <div
              className={`rounded-2xl border p-3 flex flex-col justify-between transition-all ${
                resDone
                  ? isDark
                    ? "border-purple-500/40 bg-purple-950/20 text-white"
                    : "border-purple-500/30 bg-purple-50 text-gray-900"
                  : isDark
                  ? "border-gray-800 bg-gray-950 text-gray-500"
                  : "border-gray-200 bg-white text-gray-400"
              }`}
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400">
                    Stage 3
                  </span>
                  {resDone ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  ) : (
                    <Clock className="h-4 w-4 text-gray-400" />
                  )}
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <FileText className="h-4 w-4 shrink-0 text-purple-500" />
                  <span className="font-semibold text-xs leading-tight">Resolution Agent</span>
                </div>
              </div>
              <div className="mt-3 pt-2 border-t text-[11px] dark:border-gray-800">
                <p className="font-medium truncate">
                  {resDone ? "Resolution Formulated" : "Pending"}
                </p>
                <p className="text-[10px] text-gray-400">
                  {resDone ? "Steps & citations ready" : "Awaiting run"}
                </p>
              </div>
            </div>

            {/* Stage 4: Validation Gate */}
            <div
              className={`rounded-2xl border p-3 flex flex-col justify-between transition-all ${
                valDone
                  ? valPassed
                    ? isDark
                      ? "border-emerald-500/50 bg-emerald-950/30 text-white"
                      : "border-emerald-500/40 bg-emerald-50 text-gray-900"
                    : isDark
                    ? "border-red-500/40 bg-red-950/20 text-white"
                    : "border-red-500/30 bg-red-50 text-gray-900"
                  : isDark
                  ? "border-gray-800 bg-gray-950 text-gray-500"
                  : "border-gray-200 bg-white text-gray-400"
              }`}
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                    Stage 4
                  </span>
                  {valDone ? (
                    valPassed ? (
                      <ShieldCheck className="h-4 w-4 text-emerald-500" />
                    ) : (
                      <XCircle className="h-4 w-4 text-red-500" />
                    )
                  ) : (
                    <Clock className="h-4 w-4 text-gray-400" />
                  )}
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <ShieldAlert className="h-4 w-4 shrink-0 text-amber-500" />
                  <span className="font-semibold text-xs leading-tight">Validation Gate</span>
                </div>
              </div>
              <div className="mt-3 pt-2 border-t text-[11px] dark:border-gray-800">
                <p className="font-medium truncate">
                  {valDone
                    ? valPassed
                      ? "PASSED (Valid)"
                      : "REJECTED (Low Conf)"
                    : "Pending"}
                </p>
                <p className="text-[10px] text-gray-400">
                  {workflow.final_confidence !== undefined
                    ? `Conf: ${Math.round((workflow.final_confidence || 0) * 100)}%`
                    : "Threshold: 70%"}
                </p>
              </div>
            </div>

            {/* Stage 5: Final Decision (Auto-Resolve OR Escalation) */}
            <div
              className={`rounded-2xl border p-3 flex flex-col justify-between transition-all ${
                isCompleted
                  ? isDark
                    ? "border-emerald-500/60 bg-emerald-950/40 text-white shadow-emerald-500/10 shadow-lg"
                    : "border-emerald-500/50 bg-emerald-100/50 text-gray-900 shadow-md"
                  : isEscalated
                  ? isDark
                    ? "border-amber-500/60 bg-amber-950/30 text-white shadow-amber-500/10 shadow-lg"
                    : "border-amber-500/50 bg-amber-100/50 text-gray-900 shadow-md"
                  : isDark
                  ? "border-gray-800 bg-gray-950 text-gray-500"
                  : "border-gray-200 bg-white text-gray-400"
              }`}
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider">
                    Stage 5
                  </span>
                  {isCompleted ? (
                    <Zap className="h-4 w-4 text-emerald-500 fill-current" />
                  ) : isEscalated ? (
                    <AlertTriangle className="h-4 w-4 text-amber-500" />
                  ) : (
                    <Clock className="h-4 w-4 text-gray-400" />
                  )}
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <Bot className="h-4 w-4 shrink-0 text-blue-500" />
                  <span className="font-semibold text-xs leading-tight">
                    {isCompleted
                      ? "Auto-Resolution"
                      : isEscalated
                      ? "Support Escalation"
                      : "Final Decision"}
                  </span>
                </div>
              </div>
              <div className="mt-3 pt-2 border-t text-[11px] dark:border-gray-800">
                <p className="font-bold truncate">
                  {isCompleted
                    ? "APPROVED"
                    : isEscalated
                    ? "ESCALATED"
                    : "Awaiting Gate"}
                </p>
                <p className="text-[10px] text-gray-400 truncate">
                  {isCompleted
                    ? "High confidence auto-close"
                    : isEscalated
                    ? workflow.escalation?.jira_result?.jira_issue_key
                      ? `Jira: ${workflow.escalation.jira_result.jira_issue_key}`
                      : "Jira / Email Notified"
                    : "N/A"}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Detailed Technical Breakdown Cards */}
      {!loading && workflow && (
        <div className="mt-6 space-y-6">
          {/* Metadata Summary Cards */}
          <div className="grid gap-3 sm:grid-cols-3">
            <div className={`rounded-2xl border p-4 ${isDark ? "border-gray-800 bg-gray-900" : "border-gray-100 bg-slate-50"}`}>
              <p className="text-xs text-slate-500 uppercase font-semibold">Workflow ID</p>
              <p className="mt-1 font-mono text-sm font-bold text-blue-600 dark:text-blue-400">{workflow.workflow_id}</p>
            </div>
            <div className={`rounded-2xl border p-4 ${isDark ? "border-gray-800 bg-gray-900" : "border-gray-100 bg-slate-50"}`}>
              <p className="text-xs text-slate-500 uppercase font-semibold">Composite Confidence</p>
              <p className="mt-1 text-lg font-bold text-emerald-600 dark:text-emerald-400">
                {workflow.final_confidence !== undefined
                  ? `${Math.round((workflow.final_confidence || 0) * 100)}%`
                  : "N/A"}
              </p>
            </div>
            <div className={`rounded-2xl border p-4 ${isDark ? "border-gray-800 bg-gray-900" : "border-gray-100 bg-slate-50"}`}>
              <p className="text-xs text-slate-500 uppercase font-semibold">Evidence Chunks</p>
              <p className="mt-1 text-lg font-bold">
                {workflow.retrieved_evidence ? workflow.retrieved_evidence.length : 0} articles
              </p>
            </div>
          </div>

          {/* Diagnosis Section */}
          {workflow.diagnosis && (
            <div className={`rounded-2xl border p-5 ${isDark ? "border-gray-800 bg-gray-900" : "border-gray-200 bg-white"}`}>
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
                <Layers className="h-4 w-4 text-blue-500" />
                <span>1. Technical Diagnosis</span>
              </div>
              <div className="mt-3 space-y-3 text-sm">
                <div>
                  <span className="text-xs font-semibold text-slate-500 uppercase">Problem Understanding:</span>
                  <p className="mt-0.5 font-medium">{workflow.diagnosis.problem_understanding || "N/A"}</p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <span className="text-xs font-semibold text-slate-500 uppercase">Affected System:</span>
                    <p className="mt-0.5 font-medium">{workflow.diagnosis.affected_system || "N/A"}</p>
                  </div>
                  <div>
                    <span className="text-xs font-semibold text-slate-500 uppercase">Likely Causes:</span>
                    <ul className="mt-0.5 list-disc list-inside space-y-1 text-xs">
                      {workflow.diagnosis.likely_causes && workflow.diagnosis.likely_causes.length > 0 ? (
                        workflow.diagnosis.likely_causes.map((cause, i) => <li key={i}>{cause}</li>)
                      ) : (
                        <li>None identified</li>
                      )}
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Retrieved Knowledge Section */}
          {workflow.retrieved_evidence && workflow.retrieved_evidence.length > 0 && (
            <div className={`rounded-2xl border p-5 ${isDark ? "border-gray-800 bg-gray-900" : "border-gray-200 bg-white"}`}>
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
                <Search className="h-4 w-4 text-emerald-500" />
                <span>2. Retrieved Evidence ({workflow.retrieved_evidence.length})</span>
              </div>
              <div className="mt-3 space-y-2 max-h-48 overflow-y-auto pr-1">
                {workflow.retrieved_evidence.map((ev, i) => (
                  <div
                    key={i}
                    className={`rounded-xl border p-3 text-xs ${
                      isDark ? "border-gray-800 bg-gray-950" : "border-gray-200 bg-slate-50"
                    }`}
                  >
                    <div className="flex items-center justify-between font-semibold">
                      <span className="text-blue-600 dark:text-blue-400">
                        [{ev.article_id}#{ev.chunk_index}] {ev.article_title}
                      </span>
                    </div>
                    <p className="mt-1 line-clamp-2 text-gray-600 dark:text-gray-300">{ev.content}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Resolution Section */}
          {workflow.resolution && (
            <div className={`rounded-2xl border p-5 ${isDark ? "border-gray-800 bg-gray-900" : "border-gray-200 bg-white"}`}>
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
                <FileText className="h-4 w-4 text-purple-500" />
                <span>3. Generated Resolution</span>
              </div>
              {workflow.resolution.summary && (
                <div className="mt-3">
                  <p className="text-xs font-semibold text-slate-500 uppercase">Summary:</p>
                  <p className="mt-1 font-medium text-sm leading-relaxed">{workflow.resolution.summary}</p>
                </div>
              )}
              {workflow.resolution.troubleshooting_steps && workflow.resolution.troubleshooting_steps.length > 0 && (
                <div className="mt-3">
                  <p className="text-xs font-semibold text-slate-500 uppercase">Troubleshooting Steps:</p>
                  <ol className="mt-1 list-decimal list-inside space-y-1.5 text-xs">
                    {workflow.resolution.troubleshooting_steps.map((step, i) => (
                      <li key={i} className="leading-normal">{step}</li>
                    ))}
                  </ol>
                </div>
              )}
            </div>
          )}

          {/* Validation Result Section */}
          {workflow.validation && (
            <div className={`rounded-2xl border p-5 ${isDark ? "border-gray-800 bg-gray-900" : "border-gray-200 bg-white"}`}>
              <div className="flex items-center justify-between border-b pb-3 dark:border-gray-800">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
                  <ShieldAlert className="h-4 w-4 text-amber-500" />
                  <span>4. Validation Result</span>
                </div>
                <div>
                  {workflow.validation.is_valid ? (
                    <span className="rounded-full bg-emerald-500/10 px-3 py-0.5 text-xs font-bold text-emerald-600 border border-emerald-500/20">
                      PASSED
                    </span>
                  ) : (
                    <span className="rounded-full bg-red-500/10 px-3 py-0.5 text-xs font-bold text-red-600 border border-red-500/20">
                      REJECTED
                    </span>
                  )}
                </div>
              </div>
              <div className="mt-3 space-y-2 text-xs">
                {workflow.validation.reasons && workflow.validation.reasons.length > 0 && (
                  <div>
                    <span className="font-semibold text-slate-500 uppercase">Validation Findings:</span>
                    <ul className="mt-1 list-disc list-inside space-y-1 text-amber-600 dark:text-amber-400">
                      {workflow.validation.reasons.map((r, i) => <li key={i}>{r}</li>)}
                    </ul>
                  </div>
                )}
                {workflow.validation.blocking_limitations && workflow.validation.blocking_limitations.length > 0 && (
                  <div>
                    <span className="font-semibold text-slate-500 uppercase">Blocking Limitations:</span>
                    <ul className="mt-1 list-disc list-inside space-y-1 text-red-600 dark:text-red-400">
                      {workflow.validation.blocking_limitations.map((b, i) => <li key={i}>{b}</li>)}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Escalation Details (if applicable) */}
          {workflow.escalation && (
            <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-5 text-xs space-y-3">
              <div className="flex items-center gap-2 font-bold text-sm text-amber-700 dark:text-amber-400">
                <ShieldAlert className="h-5 w-5 shrink-0" />
                <span>Escalation Package Formulated</span>
              </div>
              <div>
                <span className="font-semibold uppercase text-slate-500">Escalation Reason:</span>
                <p className="mt-0.5 font-medium">{workflow.escalation.reason || "Validation rejected auto-resolution."}</p>
              </div>
              <div>
                <span className="font-semibold uppercase text-slate-500">Recommended Action:</span>
                <p className="mt-0.5 font-medium">{workflow.escalation.recommended_action || "Assign to support team for manual review"}</p>
              </div>

              {/* Jira & Email integration status */}
              <div className="grid gap-3 pt-2 sm:grid-cols-2">
                {workflow.escalation.jira_result && (
                  <div className={`rounded-xl border p-3 ${isDark ? "border-gray-800 bg-gray-950" : "border-gray-200 bg-white"}`}>
                    <div className="flex items-center justify-between font-semibold">
                      <span className="flex items-center gap-1.5 text-blue-600 dark:text-blue-400">
                        <ExternalLink className="h-3.5 w-3.5" /> Jira Integration
                      </span>
                      <span className="rounded bg-blue-100 dark:bg-blue-900/50 px-2 py-0.5 text-[10px]">
                        {workflow.escalation.jira_result.status}
                      </span>
                    </div>
                    {workflow.escalation.jira_result.jira_issue_key && (
                      <p className="mt-1 font-bold">
                        Key: {workflow.escalation.jira_result.jira_issue_key}
                      </p>
                    )}
                  </div>
                )}

                {workflow.escalation.email_result && (
                  <div className={`rounded-xl border p-3 ${isDark ? "border-gray-800 bg-gray-950" : "border-gray-200 bg-white"}`}>
                    <div className="flex items-center justify-between font-semibold">
                      <span className="flex items-center gap-1.5 text-purple-600 dark:text-purple-400">
                        <Mail className="h-3.5 w-3.5" /> Email Notification
                      </span>
                      <span className="rounded bg-purple-100 dark:bg-purple-900/50 px-2 py-0.5 text-[10px]">
                        {workflow.escalation.email_result.status}
                      </span>
                    </div>
                    {workflow.escalation.email_result.recipient && (
                      <p className="mt-1 text-[11px] text-gray-500">
                        To: {workflow.escalation.email_result.recipient}
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Activity Logs Collapsible Drawer */}
          <div className="border-t pt-4 dark:border-gray-800">
            <button
              onClick={toggleLogs}
              className="flex items-center justify-between w-full text-xs font-semibold text-slate-500 hover:text-slate-700 dark:hover:text-gray-300 transition"
            >
              <span className="flex items-center gap-1.5">
                <Activity className="h-4 w-4 text-blue-500" />
                M3 Activity Logs ({activityLogs.length > 0 ? activityLogs.length : "Click to view"})
              </span>
              {showLogs ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>

            {showLogs && (
              <div className="mt-3 space-y-2">
                {loadingLogs ? (
                  <div className="py-4 text-center text-xs text-gray-500">Loading activity logs...</div>
                ) : activityLogs.length > 0 ? (
                  activityLogs.map((log) => (
                    <div
                      key={log.log_id}
                      className={`rounded-xl border p-3 text-xs ${
                        isDark ? "border-gray-800 bg-gray-900" : "border-gray-200 bg-slate-50"
                      }`}
                    >
                      <div className="flex items-center justify-between font-semibold">
                        <span className="text-blue-600 dark:text-blue-400">{log.action}</span>
                        <span className="text-[10px] text-gray-400">
                          {new Date(log.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                      <p className="mt-1 text-gray-600 dark:text-gray-300">{log.details}</p>
                      <div className="mt-1 flex gap-3 text-[10px] text-gray-400">
                        <span>Actor: {log.actor}</span>
                        {log.stage && <span>Stage: {log.stage}</span>}
                        <span>Status: {log.status}</span>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="py-4 text-center text-xs text-gray-400">No activity logs recorded.</div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
