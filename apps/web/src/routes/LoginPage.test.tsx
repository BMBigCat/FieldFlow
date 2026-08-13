import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { LoginPage } from "./LoginPage";

const signIn = vi.fn().mockResolvedValue({ error: null });

vi.mock("../lib/auth-context", () => ({
  useAuth: () => ({ session: null, loading: false, signIn, signOut: vi.fn() }),
}));

describe("LoginPage", () => {
  it("renders the sign-in form", () => {
    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>,
    );
    expect(screen.getByRole("heading", { name: /sign in to fieldflow/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
  });

  it("calls signIn with the entered credentials on submit", async () => {
    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>,
    );
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: "admin@acme.test" } });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: "hunter22222" } });
    fireEvent.click(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(() => expect(signIn).toHaveBeenCalledWith("admin@acme.test", "hunter22222"));
  });
});
