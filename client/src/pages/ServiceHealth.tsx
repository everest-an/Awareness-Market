import { useState, useEffect } from "react";
import Navbar from "@/components/Navbar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RefreshCw, CheckCircle2, XCircle, AlertCircle } from "lucide-react";

interface ServiceStatus {
  name: string;
  port: number;
  status: "running" | "stopped" | "error";
  url: string;
  swagger?: string;
}

const GO_SERVICE_BASE = import.meta.env.VITE_GO_SERVICE_BASE || "";

const services: ServiceStatus[] = [
  {
    name: "Memory Exchange",
    port: 8080,
    status: "running",
    url: `${GO_SERVICE_BASE || "http://localhost:8080"}`,
    swagger: `${GO_SERVICE_BASE || "http://localhost:8080"}/swagger/index.html`,
  },
  {
    name: "W-Matrix Marketplace",
    port: 8081,
    status: "running",
    url: `${GO_SERVICE_BASE ? GO_SERVICE_BASE.replace(/:\d+$/, ':8081') : "http://localhost:8081"}`,
    swagger: `${GO_SERVICE_BASE ? GO_SERVICE_BASE.replace(/:\d+$/, ':8081') : "http://localhost:8081"}/swagger/index.html`,
  },
  {
    name: "Admin Analytics",
    port: 8082,
    status: "running",
    url: `${GO_SERVICE_BASE ? GO_SERVICE_BASE.replace(/:\d+$/, ':8082') : "http://localhost:8082"}`,
    swagger: `${GO_SERVICE_BASE ? GO_SERVICE_BASE.replace(/:\d+$/, ':8082') : "http://localhost:8082"}/swagger/index.html`,
  },
  {
    name: "Vector Operations",
    port: 8083,
    status: "running",
    url: `${GO_SERVICE_BASE ? GO_SERVICE_BASE.replace(/:\d+$/, ':8083') : "http://localhost:8083"}`,
    swagger: `${GO_SERVICE_BASE ? GO_SERVICE_BASE.replace(/:\d+$/, ':8083') : "http://localhost:8083"}/swagger/index.html`,
  },
  {
    name: "Recommendation Engine",
    port: 8085,
    status: "running",
    url: `${GO_SERVICE_BASE ? GO_SERVICE_BASE.replace(/:\d+$/, ':8085') : "http://localhost:8085"}`,
    swagger: `${GO_SERVICE_BASE ? GO_SERVICE_BASE.replace(/:\d+$/, ':8085') : "http://localhost:8085"}/swagger/index.html`,
  },
];

export default function ServiceHealth() {
  const [serviceStatuses, setServiceStatuses] = useState<ServiceStatus[]>(services);
  const [lastCheck, setLastCheck] = useState<Date>(new Date());
  const [checking, setChecking] = useState(false);

  const checkServiceHealth = async (service: ServiceStatus) => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      
      const response = await fetch(`${service.url}/health`, {
        method: "GET",
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      return response.ok ? "running" : "error";
    } catch {
      return "stopped";
    }
  };

  const refreshStatuses = async () => {
    setChecking(true);
    const updatedStatuses = await Promise.all(
      serviceStatuses.map(async (service) => ({
        ...service,
        status: await checkServiceHealth(service) as "running" | "stopped" | "error",
      }))
    );
    setServiceStatuses(updatedStatuses);
    setLastCheck(new Date());
    setChecking(false);
  };

  useEffect(() => {
    refreshStatuses();
  }, []);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "running":
        return <CheckCircle2 className="h-5 w-5 text-green-500" />;
      case "stopped":
        return <XCircle className="h-5 w-5 text-red-500" />;
      case "error":
        return <AlertCircle className="h-5 w-5 text-yellow-500" />;
      default:
        return null;
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive"> = {
      running: "default",
      stopped: "destructive",
      error: "secondary",
    };
    return (
      <Badge variant={variants[status] || "secondary"} className="capitalize">
        {status}
      </Badge>
    );
  };

  return (
    <div className="min-h-screen bg-black text-white">
      <Navbar />
      <div className="container mx-auto py-8 mt-20">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold">Service Health Monitor</h1>
          <p className="text-muted-foreground mt-1">
            Monitor the status of all microservices
          </p>
        </div>
        <Button onClick={refreshStatuses} disabled={checking}>
          <RefreshCw className={`mr-2 h-4 w-4 ${checking ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      <div className="mb-4 text-sm text-muted-foreground">
        Last checked: {lastCheck.toLocaleString()}
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {serviceStatuses.map((service) => (
          <Card key={service.name}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">{service.name}</CardTitle>
                {getStatusIcon(service.status)}
              </div>
              <CardDescription>Port {service.port}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Status:</span>
                  {getStatusBadge(service.status)}
                </div>
                <div className="flex flex-col gap-2">
                  <a
                    href={service.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-blue-600 hover:underline"
                  >
                    Service URL �?
                  </a>
                  {service.swagger && (
                    <a
                      href={service.swagger}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-blue-600 hover:underline"
                    >
                      Swagger UI �?
                    </a>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>System Overview</CardTitle>
          <CardDescription>Overall microservices architecture status</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-2xl font-bold text-green-600">
                {serviceStatuses.filter((s) => s.status === "running").length}
              </div>
              <div className="text-sm text-muted-foreground">Running</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-red-600">
                {serviceStatuses.filter((s) => s.status === "stopped").length}
              </div>
              <div className="text-sm text-muted-foreground">Stopped</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-yellow-600">
                {serviceStatuses.filter((s) => s.status === "error").length}
              </div>
              <div className="text-sm text-muted-foreground">Errors</div>
            </div>
          </div>
        </CardContent>
      </Card>
      </div>
    </div>
  );
}
