import { useEffect, useRef, useState } from "react";
import type { Feed } from "../crew/contract";
import { Button } from "../ui/primitives";
import { isVoiceActive, useVoice } from "./VoiceProvider";
import { playPing } from "./ping";
import { voiceSubjects } from "./subjects";

export function HandsFreeOffers({ feed }: { feed: Feed }) {
  const { close, isOpen, phase, recorded, start, subject } = useVoice();
  const audio = useRef<AudioContext | null>(null);
  const handled = useRef(new Set<string>());
  const automatic = useRef<string | undefined>(undefined);
  const [enabled, setEnabled] = useState(false);
  const [enabling, setEnabling] = useState(false);
  const [denied, setDenied] = useState(false);
  const incoming = voiceSubjects(feed).find((item) => item.offerId && !handled.current.has(item.offerId));

  const stop = () => {
    const context = audio.current;
    audio.current = null;
    if (context && context.state !== "closed") void context.close().catch(() => undefined);
  };

  useEffect(() => stop, []);

  async function enable() {
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
    if (!enabled || isOpen || isVoiceActive(phase) || document.hidden || !incoming?.offerId) return;
    const context = audio.current;
    if (context && !feed.requests.some((request) => request.id === incoming.requestId && request.allHands))
      playPing(context);
    handled.current.add(incoming.offerId);
    automatic.current = incoming.offerId;
    void start(incoming);
  }, [enabled, feed.requests, incoming, isOpen, phase, start]);

  const inAutomaticOffer = isOpen && !!subject?.offerId && subject.offerId === automatic.current;
  useEffect(() => {
    function onHidden() {
      if (!document.hidden) return;
      if (inAutomaticOffer) close();
      setEnabled(false);
      stop();
    }
    document.addEventListener("visibilitychange", onHidden);
    return () => document.removeEventListener("visibilitychange", onHidden);
  }, [inAutomaticOffer, close]);

  useEffect(() => {
    if (!inAutomaticOffer || !recorded) return;
    const timer = window.setTimeout(close, 5_000);
    return () => window.clearTimeout(timer);
  }, [inAutomaticOffer, recorded, close]);

  const active = isVoiceActive(phase);
  useEffect(() => {
    if (!inAutomaticOffer || !active || recorded) return;
    const timer = window.setTimeout(close, 60_000);
    return () => window.clearTimeout(timer);
  }, [inAutomaticOffer, active, recorded, close]);

  return (
    <section className="cr-me" aria-label="Hands-free offers">
      <div>
        <p className="cr-me__name">Hands-free offers</p>
        <p className="cr-me__loc" role="status">
          {denied ? "Allow microphone access or use Talk." : enabled ? "On. Keep this page open." : "Beep and open the mic for incoming offers."}
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
            if (inAutomaticOffer) close();
          }
        }}
      >
        {enabled ? "Turn off" : "Turn on"}
      </Button>
    </section>
  );
}
