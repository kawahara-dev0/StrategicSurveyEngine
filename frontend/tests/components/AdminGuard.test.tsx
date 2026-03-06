import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Route, Routes } from "react-router-dom";
import { render } from "@/test/test-utils";
import { AdminGuard } from "@/components/AdminGuard";

jest.mock("@/lib/api", () => ({
  verifyAdminPassword: jest.fn(),
  setAdminKeyForSession: jest.fn(),
  clearAdminKeySession: jest.fn(),
  hasAdminKey: jest.fn(() => false),
}));

const api = jest.requireMock("@/lib/api") as {
  verifyAdminPassword: jest.Mock;
  setAdminKeyForSession: jest.Mock;
  hasAdminKey: jest.Mock;
};

function AdminGuardRoute() {
  return (
    <Routes>
      <Route path="/admin" element={<AdminGuard />}>
        <Route index element={<div data-testid="admin-content">Admin content</div>} />
      </Route>
    </Routes>
  );
}

function renderAdminGuard() {
  return render(<AdminGuardRoute />, {
    routerProps: {
      initialEntries: ["/admin"],
      initialIndex: 0,
    },
  });
}

describe("AdminGuard", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    api.hasAdminKey.mockReturnValue(false);
  });

  it("shows login form when not authenticated", () => {
    renderAdminGuard();

    expect(
      screen.getByRole("heading", { name: /system administrator access/i })
    ).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText(/administrator password/i)
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /sign in/i })).toBeInTheDocument();
  });

  it("shows admin content after successful login", async () => {
    const user = userEvent.setup();
    api.verifyAdminPassword.mockResolvedValue({ ok: true });

    renderAdminGuard();

    await user.type(
      screen.getByPlaceholderText(/administrator password/i),
      "secret123"
    );
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(() => {
      expect(screen.getByTestId("admin-content")).toBeInTheDocument();
    });
    expect(api.setAdminKeyForSession).toHaveBeenCalledWith("secret123");
  });

  it("shows error when password is incorrect", async () => {
    const user = userEvent.setup();
    api.verifyAdminPassword.mockResolvedValue({ ok: false, status: 401 });

    renderAdminGuard();

    await user.type(
      screen.getByPlaceholderText(/administrator password/i),
      "wrong"
    );
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(() => {
      expect(screen.getByText(/incorrect password/i)).toBeInTheDocument();
    });
  });
});
