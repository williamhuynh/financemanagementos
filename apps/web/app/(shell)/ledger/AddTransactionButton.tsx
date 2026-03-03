"use client";

type AddTransactionButtonProps = {
  onClick: () => void;
};

export default function AddTransactionButton({ onClick }: AddTransactionButtonProps) {
  return (
    <button
      className="icon-btn"
      onClick={onClick}
      title="Add transaction"
      aria-label="Add transaction"
    >
      +
    </button>
  );
}
