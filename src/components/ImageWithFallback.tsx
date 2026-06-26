import React, { useState, useEffect } from 'react';
import { ImageOff, AlertTriangle } from 'lucide-react';

interface ImageWithFallbackProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src?: string;
  alt: string;
  className?: string;
  fallbackClassName?: string;
}

export function ImageWithFallback({ 
  src, 
  alt, 
  className, 
  fallbackClassName = "h-14 w-14 rounded-lg border border-zinc-200 bg-zinc-50 flex flex-col items-center justify-center text-zinc-400 shrink-0",
  ...props
}: ImageWithFallbackProps) {
  const [error, setError] = useState(false);

  useEffect(() => {
    setError(false);
  }, [src]);

  const cleanSrc = typeof src === 'string' ? src.trim() : '';
  const isValidLink = cleanSrc.startsWith('http://') || cleanSrc.startsWith('https://') || cleanSrc.startsWith('data:image/');

  if (!cleanSrc || !isValidLink) {
    // GAMBAR RUSAK (Link tidak valid atau kosong)
    return (
      <div className={`${fallbackClassName} text-rose-500 border-rose-100 bg-rose-50 flex flex-col items-center justify-center`} title="Link tidak valid atau rusak">
        <AlertTriangle className="h-5 w-5 text-rose-500 stroke-[2] shrink-0" />
        <span className="text-[8px] font-black uppercase tracking-widest mt-1 text-center leading-none">GAMBAR RUSAK</span>
      </div>
    );
  }

  if (error) {
    // TIDAK TERSEDIA (Ada link tapi load gambar gagal)
    return (
      <div className={`${fallbackClassName} text-zinc-400 border-zinc-200 bg-zinc-50 flex flex-col items-center justify-center`} title="Ada link tapi gambar tidak tersedia">
        <ImageOff className="h-5 w-5 text-zinc-400 stroke-[2] shrink-0" />
        <span className="text-[8px] font-black uppercase tracking-widest mt-1 text-center leading-none">TIDAK TERSEDIA</span>
      </div>
    );
  }

  return (
    <img 
      src={cleanSrc} 
      alt={alt} 
      className={className} 
      onError={() => setError(true)}
      referrerPolicy="no-referrer"
      {...props}
    />
  );
}
