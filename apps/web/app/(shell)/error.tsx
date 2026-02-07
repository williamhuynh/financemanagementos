"use client";

import { useRouter } from "next/navigation";

export default function ShellError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const router = useRouter();

  return (
    <div style={{ padding: "40px 0" }}>
      <div className="card" style={{ maxWidth: 480 }}>
        <div className="card-title">Error</div>
        <h2
          style={{
            fontSize: 20,
            fontWeight: 600,
            margin: "12px 0 8px",
          }}
        >
          Something went wrong
        </h2>
        <p className="row-sub" style={{ marginBottom: 16 }}>
          We hit an unexpected error loading this page.
        </p>
        {error.digest && (
          <p className="row-sub" style={{ marginBottom: 16 }}>
            Error ID: {error.digest}
          </p>
        )}
        <div style={{ display: "flex", gap: 10 }}>
          <button className="primary-btn" type="button" onClick={reset}>
            Try again
          </button>
          <button
            className="ghost-btn"
            type="button"
            onClick={() => router.push("/dashboard")}
          >
            Go to dashboard
          </button>
        </div>
      </div>
    </div>
  );
}
