
import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, GraduationCap, DollarSign, TrendingUp, Award, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export function HRDashboard() {
  const skillLevels = [
    { name: "Senior Engineers", count: 12, color: "bg-green-500" },
    { name: "Mid-level Engineers", count: 8, color: "bg-blue-500" },
    { name: "Junior Engineers", count: 15, color: "bg-yellow-500" },
    { name: "Technicians", count: 20, color: "bg-purple-500" },
    { name: "Operators", count: 25, color: "bg-orange-500" }
  ];

  const recentActivities = [
    { type: "New Hire", employee: "John Smith", department: "Production", date: "2024-01-15" },
    { type: "Training", employee: "Sarah Wilson", program: "Safety Training", date: "2024-01-14" },
    { type: "Performance Review", employee: "Mike Johnson", rating: "Excellent", date: "2024-01-13" },
    { type: "Promotion", employee: "Lisa Chen", position: "Senior Technician", date: "2024-01-12" }
  ];

  return (
    <div className="space-y-6">
      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Employees</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">80</div>
            <p className="text-xs text-muted-foreground">+5% from last month</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Training Programs</CardTitle>
            <GraduationCap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">12</div>
            <p className="text-xs text-muted-foreground">3 active this month</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Performance</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">4.2/5</div>
            <p className="text-xs text-muted-foreground">+0.2 from last quarter</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Monthly Payroll</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">₹45.2L</div>
            <p className="text-xs text-muted-foreground">Current month</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Skill Matrix Overview */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Award className="h-5 w-5" />
              Staff Distribution by Skill Level
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {skillLevels.map((skill, index) => (
                <div key={index} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-3 h-3 rounded-full ${skill.color}`} />
                    <span className="text-sm font-medium">{skill.name}</span>
                  </div>
                  <Badge variant="secondary">{skill.count}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Recent Activities */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Recent Activities
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentActivities.map((activity, index) => (
                <div key={index} className="flex items-center justify-between border-b pb-2 last:border-0">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">
                        {activity.type}
                      </Badge>
                      <span className="text-sm font-medium">{activity.employee}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {activity.type === "Training" && activity.program}
                      {activity.type === "Performance Review" && `Rating: ${activity.rating}`}
                      {activity.type === "Promotion" && activity.position}
                      {activity.type === "New Hire" && `Department: ${activity.department}`}
                    </p>
                  </div>
                  <span className="text-xs text-muted-foreground">{activity.date}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
