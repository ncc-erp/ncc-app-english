"use client";

import React, { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { Navbar } from "@/components/Navbar";
import { QuestionAudioReviewer } from "@/components/ielts/QuestionAudioReviewer";
import { ClanJoinCTA } from "@/components/result/ClanJoinCTA";
import { ViewResultOnClanButton } from "@/components/result/ViewResultOnClanButton";
import { IELTSScoreResult } from "@/types/ielts";
import { UserSession } from "@/types";
import {
  Award,
  Sparkles,
  AlertCircle,
  ArrowUpRight,
  RefreshCw,
  ChevronRight,
  Clock,
  ArrowLeft,
  History,
} from "lucide-react";

export default function IELTSSpeakingResultPage({
  params,
}: {
  params: Promise<{ attemptId: string }>;
}) {
  const { attemptId } = use(params);
  const router = useRouter();

  const [result, setResult] = useState<IELTSScoreResult | null>(null);
  const [user, setUser] = useState<UserSession | null>(null);
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchResult = async (showLoadingSpinner = true) => {
    try {
      if (showLoadingSpinner) setLoading(true);
      const res = await fetch(`/api/ielts/${attemptId}`);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let data: any;
      const contentType = res.headers.get("content-type") || "";
      if (contentType.includes("application/json")) {
        data = await res.json();
      } else {
        const text = await res.text();
        throw new Error(
          text || `Server returned non-JSON response (${res.status})`,
        );
      }

      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to load result report");
      }

      if (data.attempt?.status === "cancelled") {
        setError(
          "This test attempt was cancelled because it was interrupted before completion.",
        );
        return;
      }

      if (data.result) {
        setResult(data.result);
        setIsUnlocked(
          data.isUnlocked ||
            data.attempt?.unlocked ||
            data.result?.unlocked ||
            false,
        );
      } else {
        // Instant submit case: result is not yet generated. Auto-trigger AI evaluation!
        setResult(null);
        handleRescoreWithAI();
      }
    } catch (err) {
      console.error("Fetch result error:", err);
      setError((err as Error).message);
    } finally {
      if (showLoadingSpinner) setLoading(false);
    }
  };

  useEffect(() => {
    fetchResult();
    async function loadUser() {
      try {
        const res = await fetch("/api/auth/me");
        const data = await res.json();
        if (data.isLoggedIn && data.user) {
          setUser(data.user);
          if (data.user.clan_member) {
            setIsUnlocked(true);
          }
        }
      } catch {
        // ignore
      }
    }
    loadUser();
  }, [attemptId]);

  const [rescoring, setRescoring] = useState(false);
  const [rescoreSuccess, setRescoreSuccess] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  async function handleRescoreWithAI() {
    try {
      setShowConfirmModal(false);
      setRescoring(true);
      setError(null);
      setRescoreSuccess(false);

      const res = await fetch("/api/ielts/rescore", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ attemptId }),
      });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let data: any;
      const contentType = res.headers.get("content-type") || "";
      if (contentType.includes("application/json")) {
        data = await res.json();
      } else {
        const text = await res.text();
        throw new Error(
          text || `Server returned non-JSON response (${res.status})`,
        );
      }

      if (!res.ok || !data.success || !data.result) {
        throw new Error(data.error || "Failed to re-score attempt with AI");
      }

      setResult(data.result);
      setRescoreSuccess(true);
      setTimeout(() => setRescoreSuccess(false), 5000);
    } catch (err) {
      console.error("Rescore error:", err);
      setError((err as Error).message);
    } finally {
      setRescoring(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col justify-center items-center">
        <div className="w-12 h-12 border-4 border-purple-600 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-slate-600 font-medium">
          Loading IELTS test attempt details...
        </p>
      </div>
    );
  }

  if (!result) {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans">
        <Navbar />
        <main className="flex-1 max-w-2xl mx-auto px-4 py-20 w-full flex flex-col items-center justify-center text-center space-y-6">
          {rescoring ? (
            <>
              <div className="relative flex items-center justify-center">
                <div className="w-20 h-20 border-4 border-purple-200 border-t-purple-600 rounded-full animate-spin" />
                <Sparkles className="w-8 h-8 text-purple-600 absolute animate-pulse" />
              </div>
              <div className="space-y-2">
                <div className="inline-block px-3 py-1 bg-purple-100 text-purple-800 text-xs font-bold rounded-full uppercase tracking-wider animate-pulse">
                  🤖 AI Examiner Evaluating Speech...
                </div>
                <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900">
                  Evaluating Band Score
                </h1>
                <p className="text-sm text-slate-600 max-w-md mx-auto leading-relaxed">
                  The AI system is analyzing your speaking response across 4
                  IELTS criteria (FC, LR, GRA, PR). This usually takes 15–30
                  seconds...
                </p>
              </div>
            </>
          ) : (
            <>
              <div className="p-4 bg-purple-100 text-purple-700 rounded-full shadow-inner">
                <Clock className="w-12 h-12" />
              </div>
              <div className="space-y-2">
                <div className="inline-block px-3 py-1 bg-amber-100 text-amber-800 text-xs font-bold rounded-full uppercase tracking-wider">
                  Status: Evaluation Pending
                </div>
                <h1 className="text-3xl font-extrabold text-slate-900">
                  AI Scoring Pending
                </h1>
                <p className="text-sm text-slate-600 max-w-md mx-auto leading-relaxed">
                  Your Speaking test response has been safely recorded. Click
                  the button below to start or retry the AI evaluation.
                </p>
              </div>
            </>
          )}

          {error && (
            <div className="p-4 bg-rose-50 border border-rose-200 text-rose-700 rounded-2xl text-xs font-medium max-w-md w-full">
              {error}
            </div>
          )}

          <div className="flex flex-col sm:flex-row items-center gap-4 pt-2">
            <button
              onClick={handleRescoreWithAI}
              disabled={rescoring}
              className="inline-flex items-center justify-center gap-2 px-8 py-3.5 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-2xl shadow-lg shadow-purple-200 transition-all disabled:opacity-50 active:scale-95"
            >
              <RefreshCw
                className={`w-4 h-4 ${rescoring ? "animate-spin" : ""}`}
              />
              <span>
                {rescoring
                  ? "Analyzing speaking response..."
                  : "🤖 Re-score with AI"}
              </span>
            </button>

            <button
              onClick={() => {
                if (window.history.length > 1) {
                  router.back();
                } else {
                  router.push("/ielts-speaking/history");
                }
              }}
              className="inline-flex items-center justify-center gap-2 px-6 py-3.5 bg-white hover:bg-slate-100 text-slate-700 font-bold rounded-2xl border border-slate-200 transition-all"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back</span>
            </button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans">
      <Navbar />

      <main className="flex-1 max-w-5xl mx-auto px-4 py-10 w-full space-y-6">
        {/* Navigation Back Bar */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => {
              if (window.history.length > 1) {
                router.back();
              } else {
                router.push("/ielts-speaking/history");
              }
            }}
            className="inline-flex items-center gap-2 px-4 py-2 bg-white hover:bg-slate-100 text-slate-700 text-xs font-bold rounded-xl border border-slate-200 transition-all shadow-sm group"
          >
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
            <span>Back</span>
          </button>

          <button
            onClick={() => router.push("/ielts-speaking/history")}
            className="inline-flex items-center gap-2 px-4 py-2 bg-purple-50 hover:bg-purple-100 text-purple-700 text-xs font-bold rounded-xl border border-purple-200 transition-all shadow-sm"
          >
            <History className="w-4 h-4" />
            <span>Test History</span>
          </button>
        </div>

        {/* Overall Band Hero Card */}
        <div className="relative overflow-hidden bg-gradient-to-br from-amber-500 via-amber-600 to-purple-700 text-white rounded-3xl p-8 md:p-12 shadow-xl">
          <div className="flex flex-col md:flex-row items-center justify-between gap-8">
            <div className="space-y-3 text-center md:text-left">
              <div className="flex flex-wrap items-center justify-center md:justify-start gap-2">
                <div className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-white/20 border border-white/30 text-white text-xs font-bold rounded-full uppercase tracking-wider">
                  <Award className="w-4 h-4" />
                  <span>IELTS Speaking Evaluation Report</span>
                </div>

                <button
                  onClick={() => setShowConfirmModal(true)}
                  disabled={rescoring}
                  className="inline-flex items-center gap-2 px-4 py-1.5 bg-white hover:bg-amber-50 text-purple-900 text-xs font-extrabold rounded-full transition-all shadow-md active:scale-95 disabled:opacity-50"
                  title="Re-evaluate speaking attempt using AI Examiner"
                >
                  <RefreshCw
                    className={`w-3.5 h-3.5 ${rescoring ? "animate-spin" : ""}`}
                  />
                  <span>
                    {rescoring
                      ? "Re-scoring with AI..."
                      : "🤖 Re-score with AI"}
                  </span>
                </button>
              </div>

              <h1 className="text-3xl md:text-4xl font-extrabold">
                {result.topic_title}
              </h1>
              <p className="text-amber-50 max-w-xl text-sm leading-relaxed">
                {result.summary_feedback}
              </p>

              {rescoreSuccess && (
                <div className="inline-block px-3 py-1 bg-emerald-500/90 text-white text-xs font-bold rounded-lg animate-fade-in">
                  ✓ Successfully updated with latest AI evaluation results!
                </div>
              )}
            </div>

            {/* Band Score Badge */}
            <div className="flex flex-col items-center justify-center p-6 bg-white/10 backdrop-blur-md border border-white/20 rounded-3xl min-w-[200px] shadow-2xl shrink-0">
              <div className="text-xs uppercase tracking-widest font-bold text-amber-200">
                Overall Band
              </div>
              <div className="text-6xl font-extrabold text-white font-mono my-2">
                {result.overall_band.toFixed(1)}
              </div>
              <div className="text-xs font-bold text-slate-900 text-center px-3 py-1 bg-white rounded-full">
                {result.status_title}
              </div>
            </div>
          </div>
        </div>

        {/* Estimated Band Reason Card */}
        {result.estimated_band_reason && (
          <div className="bg-purple-50/80 border border-purple-200 rounded-3xl p-6 shadow-sm space-y-2">
            <div className="flex items-center gap-2 text-xs font-bold text-purple-900 uppercase tracking-wider">
              <Sparkles className="w-4 h-4 text-purple-600" />
              <span>Official IELTS Examiner Band Rationale</span>
            </div>
            <p className="text-sm text-purple-900 font-medium leading-relaxed">
              {result.estimated_band_reason}
            </p>
          </div>
        )}

        {error && (
          <div className="p-4 bg-rose-50 border border-rose-200 text-rose-700 rounded-2xl text-sm font-medium">
            {error}
          </div>
        )}

        {/* Clan Member Interaction or Join Clan CTA Banner */}
        {!user?.clan_member ? (
          <ClanJoinCTA
            attemptId={attemptId}
            onVerifySuccess={() => {
              setIsUnlocked(true);
              setUser((prev) => (prev ? { ...prev, clan_member: true } : prev));
              fetchResult(false);
            }}
          />
        ) : (
          <ViewResultOnClanButton attemptId={attemptId} />
        )}

        {/* Detailed Breakdown Container (Slightly blurred when not verified) */}

        {/* Action Controls */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-6">
          <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
            <button
              onClick={() => router.push("/ielts-speaking")}
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3.5 bg-white hover:bg-slate-100 text-slate-800 font-bold rounded-2xl border border-slate-200 transition-all shadow-sm"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Practice Another Topic</span>
            </button>

            {/* <button
              onClick={() => router.push('/ielts-speaking/history')}
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3.5 bg-white hover:bg-purple-50 text-purple-700 font-bold rounded-2xl border border-purple-200 transition-all shadow-sm"
            >
              <History className="w-4 h-4" />
              <span>View Test History</span>
            </button> */}
          </div>

          <button
            onClick={() => router.push("/")}
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-8 py-3.5 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-2xl transition-all shadow-md shadow-purple-200"
          >
            <span>Return to Home</span>
          </button>
        </div>

        {/* Re-score Confirmation Modal */}
        {showConfirmModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
            <div className="bg-white border border-slate-200 rounded-3xl p-6 md:p-8 max-w-md w-full shadow-2xl space-y-6">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-purple-100 text-purple-700 rounded-2xl">
                  <Sparkles className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">
                    Re-evaluate with AI?
                  </h3>
                  <p className="text-xs text-slate-500 font-medium">
                    IELTS Examiner AI Scoring
                  </p>
                </div>
              </div>

              <p className="text-sm text-slate-600 leading-relaxed font-medium">
                Are you sure you want to re-score this attempt using the AI
                Examiner? This will re-evaluate your recorded responses and
                update your Band Score report.
              </p>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  onClick={() => setShowConfirmModal(false)}
                  className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-bold rounded-xl transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={handleRescoreWithAI}
                  className="px-5 py-2.5 bg-purple-600 hover:bg-purple-700 text-white text-sm font-bold rounded-xl transition-all shadow-md shadow-purple-200"
                >
                  Confirm & Re-score
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
