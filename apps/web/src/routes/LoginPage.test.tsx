import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { ThemeProvider } from "../lib/theme-context";
import { LoginPage } from "./LoginPage";

const signIn = vi.fn().mockResolvedValue({ error: null });

vi.mock("../lib/auth-context", () => ({
  useAuth: () => ({ session: null, loading: false, signIn, signOut: vi.fn() }),
}));

function renderLoginPage() {
  return render(
    <ThemeProvider>
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>
    </ThemeProvider>,
  );
}

describe("LoginPage", () => {
  it("renders the sign-in form", () => {
    renderLoginPage();
    expect(screen.getByRole("heading", { name: /sign in to fieldflow/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
  });

  it("calls signIn with the entered credentials on submit", async () => {
    renderLoginPage();
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: "admin@acme.test" } });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: "hunter22222" } });
    fireEvent.click(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(() => expect(signIn).toHaveBeenCalledWith("admin@acme.test", "hunter22222"));
  });
});
