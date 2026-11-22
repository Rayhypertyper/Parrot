import {
  ConversationProvider,
  useConversationControls,
  useConversationMode,
  useConversationStatus,
} from "@elevenlabs/react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { CrewApiError, messageOf } from "../crew/api";
import { useCrew } from "../crew/CrewProvider";

/** What the voice conversation is about. Sent to Wasp so the ticket is bound to it. */
export interface VoiceSubject {
  label: string;
  requestId?: string;
  offerId?: string;
}

export type VoicePhase =
  | "idle"
  | "permission"
  | "preparing"
  | "connecting"
  | "listening"
  | "speaking"
  | "ended"
  | "error";

export type VoiceErrorKind = "mic" | "insecure" | "session" | "connection";

export interface VoiceError {
  kind: VoiceErrorKind;
  message: string;
}

interface VoiceValue {
  isOpen: boolean;
  subject: VoiceSubject | null;
  phase: VoicePhase;
  error: VoiceError | null;
  agentLine: string | null;
  userLine: string | null;
  recorded: boolean;
  open: (subject: VoiceSubject) => void;
  setSubject: (subject: VoiceSubject) => void;
  start: () => Promise<void>;
  end: () => void;
  close: () => void;
  levels: () => { input: number; output: number };
}

const VoiceContext = createContext<VoiceValue | null>(null);

export function VoiceProvider({ children }: { children: ReactNode }) {
  return (
    <ConversationProvider>
      <VoiceState>{children}</VoiceState>
    </ConversationProvider>
  );
}

const ACTIVE: VoicePhase[] = ["permission", "preparing", "connecting", "listening", "speaking"];

function VoiceState({ children }: { children: ReactNode }) {
  const crew = useCrew();
  const controls = useConversationControls();
  const { status, message: sdkMessage } = useConversationStatus();
  const { isSpeaking } = useConversationMode();

  const [isOpen, setOpen] = useState(false);
  const [subject, setSubject] = useState<VoiceSubject | null>(null);
  const [local, setLocal] = useState<"idle" | "permission" | "preparing" | "started" | "ended" | "error">("idle");
  const [error, setError] = useState<VoiceError | null>(null);
  const [agentLine, setAgentLine] = useState<string | null>(null);
  const [userLine, setUserLine] = useState<string | null>(null);
  const [recorded, setRecorded] = useState(false);
  const attempt = useRef(0);
  const crewRef = useRef(crew);
  crewRef.current = crew;

  // Invalidate pending callbacks before the SDK tears down on unmount.
  useLayoutEffect(() => {
    return () => {
      attempt.current++;
    };
  }, []);

  const phase: VoicePhase = (() => {
    if (local === "error") return "error";
    if (local === "permission" || local === "preparing") return local;
    if (local === "started") {
      if (status === "connecting") return "connecting";
      if (status === "connected") return isSpeaking ? "speaking" : "listening";
      if (status === "error") return "error";
      return "connecting";
    }
    return local === "ended" ? "ended" : "idle";
  })();

  // The SDK reports a failed or dropped connection through status/message.
  useEffect(() => {
    if (local !== "started") return;
    if (status === "error") {
      setLocal("error");
      setError({
        kind: "connection",
        message: sdkMessage || "The voice connection dropped.",
      });
    }
  }, [status, sdkMessage, local]);

  const fail = (e: VoiceError) => {
    setError(e);
    setLocal("error");
  };

  const start = useCallback(async () => {
    const c = crewRef.current;
    if (!c.api || !c.session || !subject) return;
    if (ACTIVE.includes(phase)) return; // one local session at a time
    const my = ++attempt.current;
    setError(null);
    setAgentLine(null);
    setUserLine(null);
    setRecorded(false);

    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      return fail({
        kind: "insecure",
        message: "Voice needs a secure (HTTPS) page with microphone support.",
      });
    }

    setLocal("permission");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((t) => t.stop());
    } catch (err) {
      if (my !== attempt.current) return;
      const name = (err as DOMException)?.name;
      return fail({
        kind: "mic",
        message:
          name === "NotAllowedError" || name === "SecurityError"
            ? "Microphone access is blocked. Allow it in your browser settings, or type your update."
            : name === "NotFoundError"
              ? "No microphone found on this device. Type your update instead."
              : `Couldn't open the microphone: ${messageOf(err)}`,
      });
    }
    if (my !== attempt.current) return;

    setLocal("preparing");
    let session;
    try {
      session = await c.api.voiceSession(c.session.memberToken, {
        requestId: subject.requestId,
        offerId: subject.offerId,
      });
    } catch (err) {
      if (my !== attempt.current) return;
      if (err instanceof CrewApiError && err.isStale) c.refresh();
      return fail({ kind: "session", message: messageOf(err) });
    }
    if (my !== attempt.current) return;

    setLocal("started");
    let acceptsToolResponses = true;
    controls.startSession({
      conversationToken: session.conversationToken,
      connectionType: "webrtc",
      dynamicVariables: session.dynamicVariables,
      onMessage: ({ message, role }) => {
        if (my !== attempt.current) return;
        if (role === "agent") setAgentLine(message);
        else setUserLine(message);
      },
      onAgentToolResponse: (response) => {
        if (my !== attempt.current || !acceptsToolResponses) return;
        if (response.tool_name !== "submit_update" || response.is_error !== false) return;
        if (response.is_called === false || ("is_blocked" in response && response.is_blocked)) return;
        setRecorded(true);
        crewRef.current.refresh();
      },
      onStatusChange: ({ status }) => {
        if (status === "disconnecting" || status === "disconnected") acceptsToolResponses = false;
      },
      onDisconnect: (details) => {
        if (my !== attempt.current) return;
        attempt.current++;
        crewRef.current.refresh();
        if (details.reason === "error") {
          fail({ kind: "connection", message: details.message || "The voice connection dropped." });
        } else {
          setLocal("ended");
        }
      },
      onError: (message) => {
        if (my !== attempt.current) return;
        acceptsToolResponses = false;
        fail({ kind: "connection", message: message || "Voice connection failed." });
      },
    });
  }, [subject, phase, controls]);

  const end = useCallback(() => {
    attempt.current++;
    controls.endSession();
    setLocal((l) => (l === "idle" ? "idle" : "ended"));
    crewRef.current.refresh();
  }, [controls]);

  const close = useCallback(() => {
    attempt.current++;
    controls.endSession();
    setOpen(false);
    setLocal("idle");
    setError(null);
    setAgentLine(null);
    setUserLine(null);
    setRecorded(false);
  }, [controls]);

  const open = useCallback(
    (s: VoiceSubject) => {
      if (ACTIVE.includes(phase)) {
        setOpen(true); // already talking: bring the sheet back, don't start another
        return;
      }
      setSubject(s);
      setLocal("idle");
      setError(null);
      setOpen(true);
    },
    [phase],
  );

  const levels = useCallback(() => {
    try {
      return { input: controls.getInputVolume(), output: controls.getOutputVolume() };
    } catch {
      return { input: 0, output: 0 };
    }
  }, [controls]);

  // Leaving the page or signing out ends audio.
  useEffect(() => {
    if (!crew.session) close();
  }, [crew.session, close]);

  const value = useMemo(
    () => ({
      isOpen,
      subject,
      phase,
      error,
      agentLine,
      userLine,
      recorded,
      open,
      setSubject: (s: VoiceSubject) => {
        if (!ACTIVE.includes(phase)) setSubject(s);
      },
      start,
      end,
      close,
      levels,
    }),
    [isOpen, subject, phase, error, agentLine, userLine, recorded, open, start, end, close, levels],
  );

  return <VoiceContext.Provider value={value}>{children}</VoiceContext.Provider>;
}

export function useVoice() {
  const ctx = useContext(VoiceContext);
  if (!ctx) throw new Error("useVoice must be used inside VoiceProvider");
  return ctx;
}

export const PHASE_LABEL: Record<VoicePhase, string> = {
  idle: "Ready",
  permission: "Waiting for microphone",
  preparing: "Preparing session",
  connecting: "Connecting",
  listening: "Listening",
  speaking: "Parrot is speaking",
  ended: "Ended",
  error: "Voice unavailable",
};

export const isVoiceActive = (p: VoicePhase) => ACTIVE.includes(p);
