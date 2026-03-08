import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Route, Routes } from "react-router-dom";
import { render } from "@/test/test-utils";
import { ManagerDashboard } from "@/pages/ManagerDashboard";
import * as apiModule from "@/lib/api";

jest.mock("@/lib/api", () => ({
  managerAuth: jest.fn(),
  getManagerSurvey: jest.fn(),
  listManagerOpinions: jest.fn(),
  listManagerUpvotes: jest.fn(),
  exportManagerReport: jest.fn(),
  getManagerToken: jest.fn(() => null),
  setManagerToken: jest.fn(),
  clearManagerToken: jest.fn(),
}));

const api = apiModule as jest.Mocked<typeof apiModule>;
const mockSurveyId = "manager-survey-uuid";

function ManagerDashboardRoute() {
  return (
    <Routes>
      <Route path="/manager/:surveyId" element={<ManagerDashboard />} />
    </Routes>
  );
}

const defaultOpinions = [
  {
    id: 1,
    title: "Improve tooling",
    content: "Better tools needed",
    priority_score: 10,
    importance: 2,
    urgency: 2,
    expected_impact: 2,
    supporter_points: 0,
    supporters: 2,
  },
];

function renderManagerDashboard() {
  return render(<ManagerDashboardRoute />, {
    routerProps: {
      initialEntries: [`/manager/${mockSurveyId}`],
      initialIndex: 0,
    },
  });
}

describe("ManagerDashboard", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (api.getManagerToken as jest.Mock).mockReturnValue(null);
  });

  it("shows login form when not authenticated", () => {
    renderManagerDashboard();

    expect(
      screen.getByRole("heading", { name: /manager access/i })
    ).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/access code/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /sign in/i })).toBeInTheDocument();
  });

  it("shows survey ID in login form", () => {
    renderManagerDashboard();

    expect(screen.getByText(mockSurveyId)).toBeInTheDocument();
  });

  it("calls managerAuth when form is submitted", async () => {
    const user = userEvent.setup();
    (api.managerAuth as jest.Mock).mockResolvedValue({ access_token: "jwt-token" });

    renderManagerDashboard();

    await user.type(screen.getByPlaceholderText(/access code/i), "SECRET123");
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(() => {
      expect(api.managerAuth).toHaveBeenCalledWith(mockSurveyId, "SECRET123");
    });
  });

  it("shows dashboard when authenticated", async () => {
    (api.getManagerToken as jest.Mock).mockReturnValue("jwt-token");
    (api.getManagerSurvey as jest.Mock).mockResolvedValue({ name: "Survey 1" });
    (api.listManagerOpinions as jest.Mock).mockResolvedValue(defaultOpinions);

    renderManagerDashboard();

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: /manager dashboard/i })).toBeInTheDocument();
    });
    await waitFor(() => {
      expect(screen.getByText(/improve tooling/i)).toBeInTheDocument();
    });
    expect(screen.getByRole("button", { name: /export excel/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /export pdf/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /log out/i })).toBeInTheDocument();
  });

  it("shows empty state when no opinions", async () => {
    (api.getManagerToken as jest.Mock).mockReturnValue("jwt-token");
    (api.listManagerOpinions as jest.Mock).mockResolvedValue([]);

    renderManagerDashboard();

    await waitFor(() => {
      expect(screen.getByText(/no published opinions yet/i)).toBeInTheDocument();
    });
  });

  it("shows error when auth fails", async () => {
    const user = userEvent.setup();
    (api.managerAuth as jest.Mock).mockRejectedValue(new Error("Invalid code"));

    renderManagerDashboard();

    await user.type(screen.getByPlaceholderText(/access code/i), "wrong");
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(() => {
      expect(screen.getByText(/invalid code/i)).toBeInTheDocument();
    });
  });

  it("displays PII with label 'PII:' (not 'PII (disclosed)') when opinion has disclosed_pii", async () => {
    const opinionsWithPii = [
      {
        ...defaultOpinions[0],
        disclosed_pii: { Name: "Alice", Email: "alice@example.com" },
      },
    ];
    (api.getManagerToken as jest.Mock).mockReturnValue("jwt-token");
    (api.getManagerSurvey as jest.Mock).mockResolvedValue({ name: "Survey 1" });
    (api.listManagerOpinions as jest.Mock).mockResolvedValue(opinionsWithPii);

    renderManagerDashboard();

    await waitFor(() => {
      expect(screen.getByText(/improve tooling/i)).toBeInTheDocument();
    });
    expect(screen.getByText(/PII:/)).toBeInTheDocument();
    expect(screen.queryByText(/PII \(disclosed\)/)).not.toBeInTheDocument();
  });
});
