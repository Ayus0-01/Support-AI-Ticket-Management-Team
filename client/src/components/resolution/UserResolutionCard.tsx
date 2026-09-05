import { useEffect, useState } from "react";
import {
  getResolutionResponse,
  submitResolutionFeedback,
  type ResolutionResponse,
} from "../../services/resolutionService";
import { type Ticket } from "../../services/ticketService";
import StepChecklist from "./StepChecklist";
import SufficiencyBadge from "./SufficiencyBadge";

type UserResolutionCardProps = {
  ticket: Ticket;
  isDark?: boolean;
  onConfirmed?: () => Promise<void> | void;
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

export default function UserResolutionCard({
  ticket,
  isDark = false,
  onConfirmed,
}: UserResolutionCardProps) {
  const [response, setResponse] = useState<ResolutionResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showDetails, setShowDetails] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [rejectComment, setRejectComment] = useState("");
  const [actionDone, setActionDone] = useState(false);
  const [actionMessage, setActionMessage] = useState("");

  const responseId = ticket.latest_response_id;

  useEffect(() => {
    let active = true;

    if (!responseId) {
      setResponse(null);
      return;
    }

    const loadResponse = async () => {
      try {
        setLoading(true);
        setError("");
        const data = await getResolutionResponse(responseId);
        if (active) {
          setResponse(data);
        }
      } catch (loadError) {
        if (active) {
          setError(getErrorMessage(loadError, "Could not load resolution details."));
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    void loadResponse();

    return () => {
      active = false;
    };
  }, [responseId]);

  if (!ticket.resolution_status || (ticket.resolution_status !== "SENT" && ticket.resolution_status !== "EDITED_SENT")) {
    return null;
  }

  const handleConfirmSolve = async () => {
    if (!responseId || submitting || actionDone) {
      return;
    }

    try {
      setSubmitting(true);
      setError("");
      await submitResolutionFeedback(responseId, {
        was_helpful: true,
        resolved_ticket: true,
      });
      setActionDone(true);
      setActionMessage("Thank you! Resolution confirmed and ticket marked as Resolved.");
      await onConfirmed?.();
    } catch (submitError) {
      setError(getErrorMessage(submitError, "Could not confirm resolution."));
    } finally {
      setSubmitting(false);
    }
  };

  const handleRejectSolve = async () => {
    if (!responseId || submitting || actionDone || !rejectComment.trim()) {
      return;
    }

    try {
      setSubmitting(true);
      setError("");
      await submitResolutionFeedback(responseId, {
        was_helpful: false,
        resolved_ticket: false,
        comment: rejectComment.trim(),
      });
      setActionDone(true);
      setShowRejectForm(false);
      setActionMessage("Feedback submitted. Support agent will review your ticket.");
      await onConfirmed?.();
    } catch (submitError) {
      setError(getErrorMessage(submitError, "Could not submit feedback."));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className={`rounded-3xl border p-5 ${
      isDark
        ? "border-emerald-900/60 bg-emerald-950/20 text-white"
        : "border-emerald-200 bg-emerald-50/40 text-slate-900"
    }`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
            <p className={`text-xs font-bold uppercase tracking-[0.2em] ${isDark ? 'text-emerald-400' : 'text-emerald-700'}`}>
              Resolution Provided — Please Review
            </p>
          </div>
          <p className={`mt-1 text-sm ${isDark ? 'text-gray-300' : 'text-slate-600'}`}>
            A resolution has been provided for your issue. Please inspect the steps and confirm if it solves your problem.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowDetails((prev) => !prev)}
          className={`rounded-2xl border px-4 py-2 text-sm font-semibold transition-colors ${
            isDark
              ? "border-emerald-800 bg-emerald-950/60 text-emerald-300 hover:bg-emerald-900/40"
              : "border-emerald-300 bg-white text-emerald-700 hover:bg-emerald-50"
          }`}
        >
          {showDetails ? "Hide Details" : "View Resolution"}
        </button>
      </div>

      {loading && (
        <p className="mt-4 text-sm text-slate-500 dark:text-gray-400">
          Loading resolution details...
        </p>
      )}

      {error && (
        <p className="mt-4 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-950/30 dark:text-red-300">
          {error}
        </p>
      )}

      {actionMessage && (
        <p className="mt-4 rounded-2xl bg-emerald-100 px-4 py-3 text-sm text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
          {actionMessage}
        </p>
      )}

      {showDetails && response && (
        <div className={`mt-5 space-y-4 rounded-2xl border p-4 ${
          isDark ? "border-gray-800 bg-gray-950" : "border-gray-200 bg-white"
        }`}>
          <div className="flex flex-wrap items-center gap-3">
            <SufficiencyBadge sufficient={response.sufficient_context} />
          </div>

          {response.summary && (
            <div>
              <h4 className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                Resolution Summary
              </h4>
              <p className={`mt-1 whitespace-pre-wrap text-sm leading-6 ${isDark ? 'text-gray-300' : 'text-slate-700'}`}>
                {response.summary}
              </p>
            </div>
          )}

          {response.steps && response.steps.length > 0 && (
            <div>
              <h4 className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                Recommended Steps
              </h4>
              <div className="mt-3">
                <StepChecklist steps={response.steps} citations={response.citations} />
              </div>
            </div>
          )}
        </div>
      )}

      {!actionDone && (
        <div className="mt-5 border-t border-emerald-200/60 pt-4 dark:border-emerald-900/60">
          <p className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>
            Did this resolution solve your issue?
          </p>
          <div className="mt-3 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={handleConfirmSolve}
              disabled={submitting}
              className="rounded-2xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              {submitting ? "Submitting..." : "Yes, Solved"}
            </button>
            <button
              type="button"
              onClick={() => setShowRejectForm((prev) => !prev)}
              disabled={submitting}
              className={`rounded-2xl border px-5 py-2.5 text-sm font-semibold disabled:opacity-50 ${
                isDark
                  ? "border-red-800 text-red-300 hover:bg-red-950/40"
                  : "border-red-300 text-red-700 hover:bg-red-50"
              }`}
            >
              No, Not Solved
            </button>
          </div>

          {showRejectForm && (
            <div className={`mt-4 rounded-2xl border p-4 ${
              isDark ? "border-red-900/60 bg-gray-950" : "border-red-200 bg-white"
            }`}>
              <label
                htmlFor="user-reject-feedback"
                className={`block text-sm font-semibold ${isDark ? 'text-gray-200' : 'text-slate-800'}`}
              >
                Please describe what didn't work or why the issue persists:
              </label>
              <textarea
                id="user-reject-feedback"
                value={rejectComment}
                onChange={(e) => setRejectComment(e.target.value)}
                rows={3}
                disabled={submitting}
                placeholder="Example: Step 2 failed with error code 504."
                className={`mt-2 w-full rounded-2xl border px-3 py-2.5 text-sm outline-none focus:border-red-500 disabled:opacity-60 ${
                  isDark ? "border-gray-700 bg-gray-900 text-white" : "border-gray-300 bg-white text-gray-900"
                }`}
              />
              <div className="mt-3 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowRejectForm(false);
                    setRejectComment("");
                  }}
                  disabled={submitting}
                  className={`rounded-2xl border px-4 py-2 text-sm font-semibold ${
                    isDark ? "border-gray-700 text-gray-300" : "border-gray-300 text-slate-700"
                  }`}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleRejectSolve}
                  disabled={submitting || !rejectComment.trim()}
                  className="rounded-2xl bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
                >
                  {submitting ? "Submitting..." : "Submit Feedback"}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
