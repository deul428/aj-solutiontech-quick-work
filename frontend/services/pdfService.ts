
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';

/**
 * Captures rendered checklist elements and generates a PDF with 3 items per page.
 */
export const downloadChecklistPDF = async (containerId: string, fileName: string = 'checklists.pdf') => {
  const container = document.getElementById(containerId);
  if (!container) return;

  const elements = container.querySelectorAll('.checklist-preview-item');
  if (elements.length === 0) return;

  const pdf = new jsPDF('p', 'mm', 'a4');
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  
  const slotHeight = pageHeight / 3;

  for (let i = 0; i < elements.length; i++) {
    const element = elements[i] as HTMLElement;
    
    // Using high scale and ensuring all styles are computed before capture
    const canvas = await html2canvas(element, {
      scale: 3, 
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff',
      windowWidth: element.scrollWidth,
      windowHeight: element.scrollHeight,
      onclone: (clonedDoc) => {
        // Optional: Force elements to be visible or specific styles in the clone
        const clonedElement = clonedDoc.querySelector('.checklist-preview-item');
        if (clonedElement) {
          (clonedElement as HTMLElement).style.margin = '0';
        }
      }
    });

    const imgData = canvas.toDataURL('image/png', 1.0);
    
    const imgWidth = canvas.width;
    const imgHeight = canvas.height;
    
    const scaleX = pageWidth / imgWidth;
    const scaleY = slotHeight / imgHeight;
    const scale = Math.min(scaleX, scaleY);
    
    const renderWidth = imgWidth * scale;
    const renderHeight = imgHeight * scale;

    const positionInPage = i % 3;
    
    if (i > 0 && positionInPage === 0) {
      pdf.addPage();
    }

    const slotStartY = positionInPage * slotHeight;
    
    // Horizontal and vertical centering within the slot
    const xPos = (pageWidth - renderWidth) / 2;
    const yPos = slotStartY + (slotHeight - renderHeight) / 2;
    
    pdf.addImage(imgData, 'PNG', xPos, yPos, renderWidth, renderHeight, undefined, 'FAST');
  }

  pdf.save(fileName);
};
