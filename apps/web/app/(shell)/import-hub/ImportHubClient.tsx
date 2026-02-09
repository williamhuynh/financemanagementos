"use client";

import ImportClient from "./ImportClient";

type ImportHubClientProps = {
  ownerOptions: string[];
};

export default function ImportHubClient({ ownerOptions }: ImportHubClientProps) {
  return <ImportClient ownerOptions={ownerOptions} />;
}
