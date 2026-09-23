import { create } from 'zustand';

interface MatchingAsnStore {
  matchingResult: any | null;
  fileNameSeAsn: string;
  fileNameAsnKota: string;
  setMatchingResult: (result: any, seAsnName: string, asnKotaName: string) => void;
  clearResult: () => void;
}

export const useMatchingAsnStore = create<MatchingAsnStore>((set) => ({
  matchingResult: null,
  fileNameSeAsn: 'SE_ASN.csv',
  fileNameAsnKota: 'ASN_Kota.csv',

  // Fungsi untuk menyimpan hasil beserta nama file aslinya
  setMatchingResult: (result, seAsnName, asnKotaName) =>
    set({ matchingResult: result, fileNameSeAsn: seAsnName, fileNameAsnKota: asnKotaName }),

  // Fungsi untuk mengosongkan hasil saat memulai matching baru
  clearResult: () =>
    set({ matchingResult: null, fileNameSeAsn: 'SE_ASN.csv', fileNameAsnKota: 'ASN_Kota.csv' }),
}));
