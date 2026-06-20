import React, { Fragment } from 'react';
import { Listbox, Transition } from '@headlessui/react';
import { Check, ChevronsUpDown } from 'lucide-react';

export interface SelectOption {
  value: string;
  label: string;
}

interface CustomSelectProps {
  options: SelectOption[];
  value: string;
  onChange: (value: string) => void;
  label?: string;
}

export const CustomSelect: React.FC<CustomSelectProps> = ({ options, value, onChange, label }) => {
  const selectedOption = options.find(option => option.value === value);

  return (
    <div className="w-full">
      {label && <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>{label}</label>}
      <Listbox value={value} onChange={onChange}>
        <div className="relative">
          <Listbox.Button className="relative w-full cursor-default rounded-md py-2 pl-3 pr-10 text-left border shadow-sm focus:outline-none focus-visible:ring-2 sm:text-sm"
                          style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-primary)', color: 'var(--text-primary)' }}>
            <span className="block truncate">{selectedOption?.label}</span>
            <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
              <ChevronsUpDown className="h-5 w-5" style={{ color: 'var(--text-muted)' }} aria-hidden="true" />
            </span>
          </Listbox.Button>
          <Transition
            as={Fragment}
            leave="transition ease-in duration-100"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <Listbox.Options className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-md py-1 text-base shadow-lg focus:outline-none sm:text-sm"
                             style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-primary)' }}>
              {options.map((option) => (
                <Listbox.Option
                  key={option.value}
                  className={({ active }) =>
                    `relative cursor-default select-none py-2 pl-10 pr-4 ${active ? 'bg-[var(--interactive-hover)]' : ''}`
                  }
                  style={{ color: 'var(--text-primary)' }}
                  value={option.value}
                >
                  {({ selected }) => (
                    <>
                      <span className={`block truncate ${selected ? 'font-medium' : 'font-normal'}`}>
                        {option.label}
                      </span>
                      {selected ? (
                        <span className="absolute inset-y-0 left-0 flex items-center pl-3" style={{ color: 'var(--text-primary)' }}>
                          <Check className="h-5 w-5" aria-hidden="true" />
                        </span>
                      ) : null}
                    </>
                  )}
                </Listbox.Option>
              ))}
            </Listbox.Options>
          </Transition>
        </div>
      </Listbox>
    </div>
  );
};
