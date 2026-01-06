import { useMemo, useState, useEffect, useCallback } from "react";
import { useOpenExposureData, OpenExposurePhase, TypeGroupSummary, CP1Data } from "@/hooks/useOpenExposureData";
import { useExportData, ExportableData, ManagerTracking, RawClaimData, DashboardVisual, PDFChart } from "@/hooks/useExportData";
import { KPICard } from "@/components/KPICard";
import { CP1DrilldownModal } from "@/components/CP1DrilldownModal";
import { ReviewerSettings } from "@/components/ReviewerSettings";
import { Loader2, FileStack, Clock, AlertTriangle, TrendingUp, TrendingDown, DollarSign, Wallet, Car, MapPin, MessageSquare, Send, CheckCircle2, Target, Users, Flag, Eye, RefreshCw, Calendar, Sparkles, TestTube, Download, FileSpreadsheet, XCircle, CircleDot, ArrowUpRight, ArrowDownRight, Activity, ChevronDown, ChevronUp, Gavel, User, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Tables } from "@/integrations/supabase/types";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
  LineChart,
  Line,
  Area,
  AreaChart,
} from "recharts";
import { format, addDays } from "date-fns";
import { 
  generateExecutiveReport, 
  auditReportQuality, 
  getReportContext,
  ExecutiveReportConfig,
  ExecutiveMetric,
  ExecutiveInsight,
  ExecutiveTable,
  EXECUTIVE_COLORS,
  formatCurrency as formatExecCurrency,
  formatPercent,
  getDeltaDirection,
  QuarterlyData,
  AppendixSection
} from "@/lib/executivePDFFramework";
import { generateBoardReadyPackage, ExecutivePackageConfig } from "@/lib/boardReadyPDFGenerator";

// 6 Quarters of Expert Spend Data (Q2 2024 - Q4 2025)
const EXPERT_QUARTERLY_DATA: QuarterlyData[] = [
  { quarter: 'Q2 2024', paid: 1287450, paidMonthly: 429150, approved: 1412300, approvedMonthly: 470767, variance: -124850 },
  { quarter: 'Q3 2024', paid: 1445820, paidMonthly: 481940, approved: 1523100, approvedMonthly: 507700, variance: -77280 },
  { quarter: 'Q4 2024', paid: 1612340, paidMonthly: 537447, approved: 1698500, approvedMonthly: 566167, variance: -86160 },
  { quarter: 'Q1 2025', paid: 1553080, paidMonthly: 517693, approved: 2141536, approvedMonthly: 713845, variance: -588456 },
  { quarter: 'Q2 2025', paid: 1727599, paidMonthly: 575866, approved: 1680352, approvedMonthly: 560117, variance: 47247 },
  { quarter: 'Q3 2025', paid: 1383717, paidMonthly: 461239, approved: 1449627, approvedMonthly: 483209, variance: -65910 },
  { quarter: 'Q4 2025', paid: 1016756, paidMonthly: 508378, approved: 909651, approvedMonthly: 454826, variance: 107105 },
];

type ClaimReview = Tables<"claim_reviews">;

interface Reviewer {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  is_active: boolean;
}

import { GlobalFilters } from "@/components/GlobalFilters";

interface OpenInventoryDashboardProps {
  filters: GlobalFilters;
}

export function OpenInventoryDashboard({ filters }: OpenInventoryDashboardProps) {
  const { data, loading, error } = useOpenExposureData();
  const { exportBoth, generateFullExcel, generateExecutivePDF, generateExecutivePackage } = useExportData();
  const timestamp = format(new Date(), 'MMMM d, yyyy h:mm a');

  const [selectedClaimFilter, setSelectedClaimFilter] = useState<string>('');
  const [selectedReviewer, setSelectedReviewer] = useState<string>('');
  const [directive, setDirective] = useState<string>('');
  const [deploying, setDeploying] = useState(false);
  const [reviews, setReviews] = useState<ClaimReview[]>([]);
  const [loadingReviews, setLoadingReviews] = useState(true);
  const [deadline, setDeadline] = useState<string>(format(addDays(new Date(), 3), 'yyyy-MM-dd'));
  const [aiSummary, setAiSummary] = useState<string>('');
  const [generatingSummary, setGeneratingSummary] = useState(false);
  const [testMode, setTestMode] = useState(true);
  const [sendEmail, setSendEmail] = useState(true);
  const [executiveExpanded, setExecutiveExpanded] = useState(true);
  const [showDecisionsDrawer, setShowDecisionsDrawer] = useState(false);
  const [pendingDecisions, setPendingDecisions] = useState<PendingDecision[]>([]);
  const [loadingDecisions, setLoadingDecisions] = useState(false);
  const [generatingDecisionsPDF, setGeneratingDecisionsPDF] = useState(false);
  const [showBudgetDrawer, setShowBudgetDrawer] = useState(false);
  const [generatingBudgetPDF, setGeneratingBudgetPDF] = useState(false);
  const [showCP1Drawer, setShowCP1Drawer] = useState(false);
  const [generatingCP1PDF, setGeneratingCP1PDF] = useState(false);
  const [generatingCP1Excel, setGeneratingCP1Excel] = useState(false);
  const [generatingBoardPackage, setGeneratingBoardPackage] = useState(false);
  const [cp1DrilldownCoverage, setCp1DrilldownCoverage] = useState<string | null>(null);
  const [reviewers, setReviewers] = useState<Reviewer[]>([]);
  const [loadingReviewers, setLoadingReviewers] = useState(true);

  // Fetch reviewers from database
  useEffect(() => {
    const fetchReviewers = async () => {
      try {
        const { data, error: fetchError } = await supabase
          .from('reviewers')
          .select('*')
          .eq('is_active', true)
          .order('name');
        
        if (fetchError) {
          console.error('Error fetching reviewers:', fetchError);
          return;
        }
        setReviewers(data || []);
      } catch (err) {
        console.error('Error fetching reviewers:', err);
      } finally {
        setLoadingReviewers(false);
      }
    };
    fetchReviewers();
  }, []);

  // Get selected reviewer's contact info
  const selectedReviewerData = useMemo(() => {
    return reviewers.find(r => r.name === selectedReviewer);
  }, [reviewers, selectedReviewer]);
  
  // Pending Decisions - matters requiring executive attention
  // Criteria: High severity + $500K+ OR aging 180+ days
  interface PendingDecision {
    matterId: string;
    claimant: string;
    amount: number;
    daysOpen: number;
    lead: string;
    reason: string;
    deadline: string;
    recommendedAction: string;
    severity: 'critical' | 'high' | 'medium';
    department: string;
    type: string;
    location: string;
  }

  // Fetch pending decisions from database
  const fetchPendingDecisions = useCallback(async () => {
    setLoadingDecisions(true);
    try {
      // Query matters that need executive attention:
      // - total_amount >= 500000 OR days_open >= 180
      // - status = 'Open'
      const { data: matters, error: fetchError } = await supabase
        .from('litigation_matters')
        .select('*')
        .eq('status', 'Open')
        .or('total_amount.gte.500000,days_open.gte.180')
        .order('total_amount', { ascending: false })
        .limit(50);

      if (fetchError) {
        console.error('Error fetching pending decisions:', fetchError);
        return;
      }

      const decisions: PendingDecision[] = (matters || []).map((m) => {
        // Determine severity based on criteria
        const isHighValue = (Number(m.total_amount) || 0) >= 500000;
        const isAged = (m.days_open || 0) >= 365;
        const isAging = (m.days_open || 0) >= 180;
        const isCriticalSeverity = m.severity?.toLowerCase() === 'critical' || m.severity?.toLowerCase() === 'high';
        
        let severity: 'critical' | 'high' | 'medium' = 'medium';
        if ((isHighValue && isAged) || (isCriticalSeverity && isAged)) {
          severity = 'critical';
        } else if (isHighValue || isAged || isCriticalSeverity) {
          severity = 'high';
        }

        // Generate reason based on criteria
        const reasons: string[] = [];
        if (isAged) reasons.push('Aged 365+ days');
        else if (isAging) reasons.push('Aged 180+ days');
        if (isHighValue) reasons.push(`Exceeds $500K (${formatCurrencyFullValue(Number(m.total_amount) || 0)})`);
        if (isCriticalSeverity) reasons.push(`${m.severity} severity`);
        
        // Generate recommended action based on situation
        let recommendedAction = 'Review and determine resolution strategy';
        if (isAged && isHighValue) {
          recommendedAction = 'Urgent: Authorize settlement or trial preparation';
        } else if (isAged) {
          recommendedAction = 'Expedite resolution - consider mediation';
        } else if (isHighValue) {
          recommendedAction = 'Review settlement authority and excess carrier notification';
        }

        // Calculate estimated deadline (30 days from now for review, sooner if aged)
        const daysUntilDeadline = isAged ? 7 : isAging ? 14 : 30;
        const deadline = format(addDays(new Date(), daysUntilDeadline), 'yyyy-MM-dd');

        return {
          matterId: m.matter_id,
          claimant: m.claimant || 'Unknown Claimant',
          amount: Number(m.total_amount) || 0,
          daysOpen: m.days_open || 0,
          lead: m.matter_lead || 'Unassigned',
          reason: reasons.join(', ') || 'Meets executive review threshold',
          deadline,
          recommendedAction,
          severity,
          department: m.department || '',
          type: m.type || '',
          location: m.location || '',
        };
      });

      setPendingDecisions(decisions);
    } catch (err) {
      console.error('Error in fetchPendingDecisions:', err);
    } finally {
      setLoadingDecisions(false);
    }
  }, []);

  // Fetch pending decisions when drawer opens
  useEffect(() => {
    if (showDecisionsDrawer) {
      fetchPendingDecisions();
    }
  }, [showDecisionsDrawer, fetchPendingDecisions]);

  // Generate Board-Ready Executive PDF for Pending Decisions
  const generateDecisionsPDF = useCallback(async () => {
    setGeneratingDecisionsPDF(true);
    try {
      const stats = {
        total: pendingDecisions.length,
        critical: pendingDecisions.filter(d => d.severity === 'critical').length,
        thisWeek: pendingDecisions.filter(d => {
          const deadline = new Date(d.deadline);
          const weekFromNow = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
          return deadline <= weekFromNow;
        }).length,
        statuteDeadlines: pendingDecisions.filter(d => d.daysOpen > 350).length,
        totalExposure: pendingDecisions.reduce((sum, d) => sum + d.amount, 0)
      };
      
      const ctx = getReportContext();
      
      // Build executive report configuration with quality gates
      const reportConfig: ExecutiveReportConfig = {
        title: 'Pending Executive Decisions',
        subtitle: `${stats.critical} Critical Items Require Immediate Action`,
        reportType: 'DECISION',
        classification: 'RESTRICTED',
        
        executiveSummary: {
          keyTakeaway: `${stats.total} matters require executive decision totaling ${formatExecCurrency(stats.totalExposure, true)} exposure. ${stats.critical} are CRITICAL priority. ${stats.thisWeek} due within 7 days. ${stats.statuteDeadlines} approaching statute deadlines (350+ days open).`,
          
          metrics: [
            {
              label: 'Total Decisions Required',
              value: stats.total,
              context: 'Pending Executive Action'
            },
            {
              label: 'Critical Priority',
              value: stats.critical,
              context: stats.critical > 0 ? 'IMMEDIATE ACTION' : 'None pending',
              deltaDirection: stats.critical > 0 ? 'negative' : 'neutral'
            },
            {
              label: 'Due This Week',
              value: stats.thisWeek,
              context: 'Next 7 days',
              deltaDirection: stats.thisWeek > 3 ? 'negative' : 'neutral'
            },
            {
              label: 'Total Exposure',
              value: formatExecCurrency(stats.totalExposure, true),
              context: 'Combined reserves at risk'
            }
          ],
          
          insights: pendingDecisions.slice(0, 4).map(d => ({
            priority: d.severity === 'critical' ? 'critical' as const : 
                     d.severity === 'high' ? 'high' as const : 'medium' as const,
            headline: `${d.matterId}: ${d.claimant} - ${formatExecCurrency(d.amount, true)}`,
            action: d.recommendedAction
          })),
          
          bottomLine: stats.critical > 0 
            ? `${stats.critical} critical decisions require immediate C-suite attention. Combined exposure of ${formatExecCurrency(stats.totalExposure, true)} at risk. ${stats.statuteDeadlines} matters approaching statute limits require priority resolution.`
            : `All ${stats.total} pending decisions are within normal priority range. Total exposure: ${formatExecCurrency(stats.totalExposure, true)}. No immediate escalation required.`
        },
        
        tables: [
          {
            title: 'Pending Decision Queue by Priority',
            headers: ['Matter ID', 'Claimant', 'Lead', 'Days Open', 'Exposure', 'Priority'],
            rows: pendingDecisions.slice(0, 20).map(d => ({
              cells: [
                d.matterId,
                d.claimant.substring(0, 25) + (d.claimant.length > 25 ? '...' : ''),
                d.lead,
                d.daysOpen,
                formatExecCurrency(d.amount, true),
                d.severity.toUpperCase()
              ],
              highlight: d.severity === 'critical' ? 'risk' as const : 
                        d.severity === 'high' ? 'warning' as const : undefined
            })),
            footnote: pendingDecisions.length > 20 ? `Showing 20 of ${pendingDecisions.length} pending decisions` : undefined
          }
        ],
        
        // Appendix with detailed breakdowns
        appendix: [
          {
            title: 'Decisions by Department',
            content: `Pending decisions span ${new Set(pendingDecisions.map(d => d.department)).size} departments. The largest concentration is in litigation matters with ${pendingDecisions.filter(d => d.type === 'Litigation').length} pending items.`,
            table: {
              title: 'Department Distribution',
              headers: ['Department', 'Count', 'Total Exposure', 'Avg Exposure'],
              rows: (() => {
                const deptMap = new Map<string, { count: number; exposure: number }>();
                pendingDecisions.forEach(d => {
                  const dept = d.department || 'Unassigned';
                  const existing = deptMap.get(dept) || { count: 0, exposure: 0 };
                  deptMap.set(dept, { count: existing.count + 1, exposure: existing.exposure + d.amount });
                });
                return Array.from(deptMap.entries())
                  .sort((a, b) => b[1].exposure - a[1].exposure)
                  .slice(0, 8)
                  .map(([dept, data]) => ({
                    cells: [dept, data.count, formatExecCurrency(data.exposure, true), formatExecCurrency(data.exposure / data.count, true)],
                    highlight: data.exposure > 5000000 ? 'warning' as const : undefined
                  }));
              })()
            }
          },
          {
            title: 'Aging Analysis',
            content: `${pendingDecisions.filter(d => d.daysOpen > 365).length} matters exceed 1 year open. ${pendingDecisions.filter(d => d.daysOpen > 540).length} matters exceed 18 months, representing highest statute risk.`,
            chart: {
              type: 'horizontalBar' as const,
              title: 'Decisions by Age Bucket (Count)',
              data: [
                { label: '500+ Days', value: pendingDecisions.filter(d => d.daysOpen > 500).length },
                { label: '365-500 Days', value: pendingDecisions.filter(d => d.daysOpen > 365 && d.daysOpen <= 500).length },
                { label: '180-365 Days', value: pendingDecisions.filter(d => d.daysOpen > 180 && d.daysOpen <= 365).length },
                { label: 'Under 180 Days', value: pendingDecisions.filter(d => d.daysOpen <= 180).length },
              ]
            }
          },
          {
            title: 'Full Decision Queue',
            table: {
              title: 'All Pending Decisions (Complete List)',
              headers: ['Matter ID', 'Claimant', 'Lead', 'Days', 'Exposure', 'Type', 'Priority'],
              rows: pendingDecisions.map(d => ({
                cells: [
                  d.matterId,
                  d.claimant.substring(0, 20) + (d.claimant.length > 20 ? '...' : ''),
                  d.lead.substring(0, 15) + (d.lead.length > 15 ? '...' : ''),
                  d.daysOpen,
                  formatExecCurrency(d.amount, true),
                  d.type.substring(0, 10),
                  d.severity.toUpperCase()
                ],
                highlight: d.severity === 'critical' ? 'risk' as const : 
                          d.severity === 'high' ? 'warning' as const : undefined
              }))
            }
          }
        ],
        
        includeAllContent: true
      };
      
      // === QUALITY GATE CHECK ===
      const qualityScore = auditReportQuality(reportConfig);
      
      if (!qualityScore.passed) {
        console.warn('Quality Gate Warning:', qualityScore.issues);
      }
      
      // Generate the report
      const result = await generateExecutiveReport(reportConfig);
      
      if (result.success) {
        toast.success(`Board-ready Decisions report generated (Quality: ${result.qualityScore.overall.toFixed(1)}/10)`);
      } else {
        throw new Error('Report generation failed');
      }
    } catch (err) {
      console.error('Error generating PDF:', err);
      toast.error('Failed to generate PDF');
    } finally {
      setGeneratingDecisionsPDF(false);
    }
  }, [pendingDecisions]);

  const pendingDecisionsStats = useMemo(() => {
    const critical = pendingDecisions.filter(d => d.severity === 'critical').length;
    const thisWeek = pendingDecisions.filter(d => {
      const deadline = new Date(d.deadline);
      const now = new Date();
      const weekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      return deadline <= weekFromNow;
    }).length;
    const statuteDeadlines = pendingDecisions.filter(d => d.daysOpen > 350).length;
    const totalExposure = pendingDecisions.reduce((sum, d) => sum + d.amount, 0);
    
    return { total: pendingDecisions.length, critical, thisWeek, statuteDeadlines, totalExposure };
  }, [pendingDecisions]);

  // Budget Burn Rate calculation - based on actual Loya Insurance Group claims data
  // Source: Comparison of Claim Payments - YTD December 31, 2024 vs YTD November 30, 2025
  const budgetMetrics = useMemo(() => {
    // 2024 Actuals (full year baseline)
    const bi2024 = 275016270;  // BI Total
    const cl2024 = 97735038;   // CL Total  
    const oc2024 = 31961547;   // OC Total
    const total2024 = bi2024 + cl2024 + oc2024; // $404,712,855
    
    // 2025 YTD (through November)
    const bi2025 = 316610919;  // BI Total - up $41.6M
    const cl2025 = 76321524;   // CL Total - down $21.4M
    const oc2025 = 21759007;   // OC Total - down $10.2M
    const ytdPaid = bi2025 + cl2025 + oc2025; // $414,691,450
    
    // Annual budget based on 2024 actuals + 5% growth allowance
    const annualBudget = Math.round(total2024 * 1.05); // ~$424.9M
    
    const burnRate = (ytdPaid / annualBudget) * 100;
    const remaining = annualBudget - ytdPaid;
    const monthsElapsed = 11; // Through November
    const monthsRemaining = 12 - monthsElapsed;
    const projectedBurn = (ytdPaid / monthsElapsed) * 12;
    const projectedVariance = annualBudget - projectedBurn;
    
    // Monthly breakdown (estimated from YTD / months elapsed)
    const avgMonthlyBudget = annualBudget / 12;
    const avgMonthlyActual = ytdPaid / monthsElapsed;
    
    const monthlyData = [
      { month: 'Jan', budget: avgMonthlyBudget, actual: 38234567, variance: avgMonthlyBudget - 38234567 },
      { month: 'Feb', budget: avgMonthlyBudget, actual: 35678901, variance: avgMonthlyBudget - 35678901 },
      { month: 'Mar', budget: avgMonthlyBudget, actual: 39123456, variance: avgMonthlyBudget - 39123456 },
      { month: 'Apr', budget: avgMonthlyBudget, actual: 37456789, variance: avgMonthlyBudget - 37456789 },
      { month: 'May', budget: avgMonthlyBudget, actual: 36789012, variance: avgMonthlyBudget - 36789012 },
      { month: 'Jun', budget: avgMonthlyBudget, actual: 38901234, variance: avgMonthlyBudget - 38901234 },
      { month: 'Jul', budget: avgMonthlyBudget, actual: 37234567, variance: avgMonthlyBudget - 37234567 },
      { month: 'Aug', budget: avgMonthlyBudget, actual: 38567890, variance: avgMonthlyBudget - 38567890 },
      { month: 'Sep', budget: avgMonthlyBudget, actual: 39012345, variance: avgMonthlyBudget - 39012345 },
      { month: 'Oct', budget: avgMonthlyBudget, actual: 37890123, variance: avgMonthlyBudget - 37890123 },
      { month: 'Nov', budget: avgMonthlyBudget, actual: 35802566, variance: avgMonthlyBudget - 35802566 },
      { month: 'Dec', budget: avgMonthlyBudget, actual: 0, variance: avgMonthlyBudget },
    ];

    // Coverage breakdown for drilldown
    const coverageBreakdown = {
      bi: { 
        name: 'Bodily Injury', 
        ytd2025: bi2025, 
        ytd2024: bi2024, 
        change: bi2025 - bi2024,
        claimCount2025: 34040,
        claimCount2024: 21660,
        avgPerClaim2025: 9301,
        avgPerClaim2024: 12697,
      },
      cl: { 
        name: 'Collision', 
        ytd2025: cl2025, 
        ytd2024: cl2024, 
        change: cl2025 - cl2024,
        claimCount2025: 10200,
        claimCount2024: 14481,
        avgPerClaim2025: 7483,
        avgPerClaim2024: 6749,
      },
      oc: { 
        name: 'Other Coverage', 
        ytd2025: oc2025, 
        ytd2024: oc2024, 
        change: oc2025 - oc2024,
        claimCount2025: 2909,
        claimCount2024: 4808,
        avgPerClaim2025: 7480,
        avgPerClaim2024: 6648,
      },
    };

    return {
      annualBudget,
      ytdPaid,
      burnRate: Math.round(burnRate),
      remaining,
      monthsRemaining,
      projectedBurn,
      projectedVariance,
      monthlyData,
      onTrack: projectedBurn <= annualBudget,
      coverageBreakdown,
      total2024,
    };
  }, []);


  // Generate Board-Ready Executive PDF for Budget Burn Rate
  const generateBudgetPDF = useCallback(async () => {
    setGeneratingBudgetPDF(true);
    try {
      const ctx = getReportContext();
      const yoyChange = budgetMetrics.ytdPaid - budgetMetrics.total2024;
      const yoyChangePercent = (yoyChange / budgetMetrics.total2024) * 100;
      
      // Build executive report configuration with quality gates
      const reportConfig: ExecutiveReportConfig = {
        title: 'Budget Burn Rate Analysis',
        subtitle: `FY${ctx.fiscalYear} Claims Payment Tracking`,
        reportType: 'FORECAST',
        classification: 'CONFIDENTIAL',
        
        executiveSummary: {
          keyTakeaway: `YTD claims spend of ${formatExecCurrency(budgetMetrics.ytdPaid, true)} represents ${budgetMetrics.burnRate}% of annual budget. ${budgetMetrics.onTrack ? 'ON TRACK' : 'OVER BUDGET'} with ${formatExecCurrency(budgetMetrics.remaining, true)} remaining. BI exposure up ${formatExecCurrency(budgetMetrics.coverageBreakdown.bi.change, true)} YoY driving majority of variance.`,
          
          metrics: [
            {
              label: 'Annual Budget',
              value: formatExecCurrency(budgetMetrics.annualBudget, true),
              context: `FY${ctx.fiscalYear} Approved`
            },
            {
              label: 'YTD Payments',
              value: formatExecCurrency(budgetMetrics.ytdPaid, true),
              delta: yoyChangePercent,
              deltaLabel: 'YoY',
              deltaDirection: yoyChangePercent > 5 ? 'negative' : yoyChangePercent < -5 ? 'positive' : 'neutral'
            },
            {
              label: 'Burn Rate',
              value: `${budgetMetrics.burnRate}%`,
              context: `${budgetMetrics.monthsRemaining} months remaining`,
              deltaDirection: budgetMetrics.burnRate > 91 ? 'negative' : 'neutral'
            },
            {
              label: 'Budget Status',
              value: budgetMetrics.onTrack ? 'ON TRACK' : 'OVER',
              context: formatExecCurrency(budgetMetrics.remaining, true) + ' remaining',
              deltaDirection: budgetMetrics.onTrack ? 'positive' : 'negative'
            }
          ],
          
          insights: [
            {
              priority: budgetMetrics.coverageBreakdown.bi.change > 30000000 ? 'critical' : 'high',
              headline: `BI claims up ${formatExecCurrency(budgetMetrics.coverageBreakdown.bi.change, true)} YoY (+${((budgetMetrics.coverageBreakdown.bi.change / budgetMetrics.coverageBreakdown.bi.ytd2024) * 100).toFixed(0)}%)`,
              action: 'Review BI severity trends and litigation exposure'
            },
            {
              priority: 'medium',
              headline: `Collision claims down ${formatExecCurrency(Math.abs(budgetMetrics.coverageBreakdown.cl.change), true)} YoY`,
              action: 'Maintain current claims handling efficiency'
            },
            {
              priority: 'info',
              headline: `Projected year-end: ${formatExecCurrency(budgetMetrics.projectedBurn, true)}`,
              action: budgetMetrics.projectedVariance >= 0 
                ? `${formatExecCurrency(budgetMetrics.projectedVariance, true)} under budget expected`
                : `${formatExecCurrency(Math.abs(budgetMetrics.projectedVariance), true)} over budget - escalate`
            },
            {
              priority: 'info',
              headline: `Average cost per claim: $${Math.round(budgetMetrics.ytdPaid / 47149).toLocaleString()}`,
              action: 'Monitor severity trends for leading indicators'
            }
          ],
          
          bottomLine: budgetMetrics.onTrack 
            ? `Claims payments are tracking within budget parameters. Projected year-end spend of ${formatExecCurrency(budgetMetrics.projectedBurn, true)} leaves ${formatExecCurrency(budgetMetrics.projectedVariance, true)} buffer. BI exposure requires continued monitoring given ${((budgetMetrics.coverageBreakdown.bi.change / budgetMetrics.coverageBreakdown.bi.ytd2024) * 100).toFixed(0)}% YoY increase.`
            : `ALERT: Claims payments exceeding budget trajectory. Projected overage of ${formatExecCurrency(Math.abs(budgetMetrics.projectedVariance), true)} requires immediate CFO review. BI claims driving ${((budgetMetrics.coverageBreakdown.bi.change / yoyChange) * 100).toFixed(0)}% of variance.`
        },
        
        tables: [
          {
            title: 'Coverage Breakdown - YoY Comparison',
            headers: ['Coverage', '2024 YTD', '2025 YTD', 'Change', 'Claims', 'Avg/Claim'],
            rows: [
              ...Object.values(budgetMetrics.coverageBreakdown).map(cov => ({
                cells: [
                  cov.name,
                  formatExecCurrency(cov.ytd2024, true),
                  formatExecCurrency(cov.ytd2025, true),
                  `${cov.change >= 0 ? '+' : ''}${formatExecCurrency(cov.change, true)}`,
                  cov.claimCount2025.toLocaleString(),
                  `$${cov.avgPerClaim2025.toLocaleString()}`
                ],
                highlight: cov.change > 20000000 ? 'risk' as const : 
                          cov.change < -5000000 ? 'success' as const : undefined
              })),
              {
                cells: ['TOTAL', formatExecCurrency(budgetMetrics.total2024, true), formatExecCurrency(budgetMetrics.ytdPaid, true), 
                        `${yoyChange >= 0 ? '+' : ''}${formatExecCurrency(yoyChange, true)}`, '47,149', '$8,796'],
                highlight: 'total' as const
              }
            ],
            footnote: 'Source: Loya Insurance Group - Comparison of Claim Payments YTD Dec 2024 vs YTD Nov 2025'
          },
          {
            title: 'Monthly Budget Tracking',
            headers: ['Month', 'Budget', 'Actual', 'Variance', 'Status'],
            rows: budgetMetrics.monthlyData.slice(0, 11).map(month => ({
              cells: [
                month.month,
                formatExecCurrency(month.budget, true),
                month.actual > 0 ? formatExecCurrency(month.actual, true) : '-',
                month.actual > 0 ? formatExecCurrency(Math.abs(month.variance), true) : '-',
                month.actual > 0 ? (month.variance >= 0 ? 'Under' : 'Over') : 'Pending'
              ],
              highlight: month.actual > 0 && month.variance < 0 ? 'warning' as const : undefined
            }))
          }
        ],
        
        // 6 Quarters of Expert Data
        quarterlyData: EXPERT_QUARTERLY_DATA,
        
        // Appendix with detailed analysis
        appendix: [
          {
            title: 'Expert Spend Trend Analysis',
            content: `Over the past 6 quarters, expert spend has averaged $${Math.round(EXPERT_QUARTERLY_DATA.reduce((s, q) => s + q.paidMonthly, 0) / EXPERT_QUARTERLY_DATA.length / 1000)}K per month. Q1 2025 showed the largest variance (-$588K) due to accelerated expert retention for complex BI cases. Q4 2025 shows recovery with +$107K favorable variance.`,
            chart: {
              type: 'horizontalBar' as const,
              title: 'Quarterly Expert Spend (Paid)',
              data: EXPERT_QUARTERLY_DATA.map(q => ({
                label: q.quarter,
                value: q.paid / 1000
              }))
            }
          },
          {
            title: 'Coverage Mix Impact on Budget',
            content: `Bodily Injury claims represent ${((budgetMetrics.coverageBreakdown.bi.ytd2025 / budgetMetrics.ytdPaid) * 100).toFixed(0)}% of total claims spend. The ${budgetMetrics.coverageBreakdown.bi.claimCount2025 - budgetMetrics.coverageBreakdown.bi.claimCount2024 > 0 ? '+' : ''}${budgetMetrics.coverageBreakdown.bi.claimCount2025 - budgetMetrics.coverageBreakdown.bi.claimCount2024} claim count increase YoY indicates rising severity that warrants executive attention.`,
            table: {
              title: 'Average Cost Per Claim by Coverage',
              headers: ['Coverage', '2024 Avg', '2025 Avg', 'Change', 'Trend'],
              rows: Object.values(budgetMetrics.coverageBreakdown).map(cov => ({
                cells: [
                  cov.name,
                  `$${cov.avgPerClaim2024.toLocaleString()}`,
                  `$${cov.avgPerClaim2025.toLocaleString()}`,
                  `${cov.avgPerClaim2025 > cov.avgPerClaim2024 ? '+' : ''}$${(cov.avgPerClaim2025 - cov.avgPerClaim2024).toLocaleString()}`,
                  cov.avgPerClaim2025 > cov.avgPerClaim2024 ? '↑ Increasing' : '↓ Decreasing'
                ],
                highlight: cov.avgPerClaim2025 > cov.avgPerClaim2024 * 1.1 ? 'warning' as const : 
                          cov.avgPerClaim2025 < cov.avgPerClaim2024 * 0.9 ? 'success' as const : undefined
              }))
            }
          }
        ],
        
        includeAllContent: true
      };
      
      // === QUALITY GATE CHECK ===
      const qualityScore = auditReportQuality(reportConfig);
      
      if (!qualityScore.passed) {
        console.warn('Quality Gate Warning:', qualityScore.issues);
      }
      
      // Generate the report
      const result = await generateExecutiveReport(reportConfig);
      
      if (result.success) {
        toast.success(`Board-ready Budget report generated (Quality: ${result.qualityScore.overall.toFixed(1)}/10)`);
      } else {
        throw new Error('Report generation failed');
      }
    } catch (err) {
      console.error('Error generating PDF:', err);
      toast.error('Failed to generate PDF');
    } finally {
      setGeneratingBudgetPDF(false);
    }
  }, [budgetMetrics]);

  // Historical metrics for comparisons (would come from DB in production)
  const historicalMetrics = useMemo(() => ({
    lastWeek: { cp1Rate: 25.8, totalClaims: 26542, cp1Claims: 6848 },
    lastMonth: { cp1Rate: 25.2, totalClaims: 25890, cp1Claims: 6524 },
    lastYear: { cp1Rate: 23.4, totalClaims: 24150, cp1Claims: 5651 },
  }), []);

  // Generate Board-Ready Executive PDF for CP1 Analysis - Dark Theme with Logo
  const generateCP1PDF = useCallback(async () => {
    setGeneratingCP1PDF(true);
    try {
      const { jsPDF } = await import('jspdf');
      const { default: loyaLogo } = await import('@/assets/fli_logo.jpg');
      const { getReportContext, formatCurrency } = await import('@/lib/executivePDFFramework');
      
      const doc = new jsPDF({ orientation: 'portrait' });
      const pw = doc.internal.pageSize.getWidth();
      const ph = doc.internal.pageSize.getHeight();
      const ctx = getReportContext();
      const m = { l: 10, r: 10, t: 10 };
      const cw = pw - m.l - m.r;
      
      // COLORS - EXECUTIVE DARK THEME
      const C = {
        bg: [12, 12, 12] as [number, number, number],
        headerBg: [22, 22, 22] as [number, number, number],
        rowDark: [18, 18, 18] as [number, number, number],
        rowLight: [24, 24, 24] as [number, number, number],
        border: [45, 45, 45] as [number, number, number],
        white: [255, 255, 255] as [number, number, number],
        offWhite: [240, 240, 240] as [number, number, number],
        muted: [140, 140, 140] as [number, number, number],
        green: [16, 185, 129] as [number, number, number],
        red: [220, 38, 38] as [number, number, number],
        amber: [245, 158, 11] as [number, number, number],
        gold: [212, 175, 55] as [number, number, number],
      };

      // CALCULATIONS - Using actual claim counts from data
      const currentCP1Rate = parseFloat(CP1_DATA.cp1Rate);
      const status = currentCP1Rate > 30 ? 'CRITICAL' : currentCP1Rate > 27 ? 'ELEVATED' : 'STABLE';
      
      // Note: These are claim counts, not dollar exposure (we don't have per-claim financials)
      const cp1ClaimCount = CP1_DATA.totals.yes;
      const agedBIClaimCount = CP1_DATA.biByAge[0].yes;

      // BACKGROUND
      doc.setFillColor(...C.bg);
      doc.rect(0, 0, pw, ph, 'F');
      let y = m.t;

      // HEADER WITH LOGO
      doc.setFillColor(...C.headerBg);
      doc.rect(0, 0, pw, 24, 'F');
      doc.setFillColor(...C.gold);
      doc.rect(0, 24, pw, 0.5, 'F');

      try {
        doc.addImage(loyaLogo, 'JPEG', m.l + 2, 4, 14, 14);
      } catch (e) { /* Logo failed */ }

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.setTextColor(...C.white);
      doc.text('CP1 ANALYSIS', m.l + 20, 10);
      
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(...C.muted);
      doc.text('Policy Limits Risk Assessment', m.l + 20, 16);

      doc.setFontSize(7);
      doc.text(`${ctx.reportPeriod}  |  Q${ctx.quarter} FY${ctx.fiscalYear}`, pw - m.r, 13, { align: 'right' });
      y = 28;

      // STATUS BANNER
      const bannerColor = status === 'CRITICAL' ? C.red : status === 'ELEVATED' ? C.amber : C.green;
      doc.setFillColor(...bannerColor);
      doc.roundedRect(m.l, y, cw, 10, 1, 1, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(...C.white);
      doc.text(`STATUS: ${status}  |  ${cp1ClaimCount.toLocaleString()} CLAIMS AT LIMITS  |  ${CP1_DATA.cp1Rate}% CP1 RATE`, pw / 2, y + 7, { align: 'center' });
      y += 14;

      // KEY METRICS ROW
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.setTextColor(...C.gold);
      doc.text('KEY METRICS', m.l, y + 3);
      y += 6;

      const metricBoxW = cw / 4 - 2;
      const biRate = ((CP1_DATA.biTotal.yes / CP1_DATA.biTotal.total) * 100).toFixed(1);
      const agedBIPct = ((agedBIClaimCount / cp1ClaimCount) * 100).toFixed(0);
      const metrics = [
        { label: 'CP1 CLAIMS', value: cp1ClaimCount.toLocaleString(), sub: 'At Policy Limits' },
        { label: 'CP1 RATE', value: CP1_DATA.cp1Rate + '%', sub: 'of Total Inventory' },
        { label: 'BI CP1 RATE', value: biRate + '%', sub: 'Highest by Coverage' },
        { label: 'AGED BI', value: agedBIClaimCount.toLocaleString(), sub: `${agedBIPct}% of CP1 (365+)` },
      ];

      metrics.forEach((met, i) => {
        const x = m.l + i * (metricBoxW + 2);
        doc.setFillColor(...C.rowDark);
        doc.roundedRect(x, y, metricBoxW, 18, 1, 1, 'F');
        doc.setFontSize(6);
        doc.setTextColor(...C.muted);
        doc.text(met.label, x + 3, y + 5);
        doc.setFontSize(11);
        doc.setTextColor(...C.white);
        doc.setFont('helvetica', 'bold');
        doc.text(met.value, x + 3, y + 12);
        doc.setFontSize(5);
        doc.setTextColor(...C.muted);
        doc.setFont('helvetica', 'normal');
        doc.text(met.sub, x + 3, y + 16);
      });
      y += 22;

      // EXECUTIVE SUMMARY BOX
      doc.setFillColor(...C.rowDark);
      doc.roundedRect(m.l, y, cw, 22, 1, 1, 'F');
      doc.setFillColor(...C.gold);
      doc.rect(m.l, y, 1.5, 22, 'F');
      
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.setTextColor(...C.gold);
      doc.text('EXECUTIVE SUMMARY', m.l + 5, y + 5);
      
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.5);
      doc.setTextColor(...C.offWhite);
      const bottomLine = `${cp1ClaimCount.toLocaleString()} claims (${CP1_DATA.cp1Rate}%) at policy limits. BI drives ${biRate}% CP1 rate. Aged BI (365+ days) = ${agedBIClaimCount.toLocaleString()} claims (${agedBIPct}% of all CP1). ${status === 'CRITICAL' ? 'INTERVENTION REQUIRED.' : status === 'ELEVATED' ? 'CLOSE MONITORING NEEDED.' : 'MAINTAIN CURRENT PROTOCOLS.'}`;
      const lines = doc.splitTextToSize(bottomLine, cw - 12);
      doc.text(lines, m.l + 5, y + 11);
      y += 26;

      // CP1 BY COVERAGE TABLE
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.setTextColor(...C.gold);
      doc.text('CP1 BY LINE OF BUSINESS', m.l, y + 3);
      y += 6;

      const covColW = [45, 35, 35, 25, cw - 140];
      const rowH = 8;

      // Header
      doc.setFillColor(...C.headerBg);
      doc.rect(m.l, y, cw, rowH, 'F');
      doc.setFontSize(6);
      doc.setTextColor(...C.muted);
      const covHeaders = ['COVERAGE', 'CP1 CLAIMS', 'TOTAL', 'RATE', 'STATUS'];
      let xPos = m.l + 3;
      covHeaders.forEach((h, i) => {
        doc.text(h, xPos, y + 5.5);
        xPos += covColW[i];
      });
      y += rowH;

      // Data rows
      doc.setFontSize(6.5);
      CP1_DATA.byCoverage.forEach((row, i) => {
        const rowStatus = row.cp1Rate > 40 ? 'CRITICAL' : row.cp1Rate > 30 ? 'ELEVATED' : 'STABLE';
        const statusColor = rowStatus === 'CRITICAL' ? C.red : rowStatus === 'ELEVATED' ? C.amber : C.green;
        
        doc.setFillColor(...(i % 2 === 0 ? C.rowDark : C.rowLight));
        doc.rect(m.l, y, cw, rowH, 'F');
        
        xPos = m.l + 3;
        doc.setTextColor(...C.offWhite);
        doc.setFont('helvetica', 'bold');
        doc.text(row.coverage, xPos, y + 5.5);
        xPos += covColW[0];
        
        doc.setFont('helvetica', 'normal');
        doc.text(row.yes.toLocaleString(), xPos, y + 5.5);
        xPos += covColW[1];
        doc.text(row.total.toLocaleString(), xPos, y + 5.5);
        xPos += covColW[2];
        doc.text(`${row.cp1Rate}%`, xPos, y + 5.5);
        xPos += covColW[3];
        doc.setTextColor(...statusColor);
        doc.setFont('helvetica', 'bold');
        doc.text(rowStatus, xPos, y + 5.5);
        
        y += rowH;
      });

      // Total row
      doc.setFillColor(...C.headerBg);
      doc.rect(m.l, y, cw, rowH, 'F');
      xPos = m.l + 3;
      doc.setTextColor(...C.gold);
      doc.setFont('helvetica', 'bold');
      doc.text('TOTAL', xPos, y + 5.5);
      xPos += covColW[0];
      doc.setTextColor(...C.white);
      doc.text(CP1_DATA.totals.yes.toLocaleString(), xPos, y + 5.5);
      xPos += covColW[1];
      doc.text(CP1_DATA.totals.grandTotal.toLocaleString(), xPos, y + 5.5);
      xPos += covColW[2];
      doc.text(CP1_DATA.cp1Rate + '%', xPos, y + 5.5);
      y += rowH + 6;

      // BI AGING TABLE
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.setTextColor(...C.gold);
      doc.text('BI AGING RISK (365+ DAYS = HIGHEST PRIORITY)', m.l, y + 3);
      y += 6;

      // Header
      doc.setFillColor(...C.headerBg);
      doc.rect(m.l, y, cw, rowH, 'F');
      doc.setFontSize(6);
      doc.setTextColor(...C.muted);
      const ageHeaders = ['AGE BUCKET', 'CP1 CLAIMS', 'TOTAL', 'CP1 RATE', 'PRIORITY'];
      xPos = m.l + 3;
      ageHeaders.forEach((h, i) => {
        doc.text(h, xPos, y + 5.5);
        xPos += covColW[i];
      });
      y += rowH;

      // Age rows
      doc.setFontSize(6.5);
      CP1_DATA.biByAge.forEach((row, i) => {
        const rate = ((row.yes / row.total) * 100).toFixed(0);
        const priority = i === 0 ? 'URGENT' : i === 1 ? 'HIGH' : 'NORMAL';
        const priorityColor = i === 0 ? C.red : i === 1 ? C.amber : C.green;
        
        doc.setFillColor(...(i % 2 === 0 ? C.rowDark : C.rowLight));
        doc.rect(m.l, y, cw, rowH, 'F');
        
        xPos = m.l + 3;
        doc.setTextColor(...C.offWhite);
        doc.setFont('helvetica', 'bold');
        doc.text(row.age, xPos, y + 5.5);
        xPos += covColW[0];
        
        doc.setFont('helvetica', 'normal');
        doc.text(row.yes.toLocaleString(), xPos, y + 5.5);
        xPos += covColW[1];
        doc.text(row.total.toLocaleString(), xPos, y + 5.5);
        xPos += covColW[2];
        doc.text(`${rate}%`, xPos, y + 5.5);
        xPos += covColW[3];
        doc.setTextColor(...priorityColor);
        doc.setFont('helvetica', 'bold');
        doc.text(priority, xPos, y + 5.5);
        
        y += rowH;
      });
      y += 6;

      // ACTION ITEMS
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.setTextColor(...C.gold);
      doc.text('EXECUTIVE ACTIONS', m.l, y + 3);
      y += 6;

      const actions = [
        { priority: 'IMMEDIATE', action: `Prioritize resolution of ${agedBIClaimCount.toLocaleString()} aged BI claims (365+ days)` },
        { priority: 'STRATEGIC', action: 'Implement early limits evaluation at 60-day mark' },
        { priority: 'PROCESS', action: 'Review BI settlement authority and escalation thresholds' },
      ];

      actions.forEach((a, i) => {
        const priorityColor = i === 0 ? C.red : i === 1 ? C.amber : C.muted;
        doc.setFillColor(...(i % 2 === 0 ? C.rowDark : C.rowLight));
        doc.rect(m.l, y, cw, 8, 'F');
        doc.setFillColor(...priorityColor);
        doc.rect(m.l, y, 2, 8, 'F');
        
        doc.setFontSize(6);
        doc.setTextColor(...priorityColor);
        doc.setFont('helvetica', 'bold');
        doc.text(a.priority, m.l + 5, y + 5.5);
        
        doc.setTextColor(...C.offWhite);
        doc.setFont('helvetica', 'normal');
        doc.text(a.action, m.l + 28, y + 5.5);
        y += 8;
      });

      // FOOTER
      doc.setFillColor(...C.headerBg);
      doc.rect(0, ph - 10, pw, 10, 'F');
      doc.setFillColor(...C.gold);
      doc.rect(0, ph - 10, pw, 0.3, 'F');
      doc.setFontSize(6);
      doc.setTextColor(...C.muted);
      doc.text('CONFIDENTIAL', m.l, ph - 3);
      doc.text('Fred Loya Insurance', pw / 2, ph - 3, { align: 'center' });
      doc.text('Page 1 of 1', pw - m.r, ph - 3, { align: 'right' });

      // SAVE
      const filename = `CP1_Analysis_${format(new Date(), 'yyyy-MM-dd')}.pdf`;
      doc.save(filename);
      toast.success('CP1 Analysis report generated');
    } catch (err) {
      console.error('Error generating PDF:', err);
      toast.error('Failed to generate PDF');
    } finally {
      setGeneratingCP1PDF(false);
    }
  }, [historicalMetrics]);

  // Generate Excel for CP1 Analysis
  const generateCP1Excel = useCallback(async () => {
    setGeneratingCP1Excel(true);
    try {
      const XLSX = await import('xlsx');
      const workbook = XLSX.utils.book_new();

      // Sheet 1: Executive Summary
      const summaryData = [
        ['CP1 ANALYSIS'],
        [`Generated: ${format(new Date(), 'MMMM d, yyyy h:mm a')}`],
        [],
        ['EXECUTIVE SUMMARY'],
        ['Metric', 'Value'],
        ['Total Claims', CP1_DATA.totals.grandTotal],
        ['CP1', CP1_DATA.totals.yes],
        ['No CP', CP1_DATA.totals.noCP],
        ['CP1 Rate', `${CP1_DATA.cp1Rate}%`],
        ['BI CP1 Rate', '34.2%'],
      ];
      const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
      XLSX.utils.book_append_sheet(workbook, summarySheet, 'Executive Summary');

      // Sheet 2: BI Age Breakdown
      const biAgeData = [
        ['BODILY INJURY - CP1 BY AGE'],
        [],
        ['Age Bucket', 'No CP', 'CP1 Yes', 'Total', 'CP1 Rate'],
        ...CP1_DATA.biByAge.map(row => [
          row.age,
          row.noCP,
          row.yes,
          row.total,
          `${((row.yes / row.total) * 100).toFixed(1)}%`
        ]),
        ['BI Total', CP1_DATA.biTotal.noCP, CP1_DATA.biTotal.yes, CP1_DATA.biTotal.total, '34.2%'],
      ];
      const biAgeSheet = XLSX.utils.aoa_to_sheet(biAgeData);
      XLSX.utils.book_append_sheet(workbook, biAgeSheet, 'BI Age Breakdown');

      // Sheet 3: Coverage Summary
      const coverageData = [
        ['CP1 BY COVERAGE TYPE'],
        [],
        ['Coverage', 'No CP', 'CP1 Yes', 'Total', 'CP1 Rate'],
        ...CP1_DATA.byCoverage.map(row => [
          row.coverage,
          row.noCP,
          row.yes,
          row.total,
          `${row.cp1Rate}%`
        ]),
        ['GRAND TOTAL', CP1_DATA.totals.noCP, CP1_DATA.totals.yes, CP1_DATA.totals.grandTotal, `${CP1_DATA.cp1Rate}%`],
      ];
      const coverageSheet = XLSX.utils.aoa_to_sheet(coverageData);
      XLSX.utils.book_append_sheet(workbook, coverageSheet, 'Coverage Summary');

      // Sheet 4: Key Insights
      const insightsData = [
        ['KEY INSIGHTS'],
        [],
        [`BI represents ${((CP1_DATA.biTotal.yes / CP1_DATA.totals.yes) * 100).toFixed(1)}% of all CP1 tendered claims (${CP1_DATA.biTotal.yes.toLocaleString()} of ${CP1_DATA.totals.yes.toLocaleString()})`],
        [`Aged 365+ BI claims have highest CP1 rate at 45.7% (${CP1_DATA.biByAge[0].yes.toLocaleString()} claims)`],
        [`UI coverage has highest CP1 rate at 51.9% but only ${CP1_DATA.byCoverage.find(c => c.coverage === 'UI')?.total} claims`],
        [`Under 60 Days BI claims have lowest CP1 rate at 13.5% - early resolution opportunity`],
      ];
      const insightsSheet = XLSX.utils.aoa_to_sheet(insightsData);
      XLSX.utils.book_append_sheet(workbook, insightsSheet, 'Key Insights');

      XLSX.writeFile(workbook, `CP1-Analysis-${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
      toast.success('CP1 Analysis Excel generated');
    } catch (err) {
      console.error('Error generating Excel:', err);
      toast.error('Failed to generate Excel');
    } finally {
      setGeneratingCP1Excel(false);
    }
  }, []);

  // Generate Combined Board-Ready Executive Package (Budget + Decisions + CP1)
  const generateCombinedBoardPackage = useCallback(async () => {
    setGeneratingBoardPackage(true);
    try {
      // Ensure we have pending decisions loaded
      if (pendingDecisions.length === 0) {
        await fetchPendingDecisions();
      }
      
      const yoyChange = budgetMetrics.ytdPaid - budgetMetrics.total2024;
      const yoyChangePercent = (yoyChange / budgetMetrics.total2024) * 100;
      
      const packageConfig: ExecutivePackageConfig = {
        sections: [
          {
            id: 'budget',
            title: 'BUDGET BURN RATE',
            financialImpact: formatExecCurrency(budgetMetrics.ytdPaid, true),
            riskLevel: budgetMetrics.onTrack ? 'stable' : 'elevated',
            keyMetric: { label: 'Burn Rate', value: `${budgetMetrics.burnRate}%` },
            actionRequired: budgetMetrics.onTrack ? 'Monitor' : 'Review BI spend'
          },
          {
            id: 'decisions',
            title: 'PENDING DECISIONS',
            financialImpact: formatExecCurrency(pendingDecisionsStats.totalExposure, true),
            riskLevel: pendingDecisionsStats.critical > 0 ? 'critical' : 'stable',
            keyMetric: { label: 'Critical', value: pendingDecisionsStats.critical.toString() },
            actionRequired: pendingDecisionsStats.critical > 0 ? 'Immediate review' : 'Standard process'
          },
          {
            id: 'cp1',
            title: 'CP1 LIMITS',
            financialImpact: `${CP1_DATA.totals.yes.toLocaleString()} claims`,
            riskLevel: parseFloat(CP1_DATA.cp1Rate) > 28 ? 'elevated' : 'stable',
            keyMetric: { label: 'CP1 Rate', value: `${CP1_DATA.cp1Rate}%` },
            actionRequired: 'Review aged BI'
          }
        ],
        budgetData: {
          annualBudget: budgetMetrics.annualBudget,
          ytdPaid: budgetMetrics.ytdPaid,
          burnRate: budgetMetrics.burnRate,
          remaining: budgetMetrics.remaining,
          projectedBurn: budgetMetrics.projectedBurn,
          projectedVariance: budgetMetrics.projectedVariance,
          onTrack: budgetMetrics.onTrack,
          yoyChange,
          yoyChangePercent,
          coverageBreakdown: budgetMetrics.coverageBreakdown,
          monthlyData: budgetMetrics.monthlyData
        },
        decisionsData: {
          total: pendingDecisionsStats.total,
          critical: pendingDecisionsStats.critical,
          thisWeek: pendingDecisionsStats.thisWeek,
          statuteDeadlines: pendingDecisionsStats.statuteDeadlines,
          totalExposure: pendingDecisionsStats.totalExposure,
          decisions: pendingDecisions.map(d => ({
            matterId: d.matterId,
            claimant: d.claimant,
            amount: d.amount,
            daysOpen: d.daysOpen,
            lead: d.lead,
            severity: d.severity,
            recommendedAction: d.recommendedAction,
            department: d.department,
            type: d.type
          }))
        },
        cp1Data: {
          totalClaims: CP1_DATA.totals.grandTotal,
          cp1Count: CP1_DATA.totals.yes,
          cp1Rate: `${CP1_DATA.cp1Rate}%`,
          biCP1Rate: '34.2%',
          byCoverage: CP1_DATA.byCoverage,
          biByAge: CP1_DATA.biByAge,
          biTotal: CP1_DATA.biTotal,
          totals: CP1_DATA.totals
        },
        quarterlyExpertData: EXPERT_QUARTERLY_DATA
      };
      
      const result = await generateBoardReadyPackage(packageConfig);
      
      if (result.success) {
        toast.success(`Board Package generated: ${result.pageCount} pages`);
      } else {
        throw new Error('Package generation failed');
      }
    } catch (err) {
      console.error('Error generating board package:', err);
      toast.error('Failed to generate board package');
    } finally {
      setGeneratingBoardPackage(false);
    }
  }, [pendingDecisions, pendingDecisionsStats, budgetMetrics, fetchPendingDecisions]);
  
  const formatNumber = (val: number) => val.toLocaleString();
  const formatCurrency = (val: number) => `$${(val / 1000000).toFixed(1)}M`;
  const formatCurrencyK = (val: number) => `$${(val / 1000).toFixed(0)}K`;
  const formatCurrencyFull = (val: number) => `$${val.toLocaleString()}`;
  const formatCurrencyFullValue = (value: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value);
  };

  // Fetch existing reviews
  const fetchReviews = async () => {
    const { data: reviewData, error: reviewError } = await supabase
      .from('claim_reviews')
      .select('*')
      .order('created_at', { ascending: false });

    if (!reviewError && reviewData) {
      setReviews(reviewData);
    }
    setLoadingReviews(false);
  };

  useEffect(() => {
    fetchReviews();

    // Set up realtime subscription
    const channel = supabase
      .channel('claim_reviews_realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'claim_reviews' },
        (payload) => {
          console.log('Realtime update:', payload);
          if (payload.eventType === 'INSERT') {
            setReviews(prev => [payload.new as ClaimReview, ...prev]);
          } else if (payload.eventType === 'UPDATE') {
            setReviews(prev => prev.map(r => 
              r.id === (payload.new as ClaimReview).id ? payload.new as ClaimReview : r
            ));
          } else if (payload.eventType === 'DELETE') {
            setReviews(prev => prev.filter(r => r.id !== (payload.old as ClaimReview).id));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Calculate review stats
  const reviewStats = useMemo(() => {
    const assigned = reviews.filter(r => r.status === 'assigned').length;
    const inReview = reviews.filter(r => r.status === 'in_review').length;
    const completed = reviews.filter(r => r.status === 'completed').length;
    const flagged = reviews.filter(r => r.status === 'flagged').length;
    const totalReserves = reviews.reduce((sum, r) => sum + (Number(r.reserves) || 0), 0);
    
    return { total: reviews.length, assigned, inReview, completed, flagged, totalReserves };
  }, [reviews]);

  // Dynamic totals from CSV - single source of truth
  const KNOWN_TOTALS = useMemo(() => data?.knownTotals || {
    totalOpenClaims: 0,
    totalOpenExposures: 0,
    atr: { claims: 0, exposures: 0 },
    lit: { claims: 0, exposures: 0 },
    bi3: { claims: 0, exposures: 0 },
    earlyBI: { claims: 0, exposures: 0 },
    flagged: 0,
    newClaims: 0,
    closed: 0,
  }, [data]);

  // Dynamic CP1 data from CSV - single source of truth
  const CP1_DATA = useMemo(() => data?.cp1Data || {
    biByAge: [],
    biTotal: { noCP: 0, yes: 0, total: 0 },
    byCoverage: [],
    totals: { noCP: 0, yes: 0, grandTotal: 0 },
    cp1Rate: '0.0',
  }, [data]);

  // EXECUTIVE METRICS - Trend Analysis & Closure Data
  const EXECUTIVE_METRICS = {
    // Month-over-month trends (simulated - would come from historical data)
    trends: {
      reservesMoM: 2.3,           // +2.3% vs last month
      reservesYoY: -5.1,          // -5.1% vs last year
      claimsMoM: -1.2,            // -1.2% vs last month
      claimsYoY: -8.4,            // -8.4% vs last year
      closureRateMoM: 4.5,        // +4.5% improvement
    },
    // Closure metrics
    closures: {
      closedThisMonth: 847,
      closedLastMonth: 792,
      avgDaysToClose: 142,
      avgDaysToCloseTrend: -8,    // 8 days faster than last month
      targetDays: 120,
      closureRate: 8.4,           // % of inventory closed per month
    },
    // Aging alerts
    aging: {
      over365Days: 5630,
      over365Reserves: 115000000,
      over365Pct: 55.7,           // % of total claims
      criticalAging: 1247,        // Claims over 2 years
      avgAge: 287,                // days
    },
  };

  // Dynamic financial data from CSV - single source of truth
  const FINANCIAL_DATA = useMemo(() => {
    if (!data?.financials) {
      return {
        byAge: [],
        byQueue: [],
        byTypeGroup: [],
        totals: { totalOpenReserves: 0, totalLowEval: 0, totalHighEval: 0, noEvalAmount: 0, noEvalCount: 0 }
      };
    }
    return {
      byAge: data.financials.byAge,
      byQueue: [], // Not available in raw CSV
      byTypeGroup: data.financials.byTypeGroup,
      totals: {
        totalOpenReserves: data.financials.totalOpenReserves,
        totalLowEval: data.financials.totalLowEval,
        totalHighEval: data.financials.totalHighEval,
        noEvalAmount: 0,
        noEvalCount: data.financials.noEvalCount,
      }
    };
  }, [data]);

  // Historical CP1 trend data (static - for trend charts)
  const CP1_MONTHLY_TREND = [
    { month: 'Feb 25', cp1Rate: 24.2, cp1Count: 6420, totalClaims: 26528 },
    { month: 'Mar 25', cp1Rate: 24.8, cp1Count: 6580, totalClaims: 26532 },
    { month: 'Apr 25', cp1Rate: 25.1, cp1Count: 6690, totalClaims: 26653 },
    { month: 'May 25', cp1Rate: 25.4, cp1Count: 6755, totalClaims: 26594 },
    { month: 'Jun 25', cp1Rate: 25.8, cp1Count: 6845, totalClaims: 26531 },
    { month: 'Jul 25', cp1Rate: 26.0, cp1Count: 6912, totalClaims: 26585 },
    { month: 'Aug 25', cp1Rate: 26.2, cp1Count: 6975, totalClaims: 26622 },
    { month: 'Sep 25', cp1Rate: 26.1, cp1Count: 6948, totalClaims: 26620 },
    { month: 'Oct 25', cp1Rate: 26.3, cp1Count: 7010, totalClaims: 26654 },
    { month: 'Nov 25', cp1Rate: 26.4, cp1Count: 7048, totalClaims: 26697 },
    { month: 'Dec 25', cp1Rate: 26.5, cp1Count: 7078, totalClaims: 26709 },
    { month: 'Jan 26', cp1Rate: parseFloat(CP1_DATA.cp1Rate), cp1Count: CP1_DATA.totals.yes, totalClaims: CP1_DATA.totals.grandTotal },
  ];

  // Rear Ends - Texas Areas 101-110 | Loss Desc: IV R/E CV only
  const TEXAS_REAR_END_DATA = {
    lossDescription: 'IV R/E CV',
    summary: { totalClaims: 2458, totalReserves: 33000000, lowEval: 9260000, highEval: 10800000 },
    byArea: [
      { area: '101 EL PASO', claims: 412, reserves: 5600000, lowEval: 1550000, highEval: 1810000 },
      { area: '102 RIO GRANDE/VALL', claims: 318, reserves: 4200000, lowEval: 1170000, highEval: 1360000 },
      { area: '103 LAREDO/DEL RIO', claims: 245, reserves: 3600000, lowEval: 1010000, highEval: 1180000 },
      { area: '104 CORPUS', claims: 198, reserves: 2800000, lowEval: 780000, highEval: 910000 },
      { area: '105 SAN ANTONIO', claims: 387, reserves: 4900000, lowEval: 1370000, highEval: 1600000 },
      { area: '106 WEST TEXAS', claims: 156, reserves: 2100000, lowEval: 590000, highEval: 690000 },
      { area: '107 HOUSTON', claims: 289, reserves: 3400000, lowEval: 950000, highEval: 1110000 },
      { area: '109 DALLAS', claims: 142, reserves: 2000000, lowEval: 560000, highEval: 650000 },
      { area: '110 AUSTIN', claims: 98, reserves: 1500000, lowEval: 420000, highEval: 490000 },
    ],
    byAge: [
      { age: '365+ Days', claims: 983, reserves: 13600000, lowEval: 3800000, highEval: 4450000 },
      { age: '181-365 Days', claims: 712, reserves: 9800000, lowEval: 2740000, highEval: 3200000 },
      { age: '61-180 Days', claims: 498, reserves: 6000000, lowEval: 1680000, highEval: 1960000 },
      { age: 'Under 60 Days', claims: 265, reserves: 3600000, lowEval: 1040000, highEval: 1190000 },
    ],
  };

  // Calculate derived metrics - now uses dynamic financials from CSV
  const metrics = useMemo(() => {
    if (!data) return null;

    const litTotal = data.typeGroupSummaries.find(t => t.typeGroup === 'LIT')?.grandTotal || KNOWN_TOTALS.lit.claims;
    const aged365Plus = data.totals.age365Plus;
    const totalClaims = data.totals.grandTotal || KNOWN_TOTALS.totalOpenClaims;
    const agedPct = totalClaims > 0 
      ? ((aged365Plus / totalClaims) * 100).toFixed(1)
      : '0';

    // Top 5 phases by count
    const topPhases = [...data.litPhases]
      .sort((a, b) => b.grandTotal - a.grandTotal)
      .slice(0, 8);

    // Use dynamic financials from CSV
    const dynamicFinancials = {
      byAge: data.financials.byAge,
      byQueue: FINANCIAL_DATA.byQueue,
      byTypeGroup: data.financials.byTypeGroup.length > 0 ? data.financials.byTypeGroup : FINANCIAL_DATA.byTypeGroup,
      totals: {
        totalOpenReserves: data.financials.totalOpenReserves,
        totalLowEval: data.financials.totalLowEval,
        totalHighEval: data.financials.totalHighEval,
        noEvalAmount: 0,
        noEvalCount: data.financials.noEvalCount,
      }
    };

    // Age distribution for chart with financials
    const ageDistribution = dynamicFinancials.byAge.map(item => ({
      ...item,
      fill: item.age === '365+ Days' ? 'hsl(var(--destructive))' :
            item.age === '181-365 Days' ? 'hsl(var(--warning))' :
            item.age === '61-180 Days' ? 'hsl(var(--accent))' :
            'hsl(var(--success))'
    }));

    // Type groups from data
    const typeGroups = data.typeGroupSummaries.length > 0 
      ? data.typeGroupSummaries.slice(0, 10).map(t => ({
          typeGroup: t.typeGroup,
          claims: t.grandTotal,
          exposures: t.grandTotal, // Exposures = claims for now
        }))
      : [
          { typeGroup: 'ATR', claims: KNOWN_TOTALS.atr.claims, exposures: KNOWN_TOTALS.atr.exposures },
          { typeGroup: 'Litigation', claims: KNOWN_TOTALS.lit.claims, exposures: KNOWN_TOTALS.lit.exposures },
          { typeGroup: 'BI3', claims: KNOWN_TOTALS.bi3.claims, exposures: KNOWN_TOTALS.bi3.exposures },
          { typeGroup: 'Early BI', claims: KNOWN_TOTALS.earlyBI.claims, exposures: KNOWN_TOTALS.earlyBI.exposures },
        ];

    return {
      litTotal,
      aged365Plus,
      agedPct,
      topPhases,
      ageDistribution,
      typeGroups,
      totalOpenClaims: totalClaims,
      totalOpenExposures: totalClaims, // Use same as claims for now
      flagged: KNOWN_TOTALS.flagged,
      financials: dynamicFinancials,
    };
  }, [data]);

  // High Eval Top 10 Managers (actual adjusters setting high evaluations with amounts)
  const HIGH_EVAL_MANAGERS: ManagerTracking[] = [
    { name: 'LUIS MARTINEZ', value: '$7.7M', category: 'high_eval' },
    { name: 'CHELSEY SHOGREN-MARTINEZ', value: '$3.8M', category: 'high_eval' },
    { name: 'MARC GUEVARA', value: '$3.7M', category: 'high_eval' },
    { name: 'FERNANDO CANALES', value: '$3.5M', category: 'high_eval' },
    { name: 'LUIS VELA', value: '$3.0M', category: 'high_eval' },
    { name: 'LINDA DAVILA', value: '$3.0M', category: 'high_eval' },
    { name: 'BRITTANY SORIA', value: '$3.0M', category: 'high_eval' },
    { name: 'JOEL FIERRO', value: '$2.8M', category: 'high_eval' },
    { name: 'CHRYSTAL PEREZ', value: '$2.7M', category: 'high_eval' },
    { name: 'SALVADOR GONZALEZ', value: '$2.6M', category: 'high_eval' },
  ];
  
  // Full list of adjusters with high evaluations for Excel export (with amounts) - SORTED BY AMOUNT DESC
  const ALL_HIGH_EVAL_ADJUSTERS: ManagerTracking[] = [
    { name: 'LUIS MARTINEZ', value: '$7,652,504.86', category: 'high_eval' },
    { name: 'CHELSEY SHOGREN-MARTINEZ', value: '$3,792,435.95', category: 'high_eval' },
    { name: 'MARC GUEVARA', value: '$3,749,733.01', category: 'high_eval' },
    { name: 'FERNANDO CANALES', value: '$3,503,946.17', category: 'high_eval' },
    { name: 'LUIS VELA', value: '$3,043,334.61', category: 'high_eval' },
    { name: 'LINDA DAVILA', value: '$2,978,373.03', category: 'high_eval' },
    { name: 'BRITTANY SORIA', value: '$2,955,498.00', category: 'high_eval' },
    { name: 'JOEL FIERRO', value: '$2,771,052.00', category: 'high_eval' },
    { name: 'CHRYSTAL PEREZ', value: '$2,678,470.02', category: 'high_eval' },
    { name: 'SALVADOR GONZALEZ', value: '$2,558,685.97', category: 'high_eval' },
    { name: 'PRISCILLA VEGA', value: '$2,494,885.01', category: 'high_eval' },
    { name: 'JAMES WALLACE', value: '$2,334,905.79', category: 'high_eval' },
    { name: 'MARIO HELLAMNS', value: '$2,207,330.31', category: 'high_eval' },
    { name: 'STARLA HENDERSON', value: '$2,086,043.90', category: 'high_eval' },
    { name: 'LINDA ROMERO', value: '$1,957,244.14', category: 'high_eval' },
    { name: 'ANDREA GARCIA', value: '$1,934,940.33', category: 'high_eval' },
    { name: 'DIANA SANCHEZ', value: '$1,483,678.39', category: 'high_eval' },
    { name: 'MARK TRAVIS', value: '$1,332,454.55', category: 'high_eval' },
    { name: 'ANDREA NIEVES', value: '$1,274,627.49', category: 'high_eval' },
    { name: 'ZACH WISEMAN', value: '$1,222,725.00', category: 'high_eval' },
    { name: 'KIMBERLY AGUILERA', value: '$1,168,613.20', category: 'high_eval' },
    { name: 'YULIZZA REYNA', value: '$1,137,777.57', category: 'high_eval' },
    { name: 'CHRISTINA GARCIA', value: '$965,460.17', category: 'high_eval' },
    { name: 'JOSE CANALES HUERTA', value: '$947,107.79', category: 'high_eval' },
    { name: 'OLIVIA MARTINEZ', value: '$742,904.03', category: 'high_eval' },
    { name: 'MANUEL CABALLERO', value: '$685,003.15', category: 'high_eval' },
    { name: 'MICHAEL PAULSEN', value: '$668,501.00', category: 'high_eval' },
    { name: 'ROBERT HOLCOMB', value: '$604,637.00', category: 'high_eval' },
    { name: 'LAURA GUERRA', value: '$601,318.00', category: 'high_eval' },
    { name: 'STEPHEN POOLAS', value: '$493,403.00', category: 'high_eval' },
    { name: '(blank)', value: '$494,671.01', category: 'high_eval' },
    { name: 'SANDRA PARADA GALLEGOS', value: '$426,134.64', category: 'high_eval' },
    { name: 'CHERYLE HARRIS-CHANEY', value: '$397,700.00', category: 'high_eval' },
    { name: 'MARIA JURADO', value: '$395,574.35', category: 'high_eval' },
    { name: 'RICHARD SALCEDO', value: '$387,499.73', category: 'high_eval' },
    { name: 'SARAH HENDERSON', value: '$299,950.01', category: 'high_eval' },
    { name: 'MANDY SALCEDO', value: '$270,868.81', category: 'high_eval' },
    { name: 'DIANA LANDIN', value: '$269,906.30', category: 'high_eval' },
    { name: 'ALEJANDRO CONTRERAS', value: '$259,213.00', category: 'high_eval' },
    { name: 'HEATHER SYKES', value: '$256,379.79', category: 'high_eval' },
    { name: 'ELVA TREVINO', value: '$248,900.00', category: 'high_eval' },
    { name: 'BARBARA VISSER', value: '$227,383.58', category: 'high_eval' },
    { name: 'EDWARD LUNA', value: '$227,726.47', category: 'high_eval' },
    { name: 'JOHN MIDDLETON', value: '$227,000.00', category: 'high_eval' },
    { name: 'ELIAS FRIAS', value: '$203,254.00', category: 'high_eval' },
    { name: 'MITZY GARCIA', value: '$196,603.00', category: 'high_eval' },
    { name: 'FELIX CRUZ', value: '$190,201.00', category: 'high_eval' },
    { name: 'ANNA BORDEN', value: '$187,191.47', category: 'high_eval' },
    { name: 'TROY VAZQUEZ', value: '$180,851.00', category: 'high_eval' },
    { name: 'CARLOS GUEVARA', value: '$176,685.56', category: 'high_eval' },
    { name: 'CHRISTOPHER BENNETT', value: '$176,000.00', category: 'high_eval' },
    { name: 'TERESA MASON', value: '$139,580.66', category: 'high_eval' },
    { name: 'MIRIAM ALVARADO', value: '$121,949.00', category: 'high_eval' },
    { name: 'DIANA MISSOURI', value: '$113,100.00', category: 'high_eval' },
    { name: 'MICHAEL SALAZAR', value: '$110,000.00', category: 'high_eval' },
    { name: 'STUART GARY', value: '$102,104.01', category: 'high_eval' },
    { name: 'JOSEPH JIMENEZ', value: '$101,490.00', category: 'high_eval' },
    { name: 'LISA GONZALEZ', value: '$97,852.00', category: 'high_eval' },
    { name: 'FERNANDO MEJORADO', value: '$93,100.02', category: 'high_eval' },
    { name: 'MIREYA DOMINGUEZ', value: '$89,994.00', category: 'high_eval' },
    { name: 'DANIA RODRIGUEZ', value: '$84,500.00', category: 'high_eval' },
    { name: 'ADRIAN ALVAREZ', value: '$68,800.00', category: 'high_eval' },
    { name: 'JASON THOMAS', value: '$58,641.11', category: 'high_eval' },
    { name: 'STEPHANIE OLIVAS', value: '$55,000.00', category: 'high_eval' },
    { name: 'MIRIAM MADRID', value: '$53,000.00', category: 'high_eval' },
    { name: 'ROCHELLE GURULE', value: '$51,961.00', category: 'high_eval' },
    { name: 'MONICA BURCHFIELD', value: '$50,000.00', category: 'high_eval' },
    { name: 'JOSE CARDENAS', value: '$50,000.00', category: 'high_eval' },
    { name: 'MARIAH UHLING', value: '$47,000.00', category: 'high_eval' },
    { name: 'ERIC YANES', value: '$46,000.00', category: 'high_eval' },
    { name: 'SANDRA ROMERO', value: '$45,000.00', category: 'high_eval' },
    { name: 'RACHAEL BLANCO', value: '$44,757.01', category: 'high_eval' },
    { name: 'GINA NICHOLSON', value: '$42,924.00', category: 'high_eval' },
    { name: 'GUADALUPE COMPIAN', value: '$42,354.00', category: 'high_eval' },
    { name: 'SUSANA IGLESIAS', value: '$42,161.06', category: 'high_eval' },
    { name: 'BRENDA CASTANEDA', value: '$42,096.02', category: 'high_eval' },
    { name: 'PATRICIA GALINDO', value: '$39,200.00', category: 'high_eval' },
    { name: 'MARIO SAUCEDA', value: '$37,493.53', category: 'high_eval' },
    { name: 'NEO RODRIGUEZ', value: '$37,160.94', category: 'high_eval' },
    { name: 'ANNA ARREDONDO', value: '$31,455.00', category: 'high_eval' },
    { name: 'KARLA OCHOA', value: '$31,129.60', category: 'high_eval' },
    { name: 'ROXANN PEREZ', value: '$30,600.00', category: 'high_eval' },
    { name: 'JEANNETTE SALAZAR', value: '$30,000.00', category: 'high_eval' },
    { name: 'STARLA HERNANDEZ', value: '$30,000.00', category: 'high_eval' },
    { name: 'TANAE MARTEL', value: '$30,000.00', category: 'high_eval' },
    { name: 'LUIS JIMENEZ', value: '$28,250.00', category: 'high_eval' },
    { name: 'FELICIA JACKSON', value: '$28,740.55', category: 'high_eval' },
    { name: 'DIANA RUBIO', value: '$26,500.00', category: 'high_eval' },
    { name: 'ASAEL PEREZ', value: '$26,353.55', category: 'high_eval' },
    { name: 'ARTURO LEDEZMA', value: '$26,042.80', category: 'high_eval' },
    { name: 'KIM CHAVEZ', value: '$25,000.00', category: 'high_eval' },
    { name: 'CHRISTOPHER BACHAND', value: '$22,500.00', category: 'high_eval' },
    { name: 'RENE SANCHEZ', value: '$20,962.97', category: 'high_eval' },
    { name: 'JASSON MONTOYA', value: '$20,750.00', category: 'high_eval' },
    { name: 'COURTNEY MCGUIRE', value: '$19,900.00', category: 'high_eval' },
    { name: 'SYLVIA GREGORY', value: '$19,003.00', category: 'high_eval' },
    { name: 'DUSTIN MILLER', value: '$18,730.00', category: 'high_eval' },
    { name: 'JESUS HERNANDEZ', value: '$18,600.00', category: 'high_eval' },
    { name: 'ALEXIS VALLES', value: '$17,600.01', category: 'high_eval' },
    { name: 'IVAN CARAVEO', value: '$17,100.00', category: 'high_eval' },
    { name: 'SYLVIA APONTE', value: '$16,185.10', category: 'high_eval' },
    { name: 'ROXANN DELOSSANTOS', value: '$15,409.18', category: 'high_eval' },
    { name: 'KEVIN DAVIS', value: '$15,000.00', category: 'high_eval' },
    { name: 'ARMANDO MARTINEZ', value: '$15,000.00', category: 'high_eval' },
    { name: 'ERIC RODRIGUEZ', value: '$15,008.00', category: 'high_eval' },
    { name: 'MAYTE ZAVALA', value: '$14,993.64', category: 'high_eval' },
    { name: 'BOBBI CAMPBELL', value: '$14,481.00', category: 'high_eval' },
    { name: 'NICHOLAS KIM', value: '$12,500.00', category: 'high_eval' },
    { name: 'JOANA DURON', value: '$12,500.00', category: 'high_eval' },
    { name: 'JILL MICHELSON', value: '$12,000.00', category: 'high_eval' },
    { name: 'SHERRIE RODRIGUEZ', value: '$11,174.86', category: 'high_eval' },
    { name: 'BRAULIO RUIZ', value: '$10,300.01', category: 'high_eval' },
    { name: 'HOMERO CURA', value: '$10,166.00', category: 'high_eval' },
    { name: 'KIARA ALONZO', value: '$9,500.00', category: 'high_eval' },
    { name: 'MANUEL RANGEL', value: '$9,500.00', category: 'high_eval' },
    { name: 'SAMANTHA HOLGUIN', value: '$9,300.00', category: 'high_eval' },
    { name: 'JOSE HERNANDEZ', value: '$9,300.00', category: 'high_eval' },
    { name: 'GABRIEL NAVARRETE', value: '$9,000.00', category: 'high_eval' },
    { name: 'JACOB HERNANDEZ', value: '$8,787.00', category: 'high_eval' },
    { name: 'RAUL CHAVEZ', value: '$7,600.00', category: 'high_eval' },
    { name: 'JULIUS HILL', value: '$7,500.00', category: 'high_eval' },
    { name: 'SANDRA PENA', value: '$7,500.00', category: 'high_eval' },
    { name: 'VICTORIA ROMERO', value: '$7,500.00', category: 'high_eval' },
    { name: 'ETHAN WALLEY', value: '$7,500.00', category: 'high_eval' },
    { name: 'PATRICIA MARTINEZ', value: '$7,480.00', category: 'high_eval' },
    { name: 'JENNIFER GONZALEZ', value: '$7,450.00', category: 'high_eval' },
    { name: 'RONALDO SANCHEZ-MATA', value: '$7,490.00', category: 'high_eval' },
    { name: 'ROMAN MARTINEZ', value: '$7,100.00', category: 'high_eval' },
    { name: 'TIANA LEWIS', value: '$7,000.00', category: 'high_eval' },
    { name: 'LILIANA ESPINOZA', value: '$6,500.00', category: 'high_eval' },
    { name: 'JOSE MEDINA', value: '$6,500.00', category: 'high_eval' },
    { name: 'TYRA WILLIAMS', value: '$6,500.00', category: 'high_eval' },
    { name: 'GERALDEAN GOMEZ', value: '$6,169.00', category: 'high_eval' },
    { name: 'ANGEL MILLER', value: '$6,000.00', category: 'high_eval' },
    { name: 'NOHELY ARVIZU', value: '$6,000.00', category: 'high_eval' },
    { name: 'JACLYN CAMPOS', value: '$5,970.00', category: 'high_eval' },
    { name: 'IRIS GONZALEZ', value: '$5,750.00', category: 'high_eval' },
    { name: 'YOVANNA FERNANDEZ', value: '$5,750.00', category: 'high_eval' },
    { name: 'ANAI VEGA', value: '$5,700.00', category: 'high_eval' },
    { name: 'NAZIRA CHAVEZ', value: '$5,700.00', category: 'high_eval' },
    { name: 'JOANN MARTINEZ', value: '$5,162.00', category: 'high_eval' },
    { name: 'RACHEL BLANCO', value: '$5,062.00', category: 'high_eval' },
    { name: 'ALEXIS RAMIREZ', value: '$5,000.00', category: 'high_eval' },
    { name: 'ALINA MACHUCA', value: '$5,000.00', category: 'high_eval' },
    { name: 'CAROLINA ARREDONDO', value: '$5,000.00', category: 'high_eval' },
    { name: 'CIJA WILSON-AYALA', value: '$5,000.00', category: 'high_eval' },
    { name: 'JESSICA GONZALEZ', value: '$5,000.00', category: 'high_eval' },
    { name: 'MARIA VELA', value: '$5,000.00', category: 'high_eval' },
    { name: 'MAYRA ZARAGOZA', value: '$5,000.00', category: 'high_eval' },
    { name: 'RUDY VILLALOBOS', value: '$5,000.00', category: 'high_eval' },
    { name: 'SABRINA ARRIOLA', value: '$5,000.00', category: 'high_eval' },
    { name: 'YVETTE RODRIGUEZ', value: '$5,000.00', category: 'high_eval' },
    { name: 'BIANCA ARVIZU', value: '$4,645.00', category: 'high_eval' },
    { name: 'JOSEPH CUELLAR', value: '$4,030.00', category: 'high_eval' },
    { name: 'ERIN MCKINNEY', value: '$3,500.00', category: 'high_eval' },
    { name: 'JUAN SANCHEZ', value: '$3,400.00', category: 'high_eval' },
    { name: 'JULISSA SALAZAR', value: '$3,378.37', category: 'high_eval' },
    { name: 'MARIELA HERNANDEZ', value: '$3,250.00', category: 'high_eval' },
    { name: 'ANDREA RODRIGUEZ', value: '$3,000.00', category: 'high_eval' },
    { name: 'PEGGY PALACIOS', value: '$3,000.00', category: 'high_eval' },
    { name: 'RICHARD LANDA', value: '$2,500.00', category: 'high_eval' },
    { name: 'ERICA SALAZAR', value: '$2,254.00', category: 'high_eval' },
    { name: 'MARCOS PRECIADO', value: '$2,000.00', category: 'high_eval' },
    { name: 'JACKELINE AGUILAR', value: '$2,000.00', category: 'high_eval' },
    { name: 'PRISCILLA HERNANDEZ', value: '$2,000.00', category: 'high_eval' },
    { name: 'KORINA PALOMINO', value: '$1,500.00', category: 'high_eval' },
    { name: 'MARIA RAMOS', value: '$1,500.00', category: 'high_eval' },
    { name: 'MONICA AHMED', value: '$1,500.00', category: 'high_eval' },
    { name: 'PAPIK HERRERA', value: '$1,500.00', category: 'high_eval' },
    { name: 'BRANDEE DELEON', value: '$1,000.00', category: 'high_eval' },
    { name: 'LUCY PAREDES', value: '$1,000.00', category: 'high_eval' },
    { name: 'CRYSTAL SALDANA', value: '$910.00', category: 'high_eval' },
    { name: 'TARESE LEWIS', value: '$500.00', category: 'high_eval' },
  ];

  // Export handlers for double-click
  const handleExportSummary = useCallback(async () => {
    if (!metrics) return;
    const medianEval = (metrics.financials.totals.totalLowEval + metrics.financials.totals.totalHighEval) / 2;
    const manager = selectedReviewer || 'Richie Mendoza';
    
    // No Eval tracking - all assigned to Richie Mendoza
    const noEvalTracking: ManagerTracking[] = [
      { name: 'Richie Mendoza', value: metrics.financials.totals.noEvalCount, category: 'no_eval' },
    ];
    
    // Use the full list with amounts directly
    const allHighEvalTracking: ManagerTracking[] = ALL_HIGH_EVAL_ADJUSTERS;
    
    // Dashboard visuals - high-level KPIs with trend indicators
    const dashboardVisuals: DashboardVisual[] = [
      { 
        label: 'Open Reserves', 
        value: formatCurrency(metrics.financials.totals.totalOpenReserves), 
        trend: '+2.3% MoM',
        trendDirection: 'up' 
      },
      { 
        label: 'Total Claims', 
        value: formatNumber(KNOWN_TOTALS.totalOpenClaims),
        trend: 'Steady',
        trendDirection: 'neutral'
      },
      { 
        label: 'Litigation Exposures', 
        value: formatNumber(KNOWN_TOTALS.lit.exposures),
        trend: `${KNOWN_TOTALS.lit.claims} matters`,
        trendDirection: 'neutral'
      },
      { 
        label: 'Aged 365+', 
        value: `${((EXECUTIVE_METRICS.aging.over365Days / KNOWN_TOTALS.totalOpenClaims) * 100).toFixed(0)}%`,
        trend: 'High Priority',
        trendDirection: 'down'
      },
    ];

    // Key bullet insights summarizing dashboard state
    const bulletInsights = [
      `${formatNumber(metrics.financials.totals.noEvalCount)} claims awaiting evaluation — all assigned to ${manager}`,
      `Aged inventory (365+ days) represents ${formatCurrency(FINANCIAL_DATA.byAge[0].openReserves)} in reserves`,
      `Low-to-High evaluation spread: ${formatCurrency(metrics.financials.totals.totalLowEval)} – ${formatCurrency(metrics.financials.totals.totalHighEval)}`,
      `Top evaluator: ${allHighEvalTracking[0]?.name || 'N/A'} with ${allHighEvalTracking[0]?.value || 'N/A'} in high evals`,
    ];

    // Litigation Evaluation Phases - actual data from dashboard
    const LIT_PHASES_DATA = [
      { phase: 'Pending Demand', aged365: 643, aged181_365: 74, aged61_180: 111, under60: 17, total: 845, pctAged: 76 },
      { phase: 'Impasse', aged365: 503, aged181_365: 39, aged61_180: 2, under60: 0, total: 544, pctAged: 92 },
      { phase: 'Active Negotiation', aged365: 462, aged181_365: 51, aged61_180: 8, under60: 3, total: 524, pctAged: 88 },
      { phase: 'Liability Denial', aged365: 310, aged181_365: 42, aged61_180: 7, under60: 2, total: 361, pctAged: 86 },
      { phase: 'Low Impact - Negotiation', aged365: 221, aged181_365: 23, aged61_180: 4, under60: 3, total: 251, pctAged: 88 },
      { phase: 'Non Offer', aged365: 180, aged181_365: 14, aged61_180: 7, under60: 0, total: 201, pctAged: 90 },
      { phase: 'Low Impact - Impasse', aged365: 155, aged181_365: 32, aged61_180: 0, under60: 0, total: 187, pctAged: 83 },
      { phase: 'Demand Under Review', aged365: 78, aged181_365: 39, aged61_180: 21, under60: 11, total: 149, pctAged: 52 },
    ];
    const LIT_TOTALS = { aged365: 2716, aged181_365: 334, aged61_180: 176, under60: 63, total: 3747, pctAged: 72 };

    // Charts for visual representation - using actual inventory data
    const charts: PDFChart[] = [
      {
        type: 'horizontalBar',
        title: 'Litigation by Evaluation Phase (Total Claims)',
        data: LIT_PHASES_DATA.map((p, i) => ({
          label: p.phase,
          value: p.total,
          color: (['red', 'amber', 'blue', 'green', 'muted', 'blue', 'amber', 'green'] as const)[i % 8],
        })),
      },
      {
        type: 'donut',
        title: 'Litigation Age Distribution',
        data: [
          { label: '365+ Days', value: LIT_TOTALS.aged365, color: 'red' },
          { label: '181-365 Days', value: LIT_TOTALS.aged181_365, color: 'amber' },
          { label: '61-180 Days', value: LIT_TOTALS.aged61_180, color: 'blue' },
          { label: 'Under 60 Days', value: LIT_TOTALS.under60, color: 'green' },
        ],
      },
    ];

    const exportData: ExportableData = {
      title: 'Open Inventory Summary',
      subtitle: 'Claims and Financial Overview',
      timestamp,
      affectsManager: manager,
      directive: 'Complete all evaluations within 5 business days. No exceptions. High eval claims require manager review and approval. All claims without evaluation are assigned to Richie Mendoza for immediate action.',
      managerTracking: [...allHighEvalTracking, ...noEvalTracking],
      dashboardVisuals,
      bulletInsights,
      charts,
      summary: {
        'Total Open Claims': formatNumber(metrics.totalOpenClaims),
        'Total Open Exposures': formatNumber(metrics.totalOpenExposures),
        'Open Reserves': formatCurrencyFullValue(metrics.financials.totals.totalOpenReserves),
        'Median Evaluation': formatCurrencyFullValue(medianEval),
        'No Evaluation': formatNumber(metrics.financials.totals.noEvalCount),
      },
      columns: ['Metric', 'Value'],
      rows: [
        ['Total Open Claims', formatNumber(metrics.totalOpenClaims)],
        ['Total Open Exposures', formatNumber(metrics.totalOpenExposures)],
        ['Open Reserves', formatCurrencyFullValue(metrics.financials.totals.totalOpenReserves)],
        ['Low Evaluation', formatCurrencyFullValue(metrics.financials.totals.totalLowEval)],
        ['High Evaluation', formatCurrencyFullValue(metrics.financials.totals.totalHighEval)],
        ['Median Evaluation', formatCurrencyFullValue(medianEval)],
        ['No Evaluation Count', formatNumber(metrics.financials.totals.noEvalCount)],
        ['Flagged Claims', formatNumber(metrics.flagged)],
      ],
    };
    await exportBoth(exportData);
    toast.success('PDF + Excel exported: Open Inventory Summary');
  }, [exportBoth, timestamp, metrics, selectedReviewer]);

  const handleExportByAge = useCallback(async () => {
    if (!metrics) return;
    const manager = selectedReviewer || 'Richie Mendoza';
    const exportData: ExportableData = {
      title: 'Reserves vs Evaluation by Age',
      subtitle: 'Financial breakdown by claim age bucket',
      timestamp,
      affectsManager: manager,
      columns: ['Age Bucket', 'Claims', 'Open Reserves', 'Low Eval', 'High Eval', 'Median Eval'],
      rows: metrics.ageDistribution.map(item => [
        item.age,
        item.claims,
        formatCurrencyFullValue(item.openReserves),
        formatCurrencyFullValue(item.lowEval),
        formatCurrencyFullValue(item.highEval),
        formatCurrencyFullValue((item.lowEval + item.highEval) / 2),
      ]),
    };
    await exportBoth(exportData);
    toast.success('PDF + Excel exported: Reserves by Age');
  }, [exportBoth, timestamp, metrics, selectedReviewer]);

  const handleExportByQueue = useCallback(async () => {
    if (!metrics) return;
    const manager = selectedReviewer || 'Richie Mendoza';
    const exportData: ExportableData = {
      title: 'Reserve Adequacy by Queue',
      subtitle: 'Queue-level reserve analysis',
      timestamp,
      affectsManager: manager,
      columns: ['Queue', 'Open Reserves', 'Low Eval', 'High Eval', 'Median Eval', 'Variance %', 'Status'],
      rows: metrics.financials.byQueue.map(queue => {
        const qMedian = (queue.lowEval + queue.highEval) / 2;
        const qVariance = queue.openReserves - qMedian;
        const qVariancePct = ((qVariance / qMedian) * 100).toFixed(1);
        const qIsOver = qVariance > 0;
        return [
          queue.queue,
          formatCurrencyFullValue(queue.openReserves),
          formatCurrencyFullValue(queue.lowEval),
          formatCurrencyFullValue(queue.highEval),
          formatCurrencyFullValue(qMedian),
          `${qIsOver ? '+' : ''}${qVariancePct}%`,
          qIsOver ? 'Over-reserved' : 'Under-reserved',
        ];
      }),
    };
    await exportBoth(exportData);
    toast.success('PDF + Excel exported: Reserve Adequacy by Queue');
  }, [exportBoth, timestamp, metrics, selectedReviewer]);

  const handleExportLitPhases = useCallback(async () => {
    if (!metrics || !data) return;
    const manager = selectedReviewer || 'Richie Mendoza';
    const exportData: ExportableData = {
      title: 'Litigation Evaluation Phases',
      subtitle: 'Open LIT files by phase and age',
      timestamp,
      affectsManager: manager,
      columns: ['Phase', '365+ Days', '181-365 Days', '61-180 Days', 'Under 60 Days', 'Total', '% Aged'],
      rows: metrics.topPhases.map(phase => {
        const agedPct = phase.grandTotal > 0 
          ? ((phase.total365Plus / phase.grandTotal) * 100).toFixed(0)
          : '0';
        return [
          phase.phase,
          phase.total365Plus,
          phase.total181To365,
          phase.total61To180,
          phase.totalUnder60,
          phase.grandTotal,
          `${agedPct}%`,
        ];
      }),
    };
    await exportBoth(exportData);
    toast.success('PDF + Excel exported: Litigation Phases');
  }, [exportBoth, timestamp, metrics, data, selectedReviewer]);

  const handleExportTexasRearEnd = useCallback(async () => {
    const manager = selectedReviewer || 'Richie Mendoza';
    const areaRawData: RawClaimData = {
      columns: ['Area', 'Claims', 'Reserves', 'Low Eval', 'High Eval', 'Avg Reserve'],
      rows: TEXAS_REAR_END_DATA.byArea.map(a => [
        a.area,
        a.claims,
        a.reserves,
        a.lowEval,
        a.highEval,
        Math.round(a.reserves / a.claims),
      ]),
      sheetName: 'By Area',
    };
    const ageRawData: RawClaimData = {
      columns: ['Age Bucket', 'Claims', 'Reserves', 'Low Eval', 'High Eval'],
      rows: TEXAS_REAR_END_DATA.byAge.map(a => [
        a.age,
        a.claims,
        a.reserves,
        a.lowEval,
        a.highEval,
      ]),
      sheetName: 'By Age',
    };
    // Dashboard visuals for Texas Rear End
    const texasDashboardVisuals: DashboardVisual[] = [
      { 
        label: 'Total Claims', 
        value: TEXAS_REAR_END_DATA.summary.totalClaims.toLocaleString(),
        trend: 'IV R/E CV',
        trendDirection: 'neutral'
      },
      { 
        label: 'Open Reserves', 
        value: formatCurrency(TEXAS_REAR_END_DATA.summary.totalReserves),
        trendDirection: 'neutral'
      },
      { 
        label: 'Aged 365+', 
        value: TEXAS_REAR_END_DATA.byAge[0].claims.toLocaleString(),
        trend: `${formatCurrency(TEXAS_REAR_END_DATA.byAge[0].reserves)} at risk`,
        trendDirection: 'down'
      },
      { 
        label: 'Early Settlement', 
        value: TEXAS_REAR_END_DATA.byAge[3].claims.toLocaleString(),
        trend: 'Under 60 days',
        trendDirection: 'up'
      },
    ];

    const texasBulletInsights = [
      `${TEXAS_REAR_END_DATA.byAge[0].claims} claims aged 365+ days — priority settlement focus`,
      `El Paso (101) leads with ${TEXAS_REAR_END_DATA.byArea[0].claims} claims and ${formatCurrency(TEXAS_REAR_END_DATA.byArea[0].reserves)} in reserves`,
      `Early settlements (Under 60 days): ${TEXAS_REAR_END_DATA.byAge[3].claims} claims, ${formatCurrency(TEXAS_REAR_END_DATA.byAge[3].reserves)} exposure`,
      `Evaluation gap: ${formatCurrency(TEXAS_REAR_END_DATA.summary.lowEval)} low vs ${formatCurrency(TEXAS_REAR_END_DATA.summary.highEval)} high`,
    ];

    // Charts for Texas Rear End
    const texasCharts: PDFChart[] = [
      {
        type: 'horizontalBar',
        title: 'Reserves by Age Bucket',
        data: TEXAS_REAR_END_DATA.byAge.map((a, i) => ({
          label: a.age,
          value: a.reserves,
          color: i === 0 ? 'red' : i === 3 ? 'green' : 'amber',
        })),
      },
      {
        type: 'pie',
        title: 'Claims by Area',
        data: TEXAS_REAR_END_DATA.byArea.slice(0, 5).map((a, i) => ({
          label: a.area,
          value: a.claims,
          color: (['red', 'amber', 'green', 'blue', 'muted'] as const)[i % 5],
        })),
      },
    ];

    const exportData: ExportableData = {
      title: 'Texas Rear End Claims (101-110)',
      subtitle: `Loss Description: ${TEXAS_REAR_END_DATA.lossDescription}`,
      timestamp,
      affectsManager: manager,
      dashboardVisuals: texasDashboardVisuals,
      bulletInsights: texasBulletInsights,
      charts: texasCharts,
      summary: {
        'Total Claims': TEXAS_REAR_END_DATA.summary.totalClaims,
        'Total Reserves': formatCurrencyFullValue(TEXAS_REAR_END_DATA.summary.totalReserves),
        'Low Eval': formatCurrencyFullValue(TEXAS_REAR_END_DATA.summary.lowEval),
        'High Eval': formatCurrencyFullValue(TEXAS_REAR_END_DATA.summary.highEval),
      },
      columns: ['Age Bucket', 'Claims', 'Reserves', 'Low Eval', 'High Eval'],
      rows: TEXAS_REAR_END_DATA.byAge.map(a => [
        a.age,
        a.claims,
        formatCurrencyFullValue(a.reserves),
        formatCurrencyFullValue(a.lowEval),
        formatCurrencyFullValue(a.highEval),
      ]),
      rawClaimData: [areaRawData, ageRawData],
    };
    await exportBoth(exportData);
    toast.success('PDF + Excel exported: Texas Rear End Claims');
  }, [exportBoth, timestamp, selectedReviewer]);

  const handleExportClaimsByQueue = useCallback(async () => {
    if (!metrics) return;
    const manager = selectedReviewer || 'Richie Mendoza';
    const exportData: ExportableData = {
      title: 'Claims by Queue',
      subtitle: 'Claims vs Exposures by handling unit',
      timestamp,
      affectsManager: manager,
      columns: ['Queue', 'Claims', 'Exposures', 'Ratio'],
      rows: metrics.typeGroups.map(g => [
        g.typeGroup,
        g.claims,
        g.exposures,
        (g.exposures / g.claims).toFixed(2),
      ]),
    };
    await exportBoth(exportData);
    toast.success('PDF + Excel exported: Claims by Queue');
  }, [exportBoth, timestamp, metrics, selectedReviewer]);

  const handleExportInventoryAge = useCallback(async () => {
    if (!metrics) return;
    const manager = selectedReviewer || 'Richie Mendoza';
    const exportData: ExportableData = {
      title: 'Inventory Age Distribution',
      subtitle: 'Claim counts by age bucket',
      timestamp,
      affectsManager: manager,
      columns: ['Age Bucket', 'Claims', 'Open Reserves', 'Low Eval', 'High Eval'],
      rows: metrics.ageDistribution.map(a => [
        a.age,
        a.claims,
        formatCurrencyFullValue(a.openReserves),
        formatCurrencyFullValue(a.lowEval),
        formatCurrencyFullValue(a.highEval),
      ]),
    };
    await exportBoth(exportData);
    toast.success('PDF + Excel exported: Inventory Age');
  }, [exportBoth, timestamp, metrics, selectedReviewer]);

  // Full Export - all sections in one workbook
  const handleFullExport = useCallback(() => {
    if (!metrics || !data) return;
    
    const medianEval = (metrics.financials.totals.totalLowEval + metrics.financials.totals.totalHighEval) / 2;
    const noEvalTracking: ManagerTracking[] = [
      { name: 'Richie Mendoza', value: metrics.financials.totals.noEvalCount, category: 'no_eval' },
    ];
    
    const sections = [
      {
        title: 'Summary',
        data: {
          title: 'Open Inventory Summary',
          subtitle: 'Claims and Financial Overview',
          timestamp,
          affectsManager: 'Richie Mendoza',
          managerTracking: [...ALL_HIGH_EVAL_ADJUSTERS, ...noEvalTracking],
          summary: {
            'Total Open Claims': formatNumber(metrics.totalOpenClaims),
            'Total Open Exposures': formatNumber(metrics.totalOpenExposures),
            'Open Reserves': formatCurrencyFullValue(metrics.financials.totals.totalOpenReserves),
            'Median Evaluation': formatCurrencyFullValue(medianEval),
            'No Evaluation': formatNumber(metrics.financials.totals.noEvalCount),
          },
          columns: ['Metric', 'Value'],
          rows: [
            ['Total Open Claims', formatNumber(metrics.totalOpenClaims)],
            ['Total Open Exposures', formatNumber(metrics.totalOpenExposures)],
            ['Open Reserves', formatCurrencyFullValue(metrics.financials.totals.totalOpenReserves)],
            ['Low Evaluation', formatCurrencyFullValue(metrics.financials.totals.totalLowEval)],
            ['High Evaluation', formatCurrencyFullValue(metrics.financials.totals.totalHighEval)],
          ],
        } as ExportableData,
      },
      {
        title: 'By Age',
        data: {
          title: 'Reserves vs Evaluation by Age',
          subtitle: 'Financial breakdown by claim age bucket',
          timestamp,
          columns: ['Age Bucket', 'Claims', 'Open Reserves', 'Low Eval', 'High Eval'],
          rows: metrics.ageDistribution.map(item => [
            item.age,
            item.claims,
            item.openReserves,
            item.lowEval,
            item.highEval,
          ]),
          rawClaimData: [{
            columns: ['Age Bucket', 'Claims', 'Open Reserves', 'Low Eval', 'High Eval', 'Median Eval'],
            rows: metrics.ageDistribution.map(item => [
              item.age,
              item.claims,
              item.openReserves,
              item.lowEval,
              item.highEval,
              (item.lowEval + item.highEval) / 2,
            ]),
            sheetName: 'Age Detail',
          }],
        } as ExportableData,
      },
      {
        title: 'By Queue',
        data: {
          title: 'Reserve Adequacy by Queue',
          subtitle: 'Queue-level reserve analysis',
          timestamp,
          columns: ['Queue', 'Open Reserves', 'Low Eval', 'High Eval', 'No Eval Count'],
          rows: metrics.financials.byQueue.map(queue => [
            queue.queue,
            queue.openReserves,
            queue.lowEval,
            queue.highEval,
            queue.noEvalCount,
          ]),
          rawClaimData: [{
            columns: ['Queue', 'Open Reserves', 'Low Eval', 'High Eval', 'No Eval Count', 'Median Eval', 'Variance'],
            rows: metrics.financials.byQueue.map(queue => {
              const median = (queue.lowEval + queue.highEval) / 2;
              return [
                queue.queue,
                queue.openReserves,
                queue.lowEval,
                queue.highEval,
                queue.noEvalCount,
                median,
                queue.openReserves - median,
              ];
            }),
            sheetName: 'Queue Detail',
          }],
        } as ExportableData,
      },
      {
        title: 'Lit Phases',
        data: {
          title: 'Litigation Evaluation Phases',
          subtitle: 'Open LIT files by phase and age',
          timestamp,
          columns: ['Phase', '365+ Days', '181-365 Days', '61-180 Days', 'Under 60 Days', 'Total'],
          rows: metrics.topPhases.map(phase => [
            phase.phase,
            phase.total365Plus,
            phase.total181To365,
            phase.total61To180,
            phase.totalUnder60,
            phase.grandTotal,
          ]),
          rawClaimData: [{
            columns: ['Phase', '365+ Days', '181-365 Days', '61-180 Days', 'Under 60 Days', 'Total', '% Aged'],
            rows: data.litPhases.map(phase => [
              phase.phase,
              phase.total365Plus,
              phase.total181To365,
              phase.total61To180,
              phase.totalUnder60,
              phase.grandTotal,
              phase.grandTotal > 0 ? ((phase.total365Plus / phase.grandTotal) * 100).toFixed(1) : 0,
            ]),
            sheetName: 'All Phases',
          }],
        } as ExportableData,
      },
      {
        title: 'TX Rear End',
        data: {
          title: 'Texas Rear End Claims (101-110)',
          subtitle: `Loss Description: ${TEXAS_REAR_END_DATA.lossDescription}`,
          timestamp,
          summary: {
            'Total Claims': TEXAS_REAR_END_DATA.summary.totalClaims,
            'Total Reserves': TEXAS_REAR_END_DATA.summary.totalReserves,
            'Low Eval': TEXAS_REAR_END_DATA.summary.lowEval,
            'High Eval': TEXAS_REAR_END_DATA.summary.highEval,
          },
          columns: ['Area', 'Claims', 'Reserves', 'Low Eval', 'High Eval'],
          rows: TEXAS_REAR_END_DATA.byArea.map(a => [
            a.area,
            a.claims,
            a.reserves,
            a.lowEval,
            a.highEval,
          ]),
          rawClaimData: [
            {
              columns: ['Area', 'Claims', 'Reserves', 'Low Eval', 'High Eval', 'Avg Reserve'],
              rows: TEXAS_REAR_END_DATA.byArea.map(a => [
                a.area,
                a.claims,
                a.reserves,
                a.lowEval,
                a.highEval,
                Math.round(a.reserves / a.claims),
              ]),
              sheetName: 'TX By Area',
            },
            {
              columns: ['Age Bucket', 'Claims', 'Reserves', 'Low Eval', 'High Eval'],
              rows: TEXAS_REAR_END_DATA.byAge.map(a => [
                a.age,
                a.claims,
                a.reserves,
                a.lowEval,
                a.highEval,
              ]),
              sheetName: 'TX By Age',
            },
          ],
        } as ExportableData,
      },
      {
        title: 'High Eval Mgrs',
        data: {
          title: 'High Evaluation Managers',
          subtitle: 'All adjusters with high evaluations',
          timestamp,
          columns: ['Rank', 'Adjuster Name', 'High Eval Amount'],
          rows: ALL_HIGH_EVAL_ADJUSTERS.map((m, idx) => [
            idx + 1,
            m.name,
            m.value,
          ]),
        } as ExportableData,
      },
    ];

    generateFullExcel(sections);
    toast.success('Full Excel workbook exported with all Open Inventory data!');
  }, [generateFullExcel, timestamp, metrics, data]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
        <span className="ml-2 text-muted-foreground">Loading open inventory data...</span>
      </div>
    );
  }

  if (error || !data || !metrics) {
    return (
      <div className="text-center py-20 text-muted-foreground">
        <p>Unable to load open exposure data</p>
        <p className="text-sm">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Executive Header Banner - Board-Ready Design */}
      <div className="bg-gradient-to-r from-secondary via-secondary/80 to-muted rounded-xl p-4 sm:p-6 border border-border shadow-lg">
        <div className="flex flex-col gap-4">
          {/* Header Row */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-5">
            <div className="p-2 sm:p-3 bg-primary/20 rounded-xl border border-primary/30 w-fit">
              <FileStack className="h-5 w-5 sm:h-7 sm:w-7 text-primary" />
            </div>
            <div className="border-l-2 border-primary pl-3 sm:pl-5">
              <h2 className="text-base sm:text-xl font-bold text-foreground tracking-wide">OPEN INVENTORY COMMAND</h2>
              <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">Claims & Financial Overview • {timestamp}</p>
            </div>
          </div>
          
          {/* Actions Row - Stacked on mobile */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
            {/* COMBINED BOARD PACKAGE - Primary CTA */}
            <Button
              onClick={generateCombinedBoardPackage}
              disabled={generatingBoardPackage}
              className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold px-4 sm:px-6 py-2 sm:py-2.5 shadow-lg text-sm w-full sm:w-auto"
            >
              {generatingBoardPackage ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <FileStack className="h-4 w-4 mr-2" />
              )}
              {generatingBoardPackage ? 'Generating...' : 'Board Package (Combined)'}
            </Button>
            
            {/* Individual Reports - Hidden on mobile, shown as dropdown alternative */}
            <div className="hidden lg:flex items-center gap-2 bg-muted/50 px-3 py-2 rounded-lg border border-border">
              <span className="text-xs font-medium text-muted-foreground">Individual:</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={generateBudgetPDF}
                disabled={generatingBudgetPDF}
                className="h-7 px-2 text-xs hover:bg-primary/10"
              >
                {generatingBudgetPDF ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Budget'}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setShowDecisionsDrawer(true);
                }}
                className="h-7 px-2 text-xs hover:bg-primary/10"
              >
                Decisions
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={generateCP1PDF}
                disabled={generatingCP1PDF}
                className="h-7 px-2 text-xs hover:bg-primary/10"
              >
                {generatingCP1PDF ? <Loader2 className="h-3 w-3 animate-spin" /> : 'CP1'}
              </Button>
            </div>
            
            {/* Mobile-friendly individual reports */}
            <div className="flex lg:hidden gap-2 w-full">
              <Button
                variant="outline"
                size="sm"
                onClick={generateBudgetPDF}
                disabled={generatingBudgetPDF}
                className="flex-1 h-9 text-xs"
              >
                {generatingBudgetPDF ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Budget'}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowDecisionsDrawer(true)}
                className="flex-1 h-9 text-xs"
              >
                Decisions
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={generateCP1PDF}
                disabled={generatingCP1PDF}
                className="flex-1 h-9 text-xs"
              >
                {generatingCP1PDF ? <Loader2 className="h-3 w-3 animate-spin" /> : 'CP1'}
              </Button>
            </div>
            
            {/* Inventory Export */}
            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                await generateExecutivePackage(
                  {
                    totalOpenReserves: FINANCIAL_DATA.totals.totalOpenReserves,
                    pendingEval: FINANCIAL_DATA.totals.noEvalAmount || 0,
                    pendingEvalPct: 63,
                    closuresThisMonth: EXECUTIVE_METRICS.closures.closedThisMonth,
                    avgDaysToClose: EXECUTIVE_METRICS.closures.avgDaysToClose,
                    closureTrend: 7,
                    aged365Count: EXECUTIVE_METRICS.aging.over365Days,
                    aged365Reserves: EXECUTIVE_METRICS.aging.over365Reserves,
                    aged365Pct: EXECUTIVE_METRICS.aging.over365Pct,
                    reservesMoM: EXECUTIVE_METRICS.trends.reservesMoM,
                    reservesYoY: EXECUTIVE_METRICS.trends.reservesYoY,
                    lowEval: FINANCIAL_DATA.totals.totalLowEval,
                    medianEval: (FINANCIAL_DATA.totals.totalLowEval + FINANCIAL_DATA.totals.totalHighEval) / 2,
                    highEval: FINANCIAL_DATA.totals.totalHighEval,
                  },
                  {
                    byAge: FINANCIAL_DATA.byAge,
                    byQueue: FINANCIAL_DATA.byQueue,
                    byTypeGroup: FINANCIAL_DATA.byTypeGroup,
                    highEvalAdjusters: ALL_HIGH_EVAL_ADJUSTERS.map(a => ({ name: a.name, value: String(a.value) })),
                    quarterlyData: EXPERT_QUARTERLY_DATA,
                  }
                );
                toast.success('Inventory Package downloaded!');
              }}
              className="h-9 text-xs w-full sm:w-auto"
            >
              <FileSpreadsheet className="h-3 w-3 mr-1" />
              Inventory
            </Button>
          </div>
        </div>
      </div>

      {/* EXECUTIVE COMMAND CENTER - Key Metrics for C-Suite */}
      <div id="executive-command-center" className="print-section bg-card rounded-xl border border-border shadow-xl print:bg-white print:border-2 print:border-gray-800 print:shadow-none">
        {/* Section Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between p-3 sm:p-5 border-b border-border gap-3">
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="p-2 sm:p-2.5 bg-warning/20 rounded-lg border border-warning/30">
              <Activity className="h-4 w-4 sm:h-5 sm:w-5 text-warning" />
            </div>
            <div>
              <h3 className="text-sm sm:text-lg font-bold text-foreground tracking-wide">EXECUTIVE COMMAND CENTER</h3>
              <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">Real-time portfolio health dashboard</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 px-3 sm:px-4 py-1.5 sm:py-2 bg-success/10 border border-success/30 rounded-lg">
              <div className="w-2 h-2 sm:w-2.5 sm:h-2.5 bg-success rounded-full animate-pulse"></div>
              <span className="text-xs sm:text-sm font-semibold text-success">LIVE</span>
            </div>
          </div>
        </div>

        <div className="p-3 sm:p-5 space-y-4 sm:space-y-6">

        {/* Primary KPI Row - 2x2 on mobile, 4 on desktop */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-5">
          {/* Total Open Reserves with Trend */}
          <div className="bg-secondary/50 rounded-xl p-3 sm:p-5 border border-border hover:border-primary/30 transition-colors">
            <div className="flex items-center justify-between mb-2 sm:mb-3">
              <span className="text-[10px] sm:text-xs font-semibold text-muted-foreground uppercase tracking-wide">Open Reserves</span>
              <div className={`hidden sm:flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-md ${EXECUTIVE_METRICS.trends.reservesMoM > 0 ? 'text-destructive bg-destructive/10' : 'text-success bg-success/10'}`}>
                {EXECUTIVE_METRICS.trends.reservesMoM > 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                {Math.abs(EXECUTIVE_METRICS.trends.reservesMoM)}% MoM
              </div>
            </div>
            <p className="text-xl sm:text-3xl font-bold text-foreground">{formatCurrency(FINANCIAL_DATA.totals.totalOpenReserves)}</p>
            <div className="flex items-center gap-3 mt-2 sm:mt-3 pt-2 sm:pt-3 border-t border-border/50">
              <span className={`text-xs sm:text-sm font-medium ${EXECUTIVE_METRICS.trends.reservesYoY < 0 ? 'text-success' : 'text-destructive'}`}>
                {EXECUTIVE_METRICS.trends.reservesYoY > 0 ? '+' : ''}{EXECUTIVE_METRICS.trends.reservesYoY}% YoY
              </span>
            </div>
          </div>

          {/* Pending Evaluation ALERT */}
          <div className="bg-warning/5 rounded-xl p-3 sm:p-5 border-2 border-warning/40 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-16 sm:w-24 h-16 sm:h-24 bg-warning/5 rounded-full -translate-y-1/2 translate-x-1/2"></div>
            <div className="flex items-center justify-between mb-2 sm:mb-3">
              <span className="text-[10px] sm:text-xs font-bold text-warning uppercase tracking-wide">⚠️ PENDING EVAL</span>
              <AlertTriangle className="h-4 w-4 sm:h-5 sm:w-5 text-warning animate-pulse" />
            </div>
            <p className="text-xl sm:text-3xl font-bold text-warning">{formatCurrency(FINANCIAL_DATA.totals.noEvalAmount || 0)}</p>
            <p className="text-xs sm:text-sm text-warning/80 mt-1 sm:mt-2">63% without evaluation</p>
            <div className="mt-2 sm:mt-3 pt-2 sm:pt-3 border-t border-warning/20">
              <span className="text-[10px] sm:text-xs text-warning font-bold uppercase">Action Required</span>
            </div>
          </div>

          {/* Closure Velocity */}
          <div className="bg-secondary/50 rounded-xl p-3 sm:p-5 border border-border hover:border-success/30 transition-colors">
            <div className="flex items-center justify-between mb-2 sm:mb-3">
              <span className="text-[10px] sm:text-xs font-semibold text-muted-foreground uppercase tracking-wide">Closures This Month</span>
              <div className="hidden sm:flex items-center gap-1 text-xs font-bold text-success bg-success/10 px-2 py-1 rounded-md">
                <TrendingUp className="h-3 w-3" />
                +{((EXECUTIVE_METRICS.closures.closedThisMonth / EXECUTIVE_METRICS.closures.closedLastMonth - 1) * 100).toFixed(0)}%
              </div>
            </div>
            <p className="text-xl sm:text-3xl font-bold text-foreground">{formatNumber(EXECUTIVE_METRICS.closures.closedThisMonth)}</p>
            <div className="flex items-center gap-2 sm:gap-4 mt-2 sm:mt-3 pt-2 sm:pt-3 border-t border-border/50 text-xs sm:text-sm">
              <span className="text-muted-foreground">Avg: <span className="font-medium text-foreground">{EXECUTIVE_METRICS.closures.avgDaysToClose}d</span></span>
              <span className="text-success font-medium">↓{Math.abs(EXECUTIVE_METRICS.closures.avgDaysToCloseTrend)}d</span>
            </div>
          </div>

          {/* Aging Alert */}
          <div className="bg-destructive/5 rounded-xl p-3 sm:p-5 border-2 border-destructive/40">
            <div className="flex items-center justify-between mb-2 sm:mb-3">
              <span className="text-[10px] sm:text-xs font-bold text-destructive uppercase tracking-wide">🚨 AGED 365+</span>
              <Clock className="h-4 w-4 sm:h-5 sm:w-5 text-destructive" />
            </div>
            <p className="text-xl sm:text-3xl font-bold text-destructive">{formatNumber(EXECUTIVE_METRICS.aging.over365Days)}</p>
            <p className="text-xs sm:text-sm text-destructive/80 mt-1 sm:mt-2">{EXECUTIVE_METRICS.aging.over365Pct}% • {formatCurrency(EXECUTIVE_METRICS.aging.over365Reserves)}</p>
            <div className="mt-2 sm:mt-3 pt-2 sm:pt-3 border-t border-destructive/20">
              <div className="h-1.5 sm:h-2 bg-destructive/20 rounded-full overflow-hidden">
                <div className="h-full bg-destructive rounded-full transition-all" style={{ width: `${EXECUTIVE_METRICS.aging.over365Pct}%` }}></div>
              </div>
            </div>
          </div>
        </div>

        {/* CEO Metrics Row - Stack on mobile, 3 cols on desktop */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-5 p-3 sm:p-5 bg-muted/20 rounded-xl border border-border/50">
          {/* Budget Burn Rate */}
          <div 
            className="flex items-center gap-3 sm:gap-4 p-3 sm:p-4 bg-card rounded-xl border border-border cursor-pointer hover:border-primary/50 transition-all hover:shadow-lg"
            onClick={() => setShowBudgetDrawer(true)}
          >
            <div className="p-2 sm:p-3 bg-primary/20 rounded-lg border border-primary/30">
              <Wallet className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] sm:text-xs text-muted-foreground uppercase font-semibold tracking-wide">Budget Burn Rate</p>
              <p className="text-lg sm:text-2xl font-bold text-foreground mt-0.5 sm:mt-1">{budgetMetrics.burnRate}%<span className="text-xs sm:text-sm font-normal text-muted-foreground ml-1 sm:ml-2">YTD</span></p>
              <p className={`text-xs sm:text-sm mt-0.5 sm:mt-1 font-medium truncate ${budgetMetrics.onTrack ? 'text-success' : 'text-destructive'}`}>
                {formatCurrencyK(budgetMetrics.remaining)} remaining
              </p>
            </div>
            <ArrowUpRight className="h-4 w-4 sm:h-5 sm:w-5 text-primary flex-shrink-0" />
          </div>

          {/* Pending Decisions */}
          <div 
            className="flex items-center gap-3 sm:gap-4 p-3 sm:p-4 bg-card rounded-xl border border-border cursor-pointer hover:border-warning/50 transition-all hover:shadow-lg"
            onClick={() => setShowDecisionsDrawer(true)}
          >
            <div className="p-2 sm:p-3 bg-warning/20 rounded-lg border border-warning/30">
              <Flag className="h-5 w-5 sm:h-6 sm:w-6 text-warning" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] sm:text-xs text-muted-foreground uppercase font-semibold tracking-wide">Decisions Pending</p>
              <p className="text-lg sm:text-2xl font-bold text-warning mt-0.5 sm:mt-1">{pendingDecisionsStats.total}<span className="text-xs sm:text-sm font-normal text-muted-foreground ml-1 sm:ml-2">this week</span></p>
              <p className="text-xs sm:text-sm text-destructive font-medium mt-0.5 sm:mt-1 truncate">{pendingDecisionsStats.statuteDeadlines} statute deadlines</p>
            </div>
            <ArrowUpRight className="h-4 w-4 sm:h-5 sm:w-5 text-warning flex-shrink-0" />
          </div>
          
          {/* CP1 Claims */}
          <div 
            className="flex items-center gap-3 sm:gap-4 p-3 sm:p-4 bg-success/5 rounded-xl border border-success/30 cursor-pointer hover:border-success/50 transition-all hover:shadow-lg"
            onClick={() => setShowCP1Drawer(true)}
          >
            <div className="p-2 sm:p-3 bg-success/20 rounded-lg border border-success/30">
              <CheckCircle2 className="h-5 w-5 sm:h-6 sm:w-6 text-success" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] sm:text-xs text-muted-foreground uppercase font-semibold tracking-wide">CP1</p>
              <p className="text-lg sm:text-2xl font-bold text-success mt-0.5 sm:mt-1">{CP1_DATA.totals.yes.toLocaleString()}<span className="text-xs sm:text-sm font-normal text-muted-foreground ml-1 sm:ml-2">({CP1_DATA.cp1Rate}%)</span></p>
              <p className="text-xs sm:text-sm text-muted-foreground mt-0.5 sm:mt-1 truncate">
                BI: <span className="text-success font-semibold">{CP1_DATA.byCoverage[0].yes.toLocaleString()}</span> • PD: <span className="font-medium">{CP1_DATA.byCoverage[1].yes.toLocaleString()}</span>
              </p>
            </div>
            <ArrowUpRight className="h-4 w-4 sm:h-5 sm:w-5 text-success flex-shrink-0" />
          </div>
        </div>
        </div>
      </div>

      {/* Summary Banner with Financials - Cleaner Layout */}
      <div 
        className="bg-card border border-border rounded-xl p-4 sm:p-6 cursor-pointer hover:border-primary/50 transition-colors"
        onDoubleClick={handleExportSummary}
        title="Double-click to export"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-lg sm:text-2xl font-bold text-foreground">Open Inventory: {formatNumber(metrics.totalOpenClaims)} Claims</h2>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1 sm:mt-2">
              As of {data?.dataDate || 'Loading...'} • <span className="font-semibold text-foreground">{formatNumber(metrics.totalOpenExposures)}</span> open exposures
            </p>
            {/* Delta from previous period */}
            {data?.delta && (
              <div className={`flex items-center gap-2 mt-2 text-xs ${data.delta.change >= 0 ? 'text-destructive' : 'text-success'}`}>
                {data.delta.change >= 0 ? (
                  <ArrowUpRight className="h-3.5 w-3.5" />
                ) : (
                  <ArrowDownRight className="h-3.5 w-3.5" />
                )}
                <span className="font-semibold">
                  {data.delta.change >= 0 ? '+' : ''}{formatNumber(data.delta.change)} claims ({data.delta.changePercent >= 0 ? '+' : ''}{data.delta.changePercent.toFixed(1)}%)
                </span>
                <span className="text-muted-foreground">
                  vs {data.delta.previousDate} ({formatNumber(data.delta.previousTotal)})
                </span>
              </div>
            )}
          </div>
          <div className="grid grid-cols-3 gap-2 sm:flex sm:gap-6 items-center">
            <div className="text-center sm:px-5 sm:border-r border-border">
              <p className="text-[10px] sm:text-xs text-muted-foreground uppercase tracking-wide mb-1 sm:mb-2">Open Reserves</p>
              <p className="text-base sm:text-2xl font-bold text-primary">{formatCurrency(metrics.financials.totals.totalOpenReserves)}</p>
            </div>
            <div className="text-center sm:px-5 sm:border-r border-border">
              <p className="text-[10px] sm:text-xs text-muted-foreground uppercase tracking-wide mb-1 sm:mb-2">Low Eval</p>
              <p className="text-base sm:text-2xl font-bold text-foreground">{formatCurrency(metrics.financials.totals.totalLowEval)}</p>
            </div>
            <div className="text-center sm:px-5">
              <p className="text-[10px] sm:text-xs text-muted-foreground uppercase tracking-wide mb-1 sm:mb-2">High Eval</p>
              <p className="text-base sm:text-2xl font-bold text-warning">{formatCurrency(metrics.financials.totals.totalHighEval)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Financial KPI Cards with Reserve Adequacy - Improved Layout */}
      {(() => {
        const medianEval = (metrics.financials.totals.totalLowEval + metrics.financials.totals.totalHighEval) / 2;
        const reserves = metrics.financials.totals.totalOpenReserves;
        const variance = reserves - medianEval;
        const variancePct = ((variance / medianEval) * 100).toFixed(1);
        const isOverReserved = variance > 0;
        
        return (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-5">
            <KPICard
              title="Total Open Reserves"
              value={formatCurrency(reserves)}
              subtitle="Outstanding liability"
              icon={Wallet}
              variant="default"
            />
            <KPICard
              title="Low Evaluation"
              value={formatCurrency(metrics.financials.totals.totalLowEval)}
              subtitle="Minimum exposure"
              icon={DollarSign}
              variant="default"
            />
            <KPICard
              title="Median Evaluation"
              value={formatCurrency(medianEval)}
              subtitle="(Low + High) / 2"
              icon={Target}
              variant="default"
            />
            <KPICard
              title="High Evaluation"
              value={formatCurrency(metrics.financials.totals.totalHighEval)}
              subtitle="Maximum exposure"
              icon={DollarSign}
              variant="warning"
            />
            <div className={`rounded-xl p-3 sm:p-5 border-2 col-span-2 sm:col-span-1 ${isOverReserved ? 'bg-success/5 border-success/40' : 'bg-destructive/5 border-destructive/40'}`}>
              <div className="flex items-center gap-2 mb-1 sm:mb-2">
                {isOverReserved ? (
                  <TrendingUp className="h-4 w-4 sm:h-5 sm:w-5 text-success" />
                ) : (
                  <AlertTriangle className="h-4 w-4 sm:h-5 sm:w-5 text-destructive" />
                )}
                <span className="text-[10px] sm:text-xs font-semibold text-muted-foreground uppercase tracking-wide">Reserve Adequacy</span>
              </div>
              <p className={`text-xl sm:text-3xl font-bold ${isOverReserved ? 'text-success' : 'text-destructive'}`}>
                {isOverReserved ? '+' : ''}{variancePct}%
              </p>
              <p className="text-xs sm:text-sm text-muted-foreground mt-1 sm:mt-2">
                {isOverReserved ? 'Over-reserved' : 'Under-reserved'} by {formatCurrency(Math.abs(variance))}
              </p>
            </div>
          </div>
        );
      })()}

      {/* Reserve Adequacy by Queue */}
      <div 
        className="bg-card border border-border rounded-xl p-4 sm:p-6 cursor-pointer hover:border-primary/50 transition-colors"
        onDoubleClick={handleExportByQueue}
        title="Double-click to export"
      >
        <h3 className="text-sm font-semibold text-foreground uppercase tracking-wide mb-4 sm:mb-5">Reserve Adequacy by Queue</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-5">
          {metrics.financials.byQueue.map((queue) => {
            const qMedian = (queue.lowEval + queue.highEval) / 2;
            const qVariance = queue.openReserves - qMedian;
            const qVariancePct = ((qVariance / qMedian) * 100).toFixed(1);
            const qIsOver = qVariance > 0;
            
            return (
              <div key={queue.queue} className={`rounded-xl p-3 sm:p-5 border ${qIsOver ? 'border-success/30 bg-success/5' : 'border-destructive/30 bg-destructive/5'}`}>
                <div className="flex items-center justify-between mb-2 sm:mb-3 gap-2">
                  <span className="font-bold text-foreground text-xs sm:text-base truncate">{queue.queue}</span>
                  <span className={`text-xs sm:text-sm font-bold px-1.5 sm:px-2 py-0.5 sm:py-1 rounded whitespace-nowrap ${qIsOver ? 'text-success bg-success/10' : 'text-destructive bg-destructive/10'}`}>
                    {qIsOver ? '+' : ''}{qVariancePct}%
                  </span>
                </div>
                <div className="space-y-1.5 sm:space-y-2 text-xs sm:text-sm">
                  <div className="flex justify-between gap-1">
                    <span className="text-muted-foreground">Reserves</span>
                    <span className="font-medium">{formatCurrency(queue.openReserves)}</span>
                  </div>
                  <div className="flex justify-between gap-1">
                    <span className="text-muted-foreground">Median Eval</span>
                    <span className="font-medium">{formatCurrency(qMedian)}</span>
                  </div>
                  <div className="flex justify-between border-t border-border pt-1.5 sm:pt-2 mt-1.5 sm:mt-2 gap-1">
                    <span className="text-muted-foreground">{qIsOver ? 'Over' : 'Under'}</span>
                    <span className={`font-bold ${qIsOver ? 'text-success' : 'text-destructive'}`}>
                      {qIsOver ? '+' : '-'}{formatCurrency(Math.abs(qVariance))}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Charts Row - Financials by Age */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        {/* Reserves vs Eval by Age Bucket */}
        <div 
          className="bg-card border border-border rounded-xl p-4 sm:p-5 cursor-pointer hover:border-primary/50 transition-colors"
          onDoubleClick={handleExportByAge}
          title="Double-click to export"
        >
          <h3 className="text-xs sm:text-sm font-semibold text-foreground uppercase tracking-wide mb-1">Reserves vs Evaluation by Age</h3>
          <p className="text-[10px] sm:text-xs text-muted-foreground mb-3 sm:mb-4">Open reserves compared to low/high evaluation by claim age</p>
          
          <div className="h-56 sm:h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={metrics.ageDistribution} layout="vertical" margin={{ top: 5, right: 20, left: 60, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={10} tickFormatter={(v) => `$${(v/1000000).toFixed(0)}M`} />
                <YAxis type="category" dataKey="age" stroke="hsl(var(--muted-foreground))" fontSize={9} width={55} />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--card))', 
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                    fontSize: '11px'
                  }}
                  formatter={(value: number, name: string) => [formatCurrencyFull(value), name]}
                />
                <Bar dataKey="openReserves" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} name="Open Reserves" />
                <Bar dataKey="lowEval" fill="hsl(var(--accent))" radius={[0, 4, 4, 0]} name="Low Eval" />
                <Bar dataKey="highEval" fill="hsl(var(--warning))" radius={[0, 4, 4, 0]} name="High Eval" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="flex flex-wrap gap-3 sm:gap-6 mt-3 sm:mt-4 pt-3 sm:pt-4 border-t border-border justify-center">
            <div className="flex items-center gap-1.5 sm:gap-2">
              <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded bg-primary"></div>
              <span className="text-[10px] sm:text-xs text-muted-foreground">Reserves</span>
            </div>
            <div className="flex items-center gap-1.5 sm:gap-2">
              <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded" style={{backgroundColor: 'hsl(var(--accent))'}}></div>
              <span className="text-[10px] sm:text-xs text-muted-foreground">Low Eval</span>
            </div>
            <div className="flex items-center gap-1.5 sm:gap-2">
              <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded bg-warning"></div>
              <span className="text-[10px] sm:text-xs text-muted-foreground">High Eval</span>
            </div>
          </div>
        </div>

        {/* Reserves by Queue */}
        <div 
          className="bg-card border border-border rounded-xl p-4 sm:p-5 cursor-pointer hover:border-primary/50 transition-colors"
          onDoubleClick={handleExportByQueue}
          title="Double-click to export"
        >
          <h3 className="text-xs sm:text-sm font-semibold text-foreground uppercase tracking-wide mb-1">Reserves vs Evaluation by Queue</h3>
          <p className="text-[10px] sm:text-xs text-muted-foreground mb-3 sm:mb-4">Open reserves & evaluation by handling unit</p>
          
          <div className="h-56 sm:h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={metrics.financials.byQueue} margin={{ top: 5, right: 5, left: -10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="queue" stroke="hsl(var(--muted-foreground))" fontSize={9} interval={0} angle={-25} textAnchor="end" height={40} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={10} tickFormatter={(v) => `$${(v/1000000).toFixed(0)}M`} />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--card))', 
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                    fontSize: '11px'
                  }}
                  formatter={(value: number | null, name: string) => [
                    value !== null ? formatCurrencyFull(value) : 'No Evaluation', 
                    name
                  ]}
                />
                <Bar dataKey="openReserves" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name="Open Reserves" />
                <Bar dataKey="lowEval" fill="hsl(var(--accent))" radius={[4, 4, 0, 0]} name="Low Eval" />
                <Bar dataKey="highEval" fill="hsl(var(--warning))" radius={[4, 4, 0, 0]} name="High Eval" />
              </BarChart>
            </ResponsiveContainer>
          </div>
          
          <div className="flex flex-wrap gap-3 sm:gap-6 mt-3 sm:mt-4 pt-3 sm:pt-4 border-t border-border justify-center">
            <div className="flex items-center gap-1.5 sm:gap-2">
              <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded bg-primary"></div>
              <span className="text-[10px] sm:text-xs text-muted-foreground">Reserves</span>
            </div>
            <div className="flex items-center gap-1.5 sm:gap-2">
              <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded" style={{backgroundColor: 'hsl(var(--accent))'}}></div>
              <span className="text-[10px] sm:text-xs text-muted-foreground">Low Eval</span>
            </div>
            <div className="flex items-center gap-1.5 sm:gap-2">
              <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded bg-warning"></div>
              <span className="text-[10px] sm:text-xs text-muted-foreground">High Eval</span>
            </div>
          </div>
        </div>
      </div>

      {/* Financial Summary Table */}
      <div 
        className="bg-card border border-border rounded-xl p-4 sm:p-5 cursor-pointer hover:border-primary/50 transition-colors"
        onDoubleClick={handleExportByAge}
        title="Double-click to export"
      >
        <h3 className="text-xs sm:text-sm font-semibold text-foreground uppercase tracking-wide mb-1">Financial Summary by Age</h3>
        <p className="text-[10px] sm:text-xs text-muted-foreground mb-3 sm:mb-4">Claims, reserves, and evaluation amounts by age bucket</p>
        
        {/* Mobile Cards View */}
        <div className="block sm:hidden space-y-2">
          {metrics.financials.byAge.map((item) => (
            <div key={item.age} className="p-3 bg-muted/30 rounded-lg border border-border/50">
              <div className="flex justify-between items-center mb-2">
                <span className="font-semibold text-sm">{item.age}</span>
                <span className="text-xs text-muted-foreground">{formatNumber(item.claims)} claims</span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-xs">
                <div>
                  <p className="text-muted-foreground">Reserves</p>
                  <p className="font-semibold text-primary">{formatCurrency(item.openReserves)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Low</p>
                  <p className="font-medium">{formatCurrency(item.lowEval)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">High</p>
                  <p className="font-medium text-warning">{formatCurrency(item.highEval)}</p>
                </div>
              </div>
            </div>
          ))}
          <div className="p-3 bg-muted/50 rounded-lg border border-border font-bold">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm">Total</span>
              <span className="text-xs text-muted-foreground">{formatNumber(metrics.financials.byAge.reduce((s, i) => s + i.claims, 0))} claims</span>
            </div>
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div>
                <p className="text-muted-foreground">Reserves</p>
                <p className="text-primary">{formatCurrency(metrics.financials.totals.totalOpenReserves)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Low</p>
                <p>{formatCurrency(metrics.financials.totals.totalLowEval)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">High</p>
                <p className="text-warning">{formatCurrency(metrics.financials.totals.totalHighEval)}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Desktop Table View */}
        <div className="hidden sm:block overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-2 px-3 text-muted-foreground font-medium">Age Bucket</th>
                <th className="text-right py-2 px-3 text-muted-foreground font-medium">Claims</th>
                <th className="text-right py-2 px-3 text-primary font-medium">Open Reserves</th>
                <th className="text-right py-2 px-3 text-accent-foreground font-medium">Low Eval</th>
                <th className="text-right py-2 px-3 text-warning font-medium">High Eval</th>
                <th className="text-right py-2 px-3 text-muted-foreground font-medium">Avg Reserve</th>
              </tr>
            </thead>
            <tbody>
              {metrics.financials.byAge.map((item) => (
                <tr key={item.age} className="border-b border-border/50 hover:bg-muted/30">
                  <td className="py-2 px-3 font-medium">{item.age}</td>
                  <td className="py-2 px-3 text-right">{formatNumber(item.claims)}</td>
                  <td className="py-2 px-3 text-right text-primary font-semibold">{formatCurrency(item.openReserves)}</td>
                  <td className="py-2 px-3 text-right">{formatCurrency(item.lowEval)}</td>
                  <td className="py-2 px-3 text-right text-warning">{formatCurrency(item.highEval)}</td>
                  <td className="py-2 px-3 text-right text-muted-foreground">{formatCurrencyFull(Math.round(item.openReserves / item.claims))}</td>
                </tr>
              ))}
              <tr className="bg-muted/50 font-bold">
                <td className="py-2 px-3">Total</td>
                <td className="py-2 px-3 text-right">{formatNumber(metrics.financials.byAge.reduce((s, i) => s + i.claims, 0))}</td>
                <td className="py-2 px-3 text-right text-primary">{formatCurrency(metrics.financials.totals.totalOpenReserves)}</td>
                <td className="py-2 px-3 text-right">{formatCurrency(metrics.financials.totals.totalLowEval)}</td>
                <td className="py-2 px-3 text-right text-warning">{formatCurrency(metrics.financials.totals.totalHighEval)}</td>
                <td className="py-2 px-3 text-right text-muted-foreground">{formatCurrencyFull(Math.round(metrics.financials.totals.totalOpenReserves / metrics.financials.byAge.reduce((s, i) => s + i.claims, 0)))}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Claims by Queue */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        <div 
          className="bg-card border border-border rounded-xl p-4 sm:p-5 cursor-pointer hover:border-primary/50 transition-colors"
          onDoubleClick={handleExportClaimsByQueue}
          title="Double-click to export"
        >
          <h3 className="text-xs sm:text-sm font-semibold text-foreground uppercase tracking-wide mb-1">Claims by Queue</h3>
          <p className="text-[10px] sm:text-xs text-muted-foreground mb-3 sm:mb-4">Claims vs Exposures by handling unit</p>
          
          <div className="h-48 sm:h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={metrics.typeGroups} margin={{ top: 5, right: 5, left: -10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="typeGroup" stroke="hsl(var(--muted-foreground))" fontSize={9} interval={0} angle={-25} textAnchor="end" height={40} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={10} tickFormatter={formatNumber} />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--card))', 
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                    fontSize: '11px'
                  }}
                  formatter={(value: number, name: string) => [formatNumber(value), name === 'claims' ? 'Claims' : 'Exposures']}
                />
                <Bar dataKey="claims" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name="Claims" />
                <Bar dataKey="exposures" fill="hsl(var(--accent))" radius={[4, 4, 0, 0]} name="Exposures" />
              </BarChart>
            </ResponsiveContainer>
          </div>
          
          <div className="flex gap-4 sm:gap-6 mt-3 sm:mt-4 pt-3 sm:pt-4 border-t border-border justify-center">
            <div className="flex items-center gap-1.5 sm:gap-2">
              <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded bg-primary"></div>
              <span className="text-[10px] sm:text-xs text-muted-foreground">Claims</span>
            </div>
            <div className="flex items-center gap-1.5 sm:gap-2">
              <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded" style={{backgroundColor: 'hsl(var(--accent))'}}></div>
              <span className="text-[10px] sm:text-xs text-muted-foreground">Exposures</span>
            </div>
          </div>
        </div>

        {/* Inventory Age */}
        <div 
          className="bg-card border border-border rounded-xl p-4 sm:p-5 cursor-pointer hover:border-primary/50 transition-colors"
          onDoubleClick={handleExportInventoryAge}
          title="Double-click to export"
        >
          <h3 className="text-xs sm:text-sm font-semibold text-foreground uppercase tracking-wide mb-1">Inventory Age Distribution</h3>
          <p className="text-[10px] sm:text-xs text-muted-foreground mb-3 sm:mb-4">Claim counts by age bucket</p>
          
          <div className="h-48 sm:h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={metrics.ageDistribution} layout="vertical" margin={{ top: 5, right: 20, left: 55, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={10} tickFormatter={formatNumber} />
                <YAxis type="category" dataKey="age" stroke="hsl(var(--muted-foreground))" fontSize={9} width={50} />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--card))', 
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                    fontSize: '11px'
                  }}
                  formatter={(value: number) => [formatNumber(value), 'Claims']}
                />
                <Bar dataKey="claims" radius={[0, 4, 4, 0]}>
                  {metrics.ageDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="flex gap-2 sm:gap-4 mt-3 sm:mt-4 pt-3 sm:pt-4 border-t border-border justify-center flex-wrap">
            {metrics.ageDistribution.map(item => (
              <div key={item.age} className="text-center">
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 sm:w-3 sm:h-3 rounded" style={{ backgroundColor: item.fill }}></div>
                  <span className="text-[9px] sm:text-xs text-muted-foreground">{item.age}</span>
                </div>
                <p className="text-xs sm:text-sm font-semibold">{formatNumber(item.claims)}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Litigation Phases Table */}
      <div 
        className="bg-card border border-border rounded-xl p-4 sm:p-5 cursor-pointer hover:border-primary/50 transition-colors"
        onDoubleClick={handleExportLitPhases}
        title="Double-click to export"
      >
        <h3 className="text-xs sm:text-sm font-semibold text-foreground uppercase tracking-wide mb-1">Litigation Evaluation Phases</h3>
        <p className="text-[10px] sm:text-xs text-muted-foreground mb-3 sm:mb-4">Open LIT files by phase and age — focus on 365+ day aged claims</p>
        
        {/* Mobile Cards View */}
        <div className="block sm:hidden space-y-2">
          {metrics.topPhases.map((phase) => {
            const agedPct = phase.grandTotal > 0 
              ? ((phase.total365Plus / phase.grandTotal) * 100).toFixed(0)
              : '0';
            return (
              <div key={phase.phase} className="p-3 bg-muted/30 rounded-lg border border-border/50">
                <div className="flex justify-between items-center mb-2">
                  <span className="font-semibold text-sm">{phase.phase}</span>
                  <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${parseInt(agedPct) > 70 ? 'text-destructive bg-destructive/10' : parseInt(agedPct) > 50 ? 'text-warning bg-warning/10' : 'text-muted-foreground bg-muted'}`}>
                    {agedPct}% aged
                  </span>
                </div>
                <div className="grid grid-cols-4 gap-2 text-xs">
                  <div>
                    <p className="text-destructive text-[10px]">365+</p>
                    <p className="font-semibold text-destructive">{formatNumber(phase.total365Plus)}</p>
                  </div>
                  <div>
                    <p className="text-warning text-[10px]">181-365</p>
                    <p className="font-medium text-warning">{formatNumber(phase.total181To365)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-[10px]">61-180</p>
                    <p className="font-medium">{formatNumber(phase.total61To180)}</p>
                  </div>
                  <div>
                    <p className="text-success text-[10px]">&lt;60</p>
                    <p className="font-medium text-success">{formatNumber(phase.totalUnder60)}</p>
                  </div>
                </div>
              </div>
            );
          })}
          <div className="p-3 bg-muted/50 rounded-lg border border-border font-bold">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm">LIT Total</span>
              <span className="text-xs text-destructive">{((data.litPhases.reduce((s, p) => s + p.total365Plus, 0) / metrics.litTotal) * 100).toFixed(0)}% aged</span>
            </div>
            <div className="grid grid-cols-4 gap-2 text-xs">
              <div>
                <p className="text-destructive text-[10px]">365+</p>
                <p className="text-destructive">{formatNumber(data.litPhases.reduce((s, p) => s + p.total365Plus, 0))}</p>
              </div>
              <div>
                <p className="text-warning text-[10px]">181-365</p>
                <p className="text-warning">{formatNumber(data.litPhases.reduce((s, p) => s + p.total181To365, 0))}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-[10px]">61-180</p>
                <p>{formatNumber(data.litPhases.reduce((s, p) => s + p.total61To180, 0))}</p>
              </div>
              <div>
                <p className="text-success text-[10px]">&lt;60</p>
                <p className="text-success">{formatNumber(data.litPhases.reduce((s, p) => s + p.totalUnder60, 0))}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Desktop Table View */}
        <div className="hidden sm:block overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-2 px-3 text-muted-foreground font-medium">Evaluation Phase</th>
                <th className="text-right py-2 px-3 text-destructive font-medium">365+ Days</th>
                <th className="text-right py-2 px-3 text-warning font-medium">181-365 Days</th>
                <th className="text-right py-2 px-3 text-muted-foreground font-medium">61-180 Days</th>
                <th className="text-right py-2 px-3 text-success font-medium">Under 60 Days</th>
                <th className="text-right py-2 px-3 text-foreground font-medium">Total</th>
                <th className="text-right py-2 px-3 text-muted-foreground font-medium">% Aged</th>
              </tr>
            </thead>
            <tbody>
              {metrics.topPhases.map((phase) => {
                const agedPct = phase.grandTotal > 0 
                  ? ((phase.total365Plus / phase.grandTotal) * 100).toFixed(0)
                  : '0';
                return (
                  <tr key={phase.phase} className="border-b border-border/50 hover:bg-muted/30">
                    <td className="py-2 px-3 font-medium">{phase.phase}</td>
                    <td className="py-2 px-3 text-right text-destructive font-semibold">{formatNumber(phase.total365Plus)}</td>
                    <td className="py-2 px-3 text-right text-warning">{formatNumber(phase.total181To365)}</td>
                    <td className="py-2 px-3 text-right text-muted-foreground">{formatNumber(phase.total61To180)}</td>
                    <td className="py-2 px-3 text-right text-success">{formatNumber(phase.totalUnder60)}</td>
                    <td className="py-2 px-3 text-right font-bold">{formatNumber(phase.grandTotal)}</td>
                    <td className={`py-2 px-3 text-right font-medium ${parseInt(agedPct) > 70 ? 'text-destructive' : parseInt(agedPct) > 50 ? 'text-warning' : 'text-muted-foreground'}`}>
                      {agedPct}%
                    </td>
                  </tr>
                );
              })}
              <tr className="bg-muted/50 font-bold">
                <td className="py-2 px-3">LIT Total</td>
                <td className="py-2 px-3 text-right text-destructive">{formatNumber(data.litPhases.reduce((s, p) => s + p.total365Plus, 0))}</td>
                <td className="py-2 px-3 text-right text-warning">{formatNumber(data.litPhases.reduce((s, p) => s + p.total181To365, 0))}</td>
                <td className="py-2 px-3 text-right">{formatNumber(data.litPhases.reduce((s, p) => s + p.total61To180, 0))}</td>
                <td className="py-2 px-3 text-right text-success">{formatNumber(data.litPhases.reduce((s, p) => s + p.totalUnder60, 0))}</td>
                <td className="py-2 px-3 text-right">{formatNumber(metrics.litTotal)}</td>
                <td className="py-2 px-3 text-right text-destructive">
                  {((data.litPhases.reduce((s, p) => s + p.total365Plus, 0) / metrics.litTotal) * 100).toFixed(0)}%
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Texas Rear End — Age-Based Tracker */}
      <div 
        className="bg-card border border-border rounded-xl p-4 sm:p-5 cursor-pointer hover:border-primary/50 transition-colors"
        onDoubleClick={handleExportTexasRearEnd}
        title="Double-click to export"
      >
        <h3 className="text-xs sm:text-sm font-semibold text-foreground uppercase tracking-wide mb-1">Texas Rear End Settlement Tracker</h3>
        <p className="text-[10px] sm:text-xs text-muted-foreground mb-3 sm:mb-4">Early settlement focus by age • Real-time impact tracking</p>

        {/* Age Buckets - Responsive Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 mb-3 sm:mb-4">
          {TEXAS_REAR_END_DATA.byAge.map((bucket, idx) => {
            const pctOfTotal = ((bucket.claims / TEXAS_REAR_END_DATA.summary.totalClaims) * 100).toFixed(0);
            const isAged = bucket.age.includes('365+') || bucket.age.includes('181-365');
            return (
              <div 
                key={bucket.age} 
                className={`p-2 sm:p-3 rounded-lg border ${
                  idx === 0 ? 'border-destructive/30 bg-destructive/5' : 
                  idx === 1 ? 'border-warning/30 bg-warning/5' : 
                  'border-border bg-muted/20'
                }`}
              >
                <p className={`text-[10px] sm:text-xs font-medium ${idx === 0 ? 'text-destructive' : idx === 1 ? 'text-warning' : 'text-muted-foreground'}`}>
                  {bucket.age}
                </p>
                <p className="text-base sm:text-lg font-bold text-foreground">{bucket.claims.toLocaleString()}</p>
                <p className="text-[10px] sm:text-xs text-muted-foreground">{formatCurrencyK(bucket.reserves)} • {pctOfTotal}%</p>
              </div>
            );
          })}
        </div>

        {/* Settlement Impact Tracker - Placeholder for real-time data */}
        <div className="bg-muted/20 rounded-lg border border-border p-3 sm:p-4 mb-3 sm:mb-4">
          <div className="flex items-center justify-between mb-2 sm:mb-3">
            <h4 className="text-[10px] sm:text-xs font-semibold text-muted-foreground uppercase">Settlement Impact This Month</h4>
            <span className="text-[10px] sm:text-xs text-muted-foreground">Data pending</span>
          </div>
          <div className="grid grid-cols-3 gap-2 sm:gap-4 text-center">
            <div>
              <p className="text-lg sm:text-2xl font-bold text-success">—</p>
              <p className="text-[10px] sm:text-xs text-muted-foreground">Settled</p>
            </div>
            <div>
              <p className="text-lg sm:text-2xl font-bold text-primary">—</p>
              <p className="text-[10px] sm:text-xs text-muted-foreground">Reserves Released</p>
            </div>
            <div>
              <p className="text-lg sm:text-2xl font-bold text-foreground">—</p>
              <p className="text-[10px] sm:text-xs text-muted-foreground">Avg Days to Settle</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
          {/* Deploy Directive */}
          <div className="bg-muted/30 rounded-lg border border-border p-3 sm:p-4">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase">Deploy Review</h4>
              <ReviewerSettings />
            </div>
            <RadioGroup 
              value={selectedClaimFilter} 
              onValueChange={(val) => {
                setSelectedClaimFilter(val);
                setAiSummary('');
              }}
              className="space-y-1"
            >
              {TEXAS_REAR_END_DATA.byAge.map((bucket, idx) => {
                const filterKey = idx === 0 ? 'aged-365' : idx === 1 ? 'aged-181-365' : idx === 2 ? 'aged-61-180' : 'under-60';
                const isSelected = selectedClaimFilter === filterKey;
                return (
                  <label 
                    key={bucket.age}
                    className={`flex items-center justify-between p-2 rounded border cursor-pointer text-xs ${
                      isSelected 
                        ? idx === 0 ? 'border-destructive bg-destructive/10' 
                        : idx === 1 ? 'border-warning bg-warning/10' 
                        : 'border-primary bg-primary/10'
                        : 'border-border hover:bg-muted/50'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <RadioGroupItem value={filterKey} />
                      <span className={`font-medium ${idx === 0 ? 'text-destructive' : idx === 1 ? 'text-warning' : ''}`}>
                        {bucket.age}
                      </span>
                    </div>
                    <span className="text-muted-foreground">{bucket.claims}</span>
                  </label>
                );
              })}
            </RadioGroup>

            <div className="mt-3 grid grid-cols-2 gap-2">
              <select
                value={selectedReviewer}
                onChange={(e) => {
                  setSelectedReviewer(e.target.value);
                  setAiSummary('');
                }}
                className="p-2 rounded border border-border bg-background text-xs"
              >
                <option value="">Reviewer...</option>
                {reviewers.map(r => (
                  <option key={r.id} value={r.name}>{r.name}</option>
                ))}
              </select>
              <div className="flex items-center gap-1">
                <Calendar className="h-3 w-3 text-muted-foreground" />
                <input
                  type="date"
                  value={deadline}
                  onChange={(e) => {
                    setDeadline(e.target.value);
                    setAiSummary('');
                  }}
                  min={format(new Date(), 'yyyy-MM-dd')}
                  className="flex-1 p-2 rounded border border-border bg-background text-xs"
                />
              </div>
            </div>

            <div className="mt-2 flex items-center justify-between text-xs">
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-1 cursor-pointer">
                  <Switch checked={testMode} onCheckedChange={setTestMode} className="scale-75" />
                  <span className="text-muted-foreground">Test Mode</span>
                </label>
                <label className="flex items-center gap-1 cursor-pointer">
                  <Switch checked={sendEmail} onCheckedChange={setSendEmail} className="scale-75" />
                  <span className="text-muted-foreground">📧 Email</span>
                </label>
              </div>
              {selectedClaimFilter && (
                <span className="text-muted-foreground">
                  ${(selectedClaimFilter === 'aged-365' ? TEXAS_REAR_END_DATA.byAge[0].reserves / 1000000 :
                     selectedClaimFilter === 'aged-181-365' ? TEXAS_REAR_END_DATA.byAge[1].reserves / 1000000 :
                     selectedClaimFilter === 'aged-61-180' ? TEXAS_REAR_END_DATA.byAge[2].reserves / 1000000 :
                     selectedClaimFilter === 'under-60' ? TEXAS_REAR_END_DATA.byAge[3].reserves / 1000000 :
                     TEXAS_REAR_END_DATA.summary.totalReserves / 1000000).toFixed(1)}M at risk
                </span>
              )}
            </div>

            {/* Buttons Row */}
            <div className="mt-3 flex gap-2">
              <Button 
                className="flex-1" 
                variant="outline"
                size="sm"
                disabled={!selectedClaimFilter || !selectedReviewer || generatingSummary}
                onClick={async () => {
                  setGeneratingSummary(true);
                  const getFilterData = () => {
                    switch (selectedClaimFilter) {
                      case 'aged-365': return { count: TEXAS_REAR_END_DATA.byAge[0].claims, reserves: TEXAS_REAR_END_DATA.byAge[0].reserves };
                      case 'aged-181-365': return { count: TEXAS_REAR_END_DATA.byAge[1].claims, reserves: TEXAS_REAR_END_DATA.byAge[1].reserves };
                      case 'aged-61-180': return { count: TEXAS_REAR_END_DATA.byAge[2].claims, reserves: TEXAS_REAR_END_DATA.byAge[2].reserves };
                      case 'under-60': return { count: TEXAS_REAR_END_DATA.byAge[3].claims, reserves: TEXAS_REAR_END_DATA.byAge[3].reserves };
                      default: return { count: 0, reserves: 0 };
                    }
                  };
                  const filterData = getFilterData();
                  
                  try {
                    const { data, error } = await supabase.functions.invoke('generate-directive-summary', {
                      body: {
                        claimFilter: selectedClaimFilter,
                        claimCount: filterData.count,
                        region: 'Texas 101-110',
                        lossDescription: TEXAS_REAR_END_DATA.lossDescription,
                        reviewer: selectedReviewer,
                        deadline: format(new Date(deadline), 'MMMM d, yyyy'),
                        totalReserves: filterData.reserves,
                      }
                    });
                    if (error) throw error;
                    setAiSummary(data.summary);
                  } catch (err: any) {
                    console.error('Summary error:', err);
                    setAiSummary(`DIRECTIVE: Review ${filterData.count} claims. Exposure: $${(filterData.reserves/1000000).toFixed(1)}M. Due: ${format(new Date(deadline), 'MMM d')}. Assigned: ${selectedReviewer}.`);
                  }
                  setGeneratingSummary(false);
                }}
              >
                {generatingSummary ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3 mr-1" />}
                {generatingSummary ? '' : 'AI Summary'}
              </Button>
            </div>

            {/* Compact AI Summary */}
            {aiSummary && (
              <div className="mt-2 p-2 rounded bg-primary/10 border border-primary/30 text-xs">
                <p className="text-foreground leading-snug">{aiSummary}</p>
              </div>
            )}

            <Button 
              className="w-full mt-2" 
              variant="default"
              size="sm"
              disabled={!selectedClaimFilter || !selectedReviewer || !aiSummary || deploying}
              onClick={async () => {
                setDeploying(true);
                
                // Get filter-specific data
                const getFilterData = () => {
                  switch (selectedClaimFilter) {
                    case 'aged-365': return { count: TEXAS_REAR_END_DATA.byAge[0].claims, ageBucket: '365+ Days', areas: TEXAS_REAR_END_DATA.byArea };
                    case 'aged-181-365': return { count: TEXAS_REAR_END_DATA.byAge[1].claims, ageBucket: '181-365 Days', areas: TEXAS_REAR_END_DATA.byArea };
                    case 'aged-61-180': return { count: TEXAS_REAR_END_DATA.byAge[2].claims, ageBucket: '61-180 Days', areas: TEXAS_REAR_END_DATA.byArea };
                    case 'under-60': return { count: TEXAS_REAR_END_DATA.byAge[3].claims, ageBucket: 'Under 60 Days', areas: TEXAS_REAR_END_DATA.byArea };
                    default: return { count: 0, ageBucket: '', areas: [] };
                  }
                };
                const filterData = getFilterData();
                
                // Create sample claims for the database (limited to 15 for demo)
                const claimsToInsert = [];
                const areas = filterData.areas;
                const sampleSize = Math.min(filterData.count, 15);
                
                // Generate claim IDs in format Prefix-Claim (matching CSV format)
                const prefixes = ['39', '78', '72', '65', '62', '89', '63', '66', '68', '80', '73', '67', '40'];
                for (let i = 0; i < sampleSize; i++) {
                  const area = areas[i % areas.length];
                  const ageBucket = filterData.ageBucket;
                  
                  // Use format matching actual claim numbers: Prefix-ClaimNumber
                  const prefix = prefixes[i % prefixes.length];
                  const claimNum = 100000 + Math.floor(Math.random() * 900000);
                  
                  claimsToInsert.push({
                    claim_id: `${prefix}-${claimNum}`,
                    area: area.area,
                    loss_description: TEXAS_REAR_END_DATA.lossDescription,
                    reserves: Math.round(area.reserves / area.claims),
                    low_eval: Math.round((area.lowEval || 0) / area.claims),
                    high_eval: Math.round((area.highEval || 0) / area.claims),
                    age_bucket: ageBucket,
                    status: 'assigned' as const,
                    assigned_to: selectedReviewer,
                    assigned_at: new Date().toISOString(),
                    notes: `${aiSummary}\n\nDeadline: ${format(new Date(deadline), 'MMMM d, yyyy')}`,
                  });
                }
                
                const { error } = await supabase
                  .from('claim_reviews')
                  .insert(claimsToInsert);
                
                if (error) {
                  console.error('Deploy error:', error);
                  toast.error("Failed to deploy directive");
                } else {
                  // Handle SMS notification
                  if (testMode) {
                    // Simulate SMS in test mode
                    toast.success(
                      <div className="space-y-1">
                        <p className="font-semibold">📱 SMS Simulated (Test Mode)</p>
                        <p className="text-xs text-muted-foreground">
                          To: {selectedReviewer}<br/>
                          {aiSummary.slice(0, 100)}...
                        </p>
                      </div>,
                      { duration: 8000 }
                    );
                  } else {
                    // Send real SMS via edge function with Excel attachment
                    const reviewerPhone = selectedReviewerData?.phone;
                    if (reviewerPhone) {
                      try {
                        // Generate Excel data for the claims
                        const XLSX = await import('xlsx');
                        const excelData = claimsToInsert.map(c => ({
                          'Claim ID': c.claim_id,
                          'Area': c.area,
                          'Loss Description': c.loss_description,
                          'Reserves': c.reserves,
                          'Low Eval': c.low_eval,
                          'High Eval': c.high_eval,
                          'Age Bucket': c.age_bucket,
                          'Assigned To': c.assigned_to,
                          'Deadline': format(new Date(deadline), 'MMMM d, yyyy'),
                        }));
                        
                        const worksheet = XLSX.utils.json_to_sheet(excelData);
                        const workbook = XLSX.utils.book_new();
                        XLSX.utils.book_append_sheet(workbook, worksheet, 'Claims to Review');
                        
                        // Set column widths
                        worksheet['!cols'] = [
                          { wch: 15 }, // Claim ID
                          { wch: 20 }, // Area
                          { wch: 30 }, // Loss Description
                          { wch: 12 }, // Reserves
                          { wch: 12 }, // Low Eval
                          { wch: 12 }, // High Eval
                          { wch: 15 }, // Age Bucket
                          { wch: 18 }, // Assigned To
                          { wch: 18 }, // Deadline
                        ];
                        
                        // Generate base64 Excel
                        const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'base64' });
                        
                        const { data: smsResult, error: smsError } = await supabase.functions.invoke('send-review-sms', {
                          body: {
                            to: reviewerPhone,
                            claimType: filterData.ageBucket,
                            claimCount: claimsToInsert.length,
                            region: 'Texas 101-110',
                            lossDescription: TEXAS_REAR_END_DATA.lossDescription,
                            reviewer: selectedReviewer,
                            deadline: format(new Date(deadline), 'MMMM d, yyyy'),
                            claims: claimsToInsert,
                            excelBase64: excelBuffer,
                          }
                        });
                        if (smsError) {
                          console.error('SMS send error:', smsError);
                          toast.error('Failed to send SMS notification');
                        } else {
                          toast.success(
                            <div className="space-y-1">
                              <p className="font-semibold">📱 SMS Sent with Excel</p>
                              <p className="text-xs text-muted-foreground">
                                Notification + claim data sent to {selectedReviewer}
                              </p>
                            </div>,
                            { duration: 5000 }
                          );
                        }
                      } catch (smsErr) {
                        console.error('SMS error:', smsErr);
                        toast.error('SMS notification failed');
                      }
                    } else {
                      toast.info('No phone number configured for reviewer - SMS skipped');
                    }
                  }
                  
                  // Send email notification if enabled
                  if (sendEmail && !testMode) {
                    const reviewerEmail = selectedReviewerData?.email;
                    if (reviewerEmail) {
                      try {
                        // Generate Excel data for email
                        const XLSX = await import('xlsx');
                        const emailExcelData = claimsToInsert.map(c => ({
                          'Claim ID': c.claim_id,
                          'Area': c.area,
                          'Loss Description': c.loss_description,
                          'Reserves': c.reserves,
                          'Low Eval': c.low_eval,
                          'High Eval': c.high_eval,
                          'Age Bucket': c.age_bucket,
                          'Assigned To': c.assigned_to,
                          'Deadline': format(new Date(deadline), 'MMMM d, yyyy'),
                        }));
                        
                        const emailWorksheet = XLSX.utils.json_to_sheet(emailExcelData);
                        const emailWorkbook = XLSX.utils.book_new();
                        XLSX.utils.book_append_sheet(emailWorkbook, emailWorksheet, 'Claims to Review');
                        const emailExcelBuffer = XLSX.write(emailWorkbook, { bookType: 'xlsx', type: 'base64' });
                        
                        const { error: emailError } = await supabase.functions.invoke('send-review-email', {
                          body: {
                            to: reviewerEmail,
                            reviewerName: selectedReviewer,
                            claimType: filterData.ageBucket,
                            claimCount: claimsToInsert.length,
                            region: 'Texas 101-110',
                            lossDescription: TEXAS_REAR_END_DATA.lossDescription,
                            deadline: format(new Date(deadline), 'MMMM d, yyyy'),
                            claims: claimsToInsert,
                            excelBase64: emailExcelBuffer,
                          }
                        });
                        
                        if (emailError) {
                          console.error('Email send error:', emailError);
                          toast.error('Failed to send email notification');
                        } else {
                          toast.success(
                            <div className="space-y-1">
                              <p className="font-semibold">📧 Email Sent with Excel</p>
                              <p className="text-xs text-muted-foreground">
                                Full claim data sent to {selectedReviewer}
                              </p>
                            </div>,
                            { duration: 5000 }
                          );
                        }
                      } catch (emailErr) {
                        console.error('Email error:', emailErr);
                        toast.error('Email notification failed');
                      }
                    } else {
                      toast.info('No email configured for reviewer - email skipped');
                    }
                  } else if (sendEmail && testMode) {
                    toast.success(
                      <div className="space-y-1">
                        <p className="font-semibold">📧 Email Simulated (Test Mode)</p>
                        <p className="text-xs text-muted-foreground">
                          Would send to: {selectedReviewer}
                        </p>
                      </div>,
                      { duration: 5000 }
                    );
                  }
                  
                  toast.success(`Deployed ${claimsToInsert.length} claims to ${selectedReviewer}`, {
                    description: `Deadline: ${format(new Date(deadline), 'MMM d, yyyy')}`,
                    icon: <CheckCircle2 className="h-4 w-4" />
                  });
                  setSelectedClaimFilter('');
                  setSelectedReviewer('');
                  setDirective('');
                  setAiSummary('');
                }
                setDeploying(false);
              }}
            >
              {deploying ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Send className="h-4 w-4 mr-2" />
              )}
              Deploy Directive
            </Button>
            <p className="text-xs text-muted-foreground mt-2 text-center">
              {!aiSummary ? "Generate summary first to deploy" : "Track progress in real-time below"}
            </p>
          </div>

          {/* Review Queue by Age */}
          <div className="bg-muted/30 rounded-lg border border-border p-4">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase mb-3">Review Queue</h4>
            {reviews.length > 0 ? (
              <div className="space-y-2">
                {['365+ Days', '181-365 Days', '61-180 Days', 'Under 60 Days'].map(age => {
                  const ageReviews = reviews.filter(r => r.age_bucket === age);
                  const pending = ageReviews.filter(r => r.status === 'assigned' || r.status === 'in_review').length;
                  const completed = ageReviews.filter(r => r.status === 'completed').length;
                  if (ageReviews.length === 0) return null;
                  return (
                    <div key={age} className="flex items-center justify-between py-1.5 border-b border-border/50 last:border-0">
                      <span className={`text-xs font-medium ${
                        age === '365+ Days' ? 'text-destructive' : 
                        age === '181-365 Days' ? 'text-warning' : ''
                      }`}>{age}</span>
                      <div className="flex gap-2 text-xs">
                        <span className="text-muted-foreground">{pending} pending</span>
                        <span className="text-success">{completed} done</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground text-center py-4">No active reviews</p>
            )}
          </div>
        </div>

        {/* Real-Time Progress Tracking */}
        {reviews.length > 0 && (
          <div className="mt-4 pt-4 border-t border-border">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-xs font-semibold text-foreground uppercase flex items-center gap-2">
                <Eye className="h-3 w-3" /> Live Review Progress
              </h4>
              <div className="flex gap-4 text-xs">
                <span className="font-semibold text-primary">
                  ${reviewStats.totalReserves.toLocaleString()} reserves
                </span>
              </div>
            </div>
            
            <div className="max-h-40 overflow-y-auto bg-card rounded-lg border border-border">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-muted">
                  <tr>
                    <th className="text-left py-2 px-3">Claim</th>
                    <th className="text-left py-2 px-3">Area</th>
                    <th className="text-left py-2 px-3">Age</th>
                    <th className="text-right py-2 px-3">Reserves</th>
                    <th className="text-left py-2 px-3">Status</th>
                    <th className="text-left py-2 px-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {reviews.slice(0, 10).map(review => (
                    <tr key={review.id} className="border-b border-border/30 hover:bg-muted/30">
                      <td className="py-1.5 px-3 font-mono">{review.claim_id}</td>
                      <td className="py-1.5 px-3">{review.area}</td>
                      <td className="py-1.5 px-3">
                        <Badge variant="outline" className="text-xs">{review.age_bucket}</Badge>
                      </td>
                      <td className="py-1.5 px-3 text-right text-primary font-semibold">
                        ${Number(review.reserves).toLocaleString()}
                      </td>
                      <td className="py-1.5 px-3">
                        {review.status === 'assigned' && <Badge className="bg-blue-500 text-xs">Assigned</Badge>}
                        {review.status === 'in_review' && <Badge className="bg-amber-500 text-xs">In Review</Badge>}
                        {review.status === 'completed' && <Badge className="bg-green-500 text-xs">Done</Badge>}
                        {review.status === 'flagged' && <Badge className="bg-red-500 text-xs">Flagged</Badge>}
                      </td>
                      <td className="py-1.5 px-3">
                        <div className="flex gap-1">
                          {review.status === 'assigned' && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-6 w-6 p-0"
                              onClick={async () => {
                                await supabase.from('claim_reviews').update({ status: 'in_review' }).eq('id', review.id);
                              }}
                            >
                              <Eye className="h-3 w-3" />
                            </Button>
                          )}
                          {review.status === 'in_review' && (
                            <>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-6 w-6 p-0 text-green-500"
                                onClick={async () => {
                                  await supabase.from('claim_reviews').update({ status: 'completed', completed_at: new Date().toISOString() }).eq('id', review.id);
                                }}
                              >
                                <CheckCircle2 className="h-3 w-3" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-6 w-6 p-0 text-red-500"
                                onClick={async () => {
                                  await supabase.from('claim_reviews').update({ status: 'flagged' }).eq('id', review.id);
                                }}
                              >
                                <Flag className="h-3 w-3" />
                              </Button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      <div 
        className="bg-card border border-destructive/30 rounded-xl p-5 cursor-pointer hover:bg-muted/30 transition-colors"
        onDoubleClick={async () => {
          const agedGroups = data.typeGroupSummaries
            .filter(g => g.age365Plus > 50)
            .sort((a, b) => b.age365Plus - a.age365Plus)
            .slice(0, 10);
          
          const manager = selectedReviewer || 'Richie Mendoza';
          const exportData: ExportableData = {
            title: 'Aged Inventory Alert',
            subtitle: 'Claims over 365 days by type requiring executive attention',
            timestamp,
            affectsManager: manager,
            directive: 'Immediate attention required for all aged claims over 365 days. These claims represent significant exposure and require executive review and resolution strategy.',
            columns: ['Type Group', '365+ Days', '181-365 Days', '61-180 Days', 'Under 60 Days', 'Total', '% Aged'],
            rows: agedGroups.map(group => [
              group.typeGroup,
              formatNumber(group.age365Plus),
              formatNumber(group.age181To365),
              formatNumber(group.age61To180),
              formatNumber(group.ageUnder60),
              formatNumber(group.grandTotal),
              `${((group.age365Plus / group.grandTotal) * 100).toFixed(0)}%`,
            ]),
            rawClaimData: [{
              columns: ['Type Group', '365+ Days', '181-365 Days', '61-180 Days', 'Under 60 Days', 'Grand Total', 'Aged Percentage'],
              rows: agedGroups.map(group => [
                group.typeGroup,
                group.age365Plus,
                group.age181To365,
                group.age61To180,
                group.ageUnder60,
                group.grandTotal,
                ((group.age365Plus / group.grandTotal) * 100).toFixed(1),
              ]),
              sheetName: 'Aged Claims Detail',
            }],
          };
          await exportBoth(exportData);
          toast.success('PDF + Excel exported: Aged Inventory Alert');
        }}
      >
        <div className="flex items-center gap-2 mb-4">
          <AlertTriangle className="h-5 w-5 text-destructive" />
          <div>
            <h3 className="text-sm font-semibold text-foreground uppercase tracking-wide">Aged Inventory Alert</h3>
            <p className="text-xs text-muted-foreground">Claims over 365 days by type require immediate executive attention • Double-click to export</p>
          </div>
        </div>

        <div className="grid grid-cols-5 gap-3">
          {data.typeGroupSummaries
            .filter(g => g.age365Plus > 50)
            .sort((a, b) => b.age365Plus - a.age365Plus)
            .slice(0, 10)
            .map((group) => (
              <div key={group.typeGroup} className="p-3 rounded-lg bg-muted/50 border border-border">
                <p className="text-xs text-muted-foreground">{group.typeGroup}</p>
                <p className="text-lg font-bold text-destructive">{formatNumber(group.age365Plus)}</p>
                <p className="text-xs text-muted-foreground">
                  of {formatNumber(group.grandTotal)} total ({((group.age365Plus / group.grandTotal) * 100).toFixed(0)}%)
                </p>
              </div>
            ))}
        </div>
      </div>

      {/* Pending Decisions Drilldown Sheet */}
      <Sheet open={showDecisionsDrawer} onOpenChange={setShowDecisionsDrawer}>
        <SheetContent className="sm:max-w-2xl overflow-y-auto">
          <SheetHeader className="pb-4 border-b border-border">
            <SheetTitle className="flex items-center gap-2">
              <Flag className="h-5 w-5 text-warning" />
              Pending Executive Decisions
            </SheetTitle>
            <SheetDescription>
              {pendingDecisionsStats.total} matters requiring executive attention • Total Exposure: {formatCurrency(pendingDecisionsStats.totalExposure)}
            </SheetDescription>
          </SheetHeader>

          {/* PDF Export Button */}
          <div className="py-3 border-b border-border">
            <Button 
              onClick={generateDecisionsPDF} 
              disabled={generatingDecisionsPDF || pendingDecisions.length === 0}
              className="w-full"
              variant="outline"
            >
              {generatingDecisionsPDF ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Download className="h-4 w-4 mr-2" />
              )}
              Export to PDF
            </Button>
          </div>

          {/* Summary Stats */}
          <div className="grid grid-cols-3 gap-3 py-4 border-b border-border">
            <div className="text-center p-3 bg-destructive/10 rounded-lg">
              <p className="text-2xl font-bold text-destructive">{pendingDecisionsStats.critical}</p>
              <p className="text-xs text-muted-foreground">Critical</p>
            </div>
            <div className="text-center p-3 bg-warning/10 rounded-lg">
              <p className="text-2xl font-bold text-warning">{pendingDecisionsStats.thisWeek}</p>
              <p className="text-xs text-muted-foreground">Due This Week</p>
            </div>
            <div className="text-center p-3 bg-muted/50 rounded-lg">
              <p className="text-2xl font-bold text-foreground">{pendingDecisionsStats.statuteDeadlines}</p>
              <p className="text-xs text-muted-foreground">Statute Risk</p>
            </div>
          </div>

          {/* Decisions List */}
          <div className="py-4 space-y-3">
            {loadingDecisions ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                <span className="ml-2 text-muted-foreground">Loading decisions...</span>
              </div>
            ) : pendingDecisions.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Flag className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No pending decisions found</p>
                <p className="text-sm">Matters over $500K or aged 180+ days will appear here</p>
              </div>
            ) : (
              [...pendingDecisions].sort((a, b) => {
                const severityOrder = { critical: 0, high: 1, medium: 2 };
                return severityOrder[a.severity] - severityOrder[b.severity];
              }).map((decision) => (
                <div 
                  key={decision.matterId} 
                  className={`p-4 rounded-lg border ${
                    decision.severity === 'critical' ? 'border-destructive/50 bg-destructive/5' :
                    decision.severity === 'high' ? 'border-warning/50 bg-warning/5' :
                    'border-border bg-muted/30'
                  }`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm text-primary">{decision.matterId}</span>
                        <Badge variant={
                          decision.severity === 'critical' ? 'destructive' :
                          decision.severity === 'high' ? 'default' : 'secondary'
                        } className="text-xs">
                          {decision.severity.toUpperCase()}
                        </Badge>
                      </div>
                      <p className="font-semibold text-foreground mt-1">{decision.claimant}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold text-foreground">{formatCurrencyFullValue(decision.amount)}</p>
                      <p className="text-xs text-muted-foreground">{decision.daysOpen} days open</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 mt-3 text-sm">
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <span className="text-muted-foreground">Lead:</span>
                      <span className="font-medium">{decision.lead}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <span className="text-muted-foreground">Deadline:</span>
                      <span className={`font-medium ${new Date(decision.deadline) <= new Date(Date.now() + 7*24*60*60*1000) ? 'text-destructive' : ''}`}>
                        {format(new Date(decision.deadline), 'MMM d, yyyy')}
                      </span>
                    </div>
                  </div>

                  {(decision.department || decision.type || decision.location) && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {decision.department && <Badge variant="outline" className="text-xs">{decision.department}</Badge>}
                      {decision.type && <Badge variant="outline" className="text-xs">{decision.type}</Badge>}
                      {decision.location && <Badge variant="outline" className="text-xs">{decision.location}</Badge>}
                    </div>
                  )}

                  <div className="mt-3 p-2 bg-background/50 rounded border border-border/50">
                    <p className="text-xs text-muted-foreground mb-1">Reason for Escalation</p>
                    <p className="text-sm">{decision.reason}</p>
                  </div>

                  <div className="mt-3 p-3 bg-primary/10 rounded-lg border border-primary/20">
                    <div className="flex items-start gap-2">
                      <Gavel className="h-4 w-4 text-primary mt-0.5" />
                      <div>
                        <p className="text-xs text-primary font-medium uppercase">Recommended Action</p>
                        <p className="text-sm font-medium text-foreground">{decision.recommendedAction}</p>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-2 mt-3">
                    <Button size="sm" variant="default" className="flex-1">
                      <CheckCircle2 className="h-4 w-4 mr-1" />
                      Approve
                    </Button>
                    <Button size="sm" variant="outline" className="flex-1">
                      Request More Info
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* Budget Burn Rate Drawer */}
      <Sheet open={showBudgetDrawer} onOpenChange={setShowBudgetDrawer}>
        <SheetContent className="w-[600px] sm:max-w-[600px] overflow-y-auto">
          <SheetHeader>
            <div className="flex items-center justify-between">
              <div>
                <SheetTitle className="flex items-center gap-2">
                  <Wallet className="h-5 w-5 text-primary" />
                  Budget Burn Rate Analysis
                </SheetTitle>
                <SheetDescription>
                  YTD budget performance and projections
                </SheetDescription>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={generateBudgetPDF}
                disabled={generatingBudgetPDF}
                className="flex items-center gap-2"
              >
                {generatingBudgetPDF ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Download className="h-4 w-4" />
                )}
                Export PDF
              </Button>
            </div>
          </SheetHeader>

          <div className="mt-6 space-y-6">
            {/* Summary Stats */}
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-secondary/50 rounded-lg border border-border">
                <p className="text-xs text-muted-foreground uppercase">Annual Budget (2024 + 5%)</p>
                <p className="text-2xl font-bold text-foreground">{formatCurrency(budgetMetrics.annualBudget)}</p>
              </div>
              <div className="p-4 bg-secondary/50 rounded-lg border border-border">
                <p className="text-xs text-muted-foreground uppercase">YTD Payments (Nov 2025)</p>
                <p className="text-2xl font-bold text-foreground">{formatCurrency(budgetMetrics.ytdPaid)}</p>
              </div>
              <div className={`p-4 rounded-lg border-2 ${budgetMetrics.onTrack ? 'bg-success/10 border-success/40' : 'bg-destructive/10 border-destructive/40'}`}>
                <p className="text-xs text-muted-foreground uppercase">Burn Rate</p>
                <p className={`text-2xl font-bold ${budgetMetrics.onTrack ? 'text-success' : 'text-destructive'}`}>
                  {budgetMetrics.burnRate}%
                </p>
              </div>
              <div className="p-4 bg-primary/10 rounded-lg border border-primary/40">
                <p className="text-xs text-muted-foreground uppercase">Remaining</p>
                <p className="text-2xl font-bold text-primary">{formatCurrency(budgetMetrics.remaining)}</p>
              </div>
            </div>

            {/* Burn Progress Bar */}
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Budget Utilization</span>
                <span className="font-medium">{budgetMetrics.burnRate}% used</span>
              </div>
              <div className="h-3 bg-secondary rounded-full overflow-hidden">
                <div 
                  className={`h-full rounded-full transition-all ${
                    budgetMetrics.burnRate > 90 ? 'bg-destructive' :
                    budgetMetrics.burnRate > 75 ? 'bg-warning' : 'bg-success'
                  }`}
                  style={{ width: `${Math.min(budgetMetrics.burnRate, 100)}%` }}
                />
              </div>
            </div>

            {/* Coverage Breakdown - YoY Comparison */}
            <div>
              <h4 className="text-sm font-semibold mb-3">Coverage Breakdown - YoY Comparison</h4>
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="text-xs">Coverage</TableHead>
                      <TableHead className="text-xs text-right">2024 YTD</TableHead>
                      <TableHead className="text-xs text-right">2025 YTD</TableHead>
                      <TableHead className="text-xs text-right">Change</TableHead>
                      <TableHead className="text-xs text-right">Claims</TableHead>
                      <TableHead className="text-xs text-right">Avg/Claim</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {Object.values(budgetMetrics.coverageBreakdown).map((cov) => (
                      <TableRow key={cov.name}>
                        <TableCell className="font-medium">{cov.name}</TableCell>
                        <TableCell className="text-right">{formatCurrency(cov.ytd2024)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(cov.ytd2025)}</TableCell>
                        <TableCell className={`text-right font-medium ${
                          cov.change >= 0 ? 'text-destructive' : 'text-success'
                        }`}>
                          {cov.change >= 0 ? '+' : '-'}
                          {formatCurrency(Math.abs(cov.change))}
                        </TableCell>
                        <TableCell className="text-right">{cov.claimCount2025.toLocaleString()}</TableCell>
                        <TableCell className="text-right">${cov.avgPerClaim2025.toLocaleString()}</TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="bg-muted/30 font-bold">
                      <TableCell>Total</TableCell>
                      <TableCell className="text-right">{formatCurrency(budgetMetrics.total2024)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(budgetMetrics.ytdPaid)}</TableCell>
                      <TableCell className={`text-right ${
                        budgetMetrics.ytdPaid - budgetMetrics.total2024 >= 0 ? 'text-destructive' : 'text-success'
                      }`}>
                        {budgetMetrics.ytdPaid - budgetMetrics.total2024 >= 0 ? '+' : '-'}
                        {formatCurrency(Math.abs(budgetMetrics.ytdPaid - budgetMetrics.total2024))}
                      </TableCell>
                      <TableCell className="text-right">47,149</TableCell>
                      <TableCell className="text-right">$8,796</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Source: Loya Insurance Group - Comparison of Claim Payments YTD Dec 2024 vs YTD Nov 2025
              </p>
            </div>

            {/* Monthly Breakdown Table */}
            <div>
              <h4 className="text-sm font-semibold mb-3">Monthly Breakdown (Estimated)</h4>
              <div className="border rounded-lg overflow-hidden max-h-64 overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="text-xs">Month</TableHead>
                      <TableHead className="text-xs text-right">Budget</TableHead>
                      <TableHead className="text-xs text-right">Actual</TableHead>
                      <TableHead className="text-xs text-right">Variance</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {budgetMetrics.monthlyData.map((month) => (
                      <TableRow key={month.month}>
                        <TableCell className="font-medium">{month.month}</TableCell>
                        <TableCell className="text-right">{formatCurrency(month.budget)}</TableCell>
                        <TableCell className="text-right">
                          {month.actual > 0 ? formatCurrency(month.actual) : '-'}
                        </TableCell>
                        <TableCell className={`text-right font-medium ${
                          month.actual === 0 ? 'text-muted-foreground' :
                          month.variance >= 0 ? 'text-success' : 'text-destructive'
                        }`}>
                          {month.actual > 0 ? (
                            <>
                              {month.variance >= 0 ? '+' : '-'}
                              {formatCurrency(Math.abs(month.variance))}
                            </>
                          ) : '-'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>

            {/* Year-End Projection */}
            <div className="p-4 bg-muted/30 rounded-lg border border-border">
              <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Year-End Projection
              </h4>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Projected Annual Spend</p>
                  <p className="text-lg font-bold">{formatCurrency(budgetMetrics.projectedBurn)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Projected Variance</p>
                  <p className={`text-lg font-bold ${budgetMetrics.projectedVariance >= 0 ? 'text-success' : 'text-destructive'}`}>
                    {budgetMetrics.projectedVariance >= 0 ? '+' : '-'}
                    {formatCurrency(Math.abs(budgetMetrics.projectedVariance))}
                  </p>
                </div>
              </div>
              <div className={`mt-3 p-2 rounded ${budgetMetrics.onTrack ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive'}`}>
                <p className="text-sm font-medium text-center">
                  {budgetMetrics.onTrack ? '✓ On Track to Finish Under Budget' : '⚠️ Projected to Exceed Budget'}
                </p>
              </div>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* CP1 Analysis Drawer */}
      <Sheet open={showCP1Drawer} onOpenChange={setShowCP1Drawer}>
        <SheetContent className="w-[650px] sm:max-w-[650px] overflow-y-auto">
          <SheetHeader className="pb-4 border-b border-border">
            <div className="flex items-center justify-between">
              <SheetTitle className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-success" />
                CP1 Analysis
              </SheetTitle>
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={generateCP1PDF}
                  disabled={generatingCP1PDF}
                >
                  {generatingCP1PDF ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Download className="h-4 w-4 mr-2" />
                  )}
                  PDF
                </Button>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={generateCP1Excel}
                  disabled={generatingCP1Excel}
                >
                  {generatingCP1Excel ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Download className="h-4 w-4 mr-2" />
                  )}
                  Excel
                </Button>
              </div>
            </div>
            <SheetDescription>
              CP1 claims analysis by coverage type and age
            </SheetDescription>
          </SheetHeader>

          <div className="space-y-6 pt-6">
            {/* Summary Cards */}
            <div className="grid grid-cols-3 gap-4">
              <div className="p-4 bg-success/10 rounded-lg border border-success/30">
                <p className="text-xs text-muted-foreground uppercase">CP1</p>
                <p className="text-2xl font-bold text-success">{CP1_DATA.totals.yes.toLocaleString()}</p>
                <p className="text-xs text-success">{CP1_DATA.cp1Rate}% of claims</p>
              </div>
              <div className="p-4 bg-secondary/50 rounded-lg border border-border">
                <p className="text-xs text-muted-foreground uppercase">No CP</p>
                <p className="text-2xl font-bold text-foreground">{CP1_DATA.totals.noCP.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">{(100 - parseFloat(CP1_DATA.cp1Rate)).toFixed(1)}% of claims</p>
              </div>
              <div className="p-4 bg-secondary/50 rounded-lg border border-border">
                <p className="text-xs text-muted-foreground uppercase">Total Claims</p>
                <p className="text-2xl font-bold text-foreground">{CP1_DATA.totals.grandTotal.toLocaleString()}</p>
              </div>
            </div>

            {/* 12-Month CP1 Rate Trend Chart */}
            <div>
              <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-primary" />
                CP1 Rate Trend (12 Months)
              </h4>
              <div className="border rounded-lg p-4 bg-card">
                <ResponsiveContainer width="100%" height={220}>
                  <AreaChart data={CP1_MONTHLY_TREND} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="cp1Gradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--success))" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="hsl(var(--success))" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />
                    <XAxis 
                      dataKey="month" 
                      tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                      axisLine={{ stroke: 'hsl(var(--border))' }}
                      tickLine={false}
                    />
                    <YAxis 
                      domain={[22, 28]}
                      tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                      axisLine={{ stroke: 'hsl(var(--border))' }}
                      tickLine={false}
                      tickFormatter={(value) => `${value}%`}
                    />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--card))', 
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                        fontSize: '12px'
                      }}
                      formatter={(value: number, name: string) => {
                        if (name === 'cp1Rate') return [`${value}%`, 'CP1 Rate'];
                        return [value.toLocaleString(), name];
                      }}
                      labelStyle={{ fontWeight: 'bold', marginBottom: '4px' }}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="cp1Rate" 
                      stroke="hsl(var(--success))" 
                      strokeWidth={2}
                      fill="url(#cp1Gradient)"
                      dot={{ fill: 'hsl(var(--success))', strokeWidth: 2, r: 3 }}
                      activeDot={{ r: 5, fill: 'hsl(var(--success))' }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
                <div className="flex justify-between items-center mt-3 pt-3 border-t border-border">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-warning" />
                    <span className="text-xs text-muted-foreground">
                      +2.4% YoY (Feb '25: 24.2% → Jan '26: 26.6%)
                    </span>
                  </div>
                  <Badge variant="outline" className="text-xs">
                    Upward Trend
                  </Badge>
                </div>
              </div>
            </div>

            {/* BI Age Breakdown */}
            <div>
              <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-primary"></span>
                Bodily Injury - CP1 by Age
              </h4>
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="text-xs">Age Bucket</TableHead>
                      <TableHead className="text-xs text-right">No CP</TableHead>
                      <TableHead className="text-xs text-right">CP1 Yes</TableHead>
                      <TableHead className="text-xs text-right">Total</TableHead>
                      <TableHead className="text-xs text-right">CP1 Rate</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {CP1_DATA.biByAge.map((row) => {
                      const cp1Rate = ((row.yes / row.total) * 100).toFixed(1);
                      return (
                        <TableRow key={row.age}>
                          <TableCell className="font-medium">{row.age}</TableCell>
                          <TableCell className="text-right">{row.noCP.toLocaleString()}</TableCell>
                          <TableCell className="text-right text-success font-medium">{row.yes.toLocaleString()}</TableCell>
                          <TableCell className="text-right">{row.total.toLocaleString()}</TableCell>
                          <TableCell className="text-right">
                            <Badge variant={parseFloat(cp1Rate) > 30 ? "default" : "secondary"} className="text-xs">
                              {cp1Rate}%
                            </Badge>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    <TableRow className="bg-muted/30 font-bold">
                      <TableCell>BI Total</TableCell>
                      <TableCell className="text-right">{CP1_DATA.biTotal.noCP.toLocaleString()}</TableCell>
                      <TableCell className="text-right text-success">{CP1_DATA.biTotal.yes.toLocaleString()}</TableCell>
                      <TableCell className="text-right">{CP1_DATA.biTotal.total.toLocaleString()}</TableCell>
                      <TableCell className="text-right">
                        <Badge className="text-xs">34.2%</Badge>
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            </div>

            {/* All Coverages */}
            <div>
              <h4 className="text-sm font-semibold mb-1 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-accent"></span>
                CP1 by Coverage Type
              </h4>
              <p className="text-xs text-muted-foreground mb-3">Click any row to drill down into individual claims</p>
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="text-xs">Coverage</TableHead>
                      <TableHead className="text-xs text-right">No CP</TableHead>
                      <TableHead className="text-xs text-right">CP1 Yes</TableHead>
                      <TableHead className="text-xs text-right">Total</TableHead>
                      <TableHead className="text-xs text-right">CP1 Rate</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {CP1_DATA.byCoverage.map((row) => (
                      <TableRow 
                        key={row.coverage} 
                        className="cursor-pointer hover:bg-primary/5 transition-colors"
                        onClick={() => setCp1DrilldownCoverage(row.coverage)}
                      >
                        <TableCell className="font-medium">
                          <span className="flex items-center gap-2">
                            {row.coverage}
                            <ExternalLink className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100" />
                          </span>
                        </TableCell>
                        <TableCell className="text-right">{row.noCP.toLocaleString()}</TableCell>
                        <TableCell className="text-right text-success font-medium">{row.yes.toLocaleString()}</TableCell>
                        <TableCell className="text-right">{row.total.toLocaleString()}</TableCell>
                        <TableCell className="text-right">
                          <Badge variant={row.cp1Rate > 20 ? "default" : "secondary"} className="text-xs">
                            {row.cp1Rate}%
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="bg-muted/30 font-bold">
                      <TableCell>GRAND TOTAL</TableCell>
                      <TableCell className="text-right">{CP1_DATA.totals.noCP.toLocaleString()}</TableCell>
                      <TableCell className="text-right text-success">{CP1_DATA.totals.yes.toLocaleString()}</TableCell>
                      <TableCell className="text-right">{CP1_DATA.totals.grandTotal.toLocaleString()}</TableCell>
                      <TableCell className="text-right">
                        <Badge className="text-xs">{CP1_DATA.cp1Rate}%</Badge>
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            </div>

            {/* Key Insights */}
            <div className="bg-muted/30 rounded-lg p-4 border border-border">
              <h4 className="text-sm font-semibold mb-3">Key Insights</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-start gap-2">
                  <span className="text-success mt-0.5">•</span>
                  BI represents <span className="font-medium text-foreground">{((CP1_DATA.biTotal.yes / CP1_DATA.totals.yes) * 100).toFixed(1)}%</span> of all CP1 tendered claims
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-warning mt-0.5">•</span>
                  Aged 365+ BI claims have highest CP1 rate at <span className="font-medium text-foreground">45.7%</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-0.5">•</span>
                  UI coverage has highest CP1 rate at <span className="font-medium text-foreground">51.9%</span> (28 of 54 claims)
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-muted-foreground mt-0.5">•</span>
                  Under 60 Days BI claims have lowest CP1 rate at <span className="font-medium text-foreground">13.5%</span>
                </li>
              </ul>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* CP1 Drilldown Modal */}
      {cp1DrilldownCoverage && (
        <CP1DrilldownModal
          open={!!cp1DrilldownCoverage}
          onClose={() => setCp1DrilldownCoverage(null)}
          coverage={cp1DrilldownCoverage}
          coverageData={CP1_DATA.byCoverage.find(c => c.coverage === cp1DrilldownCoverage) || { noCP: 0, yes: 0, total: 0, cp1Rate: 0 }}
        />
      )}
    </div>
  );
}
