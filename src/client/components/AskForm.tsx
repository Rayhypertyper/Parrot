import { forwardRef, useState } from "react";
import { useCrew, intentKey } from "../crew/CrewProvider";
import { Button } from "../ui/primitives";

/** Typed request: the always-available, no-mic way to ask the crew for help. */
export const AskForm = forwardRef<
  HTMLTextAreaElement,
  { compact?: boolean; onDone?: () => void; onFocus?: () => void; id?: string }
>(function AskForm({ compact, onDone, onFocus, id = "ask" }, ref) {
  const { act, pending } = useCrew();
  const [text, setText] = useState("");
  const busy = pending[intentKey({ kind: "request_help" })];
  return (
    <form
      className={`cr-ask${compact ? " cr-ask--compact" : ""}`}
      onSubmit={async (e) => {
        e.preventDefault();
        if (!text.trim()) return;
        const r = await act({ kind: "request_help", text: text.trim() });
        if (r) {
          setText("");
          onDone?.();
        }
      }}
    >
      <label className="cr-field" htmlFor={`${id}-text`}>
        <span className={compact ? "cr-visually-hidden" : "cr-field__label"}>
          What do you need, and where?
        </span>
      </label>
      <div className="cr-ask__row">
        <textarea
          id={`${id}-text`}
          ref={ref}
          className="cr-input cr-input--area"
          rows={compact ? 1 : 2}
          value={text}
          onFocus={onFocus}
          onChange={(e) => setText(e.target.value)}
          placeholder={compact ? "What do you need?" : "We need a cart at packing"}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              e.currentTarget.form?.requestSubmit();
            }
          }}
          enterKeyHint="send"
        />
        <Button tone="primary" type="submit" busy={busy} busyLabel="Sending…" disabled={!text.trim()}>
          Ask for help
        </Button>
      </div>
    </form>
  );
});
