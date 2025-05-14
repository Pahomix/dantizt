'use client';

import { useState } from 'react';

export function TeethSelector({ selectedTeeth = [], onChange }) {
  const handleToothClick = (quadrant, number) => {
    const isCurrentlySelected = selectedTeeth.some(
      (t) => t.quadrant === quadrant && t.number === number
    );
    let newSelectedTeeth;

    if (isCurrentlySelected) {
      newSelectedTeeth = selectedTeeth.filter(
        (t) => !(t.quadrant === quadrant && t.number === number)
      );
    } else {
      newSelectedTeeth = [...selectedTeeth, { quadrant, number }];
    }

    onChange(newSelectedTeeth);
  };

  const isSelected = (quadrant, number) => {
    return selectedTeeth.some(
      (t) => t.quadrant === quadrant && t.number === number
    );
  };

  return (
    <div className="space-y-4">
      <label className="block text-sm font-medium text-gray-700">
        Выберите затронутые зубы
      </label>
      <div className="grid grid-cols-8 gap-1">
        {/* Верхний ряд (квадранты 2 и 1) */}
        {[2, 1].map(quadrant => (
          <div key={quadrant} className="col-span-4 grid grid-cols-8 gap-1">
            {[1, 2, 3, 4, 5, 6, 7, 8].map(number => {
              const toothNumber = `${quadrant}${number}`;
              return (
                <button
                  key={toothNumber}
                  type="button"
                  onClick={() => handleToothClick(quadrant, number)}
                  className={`
                    p-2 text-sm border rounded
                    ${isSelected(quadrant, number)
                      ? 'bg-indigo-600 text-white border-indigo-700'
                      : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                    }
                  `}
                >
                  {toothNumber}
                </button>
              );
            })}
          </div>
        ))}
        
        {/* Нижний ряд (квадранты 3 и 4) */}
        {[3, 4].map(quadrant => (
          <div key={quadrant} className="col-span-4 grid grid-cols-8 gap-1">
            {[1, 2, 3, 4, 5, 6, 7, 8].map(number => {
              const toothNumber = `${quadrant}${number}`;
              return (
                <button
                  key={toothNumber}
                  type="button"
                  onClick={() => handleToothClick(quadrant, number)}
                  className={`
                    p-2 text-sm border rounded
                    ${isSelected(quadrant, number)
                      ? 'bg-indigo-600 text-white border-indigo-700'
                      : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                    }
                  `}
                >
                  {toothNumber}
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
