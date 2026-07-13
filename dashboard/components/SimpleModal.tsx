import React from 'react';

interface SimpleModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    children: React.ReactNode;
    footer?: React.ReactNode;
}

export const SimpleModal: React.FC<SimpleModalProps> = ({ isOpen, onClose, title, children, footer }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 transition-opacity animate-fade-in">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-md transform transition-all scale-100 p-6 m-4 relative">
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>

                <h3 className="text-lg font-bold text-gray-900 mb-4">{title}</h3>

                <div className="mb-6">
                    {children}
                </div>

                {footer && (
                    <div className="flex justify-end gap-3 border-t border-gray-100 pt-4">
                        {footer}
                    </div>
                )}
            </div>
        </div>
    );
};
