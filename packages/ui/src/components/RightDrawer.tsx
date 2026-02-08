"use client";

import { useEffect, useCallback } from "react";
import type { ReactNode } from "react";

type RightDrawerProps = {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
};

export function RightDrawer({ open, onClose, title, children }: RightDrawerProps) {
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    },
    [onClose]
  );

  useEffect(() => {
    if (open) {
      document.addEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [open, handleKeyDown]);

  return (
    <div className={`right-drawer-overlay${open ? " right-drawer-open" : ""}`}>
      <button
        className="right-drawer-backdrop"
        type="button"
        onClick={onClose}
        aria-label="Close drawer"
        tabIndex={-1}
      />
      <div className="right-drawer-panel" role="dialog" aria-modal="true">
        <div className="right-drawer-header">
          <h3>{title ?? "Details"}</h3>
          <button
            className="ghost-btn"
            type="button"
            onClick={onClose}
            aria-label="Close"
          >
            Close
          </button>
        </div>
        <div className="right-drawer-body">
          {children}
        </div>
      </div>
    </div>
  );
}
