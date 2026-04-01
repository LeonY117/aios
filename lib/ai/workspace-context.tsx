"use client";

import { createContext, useContext } from "react";

type WorkspaceContextValue = { sessionName: string };

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

export const WorkspaceProvider = WorkspaceContext.Provider;

export function useWorkspaceName(): string {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error("useWorkspaceName must be used within WorkspaceProvider");
  return ctx.sessionName;
}
