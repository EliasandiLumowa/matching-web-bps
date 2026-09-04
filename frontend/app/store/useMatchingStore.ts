import { create } from 'zustand';

interface MatchingStore {
  matchingResult: any | null;
  fileNameMaster: string;
  fileNameScraping: string;
  setMatchingResult: (result: any, masterName: string, scrapingName: string) => void;
  clearResult: () => void;
}

export const useMatchingStore = create<MatchingStore>((set) => ({
  matchingResult: null,
  fileNameMaster: 'Master.csv',
  fileNameScraping: 'Scraping.csv',
  
  // Fungsi untuk menyimpan hasil beserta nama file aslinya
  setMatchingResult: (result, masterName, scrapingName) => 
    set({ matchingResult: result, fileNameMaster: masterName, fileNameScraping: scrapingName }),
    
  // Fungsi untuk mengosongkan hasil saat memulai matching baru
  clearResult: () => 
    set({ matchingResult: null, fileNameMaster: 'Master.csv', fileNameScraping: 'Scraping.csv' }),
}));