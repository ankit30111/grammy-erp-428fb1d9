
import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Plus, BookOpen, Users } from "lucide-react";

export function TrainingManagement() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [programName, setProgramName] = useState("");
  const [description, setDescription] = useState("");
  const [duration, setDuration] = useState("");
  const [trainer, setTrainer] = useState("");
  const [cost, setCost] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [maxParticipants, setMaxParticipants] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: trainingPrograms, isLoading } = useQuery({
    queryKey: ['training-programs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('training_programs')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data;
    }
  });

  const { data: enrollments } = useQuery({
    queryKey: ['training-enrollments'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('employee_training')
        .select(`
          *,
          employees:employee_id (first_name, last_name, employee_code),
          training_programs:training_program_id (program_name)
        `);
      
      if (error) throw error;
      return data;
    }
  });

  const createProgramMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('training_programs')
        .insert([{
          program_name: programName,
          description,
          duration_hours: duration ? parseInt(duration) : null,
          trainer_name: trainer,
          cost: cost ? parseFloat(cost) : null,
          start_date: startDate || null,
          end_date: endDate || null,
          max_participants: maxParticipants ? parseInt(maxParticipants) : null,
        }]);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['training-programs'] });
      toast({ title: "Training program created successfully" });
      setIsDialogOpen(false);
      resetForm();
    },
    onError: (error) => {
      toast({ title: "Error creating training program", description: error.message, variant: "destructive" });
    }
  });

  const resetForm = () => {
    setProgramName("");
    setDescription("");
    setDuration("");
    setTrainer("");
    setCost("");
    setStartDate("");
    setEndDate("");
    setMaxParticipants("");
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!programName) {
      toast({ title: "Program name is required", variant: "destructive" });
      return;
    }
    createProgramMutation.mutate();
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-500';
      case 'enrolled': return 'bg-blue-500';
      case 'dropped': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">Training Management</h2>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Create Program
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Create Training Program</DialogTitle>
              <DialogDescription>
                Create a new training program for employee development.
              </DialogDescription>
            </DialogHeader>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="program-name">Program Name</Label>
                  <Input
                    id="program-name"
                    value={programName}
                    onChange={(e) => setProgramName(e.target.value)}
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="trainer">Trainer Name</Label>
                  <Input
                    id="trainer"
                    value={trainer}
                    onChange={(e) => setTrainer(e.target.value)}
                  />
                </div>

                <div>
                  <Label htmlFor="duration">Duration (Hours)</Label>
                  <Input
                    id="duration"
                    type="number"
                    value={duration}
                    onChange={(e) => setDuration(e.target.value)}
                  />
                </div>

                <div>
                  <Label htmlFor="cost">Cost</Label>
                  <Input
                    id="cost"
                    type="number"
                    step="0.01"
                    value={cost}
                    onChange={(e) => setCost(e.target.value)}
                  />
                </div>

                <div>
                  <Label htmlFor="start-date">Start Date</Label>
                  <Input
                    id="start-date"
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                  />
                </div>

                <div>
                  <Label htmlFor="end-date">End Date</Label>
                  <Input
                    id="end-date"
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                  />
                </div>

                <div>
                  <Label htmlFor="max-participants">Max Participants</Label>
                  <Input
                    id="max-participants"
                    type="number"
                    value={maxParticipants}
                    onChange={(e) => setMaxParticipants(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                />
              </div>

              <DialogFooter>
                <Button type="submit" disabled={createProgramMutation.isPending}>
                  Create Program
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BookOpen className="h-5 w-5" />
              Training Programs
            </CardTitle>
            <CardDescription>Available training programs</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div>Loading training programs...</div>
            ) : (
              <div className="space-y-4">
                {trainingPrograms?.map((program) => (
                  <div key={program.id} className="border rounded-lg p-4">
                    <h3 className="font-semibold">{program.program_name}</h3>
                    <p className="text-sm text-gray-600 mt-1">{program.description}</p>
                    <div className="flex justify-between items-center mt-2 text-sm">
                      <span>Trainer: {program.trainer_name || 'TBD'}</span>
                      <span>{program.duration_hours}h</span>
                    </div>
                    {program.start_date && (
                      <div className="text-sm text-gray-500 mt-1">
                        {new Date(program.start_date).toLocaleDateString()} - {' '}
                        {program.end_date ? new Date(program.end_date).toLocaleDateString() : 'Ongoing'}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Training Enrollments
            </CardTitle>
            <CardDescription>Employee training progress</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>Program</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Score</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {enrollments?.slice(0, 10).map((enrollment) => (
                  <TableRow key={enrollment.id}>
                    <TableCell className="text-sm">
                      {enrollment.employees?.employee_code}
                    </TableCell>
                    <TableCell className="text-sm">
                      {enrollment.training_programs?.program_name}
                    </TableCell>
                    <TableCell>
                      <Badge className={getStatusColor(enrollment.status || 'enrolled')}>
                        {enrollment.status}
                      </Badge>
                    </TableCell>
                    <TableCell>{enrollment.score || '-'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
