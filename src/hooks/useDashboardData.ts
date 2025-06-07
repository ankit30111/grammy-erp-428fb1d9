
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const usePPCDashboardData = () => {
  return useQuery({
    queryKey: ['ppc-dashboard'],
    queryFn: async () => {
      const [projectionsData, shortagesData, schedulesData] = await Promise.all([
        supabase.from('projections').select('*').gte('created_at', new Date(new Date().setDate(1)).toISOString()),
        supabase.from('material_shortages_calculated').select('*').gt('shortage_quantity', 0),
        supabase.from('production_schedules').select('*')
      ]);

      return {
        totalProjections: projectionsData.data?.length || 0,
        pendingProjections: projectionsData.data?.filter(p => p.status === 'New').length || 0,
        materialShortages: shortagesData.data?.length || 0,
        scheduledProduction: schedulesData.data?.filter(s => s.status === 'SCHEDULED').length || 0
      };
    }
  });
};

export const useStoreDashboardData = () => {
  return useQuery({
    queryKey: ['store-dashboard'],
    queryFn: async () => {
      const [inventoryData, grnData, movementsData] = await Promise.all([
        supabase.from('inventory').select('quantity').eq('location', 'Main Store'),
        supabase.from('grn').select('*').eq('status', 'RECEIVED'),
        supabase.from('material_movements').select('*').eq('movement_type', 'OUT').gte('created_at', new Date().toISOString().split('T')[0])
      ]);

      const totalStock = inventoryData.data?.reduce((sum, item) => sum + item.quantity, 0) || 0;
      
      return {
        totalRawMaterials: totalStock,
        pendingGRN: grnData.data?.length || 0,
        dailyDispatches: movementsData.data?.length || 0
      };
    }
  });
};

export const useProductionDashboardData = () => {
  return useQuery({
    queryKey: ['production-dashboard'],
    queryFn: async () => {
      const [ordersData, hourlyData] = await Promise.all([
        supabase.from('production_orders').select('*'),
        supabase.from('hourly_production').select('*').gte('created_at', new Date().toISOString().split('T')[0])
      ]);

      const scheduled = ordersData.data?.filter(o => o.status === 'PENDING').length || 0;
      const completed = ordersData.data?.filter(o => o.status === 'COMPLETED').length || 0;
      const inProgress = ordersData.data?.filter(o => o.status === 'IN_PROGRESS').length || 0;

      return {
        scheduledVouchers: scheduled,
        completedVouchers: completed,
        inProgressVouchers: inProgress,
        todayProduction: hourlyData.data?.reduce((sum, h) => sum + h.production_units, 0) || 0
      };
    }
  });
};

export const useQualityDashboardData = () => {
  return useQuery({
    queryKey: ['quality-dashboard'],
    queryFn: async () => {
      const [grnItemsData, lineRejectionsData] = await Promise.all([
        supabase.from('grn_items').select('iqc_status'),
        supabase.from('line_rejections').select('*')
      ]);

      const totalIQC = grnItemsData.data?.length || 0;
      const passedIQC = grnItemsData.data?.filter(g => g.iqc_status === 'APPROVED').length || 0;
      const rejectedIQC = grnItemsData.data?.filter(g => g.iqc_status === 'REJECTED').length || 0;

      return {
        iqcPassRatio: totalIQC > 0 ? Math.round((passedIQC / totalIQC) * 100) : 0,
        iqcRejectionCount: rejectedIQC,
        lineRejections: lineRejectionsData.data?.length || 0
      };
    }
  });
};
