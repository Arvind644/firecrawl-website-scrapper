'use client';

import { useState, useRef, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Loader2, Send } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

type Message = {
  role: 'user' | 'assistant';
  content: string;
};

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [scrapedContent, setScrapedContent] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userMessage = { role: 'user' as const, content: input };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [...messages, userMessage],
          scrapedContent
        }),
      });

      if (!response.ok) throw new Error('Failed to get response');

      const data = await response.json();
      
      if (data.scrapedContent) {
        setScrapedContent(data.scrapedContent);
        if (userMessage.content.includes('scrape')) {
          setMessages(prev => [...prev, {
            role: 'assistant',
            content: 'I have successfully scraped the content. What would you like to know about it?'
          }]);
        }
      }

      if (data.message && data.message.content.trim()) {
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: data.message.content
        }]);
      }

    } catch (error) {
      console.error('Chat error:', error);
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Sorry, I encountered an error. Please try again.'
      }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="min-h-screen bg-[#FFF3E4]">
        <main className="container mx-auto p-4 max-w-4xl h-screen flex flex-col">
          <h1 className="text-3xl font-bold mb-8 text-center text-[#1A1A1A]">Web Scraper Chat</h1>
          
          <Card className="flex-1 p-4 mb-4 overflow-auto bg-[#FFF3E4] border-[#E8D5C4] shadow-lg">
            <div className="space-y-4">
              {messages.map((message, index) => (
                <div
                  key={index}
                  className={`flex ${
                    message.role === 'user' ? 'justify-end' : 'justify-start'
                  }`}
                >
                  <div
                    className={`max-w-[80%] rounded-lg p-4 ${
                      message.role === 'user'
                        ? 'bg-[#FF4B1F] text-[#FFF8EE]'
                        : 'bg-[#FFE0CC] text-[#1A1A1A]'
                    }`}
                  >
                    <ReactMarkdown className="prose prose-stone dark:prose-invert break-words">
                      {message.content}
                    </ReactMarkdown>
                  </div>
                </div>
              ))}
              {loading && (
                <div className="flex justify-start">
                  <div className="bg-[#FFE0CC] rounded-lg p-4">
                    <Loader2 className="h-6 w-6 animate-spin text-[#FF4B1F]" />
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          </Card>

          <form onSubmit={handleSubmit} className="flex gap-4">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask me to scrape a website..."
              className="flex-1 bg-[#FFF8EE] border-[#E8D5C4] text-[#1A1A1A] placeholder:text-[#6B7280] focus:ring-[#FF4B1F] focus:border-[#FF4B1F]"
              disabled={loading}
            />
            <Button 
              type="submit" 
              disabled={loading}
              className="bg-[#FF4B1F] hover:bg-[#E63E1C] text-[#FFF8EE]"
            >
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </main>
      </div>
    </>
  );
}
