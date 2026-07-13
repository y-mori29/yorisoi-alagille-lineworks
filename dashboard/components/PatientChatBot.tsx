import React, { useState, useRef, useEffect } from 'react';
import { MessageSquare, X, Send, Sparkles, Loader2 } from 'lucide-react';
import { api } from '../services/api';

interface ChatMessage {
    role: 'user' | 'model';
    text: string;
}

interface Props {
    patientId: string;
    patientName: string;
}

export const PatientChatBot: React.FC<Props> = ({ patientId, patientName }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);

    const SUGGESTIONS = [
        "前回との変更点は？",
        "最新の処方内容を教えて",
        "バイタルで気をつけることは？",
        "直近の会話での患者の様子は？"
    ];

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages, isOpen]);

    const handleSend = async (text: string) => {
        if (!text.trim() || loading) return;

        const userMsg: ChatMessage = { role: 'user', text };
        setMessages(prev => [...prev, userMsg]);
        setInput('');
        setLoading(true);

        try {
            // Include history context (converting UI model to API model if needed)
            const historyForApi = messages.map(m => ({ role: m.role, text: m.text }));
            const res = await api.chatWithAI(patientId, text, historyForApi);

            const aiMsg: ChatMessage = { role: 'model', text: res.reply };
            setMessages(prev => [...prev, aiMsg]);
        } catch (e: any) {
            console.error(e);
            setMessages(prev => [...prev, { role: 'model', text: `エラーが発生しました: ${e.message}` }]);
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) {
        return (
            <button
                onClick={() => setIsOpen(true)}
                className="fixed bottom-6 right-6 p-4 bg-emerald-600 text-white rounded-full shadow-lg hover:bg-emerald-700 transition-all z-50 flex items-center gap-2"
            >
                <Sparkles size={24} />
                <span className="font-bold">AIアシスタント</span>
            </button>
        );
    }

    return (
        <div className="fixed bottom-6 right-6 w-96 h-[600px] bg-white rounded-lg shadow-2xl border border-gray-200 z-50 flex flex-col font-sans animate-in slide-in-from-bottom-4 duration-300">
            {/* Header */}
            <div className="p-4 bg-emerald-600 text-white rounded-t-lg flex justify-between items-center shadow-sm">
                <div className="flex items-center gap-2">
                    <Sparkles size={20} />
                    <div>
                        <h3 className="font-bold text-sm">AIメディカルアシスタント</h3>
                        <p className="text-xs text-emerald-100">{patientName} 様について質問</p>
                    </div>
                </div>
                <button onClick={() => setIsOpen(false)} className="hover:bg-emerald-700 p-1 rounded">
                    <X size={20} />
                </button>
            </div>

            {/* Messages */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 bg-gray-50 space-y-4">
                {messages.length === 0 && (
                    <div className="text-center mt-10 space-y-4">
                        <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto text-emerald-600">
                            <Sparkles size={32} />
                        </div>
                        <p className="text-gray-500 text-sm px-4">
                            過去の記録や学習資料に基づき、<br />この患者様のご質問にお答えします。
                        </p>
                        <div className="grid grid-cols-1 gap-2 px-4">
                            {SUGGESTIONS.map(s => (
                                <button
                                    key={s}
                                    onClick={() => handleSend(s)}
                                    className="text-xs bg-white border border-gray-200 p-2 rounded hover:bg-emerald-50 text-left text-gray-700 transition-colors"
                                >
                                    ✨ {s}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {messages.map((msg, i) => (
                    <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div
                            className={`max-w-[85%] p-3 rounded-lg text-sm whitespace-pre-wrap ${msg.role === 'user'
                                    ? 'bg-emerald-600 text-white rounded-br-none'
                                    : 'bg-white border border-gray-200 text-gray-800 rounded-bl-none shadow-sm'
                                }`}
                        >
                            {msg.text}
                        </div>
                    </div>
                ))}

                {loading && (
                    <div className="flex justify-start">
                        <div className="bg-white border border-gray-200 p-3 rounded-lg rounded-bl-none shadow-sm flex items-center gap-2">
                            <Loader2 size={16} className="animate-spin text-emerald-600" />
                            <span className="text-xs text-gray-500">解析中...</span>
                        </div>
                    </div>
                )}
            </div>

            {/* Input */}
            <div className="p-3 bg-white border-t border-gray-100">
                <form
                    onSubmit={(e) => { e.preventDefault(); handleSend(input); }}
                    className="flex gap-2"
                >
                    <input
                        className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        placeholder="質問を入力..."
                        value={input}
                        onChange={e => setInput(e.target.value)}
                        disabled={loading}
                    />
                    <button
                        type="submit"
                        disabled={!input.trim() || loading}
                        className="bg-emerald-600 text-white p-2 rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition-colors"
                    >
                        <Send size={18} />
                    </button>
                </form>
            </div>
        </div>
    );
};
