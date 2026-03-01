import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { AdminGuard } from "@/components/AdminGuard";
import { Home } from "@/pages/Home";
import { SurveyList } from "@/pages/SurveyList";
import { SurveyCreate } from "@/pages/SurveyCreate";
import { SurveyDetail } from "@/pages/SurveyDetail";
import { SurveyModeration } from "@/pages/SurveyModeration";
import { ManagerDashboard } from "@/pages/ManagerDashboard";
import { SurveyPost } from "@/pages/SurveyPost";
import { SurveySearch } from "@/pages/SurveySearch";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Home />} />
          <Route path="admin" element={<AdminGuard />}>
            <Route index element={<SurveyList />} />
            <Route path="surveys/new" element={<SurveyCreate />} />
            <Route path="surveys/:surveyId/moderation" element={<SurveyModeration />} />
            <Route path="surveys/:surveyId/responses" element={<Navigate to="../moderation" replace />} />
            <Route path="surveys/:surveyId/responses/:responseId" element={<Navigate to="../moderation" replace />} />
            <Route path="surveys/:surveyId" element={<SurveyDetail />} />
          </Route>
          <Route path="manager/:surveyId" element={<ManagerDashboard />} />
          <Route path="survey/:surveyId/post" element={<SurveyPost />} />
          <Route path="survey/:surveyId" element={<SurveySearch />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
