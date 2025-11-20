/**
 * Utility functions for formatting drug data
 */

export const formatDrugName = (name: string): string => {
  if (!name) return '';
  
  // Capitalize first letter of each word
  return name
    .toLowerCase()
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

export const formatRxCui = (rxCui: string): string => {
  if (!rxCui) return '';
  
  // Add hyphens for readability if it's a long number
  if (rxCui.length > 6) {
    return rxCui.replace(/(\d{4})(\d{4})(\d+)/, '$1-$2-$3');
  }
  
  return rxCui;
};

export const formatSeverity = (severity: string): string => {
  if (!severity) return 'Unknown';
  
  // Format severity levels
  const severityMap: { [key: string]: string } = {
    'HIGH': 'High',
    'MODERATE': 'Moderate',
    'LOW': 'Low',
    'MINOR': 'Minor'
  };
  
  return severityMap[severity.toUpperCase()] || severity;
};

export const formatAdverseEffectCount = (count: number): string => {
  if (count >= 1000) {
    return `${(count / 1000).toFixed(1)}k`;
  }
  return count.toString();
};

export const extractActiveIngredients = (monograph: any): string[] => {
  if (!monograph || !monograph.SPL || !monograph.SPL.content) {
    return [];
  }
  
  // Look for active ingredients in the monograph content
  const activeIngredients: string[] = [];
  
  monograph.SPL.content.forEach((section: any) => {
    if (section.title && section.title.toLowerCase().includes('active')) {
      if (section.paragraph) {
        // Extract ingredients from paragraph text
        const ingredients = section.paragraph.match(/([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)(?=\s+ingred)/gi);
        if (ingredients) {
          activeIngredients.push(...ingredients);
        }
      }
    }
  });
  
  return [...new Set(activeIngredients)]; // Remove duplicates
};