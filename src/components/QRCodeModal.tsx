/* eslint-disable @next/next/no-img-element */
"use client";

import React, { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Copy, Check, ExternalLink, Smartphone } from "lucide-react";

interface QRCodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  roomKey: string;
}

export function QRCodeModal({ isOpen, onClose, roomKey }: QRCodeModalProps) {
  const [qrDataUrl, setQrDataUrl] = useState<string>("");
  const [copied, setCopied] = useState(false);
  const [pairingUrl, setPairingUrl] = useState<string>("");

  useEffect(() => {
    if (typeof window !== "undefined" && roomKey) {
      const url = `${window.location.protocol}//${window.location.hostname}${
        window.location.port ? `:${window.location.port}` : ""
      }/remote/${roomKey.toUpperCase()}`;
      setPairingUrl(url);

      QRCode.toDataURL(url, {
        width: 320,
        margin: 2,
        color: {
          dark: "#000000",
          light: "#FFFFFF",
        },
      })
        .then((dataUrl) => setQrDataUrl(dataUrl))
        .catch((err) => console.error("Error generating QR code:", err));
    }
  }, [roomKey]);

  const copyUrl = () => {
    if (pairingUrl) {
      navigator.clipboard.writeText(pairingUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="w-[92vw] sm:max-w-md md:max-w-lg bg-neutral-950 border-neutral-800 text-neutral-100 p-5 sm:p-6 overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg sm:text-xl font-bold">
            <Smartphone className="text-amber-400 w-5 h-5 shrink-0" />
            Connect Remote Device
          </DialogTitle>
          <DialogDescription className="text-neutral-400 text-xs sm:text-sm">
            Scan the QR code with your phone camera or enter the Room Key to pair as a wireless remote.
          </DialogDescription>
        </DialogHeader>

        <div className="w-full min-w-0 flex flex-col items-center justify-center py-1 sm:py-2 gap-3 sm:gap-4 overflow-hidden box-border">
          <div className="bg-white p-2.5 sm:p-3 rounded-2xl shadow-xl shrink-0">
            {qrDataUrl ? (
              <img
                src={qrDataUrl}
                alt={`QR code to pair remote for room ${roomKey}`}
                className="w-40 h-40 sm:w-48 sm:h-48 rounded-xl object-contain"
              />
            ) : (
              <div className="w-40 h-40 sm:w-48 sm:h-48 flex items-center justify-center text-neutral-400 text-sm">
                Generating QR...
              </div>
            )}
          </div>

          <div className="w-full flex flex-col items-center gap-1">
            <div className="text-[10px] uppercase tracking-widest text-neutral-400 font-bold">
              Room Key
            </div>
            <div className="text-2xl sm:text-3xl font-mono font-black tracking-widest text-amber-400 bg-neutral-900 border border-neutral-800 px-6 py-1.5 rounded-xl shadow-inner">
              {roomKey}
            </div>
          </div>

          <div className="w-full min-w-0 flex items-center gap-2 bg-neutral-900/90 border border-neutral-800 p-2 sm:p-2.5 rounded-xl text-xs font-mono text-neutral-300 overflow-hidden box-border">
            <span className="truncate flex-1 min-w-0 select-all font-mono text-[11px] sm:text-xs text-neutral-300">
              {pairingUrl}
            </span>
            <Button
              size="sm"
              variant="secondary"
              onClick={copyUrl}
              className="h-8 px-2.5 flex items-center gap-1.5 shrink-0 text-xs font-semibold bg-neutral-800 hover:bg-neutral-700 text-neutral-200"
            >
              {copied ? <Check size={13} className="text-green-400" /> : <Copy size={13} />}
              <span>{copied ? "Copied" : "Copy"}</span>
            </Button>
          </div>
        </div>

        <div className="w-full flex flex-col-reverse sm:flex-row sm:justify-end gap-2.5 pt-3 border-t border-neutral-800/80">
          <Button
            variant="outline"
            onClick={onClose}
            className="border-neutral-800 text-neutral-300 hover:bg-neutral-900 h-9 sm:h-10 text-xs sm:text-sm"
          >
            Done
          </Button>
          <Button
            className="!bg-amber-500 hover:!bg-amber-400 !text-black font-bold shadow-md shadow-amber-500/20 h-9 sm:h-10 text-xs sm:text-sm flex items-center justify-center gap-1.5"
            onClick={() => {
              window.open(pairingUrl, "_blank");
              onClose();
            }}
          >
            <ExternalLink size={15} />
            Open Remote in Tab
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
