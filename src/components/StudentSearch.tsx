import React, { useState, useEffect, useRef } from 'react';
import { MasterSiswa } from '../types';
import { Search, UserCheck, Filter, ChevronDown, Check, X, ShieldAlert, CheckSquare, Users } from 'lucide-react';

interface StudentSearchProps {
  siswaList: MasterSiswa[];
  selectedSiswaList: MasterSiswa[];
  onSelectSiswaList: (siswaList: MasterSiswa[]) => void;
}

export const StudentSearch: React.FC<StudentSearchProps> = ({
  siswaList,
  selectedSiswaList,
  onSelectSiswaList
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [classFilter, setClassFilter] = useState('ALL');
  const [genderFilter, setGenderFilter] = useState('ALL');
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Extract unique classes for filter sorted naturally by grade level
  const classes = Array.from(new Set(siswaList.map(s => s.Kelas).filter(Boolean)))
    .map(c => String(c))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));

  // Extract unique genders for filter
  const genders = Array.from(new Set(siswaList.map(s => s.Gender).filter(Boolean)))
    .map(g => String(g))
    .sort();

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Filter students by Search Term (Name, NIS, Class, Halaqah), Class Filter, and Gender Filter
  const filteredSiswa = siswaList.filter(s => {
    const matchesSearch = 
      s.Nama_Siswa.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.ID_Siswa.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.Kelas.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (s.Kelompok_Halaqah && s.Kelompok_Halaqah.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesClass = classFilter === 'ALL' || s.Kelas === classFilter;
    const matchesGender = genderFilter === 'ALL' || s.Gender === genderFilter;

    return matchesSearch && matchesClass && matchesGender;
  });

  // Check if ALL currently filtered students are selected
  const isAllFilteredSelected = 
    filteredSiswa.length > 0 && 
    filteredSiswa.every(s => selectedSiswaList.some(sel => sel.ID_Siswa === s.ID_Siswa));

  // Toggle "Select All Filtered / Select Class"
  const handleToggleSelectAll = () => {
    if (isAllFilteredSelected) {
      // Deselect all filtered students
      const filteredNisSet = new Set(filteredSiswa.map(s => s.ID_Siswa));
      onSelectSiswaList(selectedSiswaList.filter(s => !filteredNisSet.has(s.ID_Siswa)));
    } else {
      // Select all filtered students (merge avoiding duplicates)
      const selectedNisSet = new Set(selectedSiswaList.map(s => s.ID_Siswa));
      const toAdd = filteredSiswa.filter(s => !selectedNisSet.has(s.ID_Siswa));
      onSelectSiswaList([...selectedSiswaList, ...toAdd]);
    }
  };

  // Toggle individual student selection
  const handleToggleStudent = (siswa: MasterSiswa) => {
    const isSelected = selectedSiswaList.some(s => s.ID_Siswa === siswa.ID_Siswa);
    if (isSelected) {
      onSelectSiswaList(selectedSiswaList.filter(s => s.ID_Siswa !== siswa.ID_Siswa));
    } else {
      onSelectSiswaList([...selectedSiswaList, siswa]);
    }
  };

  // Remove individual student from selection chip
  const handleRemoveStudent = (idSiswa: string) => {
    onSelectSiswaList(selectedSiswaList.filter(s => s.ID_Siswa !== idSiswa));
  };

  // Clear all selections
  const handleClearAll = () => {
    onSelectSiswaList([]);
    setSearchTerm('');
  };

  // Format search input text display
  const getInputValue = () => {
    if (selectedSiswaList.length === 1) {
      const s = selectedSiswaList[0];
      return `${s.Nama_Siswa} - ${s.Kelas} - NIS: ${s.ID_Siswa}`;
    }
    if (selectedSiswaList.length > 1) {
      return `${selectedSiswaList.length} Siswa Terpilih ${classFilter !== 'ALL' ? `(Kelas ${classFilter})` : ''}`;
    }
    return searchTerm;
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 p-3.5 sm:p-5 mb-4 sm:mb-6" ref={containerRef}>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 sm:gap-4">
        
        {/* Title */}
        <div className="flex items-center gap-2.5 sm:gap-3">
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-blue-100 text-[#1E3A8A] flex items-center justify-center font-bold shrink-0">
            <Users className="w-4 h-4 sm:w-5 sm:h-5 text-[#1E3A8A]" />
          </div>
          <div>
            <h2 className="text-sm sm:text-base font-extrabold text-slate-900 tracking-tight">
              Pencarian & Pemilihan Siswa
            </h2>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Pilih 1 siswa atau centang sekelas/multiple siswa untuk input massal
            </p>
          </div>
        </div>

        {/* Filter Kelas, Filter Gender & Quick Checkbox Sekelas */}
        <div className="grid grid-cols-1 xs:grid-cols-2 sm:flex sm:flex-wrap items-center gap-2 sm:gap-2.5 w-full md:w-auto">
          <div className="flex items-center justify-between sm:justify-start gap-2 bg-slate-100 hover:bg-slate-200/80 border border-slate-300 rounded-xl px-3 py-2 transition-colors min-h-[40px]">
            <div className="flex items-center gap-1.5 min-w-0">
              <Filter className="w-3.5 h-3.5 text-slate-500 shrink-0" />
              <span className="text-xs font-bold text-slate-700 whitespace-nowrap">Kelas:</span>
            </div>
            <select
              value={classFilter}
              onChange={(e) => setClassFilter(e.target.value)}
              className="text-xs font-extrabold text-[#1E3A8A] bg-transparent focus:outline-none cursor-pointer text-right sm:text-left pr-1 min-w-0 truncate"
            >
              <option value="ALL">Semua ({siswaList.length})</option>
              {classes.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center justify-between sm:justify-start gap-2 bg-slate-100 hover:bg-slate-200/80 border border-slate-300 rounded-xl px-3 py-2 transition-colors min-h-[40px]">
            <div className="flex items-center gap-1.5 min-w-0">
              <Users className="w-3.5 h-3.5 text-slate-500 shrink-0" />
              <span className="text-xs font-bold text-slate-700 whitespace-nowrap">Gender:</span>
            </div>
            <select
              value={genderFilter}
              onChange={(e) => setGenderFilter(e.target.value)}
              className="text-xs font-extrabold text-[#1E3A8A] bg-transparent focus:outline-none cursor-pointer text-right sm:text-left pr-1 min-w-0 truncate"
            >
              <option value="ALL">Semua</option>
              {genders.map(g => (
                <option key={g} value={g}>{g}</option>
              ))}
            </select>
          </div>

          {/* Quick Checkbox Sekelas */}
          <button
            type="button"
            onClick={handleToggleSelectAll}
            disabled={filteredSiswa.length === 0}
            className={`flex items-center justify-center sm:justify-start gap-2 px-3 py-2 rounded-xl text-xs font-extrabold transition-all border min-h-[40px] ${
              isAllFilteredSelected
                ? 'bg-[#1E3A8A] text-white border-blue-900 shadow-xs'
                : 'bg-blue-50 text-[#1E3A8A] border-blue-200 hover:bg-blue-100/80'
            } ${filteredSiswa.length === 0 ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
            title={classFilter !== 'ALL' || genderFilter !== 'ALL' ? `Centang untuk memilih seluruh siswa yang sudah difilter` : 'Centang untuk memilih semua siswa'}
          >
            <input
              type="checkbox"
              checked={isAllFilteredSelected}
              onChange={() => {}} // Handled by button onClick
              className="w-4 h-4 text-[#1E3A8A] rounded border-slate-300 focus:ring-[#1E3A8A] cursor-pointer"
            />
            <span className="truncate">
              {classFilter !== 'ALL' || genderFilter !== 'ALL' ? `Pilih Yang Tampil (${filteredSiswa.length})` : `Pilih Semua (${filteredSiswa.length})`}
            </span>
          </button>
        </div>

      </div>

      {/* Autocomplete Search Input */}
      <div className="mt-3 sm:mt-4 relative">
        <div className="relative">
          <input
            type="text"
            value={getInputValue()}
            onFocus={() => setIsOpen(true)}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setIsOpen(true);
            }}
            placeholder="Ketik Nama, NIS, atau Kelas..."
            className={`w-full pl-10 pr-20 py-3 text-base sm:text-sm font-semibold rounded-xl border transition-all min-h-[44px] ${
              selectedSiswaList.length > 0
                ? 'bg-blue-50/80 border-[#1E3A8A] text-[#1E3A8A] shadow-xs'
                : 'bg-slate-50 border-slate-300 text-slate-900 focus:bg-white focus:border-[#1E3A8A] focus:ring-2 focus:ring-blue-100'
            }`}
          />
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            {selectedSiswaList.length > 0 ? (
              <UserCheck className="w-4 h-4 sm:w-5 sm:h-5 text-[#1E3A8A]" />
            ) : (
              <Search className="w-4 h-4 sm:w-5 sm:h-5 text-slate-400" />
            )}
          </div>

          <div className="absolute inset-y-0 right-0 pr-2 flex items-center gap-1">
            {selectedSiswaList.length > 0 && (
              <button
                type="button"
                onClick={handleClearAll}
                className="p-2 text-slate-400 hover:text-rose-600 rounded-lg transition-colors min-w-[36px] min-h-[36px] flex items-center justify-center"
                title="Hapus semua pilihan siswa"
              >
                <X className="w-4 h-4" />
              </button>
            )}
            <button
              type="button"
              onClick={() => setIsOpen(!isOpen)}
              className="p-2 text-slate-400 hover:text-slate-600 rounded-lg transition-colors min-w-[36px] min-h-[36px] flex items-center justify-center"
            >
              <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
            </button>
          </div>
        </div>

        {/* Dropdown Options List with Checkboxes */}
        {isOpen && (
          <div className="absolute left-0 right-0 mt-2 bg-white rounded-xl shadow-2xl border border-slate-200 z-50 max-h-80 overflow-y-auto divide-y divide-slate-100 animate-fade-in">
            {/* Dropdown Header Bar */}
            <div className="sticky top-0 bg-slate-100 px-4 py-2.5 border-b border-slate-200 flex items-center justify-between gap-2 z-10">
              <label className="flex items-center gap-2 text-xs font-bold text-slate-800 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isAllFilteredSelected}
                  onChange={handleToggleSelectAll}
                  className="w-4 h-4 text-[#1E3A8A] rounded border-slate-300 focus:ring-[#1E3A8A] cursor-pointer"
                />
                <span>
                  Pilih Semua ({filteredSiswa.length} Siswa{classFilter !== 'ALL' ? ` Kelas ${classFilter}` : ''}{genderFilter !== 'ALL' ? ` ${genderFilter}` : ''})
                </span>
              </label>
              <span className="text-[11px] font-extrabold text-[#1E3A8A] bg-blue-100 px-2.5 py-0.5 rounded-full">
                {selectedSiswaList.length} Terpilih
              </span>
            </div>

            {filteredSiswa.length > 0 ? (
              filteredSiswa.map((siswa) => {
                const isSelected = selectedSiswaList.some(s => s.ID_Siswa === siswa.ID_Siswa);

                return (
                  <div
                    key={siswa.ID_Siswa}
                    onClick={() => handleToggleStudent(siswa)}
                    className={`w-full text-left px-4 py-3 hover:bg-blue-50/80 transition-colors flex items-center justify-between gap-3 min-h-[56px] cursor-pointer ${
                      isSelected ? 'bg-blue-100/70 border-l-4 border-[#1E3A8A]' : ''
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => {}} // Handled by row onClick
                        className="w-4.5 h-4.5 text-[#1E3A8A] rounded border-slate-300 focus:ring-[#1E3A8A] cursor-pointer shrink-0"
                      />
                      <div className="flex flex-col gap-0.5 min-w-0">
                        <span className="text-sm font-extrabold block text-slate-900 truncate">
                          {siswa.Nama_Siswa}
                        </span>
                        <div className="flex items-center gap-2 text-xs">
                          <span className="font-bold text-[#1E3A8A] block truncate">
                            {siswa.Kelas}
                          </span>
                          <span className="text-slate-300">•</span>
                          <span className="text-[11px] font-medium text-slate-500 block truncate">
                            NIS: {siswa.ID_Siswa}
                          </span>
                        </div>
                      </div>
                    </div>

                    {isSelected && (
                      <Check className="w-5 h-5 text-[#1E3A8A] shrink-0" />
                    )}
                  </div>
                );
              })
            ) : (
              <div className="p-6 text-center text-slate-500">
                <ShieldAlert className="w-8 h-8 text-amber-500 mx-auto mb-2" />
                <p className="text-xs font-semibold">Tidak ada siswa yang cocok dengan kata kunci.</p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Coba kata kunci lain atau pilih filter "Semua Kelas".
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Selected Students Cards / Chips Display */}
      {selectedSiswaList.length > 0 && (
        <div className="mt-3.5 bg-gradient-to-r from-blue-50/90 via-slate-50 to-amber-50/40 p-3.5 sm:p-4 rounded-xl border border-blue-200/90 animate-fade-in space-y-2.5">
          <div className="flex items-center justify-between gap-2 flex-wrap border-b border-blue-200/60 pb-2">
            <div className="flex items-center gap-2">
              <CheckSquare className="w-4 h-4 text-[#1E3A8A]" />
              <span className="text-xs font-extrabold text-[#1E3A8A] uppercase tracking-wide">
                {selectedSiswaList.length === 1
                  ? '1 Siswa Terpilih (Input Single)'
                  : `${selectedSiswaList.length} Siswa Terpilih (Input Massal)`}
              </span>
            </div>
            <button
              type="button"
              onClick={handleClearAll}
              className="text-[11px] font-bold text-rose-600 hover:text-rose-800 hover:bg-rose-100/60 px-2.5 py-1 rounded-lg transition-colors flex items-center gap-1"
            >
              <X className="w-3.5 h-3.5" />
              Reset Pilihan
            </button>
          </div>

          {/* Chips list */}
          <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto pr-1">
            {selectedSiswaList.map((s) => (
              <span
                key={s.ID_Siswa}
                className="inline-flex items-center gap-1.5 bg-white text-slate-800 text-xs font-bold px-2.5 py-1 rounded-lg border border-slate-300 shadow-2xs"
              >
                <span>{s.Nama_Siswa}</span>
                <span className="text-[10px] text-[#1E3A8A] font-extrabold bg-blue-100 px-1.5 py-0.2 rounded">
                  {s.Kelas}
                </span>
                <button
                  type="button"
                  onClick={() => handleRemoveStudent(s.ID_Siswa)}
                  className="text-slate-400 hover:text-rose-600 ml-0.5 p-0.5 rounded"
                  title="Hapus siswa ini dari pilihan"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>
        </div>
      )}

    </div>
  );
};
