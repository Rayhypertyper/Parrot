import { useEffect, useRef, useState } from "react";
import { allHandsDetails } from "../../shared/crew/index";
import type { Feed } from "../crew/contract";
import { memberById } from "../crew/derive";
import { IconAlert, IconX } from "../ui/icons";
import { playPing } from "../voice/ping";

export function AllHandsAlerts({ feed }: { feed: Feed }) {
  const storageKey = `crew-radio:all-hands:${feed.me.id}`;
  const [dismissed, setDismissed] = useState<string[]>(() => {
    try {
      const saved: unknown = JSON.parse(sessionStorage.getItem(storageKey) ?? "[]");
      return Array.isArray(saved) ? saved.filter((id): id is string => typeof id === "string") : [];
    } catch {
      return [];
    }
  });
  const [audioReady, setAudioReady] = useState(false);
  const audio = useRef<AudioContext | null>(null);
  const announced = useRef(new Set<string>());
  const alerts = feed.requests.filter((request) => request.allHands && !dismissed.includes(request.id));

  useEffect(() => {
    function prepareAudio() {
      if (document.hidden || typeof AudioContext === "undefined") return;
      const context = (audio.current ??= new AudioContext());
      void context.resume().then(() => {
        if (audio.current === context) setAudioReady(true);
      }).catch(() => undefined);
    }
    document.addEventListener("pointerup", prepareAudio);
    document.addEventListener("keydown", prepareAudio);
    if (navigator.userActivation?.hasBeenActive) prepareAudio();
    return () => {
      document.removeEventListener("pointerup", prepareAudio);
      document.removeEventListener("keydown", prepareAudio);
      if (audio.current) void audio.current.close().catch(() => undefined);
      audio.current = null;
    };
  }, []);

  useEffect(() => {
    const context = audio.current;
    if (!audioReady || context?.state !== "running" || document.hidden) return;
    const unread = alerts.filter(({ id, requesterId }) => requesterId !== feed.me.id && !announced.current.has(id));
    if (!unread.length) return;
    unread.forEach(({ id }) => announced.current.add(id));
    playPing(context, 880);
  }, [alerts, audioReady, feed.me.id]);

  function dismiss(id: string) {
    const next = [...dismissed, id];
    setDismissed(next);
    try {
      sessionStorage.setItem(storageKey, JSON.stringify(next));
    } catch {
      // The alert can still be dismissed for the current page.
    }
  }

  return alerts.map((request) => {
    const sender = memberById(feed, request.requesterId)?.name;
    const details = allHandsDetails(request.title) ?? request.title;
    return (
      <div className="cr-notice cr-notice--warn cr-notice--all-hands" role="alert" key={request.id}>
        <IconAlert size={18} />
        <span>
          <strong>All hands on deck</strong>
          {sender && <span> · {sender}</span>}
          {details && <span className="cr-all-hands__detail">{details}</span>}
          {request.destination && !details.includes(request.destination) && (
            <span className="cr-all-hands__detail">{request.destination}</span>
          )}
        </span>
        <button className="cr-icon-btn" onClick={() => dismiss(request.id)} aria-label="Dismiss all-hands alert">
          <IconX size={16} />
        </button>
      </div>
    );
  });
}
