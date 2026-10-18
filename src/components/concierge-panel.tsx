"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import { ArrowUp, ArrowUpRight, Sparkles } from "lucide-react";
import Image from "next/image";
import Link from "./link";
import { Dialog } from "./dialog";
import { campaigns, campaignById } from "@/lib/content";
import { track } from "@/lib/client-events";
import {
  parseConciergeAnswer,
  type ConciergeAnswer,
} from "@/lib/concierge-view";
import "./ask-panel.css";
import "./discovery-concierge.css";

type Turn = {
  id: string;
  question: string;
  status: "pending" | "complete" | "error";
  answer?: ConciergeAnswer;
  error?: string;
};
const suggestions = [
  "I care about climate and nature",
  "Help me find a project that brings neighbors together",
  "I’d like to spread the word, not donate right now",
];

export default function ConciergePanel({
  onClose,
  onNavigate,
  returnFocusRef,
}: {
  onClose: () => void;
  onNavigate: () => void;
  returnFocusRef: RefObject<HTMLElement | null>;
}) {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [draft, setDraft] = useState("");
  const [validation, setValidation] = useState("");
  const active = useRef<AbortController | null>(null);
  const mounted = useRef(true);
  const composer = useRef<HTMLTextAreaElement>(null);
  const transcript = useRef<HTMLDivElement>(null);
  const busy = turns.some((t) => t.status === "pending");
  useEffect(() => {
    mounted.current = true;
    composer.current?.focus();
    return () => {
      mounted.current = false;
      active.current?.abort();
    };
  }, []);
  useEffect(() => {
    const el = transcript.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [turns]);
  function close() {
    active.current?.abort();
    onClose();
  }
  function navigate(campaignId: string, requestId?: string, source = false) {
    track("concierge_campaign_opened", campaignId, {
      ...(requestId ? { requestId } : {}),
      targetType: source ? "source" : "campaign",
    });
    onNavigate();
    close();
  }
  async function request(turn: Turn, prior: Turn[]) {
    if (active.current) return;
    const controller = new AbortController();
    active.current = controller;
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, 19000);
    let history = prior
      .filter((t) => t.status === "complete" && t.answer)
      .slice(-2)
      .flatMap((t) => [
        { role: "user" as const, content: t.question },
        {
          role: "assistant" as const,
          content: [
            t.answer!.message,
            ...t.answer!.recommendations.map(
              (r) => `${campaignById(r.campaignId)?.title}: ${r.reason}`,
            ),
          ]
            .join("\n")
            .slice(0, 1500),
        },
      ]);
    const payload = () =>
      JSON.stringify({
        question: turn.question,
        ...(history.length ? { history } : {}),
      });
    while (history.length && new TextEncoder().encode(payload()).length > 8000)
      history = history.slice(2);
    try {
      const response = await fetch("/api/concierge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: payload(),
        signal: controller.signal,
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(
          typeof data.error === "string"
            ? data.error
            : "The guide is unavailable. Please try again.",
        );
      let answer: ConciergeAnswer;
      try {
        answer = parseConciergeAnswer(data);
      } catch {
        throw new Error(
          "The guide couldn’t verify those suggestions. Please try again or browse the campaigns.",
        );
      }
      if (!mounted.current || controller.signal.aborted) return;
      setTurns((current) =>
        current.map((t) =>
          t.id === turn.id ? { ...t, status: "complete", answer } : t,
        ),
      );
    } catch (error) {
      if (!mounted.current || (controller.signal.aborted && !timedOut)) return;
      const message = timedOut
        ? "The guide took too long. Please try again or explore the campaigns below."
        : error instanceof Error
          ? error.message
          : "The guide couldn’t finish. Please try again.";
      setTurns((current) =>
        current.map((t) =>
          t.id === turn.id ? { ...t, status: "error", error: message } : t,
        ),
      );
    } finally {
      clearTimeout(timer);
      if (active.current === controller) active.current = null;
    }
  }
  function send(question: string) {
    const text = question.trim();
    if (active.current || busy) return;
    if (!text || text.length > 1000) {
      setValidation("Tell me what matters to you in 1–1,000 characters.");
      return;
    }
    setValidation("");
    setDraft("");
    const turn: Turn = {
      id: crypto.randomUUID(),
      question: text,
      status: "pending",
    };
    setTurns((current) => [...current, turn]);
    void request(turn, turns);
    composer.current?.focus();
  }
  function retry(turn: Turn) {
    if (active.current) return;
    setTurns((current) =>
      current.map((t) =>
        t.id === turn.id ? { ...t, status: "pending", error: undefined } : t,
      ),
    );
    void request(
      turn,
      turns.slice(
        0,
        turns.findIndex((t) => t.id === turn.id),
      ),
    );
  }
  return (
    <Dialog
      title="Find your kind of good"
      variant="chat"
      returnFocusRef={returnFocusRef}
      onClose={close}
    >
      <div className="chat-context">
        <Sparkles size={17} />
        <p>
          Your discovery concierge · Explore all four fictional community
          campaigns.
        </p>
      </div>
      <div className="chat-thread">
        <div
          className="chat-messages"
          ref={transcript}
          role="region"
          aria-label="Discovery conversation"
          tabIndex={0}
        >
          {!turns.length && (
            <div className="chat-intro">
              <span className="chat-intro-icon">
                <Sparkles size={26} />
              </span>
              <h3>What matters to you?</h3>
              <p>
                Fresh food, greener neighborhoods, a more welcoming outdoors?
                Let’s find a project you’d feel good supporting—or sharing.
              </p>
              <div className="suggestions">
                {suggestions.map((q) => (
                  <button className="topic" key={q} onClick={() => send(q)}>
                    {q}
                    <ArrowUpRight size={15} />
                  </button>
                ))}
              </div>
            </div>
          )}
          {turns.map((turn) => (
            <div className="chat-turn" key={turn.id}>
              <div className="chat-message chat-user">
                <span className="chat-author">You</span>
                <p className="question-bubble">{turn.question}</p>
              </div>
              <div className="chat-message chat-assistant">
                <span className="chat-assistant-icon">
                  <Sparkles size={16} />
                </span>
                <div className="chat-assistant-content">
                  <span className="chat-author">Your discovery guide</span>
                  {turn.status === "pending" && (
                    <p className="chat-pending" role="status">
                      Looking through the community’s projects…
                    </p>
                  )}
                  {turn.status === "error" && (
                    <div className="chat-error" role="alert">
                      <p>{turn.error}</p>
                      <button
                        className="text-button"
                        disabled={busy}
                        onClick={() => retry(turn)}
                      >
                        Try again
                      </button>
                      <details className="concierge-fallback">
                        <summary>Browse campaign information instead</summary>
                        <p>These are catalog links, not AI recommendations.</p>
                        {campaigns.map((c) => (
                          <Link
                            key={c.id}
                            href={`/fundraisers/${c.id}`}
                            onClick={() => navigate(c.id)}
                          >
                            {c.title} <ArrowUpRight size={13} />
                          </Link>
                        ))}
                      </details>
                    </div>
                  )}
                  {turn.status === "complete" && turn.answer && (
                    <div className="chat-answer">
                      <p>{turn.answer.message}</p>
                      <div className="concierge-recommendations">
                        {turn.answer.recommendations.map((rec) => {
                          const c = campaignById(rec.campaignId)!;
                          return (
                            <article
                              className="concierge-recommendation"
                              key={c.id}
                            >
                              <Link
                                className="concierge-campaign-title"
                                href={`/fundraisers/${c.id}`}
                                onClick={() =>
                                  navigate(c.id, turn.answer!.requestId)
                                }
                              >
                                <Image
                                  src={c.image}
                                  alt={c.alt}
                                  width={76}
                                  height={76}
                                  sizes="76px"
                                />
                                <span>
                                  <small>{c.topic}</small>
                                  <strong>{c.title}</strong>
                                </span>
                                <ArrowUpRight size={17} />
                              </Link>
                              <p>{rec.reason}</p>
                              <div className="concierge-sources">
                                <span>From the campaign:</span>
                                {rec.sources.map((source) => (
                                  <Link
                                    key={source.id}
                                    href={source.href}
                                    onClick={() =>
                                      navigate(
                                        c.id,
                                        turn.answer!.requestId,
                                        true,
                                      )
                                    }
                                  >
                                    {source.label}
                                  </Link>
                                ))}
                              </div>
                              <Link
                                className="concierge-explore"
                                href={`/fundraisers/${c.id}`}
                                onClick={() =>
                                  navigate(c.id, turn.answer!.requestId)
                                }
                              >
                                Explore & support <ArrowUpRight size={14} />
                              </Link>
                            </article>
                          );
                        })}
                      </div>
                      {turn.answer.recommendations.length > 0 && (
                        <p className="concierge-support-note">
                          On each campaign you can donate, share its link, or
                          feature it on your profile. Demo donations are
                          simulated.
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
      <form
        className="chat-composer"
        onSubmit={(e) => {
          e.preventDefault();
          send(draft);
        }}
      >
        <label className="chat-composer-label" htmlFor="concierge-question">
          What kind of difference would you like to make?
        </label>
        <div className="chat-input-wrap">
          <textarea
            ref={composer}
            id="concierge-question"
            rows={2}
            maxLength={1000}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Tell me about a cause you care about…"
            onKeyDown={(e) => {
              if (
                e.key === "Enter" &&
                !e.shiftKey &&
                !e.nativeEvent.isComposing
              ) {
                e.preventDefault();
                send(draft);
              }
            }}
          />
          <button
            className="chat-send"
            type="submit"
            aria-label="Send discovery message"
            disabled={busy || !draft.trim()}
          >
            <ArrowUp size={20} />
          </button>
        </div>
        {validation && (
          <p role="alert" className="error">
            {validation}
          </p>
        )}
        <p className="concierge-footer">
          AI suggestions, based on campaign information. Check the details
          before supporting. Chat clears when you close.
        </p>
      </form>
    </Dialog>
  );
}
