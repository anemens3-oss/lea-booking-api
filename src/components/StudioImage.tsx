import React, { useState } from 'react';

interface StudioImageProps {
  src: string;
  alt: string;
  className?: string;
  imgClassName?: string;
  fallbackLabel?: string;
}

export const StudioImage: React.FC<StudioImageProps> = ({
  src,
  alt,
  className = '',
  imgClassName = '',
  fallbackLabel,
}) => {
  const [hasError, setHasError] = useState(false);

  if (hasError) {
    return (
      <div
        className={`flex flex-col items-center justify-center bg-[#FAF8F5] border border-[#EAE6E1] p-6 text-center ${className}`}
        role="img"
        aria-label={alt}
      >
        <svg
          className="w-8 h-8 text-[#827D76] mb-2"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.2"
          aria-hidden="true"
        >
          <path d="M12 3c.5 4.5 4 8 8.5 8.5-4.5.5-8 4-8.5 8.5-.5-4.5-4-8-8.5-8.5 4.5-.5 8-4 8.5-8.5z" />
        </svg>
        <span className="text-xs text-[#827D76] max-w-[24ch]">
          {fallbackLabel || alt}
        </span>
      </div>
    );
  }

  return (
    <div className={`overflow-hidden bg-[#FAF8F5] ${className}`}>
      <img
        src={src}
        alt={alt}
        referrerPolicy="no-referrer"
        onError={() => setHasError(true)}
        className={`w-full h-full object-cover transition-transform duration-200 ease-out ${imgClassName}`}
      />
    </div>
  );
};
