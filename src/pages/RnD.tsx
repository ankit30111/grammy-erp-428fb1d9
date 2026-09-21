import { DashboardLayout } from "@/components/Layout/DashboardLayout";
import { PageHeader } from "@/components/shell/PageHeader";
import { TabBar } from "@/components/shell/TabBar";
import { rndRouteTabs } from "@/components/shell/moduleTabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Lightbulb, Package, ArrowRight, Users, Clock, CheckCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import ProjectStatusGrid from "@/components/RnD/ProjectStatusGrid";


const RnD = () => {
  const navigate = useNavigate();

  // Fetch NPD project statistics
  const { data: npdStats } = useQuery({
    queryKey: ['npd-stats'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('npd_projects')
        .select('stage');
      
      if (error) throw error;
      
      // npd_stage is CONCEPT | DESIGN | BOM | SAMPLE | VALIDATION | LAUNCHED |
      // DROPPED. PROTOTYPE, TESTING and APPROVED are not members, so those three
      // counts were always zero and "Active Development" never moved.
      const count = (...stages: string[]) =>
        data.filter(p => stages.includes(p.stage)).length;

      const total = data.length;
      const concept = count('CONCEPT');
      const designing = count('DESIGN', 'BOM');
      const sampling = count('SAMPLE', 'VALIDATION');
      const launched = count('LAUNCHED');
      const dropped = count('DROPPED');
      const inProgress = total - launched - dropped;

      return { total, concept, designing, sampling, launched, dropped, inProgress };
    }
  });


  return (
    <DashboardLayout>
      <PageHeader title="R&D" />
      <TabBar tabs={rndRouteTabs} />
      <div className="grid gap-6 pt-4">


        {/* Project Status Dashboard */}
        <ProjectStatusGrid />

        <div className="grid gap-6 md:grid-cols-2">
          {/* NPD Widget */}
          <Card 
            className="cursor-pointer transition-all hover:shadow-lg hover:scale-105"
            onClick={() => navigate('/rnd/npd')}
          >
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Lightbulb className="h-5 w-5 text-primary" />
                  <span>NPD (New Product Development)</span>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Complete development of new products from customer requirements to production-ready designs.
              </p>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-primary">{npdStats?.total || 0}</div>
                  <div className="text-xs text-muted-foreground">Total Projects</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-warning">{npdStats?.inProgress || 0}</div>
                  <div className="text-xs text-muted-foreground">In Development</div>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <Clock className="h-3 w-3 text-warning" />
                    <span className="text-xs">Design/Prototype/Testing</span>
                  </div>
                  <Badge variant="secondary">{npdStats?.inProgress || 0}</Badge>
                </div>
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-3 w-3 text-success" />
                    <span className="text-xs">Approved for Production</span>
                  </div>
                  <Badge variant="outline">{npdStats?.approved || 0}</Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          {/*
            Pre-Existing Product tracking was built on pre_existing_projects, which
            was dropped in the rebuild with no replacement. The card used to show
            four counts that would all read 0 forever - which looks like "nothing in
            progress" rather than "this feature no longer exists". It says so.
          */}
          <Card className="border-dashed">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-muted-foreground">
                <span>Pre-Existing Product</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="text-sm text-muted-foreground">
                Brand-specific customization of existing products.
              </p>
              <p className="text-sm font-medium">
                Not available after the rebuild — this module has no data behind it
                yet.
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Quick Stats Overview */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <div className="text-2xl font-bold text-primary">{npdStats?.total || 0}</div>
                <p className="text-sm text-muted-foreground">Total R&D Projects</p>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <div className="text-2xl font-bold text-warning">{npdStats?.inProgress || 0}</div>
                <p className="text-sm text-muted-foreground">Active Development</p>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <div className="text-2xl font-bold text-purple-600">{npdStats?.sampling || 0}</div>
                <p className="text-sm text-muted-foreground">In Sampling</p>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <div className="text-2xl font-bold text-success">{npdStats?.launched || 0}</div>
                <p className="text-sm text-muted-foreground">Launched</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default RnD;
