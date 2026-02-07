"use client";

import { useEffect, useCallback } from "react";
import type { ReactNode } from "react";

type BottomDrawerProps = {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
};

export function BottomDrawer({ open, onClose, title, children }: BottomDrawerProps) {
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
    <div className={`bottom-drawer-overlay${open ? " bottom-drawer-open" : ""}`}>
      <button
        className="bottom-drawer-backdrop"
        type="button"
        onClick={onClose}
        aria-label="Close drawer"
        tabIndex={-1}
      />
      <div className="bottom-drawer-panel" role="dialog" aria-modal="true">
        <div className="bottom-drawer-handle" />
        {title ? (
          <div className="bottom-drawer-header">
            <h3>{title}</h3>
            <button
              className="ghost-btn"
              type="button"
              onClick={onClose}
              aria-label="Close"
            >
              Done
            </button>
          </div>
        ) : null}
        <div className="bottom-drawer-body">
          {children}
        </div>
      </div>
    </div>
  );
}
