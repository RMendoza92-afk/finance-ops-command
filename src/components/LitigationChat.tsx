import { useState, useRef, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MessageCircle, Send, FileText, X, Loader2, Minimize2, Maximize2 } from "lucide-react";
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

export function LitigationChat() {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  
  const { data: litigationData } = useLitigationData();
  const { data: openExposureData } = useOpenExposureData();

  // Build data context from the loaded litigation data
  const dataContext = useMemo(() => {
    if (!litigationData || litigationData.length === 0) return null;

    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    // MTD Closures (CWP with payment in current month)
    const mtdClosures = litigationData.filter(m => {
      if (m.cwpCwn !== 'CWP' || !m.paymentDate) return false;
      const payDate = new Date(m.paymentDate);
      return payDate.getMonth() === currentMonth && payDate.getFullYear() === currentYear;
    });

    const mtdPaid = mtdClosures.reduce((sum, m) => sum + m.indemnitiesAmount, 0);

    // By expense category
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

    // By coverage
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

    // By team
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

    // Matters without evaluation
    const withoutEvaluation = litigationData.filter(m => m.indemnitiesAmount === 0);

    // Fixed reserves value
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

    // Executive dark color palette
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

    // Sanitize text for PDF
    const sanitize = (text: string): string => {
      return text
        .replace(/[–—]/g, '-')
        .replace(/['']/g, "'")
        .replace(/[""]/g, '"')
        .replace(/…/g, '...')
        .replace(/\*\*/g, '')
        .replace(/[^\x20-\x7E\n]/g, '');
    };

    // Background
    doc.setFillColor(...C.bg);
    doc.rect(0, 0, pw, ph, 'F');

    // Header
    doc.setFillColor(...C.headerBg);
    doc.rect(0, 0, pw, 24, 'F');
    doc.setFillColor(...C.gold);
    doc.rect(0, 24, pw, 0.5, 'F');

    // Logo
    try {
      doc.addImage(loyaLogo, 'JPEG', m.l + 2, 4, 14, 14);
    } catch (e) {
      // Logo failed silently
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(...C.white);
    doc.text('LITIGATION INTELLIGENCE REPORT', m.l + 20, 13);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(...C.muted);
    doc.text(new Date().toLocaleDateString(), pw - m.r, 13, { align: 'right' });

    let y = 28;

    // KPI Summary Box
    const kpiBoxH = 22;
    doc.setFillColor(...C.rowDark);
    doc.roundedRect(m.l, y, cw, kpiBoxH, 1, 1, 'F');
    doc.setFillColor(...C.gold);
    doc.rect(m.l, y, cw, 0.5, 'F');

    // KPI metrics - 4 columns
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

    // Query Section
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

    // Response Section Header
    doc.setFillColor(...C.headerBg);
    doc.rect(m.l, y, cw, 8, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6);
    doc.setTextColor(...C.muted);
    doc.text('INTELLIGENCE RESPONSE', m.l + 3, y + 5);
    y += 10;

    // Response content
    const sanitizedResponse = sanitize(responseContent);
    const lines = sanitizedResponse.split('\n');
    const lineH = 5;

    doc.setFontSize(8);

    lines.forEach((line, idx) => {
      if (y > ph - 20) {
        // New page
        doc.addPage();
        doc.setFillColor(...C.bg);
        doc.rect(0, 0, pw, ph, 'F');
        y = m.t;
      }

      const trimmedLine = line.trim();
      const isEven = idx % 2 === 0;

      // Row background
      doc.setFillColor(...(isEven ? C.rowDark : C.rowLight));
      doc.rect(m.l, y - 3, cw, lineH + 2, 'F');

      // Handle bullet points
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
      }
      // Handle numbered lists
      else if (/^\d+\./.test(trimmedLine)) {
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
      }
      // Handle headers (lines ending with :)
      else if (trimmedLine.endsWith(':') && trimmedLine.length < 60) {
        y += 2;
        doc.setFillColor(...C.headerBg);
        doc.rect(m.l, y - 3, cw, lineH + 3, 'F');
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...C.gold);
        doc.text(trimmedLine, m.l + 3, y);
        doc.setFont('helvetica', 'normal');
        y += lineH + 2;
      }
      // Regular text
      else if (trimmedLine) {
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
        y += 3; // Empty line spacing
      }
    });

    // Footer on all pages
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

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;
    
    if (!dataContext) {
      toast.error("Data is still loading, please wait...");
      return;
    }
    
    const userMessage: Message = { role: "user", content: input };
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
          dataContext 
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
      
      // Auto-generate PDF with the response
      if (assistantContent.trim()) {
        generateResponsePDF(userMessage.content, assistantContent);
        // Update the message to show it was exported
        setMessages(prev => 
          prev.map((m, i) => i === prev.length - 1 && m.role === 'assistant' 
            ? { ...m, content: 'PDF report generated and downloaded.' } 
            : m)
        );
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

  if (!isOpen) {
    return (
      <Button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 h-12 w-12 sm:h-14 sm:w-14 rounded-full shadow-lg z-50"
        size="icon"
      >
        <MessageCircle className="h-5 w-5 sm:h-6 sm:w-6" />
      </Button>
    );
  }

  return (
    <Card className={`fixed z-50 shadow-2xl transition-all duration-300 ${
      isMinimized 
        ? "bottom-4 right-4 sm:bottom-6 sm:right-6 w-64 sm:w-72 h-12 sm:h-14" 
        : "inset-4 sm:inset-auto sm:bottom-6 sm:right-6 sm:w-[420px] sm:h-[600px] sm:max-h-[80vh]"
    }`}>
      <CardHeader className="py-3 px-4 border-b flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <MessageCircle className="h-4 w-4" />
          Litigation Assistant
          {dataContext && (
            <span className="text-xs text-muted-foreground">
              ({dataContext.totalMatters.toLocaleString()} matters)
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
              <div className="text-center text-muted-foreground text-sm py-8">
                <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="font-medium mb-2">Ask me about your litigation data</p>
                <p className="text-xs">Examples:</p>
                <ul className="text-xs mt-2 space-y-1">
                  <li>"What was closed month to date and what was paid?"</li>
                  <li>"How many matters without evaluations?"</li>
                  <li>"Show me team performance breakdown"</li>
                  <li>"Generate a PDF report of LIT category cases"</li>
                </ul>
              </div>
            )}
            
            {messages.map((msg, i) => (
              <div
                key={i}
                className={`mb-4 ${msg.role === "user" ? "text-right" : "text-left"}`}
              >
                <div
                  className={`inline-block max-w-[85%] px-4 py-3 rounded-lg text-sm ${
                    msg.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-foreground"
                  }`}
                >
                  <div className="whitespace-pre-wrap leading-relaxed">
                    {msg.content.split('\n').map((line, lineIdx) => (
                      <p key={lineIdx} className={line.trim() === '' ? 'h-2' : 'mb-1'}>
                        {line.startsWith('- ') ? (
                          <span className="flex gap-2">
                            <span className="text-muted-foreground">•</span>
                            <span>{line.slice(2)}</span>
                          </span>
                        ) : line.startsWith('**') && line.endsWith('**') ? (
                          <strong>{line.slice(2, -2)}</strong>
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
              <div className="flex items-center gap-2 text-muted-foreground text-sm">
                <Loader2 className="h-4 w-4 animate-spin" />
                Analyzing {dataContext?.totalMatters.toLocaleString()} matters...
              </div>
            )}
            
          </ScrollArea>
          
          <div className="p-4 border-t">
            <div className="flex gap-2">
              <Input
                placeholder="Ask about your litigation data..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={isLoading}
                className="flex-1"
              />
              <Button
                size="icon"
                onClick={sendMessage}
                disabled={isLoading || !input.trim()}
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      )}
    </Card>
  );
}
