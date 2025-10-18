import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import Navigation from "@/components/Navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Package, AlertTriangle, Clock, Plus, List, Users, FileText } from "lucide-react";
import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";

interface DashboardStats {
  totalParts: number;
  lowStockCount: number;
  totalCustomers: number;
  pendingUdhaari: number;
}

const Dashboard = () => {
  const [stats, setStats] = useState<DashboardStats>({
    totalParts: 0,
    lowStockCount: 0,
    totalCustomers: 0,
    pendingUdhaari: 0,
  });
  const [recentParts, setRecentParts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    setLoading(true);

    // Fetch total parts and low stock
    const { data: stockData, error: stockError } = await supabase
      .from("stock")
      .select("*")
      .order("created_at", { ascending: false });

    if (!stockError && stockData) {
      const lowStock = stockData.filter(
        (item) => item.quantity <= item.low_stock_threshold
      );
      setStats((prev) => ({
        ...prev,
        totalParts: stockData.length,
        lowStockCount: lowStock.length,
      }));
      setRecentParts(stockData.slice(0, 5));
    }

    // Fetch customers count
    const { count: customerCount } = await supabase
      .from("customers")
      .select("*", { count: "exact", head: true });

    if (customerCount !== null) {
      setStats((prev) => ({ ...prev, totalCustomers: customerCount }));
    }

    // Fetch pending udhaari
    const { count: udhaariCount } = await supabase
      .from("udhaari")
      .select("*", { count: "exact", head: true })
      .in("status", ["pending", "partial"]);

    if (udhaariCount !== null) {
      setStats((prev) => ({ ...prev, pendingUdhaari: udhaariCount }));
    }

    setLoading(false);
  };

  const statCards = [
    {
      title: "Total Parts",
      value: stats.totalParts,
      icon: Package,
      color: "text-primary",
      bgColor: "bg-primary/10",
    },
    {
      title: "Low Stock Alerts",
      value: stats.lowStockCount,
      icon: AlertTriangle,
      color: "text-accent",
      bgColor: "bg-accent/10",
    },
    {
      title: "Total Customers",
      value: stats.totalCustomers,
      icon: Users,
      color: "text-primary",
      bgColor: "bg-primary/10",
    },
    {
      title: "Pending Udhaari",
      value: stats.pendingUdhaari,
      icon: FileText,
      color: "text-accent",
      bgColor: "bg-accent/10",
    },
  ];

  const quickActions = [
    {
      title: "Add New Stock",
      description: "Add a new part to inventory",
      icon: Plus,
      link: "/add-stock",
      variant: "default" as const,
    },
    {
      title: "View All Parts",
      description: "Browse complete inventory",
      icon: List,
      link: "/parts",
      variant: "secondary" as const,
    },
    {
      title: "Customers",
      description: "Manage customer records",
      icon: Users,
      link: "/customers",
      variant: "secondary" as const,
    },
    {
      title: "Udhaari Summary",
      description: "Track pending payments",
      icon: FileText,
      link: "/udhaari",
      variant: "secondary" as const,
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Dashboard</h1>
          <p className="text-muted-foreground">Welcome back! Here's your inventory overview.</p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {statCards.map((stat) => {
            const Icon = stat.icon;
            return (
              <Card key={stat.title} className="hover:shadow-md transition-shadow">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">{stat.title}</p>
                      <p className="text-3xl font-bold">{loading ? "..." : stat.value}</p>
                    </div>
                    <div className={`${stat.bgColor} p-3 rounded-lg`}>
                      <Icon className={`w-6 h-6 ${stat.color}`} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Quick Actions */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle>Quick Actions</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {quickActions.map((action) => {
                    const Icon = action.icon;
                    return (
                      <Link key={action.title} to={action.link}>
                        <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
                          <CardContent className="p-4">
                            <div className="flex items-start gap-3">
                              <div className="bg-primary/10 p-2 rounded-lg">
                                <Icon className="w-5 h-5 text-primary" />
                              </div>
                              <div>
                                <h3 className="font-semibold mb-1">{action.title}</h3>
                                <p className="text-sm text-muted-foreground">{action.description}</p>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      </Link>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Recent Updates */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="w-5 h-5" />
                Recent Updates
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <p className="text-muted-foreground text-sm">Loading...</p>
              ) : recentParts.length === 0 ? (
                <p className="text-muted-foreground text-sm">No parts added yet</p>
              ) : (
                <div className="space-y-3">
                  {recentParts.map((part) => (
                    <div key={part.id} className="flex items-start justify-between border-b pb-3 last:border-0">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{part.part_name}</p>
                        <p className="text-xs text-muted-foreground">{part.brand}</p>
                      </div>
                      <Badge variant={part.quantity <= part.low_stock_threshold ? "destructive" : "secondary"}>
                        Qty: {part.quantity}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
