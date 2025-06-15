
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Target, Plus, X } from "lucide-react";

interface BenchmarkDialogProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  projectName: string;
  onBenchmarkCreated: () => void;
}

interface Benchmark {
  benchmark_title: string;
  target_value: string;
  measurement_unit: string;
  description: string;
  priority: string;
  target_date: string;
}

const BenchmarkDialog = ({ isOpen, onClose, projectId, projectName, onBenchmarkCreated }: BenchmarkDialogProps) => {
  const [benchmarks, setBenchmarks] = useState<Benchmark[]>([{
    benchmark_title: '',
    target_value: '',
    measurement_unit: '',
    description: '',
    priority: 'MEDIUM',
    target_date: ''
  }]);
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const createBenchmarksMutation = useMutation({
    mutationFn: async (benchmarksData: Benchmark[]) => {
      const benchmarksToInsert = benchmarksData.map(benchmark => ({
        ...benchmark,
        npd_project_id: projectId
      }));

      const { data, error } = await supabase
        .from('npd_benchmarks')
        .insert(benchmarksToInsert)
        .select();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['npd-projects'] });
      toast({
        title: "Success",
        description: "Benchmarks created successfully"
      });
      onBenchmarkCreated();
      handleClose();
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to create benchmarks",
        variant: "destructive"
      });
    }
  });

  const addBenchmark = () => {
    setBenchmarks([...benchmarks, {
      benchmark_title: '',
      target_value: '',
      measurement_unit: '',
      description: '',
      priority: 'MEDIUM',
      target_date: ''
    }]);
  };

  const removeBenchmark = (index: number) => {
    if (benchmarks.length > 1) {
      setBenchmarks(benchmarks.filter((_, i) => i !== index));
    }
  };

  const updateBenchmark = (index: number, field: keyof Benchmark, value: string) => {
    const updated = [...benchmarks];
    updated[index] = { ...updated[index], [field]: value };
    setBenchmarks(updated);
  };

  const handleSave = () => {
    const validBenchmarks = benchmarks.filter(b => b.benchmark_title.trim() !== '');
    if (validBenchmarks.length === 0) {
      toast({
        title: "Error",
        description: "Please add at least one benchmark with a title",
        variant: "destructive"
      });
      return;
    }
    createBenchmarksMutation.mutate(validBenchmarks);
  };

  const handleClose = () => {
    setBenchmarks([{
      benchmark_title: '',
      target_value: '',
      measurement_unit: '',
      description: '',
      priority: 'MEDIUM',
      target_date: ''
    }]);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            Set Benchmarks for {projectName}
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          <p className="text-sm text-muted-foreground">
            Define key design and performance targets for this NPD project. These benchmarks will help track progress and ensure project objectives are met.
          </p>

          {benchmarks.map((benchmark, index) => (
            <div key={index} className="border rounded-lg p-4 space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="font-medium">Benchmark {index + 1}</h4>
                {benchmarks.length > 1 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeBenchmark(index)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor={`title-${index}`}>Benchmark Title *</Label>
                  <Input
                    id={`title-${index}`}
                    value={benchmark.benchmark_title}
                    onChange={(e) => updateBenchmark(index, 'benchmark_title', e.target.value)}
                    placeholder="e.g., Power Efficiency, Weight Target"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`priority-${index}`}>Priority</Label>
                  <Select 
                    value={benchmark.priority} 
                    onValueChange={(value) => updateBenchmark(index, 'priority', value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="LOW">Low</SelectItem>
                      <SelectItem value="MEDIUM">Medium</SelectItem>
                      <SelectItem value="HIGH">High</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor={`target-${index}`}>Target Value</Label>
                  <Input
                    id={`target-${index}`}
                    value={benchmark.target_value}
                    onChange={(e) => updateBenchmark(index, 'target_value', e.target.value)}
                    placeholder="e.g., 95, 2.5, Yes"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`unit-${index}`}>Unit</Label>
                  <Input
                    id={`unit-${index}`}
                    value={benchmark.measurement_unit}
                    onChange={(e) => updateBenchmark(index, 'measurement_unit', e.target.value)}
                    placeholder="e.g., %, kg, hours"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`date-${index}`}>Target Date</Label>
                  <Input
                    id={`date-${index}`}
                    type="date"
                    value={benchmark.target_date}
                    onChange={(e) => updateBenchmark(index, 'target_date', e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor={`description-${index}`}>Description</Label>
                <Textarea
                  id={`description-${index}`}
                  value={benchmark.description}
                  onChange={(e) => updateBenchmark(index, 'description', e.target.value)}
                  placeholder="Detailed description of this benchmark and how it will be measured"
                  rows={3}
                />
              </div>
            </div>
          ))}

          <Button variant="outline" onClick={addBenchmark} className="w-full">
            <Plus className="h-4 w-4 mr-2" />
            Add Another Benchmark
          </Button>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={handleClose}>
              Skip for Now
            </Button>
            <Button onClick={handleSave} disabled={createBenchmarksMutation.isPending}>
              {createBenchmarksMutation.isPending ? 'Creating...' : 'Create Benchmarks'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default BenchmarkDialog;
