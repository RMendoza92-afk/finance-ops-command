import { useState, useRef, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MessageCircle, Send, FileText, X, Loader2, Minimize2, Maximize2, Sparkles, TrendingUp, AlertTriangle, Users, FileSpreadsheet } from "lucide-react";
import { toast } from "sonner";
import jsPDF from "jspdf";
import { useLitigationData } from "@/hooks/useLitigationData";
import { useOpenExposureData } from "@/hooks/useOpenExposureData";
import loyaLogo from "@/assets/fli_logo.jpg";

interface Message {
  role: "user" | "assistant";
  content: string;
}

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/litigation-chat`;

// Quick action categories
const QUICK_ACTIONS = [
  { 
    label: "MTD Closures", 
    query: "What was closed month to date, total paid, and list the top 10 recent closures with amounts?",
    icon: TrendingUp,
    color: "text-emerald-500"
  },
  { 
    label: "Aged 365+", 
    query: "Show me the aged inventory breakdown. How many claims are over 365 days by type group? List the worst offenders.",
    icon: AlertTriangle,
    color: "text-destructive"
  },
  { 
    label: "CP1 Analysis", 
    query: "Give me the full CP1 exposure analysis - totals by coverage, by age bucket, and the overall CP1 rate.",
    icon: FileSpreadsheet,
    color: "text-warning"
  },
  { 
    label: "No Eval Claims", 
    query: "How many claims have no evaluation set? What's the total reserve exposure? List a sample of these claims.",
    icon: Sparkles,
    color: "text-blue-500"
  },
  { 
    label: "Team Stats", 
    query: "Break down performance by team - show closures, total paid, and open matters for each team.",
    icon: Users,
    color: "text-purple-500"
  },
];

export function LitigationChat() {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  
  const { data: litigationData } = useLitigationData();
  const { data: openExposureData } = useOpenExposureData();

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
      financials: openExposureData.financials,
      knownTotals: openExposureData.knownTotals,
      rawClaims: openExposureData.rawClaims?.slice(0, 100) || [], // Send sample of raw claims
    };
  }, [openExposureData]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const generateResponsePDF = (question: string, responseContent: string) => {
    const doc = new jsPDF();
    const pw = doc.internal.pageSize.getWidth();
    const ph = doc.internal.pageSize.getHeight();
    const m = { l: 10, r: 10, t: 10 };
    const cw = pw - m.l - m.r;

    const C = {
      bg: [12, 12, 12] as [number, number, number],
      headerBg: [22, 22, 22] as [number, number, number],
      rowDark: [18, 18, 18] as [number, number, number],
      rowLight: [24, 24, 24] as [number, number, number],
      border: [45, 45, 45] as [number, number, number],
      white: [255, 255, 255] as [number, number, number],
      offWhite: [240, 240, 240] as [number, number, number],
      muted: [140, 140, 140] as [number, number, number],
      gold: [212, 175, 55] as [number, number, number],
      green: [16, 185, 129] as [number, number, number],
    };

    const formatCurrency = (val: number): string => {
      if (val >= 1000000) return '$' + (val / 1000000).toFixed(1) + 'M';
      if (val >= 1000) return '$' + (val / 1000).toFixed(0) + 'K';
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

    doc.setFillColor(...C.bg);
    doc.rect(0, 0, pw, ph, 'F');

    doc.setFillColor(...C.headerBg);
    doc.rect(0, 0, pw, 24, 'F');
    doc.setFillColor(...C.gold);
    doc.rect(0, 24, pw, 0.5, 'F');

    try {
      doc.addImage(loyaLogo, 'JPEG', m.l + 2, 4, 14, 14);
    } catch (e) {}

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(...C.white);
    doc.text('LITIGATION INTELLIGENCE REPORT', m.l + 20, 13);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(...C.muted);
    doc.text(new Date().toLocaleDateString(), pw - m.r, 13, { align: 'right' });

    let y = 28;

    const kpiBoxH = 22;
    doc.setFillColor(...C.rowDark);
    doc.roundedRect(m.l, y, cw, kpiBoxH, 1, 1, 'F');
    doc.setFillColor(...C.gold);
    doc.rect(m.l, y, cw, 0.5, 'F');

    const kpiColW = cw / 4;
    const kpis = [
      { label: 'TOTAL MATTERS', value: dataContext?.totalMatters?.toLocaleString() || '0' },
      { label: 'MTD CLOSURES', value: dataContext?.monthToDate?.closures?.toString() || '0' },
      { label: 'RESERVES', value: formatCurrency(dataContext?.totalReserves || 0) },
      { label: 'INDEMNITY PAID', value: formatCurrency(dataContext?.totalIndemnityPaid || 0) },
    ];

    kpis.forEach((kpi, i) => {
      const xPos = m.l + (i * kpiColW) + (kpiColW / 2);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(5);
      doc.setTextColor(...C.muted);
      doc.text(kpi.label, xPos, y + 8, { align: 'center' });
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(...C.gold);
      doc.text(kpi.value, xPos, y + 16, { align: 'center' });
    });

    y += kpiBoxH + 4;

    doc.setFillColor(...C.rowDark);
    doc.roundedRect(m.l, y, cw, 18, 1, 1, 'F');
    doc.setFillColor(...C.gold);
    doc.rect(m.l, y, 1.5, 18, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(...C.gold);
    doc.text('EXECUTIVE QUERY', m.l + 5, y + 5);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...C.offWhite);
    const questionLines = doc.splitTextToSize(sanitize(question), cw - 12);
    doc.text(questionLines.slice(0, 2), m.l + 5, y + 11);

    y += 22;

    doc.setFillColor(...C.headerBg);
    doc.rect(m.l, y, cw, 8, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6);
    doc.setTextColor(...C.muted);
    doc.text('INTELLIGENCE RESPONSE', m.l + 3, y + 5);
    y += 10;

    const sanitizedResponse = sanitize(responseContent);
    const lines = sanitizedResponse.split('\n');
    const lineH = 5;

    doc.setFontSize(8);

    lines.forEach((line, idx) => {
      if (y > ph - 20) {
        doc.addPage();
        doc.setFillColor(...C.bg);
        doc.rect(0, 0, pw, ph, 'F');
        y = m.t;
      }

      const trimmedLine = line.trim();
      const isEven = idx % 2 === 0;

      doc.setFillColor(...(isEven ? C.rowDark : C.rowLight));
      doc.rect(m.l, y - 3, cw, lineH + 2, 'F');

      if (trimmedLine.startsWith('- ') || trimmedLine.startsWith('* ')) {
        const bulletText = trimmedLine.slice(2);
        const bulletLines = doc.splitTextToSize(bulletText, cw - 15);
        doc.setTextColor(...C.gold);
        doc.text('\u2022', m.l + 3, y);
        doc.setTextColor(...C.offWhite);
        doc.setFont('helvetica', 'normal');
        doc.text(bulletLines[0] || '', m.l + 8, y);
        y += lineH;
        bulletLines.slice(1).forEach((bl: string) => {
          if (y > ph - 20) {
            doc.addPage();
            doc.setFillColor(...C.bg);
            doc.rect(0, 0, pw, ph, 'F');
            y = m.t;
          }
          doc.setFillColor(...C.rowLight);
          doc.rect(m.l, y - 3, cw, lineH + 2, 'F');
          doc.setTextColor(...C.offWhite);
          doc.text(bl, m.l + 8, y);
          y += lineH;
        });
      } else if (/^\d+\./.test(trimmedLine)) {
        doc.setTextColor(...C.gold);
        doc.setFont('helvetica', 'bold');
        const num = trimmedLine.match(/^\d+\./)?.[0] || '';
        doc.text(num, m.l + 3, y);
        doc.setTextColor(...C.offWhite);
        doc.setFont('helvetica', 'normal');
        const restText = trimmedLine.slice(num.length).trim();
        const textLines = doc.splitTextToSize(restText, cw - 15);
        doc.text(textLines[0] || '', m.l + 12, y);
        y += lineH;
        textLines.slice(1).forEach((tl: string) => {
          if (y > ph - 20) {
            doc.addPage();
            doc.setFillColor(...C.bg);
            doc.rect(0, 0, pw, ph, 'F');
            y = m.t;
          }
          doc.setFillColor(...C.rowLight);
          doc.rect(m.l, y - 3, cw, lineH + 2, 'F');
          doc.setTextColor(...C.offWhite);
          doc.text(tl, m.l + 12, y);
          y += lineH;
        });
      } else if (trimmedLine.endsWith(':') && trimmedLine.length < 60) {
        y += 2;
        doc.setFillColor(...C.headerBg);
        doc.rect(m.l, y - 3, cw, lineH + 3, 'F');
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...C.gold);
        doc.text(trimmedLine, m.l + 3, y);
        doc.setFont('helvetica', 'normal');
        y += lineH + 2;
      } else if (trimmedLine) {
        const textLines = doc.splitTextToSize(trimmedLine, cw - 6);
        doc.setTextColor(...C.offWhite);
        doc.text(textLines[0] || '', m.l + 3, y);
        y += lineH;
        textLines.slice(1).forEach((tl: string) => {
          if (y > ph - 20) {
            doc.addPage();
            doc.setFillColor(...C.bg);
            doc.rect(0, 0, pw, ph, 'F');
            y = m.t;
          }
          doc.setFillColor(...C.rowLight);
          doc.rect(m.l, y - 3, cw, lineH + 2, 'F');
          doc.setTextColor(...C.offWhite);
          doc.text(tl, m.l + 3, y);
          y += lineH;
        });
      } else {
        y += 3;
      }
    });

    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFillColor(...C.headerBg);
      doc.rect(0, ph - 10, pw, 10, 'F');
      doc.setFillColor(...C.gold);
      doc.rect(0, ph - 10, pw, 0.3, 'F');
      doc.setFontSize(6);
      doc.setTextColor(...C.muted);
      doc.text('CONFIDENTIAL', m.l, ph - 3);
      doc.text('Fred Loya Insurance', pw / 2, ph - 3, { align: 'center' });
      doc.text('Page ' + i + ' of ' + pageCount, pw - m.r, ph - 3, { align: 'right' });
    }

    const timestamp = new Date().toISOString().slice(0, 10);
    const filename = 'FLI_Intelligence_Report_' + timestamp + '.pdf';
    doc.save(filename);
    toast.success('Executive report downloaded: ' + filename);
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
      
      if (!resp.ok || !resp.body) {
        const errorData = await resp.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to get response");
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
              <div className="space-y-4">
                <div className="text-center text-muted-foreground text-sm py-4">
                  <Sparkles className="h-10 w-10 mx-auto mb-3 text-primary opacity-70" />
                  <p className="font-semibold text-foreground mb-1">I am the Litigation Oracle</p>
                  <p className="text-xs mb-4">Ask anything. I furnish data, lists, analysis—with exact numbers.</p>
                </div>
                
                {/* Quick Actions */}
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide px-1">Quick Analysis</p>
                  <div className="grid grid-cols-2 gap-2">
                    {QUICK_ACTIONS.map((action) => (
                      <Button
                        key={action.label}
                        variant="outline"
                        size="sm"
                        className="h-auto py-2 px-3 justify-start text-left hover:bg-muted/50 transition-colors"
                        onClick={() => handleQuickAction(action.query)}
                        disabled={isLoading || !dataReady}
                      >
                        <action.icon className={`h-4 w-4 mr-2 ${action.color}`} />
                        <span className="text-xs">{action.label}</span>
                      </Button>
                    ))}
                  </div>
                </div>

                <div className="border-t pt-4 mt-4">
                  <p className="text-xs text-muted-foreground px-1 mb-2">Or ask anything:</p>
                  <ul className="text-xs text-muted-foreground space-y-1 px-1">
                    <li className="flex items-center gap-2">
                      <span className="text-primary">•</span>
                      "List all claims over $100K in reserves"
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="text-primary">•</span>
                      "What's the CP1 rate for BI coverage?"
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="text-primary">•</span>
                      "Compare team A vs team B closures"
                    </li>
                  </ul>
                </div>
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
                        {line.startsWith('- ') || line.startsWith('* ') ? (
                          <span className="flex gap-2">
                            <span className="text-primary">•</span>
                            <span>{line.slice(2)}</span>
                          </span>
                        ) : line.startsWith('**') && line.endsWith('**') ? (
                          <strong className="text-primary">{line.slice(2, -2)}</strong>
                        ) : line.startsWith('###') ? (
                          <strong className="text-primary text-base">{line.replace(/^#+\s*/, '')}</strong>
                        ) : line.startsWith('##') ? (
                          <strong className="text-primary text-lg">{line.replace(/^#+\s*/, '')}</strong>
                        ) : line.startsWith('#') ? (
                          <strong className="text-primary text-xl">{line.replace(/^#+\s*/, '')}</strong>
                        ) : line.startsWith('|') ? (
                          <code className="text-xs bg-background px-1 rounded">{line}</code>
                        ) : (
                          line
                        )}
                      </p>
                    ))}
                  </div>
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
    </Card>
  );
}
