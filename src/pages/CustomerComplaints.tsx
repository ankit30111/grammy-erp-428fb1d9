
import { useState } from "react";
import { DashboardLayout } from "@/components/Layout/DashboardLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import BatchReceiptEntry from "@/components/quality/BatchReceiptEntry";
import IndividualComplaintsManagement from "@/components/quality/IndividualComplaintsManagement";
import { Receipt, FileSearch } from "lucide-react";

const CustomerComplaints = () => {
  const [activeTab, setActiveTab] = useState("receipt");

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Customer Complaints</h1>
            <p className="text-muted-foreground">
              Manage customer complaint receipts and individual complaint processing
            </p>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="receipt" className="flex items-center gap-2">
              <Receipt className="h-4 w-4" />
              Receipt Entry
            </TabsTrigger>
            <TabsTrigger value="management" className="flex items-center gap-2">
              <FileSearch className="h-4 w-4" />
              Individual Complaints
            </TabsTrigger>
          </TabsList>

          <TabsContent value="receipt" className="space-y-6">
            <BatchReceiptEntry />
          </TabsContent>

          <TabsContent value="management" className="space-y-6">
            <IndividualComplaintsManagement />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

export default CustomerComplaints;
