// // app/(dashboard)/layout.tsx
// import { cookies } from 'next/headers';
// import { redirect } from 'next/navigation';
// import DashboardClientLayout from './DashboardClientLayout';

// export default async function DashboardLayout({
//   children,
// }: {
//   children: React.ReactNode;
// }) {
//   // 1. Ambil cookie autentikasi di level server
//   const cookieStore = await cookies();
//   const token = cookieStore.get('auth_token')?.value;

//   // 2. Proteksi Server-Side: Lempar ke /login jika token tidak ditemukan
//   if (!token) {
//     redirect('/login');
//   }

//   // 3. Render UI Dashboard jika user terautentikasi
//   return <DashboardClientLayout>{children}</DashboardClientLayout>;
// }





//// CODINGAN SEMENTARA TANPA LOGIN //////
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import DashboardClientLayout from './DashboardClientLayout';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // --- MULAI BYPASS LOGIN SEMENTARA ---
  /* 
  // 1. Ambil cookie autentikasi di level server
  const cookieStore = await cookies();
  const token = cookieStore.get('auth_token')?.value;

  // 2. Proteksi Server-Side: Lempar ke /login jika token tidak ditemukan
  if (!token) {
    redirect('/login');
  }
  */
  // --- AKHIR BYPASS LOGIN SEMENTARA ---

  // 3. Render UI Dashboard langsung tanpa peduli auth
  return <DashboardClientLayout>{children}</DashboardClientLayout>;
}