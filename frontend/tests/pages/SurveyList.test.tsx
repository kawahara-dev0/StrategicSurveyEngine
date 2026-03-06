import { screen, waitFor } from "@testing-library/react";
import { Route, Routes } from "react-router-dom";
import { render } from "@/test/test-utils";
import { SurveyList } from "@/pages/SurveyList";

jest.mock("@/lib/api", () => ({
  listSurveys: jest.fn(),
  deleteSurvey: jest.fn(),
}));

const api = jest.requireMock("@/lib/api") as {
  listSurveys: jest.Mock;
  deleteSurvey: jest.Mock;
};

function SurveyListRoute() {
  return (
    <Routes>
      <Route path="/admin" element={<SurveyList />} />
    </Routes>
  );
}

function renderSurveyList() {
  return render(<SurveyListRoute />, {
    routerProps: {
      initialEntries: ["/admin"],
      initialIndex: 0,
    },
  });
}

describe("SurveyList", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("shows empty state when no surveys", async () => {
    api.listSurveys.mockResolvedValue([]);

    renderSurveyList();

    await waitFor(() => {
      expect(screen.getByText(/no surveys yet/i)).toBeInTheDocument();
    });
    expect(screen.getByText(/create your first survey/i)).toBeInTheDocument();
  });

  it("shows survey list when surveys exist", async () => {
    api.listSurveys.mockResolvedValue([
      {
        id: "survey-1",
        name: "Feedback 2024",
        schema_name: "survey_abc",
        status: "active",
        contract_end_date: "2025-01-01",
        deletion_due_date: "2025-04-01",
        notes: null,
        access_code: "XYZ123",
      },
    ]);

    renderSurveyList();

    await waitFor(() => {
      expect(screen.getByText(/feedback 2024/i)).toBeInTheDocument();
    });
    expect(screen.getByRole("link", { name: /feedback 2024/i })).toBeInTheDocument();
  });

  it("shows error when list fails", async () => {
    api.listSurveys.mockRejectedValue(new Error("Network error"));

    renderSurveyList();

    await waitFor(() => {
      expect(screen.getByText(/failed to load surveys/i)).toBeInTheDocument();
    });
  });
});
