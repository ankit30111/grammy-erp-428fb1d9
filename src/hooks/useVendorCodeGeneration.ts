
import { supabase } from "@/integrations/supabase/client";

export const useVendorCodeGeneration = () => {
  const generateVendorCode = async (): Promise<string> => {
    console.log("Debug: Starting vendor code generation");
    
    try {
      // Use a transaction to ensure atomicity
      const { data, error } = await supabase.rpc('generate_vendor_code');
      
      if (error) {
        console.error("Debug: Error generating vendor code via RPC:", error);
        // Fallback to manual generation
        return await generateVendorCodeFallback();
      }
      
      console.log("Debug: Generated vendor code:", data);
      return data;
    } catch (error) {
      console.error("Debug: Exception in vendor code generation:", error);
      // Fallback to manual generation
      return await generateVendorCodeFallback();
    }
  };

  const generateVendorCodeFallback = async (): Promise<string> => {
    console.log("Debug: Using fallback vendor code generation");
    
    try {
      // Get the last vendor code with proper error handling
      const { data: vendors, error } = await supabase
        .from("vendors")
        .select("vendor_code")
        .like("vendor_code", "VDR%")
        .order("vendor_code", { ascending: false })
        .limit(1);

      if (error) {
        console.error("Debug: Error fetching last vendor:", error);
        return "VDR001"; // Default if we can't fetch
      }

      let nextNumber = 1;
      
      if (vendors && vendors.length > 0) {
        const lastCode = vendors[0].vendor_code;
        console.log("Debug: Last vendor code found:", lastCode);
        
        // Extract number from VDR### format
        const match = lastCode.match(/^VDR(\d{3})$/);
        if (match) {
          nextNumber = parseInt(match[1], 10) + 1;
        }
      }

      const newCode = `VDR${nextNumber.toString().padStart(3, "0")}`;
      console.log("Debug: Generated fallback vendor code:", newCode);
      return newCode;
    } catch (error) {
      console.error("Debug: Exception in fallback generation:", error);
      // If all else fails, return a default
      return "VDR001";
    }
  };

  return { generateVendorCode };
};
