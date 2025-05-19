
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CalendarIcon, AlertTriangle, Check } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format } from "date-fns";
import { projections, productionLines, RawMaterialShortage } from "@/types/ppc";

interface ScheduleProductionFormProps {
  date: Date | undefined;
  selectedProjection: string | null;
  setSelectedProjection: (id: string | null) => void;
  selectedLine: string;
  setSelectedLine: (id: string) => void;
  quantity: string;
  setQuantity: (quantity: string) => void;
  materialShortages: RawMaterialShortage[];
  handleScheduleProduction: () => void;
  getSelectedProjection: () => (typeof projections[0]) | undefined;
  checkMaterialAvailability: (product: string, qty: number) => void;
}

const ScheduleProductionForm = ({
  date,
  selectedProjection,
  setSelectedProjection,
  selectedLine,
  setSelectedLine,
  quantity,
  setQuantity,
  materialShortages,
  handleScheduleProduction,
  getSelectedProjection,
  checkMaterialAvailability
}: ScheduleProductionFormProps) => {

  return (
    <Card className="md:col-span-2">
      <CardHeader>
        <CardTitle>Schedule Production</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Left column */}
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-1 block">Selected Date</label>
                <div className="p-2 bg-accent rounded flex items-center">
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {date ? format(date, 'PPPP') : 'Select a date'}
                </div>
              </div>
              
              <div>
                <label htmlFor="projection" className="text-sm font-medium mb-1 block">Customer Projection</label>
                <Select value={selectedProjection || ""} onValueChange={setSelectedProjection}>
                  <SelectTrigger id="projection">
                    <SelectValue placeholder="Select projection" />
                  </SelectTrigger>
                  <SelectContent>
                    {projections.map((proj) => (
                      <SelectItem key={proj.id} value={proj.id}>
                        {proj.customer} - {proj.product} ({proj.quantity} pcs)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <label htmlFor="quantity" className="text-sm font-medium mb-1 block">Quantity to Produce</label>
                <Input 
                  id="quantity"
                  type="number"
                  value={quantity}
                  onChange={(e) => {
                    setQuantity(e.target.value);
                    if (selectedProjection) {
                      const projectionDetails = getSelectedProjection();
                      if (projectionDetails && e.target.value) {
                        checkMaterialAvailability(projectionDetails.product, parseInt(e.target.value));
                      }
                    }
                  }}
                  placeholder="Enter quantity"
                />
              </div>
            </div>
            
            {/* Right column */}
            <div className="space-y-4">
              <div>
                <label htmlFor="line" className="text-sm font-medium mb-1 block">Production Line</label>
                <Select value={selectedLine} onValueChange={setSelectedLine}>
                  <SelectTrigger id="line">
                    <SelectValue placeholder="Select production line" />
                  </SelectTrigger>
                  <SelectContent>
                    {productionLines.map((line) => (
                      <SelectItem key={line.id} value={line.id}>
                        {line.name} (Capacity: {line.capacity} pcs/day)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              {selectedProjection && materialShortages.length > 0 && (
                <div className="bg-amber-50 p-3 rounded-md border border-amber-200">
                  <h4 className="flex items-center text-sm font-medium text-amber-800 mb-2">
                    <AlertTriangle className="h-4 w-4 mr-1" />
                    Material Shortage Detected
                  </h4>
                  <ul className="text-xs space-y-1 text-amber-800">
                    {materialShortages.map((shortage, index) => (
                      <li key={index}>
                        {shortage.partCode}: Need {shortage.required}, have {shortage.available} 
                        ({shortage.shortage} short)
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              
              <div className="pt-6">
                <Button 
                  onClick={handleScheduleProduction}
                  disabled={!date || !selectedProjection || !selectedLine || !quantity}
                  className="w-full"
                >
                  <Check className="mr-2 h-4 w-4" />
                  Schedule Production
                </Button>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default ScheduleProductionForm;
