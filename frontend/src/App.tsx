import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { SurveyList } from "@/pages/SurveyList";
import { SurveyCreate } from "@/pages/SurveyCreate";
import { SurveyDetail } from "@/pages/SurveyDetail";
import { SurveyModeration } from "@/pages/SurveyModeration";
import { SurveyPost } from "@/pages/SurveyPost";
import { SurveySearch } from "@/pages/SurveySearch";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<SurveyList />} />
          <Route path="admin/surveys/new" element={<SurveyCreate />} />
          <Route path="admin/surveys/:surveyId/moderation" element={<SurveyModeration />} />
          <Route path="admin/surveys/:surveyId/responses" element={<Navigate to="../moderation" replace />} />
          <Route path="admin/surveys/:surveyId/responses/:responseId" element={<Navigate to="../moderation" replace />} />
          <Route path="admin/surveys/:surveyId" element={<SurveyDetail />} />
          <Route path="survey/:surveyId/post" element={<SurveyPost />} />
          <Route path="survey/:surveyId" element={<SurveySearch />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
