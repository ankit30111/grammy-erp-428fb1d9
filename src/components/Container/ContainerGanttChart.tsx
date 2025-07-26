import { useMemo } from "react";
import { format, differenceInDays, parseISO } from "date-fns";
import { Container } from "@/hooks/useContainers";

interface ContainerGanttChartProps {
  containers: Container[];
}

const statusSteps = [
  'ORDERED',
  'LOADING', 
  'LOADED',
  'CHINA_CUSTOM',
  'SHIPPED',
  'IN_TRANSIT',
  'INDIAN_DOCK',
  'IN_TRAIN',
  'INDIA_CUSTOM',
  'DISPATCHED',
  'ARRIVED'
];

const statusColors = {
  ORDERED: "#fbbf24",
  LOADING: "#fb923c", 
  LOADED: "#3b82f6",
  CHINA_CUSTOM: "#8b5cf6",
  SHIPPED: "#06b6d4",
  IN_TRANSIT: "#6366f1",
  INDIAN_DOCK: "#10b981",
  IN_TRAIN: "#14b8a6",
  INDIA_CUSTOM: "#f59e0b",
  DISPATCHED: "#84cc16",
  ARRIVED: "#059669"
};

export default function ContainerGanttChart({ containers }: ContainerGanttChartProps) {
  const chartData = useMemo(() => {
    if (!containers.length) return { minDate: new Date(), maxDate: new Date(), containerData: [] };

    const dates = containers.flatMap(container => [
      container.ordered_date,
      container.loading_date,
      container.loaded_date,
      container.china_custom_date,
      container.shipped_date,
      container.in_transit_date,
      container.indian_dock_date,
      container.in_train_date,
      container.india_custom_date,
      container.dispatched_date,
      container.arrived_date
    ].filter(Boolean).map(date => parseISO(date!)));

    const minDate = new Date(Math.min(...dates.map(d => d.getTime())));
    const maxDate = new Date(Math.max(...dates.map(d => d.getTime())));
    
    const totalDays = differenceInDays(maxDate, minDate) || 1;

    const containerData = containers.map(container => {
      const startDate = container.ordered_date ? parseISO(container.ordered_date) : minDate;
      const currentStatusIndex = statusSteps.indexOf(container.current_status);
      
      // Calculate progress based on status dates
      const progress = statusSteps.slice(0, currentStatusIndex + 1).map(status => {
        const dateKey = `${status.toLowerCase()}_date` as keyof Container;
        return container[dateKey] ? parseISO(container[dateKey] as string) : null;
      }).filter(Boolean);

      return {
        ...container,
        startDate,
        progress,
        progressPercentage: ((currentStatusIndex + 1) / statusSteps.length) * 100,
        daysFromStart: differenceInDays(startDate, minDate),
        statusColor: statusColors[container.current_status as keyof typeof statusColors] || "#6b7280"
      };
    });

    return { minDate, maxDate, totalDays, containerData };
  }, [containers]);

  if (!containers.length) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        No containers to display
      </div>
    );
  }

  const dayWidth = Math.max(1200 / chartData.totalDays, 30);

  return (
    <div className="w-full overflow-x-auto">
      <div className="min-w-[1200px]">
        {/* Header with dates */}
        <div className="flex items-center mb-4 sticky top-0 bg-background z-10">
          <div className="w-48 text-sm font-medium">Container</div>
          <div className="flex-1 flex">
            {Array.from({ length: chartData.totalDays + 1 }, (_, i) => {
              const date = new Date(chartData.minDate);
              date.setDate(date.getDate() + i);
              return (
                <div
                  key={i}
                  className="text-xs text-muted-foreground border-l border-border px-1"
                  style={{ width: dayWidth }}
                >
                  {i % 7 === 0 ? format(date, 'MMM d') : ''}
                </div>
              );
            })}
          </div>
        </div>

        {/* Container rows */}
        {chartData.containerData.map((container) => (
          <div key={container.id} className="flex items-center mb-2 group hover:bg-muted/50 rounded p-1">
            <div className="w-48 pr-4">
              <div className="text-sm font-medium truncate">
                {container.container_number}
              </div>
              <div className="text-xs text-muted-foreground">
                {container.current_status.replace('_', ' ')}
              </div>
            </div>
            
            <div className="flex-1 relative h-8">
              {/* Background grid */}
              <div className="absolute inset-0 flex">
                {Array.from({ length: chartData.totalDays + 1 }, (_, i) => (
                  <div
                    key={i}
                    className="border-l border-border/30"
                    style={{ width: dayWidth }}
                  />
                ))}
              </div>

              {/* Progress bar */}
              <div
                className="absolute top-1 h-6 rounded-md flex items-center px-2 text-white text-xs font-medium"
                style={{
                  left: (container.daysFromStart * dayWidth),
                  width: `${container.progressPercentage}%`,
                  backgroundColor: container.statusColor,
                  minWidth: '60px'
                }}
              >
                {container.progressPercentage.toFixed(0)}%
              </div>

              {/* Status milestones */}
              {container.progress.map((date, index) => (
                <div
                  key={index}
                  className="absolute top-0 w-1 h-8 bg-white border border-gray-300 rounded"
                  style={{
                    left: (differenceInDays(date, chartData.minDate) * dayWidth) - 2
                  }}
                  title={format(date, 'MMM d, yyyy')}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}