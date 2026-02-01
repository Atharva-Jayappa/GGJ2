import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import PlayerView from "@/pages/PlayerView";
import HostView from "@/pages/HostView";

function Router() {
  return (
    <Switch>
      {/* Player View (Mobile) */}
      <Route path="/" component={PlayerView} />
      
      {/* Host View (Projector) */}
      <Route path="/host" component={HostView} />
      
      {/* Fallback to 404 */}
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Router />
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
