import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { SurveyList } from "@/pages/SurveyList";
import { SurveyCreate } from "@/pages/SurveyCreate";
import { SurveyDetail } from "@/pages/SurveyDetail";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<SurveyList />} />
          <Route path="admin/surveys/new" element={<SurveyCreate />} />
          <Route path="admin/surveys/:surveyId" element={<SurveyDetail />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
