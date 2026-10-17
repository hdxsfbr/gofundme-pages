"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "@/components/link";
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Captions,
  CaptionsOff,
  RotateCcw,
  Volume2,
  VolumeX,
  Play,
  Pause,
  LoaderCircle,
} from "lucide-react";
import { campaignById, community, organizerById } from "@/lib/content";
import {
  campaignClips,
  clipById,
  type CampaignClip,
} from "@/lib/video-content";
import {
  Avatar,
  DonateButton,
  FollowButton,
  Funding,
  ShareButton,
  track,
} from "@/components/experience";
import { Dialog } from "@/components/dialog";
import "./watch-feed.css";

const returnKey = `watch-return:${community.id}:v1`;
type WatchMemory = {
  communityId: string;
  clipId: string;
  positions: Record<string, number>;
  paused: boolean;
  muted: boolean;
  captions: boolean;
};

function readMemory(): WatchMemory | null {
  try {
    const parsed = JSON.parse(sessionStorage.getItem(returnKey) || "null");
    if (
      parsed?.communityId !== community.id ||
      typeof parsed.clipId !== "string" ||
      !parsed.positions ||
      typeof parsed.positions !== "object" ||
      Array.isArray(parsed.positions) ||
      typeof parsed.paused !== "boolean" ||
      typeof parsed.muted !== "boolean" ||
      typeof parsed.captions !== "boolean"
    )
      return null;
    return parsed as WatchMemory;
  } catch {
    return null;
  }
}

function safePosition(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? value
    : 0;
}

function visibleEnough(element: HTMLElement | null, root: HTMLElement | null) {
  if (!element || !root) return false;
  const item = element.getBoundingClientRect();
  const frame = root.getBoundingClientRect();
  const shown = Math.max(
    0,
    Math.min(item.bottom, frame.bottom) - Math.max(item.top, frame.top),
  );
  return shown >= Math.min(item.height, frame.height) * 0.8;
}

export function WatchFeed({
  initialClipId,
  initialInvalidClip,
}: {
  initialClipId?: string;
  initialInvalidClip?: string;
}) {
  const initialIndex = Math.max(
    0,
    campaignClips.findIndex((clip) => clip.id === initialClipId),
  );
  const [ready, setReady] = useState(false);
  const [invalidClip, setInvalidClip] = useState(initialInvalidClip || "");
  const [activeIndex, setActiveIndex] = useState(initialIndex);
  const [transitioning, setTransitioning] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const [transcriptOpen, setTranscriptOpen] = useState(false);
  const [desiredPlaying, setDesiredPlaying] = useState(true);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(true);
  const [captions, setCaptions] = useState(true);
  const [blocked, setBlocked] = useState(false);
  const [loading, setLoading] = useState(true);
  const [mediaError, setMediaError] = useState(false);
  const [retryKey, setRetryKey] = useState(0);
  const [pageVisible, setPageVisible] = useState(true);
  const [qualifiedView, setQualifiedView] = useState(false);
  const [liveMessage, setLiveMessage] = useState("");
  const scrollerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const playbackAllowedRef = useRef(false);
  const itemRefs = useRef<Array<HTMLElement | null>>([]);
  const panelTriggerRef = useRef<HTMLElement | null>(null);
  const positionRef = useRef<Record<string, number>>({});
  const initializedRef = useRef(false);
  const activeIndexRef = useRef(initialIndex);
  const activeClipRef = useRef<CampaignClip | undefined>(
    campaignClips[initialIndex],
  );
  const desiredRef = useRef(true);
  const mutedRef = useRef(true);
  const captionsRef = useRef(true);
  const settlingRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Target of an in-flight button/key/wheel/swipe step. Settling uses it
  // instead of the scroll offset so a slow smooth scroll cannot snap back.
  const pendingTargetRef = useRef<number | null>(null);
  const lastStepRef = useRef(0);
  const touchStartRef = useRef<{
    pointerId: number;
    x: number;
    y: number;
  } | null>(null);
  const lastSaveRef = useRef(0);
  const impressionsRef = useRef(new Set<string>());
  const playsRef = useRef(new Set<string>());
  const observedTimeRef = useRef(0);

  const endIndex = campaignClips.length;
  const activeClip = campaignClips[activeIndex];
  const isEnd = activeIndex === endIndex && campaignClips.length > 0;
  const isModalOpen = panelOpen || transcriptOpen;

  const save = useCallback((force = false) => {
    const clip = activeClipRef.current;
    if (!initializedRef.current || !clip) return;
    const now = Date.now();
    if (!force && now - lastSaveRef.current < 1000) return;
    lastSaveRef.current = now;
    const video = videoRef.current;
    if (video && Number.isFinite(video.currentTime)) {
      positionRef.current[clip.id] = video.currentTime;
    }
    try {
      sessionStorage.setItem(
        returnKey,
        JSON.stringify({
          communityId: community.id,
          clipId: clip.id,
          positions: positionRef.current,
          paused: !desiredRef.current,
          muted: mutedRef.current,
          captions: captionsRef.current,
        } satisfies WatchMemory),
      );
    } catch {
      // Playback remains usable when tab storage is unavailable.
    }
  }, []);

  const replaceClipUrl = useCallback((clipId: string) => {
    const url = new URL(window.location.href);
    url.searchParams.set("clip", clipId);
    window.history.replaceState(
      window.history.state,
      "",
      url.pathname + url.search + url.hash,
    );
  }, []);

  useEffect(() => {
    let alignFrame = 0;
    const frame = requestAnimationFrame(() => {
      const query = new URLSearchParams(window.location.search).get("clip");
      const saved = readMemory();
      const explicit = query ? clipById(query) : undefined;
      const selected = query
        ? explicit
        : saved
          ? clipById(saved.clipId)
          : campaignClips[0];
      if (query && !explicit) {
        setInvalidClip(query);
        setReady(true);
        return;
      }
      if (selected) {
        const index = campaignClips.findIndex(
          (clip) => clip.id === selected.id,
        );
        activeIndexRef.current = index;
        activeClipRef.current = selected;
        setActiveIndex(index);
        const reducedMotion = window.matchMedia(
          "(prefers-reduced-motion: reduce)",
        ).matches;
        if (saved && (!query || query === saved.clipId)) {
          positionRef.current = saved.positions;
          desiredRef.current = !reducedMotion && !saved.paused;
          mutedRef.current = saved.muted;
          captionsRef.current = saved.captions;
          setDesiredPlaying(!reducedMotion && !saved.paused);
          setMuted(saved.muted);
          setCaptions(saved.captions);
        } else if (reducedMotion) {
          desiredRef.current = false;
          setDesiredPlaying(false);
        }
        replaceClipUrl(selected.id);
        setLiveMessage(
          `Clip ${index + 1} of ${campaignClips.length}: ${selected.title}`,
        );
        initializedRef.current = true;
      }
      setReady(true);
      track("video_feed_opened", community.id);
      if (selected) {
        const index = campaignClips.findIndex(
          (clip) => clip.id === selected.id,
        );
        alignFrame = requestAnimationFrame(() => {
          const root = scrollerRef.current;
          root?.scrollTo({
            top: index * (root.clientHeight || 0),
            behavior: "instant",
          });
          setQualifiedView(visibleEnough(itemRefs.current[index], root));
        });
      }
    });
    return () => {
      cancelAnimationFrame(frame);
      cancelAnimationFrame(alignFrame);
    };
  }, [replaceClipUrl]);

  useEffect(() => {
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onPreferenceChange = (event: MediaQueryListEvent) => {
      if (!event.matches) return;
      desiredRef.current = false;
      setDesiredPlaying(false);
      playbackAllowedRef.current = false;
      videoRef.current?.pause();
      save(true);
    };
    preference.addEventListener("change", onPreferenceChange);
    return () => preference.removeEventListener("change", onPreferenceChange);
  }, [save]);

  useEffect(() => {
    const onVisibility = () => {
      setPageVisible(document.visibilityState === "visible");
      if (document.visibilityState !== "visible") {
        playbackAllowedRef.current = false;
        save(true);
      }
    };
    const onPageHide = () => save(true);
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", onPageHide);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", onPageHide);
      save(true);
    };
  }, [save]);

  useEffect(() => {
    const media = videoRef.current;
    const position = safePosition(
      activeClip ? positionRef.current[activeClip.id] : undefined,
    );
    if (
      !media ||
      !ready ||
      !activeClip ||
      position <= 0 ||
      media.readyState < 1
    )
      return;
    const duration = media.duration;
    media.currentTime = Number.isFinite(duration)
      ? Math.min(position, Math.max(0, duration - 0.25))
      : position;
  }, [activeClip, ready, retryKey]);

  useEffect(() => {
    const media = videoRef.current;
    if (!media || !ready || !activeClip) return;
    if (media.error) {
      playbackAllowedRef.current = false;
      setMediaError(true);
      setLoading(false);
      setPlaying(false);
      return;
    }
    media.muted = muted;
    if (media.textTracks[0])
      media.textTracks[0].mode = captions ? "showing" : "disabled";
    const mayPlay =
      desiredPlaying &&
      pageVisible &&
      !isModalOpen &&
      !transitioning &&
      !mediaError &&
      qualifiedView;
    if (!mayPlay) {
      playbackAllowedRef.current = false;
      media.pause();
      return;
    }
    playbackAllowedRef.current = true;
    let canceled = false;
    void media
      .play()
      .then(() => {
        if (canceled || !playbackAllowedRef.current) {
          media.pause();
          return;
        }
        setBlocked(false);
      })
      .catch(() => {
        if (!canceled && playbackAllowedRef.current) {
          setBlocked(true);
          setPlaying(false);
        }
      });
    return () => {
      canceled = true;
      playbackAllowedRef.current = false;
      media.pause();
    };
  }, [
    activeClip,
    captions,
    desiredPlaying,
    isModalOpen,
    mediaError,
    muted,
    pageVisible,
    qualifiedView,
    ready,
    retryKey,
    transitioning,
  ]);

  useEffect(() => {
    if (
      !ready ||
      !activeClip ||
      invalidClip ||
      !qualifiedView ||
      transitioning ||
      isModalOpen ||
      !pageVisible
    )
      return;
    if (impressionsRef.current.has(activeClip.id)) return;
    const timer = window.setTimeout(() => {
      if (
        !visibleEnough(itemRefs.current[activeIndex], scrollerRef.current) ||
        document.visibilityState !== "visible"
      )
        return;
      impressionsRef.current.add(activeClip.id);
      track("video_clip_impression", activeClip.campaignId, {
        source: "watch",
        sourceId: activeClip.id,
      });
    }, 1000);
    return () => window.clearTimeout(timer);
  }, [
    activeClip,
    activeIndex,
    invalidClip,
    isModalOpen,
    pageVisible,
    qualifiedView,
    ready,
    transitioning,
  ]);

  const settle = useCallback(() => {
    const root = scrollerRef.current;
    if (!root || !root.clientHeight) return;
    const pending = pendingTargetRef.current;
    pendingTargetRef.current = null;
    const destination =
      pending ?? Math.round(root.scrollTop / root.clientHeight);
    const current = activeIndexRef.current;
    const next = Math.min(
      endIndex,
      Math.max(0, Math.min(current + 1, Math.max(current - 1, destination))),
    );
    const target = Math.max(0, Math.min(endIndex, next));
    if (target !== current) {
      const outgoing = activeClipRef.current;
      if (outgoing && videoRef.current)
        positionRef.current[outgoing.id] = videoRef.current.currentTime;
      save(true);
      playbackAllowedRef.current = false;
      videoRef.current?.pause();
      activeIndexRef.current = target;
      activeClipRef.current = campaignClips[target];
      setActiveIndex(target);
      setPlaying(false);
      setBlocked(false);
      setMediaError(false);
      setLoading(true);
      observedTimeRef.current = 0;
      const selected = campaignClips[target];
      if (selected) {
        replaceClipUrl(selected.id);
        setLiveMessage(
          `Clip ${target + 1} of ${campaignClips.length}: ${selected.title}`,
        );
      }
    }
    root.scrollTo({ top: target * root.clientHeight, behavior: "instant" });
    setQualifiedView(visibleEnough(itemRefs.current[target], root));
    setTransitioning(false);
  }, [endIndex, replaceClipUrl, save]);

  const navigate = useCallback(
    (target: number, force = false) => {
      if (
        !ready ||
        invalidClip ||
        isModalOpen ||
        target < 0 ||
        target > endIndex
      )
        return;
      if (!force && Date.now() - lastStepRef.current < 360) return;
      if (target === activeIndexRef.current) return;
      lastStepRef.current = Date.now();
      const outgoing = activeClipRef.current;
      if (outgoing && videoRef.current)
        positionRef.current[outgoing.id] = videoRef.current.currentTime;
      save(true);
      playbackAllowedRef.current = false;
      videoRef.current?.pause();
      setPlaying(false);
      setTransitioning(true);
      setBlocked(false);
      setMediaError(false);
      setLoading(true);
      setQualifiedView(false);
      observedTimeRef.current = 0;
      activeIndexRef.current = target;
      activeClipRef.current = campaignClips[target];
      setActiveIndex(target);
      const selected = campaignClips[target];
      if (selected) {
        replaceClipUrl(selected.id);
        setLiveMessage(
          `Clip ${target + 1} of ${campaignClips.length}: ${selected.title}`,
        );
      }
      pendingTargetRef.current = target;
      const root = scrollerRef.current;
      root?.scrollTo({
        top: target * root.clientHeight,
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "instant"
          : "smooth",
      });
      if (settlingRef.current) clearTimeout(settlingRef.current);
      settlingRef.current = setTimeout(settle, 480);
    },
    [endIndex, invalidClip, isModalOpen, ready, replaceClipUrl, save, settle],
  );

  useEffect(() => {
    const root = scrollerRef.current;
    if (!root) return;
    const wheel = (event: WheelEvent) => {
      if (event.ctrlKey) return;
      event.preventDefault();
      if (Math.abs(event.deltaY) < 3 || isModalOpen) return;
      navigate(activeIndexRef.current + (event.deltaY > 0 ? 1 : -1));
    };
    root.addEventListener("wheel", wheel, { passive: false });
    return () => root.removeEventListener("wheel", wheel);
  }, [isModalOpen, navigate]);

  function onScroll() {
    const root = scrollerRef.current;
    if (!root || isModalOpen) return;
    if (
      Math.abs(root.scrollTop - activeIndexRef.current * root.clientHeight) > 8
    ) {
      videoRef.current?.pause();
      setTransitioning(true);
      setQualifiedView(false);
    }
    if (settlingRef.current) clearTimeout(settlingRef.current);
    settlingRef.current = setTimeout(settle, 180);
  }

  function onKeys(event: React.KeyboardEvent<HTMLDivElement>) {
    const target = event.target as HTMLElement;
    if (
      target !== event.currentTarget &&
      target.closest("button, a, input, textarea, select, [contenteditable]")
    )
      return;
    if (
      isModalOpen ||
      !["ArrowDown", "ArrowUp", "PageDown", "PageUp"].includes(event.key)
    )
      return;
    event.preventDefault();
    navigate(
      activeIndexRef.current +
        (["ArrowDown", "PageDown"].includes(event.key) ? 1 : -1),
    );
  }

  function onPointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (event.pointerType !== "touch") return;
    const target = event.target as HTMLElement;
    if (target.closest("a, button, input, textarea, select, [contenteditable]"))
      return;
    touchStartRef.current = {
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
    };
  }

  function onPointerUp(event: React.PointerEvent<HTMLDivElement>) {
    const start = touchStartRef.current;
    touchStartRef.current = null;
    if (!start || start.pointerId !== event.pointerId) return;
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    if (Math.abs(dy) < 52 || Math.abs(dy) < Math.abs(dx) * 1.15) return;
    event.preventDefault();
    navigate(activeIndexRef.current + (dy < 0 ? 1 : -1));
  }

  function onPanelChange(open: boolean) {
    if (open) {
      playbackAllowedRef.current = false;
      panelTriggerRef.current =
        document.activeElement instanceof HTMLElement
          ? document.activeElement
          : null;
      save(true);
      videoRef.current?.pause();
      setPlaying(false);
    }
    setPanelOpen(open);
  }

  function onStoryTextChange(open: boolean) {
    if (open) {
      playbackAllowedRef.current = false;
      save(true);
      videoRef.current?.pause();
      setPlaying(false);
    }
    setTranscriptOpen(open);
  }

  function togglePlay() {
    if (!activeClip) return;
    const next = !desiredRef.current || blocked || mediaError;
    desiredRef.current = next;
    setDesiredPlaying(next);
    if ((blocked || mediaError) && next) {
      setBlocked(false);
      setMediaError(false);
      setLoading(true);
      setRetryKey((value) => value + 1);
    }
    if (!next) {
      playbackAllowedRef.current = false;
      videoRef.current?.pause();
    }
    save(true);
  }

  function onTimeUpdate(event: React.SyntheticEvent<HTMLVideoElement>) {
    const media = event.currentTarget;
    if (
      !activeClip ||
      media.paused ||
      !pageVisible ||
      isModalOpen ||
      transitioning
    )
      return;
    if (
      media.currentTime > observedTimeRef.current + 0.03 &&
      !playsRef.current.has(activeClip.id)
    ) {
      playsRef.current.add(activeClip.id);
      track("video_play_started", activeClip.campaignId, {
        source: "watch",
        sourceId: activeClip.id,
      });
    }
    observedTimeRef.current = media.currentTime;
    positionRef.current[activeClip.id] = media.currentTime;
    save();
  }

  const discoveryUrl = `/communities/${community.id}`;
  if (invalidClip)
    return (
      <main
        className="watch-shell watch-empty"
        id="main"
        data-testid="watch-invalid-clip"
      >
        <p className="watch-overline">A greener tomorrow · Watch</p>
        <h1>This clip is unavailable</h1>
        <p>
          The link may have changed. You can start with the current collection
          or explore the campaigns.
        </p>
        <div className="watch-empty-actions">
          {campaignClips.length > 0 && (
            <Link
              className="button primary"
              href={`${discoveryUrl}/watch?clip=${campaignClips[0].id}`}
            >
              Start Watch
            </Link>
          )}
          <Link className="button secondary" href={discoveryUrl}>
            Explore campaigns
          </Link>
        </div>
      </main>
    );
  if (campaignClips.length === 0)
    return (
      <main
        className="watch-shell watch-empty"
        id="main"
        data-testid="watch-empty"
      >
        <p className="watch-overline">A greener tomorrow · Watch</p>
        <h1>No videos are available yet</h1>
        <p>The community’s campaigns are still ready to explore.</p>
        <Link className="button primary" href={discoveryUrl}>
          Explore campaigns
        </Link>
      </main>
    );

  return (
    <main
      className="watch-shell"
      id="main"
      data-testid="watch-feed"
      inert={!ready}
      aria-busy={!ready}
    >
      <div className="watch-topline">
        <div>
          <span className="watch-overline">A greener tomorrow</span>
          <strong>Watch stories that move us</strong>
        </div>
        <Link
          href={discoveryUrl}
          className="watch-exit"
          onClick={() => save(true)}
        >
          <ArrowLeft size={17} /> Explore campaigns
        </Link>
      </div>
      <div className="watch-layout">
        <div className="watch-stage-wrap">
          <div
            className="watch-scroller"
            ref={scrollerRef}
            tabIndex={0}
            role="region"
            aria-label="Campaign video feed. Use arrow keys, scroll, or swipe to change clips."
            onKeyDown={onKeys}
            onScroll={onScroll}
            data-active-clip={activeClip?.id || "end"}
          >
            {campaignClips.map((clip, index) => {
              const linkedCampaign = campaignById(clip.campaignId);
              const linkedPublisher = organizerById(clip.profileId);
              const active = index === activeIndex;
              const attachPoster =
                active || (ready && Math.abs(index - activeIndex) <= 1);
              const attachSource =
                ready && (active || index === activeIndex + 1);
              if (!linkedCampaign || !linkedPublisher) return null;
              return (
                <article
                  className={`watch-item${active ? " is-active" : ""}`}
                  key={clip.id}
                  ref={(node) => {
                    itemRefs.current[index] = node;
                  }}
                  inert={!active || isModalOpen}
                  aria-hidden={!active}
                  data-clip-id={clip.id}
                  data-active={active}
                >
                  <div
                    className="watch-media"
                    onPointerDown={onPointerDown}
                    onPointerUp={onPointerUp}
                    onPointerCancel={() => {
                      touchStartRef.current = null;
                    }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element -- This pre-compressed local poster is served directly so the first frame needs no image-optimizer request. */}
                    <img
                      className="watch-poster"
                      src={attachPoster ? clip.poster : undefined}
                      alt=""
                      loading={active ? "eager" : "lazy"}
                      fetchPriority={active ? "high" : "auto"}
                      decoding="async"
                      aria-hidden="true"
                    />
                    {attachSource && (
                      <video
                        key={`${clip.id}:${active ? retryKey : "preload"}`}
                        ref={active ? videoRef : undefined}
                        className="watch-video"
                        src={clip.src}
                        playsInline
                        muted={muted}
                        preload="metadata"
                        onLoadedMetadata={(event) => {
                          if (!active) return;
                          const position = safePosition(
                            positionRef.current[clip.id],
                          );
                          if (position > 0) {
                            const duration = event.currentTarget.duration;
                            event.currentTarget.currentTime = Number.isFinite(
                              duration,
                            )
                              ? Math.min(position, Math.max(0, duration - 0.25))
                              : position;
                          }
                          if (event.currentTarget.textTracks[0])
                            event.currentTarget.textTracks[0].mode = captions
                              ? "showing"
                              : "disabled";
                        }}
                        onCanPlay={() => {
                          if (active) setLoading(false);
                        }}
                        onWaiting={() => {
                          if (active) setLoading(true);
                        }}
                        onPlaying={(event) => {
                          if (active) {
                            if (
                              !desiredRef.current ||
                              !playbackAllowedRef.current
                            ) {
                              event.currentTarget.pause();
                              return;
                            }
                            setPlaying(true);
                            setLoading(false);
                          }
                        }}
                        onPause={() => {
                          if (active) setPlaying(false);
                        }}
                        onEnded={() => {
                          if (active) {
                            desiredRef.current = false;
                            playbackAllowedRef.current = false;
                            setDesiredPlaying(false);
                            setPlaying(false);
                            save(true);
                          }
                        }}
                        onError={() => {
                          if (active) {
                            setMediaError(true);
                            setLoading(false);
                            setPlaying(false);
                          }
                        }}
                        onTimeUpdate={active ? onTimeUpdate : undefined}
                      >
                        <track
                          kind="captions"
                          src={clip.captions}
                          srcLang="en"
                          label="English"
                          default={captions}
                        />
                      </video>
                    )}
                    <div className="watch-media-top">
                      <span>
                        STORY {index + 1} / {campaignClips.length}
                      </span>
                      <span>
                        Illustrative stock footage | Fictional demo · No spoken
                        audio
                      </span>
                    </div>
                    {active && mediaError && (
                      <div className="watch-media-notice" role="alert">
                        <strong>Video could not load</strong>
                        <span>
                          You can retry, continue, or explore this cause.
                        </span>
                        <div className="watch-notice-actions">
                          <button
                            type="button"
                            onClick={() => {
                              setMediaError(false);
                              setLoading(true);
                              setRetryKey((value) => value + 1);
                            }}
                          >
                            <RotateCcw size={15} /> Retry video
                          </button>
                          {index < campaignClips.length - 1 && (
                            <button
                              type="button"
                              onClick={() => navigate(index + 1, true)}
                            >
                              Next clip <ArrowRight size={15} />
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                    {active && !mediaError && (loading || blocked) && (
                      <div className="watch-media-status" role="status">
                        {blocked ? (
                          "Tap Play to watch"
                        ) : (
                          <>
                            <LoaderCircle size={16} className="watch-spin" />{" "}
                            Loading video…
                          </>
                        )}
                      </div>
                    )}
                    {active && !mediaError && (
                      <button
                        className="watch-play-toggle"
                        type="button"
                        onClick={togglePlay}
                        aria-label={
                          desiredPlaying && !blocked
                            ? "Pause video"
                            : "Play video"
                        }
                        aria-pressed={desiredPlaying && !blocked}
                        data-playing={playing}
                      >
                        {desiredPlaying && !blocked ? (
                          <Pause size={22} fill="currentColor" />
                        ) : (
                          <Play size={22} fill="currentColor" />
                        )}
                      </button>
                    )}
                  </div>
                  <div className="watch-story">
                    <div className="watch-identity">
                      <Link
                        href={`/profiles/${clip.profileId}`}
                        onClick={() => save(true)}
                        aria-label={`View ${linkedPublisher.name}'s profile`}
                      >
                        <Avatar id={clip.profileId} size="tiny" />
                      </Link>
                      <div>
                        <Link
                          href={`/profiles/${clip.profileId}`}
                          onClick={() => save(true)}
                        >
                          {linkedPublisher.name}
                        </Link>
                        <span>
                          {clip.role === "organizer"
                            ? "Organizer"
                            : "Supporter"}{" "}
                          ·{" "}
                          {new Date(clip.publishedAt).toLocaleDateString(
                            "en-US",
                            { month: "short", day: "numeric", year: "numeric" },
                          )}
                        </span>
                      </div>
                      <span className="watch-duration">
                        {Math.round(clip.duration)}s
                      </span>
                    </div>
                    <h2>{clip.title}</h2>
                    <Link
                      className="watch-campaign-link"
                      href={`/fundraisers/${clip.campaignId}`}
                      onClick={() => {
                        save(true);
                        track("video_campaign_opened", clip.campaignId, {
                          source: "watch",
                          sourceId: clip.id,
                        });
                      }}
                    >
                      {linkedCampaign.title} <ArrowRight size={17} />
                    </Link>
                    <Funding campaign={linkedCampaign} />
                    <div className="watch-actions">
                      <DonateButton
                        campaign={linkedCampaign}
                        label="Donate now"
                        sourceId={clip.id}
                        onOpenChange={onPanelChange}
                        returnFocusRef={panelTriggerRef}
                      />
                      <FollowButton
                        type="fundraiser"
                        id={clip.campaignId}
                        compact
                        sourceId={clip.id}
                      />
                      <ShareButton
                        id={clip.campaignId}
                        sourceId={clip.id}
                        onOpenChange={onPanelChange}
                        returnFocusRef={panelTriggerRef}
                      />
                    </div>
                    <div className="watch-tools">
                      <button
                        type="button"
                        disabled={!clip.hasAudio}
                        aria-label={
                          clip.hasAudio
                            ? muted
                              ? "Turn sound on"
                              : "Turn sound off"
                            : "No audio available in this demo clip"
                        }
                        aria-pressed={clip.hasAudio ? !muted : undefined}
                        onClick={() => {
                          mutedRef.current = !muted;
                          setMuted(!muted);
                          save(true);
                        }}
                      >
                        {muted || !clip.hasAudio ? (
                          <VolumeX size={16} />
                        ) : (
                          <Volume2 size={16} />
                        )}
                        {clip.hasAudio
                          ? muted
                            ? "Sound off"
                            : "Sound on"
                          : "No audio"}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          captionsRef.current = !captions;
                          setCaptions(!captions);
                          save(true);
                        }}
                        aria-pressed={captions}
                      >
                        {captions ? (
                          <Captions size={16} />
                        ) : (
                          <CaptionsOff size={16} />
                        )}
                        {captions ? "Captions on" : "Captions off"}
                      </button>
                      <button
                        type="button"
                        onClick={() => onStoryTextChange(true)}
                      >
                        Read story text
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
            <section
              className={`watch-item watch-end${isEnd ? " is-active" : ""}`}
              ref={(node) => {
                itemRefs.current[endIndex] = node;
              }}
              inert={!isEnd || isModalOpen}
              aria-hidden={!isEnd}
              data-testid="watch-end"
            >
              <span className="watch-end-mark">✳</span>
              <p className="watch-overline">You’ve seen every story</p>
              <h2>Good things keep growing.</h2>
              <p>Revisit the collection or find a campaign you care about.</p>
              <div className="watch-end-actions">
                <button
                  className="button primary"
                  type="button"
                  onClick={() => navigate(0, true)}
                >
                  <RotateCcw size={17} /> Replay stories
                </button>
                <Link className="button secondary" href={discoveryUrl}>
                  Explore campaigns
                </Link>
              </div>
            </section>
          </div>
        </div>
        <aside className="watch-navigation" aria-label="Video navigation">
          <button
            type="button"
            onClick={() => navigate(activeIndexRef.current - 1, true)}
            disabled={activeIndex === 0 || isModalOpen}
            aria-label="Previous clip"
          >
            <ArrowUp size={20} />
          </button>
          <span>
            {isEnd ? "End" : `${activeIndex + 1} / ${campaignClips.length}`}
          </span>
          <button
            type="button"
            onClick={() => navigate(activeIndexRef.current + 1, true)}
            disabled={isEnd || isModalOpen}
            aria-label="Next clip"
          >
            <ArrowDown size={20} />
          </button>
        </aside>
      </div>
      <p className="watch-sr-only" aria-live="polite">
        {liveMessage}
      </p>
      {activeClip && transcriptOpen && (
        <Dialog
          title={`Story text: ${activeClip.title}`}
          onClose={() => onStoryTextChange(false)}
        >
          <p className="watch-transcript-note">
            This clip has no spoken audio. This is fictional campaign copy over
            illustrative footage, not dialogue or testimony from the people
            shown.
          </p>
          <p className="watch-transcript">{activeClip.storyText}</p>
        </Dialog>
      )}
    </main>
  );
}
