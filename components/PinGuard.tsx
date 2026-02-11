"use client";

import React, { useState } from "react";
import { Lock, X, Check } from "lucide-react";

interface PinGuardProps {
    children: React.ReactElement<{ onClick?: (e: React.MouseEvent) => void }>;
    onVerify: () => void;
    title?: string;
    description?: string;
}

export default function PinGuard({
    children,
    onVerify,
    title = "Acceso Protegido",
    description = "Ingresa el PIN de seguridad para continuar."
}: PinGuardProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [pin, setPin] = useState("");
    const [error, setError] = useState(false);

    // Default PIN from user request
    const CORRECT_PIN = "1111";

    const handleProtectedClick = (e: React.MouseEvent) => {
        // Stop any parent handlers
        e.preventDefault();
        e.stopPropagation();

        // Open the guard modal
        setIsOpen(true);
        setPin("");
        setError(false);
    };

    const handlePinSubmit = () => {
        if (pin === CORRECT_PIN) {
            setIsOpen(false);
            setPin("");
            setError(false);
            // Execute the protected action
            onVerify();
        } else {
            setError(true);
            setPin("");
            // Auto clear error after 2s
            setTimeout(() => setError(false), 2000);
        }
    };

    const handleClose = () => {
        setIsOpen(false);
        setPin("");
        setError(false);
    };

    // Append our protected handler to the child
    const childWithClick = React.cloneElement(children, {
        onClick: handleProtectedClick
    });

    return (
        <>
            {childWithClick}

            {isOpen && (
                <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4">
                    {/* Backdrop */}
                    <div
                        className="absolute inset-0 bg-black/90 backdrop-blur-md animate-in fade-in duration-200"
                        onClick={handleClose}
                    />

                    {/* Modal */}
                    <div className="relative bg-[#3E3129] border border-white/10 rounded-2xl p-8 max-w-sm w-full shadow-2xl animate-in zoom-in-95 duration-200 ring-1 ring-white/5">

                        <div className="flex justify-center mb-4">
                            <div className={`p-4 rounded-full ${error ? "bg-red-500/10 text-red-400" : "bg-[#A5D6A7]/10 text-[#A5D6A7]"}`}>
                                <Lock size={32} />
                            </div>
                        </div>

                        <h3 className="text-2xl font-bold text-white mb-2 text-center">{title}</h3>
                        <p className="text-white/60 mb-6 text-center text-lg">{description}</p>

                        {/* PIN Input Circles */}
                        <div className="flex justify-center gap-4 mb-8">
                            {[0, 1, 2, 3].map((idx) => (
                                <div
                                    key={idx}
                                    className={`
                                        w-4 h-4 rounded-full transition-all duration-300
                                        ${idx < pin.length
                                            ? (error ? "bg-red-500 scale-110" : "bg-[#A5D6A7] scale-110")
                                            : "bg-white/10"}
                                    `}
                                />
                            ))}
                        </div>

                        {/* Custom Numpad */}
                        <div className="grid grid-cols-3 gap-3 mb-6">
                            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                                <button
                                    key={num}
                                    onClick={() => {
                                        if (pin.length < 4) {
                                            const newPin = pin + num;
                                            setPin(newPin);
                                            // Auto submit on 4th digit
                                            if (newPin.length === 4) {
                                                // Tiny delay for visual feedback
                                                setTimeout(() => {
                                                    if (newPin === CORRECT_PIN) {
                                                        setIsOpen(false);
                                                        onVerify();
                                                    } else {
                                                        setError(true);
                                                        setTimeout(() => { setError(false); setPin(""); }, 1000);
                                                    }
                                                }, 100);
                                            }
                                        }
                                    }}
                                    className="h-16 rounded-xl bg-white/5 hover:bg-white/10 text-white font-bold text-2xl transition-colors active:scale-95"
                                >
                                    {num}
                                </button>
                            ))}
                            <button
                                onClick={handleClose}
                                className="h-16 rounded-xl bg-white/5 hover:bg-white/10 text-white/50 flex items-center justify-center"
                            >
                                <X size={24} />
                            </button>
                            <button
                                onClick={() => {
                                    if (pin.length < 4) {
                                        const newPin = pin + "0";
                                        setPin(newPin);
                                        if (newPin.length === 4) {
                                            setTimeout(() => {
                                                if (newPin === CORRECT_PIN) {
                                                    setIsOpen(false);
                                                    onVerify();
                                                } else {
                                                    setError(true);
                                                    setTimeout(() => { setError(false); setPin(""); }, 1000);
                                                }
                                            }, 100);
                                        }
                                    }
                                }}
                                className="h-16 rounded-xl bg-white/5 hover:bg-white/10 text-white font-bold text-2xl transition-colors active:scale-95"
                            >
                                0
                            </button>
                            <button
                                onClick={() => setPin(prev => prev.slice(0, -1))}
                                className="h-16 rounded-xl bg-white/5 hover:bg-white/10 text-white/50 flex items-center justify-center"
                            >
                                <span className="text-xl">⌫</span>
                            </button>
                        </div>

                        {error && (
                            <p className="text-red-400 text-center font-bold animate-pulse absolute bottom-4 left-0 right-0">
                                PIN Incorrecto
                            </p>
                        )}
                    </div>
                </div>
            )}
        </>
    );
}
