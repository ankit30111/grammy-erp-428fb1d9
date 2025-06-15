
export const calculateEndingSerialNumber = (
  startingSerial: string,
  quantity: number
): string => {
  if (!startingSerial || quantity <= 0) return "";

  try {
    // Extract numeric portion from the end of the serial number
    const match = startingSerial.match(/^(.*?)(\d+)$/);
    
    if (!match) {
      // If no numeric pattern found, just append the quantity
      return `${startingSerial}_${quantity - 1}`;
    }

    const [, prefix, numericPart] = match;
    const startingNumber = parseInt(numericPart, 10);
    const endingNumber = startingNumber + quantity - 1; // -1 because starting number counts as 1
    
    // Maintain the same number of digits as original (with leading zeros if needed)
    const paddedEndingNumber = endingNumber.toString().padStart(numericPart.length, '0');
    
    return `${prefix}${paddedEndingNumber}`;
  } catch (error) {
    console.error("Error calculating ending serial number:", error);
    return `${startingSerial}_TO_${startingSerial}_${quantity - 1}`;
  }
};

export const validateSerialNumberRange = (
  startingSerial: string,
  endingSerial: string,
  quantity: number
): { isValid: boolean; error?: string } => {
  if (!startingSerial || !endingSerial) {
    return { isValid: false, error: "Both starting and ending serial numbers are required" };
  }

  // Extract numeric portions for validation
  const startMatch = startingSerial.match(/(\d+)$/);
  const endMatch = endingSerial.match(/(\d+)$/);

  if (!startMatch || !endMatch) {
    // If no numeric pattern, just check they're different
    if (startingSerial === endingSerial && quantity > 1) {
      return { isValid: false, error: "Starting and ending serial numbers cannot be the same for quantity > 1" };
    }
    return { isValid: true };
  }

  const startNum = parseInt(startMatch[1], 10);
  const endNum = parseInt(endMatch[1], 10);
  const expectedRange = quantity - 1;

  if (endNum < startNum) {
    return { isValid: false, error: "Ending serial number must be greater than starting serial number" };
  }

  const actualRange = endNum - startNum;
  if (actualRange !== expectedRange) {
    return { 
      isValid: false, 
      error: `Serial number range should span ${expectedRange} numbers for quantity ${quantity}, but spans ${actualRange}` 
    };
  }

  return { isValid: true };
};

export const formatSerialNumberRange = (starting?: string, ending?: string): string => {
  if (!starting && !ending) return "Not assigned";
  if (!ending) return starting || "Not assigned";
  if (starting === ending) return starting;
  return `${starting} to ${ending}`;
};
