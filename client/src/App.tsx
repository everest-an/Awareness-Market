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
import SdkDocs from "./pages/SdkDocs";
import Pricing from "./pages/Pricing";
import Privacy from "./pages/Privacy";
import Terms from "./pages/Terms";
import About from "./pages/About";
import Blog from "./pages/Blog";
import BlogPost from "./pages/BlogPost";
import ReasoningChainMarket from "./pages/ReasoningChainMarket";
import WMatrixProtocol from "./pages/WMatrixProtocol";
import ReasoningChainPublish from "./pages/ReasoningChainPublish";
import WMatrixTester from "./pages/WMatrixTester";
import AgentRegistry from "./pages/AgentRegistry";

function Router() {
  // make sure to consider if you need authentication for certain routes
  return (
    <Switch>
      <Route path={"/"} component={Home} />
      <Route path={"/marketplace"} component={Marketplace} />
      <Route path={"/marketplace/:id"} component={VectorDetail} />
      <Route path={"/dashboard"} component={CreatorDashboard} />
      <Route path={"/dashboard/creator"} component={CreatorDashboard} />
      <Route path={"/upload"} component={UploadVector} />
      <Route path={"/creator/publish"} component={UploadVector} />
      <Route path={"/dashboard/consumer"} component={ConsumerDashboard} />
      <Route path="/profile" component={Profile} />
       <Route path="/subscriptions" component={Subscriptions} />
      <Route path="/docs/sdk" component={SdkDocs} />
      <Route path="/pricing" component={Pricing} />
      <Route path="/privacy" component={Privacy} />
      <Route path="/terms" component={Terms} />
      <Route path="/about" component={About} />
      <Route path="/blog" component={Blog} />
      <Route path="/blog/:slug" component={BlogPost} />
      <Route path="/reasoning-chains" component={ReasoningChainMarket} />
      <Route path="/reasoning-chains/publish" component={ReasoningChainPublish} />
      <Route path="/w-matrix" component={WMatrixProtocol} />
      <Route path="/w-matrix/tester" component={WMatrixTester} />
      <Route path="/agents" component={AgentRegistry} />
      <Route path="/semantic-index" component={AgentRegistry} />
      <Route path="/404" component={NotFound} />
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
        defaultTheme="dark"
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
