import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import FirecrawlApp from 'npm:@mendable/firecrawl-js';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface LDBResponse {
  success: boolean;
  containerNumber?: string;
  status?: string;
  location?: string;
  lastUpdate?: string;
  error?: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const FIRECRAWL_API_KEY = Deno.env.get('FIRECRAWL_API_KEY');
    if (!FIRECRAWL_API_KEY) {
      throw new Error('FIRECRAWL_API_KEY is not set');
    }

    const { containerNumber } = await req.json();
    
    if (!containerNumber) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Container number is required'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Fetching LDB status for container: ${containerNumber}`);

    // Initialize Firecrawl
    const app = new FirecrawlApp({ apiKey: FIRECRAWL_API_KEY });

    // Scrape LDB website
    const ldbUrl = `https://www.ldb.co.in/ldb/containersearch?container=${encodeURIComponent(containerNumber)}`;
    
    const scrapeResponse = await app.scrapeUrl(ldbUrl, {
      formats: ['markdown', 'html'],
      timeout: 30000,
    });

    if (!scrapeResponse.success) {
      console.error('Firecrawl scraping failed:', scrapeResponse.error);
      return new Response(JSON.stringify({
        success: false,
        containerNumber,
        error: 'Failed to scrape LDB website'
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Parse the scraped data to extract container information
    const markdown = scrapeResponse.data?.markdown || '';
    const html = scrapeResponse.data?.html || '';

    // Extract container status information from the scraped content
    const result = parseContainerData(containerNumber, markdown, html);

    console.log('LDB scraping result:', result);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in LDB scraper:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

function parseContainerData(containerNumber: string, markdown: string, html: string): LDBResponse {
  try {
    // Look for common patterns in LDB response
    const statusPatterns = [
      /status[:\s]*([^,\n]+)/i,
      /current[:\s]*([^,\n]+)/i,
      /position[:\s]*([^,\n]+)/i,
    ];

    const locationPatterns = [
      /location[:\s]*([^,\n]+)/i,
      /port[:\s]*([^,\n]+)/i,
      /terminal[:\s]*([^,\n]+)/i,
    ];

    const datePatterns = [
      /updated?[:\s]*([^,\n]+)/i,
      /last[:\s]*([^,\n]+)/i,
      /date[:\s]*([^,\n]+)/i,
    ];

    let status = 'Unknown';
    let location = 'Unknown';
    let lastUpdate = new Date().toISOString();

    // Extract status
    for (const pattern of statusPatterns) {
      const match = markdown.match(pattern);
      if (match && match[1]) {
        status = match[1].trim();
        break;
      }
    }

    // Extract location
    for (const pattern of locationPatterns) {
      const match = markdown.match(pattern);
      if (match && match[1]) {
        location = match[1].trim();
        break;
      }
    }

    // Extract last update
    for (const pattern of datePatterns) {
      const match = markdown.match(pattern);
      if (match && match[1]) {
        const dateStr = match[1].trim();
        try {
          const parsedDate = new Date(dateStr);
          if (!isNaN(parsedDate.getTime())) {
            lastUpdate = parsedDate.toISOString();
          }
        } catch (e) {
          console.warn('Failed to parse date:', dateStr);
        }
        break;
      }
    }

    // Check if we found any meaningful data
    if (markdown.toLowerCase().includes('not found') || 
        markdown.toLowerCase().includes('no records') ||
        markdown.toLowerCase().includes('error')) {
      return {
        success: false,
        containerNumber,
        error: 'Container not found in LDB system'
      };
    }

    // Return successful result
    return {
      success: true,
      containerNumber,
      status,
      location,
      lastUpdate
    };

  } catch (error) {
    console.error('Error parsing container data:', error);
    return {
      success: false,
      containerNumber,
      error: 'Failed to parse container data from LDB'
    };
  }
}