"use client";

import { useRef, useState } from "react";
import { ArrowUpRight, Sparkles } from "lucide-react";
import { Dialog } from "./dialog";
import { track } from "@/lib/client-events";
import { community } from "@/lib/content";
import "./discovery-concierge.css";

export function DiscoveryConcierge({ onNavigate }: { onNavigate: () => void }) {
  const [open, setOpen] = useState(false);
  const [Panel, setPanel] = useState<
    typeof import("./concierge-panel").default | null
  >(null);
  const [error, setError] = useState("");
  const trigger = useRef<HTMLButtonElement | null>(null);
  async function show(button?: HTMLButtonElement) {
    if (button) trigger.current = button;
    setOpen(true);
    setError("");
    if (button) track("concierge_opened", community.id);
    if (!Panel) {
      try {
        const panelModule = await import("./concierge-panel");
        setPanel(() => panelModule.default);
      } catch {
        setError(
          "The guide couldn’t open. Please try again or browse the campaigns below.",
        );
      }
    }
  }
  return (
    <>
      <div className="concierge-invitation">
        <span className="concierge-invitation-icon">
          <Sparkles size={24} />
        </span>
        <div>
          <p className="eyebrow">YOUR NEXT GOOD THING</p>
          <h2>A cause that feels like you.</h2>
          <p>
            Tell our AI guide what matters to you. Find a project to support or
            share.
          </p>
        </div>
        <button className="button" onClick={(e) => void show(e.currentTarget)}>
          Find a cause with the concierge <ArrowUpRight size={18} />
        </button>
      </div>
      <button
        className="concierge-launcher assistant-launcher"
        onClick={(e) => void show(e.currentTarget)}
        aria-label="Open discovery concierge"
      >
        <Sparkles size={19} /> Find my cause
      </button>
      {open &&
        (Panel ? (
          <Panel
            onClose={() => setOpen(false)}
            onNavigate={onNavigate}
            returnFocusRef={trigger}
          />
        ) : (
          <Dialog
            title="Find your kind of good"
            variant="chat"
            returnFocusRef={trigger}
            onClose={() => setOpen(false)}
          >
            <div
              className="concierge-loading"
              role={error ? "alert" : "status"}
            >
              <p>{error || "Opening your discovery guide…"}</p>
              {error && (
                <button className="button" onClick={() => void show()}>
                  Retry opening guide
                </button>
              )}
            </div>
          </Dialog>
        ))}
    </>
  );
}
