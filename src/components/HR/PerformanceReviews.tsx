
import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Plus, Star, TrendingUp, Award } from "lucide-react";

export function PerformanceReviews() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState("");
  const [reviewPeriodStart, setReviewPeriodStart] = useState("");
  const [reviewPeriodEnd, setReviewPeriodEnd] = useState("");
  const [overallRating, setOverallRating] = useState("");
  const [technicalRating, setTechnicalRating] = useState("");
  const [communicationRating, setCommunicationRating] = useState("");
  const [teamworkRating, setTeamworkRating] = useState("");
  const [punctualityRating, setPunctualityRating] = useState("");
  const [goalsAchieved, setGoalsAchieved] = useState("");
  const [areasForImprovement, setAreasForImprovement] = useState("");
  const [feedback, setFeedback] = useState("");
  const [actionPlan, setActionPlan] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: employees } = useQuery({
    queryKey: ['employees-for-review'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('employees')
        .select('id, first_name, last_name, employee_code, position')
        .eq('status', 'active');
      
      if (error) throw error;
      return data || [];
    }
  });

  const { data: reviews, isLoading } = useQuery({
    queryKey: ['performance-reviews'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('performance_reviews')
        .select(`
          id,
          review_period_start,
          review_period_end,
          overall_rating,
          technical_skills_rating,
          communication_rating,
          teamwork_rating,
          punctuality_rating,
          created_at,
          employees!employee_id (
            id,
            first_name,
            last_name,
            employee_code,
            position
          )
        `)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data || [];
    }
  });

  const createReviewMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('performance_reviews')
        .insert([{
          employee_id: selectedEmployee,
          review_period_start: reviewPeriodStart,
          review_period_end: reviewPeriodEnd,
          overall_rating: overallRating as any,
          technical_skills_rating: technicalRating as any,
          communication_rating: communicationRating as any,
          teamwork_rating: teamworkRating as any,
          punctuality_rating: punctualityRating as any,
          goals_achieved: goalsAchieved,
          areas_for_improvement: areasForImprovement,
          feedback,
          action_plan: actionPlan,
        }]);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['performance-reviews'] });
      toast({ title: "Performance review created successfully" });
      setIsDialogOpen(false);
      resetForm();
    },
    onError: (error: any) => {
      toast({ title: "Error creating review", description: error.message, variant: "destructive" });
    }
  });

  const resetForm = () => {
    setSelectedEmployee("");
    setReviewPeriodStart("");
    setReviewPeriodEnd("");
    setOverallRating("");
    setTechnicalRating("");
    setCommunicationRating("");
    setTeamworkRating("");
    setPunctualityRating("");
    setGoalsAchieved("");
    setAreasForImprovement("");
    setFeedback("");
    setActionPlan("");
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEmployee || !reviewPeriodStart || !reviewPeriodEnd) {
      toast({ title: "Please fill all required fields", variant: "destructive" });
      return;
    }
    createReviewMutation.mutate();
  };

  const getRatingColor = (rating: string) => {
    switch (rating) {
      case 'excellent': return 'bg-green-500';
      case 'good': return 'bg-blue-500';
      case 'satisfactory': return 'bg-yellow-500';
      case 'needs_improvement': return 'bg-orange-500';
      case 'unsatisfactory': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  const ratingOptions = [
    { value: 'excellent', label: 'Excellent' },
    { value: 'good', label: 'Good' },
    { value: 'satisfactory', label: 'Satisfactory' },
    { value: 'needs_improvement', label: 'Needs Improvement' },
    { value: 'unsatisfactory', label: 'Unsatisfactory' }
  ];

  // Calculate performance statistics safely
  const avgRating = reviews && reviews.length > 0 ? reviews.reduce((sum, review) => {
    const ratings = [
      review.overall_rating,
      review.technical_skills_rating,
      review.communication_rating,
      review.teamwork_rating,
      review.punctuality_rating
    ].filter(Boolean);
    
    const numericRatings = ratings.map(rating => {
      switch (rating) {
        case 'excellent': return 5;
        case 'good': return 4;
        case 'satisfactory': return 3;
        case 'needs_improvement': return 2;
        case 'unsatisfactory': return 1;
        default: return 0;
      }
    });
    
    return sum + (numericRatings.reduce((a, b) => a + b, 0) / numericRatings.length);
  }, 0) / reviews.length : 0;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">Performance Reviews</h2>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Create Review
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create Performance Review</DialogTitle>
              <DialogDescription>
                Evaluate employee performance across different areas.
              </DialogDescription>
            </DialogHeader>
            
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                  <Label htmlFor="period-start">Review Period Start</Label>
                  <Input
                    id="period-start"
                    type="date"
                    value={reviewPeriodStart}
                    onChange={(e) => setReviewPeriodStart(e.target.value)}
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="period-end">Review Period End</Label>
                  <Input
                    id="period-end"
                    type="date"
                    value={reviewPeriodEnd}
                    onChange={(e) => setReviewPeriodEnd(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="text-lg font-medium">Performance Ratings</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {[
                    { label: 'Overall Rating', value: overallRating, setter: setOverallRating },
                    { label: 'Technical Skills', value: technicalRating, setter: setTechnicalRating },
                    { label: 'Communication', value: communicationRating, setter: setCommunicationRating },
                    { label: 'Teamwork', value: teamworkRating, setter: setTeamworkRating },
                    { label: 'Punctuality', value: punctualityRating, setter: setPunctualityRating }
                  ].map((rating, index) => (
                    <div key={index}>
                      <Label>{rating.label}</Label>
                      <Select value={rating.value} onValueChange={rating.setter}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select rating" />
                        </SelectTrigger>
                        <SelectContent>
                          {ratingOptions.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <Label htmlFor="goals">Goals Achieved</Label>
                  <Textarea
                    id="goals"
                    value={goalsAchieved}
                    onChange={(e) => setGoalsAchieved(e.target.value)}
                    rows={3}
                  />
                </div>

                <div>
                  <Label htmlFor="improvements">Areas for Improvement</Label>
                  <Textarea
                    id="improvements"
                    value={areasForImprovement}
                    onChange={(e) => setAreasForImprovement(e.target.value)}
                    rows={3}
                  />
                </div>

                <div>
                  <Label htmlFor="feedback">Feedback</Label>
                  <Textarea
                    id="feedback"
                    value={feedback}
                    onChange={(e) => setFeedback(e.target.value)}
                    rows={3}
                  />
                </div>

                <div>
                  <Label htmlFor="action-plan">Action Plan</Label>
                  <Textarea
                    id="action-plan"
                    value={actionPlan}
                    onChange={(e) => setActionPlan(e.target.value)}
                    rows={3}
                  />
                </div>
              </div>

              <DialogFooter>
                <Button type="submit" disabled={createReviewMutation.isPending}>
                  Create Review
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Star className="h-5 w-5 text-yellow-500" />
              Average Rating
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {avgRating.toFixed(1)}/5.0
            </div>
            <p className="text-sm text-gray-500">Overall performance</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-green-500" />
              Reviews Completed
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{reviews?.length || 0}</div>
            <p className="text-sm text-gray-500">This year</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Award className="h-5 w-5 text-blue-500" />
              Top Performers
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {reviews?.filter(r => r.overall_rating === 'excellent').length || 0}
            </div>
            <p className="text-sm text-gray-500">Excellent ratings</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Performance Review History</CardTitle>
          <CardDescription>Employee performance evaluations and feedback</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div>Loading performance reviews...</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>Position</TableHead>
                  <TableHead>Review Period</TableHead>
                  <TableHead>Overall Rating</TableHead>
                  <TableHead>Technical</TableHead>
                  <TableHead>Communication</TableHead>
                  <TableHead>Teamwork</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reviews?.map((review) => (
                  <TableRow key={review.id}>
                    <TableCell>
                      {review.employees?.employee_code} - {review.employees?.first_name} {review.employees?.last_name}
                    </TableCell>
                    <TableCell>{review.employees?.position}</TableCell>
                    <TableCell>
                      {new Date(review.review_period_start).toLocaleDateString()} - {' '}
                      {new Date(review.review_period_end).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      {review.overall_rating && (
                        <Badge className={getRatingColor(review.overall_rating)}>
                          {review.overall_rating.replace('_', ' ')}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {review.technical_skills_rating && (
                        <Badge className={getRatingColor(review.technical_skills_rating)} variant="outline">
                          {review.technical_skills_rating.replace('_', ' ')}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {review.communication_rating && (
                        <Badge className={getRatingColor(review.communication_rating)} variant="outline">
                          {review.communication_rating.replace('_', ' ')}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {review.teamwork_rating && (
                        <Badge className={getRatingColor(review.teamwork_rating)} variant="outline">
                          {review.teamwork_rating.replace('_', ' ')}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {review.created_at && new Date(review.created_at).toLocaleDateString()}
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
