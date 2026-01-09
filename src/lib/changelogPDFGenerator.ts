import jsPDF from 'jspdf';
import { format } from 'date-fns';

interface ChangelogEvent {
  id: number;
  date: string;
  type: string;
  title: string;
  description: string;
  filesCreated?: string[];
  filesModified?: string[];
  sqlExecuted?: string;
  databaseTable?: string;
}

const changelogEvents: ChangelogEvent[] = [
  {
    id: 1,
    date: "January 4, 2026",
    type: "Data Verification",
    title: "CP1 Claims Count Validation",
    description: "Verified accuracy of 7,105 CP1 claims count against database records.",
    filesModified: ["src/components/OpenInventoryDashboard.tsx"]
  },
  {
    id: 2,
    date: "January 4, 2026",
    type: "New Feature",
    title: "CP1 Drill-down Modal Implementation",
    description: "Created interactive drill-down capability allowing users to click on CP1 coverage rows to view individual claim details including matter ID, claimant, lead attorney, location, days open, and exposure amount.",
    filesCreated: ["src/components/CP1DrilldownModal.tsx"],
    filesModified: ["src/components/OpenInventoryDashboard.tsx"]
  },
  {
    id: 3,
    date: "January 4, 2026",
    type: "Feature Enhancement",
    title: "Executive Review 'Bombs' Display",
    description: "Added complete list of Executive Review Required cases (high-priority matters) with matter IDs as primary identifiers. Removed previous display limits.",
    filesModified: ["src/components/ExecutiveDashboard.tsx"]
  },
  {
    id: 4,
    date: "January 4, 2026",
    type: "Feature Enhancement",
    title: "Score & Explanation View",
    description: "Added executive review score display with detailed breakdown of reasons for each score.",
    filesModified: ["src/components/ExecutiveDashboard.tsx"]
  },
  {
    id: 5,
    date: "January 4, 2026",
    type: "UI Enhancement",
    title: "Scoring Formula Tooltip",
    description: "Added hover tooltip functionality showing detailed score calculation breakdown when users hover over the score badge.",
    filesModified: ["src/components/ExecutiveDashboard.tsx"]
  },
  {
    id: 6,
    date: "January 4-5, 2026",
    type: "Feature Integration",
    title: "Executive Review Integration with Open Inventory",
    description: "Integrated executive review scoring logic into CP1 drilldown modal. Claims are automatically scored, sorted by priority, display claim age in years, and show review level badges.",
    filesModified: ["src/components/CP1DrilldownModal.tsx"]
  },
  {
    id: 7,
    date: "January 5, 2026",
    type: "New Feature",
    title: "Excel Export for CP1 Claims",
    description: "Added 'Export Excel' button to CP1 drilldown modal with comprehensive data export including Matter ID, Review Level, Score, Claimant, Attorney, Location, Days Open, Exposure, and more.",
    filesModified: ["src/components/CP1DrilldownModal.tsx"]
  },
  {
    id: 8,
    date: "January 5, 2026",
    type: "UI Cleanup",
    title: "Header Statistics Cleanup",
    description: "Removed record count display, CSV badge indicator, and CWP/CWN statistics from dashboard header.",
    filesModified: ["src/pages/Index.tsx"]
  },
  {
    id: 9,
    date: "January 5, 2026",
    type: "UI Enhancement",
    title: "Executive Command Center - Always Visible",
    description: "Removed collapse/expand toggle from Executive Command Center section. This critical section now remains visible at all times.",
    filesModified: ["src/components/OpenInventoryDashboard.tsx"]
  },
  {
    id: 10,
    date: "January 9, 2026",
    type: "Data Analysis",
    title: "Accident Year Loss Development Chart Investigation",
    description: "Investigated discrepancy between 'Accident Year Loss Development' chart (52.3% for AY 2025) and RBC dashboard hardcoded values (63.47%). Confirmed chart uses loss_development_triangles database table.",
    filesModified: ["src/hooks/useLossTriangleData.ts"],
    databaseTable: "loss_development_triangles"
  },
  {
    id: 11,
    date: "January 9, 2026",
    type: "Database Update",
    title: "Loss Development Triangle Data Update",
    description: "Inserted updated 9-month development data for AY 2025 and development data for AY 2020-2024 including Earned Premium, Net Paid Loss, Claim Reserves, Bulk IBNR, and Loss Ratio.",
    databaseTable: "loss_development_triangles",
    sqlExecuted: "INSERT statements for AY 2020-2025"
  },
  {
    id: 12,
    date: "January 9, 2026",
    type: "Bug Fix",
    title: "Loss Ratio Hardcoding Fix",
    description: "Modified loss triangle data hook to prioritize stored actuarial loss_ratio values from database instead of calculating dynamically. Updated loss ratios: AY 2025 (63.59%), AY 2024 (66.08%), AY 2023 (66.96%), AY 2022 (68.41%), AY 2021 (67.37%), AY 2020 (67.04%).",
    filesModified: ["src/hooks/useLossTriangleData.ts"],
    databaseTable: "loss_development_triangles"
  },
  {
    id: 13,
    date: "January 9, 2026",
    type: "Security Enhancement",
    title: "RBC Tab Access Control",
    description: "Implemented access control for RBC dashboard tab. Tab is hidden by default, accessible via sessionStorage key 'rbc_exec_access' or keyboard shortcut Ctrl+Shift+R.",
    filesModified: ["src/components/GlobalFilters.tsx"]
  },
  {
    id: 14,
    date: "January 9, 2026",
    type: "Database Update",
    title: "Earned Premium Correction",
    description: "Updated AY 2025 earned premium from $611,704,442 to $811,704,442 (+$200M) to align with actual Net Written Premium figures (~$825M).",
    databaseTable: "loss_development_triangles",
    sqlExecuted: "UPDATE earned_premium for AY 2025"
  }
];

export const generateChangelogPDF = () => {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'pt',
    format: 'letter'
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 50;
  const contentWidth = pageWidth - (margin * 2);
  let yPos = margin;

  // Helper function to check page break
  const checkPageBreak = (requiredHeight: number) => {
    if (yPos + requiredHeight > pageHeight - margin) {
      doc.addPage();
      yPos = margin;
      return true;
    }
    return false;
  };

  // Header
  doc.setFillColor(30, 41, 59); // slate-800
  doc.rect(0, 0, pageWidth, 100, 'F');
  
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(24);
  doc.setFont('helvetica', 'bold');
  doc.text('LITIGATION COMMAND CENTER', margin, 45);
  
  doc.setFontSize(14);
  doc.setFont('helvetica', 'normal');
  doc.text('Development Changelog', margin, 68);
  
  doc.setFontSize(10);
  doc.text(`Generated: ${format(new Date(), 'MMMM d, yyyy h:mm a')}`, margin, 85);
  
  // Confidential badge
  doc.setFillColor(220, 38, 38); // red-600
  doc.roundedRect(pageWidth - margin - 100, 30, 100, 24, 3, 3, 'F');
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('CONFIDENTIAL', pageWidth - margin - 80, 46);

  yPos = 130;

  // Report Period
  doc.setTextColor(100, 116, 139); // slate-500
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text('Report Period: January 4, 2026 - January 9, 2026', margin, yPos);
  yPos += 30;

  // Summary Statistics Section
  doc.setTextColor(30, 41, 59);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('SUMMARY STATISTICS', margin, yPos);
  yPos += 20;

  // Stats boxes
  const statsData = [
    { label: 'Total Changes', value: '14' },
    { label: 'New Features', value: '3' },
    { label: 'Enhancements', value: '7' },
    { label: 'Database Updates', value: '4' }
  ];

  const boxWidth = (contentWidth - 30) / 4;
  statsData.forEach((stat, i) => {
    const boxX = margin + (i * (boxWidth + 10));
    doc.setFillColor(248, 250, 252); // slate-50
    doc.roundedRect(boxX, yPos, boxWidth, 50, 4, 4, 'F');
    doc.setDrawColor(226, 232, 240); // slate-200
    doc.roundedRect(boxX, yPos, boxWidth, 50, 4, 4, 'S');
    
    doc.setTextColor(100, 116, 139);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text(stat.label.toUpperCase(), boxX + 10, yPos + 18);
    
    doc.setTextColor(30, 41, 59);
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.text(stat.value, boxX + 10, yPos + 40);
  });

  yPos += 80;

  // Timeline of Changes
  doc.setTextColor(30, 41, 59);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('TIMELINE OF CHANGES', margin, yPos);
  yPos += 25;

  // Event entries
  changelogEvents.forEach((event) => {
    checkPageBreak(100);

    // Event header
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(margin, yPos, contentWidth, 70, 4, 4, 'F');
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(margin, yPos, contentWidth, 70, 4, 4, 'S');

    // Event number badge
    const badgeColor = getBadgeColor(event.type);
    doc.setFillColor(badgeColor.r, badgeColor.g, badgeColor.b);
    doc.circle(margin + 20, yPos + 20, 12, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text(String(event.id), margin + 16, yPos + 24);

    // Event title
    doc.setTextColor(30, 41, 59);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text(event.title, margin + 45, yPos + 18);

    // Type badge
    doc.setFillColor(badgeColor.r, badgeColor.g, badgeColor.b);
    doc.roundedRect(margin + 45, yPos + 25, doc.getTextWidth(event.type) + 12, 14, 2, 2, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.text(event.type.toUpperCase(), margin + 51, yPos + 34);

    // Date
    doc.setTextColor(100, 116, 139);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text(event.date, pageWidth - margin - doc.getTextWidth(event.date) - 10, yPos + 18);

    // Description (wrapped)
    doc.setTextColor(71, 85, 105);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    const descLines = doc.splitTextToSize(event.description, contentWidth - 60);
    doc.text(descLines.slice(0, 2), margin + 45, yPos + 52);

    yPos += 80;
  });

  // Files Affected Section
  checkPageBreak(200);
  yPos += 10;
  
  doc.setTextColor(30, 41, 59);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('FILES AFFECTED', margin, yPos);
  yPos += 20;

  const filesAffected = [
    { file: 'src/components/OpenInventoryDashboard.tsx', changes: '3 modifications' },
    { file: 'src/components/CP1DrilldownModal.tsx', changes: '1 creation, 2 modifications' },
    { file: 'src/components/ExecutiveDashboard.tsx', changes: '3 modifications' },
    { file: 'src/pages/Index.tsx', changes: '1 modification' },
    { file: 'src/hooks/useLossTriangleData.ts', changes: '1 modification' },
    { file: 'src/components/GlobalFilters.tsx', changes: '1 modification' }
  ];

  filesAffected.forEach((file) => {
    checkPageBreak(25);
    doc.setTextColor(30, 41, 59);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text('• ' + file.file, margin + 10, yPos);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139);
    doc.text(' — ' + file.changes, margin + 10 + doc.getTextWidth('• ' + file.file), yPos);
    yPos += 18;
  });

  // Access Control Reference
  checkPageBreak(100);
  yPos += 20;
  
  doc.setTextColor(30, 41, 59);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('ACCESS CONTROL REFERENCE', margin, yPos);
  yPos += 20;

  doc.setFillColor(254, 243, 199); // yellow-100
  doc.roundedRect(margin, yPos, contentWidth, 60, 4, 4, 'F');
  doc.setDrawColor(252, 211, 77); // yellow-400
  doc.roundedRect(margin, yPos, contentWidth, 60, 4, 4, 'S');

  doc.setTextColor(146, 64, 14); // yellow-800
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('RBC Dashboard Access', margin + 15, yPos + 18);
  
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text('• Default: Hidden', margin + 15, yPos + 33);
  doc.text('• Session Key: rbc_exec_access = "true"', margin + 15, yPos + 46);
  doc.text('• Keyboard Shortcut: Ctrl+Shift+R', margin + 200, yPos + 46);

  // Footer
  yPos = pageHeight - 40;
  doc.setDrawColor(226, 232, 240);
  doc.line(margin, yPos - 10, pageWidth - margin, yPos - 10);
  
  doc.setTextColor(100, 116, 139);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text('© 2026 Fred Loya Insurance — FLI Litigation Command Center', margin, yPos);
  doc.text('CONFIDENTIAL — FOR EXECUTIVE DISTRIBUTION ONLY', pageWidth - margin - 200, yPos);

  // Save the PDF
  doc.save(`FLI-Changelog-${format(new Date(), 'yyyy-MM-dd')}.pdf`);
};

// Helper function for badge colors
function getBadgeColor(type: string): { r: number; g: number; b: number } {
  switch (type) {
    case 'New Feature':
      return { r: 34, g: 197, b: 94 }; // green-500
    case 'Feature Enhancement':
    case 'Feature Integration':
      return { r: 59, g: 130, b: 246 }; // blue-500
    case 'UI Enhancement':
    case 'UI Cleanup':
      return { r: 168, g: 85, b: 247 }; // purple-500
    case 'Bug Fix':
      return { r: 239, g: 68, b: 68 }; // red-500
    case 'Database Update':
      return { r: 249, g: 115, b: 22 }; // orange-500
    case 'Security Enhancement':
      return { r: 236, g: 72, b: 153 }; // pink-500
    case 'Data Verification':
    case 'Data Analysis':
      return { r: 20, g: 184, b: 166 }; // teal-500
    default:
      return { r: 100, g: 116, b: 139 }; // slate-500
  }
}
