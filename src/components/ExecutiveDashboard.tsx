import { useMemo, useCallback, useState } from "react";
import { LitigationMatter } from "@/hooks/useLitigationData";
import { useExportData, ExportableData, RawClaimData } from "@/hooks/useExportData";
import { KPICard } from "@/components/KPICard";
import { DollarSign, TrendingUp, AlertTriangle, Target, Download, FileSpreadsheet, ChevronDown, ChevronUp, Info, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip as ShadcnTooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

import { toast } from "sonner";
import { format } from "date-fns";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
} from "recharts";
import { 
  calculateExecutiveReview, 
  estimateClaimAge,
  ExecutiveReviewLevel,
  ExecutiveReviewResult 
} from "@/lib/executiveReview";
import { SMSDialog } from "./SMSDialog";
interface PainLevelRow {
  oldStartPain: string;
  oldEndPain: string;
  startPain: string;
  endPain: string;
}

interface ExecutiveDashboardProps {
  data: LitigationMatter[];
  onDrilldown: (claimId: string) => void;
}

// Determine litigation stage based on pain level
function getLitigationStage(painLvl: number): 'Early' | 'Mid' | 'Late' | 'Very Late' {
  if (painLvl <= 2) return 'Early';
  if (painLvl <= 5) return 'Mid';
  if (painLvl <= 7) return 'Late';
  return 'Very Late';
}

// Determine expert type from expense category
function getExpertType(expCategory: string): string {
  if (!expCategory) return 'Other';
  const cat = expCategory.toUpperCase();
  if (cat.includes('MEDICAL') || cat.includes('MED')) return 'Medical';
  if (cat.includes('LEGAL') || cat.includes('ATTORNEY')) return 'Legal';
  if (cat.includes('EXPERT') || cat.includes('CONSULT')) return 'Consultant';
  if (cat.includes('ENGINEER')) return 'Engineering';
  if (cat.includes('ACCOUNT') || cat.includes('ECON')) return 'Economic';
  return 'Other';
}

export function ExecutiveDashboard({ data, onDrilldown }: ExecutiveDashboardProps) {
  const { exportBoth, generateFullExcel } = useExportData();
  const timestamp = format(new Date(), 'MMMM d, yyyy h:mm a');
  const [showAllBombs, setShowAllBombs] = useState(false);
  const [smsDialogOpen, setSmsDialogOpen] = useState(false);
  const [selectedCaseForSMS, setSelectedCaseForSMS] = useState<{
    matterId: string;
    exposure: number;
    stage: string;
    adjuster: string;
    level: string;
  } | null>(null);
  // Aggregate data by unique record (claim)
  const aggregatedData = useMemo(() => {
    const grouped = new Map<string, {
      uniqueRecord: string;
      claim: string;
      stage: string;
      expertSpend: number;
      postureSpend: number;
      indemnity: number;
      expense: number;
      totalPaid: number;
      expertType: string;
      adjuster: string;
      team: string;
    }>();

    data.forEach(matter => {
      const key = matter.uniqueRecord || matter.claim;
      const existing = grouped.get(key);
      const stage = getLitigationStage(matter.endPainLvl);
      const expertType = getExpertType(matter.expCategory);
      
      // Determine if this is expert spend or reactive posture spend
      const isExpertSpend = matter.expCategory?.toUpperCase().includes('EXPERT') || 
                           matter.expCategory?.toUpperCase().includes('MED') ||
                           matter.expCategory?.toUpperCase().includes('CONSULT');
      
      // Calculate expense from total minus indemnity
      const expenseAmount = (matter.totalAmount || 0) - (matter.indemnitiesAmount || 0);
      const expertSpend = isExpertSpend ? Math.max(0, expenseAmount) : 0;
      const postureSpend = isExpertSpend ? 0 : Math.max(0, expenseAmount);
      
      if (existing) {
        existing.expertSpend += expertSpend;
        existing.postureSpend += postureSpend;
        existing.indemnity += matter.indemnitiesAmount || 0;
        existing.expense += Math.max(0, expenseAmount);
        existing.totalPaid += matter.totalAmount || 0;
      } else {
        const expenseAmount = (matter.totalAmount || 0) - (matter.indemnitiesAmount || 0);
        grouped.set(key, {
          uniqueRecord: key,
          claim: matter.claim || key,
          stage,
          expertSpend,
          postureSpend,
          indemnity: matter.indemnitiesAmount || 0,
          expense: Math.max(0, expenseAmount),
          totalPaid: matter.totalAmount || 0,
          expertType,
          adjuster: matter.adjusterName || 'Unknown',
          team: matter.team || 'Unknown',
        });
      }
    });

    return Array.from(grouped.values());
  }, [data]);

  // Calculate KPIs - Known 2025 YTD figures (through November):
  // Total BI Spend: $395M (all bodily injury)
  // Litigation Expenses: $19M  
  // Expert Spend (actual): $5,681,152 YTD
  // Reactive (pre-lit ATR waste + lit fees): $13.3M ($19M - $5.68M)
  const kpis = useMemo(() => {
    const totalPaid = aggregatedData.reduce((sum, m) => sum + m.totalPaid, 0);
    const indemnity = aggregatedData.reduce((sum, m) => sum + m.indemnity, 0);
    const expense = aggregatedData.reduce((sum, m) => sum + m.expense, 0);
    const expertSpend = aggregatedData.reduce((sum, m) => sum + m.expertSpend, 0);
    const postureSpend = aggregatedData.reduce((sum, m) => sum + m.postureSpend, 0);
    
    // Calculate waste ratio (avoid divide by zero)
    const wasteRatio = expertSpend > 0 ? postureSpend / expertSpend : 0;
    const expertPercent = expense > 0 ? (expertSpend / expense) * 100 : 0;
    const wastePercent = expense > 0 ? (postureSpend / expense) * 100 : 0;
    
    return { 
      totalPaid, 
      expertSpend, 
      postureSpend, 
      indemnity,
      expense,
      wasteRatio,
      expertPercent,
      wastePercent,
      claimCount: aggregatedData.length,
    };
  }, [aggregatedData]);

  // Expert spend by quarter - actual 2025 YTD data (through November)
  const quarterlyExpertData = [
    { quarter: 'Q1 2025', paid: 1553080, paidAvgMonthly: 517693, approved: 2141536, approvedAvgMonthly: 713845 },
    { quarter: 'Q2 2025', paid: 1727599, paidAvgMonthly: 575866, approved: 1680352, approvedAvgMonthly: 560117 },
    { quarter: 'Q3 2025', paid: 1383717, paidAvgMonthly: 461239, approved: 1449627, approvedAvgMonthly: 483209 },
    { quarter: 'Q4 2025', paid: 1016756, paidAvgMonthly: 508378, approved: 909651, approvedAvgMonthly: 454826 },
  ];

  // Reactive cost curve by stage - using actual data
  const costCurveData = useMemo(() => {
    const stages = ['Early', 'Mid', 'Late', 'Very Late'];
    let cumulative = 0;
    
    return stages.map(stage => {
      const stageData = aggregatedData.filter(m => m.stage === stage);
      const stageExpense = stageData.reduce((sum, m) => sum + m.expense, 0);
      const stageExpert = stageData.reduce((sum, m) => sum + m.expertSpend, 0);
      const stagePosture = stageData.reduce((sum, m) => sum + m.postureSpend, 0);
      cumulative += stagePosture;
      
      return {
        stage,
        reactiveSpend: stagePosture,
        expertSpend: stageExpert,
        cumulative,
        count: stageData.length,
      };
    });
  }, [aggregatedData]);

  // Executive Review Cases - files requiring executive attention
  const executiveReviewCases = useMemo(() => {
    
    // Build aggregated view with executive review calculation
    const claimMap = new Map<string, {
      uniqueRecord: string;
      claim: string;
      matterId: string;
      stage: 'Early' | 'Mid' | 'Late' | 'Very Late';
      expense: number;
      adjuster: string;
      claimAge: number;
      painEscalation: number;
      maxPain: number;
      expCategory: string;
      coverage: string;
      team: string;
      executiveReview: ExecutiveReviewResult;
    }>();
    
    data.forEach(matter => {
      const key = matter.uniqueRecord || matter.claim;
      const existing = claimMap.get(key);
      const stage = getLitigationStage(matter.endPainLvl);
      const expenseAmount = Math.max(0, (matter.totalAmount || 0) - (matter.indemnitiesAmount || 0));
      const claimAge = estimateClaimAge(matter.prefix, matter.transferDate);
      const painEscalation = matter.endPainLvl - matter.startPainLvl;
      
      if (existing) {
        existing.expense += expenseAmount;
        existing.maxPain = Math.max(existing.maxPain, matter.endPainLvl);
        existing.painEscalation = Math.max(existing.painEscalation, painEscalation);
      } else {
        claimMap.set(key, {
          uniqueRecord: key,
          claim: matter.claim || key,
          matterId: matter.uniqueRecord || matter.claim || key,
          stage,
          expense: expenseAmount,
          adjuster: matter.adjusterName || 'Unknown',
          claimAge,
          painEscalation,
          maxPain: matter.endPainLvl,
          expCategory: matter.expCategory || '',
          coverage: matter.coverage || '',
          team: matter.team || '',
          executiveReview: { level: 'NONE', reasons: [], score: 0 } // placeholder
        });
      }
    });
    
    // Calculate executive review for each claim
    // Use a reasonable approximation for expert vs reactive spend based on expense category
    const cases = Array.from(claimMap.values()).map(c => {
      const isExpertSpend = c.expCategory?.toUpperCase().includes('EXPERT') || 
                           c.expCategory?.toUpperCase().includes('MED') ||
                           c.expCategory?.toUpperCase().includes('CONSULT');
      const expertSpend = isExpertSpend ? c.expense : 0;
      const reactiveSpend = isExpertSpend ? 0 : c.expense;
      
      const review = calculateExecutiveReview(
        c.claimAge,
        c.stage,
        expertSpend,
        reactiveSpend,
        c.painEscalation,
        c.maxPain,
        c.expCategory
      );
      
      return {
        ...c,
        expertSpend,
        reactiveSpend,
        executiveReview: review
      };
    });
    
    // Filter to CRITICAL and REQUIRED only, sort by score (highest first), then expense
    return cases
      .filter(c => c.executiveReview.level === 'CRITICAL' || c.executiveReview.level === 'REQUIRED')
      .sort((a, b) => {
        // First sort by score (highest first), then by expense
        if (b.executiveReview.score !== a.executiveReview.score) {
          return b.executiveReview.score - a.executiveReview.score;
        }
        return b.expense - a.expense;
      });
    // No slice - return all cases for complete visibility
  }, [data]);

  const formatCurrency = (value: number) => {
    if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `$${(value / 1000).toFixed(0)}K`;
    return `$${value.toFixed(0)}`;
  };

  const formatCurrencyFull = (value: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value);
  };

  // Format claim number as XX-XXXXXX-X (2 digits prefix, 6 digits claim, 1 digit exposure)
  const formatClaimNumber = (claimId: string): string => {
    if (!claimId) return '';
    // Remove any existing dashes and non-numeric characters except for the last digit which could be a suffix
    const cleaned = claimId.replace(/[^0-9]/g, '');
    if (cleaned.length >= 9) {
      // Format as XX-XXXXXX-X
      return `${cleaned.slice(0, 2)}-${cleaned.slice(2, 8)}-${cleaned.slice(8, 9)}`;
    } else if (cleaned.length >= 8) {
      // Format as XX-XXXXXX (no suffix)
      return `${cleaned.slice(0, 2)}-${cleaned.slice(2, 8)}`;
    }
    // Return original if format doesn't match expected pattern
    return claimId;
  };

  // Helper to build raw claim data for Excel
  const buildRawClaimData = useCallback((filterFn?: (m: typeof aggregatedData[0]) => boolean): RawClaimData => {
    const filteredData = filterFn ? aggregatedData.filter(filterFn) : aggregatedData;
    return {
      columns: ['Unique Record', 'Claim', 'Stage', 'Adjuster', 'Team', 'Indemnity', 'Expense', 'Expert Spend', 'Posture Spend', 'Total Paid'],
      rows: filteredData.map(m => [
        m.uniqueRecord,
        m.claim,
        m.stage,
        m.adjuster,
        m.team,
        m.indemnity,
        m.expense,
        m.expertSpend,
        m.postureSpend,
        m.totalPaid,
      ]),
      sheetName: 'Claim Detail',
    };
  }, [aggregatedData]);

  // Export handlers for double-click
  const handleExportKPIs = useCallback(async () => {
    const exportData: ExportableData = {
      title: 'KPI Dashboard Summary',
      subtitle: 'Expert Spend and Friction Metrics',
      timestamp,
      affectsManager: 'Executive Leadership',
      summary: {
        'Total Paid': formatCurrencyFull(kpis.totalPaid),
        'Expenses': formatCurrencyFull(kpis.expense),
        'Expert Spend': formatCurrencyFull(kpis.expertSpend),
        'Reactive Waste': formatCurrencyFull(kpis.postureSpend),
        'Waste Ratio': kpis.wasteRatio > 0 ? `${kpis.wasteRatio.toFixed(1)}x` : '--',
      },
      columns: ['Metric', 'Value', 'Notes'],
      rows: [
        ['Total Paid', formatCurrencyFull(kpis.totalPaid), `${kpis.claimCount.toLocaleString()} claims`],
        ['Indemnity', formatCurrencyFull(kpis.indemnity), 'Settlement amounts'],
        ['Expert Spend', formatCurrencyFull(kpis.expertSpend), 'Strategic spend'],
        ['Reactive Waste', formatCurrencyFull(kpis.postureSpend), 'Pre-lit ATR + Lit fees'],
        ['Expert %', `${kpis.expertPercent.toFixed(1)}%`, 'Strategic spend ratio'],
        ['Reactive %', `${kpis.wastePercent.toFixed(1)}%`, 'Friction spend ratio'],
      ],
      rawClaimData: [buildRawClaimData()],
    };
    await exportBoth(exportData);
    toast.success('PDF + Excel exported: KPI Summary');
  }, [exportBoth, timestamp, buildRawClaimData, kpis]);

  const handleExportQuarterly = useCallback(async () => {
    const exportData: ExportableData = {
      title: '2025 Quarterly Expert Spend',
      subtitle: 'Paid vs Approved by Quarter',
      timestamp,
      affectsManager: 'Executive Leadership',
      summary: {
        'YTD Paid': '$5,681,152',
        'YTD Approved': '$6,181,166',
        'Monthly Avg Paid': '$516,468',
      },
      columns: ['Quarter', 'Paid', 'Paid Monthly Avg', 'Approved', 'Approved Monthly Avg', 'Variance'],
      rows: quarterlyExpertData.map(q => [
        q.quarter,
        formatCurrencyFull(q.paid),
        formatCurrencyFull(q.paidAvgMonthly),
        formatCurrencyFull(q.approved),
        formatCurrencyFull(q.approvedAvgMonthly),
        formatCurrencyFull(q.approved - q.paid),
      ]),
      rawClaimData: [buildRawClaimData()],
    };
    await exportBoth(exportData);
    toast.success('PDF + Excel exported: Quarterly Expert Spend');
  }, [exportBoth, timestamp, quarterlyExpertData, buildRawClaimData]);

  const handleExportCostCurve = useCallback(async () => {
    // Build stage-specific claim data sheets
    const stageClaimData: RawClaimData[] = costCurveData.map(stage => ({
      columns: ['Unique Record', 'Claim', 'Stage', 'Adjuster', 'Team', 'Indemnity', 'Expense', 'Expert Spend', 'Posture Spend', 'Total Paid'],
      rows: aggregatedData.filter(m => m.stage === stage.stage).map(m => [
        m.uniqueRecord,
        m.claim,
        m.stage,
        m.adjuster,
        m.team,
        m.indemnity,
        m.expense,
        m.expertSpend,
        m.postureSpend,
        m.totalPaid,
      ]),
      sheetName: `${stage.stage} Stage Claims`,
    }));

    const exportData: ExportableData = {
      title: 'Reactive Cost Curve Analysis',
      subtitle: 'Cumulative posture spend by litigation stage',
      timestamp,
      affectsManager: 'Executive Leadership',
      columns: ['Stage', 'Reactive Spend', 'Expert Spend', 'Cumulative', 'Claim Count'],
      rows: costCurveData.map(d => [
        d.stage,
        formatCurrencyFull(d.reactiveSpend),
        formatCurrencyFull(d.expertSpend),
        formatCurrencyFull(d.cumulative),
        d.count,
      ]),
      rawClaimData: stageClaimData,
    };
    await exportBoth(exportData);
    toast.success('PDF + Excel exported: Cost Curve');
  }, [exportBoth, timestamp, costCurveData, aggregatedData]);

  const handleExportExecutiveReview = useCallback(async () => {
    // Build raw claim data for all executive review cases
    const execReviewClaimData: RawClaimData = {
      columns: ['Claim', 'Unique Record', 'Review Level', 'Score', 'Total Exposure', 'Expert Spend', 'Reactive Spend', 'Claim Age (Years)', 'Stage', 'Adjuster', 'Pain Escalation', 'Max Pain', 'All Review Reasons'],
      rows: executiveReviewCases.map(c => [
        c.claim,
        c.uniqueRecord,
        c.executiveReview.level,
        c.executiveReview.score,
        c.expense,
        c.expertSpend,
        c.reactiveSpend,
        c.claimAge,
        c.stage,
        c.adjuster,
        c.painEscalation,
        c.maxPain,
        c.executiveReview.reasons.join('; '),
      ]),
      sheetName: 'Executive Review Claims',
    };

    const exportData: ExportableData = {
      title: 'Executive Review Required',
      subtitle: 'Files requiring executive closure',
      timestamp,
      affectsManager: 'Executive Leadership',
      summary: {
        'Critical Cases': executiveReviewCases.filter(c => c.executiveReview.level === 'CRITICAL').length,
        'Required Cases': executiveReviewCases.filter(c => c.executiveReview.level === 'REQUIRED').length,
        'Total Exposure': formatCurrencyFull(executiveReviewCases.reduce((s, c) => s + c.expense, 0)),
      },
      columns: ['Claim', 'Level', 'Exposure', 'Age (Years)', 'Stage', 'Adjuster', 'Score', 'Top Reason'],
      rows: executiveReviewCases.map(c => [
        c.claim,
        c.executiveReview.level,
        formatCurrencyFull(c.expense),
        c.claimAge,
        c.stage,
        c.adjuster,
        c.executiveReview.score,
        c.executiveReview.reasons[0] || '',
      ]),
      rawClaimData: [execReviewClaimData],
    };
    await exportBoth(exportData);
    toast.success('PDF + Excel exported: Executive Review Cases');
  }, [exportBoth, timestamp, executiveReviewCases]);

  const handleExportClaim = useCallback(async (caseItem: typeof executiveReviewCases[0]) => {
    // Get all raw matter data for this specific claim from original data
    const claimMatters = data.filter(m => (m.uniqueRecord || m.claim) === caseItem.uniqueRecord);
    const claimRawData: RawClaimData = {
      columns: ['Claim', 'Unique Record', 'Adjuster', 'Team', 'Prefix', 'Start Pain', 'End Pain', 'Indemnity', 'Total Amount', 'Expense Category', 'Transfer Date'],
      rows: claimMatters.map(m => [
        m.claim || '',
        m.uniqueRecord || '',
        m.adjusterName || '',
        m.team || '',
        m.prefix || '',
        m.startPainLvl || 0,
        m.endPainLvl || 0,
        m.indemnitiesAmount || 0,
        m.totalAmount || 0,
        m.expCategory || '',
        m.transferDate || '',
      ]),
      sheetName: 'Claim Transactions',
    };

    const exportData: ExportableData = {
      title: `Claim Detail: ${caseItem.claim}`,
      subtitle: `Executive Review - ${caseItem.executiveReview.level}`,
      timestamp,
      affectsManager: caseItem.adjuster || 'Executive Leadership',
      summary: {
        'Claim ID': caseItem.claim,
        'Review Level': caseItem.executiveReview.level,
        'Score': caseItem.executiveReview.score,
        'Total Exposure': formatCurrencyFull(caseItem.expense),
        'Expert Spend': formatCurrencyFull(caseItem.expertSpend),
        'Reactive Spend': formatCurrencyFull(caseItem.reactiveSpend),
        'Claim Age': `${caseItem.claimAge} years`,
        'Stage': caseItem.stage,
        'Adjuster': caseItem.adjuster,
      },
      columns: ['Review Reason'],
      rows: caseItem.executiveReview.reasons.map(r => [r]),
      rawClaimData: [claimRawData],
    };
    await exportBoth(exportData);
    toast.success(`PDF + Excel exported: ${caseItem.claim}`);
  }, [exportBoth, timestamp, data]);

  // Full Export - all sections in one workbook
  const handleFullExport = useCallback(() => {
    // Build stage-specific claim data
    const stageClaimData: RawClaimData[] = costCurveData.map(stage => ({
      columns: ['Unique Record', 'Claim', 'Stage', 'Adjuster', 'Team', 'Indemnity', 'Expense', 'Expert Spend', 'Posture Spend', 'Total Paid'],
      rows: aggregatedData.filter(m => m.stage === stage.stage).map(m => [
        m.uniqueRecord,
        m.claim,
        m.stage,
        m.adjuster,
        m.team,
        m.indemnity,
        m.expense,
        m.expertSpend,
        m.postureSpend,
        m.totalPaid,
      ]),
      sheetName: `${stage.stage} Stage Claims`,
    }));

    // Executive review raw data
    const execReviewClaimData: RawClaimData = {
      columns: ['Claim', 'Unique Record', 'Review Level', 'Score', 'Total Exposure', 'Expert Spend', 'Reactive Spend', 'Claim Age (Years)', 'Stage', 'Adjuster', 'Pain Escalation', 'Max Pain', 'All Review Reasons'],
      rows: executiveReviewCases.map(c => [
        c.claim,
        c.uniqueRecord,
        c.executiveReview.level,
        c.executiveReview.score,
        c.expense,
        c.expertSpend,
        c.reactiveSpend,
        c.claimAge,
        c.stage,
        c.adjuster,
        c.painEscalation,
        c.maxPain,
        c.executiveReview.reasons.join('; '),
      ]),
      sheetName: 'Executive Review Claims',
    };

    const sections = [
      {
        title: 'KPI Summary',
        data: {
          title: 'KPI Dashboard Summary',
          subtitle: 'Expert Spend and Friction Metrics',
          timestamp,
          affectsManager: 'Executive Leadership',
          summary: {
            'Total Paid': formatCurrencyFull(kpis.totalPaid),
            'Expenses': formatCurrencyFull(kpis.expense),
            'Expert Spend': formatCurrencyFull(kpis.expertSpend),
            'Reactive Waste': formatCurrencyFull(kpis.postureSpend),
            'Waste Ratio': kpis.wasteRatio > 0 ? `${kpis.wasteRatio.toFixed(1)}x` : '--',
          },
          columns: ['Metric', 'Value', 'Notes'],
          rows: [
            ['Total Paid', formatCurrencyFull(kpis.totalPaid), `${kpis.claimCount.toLocaleString()} claims`],
            ['Indemnity', formatCurrencyFull(kpis.indemnity), 'Settlement amounts'],
            ['Expert Spend', formatCurrencyFull(kpis.expertSpend), 'Strategic spend'],
            ['Reactive Waste', formatCurrencyFull(kpis.postureSpend), 'Pre-lit ATR + Lit fees'],
            ['Expert %', `${kpis.expertPercent.toFixed(1)}%`, 'Strategic spend ratio'],
            ['Reactive %', `${kpis.wastePercent.toFixed(1)}%`, 'Friction spend ratio'],
          ],
          rawClaimData: [buildRawClaimData()],
        } as ExportableData,
      },
      {
        title: 'Quarterly Expert',
        data: {
          title: '2025 Quarterly Expert Spend',
          subtitle: 'Paid vs Approved by Quarter',
          timestamp,
          affectsManager: 'Executive Leadership',
          summary: {
            'YTD Paid': '$5,681,152',
            'YTD Approved': '$6,181,166',
            'Monthly Avg Paid': '$516,468',
          },
          columns: ['Quarter', 'Paid', 'Paid Monthly Avg', 'Approved', 'Approved Monthly Avg', 'Variance'],
          rows: quarterlyExpertData.map(q => [
            q.quarter,
            formatCurrencyFull(q.paid),
            formatCurrencyFull(q.paidAvgMonthly),
            formatCurrencyFull(q.approved),
            formatCurrencyFull(q.approvedAvgMonthly),
            formatCurrencyFull(q.approved - q.paid),
          ]),
        } as ExportableData,
      },
      {
        title: 'Cost Curve',
        data: {
          title: 'Reactive Cost Curve Analysis',
          subtitle: 'Cumulative posture spend by litigation stage',
          timestamp,
          affectsManager: 'Executive Leadership',
          columns: ['Stage', 'Reactive Spend', 'Expert Spend', 'Cumulative', 'Claim Count'],
          rows: costCurveData.map(d => [
            d.stage,
            formatCurrencyFull(d.reactiveSpend),
            formatCurrencyFull(d.expertSpend),
            formatCurrencyFull(d.cumulative),
            d.count,
          ]),
          rawClaimData: stageClaimData,
        } as ExportableData,
      },
      {
        title: 'Exec Review',
        data: {
          title: 'Executive Review Required',
          subtitle: 'Files requiring executive closure',
          timestamp,
          affectsManager: 'Executive Leadership',
          summary: {
            'Critical Cases': executiveReviewCases.filter(c => c.executiveReview.level === 'CRITICAL').length,
            'Required Cases': executiveReviewCases.filter(c => c.executiveReview.level === 'REQUIRED').length,
            'Total Exposure': formatCurrencyFull(executiveReviewCases.reduce((s, c) => s + c.expense, 0)),
          },
          columns: ['Claim', 'Level', 'Exposure', 'Age (Years)', 'Stage', 'Adjuster', 'Score', 'Top Reason'],
          rows: executiveReviewCases.map(c => [
            c.claim,
            c.executiveReview.level,
            formatCurrencyFull(c.expense),
            c.claimAge,
            c.stage,
            c.adjuster,
            c.executiveReview.score,
            c.executiveReview.reasons[0] || '',
          ]),
          rawClaimData: [execReviewClaimData],
        } as ExportableData,
      },
    ];

    generateFullExcel(sections);
    toast.success('Full Excel workbook exported with all dashboard data!');
  }, [generateFullExcel, timestamp, buildRawClaimData, quarterlyExpertData, costCurveData, aggregatedData, executiveReviewCases]);

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Professional Header Banner */}
      <div className="bg-[#0c2340] rounded-xl p-4 sm:p-5 shadow-lg">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="border-l-2 border-[#b41e1e] pl-3 sm:pl-4">
            <h2 className="text-sm sm:text-lg font-bold text-white tracking-wide">EXECUTIVE COMMAND CENTER</h2>
            <p className="text-[10px] sm:text-xs text-gray-300">Litigation Intelligence Dashboard</p>
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:gap-4">
            <button
              onClick={handleFullExport}
              className="flex items-center gap-1 sm:gap-2 px-2 sm:px-4 py-1.5 sm:py-2 bg-[#b41e1e] hover:bg-[#8f1818] text-white text-xs sm:text-sm font-semibold rounded-lg transition-colors shadow-md"
            >
              <FileSpreadsheet className="h-3 w-3 sm:h-4 sm:w-4" />
              <span className="hidden sm:inline">Full Export</span>
              <span className="sm:hidden">Export</span>
            </button>
            <div className="hidden lg:flex items-center gap-2 text-xs text-gray-300">
              <Download className="h-3.5 w-3.5" />
              <span>Double-click sections</span>
            </div>
          </div>
        </div>
      </div>

      {/* Filtered Data Summary Banner */}
      <div 
        className="bg-gradient-to-r from-[#0c2340] to-[#1a3a5c] border-2 border-[#b41e1e]/30 rounded-xl p-3 sm:p-5 cursor-pointer hover:border-[#b41e1e] transition-colors shadow-lg"
        onDoubleClick={handleExportKPIs}
        title="Double-click to export"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-lg sm:text-xl font-bold text-white">Total Paid: {formatCurrency(kpis.totalPaid)}</h2>
            <p className="text-xs sm:text-sm text-gray-300 mt-1">
              Expenses: <span className="font-semibold text-white">{formatCurrency(kpis.expense)}</span> • {kpis.claimCount.toLocaleString()} claims
            </p>
          </div>
          <div className="text-left sm:text-right">
            <p className="text-[10px] sm:text-xs text-gray-400 uppercase tracking-wide mb-1">Expense Breakdown</p>
            <div className="flex items-center gap-2 sm:gap-3 text-sm">
              <span className="text-emerald-400 font-bold">{formatCurrency(kpis.expertSpend)} Expert</span>
              <span className="text-gray-400">vs</span>
              <span className="text-[#b41e1e] font-bold">{formatCurrency(kpis.postureSpend)} Waste</span>
            </div>
          </div>
        </div>
        
        {/* Visual expense breakdown */}
        <div className="mt-3 sm:mt-4 pt-3 sm:pt-4 border-t border-white/10">
          <div className="flex items-center gap-2 sm:gap-4">
            <div className="flex-1">
              <div className="flex justify-between text-[10px] sm:text-xs text-gray-400 mb-1">
                <span>Expert ({kpis.expertPercent.toFixed(0)}%)</span>
                <span>Reactive Waste ({kpis.wastePercent.toFixed(0)}%)</span>
              </div>
              <div className="w-full h-4 sm:h-5 rounded-full bg-gray-700 overflow-hidden flex">
                <div 
                  className="bg-emerald-500 h-full flex items-center justify-center text-[9px] sm:text-[10px] font-bold text-white" 
                  style={{ width: `${Math.max(kpis.expertPercent, 1)}%` }}
                >
                  {kpis.expertPercent >= 10 ? `${kpis.expertPercent.toFixed(0)}%` : ''}
                </div>
                <div 
                  className="bg-[#b41e1e] h-full flex items-center justify-center text-[9px] sm:text-[10px] font-bold text-white" 
                  style={{ width: `${Math.max(kpis.wastePercent, 1)}%` }}
                >
                  {kpis.wastePercent >= 10 ? `${kpis.wastePercent.toFixed(0)}%` : ''}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
        <KPICard
          title="Total Paid"
          value={formatCurrency(kpis.totalPaid)}
          subtitle={`${kpis.claimCount.toLocaleString()} claims`}
          icon={DollarSign}
          variant="default"
        />
        <KPICard
          title="Indemnity"
          value={formatCurrency(kpis.indemnity)}
          subtitle="Settlement amounts"
          icon={DollarSign}
          variant="default"
        />
        <KPICard
          title="Expert Spend"
          value={formatCurrency(kpis.expertSpend)}
          subtitle="Strategic spend"
          icon={Target}
          variant="success"
        />
        <KPICard
          title="Reactive Waste"
          value={formatCurrency(kpis.postureSpend)}
          subtitle="Pre-lit ATR + Lit fees"
          icon={AlertTriangle}
          variant="danger"
        />
        <KPICard
          title="Waste Ratio"
          value={kpis.wasteRatio > 0 ? `${kpis.wasteRatio.toFixed(1)}x` : '--'}
          subtitle={kpis.wasteRatio > 0 ? `$1 expert = $${kpis.wasteRatio.toFixed(2)} waste` : 'No expert spend'}
          icon={TrendingUp}
          variant="warning"
        />
      </div>

      {/* Quarterly Expert Spend Table */}
      <div 
        className="bg-card border-2 border-[#0c2340]/20 rounded-xl p-3 sm:p-5 cursor-pointer hover:border-[#0c2340]/50 transition-colors shadow-md"
        onDoubleClick={handleExportQuarterly}
        title="Double-click to export"
      >
        <div className="flex items-center gap-2 mb-1">
          <div className="w-1 h-5 bg-[#b41e1e] rounded"></div>
          <h3 className="text-xs sm:text-sm font-semibold text-[#0c2340] uppercase tracking-wide">2025 Expert Spend</h3>
        </div>
        <p className="text-[10px] sm:text-xs text-muted-foreground mb-3 sm:mb-4 ml-3">YTD through November</p>
        
        {/* Mobile Cards */}
        <div className="block sm:hidden space-y-2">
          {quarterlyExpertData.map((q) => (
            <div key={q.quarter} className="flex items-center justify-between p-2 bg-muted/30 rounded-lg">
              <span className="font-medium text-sm">{q.quarter}</span>
              <div className="text-right">
                <span className="text-sm text-success font-semibold">{formatCurrency(q.paid)}</span>
                <span className="text-xs text-muted-foreground ml-2">paid</span>
              </div>
            </div>
          ))}
          <div className="flex items-center justify-between p-2 bg-muted/50 rounded-lg font-bold">
            <span className="text-sm">2025 YTD</span>
            <span className="text-sm text-success">$5.68M</span>
          </div>
        </div>

        {/* Desktop Table */}
        <div className="hidden sm:block overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-2 px-3 text-muted-foreground font-medium">Quarter</th>
                <th className="text-right py-2 px-3 text-muted-foreground font-medium">Paid</th>
                <th className="text-right py-2 px-3 text-muted-foreground font-medium hidden lg:table-cell">Monthly Avg</th>
                <th className="text-right py-2 px-3 text-muted-foreground font-medium">Approved</th>
                <th className="text-right py-2 px-3 text-muted-foreground font-medium hidden lg:table-cell">Monthly Avg</th>
                <th className="text-right py-2 px-3 text-muted-foreground font-medium">Variance</th>
              </tr>
            </thead>
            <tbody>
              {quarterlyExpertData.map((q) => (
                <tr key={q.quarter} className="border-b border-border/50 hover:bg-muted/30">
                  <td className="py-2 px-3 font-medium">{q.quarter}</td>
                  <td className="py-2 px-3 text-right text-success font-semibold">{formatCurrencyFull(q.paid)}</td>
                  <td className="py-2 px-3 text-right text-muted-foreground hidden lg:table-cell">{formatCurrencyFull(q.paidAvgMonthly)}</td>
                  <td className="py-2 px-3 text-right">{formatCurrencyFull(q.approved)}</td>
                  <td className="py-2 px-3 text-right text-muted-foreground hidden lg:table-cell">{formatCurrencyFull(q.approvedAvgMonthly)}</td>
                  <td className={`py-2 px-3 text-right font-medium ${q.paid > q.approved ? 'text-warning' : 'text-success'}`}>
                    {q.paid > q.approved ? '+' : '-'}{formatCurrencyFull(Math.abs(q.approved - q.paid))}
                  </td>
                </tr>
              ))}
              <tr className="bg-muted/50 font-bold">
                <td className="py-2 px-3">2025 YTD</td>
                <td className="py-2 px-3 text-right text-success">$5,681,152</td>
                <td className="py-2 px-3 text-right text-muted-foreground hidden lg:table-cell">$516,468</td>
                <td className="py-2 px-3 text-right">$6,181,166</td>
                <td className="py-2 px-3 text-right text-muted-foreground hidden lg:table-cell">$561,924</td>
                <td className="py-2 px-3 text-right text-success">-$500,014</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        {/* Reactive Cost Curve */}
        <div 
          className="bg-card border-2 border-[#0c2340]/20 rounded-xl p-3 sm:p-5 cursor-pointer hover:border-[#0c2340]/50 transition-colors shadow-md"
          onDoubleClick={handleExportCostCurve}
          title="Double-click to export"
        >
          <div className="flex items-center gap-2 mb-1">
            <div className="w-1 h-5 bg-[#b41e1e] rounded"></div>
            <h3 className="text-xs sm:text-sm font-semibold text-[#0c2340] uppercase tracking-wide">Reactive Cost Curve</h3>
          </div>
          <p className="text-[10px] sm:text-xs text-muted-foreground mb-3 sm:mb-4 ml-3">Cumulative posture spend by stage</p>
          
          <div className="h-48 sm:h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={costCurveData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorReactive" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--destructive))" stopOpacity={0.4}/>
                    <stop offset="95%" stopColor="hsl(var(--destructive))" stopOpacity={0.05}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis 
                  dataKey="stage" 
                  stroke="hsl(var(--muted-foreground))" 
                  fontSize={10}
                  tickLine={false}
                />
                <YAxis 
                  stroke="hsl(var(--muted-foreground))" 
                  fontSize={10}
                  tickFormatter={(v) => formatCurrency(v)}
                  tickLine={false}
                  axisLine={false}
                  width={45}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--card))', 
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                    fontSize: '11px'
                  }}
                  formatter={(value: number, name: string) => [formatCurrencyFull(value), name === 'cumulative' ? 'Cumulative' : 'Stage']}
                  labelFormatter={(label) => `Stage: ${label}`}
                />
                <Area 
                  type="monotone" 
                  dataKey="cumulative" 
                  stroke="hsl(var(--destructive))" 
                  strokeWidth={2}
                  fill="url(#colorReactive)" 
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div className="grid grid-cols-4 gap-1 sm:gap-4 mt-3 sm:mt-4 pt-3 sm:pt-4 border-t border-border">
            {costCurveData.map(item => (
              <div key={item.stage} className="text-center">
                <p className="text-[10px] sm:text-xs text-muted-foreground">{item.stage}</p>
                <p className="text-xs sm:text-sm font-semibold text-foreground">{formatCurrency(item.reactiveSpend)}</p>
                <p className="text-[10px] text-muted-foreground hidden sm:block">{item.count} claims</p>
              </div>
            ))}
          </div>
        </div>

        {/* Spend Comparison by Stage */}
        <div 
          className="bg-card border-2 border-[#0c2340]/20 rounded-xl p-3 sm:p-5 cursor-pointer hover:border-[#0c2340]/50 transition-colors shadow-md"
          onDoubleClick={handleExportCostCurve}
          title="Double-click to export"
        >
          <div className="flex items-center gap-2 mb-1">
            <div className="w-1 h-5 bg-[#b41e1e] rounded"></div>
            <h3 className="text-xs sm:text-sm font-semibold text-[#0c2340] uppercase tracking-wide">Expert vs Reactive</h3>
          </div>
          <p className="text-[10px] sm:text-xs text-muted-foreground mb-3 sm:mb-4 ml-3">By litigation stage</p>
          
          <div className="h-48 sm:h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={costCurveData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis 
                  dataKey="stage" 
                  stroke="hsl(var(--muted-foreground))" 
                  fontSize={10}
                  tickLine={false}
                />
                <YAxis 
                  stroke="hsl(var(--muted-foreground))" 
                  fontSize={10}
                  tickFormatter={(v) => formatCurrency(v)}
                  tickLine={false}
                  axisLine={false}
                  width={45}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--card))', 
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                    fontSize: '11px'
                  }}
                  formatter={(value: number, name: string) => [formatCurrencyFull(value), name === 'expertSpend' ? 'Expert' : 'Reactive']}
                />
                <Bar dataKey="expertSpend" fill="hsl(var(--success))" radius={[4, 4, 0, 0]} name="Expert Spend" />
                <Bar dataKey="reactiveSpend" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} name="Reactive Spend" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="flex gap-4 sm:gap-6 mt-3 sm:mt-4 pt-3 sm:pt-4 border-t border-border justify-center">
            <div className="flex items-center gap-1.5 sm:gap-2">
              <div className="w-2 h-2 sm:w-3 sm:h-3 rounded bg-success"></div>
              <span className="text-[10px] sm:text-xs text-muted-foreground">Expert</span>
            </div>
            <div className="flex items-center gap-1.5 sm:gap-2">
              <div className="w-2 h-2 sm:w-3 sm:h-3 rounded bg-destructive"></div>
              <span className="text-[10px] sm:text-xs text-muted-foreground">Reactive</span>
            </div>
          </div>
        </div>
      </div>

      {/* Executive Review Required */}
      <div 
        className="bg-card border-2 border-[#0c2340]/20 rounded-xl p-3 sm:p-5 cursor-pointer hover:border-[#0c2340]/50 transition-colors shadow-md"
        onDoubleClick={handleExportExecutiveReview}
        title="Double-click to export all cases"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-4 mb-3 sm:mb-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <div className="w-1 h-5 bg-[#b41e1e] rounded"></div>
              <h3 className="text-xs sm:text-sm font-semibold text-[#0c2340] uppercase tracking-wide">Executive Review</h3>
              <span className="text-[10px] sm:text-xs font-bold text-[#b41e1e] bg-[#b41e1e]/10 px-1.5 sm:px-2 py-0.5 rounded-full">
                {executiveReviewCases.length}
              </span>
            </div>
            <p className="text-[10px] sm:text-xs text-muted-foreground ml-3 hidden sm:block">
              Click to correlate with open inventory
            </p>
          </div>
          <div className="flex items-center gap-2 sm:gap-4 flex-wrap">
            <div className="flex items-center gap-2 sm:gap-3 text-[10px] sm:text-xs">
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-[#b41e1e] animate-pulse"></span>
                <span className="hidden sm:inline">CRITICAL</span> ({executiveReviewCases.filter(c => c.executiveReview.level === 'CRITICAL').length})
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                <span className="hidden sm:inline">REQUIRED</span> ({executiveReviewCases.filter(c => c.executiveReview.level === 'REQUIRED').length})
              </span>
            </div>
            {executiveReviewCases.length > 8 && (
              <Button
                variant="outline"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowAllBombs(!showAllBombs);
                }}
                className="text-[10px] sm:text-xs h-6 sm:h-7 px-2"
              >
                {showAllBombs ? (
                  <>Less <ChevronUp className="ml-1 h-3 w-3" /></>
                ) : (
                  <>All ({executiveReviewCases.length}) <ChevronDown className="ml-1 h-3 w-3" /></>
                )}
              </Button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3 max-h-[400px] sm:max-h-[600px] overflow-y-auto">
          {(showAllBombs ? executiveReviewCases : executiveReviewCases.slice(0, 8)).map((caseItem, idx) => (
            <div
              key={caseItem.uniqueRecord}
              className="relative text-left p-2 sm:p-4 rounded-lg border-2 border-[#0c2340]/10 bg-gradient-to-br from-white to-gray-50 hover:from-gray-50 hover:to-gray-100 transition-all hover:border-[#0c2340]/30 group shadow-sm cursor-pointer"
              onClick={() => onDrilldown(caseItem.uniqueRecord)}
              onDoubleClick={(e) => {
                e.stopPropagation();
                handleExportClaim(caseItem);
              }}
            >
              {/* SMS Button */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedCaseForSMS({
                    matterId: caseItem.matterId,
                    exposure: caseItem.expense,
                    stage: caseItem.stage,
                    adjuster: caseItem.adjuster,
                    level: caseItem.executiveReview.level,
                  });
                  setSmsDialogOpen(true);
                }}
                className="absolute top-2 right-2 p-1.5 rounded-md bg-primary/10 hover:bg-primary/20 text-primary sm:opacity-0 sm:group-hover:opacity-100 transition-opacity z-10"
                title="Send SMS Alert"
              >
                <MessageSquare className="h-3.5 w-3.5" />
              </button>
              <div className="flex items-start justify-between mb-2">
                <span className="text-xs font-mono text-[#0c2340]/60">#{idx + 1}</span>
                <TooltipProvider>
                  <ShadcnTooltip>
                    <TooltipTrigger asChild>
                      <div className="flex items-center gap-2 cursor-help">
                        <span className={`text-sm font-bold ${
                          caseItem.executiveReview.level === 'CRITICAL' ? 'text-[#b41e1e]' : 'text-amber-600'
                        }`}>
                          {caseItem.executiveReview.score}pts
                        </span>
                        <span className={`w-2.5 h-2.5 rounded-full ${
                          caseItem.executiveReview.level === 'CRITICAL' ? 'bg-[#b41e1e] animate-pulse' : 'bg-amber-500'
                        }`}></span>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="left" className="max-w-xs p-3 text-xs">
                      <p className="font-bold mb-2 text-foreground">Score Formula:</p>
                      <div className="space-y-1 text-muted-foreground">
                        <p>• Age 7+ yr: +40pts</p>
                        <p>• Age 5-6 yr: +25pts</p>
                        <p>• Age 3-4 yr: +10pts</p>
                        <p>• Late stage + $0 expert: +20pts</p>
                        <p>• High reactive, no expert: +15pts</p>
                        <p>• Pain escalation 4+: +20pts</p>
                        <p>• Pain level 9-10: +15pts</p>
                        <p>• Large loss / L3L: +15pts</p>
                      </div>
                      <div className="mt-2 pt-2 border-t border-border">
                        <p className="text-muted-foreground">CRITICAL: 50+pts • REQUIRED: 30-49pts</p>
                      </div>
                    </TooltipContent>
                  </ShadcnTooltip>
                </TooltipProvider>
              </div>
              
              {/* Matter ID - Primary Identifier for correlation */}
              <p className="text-base font-bold text-[#0c2340] truncate mb-2 group-hover:text-[#b41e1e] transition-colors font-mono">
                {formatClaimNumber(caseItem.matterId)}
              </p>
              
              {/* Score breakdown - all reasons */}
              <div className="space-y-1 text-[10px]">
                {caseItem.executiveReview.reasons.map((reason, rIdx) => (
                  <div key={rIdx} className="flex items-start gap-1.5 text-[#b41e1e]/90">
                    <span className="text-[#b41e1e] mt-0.5">•</span>
                    <span className="leading-tight">{reason}</span>
                  </div>
                ))}
              </div>
              
              <p className="text-[10px] text-gray-500 mt-2 pt-1 border-t border-[#0c2340]/10 truncate">
                {caseItem.adjuster} • {caseItem.stage} • {caseItem.claimAge}yr old
              </p>
            </div>
          ))}
        </div>

        {executiveReviewCases.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            <p>No files requiring executive review in current filter selection</p>
          </div>
        )}
      </div>
      
      {/* SMS Dialog */}
      {selectedCaseForSMS && (
        <SMSDialog
          open={smsDialogOpen}
          onClose={() => {
            setSmsDialogOpen(false);
            setSelectedCaseForSMS(null);
          }}
          context={{
            matterId: selectedCaseForSMS.matterId,
            exposure: selectedCaseForSMS.exposure,
            phase: selectedCaseForSMS.stage,
            actionRequired: `${selectedCaseForSMS.level} review - ${selectedCaseForSMS.adjuster}`
          }}
        />
      )}
    </div>
  );
}
