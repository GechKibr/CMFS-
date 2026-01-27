import { useTheme } from '../../contexts/ThemeContext';

const Modal = ({ isOpen, onClose, title, children, size = 'md' }) => {
  const { isDark } = useTheme();
  
  if (!isOpen) return null;

  const sizeClasses = {
    sm: 'max-w-md',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl'
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className={`${isDark ? 'bg-gray-800' : 'bg-white'} rounded-lg p-6 w-full ${sizeClasses[size]} mx-4 max-h-[90vh] overflow-y-auto`}>
        <div className="flex justify-between items-center mb-4">
          <h2 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-gray-700'}`}>{title}</h2>
          <button
            onClick={onClose}
            className={`${isDark ? 'text-gray-400 hover:text-gray-200' : 'text-gray-500 hover:text-gray-700'} p-1`}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="space-y-4">
          {children}
        </div>
      </div>
    </div>
  );
};

export default Modal;
