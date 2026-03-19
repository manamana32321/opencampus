export default function LoginPage() {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

  return (
    <main className="flex min-h-screen items-center justify-center bg-black text-white">
      <div className="text-center space-y-8">
        <h1 className="text-4xl font-bold">OpenCampus</h1>
        <p className="text-zinc-400">강의 자료 통합 관리 허브</p>
        <a
          href={`${apiUrl}/auth/google`}
          className="inline-block rounded-lg bg-white px-6 py-3 text-black font-medium hover:bg-zinc-200 transition"
        >
          Google로 로그인
        </a>
      </div>
    </main>
  );
}
