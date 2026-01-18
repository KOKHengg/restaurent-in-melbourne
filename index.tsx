import React, { useState, useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
import { 
  MessageSquare, 
  Image as ImageIcon, 
  Video, 
  Send, 
  Loader2, 
  Sparkles, 
  History,
  Info,
  ExternalLink,
  ChevronRight,
  User,
  Bot
} from 'lucide-react';

// --- Types ---
type AppMode = 'chat' | 'image' | 'video';

interface Message {
  id: string;
  role: 'user' | 'model';
  content: string;
  type: 'text' | 'image' | 'video';
  mediaUrl?: string;
  groundingLinks?: { title: string; uri: string }[];
}

// --- Components ---

const SidebarItem = ({ active, icon: Icon, label, onClick }: { active: boolean, icon: any, label: string, onClick: () => void }) => (
  <button
    onClick={onClick}
    className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl transition-all duration-200 group ${
      active 
        ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' 
        : 'hover:bg-slate-800 text-slate-400 hover:text-slate-100'
    }`}
  >
    <Icon size={20} className={active ? 'text-white' : 'group-hover:scale-110 transition-transform'} />
    <span className="font-medium">{label}</span>
  </button>
);

const App = () => {
  const [mode, setMode] = useState<AppMode>('chat');
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isGenerating]);

  const addMessage = (msg: Message) => {
    setMessages(prev => [...prev, msg]);
  };

  const handleTextAction = async (prompt: string) => {
    setIsGenerating(true);
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    // Add user message immediately
    const userMsgId = Date.now().toString();
    addMessage({ id: userMsgId, role: 'user', content: prompt, type: 'text' });
    setInput('');

    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
        config: {
          tools: [{ googleSearch: {} }]
        }
      });

      const text = response.text || "No response generated.";
      const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
      const links = groundingChunks?.map((chunk: any) => ({
        title: chunk.web?.title || 'Source',
        uri: chunk.web?.uri || '#'
      })).filter((l: any) => l.uri !== '#');

      addMessage({
        id: (Date.now() + 1).toString(),
        role: 'model',
        content: text,
        type: 'text',
        groundingLinks: links
      });
    } catch (error) {
      console.error(error);
      addMessage({
        id: Date.now().toString(),
        role: 'model',
        content: "I encountered an error processing your request. Please try again.",
        type: 'text'
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleImageAction = async (prompt: string) => {
    setIsGenerating(true);
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    addMessage({ id: Date.now().toString(), role: 'user', content: `Generating image: ${prompt}`, type: 'text' });
    setInput('');

    try {
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: { parts: [{ text: prompt }] },
        config: { imageConfig: { aspectRatio: "1:1" } }
      });

      let imageUrl = '';
      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData) {
          imageUrl = `data:image/png;base64,${part.inlineData.data}`;
          break;
        }
      }

      if (imageUrl) {
        addMessage({
          id: Date.now().toString(),
          role: 'model',
          content: prompt,
          type: 'image',
          mediaUrl: imageUrl
        });
      } else {
        throw new Error("No image data returned");
      }
    } catch (error) {
      console.error(error);
      addMessage({ id: Date.now().toString(), role: 'model', content: "Failed to generate image.", type: 'text' });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleVideoAction = async (prompt: string) => {
    setIsGenerating(true);
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    addMessage({ id: Date.now().toString(), role: 'user', content: `Generating video: ${prompt}`, type: 'text' });
    setInput('');

    try {
      let operation = await ai.models.generateVideos({
        model: 'veo-3.1-fast-generate-preview',
        prompt,
        config: { numberOfVideos: 1, resolution: '720p', aspectRatio: '16:9' }
      });

      while (!operation.done) {
        await new Promise(resolve => setTimeout(resolve, 5000));
        operation = await ai.operations.getVideosOperation({ operation });
      }

      const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
      const response = await fetch(`${downloadLink}&key=${process.env.API_KEY}`);
      const blob = await response.blob();
      const videoUrl = URL.createObjectURL(blob);

      addMessage({
        id: Date.now().toString(),
        role: 'model',
        content: prompt,
        type: 'video',
        mediaUrl: videoUrl
      });
    } catch (error) {
      console.error(error);
      addMessage({ id: Date.now().toString(), role: 'model', content: "Video generation failed.", type: 'text' });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isGenerating) return;

    if (mode === 'chat') handleTextAction(input);
    else if (mode === 'image') handleImageAction(input);
    else if (mode === 'video') handleVideoAction(input);
  };

  return (
    <div className="flex h-screen bg-slate-950 text-slate-200">
      {/* Sidebar */}
      <aside className="w-64 border-r border-slate-800 bg-slate-900/50 p-6 flex flex-col">
        <div className="flex items-center space-x-2 mb-10">
          <div className="bg-indigo-600 p-2 rounded-lg">
            <Sparkles className="text-white" size={24} />
          </div>
          <h1 className="text-xl font-bold tracking-tight text-white">Gemini Hub</h1>
        </div>

        <nav className="flex-1 space-y-2">
          <SidebarItem 
            active={mode === 'chat'} 
            icon={MessageSquare} 
            label="Chat" 
            onClick={() => setMode('chat')} 
          />
          <SidebarItem 
            active={mode === 'image'} 
            icon={ImageIcon} 
            label="Image Gen" 
            onClick={() => setMode('image')} 
          />
          <SidebarItem 
            active={mode === 'video'} 
            icon={Video} 
            label="Video Gen" 
            onClick={() => setMode('video')} 
          />
        </nav>

        <div className="mt-auto p-4 rounded-xl bg-slate-800/50 border border-slate-700">
          <div className="flex items-center space-x-2 mb-2 text-slate-300">
            <Info size={16} />
            <span className="text-xs font-semibold uppercase tracking-wider">Status</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className={`w-2 h-2 rounded-full ${isGenerating ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500'}`}></div>
            <span className="text-sm text-slate-400">{isGenerating ? 'Processing...' : 'Ready'}</span>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col relative">
        {/* Header */}
        <header className="h-16 border-b border-slate-800 flex items-center justify-between px-8 bg-slate-950/50 backdrop-blur-md sticky top-0 z-10">
          <div className="flex items-center space-x-2">
            <span className="text-slate-500 font-medium capitalize">{mode}</span>
            <ChevronRight size={16} className="text-slate-600" />
            <span className="text-slate-100 font-semibold">New Session</span>
          </div>
          <button className="text-slate-400 hover:text-white p-2">
            <History size={20} />
          </button>
        </header>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-8 space-y-8">
          {messages.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center text-center max-w-md mx-auto">
              <div className="w-20 h-20 bg-slate-900 rounded-3xl flex items-center justify-center mb-6 border border-slate-800">
                <Sparkles size={40} className="text-indigo-500" />
              </div>
              <h2 className="text-2xl font-bold text-white mb-2">How can I help you today?</h2>
              <p className="text-slate-400">
                Switch between text, image, and video generation modes using the sidebar.
              </p>
            </div>
          )}

          {messages.map((msg) => (
            <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`flex max-w-[80%] space-x-4 ${msg.role === 'user' ? 'flex-row-reverse space-x-reverse' : 'flex-row'}`}>
                <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center border shadow-sm ${
                  msg.role === 'user' ? 'bg-slate-800 border-slate-700' : 'bg-indigo-900/30 border-indigo-500/30'
                }`}>
                  {msg.role === 'user' ? <User size={20} className="text-slate-400" /> : <Bot size={20} className="text-indigo-400" />}
                </div>

                <div className={`space-y-3 ${msg.role === 'user' ? 'text-right' : 'text-left'}`}>
                  <div className={`inline-block px-5 py-3 rounded-2xl shadow-sm ${
                    msg.role === 'user' 
                      ? 'bg-indigo-600 text-white rounded-tr-none' 
                      : 'bg-slate-900 border border-slate-800 rounded-tl-none'
                  }`}>
                    {msg.type === 'text' && <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>}
                    
                    {msg.type === 'image' && (
                      <div className="space-y-2">
                        <img src={msg.mediaUrl} alt={msg.content} className="rounded-lg max-w-full border border-slate-800" />
                        <p className="text-xs text-slate-400 italic">Prompt: {msg.content}</p>
                      </div>
                    )}

                    {msg.type === 'video' && (
                      <div className="space-y-2">
                        <video src={msg.mediaUrl} controls className="rounded-lg w-full border border-slate-800" />
                        <p className="text-xs text-slate-400 italic">Prompt: {msg.content}</p>
                      </div>
                    )}
                  </div>

                  {msg.groundingLinks && msg.groundingLinks.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {msg.groundingLinks.map((link, idx) => (
                        <a 
                          key={idx} 
                          href={link.uri} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="flex items-center space-x-1 px-2 py-1 rounded bg-slate-800 text-[10px] text-indigo-400 border border-slate-700 hover:bg-slate-700 transition-colors"
                        >
                          <ExternalLink size={10} />
                          <span>{link.title}</span>
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}

          {isGenerating && mode === 'chat' && (
            <div className="flex justify-start">
              <div className="flex space-x-4">
                <div className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center bg-indigo-900/30 border border-indigo-500/30">
                  <Bot size={20} className="text-indigo-400" />
                </div>
                <div className="bg-slate-900 border border-slate-800 px-5 py-3 rounded-2xl rounded-tl-none">
                  <div className="flex space-x-1">
                    <div className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                    <div className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                    <div className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce"></div>
                  </div>
                </div>
              </div>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>

        {/* Input Area */}
        <div className="p-8 pt-0">
          <div className="max-w-4xl mx-auto relative group">
            <div className="absolute -inset-1 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-2xl blur opacity-20 group-focus-within:opacity-40 transition duration-500"></div>
            <form 
              onSubmit={handleSubmit}
              className="relative flex items-center glass rounded-2xl border border-slate-700 p-2 pl-6 focus-within:border-indigo-500/50 transition-all shadow-xl"
            >
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={`Ask ${mode === 'chat' ? 'anything' : 'to generate ' + mode}...`}
                className="flex-1 bg-transparent border-none outline-none text-white py-3 pr-4 placeholder-slate-500"
                disabled={isGenerating}
              />
              <button
                type="submit"
                disabled={!input.trim() || isGenerating}
                className="bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 disabled:text-slate-600 p-3 rounded-xl text-white transition-all shadow-lg active:scale-95 flex items-center justify-center"
              >
                {isGenerating ? <Loader2 size={20} className="animate-spin" /> : <Send size={20} />}
              </button>
            </form>
            <p className="text-center mt-3 text-xs text-slate-500 font-medium">
              Powered by Google Gemini &middot; AI can make mistakes. Check important info.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
};

const rootElement = document.getElementById('root');
if (rootElement) {
  createRoot(rootElement).render(<App />);
}