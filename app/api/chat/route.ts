import { OpenAI } from 'openai';
import { NextResponse } from 'next/server';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const SYSTEM_PROMPT = `You are a helpful web scraping assistant that uses Firecrawl to scrape websites. 
Your role is to help users understand and analyze scraped content.

When handling user requests:
1. For new scraping: If you see a URL, respond with "SCRAPE_URL: <the_url>"
2. For analysis: 
   - Provide detailed, informative responses about the scraped content
   - Focus on answering the user's specific questions
   - Include relevant details and examples from the content
   - Format your responses in a clear, readable way
3. When users specifically request the full content, provide it with proper formatting
4. For all other requests, provide analyzed or summarized information

Example responses:
- For full content request: Return the complete scraped content with proper formatting
- For summaries: "Here's a summary of the content: [detailed summary]"
- For specific info: "The key points about [topic] are: [points]"

Always format the content in a clear, readable way.`;

// Function to truncate text to approximate token count
function truncateText(text: string, maxTokens: number = 12000): string {
  // Rough approximation: 1 token ≈ 4 characters
  const maxLength = maxTokens * 4;
  if (text.length <= maxLength) return text;
  
  return text.slice(0, maxLength) + "\n\n[Content truncated due to length...]";
}

export async function POST(request: Request) {
  try {
    const { messages, scrapedContent } = await request.json();

    // Get the user's latest message
    const lastMessage = messages[messages.length - 1];
    const userUrlMatch = lastMessage.role === 'user' ? 
      lastMessage.content.match(/https?:\/\/[^\s]+/) : null;

    let currentScrapedContent = scrapedContent;
    
    // Handle URL scraping if present in user message
    if (userUrlMatch) {
      const url = userUrlMatch[0];
      const scrapeResponse = await fetch(`${request.headers.get('origin')}/api/scrape`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });
      
      if (scrapeResponse.ok) {
        const scrapeResult = await scrapeResponse.json();
        currentScrapedContent = scrapeResult.data?.content || scrapeResult.data?.markdown;
        // Truncate the scraped content
        currentScrapedContent = truncateText(currentScrapedContent || '');
      }
    }

    // Check if user is requesting full content
    const isFullContentRequest = lastMessage.role === 'user' && 
      lastMessage.content.toLowerCase().includes('whole content');

    // For non-URL messages, prepare the request
    const userRequest = lastMessage.role === 'user' && !userUrlMatch ? 
      isFullContentRequest ? 
        "Please provide the complete scraped content with proper formatting." :
        `Based on the scraped content, please: ${lastMessage.content}` :
      lastMessage.content;

    // Prepare messages for OpenAI with higher token limit for full content requests
    const systemMessages = [
      { role: "system", content: SYSTEM_PROMPT },
      ...(currentScrapedContent ? [{ 
        role: "system", 
        content: `Reference content for analysis: ${
          isFullContentRequest ? 
            currentScrapedContent : // Send full content when specifically requested
            truncateText(currentScrapedContent, 4000)
        }`
      }] : [])
    ];

    // Take only relevant recent messages
    const recentMessages = messages
      .slice(-5)
      .map(msg => ({
        role: msg.role as "user" | "assistant",
        content: msg.role === 'user' && msg === lastMessage ? userRequest : msg.content
      }));

    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo-16k", // Use the 16k model for larger content
      messages: [...systemMessages, ...recentMessages],
      temperature: 0.7,
    });

    const responseMessage = completion.choices[0].message;

    if (!responseMessage || !responseMessage.content) {
      throw new Error('Invalid response from OpenAI');
    }

    // Handle new URL scraping requests from AI
    const aiUrlMatch = responseMessage.content.match(/SCRAPE_URL: (https?:\/\/[^\s]+)/);
    let scrapeResult = null;

    if (aiUrlMatch && !userUrlMatch) {
      const url = aiUrlMatch[1];
      const scrapeResponse = await fetch(`${request.headers.get('origin')}/api/scrape`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });
      
      if (scrapeResponse.ok) {
        scrapeResult = await scrapeResponse.json();
        currentScrapedContent = scrapeResult.data?.content || scrapeResult.data?.markdown;
        currentScrapedContent = truncateText(currentScrapedContent || '');

        // Get AI to analyze the newly scraped content
        const analysisCompletion = await openai.chat.completions.create({
          model: "gpt-3.5-turbo",
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "system", content: `Recently scraped content: ${truncateText(currentScrapedContent, 4000)}` },
            { role: "user", content: "Please analyze this content and provide a helpful summary." }
          ],
          temperature: 0.7,
        });

        if (analysisCompletion.choices[0].message?.content) {
          responseMessage.content = analysisCompletion.choices[0].message.content;
        }
      }
    }

    // Clean up any SCRAPE_URL commands from the response
    const cleanedContent = responseMessage.content
      .replace(/SCRAPE_URL: https?:\/\/[^\s]+/, '')
      .trim();

    return NextResponse.json({
      message: {
        role: responseMessage.role,
        content: cleanedContent
      },
      scrapeResult: scrapeResult?.data,
      scrapedContent: currentScrapedContent
    });

  } catch (error) {
    console.error('Chat error:', error);
    return NextResponse.json(
      { error: 'Failed to process chat' },
      { status: 500 }
    );
  }
} 