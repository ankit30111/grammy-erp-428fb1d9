import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { MessageSquare, Plus, User, Calendar } from 'lucide-react';
import { format } from 'date-fns';

interface CollaborationPanelProps {
  bomId: string;
}

const COMMENT_TYPES = [
  { value: 'GENERAL', label: 'General Comment', color: 'bg-gray-100 text-gray-800' },
  { value: 'RND_NOTE', label: 'R&D Note', color: 'bg-blue-100 text-blue-800' },
  { value: 'IQC_FEEDBACK', label: 'IQC Feedback', color: 'bg-green-100 text-green-800' },
  { value: 'PURCHASE_NOTE', label: 'Purchase Note', color: 'bg-purple-100 text-purple-800' },
  { value: 'VENDOR_COMMUNICATION', label: 'Vendor Communication', color: 'bg-orange-100 text-orange-800' }
];

export const CollaborationPanel: React.FC<CollaborationPanelProps> = ({ bomId }) => {
  const [selectedMaterialId, setSelectedMaterialId] = useState<string>('');
  const [newComment, setNewComment] = useState({
    comment_text: '',
    comment_type: 'GENERAL',
    department: ''
  });
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch BOM materials for selection
  const { data: bomMaterials = [] } = useQuery({
    queryKey: ['npd-bom-materials-collaboration', bomId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('npd_bom_materials')
        .select('id, material_name, temporary_part_code, material_code')
        .eq('npd_project_bom_id', bomId)
        .order('material_name');

      if (error) throw error;
      return data || [];
    },
    enabled: !!bomId
  });

  // Fetch comments for selected material
  const { data: comments = [] } = useQuery({
    queryKey: ['npd-bom-comments', selectedMaterialId],
    queryFn: async () => {
      if (!selectedMaterialId) return [];
      
      const { data, error } = await supabase
        .from('npd_bom_comments')
        .select('*')
        .eq('npd_bom_material_id', selectedMaterialId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    },
    enabled: !!selectedMaterialId
  });

  // Add comment mutation
  const addCommentMutation = useMutation({
    mutationFn: async (commentData: any) => {
      const { error } = await supabase
        .from('npd_bom_comments')
        .insert({
          npd_bom_material_id: selectedMaterialId,
          comment_text: commentData.comment_text,
          comment_type: commentData.comment_type,
          department: commentData.department,
          created_by: (await supabase.auth.getUser()).data.user?.id
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['npd-bom-comments', selectedMaterialId] });
      toast({ title: "Comment added successfully" });
      setNewComment({
        comment_text: '',
        comment_type: 'GENERAL',
        department: ''
      });
    },
    onError: (error) => {
      toast({ title: "Error adding comment", description: error.message, variant: "destructive" });
    }
  });

  const handleAddComment = () => {
    if (!selectedMaterialId || !newComment.comment_text.trim()) {
      toast({ title: "Please select a material and enter a comment", variant: "destructive" });
      return;
    }

    addCommentMutation.mutate(newComment);
  };

  const getCommentTypeInfo = (type: string) => {
    return COMMENT_TYPES.find(t => t.value === type) || COMMENT_TYPES[0];
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Multi-Department Collaboration
          </CardTitle>
          <CardDescription>
            Communicate with R&D, IQC, Purchase, and other departments about BOM materials
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="material-select">Select Material</Label>
            <Select value={selectedMaterialId} onValueChange={setSelectedMaterialId}>
              <SelectTrigger>
                <SelectValue placeholder="Choose a material to comment on" />
              </SelectTrigger>
              <SelectContent>
                {bomMaterials.map((material) => (
                  <SelectItem key={material.id} value={material.id}>
                    {material.material_name} ({material.temporary_part_code || material.material_code})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedMaterialId && (
            <div className="space-y-4 p-4 border rounded-lg">
              <h4 className="font-medium">Add New Comment</h4>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="comment-type">Comment Type</Label>
                  <Select
                    value={newComment.comment_type}
                    onValueChange={(value) => setNewComment({ ...newComment, comment_type: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {COMMENT_TYPES.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="department">Department (Optional)</Label>
                  <Select
                    value={newComment.department}
                    onValueChange={(value) => setNewComment({ ...newComment, department: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select department" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="RND">R&D</SelectItem>
                      <SelectItem value="IQC">IQC</SelectItem>
                      <SelectItem value="PURCHASE">Purchase</SelectItem>
                      <SelectItem value="QUALITY">Quality</SelectItem>
                      <SelectItem value="PRODUCTION">Production</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label htmlFor="comment-text">Comment</Label>
                <Textarea
                  id="comment-text"
                  value={newComment.comment_text}
                  onChange={(e) => setNewComment({ ...newComment, comment_text: e.target.value })}
                  placeholder="Enter your comment or feedback..."
                  rows={3}
                />
              </div>

              <Button 
                onClick={handleAddComment}
                disabled={!newComment.comment_text.trim() || addCommentMutation.isPending}
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Comment
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {selectedMaterialId && (
        <Card>
          <CardHeader>
            <CardTitle>Comments & Discussions</CardTitle>
            <CardDescription>
              {bomMaterials.find(m => m.id === selectedMaterialId)?.material_name}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {comments.map((comment) => {
                const typeInfo = getCommentTypeInfo(comment.comment_type);
                
                return (
                  <div key={comment.id} className="p-4 border rounded-lg space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback>
                            <User className="h-4 w-4" />
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex items-center gap-2">
                          <Badge className={typeInfo.color}>
                            {typeInfo.label}
                          </Badge>
                          {comment.department && (
                            <Badge variant="outline">
                              {comment.department}
                            </Badge>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 text-sm text-muted-foreground">
                        <Calendar className="h-4 w-4" />
                        {format(new Date(comment.created_at), 'MMM dd, yyyy HH:mm')}
                      </div>
                    </div>
                    
                    <p className="text-sm">{comment.comment_text}</p>
                  </div>
                );
              })}

              {comments.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  No comments yet. Be the first to add feedback!
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};