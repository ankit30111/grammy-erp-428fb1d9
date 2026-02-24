import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { WifiOff, Copy, ExternalLink, RefreshCw, CheckCircle2 } from "lucide-react";
import { ConnectivityResult, formatDiagnostics, getHealthUrl } from "@/utils/supabaseConnectivity";
import { toast } from "sonner";

interface Props {
  result: ConnectivityResult;
  onRetry: () => void;
  retrying?: boolean;
}

export function BackendUnreachable({ result, onRetry, retrying }: Props) {
  const [copied, setCopied] = useState(false);

  const copyDiagnostics = async () => {
    try {
      await navigator.clipboard.writeText(formatDiagnostics(result));
      setCopied(true);
      toast.success("Diagnostics copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Could not copy to clipboard");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 py-12 px-4">
      <div className="max-w-lg w-full space-y-6">
        <div className="text-center">
          <img
            className="mx-auto h-12 w-auto"
            src="https://grammyelectronics.com/wp-content/uploads/2021/04/grammy-logo@2x-1-1.png"
            alt="Grammy Electronics"
          />
          <h1 className="mt-6 text-2xl font-bold text-foreground">
            Cannot reach ERP backend
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Your browser cannot connect to the Supabase server that powers this app.
          </p>
        </div>

        <Alert variant="destructive">
          <WifiOff className="h-4 w-4" />
          <AlertDescription className="ml-2">
            {result.errorMessage || "The backend server is unreachable from your network."}
          </AlertDescription>
        </Alert>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">How to fix this</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <ol className="list-decimal list-inside space-y-2">
              <li>
                <strong>Try a mobile hotspot</strong> — connect your device to phone data and reload. If it works, your Wi-Fi/ISP is blocking <code className="text-xs bg-muted px-1 rounded">*.supabase.co</code>.
              </li>
              <li>
                <strong>Change DNS</strong> — set your device or router DNS to <code className="text-xs bg-muted px-1 rounded">1.1.1.1</code> (Cloudflare) or <code className="text-xs bg-muted px-1 rounded">8.8.8.8</code> (Google).
              </li>
              <li>
                <strong>Enable DNS-over-HTTPS</strong> — in Chrome/Edge: Settings → Privacy → Security → "Use secure DNS".
              </li>
              <li>
                <strong>Ask IT</strong> — whitelist <code className="text-xs bg-muted px-1 rounded">{result.supabaseHost}</code> on your firewall/proxy.
              </li>
            </ol>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Diagnostics</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-xs text-muted-foreground font-mono">
            <p>Host: {result.supabaseHost}</p>
            <p>Origin: {result.origin}</p>
            <p>Online: {result.online ? "Yes" : "No"}</p>
            <p>Time: {result.timestamp}</p>
          </CardContent>
        </Card>

        <div className="flex flex-col sm:flex-row gap-3">
          <Button onClick={onRetry} disabled={retrying} className="flex-1">
            <RefreshCw className={`mr-2 h-4 w-4 ${retrying ? "animate-spin" : ""}`} />
            {retrying ? "Checking…" : "Retry connection"}
          </Button>
          <Button
            variant="outline"
            onClick={() => window.open(getHealthUrl(), "_blank")}
            className="flex-1"
          >
            <ExternalLink className="mr-2 h-4 w-4" />
            Open health check
          </Button>
          <Button variant="outline" onClick={copyDiagnostics} className="flex-1">
            {copied ? <CheckCircle2 className="mr-2 h-4 w-4" /> : <Copy className="mr-2 h-4 w-4" />}
            {copied ? "Copied" : "Copy diagnostics"}
          </Button>
        </div>
      </div>
    </div>
  );
}
