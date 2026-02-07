"use client";

import { useEffect, useCallback } from "react";
import type { ReactNode } from "react";

type DrawerProps = {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
};

export function Drawer({ open, onClose, children }: DrawerProps) {
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
    <div className={`drawer-overlay ${open ? "drawer-open" : ""}`}>
      <button
        className="drawer-backdrop"
        type="button"
        onClick={onClose}
        aria-label="Close menu"
        tabIndex={-1}
      />
      <div className="drawer-panel">
        {children}
      </div>
    </div>
  );
}
