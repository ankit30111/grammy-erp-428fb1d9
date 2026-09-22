
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useDashboardScope } from "@/contexts/DashboardScopeContext";

export const usePPCDashboardData = () => {
  const { scopePlantId } = useDashboardScope();
  return useQuery({
    queryKey: ['ppc-dashboard', scopePlantId ?? 'all'],
    queryFn: async () => {
      let schedulesQ = supabase.from('production_schedules').select('*');
      if (scopePlantId) schedulesQ = schedulesQ.eq('plant_id', scopePlantId);
      const [projectionsData, shortagesData, schedulesData] = await Promise.all([
        supabase.from('projections').select('*').gte('created_at', new Date(new Date().setDate(1)).toISOString()),
        supabase.from('shortages').select('*').gt('shortage_quantity', 0),
        schedulesQ
      ]);

      return {
        totalProjections: projectionsData.data?.length || 0,
        pendingProjections: projectionsData.data?.filter(p => p.status === 'New').length || 0,
        materialShortages: shortagesData.data?.length || 0,
        scheduledProduction: schedulesData.data?.filter(s => s.status === 'PLANNED').length || 0
      };
    }
  });
};

export const useStoreDashboardData = () => {
  const { scopePlantId } = useDashboardScope();
  return useQuery({
    queryKey: ['store-dashboard', scopePlantId ?? 'all'],
    queryFn: async () => {
      let invQ = supabase
        .from('stock_balance')
        .select('quantity, stock_locations!inner(code)')
        .eq('stock_locations.code', 'MAIN');
      // "Pending GRN" = received but not yet through inspection and store count.
      // ('RECEIVED' is not a grn_status; this tile counted nothing.)
      let grnQ = supabase.from('grn').select('id').in('status', ['IQC_PENDING', 'IQC_DONE']);
      // Daily dispatches = anything that left stock today. Taken from the sign of
      // qty_delta rather than matching a movement_type string: the old query looked
      // for type 'OUT', which nothing in the app has ever posted, so this tile read
      // zero regardless of activity.
      let movQ = supabase
        .from('stock_ledger')
        .select('id')
        .lt('qty_delta', 0)
        .gte('created_at', new Date().toISOString().split('T')[0]);
      if (scopePlantId) {
        invQ = invQ.eq('plant_id', scopePlantId);
        grnQ = grnQ.eq('plant_id', scopePlantId);
        movQ = movQ.eq('plant_id', scopePlantId);
      }
      const [inventoryData, grnData, movementsData] = await Promise.all([
        invQ, grnQ, movQ
      ]);

      const totalStock = inventoryData.data?.reduce((sum: number, item: any) => sum + Number(item.quantity || 0), 0) || 0;
      
      return {
        totalRawMaterials: totalStock,
        pendingGRN: grnData.data?.length || 0,
        dailyDispatches: movementsData.data?.length || 0
      };
    }
  });
};

export const useProductionDashboardData = () => {
  const { scopePlantId } = useDashboardScope();
  return useQuery({
    queryKey: ['production-dashboard', scopePlantId ?? 'all'],
    queryFn: async () => {
      let ordersQ = supabase.from('production_orders').select('*');
      if (scopePlantId) ordersQ = ordersQ.eq('plant_id', scopePlantId);
      const [ordersData, hourlyData] = await Promise.all([
        ordersQ,
        supabase.from('hourly_production').select('*').gte('created_at', new Date().toISOString().split('T')[0])
      ]);

      const scheduled = ordersData.data?.filter(o => o.status === 'PLANNED').length || 0;
      const completed = ordersData.data?.filter(o => o.status === 'COMPLETED').length || 0;
      const inProgress = ordersData.data?.filter(o => o.status === 'IN_PRODUCTION').length || 0;

      return {
        scheduledVouchers: scheduled,
        completedVouchers: completed,
        inProgressVouchers: inProgress,
        todayProduction: hourlyData.data?.reduce((sum, h) => sum + h.produced_quantity, 0) || 0
      };
    }
  });
};

export const useQualityDashboardData = () => {
  const { scopePlantId } = useDashboardScope();
  return useQuery({
    queryKey: ['quality-dashboard', scopePlantId ?? 'all'],
    queryFn: async () => {
      // grn_items carries no plant_id; the plant is on the parent grn.
      let itemsQ = supabase.from('grn_items').select('iqc_outcome, grn!inner(plant_id)');
      if (scopePlantId) itemsQ = itemsQ.eq('grn.plant_id', scopePlantId);
      const [grnItemsData, lineRejectionsData] = await Promise.all([
        itemsQ,
        supabase.from('line_rejections').select('*')
      ]);

      const totalIQC = grnItemsData.data?.length || 0;
      const passedIQC = grnItemsData.data?.filter(g => g.iqc_outcome === 'ACCEPTED').length || 0;
      const rejectedIQC = grnItemsData.data?.filter(g => g.iqc_outcome === 'REJECTED').length || 0;

      return {
        iqcPassRatio: totalIQC > 0 ? Math.round((passedIQC / totalIQC) * 100) : 0,
        iqcRejectionCount: rejectedIQC,
        lineRejections: lineRejectionsData.data?.length || 0
      };
    }
  });
};
