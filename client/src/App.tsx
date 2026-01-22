import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { NotificationProvider } from "./contexts/NotificationContext";
import Home from "./pages/Home";
import Marketplace from "./pages/Marketplace";
import VectorDetail from "./pages/VectorDetail";
import CreatorDashboard from "./pages/CreatorDashboard";
import UploadVector from "./pages/UploadVector";
import ConsumerDashboard from "./pages/ConsumerDashboard";
import Profile from "./pages/Profile";
import Subscriptions from "./pages/Subscriptions";
import Pricing from "./pages/Pricing";
import About from "./pages/About";
import Privacy from "./pages/Privacy";
import Terms from "./pages/Terms";
import Leaderboard from "./pages/Leaderboard";
import GolemVisualizerPage from "./pages/GolemVisualizer";

function Router() {
  // make sure to consider if you need authentication for certain routes
  return (
    <Switch>
      <Route path={"/"} component={Home} />
      <Route path={"/marketplace"} component={Marketplace} />
      <Route path={"/marketplace/:id"} component={VectorDetail} />
      <Route path={"/dashboard/creator"} component={CreatorDashboard} />
      <Route path={"/upload"} component={UploadVector} />
      <Route path={"/dashboard/consumer"} component={ConsumerDashboard} />
      <Route path="/profile" component={Profile} />
      <Route path="/subscriptions" component={Subscriptions} />
      <Route path="/pricing" component={Pricing} />
      <Route path="/about" component={About} />
      <Route path="/privacy" component={Privacy} />
      <Route path="/terms" component={Terms} />
      <Route path="/golem-visualizer" component={GolemVisualizerPage} />
      <Route path="/leaderboard" component={Leaderboard} />
      <Route path={"/404"} component={NotFound} />
      {/* Final fallback route */}
      <Route component={NotFound} />
    </Switch>
  );
}

// NOTE: About Theme
// - First choose a default theme according to your design style (dark or light bg), than change color palette in index.css
//   to keep consistent foreground/background color across components
// - If you want to make theme switchable, pass `switchable` ThemeProvider and use `useTheme` hook

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider
        defaultTheme="light"
      // switchable
      >
        <NotificationProvider>
          <TooltipProvider>
            <Toaster />
            <Router />
          </TooltipProvider>
        </NotificationProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
