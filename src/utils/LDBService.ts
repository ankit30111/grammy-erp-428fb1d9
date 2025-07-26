import { supabase } from "@/integrations/supabase/client";

interface LDBContainerStatus {
  success: boolean;
  containerNumber?: string;
  status?: string;
  location?: string;
  lastUpdate?: string;
  error?: string;
}

export class LDBService {
  private static readonly LDB_BASE_URL = 'https://www.ldb.co.in/ldb/containersearch';
  
  /**
   * Fetch container status from LDB website using Supabase Edge Function
   */
  static async fetchContainerStatus(containerNumber: string): Promise<LDBContainerStatus> {
    try {
      console.log(`Fetching status for container: ${containerNumber} from LDB`);
      
      // Call our Supabase Edge Function to scrape LDB
      const { data, error } = await supabase.functions.invoke('ldb-scraper', {
        body: { containerNumber: this.formatContainerNumber(containerNumber) }
      });

      if (error) {
        console.error('Error calling LDB scraper function:', error);
        return {
          success: false,
          containerNumber,
          error: `Failed to fetch from LDB: ${error.message}`
        };
      }

      return data as LDBContainerStatus;
    } catch (error) {
      console.error('Error fetching container status from LDB:', error);
      return {
        success: false,
        containerNumber,
        error: error instanceof Error ? error.message : 'Failed to fetch container status'
      };
    }
  }

  /**
   * Get direct URL to LDB search for a container
   */
  static getLDBSearchUrl(containerNumber: string): string {
    return `${this.LDB_BASE_URL}?container=${encodeURIComponent(containerNumber)}`;
  }

  /**
   * Validate container number format
   */
  static isValidContainerNumber(containerNumber: string): boolean {
    // Basic container number validation (4 letters + 7 digits)
    const containerRegex = /^[A-Z]{4}[0-9]{7}$/;
    return containerRegex.test(containerNumber.replace(/\s+/g, ''));
  }

  /**
   * Format container number to standard format
   */
  static formatContainerNumber(containerNumber: string): string {
    return containerNumber.replace(/\s+/g, '').toUpperCase();
  }
}