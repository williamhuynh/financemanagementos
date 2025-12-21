import { appwriteEnabled } from "./appwriteClient";
import { headers } from "next/headers";

type HealthStatus = "ok" | "warning" | "error";

export type HealthCheck = {
  id: string;
  name: string;
  status: HealthStatus;
  detail: string;
};

async function checkAppwrite(): Promise<HealthCheck> {
  if (!appwriteEnabled) {
    return {
      id: "appwrite",
      name: "Appwrite",
      status: "warning",
      detail: "Missing project or database configuration"
    };
  }

  try {
    const headerList = await headers();
    const forwardedHost = headerList.get("x-forwarded-host");
    const host = forwardedHost ?? headerList.get("host") ?? "localhost:3000";
    const forwardedProto = headerList.get("x-forwarded-proto");
    const protocol = forwardedProto ?? (host.includes("localhost") ? "http" : "https");
    const baseUrl = `${protocol}://${host}`;
    const response = await fetch(`${baseUrl}/api/health/appwrite`, {
      cache: "no-store"
    });
    const payload = (await response.json()) as { status?: HealthStatus; detail?: string };

    if (payload?.status && payload?.detail) {
      return {
        id: "appwrite",
        name: "Appwrite",
        status: payload.status,
        detail: payload.detail
      };
    }

    return {
      id: "appwrite",
      name: "Appwrite",
      status: "warning",
      detail: "Health endpoint returned unexpected response"
    };
  } catch (error) {
    return {
      id: "appwrite",
      name: "Appwrite",
      status: "error",
      detail: "Unable to reach health endpoint"
    };
  }
}

export async function getHealthChecks(): Promise<HealthCheck[]> {
  const appwrite = await checkAppwrite();

  return [
    appwrite,
    {
      id: "data-source",
      name: "Data source",
      status: appwriteEnabled ? "ok" : "warning",
      detail: appwriteEnabled ? "Appwrite collections configured" : "Using mock data fallback"
    },
    {
      id: "ui-shell",
      name: "UI shell",
      status: "ok",
      detail: "Next.js App Router ready"
    }
  ];
}
