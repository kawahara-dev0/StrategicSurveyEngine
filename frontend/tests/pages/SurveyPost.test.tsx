import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Route, Routes } from "react-router-dom";
import { render } from "@/test/test-utils";
import { SurveyPost } from "@/pages/SurveyPost";
import type { SurveyQuestionsResponse, SubmitResponse } from "@/types/api";

jest.mock("@/lib/api", () => ({
  getSurveyQuestions: jest.fn(),
  submitSurveyResponse: jest.fn(),
}));

const api = jest.requireMock("@/lib/api") as {
  getSurveyQuestions: jest.Mock;
  submitSurveyResponse: jest.Mock;
};

const mockSurveyId = "test-survey-uuid";

function SurveyPostRoute() {
  return (
    <Routes>
      <Route path="/survey/:surveyId/post" element={<SurveyPost />} />
    </Routes>
  );
}

const defaultSurveyResponse: SurveyQuestionsResponse = {
  survey_name: "Feedback 2024",
  status: "active",
  questions: [
    {
      id: 1,
      survey_id: mockSurveyId,
      label: "What is your main concern?",
      question_type: "text",
      options: null,
      is_required: true,
      is_personal_data: false,
    },
    {
      id: 2,
      survey_id: mockSurveyId,
      label: "Additional comments (optional)",
      question_type: "textarea",
      options: null,
      is_required: false,
      is_personal_data: false,
    },
  ],
};

const defaultSubmitResponse: SubmitResponse = {
  response_id: "resp-123",
  message: "Thank you",
};

function renderSurveyPost(routeSurveyId: string = mockSurveyId) {
  return render(<SurveyPostRoute />, {
    routerProps: {
      initialEntries: [`/survey/${routeSurveyId}/post`],
      initialIndex: 0,
    },
  });
}

describe("SurveyPost", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    api.getSurveyQuestions.mockResolvedValue(defaultSurveyResponse);
    api.submitSurveyResponse.mockResolvedValue(defaultSubmitResponse);
  });

  describe("Happy path", () => {
    it("submits the form and shows completion screen when API succeeds", async () => {
      const user = userEvent.setup();
      api.getSurveyQuestions.mockResolvedValue(defaultSurveyResponse);
      api.submitSurveyResponse.mockResolvedValue(defaultSubmitResponse);

      renderSurveyPost();

      await waitFor(() => {
        expect(
          screen.getByRole("textbox", { name: /what is your main concern/i })
        ).toBeInTheDocument();
      });

      const requiredInput = screen.getByRole("textbox", {
        name: /what is your main concern/i,
      });
      await user.type(requiredInput, "Need more support");

      const submitButton = screen.getByRole("button", { name: /submit/i });
      expect(submitButton).toBeEnabled();
      await user.click(submitButton);

      expect(api.submitSurveyResponse).toHaveBeenCalledWith(
        mockSurveyId,
        expect.arrayContaining([
          expect.objectContaining({
            question_id: 1,
            answer_text: "Need more support",
          }),
        ])
      );

      await waitFor(() => {
        expect(
          screen.getByRole("heading", { name: /thank you for your submission/i })
        ).toBeInTheDocument();
      });
      expect(screen.getByText(/your feedback has been recorded/i)).toBeInTheDocument();
      expect(screen.getByRole("link", { name: /view this survey's opinions/i })).toBeInTheDocument();
    });

    it("sends only non-empty answers in the API request", async () => {
      const user = userEvent.setup();
      api.getSurveyQuestions.mockResolvedValue(defaultSurveyResponse);
      api.submitSurveyResponse.mockResolvedValue(defaultSubmitResponse);

      renderSurveyPost();

      await waitFor(() => {
        expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Feedback 2024");
      });

      const requiredInput = screen.getByRole("textbox", {
        name: /what is your main concern/i,
      });
      await user.type(requiredInput, "Only this");

      await user.click(screen.getByRole("button", { name: /submit/i }));

      await waitFor(() => {
        expect(api.submitSurveyResponse).toHaveBeenCalledWith(
          mockSurveyId,
          expect.arrayContaining([
            expect.objectContaining({ question_id: 1, answer_text: "Only this" }),
          ])
        );
      });
      expect(api.submitSurveyResponse.mock.calls[0][1]).toHaveLength(1);
    });
  });

  describe("Validation", () => {
    it("disables submit button when required questions are unanswered", async () => {
      api.getSurveyQuestions.mockResolvedValue(defaultSurveyResponse);

      renderSurveyPost();

      await waitFor(() => {
        expect(screen.getByRole("textbox", { name: /what is your main concern/i })).toBeInTheDocument();
      });

      const submitButton = screen.getByRole("button", { name: /submit/i });
      expect(submitButton).toBeDisabled();
    });

    it("enables submit button when all required questions are filled", async () => {
      const user = userEvent.setup();
      api.getSurveyQuestions.mockResolvedValue(defaultSurveyResponse);

      renderSurveyPost();

      await waitFor(() => {
        expect(screen.getByRole("textbox", { name: /what is your main concern/i })).toBeInTheDocument();
      });

      await user.type(
        screen.getByRole("textbox", { name: /what is your main concern/i }),
        "My answer"
      );

      expect(screen.getByRole("button", { name: /submit/i })).toBeEnabled();
    });

    it("does not call submit API when required field is empty", async () => {
      api.getSurveyQuestions.mockResolvedValue(defaultSurveyResponse);
      api.submitSurveyResponse.mockClear();

      renderSurveyPost();

      await waitFor(() => {
        expect(screen.getByRole("button", { name: /submit/i })).toBeInTheDocument();
      });

      const submitButton = screen.getByRole("button", { name: /submit/i });
      expect(submitButton).toBeDisabled();
      expect(api.submitSurveyResponse).not.toHaveBeenCalled();
    });
  });

  describe("API mocking", () => {
    it("shows error when getSurveyQuestions fails", async () => {
      api.getSurveyQuestions.mockRejectedValue(new Error("Network error"));

      renderSurveyPost();

      await waitFor(() => {
        expect(
          screen.getByText(/failed to load survey/i)
        ).toBeInTheDocument();
      });
    });

    it("shows error message when submit fails", async () => {
      const user = userEvent.setup();
      api.getSurveyQuestions.mockResolvedValue(defaultSurveyResponse);
      api.submitSurveyResponse.mockRejectedValue(new Error("Server error"));

      renderSurveyPost();

      await waitFor(() => {
        expect(screen.getByRole("textbox", { name: /what is your main concern/i })).toBeInTheDocument();
      });

      await user.type(
        screen.getByRole("textbox", { name: /what is your main concern/i }),
        "Answer"
      );
      await user.click(screen.getByRole("button", { name: /submit/i }));

      await waitFor(() => {
        expect(screen.getByText(/server error/i)).toBeInTheDocument();
      });
      expect(screen.queryByRole("heading", { name: /thank you/i })).not.toBeInTheDocument();
    });
  });
});
