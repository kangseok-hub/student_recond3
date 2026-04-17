/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Send, 
  ChevronRight, 
  ChevronLeft, 
  FileText, 
  UserCheck, 
  MessageSquare, 
  Sparkles, 
  CheckCircle2,
  AlertCircle,
  Loader2,
  RefreshCw,
  Upload,
  X,
  ClipboardCheck,
  ArrowRight,
  Edit3,
  PlusCircle
} from 'lucide-react';
import Markdown from 'react-markdown';
import * as pdfjsLib from 'pdfjs-dist';
import { Phase, AppState } from './types.ts';
import { generateContent, SYSTEM_PROMPT_BASE } from './services/gemini.ts';
import { cn } from './lib/utils.ts';

// PDF.js worker setup
const PDF_JS_VERSION = '5.6.205';
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${PDF_JS_VERSION}/build/pdf.worker.min.mjs`;

const stripLineBreaks = (text: string) => text.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();

export default function App() {
  const [state, setState] = useState<AppState>({
    currentPhase: Phase.INPUT,
    subject: '',
    targetLength: '500',
    materials: '',
    observation: '',
    followUp: '',
    draft: '',
    finalRecord: '',
  });

  const [files, setFiles] = useState<{ name: string; content: string }[]>([]);
  const [feedbackInput, setFeedbackInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = 0;
    }
  }, [state.currentPhase]);

  const resetApp = () => {
    setState({
      currentPhase: Phase.INPUT,
      subject: '',
      targetLength: '500',
      materials: '',
      observation: '',
      followUp: '',
      draft: '',
      finalRecord: '',
    });
    setFiles([]);
    setFeedbackInput('');
    setError(null);
    setIsCopied(false);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFiles = e.target.files;
    if (!uploadedFiles || uploadedFiles.length === 0) return;

    setIsUploading(true);
    setError(null);

    try {
      for (const file of Array.from(uploadedFiles)) {
        const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
        
        if (isPdf) {
          try {
            const arrayBuffer = await file.arrayBuffer();
            const loadingTask = pdfjsLib.getDocument({ 
              data: arrayBuffer,
              useWorkerFetch: true,
              isEvalSupported: false
            });
            const pdf = await loadingTask.promise;
            let fullText = '';
            
            for (let i = 1; i <= pdf.numPages; i++) {
              const page = await pdf.getPage(i);
              const textContent = await page.getTextContent();
              const pageText = textContent.items
                .map((item: any) => item.str)
                .join(' ');
              fullText += pageText + '\n';
            }
            
            if (!fullText.trim()) {
              throw new Error('PDF에서 텍스트를 추출할 수 없습니다. 이미지로 된 PDF일 수 있습니다.');
            }

            setFiles(prev => [...prev, { name: file.name, content: fullText }]);
            setState(prev => ({ 
              ...prev, 
              materials: prev.materials + (prev.materials ? '\n\n' : '') + `[파일: ${file.name}]\n${fullText}` 
            }));
          } catch (err: any) {
            console.error('PDF Error:', err);
            setError(`PDF 파일을 읽는 중 오류가 발생했습니다 (${file.name}): ${err.message || '알 수 없는 오류'}`);
          }
        } else {
          await new Promise<void>((resolve) => {
            const reader = new FileReader();
            reader.onload = (event) => {
              const content = event.target?.result as string;
              if (content) {
                setFiles(prev => [...prev, { name: file.name, content }]);
                setState(prev => ({ 
                  ...prev, 
                  materials: prev.materials + (prev.materials ? '\n\n' : '') + `[파일: ${file.name}]\n${content}` 
                }));
              }
              resolve();
            };
            reader.onerror = () => {
              setError(`파일을 읽는 중 오류가 발생했습니다: ${file.name}`);
              resolve();
            };
            reader.readAsText(file);
          });
        }
      }
    } catch (err: any) {
      console.error('Upload Error:', err);
      setError(`파일 업로드 중 오류가 발생했습니다: ${err.message || '알 수 없는 오류'}`);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const removeFile = (index: number) => {
    const fileToRemove = files[index];
    setFiles(prev => prev.filter((_, i) => i !== index));
    setState(prev => ({
      ...prev,
      materials: prev.materials.replace(`[파일: ${fileToRemove.name}]\n${fileToRemove.content}`, '').trim()
    }));
  };

  const handleGenerateDraft = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!state.subject || !state.materials || !state.observation) {
      setError('과목명, 학생 자료, 학생 관찰 내용은 필수 입력 사항입니다.');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const prompt = `
        다음 정보를 바탕으로 입학사정관의 관점에서 고품질 세특 초안을 작성해주세요.
        
        [과목]: ${state.subject}
        [목표 분량]: ${state.targetLength} 바이트 (UTF-8 기준)
        [학생 활동 자료]: ${state.materials}
        [교사 관찰 내용]: ${state.observation}
        [후속 활동 내용]: ${state.followUp}
        
        [작성 지침]:
        1. '지식탐구, 진로준비, 공동체의식, 문제극복' 역량이 잘 드러나도록 작성하십시오.
        2. 제공된 학습 자료의 전문 어휘를 활용하여 유기적인 문장으로 구성하십시오.
        3. 분량 엄수: 공백을 포함한 전체 텍스트의 크기가 반드시 ${state.targetLength} 바이트에 최대한 가깝게(±10자 내외) 작성되어야 합니다. 분량이 부족하면 내용을 구체화하고, 넘치면 핵심 위주로 압축하십시오.
        4. 중요: 줄 바꿈(엔터)이 전혀 없는 하나의 연속된 문단으로 작성하십시오.
      `;

      const result = await generateContent(prompt, SYSTEM_PROMPT_BASE);
      setState(prev => ({ ...prev, draft: stripLineBreaks(result), currentPhase: Phase.DRAFT_FEEDBACK }));
    } catch (err) {
      setError('초안 생성 중 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleApplyFeedback = async () => {
    if (!feedbackInput.trim()) return;
    setIsLoading(true);
    setError(null);

    try {
      const prompt = `
        사용자의 수정 요청을 반영하여 세특을 다시 작성해주세요.
        
        [현재 초안]:
        ${state.draft}
        
        [수정 요청]:
        ${feedbackInput}
        
        [목표 분량]: ${state.targetLength} 바이트 (Strict)
        
        [작성 지침]:
        1. 입학사정관이 선호하는 전문적인 톤을 유지하면서 요청사항을 완벽히 반영하십시오.
        2. 분량 엄수: 최종 결과물은 반드시 ${state.targetLength} 바이트에 최대한 가깝게 작성되어야 합니다.
        3. 중요: 줄 바꿈(엔터)이 전혀 없는 하나의 연속된 문단으로 작성하십시오.
      `;

      const result = await generateContent(prompt, SYSTEM_PROMPT_BASE);
      setState(prev => ({ ...prev, draft: stripLineBreaks(result) }));
      setFeedbackInput('');
    } catch (err) {
      setError('수정 중 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleFinalize = () => {
    setState(prev => ({ ...prev, finalRecord: prev.draft, currentPhase: Phase.FINAL }));
  };

  const renderInputForm = () => (
    <form onSubmit={handleGenerateDraft} className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="space-y-3">
          <label className="text-sm font-extrabold text-gray-800 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-blue-600" />
            과목명
          </label>
          <input 
            type="text"
            value={state.subject}
            onChange={e => setState(prev => ({ ...prev, subject: e.target.value }))}
            placeholder="예: 국어, 화학, 진로 탐구 등"
            className="w-full bg-white border-2 border-gray-100 rounded-2xl px-6 py-4 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all outline-none text-lg"
          />
        </div>
        <div className="space-y-3">
          <label className="text-sm font-extrabold text-gray-800 flex items-center gap-2">
            <ArrowRight className="w-4 h-4 text-green-600" />
            목표 분량 (바이트)
          </label>
          <input 
            type="text"
            value={state.targetLength}
            onChange={e => setState(prev => ({ ...prev, targetLength: e.target.value }))}
            placeholder="예: 500, 1500"
            className="w-full bg-white border-2 border-gray-100 rounded-2xl px-6 py-4 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all outline-none text-lg"
          />
        </div>
      </div>

      <div className="space-y-4">
        <label className="text-sm font-extrabold text-gray-800 flex items-center gap-2">
          <FileText className="w-4 h-4 text-purple-600" />
          학생 활동 자료 (발표자료, 보고서, 소감문 등)
        </label>
        <div 
          onClick={() => !isUploading && fileInputRef.current?.click()}
          className={cn(
            "border-2 border-dashed rounded-3xl p-8 flex flex-col items-center justify-center gap-3 transition-all cursor-pointer group",
            isUploading ? "border-blue-300 bg-blue-50 cursor-wait" : "border-gray-200 hover:border-blue-500 hover:bg-blue-50/30"
          )}
        >
          <div className={cn(
            "w-12 h-12 rounded-2xl flex items-center justify-center transition-colors",
            isUploading ? "bg-blue-200" : "bg-gray-50 group-hover:bg-blue-100"
          )}>
            {isUploading ? (
              <Loader2 className="w-6 h-6 text-blue-600 animate-spin" />
            ) : (
              <Upload className="w-6 h-6 text-gray-400 group-hover:text-blue-600 transition-colors" />
            )}
          </div>
          <p className={cn(
            "text-sm font-bold transition-colors",
            isUploading ? "text-blue-700" : "text-gray-600 group-hover:text-blue-700"
          )}>
            {isUploading ? "파일 분석 중..." : "파일 업로드 또는 클릭 (PDF, TXT, MD)"}
          </p>
          <input type="file" ref={fileInputRef} onChange={handleFileUpload} multiple className="hidden" accept=".txt,.md,.pdf" />
        </div>
        {files.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {files.map((file, i) => (
              <div key={i} className="flex items-center gap-2 bg-blue-50 text-blue-700 px-4 py-2 rounded-xl text-xs font-bold border border-blue-100">
                <span className="max-w-[150px] truncate">{file.name}</span>
                <button type="button" onClick={() => removeFile(i)} className="text-blue-400 hover:text-red-500 transition-colors"><X className="w-3.5 h-3.5" /></button>
              </div>
            ))}
          </div>
        )}
        <textarea 
          value={state.materials}
          onChange={e => setState(prev => ({ ...prev, materials: e.target.value }))}
          placeholder="자료 내용을 직접 입력하거나 붙여넣어 주세요..."
          className="w-full bg-white border-2 border-gray-100 rounded-3xl px-6 py-5 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all outline-none min-h-[200px] resize-none text-lg leading-relaxed font-medium text-gray-700"
        />
      </div>

      <div className="space-y-3">
        <label className="text-sm font-extrabold text-gray-800 flex items-center gap-2">
          <UserCheck className="w-4 h-4 text-orange-600" />
          학생 관찰 내용 (교사 피드백) <span className="text-red-500 font-bold">*필수</span>
        </label>
        <textarea 
          value={state.observation}
          onChange={e => setState(prev => ({ ...prev, observation: e.target.value }))}
          placeholder="수업 중 관찰한 학생의 태도, 역량 등을 입력해주세요."
          className="w-full bg-white border-2 border-gray-100 rounded-3xl px-6 py-5 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all outline-none min-h-[120px] resize-none text-lg leading-relaxed font-medium text-gray-700"
        />
      </div>

      <div className="space-y-3">
        <label className="text-sm font-extrabold text-gray-800 flex items-center gap-2">
          <RefreshCw className="w-4 h-4 text-teal-600" />
          학생의 후속활동 내용
        </label>
        <textarea 
          value={state.followUp}
          onChange={e => setState(prev => ({ ...prev, followUp: e.target.value }))}
          placeholder="활동 이후의 심화 탐구나 실생활 적용 사례가 있다면 입력해주세요."
          className="w-full bg-white border-2 border-gray-100 rounded-3xl px-6 py-5 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all outline-none min-h-[120px] resize-none text-lg leading-relaxed font-medium text-gray-700"
        />
      </div>

      <button 
        type="submit"
        disabled={isLoading}
        className="w-full py-5 bg-blue-600 text-white rounded-3xl font-black text-lg hover:bg-blue-700 transition-all flex items-center justify-center gap-3 shadow-2xl shadow-blue-200 disabled:opacity-50 active:scale-[0.98]"
      >
        {isLoading ? <Loader2 className="w-7 h-7 animate-spin" /> : <><Sparkles className="w-6 h-6" /> 세특 초안 생성하기</>}
      </button>
    </form>
  );

  const renderDraftFeedback = () => (
    <div className="space-y-8 animate-in fade-in zoom-in-95 duration-500">
      <div className="bg-white rounded-3xl border border-gray-100 shadow-2xl shadow-gray-200/50 overflow-hidden">
        <div className="bg-gray-900 px-8 py-6 flex items-center justify-between">
          <h3 className="text-white font-bold flex items-center gap-2">
            <UserCheck className="w-5 h-5 text-blue-400" />
            입학사정관 관점의 세특 초안
          </h3>
          <div className="flex flex-col items-end">
            <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">목표: {state.targetLength}b</span>
            <span className={cn(
              "text-sm font-mono font-bold",
              Math.abs(new Blob([state.draft]).size - parseInt(state.targetLength)) < 50 ? "text-green-400" : "text-yellow-400"
            )}>
              현재: {new Blob([state.draft]).size}b
            </span>
          </div>
        </div>
        <div className="p-8 prose prose-slate max-w-none font-serif text-lg leading-relaxed">
          <Markdown>{state.draft}</Markdown>
        </div>
      </div>

      <div className="bg-blue-50 rounded-3xl p-8 border border-blue-100 space-y-4">
        <div className="flex items-center gap-2 text-blue-900 font-bold">
          <Edit3 className="w-5 h-5" />
          수정 요청 사항이 있으신가요?
        </div>
        <div className="flex gap-3">
          <textarea 
            value={feedbackInput}
            onChange={e => setFeedbackInput(e.target.value)}
            placeholder="예: '지식탐구 역량을 좀 더 강조해줘', '글자수를 조금 더 줄여줘' 등"
            className="flex-1 bg-white border border-blue-200 rounded-2xl px-5 py-3 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all outline-none resize-none"
            rows={2}
          />
          <button 
            onClick={handleApplyFeedback}
            disabled={isLoading || !feedbackInput.trim()}
            className="px-6 bg-blue-600 text-white rounded-2xl font-bold hover:bg-blue-700 transition-all disabled:opacity-50 flex items-center justify-center"
          >
            {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
          </button>
        </div>
      </div>

      <div className="flex gap-4">
        <button 
          onClick={() => setState(prev => ({ ...prev, currentPhase: Phase.INPUT }))}
          className="flex-1 py-4 border border-gray-200 rounded-2xl font-bold text-gray-600 hover:bg-gray-50 transition-all"
        >
          처음으로 돌아가기
        </button>
        <button 
          onClick={handleFinalize}
          className="flex-[2] py-4 bg-gray-900 text-white rounded-2xl font-bold hover:bg-gray-800 transition-all shadow-lg shadow-gray-200 flex items-center justify-center gap-2"
        >
          최종 확정하기 <CheckCircle2 className="w-5 h-5" />
        </button>
      </div>
    </div>
  );

  const renderFinal = () => (
    <div className="space-y-8 animate-in fade-in zoom-in-95 duration-700">
      <div className="text-center space-y-2 py-8">
        <div className="inline-flex items-center justify-center w-20 h-20 bg-green-100 rounded-full mb-4">
          <CheckCircle2 className="w-10 h-10 text-green-600" />
        </div>
        <h2 className="text-3xl font-black text-gray-900 tracking-tight">최종 세특이 완성되었습니다!</h2>
        <p className="text-gray-500">선생님의 정성이 담긴 기록이 학생의 미래를 응원합니다.</p>
      </div>

      <div className="bg-white p-10 rounded-[40px] border-4 border-gray-50 shadow-2xl font-serif text-xl leading-[2] relative">
        <div className="absolute -top-4 -left-4 w-12 h-12 bg-gray-900 rounded-2xl flex items-center justify-center text-white">
          <Sparkles className="w-6 h-6" />
        </div>
        <div className="absolute top-4 right-8 flex flex-col items-end opacity-40">
           <span className="text-[10px] font-bold uppercase tracking-widest">분량</span>
           <span className="text-xs font-mono font-bold">{new Blob([state.finalRecord]).size} / {state.targetLength} Bytes</span>
        </div>
        <Markdown>{state.finalRecord}</Markdown>
      </div>

      <div className="flex gap-4">
        <button 
          onClick={() => {
            navigator.clipboard.writeText(state.finalRecord);
            setIsCopied(true);
            setTimeout(() => setIsCopied(false), 2000);
          }}
          className="flex-1 py-5 bg-gray-900 text-white rounded-3xl font-bold hover:bg-gray-800 transition-all flex items-center justify-center gap-3 shadow-xl shadow-gray-200"
        >
          {isCopied ? (
            <><CheckCircle2 className="w-6 h-6 text-green-400" /> 복사 완료!</>
          ) : (
            <>
              <ClipboardCheck className="w-6 h-6" />
              클립보드 복사
            </>
          )}
        </button>
        <button 
          onClick={resetApp}
          className="px-10 py-5 border-2 border-gray-100 rounded-3xl font-bold text-gray-500 hover:bg-gray-50 transition-all flex items-center gap-2"
        >
          <PlusCircle className="w-5 h-5" />
          새로 시작하기
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#fcfdfe] text-gray-900 font-sans selection:bg-blue-100">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/70 backdrop-blur-2xl border-b border-gray-100 px-8 py-5">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-blue-600 rounded-[18px] flex items-center justify-center shadow-lg shadow-blue-200">
              <Sparkles className="text-white w-7 h-7" />
            </div>
            <div>
              <h1 className="font-black text-xl tracking-tight leading-tight mb-0.5 text-gray-900">숭신고 세특 전문가</h1>
              <p className="text-[11px] text-blue-600 font-bold uppercase tracking-wider">입학사정관의 관점에서 작성하는 AI 기록기</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <button 
              onClick={resetApp}
              className="p-2 hover:bg-gray-100 rounded-xl transition-colors text-gray-400 hover:text-gray-900 flex items-center gap-2"
              title="새로 시작하기"
            >
              <PlusCircle className="w-5 h-5" />
              <span className="text-xs font-bold hidden sm:inline">새로 시작</span>
            </button>
            <div className="w-px h-4 bg-gray-200 mx-1" />
            {Object.values(Phase).map((p) => (
              <div 
                key={p}
                className={cn(
                  "h-1.5 rounded-full transition-all duration-500",
                  state.currentPhase === p ? "w-8 bg-gray-900" : "w-1.5 bg-gray-200"
                )}
              />
            ))}
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-8 py-12 pb-32">
        {error && (
          <div className="mb-8 p-4 bg-red-50 border border-red-100 rounded-2xl text-red-800 text-sm flex items-center gap-3 animate-in fade-in zoom-in-95">
            <AlertCircle className="w-5 h-5 shrink-0" />
            {error}
          </div>
        )}

        {state.currentPhase === Phase.INPUT && renderInputForm()}
        {state.currentPhase === Phase.DRAFT_FEEDBACK && renderDraftFeedback()}
        {state.currentPhase === Phase.FINAL && renderFinal()}
      </main>

      {/* Footer Info */}
      <footer className="fixed bottom-6 left-1/2 -translate-x-1/2 pointer-events-none z-50">
        <div className="bg-white/80 backdrop-blur-md px-8 py-3 rounded-full border border-gray-200 shadow-xl">
          <p className="text-xs text-gray-600 font-bold tracking-tight">
            제작 : 숭신고 진로진학상담부 김강석
          </p>
        </div>
      </footer>
    </div>
  );
}
