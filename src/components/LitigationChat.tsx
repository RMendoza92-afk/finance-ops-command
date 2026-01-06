import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { MessageCircle, Send, FileText, X, Loader2, Minimize2, Maximize2, Sparkles, TrendingUp, AlertTriangle, Users, FileSpreadsheet, GitCompare, LayoutDashboard, DollarSign, Clock, Shield, BarChart3, PieChart, Download } from "lucide-react";
import { toast } from "sonner";
import jsPDF from "jspdf";
import { useLitigationData, LitigationMatter } from "@/hooks/useLitigationData";
import { useExportData, ExportableData } from "@/hooks/useExportData";
import { useOpenExposureData } from "@/hooks/useOpenExposureData";
import { TrendComparisonCard, parseTrendData } from "@/components/TrendComparisonCard";
import { DrilldownModal } from "@/components/DrilldownModal";
import loyaLogo from "@/assets/fli_logo.jpg";
import { registerIBMPlexSans, setIBMPlexSans } from "@/lib/pdfFonts";
import { EXECUTIVE_COLORS, getReportContext } from "@/lib/executivePDFFramework";

interface Message {
  role: "user" | "assistant";
  content: string;
}

// Regex to match claim IDs in Oracle responses (e.g., M-12345, 12345678, CLM-12345)
const CLAIM_ID_REGEX = /\b(M-\d{4,8}|\d{6,10}|CLM-\d{4,8}|[A-Z]{1,3}-\d{5,8})\b/g;

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/litigation-chat`;

// Report categories organized by dashboard tab
type ReportCategory = 'trending' | 'executive' | 'exposure' | 'inventory' | 'exports';

interface ReportOption {
  id: string;
  label: string;
  query: string;
  icon: React.ElementType;
  color: string;
  description: string;
  disabled?: boolean;
}

const REPORT_CATEGORIES: Record<ReportCategory, { label: string; icon: React.ElementType; reports: ReportOption[] }> = {
  trending: {
    label: "Trending",
    icon: TrendingUp,
    reports: [
      { 
        id: "mtd-closures",
        label: "MTD Closures", 
        query: "What was closed month to date, total paid, and list the top 10 recent closures with amounts?",
        icon: TrendingUp,
        color: "text-muted-foreground",
        description: "Coming Soon",
        disabled: true
      },
      { 
        id: "weekly-compare",
        label: "Week-over-Week", 
        query: "Compare this week vs last week: show closures count, total paid, new filings, and net inventory change. Highlight any significant variances (>10% change).",
        icon: GitCompare,
        color: "text-cyan-500",
        description: "Compare this week's metrics to last week"
      },
      { 
        id: "monthly-compare",
        label: "Month-over-Month", 
        query: "Compare this month vs last month: closures, total paid, new filings, inventory delta. Call out any major changes.",
        icon: BarChart3,
        color: "text-blue-500",
        description: "Compare this month's metrics to last month"
      },
    ]
  },
  executive: {
    label: "Executive",
    icon: LayoutDashboard,
    reports: [
      { 
        id: "portfolio-summary",
        label: "Portfolio Summary", 
        query: "Give me a complete portfolio summary: total open matters, total reserves, total exposure, CP1 rate, and breakdown by major category.",
        icon: PieChart,
        color: "text-primary",
        description: "High-level portfolio overview with key metrics"
      },
      { 
        id: "team-performance",
        label: "Team Performance", 
        query: "Break down performance by team - show closures, total paid, open matters, and CP1 rate for each team.",
        icon: Users,
        color: "text-purple-500",
        description: "Performance metrics by team"
      },
      { 
        id: "risk-flags",
        label: "Risk Flags", 
        query: "Show me claims with high risk indicators: aged 365+, high exposure, CP1, or no evaluation. Summarize counts and total exposure.",
        icon: AlertTriangle,
        color: "text-destructive",
        description: "High-risk claims requiring attention"
      },
    ]
  },
  exposure: {
    label: "Exposure",
    icon: Shield,
    reports: [
      { 
        id: "cp1-analysis",
        label: "CP1 Full Analysis", 
        query: "Give me the full CP1 exposure analysis - totals by coverage, by type group, by age bucket, and the overall CP1 rate.",
        icon: FileSpreadsheet,
        color: "text-warning",
        description: "Complete CP1 breakdown by all dimensions"
      },
      { 
        id: "exposure-by-type",
        label: "Exposure by Type", 
        query: "Break down open exposure by type group: show count, total reserves, net exposure, and insurance expectancy for each type.",
        icon: PieChart,
        color: "text-blue-500",
        description: "Exposure breakdown by type group"
      },
      { 
        id: "high-exposure",
        label: "High Exposure Claims", 
        query: "List the top 20 claims by net exposure. Include matter ID, type, reserves, and exposure amount.",
        icon: AlertTriangle,
        color: "text-destructive",
        description: "Highest exposure claims in portfolio"
      },
    ]
  },
  inventory: {
    label: "Inventory",
    icon: FileSpreadsheet,
    reports: [
      { 
        id: "aged-inventory",
        label: "Aged 365+ Claims", 
        query: "Show me the aged inventory breakdown. How many claims are over 365 days by type group? List the 15 oldest claims.",
        icon: Clock,
        color: "text-destructive",
        description: "Claims aged over 365 days"
      },
      { 
        id: "no-eval",
        label: "No Evaluation Set", 
        query: "How many claims have no evaluation set? What's the total reserve exposure? List a sample of these claims by type.",
        icon: Sparkles,
        color: "text-amber-500",
        description: "Claims without evaluation"
      },
      { 
        id: "age-buckets",
        label: "Age Distribution", 
        query: "Show inventory by age bucket: 0-60, 61-180, 181-365, 365+ days. Include count, reserves, and exposure for each bucket.",
        icon: BarChart3,
        color: "text-blue-500",
        description: "Inventory broken down by age ranges"
      },
    ]
  },
  exports: {
    label: "Exports",
    icon: Download,
    reports: [
      { 
        id: "full-data-pdf",
        label: "Full Data PDF", 
        query: "EXPORT_PDF: Generate a comprehensive PDF report with portfolio summary, key metrics, risk analysis, and top claims.",
        icon: FileText,
        color: "text-destructive",
        description: "Complete portfolio PDF report"
      },
      { 
        id: "full-data-excel",
        label: "Full Data Excel", 
        query: "EXPORT_EXCEL: Generate a comprehensive Excel workbook with all claims data, summary metrics, and breakdowns by category.",
        icon: FileSpreadsheet,
        color: "text-success",
        description: "Complete data Excel export"
      },
      { 
        id: "claims-list",
        label: "Claims List", 
        query: "List all open claims with their key details: claim ID, claimant, coverage, team, adjuster, reserves, and pain level. Format as a data table.",
        icon: BarChart3,
        color: "text-blue-500",
        description: "Detailed claims listing"
      },
    ]
  },
};

// Aggregated matter type for drilldown modal
interface AggregatedMatter {
  id: string;
  uniqueRecord: string;
  claim: string;
  claimant: string;
  coverage: string;
  litigationStage: 'Early' | 'Mid' | 'Late' | 'Very Late';
  expertType: string;
  expertSpend: number;
  reactiveSpend: number;
  postureRatio: number;
  riskFlag: 'GREEN' | 'ORANGE' | 'RED';
  team: string;
  adjuster: string;
  dept: string;
  totalPaid: number;
  indemnity: number;
  expense: number;
  painBand: string;
  transactions: LitigationMatter[];
}

export function LitigationChat() {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [selectedMatter, setSelectedMatter] = useState<AggregatedMatter | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  
  const { data: litigationData } = useLitigationData();
  const { data: openExposureData } = useOpenExposureData();
  const { generatePDF, generateExcel } = useExportData();

  // Build a lookup map for quick claim resolution
  const claimLookup = useMemo(() => {
    const map = new Map<string, LitigationMatter[]>();
    litigationData?.forEach(m => {
      const key = m.claim?.toLowerCase() || m.uniqueRecord?.toLowerCase();
      if (key) {
        if (!map.has(key)) map.set(key, []);
        map.get(key)!.push(m);
      }
      // Also index by uniqueRecord
      const urKey = m.uniqueRecord?.toLowerCase();
      if (urKey && urKey !== key) {
        if (!map.has(urKey)) map.set(urKey, []);
        map.get(urKey)!.push(m);
      }
    });
    return map;
  }, [litigationData]);

  // Handle clicking on a claim ID in the Oracle response
  const handleClaimClick = useCallback((claimId: string) => {
    const normalized = claimId.toLowerCase();
    const matches = claimLookup.get(normalized);
    
    if (!matches || matches.length === 0) {
      // Try partial match
      const partialMatches: LitigationMatter[] = [];
      claimLookup.forEach((matters, key) => {
        if (key.includes(normalized) || normalized.includes(key)) {
          partialMatches.push(...matters);
        }
      });
      
      if (partialMatches.length === 0) {
        toast.info(`Claim ${claimId} not found in local data`);
        return;
      }
      
      buildAggregatedMatter(partialMatches, claimId);
      return;
    }
    
    buildAggregatedMatter(matches, claimId);
  }, [claimLookup]);

  // Build aggregated matter from transactions
  const buildAggregatedMatter = useCallback((transactions: LitigationMatter[], claimId: string) => {
    if (transactions.length === 0) return;
    
    const first = transactions[0];
    const totalPaid = transactions.reduce((sum, t) => sum + t.totalAmount, 0);
    const indemnity = transactions.reduce((sum, t) => sum + t.indemnitiesAmount, 0);
    const expense = totalPaid - indemnity;
    
    // Determine litigation stage based on days (approximated from data)
    const avgPain = transactions.reduce((sum, t) => sum + t.endPainLvl, 0) / transactions.length;
    let stage: 'Early' | 'Mid' | 'Late' | 'Very Late' = 'Early';
    if (avgPain >= 7) stage = 'Very Late';
    else if (avgPain >= 5) stage = 'Late';
    else if (avgPain >= 3) stage = 'Mid';
    
    // Risk flag based on amounts
    let riskFlag: 'GREEN' | 'ORANGE' | 'RED' = 'GREEN';
    if (totalPaid > 200000 || avgPain >= 7) riskFlag = 'RED';
    else if (totalPaid > 75000 || avgPain >= 5) riskFlag = 'ORANGE';
    
    const aggregated: AggregatedMatter = {
      id: first.id,
      uniqueRecord: first.uniqueRecord || claimId,
      claim: first.claim || claimId,
      claimant: first.claimant,
      coverage: first.coverage || first.expCategory,
      litigationStage: stage,
      expertType: first.expCategory,
      expertSpend: expense * 0.6, // Approximation
      reactiveSpend: expense * 0.4,
      postureRatio: expense > 0 ? totalPaid / expense : 0,
      riskFlag,
      team: first.team,
      adjuster: first.adjusterName,
      dept: first.dept,
      totalPaid,
      indemnity,
      expense,
      painBand: `${first.startPainLvl}-${first.endPainLvl}`,
      transactions,
    };
    
    setSelectedMatter(aggregated);
  }, []);

  // Build litigation data context
  const dataContext = useMemo(() => {
    if (!litigationData || litigationData.length === 0) return null;

    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    const mtdClosures = litigationData.filter(m => {
      if (m.cwpCwn !== 'CWP' || !m.paymentDate) return false;
      const payDate = new Date(m.paymentDate);
      return payDate.getMonth() === currentMonth && payDate.getFullYear() === currentYear;
    });

    const mtdPaid = mtdClosures.reduce((sum, m) => sum + m.indemnitiesAmount, 0);

    const byExpenseCategory: Record<string, { count: number; withEval: number; withoutEval: number; totalPaid: number }> = {};
    litigationData.forEach(m => {
      const cat = m.expCategory || 'Unknown';
      if (!byExpenseCategory[cat]) {
        byExpenseCategory[cat] = { count: 0, withEval: 0, withoutEval: 0, totalPaid: 0 };
      }
      byExpenseCategory[cat].count++;
      if (m.indemnitiesAmount > 0) {
        byExpenseCategory[cat].withEval++;
        byExpenseCategory[cat].totalPaid += m.indemnitiesAmount;
      } else {
        byExpenseCategory[cat].withoutEval++;
      }
    });

    const byCoverage: Record<string, { count: number; withEval: number; withoutEval: number }> = {};
    litigationData.forEach(m => {
      const cov = m.coverage || 'Unknown';
      if (!byCoverage[cov]) {
        byCoverage[cov] = { count: 0, withEval: 0, withoutEval: 0 };
      }
      byCoverage[cov].count++;
      if (m.indemnitiesAmount > 0) {
        byCoverage[cov].withEval++;
      } else {
        byCoverage[cov].withoutEval++;
      }
    });

    const byTeam: Record<string, { count: number; closed: number; totalPaid: number }> = {};
    litigationData.forEach(m => {
      const team = m.team || 'Unknown';
      if (!byTeam[team]) {
        byTeam[team] = { count: 0, closed: 0, totalPaid: 0 };
      }
      byTeam[team].count++;
      if (m.cwpCwn === 'CWP') {
        byTeam[team].closed++;
        byTeam[team].totalPaid += m.indemnitiesAmount;
      }
    });

    const withoutEvaluation = litigationData.filter(m => m.indemnitiesAmount === 0);
    const totalReserves = 257300000;
    
    return {
      totalMatters: litigationData.length,
      totalCWP: litigationData.filter(m => m.cwpCwn === 'CWP').length,
      totalCWN: litigationData.filter(m => m.cwpCwn === 'CWN').length,
      totalReserves,
      totalIndemnityPaid: litigationData.reduce((sum, m) => sum + m.indemnitiesAmount, 0),
      monthToDate: {
        closures: mtdClosures.length,
        totalPaid: mtdPaid,
        avgPayment: mtdClosures.length > 0 ? Math.round(mtdPaid / mtdClosures.length) : 0,
        closedMatters: mtdClosures.slice(0, 50).map(m => ({
          claim: m.claim,
          claimant: m.claimant,
          paymentDate: m.paymentDate,
          amountPaid: m.indemnitiesAmount,
          team: m.team,
          adjuster: m.adjusterName,
        }))
      },
      evaluationStatus: {
        withEvaluation: litigationData.filter(m => m.indemnitiesAmount > 0).length,
        withoutEvaluation: withoutEvaluation.length,
        percentWithoutEval: Math.round((withoutEvaluation.length / litigationData.length) * 100),
      },
      byExpenseCategory,
      byCoverage,
      byTeam,
      mattersWithoutEvaluation: withoutEvaluation.slice(0, 100).map(m => ({
        claim: m.claim,
        claimant: m.claimant,
        category: m.expCategory,
        coverage: m.coverage,
        team: m.team,
        adjuster: m.adjusterName,
        reserves: m.netAmount,
      })),
      sampleMatters: litigationData.slice(0, 100).map(m => ({
        claim: m.claim,
        claimant: m.claimant,
        expCategory: m.expCategory,
        coverage: m.coverage,
        team: m.team,
        adjuster: m.adjusterName,
        paymentDate: m.paymentDate,
        indemnityPaid: m.indemnitiesAmount,
        totalAmount: m.totalAmount,
        status: m.cwpCwn,
        painLevel: m.endPainLvl,
      })),
    };
  }, [litigationData]);

  // Build open exposure context
  const openExposureContext = useMemo(() => {
    if (!openExposureData) return null;
    return {
      totals: openExposureData.totals,
      typeGroupSummaries: openExposureData.typeGroupSummaries,
      cp1Data: openExposureData.cp1Data,
      cp1ByTypeGroup: openExposureData.cp1ByTypeGroup,
      financials: openExposureData.financials,
      knownTotals: openExposureData.knownTotals,
      rawClaims: openExposureData.rawClaims?.slice(0, 200) || [], // Send larger sample for accurate queries
    };
  }, [openExposureData]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const generateResponsePDF = async (question: string, responseContent: string) => {
    const doc = new jsPDF();
    await registerIBMPlexSans(doc);
    
    const pw = doc.internal.pageSize.getWidth();
    const ph = doc.internal.pageSize.getHeight();
    const m = { l: 18, r: 18, t: 22, b: 22 };
    const cw = pw - m.l - m.r;
    const ctx = getReportContext();

    const C = EXECUTIVE_COLORS;

    const formatCurrency = (val: number): string => {
      if (val >= 1000000) return '$' + (val / 1000000).toFixed(2) + 'M';
      if (val >= 1000) return '$' + Math.round(val / 1000) + 'K';
      return '$' + val.toLocaleString();
    };

    const sanitize = (text: string): string => {
      return text
        .replace(/[–—]/g, '-')
        .replace(/['']/g, "'")
        .replace(/[""]/g, '"')
        .replace(/…/g, '...')
        .replace(/\*\*/g, '')
        .replace(/[^\x20-\x7E\n]/g, '');
    };

    const sanitizedResponse = sanitize(responseContent);
    const lines = sanitizedResponse.split('\n').filter(l => l.trim());
    
    // === PARSE CONTENT INTO STRUCTURED SECTIONS ===
    interface ContentSection {
      title: string;
      items: string[];
      isTable?: boolean;
      tableData?: string[][];
    }
    
    const sections: ContentSection[] = [];
    let currentSection: ContentSection | null = null;
    
    lines.forEach((line) => {
      const trimmed = line.trim();
      
      // Detect section headers (lines ending with colon, standalone headers)
      if ((trimmed.endsWith(':') && trimmed.length < 80) || 
          /^[A-Z][A-Z\s&]+$/.test(trimmed) ||
          /^#{1,3}\s/.test(trimmed)) {
        if (currentSection && currentSection.items.length > 0) {
          sections.push(currentSection);
        }
        currentSection = { 
          title: trimmed.replace(/^#+\s*/, '').replace(/:$/, ''), 
          items: [] 
        };
      } else if (currentSection) {
        currentSection.items.push(trimmed);
      } else {
        // Content before first section
        if (!currentSection) {
          currentSection = { title: 'Summary', items: [] };
        }
        currentSection.items.push(trimmed);
      }
    });
    
    if (currentSection && currentSection.items.length > 0) {
      sections.push(currentSection);
    }

    // === PAGE 1: EXECUTIVE COVER ===
    // Full black background
    doc.setFillColor(...C.navy);
    doc.rect(0, 0, pw, ph, 'F');

    // Premium header band
    doc.setFillColor(...C.darkNavy);
    doc.rect(0, 0, pw, 50, 'F');
    
    // Thin red accent line
    doc.setFillColor(...C.azure);
    doc.rect(0, 50, pw, 1.5, 'F');

    // Report classification badge
    doc.setFillColor(...C.azure);
    doc.roundedRect(m.l, 12, 55, 14, 3, 3, 'F');
    setIBMPlexSans(doc, 'bold');
    doc.setFontSize(8);
    doc.setTextColor(...C.white);
    doc.text('EXECUTIVE BRIEF', m.l + 27.5, 21, { align: 'center' });

    // Logo
    try {
      doc.addImage(loyaLogo, 'JPEG', pw - m.r - 28, 10, 26, 26);
    } catch (e) {}

    // Main title
    setIBMPlexSans(doc, 'bold');
    doc.setFontSize(18);
    doc.setTextColor(...C.white);
    doc.text('LITIGATION ORACLE', m.l, 72);
    
    // Subtitle with context
    setIBMPlexSans(doc, 'normal');
    doc.setFontSize(11);
    doc.setTextColor(...C.textSecondary);
    doc.text('Intelligence Report', m.l, 82);
    
    // Report metadata line
    doc.setFontSize(9);
    doc.text(`${ctx.reportPeriod}  |  Week ${ctx.weekNumber}  |  Q${ctx.quarter} FY${ctx.fiscalYear}`, m.l, 92);

    // Report ID (right aligned)
    doc.setFontSize(7);
    doc.text(ctx.reportId, pw - m.r, 92, { align: 'right' });

    let y = 110;

    // === EXECUTIVE METRICS DASHBOARD ===
    const kpiCardW = (cw - 15) / 4;
    const kpiCardH = 38;
    
    const kpis = [
      { label: 'TOTAL MATTERS', value: dataContext?.totalMatters?.toLocaleString() || '--', subtext: 'Open Inventory', accent: C.azure, disabled: false },
      { label: 'MTD CLOSURES', value: '--', subtext: 'Coming Soon', accent: C.steel, disabled: true },
      { label: 'RESERVES', value: formatCurrency(dataContext?.totalReserves || 0), subtext: 'Total exposure', accent: C.warning, disabled: false },
      { label: 'INDEMNITY YTD', value: formatCurrency(dataContext?.totalIndemnityPaid || 0), subtext: 'Payments made', accent: C.danger, disabled: false },
    ];

    kpis.forEach((kpi, i) => {
      const xPos = m.l + (i * (kpiCardW + 5));
      const isDisabled = kpi.disabled;
      
      // Card with subtle border - greyed out if disabled
      doc.setFillColor(...(isDisabled ? [30, 35, 45] as [number, number, number] : C.darkNavy));
      doc.roundedRect(xPos, y, kpiCardW, kpiCardH, 3, 3, 'F');
      doc.setDrawColor(...(isDisabled ? [60, 65, 75] as [number, number, number] : C.steel));
      doc.setLineWidth(0.3);
      doc.roundedRect(xPos, y, kpiCardW, kpiCardH, 3, 3, 'S');
      
      // Accent bar at top - muted if disabled
      doc.setFillColor(...(isDisabled ? [60, 65, 75] as [number, number, number] : kpi.accent));
      doc.roundedRect(xPos, y, kpiCardW, 3, 3, 3, 'F');
      doc.setFillColor(...(isDisabled ? [30, 35, 45] as [number, number, number] : C.darkNavy));
      doc.rect(xPos, y + 1.5, kpiCardW, 3, 'F');
      
      // Label - dimmed if disabled
      setIBMPlexSans(doc, 'normal');
      doc.setFontSize(6.5);
      doc.setTextColor(...(isDisabled ? [80, 85, 95] as [number, number, number] : C.textSecondary));
      doc.text(kpi.label, xPos + kpiCardW / 2, y + 12, { align: 'center' });
      
      // Value - dimmed if disabled
      setIBMPlexSans(doc, 'bold');
      doc.setFontSize(14);
      doc.setTextColor(...(isDisabled ? [100, 105, 115] as [number, number, number] : C.white));
      doc.text(kpi.value, xPos + kpiCardW / 2, y + 25, { align: 'center' });
      
      // Subtext - dimmed if disabled
      setIBMPlexSans(doc, 'normal');
      doc.setFontSize(6);
      doc.setTextColor(...(isDisabled ? [80, 85, 95] as [number, number, number] : C.textSecondary));
      doc.text(kpi.subtext, xPos + kpiCardW / 2, y + 33, { align: 'center' });
    });

    y += kpiCardH + 15;

    // === QUERY CONTEXT BOX ===
    doc.setFillColor(...C.darkNavy);
    doc.roundedRect(m.l, y, cw, 32, 4, 4, 'F');
    
    // Left accent
    doc.setFillColor(...C.warning);
    doc.roundedRect(m.l, y, 4, 32, 4, 0, 'F');
    doc.setFillColor(...C.darkNavy);
    doc.rect(m.l + 2, y, 4, 32, 'F');

    // Query label
    setIBMPlexSans(doc, 'bold');
    doc.setFontSize(7);
    doc.setTextColor(...C.warning);
    doc.text('EXECUTIVE QUERY', m.l + 12, y + 10);

    // Query text with proper wrapping
    setIBMPlexSans(doc, 'normal');
    doc.setFontSize(10);
    doc.setTextColor(...C.white);
    const questionLines = doc.splitTextToSize(sanitize(question), cw - 24);
    doc.text(questionLines.slice(0, 3), m.l + 12, y + 20);

    y += 40;

    // === TABLE OF CONTENTS (if 3+ sections) ===
    const includeTOC = sections.length >= 3;
    
    if (includeTOC) {
      // TOC Header
      doc.setFillColor(...C.steel);
      doc.roundedRect(m.l, y, cw, 16, 3, 3, 'F');
      
      setIBMPlexSans(doc, 'bold');
      doc.setFontSize(10);
      doc.setTextColor(...C.white);
      doc.text('REPORT CONTENTS', m.l + 8, y + 11);
      
      doc.setFontSize(8);
      doc.setTextColor(...C.textSecondary);
      doc.text(`${sections.length} Sections`, pw - m.r - 8, y + 11, { align: 'right' });
      
      y += 22;

      // TOC entries (compact, professional)
      sections.slice(0, 8).forEach((section, idx) => {
        if (y > ph - m.b - 30) return;
        
        // Subtle row background
        if (idx % 2 === 0) {
          doc.setFillColor(...C.darkNavy);
          doc.rect(m.l, y - 2, cw, 10, 'F');
        }
        
        // Section number circle
        doc.setFillColor(...C.azure);
        doc.circle(m.l + 6, y + 3, 4, 'F');
        setIBMPlexSans(doc, 'bold');
        doc.setFontSize(7);
        doc.setTextColor(...C.white);
        doc.text(String(idx + 1), m.l + 6, y + 4.5, { align: 'center' });
        
        // Section title
        setIBMPlexSans(doc, 'normal');
        doc.setFontSize(9);
        doc.setTextColor(...C.white);
        const truncTitle = section.title.length > 55 ? section.title.substring(0, 52) + '...' : section.title;
        doc.text(truncTitle, m.l + 16, y + 4);
        
        y += 12;
      });
      
      y += 8;
    }

    // Check if we need a new page for content
    if (y > ph - 60) {
      doc.addPage();
      doc.setFillColor(...C.navy);
      doc.rect(0, 0, pw, ph, 'F');
      y = m.t;
    }

    // === RESPONSE CONTENT - FLOWING EXECUTIVE LAYOUT ===
    
    // Section header
    setIBMPlexSans(doc, 'bold');
    doc.setFontSize(11);
    doc.setTextColor(...C.azure);
    doc.text('INTELLIGENCE RESPONSE', m.l, y + 2);
    
    // Subtle underline
    doc.setDrawColor(...C.steel);
    doc.setLineWidth(0.3);
    doc.line(m.l, y + 6, m.l + 60, y + 6);
    y += 16;

    // Render each section with flowing text
    sections.forEach((section, sectionIdx) => {
      // Page break check
      if (y > ph - m.b - 40) {
        doc.addPage();
        doc.setFillColor(...C.navy);
        doc.rect(0, 0, pw, ph, 'F');
        y = m.t;
      }

      // Section header - clean typography, no box
      setIBMPlexSans(doc, 'bold');
      doc.setFontSize(10);
      doc.setTextColor(...C.white);
      doc.text(section.title.toUpperCase(), m.l, y + 2);
      
      // Thin accent line under section title
      doc.setDrawColor(...C.azure);
      doc.setLineWidth(0.5);
      doc.line(m.l, y + 5, m.l + Math.min(doc.getTextWidth(section.title.toUpperCase()) + 8, cw * 0.4), y + 5);
      
      y += 12;

      // Section content - flowing prose style
      section.items.forEach((item) => {
        if (y > ph - m.b - 15) {
          doc.addPage();
          doc.setFillColor(...C.navy);
          doc.rect(0, 0, pw, ph, 'F');
          y = m.t;
        }

        const lineHeight = 5;

        // Bullet points
        if (item.startsWith('- ') || item.startsWith('* ')) {
          const bulletText = item.slice(2);
          const textLines = doc.splitTextToSize(bulletText, cw - 14);
          
          // Small bullet dot
          doc.setFillColor(...C.azure);
          doc.circle(m.l + 3, y + 1.5, 1, 'F');
          
          setIBMPlexSans(doc, 'normal');
          doc.setFontSize(9);
          doc.setTextColor(...C.textPrimary);
          
          textLines.forEach((tl: string, i: number) => {
            doc.text(tl, m.l + 8, y + 2 + (i * lineHeight));
          });
          
          y += (textLines.length * lineHeight) + 3;
        }
        // Numbered items
        else if (/^\d+\./.test(item)) {
          const num = item.match(/^\d+\.?/)?.[0] || '';
          const restText = item.replace(/^\d+\.\s*/, '');
          const textLines = doc.splitTextToSize(restText, cw - 16);
          
          // Number in accent color
          setIBMPlexSans(doc, 'bold');
          doc.setFontSize(9);
          doc.setTextColor(...C.azure);
          doc.text(num, m.l, y + 2);
          
          setIBMPlexSans(doc, 'normal');
          doc.setFontSize(9);
          doc.setTextColor(...C.textPrimary);
          
          textLines.forEach((tl: string, i: number) => {
            doc.text(tl, m.l + 10, y + 2 + (i * lineHeight));
          });
          
          y += (textLines.length * lineHeight) + 3;
        }
        // Key-value pairs
        else if (item.includes(':') && item.indexOf(':') < 40 && !item.endsWith(':')) {
          const [key, ...valueParts] = item.split(':');
          const value = valueParts.join(':').trim();
          
          setIBMPlexSans(doc, 'bold');
          doc.setFontSize(9);
          doc.setTextColor(...C.textSecondary);
          doc.text(key.trim() + ':', m.l, y + 2);
          
          const keyWidth = doc.getTextWidth(key.trim() + ': ');
          const valueLines = doc.splitTextToSize(value, cw - keyWidth - 5);
          
          setIBMPlexSans(doc, 'normal');
          doc.setTextColor(...C.white);
          valueLines.forEach((vl: string, i: number) => {
            doc.text(vl, m.l + keyWidth, y + 2 + (i * lineHeight));
          });
          
          y += (valueLines.length * lineHeight) + 3;
        }
        // Regular paragraph
        else {
          const textLines = doc.splitTextToSize(item, cw);
          
          setIBMPlexSans(doc, 'normal');
          doc.setFontSize(9);
          doc.setTextColor(...C.textPrimary);
          
          textLines.forEach((tl: string, i: number) => {
            doc.text(tl, m.l, y + 2 + (i * lineHeight));
          });
          
          y += (textLines.length * lineHeight) + 3;
        }
      });
      
      y += 6; // Section spacing
      
      // Add subtle separator between sections (not after last)
      if (sectionIdx < sections.length - 1 && y < ph - m.b - 20) {
        doc.setDrawColor(...C.steel);
        doc.setLineWidth(0.15);
        doc.line(m.l + 20, y, pw - m.r - 20, y);
        y += 8;
      }
    });

    // === FOOTER ON ALL PAGES ===
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      
      // Footer band
      doc.setFillColor(...C.darkNavy);
      doc.rect(0, ph - 16, pw, 16, 'F');
      
      // Top accent
      doc.setFillColor(...C.azure);
      doc.rect(0, ph - 16, pw, 0.5, 'F');
      
      // Footer content
      setIBMPlexSans(doc, 'normal');
      doc.setFontSize(6);
      doc.setTextColor(...C.textSecondary);
      doc.text('CONFIDENTIAL - EXECUTIVE USE ONLY', m.l, ph - 6);
      
      setIBMPlexSans(doc, 'bold');
      doc.text('Fred Loya Insurance  |  Litigation Command Center', pw / 2, ph - 6, { align: 'center' });
      
      setIBMPlexSans(doc, 'normal');
      doc.text(`Page ${i} of ${pageCount}`, pw - m.r, ph - 6, { align: 'right' });
    }

    const timestamp = new Date().toISOString().slice(0, 10);
    const filename = `FLI_Executive_Brief_${timestamp}.pdf`;
    doc.save(filename);
    toast.success(`Executive brief downloaded: ${filename}`);
  };

  const sendMessage = async (overrideInput?: string) => {
    const messageText = overrideInput || input;
    if (!messageText.trim() || isLoading) return;
    
    if (!dataContext && !openExposureContext) {
      toast.error("Data is still loading, please wait...");
      return;
    }
    
    const userMessage: Message = { role: "user", content: messageText };
    setMessages(prev => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);
    
    // Handle direct export commands
    if (messageText.startsWith('EXPORT_PDF:') || messageText.startsWith('EXPORT_EXCEL:')) {
      const isExcel = messageText.startsWith('EXPORT_EXCEL:');
      try {
        const totalReserves = openExposureContext?.knownTotals?.totalOpenExposures || dataContext?.totalReserves || 0;
        const cp1Rate = openExposureContext?.cp1Data?.cp1Rate || '0';
        const cp1Total = openExposureContext?.cp1Data?.total || 0;
        
        const exportData: ExportableData = {
          title: isExcel ? 'Litigation Portfolio Data Export' : 'Litigation Portfolio Executive Summary',
          subtitle: 'Comprehensive claims and exposure analysis',
          timestamp: new Date().toLocaleString(),
          summary: {
            'Total Matters': dataContext?.totalMatters?.toLocaleString() || '0',
            'Total Reserves': '$' + (totalReserves / 1000000).toFixed(1) + 'M',
            'CP1 Rate': cp1Rate + '%',
            'CWP Count': dataContext?.totalCWP?.toLocaleString() || '0',
            'CWN Count': dataContext?.totalCWN?.toLocaleString() || '0',
          },
          bulletInsights: [
            `Portfolio contains ${dataContext?.totalMatters?.toLocaleString() || 0} total matters`,
            `Total reserves of $${(totalReserves / 1000000).toFixed(1)}M across all type groups`,
            `CP1 rate at ${cp1Rate}% (${cp1Total.toLocaleString()} claims)`,
            `${dataContext?.evaluationStatus?.withoutEvaluation || 0} claims without evaluation assigned`,
          ],
          columns: ['Claim', 'Claimant', 'Coverage', 'Team', 'Adjuster', 'Status', 'Indemnity', 'Pain Level'],
          rows: (litigationData || []).slice(0, 500).map(m => [
            m.claim || m.uniqueRecord,
            m.claimant,
            m.coverage || m.expCategory,
            m.team,
            m.adjusterName,
            m.cwpCwn,
            '$' + m.indemnitiesAmount.toLocaleString(),
            m.endPainLvl.toString()
          ]),
          rawClaimData: isExcel ? [{
            sheetName: 'All Claims',
            columns: ['Claim', 'Unique Record', 'Claimant', 'Coverage', 'Category', 'Team', 'Dept', 'Adjuster', 'Status', 'Indemnity', 'Total Amount', 'Net Amount', 'Start Pain', 'End Pain', 'Payment Date'],
            rows: (litigationData || []).map(m => [
              m.claim,
              m.uniqueRecord,
              m.claimant,
              m.coverage,
              m.expCategory,
              m.team,
              m.dept,
              m.adjusterName,
              m.cwpCwn,
              m.indemnitiesAmount,
              m.totalAmount,
              m.netAmount,
              m.startPainLvl,
              m.endPainLvl,
              m.paymentDate || ''
            ])
          }] : undefined
        };

        if (isExcel) {
          generateExcel(exportData);
          setMessages(prev => [...prev, { 
            role: 'assistant', 
            content: `✅ **Excel Export Complete**\n\nI've generated a comprehensive Excel workbook with:\n- **Executive Summary** sheet with key metrics\n- **All Claims** sheet with ${(litigationData || []).length.toLocaleString()} records\n\nThe file has been downloaded to your device.` 
          }]);
        } else {
          await generatePDF(exportData);
          setMessages(prev => [...prev, { 
            role: 'assistant', 
            content: `✅ **PDF Export Complete**\n\nI've generated an executive PDF report with:\n- Portfolio summary metrics\n- Key findings and insights\n- Top 500 claims data table\n\nThe file has been downloaded to your device.` 
          }]);
        }
        setIsLoading(false);
        return;
      } catch (error) {
        console.error('Export error:', error);
        toast.error('Failed to generate export');
        setIsLoading(false);
        return;
      }
    }
    
    let assistantContent = "";
    
    const updateAssistant = (chunk: string) => {
      assistantContent += chunk;
      setMessages(prev => {
        const last = prev[prev.length - 1];
        if (last?.role === "assistant") {
          return prev.map((m, i) => i === prev.length - 1 ? { ...m, content: assistantContent } : m);
        }
        return [...prev, { role: "assistant", content: assistantContent }];
      });
    };
    
    try {
      const resp = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ 
          messages: [...messages, userMessage],
          dataContext,
          openExposureContext,
        }),
      });
      
      if (!resp.ok) {
        const errorData = await resp.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to get response");
      }
      
      // Check for restricted response (non-streaming JSON)
      const contentType = resp.headers.get("content-type") || "";
      if (contentType.includes("application/json")) {
        const jsonResp = await resp.json();
        if (jsonResp.restricted) {
          updateAssistant(jsonResp.message);
          setIsLoading(false);
          return;
        }
      }
      
      if (!resp.body) {
        throw new Error("No response body");
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        buffer += decoder.decode(value, { stream: true });
        
        let newlineIndex: number;
        while ((newlineIndex = buffer.indexOf("\n")) !== -1) {
          let line = buffer.slice(0, newlineIndex);
          buffer = buffer.slice(newlineIndex + 1);
          
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (line.startsWith(":") || line.trim() === "") continue;
          if (!line.startsWith("data: ")) continue;
          
          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") break;
          
          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) updateAssistant(content);
          } catch {
            buffer = line + "\n" + buffer;
            break;
          }
        }
      }
      
      if (assistantContent.trim()) {
        generateResponsePDF(userMessage.content, assistantContent);
        toast.info("PDF report downloaded automatically");
      }
      
    } catch (error) {
      console.error("Chat error:", error);
      toast.error(error instanceof Error ? error.message : "Failed to send message");
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleQuickAction = (query: string) => {
    sendMessage(query);
  };

  const dataReady = dataContext || openExposureContext;
  const totalClaims = (openExposureContext?.totals?.grandTotal || 0) + (dataContext?.totalMatters || 0);

  if (!isOpen) {
    return (
      <Button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 h-12 w-12 sm:h-14 sm:w-14 rounded-full shadow-lg z-50 bg-gradient-to-br from-primary to-primary/80"
        size="icon"
      >
        <Sparkles className="h-5 w-5 sm:h-6 sm:w-6" />
      </Button>
    );
  }

  return (
    <Card className={`fixed z-50 shadow-2xl transition-all duration-300 border-primary/20 ${
      isMinimized 
        ? "bottom-4 right-4 sm:bottom-6 sm:right-6 w-64 sm:w-72 h-12 sm:h-14" 
        : "inset-4 sm:inset-auto sm:bottom-6 sm:right-6 sm:w-[480px] sm:h-[700px] sm:max-h-[85vh]"
    }`}>
      <CardHeader className="py-3 px-4 border-b flex flex-row items-center justify-between space-y-0 bg-gradient-to-r from-card to-muted/30">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <span className="font-bold">Litigation Oracle</span>
          {dataReady && (
            <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
              {totalClaims.toLocaleString()} claims
            </span>
          )}
        </CardTitle>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => setIsMinimized(!isMinimized)}
          >
            {isMinimized ? <Maximize2 className="h-4 w-4" /> : <Minimize2 className="h-4 w-4" />}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => setIsOpen(false)}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      
      {!isMinimized && (
        <CardContent className="p-0 flex flex-col h-[calc(100%-56px)]">
          <ScrollArea className="flex-1 p-4" ref={scrollRef}>
            {messages.length === 0 && (
              <div className="space-y-3">
                {/* Executive Header */}
                <div className="bg-[#161616] rounded-lg p-3 border border-[#2d2d2d]">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#d4af37] to-[#b8962e] flex items-center justify-center">
                      <Sparkles className="h-5 w-5 text-[#0c0c0c]" />
                    </div>
                    <div>
                      <p className="font-bold text-[#f0f0f0] text-sm tracking-tight">Litigation Oracle</p>
                      <p className="text-[10px] text-[#8c8c8c]">Board-Ready Intelligence Reports</p>
                    </div>
                  </div>
                </div>
                
                {/* Tabbed Report Selector - Executive Dark Theme */}
                <Tabs defaultValue="trending" className="w-full">
                  <TabsList className="w-full grid grid-cols-5 h-auto p-0.5 bg-[#121212] border border-[#2d2d2d] rounded-lg">
                    {(Object.keys(REPORT_CATEGORIES) as ReportCategory[]).map((cat) => {
                      const category = REPORT_CATEGORIES[cat];
                      return (
                        <TabsTrigger
                          key={cat}
                          value={cat}
                          className="text-[10px] px-1 py-2 flex flex-col gap-0.5 rounded-md text-[#8c8c8c] data-[state=active]:bg-[#1a1a1a] data-[state=active]:text-[#d4af37] data-[state=active]:border-t data-[state=active]:border-[#d4af37]/50 transition-all"
                        >
                          <category.icon className="h-3.5 w-3.5" />
                          <span className="hidden sm:inline font-medium">{category.label}</span>
                        </TabsTrigger>
                      );
                    })}
                  </TabsList>
                  
                  {(Object.keys(REPORT_CATEGORIES) as ReportCategory[]).map((cat) => {
                    const category = REPORT_CATEGORIES[cat];
                    return (
                      <TabsContent key={cat} value={cat} className="mt-2 space-y-1">
                        {category.reports.map((report, idx) => (
                          <button
                            key={report.id}
                            onClick={() => !report.disabled && handleQuickAction(report.query)}
                            disabled={isLoading || !dataReady || report.disabled}
                            className={`w-full text-left p-2.5 rounded-lg border transition-all group disabled:opacity-50 disabled:cursor-not-allowed
                              ${idx % 2 === 0 ? 'bg-[#121212]' : 'bg-[#181818]'}
                              ${report.disabled ? 'border-[#1a1a1a] opacity-40' : 'border-[#2d2d2d] hover:border-[#d4af37]/40 hover:bg-[#1a1a1a]'}
                            `}
                          >
                            <div className="flex items-start gap-2.5">
                              <div className={`w-7 h-7 rounded flex-shrink-0 flex items-center justify-center bg-[#0c0c0c] border ${report.disabled ? 'border-[#1a1a1a]' : 'border-[#2d2d2d] group-hover:border-[#d4af37]/30'}`}>
                                <report.icon className={`h-3.5 w-3.5 ${report.disabled ? 'text-muted-foreground' : report.color} ${!report.disabled && 'group-hover:text-[#d4af37]'} transition-colors`} />
                              </div>
                              <div className="flex-1 min-w-0">
                                <span className={`text-xs font-semibold block ${report.disabled ? 'text-muted-foreground' : 'text-[#f0f0f0] group-hover:text-[#d4af37]'} transition-colors`}>{report.label}</span>
                                <span className={`text-[10px] block leading-tight mt-0.5 ${report.disabled ? 'text-muted-foreground/60 italic' : 'text-[#8c8c8c]'}`}>{report.description}</span>
                              </div>
                              {!report.disabled && (
                                <div className="text-[#2d2d2d] group-hover:text-[#d4af37] transition-colors">
                                  <Send className="h-3 w-3" />
                                </div>
                              )}
                            </div>
                          </button>
                        ))}
                      </TabsContent>
                    );
                  })}
                </Tabs>
              </div>
            )}
            
            {messages.map((msg, i) => (
              <div
                key={i}
                className={`mb-4 ${msg.role === "user" ? "text-right" : "text-left"}`}
              >
                <div
                  className={`inline-block max-w-[90%] px-4 py-3 rounded-lg text-sm ${
                    msg.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-foreground border border-border"
                  }`}
                >
                  <div className="whitespace-pre-wrap leading-relaxed">
                    {msg.content.split('\n').map((line, lineIdx) => (
                      <p key={lineIdx} className={line.trim() === '' ? 'h-2' : 'mb-1'}>
                        {renderLineWithClickableClaims(line, msg.role === 'assistant' ? handleClaimClick : undefined)}
                      </p>
                    ))}
                  </div>
                  
                  {/* Render trend comparison cards for assistant messages */}
                  {msg.role === "assistant" && (() => {
                    const trendData = parseTrendData(msg.content);
                    if (!trendData) return null;
                    return (
                      <div className="mt-3 space-y-2">
                        {trendData.weekOverWeek && trendData.weekOverWeek.length > 0 && (
                          <TrendComparisonCard
                            title="Week-over-Week"
                            period="vs last week"
                            metrics={trendData.weekOverWeek}
                          />
                        )}
                        {trendData.monthOverMonth && trendData.monthOverMonth.length > 0 && (
                          <TrendComparisonCard
                            title="Month-over-Month"
                            period="vs last month"
                            metrics={trendData.monthOverMonth}
                          />
                        )}
                      </div>
                    );
                  })()}
                </div>
              </div>
            ))}
            
            {isLoading && (
              <div className="flex items-center gap-2 text-muted-foreground text-sm bg-muted/50 rounded-lg px-4 py-3">
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
                <span>Analyzing {totalClaims.toLocaleString()} claims...</span>
              </div>
            )}
          </ScrollArea>
          
          <div className="p-4 border-t bg-muted/20">
            <div className="flex gap-2">
              <Input
                placeholder="Ask the Oracle anything..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={isLoading}
                className="flex-1"
              />
              <Button
                size="icon"
                onClick={() => sendMessage()}
                disabled={isLoading || !input.trim()}
                className="bg-primary hover:bg-primary/90"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-[10px] text-muted-foreground mt-2 text-center">
              PDF report auto-downloads with each response • Double-click dashboard cards for raw exports
            </p>
          </div>
        </CardContent>
      )}
      
      {/* Drilldown Modal for clicked claims */}
      <DrilldownModal 
        matter={selectedMatter} 
        onClose={() => setSelectedMatter(null)} 
      />
    </Card>
  );
}

// Helper function to render line content with clickable claim IDs
function renderLineWithClickableClaims(
  line: string, 
  onClaimClick?: (claimId: string) => void
): React.ReactNode {
  // Handle special line formatting first
  if (line.startsWith('- ') || line.startsWith('* ')) {
    return (
      <span className="flex gap-2">
        <span className="text-primary">•</span>
        <span>{parseClaimIds(line.slice(2), onClaimClick)}</span>
      </span>
    );
  }
  if (line.startsWith('**') && line.endsWith('**')) {
    return <strong className="text-primary">{parseClaimIds(line.slice(2, -2), onClaimClick)}</strong>;
  }
  if (line.startsWith('###')) {
    return <strong className="text-primary text-base">{parseClaimIds(line.replace(/^#+\s*/, ''), onClaimClick)}</strong>;
  }
  if (line.startsWith('##')) {
    return <strong className="text-primary text-lg">{parseClaimIds(line.replace(/^#+\s*/, ''), onClaimClick)}</strong>;
  }
  if (line.startsWith('#')) {
    return <strong className="text-primary text-xl">{parseClaimIds(line.replace(/^#+\s*/, ''), onClaimClick)}</strong>;
  }
  if (line.startsWith('|')) {
    return <code className="text-xs bg-background px-1 rounded">{parseClaimIds(line, onClaimClick)}</code>;
  }
  
  return parseClaimIds(line, onClaimClick);
}

// Parse text and replace claim IDs with clickable spans
function parseClaimIds(
  text: string, 
  onClaimClick?: (claimId: string) => void
): React.ReactNode {
  if (!onClaimClick) return text;
  
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  
  // Reset regex state
  CLAIM_ID_REGEX.lastIndex = 0;
  
  while ((match = CLAIM_ID_REGEX.exec(text)) !== null) {
    // Add text before the match
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    
    // Add clickable claim ID
    const claimId = match[1];
    parts.push(
      <button
        key={`${match.index}-${claimId}`}
        onClick={() => onClaimClick(claimId)}
        className="text-primary underline underline-offset-2 hover:text-primary/80 font-mono font-medium cursor-pointer transition-colors"
        title={`View details for ${claimId}`}
      >
        {claimId}
      </button>
    );
    
    lastIndex = match.index + match[0].length;
  }
  
  // Add remaining text
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }
  
  return parts.length > 0 ? parts : text;
}
