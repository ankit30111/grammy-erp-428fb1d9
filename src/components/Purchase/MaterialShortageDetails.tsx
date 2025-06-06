
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Package, TrendingUp, AlertTriangle } from "lucide-react";

interface MaterialShortageDetailsProps {
  isOpen: boolean;
  onClose: () => void;
  materialData: {
    material_code: string;
    material_name: string;
    total_required: number;
    available_quantity: number;
    shortage_quantity: number;
    projection_details: Array<{
      projection_id: string;
      product_name: string;
      customer_name: string;
      projection_quantity: number;
      required_quantity: number;
      delivery_month: string;
    }>;
  } | null;
}

const MaterialShortageDetails = ({ isOpen, onClose, materialData }: MaterialShortageDetailsProps) => {
  if (!materialData) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Material Shortage Details - {materialData.material_code}
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-blue-600" />
                <div>
                  <div className="text-sm text-blue-600 font-medium">Current Stock</div>
                  <div className="text-lg font-bold text-blue-800">{materialData.available_quantity}</div>
                </div>
              </div>
            </div>
            
            <div className="bg-orange-50 p-4 rounded-lg border border-orange-200">
              <div className="flex items-center gap-2">
                <Package className="h-4 w-4 text-orange-600" />
                <div>
                  <div className="text-sm text-orange-600 font-medium">Total Required</div>
                  <div className="text-lg font-bold text-orange-800">{materialData.total_required}</div>
                </div>
              </div>
            </div>
            
            <div className="bg-red-50 p-4 rounded-lg border border-red-200">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-red-600" />
                <div>
                  <div className="text-sm text-red-600 font-medium">Net Shortage</div>
                  <div className="text-lg font-bold text-red-800">{materialData.shortage_quantity}</div>
                </div>
              </div>
            </div>
            
            <div className="bg-green-50 p-4 rounded-lg border border-green-200">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-green-600" />
                <div>
                  <div className="text-sm text-green-600 font-medium">Projections</div>
                  <div className="text-lg font-bold text-green-800">{materialData.projection_details.length}</div>
                </div>
              </div>
            </div>
          </div>

          {/* Material Info */}
          <div className="bg-gray-50 p-4 rounded-lg">
            <h3 className="font-medium mb-2">Material Information</h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div><strong>Part Code:</strong> {materialData.material_code}</div>
              <div><strong>Part Name:</strong> {materialData.material_name}</div>
            </div>
          </div>

          {/* Projection Details */}
          <div>
            <h3 className="font-medium mb-4">Projection Requirements</h3>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Customer</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead>Projection Qty</TableHead>
                  <TableHead>Required for this Part</TableHead>
                  <TableHead>Delivery Month</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {materialData.projection_details.map((projection, index) => (
                  <TableRow key={index}>
                    <TableCell>{projection.customer_name}</TableCell>
                    <TableCell>{projection.product_name}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{projection.projection_quantity}</Badge>
                    </TableCell>
                    <TableCell className="font-medium">{projection.required_quantity}</TableCell>
                    <TableCell>{projection.delivery_month}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Summary */}
          <div className="bg-amber-50 p-4 rounded-lg border border-amber-200">
            <h4 className="font-medium text-amber-800 mb-2">Summary</h4>
            <div className="text-sm text-amber-700 space-y-1">
              <div>• Cumulative quantity required: <strong>{materialData.total_required}</strong></div>
              <div>• Available in stock: <strong>{materialData.available_quantity}</strong></div>
              <div>• Net shortage: <strong className="text-red-600">{materialData.shortage_quantity}</strong></div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default MaterialShortageDetails;
