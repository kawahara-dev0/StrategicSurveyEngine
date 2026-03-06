import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Route, Routes } from "react-router-dom";
import { render } from "@/test/test-utils";
import { SurveySearch } from "@/pages/SurveySearch";
import type { PublicOpinionItem } from "@/types/api";

jest.mock("@/lib/api", () => ({
  getSurveyQuestions: jest.fn(),
  searchPublicOpinions: jest.fn(),
  postUpvote: jest.fn(),
}));

const api = jest.requireMock("@/lib/api") as {
  getSurveyQuestions: jest.Mock;
  searchPublicOpinions: jest.Mock;
  postUpvote: jest.Mock;
};

const mockSurveyId = "test-survey-uuid";

function SurveySearchRoute() {
  return (
    <Routes>
      <Route path="/survey/:surveyId" element={<SurveySearch />} />
    </Routes>
  );
}

const defaultSurveyData = {
  survey_name: "Feedback 2024",
  status: "active",
  questions: [],
};

const defaultOpinions: PublicOpinionItem[] = [
  {
    id: 1,
    title: "Need better tools",
    content: "We need improved development tools.",
    priority_score: 8,
    supporters: 3,
    additional_comments: ["Agreed, +1"],
    current_user_has_supported: false,
  },
];

function renderSurveySearch() {
  return render(<SurveySearchRoute />, {
    routerProps: {
      initialEntries: [`/survey/${mockSurveyId}`],
      initialIndex: 0,
    },
  });
}

describe("SurveySearch", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    api.getSurveyQuestions.mockResolvedValue(defaultSurveyData);
    api.searchPublicOpinions.mockResolvedValue(defaultOpinions);
  });

  it("renders survey name and search form", async () => {
    renderSurveySearch();

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: /feedback 2024/i })
      ).toBeInTheDocument();
    });
    expect(screen.getByPlaceholderText(/search by keyword/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /search/i })).toBeInTheDocument();
  });

  it("renders opinions list when data is loaded", async () => {
    renderSurveySearch();

    await waitFor(() => {
      expect(screen.getByText(/need better tools/i)).toBeInTheDocument();
    });
    expect(screen.getByText(/we need improved development tools/i)).toBeInTheDocument();
    expect(screen.getByText(/3 supporters/)).toBeInTheDocument();
  });

  it("calls searchPublicOpinions when Search is submitted", async () => {
    const user = userEvent.setup();
    renderSurveySearch();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /search/i })).toBeInTheDocument();
    });

    await user.type(screen.getByPlaceholderText(/search by keyword/i), "tools");
    await user.click(screen.getByRole("button", { name: /search/i }));

    await waitFor(() => {
      expect(api.searchPublicOpinions).toHaveBeenCalledWith(mockSurveyId, "tools");
    });
  });

  it("shows Support button for each opinion", async () => {
    renderSurveySearch();

    await waitFor(() => {
      expect(screen.getByText(/need better tools/i)).toBeInTheDocument();
    });

    expect(screen.getByRole("button", { name: /support/i })).toBeInTheDocument();
  });

  it("shows Post your own opinion link", async () => {
    renderSurveySearch();

    await waitFor(() => {
      expect(screen.getByRole("link", { name: /post your own opinion/i })).toBeInTheDocument();
    });
    expect(screen.getByRole("link", { name: /post your own opinion/i })).toHaveAttribute(
      "href",
      `/survey/${mockSurveyId}/post`
    );
  });

  it("shows no matching opinions when empty", async () => {
    api.searchPublicOpinions.mockResolvedValue([]);

    renderSurveySearch();

    await waitFor(() => {
      expect(screen.getByText(/no matching opinions/i)).toBeInTheDocument();
    });
  });

  it("shows error when survey not found", async () => {
    api.getSurveyQuestions.mockRejectedValue(new Error("Not found"));

    renderSurveySearch();

    await waitFor(() => {
      expect(screen.getByText(/survey not found/i)).toBeInTheDocument();
    });
  });
});
