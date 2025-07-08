import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { format } from 'date-fns';

export interface PDFGenerationOptions {
  filename?: string;
  title?: string;
  orientation?: 'portrait' | 'landscape';
  format?: 'a4' | 'letter';
}

export class PDFGenerator {
  private pdf: jsPDF;
  private pageWidth: number;
  private pageHeight: number;
  private margin: number = 20;
  private currentY: number = 20;

  constructor(options: PDFGenerationOptions = {}) {
    this.pdf = new jsPDF({
      orientation: options.orientation || 'portrait',
      unit: 'mm',
      format: options.format || 'a4'
    });
    
    this.pageWidth = this.pdf.internal.pageSize.getWidth();
    this.pageHeight = this.pdf.internal.pageSize.getHeight();
  }

  // Add company header
  addCompanyHeader(companyName: string = "Grammy Electronics") {
    // Company logo area (placeholder)
    this.pdf.setFillColor(240, 240, 240);
    this.pdf.rect(this.margin, this.currentY, 40, 20, 'F');
    
    // Company name
    this.pdf.setFontSize(20);
    this.pdf.setFont('helvetica', 'bold');
    this.pdf.text(companyName, this.margin + 45, this.currentY + 8);
    
    // Subtitle
    this.pdf.setFontSize(10);
    this.pdf.setFont('helvetica', 'normal');
    this.pdf.text('Manufacturing Management System', this.margin + 45, this.currentY + 15);
    
    this.currentY += 30;
    this.addLine();
  }

  // Add document title
  addDocumentTitle(title: string, documentNumber?: string) {
    this.pdf.setFontSize(16);
    this.pdf.setFont('helvetica', 'bold');
    this.pdf.text(title, this.margin, this.currentY);
    
    if (documentNumber) {
      const titleWidth = this.pdf.getTextWidth(title);
      this.pdf.setFontSize(12);
      this.pdf.setFont('helvetica', 'normal');
      this.pdf.text(`#${documentNumber}`, this.margin + titleWidth + 10, this.currentY);
    }
    
    // Date
    this.pdf.setFontSize(10);
    this.pdf.setFont('helvetica', 'normal');
    const dateText = `Generated: ${format(new Date(), 'dd/MM/yyyy HH:mm')}`;
    const dateWidth = this.pdf.getTextWidth(dateText);
    this.pdf.text(dateText, this.pageWidth - this.margin - dateWidth, this.currentY);
    
    this.currentY += 15;
    this.addLine();
  }

  // Add section header
  addSectionHeader(title: string) {
    this.currentY += 5;
    this.pdf.setFontSize(12);
    this.pdf.setFont('helvetica', 'bold');
    this.pdf.text(title, this.margin, this.currentY);
    this.currentY += 8;
  }

  // Add key-value pairs
  addKeyValuePairs(data: Array<{ label: string; value: string }>, columns: number = 2) {
    const columnWidth = (this.pageWidth - 2 * this.margin) / columns;
    let currentColumn = 0;
    const startY = this.currentY;

    this.pdf.setFontSize(9);
    
    data.forEach((item, index) => {
      const x = this.margin + (currentColumn * columnWidth);
      const y = startY + Math.floor(index / columns) * 12;
      
      // Label
      this.pdf.setFont('helvetica', 'bold');
      this.pdf.text(`${item.label}:`, x, y);
      
      // Value
      this.pdf.setFont('helvetica', 'normal');
      const labelWidth = this.pdf.getTextWidth(`${item.label}:`);
      this.pdf.text(item.value, x + labelWidth + 3, y);
      
      currentColumn = (currentColumn + 1) % columns;
    });
    
    this.currentY = startY + Math.ceil(data.length / columns) * 12 + 5;
  }

  // Add table
  addTable(headers: string[], rows: string[][], options: {
    headerBg?: [number, number, number];
    cellPadding?: number;
    fontSize?: number;
  } = {}) {
    const {
      headerBg = [52, 73, 94],
      cellPadding = 3,
      fontSize = 8
    } = options;

    const tableWidth = this.pageWidth - 2 * this.margin;
    const columnWidth = tableWidth / headers.length;
    const rowHeight = 8;

    this.pdf.setFontSize(fontSize);
    
    // Check if table fits on current page
    const tableHeight = (rows.length + 1) * rowHeight;
    if (this.currentY + tableHeight > this.pageHeight - this.margin) {
      this.addPage();
    }

    // Headers
    this.pdf.setFillColor(...headerBg);
    this.pdf.rect(this.margin, this.currentY, tableWidth, rowHeight, 'F');
    
    this.pdf.setTextColor(255, 255, 255);
    this.pdf.setFont('helvetica', 'bold');
    
    headers.forEach((header, index) => {
      const x = this.margin + (index * columnWidth) + cellPadding;
      this.pdf.text(header, x, this.currentY + 5);
    });
    
    this.currentY += rowHeight;
    
    // Rows
    this.pdf.setTextColor(0, 0, 0);
    this.pdf.setFont('helvetica', 'normal');
    
    rows.forEach((row, rowIndex) => {
      // Alternate row colors
      if (rowIndex % 2 === 0) {
        this.pdf.setFillColor(249, 249, 249);
        this.pdf.rect(this.margin, this.currentY, tableWidth, rowHeight, 'F');
      }
      
      row.forEach((cell, cellIndex) => {
        const x = this.margin + (cellIndex * columnWidth) + cellPadding;
        this.pdf.text(cell.toString(), x, this.currentY + 5);
      });
      
      this.currentY += rowHeight;
    });
    
    // Table border
    this.pdf.setDrawColor(200, 200, 200);
    this.pdf.rect(this.margin, this.currentY - (rows.length + 1) * rowHeight, tableWidth, (rows.length + 1) * rowHeight);
    
    // Column dividers
    for (let i = 1; i < headers.length; i++) {
      const x = this.margin + (i * columnWidth);
      this.pdf.line(x, this.currentY - (rows.length + 1) * rowHeight, x, this.currentY);
    }
    
    this.currentY += 10;
  }

  // Add line separator
  addLine() {
    this.pdf.setDrawColor(200, 200, 200);
    this.pdf.line(this.margin, this.currentY, this.pageWidth - this.margin, this.currentY);
    this.currentY += 5;
  }

  // Add new page
  addPage() {
    this.pdf.addPage();
    this.currentY = 20;
  }

  // Add footer
  addFooter(text: string = '') {
    const footerY = this.pageHeight - 15;
    
    this.pdf.setFontSize(8);
    this.pdf.setFont('helvetica', 'normal');
    this.pdf.setTextColor(128, 128, 128);
    
    // Page number
    const pageNum = `Page ${this.pdf.getCurrentPageInfo().pageNumber}`;
    const pageNumWidth = this.pdf.getTextWidth(pageNum);
    this.pdf.text(pageNum, this.pageWidth - this.margin - pageNumWidth, footerY);
    
    // Footer text
    if (text) {
      this.pdf.text(text, this.margin, footerY);
    }
    
    // Footer line
    this.pdf.setDrawColor(200, 200, 200);
    this.pdf.line(this.margin, footerY - 5, this.pageWidth - this.margin, footerY - 5);
  }

  // Save PDF
  save(filename: string) {
    this.pdf.save(filename);
  }

  // Get PDF as blob
  getBlob(): Blob {
    return this.pdf.output('blob');
  }

  // Get PDF as data URL
  getDataURL(): string {
    return this.pdf.output('dataurlstring');
  }
}

// Utility function to generate PDF from HTML element
export const generatePDFFromHTML = async (
  element: HTMLElement,
  options: PDFGenerationOptions = {}
): Promise<jsPDF> => {
  const canvas = await html2canvas(element, {
    scale: 2,
    useCORS: true,
    allowTaint: true
  });

  const imgData = canvas.toDataURL('image/png');
  const pdf = new jsPDF({
    orientation: options.orientation || 'portrait',
    unit: 'mm',
    format: options.format || 'a4'
  });

  const imgWidth = pdf.internal.pageSize.getWidth();
  const imgHeight = (canvas.height * imgWidth) / canvas.width;
  
  pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight);
  
  return pdf;
};

// Utility function to download PDF
export const downloadPDF = (pdf: jsPDF, filename: string) => {
  pdf.save(filename);
};