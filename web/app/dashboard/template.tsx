import type { ReactNode } from "react";

/* A template remounts on every navigation, so this replays the fade for each page. */
export default function Template({ children }: { children: ReactNode }) {
  return <div className="dp-fade">{children}</div>;
}