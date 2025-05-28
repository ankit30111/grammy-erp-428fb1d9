
import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { GraduationCap, Star, Plus, Calendar } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export function TrainingSkillMatrix() {
  const skillMatrix = [
    {
      employee: "John Smith",
      position: "Senior Engineer",
      skills: {
        "Machine Operation": 5,
        "Quality Control": 4,
        "Safety Protocols": 5,
        "Leadership": 3,
        "Problem Solving": 4
      }
    },
    {
      employee: "Sarah Wilson",
      position: "QC Inspector",
      skills: {
        "Quality Control": 5,
        "Testing Procedures": 4,
        "Documentation": 5,
        "Problem Solving": 4,
        "Equipment Calibration": 3
      }
    }
  ];

  const trainingPrograms = [
    {
      id: "TR001",
      name: "Safety Training",
      duration: "2 days",
      status: "Active",
      enrolled: 15,
      completed: 12
    },
    {
      id: "TR002",
      name: "Quality Management",
      duration: "5 days",
      status: "Upcoming",
      enrolled: 8,
      completed: 0
    },
    {
      id: "TR003",
      name: "Leadership Development",
      duration: "3 days",
      status: "Completed",
      enrolled: 10,
      completed: 10
    }
  ];

  const renderStars = (rating: number) => {
    return Array.from({ length: 5 }, (_, i) => (
      <Star
        key={i}
        className={`h-4 w-4 ${i < rating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'}`}
      />
    ));
  };

  return (
    <div className="space-y-6">
      <Tabs defaultValue="skills" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="skills">Skill Matrix</TabsTrigger>
          <TabsTrigger value="training">Training Programs</TabsTrigger>
        </TabsList>

        <TabsContent value="skills" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Star className="h-5 w-5" />
                Employee Skill Matrix
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {skillMatrix.map((employee, index) => (
                  <div key={index} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h3 className="font-semibold">{employee.employee}</h3>
                        <p className="text-sm text-muted-foreground">{employee.position}</p>
                      </div>
                      <Button variant="outline" size="sm">
                        Update Skills
                      </Button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {Object.entries(employee.skills).map(([skill, rating]) => (
                        <div key={skill} className="flex items-center justify-between">
                          <span className="text-sm font-medium">{skill}</span>
                          <div className="flex items-center gap-1">
                            {renderStars(rating)}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="training" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <GraduationCap className="h-5 w-5" />
                  Training Programs
                </CardTitle>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Program
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Program ID</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Duration</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Enrolled</TableHead>
                    <TableHead>Completed</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {trainingPrograms.map((program) => (
                    <TableRow key={program.id}>
                      <TableCell className="font-medium">{program.id}</TableCell>
                      <TableCell>{program.name}</TableCell>
                      <TableCell>{program.duration}</TableCell>
                      <TableCell>
                        <Badge variant={
                          program.status === "Active" ? "default" :
                          program.status === "Upcoming" ? "secondary" : "outline"
                        }>
                          {program.status}
                        </Badge>
                      </TableCell>
                      <TableCell>{program.enrolled}</TableCell>
                      <TableCell>{program.completed}</TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          <Button variant="outline" size="sm">
                            <Calendar className="h-4 w-4 mr-1" />
                            Schedule
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
