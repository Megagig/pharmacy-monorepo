/**
 * Document generation utilities for referral documents
 */
import jsPDF from 'jspdf';

export interface ReferralDocumentData {
  content: string;
  caseId: string;
  patientName?: string;
  pharmacistName?: string;
  generatedAt?: Date;
}

/**
 * Generate a downloadable text file
 */
export const generateTextDocument = (data: ReferralDocumentData): Blob => {
  const formattedContent = `MEDICAL REFERRAL DOCUMENT
${'='.repeat(60)}

Case ID: ${data.caseId}
Patient: ${data.patientName || 'N/A'}
Pharmacist: ${data.pharmacistName || 'N/A'}
Generated: ${(data.generatedAt || new Date()).toLocaleString()}

${'='.repeat(60)}

${data.content}

${'='.repeat(60)}
End of Document

This referral was generated with AI assistance and reviewed by a licensed pharmacist.
For questions, please contact the referring pharmacy.
`;

  return new Blob([formattedContent], { type: 'text/plain;charset=utf-8' });
};

/**
 * Generate a simple RTF document (can be opened by Word)
 */
export const generateRTFDocument = (data: ReferralDocumentData): Blob => {
  const rtfContent = `{\\rtf1\\ansi\\deff0 
{\\fonttbl {\\f0 Times New Roman;}{\\f1 Arial;}}
{\\colortbl;\\red0\\green0\\blue0;\\red0\\green0\\blue255;}
\\f0\\fs28\\b MEDICAL REFERRAL DOCUMENT\\b0\\par
\\par
\\f1\\fs20 Case ID: ${data.caseId}\\par
Patient: ${data.patientName || 'N/A'}\\par
Pharmacist: ${data.pharmacistName || 'N/A'}\\par
Generated: ${(data.generatedAt || new Date()).toLocaleString()}\\par
\\par
\\line\\par
\\f0\\fs22 ${data.content.replace(/\n/g, '\\par ')}\\par
\\par
\\line\\par
\\f1\\fs18\\i This referral was generated with AI assistance and reviewed by a licensed pharmacist.\\i0\\par
}`;

  return new Blob([rtfContent], { type: 'application/rtf' });
};

/**
 * Generate an HTML document (can be printed or converted to PDF)
 */
export const generateHTMLDocument = (data: ReferralDocumentData): Blob => {
  const htmlContent = `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Medical Referral - ${data.caseId}</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 40px; line-height: 1.6; }
        .header { text-align: center; border-bottom: 2px solid #333; padding-bottom: 20px; margin-bottom: 30px; }
        .info-section { background: #f5f5f5; padding: 15px; margin: 20px 0; border-radius: 5px; }
        .content { white-space: pre-wrap; margin: 20px 0; }
        .footer { border-top: 1px solid #ccc; padding-top: 20px; margin-top: 30px; font-size: 12px; color: #666; }
        @media print { body { margin: 20px; } }
    </style>
</head>
<body>
    <div class="header">
        <h1>MEDICAL REFERRAL DOCUMENT</h1>
    </div>
    
    <div class="info-section">
        <strong>Case ID:</strong> ${data.caseId}<br>
        <strong>Patient:</strong> ${data.patientName || 'N/A'}<br>
        <strong>Pharmacist:</strong> ${data.pharmacistName || 'N/A'}<br>
        <strong>Generated:</strong> ${(data.generatedAt || new Date()).toLocaleString()}
    </div>
    
    <div class="content">
${data.content}
    </div>
    
    <div class="footer">
        <p><em>This referral was generated with AI assistance and reviewed by a licensed pharmacist.</em></p>
        <p>For questions, please contact the referring pharmacy.</p>
    </div>
</body>
</html>`;

  return new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
};

/**
 * Generate a proper PDF document using jsPDF
 */
export const generatePDFDocument = (data: ReferralDocumentData): Blob => {
  const doc = new jsPDF();
  
  // Set up document properties
  doc.setProperties({
    title: `Medical Referral - ${data.caseId}`,
    subject: 'Medical Referral Document',
    author: 'PharmacyCopilot System',
    creator: 'PharmacyCopilot SaaS Platform'
  });
  
  // Header
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('MEDICAL REFERRAL DOCUMENT', 105, 20, { align: 'center' });
  
  // Draw header line
  doc.setLineWidth(0.5);
  doc.line(20, 25, 190, 25);
  
  // Document info section
  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  
  let yPosition = 40;
  const leftMargin = 20;
  const lineHeight = 7;
  
  // Info box background
  doc.setFillColor(245, 245, 245);
  doc.rect(leftMargin, yPosition - 5, 170, 35, 'F');
  
  doc.setFont('helvetica', 'bold');
  doc.text('Case ID:', leftMargin + 5, yPosition);
  doc.setFont('helvetica', 'normal');
  doc.text(data.caseId, leftMargin + 30, yPosition);
  
  yPosition += lineHeight;
  doc.setFont('helvetica', 'bold');
  doc.text('Patient:', leftMargin + 5, yPosition);
  doc.setFont('helvetica', 'normal');
  doc.text(data.patientName || 'N/A', leftMargin + 30, yPosition);
  
  yPosition += lineHeight;
  doc.setFont('helvetica', 'bold');
  doc.text('Pharmacist:', leftMargin + 5, yPosition);
  doc.setFont('helvetica', 'normal');
  doc.text(data.pharmacistName || 'N/A', leftMargin + 30, yPosition);
  
  yPosition += lineHeight;
  doc.setFont('helvetica', 'bold');
  doc.text('Generated:', leftMargin + 5, yPosition);
  doc.setFont('helvetica', 'normal');
  doc.text((data.generatedAt || new Date()).toLocaleString(), leftMargin + 30, yPosition);
  
  // Content section
  yPosition += 20;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text('Referral Content:', leftMargin, yPosition);
  
  yPosition += 10;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  
  // Split content into lines that fit the page width
  const pageWidth = 170; // Available width for text
  const contentLines = doc.splitTextToSize(data.content, pageWidth);
  
  // Add content with page breaks if needed
  for (let i = 0; i < contentLines.length; i++) {
    if (yPosition > 270) { // Near bottom of page
      doc.addPage();
      yPosition = 20;
    }
    doc.text(contentLines[i], leftMargin, yPosition);
    yPosition += 5;
  }
  
  // Footer
  if (yPosition > 250) {
    doc.addPage();
    yPosition = 20;
  }
  
  yPosition += 15;
  doc.setLineWidth(0.3);
  doc.line(leftMargin, yPosition, 190, yPosition);
  
  yPosition += 10;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'italic');
  doc.text('This referral was generated with AI assistance and reviewed by a licensed pharmacist.', leftMargin, yPosition);
  
  yPosition += 5;
  doc.text('For questions, please contact the referring pharmacy.', leftMargin, yPosition);
  
  // Add page numbers if multiple pages
  const pageCount = doc.getNumberOfPages();
  if (pageCount > 1) {
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.text(`Page ${i} of ${pageCount}`, 190, 285, { align: 'right' });
    }
  }
  
  // Convert to blob
  const pdfBlob = doc.output('blob');
  return pdfBlob;
};

/**
 * Download a document with the specified format
 */
export const downloadDocument = (
  blob: Blob, 
  filename: string, 
  onSuccess?: () => void,
  onError?: (error: Error) => void
) => {
  try {
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.style.display = 'none';
    
    document.body.appendChild(link);
    link.click();
    
    // Clean up after a short delay
    setTimeout(() => {
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    }, 100);
    
    onSuccess?.();
  } catch (error) {
    onError?.(error as Error);
  }
};