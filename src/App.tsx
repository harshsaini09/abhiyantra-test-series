import { Routes, Route } from 'react-router-dom';
import LandingPage from './pages/LandingPage';
import TestPage from './pages/TestPage';
import ReportPage from './pages/ReportPage';
import QuestionBankPage from './pages/QuestionBankPage';
import CustomTestBuilderPage from './pages/CustomTestBuilderPage';
import ReportCardsPage from './pages/ReportCardsPage';

export default function App() {
  return (
    <div className="min-h-screen bg-slate-50 w-full max-w-full overflow-x-hidden">
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/test" element={<TestPage />} />
        <Route path="/report" element={<ReportPage />} />
        <Route path="/report-cards" element={<ReportCardsPage />} />
        <Route path="/question-bank" element={<QuestionBankPage />} />
        <Route path="/custom-builder" element={<CustomTestBuilderPage />} />
      </Routes>
    </div>
  );
}
