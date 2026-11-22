import { useCallback, useEffect, useRef, useState } from "react";
import { allHandsDetails, allHandsSpeech } from "../../shared/crew/index";
import type { CrewRequest, Feed } from "../crew/contract";
import { useCrew } from "../crew/CrewProvider";
import { memberById } from "../crew/derive";
import { IconAlert, IconX } from "../ui/icons";
import { playPing } from "../voice/ping";

export function AllHandsAlerts({ feed }: { feed: Feed }) {
  const { api, session } = useCrew();
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
  const playback = useRef(0);
  const announced = useRef(new Set<string>());
  const alerts = feed.requests.filter((request) => request.allHands && !dismissed.includes(request.id));
  const latest = feed.requests.find((request) => request.allHands && request.status === "open");

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

  const playAnnouncement = useCallback(async (request: CrewRequest, ping = false) => {
    if (document.hidden || typeof AudioContext === "undefined") return;
    const context = (audio.current ??= new AudioContext());
    const attempt = ++playback.current;
    const current = () => playback.current === attempt && audio.current === context && !document.hidden;
    try {
      await context.resume();
      if (!current()) return;
      if (ping) playPing(context, 880);
      if (!api || !session) return;
      const { audio: clip } = await api.announcementAudio(session.memberToken, request.id);
      const bytes = Uint8Array.from(atob(clip), (character) => character.charCodeAt(0));
      const buffer = await context.decodeAudioData(bytes.buffer);
      if (!current()) return;
      const voice = context.createBufferSource();
      voice.buffer = buffer;
      voice.connect(context.destination);
      voice.start();
    } catch {
      if (current() && "speechSynthesis" in window) {
        window.speechSynthesis.speak(new SpeechSynthesisUtterance(allHandsSpeech(request.title, request.destination)));
      }
    }
  }, [api, session]);

  useEffect(() => {
    if (!audioReady || audio.current?.state !== "running" || document.hidden || !latest ||
        latest.requesterId === feed.me.id || dismissed.includes(latest.id) || announced.current.has(latest.id)) return;
    announced.current.add(latest.id);
    void playAnnouncement(latest, true);
  }, [latest, dismissed, audioReady, feed.me.id, playAnnouncement]);

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
          <button className="cr-link cr-all-hands__detail" onClick={() => void playAnnouncement(request)}>
            Play announcement
          </button>
        </span>
        <button className="cr-icon-btn" onClick={() => dismiss(request.id)} aria-label="Dismiss all-hands alert">
          <IconX size={16} />
        </button>
      </div>
    );
  });
}
