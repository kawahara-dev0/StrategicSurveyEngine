import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Route, Routes } from "react-router-dom";
import { render } from "@/test/test-utils";
import { SurveyCreate } from "@/pages/SurveyCreate";

jest.mock("@/lib/api", () => ({
  createSurvey: jest.fn(),
}));

const api = jest.requireMock("@/lib/api") as { createSurvey: jest.Mock };

function SurveyCreateRoute() {
  return (
    <Routes>
      <Route path="/admin/surveys/new" element={<SurveyCreate />} />
    </Routes>
  );
}

function renderSurveyCreate() {
  return render(<SurveyCreateRoute />, {
    routerProps: {
      initialEntries: ["/admin/surveys/new"],
      initialIndex: 0,
    },
  });
}

describe("SurveyCreate", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders create survey form with name input", () => {
    renderSurveyCreate();

    expect(
      screen.getByPlaceholderText(/q1 2025 feedback/i)
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /create survey/i })).toBeInTheDocument();
  });

  it("shows success screen with access code after creation", async () => {
    const user = userEvent.setup();
    api.createSurvey.mockResolvedValue({
      id: "survey-123",
      access_code: "ABC12345",
      name: "My Survey",
    });

    renderSurveyCreate();

    await user.type(
      screen.getByPlaceholderText(/q1 2025 feedback/i),
      "My Survey"
    );
    await user.click(screen.getByRole("button", { name: /create survey/i }));

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: /survey created/i })).toBeInTheDocument();
    });
    expect(screen.getByText(/ABC12345/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /open survey & add questions/i })).toBeInTheDocument();
  });

  it("disables submit when name is empty", () => {
    renderSurveyCreate();

    const createButton = screen.getByRole("button", { name: /^create survey$/i });
    expect(createButton).toBeDisabled();
  });
});
