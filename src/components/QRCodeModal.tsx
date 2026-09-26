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
      <DialogContent className="sm:max-w-md bg-neutral-950 border-neutral-800 text-neutral-100">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl font-bold">
            <Smartphone className="text-amber-400" />
            Connect Remote Device
          </DialogTitle>
          <DialogDescription className="text-neutral-400">
            Scan the QR code with your phone camera or enter the Room Key to pair as a wireless remote.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center justify-center p-4 gap-4">
          <div className="bg-white p-3 rounded-2xl shadow-xl">
            {qrDataUrl ? (
              <img
                src={qrDataUrl}
                alt={`QR code to pair remote for room ${roomKey}`}
                className="w-56 h-56 rounded-xl"
              />
            ) : (
              <div className="w-56 h-56 flex items-center justify-center text-neutral-400">
                Generating QR...
              </div>
            )}
          </div>

          <div className="w-full flex flex-col items-center gap-2">
            <div className="text-xs uppercase tracking-wider text-neutral-400 font-semibold">
              Room Key
            </div>
            <div className="text-3xl font-mono font-black tracking-widest text-amber-400 bg-neutral-900 border border-neutral-800 px-6 py-2 rounded-xl">
              {roomKey}
            </div>
          </div>

          <div className="w-full flex items-center gap-2 bg-neutral-900/80 border border-neutral-800 p-2 rounded-lg text-xs font-mono text-neutral-300">
            <span className="truncate flex-1 select-all">{pairingUrl}</span>
            <Button
              size="sm"
              variant="secondary"
              onClick={copyUrl}
              className="h-8 px-2 flex items-center gap-1 shrink-0"
            >
              {copied ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
              <span>{copied ? "Copied" : "Copy"}</span>
            </Button>
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <Button variant="outline" onClick={onClose} className="border-neutral-800 text-neutral-300 hover:bg-neutral-900">
            Done
          </Button>
          <Button
            className="!bg-amber-500 hover:!bg-amber-400 !text-black font-bold shadow-md shadow-amber-500/20"
            onClick={() => {
              window.open(pairingUrl, "_blank");
              onClose();
            }}
          >
            <ExternalLink size={16} className="mr-1.5" />
            Open Remote in Tab
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
