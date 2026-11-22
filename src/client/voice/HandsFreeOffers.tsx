import { useEffect, useRef, useState } from "react";
import type { Feed } from "../crew/contract";
import { Button } from "../ui/primitives";
import { isVoiceActive, useVoice, type VoiceSubject } from "./VoiceProvider";
import { playPing } from "./ping";
import { voiceSubjects } from "./subjects";

export function HandsFreeOffers({ feed, enabled, setEnabled }: {
  feed: Feed;
  enabled: boolean;
  setEnabled: (enabled: boolean) => void;
}) {
  const { close, isOpen, phase, recorded, start, subject } = useVoice();
  const audio = useRef<AudioContext | null>(null);
  const handled = useRef(new Set<string>());
  const automatic = useRef<string | undefined>(undefined);
  const [enabling, setEnabling] = useState(false);
  const [denied, setDenied] = useState(false);
  const announcement = feed.requests.find((request) => request.allHands && request.status === "open" &&
    request.requesterId !== feed.me.id && !handled.current.has(request.id));
  const incoming: VoiceSubject | undefined = announcement
    ? { label: "All hands on deck", announcementId: announcement.id }
    : voiceSubjects(feed).find((item) => item.offerId && !handled.current.has(item.offerId));
  const incomingId = incoming?.announcementId ?? incoming?.offerId;

  const stop = () => {
    const context = audio.current;
    audio.current = null;
    if (context && context.state !== "closed") void context.close().catch(() => undefined);
  };

  useEffect(() => stop, []);

  async function enable() {
    // Announcements already visible when Hands-free is enabled can be replayed from their banner.
    feed.requests.forEach((request) => {
      if (request.allHands) handled.current.add(request.id);
    });
    setEnabling(true);
    setDenied(false);
    let context: AudioContext | undefined;
    try {
      context = new AudioContext();
      audio.current = context;
      const ready = context.resume().catch(() => undefined);
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((track) => track.stop());
      await ready;
      if (audio.current === context) setEnabled(true);
    } catch {
      if (!context || audio.current === context) {
        stop();
        setDenied(true);
      }
    } finally {
      setEnabling(false);
    }
  }

  useEffect(() => {
    if (!isOpen) automatic.current = undefined;
  }, [isOpen]);

  useEffect(() => {
    if (!enabled || isOpen || isVoiceActive(phase) || document.hidden || !incoming || !incomingId) return;
    const context = audio.current;
    if (context) playPing(context, incoming.announcementId ? 880 : 660);
    handled.current.add(incomingId);
    automatic.current = incomingId;
    void start(incoming);
  }, [enabled, incoming, incomingId, isOpen, phase, start]);

  const subjectId = subject?.announcementId ?? subject?.offerId;
  const inAutomaticSession = isOpen && !!subjectId && subjectId === automatic.current;
  useEffect(() => {
    function onHidden() {
      if (!document.hidden) return;
      if (inAutomaticSession) close();
      setEnabled(false);
      stop();
    }
    document.addEventListener("visibilitychange", onHidden);
    return () => document.removeEventListener("visibilitychange", onHidden);
  }, [inAutomaticSession, close, setEnabled]);

  useEffect(() => {
    if (!inAutomaticSession || !recorded) return;
    const timer = window.setTimeout(close, 5_000);
    return () => window.clearTimeout(timer);
  }, [inAutomaticSession, recorded, close]);

  const active = isVoiceActive(phase);
  useEffect(() => {
    if (!inAutomaticSession || !active || recorded) return;
    const timer = window.setTimeout(close, 60_000);
    return () => window.clearTimeout(timer);
  }, [inAutomaticSession, active, recorded, close]);

  return (
    <section className="cr-me" aria-label="Hands-free offers">
      <div>
        <p className="cr-me__name">Hands-free offers</p>
        <p className="cr-me__loc" role="status">
          {denied ? "Allow microphone access or use Talk." : enabled ? "On. Keep this page open." : "Open the mic for offers and all-hands announcements."}
        </p>
      </div>
      <Button
        tone="secondary"
        busy={enabling}
        busyLabel="Allow mic…"
        onClick={() => {
          if (!enabled) void enable();
          else {
            setEnabled(false);
            stop();
            if (inAutomaticSession) close();
          }
        }}
      >
        {enabled ? "Turn off" : "Turn on"}
      </Button>
    </section>
  );
}
