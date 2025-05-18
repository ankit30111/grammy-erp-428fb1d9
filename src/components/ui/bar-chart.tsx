
import * as React from "react"
import { BarChart as RechartsBarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts"
import { ChartContainer, ChartTooltipContent } from "@/components/ui/chart"

interface BarChartProps {
  data: any[];
  index: string;
  categories: string[];
  colors?: string[];
  valueFormatter?: (value: number) => string;
  yAxisWidth?: number;
}

export function BarChart({
  data,
  index,
  categories,
  colors = ["blue"],
  valueFormatter = (value) => `${value}`,
  yAxisWidth = 40,
}: BarChartProps) {
  // Create a configuration object for the chart
  const chartConfig = categories.reduce((acc, category, i) => {
    acc[category] = {
      label: category,
      color: colors[i % colors.length],
    };
    return acc;
  }, {} as Record<string, { label: string; color: string }>);

  return (
    <ChartContainer config={chartConfig}>
      <RechartsBarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} />
        <XAxis 
          dataKey={index} 
          tickLine={false}
          axisLine={false}
          tick={{ fontSize: 12 }}
        />
        <YAxis 
          tickLine={false}
          axisLine={false}
          width={yAxisWidth}
          tick={{ fontSize: 12 }}
        />
        <Tooltip 
          content={(props) => (
            <ChartTooltipContent 
              {...props as any} 
              formatter={(value) => valueFormatter(Number(value))}
            />
          )}
        />
        {categories.map((category, i) => (
          <Bar
            key={category}
            dataKey={category}
            fill={colors[i % colors.length]}
            radius={[4, 4, 0, 0]}
            barSize={30}
          />
        ))}
      </RechartsBarChart>
    </ChartContainer>
  )
}
