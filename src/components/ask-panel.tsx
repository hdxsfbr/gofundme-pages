"use client";
import { useEffect, useRef, useState } from "react";
import { ArrowUp, ArrowDown, ArrowUpRight, Sparkles } from "lucide-react";
import type { Campaign } from "@/lib/content";
import { dateLabel } from "@/lib/domain";
import { track } from "@/lib/client-events";
import type { AnswerView } from "@/lib/answer-view";
import { Dialog } from "./dialog";
import "./ask-panel.css";
type Answer = AnswerView;
type ChatTurn = {
  id: string;
  question: string;
  status: "pending" | "complete" | "error";
  answer?: Answer;
  partial?: Answer;
  error?: string;
};
type ChatContextMessage = { role: "user" | "assistant"; content: string };
function chatRequest(campaignId: string, turn: ChatTurn, prior: ChatTurn[]) {
  let messages: ChatContextMessage[] = prior
    .filter((entry) => entry.status === "complete" && entry.answer)
    .slice(-2)
    .flatMap((entry): ChatContextMessage[] => {
      const answer = entry.answer!;
      const content = [
        ...answer.claims.map((claim) => claim.text),
        answer.missing,
        ...answer.facts.map((fact) => `${fact.label}: ${fact.value}`),
      ]
        .filter(Boolean)
        .join("\n\n")
        .trim()
        .slice(0, 1500);
      return content
        ? [
            { role: "user", content: entry.question },
            { role: "assistant", content },
          ]
        : [];
    });
  const payload = () => ({
    campaignId,
    question: turn.question,
    ...(messages.length ? { history: { campaignId, messages } } : {}),
  });
  while (messages.length && JSON.stringify(payload()).length > 8192)
    messages = messages.slice(2);
  return payload();
}
async function readChatStream(
  response: Response,
  campaignId: string,
  signal: AbortSignal,
  onPartial: (value: unknown) => void,
  validate: (value: unknown) => Answer,
): Promise<Answer> {
  const interrupted =
    "The answer was interrupted. Please try again or read the original sources.";
  const reader = response.body?.getReader();
  if (!reader) throw new Error(interrupted);
  const decoder = new TextDecoder("utf-8", { fatal: true });
  let buffer = "";
  let bytes = 0;
  let requestId: string | undefined;
  const cancel = () => {
    void reader.cancel().catch(() => {});
  };
  signal.addEventListener("abort", cancel, { once: true });
  try {
    if (signal.aborted) throw new Error(interrupted);
    while (true) {
      const chunk = await reader.read();
      if (signal.aborted) throw new Error(interrupted);
      if (chunk.done) throw new Error(interrupted);
      bytes += chunk.value.byteLength;
      if (bytes > 131072) throw new Error(interrupted);
      buffer += decoder.decode(chunk.value, { stream: true });
      // SSE accepts LF, CRLF, and CR line endings, even across byte chunks.
      let boundary: RegExpExecArray | null;
      while ((boundary = /(?:\r\n|\r(?!\n)|\n){2}/.exec(buffer))) {
        const frame = buffer.slice(0, boundary.index);
        buffer = buffer.slice(boundary.index + boundary[0].length);
        let event = "message";
        const data: string[] = [];
        for (const line of frame.split(/\r\n|\r|\n/)) {
          if (line.startsWith(":")) continue;
          const colon = line.indexOf(":");
          const field = colon < 0 ? line : line.slice(0, colon);
          const value =
            colon < 0 ? "" : line.slice(colon + 1).replace(/^ /, "");
          if (field === "event") event = value;
          if (field === "data") data.push(value);
        }
        if (!data.length) continue;
        let value: Record<string, unknown>;
        try {
          value = JSON.parse(data.join("\n"));
          if (!value || typeof value !== "object" || Array.isArray(value))
            throw new Error();
        } catch {
          throw new Error(interrupted);
        }
        if (event === "start") {
          if (
            requestId ||
            value.campaignId !== campaignId ||
            typeof value.requestId !== "string" ||
            !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
              value.requestId,
            )
          )
            throw new Error(interrupted);
          requestId = value.requestId;
        } else {
          if (!requestId || value.requestId !== requestId)
            throw new Error(interrupted);
          if (event === "error")
            throw new Error(
              typeof value.error === "string" && value.error.length <= 1000
                ? value.error
                : interrupted,
            );
          if (event === "partial") {
            if (
              value.status !== "supported" ||
              value.missing !== "" ||
              !Array.isArray(value.facts) ||
              value.facts.length
            )
              throw new Error(interrupted);
            onPartial(value);
          } else if (event === "done") return validate(value);
          else throw new Error(interrupted);
        }
      }
    }
  } finally {
    signal.removeEventListener("abort", cancel);
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}
function ChatAnswer({
  answer,
  partial,
  citation,
}: {
  answer: Answer;
  partial: boolean;
  citation: (id: string, requestId?: string) => void;
}) {
  const sources = [
    ...new Map(
      answer.claims.flatMap((claim) =>
        claim.citations.map((source) => [source.id, source] as const),
      ),
    ).values(),
  ];
  return (
    <div
      className={partial ? "chat-answer chat-streaming" : "chat-answer answer"}
    >
      {answer.claims.map((claim, index) => (
        <p key={index}>{claim.text}</p>
      ))}
      {answer.missing && <p>{answer.missing}</p>}
      {answer.facts.map((fact) => (
        <p key={fact.label}>
          <strong>{fact.label}:</strong> {fact.value}
        </p>
      ))}
      {sources.length > 0 && (
        <footer className="chat-references" aria-label="Answer sources">
          <span className="chat-author">Sources</span>
          <div className="citation-list">
            {sources.map((source) => (
              <button
                type="button"
                className="citation"
                key={source.id}
                onClick={() => citation(source.id, answer.requestId)}
              >
                {source.label} · {dateLabel(source.date)}{" "}
                <ArrowUpRight size={12} aria-hidden="true" />
              </button>
            ))}
          </div>
        </footer>
      )}
      {(answer.facts.length > 0 ||
        sources.some((source) => source.id === "funding")) && (
        <small className="chat-snapshot">
          Funding snapshot: {answer.snapshot.slice(0, 19).replace("T", " ")} UTC{" "}
          {!sources.some((source) => source.id === "funding") && (
            <button
              type="button"
              className="text-button"
              onClick={() => citation("funding", answer.requestId)}
            >
              View funding source
            </button>
          )}
        </small>
      )}
    </div>
  );
}
export default function AskPanel({
  campaign,
  onClose,
}: {
  campaign: Campaign;
  onClose: () => void;
}) {
  const [question, setQuestion] = useState("");
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [atBottom, setAtBottom] = useState(true);
  const turnsRef = useRef<ChatTurn[]>([]);
  const controller = useRef<AbortController | null>(null);
  const composer = useRef<HTMLTextAreaElement>(null);
  const messages = useRef<HTMLDivElement>(null);
  const followingLatest = useRef(true);
  const composing = useRef(false);
  const pending = turns.some((turn) => turn.status === "pending");
  function updateTurns(update: (current: ChatTurn[]) => ChatTurn[]) {
    const next = update(turnsRef.current);
    turnsRef.current = next;
    setTurns(next);
  }
  function scrollToLatest() {
    followingLatest.current = true;
    setAtBottom(true);
    const node = messages.current;
    if (node) node.scrollTo({ top: node.scrollHeight, behavior: "instant" });
  }
  useEffect(() => {
    composer.current?.focus({ preventScroll: true });
    return () => {
      controller.current?.abort();
      controller.current = null;
    };
  }, []);
  useEffect(() => {
    if (followingLatest.current) {
      const node = messages.current;
      if (node) node.scrollTo({ top: node.scrollHeight, behavior: "instant" });
    }
  }, [turns]);
  useEffect(() => {
    const input = composer.current;
    if (input) {
      input.style.height = "0px";
      input.style.height = `${Math.min(input.scrollHeight, 120)}px`;
    }
    if (followingLatest.current && messages.current)
      messages.current.scrollTop = messages.current.scrollHeight;
  }, [question]);
  function close() {
    controller.current?.abort();
    controller.current = null;
    onClose();
  }
  async function requestAnswer(turn: ChatTurn) {
    if (controller.current) return;
    const ac = new AbortController();
    controller.current = ac;
    const index = turnsRef.current.findIndex((entry) => entry.id === turn.id);
    const body = chatRequest(
      campaign.id,
      turn,
      turnsRef.current.slice(0, index),
    );
    const timeout = setTimeout(() => ac.abort(), 20000);
    try {
      const response = await fetch("/api/ask", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "text/event-stream",
        },
        body: JSON.stringify(body),
        signal: ac.signal,
      });
      if (!response.ok) {
        const failure = await response.json();
        throw new Error(
          failure.error || "We couldn’t get an answer. Please try again.",
        );
      }
      const { answerViewSchema } = await import("@/lib/answer-view");
      const validate = (value: unknown) => {
        const valid = answerViewSchema.safeParse(value);
        if (!valid.success)
          throw new Error(
            "The service returned an incomplete answer. Please try again or read the original sources.",
          );
        return valid.data;
      };
      const answer = response.headers
        .get("content-type")
        ?.includes("text/event-stream")
        ? await readChatStream(
            response,
            campaign.id,
            ac.signal,
            (value) => {
              const partial = validate(value);
              if (controller.current === ac && !ac.signal.aborted)
                updateTurns((entries) =>
                  entries.map((entry) =>
                    entry.id === turn.id ? { ...entry, partial } : entry,
                  ),
                );
            },
            validate,
          )
        : validate(await response.json());
      if (ac.signal.aborted) throw new Error("Answer deadline reached.");
      if (controller.current === ac) {
        updateTurns((entries) =>
          entries.map((entry) =>
            entry.id === turn.id
              ? {
                  ...entry,
                  status: "complete",
                  answer,
                  partial: undefined,
                  error: undefined,
                }
              : entry,
          ),
        );
      }
    } catch (error) {
      if (controller.current === ac) {
        const message = ac.signal.aborted
          ? "This answer took too long. Please try again."
          : (error as Error).message;
        updateTurns((entries) =>
          entries.map((entry) =>
            entry.id === turn.id
              ? {
                  ...entry,
                  status: "error",
                  partial: undefined,
                  error: message,
                }
              : entry,
          ),
        );
      }
    } finally {
      clearTimeout(timeout);
      if (controller.current === ac) controller.current = null;
    }
  }
  function send(value: string) {
    const text = value.trim();
    if (!text || text.length > 1000 || controller.current) return;
    const turn: ChatTurn = {
      id: crypto.randomUUID(),
      question: text,
      status: "pending",
    };
    followingLatest.current = true;
    setAtBottom(true);
    updateTurns((entries) => [...entries, turn]);
    setQuestion("");
    composer.current?.focus({ preventScroll: true });
    void requestAnswer(turn);
  }
  function retry(id: string) {
    if (controller.current) return;
    const turn = turnsRef.current.find((entry) => entry.id === id);
    if (!turn || turn.status !== "error") return;
    updateTurns((entries) =>
      entries.map((entry) =>
        entry.id === id
          ? { ...entry, status: "pending", error: undefined }
          : entry,
      ),
    );
    composer.current?.focus({ preventScroll: true });
    void requestAnswer(turn);
  }
  function citation(id: string, requestId?: string) {
    track("ai_citation_opened", campaign.id, { sourceId: id, requestId });
    close();
    requestAnimationFrame(() => {
      const el = document.getElementById(id);
      if (el) {
        const details = el.closest("details");
        if (details) details.open = true;
        el.scrollIntoView({ behavior: "instant", block: "start" });
        el.focus();
        historyReplace(id);
      }
    });
  }
  return (
    <Dialog title="Ask about this fundraiser" variant="chat" onClose={close}>
      <div className="chat-context">
        <Sparkles size={16} aria-hidden="true" />
        <p>{campaign.title}</p>
      </div>
      <div className="chat-thread">
        <div
          className="chat-messages"
          ref={messages}
          role="log"
          aria-label="Conversation about this fundraiser"
          aria-live="polite"
          aria-relevant="additions text"
          tabIndex={0}
          onScroll={() => {
            const node = messages.current;
            if (!node) return;
            const nearBottom =
              node.scrollHeight - node.scrollTop - node.clientHeight < 80;
            followingLatest.current = nearBottom;
            setAtBottom(nearBottom);
          }}
        >
          {!turns.length && (
            <div className="chat-intro">
              <span className="chat-intro-icon">
                <Sparkles size={25} aria-hidden="true" />
              </span>
              <h3>A little clarity before you give.</h3>
              <p>
                Explore this fundraiser’s story, updates, and current progress.
                Answers link back to its sources.
              </p>
              <div className="suggestions" aria-label="Suggested questions">
                {[
                  "What will the funds be used for?",
                  "What is the latest update?",
                  "How much is still needed?",
                ].map((suggestion) => (
                  <button
                    type="button"
                    className="topic"
                    key={suggestion}
                    onClick={() => send(suggestion)}
                  >
                    {suggestion}
                    <ArrowUpRight size={14} aria-hidden="true" />
                  </button>
                ))}
              </div>
            </div>
          )}
          {turns.map((turn) => (
            <div className="chat-turn" key={turn.id}>
              <article
                className="chat-message chat-user"
                aria-label="Your message"
              >
                <span className="chat-author">You</span>
                <p className="question-bubble">{turn.question}</p>
              </article>
              <article
                className="chat-message chat-assistant"
                aria-label="Fundraiser assistant"
              >
                <span className="chat-assistant-icon">
                  <Sparkles size={17} aria-hidden="true" />
                </span>
                <div className="chat-assistant-content">
                  <span className="chat-author">Fundraiser assistant</span>
                  {turn.status === "pending" && (
                    <p role="status" className="chat-pending">
                      {turn.partial?.claims.length
                        ? "Writing from the campaign’s sources…"
                        : "Looking through the campaign’s sources…"}
                    </p>
                  )}
                  {turn.status === "error" && (
                    <div role="alert" className="chat-error">
                      <p>{turn.error}</p>
                      <div className="chat-error-actions">
                        <button
                          type="button"
                          className="text-button"
                          disabled={pending}
                          onClick={() => retry(turn.id)}
                        >
                          Retry answer
                        </button>
                        <button
                          type="button"
                          className="text-button"
                          onClick={() => citation("story")}
                        >
                          Read the original campaign story
                        </button>
                      </div>
                    </div>
                  )}
                  {(turn.answer || turn.partial) && (
                    <ChatAnswer
                      answer={(turn.answer || turn.partial)!}
                      partial={turn.status === "pending"}
                      citation={citation}
                    />
                  )}
                </div>
              </article>
            </div>
          ))}
        </div>
        {!atBottom && turns.length > 0 && (
          <button type="button" className="chat-jump" onClick={scrollToLatest}>
            Latest message <ArrowDown size={14} aria-hidden="true" />
          </button>
        )}
      </div>
      <form
        className="chat-composer"
        onSubmit={(event) => {
          event.preventDefault();
          send(question);
        }}
      >
        <label className="chat-composer-label" htmlFor="fundraiser-question">
          Your question
        </label>
        <div className="chat-input-wrap">
          <textarea
            id="fundraiser-question"
            ref={composer}
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            onCompositionStart={() => {
              composing.current = true;
            }}
            onCompositionEnd={() => {
              composing.current = false;
            }}
            onKeyDown={(event) => {
              if (
                event.key !== "Enter" ||
                event.shiftKey ||
                event.nativeEvent.isComposing ||
                composing.current ||
                event.keyCode === 229
              )
                return;
              event.preventDefault();
              if (!event.repeat) send(question);
            }}
            maxLength={1000}
            rows={1}
            placeholder={
              turns.length ? "Ask a follow-up…" : "What would you like to know?"
            }
          />
          <button
            type="submit"
            className="chat-send"
            aria-label="Send message"
            title="Send message"
            disabled={pending || !question.trim()}
          >
            <ArrowUp size={19} aria-hidden="true" />
          </button>
        </div>
        <p className="chat-keyboard-hint">
          Enter to send · Shift+Enter for a new line
        </p>
        <p className="chat-disclaimer">
          AI answers from campaign sources. Organizer claims aren’t independent
          verification.
        </p>
      </form>
    </Dialog>
  );
}
function historyReplace(id: string) {
  window.history.replaceState(
    null,
    "",
    location.pathname + "#" + encodeURIComponent(id),
  );
}
