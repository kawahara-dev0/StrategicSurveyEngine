import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Route, Routes } from "react-router-dom";
import { render } from "@/test/test-utils";
import { SurveyModeration } from "@/pages/SurveyModeration";

jest.mock("@/lib/api", () => ({
  listResponses: jest.fn(),
  getResponse: jest.fn(),
  createOpinion: jest.fn(),
  listOpinions: jest.fn(),
  updateOpinion: jest.fn(),
  getSurvey: jest.fn(),
  listUpvotesForOpinion: jest.fn(),
  updateUpvote: jest.fn(),
}));

const api = jest.requireMock("@/lib/api") as {
  listResponses: jest.Mock;
  getResponse: jest.Mock;
  createOpinion: jest.Mock;
  listOpinions: jest.Mock;
  getSurvey: jest.Mock;
};

const mockSurveyId = "mod-survey-uuid";

function SurveyModerationRoute() {
  return (
    <Routes>
      <Route path="/admin/surveys/:surveyId/moderation" element={<SurveyModeration />} />
    </Routes>
  );
}

const defaultSurvey = {
  id: mockSurveyId,
  name: "Moderation Survey",
  schema_name: "survey_mod",
  status: "active",
  contract_end_date: "2025-01-01",
  deletion_due_date: "2025-04-01",
  notes: null,
  access_code: "CODE",
};

const defaultResponses = [
  {
    id: "resp-1",
    submitted_at: "2025-01-15T10:00:00Z",
    status: "pending" as const,
  },
];

const defaultResponseDetail = {
  id: "resp-1",
  submitted_at: "2025-01-15T10:00:00Z",
  answers: [
    { question_id: 1, label: "Improvement idea", answer_text: "Better processes", is_disclosure_agreed: false },
  ],
};

const defaultOpinions = [
  {
    id: 1,
    raw_response_id: "resp-2",
    title: "Published opinion",
    content: "Refined content",
    priority_score: 8,
  },
];

function renderSurveyModeration() {
  return render(<SurveyModerationRoute />, {
    routerProps: {
      initialEntries: [`/admin/surveys/${mockSurveyId}/moderation`],
      initialIndex: 0,
    },
  });
}

describe("SurveyModeration", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    api.getSurvey.mockResolvedValue(defaultSurvey);
    api.listResponses.mockResolvedValue(defaultResponses);
    api.getResponse.mockResolvedValue(defaultResponseDetail);
    api.listOpinions.mockResolvedValue(defaultOpinions);
  });

  it("renders moderation title and back button", async () => {
    renderSurveyModeration();

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: /moderation · moderation survey/i })).toBeInTheDocument();
    });
    expect(screen.getByRole("button", { name: /back to survey/i })).toBeInTheDocument();
  });

  it("shows Submitted responses section", async () => {
    renderSurveyModeration();

    await waitFor(() => {
      expect(screen.getByText(/submitted responses/i)).toBeInTheDocument();
    });
  });

  it("shows Published opinions section", async () => {
    renderSurveyModeration();

    await waitFor(() => {
      expect(screen.getByText(/published opinions/i)).toBeInTheDocument();
    });
  });

  it("lists raw responses when loaded", async () => {
    renderSurveyModeration();

    await waitFor(() => {
      expect(screen.getByText(/resp-1/i)).toBeInTheDocument();
    });
  });

  it("shows response detail and publish form when response is selected", async () => {
    const user = userEvent.setup();
    renderSurveyModeration();

    await waitFor(() => {
      expect(screen.getByText(/resp-1/i)).toBeInTheDocument();
    });

    await user.click(screen.getByText(/resp-1/i).closest("button")!);

    await waitFor(() => {
      expect(screen.getByText(/response content/i)).toBeInTheDocument();
    });
    expect(
      screen.getAllByText((_, el) => {
        const text = el?.textContent ?? "";
        return text.includes("Improvement idea") && text.includes("Better processes");
      }).length
    ).toBeGreaterThan(0);
    expect(screen.getByPlaceholderText(/anonymized summary title/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/refined content for publication/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /publish opinion/i })).toBeInTheDocument();
  });

  it("calls createOpinion when Publish opinion is submitted", async () => {
    const user = userEvent.setup();
    api.createOpinion.mockResolvedValue({ id: 1 });

    renderSurveyModeration();

    await waitFor(() => {
      expect(screen.getByText(/resp-1/i)).toBeInTheDocument();
    });

    await user.click(screen.getByText(/resp-1/i).closest("button")!);

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/anonymized summary title/i)).toBeInTheDocument();
    });

    await user.type(screen.getByPlaceholderText(/anonymized summary title/i), "New opinion title");
    await user.type(screen.getByPlaceholderText(/refined content for publication/i), "Refined content for publication");
    await user.click(screen.getByRole("button", { name: /publish opinion/i }));

    await waitFor(() => {
      expect(api.createOpinion).toHaveBeenCalledWith(
        mockSurveyId,
        expect.objectContaining({
          raw_response_id: "resp-1",
          title: "New opinion title",
          content: "Refined content for publication",
        })
      );
    });
  });

  it("shows empty state when no responses", async () => {
    api.listResponses.mockResolvedValue([]);

    renderSurveyModeration();

    await waitFor(() => {
      expect(screen.getByText(/no submissions yet/i)).toBeInTheDocument();
    });
  });

  it("shows published opinions list", async () => {
    renderSurveyModeration();

    await waitFor(() => {
      expect(screen.getByText("Refined content")).toBeInTheDocument();
    });
  });
});
