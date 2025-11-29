import React from 'react';
import { UserRole } from '../types';

interface RoleSelectorProps {
  currentRole: UserRole;
  setRole: (role: UserRole) => void;
}

export const RoleSelector: React.FC<RoleSelectorProps> = ({ currentRole, setRole }) => {
  return (
    <div className="flex bg-stone-200 p-1 rounded-full relative shadow-inner">
      <div 
        className={`absolute top-1 bottom-1 w-1/2 bg-white rounded-full shadow-sm transition-all duration-300 ease-in-out ${
          currentRole === UserRole.DRIVER ? 'left-1' : 'left-[calc(50%-4px)] translate-x-1'
        }`}
      />
      <button
        onClick={() => setRole(UserRole.DRIVER)}
        className={`flex-1 relative z-10 py-2 text-sm font-bold rounded-full transition-colors ${
          currentRole === UserRole.DRIVER ? 'text-green-800' : 'text-stone-500 hover:text-stone-700'
        }`}
      >
        配達員 (Driver)
      </button>
      <button
        onClick={() => setRole(UserRole.CUSTOMER)}
        className={`flex-1 relative z-10 py-2 text-sm font-bold rounded-full transition-colors ${
          currentRole === UserRole.CUSTOMER ? 'text-green-800' : 'text-stone-500 hover:text-stone-700'
        }`}
      >
        お客様 (Viewer)
      </button>
    </div>
  );
};