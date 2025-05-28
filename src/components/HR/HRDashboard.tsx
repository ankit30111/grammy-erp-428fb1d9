
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, TrendingUp, Clock, Award, DollarSign, AlertTriangle } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function HRDashboard() {
  const { data: stats } = useQuery({
    queryKey: ['hr-dashboard-stats'],
    queryFn: async () => {
      const [employeesCount, activeEmployees, pendingReviews, trainingInProgress] = await Promise.all([
        supabase.from('employees').select('id', { count: 'exact' }),
        supabase.from('employees').select('id', { count: 'exact' }).eq('status', 'active'),
        supabase.from('performance_reviews').select('id', { count: 'exact' }).is('completion_date', null),
        supabase.from('employee_training').select('id', { count: 'exact' }).eq('status', 'enrolled')
      ]);

      return {
        totalEmployees: employeesCount.count || 0,
        activeEmployees: activeEmployees.count || 0,
        pendingReviews: pendingReviews.count || 0,
        trainingInProgress: trainingInProgress.count || 0
      };
    }
  });

  const dashboardCards = [
    {
      title: "Total Employees",
      value: stats?.totalEmployees || 0,
      icon: Users,
      description: "All registered employees"
    },
    {
      title: "Active Employees",
      value: stats?.activeEmployees || 0,
      icon: TrendingUp,
      description: "Currently working employees"
    },
    {
      title: "Pending Reviews",
      value: stats?.pendingReviews || 0,
      icon: Clock,
      description: "Performance reviews due"
    },
    {
      title: "Training in Progress",
      value: stats?.trainingInProgress || 0,
      icon: Award,
      description: "Ongoing training programs"
    }
  ];

  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
      {dashboardCards.map((card, index) => (
        <Card key={index}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {card.title}
            </CardTitle>
            <card.icon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{card.value}</div>
            <p className="text-xs text-muted-foreground">
              {card.description}
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
