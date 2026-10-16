import { useEffect, useId, useRef } from "react";
import type { ReactNode } from "react";

export function FormDialog({
  title,
  children,
  onClose,
  busy = false,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  busy?: boolean;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    if (!dialog.current?.open) dialog.current?.showModal();
  }, []);
  return (
    <dialog
      ref={dialog}
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onClose();
      }}
      className="m-auto w-[calc(100%_-_2rem)] max-w-lg max-h-[90vh] overflow-y-auto rounded-lg border border-gray-200 bg-white p-6 shadow-xl backdrop:bg-black/50"
    >
      <h2 id={titleId} className="text-xl font-bold mb-4">
        {title}
      </h2>
      {children}
    </dialog>
  );
}
