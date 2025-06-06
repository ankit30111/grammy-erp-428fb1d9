
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Truck, Star, Clock, AlertCircle } from "lucide-react";

export const VendorPerformanceWidget = () => {
  // Vendor delivery performance
  const { data: vendorPerformance } = useQuery({
    queryKey: ['vendor-performance'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('purchase_orders')
        .select(`
          id,
          expected_delivery_date,
          status,
          vendors (name),
          grn (received_date)
        `);
      
      if (error) throw error;
      
      // Calculate on-time delivery by vendor
      const vendorStats = data?.reduce((acc: any, po: any) => {
        const vendorName = po.vendors?.name || 'Unknown';
        if (!acc[vendorName]) {
          acc[vendorName] = { onTime: 0, total: 0 };
        }
        
        if (po.grn?.length && po.expected_delivery_date) {
          const receivedDate = new Date(po.grn[0].received_date);
          const expectedDate = new Date(po.expected_delivery_date);
          const isOnTime = receivedDate <= expectedDate;
          
          acc[vendorName].total += 1;
          if (isOnTime) acc[vendorName].onTime += 1;
        }
        
        return acc;
      }, {});
      
      return Object.entries(vendorStats || {}).map(([vendor, stats]: [string, any]) => ({
        vendor,
        onTimeRate: stats.total > 0 ? Math.round((stats.onTime / stats.total) * 100) : 0,
        totalOrders: stats.total
      })).slice(0, 5); // Top 5 vendors
    },
  });

  // Vendor quality scores
  const { data: vendorQuality } = useQuery({
    queryKey: ['vendor-quality'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('grn_items')
        .select(`
          iqc_status,
          accepted_quantity,
          rejected_quantity,
          grn (
            vendors (name)
          )
        `);
      
      if (error) throw error;
      
      const vendorQuality = data?.reduce((acc: any, item: any) => {
        const vendorName = item.grn?.vendors?.name || 'Unknown';
        if (!acc[vendorName]) {
          acc[vendorName] = { passed: 0, total: 0 };
        }
        
        if (item.iqc_status && item.iqc_status !== 'PENDING') {
          acc[vendorName].total += 1;
          if (item.iqc_status === 'APPROVED') {
            acc[vendorName].passed += 1;
          }
        }
        
        return acc;
      }, {});
      
      return Object.entries(vendorQuality || {}).map(([vendor, stats]: [string, any]) => ({
        vendor,
        qualityScore: stats.total > 0 ? Math.round((stats.passed / stats.total) * 100) : 0,
        totalLots: stats.total
      })).slice(0, 5);
    },
  });

  // Open CAPAs
  const { data: openCAPAs } = useQuery({
    queryKey: ['open-capas'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('vendor_capa')
        .select('id')
        .eq('status', 'Open');
      
      if (error) throw error;
      return data?.length || 0;
    },
  });

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Vendor On-Time Delivery
          </CardTitle>
        </CardHeader>
        <CardContent>
          {vendorPerformance?.length ? (
            <div className="space-y-3">
              {vendorPerformance.map((vendor) => (
                <div key={vendor.vendor} className="flex items-center justify-between">
                  <span className="text-sm font-medium truncate">{vendor.vendor}</span>
                  <div className="flex items-center gap-2">
                    <div className="text-sm text-muted-foreground">
                      {vendor.totalOrders} orders
                    </div>
                    <div className="text-sm font-bold text-green-600">
                      {vendor.onTimeRate}%
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-4 text-muted-foreground text-sm">
              No delivery data available
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Star className="h-5 w-5" />
            Vendor Quality Score
          </CardTitle>
        </CardHeader>
        <CardContent>
          {vendorQuality?.length ? (
            <div className="space-y-3">
              {vendorQuality.map((vendor) => (
                <div key={vendor.vendor} className="flex items-center justify-between">
                  <span className="text-sm font-medium truncate">{vendor.vendor}</span>
                  <div className="flex items-center gap-2">
                    <div className="text-sm text-muted-foreground">
                      {vendor.totalLots} lots
                    </div>
                    <div className="text-sm font-bold text-blue-600">
                      {vendor.qualityScore}%
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-4 text-muted-foreground text-sm">
              No quality data available
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Open CAPAs</CardTitle>
          <AlertCircle className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-red-600">{openCAPAs || 0}</div>
          <p className="text-xs text-muted-foreground">
            Pending vendor actions
          </p>
        </CardContent>
      </Card>
    </div>
  );
};
