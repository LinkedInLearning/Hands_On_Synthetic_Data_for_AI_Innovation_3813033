import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import AppLayout from "@/components/AppLayout";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import Dashboard from "./pages/Dashboard";
import Compare from "./pages/Compare";
import ScenarioBuilder from "./pages/ScenarioBuilder";
import UseCases from "./pages/UseCases";
import Settings from "./pages/Settings";
import NotFound from "./pages/NotFound";

// Fix 6.5 — the @tanstack/react-query provider was mounted but never used, and
// the Radix <Toaster /> sat alongside <Sonner /> while only sonner's toast()
// was ever called. Both removed.
const App = () => (
  <TooltipProvider>
    <Sonner />
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      {/* Fix 4 — one bad render used to leave a white page with no way back. */}
      <ErrorBoundary>
        <Routes>
          <Route element={<AppLayout />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/use-cases" element={<UseCases />} />
            <Route path="/compare" element={<Compare />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/scenario/:id" element={<ScenarioBuilder />} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </ErrorBoundary>
    </BrowserRouter>
  </TooltipProvider>
);

export default App;
