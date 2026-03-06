import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Route, Routes } from "react-router-dom";
import { render } from "@/test/test-utils";
import { SurveyDetail } from "@/pages/SurveyDetail";

jest.mock("@/lib/api", () => ({
  getSurvey: jest.fn(),
  listQuestions: jest.fn(),
  createQuestion: jest.fn(),
  deleteQuestion: jest.fn(),
  resetSurveyAccessCode: jest.fn(),
}));

const api = jest.requireMock("@/lib/api") as {
  getSurvey: jest.Mock;
  listQuestions: jest.Mock;
  createQuestion: jest.Mock;
  deleteQuestion: jest.Mock;
  resetSurveyAccessCode: jest.Mock;
};

const mockSurveyId = "abc12345-0000-0000-0000-000000000000";

function SurveyDetailRoute() {
  return (
    <Routes>
      <Route path="/admin/surveys/:surveyId" element={<SurveyDetail />} />
    </Routes>
  );
}

const defaultSurvey = {
  id: mockSurveyId,
  name: "Feedback Survey",
  schema_name: "survey_abc12345",
  status: "active",
  contract_end_date: "2025-01-01",
  deletion_due_date: "2025-04-01",
  notes: null,
  access_code: "CODE123",
};

const defaultQuestions = [
  {
    id: 1,
    survey_id: mockSurveyId,
    label: "Improvement idea",
    question_type: "text",
    options: null,
    is_required: true,
    is_personal_data: false,
  },
];

function renderSurveyDetail() {
  return render(<SurveyDetailRoute />, {
    routerProps: {
      initialEntries: [`/admin/surveys/${mockSurveyId}`],
      initialIndex: 0,
    },
  });
}

describe("SurveyDetail", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    api.getSurvey.mockResolvedValue(defaultSurvey);
    api.listQuestions.mockResolvedValue(defaultQuestions);
  });

  it("renders survey name and back button", async () => {
    renderSurveyDetail();

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: /feedback survey/i })).toBeInTheDocument();
    });
    expect(screen.getByRole("button", { name: /back to surveys/i })).toBeInTheDocument();
  });

  it("renders Manager access code block when survey has access_code", async () => {
    renderSurveyDetail();

    await waitFor(() => {
      expect(screen.getByText(/manager access code/i)).toBeInTheDocument();
    });
    await waitFor(() => {
      expect(screen.getByText("CODE123")).toBeInTheDocument();
    });
  });

  it("shows link to submission form and moderation", async () => {
    renderSurveyDetail();

    await waitFor(() => {
      expect(screen.getByText(/open submission form/i)).toBeInTheDocument();
    });
    expect(screen.getByRole("button", { name: /moderation workspace/i })).toBeInTheDocument();
  });

  it("shows questions list when questions exist", async () => {
    renderSurveyDetail();

    await waitFor(() => {
      expect(screen.getByText(/improvement idea/i)).toBeInTheDocument();
    });
    expect(screen.getByText(/text/i)).toBeInTheDocument();
    expect(screen.getByText(/required/i)).toBeInTheDocument();
  });

  it("shows Add question form when Add question button is clicked", async () => {
    const user = userEvent.setup();
    renderSurveyDetail();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /add question/i })).toBeInTheDocument();
    });

    const addButtons = screen.getAllByRole("button", { name: /add question/i });
    await user.click(addButtons[0]);

    expect(screen.getByRole("heading", { name: /new question/i })).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/e\.g\. improvement idea/i)).toBeInTheDocument();
    expect(screen.getByRole("combobox")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /cancel/i })).toBeInTheDocument();
  });

  it("calls createQuestion when form is submitted", async () => {
    const user = userEvent.setup();
    api.createQuestion.mockResolvedValue({
      id: 2,
      survey_id: mockSurveyId,
      label: "New question",
      question_type: "textarea",
      options: null,
      is_required: false,
      is_personal_data: false,
    });

    renderSurveyDetail();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /add question/i })).toBeInTheDocument();
    });

    const addButtons = screen.getAllByRole("button", { name: /add question/i });
    await user.click(addButtons[0]);
    await user.type(screen.getByPlaceholderText(/e\.g\. improvement idea/i), "New question");
    await user.click(
      screen.getAllByRole("button", { name: /add question/i }).find((el) => el.closest("form"))!
    );

    await waitFor(() => {
      expect(api.createQuestion).toHaveBeenCalledWith(
        mockSurveyId,
        expect.objectContaining({
          label: "New question",
          question_type: "text",
          is_required: false,
          is_personal_data: false,
        })
      );
    });
  });

  it("shows empty state when no questions", async () => {
    api.listQuestions.mockResolvedValue([]);

    renderSurveyDetail();

    await waitFor(() => {
      expect(screen.getByText(/no questions yet/i)).toBeInTheDocument();
    });
  });

});
