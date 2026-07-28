import { Copy, Download, Package } from "lucide-react";
import { PanelModel } from "./project-details/PanelsSection";
import { Button } from "./ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "./ui/dialog";
import { QRCodeCanvas } from "qrcode.react";
import { useRef } from "react";

interface QRCodeModalProps {
  panel: PanelModel;
  isOpen: boolean;
  onClose: () => void;
}

export function QRCodeModal({ panel, isOpen, onClose }: QRCodeModalProps) {
  const qrCodeData = `${window.location.origin}/panels/${panel.id}`;

  const qrCodeRef = useRef<HTMLCanvasElement>(null);

  const handleCopyToClipboard = () => {
    navigator.clipboard.writeText(qrCodeData);
  };

const handleDownload = () => {
  if (qrCodeRef.current) {
    const canvas = qrCodeRef.current;
    try {
      const pngUrl = canvas.toDataURL("image/png");
      const downloadLink = document.createElement("a");
      downloadLink.href = pngUrl;
      downloadLink.download = `panel-${panel.id}-qr.png`;
      document.body.appendChild(downloadLink);
      downloadLink.click();
      document.body.removeChild(downloadLink);
    } catch (error) {
    }
  }
};

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            QR Code for {panel.name}
          </DialogTitle>
          <DialogDescription>
            Panel information and QR code data
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* QR Code Display */}
          <div className="flex justify-center">
            <div className="w-48 h-48 bg-white rounded-lg flex items-center justify-center border-2 border-dashed border-muted-foreground">
              <QRCodeCanvas
                value={qrCodeData}
                size={176} 
                level="H" 
                marginSize={3}
                ref={qrCodeRef}
                className="rounded-lg"
              />
            </div>
          </div>

          {/* QR Code Data */}
          <div className="space-y-2">
            <span className="text-sm font-medium">QR Code Data:</span>
            <div className="p-3 bg-muted rounded-md">
              <pre className="text-xs text-muted-foreground whitespace-pre-wrap">
                {qrCodeData}
              </pre>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={handleCopyToClipboard}
              className="flex-1"
            >
              <Copy className="mr-2 h-4 w-4" />
              Copy Data
            </Button>
            <Button
              variant="outline"
              onClick={handleDownload}
              className="flex-1"
            >
              <Download className="mr-2 h-4 w-4" />
              Download
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}