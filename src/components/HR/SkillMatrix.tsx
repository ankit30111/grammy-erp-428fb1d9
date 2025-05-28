
import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Plus, Award } from "lucide-react";

export function SkillMatrix() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState("");
  const [selectedSkill, setSelectedSkill] = useState("");
  const [skillLevel, setSkillLevel] = useState("");
  const [certified, setCertified] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: employees } = useQuery({
    queryKey: ['employees-active'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('employees')
        .select('id, first_name, last_name, employee_code')
        .eq('status', 'active');
      
      if (error) throw error;
      return data;
    }
  });

  const { data: skills } = useQuery({
    queryKey: ['skills'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('skills')
        .select('*')
        .order('category', { ascending: true });
      
      if (error) throw error;
      return data;
    }
  });

  const { data: employeeSkills, isLoading } = useQuery({
    queryKey: ['employee-skills'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('employee_skills')
        .select(`
          *,
          employees:employee_id (first_name, last_name, employee_code),
          skills:skill_id (skill_name, category)
        `)
        .order('acquired_date', { ascending: false });
      
      if (error) throw error;
      return data;
    }
  });

  const addSkillMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('employee_skills')
        .insert([{
          employee_id: selectedEmployee,
          skill_id: selectedSkill,
          skill_level: skillLevel as any,
          certified,
        }]);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employee-skills'] });
      toast({ title: "Skill added successfully" });
      setIsDialogOpen(false);
      resetForm();
    },
    onError: (error) => {
      toast({ title: "Error adding skill", description: error.message, variant: "destructive" });
    }
  });

  const resetForm = () => {
    setSelectedEmployee("");
    setSelectedSkill("");
    setSkillLevel("");
    setCertified(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEmployee || !selectedSkill || !skillLevel) {
      toast({ title: "Please fill all required fields", variant: "destructive" });
      return;
    }
    addSkillMutation.mutate();
  };

  const getSkillLevelColor = (level: string) => {
    switch (level) {
      case 'expert': return 'bg-green-500';
      case 'advanced': return 'bg-blue-500';
      case 'intermediate': return 'bg-yellow-500';
      case 'beginner': return 'bg-gray-500';
      default: return 'bg-gray-400';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">Skills Matrix</h2>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add Skill
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Employee Skill</DialogTitle>
              <DialogDescription>
                Assign a skill to an employee and set their proficiency level.
              </DialogDescription>
            </DialogHeader>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="employee">Employee</Label>
                <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select employee" />
                  </SelectTrigger>
                  <SelectContent>
                    {employees?.map((employee) => (
                      <SelectItem key={employee.id} value={employee.id}>
                        {employee.employee_code} - {employee.first_name} {employee.last_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="skill">Skill</Label>
                <Select value={selectedSkill} onValueChange={setSelectedSkill}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select skill" />
                  </SelectTrigger>
                  <SelectContent>
                    {skills?.map((skill) => (
                      <SelectItem key={skill.id} value={skill.id}>
                        {skill.skill_name} ({skill.category})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="level">Skill Level</Label>
                <Select value={skillLevel} onValueChange={setSkillLevel}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select skill level" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="beginner">Beginner</SelectItem>
                    <SelectItem value="intermediate">Intermediate</SelectItem>
                    <SelectItem value="advanced">Advanced</SelectItem>
                    <SelectItem value="expert">Expert</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="certified"
                  checked={certified}
                  onChange={(e) => setCertified(e.target.checked)}
                  className="rounded"
                />
                <Label htmlFor="certified">Certified</Label>
              </div>

              <DialogFooter>
                <Button type="submit" disabled={addSkillMutation.isPending}>
                  Add Skill
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Employee Skills Overview</CardTitle>
          <CardDescription>Track employee skills and certifications</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div>Loading skills matrix...</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>Skill</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Level</TableHead>
                  <TableHead>Certified</TableHead>
                  <TableHead>Acquired Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {employeeSkills?.map((empSkill) => (
                  <TableRow key={empSkill.id}>
                    <TableCell>
                      {empSkill.employees?.employee_code} - {empSkill.employees?.first_name} {empSkill.employees?.last_name}
                    </TableCell>
                    <TableCell>{empSkill.skills?.skill_name}</TableCell>
                    <TableCell>{empSkill.skills?.category}</TableCell>
                    <TableCell>
                      <Badge className={getSkillLevelColor(empSkill.skill_level)}>
                        {empSkill.skill_level}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {empSkill.certified && <Award className="h-4 w-4 text-yellow-500" />}
                    </TableCell>
                    <TableCell>
                      {empSkill.acquired_date ? new Date(empSkill.acquired_date).toLocaleDateString() : '-'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
