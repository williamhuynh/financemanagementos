"use client";

import { useEffect, useCallback, useState } from "react";
import type { ReactNode } from "react";

type DetailPanelProps = {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
};

export function DetailPanel({ open, onClose, title, children }: DetailPanelProps) {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mql = window.matchMedia("(max-width: 720px)");
    setIsMobile(mql.matches);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, []);

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
      if (isMobile) {
        document.body.style.overflow = "hidden";
      } else {
        document.body.classList.add("detail-panel-active");
      }
    }
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      if (isMobile) {
        document.body.style.overflow = "";
      }
      document.body.classList.remove("detail-panel-active");
    };
  }, [open, handleKeyDown, isMobile]);

  return (
    <>
      {open && isMobile && (
        <button
          className="detail-panel-backdrop"
          type="button"
          onClick={onClose}
          aria-label="Close panel"
          tabIndex={-1}
        />
      )}
      <aside
        className={`detail-panel${open ? " detail-panel-open" : ""}`}
        role="complementary"
        aria-label={title ?? "Details"}
      >
        <div className="detail-panel-header">
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
        <div className="detail-panel-body">
          {children}
        </div>
      </aside>
    </>
  );
}
