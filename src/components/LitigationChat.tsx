import { useState, useRef, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MessageCircle, Send, FileText, X, Loader2, Minimize2, Maximize2 } from "lucide-react";
import { toast } from "sonner";
import jsPDF from "jspdf";
import { useLitigationData } from "@/hooks/useLitigationData";

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

    return {
      totalMatters: litigationData.length,
      totalCWP: litigationData.filter(m => m.cwpCwn === 'CWP').length,
      totalCWN: litigationData.filter(m => m.cwpCwn === 'CWN').length,
      totalReserves: litigationData.reduce((sum, m) => sum + m.netAmount, 0),
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
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 20;
    const contentWidth = pageWidth - margin * 2;

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

    // Header
    doc.setFillColor(30, 41, 59);
    doc.rect(0, 0, pageWidth, 35, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text("Fred Loya Insurance", margin, 15);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text("Litigation Command Center - Query Report", margin, 25);
    doc.text(new Date().toLocaleDateString(), pageWidth - margin, 15, { align: 'right' });

    let yPos = 50;

    // Question section
    doc.setTextColor(100, 100, 100);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text("QUERY:", margin, yPos);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(0, 0, 0);
    const questionLines = doc.splitTextToSize(sanitize(question), contentWidth);
    doc.text(questionLines, margin, yPos + 6);
    yPos += 6 + questionLines.length * 5 + 10;

    // Divider
    doc.setDrawColor(200, 200, 200);
    doc.line(margin, yPos, pageWidth - margin, yPos);
    yPos += 10;

    // Response section
    doc.setTextColor(100, 100, 100);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text("RESPONSE:", margin, yPos);
    yPos += 8;

    doc.setTextColor(0, 0, 0);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');

    const sanitizedResponse = sanitize(responseContent);
    const lines = sanitizedResponse.split('\n');

    lines.forEach(line => {
      if (yPos > pageHeight - 30) {
        doc.addPage();
        yPos = 20;
      }

      const trimmedLine = line.trim();
      
      // Handle bullet points
      if (trimmedLine.startsWith('- ') || trimmedLine.startsWith('* ')) {
        const bulletText = trimmedLine.slice(2);
        const bulletLines = doc.splitTextToSize(bulletText, contentWidth - 10);
        doc.text('•', margin, yPos);
        doc.text(bulletLines, margin + 8, yPos);
        yPos += bulletLines.length * 5 + 2;
      } 
      // Handle numbered lists
      else if (/^\d+\./.test(trimmedLine)) {
        const textLines = doc.splitTextToSize(trimmedLine, contentWidth - 5);
        doc.text(textLines, margin + 5, yPos);
        yPos += textLines.length * 5 + 2;
      }
      // Handle headers (lines ending with :)
      else if (trimmedLine.endsWith(':') && trimmedLine.length < 60) {
        doc.setFont('helvetica', 'bold');
        doc.text(trimmedLine, margin, yPos);
        doc.setFont('helvetica', 'normal');
        yPos += 7;
      }
      // Regular text
      else if (trimmedLine) {
        const textLines = doc.splitTextToSize(trimmedLine, contentWidth);
        doc.text(textLines, margin, yPos);
        yPos += textLines.length * 5 + 2;
      } else {
        yPos += 4; // Empty line
      }
    });

    // Footer on all pages
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFillColor(245, 245, 245);
      doc.rect(0, pageHeight - 15, pageWidth, 15, 'F');
      doc.setFontSize(8);
      doc.setTextColor(128, 128, 128);
      doc.text('CONFIDENTIAL - Fred Loya Insurance', margin, pageHeight - 5);
      doc.text('Page ' + i + ' of ' + pageCount, pageWidth - margin, pageHeight - 5, { align: 'right' });
    }

    const timestamp = new Date().toISOString().slice(0, 10);
    const filename = 'FLI_Query_Report_' + timestamp + '.pdf';
    doc.save(filename);
    toast.success("PDF report downloaded: " + filename);
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
        className="fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-lg z-50"
        size="icon"
      >
        <MessageCircle className="h-6 w-6" />
      </Button>
    );
  }

  return (
    <Card className={`fixed z-50 shadow-2xl transition-all duration-300 ${
      isMinimized 
        ? "bottom-6 right-6 w-72 h-14" 
        : "bottom-6 right-6 w-[420px] h-[600px] max-h-[80vh]"
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
