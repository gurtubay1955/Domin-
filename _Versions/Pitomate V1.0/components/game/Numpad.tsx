"use client";

import { Delete } from "lucide-react";

interface NumpadProps {
    onInput: (value: number) => void;
    onDelete: () => void;
    onEnter: () => void;
    disabled?: boolean;
}

export default function Numpad({ onInput, onDelete, onEnter, disabled }: NumpadProps) {
    const keys = [7, 8, 9, 4, 5, 6, 1, 2, 3, 0];

    return (
        <div className="grid grid-cols-3 gap-2 w-full max-w-[300px] mx-auto opacity-100 transition-opacity duration-300">
            {keys.map((num) => (
                <button
                    key={num}
                    onClick={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        if (!disabled) onInput(num);
                    }}
                    disabled={disabled}
                    className={`
            h-16 text-2xl font-bold rounded-xl shadow-sm border-b-4 active:border-b-0 active:translate-y-1 transition-all
            ${num === 0 ? "col-span-1" : ""}
            bg-[#FDFBF7] text-[#4A3B32] border-[#dcdcdc]
            hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed
          `}
                >
                    {num}
                </button>
            ))}

            <button
                onClick={onDelete}
                disabled={disabled}
                className="h-16 flex items-center justify-center bg-[#E57373] text-white font-bold rounded-xl shadow-sm border-b-4 border-[#D32F2F] active:border-b-0 active:translate-y-1 transition-all hover:bg-[#EF5350]"
            >
                <Delete />
            </button>

            <button
                onClick={onEnter}
                disabled={disabled}
                className="h-16 flex items-center justify-center bg-[#81C784] text-white font-bold rounded-xl shadow-sm border-b-4 border-[#388E3C] active:border-b-0 active:translate-y-1 transition-all hover:bg-[#66BB6A]"
            >
                OK
            </button>
        </div>
    );
}
