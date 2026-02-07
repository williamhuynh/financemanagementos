import Link from "next/link";

export default function NotFound() {
  return (
    <div className="auth-page">
      <div className="auth-card card" style={{ textAlign: "center" }}>
        <h2 className="auth-title">Page not found</h2>
        <p className="auth-sub">
          The page you&rsquo;re looking for doesn&rsquo;t exist.
        </p>
        <Link className="primary-btn" href="/dashboard">
          Go to dashboard
        </Link>
      </div>
    </div>
  );
}
