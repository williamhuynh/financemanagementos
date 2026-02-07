"use client";

export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="auth-page">
      <div className="auth-card card" style={{ textAlign: "center" }}>
        <h2 className="auth-title">Something went wrong</h2>
        <p className="auth-sub">
          An unexpected error occurred. Please try again.
        </p>
        {error.digest && (
          <p className="row-sub">Error ID: {error.digest}</p>
        )}
        <button className="primary-btn" type="button" onClick={reset}>
          Try again
        </button>
      </div>
    </div>
  );
}
