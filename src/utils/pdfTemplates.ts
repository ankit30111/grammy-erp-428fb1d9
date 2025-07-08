import { PDFGenerator } from './pdfGenerator';
import { format } from 'date-fns';

export interface ProductionVoucherData {
  voucherNumber: string;
  productName: string;
  productionQuantity: number;
  scheduledDate: string;
  materials: Array<{
    materialCode: string;
    materialName: string;
    category: string;
    requiredQuantity: number;
    dispatchedQuantity: number;
    currentStock: number;
    bomType: string;
  }>;
  dispatchedBy?: string;
  dispatchedAt: string;
}

export interface PurchaseOrderData {
  poNumber: string;
  vendorName: string;
  vendorAddress: string;
  vendorContact: string;
  expectedDeliveryDate: string;
  items: Array<{
    materialCode: string;
    materialName: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
  }>;
  totalAmount: number;
  notes?: string;
  createdBy?: string;
  createdAt: string;
}

export const generateProductionVoucherPDF = (data: ProductionVoucherData): PDFGenerator => {
  const pdf = new PDFGenerator();
  
  // Header
  pdf.addCompanyHeader();
  
  // Document title
  pdf.addDocumentTitle('Production Material Dispatch Voucher', data.voucherNumber);
  
  // Production details
  pdf.addSectionHeader('Production Order Details');
  pdf.addKeyValuePairs([
    { label: 'Voucher Number', value: data.voucherNumber },
    { label: 'Product Name', value: data.productName },
    { label: 'Production Quantity', value: data.productionQuantity.toString() },
    { label: 'Scheduled Date', value: format(new Date(data.scheduledDate), 'dd/MM/yyyy') },
    { label: 'Dispatched By', value: data.dispatchedBy || 'Store Department' },
    { label: 'Dispatch Date & Time', value: format(new Date(data.dispatchedAt), 'dd/MM/yyyy HH:mm') }
  ], 2);
  
  // Group materials by BOM type
  const groupedMaterials = data.materials.reduce((acc, material) => {
    const bomType = material.bomType || 'main_assembly';
    const displayType = bomType === 'sub_assembly' ? 'Sub Assembly' : 
                       bomType === 'main_assembly' ? 'Main Assembly' : 'Accessory';
    
    if (!acc[displayType]) {
      acc[displayType] = [];
    }
    acc[displayType].push(material);
    return acc;
  }, {} as Record<string, typeof data.materials>);
  
  // Materials table for each category
  Object.entries(groupedMaterials).forEach(([categoryName, materials]) => {
    pdf.addSectionHeader(`${categoryName} Materials`);
    
    const headers = [
      'Material Code',
      'Material Name', 
      'Category',
      'Required Qty',
      'Dispatched Qty',
      'Current Stock',
      'Status'
    ];
    
    const rows = materials.map(material => [
      material.materialCode,
      material.materialName.length > 25 ? material.materialName.substring(0, 25) + '...' : material.materialName,
      material.category,
      material.requiredQuantity.toString(),
      material.dispatchedQuantity.toString(),
      material.currentStock.toString(),
      material.dispatchedQuantity >= material.requiredQuantity ? 'Complete' : 'Partial'
    ]);
    
    pdf.addTable(headers, rows, { fontSize: 7 });
  });
  
  // Summary section
  pdf.addSectionHeader('Dispatch Summary');
  const totalMaterials = data.materials.length;
  const completeMaterials = data.materials.filter(m => m.dispatchedQuantity >= m.requiredQuantity).length;
  const totalDispatched = data.materials.reduce((sum, m) => sum + m.dispatchedQuantity, 0);
  
  pdf.addKeyValuePairs([
    { label: 'Total Materials', value: totalMaterials.toString() },
    { label: 'Complete Dispatches', value: completeMaterials.toString() },
    { label: 'Partial Dispatches', value: (totalMaterials - completeMaterials).toString() },
    { label: 'Total Quantity Dispatched', value: totalDispatched.toString() }
  ], 2);
  
  // Terms and conditions
  pdf.addSectionHeader('Terms & Conditions');
  const terms = [
    '1. All materials are dispatched as per BOM requirements and production schedule.',
    '2. Production department must verify received quantities and report any discrepancies immediately.',
    '3. Materials are to be used only for the specified production order.',
    '4. Any unused materials must be returned to store with proper documentation.',
    '5. This voucher serves as authorization for material usage in production.'
  ];
  
  terms.forEach(term => {
    pdf.addKeyValuePairs([{ label: '', value: term }], 1);
  });
  
  // Signatures
  pdf.addSectionHeader('Authorizations');
  pdf.addKeyValuePairs([
    { label: 'Store Authorized By', value: '_________________________' },
    { label: 'Production Received By', value: '_________________________' },
    { label: 'Date', value: '_________________________' },
    { label: 'Signature', value: '_________________________' }
  ], 2);
  
  // Footer
  pdf.addFooter('Grammy Electronics - Production Material Dispatch Voucher');
  
  return pdf;
};

export const generatePurchaseOrderPDF = (data: PurchaseOrderData): PDFGenerator => {
  const pdf = new PDFGenerator();
  
  // Header
  pdf.addCompanyHeader();
  
  // Document title
  pdf.addDocumentTitle('Purchase Order', data.poNumber);
  
  // Vendor details
  pdf.addSectionHeader('Vendor Information');
  pdf.addKeyValuePairs([
    { label: 'Vendor Name', value: data.vendorName },
    { label: 'Address', value: data.vendorAddress },
    { label: 'Contact', value: data.vendorContact },
    { label: 'Expected Delivery', value: format(new Date(data.expectedDeliveryDate), 'dd/MM/yyyy') }
  ], 2);
  
  // Order details
  pdf.addSectionHeader('Order Information');
  pdf.addKeyValuePairs([
    { label: 'PO Number', value: data.poNumber },
    { label: 'Order Date', value: format(new Date(data.createdAt), 'dd/MM/yyyy') },
    { label: 'Created By', value: data.createdBy || 'Purchase Department' },
    { label: 'Total Amount', value: `₹ ${data.totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` }
  ], 2);
  
  // Items table
  pdf.addSectionHeader('Purchase Order Items');
  
  const headers = [
    'S.No',
    'Material Code',
    'Material Name',
    'Quantity',
    'Unit Price (₹)',
    'Total Price (₹)'
  ];
  
  const rows = data.items.map((item, index) => [
    (index + 1).toString(),
    item.materialCode,
    item.materialName.length > 30 ? item.materialName.substring(0, 30) + '...' : item.materialName,
    item.quantity.toString(),
    item.unitPrice.toLocaleString('en-IN', { minimumFractionDigits: 2 }),
    item.totalPrice.toLocaleString('en-IN', { minimumFractionDigits: 2 })
  ]);
  
  pdf.addTable(headers, rows, { fontSize: 8 });
  
  // Total summary
  pdf.addSectionHeader('Order Summary');
  const subtotal = data.totalAmount;
  const gst = subtotal * 0.18; // 18% GST
  const grandTotal = subtotal + gst;
  
  pdf.addKeyValuePairs([
    { label: 'Subtotal', value: `₹ ${subtotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` },
    { label: 'GST (18%)', value: `₹ ${gst.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` },
    { label: 'Grand Total', value: `₹ ${grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` }
  ], 2);
  
  // Notes
  if (data.notes) {
    pdf.addSectionHeader('Special Instructions');
    pdf.addKeyValuePairs([{ label: '', value: data.notes }], 1);
  }
  
  // Terms and conditions
  pdf.addSectionHeader('Terms & Conditions');
  const terms = [
    '1. Please quote your best prices including all taxes and delivery charges.',
    '2. Delivery should be made as per the scheduled date mentioned above.',
    '3. All materials should be accompanied by proper quality certificates.',
    '4. Payment terms: 30 days from receipt of materials and invoice.',
    '5. Any deviation from specifications should be intimated immediately.',
    '6. This purchase order is subject to our standard terms and conditions.'
  ];
  
  terms.forEach(term => {
    pdf.addKeyValuePairs([{ label: '', value: term }], 1);
  });
  
  // Signatures
  pdf.addSectionHeader('Authorizations');
  pdf.addKeyValuePairs([
    { label: 'Prepared By', value: '_________________________' },
    { label: 'Approved By', value: '_________________________' },
    { label: 'Purchase Manager', value: '_________________________' },
    { label: 'Date', value: '_________________________' }
  ], 2);
  
  // Footer
  pdf.addFooter('Grammy Electronics - Purchase Order');
  
  return pdf;
};

// Utility functions for filename generation
export const generateProductionVoucherFilename = (voucherNumber: string): string => {
  const timestamp = format(new Date(), 'yyyyMMdd_HHmm');
  return `Production_Voucher_${voucherNumber}_${timestamp}.pdf`;
};

export const generatePurchaseOrderFilename = (poNumber: string): string => {
  const timestamp = format(new Date(), 'yyyyMMdd_HHmm');
  return `Purchase_Order_${poNumber}_${timestamp}.pdf`;
};