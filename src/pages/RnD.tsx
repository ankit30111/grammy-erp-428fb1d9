import { DashboardLayout } from "@/components/Layout/DashboardLayout";
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
        .select('status');
      
      if (error) throw error;
      
      const total = data.length;
      const concept = data.filter(p => p.status === 'CONCEPT').length;
      const prototype = data.filter(p => p.status === 'PROTOTYPE').length;
      const testing = data.filter(p => p.status === 'TESTING').length;
      const approved = data.filter(p => p.status === 'APPROVED').length;
      const inProgress = concept + prototype + testing;
      
      return { total, concept, prototype, testing, approved, inProgress };
    }
  });

  // Fetch Pre-Existing project statistics
  const { data: preExistingStats } = useQuery({
    queryKey: ['pre-existing-stats'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pre_existing_projects')
        .select('status');
      
      if (error) throw error;
      
      const total = data.length;
      const customization = data.filter(p => p.status === 'CUSTOMIZATION').length;
      const customerApproval = data.filter(p => p.status === 'CUSTOMER_APPROVAL').length;
      const finalized = data.filter(p => p.status === 'FINALIZED').length;
      
      return { total, customization, customerApproval, finalized };
    }
  });

  return (
    <DashboardLayout>
      <div className="grid gap-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">Research & Development</h1>
          <div className="flex items-center gap-2">
            <Lightbulb className="h-8 w-8 text-primary" />
          </div>
        </div>

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
                  <Lightbulb className="h-5 w-5 text-blue-600" />
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
                  <div className="text-2xl font-bold text-blue-600">{npdStats?.total || 0}</div>
                  <div className="text-xs text-muted-foreground">Total Projects</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-orange-600">{npdStats?.inProgress || 0}</div>
                  <div className="text-xs text-muted-foreground">In Development</div>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <Clock className="h-3 w-3 text-yellow-500" />
                    <span className="text-xs">Design/Prototype/Testing</span>
                  </div>
                  <Badge variant="secondary">{npdStats?.inProgress || 0}</Badge>
                </div>
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-3 w-3 text-green-500" />
                    <span className="text-xs">Approved for Production</span>
                  </div>
                  <Badge variant="outline">{npdStats?.approved || 0}</Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Pre-Existing Product Widget */}
          <Card 
            className="cursor-pointer transition-all hover:shadow-lg hover:scale-105"
            onClick={() => navigate('/rnd/pre-existing')}
          >
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Package className="h-5 w-5 text-green-600" />
                  <span>Pre-Existing Product</span>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Brand-specific customization of existing products including packaging, UI, and documentation.
              </p>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">{preExistingStats?.total || 0}</div>
                  <div className="text-xs text-muted-foreground">Total Projects</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-purple-600">{preExistingStats?.customization || 0}</div>
                  <div className="text-xs text-muted-foreground">Under Customization</div>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <Users className="h-3 w-3 text-blue-500" />
                    <span className="text-xs">Ready for Customer Approval</span>
                  </div>
                  <Badge variant="secondary">{preExistingStats?.customerApproval || 0}</Badge>
                </div>
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-3 w-3 text-green-500" />
                    <span className="text-xs">Finalized</span>
                  </div>
                  <Badge variant="outline">{preExistingStats?.finalized || 0}</Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Quick Stats Overview */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">{(npdStats?.total || 0) + (preExistingStats?.total || 0)}</div>
                <p className="text-sm text-muted-foreground">Total R&D Projects</p>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <div className="text-2xl font-bold text-orange-600">{(npdStats?.inProgress || 0) + (preExistingStats?.customization || 0)}</div>
                <p className="text-sm text-muted-foreground">Active Development</p>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <div className="text-2xl font-bold text-purple-600">{preExistingStats?.customerApproval || 0}</div>
                <p className="text-sm text-muted-foreground">Awaiting Approval</p>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">{(npdStats?.approved || 0) + (preExistingStats?.finalized || 0)}</div>
                <p className="text-sm text-muted-foreground">Completed Projects</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default RnD;
