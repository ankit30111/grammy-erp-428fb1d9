
import { useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { projections } from "@/types/ppc";

interface UnscheduledProjectionsProps {
  getUnscheduledProjections: () => typeof projections;
  onScheduleClick: (projectionId: string) => void;
}

const UnscheduledProjections = ({ 
  getUnscheduledProjections, 
  onScheduleClick 
}: UnscheduledProjectionsProps) => {
  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle>Unscheduled Projections</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ID</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Product</TableHead>
              <TableHead>Quantity</TableHead>
              <TableHead>Due Date</TableHead>
              <TableHead>Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {getUnscheduledProjections().length > 0 ? (
              getUnscheduledProjections().map((proj) => (
                <TableRow key={proj.id}>
                  <TableCell className="font-medium">{proj.id}</TableCell>
                  <TableCell>{proj.customer}</TableCell>
                  <TableCell>{proj.product}</TableCell>
                  <TableCell>{proj.quantity}</TableCell>
                  <TableCell>{new Date(proj.dueDate).toLocaleDateString()}</TableCell>
                  <TableCell>
                    <Button 
                      size="sm" 
                      onClick={() => onScheduleClick(proj.id)}
                      variant="outline"
                    >
                      Schedule
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-4 text-muted-foreground">
                  All projections have been scheduled
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
};

export default UnscheduledProjections;
