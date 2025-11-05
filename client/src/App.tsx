import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import Dashboard from "./pages/Dashboard";
import Upload from "./pages/Upload";
import Capture from "./pages/Capture";
import Documents from "./pages/Documents";
import DocumentDetail from "./pages/DocumentDetail";
import Contacts from "./pages/Contacts";
import Subscription from "./pages/Subscription";
import Tags from "./pages/Tags";
import IPFSUpload from "./pages/IPFSUpload";
import SubscriptionSuccess from "./pages/SubscriptionSuccess";
import SubscriptionCancel from "./pages/SubscriptionCancel";

function Router() {
  // make sure to consider if you need authentication for certain routes
  return (
    <Switch>
      <Route path={"/"} component={Home} />
      <Route path={"/dashboard"} component={Dashboard} />
      <Route path={"/upload"} component={Upload} />
      <Route path={"/capture"} component={Capture} />
      <Route path={"/documents"} component={Documents} />
      <Route path={"/documents/:id"} component={DocumentDetail} />
      <Route path={"/contacts"} component={Contacts} />
      <Route path={"/subscription"} component={Subscription} />
      <Route path={"/subscription/success"} component={SubscriptionSuccess} />
      <Route path={"/subscription/cancel"} component={SubscriptionCancel} />
      <Route path={"/tags"} component={Tags} />
      <Route path={"/ipfs"} component={IPFSUpload} />
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
        defaultTheme="dark"
        // Official website uses pure black theme
      >
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
