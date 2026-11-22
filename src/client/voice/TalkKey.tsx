import { useEffect, useRef } from "react";
import { IconMic, IconMicOff } from "../ui/icons";
import { isVoiceActive, useVoice, type VoicePhase } from "./VoiceProvider";

/**
 * The one voice animation: a ring whose spread follows the real input/output
 * level from the SDK while connected. Static under reduced motion.
 */
export function VoiceRing({ phase }: { phase: VoicePhase }) {
  const ref = useRef<HTMLSpanElement>(null);
  const { levels } = useVoice();
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const live = phase === "listening" || phase === "speaking";
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (!live || reduce) {
      el.style.setProperty("--lvl", "0");
      return;
    }
    let raf = 0;
    let smooth = 0;
    const loop = () => {
      const { input, output } = levels();
      const target = Math.min(1, (phase === "speaking" ? output : input) * 2.2);
      smooth += (target - smooth) * 0.25;
      el.style.setProperty("--lvl", smooth.toFixed(3));
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [phase, levels]);
  return <span ref={ref} className={`cr-ring cr-ring--${phase}`} aria-hidden="true" />;
}

export function TalkKey({
  onPress,
  label = "Talk",
  size = "lg",
}: {
  onPress: () => void;
  label?: string;
  size?: "lg" | "md";
}) {
  const { phase } = useVoice();
  const active = isVoiceActive(phase);
  return (
    <button
      className={`cr-talk cr-talk--${size}${active ? " is-active" : ""}`}
      onClick={onPress}
      aria-label={active ? "Open the active voice session" : label}
    >
      <VoiceRing phase={phase} />
      <span className="cr-talk__face">
        {phase === "error" ? <IconMicOff size={26} /> : <IconMic size={26} />}
      </span>
      <span className="cr-talk__label">{active ? "On air" : label}</span>
    </button>
  );
}
