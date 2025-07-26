import { useMemo } from "react";
import { format, differenceInDays, parseISO } from "date-fns";
import { Container } from "@/hooks/useContainers";

interface ContainerGanttChartProps {
  containers: Container[];
}

const statusSteps = [
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
      const startDate = container.loading_date ? parseISO(container.loading_date) : minDate;
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
    <div className="w-full overflow-x-auto bg-background">
      <div className="min-w-[1200px] p-4">
        {/* Enhanced Header with dates */}
        <div className="flex items-center mb-6 sticky top-0 bg-background z-10 border-b border-border pb-2">
          <div className="w-64 text-sm font-semibold text-foreground">Container Details</div>
          <div className="flex-1 flex">
            {Array.from({ length: chartData.totalDays + 1 }, (_, i) => {
              const date = new Date(chartData.minDate);
              date.setDate(date.getDate() + i);
              const isWeekStart = i % 7 === 0;
              return (
                <div
                  key={i}
                  className={`text-xs border-l px-2 py-1 ${
                    isWeekStart 
                      ? 'text-foreground font-medium border-border' 
                      : 'text-muted-foreground border-border/30'
                  }`}
                  style={{ width: dayWidth }}
                >
                  {isWeekStart ? format(date, 'MMM d') : i % 7 === 3 ? format(date, 'd') : ''}
                </div>
              );
            })}
          </div>
        </div>

        {/* Enhanced Container rows */}
        <div className="space-y-3">
          {chartData.containerData.map((container) => (
            <div key={container.id} className="flex items-center group hover:bg-muted/50 rounded-lg p-3 border border-border/50 hover:border-border transition-all duration-200">
              <div className="w-64 pr-4">
                <div className="text-sm font-semibold text-foreground truncate">
                  {container.container_number}
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  Status: {container.current_status.replace('_', ' ')}
                </div>
                <div className="text-xs text-primary font-medium mt-1">
                  {container.progressPercentage.toFixed(0)}% Complete
                </div>
              </div>
              
              <div className="flex-1 relative h-12 bg-muted/30 rounded-md">
                {/* Background grid with better visibility */}
                <div className="absolute inset-0 flex">
                  {Array.from({ length: chartData.totalDays + 1 }, (_, i) => (
                    <div
                      key={i}
                      className={`border-l ${i % 7 === 0 ? 'border-border' : 'border-border/20'}`}
                      style={{ width: dayWidth }}
                    />
                  ))}
                </div>

                {/* Enhanced Progress bar with gradient */}
                <div
                  className="absolute top-2 h-8 rounded-lg flex items-center px-3 text-white text-xs font-semibold shadow-md border border-white/20"
                  style={{
                    left: Math.max(0, container.daysFromStart * dayWidth),
                    width: `${Math.max(container.progressPercentage, 15)}%`,
                    background: `linear-gradient(135deg, ${container.statusColor}, ${container.statusColor}dd)`,
                    minWidth: '80px'
                  }}
                >
                  <span className="drop-shadow-sm">
                    {container.current_status.replace('_', ' ')}
                  </span>
                </div>

                {/* Enhanced Status milestones */}
                {container.progress.map((date, index) => (
                  <div
                    key={index}
                    className="absolute top-1 w-2 h-10 bg-primary rounded-full shadow-sm border-2 border-background"
                    style={{
                      left: (differenceInDays(date, chartData.minDate) * dayWidth) - 4
                    }}
                    title={`${statusSteps[index]}: ${format(date, 'MMM d, yyyy')}`}
                  />
                ))}

                {/* Timeline markers for major statuses */}
                <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-muted-foreground/20 to-muted-foreground/5 rounded-b-md" />
              </div>
            </div>
          ))}
        </div>

        {/* Legend */}
        <div className="mt-8 p-4 bg-muted/30 rounded-lg">
          <h4 className="text-sm font-semibold mb-3 text-foreground">Status Legend</h4>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
            {statusSteps.map((status) => (
              <div key={status} className="flex items-center space-x-2">
                <div 
                  className="w-3 h-3 rounded-full" 
                  style={{ backgroundColor: statusColors[status as keyof typeof statusColors] }}
                />
                <span className="text-xs text-muted-foreground">
                  {status.replace('_', ' ')}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}