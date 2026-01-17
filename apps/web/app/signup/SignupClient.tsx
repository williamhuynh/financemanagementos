"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Account, ID } from "appwrite";
import { appwriteEnabled, getAppwriteClient } from "../../lib/appwriteClient";

type FormState = "idle" | "sending" | "error";

export default function SignupClient() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [formState, setFormState] = useState<FormState>("idle");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!name.trim()) {
      setFormState("error");
      setStatusMessage("Enter your name.");
      return;
    }
    if (!email) {
      setFormState("error");
      setStatusMessage("Enter your email address.");
      return;
    }
    if (!password) {
      setFormState("error");
      setStatusMessage("Enter a password.");
      return;
    }
    if (password.length < 8) {
      setFormState("error");
      setStatusMessage("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setFormState("error");
      setStatusMessage("Passwords do not match.");
      return;
    }

    if (!appwriteEnabled) {
      setFormState("error");
      setStatusMessage("Appwrite auth is not configured yet.");
      return;
    }

    const appwrite = getAppwriteClient();
    if (!appwrite) {
      setFormState("error");
      setStatusMessage("Appwrite auth is not configured yet.");
      return;
    }

    setFormState("sending");
    setStatusMessage(null);

    try {
      const account = new Account(appwrite.client);

      // Create the user account
      await account.create(ID.unique(), email, password, name);

      // Create a session (log them in)
      await account.createEmailPasswordSession(email, password);

      // Redirect to onboarding for new users
      router.replace("/onboarding");
    } catch (error: unknown) {
      setFormState("error");
      if (error instanceof Error) {
        // Appwrite specific error messages
        if (error.message.includes("already exists")) {
          setStatusMessage("An account with this email already exists. Please sign in instead.");
        } else if (error.message.includes("Invalid email")) {
          setStatusMessage("Please enter a valid email address.");
        } else {
          setStatusMessage(error.message);
        }
      } else {
        setStatusMessage("Something went wrong. Please try again.");
      }
    }
  };

  return (
    <div className="auth-page">
      <div className="card auth-card">
        <div className="eyebrow">FinanceLab</div>
        <h1 className="auth-title">Create account</h1>
        <p className="auth-sub">Sign up to start managing your finances.</p>
        <form onSubmit={handleSubmit}>
          <label className="field">
            <span className="field-label">Name</span>
            <input
              className="field-input"
              type="text"
              name="name"
              autoComplete="name"
              placeholder="Your name"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </label>
          <label className="field">
            <span className="field-label">Email address</span>
            <input
              className="field-input"
              type="email"
              name="email"
              autoComplete="email"
              placeholder="you@example.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </label>
          <label className="field">
            <span className="field-label">Password</span>
            <input
              className="field-input"
              type="password"
              name="password"
              autoComplete="new-password"
              placeholder="At least 8 characters"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>
          <label className="field">
            <span className="field-label">Confirm password</span>
            <input
              className="field-input"
              type="password"
              name="confirmPassword"
              autoComplete="new-password"
              placeholder="Confirm your password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
            />
          </label>
          <button className="primary-btn" type="submit" disabled={formState === "sending"}>
            {formState === "sending" ? "Creating account..." : "Create account"}
          </button>
        </form>
        {statusMessage ? (
          <p className="auth-error">{statusMessage}</p>
        ) : null}
        <p className="auth-hint">
          Already have an account?{" "}
          <Link href="/login" className="auth-link">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
