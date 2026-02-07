"use client";

import { useEffect, useState } from "react";
import { Card } from "@tandemly/ui";

type Member = {
  id: string;
  user_id: string;
  name: string;
  email: string;
  role: string;
};

type Invitation = {
  id: string;
  email: string;
  role: string;
  expires_at: string;
};

type MembersSectionProps = {
  workspaceId: string;
  currentUserId: string;
  userRole: string;
};

export default function MembersSection({
  workspaceId,
  currentUserId,
  userRole,
}: MembersSectionProps) {
  const [members, setMembers] = useState<Member[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("editor");
  const [inviting, setInviting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);

  const canManageMembers = userRole === "owner" || userRole === "admin";

  useEffect(() => {
    async function fetchData() {
      try {
        const [membersRes, invitationsRes] = await Promise.all([
          fetch(`/api/workspaces/${workspaceId}/members`),
          canManageMembers
            ? fetch(`/api/workspaces/${workspaceId}/invitations`)
            : Promise.resolve({ ok: true, json: () => ({ invitations: [] }) }),
        ]);

        if (membersRes.ok) {
          const data = await membersRes.json();
          setMembers(data.members || []);
        }

        if (invitationsRes.ok) {
          const data = await (invitationsRes as Response).json();
          setInvitations(data.invitations || []);
        }
      } catch (err) {
        console.error("Failed to fetch members:", err);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [workspaceId, canManageMembers]);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setInviting(true);
    setError(null);
    setInviteUrl(null);

    try {
      const response = await fetch(`/api/workspaces/${workspaceId}/invitations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: inviteEmail, role: inviteRole }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Failed to send invitation");
        return;
      }

      setInviteUrl(data.inviteUrl);
      setInvitations([
        ...invitations,
        {
          id: data.invitation.id,
          email: data.invitation.email,
          role: data.invitation.role,
          expires_at: data.invitation.expires_at,
        },
      ]);
      setInviteEmail("");
    } catch {
      setError("Failed to send invitation");
    } finally {
      setInviting(false);
    }
  };

  const handleCancelInvitation = async (invitationId: string) => {
    try {
      const response = await fetch(
        `/api/workspaces/${workspaceId}/invitations/${invitationId}`,
        { method: "DELETE" }
      );

      if (response.ok) {
        setInvitations(invitations.filter((inv) => inv.id !== invitationId));
      }
    } catch {
      console.error("Failed to cancel invitation");
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    if (!confirm("Are you sure you want to remove this member?")) {
      return;
    }

    try {
      const response = await fetch(
        `/api/workspaces/${workspaceId}/members/${memberId}`,
        { method: "DELETE" }
      );

      if (response.ok) {
        setMembers(members.filter((m) => m.id !== memberId));
      }
    } catch {
      console.error("Failed to remove member");
    }
  };

  if (loading) {
    return (
      <Card title="Members">
        <p className="loading-text">Loading members...</p>
      </Card>
    );
  }

  return (
    <Card title="Members">
      {members.map((member) => (
        <div key={member.id} className="list-row">
          <div>
            <div className="row-title">{member.name || member.email}</div>
            <div className="row-sub" style={{ textTransform: "capitalize" }}>
              {member.role}
            </div>
          </div>
          {canManageMembers &&
            member.user_id !== currentUserId &&
            member.role !== "owner" && (
              <button
                className="ghost-btn danger"
                type="button"
                onClick={() => handleRemoveMember(member.id)}
              >
                Remove
              </button>
            )}
        </div>
      ))}

      {invitations.length > 0 && (
        <>
          <div className="section-divider">
            <span>Pending Invitations</span>
          </div>
          {invitations.map((invitation) => (
            <div key={invitation.id} className="list-row pending">
              <div>
                <div className="row-title">{invitation.email}</div>
                <div className="row-sub" style={{ textTransform: "capitalize" }}>
                  {invitation.role} (pending)
                </div>
              </div>
              <button
                className="ghost-btn"
                type="button"
                onClick={() => handleCancelInvitation(invitation.id)}
              >
                Cancel
              </button>
            </div>
          ))}
        </>
      )}

      {canManageMembers && (
        <>
          {!showInviteForm ? (
            <button
              className="primary-btn"
              type="button"
              style={{ marginTop: "16px" }}
              onClick={() => setShowInviteForm(true)}
            >
              Invite Member
            </button>
          ) : (
            <form onSubmit={handleInvite} className="invite-form">
              <div className="form-row">
                <input
                  type="email"
                  placeholder="Email address"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  required
                  className="text-input"
                />
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value)}
                  className="role-select"
                >
                  <option value="viewer">Viewer</option>
                  <option value="editor">Editor</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              {error && <p className="auth-error">{error}</p>}
              {inviteUrl && (
                <div className="invite-url-box">
                  <p className="auth-success">Invitation created! Share this link:</p>
                  <input
                    type="text"
                    value={inviteUrl}
                    readOnly
                    className="text-input"
                    onClick={(e) => (e.target as HTMLInputElement).select()}
                  />
                </div>
              )}
              <div className="form-actions">
                <button
                  type="button"
                  className="ghost-btn"
                  onClick={() => {
                    setShowInviteForm(false);
                    setInviteUrl(null);
                    setError(null);
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="primary-btn"
                  disabled={inviting}
                >
                  {inviting ? "Sending..." : "Send Invitation"}
                </button>
              </div>
            </form>
          )}
        </>
      )}
    </Card>
  );
}
