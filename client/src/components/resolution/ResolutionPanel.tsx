import { useEffect, useState } from "react";
import {
  acceptResolution,
  editAndSendResolution,
  generateResolution,
  getTicketResponses,
  rejectResolution,
  sendManualResolution,
  submitResolutionFeedback,
  type ResolutionResponse,
} from "../../services/resolutionService";
import DestructiveWarning from "./DestructiveWarning";
import EditAndSendDialog from "./EditAndSendDialog";
import StepChecklist from "./StepChecklist";
import SufficiencyBadge from "./SufficiencyBadge";

type ResolutionPanelProps = {
  ticketId: string;
  onResponseChanged?: () => Promise<void> | void;
};

const getErrorMessage = (error: unknown, fallback: string) => {
  if (!error || typeof error !== "object") {
    return fallback;
  }

  const candidate = error as {
    message?: string;
    response?: { data?: { message?: string } };
  };

  return candidate.response?.data?.message || candidate.message || fallback;
};

const statusLabel = (status: string) => {
  switch (status) {
    case "DRAFT":
      return "Draft — not sent";
    case "SENT":
      return "Sent";
    case "EDITED_SENT":
      return "Sent after edit";
    case "REJECTED":
      return "Rejected";
    default:
      return status;
  }
};

const statusClasses = (status: string) => {
  switch (status) {
    case "DRAFT":
      return "bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300";
    case "REJECTED":
      return "bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300";
    default:
      return "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300";
  }
};

export default function ResolutionPanel({
  ticketId,
  onResponseChanged,
}: ResolutionPanelProps) {
  const [responses, setResponses] = useState<ResolutionResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);
  const [error, setError] = useState("");
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [feedbackComment, setFeedbackComment] = useState("");
  const [feedbackMessage, setFeedbackMessage] = useState("");
  const [manualSummary, setManualSummary] = useState("");
  const [manualBusy, setManualBusy] = useState(false);
  const [manualSuccessMessage, setManualSuccessMessage] = useState("");

  const replaceResponse = (updated: ResolutionResponse) => {
    setResponses((current) => [
      updated,
      ...current.filter((response) => response.id !== updated.id),
    ]);
  };

  const notifyResponseChanged = async () => {
    await onResponseChanged?.();
  };

  useEffect(() => {
    let active = true;

    const loadResponses = async () => {
      try {
        setLoading(true);
        setError("");
        const loadedResponses = await getTicketResponses(ticketId);
        if (active) {
          setResponses(loadedResponses);
        }
      } catch (loadError) {
        if (active) {
          setError(getErrorMessage(loadError, "Could not load generated resolutions."));
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    void loadResponses();

    return () => {
      active = false;
    };
  }, [ticketId]);

  const currentResponse = responses[0];
  const canGenerate = !currentResponse || currentResponse.status === "REJECTED";

  const handleGenerate = async () => {
    try {
      setGenerating(true);
      setError("");
      const generated = await generateResolution(ticketId);
      replaceResponse(generated);
      await notifyResponseChanged();
    } catch (generateError) {
      if (
        typeof generateError === "object" &&
        generateError !== null &&
        (generateError as { response?: { status?: number } }).response?.status === 409
      ) {
        try {
          const refreshedResponses = await getTicketResponses(ticketId);
          setResponses(refreshedResponses);
        } catch {
          // Keep the actionable conflict message if the refresh also fails.
        }
      }
      setError(getErrorMessage(generateError, "Could not generate a resolution draft."));
    } finally {
      setGenerating(false);
    }
  };

  const handleAccept = async () => {
    if (!currentResponse) {
      return;
    }

    try {
      setActionBusy(true);
      setError("");
      const accepted = await acceptResolution(currentResponse.id);
      replaceResponse(accepted);
      await notifyResponseChanged();
    } catch (acceptError) {
      setError(getErrorMessage(acceptError, "Could not accept and send this resolution."));
    } finally {
      setActionBusy(false);
    }
  };

  const handleEditAndSend = async (summary: string) => {
    if (!currentResponse) {
      return;
    }

    try {
      setActionBusy(true);
      setError("");
      const sent = await editAndSendResolution(
        currentResponse.id,
        summary,
        currentResponse.steps,
      );
      replaceResponse(sent);
      setShowEditDialog(false);
      await notifyResponseChanged();
    } catch (sendError) {
      setError(getErrorMessage(sendError, "Could not send the edited resolution."));
    } finally {
      setActionBusy(false);
    }
  };

  const handleReject = async () => {
    if (!currentResponse || !rejectReason.trim()) {
      return;
    }

    try {
      setActionBusy(true);
      setError("");
      const rejected = await rejectResolution(currentResponse.id, rejectReason.trim());
      replaceResponse(rejected);
      setRejectReason("");
      setShowRejectForm(false);
      await notifyResponseChanged();
    } catch (rejectError) {
      setError(getErrorMessage(rejectError, "Could not reject this resolution."));
    } finally {
      setActionBusy(false);
    }
  };

  const handleFeedback = async (wasHelpful: boolean) => {
    if (!currentResponse) {
      return;
    }

    try {
      setActionBusy(true);
      setError("");
      setFeedbackMessage("");
      await submitResolutionFeedback(currentResponse.id, {
        was_helpful: wasHelpful,
        comment: feedbackComment.trim() || undefined,
        resolved_ticket: currentResponse.status === "SENT" || currentResponse.status === "EDITED_SENT",
      });
      setFeedbackComment("");
      setFeedbackMessage("Feedback recorded.");
    } catch (feedbackError) {
      setError(getErrorMessage(feedbackError, "Could not submit feedback."));
    } finally {
      setActionBusy(false);
    }
  };

  const handleSendManualResolution = async () => {
    const trimmed = manualSummary.trim();
    if (!trimmed) {
      return;
    }

    try {
      setManualBusy(true);
      setError("");
      setManualSuccessMessage("");
      const sentResponse = await sendManualResolution(ticketId, trimmed);
      replaceResponse(sentResponse);
      setManualSummary("");
      setManualSuccessMessage("Manual resolution sent successfully.");
      await notifyResponseChanged();
    } catch (manualErr) {
      setError(getErrorMessage(manualErr, "Could not send manual resolution."));
    } finally {
      setManualBusy(false);
    }
  };

  return (
    <section className="rounded-3xl border border-indigo-200 bg-indigo-50/30 p-5 dark:border-indigo-900/60 dark:bg-indigo-950/10">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-700 dark:text-indigo-300">AI resolution</p>
          <p className="mt-1 text-sm text-slate-600 dark:text-gray-400">Grounded troubleshooting guidance for agent review. Nothing is sent automatically.</p>
        </div>
        {currentResponse && (
          <span className={`rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide ${statusClasses(currentResponse.status)}`}>
            {statusLabel(currentResponse.status)}
          </span>
        )}
      </div>

      {loading ? (
        <p className="mt-5 text-sm text-slate-500 dark:text-gray-400">Loading resolution history...</p>
      ) : !currentResponse ? (
        <div className="mt-5 rounded-2xl border border-dashed border-indigo-200 bg-white/70 p-4 dark:border-indigo-900/80 dark:bg-gray-950/40">
          <p className="text-sm font-semibold text-slate-800 dark:text-gray-100">No resolution has been generated yet.</p>
          <p className="mt-1 text-sm text-slate-600 dark:text-gray-400">Generate a draft to review its summary, grounded steps, and citations before sending.</p>
        </div>
      ) : (
        <div className="mt-5 space-y-5">
          <div className="flex flex-wrap items-center gap-3">
            <SufficiencyBadge sufficient={currentResponse.sufficient_context} />
            {typeof currentResponse.confidence === "number" && (
              <span className="text-xs font-semibold text-slate-600 dark:text-gray-300">Agent confidence: {Math.round(currentResponse.confidence * 100)}%</span>
            )}
          </div>

          {!currentResponse.sufficient_context ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/70 dark:bg-amber-950/20">
              <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">Escalation recommended</p>
              <p className="mt-1 text-sm leading-6 text-amber-800 dark:text-amber-300">
                {currentResponse.escalation_reason || "The knowledge base does not contain enough verified context to provide a safe troubleshooting resolution."}
              </p>
            </div>
          ) : (
            <>
              {currentResponse.summary && (
                <div>
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Resolution summary</h3>
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700 dark:text-gray-300">{currentResponse.summary}</p>
                </div>
              )}
              <DestructiveWarning steps={currentResponse.steps} />
              <div>
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Recommended steps</h3>
                <div className="mt-3">
                  <StepChecklist steps={currentResponse.steps} citations={currentResponse.citations} />
                </div>
              </div>
            </>
          )}

          {currentResponse.status === "REJECTED" && currentResponse.reject_reason && (
            <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-800 dark:bg-red-950/30 dark:text-red-300">Rejected: {currentResponse.reject_reason}</p>
          )}
        </div>
      )}

      {error && <p className="mt-4 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-950/30 dark:text-red-300">{error}</p>}

      <div className="mt-5 flex flex-wrap gap-3">
        {canGenerate && (
          <button type="button" onClick={handleGenerate} disabled={generating || actionBusy} className="rounded-2xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50">
            {generating ? "Generating draft..." : currentResponse ? "Generate another draft" : "Generate resolution"}
          </button>
        )}
        {currentResponse?.status === "DRAFT" && (
          <>
            <button type="button" onClick={handleAccept} disabled={actionBusy || generating} className="rounded-2xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50">{actionBusy ? "Saving..." : "Accept & send"}</button>
            <button type="button" onClick={() => setShowEditDialog(true)} disabled={actionBusy || generating} className="rounded-2xl border border-blue-300 px-4 py-2.5 text-sm font-semibold text-blue-700 hover:bg-blue-50 disabled:opacity-50 dark:border-blue-800 dark:text-blue-300 dark:hover:bg-blue-950/30">Edit & send</button>
            <button type="button" onClick={() => setShowRejectForm((visible) => !visible)} disabled={actionBusy || generating} className="rounded-2xl border border-red-300 px-4 py-2.5 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50 dark:border-red-800 dark:text-red-300 dark:hover:bg-red-950/30">Reject</button>
          </>
        )}
      </div>

      {showRejectForm && currentResponse?.status === "DRAFT" && (
        <div className="mt-4 rounded-2xl border border-red-200 bg-white p-4 dark:border-red-900/70 dark:bg-gray-950/50">
          <label htmlFor="reject-resolution-reason" className="block text-sm font-semibold text-slate-800 dark:text-gray-200">Why is this draft being rejected?</label>
          <textarea id="reject-resolution-reason" value={rejectReason} onChange={(event) => setRejectReason(event.target.value)} rows={3} disabled={actionBusy} className="mt-2 w-full rounded-2xl border border-slate-300 px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-red-500 disabled:opacity-60 dark:border-gray-700 dark:bg-gray-900 dark:text-white" />
          <div className="mt-3 flex justify-end gap-3">
            <button type="button" onClick={() => { setShowRejectForm(false); setRejectReason(""); }} disabled={actionBusy} className="rounded-2xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 disabled:opacity-50 dark:border-gray-700 dark:text-gray-200">Cancel</button>
            <button type="button" onClick={handleReject} disabled={actionBusy || !rejectReason.trim()} className="rounded-2xl bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50">{actionBusy ? "Rejecting..." : "Confirm rejection"}</button>
          </div>
        </div>
      )}

      {currentResponse && currentResponse.status !== "DRAFT" && (
        <div className="mt-5 border-t border-indigo-100 pt-5 dark:border-indigo-900/60">
          <p className="text-sm font-semibold text-slate-900 dark:text-white">Resolution feedback</p>
          <textarea value={feedbackComment} onChange={(event) => setFeedbackComment(event.target.value)} rows={2} disabled={actionBusy} placeholder="Optional feedback for future quality improvement" className="mt-2 w-full rounded-2xl border border-slate-300 px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-indigo-500 disabled:opacity-60 dark:border-gray-700 dark:bg-gray-950 dark:text-white" />
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <button type="button" onClick={() => void handleFeedback(true)} disabled={actionBusy} className="rounded-2xl border border-emerald-300 px-4 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-50 disabled:opacity-50 dark:border-emerald-800 dark:text-emerald-300 dark:hover:bg-emerald-950/30">Helpful</button>
            <button type="button" onClick={() => void handleFeedback(false)} disabled={actionBusy} className="rounded-2xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-900">Not helpful</button>
            {feedbackMessage && <span className="text-sm text-emerald-700 dark:text-emerald-300">{feedbackMessage}</span>}
          </div>
        </div>
      )}

      <div className="mt-6 border-t border-indigo-100 pt-5 dark:border-indigo-900/60">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
          Manual Resolution
        </h3>
        <p className="mt-1 text-xs text-slate-600 dark:text-gray-400">
          Provide a manual troubleshooting response to send directly to the ticket requester.
        </p>

        <textarea
          value={manualSummary}
          onChange={(event) => {
            setManualSummary(event.target.value);
            if (manualSuccessMessage) setManualSuccessMessage("");
          }}
          rows={3}
          disabled={manualBusy || actionBusy}
          placeholder="Type user-facing manual resolution instructions here..."
          className="mt-3 w-full rounded-2xl border border-slate-300 px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-indigo-500 disabled:opacity-60 dark:border-gray-700 dark:bg-gray-950 dark:text-white"
        />

        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => void handleSendManualResolution()}
            disabled={manualBusy || actionBusy || !manualSummary.trim()}
            className="rounded-2xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {manualBusy ? "Sending..." : "Send Manual Resolution"}
          </button>
          {manualSuccessMessage && (
            <span className="text-sm font-medium text-emerald-700 dark:text-emerald-300">
              {manualSuccessMessage}
            </span>
          )}
        </div>
      </div>

      {showEditDialog && currentResponse?.status === "DRAFT" && (
        <EditAndSendDialog response={currentResponse} busy={actionBusy} onCancel={() => setShowEditDialog(false)} onSubmit={handleEditAndSend} />
      )}
    </section>
  );
}
