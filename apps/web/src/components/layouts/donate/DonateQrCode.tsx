"use client";

import { QRCodeSVG } from "qrcode.react";

interface DonateQrCodeProps {
  title: string;
  value: string;
}

/** 在浏览器内将支付文本编码为 SVG 二维码，避免把支付内容发送给第三方服务。 */
export function DonateQrCode({ title, value }: DonateQrCodeProps) {
  return (
    <QRCodeSVG
      value={value}
      title={title}
      level="M"
      marginSize={4}
      className="size-45 rounded-xl select-none"
    />
  );
}
