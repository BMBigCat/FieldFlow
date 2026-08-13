import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import App from "./App";

vi.mock("./lib/auth-context", () => ({
  useAuth: () => ({ session: null, loading: false, signIn: vi.fn(), signOut: vi.fn() }),
  AuthProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

describe("App", () => {
  it("redirects unauthenticated visitors to the login page", async () => {
    window.history.pushState({}, "", "/");
    const queryClient = new QueryClient();
    render(
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>,
    );
    expect(await screen.findByRole("heading", { name: /sign in to fieldflow/i })).toBeInTheDocument();
  });
});
