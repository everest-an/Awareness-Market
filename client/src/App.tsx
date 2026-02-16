import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { NotificationProvider } from "./contexts/NotificationContext";
import { Web3Provider } from "./contexts/Web3Context";
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
import ReasoningChainPublish from "./pages/ReasoningChainPublish";
import LatentTest from "./pages/LatentTest";
import AgentRegistry from "./pages/AgentRegistry";
import SDKPage from "./pages/SDKPage";
import AuthPage from "./pages/AuthPage";
import Dashboard from "./pages/Dashboard";
import LatentMASv2Demo from "./pages/LatentMASv2Demo";
import BlogLatentMASPaper from "./pages/BlogLatentMASPaper";
import MemoryMarketplace from "./pages/MemoryMarketplace";
import MemoryNFTDetail from "./pages/MemoryNFTDetail";
import ApiKeys from "./pages/ApiKeys";
import AdminPanel from "./pages/AdminPanel";
import ServiceHealth from "./pages/ServiceHealth";
import UsageAnalytics from "./pages/UsageAnalytics";
import KVCacheDemo from "./pages/KVCacheDemo";
import MemoryProvenance from "./pages/MemoryProvenance";
import UploadVectorPackage from "./pages/UploadVectorPackage";
import UploadMemoryPackage from "./pages/UploadMemoryPackage";
import UploadChainPackage from "./pages/UploadChainPackage";
import PackageDetail from "./pages/PackageDetail";
import VectorPackageMarket from "./pages/VectorPackageMarket";
import ChainPackageMarketplace from "./pages/ChainPackageMarketplace";
import WorkflowDemo from "./pages/WorkflowDemo";
import { WorkflowHistory } from "./pages/WorkflowHistory";
import { WorkflowSessionDetail } from "./pages/WorkflowSessionDetail";
import { WorkflowPlayback } from "./pages/WorkflowPlayback";
import PurchaseSuccess from "./pages/PurchaseSuccess";
import { WorkflowPerformance } from "./pages/WorkflowPerformance";
import GolemVisualizerPage from "./pages/GolemVisualizerPage";
import NeuralCortex from "./pages/NeuralCortex";
import OAuthCallback from "./pages/OAuthCallback";
import EmailVerification from "./pages/EmailVerification";
import AgentAuth from "./pages/AgentAuth";
import PrivacySettings from "./pages/PrivacySettings";
import ZKPDashboard from "./pages/ZKPDashboard";
import UploadMultimodalPackage from "./pages/UploadMultimodalPackage";
import CrossModalSearch from "./pages/CrossModalSearch";
// import AudioToText from "./pages/AudioToText";
import AiCollaborationDocs from "./pages/AiCollaborationDocs";
import AiCollaborationHub from "./pages/AiCollaboration";
import NewCollaborationSession from "./pages/AiCollaboration/NewSession";
import SessionConnect from "./pages/AiCollaboration/SessionConnect";
import SessionsList from "./pages/AiCollaboration/SessionsList";
// HiveMind removed - redirects to NeuralCortex
import WalletDashboard from "./pages/WalletDashboard";
import MemoryManagement from "./pages/MemoryManagement";
// v3: Organization Governance
import OrganizationSetup from "./pages/OrganizationSetup";
import OrgDashboard from "./pages/OrgDashboard";
// v3 Phase 3: Decision Audit + Agent Reputation
import DecisionAudit from "./pages/DecisionAudit";
// v3 Phase 4: Verification + Evidence
import VerificationDashboard from "./pages/VerificationDashboard";
// v3 Phase 5: Analytics + Billing
import OrgAnalytics from "./pages/OrgAnalytics";
import BillingDashboard from "./pages/BillingDashboard";
import ConflictResolution from "./pages/ConflictResolution";
import { FeatureErrorBoundary } from "./components/FeatureErrorBoundary";
import { Redirect } from "wouter";
import LandingPage from "./pages/LandingPage";
import RoboticsPage from "./pages/robotics";
import { DocsLayout } from "./pages/Docs";

function Router() {
  // make sure to consider if you need authentication for certain routes
  return (
    <Switch>
      <Route path={"/"} component={Home} />
      <Route path={"/robotics"} component={RoboticsPage} />
      {/* Documentation System */}
      <Route path="/documentation/:rest*" component={DocsLayout} />
      <Route path="/documentation" component={DocsLayout} />
      <Route path={"/auth"} component={AuthPage} />
      <Route path={"/auth/verify"} component={EmailVerification} />
      <Route path={"/auth/agent"} component={AgentAuth} />
      <Route path={"/api/auth/callback/:provider"} component={OAuthCallback} />
      
      <Route path="/docs/collaboration" component={AiCollaborationDocs} />
      <Route path="/ai-collaboration" component={AiCollaborationHub} />
      <Route path="/ai-collaboration/new" component={NewCollaborationSession} />
      <Route path="/ai-collaboration/sessions" component={SessionsList} />
      <Route path="/ai-collaboration/connect/:sessionId" component={SessionConnect} />

      <Route path={"/marketplace"} component={Marketplace} />
      <Route path={"/marketplace/:id"} component={VectorDetail} />
      <Route path={"/purchase/success"} component={PurchaseSuccess} />
      <Route path={"/dashboard"} component={Dashboard} />
      <Route path={"/dashboard/creator"} component={CreatorDashboard} />
      <Route path={"/upload"} component={UploadVector} />
      <Route path={"/creator/publish"} component={UploadVector} />
      <Route path={"/dashboard/consumer"} component={ConsumerDashboard} />
      <Route path="/profile" component={Profile} />
      <Route path="/privacy-settings" component={PrivacySettings} />
      <Route path="/zkp-dashboard" component={ZKPDashboard} />
      <Route path="/zkp" component={ZKPDashboard} />
       <Route path="/subscriptions" component={Subscriptions} />
      <Route path="/docs/sdk" component={SdkDocs} />
      <Route path="/pricing" component={Pricing} />
      <Route path="/privacy" component={Privacy} />
      <Route path="/terms" component={Terms} />
      <Route path="/about" component={About} />
      <Route path="/blog" component={Blog} />
      <Route path="/blog/latentmas-research-paper" component={BlogLatentMASPaper} />
      <Route path="/blog/:slug" component={BlogPost} />
      <Route path="/reasoning-chains" component={ReasoningChainMarket} />
      <Route path="/reasoning-chains/publish" component={ReasoningChainPublish} />
      <Route path="/latent-test" component={LatentTest} />
      <Route path="/w-matrix" component={LatentTest} />
      <Route path="/w-matrix/tester">{() => <Redirect to="/latent-test" />}</Route>
      <Route path="/latentmas-v2-demo" component={LatentMASv2Demo} />
      {/* Redirects for deprecated pages */}
      <Route path="/w-matrix-marketplace">{() => <Redirect to="/w-matrix" />}</Route>
      <Route path="/vector-packages" component={VectorPackageMarket} />
      <Route path="/workflow-demo" component={WorkflowDemo} />
      <Route path="/workflow-history" component={WorkflowHistory} />
      <Route path="/workflow-history/:sessionId" component={WorkflowSessionDetail} />
      <Route path="/workflow-playback/:sessionId" component={WorkflowPlayback} />
      <Route path="/workflow-performance" component={WorkflowPerformance} />
      <Route path="/upload-vector-package" component={UploadVectorPackage} />
      <Route path="/memory-marketplace" component={MemoryMarketplace} />
      <Route path="/memory-packages" component={MemoryMarketplace} />
      <Route path="/upload-memory-package" component={UploadMemoryPackage} />
      <Route path="/memory-management" component={MemoryManagement} />
      <Route path="/conflicts" component={ConflictResolution} />
      <Route path="/chain-packages" component={ChainPackageMarketplace} />
      <Route path="/upload-chain-package" component={UploadChainPackage} />
      <Route path="/upload-multimodal-package" component={UploadMultimodalPackage} />
      <Route path="/cross-modal-search" component={CrossModalSearch} />
      <Route path="/package/:type/:id" component={PackageDetail} />
      <Route path="/memory/:id" component={MemoryNFTDetail} />

      <Route path="/hive-mind">{() => <Redirect to="/neural-cortex" />}</Route>
      <Route path="/network">{() => <Redirect to="/neural-cortex" />}</Route>
      <Route path="/agents" component={AgentRegistry} />
      <Route path="/semantic-index" component={AgentRegistry} />
      <Route path="/sdk" component={SDKPage} />
      <Route path="/docs" component={SDKPage} />
      <Route path="/api-keys" component={ApiKeys} />
      <Route path="/wallet" component={WalletDashboard} />

      {/* v3: Organization Governance */}
      <Route path="/org/setup">{() => <FeatureErrorBoundary feature="Organization Setup"><OrganizationSetup /></FeatureErrorBoundary>}</Route>
      <Route path="/org/dashboard">{() => <FeatureErrorBoundary feature="Organization Dashboard"><OrgDashboard /></FeatureErrorBoundary>}</Route>
      <Route path="/org/decisions">{() => <FeatureErrorBoundary feature="Decision Audit"><DecisionAudit /></FeatureErrorBoundary>}</Route>
      <Route path="/org/verification">{() => <FeatureErrorBoundary feature="Verification"><VerificationDashboard /></FeatureErrorBoundary>}</Route>
      <Route path="/org/analytics">{() => <FeatureErrorBoundary feature="Analytics"><OrgAnalytics /></FeatureErrorBoundary>}</Route>
      <Route path="/org/billing">{() => <FeatureErrorBoundary feature="Billing"><BillingDashboard /></FeatureErrorBoundary>}</Route>

      <Route path="/admin" component={AdminPanel} />
      <Route path="/service-health" component={ServiceHealth} />

      <Route path="/usage-analytics" component={UsageAnalytics} />
      <Route path="/kv-cache-demo" component={KVCacheDemo} />
      <Route path="/memory-provenance/:id" component={MemoryProvenance} />
      {/* AI Visualization - all routes go to NeuralCortex */}
      <Route path="/golem-visualizer">{() => <Redirect to="/neural-cortex" />}</Route>
      <Route path="/inference">{() => <Redirect to="/neural-cortex" />}</Route>
      <Route path="/inference-dashboard">{() => <Redirect to="/neural-cortex" />}</Route>
      <Route path="/neural-cortex" component={NeuralCortex} />
      <Route path="/cortex" component={NeuralCortex} />
      <Route path="/visualizer" component={NeuralCortex} />
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
        <Web3Provider>
          <NotificationProvider>
            <TooltipProvider>
              <Toaster />
              <Router />
            </TooltipProvider>
          </NotificationProvider>
        </Web3Provider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
