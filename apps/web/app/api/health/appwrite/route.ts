import { NextResponse } from "next/server";

export async function GET() {
  const endpoint = process.env.APPWRITE_ENDPOINT ?? process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT;
  const projectId = process.env.APPWRITE_PROJECT_ID ?? process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID;
  const apiKey = process.env.APPWRITE_API_KEY;

  if (!endpoint || !projectId) {
    return NextResponse.json({
      status: "warning",
      detail: "Missing Appwrite endpoint or project ID"
    });
  }

  if (!apiKey) {
    return NextResponse.json({
      status: "warning",
      detail: "Missing server API key"
    });
  }

  try {
    const response = await fetch(`${endpoint}/health`, {
      cache: "no-store",
      headers: {
        "X-Appwrite-Project": projectId,
        "X-Appwrite-Key": apiKey
      }
    });

    if (!response.ok) {
      return NextResponse.json({
        status: "error",
        detail: `Health check failed (${response.status})`
      });
    }

    return NextResponse.json({
      status: "ok",
      detail: "Server health confirmed"
    });
  } catch (error) {
    return NextResponse.json({
      status: "error",
      detail: "Unable to reach Appwrite health endpoint"
    });
  }
}
