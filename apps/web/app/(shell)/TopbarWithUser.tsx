"use client";

import { useEffect, useState } from "react";
import { Account } from "appwrite";
import { Topbar } from "@financelab/ui";
import { appwriteEnabled, getAppwriteClient } from "../../lib/appwriteClient";

export default function TopbarWithUser() {
  const [userLabel, setUserLabel] = useState("Signed in");

  useEffect(() => {
    if (!appwriteEnabled) {
      return;
    }

    const appwrite = getAppwriteClient();
    if (!appwrite) {
      return;
    }

    const account = new Account(appwrite.client);
    account
      .get()
      .then((user) => {
        const label = user.name?.trim() || user.email?.trim();
        setUserLabel(label ? `Signed in as ${label}` : "Signed in");
      })
      .catch(() => {
        setUserLabel("Signed in");
      });
  }, []);

  return <Topbar userLabel={userLabel} />;
}
