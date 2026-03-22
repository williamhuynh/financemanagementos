import { NextResponse } from "next/server";
import { createSessionClient } from "../../../../lib/api-auth";
import {
  validateBody,
  UpdateNameSchema,
  UpdateEmailSchema,
  UpdatePasswordSchema,
} from "../../../../lib/validations";
import { rateLimit, AUTH_RATE_LIMITS } from "../../../../lib/rate-limit";

export const dynamic = "force-dynamic";

/**
 * PATCH /api/account/profile
 *
 * Update profile details for the currently logged-in user.
 * Requires ?action= query parameter:
 *   - name     → update display name (no password needed)
 *   - email    → update email address (requires current password; resets verification)
 *   - password → change password (requires old password)
 */
export async function PATCH(request: Request) {
  const blocked = await rateLimit(request, AUTH_RATE_LIMITS.login);
  if (blocked) return blocked;

  const sessionClient = await createSessionClient();
  if (!sessionClient) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const action = url.searchParams.get("action");

  try {
    const body = await request.json();

    if (action === "name") {
      const parsed = validateBody(UpdateNameSchema, body);
      if (!parsed.success) {
        return NextResponse.json({ error: parsed.error }, { status: 400 });
      }

      await sessionClient.account.updateName(parsed.data.name);
      return NextResponse.json({ success: true });
    }

    if (action === "email") {
      const parsed = validateBody(UpdateEmailSchema, body);
      if (!parsed.success) {
        return NextResponse.json({ error: parsed.error }, { status: 400 });
      }

      await sessionClient.account.updateEmail(parsed.data.email, parsed.data.password);

      // Email change resets verification — send a new verification email
      let emailVerificationSent = false;
      try {
        const origin =
          process.env.NEXT_PUBLIC_APP_URL ||
          request.headers.get("origin") ||
          "http://localhost:3000";
        await sessionClient.account.createVerification(`${origin}/verify-email`);
        emailVerificationSent = true;
      } catch {
        // Non-critical — email was updated successfully even if re-verification fails
      }

      return NextResponse.json({ success: true, emailVerificationSent });
    }

    if (action === "password") {
      const parsed = validateBody(UpdatePasswordSchema, body);
      if (!parsed.success) {
        return NextResponse.json({ error: parsed.error }, { status: 400 });
      }

      await sessionClient.account.updatePassword(
        parsed.data.password,
        parsed.data.oldPassword
      );
      return NextResponse.json({ success: true });
    }

    return NextResponse.json(
      { error: "Invalid action. Use name, email, or password." },
      { status: 400 }
    );
  } catch (error: unknown) {
    const err = error as { message?: string; code?: number };
    if (err.code === 401 || err.message?.toLowerCase().includes("invalid credentials")) {
      return NextResponse.json(
        { error: "Current password is incorrect." },
        { status: 401 }
      );
    }
    if (err.message?.toLowerCase().includes("email already exists") || err.code === 409) {
      return NextResponse.json(
        { error: "That email address is already in use." },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { error: "Update failed. Please try again." },
      { status: 500 }
    );
  }
}
