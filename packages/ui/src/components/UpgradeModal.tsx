"use client";

import { useEffect, useCallback } from "react";
import { createPortal } from "react-dom";

type UpgradeModalProps = {
  open: boolean;
  onClose: () => void;
  limitLabel: string;    // e.g. "accounts", "assets", "members"
  currentCount: number;
  maxCount: number;
  planLabel?: string;     // e.g. "Free"
};

export function UpgradeModal({
  open,
  onClose,
  limitLabel,
  currentCount,
  maxCount,
  planLabel = "Free",
}: UpgradeModalProps) {
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
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

  if (!open) return null;

  return createPortal(
    <div className="upgrade-modal-overlay">
      <button
        className="upgrade-modal-backdrop"
        type="button"
        onClick={onClose}
        aria-label="Close"
        tabIndex={-1}
      />
      <div className="upgrade-modal" role="dialog" aria-modal="true">
        <div className="upgrade-modal-header">
          <h3>Plan limit reached</h3>
          <button className="ghost-btn" type="button" onClick={onClose}>
            Close
          </button>
        </div>
        <div className="upgrade-modal-body">
          <p>
            You&apos;ve reached the {planLabel} plan limit of{" "}
            <strong>
              {maxCount} {limitLabel}
            </strong>
            .
          </p>
          <div className="upgrade-modal-usage">
            <div className="upgrade-modal-bar">
              <div
                className="upgrade-modal-bar-fill"
                style={{ width: "100%" }}
              />
            </div>
            <span className="upgrade-modal-count">
              {currentCount}/{maxCount} {limitLabel} used
            </span>
          </div>
          <p className="upgrade-modal-cta-text">
            Upgrade to Pro for unlimited {limitLabel} and more.
          </p>
        </div>
        <div className="upgrade-modal-footer">
          <button className="ghost-btn" type="button" onClick={onClose}>
            Maybe later
          </button>
          <a className="primary-btn" href="/settings/billing">
            View plans
          </a>
        </div>
      </div>
    </div>,
    document.body
  );
}
