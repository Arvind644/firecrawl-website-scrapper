'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

export default function Home() {
  const [url, setUrl] = useState('');
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleScrape = async () => {
    if (!url) {
      setError('Please enter a URL');
      return;
    }

    setLoading(true);
    setError('');
    setContent('');

    try {
      const response = await fetch('/api/scrape', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url }),
      });

      if (!response.ok) {
        throw new Error('Failed to scrape content');
      }

      const data = await response.json();
      setContent(data.data?.markdown || data.data?.content || JSON.stringify(data));
    } catch (err) {
      setError('Failed to scrape content. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const formatContent = (content: string) => {
    try {
      // Try to parse as JSON if content is a stringified JSON
      const parsed = JSON.parse(content);
      return parsed.markdown || parsed.content || content;
    } catch {
      // If not JSON, return as is
      return content;
    }
  };

  return (
    <main className="container mx-auto p-4 max-w-4xl">
      <h1 className="text-3xl font-bold mb-8 text-center">Web Content Scraper</h1>
      
      <div className="flex gap-4 mb-8">
        <Input
          type="url"
          placeholder="Enter URL to scrape..."
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          className="flex-1"
        />
        <Button 
          onClick={handleScrape}
          disabled={loading}
        >
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Scraping...
            </>
          ) : (
            'Scrape'
          )}
        </Button>
      </div>

      {error && (
        <div className="text-red-500 mb-4">
          {error}
        </div>
      )}

      {content && (
        <Card className="p-6">
          <div className="prose prose-sm md:prose-base lg:prose-lg max-w-none dark:prose-invert">
            <ReactMarkdown>{formatContent(content)}</ReactMarkdown>
          </div>
        </Card>
      )}
    </main>
  );
}
