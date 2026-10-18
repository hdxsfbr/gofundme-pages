"use client";
import {
  createContext,
  useContext,
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import Link from "@/components/link";
import Image from "next/image";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  ArrowUpRight,
  ArrowLeft,
  Check,
  Heart,
  Leaf,
  Search,
  Share2,
  Sparkles,
  Bookmark,
  MapPin,
  Plus,
  Users,
  Sun,
  ArrowRight,
  Copy,
  CircleHelp,
} from "lucide-react";
import {
  campaigns,
  community,
  organizerById,
  topics,
  type Campaign,
} from "@/lib/content";
import {
  amountCents,
  dateLabel,
  emptyViewer,
  followingCampaigns,
  funding,
  history,
  money,
  searchCampaigns,
  type Viewer,
} from "@/lib/domain";
import { Dialog } from "./dialog";
import { LiveDonationChart } from "./live-donation-chart";
import { DiscoveryConcierge } from "./discovery-concierge";
import { track } from "@/lib/client-events";
export { track } from "@/lib/client-events";

type Action = Record<string, string | boolean>;
const Context = createContext<{
  viewer: Viewer;
  act: (action: Action) => Promise<void>;
}>({ viewer: emptyViewer, act: async () => {} });
export const useDemo = () => useContext(Context);
function rememberDiscovery() {
  if (location.pathname !== "/communities/" + community.id) return;
  try {
    sessionStorage.setItem(
      "discovery-return",
      JSON.stringify({ url: location.pathname + location.search, y: scrollY }),
    );
  } catch {
    // Browsing remains usable when private storage is unavailable.
  }
}
export function Shell({
  initial,
  children,
}: {
  initial: Viewer;
  children: ReactNode;
}) {
  const viewer = initial;
  const pathname = usePathname();
  const params = useSearchParams();
  const watching = pathname.endsWith("/watch");
  const inCommunity = pathname === "/communities/" + community.id;
  const following = inCommunity && params.get("view") === "following";
  const router = useRouter();
  const act = useCallback(
    async (action: Action) => {
      const r = await fetch("/api/actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(action),
      });
      const result = await r.json();
      if (!r.ok) throw new Error(result.error);
      router.refresh();
    },
    [router],
  );
  useEffect(() => {
    track("page_view", pathname.split("/").pop() || null, {
      pageType: watching ? "watch" : pathname.split("/")[1] || "community",
    });
  }, [pathname, watching]);
  return (
    <Context.Provider value={{ viewer, act }}>
      <header className={"site-header" + (watching ? " watch-header" : "")}>
        <div className="nav-inner">
          <Link
            href={"/communities/" + community.id}
            className="wordmark"
            aria-label="GoFundMe home"
          >
            <span className="logo-sun">
              <Sun size={22} />
            </span>
            gofundme
          </Link>
          <nav aria-label="Main navigation">
            <Link
              className={inCommunity && !following ? "nav-current" : ""}
              aria-current={inCommunity && !following ? "page" : undefined}
              href={"/communities/" + community.id}
            >
              Discover
            </Link>
            <Link
              href={"/communities/" + community.id + "?view=following"}
              className={following ? "nav-current" : ""}
              aria-current={following ? "page" : undefined}
            >
              Following
            </Link>
            <Link
              href={"/communities/" + community.id + "/watch"}
              className={watching ? "nav-current" : ""}
              aria-current={watching ? "page" : undefined}
              prefetch={false}
              onClick={rememberDiscovery}
            >
              Watch
            </Link>
          </nav>
          <Link className="my-profile-link" href="/me">
            <span className="small-avatar">Y</span>
            <span>My profile</span>
          </Link>
        </div>
      </header>
      {children}
      {!watching && (
        <footer className="footer container">
          <Link className="wordmark" href={"/communities/" + community.id}>
            gofundme<span className="footer-dot">✳</span>
          </Link>
          <p>A little good goes a long way.</p>
          <p className="demo-note">
            Fictional demo · No money is charged.
            <br />
            Your actions are saved for this browser only.{" "}
            <Link href="/me">Your demo profile</Link>
          </p>
        </footer>
      )}
    </Context.Provider>
  );
}
export function Avatar({ id, size = "" }: { id: string; size?: string }) {
  const o = organizerById(id);
  return (
    <span
      className={"avatar " + size}
      style={{ background: o?.color }}
      aria-hidden="true"
    >
      {o?.initials || "Y"}
    </span>
  );
}
export function FollowButton({
  type,
  id,
  compact = false,
  sourceId,
}: {
  type: "community" | "fundraiser" | "organizer";
  id: string;
  compact?: boolean;
  sourceId?: string;
}) {
  const { viewer, act } = useDemo();
  const [pending, setPending] = useState(false),
    [error, setError] = useState("");
  const active = viewer.follows.some(
    (f) => f.target_type === type && f.target_id === id,
  );
  async function follow() {
    setPending(true);
    setError("");
    try {
      await act({
        action: "follow",
        targetType: type,
        targetId: id,
        active: !active,
        ...(sourceId ? { sourceId } : {}),
      });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setPending(false);
    }
  }
  return (
    <span className="control-group">
      <button
        className={compact ? "button small secondary" : "button secondary"}
        onClick={follow}
        aria-pressed={active}
        disabled={pending}
      >
        {active ? <Check size={16} /> : <Plus size={16} />}{" "}
        {pending ? "Saving…" : active ? "Following" : "Follow"}
      </button>
      {error && (
        <span className="error" role="alert">
          {error}
        </span>
      )}
    </span>
  );
}
export function Funding({
  campaign,
  large = false,
}: {
  campaign: Campaign;
  large?: boolean;
}) {
  const { viewer } = useDemo();
  const f = funding(campaign, viewer.donations);
  return (
    <div className={"funding " + (large ? "funding-large" : "")}>
      <div className="funding-line">
        <span>
          <strong>{money(f.raised)}</strong>{" "}
          <span className="muted">raised</span>
        </span>
        <span>{f.percent}%</span>
      </div>
      <div
        className="progress-track"
        role="progressbar"
        aria-label="Funding progress"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.min(100, f.percent)}
        aria-valuetext={`${f.percent}% funded`}
      >
        <span style={{ width: Math.min(100, f.percent) + "%" }} />
      </div>
      <div className="funding-foot">
        <span>{money(f.goal)} goal</span>
        <span>{f.count} contributions</span>
      </div>
    </div>
  );
}
export function CampaignCard({
  campaign,
  priority = false,
}: {
  campaign: Campaign;
  priority?: boolean;
}) {
  const o = organizerById(campaign.organizerId)!;
  const media = useRef<HTMLAnchorElement>(null);
  const [imageReady, setImageReady] = useState(priority);
  useEffect(() => {
    if (imageReady) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setImageReady(true);
          observer.disconnect();
        }
      },
      { rootMargin: "200px" },
    );
    if (media.current) observer.observe(media.current);
    return () => observer.disconnect();
  }, [imageReady]);
  return (
    <article className="campaign-card">
      <Link
        ref={media}
        className="card-image-link"
        href={"/fundraisers/" + campaign.id}
        onClick={() => {
          sessionStorage.setItem(
            "discovery-return",
            JSON.stringify({
              url: location.pathname + location.search,
              y: window.scrollY,
            }),
          );
          track("discovery_card_open", campaign.id);
        }}
      >
        {imageReady || priority ? (
          <Image
            quality={60}
            className="card-photo"
            src={campaign.image}
            alt={campaign.alt}
            width={800}
            height={900}
            sizes="(max-width:650px) 100vw, (max-width:1000px) 50vw, 25vw"
            priority={priority}
            fetchPriority={priority ? "high" : undefined}
          />
        ) : (
          <div className="card-photo" role="img" aria-label={campaign.alt} />
        )}
        <span className="card-topic">{campaign.topic}</span>
        <span className="card-arrow">
          <ArrowUpRight size={22} />
        </span>
      </Link>
      <div className="card-content">
        <Link className="organizer-line" href={"/profiles/" + o.id}>
          <Avatar id={o.id} size="tiny" />
          {o.name}
        </Link>
        <Link
          href={"/fundraisers/" + campaign.id}
          className="card-title-link"
          onClick={() => {
            sessionStorage.setItem(
              "discovery-return",
              JSON.stringify({
                url: location.pathname + location.search,
                y: window.scrollY,
              }),
            );
            track("discovery_card_open", campaign.id);
          }}
        >
          <h3>{campaign.shortTitle}</h3>
        </Link>
        <p className="card-need">{campaign.need}</p>
        <Funding campaign={campaign} />
      </div>
    </article>
  );
}
export function CommunityHero() {
  const { viewer } = useDemo();
  const totals = campaigns.map((c) => funding(c, viewer.donations));
  return (
    <section className="community-hero container">
      <div className="hero-copy">
        <p className="eyebrow">
          <Leaf size={15} /> A COMMUNITY FOR THE COMMON GOOD
        </p>
        <h1>
          A greener
          <br />
          <span>tomorrow.</span>
        </h1>
        <p className="hero-description">
          Small acts. Shared roots.
          <br /> A future we build together.
        </p>
        <p className="location">
          <MapPin size={15} /> Portland, Oregon <span>·</span> Fictional
          community
        </p>
        <div className="hero-actions">
          <FollowButton type="community" id={community.id} />
          <ShareButton id={community.id} type="community" />
        </div>
        <div className="hero-metrics">
          <div>
            <strong>{money(totals.reduce((n, f) => n + f.raised, 0))}</strong>
            <span>raised together</span>
          </div>
          <div>
            <strong>{totals.reduce((n, f) => n + f.count, 0)}</strong>
            <span>contributions</span>
          </div>
          <div>
            <strong>4</strong>
            <span>local projects</span>
          </div>
        </div>
      </div>
      <div className="hero-art">
        <Image
          quality={60}
          src="/media/forest.jpg"
          alt="A green forest, representing the community's shared care for nature"
          fill
          loading="eager"
          fetchPriority="high"
          sizes="(max-width:650px) 100vw, 48vw"
        />
        <div className="hero-sticker">
          <Leaf size={28} />
          <span>
            Good things
            <br />
            grow together.
          </span>
        </div>
        <div className="hero-caption">
          <span className="live-dot" /> PEOPLE MAKING A DIFFERENCE
        </div>
      </div>
    </section>
  );
}
export function Discovery() {
  const { viewer } = useDemo();
  const params = useSearchParams();
  const view = params.get("view") === "following" ? "following" : "discover",
    query = params.get("q") || "",
    topic = params.get("topic") || "";
  useEffect(() => {
    const restore = () => {
      try {
        const saved = sessionStorage.getItem("discovery-return");
        if (!saved) return;
        const entry = JSON.parse(saved);
        if (entry.url === location.pathname + location.search) {
          sessionStorage.removeItem("discovery-return");
          requestAnimationFrame(() =>
            requestAnimationFrame(() => window.scrollTo(0, entry.y)),
          );
        }
      } catch {
        // Storage can be disabled; ordinary navigation still works.
      }
    };
    restore();
    window.addEventListener("popstate", restore);
    return () => window.removeEventListener("popstate", restore);
  }, []);
  function change(v: string, q: string, t: string, kind: string) {
    const p = new URLSearchParams(location.search);
    const put = (key: string, value: string) =>
      value ? p.set(key, value) : p.delete(key);
    if (kind === "view" || kind === "reset")
      put("view", v === "following" ? v : "");
    if (kind === "search" || kind === "reset") put("q", q);
    if (kind === "topic" || kind === "reset") put("topic", t);
    window.history.replaceState(
      null,
      "",
      location.pathname + (p.size ? "?" + p.toString() : ""),
    );
    track("discovery_filter_changed", community.id, { filterType: kind });
  }
  const followed = followingCampaigns(viewer.follows);
  const items = searchCampaigns(
    view === "following" ? followed : campaigns,
    query,
    topic,
  );
  const updates = items
    .flatMap((c) => c.updates.map((u) => ({ ...u, campaign: c })))
    .sort((a, b) => b.date.localeCompare(a.date) || a.id.localeCompare(b.id));
  const communityFollowed = viewer.follows.some(
    (f) => f.target_type === "community" && f.target_id === community.id,
  );
  return (
    <section id="discover" className="discovery container">
      {view === "discover" && (
        <DiscoveryConcierge onNavigate={rememberDiscovery} />
      )}
      <div className="discovery-top">
        <div className="discovery-views">
          <div className="tabs" role="tablist" aria-label="Campaign views">
            <button
              role="tab"
              aria-selected={view === "discover"}
              onClick={() => change("discover", query, topic, "view")}
            >
              Discover
            </button>
            <button
              role="tab"
              aria-selected={view === "following"}
              onClick={() => change("following", query, topic, "view")}
            >
              Following <span>{followed.length}</span>
            </button>
          </div>
          <Link
            className="watch-discovery-link"
            href={"/communities/" + community.id + "/watch"}
            prefetch={false}
            onClick={rememberDiscovery}
          >
            Watch <ArrowUpRight size={16} />
          </Link>
        </div>
        <label className="search">
          <Search size={18} />
          <input
            aria-label="Search campaigns"
            placeholder="Find your kind of good"
            value={query}
            onChange={(e) => change(view, e.target.value, topic, "search")}
          />
        </label>
      </div>
      <div className="topic-row">
        <button
          className={"topic " + (!topic ? "selected" : "")}
          onClick={() => change(view, query, "", "topic")}
        >
          <Leaf size={15} /> All causes
        </button>
        {topics.map((t) => (
          <button
            key={t}
            className={"topic " + (topic === t ? "selected" : "")}
            onClick={() => change(view, query, t, "topic")}
          >
            {t}
          </button>
        ))}
        {(query || topic) && (
          <button
            className="text-button"
            onClick={() => change(view, "", "", "reset")}
          >
            Reset filters
          </button>
        )}
      </div>
      <div className="section-intro">
        <div>
          <p className="eyebrow">A LITTLE HELP STARTS HERE</p>
          <h2>
            {view === "following"
              ? "Good you’re following"
              : "Find a cause that feels like you."}
          </h2>
        </div>
        <span className="muted">
          {items.length} {items.length === 1 ? "project" : "projects"}
        </span>
      </div>
      {items.length ? (
        <div className="campaign-grid">
          {items.map((c) => (
            <CampaignCard campaign={c} key={c.id} />
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <Leaf size={36} />
          <h3>
            {view === "following" && !followed.length
              ? "Your next good thing is out there."
              : "No causes match just yet."}
          </h3>
          <p>
            {view === "following" && !followed.length
              ? "Follow a community, organizer, or fundraiser to see their projects here."
              : "Try another search or clear your filters."}
          </p>
          <button
            className="button"
            onClick={() => change("discover", "", "", "reset")}
          >
            Explore all causes <ArrowRight size={18} />
          </button>
        </div>
      )}
      <div className="updates-section">
        <div className="section-intro">
          <div>
            <p className="eyebrow">THE GOOD KEEPS GROWING</p>
            <h2>From the community</h2>
          </div>
          <span className="muted">Latest updates</span>
        </div>
        <div className="update-grid">
          {(view === "discover" || communityFollowed) &&
            community.updates.map((u) => (
              <article className="update-card community-update" key={u.id}>
                <span className="update-kind">
                  <Users size={15} /> COMMUNITY UPDATE
                </span>
                <h3>{u.title}</h3>
                <p>{u.body}</p>
                <span className="muted">
                  A greener tomorrow · {dateLabel(u.date)}
                </span>
              </article>
            ))}
          {updates.slice(0, 3).map((u) => {
            const seen = viewer.views.find(
              (v) => v.campaign_id === u.campaign.id,
            );
            const fresh = seen && u.date > seen.viewed_at;
            return (
              <article className="update-card" key={u.id}>
                <span className="update-kind">
                  FUNDRAISER UPDATE{" "}
                  {fresh && <strong className="new-badge">New</strong>}
                </span>
                <Link href={"/fundraisers/" + u.campaign.id + "#" + u.id}>
                  <h3>
                    {u.title} <ArrowUpRight size={18} />
                  </h3>
                </Link>
                <p>{u.body}</p>
                <div className="organizer-line">
                  <Avatar id={u.campaign.organizerId} size="tiny" />
                  <span>
                    {organizerById(u.campaign.organizerId)?.name}
                    <small>{dateLabel(u.date)}</small>
                  </span>
                </div>
              </article>
            );
          })}
        </div>
      </div>
      <div className="community-note">
        <Leaf size={32} />
        <div>
          <h3>Change starts with a few of us.</h3>
          <p>Meet the neighbors turning shared ideas into everyday good.</p>
        </div>
        <Link className="button secondary" href="/profiles/maya-chen">
          Meet an organizer <ArrowUpRight size={17} />
        </Link>
      </div>
    </section>
  );
}
export function ShareButton({
  id,
  type = "fundraiser",
  onOpenChange,
  sourceId,
  returnFocusRef,
}: {
  id: string;
  type?: "fundraiser" | "community";
  onOpenChange?: (open: boolean) => void;
  sourceId?: string;
  returnFocusRef?: RefObject<HTMLElement | null>;
}) {
  const activeSource = useRef<string | undefined>(undefined);
  const [open, setOpen] = useState(false),
    [status, setStatus] = useState("");
  const route = (type === "community" ? "/communities/" : "/fundraisers/") + id;
  const [url, setUrl] = useState("");
  function properties() {
    return activeSource.current
      ? { source: "watch", sourceId: activeSource.current }
      : {};
  }
  function show() {
    activeSource.current = sourceId;
    setUrl(location.origin + route);
    setStatus("");
    setOpen(true);
    onOpenChange?.(true);
    track("share_opened", id, properties());
  }
  async function copy() {
    const source = properties();
    try {
      await navigator.clipboard.writeText(url);
      setStatus("Link copied. A little good travels far.");
      track("share_copied", id, source);
    } catch {
      setStatus(
        "Copy is unavailable. Select the link below and copy it manually.",
      );
      track("share_failed", id, source);
    }
  }
  async function native() {
    const source = properties();
    try {
      await navigator.share({ title: "A little good goes a long way", url });
      setStatus("Your browser completed the share.");
      track("native_share_completed", id, source);
    } catch (e) {
      const canceled = (e as Error).name === "AbortError";
      setStatus(
        canceled
          ? "Sharing canceled."
          : "Sharing is unavailable. You can copy the link.",
      );
      track(canceled ? "share_cancelled" : "share_failed", id, source);
    }
  }
  return (
    <>
      <button className="button secondary" onClick={show}>
        <Share2 size={17} /> Share
      </button>
      {open && (
        <Dialog
          title="Pass a little good along"
          returnFocusRef={returnFocusRef}
          onClose={() => {
            setOpen(false);
            onOpenChange?.(false);
          }}
        >
          <p>Share this cause with someone who cares.</p>
          <label className="field">
            Public link
            <input readOnly value={url} onFocus={(e) => e.target.select()} />
          </label>
          <div className="button-row">
            <button className="button" onClick={copy}>
              <Copy size={16} /> Copy link
            </button>
            {typeof navigator !== "undefined" &&
              typeof navigator.share === "function" && (
                <button className="button secondary" onClick={native}>
                  Share with…
                </button>
              )}
          </div>
          <p role="status">{status}</p>
        </Dialog>
      )}
    </>
  );
}
export function DonateButton({
  campaign,
  wide = false,
  label = "Make a difference",
  onOpenChange,
  sourceId,
  returnFocusRef,
}: {
  campaign: Campaign;
  wide?: boolean;
  label?: string;
  onOpenChange?: (open: boolean) => void;
  sourceId?: string;
  returnFocusRef?: RefObject<HTMLElement | null>;
}) {
  const { act } = useDemo();
  const activeAttempt = useRef<string | null>(null);
  const activeSource = useRef<string | undefined>(undefined);
  const [confirmedCents, setConfirmedCents] = useState(0);
  const [open, setOpen] = useState(false),
    [amount, setAmount] = useState("25"),
    [key, setKey] = useState(""),
    [pending, setPending] = useState(false),
    [error, setError] = useState(""),
    [done, setDone] = useState(false);
  function start() {
    const k = crypto.randomUUID();
    activeSource.current = sourceId;
    activeAttempt.current = k;
    setKey(k);
    setPending(false);
    setOpen(true);
    onOpenChange?.(true);
    setDone(false);
    setError("");
    track("donation_started", campaign.id, {
      attemptId: k,
      ...(sourceId ? { source: "watch", sourceId } : {}),
    });
  }
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (pending) return;
    setPending(true);
    setError("");
    try {
      const submittedCents = amountCents(amount);
      await act({
        action: "donate",
        campaignId: campaign.id,
        amount,
        key,
        ...(activeSource.current ? { sourceId: activeSource.current } : {}),
      });
      if (activeAttempt.current === key) {
        setConfirmedCents(submittedCents);
        setDone(true);
      }
    } catch (e) {
      if (activeAttempt.current === key) setError((e as Error).message);
    } finally {
      if (activeAttempt.current === key) setPending(false);
    }
  }
  return (
    <>
      <button
        className={"button primary " + (wide ? "wide" : "")}
        onClick={start}
      >
        <Heart size={18} /> {label} <ArrowUpRight size={18} />
      </button>
      {open && (
        <Dialog
          title={done ? "A little good, added." : "Support this good thing"}
          returnFocusRef={returnFocusRef}
          onClose={() => {
            activeAttempt.current = null;
            setOpen(false);
            onOpenChange?.(false);
          }}
        >
          {done ? (
            <div className="confirmation">
              <span className="confirmation-icon">
                <Check size={32} />
              </span>
              <h3>{money(confirmedCents, true)} in simulated support</h3>
              <p>
                No money was charged. Your contribution is saved in this
                browser’s demo and reflected in this cause’s progress.
              </p>
              <Link className="button" href="/me">
                See your impact <ArrowRight size={18} />
              </Link>
            </div>
          ) : (
            <form onSubmit={submit}>
              <p>{campaign.title}</p>
              <p className="demo-banner">
                <CircleHelp size={16} /> Demo donation · No money is charged.
              </p>
              <div className="amounts">
                {["10", "25", "50", "100"].map((n) => (
                  <button
                    type="button"
                    className={amount === n ? "selected" : ""}
                    key={n}
                    disabled={pending}
                    onClick={() => setAmount(n)}
                  >
                    ${n}
                  </button>
                ))}
              </div>
              <label className="field">
                Amount in USD
                <input
                  aria-label="Donation amount"
                  disabled={pending}
                  inputMode="decimal"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  required
                />
              </label>
              <small>Choose $1 to $10,000. No payment details needed.</small>
              {error && (
                <p className="error" role="alert">
                  {error}
                </p>
              )}
              <button className="button primary wide" disabled={pending}>
                {pending
                  ? "Saving your support…"
                  : "Confirm simulated donation"}{" "}
                <Heart size={17} />
              </button>
            </form>
          )}
        </Dialog>
      )}
    </>
  );
}
export function FeatureButton({ campaign }: { campaign: Campaign }) {
  const { viewer, act } = useDemo();
  const feature = viewer.features.find((f) => f.campaign_id === campaign.id);
  const [open, setOpen] = useState(false),
    [reason, setReason] = useState(feature?.reason || ""),
    [error, setError] = useState(""),
    [pending, setPending] = useState(false);
  async function save(active: boolean) {
    setPending(true);
    try {
      await act({ action: "feature", campaignId: campaign.id, reason, active });
      setOpen(false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setPending(false);
    }
  }
  return (
    <>
      <button
        className="button secondary"
        onClick={() => {
          setReason(feature?.reason || "");
          setOpen(true);
        }}
      >
        <Bookmark size={16} />
        {feature ? "Featured on my profile" : "Feature this cause"}
      </button>
      {open && (
        <Dialog
          title="Make this cause part of your story"
          onClose={() => setOpen(false)}
        >
          <p>Your featured causes are private to this demo browser.</p>
          <label className="field">
            Why does this matter to you?{" "}
            <span className="muted">(optional)</span>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              maxLength={280}
              rows={4}
            />
          </label>
          <small>{reason.length}/280 characters</small>
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          <div className="button-row">
            <button
              className="button"
              disabled={pending}
              onClick={() => save(true)}
            >
              Save to my profile
            </button>
            {feature && (
              <button
                className="text-button"
                disabled={pending}
                onClick={() => save(false)}
              >
                Remove feature
              </button>
            )}
          </div>
        </Dialog>
      )}
    </>
  );
}
export function ProgressHistory({
  campaign,
  snapshotAt,
}: {
  campaign: Campaign;
  snapshotAt: string;
}) {
  const { viewer } = useDemo();
  const [live, setLive] = useState(true);
  const [range, setRange] = useState<"7" | "30" | "all">("30");
  useEffect(() => {
    const showSource = () => {
      if (location.hash === "#funding") setLive(false);
    };
    showSource();
    window.addEventListener("hashchange", showSource);
    return () => window.removeEventListener("hashchange", showSource);
  }, []);
  // Reuse the server snapshot through hydration and range changes. A refresh
  // supplies a new snapshot without independently reading the browser clock.
  const h = history(campaign, viewer.donations, range, new Date(snapshotAt));
  const max = Math.max(...h.points.map((p) => p.cents), 1);
  const points = h.points
    .map(
      (p, i) =>
        `${(i / (h.points.length - 1)) * 600},${145 - (p.cents / max) * 130}`,
    )
    .join(" ");
  return (
    <section
      id="funding"
      onFocus={(event) => {
        if (event.target === event.currentTarget) setLive(false);
      }}
      tabIndex={-1}
      className="progress-section source-section"
    >
      <div className="section-intro">
        <div>
          <p className="eyebrow">MOMENTUM, MADE TOGETHER</p>
          <h2>Every bit adds up.</h2>
        </div>
        <div className="range-controls" aria-label="Funding history range">
          <button aria-pressed={live} onClick={() => setLive(true)}>
            Live demo
          </button>
          {(["7", "30", "all"] as const).map((r) => (
            <button
              aria-pressed={!live && r === range}
              key={r}
              onClick={() => {
                setRange(r);
                setLive(false);
              }}
            >
              {r === "all" ? "All time" : r + " days"}
            </button>
          ))}
        </div>
      </div>
      {live && <LiveDonationChart key={campaign.id} />}
      <div className="recorded-funding-history" hidden={live}>
        <p>
          <strong>{money(h.change)}</strong> from {h.count} contributions in
          this period
        </p>
        <svg
          className="history-chart"
          viewBox="0 0 600 160"
          role="img"
          aria-label={`Cumulative USD funding. ${money(h.change)} added during the selected period.`}
        >
          <line x1="0" x2="600" y1="145" y2="145" stroke="#dfe6da" />
          <polyline
            points={points}
            fill="none"
            stroke="#2b704d"
            strokeWidth="3"
            strokeLinejoin="round"
          />
          <circle
            cx="600"
            cy={
              h.points.at(-1) ? 145 - (h.points.at(-1)!.cents / max) * 130 : 145
            }
            r="4"
            fill="#2b704d"
          />
        </svg>
        <div className="funding-foot">
          <span>{dateLabel(h.start)}</span>
          <span>{dateLabel(h.end)} · USD · UTC</span>
        </div>
        <details className="chart-table">
          <summary>View the dated funding data</summary>
          <p>
            Cumulative balance includes contributions before this period.
            Snapshot: {h.end.slice(0, 16).replace("T", " ")} UTC.
          </p>
          <table>
            <caption>Daily cumulative funding in USD</caption>
            <thead>
              <tr>
                <th>Date (UTC)</th>
                <th>Balance</th>
              </tr>
            </thead>
            <tbody>
              {h.points.map((p, i) => (
                <tr key={i}>
                  <td>{p.label}</td>
                  <td>{money(p.cents, true)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      </div>
    </section>
  );
}
export function Updates({ campaign }: { campaign: Campaign }) {
  const { act } = useDemo();
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    let recorded = false;
    const ob = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting) && !recorded) {
          recorded = true;
          void act({ action: "view-updates", campaignId: campaign.id }).catch(
            () => {},
          );
        }
      },
      { threshold: 0.1 },
    );
    if (ref.current) ob.observe(ref.current);
    return () => ob.disconnect();
  }, [campaign.id, act]);
  return (
    <section ref={ref} id="updates" className="source-section">
      <p className="eyebrow">FROM THE ORGANIZER</p>
      <h2>Good things are happening.</h2>
      {campaign.updates.map((u) => (
        <article
          key={u.id}
          id={u.id}
          tabIndex={-1}
          className="timeline-update source-section"
        >
          <div className="organizer-line">
            <Avatar id={campaign.organizerId} size="tiny" />
            {organizerById(campaign.organizerId)?.name}
            <span className="muted">{dateLabel(u.date)}</span>
          </div>
          <h3>{u.title}</h3>
          <p>{u.body}</p>
        </article>
      ))}
    </section>
  );
}
export function AskButton({ campaign }: { campaign: Campaign }) {
  const [open, setOpen] = useState(false);
  const [Panel, setPanel] = useState<
    typeof import("./ask-panel").default | null
  >(null);
  const [loadError, setLoadError] = useState("");
  async function openPanel() {
    setOpen(true);
    if (Panel) return;
    setLoadError("");
    try {
      const panelModule = await import("./ask-panel");
      setPanel(() => panelModule.default);
    } catch {
      setLoadError("The assistant could not open. Please try again.");
    }
  }
  return (
    <>
      <button className="ask-entry" onClick={() => void openPanel()}>
        <span className="sparkle-box">
          <Sparkles size={21} />
        </span>
        <span>
          <strong>A little clarity before you give.</strong>
          <small>Ask about this fundraiser</small>
        </span>
        <ArrowUpRight size={20} />
      </button>
      {open &&
        (Panel ? (
          <Panel
            key={campaign.id}
            campaign={campaign}
            onClose={() => setOpen(false)}
          />
        ) : (
          <Dialog
            title="Ask about this fundraiser"
            onClose={() => setOpen(false)}
          >
            {loadError ? (
              <div role="alert">
                <p>{loadError}</p>
                <button className="button" onClick={() => void openPanel()}>
                  Retry opening assistant
                </button>
              </div>
            ) : (
              <p role="status">Opening the fundraiser assistant…</p>
            )}
          </Dialog>
        ))}
    </>
  );
}
export function FundraiserSidebar({ campaign }: { campaign: Campaign }) {
  return (
    <aside className="support-panel">
      <p className="eyebrow">A LITTLE HELP. A LASTING DIFFERENCE.</p>
      <Funding campaign={campaign} large />
      <DonateButton campaign={campaign} wide />
      <div className="support-secondary">
        <FollowButton type="fundraiser" id={campaign.id} />
        <ShareButton id={campaign.id} />
      </div>
      <p className="support-note">
        Fictional campaign. Donations are simulated.
        <br />
        No money is charged.
      </p>
      <AskButton campaign={campaign} />
      <FeatureButton campaign={campaign} />
    </aside>
  );
}
export function ProfileContent({ organizerId }: { organizerId?: string }) {
  const { viewer } = useDemo();
  const o = organizerById(organizerId || "");
  const own = !o;
  const mine = o
    ? campaigns.filter((c) => c.organizerId === o.id)
    : campaigns.filter((c) =>
        viewer.features.some((f) => f.campaign_id === c.id),
      );
  const entries = o
    ? mine.flatMap((c) => [
        {
          id: c.id,
          date: c.createdAt,
          text: "Started a fundraiser",
          campaign: c,
        },
        ...c.updates.map((u) => ({
          id: u.id,
          date: u.date,
          text: u.title,
          campaign: c,
        })),
      ])
    : [
        ...viewer.donations.map((d) => ({
          id: d.id,
          date: d.created_at,
          text: `Contributed ${money(d.cents, true)} in simulated support`,
          campaign: campaigns.find((c) => c.id === d.campaign_id)!,
        })),
        ...viewer.features.map((f) => ({
          id: f.campaign_id,
          date: f.updated_at,
          text: "Featured a cause",
          campaign: campaigns.find((c) => c.id === f.campaign_id)!,
        })),
      ];
  entries.sort((a, b) => b.date.localeCompare(a.date));
  return (
    <>
      <section className="profile-hero container">
        <Link className="back-link" href={"/communities/" + community.id}>
          <ArrowLeft size={16} /> Back to the community
        </Link>
        <div className="profile-cover">
          <span className="profile-leaf">
            <Leaf size={120} />
          </span>
          <span>GOOD STARTS WITH PEOPLE.</span>
        </div>
        <div className="profile-intro">
          <Avatar id={o?.id || "you"} size="huge" />
          <div>
            <p className="eyebrow">
              {own
                ? "YOUR PRIVATE DEMO PROFILE"
                : "COMMUNITY ORGANIZER · FICTIONAL PROFILE"}
            </p>
            <h1>{o?.name || "Your corner of good."}</h1>
            <p>
              {o?.bio ||
                "The causes you care about. The good you’re part of. All in one place."}
            </p>
            <div className="topic-row">
              {(o?.interests || ["A little good, every day"]).map((t) => (
                <span className="topic" key={t}>
                  {t}
                </span>
              ))}
            </div>
          </div>
          {o && <FollowButton type="organizer" id={o.id} />}
        </div>
      </section>
      <div className="profile-body container">
        <section>
          <p className="eyebrow">
            CAUSES CLOSE TO {own ? "YOUR" : "THEIR"} HEART
          </p>
          <h2>{own ? "Your featured causes" : "Good worth getting behind."}</h2>
          {mine.length ? (
            <div className="profile-cards">
              {mine.map((c, index) => (
                <div key={c.id}>
                  <CampaignCard campaign={c} priority={index === 0} />
                  <blockquote>
                    {o?.reason ||
                      viewer.features.find((f) => f.campaign_id === c.id)
                        ?.reason ||
                      "A cause you care about."}
                  </blockquote>
                  {own && <FeatureButton campaign={c} />}
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <Bookmark size={32} />
              <h3>Make room for what matters.</h3>
              <p>
                Feature a fundraiser and add a few words about why you care.
              </p>
              <Link className="button" href={"/communities/" + community.id}>
                Discover a cause <ArrowRight size={16} />
              </Link>
            </div>
          )}
          <section className="profile-activity">
            <h2>A little good, along the way.</h2>
            {entries.length ? (
              entries.map((e) => (
                <article key={e.id} className="activity-row">
                  <span className="activity-icon">
                    <Heart size={17} />
                  </span>
                  <div>
                    <p>{e.text}</p>
                    <Link href={"/fundraisers/" + e.campaign.id}>
                      {e.campaign.title}
                    </Link>
                    <small>
                      {dateLabel(e.date)} ·{" "}
                      {own ? "Your demo activity" : "Fictional seed activity"}
                    </small>
                  </div>
                </article>
              ))
            ) : (
              <p className="muted">
                Your story starts with your first small act.{" "}
                <Link href={"/communities/" + community.id}>
                  Explore the community.
                </Link>
              </p>
            )}
          </section>
        </section>
        <aside className="profile-aside">
          <Leaf size={28} />
          <h3>Part of something bigger.</h3>
          <Link href={"/communities/" + community.id}>
            A greener tomorrow <ArrowUpRight size={17} />
          </Link>
          <p>Neighbors building a better future, together.</p>
          {own && (
            <>
              <h3>You’re following</h3>
              {viewer.follows.length ? (
                viewer.follows.map((f) => (
                  <Link
                    className="followed-link"
                    key={f.target_type + f.target_id}
                    href={
                      (f.target_type === "community"
                        ? "/communities/"
                        : f.target_type === "organizer"
                          ? "/profiles/"
                          : "/fundraisers/") + f.target_id
                    }
                  >
                    {f.target_type === "community"
                      ? community.name
                      : f.target_type === "organizer"
                        ? organizerById(f.target_id)?.name
                        : campaigns.find((c) => c.id === f.target_id)
                            ?.shortTitle}{" "}
                    <ArrowUpRight size={14} />
                  </Link>
                ))
              ) : (
                <p>Follow people and causes to stay connected.</p>
              )}
              <p className="demo-note">
                Your activity and notes are private to this browser. Clearing
                its cookie starts a new demo.
              </p>
            </>
          )}
        </aside>
      </div>
    </>
  );
}
