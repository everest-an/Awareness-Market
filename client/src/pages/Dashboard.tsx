import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { Camera, FileText, Plus, Upload, Users } from "lucide-react";
import { useLocation } from "wouter";

export default function Dashboard() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();

  // Fetch statistics
  const { data: files } = trpc.files.list.useQuery();
  const { data: documents } = trpc.documents.list.useQuery();
  const { data: contacts } = trpc.contacts.list.useQuery();

  const stats = [
    {
      title: "Total Files",
      value: files?.length || 0,
      icon: Upload,
      color: "text-blue-600",
      bgColor: "bg-blue-100",
    },
    {
      title: "Documents",
      value: documents?.length || 0,
      icon: FileText,
      color: "text-purple-600",
      bgColor: "bg-purple-100",
    },
    {
      title: "Contacts",
      value: contacts?.length || 0,
      icon: Users,
      color: "text-pink-600",
      bgColor: "bg-pink-100",
    },
  ];

  const quickActions = [
    {
      title: "Upload Image",
      description: "Upload a photo or document",
      icon: Upload,
      action: () => setLocation("/upload"),
      color: "from-blue-500 to-blue-600",
    },
    {
      title: "Take Photo",
      description: "Use camera to capture",
      icon: Camera,
      action: () => setLocation("/capture"),
      color: "from-purple-500 to-purple-600",
    },
    {
      title: "View Documents",
      description: "Browse your knowledge base",
      icon: FileText,
      action: () => setLocation("/documents"),
      color: "from-pink-500 to-pink-600",
    },
    {
      title: "Manage Contacts",
      description: "View and edit contacts",
      icon: Users,
      action: () => setLocation("/contacts"),
      color: "from-green-500 to-green-600",
    },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-8">
        {/* Welcome Section */}
        <div>
          <h1 className="text-3xl font-bold mb-2">Welcome back, {user?.name || "User"}!</h1>
          <p className="text-gray-600">
            Manage your knowledge base and capture new information
          </p>
        </div>

        {/* Statistics Cards */}
        <div className="grid md:grid-cols-3 gap-6">
          {stats.map((stat) => (
            <Card key={stat.title}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">
                  {stat.title}
                </CardTitle>
                <div className={`h-10 w-10 ${stat.bgColor} rounded-lg flex items-center justify-center`}>
                  <stat.icon className={`h-5 w-5 ${stat.color}`} />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{stat.value}</div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Quick Actions */}
        <div>
          <h2 className="text-2xl font-bold mb-4">Quick Actions</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
            {quickActions.map((action) => (
              <Card
                key={action.title}
                className="cursor-pointer hover:shadow-lg transition-all border-2 hover:border-blue-200"
                onClick={action.action}
              >
                <CardHeader>
                  <div className={`h-12 w-12 bg-gradient-to-br ${action.color} text-white rounded-lg flex items-center justify-center mb-3`}>
                    <action.icon className="h-6 w-6" />
                  </div>
                  <CardTitle className="text-lg">{action.title}</CardTitle>
                  <CardDescription>{action.description}</CardDescription>
                </CardHeader>
              </Card>
            ))}
          </div>
        </div>

        {/* Recent Documents */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-bold">Recent Documents</h2>
            <Button variant="outline" onClick={() => setLocation("/documents")}>
              View All
            </Button>
          </div>
          {documents && documents.length > 0 ? (
            <div className="grid md:grid-cols-2 gap-4">
              {documents.slice(0, 4).map((doc) => (
                <Card
                  key={doc.id}
                  className="cursor-pointer hover:shadow-md transition-all"
                  onClick={() => setLocation(`/documents/${doc.id}`)}
                >
                  <CardHeader>
                    <CardTitle className="text-lg">{doc.title}</CardTitle>
                    <CardDescription className="line-clamp-2">
                      {doc.summary || "No summary available"}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-gray-500">
                      Created {new Date(doc.createdAt).toLocaleDateString()}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <FileText className="h-12 w-12 text-gray-400 mb-4" />
                <p className="text-gray-600 mb-4">No documents yet</p>
                <Button onClick={() => setLocation("/upload")}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Your First Document
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
