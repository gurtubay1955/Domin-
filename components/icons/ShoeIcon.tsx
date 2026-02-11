import React from 'react';

export const ShoeIcon = ({ size = 24, className = "" }: { size?: number, className?: string }) => (
    <svg
        xmlns="http://www.w3.org/2000/svg"
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="currentColor"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
    >
        {/* Sneaker Shape */}
        <path d="M21 15v4a2 2 0 0 1-2 2H5l-2-4.5V14c0-2.5 2-4.5 4.5-4.5.5 0 1 .1 1.5.3L11 8c0-3 2.5-5 5.5-5 2 0 3.5 1 4.5 2.5V15z" />
        <line x1="2" y1="17" x2="22" y2="17" />
        <path d="M15 12h.01" strokeWidth="3" />
        <path d="M12 12h.01" strokeWidth="3" />
    </svg>
);
