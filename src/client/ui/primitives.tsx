import {
  forwardRef,
  useEffect,
  useRef,
  type ButtonHTMLAttributes,
  type ReactNode,
} from "react";
import type { Availability, RequestStatus } from "../crew/contract";
import { STATUS_LABEL } from "../crew/derive";
import {
  IconCheckCircle,
  IconHourglass,
  IconOpen,
  IconProgress,
  IconSend,
  IconShield,
} from "./icons";

type Tone = "primary" | "secondary" | "quiet" | "danger";

export const Button = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement> & {
    tone?: Tone;
    busy?: boolean;
    busyLabel?: string;
    icon?: ReactNode;
    block?: boolean;
  }
>(function Button(
  { tone = "secondary", busy, busyLabel, icon, block, className, children, disabled, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      className={["cr-btn", `cr-btn--${tone}`, block && "cr-btn--block", className]
        .filter(Boolean)
        .join(" ")}
      disabled={disabled || busy}
      aria-busy={busy || undefined}
      {...rest}
    >
      {icon}
      <span>{busy && busyLabel ? busyLabel : children}</span>
    </button>
  );
});

const STATUS_ICON: Record<RequestStatus, typeof IconOpen> = {
  open: IconOpen,
  offered: IconSend,
  in_progress: IconProgress,
  awaiting_confirmation: IconHourglass,
  done: IconCheckCircle,
};

export function StatusBadge({ status }: { status: RequestStatus }) {
  const Icon = STATUS_ICON[status];
  return (
    <span className={`cr-status cr-status--${status}`}>
      <Icon size={16} />
      {STATUS_LABEL[status]}
    </span>
  );
}

export function AvailabilityMark({ value }: { value: Availability }) {
  if (value === "protected")
    return (
      <span className="cr-avail cr-avail--protected">
        <IconShield size={15} />
        Protected post
      </span>
    );
  return (
    <span className={`cr-avail cr-avail--${value}`}>
      <span className="cr-avail__dot" aria-hidden="true" />
      {value === "available" ? "Available" : "Busy"}
    </span>
  );
}

/** Bottom sheet on phones, side dialog on wide screens. Native <dialog> for focus and Escape. */
export function Sheet({
  open,
  onClose,
  labelledBy,
  children,
}: {
  open: boolean;
  onClose: () => void;
  labelledBy: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      className="cr-sheet"
      aria-labelledby={labelledBy}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="cr-sheet__body">{children}</div>
    </dialog>
  );
}
